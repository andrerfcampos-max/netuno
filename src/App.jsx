import { useState, useMemo, useEffect } from 'react';
import { Upload, GitMerge, FolderOpen } from 'lucide-react';
import { parseHydrantsCSV } from './utils/csvParser';
import MapComponent from './components/MapComponent';
import FilterBar from './components/FilterBar';
import InspectionModal from './components/InspectionModal';
import DataTable from './components/DataTable';
import MissionRoutePanel from './components/MissionRoutePanel';
import MissionReportPanel from './components/MissionReportPanel';
import MissionTabs from './components/MissionTabs';
import MissionManagerModal from './components/MissionManagerModal';
import { loadPreloadedDatabase } from './utils/xlsxParser';
import { loadMissions, saveMissions, createNewMission } from './utils/storage';

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('netuno_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [hidrantes, setHidrantes] = useState([]);
  const [filteredList, setFilteredList] = useState([]);
  const [isFilterVisible, setIsFilterVisible] = useState(true);
  const [activeView, setActiveView] = useState('map'); // 'map' | 'table' | 'route' | 'report'
  const [activeFilters, setActiveFilters] = useState({});
  const [inspectingHidrante, setInspectingHidrante] = useState(null);
  const [lastInspectedCoords, setLastInspectedCoords] = useState(null);
  const [mapCenterPosition, setMapCenterPosition] = useState(null);
  
  // Controle de Missões Persistentes
  const [missions, setMissions] = useState(loadMissions());
  const [openMissionIds, setOpenMissionIds] = useState([]);
  const [activeMissionId, setActiveMissionId] = useState(null);
  const [isMissionManagerOpen, setIsMissionManagerOpen] = useState(false);

  // Derivações da Missão Ativa
  const currentMission = missions.find(m => m.id === activeMissionId);
  const selectedMissionIds = currentMission?.selectedIds || [];
  const completedMissionIds = currentMission?.completedIds || [];

  // Sincroniza estado de missões com LocalStorage sempre que alterar
  useEffect(() => {
    saveMissions(missions);
  }, [missions]);

  // Hidratação por Link Mágico (?ds=ID1,ID2) e Carregamento Automático
  useEffect(() => {
    // 1. Carregar Base Pre-carregada automaticamente se estiver vazio
    if (hidrantes.length === 0) {
      loadPreloadedDatabase((data) => {
        if (data.length > 0) {
          setHidrantes(data);
          setFilteredList(data);
        }
      });
    }

    // 2. Link Mágico
    const params = new URLSearchParams(window.location.search);
    const ds = params.get('ds');
    if (ds) {
      const ids = ds.split(',').filter(Boolean);
      if (ids.length > 0) {
        // Cria uma nova missão com esses IDs importados
        const newMission = createNewMission("Missão Importada");
        newMission.selectedIds = ids;
        newMission.createdBy = currentUser?.matricula;
        setMissions(prev => [...prev, newMission]);
        setOpenMissionIds(prev => [...prev, newMission.id]);
        setActiveMissionId(newMission.id);
        setActiveView('route');
        // Limpa a URL para não duplicar no F5
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [hidrantes.length]);

  const updateCurrentMission = (updates) => {
    if (!activeMissionId) return;
    setMissions(prev => prev.map(m => m.id === activeMissionId ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m));
  };

  const toggleMissionSelection = (id) => {
    let currentId = activeMissionId;
    let currentSel = selectedMissionIds;
    let currentComp = completedMissionIds;

    // Se tentar adicionar mas não tiver missão ativa, cria uma automaticamente
    if (!currentId) {
      const newMission = createNewMission();
      newMission.createdBy = currentUser?.matricula;
      setMissions(prev => [...prev, newMission]);
      setOpenMissionIds(prev => [...prev, newMission.id]);
      setActiveMissionId(newMission.id);
      currentId = newMission.id;
      currentSel = [];
      currentComp = [];
    }

    const newSelected = currentSel.includes(id) 
      ? currentSel.filter(missionId => missionId !== id) 
      : [...currentSel, id];
    
    const newCompleted = currentSel.includes(id)
      ? currentComp.filter(cId => cId !== id)
      : currentComp;

    // Atualiza o estado
    setMissions(prev => prev.map(m => m.id === currentId ? { ...m, selectedIds: newSelected, completedIds: newCompleted, updatedAt: new Date().toISOString() } : m));
  };

  const selectAllFiltered = (isChecked, currentFilteredData) => {
    let currentId = activeMissionId;
    let currentSel = selectedMissionIds;
    let currentComp = completedMissionIds;

    if (!currentId) {
      const newMission = createNewMission();
      newMission.createdBy = currentUser?.matricula;
      setMissions(prev => [...prev, newMission]);
      setOpenMissionIds(prev => [...prev, newMission.id]);
      setActiveMissionId(newMission.id);
      currentId = newMission.id;
      currentSel = [];
      currentComp = [];
    }

    const filteredIds = currentFilteredData.map(h => h.codHidrante || h.nomHidrante);
    
    if (isChecked) {
      const idsToAdd = filteredIds.filter(id => !currentSel.includes(id));
      setMissions(prev => prev.map(m => m.id === currentId ? { ...m, selectedIds: [...currentSel, ...idsToAdd], updatedAt: new Date().toISOString() } : m));
    } else {
      const newSelected = currentSel.filter(id => !filteredIds.includes(id));
      const newCompleted = currentComp.filter(id => !filteredIds.includes(id));
      setMissions(prev => prev.map(m => m.id === currentId ? { ...m, selectedIds: newSelected, completedIds: newCompleted, updatedAt: new Date().toISOString() } : m));
    }
  };

  const parseDate = (dateStr) => {
    if (!dateStr || dateStr === '-') return null;
    const [datePart] = dateStr.split(' ');
    const parts = datePart.split('/');
    if (parts.length === 3) {
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return null;
  };

  const getFilteredData = (filters, dataList = hidrantes) => {
    let result = [...dataList];
    if (filters.buscaGeral) {
      const termo = filters.buscaGeral.toLowerCase();
      result = result.filter(h => 
        (h.dscEndereco && h.dscEndereco.toLowerCase().includes(termo)) ||
        (h.nomHidrante && h.nomHidrante.toLowerCase().includes(termo)) ||
        (h.dscPontoReferencia && h.dscPontoReferencia.toLowerCase().includes(termo))
      );
    }
    if (filters.ra) {
      result = result.filter(h => h.dscLocalidade === filters.ra);
    }
    if (filters.periodo) {
      result = result.filter(h => {
        const d = parseDate(h.datHoraUltimaVistoria);
        if (!d) return false;
        
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        
        if (filters.periodo === 'hoje') {
          return d.getTime() === hoje.getTime();
        } else if (filters.periodo === 'semana') {
          const start = new Date(hoje);
          start.setDate(start.getDate() - start.getDay());
          return d >= start;
        } else if (filters.periodo === 'mes') {
          return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
        } else if (filters.periodo === 'ano_atual') {
          return d.getFullYear() === hoje.getFullYear();
        } else if (filters.periodo.startsWith('ano-')) {
          const targetYear = parseInt(filters.periodo.split('-')[1]);
          return d.getFullYear() === targetYear;
        } else if (filters.periodo === 'personalizado') {
          if (filters.dataInicio) {
            // Usa 'T00:00:00' para evitar shift de timezone no Date constructor
            const start = new Date(filters.dataInicio + 'T00:00:00');
            if (d < start) return false;
          }
          if (filters.dataFim) {
            const end = new Date(filters.dataFim + 'T23:59:59');
            if (d > end) return false;
          }
          return true;
        }
        return true;
      });
    }
    if (filters.status && filters.status !== 'Todos') {
      const isOperante = filters.status === 'Operante';
      result = result.filter(h => h.flgAtivo === isOperante);
    }
    if (filters.problema) {
      result = result.filter(h => h.problemasHidrante === filters.problema);
    }
    return result;
  };

  // Extrair Regiões (RAs) únicas dinamicamente
  const regions = useMemo(() => {
    const filtersWithoutRA = { ...activeFilters, ra: '' };
    const dataForRA = getFilteredData(filtersWithoutRA, hidrantes);
    const r = new Set(dataForRA.map(h => h.dscLocalidade).filter(Boolean));
    return Array.from(r).sort();
  }, [hidrantes, activeFilters]);

  // Extrair Anos únicos dinamicamente
  const anosVistoria = useMemo(() => {
    const filtersWithoutAno = { ...activeFilters, periodo: '', dataInicio: '', dataFim: '' };
    const dataForAno = getFilteredData(filtersWithoutAno, hidrantes);
    
    const anos = new Set();
    dataForAno.forEach(h => {
      if (h.datHoraUltimaVistoria && h.datHoraUltimaVistoria !== '-') {
        // Assume formato DD/MM/YYYY ou similar que contenha o ano com 4 dígitos
        const match = h.datHoraUltimaVistoria.match(/\b(20\d{2})\b/);
        if (match) anos.add(match[1]);
      }
    });
    return Array.from(anos).sort((a, b) => b - a); // decrescente
  }, [hidrantes, activeFilters]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      parseHydrantsCSV(file, (data) => {
        setHidrantes(data);
        setFilteredList(data);
      });
    }
  };

  const applyFilters = (filters, dataList = hidrantes) => {
    setFilteredList(getFilteredData(filters, dataList));
  };

  const handleFilterChange = (filters) => {
    setActiveFilters(filters);
    applyFilters(filters, hidrantes);
  };

  const handleSaveInspection = (updatedHidrante) => {
    const newHidrantes = hidrantes.map(h => {
      if (h._internalId === updatedHidrante._internalId || 
         (h.nomHidrante === updatedHidrante.nomHidrante && h.codHidrante === updatedHidrante.codHidrante)) {
        return updatedHidrante;
      }
      return h;
    });
    setHidrantes(newHidrantes);
    
    const id = updatedHidrante.codHidrante || updatedHidrante.nomHidrante;
    if (activeMissionId && selectedMissionIds.includes(id) && !completedMissionIds.includes(id)) {
      updateCurrentMission({ completedIds: [...completedMissionIds, id] });
    }

    applyFilters(activeFilters, newHidrantes);
    setLastInspectedCoords({ lat: updatedHidrante.numLatitude, lng: updatedHidrante.numLongitude });
    setInspectingHidrante(null);
  };

  // ---- Controle de Missões ----
  const handleNewMission = () => {
    const newMission = createNewMission();
    newMission.createdBy = currentUser?.matricula;
    setMissions(prev => [...prev, newMission]);
    setOpenMissionIds(prev => [...prev, newMission.id]);
    setActiveMissionId(newMission.id);
  };

  const handleOpenMission = (id) => {
    if (!openMissionIds.includes(id)) {
      setOpenMissionIds(prev => [...prev, id]);
    }
    setActiveMissionId(id);
  };

  const handleCloseTab = (id) => {
    const newOpen = openMissionIds.filter(mid => mid !== id);
    setOpenMissionIds(newOpen);
    if (activeMissionId === id) {
      setActiveMissionId(newOpen.length > 0 ? newOpen[0] : null);
    }
  };

  const handleDeleteMission = (id) => {
    setMissions(prev => prev.filter(m => m.id !== id));
    handleCloseTab(id);
  };

  const handleLogout = () => {
    localStorage.removeItem('netuno_user');
    setCurrentUser(null);
    setOpenMissionIds([]);
    setActiveMissionId(null);
    setActiveView('map');
  };

  // Sessão de 8h e renovação silenciosa
  useEffect(() => {
    if (!currentUser) return;

    const checkSession = () => {
      const saved = localStorage.getItem('netuno_user');
      if (saved) {
        const user = JSON.parse(saved);
        if (user.expiresAt && Date.now() > user.expiresAt) {
          handleLogout();
          alert('Sua sessão expirou por inatividade. Faça login novamente.');
        }
      }
    };

    // Estende a sessão em 8 horas
    const extendSession = () => {
      const saved = localStorage.getItem('netuno_user');
      if (saved) {
        const user = JSON.parse(saved);
        user.expiresAt = Date.now() + 8 * 60 * 60 * 1000;
        localStorage.setItem('netuno_user', JSON.stringify(user));
        setCurrentUser(user);
      }
    };

    // Checa a cada 5 minutos
    const interval = setInterval(checkSession, 5 * 60 * 1000);

    // Renova na interação, com "throttle" rudimentar para não inundar o localStorage
    let throttleTimer;
    const handleActivity = () => {
      if (!throttleTimer) {
        extendSession();
        throttleTimer = setTimeout(() => { throttleTimer = null; }, 60000); // 1 min throttle
      }
    };

    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('scroll', handleActivity);

    // Checa na montagem inicial se já estava expirado
    checkSession();

    return () => {
      clearInterval(interval);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, [currentUser?.matricula]); // Depende apenas da matrícula para não refazer os listeners atoa

  const handleLogin = (e) => {
    e.preventDefault();
    const mat = e.target.matricula.value;
    const senha = e.target.senha.value;
    
    // Simulação do backend
    if (senha !== '123' && senha !== 'senha123' && senha !== 'admin') {
      alert('Senha incorreta para testes. (Dica: use 123)');
      return;
    }

    let user = null;
    if (mat === '123') {
      user = { matricula: '123', nome: 'Vistoriador Silva', role: 'vistoriador' };
    } else if (mat === '456') {
      user = { matricula: '456', nome: 'Gestor Souza', role: 'gestor' };
    } else if (mat === '789') {
      user = { matricula: '789', nome: 'Gestor Oliveira', role: 'gestor' };
    }
    
    if (user) {
      user.expiresAt = Date.now() + 8 * 60 * 60 * 1000;
      localStorage.setItem('netuno_user', JSON.stringify(user));
      setCurrentUser(user);
    } else {
      alert('Matrícula inválida. Use 123 (Vistoriador), 456 ou 789 (Gestores).');
    }
  };

  if (!currentUser) {
    return (
      <div className="flex flex-col h-screen bg-slate-900 text-slate-100 font-sans items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-xl shadow-2xl border border-slate-700 w-full max-w-sm">
          <h1 className="text-3xl font-black tracking-tight text-emerald-400 drop-shadow-md text-center mb-2">NETUNO</h1>
          <p className="text-slate-400 text-center text-sm mb-6">Sistema de mapeamento de hidrantes urbanos de incêndio - SEHUR/GPCIU</p>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="text-slate-400 text-sm font-bold mb-2 block">Matrícula Militar</label>
              <input 
                name="matricula" 
                type="text" 
                defaultValue="456"
                autoComplete="off"
                className="w-full p-3 rounded bg-slate-900 border border-slate-600 text-white focus:outline-none focus:border-emerald-500 font-mono text-center text-lg tracking-widest" 
                placeholder="Ex: 123, 456, 789" 
                required 
              />
            </div>
            <div>
              <label className="text-slate-400 text-sm font-bold mb-2 block">Senha</label>
              <input 
                name="senha" 
                type="password" 
                defaultValue="123"
                autoComplete="off"
                className="w-full p-3 rounded bg-slate-900 border border-slate-600 text-white focus:outline-none focus:border-emerald-500 font-mono text-center text-lg tracking-widest" 
                placeholder="***" 
                required 
              />
            </div>
            <button type="submit" className="w-full py-3 bg-emerald-600 text-white font-bold rounded shadow-lg shadow-emerald-900/50 hover:bg-emerald-500 active:scale-95 transition-all mt-2">
              Acessar Sistema
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden">
      
      {inspectingHidrante && (
        <InspectionModal 
          hidrante={inspectingHidrante}
          onClose={() => setInspectingHidrante(null)}
          onSave={handleSaveInspection}
          currentUser={currentUser}
        />
      )}

      {/* Header com Botão de Upload */}
      <header className="flex justify-between items-center p-3 bg-slate-900 border-b border-slate-700 z-50">
        <h1 className="text-xl font-bold tracking-tight text-emerald-400 drop-shadow-md">NETUNO</h1>
        
        <div className="flex gap-2">
          <button 
            onClick={() => setIsMissionManagerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 text-emerald-400 font-semibold rounded shadow-sm hover:bg-slate-700 active:scale-95 transition-all"
          >
            <FolderOpen size={18} />
            <span className="hidden sm:inline">Central de Missões</span>
          </button>
        </div>
      </header>

      {/* TABS DE MISSÃO GLOBAL */}
      <MissionTabs 
        missions={missions}
        activeMissionId={activeMissionId}
        openMissionIds={openMissionIds}
        onTabClick={setActiveMissionId}
        onCloseTab={handleCloseTab}
        onNewMission={currentUser.role === 'gestor' ? handleNewMission : undefined}
        currentUser={currentUser}
      />

      <main className="flex-1 overflow-y-auto w-full flex flex-col relative p-2 gap-2">
        
        {/* MÓDULO 1: BARRA DE FILTROS */}
        {hidrantes.length > 0 && (
          <FilterBar onFilterChange={handleFilterChange} regions={regions} anos={anosVistoria} isVisible={isFilterVisible} currentUser={currentUser} onLogout={handleLogout} />
        )}

        {/* CONTROLES RETRÁTEIS */}
        <div className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur py-2 flex gap-2 w-full justify-center flex-wrap px-1 border-b border-slate-700/50 mb-2">
          <button 
            onClick={() => setIsFilterVisible(!isFilterVisible)}
            className={`flex-1 min-w-[80px] sm:min-w-[100px] py-2 px-2 border rounded-lg text-sm font-bold active:scale-95 transition-all shadow-sm ${
              isFilterVisible ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            Filtros
          </button>
          <button 
            onClick={() => setActiveView('map')}
            className={`flex-1 min-w-[80px] sm:min-w-[100px] py-2 px-2 border rounded-lg text-sm font-bold active:scale-95 transition-all shadow-sm ${
              activeView === 'map' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            Mapa
          </button>
          <button 
            onClick={() => setActiveView('table')}
            className={`flex-1 min-w-[80px] sm:min-w-[100px] py-2 px-2 border rounded-lg text-sm font-bold active:scale-95 transition-all shadow-sm ${
              activeView === 'table' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            Lista
          </button>
          <button 
            onClick={() => setActiveView('route')}
            className={`flex-1 min-w-[80px] sm:min-w-[100px] py-2 px-2 border rounded-lg text-sm font-bold active:scale-95 transition-all shadow-sm ${
              activeView === 'route' 
                ? 'bg-emerald-600 border-emerald-500 text-white' 
                : (!activeMissionId || selectedMissionIds.length === 0 
                   ? 'bg-slate-800 border-slate-700 text-slate-500 opacity-50' 
                   : 'bg-slate-800 border-slate-700 text-slate-300')
            }`}
            disabled={!activeMissionId}
          >
            Rota ({selectedMissionIds.length})
          </button>
          <button 
            onClick={() => setActiveView('report')}
            className={`flex-1 min-w-[80px] sm:min-w-[100px] py-2 px-2 border rounded-lg text-sm font-bold active:scale-95 transition-all shadow-sm ${
              activeView === 'report' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            Relatório
          </button>
        </div>

        {/* MÓDULO 2: MAPA TÁTICO INTEGRADO */}
        {activeView === 'map' && (
          <div className="w-full relative z-0 flex-1 flex-shrink-0 min-h-[400px]">
            <MapComponent 
              hidrantes={filteredList} 
              onInspect={(h) => setInspectingHidrante(h)}
              centerPosition={mapCenterPosition}
              selectedMissionIds={selectedMissionIds}
              onToggleMission={toggleMissionSelection}
              currentUser={currentUser}
            />
          </div>
        )}

        {/* MÓDULO 4: TABELA */}
        {activeView === 'table' && (
          <div className="w-full flex-1 flex-shrink-0 min-h-[400px] bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
            <DataTable 
              data={filteredList} 
              onInspect={(h) => setInspectingHidrante(h)}
              onCenterMap={(h) => {
                setMapCenterPosition(h);
                setActiveView('map');
              }} 
              selectedMissionIds={selectedMissionIds}
              onToggleMission={toggleMissionSelection}
              onSelectAllMission={selectAllFiltered}
              currentUser={currentUser}
            />
          </div>
        )}

        {/* MÓDULO ROTA DE MISSÃO */}
        {activeView === 'route' && activeMissionId && (
          <div id="modulo-rota" className="w-full relative z-10 flex-shrink-0 h-[65vh] min-h-[400px] max-h-[800px] border border-slate-700 rounded-xl overflow-hidden flex flex-col">
            <MissionRoutePanel 
              hidrantes={hidrantes}
              selectedMissionIds={selectedMissionIds}
              completedMissionIds={completedMissionIds}
              currentMission={currentMission}
              onUpdateMission={(updates) => updateCurrentMission(updates)}
              onClose={() => setActiveView('map')}
              onClearMission={() => updateCurrentMission({ selectedIds: [], completedIds: [] })}
              onRemoveFromMission={toggleMissionSelection}
              lastInspectedCoords={lastInspectedCoords} 
              onInspect={(h) => setInspectingHidrante(h)}
              onCenterMap={(h) => {
                setMapCenterPosition(h);
                setActiveView('map');
              }}
              currentUser={currentUser}
            />
          </div>
        )}

        {/* MÓDULO RELATÓRIO TÁTICO */}
        {activeView === 'report' && (
          <div id="modulo-relatorio" className="w-full relative z-10 flex-shrink-0 h-[65vh] min-h-[400px] max-h-[800px] border border-slate-700 rounded-xl flex flex-col">
            <MissionReportPanel 
              hidrantes={activeMissionId && selectedMissionIds.length > 0 ? hidrantes.filter(h => selectedMissionIds.includes(h.codHidrante || h.nomHidrante)) : filteredList}
              currentMission={currentMission}
              onClose={() => setActiveView('map')}
              currentUser={currentUser}
            />
          </div>
        )}
      </main>

      {/* Barramento de Seleção Inferior */}
      <footer className="bg-slate-900 border-t border-slate-700 p-3 flex justify-between items-center z-50">
        <div className="flex flex-col">
          <div className="text-sm font-semibold text-slate-400">
            {activeMissionId ? (
              <>
                <span className="text-emerald-400 font-bold">{selectedMissionIds.length}</span> hidrantes na {currentMission?.name} 
                {completedMissionIds.length > 0 && ` (${completedMissionIds.length} concluídos)`}
              </>
            ) : (
              <span>Selecione ou crie uma Missão na Central</span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 opacity-60 mt-0.5 tracking-wide">
            Desenvolvido por Sgt Roméro
          </span>
        </div>
        {selectedMissionIds.length > 0 && (
          <button 
            onClick={() => {
              setActiveView('route');
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded font-bold shadow-lg shadow-emerald-900/50 active:scale-95 transition-all animate-pulse"
          >
            IR PARA A ROTA
          </button>
        )}
      </footer>

      {isMissionManagerOpen && (
        <MissionManagerModal 
          missions={missions}
          openMissionIds={openMissionIds}
          onClose={() => setIsMissionManagerOpen(false)}
          onOpenMission={handleOpenMission}
          onNewMission={handleNewMission}
          onDeleteMission={handleDeleteMission}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}

export default App;
