import React, { useState, useEffect, useMemo } from 'react';
import { X, Target, Plus, CheckCircle, Trash2, FolderOpen, Folder, ChevronRight, Home, CornerUpLeft, FolderInput, FileSpreadsheet, Printer, BarChart3, Activity, Clock, CheckCircle2, Search, ArrowRight, Shield, Layers, Filter, Edit } from 'lucide-react';
import { createNewFolder } from '../utils/storage';
import { syncMissionToCloud, syncFolderToCloud } from '../services/syncService';
import { printMissionDraft } from '../utils/draftPrintUtils';

const MissionManagerModal = ({ missions, folders = [], openMissionIds = [], activeMissionId = null, hidrantes = [], onClose, onOpenMission, onNewMission, onDeleteMission, onFoldersChange, onMissionsChange, currentUser, isEmbedded = false }) => {
  const isGestor = currentUser?.role === 'gestor' || currentUser?.role === 'admin';
  const [activeTab, setActiveTab] = useState('todas'); // todas, nao_iniciadas, em_andamento, finalizadas, dashboard_comando
  const [searchTerm, setSearchTerm] = useState('');
  
  const [defaultFolderId, setDefaultFolderId] = useState(() => {
    return localStorage.getItem('netuno_default_folder') || null;
  });

  const [currentFolderId, setCurrentFolderId] = useState(() => {
    return localStorage.getItem('netuno_default_folder') || null;
  });

  const [isMoveMode, setIsMoveMode] = useState(false);
  const [missionToMove, setMissionToMove] = useState(null);
  const [missionToDelete, setMissionToDelete] = useState(null);
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [dashboardOnlyWithMissions, setDashboardOnlyWithMissions] = useState(false);

  // Set default (favorite) folder
  const handleSetDefaultFolder = () => {
    if (currentFolderId === defaultFolderId) {
      localStorage.removeItem('netuno_default_folder');
      setDefaultFolderId(null);
    } else {
      localStorage.setItem('netuno_default_folder', currentFolderId || '');
      setDefaultFolderId(currentFolderId);
    }
  };

  // Renomear pasta
  const handleRenameFolder = (folder, e) => {
    if (e) e.stopPropagation();
    const newName = prompt("Editar nome da pasta:", folder.name);
    if (newName && newName.trim() && newName.trim() !== folder.name) {
      const updatedFolder = { ...folder, name: newName.trim(), updatedAt: new Date().toISOString() };
      const updatedList = folders.map(f => f.id === folder.id ? updatedFolder : f);
      onFoldersChange(updatedList);
      syncFolderToCloud(updatedFolder);
    }
  };

  const handleRenameCurrentFolder = () => {
    const currentFolder = folders.find(f => f.id === currentFolderId);
    if (currentFolder) {
      handleRenameFolder(currentFolder);
    }
  };

  // Breadcrumbs
  const getBreadcrumbs = () => {
    const crumbs = [];
    const visited = new Set();
    let currentId = currentFolderId;
    while (currentId) {
      if (visited.has(currentId)) break; // Proteção contra loop infinito/tela preta
      visited.add(currentId);
      
      const f = folders.find(folder => folder.id === currentId);
      if (f) {
        crumbs.unshift({ id: f.id, name: f.name });
        currentId = f.parentFolderId;
      } else {
        break;
      }
    }
    return crumbs;
  };
  const breadcrumbs = getBreadcrumbs();

  const handleCreateFolder = () => {
    const name = prompt("Nome da nova pasta:");
    if (name && name.trim()) {
      const newFolder = createNewFolder(name.trim(), currentFolderId, currentUser?.matricula);
      onFoldersChange([...folders, newFolder]);
    }
  };

  const availableMissions = isGestor ? missions : missions.filter(m => !m.isDraft);

  // Estatísticas Consolidadas do Dashboard de Comando (Multiquartéis)
  const dashboardStats = useMemo(() => {
    let totalHidrantes = 0;
    let totalConcluidos = 0;
    let totalNaoIniciadas = 0;
    let totalEmAndamento = 0;
    let totalConcluidas = 0;

    const quartelStats = folders.map(folder => {
      const fMissions = availableMissions.filter(m => (m.parentFolderId || null) === folder.id);
      let qHidrantes = 0;
      let qConcluidos = 0;
      let qNaoIniciadas = 0;
      let qEmAndamento = 0;
      let qConcluidas = 0;

      const missionsDetail = fMissions.map(m => {
        const total = (m.selectedIds || []).length;
        const completed = (m.completedIds || []).filter(id => (m.selectedIds || []).includes(id)).length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        const status = total > 0 && completed >= total ? 'concluida' : completed > 0 ? 'em_andamento' : 'nao_iniciada';
        
        qHidrantes += total;
        qConcluidos += completed;
        if (status === 'concluida') qConcluidas++;
        else if (status === 'em_andamento') qEmAndamento++;
        else qNaoIniciadas++;

        return {
          id: m.id,
          name: m.name,
          atribuicao: m.atribuicao || 'Não atribuída',
          total,
          completed,
          percent,
          status,
          ratioText: `${completed}/${total}`
        };
      });

      totalHidrantes += qHidrantes;
      totalConcluidos += qConcluidos;
      totalNaoIniciadas += qNaoIniciadas;
      totalEmAndamento += qEmAndamento;
      totalConcluidas += qConcluidas;

      const progGeral = qHidrantes > 0 ? Math.round((qConcluidos / qHidrantes) * 100) : 0;

      return {
        folder,
        missions: missionsDetail,
        totalMissions: fMissions.length,
        totalHidrantes: qHidrantes,
        totalConcluidos: qConcluidos,
        naoIniciadas: qNaoIniciadas,
        emAndamento: qEmAndamento,
        concluidas: qConcluidas,
        progGeral
      };
    });

    const globalProgGeral = totalHidrantes > 0 ? Math.round((totalConcluidos / totalHidrantes) * 100) : 0;

    return {
      totalQuarteis: folders.length,
      totalMissions: availableMissions.length,
      totalHidrantes,
      totalConcluidos,
      totalNaoIniciadas,
      totalEmAndamento,
      totalConcluidas,
      globalProgGeral,
      quartelStats
    };
  }, [availableMissions, folders]);

  // Utilitário de ordenação alfabética com pasta favorita no topo
  const sortFoldersWithFavorite = (folderList, favId) => {
    return [...folderList].sort((a, b) => {
      const aIsFav = favId && a.id === favId;
      const bIsFav = favId && b.id === favId;
      if (aIsFav && !bIsFav) return -1;
      if (!aIsFav && bIsFav) return 1;
      return (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base', numeric: true });
    });
  };

  // Filtra as pastas e missões
  let displayMissions = [];
  let displayFolders = [];

  if (currentFolderId === null) {
    // Na pasta raiz: se houver busca, busca nomes de pastas e missões da raiz
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      displayFolders = folders.filter(f => (f.parentFolderId || null) === null && f.name.toLowerCase().includes(term));
      displayMissions = availableMissions.filter(m => (m.parentFolderId || null) === null && ((m.name?.toLowerCase() || '').includes(term) || (m.atribuicao?.toLowerCase() || '').includes(term)));
    } else {
      displayFolders = folders.filter(f => (f.parentFolderId || null) === null);
      displayMissions = availableMissions.filter(m => (m.parentFolderId || null) === null);
    }
  } else {
    // Dentro de uma subpasta: busca por digitação desativada, exibe apenas os itens daquela pasta
    displayFolders = folders.filter(f => f.parentFolderId === currentFolderId);
    displayMissions = availableMissions.filter(m => m.parentFolderId === currentFolderId);
  }

  // Ordena as pastas em ordem alfabética com a pasta favorita no topo
  displayFolders = sortFoldersWithFavorite(displayFolders, defaultFolderId);

  const filteredMissions = displayMissions.filter(m => {
    const total = (m.selectedIds || []).length;
    const completed = (m.completedIds || []).filter(id => (m.selectedIds || []).includes(id)).length;
    const isCompleted = total > 0 && completed >= total;
    const isNotStarted = completed === 0;
    const isPartial = !isNotStarted && !isCompleted;

    if (activeTab === 'todas') return true;
    if (activeTab === 'nao_iniciadas' && isNotStarted) return true;
    if (activeTab === 'em_andamento' && isPartial) return true;
    if (activeTab === 'finalizadas' && isCompleted) return true;
    return true;
  }).sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  const confirmDelete = () => {
    if (missionToDelete) {
      onDeleteMission(missionToDelete.id);
      setMissionToDelete(null);
    }
  };

  const handleExportPDFComando = () => {
    const printWindow = window.open('', '', 'width=1000,height=800');
    const today = new Date().toLocaleDateString('pt-BR');
    
    let html = `
      <html><head><title>Relatório - Dashboard de Comando Multiquartéis</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; line-height: 1.4; }
        h1 { text-align: center; color: #0f172a; margin-bottom: 4px; font-size: 18px; text-transform: uppercase; }
        h2 { text-align: center; color: #475569; font-size: 12px; margin-top: 0; margin-bottom: 20px; text-transform: uppercase; }
        .kpi-row { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 20px; }
        .kpi-box { flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; text-align: center; background: #f8fafc; }
        .kpi-title { font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase; }
        .kpi-val { font-size: 18px; font-weight: bold; color: #0f172a; margin-top: 2px; }
        
        .section-title { font-size: 14px; font-weight: bold; color: #0f172a; border-bottom: 2px solid #0f172a; padding-bottom: 4px; margin: 20px 0 12px 0; text-transform: uppercase; }
        .quartel-block { border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 14px; overflow: hidden; break-inside: avoid; }
        .quartel-header { background: #f1f5f9; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #cbd5e1; font-weight: bold; font-size: 12px; }
        .mission-row { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; font-size: 11px; }
        .mission-row:last-child { border-bottom: none; }
        .mission-name { flex: 1; font-weight: bold; color: #1e293b; }
        .mission-sub { font-size: 10px; color: #64748b; font-weight: normal; margin-top: 2px; }
        .mission-progress { width: 200px; margin: 0 12px; }
        .progress-bg { background: #e2e8f0; height: 14px; border-radius: 7px; overflow: hidden; position: relative; }
        .progress-fill { height: 100%; background: #3b82f6; }
        .progress-fill.complete { background: #10b981; }
        .progress-text { position: absolute; inset: 0; font-size: 9px; font-weight: bold; display: flex; align-items: center; justify-content: center; color: #fff; text-shadow: 0 0 2px rgba(0,0,0,0.8); }
        .badge { padding: 2px 6px; border-radius: 10px; font-size: 10px; font-weight: bold; white-space: nowrap; }
        .badge-done { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
        .badge-prog { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
        .badge-pending { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
        .signature { margin-top: 40px; text-align: center; page-break-inside: avoid; font-size: 11px; }
      </style></head>
      <body>
        <h1>NETUNO - RELATÓRIO DO DASHBOARD DE COMANDO MULTIQUARTÉIS</h1>
        <h2>Corpo de Bombeiros Militar do Distrito Federal | Emissão: ${today}</h2>
        
        <div class="kpi-row">
          <div class="kpi-box">
            <div class="kpi-title">Quartéis Monitorados</div>
            <div class="kpi-val">${dashboardStats.totalQuarteis}</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-title">Total de Missões</div>
            <div class="kpi-val">${dashboardStats.totalMissions}</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-title">Hidrantes Concluídos</div>
            <div class="kpi-val">${dashboardStats.totalConcluidos} / ${dashboardStats.totalHidrantes} (${dashboardStats.globalProgGeral}%)</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-title">Status Global</div>
            <div class="kpi-val" style="font-size: 12px; margin-top: 4px;">
              <span style="color: #475569;">⏳ ${dashboardStats.totalNaoIniciadas} Plan.</span> | 
              <span style="color: #b45309;">🔄 ${dashboardStats.totalEmAndamento} And.</span> | 
              <span style="color: #15803d;">✅ ${dashboardStats.totalConcluidas} Conc.</span>
            </div>
          </div>
        </div>

        <div class="section-title">📊 Gráfico Multiquartéis: Progresso Executado das Missões (0/5, 2/5, 5/5)</div>
    `;
    
    dashboardStats.quartelStats.forEach(qs => {
      if (qs.totalMissions === 0) return;
      
      html += `
        <div class="quartel-block">
          <div class="quartel-header">
            <span>🏢 ${qs.folder.name} (${qs.totalMissions} ${qs.totalMissions === 1 ? 'Missão' : 'Missões'})</span>
            <span>Progresso Geral: ${qs.totalConcluidos}/${qs.totalHidrantes} (${qs.progGeral}%)</span>
          </div>
      `;

      qs.missions.forEach(m => {
        const progClass = m.percent === 100 ? 'progress-fill complete' : 'progress-fill';
        const badgeClass = m.status === 'concluida' ? 'badge badge-done' : m.status === 'em_andamento' ? 'badge badge-prog' : 'badge badge-pending';
        const badgeLabel = m.status === 'concluida' ? 'Concluída ✅' : m.status === 'em_andamento' ? 'Em Andamento 🔄' : 'Planejada ⏳';

        html += `
          <div class="mission-row">
            <div class="mission-name">
              <div>${m.name}</div>
              <div class="mission-sub">${m.atribuicao}</div>
            </div>
            <div style="font-weight: bold; font-family: monospace; font-size: 12px; margin-right: 8px;">
              ${m.ratioText}
            </div>
            <div class="mission-progress">
              <div class="progress-bg">
                <div class="${progClass}" style="width: ${m.percent}%"></div>
                <div class="progress-text">${m.ratioText} (${m.percent}%)</div>
              </div>
            </div>
            <span class="${badgeClass}">${badgeLabel}</span>
          </div>
        `;
      });

      html += `</div>`;
    });

    html += `
        <div class="signature">
          <br><br>_________________________________________<br>
          Comando Operacional / SEHUR - CBMDF
        </div>
      </body></html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  const handleCreateMission = () => {
    const targetFolderId = currentFolderId !== null ? currentFolderId : (defaultFolderId || null);
    onNewMission(targetFolderId);
  };

  const handleMoveMission = (mission) => {
    setIsMoveMode(true);
    setMissionToMove(mission);
  };

  const confirmMove = (targetFolderId) => {
    let target = null;
    onMissionsChange(prev => prev.map(m => {
      if (m.id === missionToMove.id) {
        target = { ...m, parentFolderId: targetFolderId, updatedAt: new Date().toISOString() };
        return target;
      }
      return m;
    }));
    if (target) {
      syncMissionToCloud(target);
    }
    setIsMoveMode(false);
    setMissionToMove(null);
  };

  const formatDate = (isoString) => {
    try {
      if (!isoString) return '';
      const d = new Date(isoString);
      return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const modalContent = (
    <div className={isEmbedded ? "bg-slate-900 w-full h-full flex-1 min-h-0 rounded-xl border border-slate-700/80 shadow-xl flex flex-col overflow-hidden text-slate-100" : "bg-slate-900 w-full max-w-4xl rounded-2xl border border-slate-700/80 shadow-2xl flex flex-col overflow-hidden max-h-[92vh] text-slate-100"}>
        
        {/* CABEÇALHO PADRONIZADO */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-slate-900 border-b border-slate-700/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button 
              type="button"
              onClick={() => {
                if (currentFolderId !== null) {
                  const currentFolder = folders.find(f => f.id === currentFolderId);
                  setCurrentFolderId(currentFolder?.parentFolderId || null);
                } else {
                  onClose();
                }
              }} 
              className="text-xs px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg font-semibold transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
            >
              ← Voltar
            </button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-950/50 shrink-0">
              <FolderOpen size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                Central de Missões
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Organização por quartel (GBM), roteirização e produtividade operacional
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Breadcrumbs */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-slate-900/60 border-b border-slate-700/60 text-xs sm:text-sm font-semibold">
          <button 
            onClick={() => {
              setCurrentFolderId(null);
              setSearchTerm('');
            }}
            className="flex items-center gap-1 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
          >
            <Home size={15} /> Início
          </button>
          
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.id}>
              <ChevronRight size={14} className="text-slate-600" />
              <button 
                onClick={() => setCurrentFolderId(crumb.id)}
                className={`flex items-center gap-1 transition-colors cursor-pointer ${idx === breadcrumbs.length - 1 ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-emerald-400'}`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}

          {/* Botão de Pasta Favorita e Renomear */}
          {currentFolderId && (
            <div className="ml-auto flex items-center gap-2">
              {isGestor && (
                <button
                  type="button"
                  onClick={handleRenameCurrentFolder}
                  className="text-xs px-2.5 py-1 rounded-lg border font-semibold bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                  title="Editar nome desta pasta"
                >
                  <Edit size={13} className="text-cyan-400" />
                  <span>Renomear Pasta</span>
                </button>
              )}
              <button 
                type="button"
                onClick={handleSetDefaultFolder}
                className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-colors cursor-pointer flex items-center gap-1 ${currentFolderId === defaultFolderId ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-amber-300'}`}
                title={currentFolderId === defaultFolderId ? 'Pasta favorita selecionada para abertura e salvamento padrão' : 'Definir como pasta favorita padrão'}
              >
                {currentFolderId === defaultFolderId ? '★ Pasta Favorita' : '☆ Definir como Favorita'}
              </button>
            </div>
          )}
        </div>

        {/* Move Mode Banner */}
        {isMoveMode && (
          <div className="bg-amber-950/40 border-b border-amber-600/50 p-3 px-4 flex justify-between items-center text-amber-300 text-xs sm:text-sm font-semibold">
            <div className="flex items-center gap-2">
              <FolderInput size={18} className="text-amber-400" />
              <span>Navegue até a pasta destino e confirme para mover: "{missionToMove?.name}"</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => confirmMove(currentFolderId)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md cursor-pointer">Mover para Aqui</button>
              <button onClick={() => {setIsMoveMode(false); setMissionToMove(null);}} className="bg-slate-800 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-700 cursor-pointer">Cancelar</button>
            </div>
          </div>
        )}

        {/* Tabs Principais - Segmented Control Padronizado */}
        <div className="p-2.5 bg-slate-900/40 border-b border-slate-700/60">
          <div className="flex p-1 bg-slate-900/80 rounded-xl border border-slate-700/80 max-w-md mx-auto">
            <button 
              type="button"
              onClick={() => setActiveTab('todas')} 
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'todas' 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pastas & Missões
            </button>
            {/* RBAC: Apenas Gestores e Admins acessam o Dashboard de Comando */}
            {isGestor && (
              <button 
                type="button"
                onClick={() => setActiveTab('dashboard_comando')} 
                className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg flex justify-center items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'dashboard_comando' 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                 <Target size={15} /> Dashboard de Comando
              </button>
            )}
          </div>
        </div>

        {/* Search Bar (Visível apenas na pasta raiz) */}
        {activeTab !== 'dashboard_comando' && currentFolderId === null && (
          <div className="p-3 bg-slate-900/30 border-b border-slate-700 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-800/80 px-3 py-2 rounded-lg border border-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse"></span>
              <span className="font-medium">Selecione o quartel para encontrar as ordens de missão de vistoria.</span>
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Buscar quartel ou missão (ex: Guará, 13º GBM, Missão)..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="px-3 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold rounded-lg"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        )}

        {/* List Content */}
        <div className={`flex-1 overflow-y-auto ${activeTab === 'dashboard_comando' ? 'p-0' : 'p-4'} flex flex-col gap-3`}>
          
          {activeTab === 'dashboard_comando' && (
            <div className="flex flex-col h-full w-full bg-slate-900 overflow-y-auto gap-5 p-4 pb-8 items-start">
              
              {/* Header do Dashboard */}
              <div className="flex flex-col md:flex-row justify-between w-full items-start md:items-center gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                     <Target className="text-blue-400" /> Dashboard de Comando
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Monitoramento integrado de missões e progresso de vistorias de todos os quartéis do Distrito Federal.
                  </p>
                </div>
                <button 
                  onClick={handleExportPDFComando}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 shadow-lg transition-transform active:scale-95 text-xs sm:text-sm shrink-0"
                >
                  <Printer size={16} /> Exportar Relatório (PDF)
                </button>
              </div>

              {/* KPIs Executivos Globais */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full">
                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
                  <span className="text-[11px] font-bold uppercase text-slate-400">Quartéis Monitorados</span>
                  <div className="text-2xl font-black text-white mt-1">{dashboardStats.totalQuarteis}</div>
                  <span className="text-[10px] text-slate-400 mt-1">Unidades e GBMs cadastrados</span>
                </div>

                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
                  <span className="text-[11px] font-bold uppercase text-slate-400">Total de Missões</span>
                  <div className="text-2xl font-black text-cyan-400 mt-1">{dashboardStats.totalMissions}</div>
                  <span className="text-[10px] text-slate-400 mt-1">Missões ativas no DF</span>
                </div>

                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3.5 flex flex-col justify-between shadow-sm col-span-2 sm:col-span-1">
                  <span className="text-[11px] font-bold uppercase text-slate-400">Hidrantes Vistoriados</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black text-emerald-400">{dashboardStats.totalConcluidos}</span>
                    <span className="text-xs text-slate-400">/ {dashboardStats.totalHidrantes}</span>
                    <span className="text-xs font-bold text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60 ml-auto">
                      {dashboardStats.globalProgGeral}%
                    </span>
                  </div>
                  {/* Barra Global */}
                  <div className="w-full bg-slate-900 rounded-full h-2 mt-2 overflow-hidden border border-slate-700">
                    <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${dashboardStats.globalProgGeral}%` }}></div>
                  </div>
                </div>

                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3.5 flex flex-col justify-between shadow-sm col-span-2 sm:col-span-1">
                  <span className="text-[11px] font-bold uppercase text-slate-400">Status das Missões</span>
                  <div className="grid grid-cols-3 gap-1 text-center mt-2 text-xs font-bold">
                    <div className="bg-slate-900/60 p-1.5 rounded border border-slate-700" title="Missões não iniciadas">
                      <span className="text-[10px] text-slate-400 block">⏳ Plan.</span>
                      <span className="text-slate-200 text-sm">{dashboardStats.totalNaoIniciadas}</span>
                    </div>
                    <div className="bg-amber-950/30 p-1.5 rounded border border-amber-800/40" title="Missões em andamento">
                      <span className="text-[10px] text-amber-400 block">🔄 And.</span>
                      <span className="text-amber-300 text-sm">{dashboardStats.totalEmAndamento}</span>
                    </div>
                    <div className="bg-emerald-950/30 p-1.5 rounded border border-emerald-800/40" title="Missões 100% concluídas">
                      <span className="text-[10px] text-emerald-400 block">✅ Conc.</span>
                      <span className="text-emerald-300 text-sm">{dashboardStats.totalConcluidas}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* GRÁFICO MULTIQUARTÉIS CONSOLIDADO COM BARRAS 0/5, 2/5, 5/5 */}
              <div className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-4 sm:p-5 shadow-lg flex flex-col gap-4">
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-700 pb-3">
                  <div>
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <BarChart3 className="text-cyan-400" size={20} />
                      Gráfico Multiquartéis: Progresso Executado das Missões (0/5, 2/5, 5/5)
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Acompanhamento simultâneo de todas as missões e taxas de execução de cada quartel em um único gráfico consolidado.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <input 
                        type="text"
                        placeholder="Filtrar quartel ou missão..."
                        value={dashboardSearch}
                        onChange={(e) => setDashboardSearch(e.target.value)}
                        className="bg-slate-900 border border-slate-600 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 w-48 sm:w-56"
                      />
                      <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                    </div>

                    <button
                      onClick={() => setDashboardOnlyWithMissions(!dashboardOnlyWithMissions)}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors ${dashboardOnlyWithMissions ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500' : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'}`}
                    >
                      {dashboardOnlyWithMissions ? 'Apenas com Missões' : 'Todos os Quartéis'}
                    </button>
                  </div>
                </div>

                {/* Lista Multiquartéis com Barras de Progresso */}
                <div className="flex flex-col gap-4">
                  {dashboardStats.quartelStats
                    .filter(qs => {
                      if (dashboardOnlyWithMissions && qs.totalMissions === 0) return false;
                      if (!dashboardSearch.trim()) return true;
                      const term = dashboardSearch.toLowerCase();
                      const matchFolder = qs.folder.name.toLowerCase().includes(term);
                      const matchMission = qs.missions.some(m => m.name.toLowerCase().includes(term) || m.atribuicao.toLowerCase().includes(term));
                      return matchFolder || matchMission;
                    })
                    .map((qs) => (
                      <div key={qs.folder.id} className="bg-slate-900/80 border border-slate-700/80 rounded-xl overflow-hidden shadow-sm">
                        
                        {/* Cabeçalho do Quartel */}
                        <div className="bg-slate-800/80 p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700">
                          <div className="flex items-center gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                            <span className="font-bold text-slate-100 text-sm sm:text-base">{qs.folder.name}</span>
                            <span className="text-[11px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-semibold">
                              {qs.totalMissions} {qs.totalMissions === 1 ? 'Missão' : 'Missões'}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-slate-400 font-medium">Progresso do Quartel:</span>
                              <span className="font-mono font-bold text-emerald-400">{qs.totalConcluidos}/{qs.totalHidrantes}</span>
                              <span className="font-bold text-slate-200">({qs.progGeral}%)</span>
                            </div>
                            
                            <button
                              onClick={() => {
                                setCurrentFolderId(qs.folder.id);
                                setActiveTab('todas');
                              }}
                              className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-cyan-300 rounded border border-slate-600 transition-colors"
                              title="Abrir pasta deste quartel"
                            >
                              Ver Pasta →
                            </button>
                          </div>
                        </div>

                        {/* Barra de Progresso Geral do Quartel */}
                        <div className="w-full bg-slate-950 h-1.5">
                          <div 
                            className={`h-full ${qs.progGeral === 100 ? 'bg-emerald-500' : 'bg-cyan-500'} transition-all duration-500`}
                            style={{ width: `${qs.progGeral}%` }}
                          ></div>
                        </div>

                                {/* Missões do Quartel */}
                                <div className="p-3 sm:p-4 flex flex-col gap-2.5">
                                  {qs.missions.length === 0 ? (
                                    <div className="text-xs text-slate-500 italic py-1 text-center sm:text-left">
                                      Nenhuma missão cadastrada neste quartel.
                                    </div>
                                  ) : (
                                    qs.missions.map((m) => (
                                      <div 
                                        key={m.id}
                                        className="bg-slate-800/60 hover:bg-slate-800 border border-slate-700/70 hover:border-slate-600 p-3 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all group shadow-sm"
                                      >
                                        {/* Info da Missão + Status Badge */}
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-slate-100 text-xs sm:text-sm truncate max-w-[280px] sm:max-w-md" title={m.name}>
                                              {m.name}
                                            </span>
                                            {/* Status Badge */}
                                            {m.status === 'concluida' ? (
                                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 shrink-0">
                                                Concluída ✅
                                              </span>
                                            ) : m.status === 'em_andamento' ? (
                                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/60 shrink-0">
                                                Em Andamento 🔄
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                                                Não Iniciada ⏳
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                                            {m.atribuicao}
                                          </div>
                                        </div>

                                        {/* Badge de Execução (0/5, 2/5, 5/5), Barra de Progresso e Ação */}
                                        <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0">
                                          
                                          {/* Badge Numérico Ratio */}
                                          <div 
                                            className="font-mono font-bold text-xs px-2 py-1 rounded bg-slate-950 border border-slate-700 text-cyan-300 shrink-0 text-center min-w-[50px] shadow-inner"
                                            title="Hidrantes concluídos / Total de hidrantes da missão"
                                          >
                                            {m.ratioText}
                                          </div>

                                          {/* Barra de Progresso Visual Individual */}
                                          <div className="flex-1 md:w-44 lg:w-60">
                                            <div className="w-full bg-slate-950 rounded-full h-4 overflow-hidden border border-slate-700/80 relative shadow-inner flex items-center">
                                              <div 
                                                className={`h-full transition-all duration-500 ${
                                                  m.percent === 100 
                                                    ? 'bg-emerald-500' 
                                                    : m.percent > 0 
                                                      ? 'bg-amber-500' 
                                                      : 'bg-transparent'
                                                }`}
                                                style={{ width: `${Math.min(100, Math.max(0, m.percent))}%` }}
                                              ></div>
                                              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] whitespace-nowrap select-none">
                                                {m.percent}%
                                              </span>
                                            </div>
                                          </div>

                                          {/* Ação Rápida de Imprimir Rascunho */}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const fullMission = missions.find(x => x.id === m.id);
                                              if (fullMission) {
                                                printMissionDraft({
                                                  mission: fullMission,
                                                  hidrantes,
                                                  folderName: qs.folder?.name || '',
                                                  currentUser
                                                });
                                              }
                                            }}
                                            className="p-1.5 px-2.5 bg-indigo-600/30 hover:bg-indigo-600/60 text-indigo-200 border border-indigo-500/40 rounded-lg transition-all shrink-0 active:scale-95 flex items-center gap-1 text-xs font-semibold cursor-pointer"
                                            title="Imprimir rascunho de campo da missão"
                                          >
                                            <Printer size={14} />
                                            <span className="hidden sm:inline">Rascunho</span>
                                          </button>

                                          {/* Ação Rápida de Abertura */}
                                          <button
                                            onClick={() => {
                                              onOpenMission(m.id);
                                              onClose();
                                            }}
                                            className="p-1.5 px-2.5 bg-slate-700 hover:bg-emerald-600 text-slate-300 hover:text-white rounded-lg transition-all shrink-0 active:scale-95 flex items-center gap-1 text-xs font-semibold cursor-pointer"
                                            title="Abrir missão no mapa"
                                          >
                                            <span className="hidden sm:inline">Abrir</span>
                                            <ArrowRight size={14} />
                                          </button>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Cards Tradicionais por Quartel (Mosaico de Acesso Rápido) */}
              <div className="w-full mt-2">
                <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">
                  🏢 Mosaico de Pastas dos Quartéis
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
                  {[...dashboardStats.quartelStats]
                    .sort((a, b) => {
                      const aIsFav = defaultFolderId && a.folder.id === defaultFolderId;
                      const bIsFav = defaultFolderId && b.folder.id === defaultFolderId;
                      if (aIsFav && !bIsFav) return -1;
                      if (!aIsFav && bIsFav) return 1;
                      return (a.folder.name || '').localeCompare(b.folder.name || '', 'pt-BR', { sensitivity: 'base', numeric: true });
                    })
                    .map(qs => {
                      const isFav = qs.folder.id === defaultFolderId;
                      return (
                        <div 
                          key={qs.folder.id} 
                          onClick={() => {
                            setCurrentFolderId(qs.folder.id);
                            setActiveTab('todas');
                          }}
                          className={`border rounded-xl p-3.5 flex flex-col gap-2.5 shadow-md cursor-pointer hover:scale-[1.01] transition-all group ${
                            isFav 
                              ? 'bg-slate-800 border-amber-500/60 shadow-amber-950/20 ring-1 ring-amber-500/30' 
                              : 'bg-slate-800 border-slate-700 hover:border-emerald-500'
                          }`}
                          title="Clique para abrir as missões deste quartel"
                        >
                           <h5 className="font-bold text-emerald-400 group-hover:text-emerald-300 text-base border-b border-slate-700 pb-2 flex justify-between items-center gap-2">
                              <span className="truncate flex items-center gap-1.5">
                                {isFav && <span className="text-amber-400 text-xs font-bold shrink-0">★</span>}
                                <span className={isFav ? 'text-amber-300' : 'text-emerald-400'}>{qs.folder.name}</span>
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                {isFav && (
                                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full border border-amber-500/40 font-bold">
                                    Favorita
                                  </span>
                                )}
                                <span className="text-xs bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-800/60 font-semibold">
                                  {qs.totalMissions} Missões
                                </span>
                              </div>
                           </h5>
                           
                           <div className="w-full bg-slate-700 rounded-full h-3.5 overflow-hidden border border-slate-600 relative">
                             <div className={`h-full ${qs.progGeral === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${qs.progGeral}%` }}></div>
                             <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                               {qs.progGeral}% ({qs.totalConcluidos}/{qs.totalHidrantes})
                             </div>
                           </div>
                           
                           <div className="grid grid-cols-3 gap-1.5 text-center text-xs font-bold mt-1">
                             <div className="bg-slate-700/50 rounded py-1.5 border border-slate-600 flex flex-col">
                               <span className="text-[10px] text-slate-400">Plan.</span>
                               <span className="text-sm text-slate-200">{qs.naoIniciadas}</span>
                             </div>
                             <div className="bg-amber-900/20 rounded py-1.5 border border-amber-900/50 flex flex-col">
                               <span className="text-[10px] text-amber-400">Andam.</span>
                               <span className="text-sm text-amber-400">{qs.emAndamento}</span>
                             </div>
                             <div className="bg-emerald-900/20 rounded py-1.5 border border-emerald-900/50 flex flex-col">
                               <span className="text-[10px] text-emerald-400">Concl.</span>
                               <span className="text-sm text-emerald-400">{qs.concluidas}</span>
                             </div>
                           </div>
                        </div>
                      );
                    })}
                </div>
              </div>

            </div>
          )}

          {activeTab !== 'dashboard_comando' && isGestor && !isMoveMode && searchTerm === '' && (
            <div className="flex gap-2 mb-2">
              <button 
                type="button"
                onClick={handleCreateFolder} 
                className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-500 hover:border-slate-400 text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold transition-all cursor-pointer"
              >
                <Plus size={18} />
                NOVA PASTA
              </button>
              <button 
                type="button"
                onClick={() => {
                  const targetFolderId = currentFolderId !== null ? currentFolderId : (defaultFolderId || null);
                  onNewMission(targetFolderId);
                  onClose();
                }} 
                className="flex-[2] flex items-center justify-center gap-2 py-3 border-2 border-dashed border-emerald-500/50 hover:border-emerald-400 text-emerald-400 bg-emerald-900/10 hover:bg-emerald-900/30 rounded-xl font-bold transition-all cursor-pointer"
                title="Criar nova missão (na pasta atual ou na pasta favorita)"
              >
                <Plus size={18} />
                CRIAR MISSÃO
              </button>
            </div>
          )}

          {activeTab !== 'dashboard_comando' && displayFolders.map(folder => {
            const isFav = folder.id === defaultFolderId;
            return (
              <div 
                key={folder.id} 
                onClick={() => setCurrentFolderId(folder.id)}
                className={`border rounded-xl p-3 sm:p-3.5 flex items-center gap-3 cursor-pointer transition-all group ${
                  isFav 
                    ? 'bg-amber-950/20 border-amber-500/50 hover:border-amber-400 hover:bg-amber-950/30 shadow-md shadow-amber-950/30' 
                    : 'bg-slate-700/30 border-slate-600 hover:border-emerald-500 hover:bg-slate-700'
                }`}
              >
                <div className="relative shrink-0">
                  <Folder size={24} className={isFav ? 'text-amber-400 group-hover:scale-110 transition-transform' : 'text-emerald-500 group-hover:scale-110 transition-transform'} />
                  {isFav && (
                    <span className="absolute -top-1.5 -right-1.5 text-[10px] text-amber-300 font-bold drop-shadow">★</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`font-bold text-base sm:text-lg truncate ${isFav ? 'text-amber-200' : 'text-slate-200'}`}>
                      {folder.name}
                    </h3>
                    {isFav && (
                      <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        ★ Favorita
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                  {isGestor && (
                    <button
                      type="button"
                      onClick={(e) => handleRenameFolder(folder, e)}
                      className="p-2 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Editar nome da pasta"
                    >
                      <Edit size={16} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setCurrentFolderId(folder.id)}
                    className="p-1 text-slate-500 group-hover:text-slate-300 transition-colors"
                    title="Abrir pasta"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            );
          })}

          {activeTab !== 'dashboard_comando' && filteredMissions.map(mission => {
            const isOpen = (mission.id === activeMissionId) || (Array.isArray(openMissionIds) && openMissionIds.includes(mission.id));
            const total = (mission.selectedIds || []).length;
            const completed = (mission.completedIds || []).filter(id => (mission.selectedIds || []).includes(id)).length;
            const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
            const isCompleted = total > 0 && total === completed;

            return (
              <div 
                key={mission.id} 
                className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between hover:bg-slate-700 transition-all w-full relative select-none"
              >
                <div className="flex-1 w-full min-w-0 overflow-hidden">
                  <h3 className="font-bold text-lg text-slate-200 truncate flex items-center gap-2">
                    {isCompleted ? <CheckCircle size={18} className="text-emerald-500 shrink-0" /> : <Target size={18} className="text-amber-500 shrink-0" />}
                    <span className="truncate">{mission.name}</span>
                    {mission.isDraft && (
                       <span className="bg-amber-900/50 text-amber-500 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border border-amber-800 shrink-0">Rascunho</span>
                    )}
                  </h3>
                  
                  <div className="text-sm text-slate-400 mt-1 flex gap-4">
                    <span>Criada em: {formatDate(mission.createdAt)}{(mission.createdByName || mission.createdBy) ? ` por ${mission.createdByName || mission.createdBy}` : ''}</span>
                  </div>

                  <div className="mt-3 w-full">
                    <div className="flex justify-between text-xs text-slate-300 mb-1 font-semibold">
                      <span>Progresso: {completed}/{total} hidrantes</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div className={`h-2 rounded-full transition-all duration-500 ${isCompleted ? 'bg-emerald-500' : 'bg-emerald-400'}`} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}></div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 w-full sm:w-auto mt-2 sm:mt-0 items-center">
                  {/* Botão Imprimir Rascunho (Acessível a Qualquer Perfil) */}
                  <button
                    type="button"
                    onClick={() => {
                      const parentFolder = folders.find(f => f.id === mission.parentFolderId);
                      printMissionDraft({
                        mission,
                        hidrantes,
                        folderName: parentFolder?.name || '',
                        currentUser
                      });
                    }}
                    className="flex-1 sm:flex-none px-3.5 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer text-xs sm:text-sm shadow-sm"
                    title="Imprimir rascunho de campo da missão"
                  >
                    <Printer size={16} />
                    <span>Imprimir rascunho</span>
                  </button>

                  <button 
                    onClick={() => {
                      onOpenMission(mission.id);
                      onClose();
                    }}
                    className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors cursor-pointer text-xs sm:text-sm"
                  >
                    {isOpen ? 'Já Aberta' : 'Abrir'}
                  </button>
                  {isGestor && !isMoveMode && (
                    <>
                      <button onClick={() => handleMoveMission(mission)} className="p-2 bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer" title="Mover para...">
                        <FolderInput size={20} />
                      </button>
                      <button 
                        onClick={() => {
                          if (mission.createdBy && mission.createdBy !== currentUser?.matricula && currentUser?.role !== 'admin' && currentUser?.role !== 'gestor') {
                            alert(`Somente o autor da rota (${mission.createdBy}), um gestor ou um admin pode excluí-la.`);
                            return;
                          }
                          setMissionToDelete(mission);
                        }}
                        className="p-2 bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                        title="Excluir Missão"
                      >
                        <Trash2 size={20} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {activeTab !== 'dashboard_comando' && displayFolders.length === 0 && filteredMissions.length === 0 && (
            <div className="text-center text-slate-500 py-8">Nenhum item encontrado nesta pasta.</div>
          )}
        </div>

        {/* Modal de Confirmação de Exclusão */}
        {missionToDelete && (
          <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-red-500/50 rounded-xl p-5 max-w-md w-full shadow-2xl flex flex-col gap-4 animate-scaleUp">
              <div className="flex items-center gap-3 text-red-400">
                <Trash2 size={24} />
                <h3 className="text-lg font-bold text-white">Confirmar Exclusão</h3>
              </div>
              <p className="text-sm text-slate-300">
                Deseja realmente excluir a missão <strong className="text-white">"{missionToDelete.name}"</strong>? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-2 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setMissionToDelete(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-sm transition-colors border border-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-sm transition-colors shadow-lg shadow-red-900/50"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );

  if (isEmbedded) {
    return modalContent;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      {modalContent}
    </div>
  );
};

export default MissionManagerModal;
