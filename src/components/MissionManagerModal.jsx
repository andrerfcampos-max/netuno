import React, { useState, useEffect } from 'react';
import { X, Target, Plus, CheckCircle, Trash2, FolderOpen, Folder, ChevronRight, Home, CornerUpLeft, FolderInput, FileSpreadsheet, Printer } from 'lucide-react';
import { createNewFolder } from '../utils/storage';

const MissionManagerModal = ({ missions, folders = [], openMissionIds, onClose, onOpenMission, onNewMission, onDeleteMission, onFoldersChange, onMissionsChange, currentUser }) => {
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
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [swipingMissionId, setSwipingMissionId] = useState(null);

  // Set default folder
  const handleSetDefaultFolder = () => {
    if (currentFolderId === defaultFolderId) {
      localStorage.removeItem('netuno_default_folder');
      setDefaultFolderId(null);
    } else {
      localStorage.setItem('netuno_default_folder', currentFolderId || '');
      setDefaultFolderId(currentFolderId);
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

  const filteredMissions = displayMissions.filter(m => {
    const total = m.selectedIds.length;
    const completed = (m.completedIds || []).filter(id => m.selectedIds.includes(id)).length;
    const isCompleted = total > 0 && completed >= total;
    const isNotStarted = completed === 0;
    const isPartial = !isNotStarted && !isCompleted;

    if (activeTab === 'todas') return true;
    if (activeTab === 'nao_iniciadas' && isNotStarted) return true;
    if (activeTab === 'em_andamento' && isPartial) return true;
    if (activeTab === 'finalizadas' && isCompleted) return true;
    return true;
  }).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

  const handleTouchCardStart = (e, missionId) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
    setSwipingMissionId(missionId);
  };

  const handleTouchCardEnd = (e, mission) => {
    if (touchStartX === null || touchStartY === null || swipingMissionId !== mission.id) {
      setTouchStartX(null);
      setTouchStartY(null);
      setSwipingMissionId(null);
      return;
    }
    const diffX = touchStartX - e.changedTouches[0].clientX;
    const diffY = touchStartY - e.changedTouches[0].clientY;

    // Arrastou para a esquerda de forma clara (> 65px)
    if (Math.abs(diffX) > Math.abs(diffY) * 1.5 && diffX > 65) {
      if (mission.createdBy && mission.createdBy !== currentUser?.matricula && currentUser?.role !== 'admin') {
        alert(`Somente o autor da rota (${mission.createdBy}) ou um admin pode excluí-la.`);
      } else {
        setMissionToDelete(mission);
      }
    }
    setTouchStartX(null);
    setTouchStartY(null);
    setSwipingMissionId(null);
  };

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
      <html><head><title>Relatório - Dashboard de Comando</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
        h1 { text-align: center; color: #1e293b; margin-bottom: 5px; }
        h2 { text-align: center; color: #64748b; font-size: 14px; margin-top: 0; margin-bottom: 30px; }
        .grid { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; }
        .folder-box { width: 300px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); break-inside: avoid; margin-bottom: 20px; }
        .folder-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 15px; }
        .folder-title { font-weight: bold; font-size: 16px; color: #0f172a; }
        .folder-badge { font-size: 11px; background: #e2e8f0; padding: 3px 8px; border-radius: 12px; color: #475569; }
        .progress-bar-bg { width: 100%; background-color: #e2e8f0; border-radius: 8px; height: 16px; position: relative; margin-bottom: 15px; overflow: hidden; }
        .progress-bar-fill { height: 100%; background-color: #3b82f6; border-radius: 8px; }
        .progress-bar-fill.complete { background-color: #10b981; }
        .progress-text { position: absolute; width: 100%; text-align: center; top: 0; left: 0; font-size: 10px; font-weight: bold; color: #fff; line-height: 16px; text-shadow: 0 0 2px rgba(0,0,0,0.8); }
        .stats-grid { display: flex; justify-content: space-between; gap: 10px; text-align: center; }
        .stat-box { flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 0; background: #f8fafc; }
        .stat-label { font-size: 10px; color: #64748b; display: block; text-transform: uppercase; }
        .stat-value { font-size: 18px; font-weight: bold; color: #0f172a; display: block; margin-top: 4px; }
        .stat-box.planejadas { border-color: #cbd5e1; }
        .stat-box.andamento { border-color: #fcd34d; background: #fffbeb; }
        .stat-box.concluidas { border-color: #6ee7b7; background: #ecfdf5; }
        .signature { margin-top: 60px; text-align: center; page-break-inside: avoid; }
      </style></head>
      <body>
        <h1>NETUNO - RELATÓRIO DO DASHBOARD DE COMANDO</h1>
        <h2>Data de Emissão: ${today}</h2>
        <div class="grid">
    `;
    
    folders.forEach(folder => {
      const fMissions = availableMissions.filter(m => m.parentFolderId === folder.id);
      
      let totalHidrantes = 0;
      let totalConcluidos = 0;
      let naoIniciadas = 0;
      let emAndamento = 0;
      let concluidas = 0;

      fMissions.forEach(m => {
        const t = m.selectedIds.length;
        const c = (m.completedIds || []).filter(id => m.selectedIds.includes(id)).length;
        totalHidrantes += t;
        totalConcluidos += c;
        if (t > 0 && c >= t) concluidas++;
        else if (c > 0) emAndamento++;
        else naoIniciadas++;
      });
      
      const progGeral = totalHidrantes > 0 ? Math.round((totalConcluidos / totalHidrantes) * 100) : 0;
      const progressClass = progGeral === 100 ? 'progress-bar-fill complete' : 'progress-bar-fill';

      html += `
        <div class="folder-box">
          <div class="folder-header">
            <span class="folder-title">${folder.name}</span>
            <span class="folder-badge">${fMissions.length} Missões</span>
          </div>
          <div class="progress-bar-bg">
            <div class="${progressClass}" style="width: ${progGeral}%"></div>
            <div class="progress-text">${progGeral}% (${totalConcluidos}/${totalHidrantes})</div>
          </div>
          <div class="stats-grid">
            <div class="stat-box planejadas">
              <span class="stat-label">Planejadas</span>
              <span class="stat-label stat-value">${naoIniciadas}</span>
            </div>
            <div class="stat-box andamento">
              <span class="stat-label">Andamento</span>
              <span class="stat-label stat-value">${emAndamento}</span>
            </div>
            <div class="stat-box concluidas">
              <span class="stat-label">Concluídas</span>
              <span class="stat-label stat-value">${concluidas}</span>
            </div>
          </div>
        </div>
      `;
    });

    html += `
        </div>
        <div class="signature">
          <br><br>_________________________________________<br>
          Assinatura do Responsável
        </div>
      </body></html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  const handleCreateMission = () => {
    onNewMission(currentFolderId);
  };

  const handleMoveMission = (mission) => {
    setIsMoveMode(true);
    setMissionToMove(mission);
  };

  const confirmMove = (targetFolderId) => {
    onMissionsChange(prev => prev.map(m => m.id === missionToMove.id ? { ...m, parentFolderId: targetFolderId } : m));
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

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 w-full max-w-4xl rounded-xl border border-slate-600 shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={onClose} 
              className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded font-semibold transition-colors"
            >
              ← Voltar
            </button>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <FolderOpen className="text-emerald-400" />
              Central de Missões
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-red-400 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Breadcrumbs */}
        <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-800 border-b border-slate-700 text-sm font-semibold">
          <button 
            onClick={() => {
              setCurrentFolderId(null);
              setSearchTerm('');
            }}
            className="flex items-center gap-1 text-slate-400 hover:text-emerald-400 transition-colors"
          >
            <Home size={16} /> Início
          </button>
          
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.id}>
              <ChevronRight size={16} className="text-slate-600" />
              <button 
                onClick={() => setCurrentFolderId(crumb.id)}
                className={`flex items-center gap-1 transition-colors ${idx === breadcrumbs.length - 1 ? 'text-emerald-400' : 'text-slate-400 hover:text-emerald-400'}`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}

          {/* Botão de Quartel Padrão */}
          {currentFolderId && (
            <div className="ml-auto flex items-center gap-2">
              <button 
                onClick={handleSetDefaultFolder}
                className={`text-xs px-2 py-1 rounded border transition-colors ${currentFolderId === defaultFolderId ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500' : 'bg-slate-700 text-slate-400 border-slate-600 hover:text-emerald-400'}`}
                title="Definir pasta atual para abrir automaticamente"
              >
                {currentFolderId === defaultFolderId ? '★ Quartel Padrão' : '☆ Definir como Padrão'}
              </button>
            </div>
          )}
        </div>

        {/* Move Mode Banner */}
        {isMoveMode && (
          <div className="bg-amber-900/40 border-b border-amber-600 p-3 flex justify-between items-center text-amber-400 text-sm font-bold">
            <div className="flex items-center gap-2">
              <FolderInput size={18} />
              Navegue até a pasta destino e confirme para mover: "{missionToMove?.name}"
            </div>
            <div className="flex gap-2">
              <button onClick={() => confirmMove(currentFolderId)} className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded shadow-sm">Mover para Aqui</button>
              <button onClick={() => {setIsMoveMode(false); setMissionToMove(null);}} className="bg-slate-700 text-slate-300 px-3 py-1 rounded hover:bg-slate-600">Cancelar</button>
            </div>
          </div>
        )}

        {/* Tabs Principais */}
        <div className="flex border-b border-slate-700 bg-slate-900/40">
          <button onClick={() => setActiveTab('todas')} className={`flex-1 py-3 text-sm font-bold ${activeTab === 'todas' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-slate-800' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-300'}`}>Pastas & Missões</button>
          {/* RBAC: Apenas Gestores e Admins acessam o Dashboard de Comando */}
          {isGestor && (
            <button onClick={() => setActiveTab('dashboard_comando')} className={`flex-1 py-3 text-sm font-bold flex justify-center items-center gap-2 ${activeTab === 'dashboard_comando' ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-800' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-300'}`}>
               <Target size={16} /> Dashboard de Comando
            </button>
          )}
        </div>

        {/* Search Bar (Visível apenas na pasta raiz) */}
        {activeTab !== 'dashboard_comando' && currentFolderId === null && (
          <div className="p-3 bg-slate-900/30 border-b border-slate-700 flex gap-2">
            <input 
              type="text" 
              placeholder="Buscar pasta ou missão na raiz (ex: Guará, 13º GBM, Missão)..." 
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
        )}

        {/* List Content */}
        <div className={`flex-1 overflow-y-auto ${activeTab === 'dashboard_comando' ? 'p-0' : 'p-4'} flex flex-col gap-3`}>
          
          {activeTab === 'dashboard_comando' && (
            <div className="flex flex-col h-full w-full bg-slate-900 overflow-y-auto gap-4 p-4 pb-8 items-start">
              <div className="flex flex-col md:flex-row justify-between w-full items-start md:items-center mb-2 gap-4">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                     <Target className="text-blue-400" /> Dashboard de Comando
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Clique em qualquer quartel para abrir diretamente a pasta de missões.</p>
                </div>
                <button 
                  onClick={handleExportPDFComando}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 shadow-lg transition-transform active:scale-95 text-sm"
                >
                  <Printer size={18} /> Exportar Relatório (PDF)
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                {folders.map(folder => {
                  const fMissions = availableMissions.filter(m => m.parentFolderId === folder.id);
                  
                  let totalHidrantes = 0;
                  let totalConcluidos = 0;
                  let naoIniciadas = 0;
                  let emAndamento = 0;
                  let concluidas = 0;

                  fMissions.forEach(m => {
                    const t = m.selectedIds.length;
                    const c = (m.completedIds || []).filter(id => m.selectedIds.includes(id)).length;
                    totalHidrantes += t;
                    totalConcluidos += c;
                    if (t > 0 && c >= t) concluidas++;
                    else if (c > 0) emAndamento++;
                    else naoIniciadas++;
                  });
                  
                  const progGeral = totalHidrantes > 0 ? Math.round((totalConcluidos / totalHidrantes) * 100) : 0;

                  return (
                    <div 
                      key={folder.id} 
                      onClick={() => {
                        setCurrentFolderId(folder.id);
                        setActiveTab('todas');
                      }}
                      className="bg-slate-800 border border-slate-700 hover:border-emerald-500 rounded-xl p-4 flex flex-col gap-3 shadow-md cursor-pointer hover:scale-[1.02] transition-all group"
                      title="Clique para abrir esta pasta de missões"
                    >
                       <h4 className="font-bold text-emerald-400 group-hover:text-emerald-300 text-lg border-b border-slate-700 pb-2 flex justify-between items-center">
                          {folder.name}
                          <span className="text-xs bg-emerald-900/50 text-emerald-300 px-2 py-1 rounded-full">{fMissions.length} Missões</span>
                       </h4>
                       
                       <div className="w-full bg-slate-700 rounded-full h-4 mb-1 overflow-hidden border border-slate-600 relative">
                         <div className={`h-full ${progGeral === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${progGeral}%` }}></div>
                         <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">{progGeral}% ({totalConcluidos}/${totalHidrantes})</div>
                       </div>
                       
                       <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold mt-2">
                         <div className="bg-slate-700/50 rounded py-2 border border-slate-600 flex flex-col">
                           <span className="text-slate-400">Planejadas</span>
                           <span className="text-lg text-slate-200">{naoIniciadas}</span>
                         </div>
                         <div className="bg-amber-900/20 rounded py-2 border border-amber-900/50 flex flex-col">
                           <span className="text-amber-500">Andamento</span>
                           <span className="text-lg text-amber-400">{emAndamento}</span>
                         </div>
                         <div className="bg-emerald-900/20 rounded py-2 border border-emerald-900/50 flex flex-col">
                           <span className="text-emerald-500">Concluídas</span>
                           <span className="text-lg text-emerald-400">{concluidas}</span>
                         </div>
                       </div>
                    </div>
                  );
                })}
                {availableMissions.length === 0 && (
                  <div className="col-span-full text-center text-slate-500 py-8">Nenhuma missão registrada.</div>
                )}
              </div>
            </div>
          )}

          {activeTab !== 'dashboard_comando' && isGestor && !isMoveMode && searchTerm === '' && (
            <div className="flex gap-2 mb-2">
              <button onClick={handleCreateFolder} className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-500 hover:border-slate-400 text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold transition-all">
                <Plus size={18} />
                NOVA PASTA
              </button>
              <button onClick={() => {
                onNewMission(currentFolderId);
                onClose();
              }} className="flex-[2] flex items-center justify-center gap-2 py-3 border-2 border-dashed border-emerald-500/50 hover:border-emerald-400 text-emerald-400 bg-emerald-900/10 hover:bg-emerald-900/30 rounded-xl font-bold transition-all">
                <Plus size={18} />
                CRIAR RASCUNHO
              </button>
            </div>
          )}

          {activeTab !== 'dashboard_comando' && displayFolders.map(folder => (
            <div 
              key={folder.id} 
              onClick={() => setCurrentFolderId(folder.id)}
              className="bg-slate-700/30 border border-slate-600 hover:border-emerald-500 rounded-lg p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-700 transition-colors group"
            >
              <Folder size={24} className="text-emerald-500 group-hover:scale-110 transition-transform" />
              <div className="flex-1">
                <h3 className="font-bold text-lg text-slate-200">{folder.name}</h3>
              </div>
              <ChevronRight size={20} className="text-slate-500" />
            </div>
          ))}

          {activeTab !== 'dashboard_comando' && filteredMissions.map(mission => {
            const isOpen = openMissionIds.includes(mission.id);
            const total = mission.selectedIds.length;
            const completed = (mission.completedIds || []).filter(id => mission.selectedIds.includes(id)).length;
            const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
            const isCompleted = total > 0 && total === completed;

            return (
              <div 
                key={mission.id} 
                onTouchStart={(e) => handleTouchCardStart(e, mission.id)}
                onTouchEnd={(e) => handleTouchCardEnd(e, mission)}
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

                <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0 items-center">
                  <button 
                    onClick={() => {
                      onOpenMission(mission.id);
                      onClose();
                    }}
                    className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors"
                  >
                    {isOpen ? 'Já Aberta' : 'Abrir'}
                  </button>
                  {isGestor && !isMoveMode && (
                    <>
                      <button onClick={() => handleMoveMission(mission)} className="p-2 bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white rounded-lg transition-colors" title="Mover para...">
                        <FolderInput size={20} />
                      </button>
                      <button 
                        onClick={() => {
                          if (mission.createdBy && mission.createdBy !== currentUser?.matricula && currentUser?.role !== 'admin') {
                            alert(`Somente o autor da rota (${mission.createdBy}) ou um admin pode excluí-la.`);
                            return;
                          }
                          setMissionToDelete(mission);
                        }}
                        className="p-2 bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white rounded-lg transition-colors"
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
    </div>
  );
};

export default MissionManagerModal;
