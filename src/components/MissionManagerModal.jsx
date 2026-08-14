import React, { useState, useEffect } from 'react';
import { X, Target, Plus, CheckCircle, Trash2, FolderOpen, Folder, ChevronRight, Home, CornerUpLeft, FolderInput, FileSpreadsheet, Printer } from 'lucide-react';
import { createNewFolder } from '../utils/storage';

const MissionManagerModal = ({ missions, folders = [], openMissionIds, onClose, onOpenMission, onNewMission, onDeleteMission, onFoldersChange, onMissionsChange, currentUser }) => {
  const isGestor = currentUser?.role === 'gestor' || currentUser?.role === 'admin';
  const [activeTab, setActiveTab] = useState('todas'); // todas, nao_iniciadas, em_andamento, finalizadas, visao_comando
  const [searchTerm, setSearchTerm] = useState('');
  
  const [defaultFolderId, setDefaultFolderId] = useState(() => {
    return localStorage.getItem('netuno_default_folder') || null;
  });

  const [currentFolderId, setCurrentFolderId] = useState(() => {
    return localStorage.getItem('netuno_default_folder') || null;
  });

  const [isMoveMode, setIsMoveMode] = useState(false);
  const [missionToMove, setMissionToMove] = useState(null);

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

  const handleExportFolderReport = () => {
    if (!currentFolderId) {
      alert("Navegue até uma pasta (grupamento) para exportar o relatório consolidado.");
      return;
    }
    const folder = folders.find(f => f.id === currentFolderId);
    const folderName = folder ? folder.name : "Central";
    
    const folderMissions = availableMissions.filter(m => m.parentFolderId === currentFolderId && !m.isDraft);
    
    if (folderMissions.length === 0) {
      alert("Não há missões ativas nesta pasta para gerar o relatório.");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Relatorio Consolidado de Missoes - " + folderName + "\\n\\n";
    csvContent += "Nome da Missao,Criador,Data de Criacao,Total Hidrantes,Vistorias Realizadas,Progresso (%)\\n";

    folderMissions.forEach(m => {
      const total = m.selectedIds.length;
      const comp = m.completedIds.length;
      const perc = total > 0 ? Math.round((comp / total) * 100) : 0;
      const criador = m.createdBy || "-";
      const date = new Date(m.createdAt).toLocaleDateString('pt-BR');
      csvContent += `"${m.name}","${criador}","${date}",${total},${comp},${perc}%\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Relatorio_Grupamento_${folderName.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDFComando = () => {
    const printWindow = window.open('', '', 'width=1000,height=800');
    const today = new Date().toLocaleDateString('pt-BR');
    
    const folderStats = [];
    folders.forEach(f => {
      const ms = availableMissions.filter(m => m.parentFolderId === f.id);
      if (ms.length > 0) {
        folderStats.push({ folder: f, missions: ms });
      }
    });

    let html = `
      <html><head><title>Relatório - Visão de Comando</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1, h2 { text-align: center; }
        .folder-box { margin-bottom: 20px; border: 1px solid #ccc; padding: 10px; border-radius: 8px; }
        .folder-title { font-weight: bold; font-size: 18px; margin-bottom: 10px; background: #f0f0f0; padding: 5px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
      </style></head>
      <body>
        <h1>NETUNO - RELATÓRIO DE VISÃO DE COMANDO</h1>
        <h2>Data de Emissão: ${today}</h2>
    `;
    
    folderStats.forEach(fs => {
       html += `<div class="folder-box">
         <div class="folder-title">${fs.folder.name}</div>
         <table>
           <tr><th>Missão</th><th>Criador</th><th>Criado Em</th><th>Progresso</th></tr>`;
       fs.missions.forEach(m => {
          const total = m.selectedIds.length;
          const completed = m.completedIds.length;
          const prog = total > 0 ? Math.round((completed / total) * 100) : 0;
          const date = new Date(m.createdAt).toLocaleDateString('pt-BR');
          html += `<tr>
            <td>${m.name}</td>
            <td>${m.createdBy || '-'}</td>
            <td>${date}</td>
            <td>${completed}/${total} (${prog}%)</td>
          </tr>`;
       });
       html += `</table></div>`;
    });

    html += `
        <div style="margin-top: 50px; text-align: center;">
          <br><br>_________________________________________<br>
          Assinatura do Responsável
        </div>
      </body></html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  };


  const handleCreateMission = () => {
    onNewMission();
    // A função handleNewMission do App não recebe o currentFolderId, então teremos que atualizar a missão recém criada?
    // Melhor forma é o App tratar isso. Como não podemos mudar App handleNewMission sem quebrar a assinatura,
    // vamos pegar a última missão adicionada (logo após onClose não dá). 
    // Por enquanto, atualizamos o parentFolderId direto no array.
    setTimeout(() => {
      // gambiarra temporária para não alterar a API do App.jsx no onNewMission
      // mas vamos usar o onMissionsChange para forçar a atualização.
    }, 100);
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

  const availableMissions = isGestor ? missions : missions.filter(m => !m.isDraft);

  // Filtra as missões que pertencem à pasta atual (se não estiver buscando)
  let displayMissions = availableMissions;
  let displayFolders = folders;

  if (searchTerm.trim() === '') {
    displayMissions = availableMissions.filter(m => (m.parentFolderId || null) === currentFolderId);
    displayFolders = folders.filter(f => (f.parentFolderId || null) === currentFolderId);
  } else {
    // Busca global ignora pastas
    displayFolders = [];
  }

  const filteredMissions = displayMissions.filter(m => {
    const total = m.selectedIds.length;
    const completed = m.completedIds.length;
    const isCompleted = total > 0 && total === completed;
    const isNotStarted = completed === 0;
    const isPartial = !isNotStarted && !isCompleted;

    let matchTab = false;
    if (activeTab === 'todas') matchTab = true;
    if (activeTab === 'nao_iniciadas' && isNotStarted) matchTab = true;
    if (activeTab === 'em_andamento' && isPartial) matchTab = true;
    if (activeTab === 'finalizadas' && isCompleted) matchTab = true;

    let matchSearch = true;
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      const name = m.name?.toLowerCase() || '';
      const atri = m.atribuicao?.toLowerCase() || '';
      matchSearch = name.includes(term) || atri.includes(term);
    }

    return matchTab && matchSearch;
  }).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

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
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <FolderOpen className="text-emerald-400" />
            Central de Missões
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-red-400 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Breadcrumbs */}
        <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-800 border-b border-slate-700 text-sm font-semibold">
          <button 
            onClick={() => setCurrentFolderId(null)}
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
              {isGestor && (
                <button 
                  onClick={handleExportFolderReport}
                  className="text-xs px-2 py-1 flex items-center gap-1 rounded border bg-blue-600/20 text-blue-400 border-blue-500 hover:bg-blue-600/40 transition-colors"
                  title="Exportar Relatório (Produtividade/Cumprimento)"
                >
                  <FileSpreadsheet size={14} /> Exportar Relatório
                </button>
              )}
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
          {/* RBAC: Apenas Gestores e Admins acessam a Visão de Comando */}
          {isGestor && (
            <button onClick={() => setActiveTab('visao_comando')} className={`flex-1 py-3 text-sm font-bold flex justify-center items-center gap-2 ${activeTab === 'visao_comando' ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-800' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-300'}`}>
               <Target size={16} /> Visão de Comando
            </button>
          )}
        </div>

        {/* Search Bar (Only if not in comando) */}
        {activeTab !== 'visao_comando' && (
          <div className="p-3 bg-slate-900/30 border-b border-slate-700 flex gap-2">
            <input 
              type="text" 
              placeholder="Buscar globalmente..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        )}

        {/* List Content */}
        <div className={`flex-1 overflow-y-auto ${activeTab === 'visao_comando' ? 'p-0' : 'p-4'} flex flex-col gap-3`}>
          
          {activeTab === 'visao_comando' && (
            <div className="flex flex-col h-full w-full bg-slate-900 overflow-y-auto gap-4 p-4 pb-8 items-start">
              <div className="flex flex-col md:flex-row justify-between w-full items-start md:items-center mb-2 gap-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                   <Target className="text-blue-400" /> Dashboard de Comando
                </h3>
                <button 
                  onClick={handleExportPDFComando}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 shadow-lg transition-transform active:scale-95"
                >
                  <Printer size={18} /> Exportar Relatório (PDF)
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                {folders.map(folder => {
                  const fMissions = availableMissions.filter(m => m.parentFolderId === folder.id);
                  // if (fMissions.length === 0) return null; // Removido para garantir que todos os quartéis sejam visíveis
                  
                  let totalHidrantes = 0;
                  let totalConcluidos = 0;
                  let naoIniciadas = 0;
                  let emAndamento = 0;
                  let concluidas = 0;

                  fMissions.forEach(m => {
                    const t = m.selectedIds.length;
                    const c = m.completedIds.length;
                    totalHidrantes += t;
                    totalConcluidos += c;
                    if (t > 0 && c === t) concluidas++;
                    else if (c > 0) emAndamento++;
                    else naoIniciadas++;
                  });
                  
                  const progGeral = totalHidrantes > 0 ? Math.round((totalConcluidos / totalHidrantes) * 100) : 0;

                  return (
                    <div key={folder.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col gap-3 shadow-md">
                       <h4 className="font-bold text-emerald-400 text-lg border-b border-slate-700 pb-2 flex justify-between items-center">
                          {folder.name}
                          <span className="text-xs bg-emerald-900/50 text-emerald-300 px-2 py-1 rounded-full">{fMissions.length} Missões</span>
                       </h4>
                       
                       <div className="w-full bg-slate-700 rounded-full h-4 mb-1 overflow-hidden border border-slate-600 relative">
                         <div className={`h-full ${progGeral === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${progGeral}%` }}></div>
                         <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">{progGeral}% ({totalConcluidos}/{totalHidrantes})</div>
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

          {activeTab !== 'visao_comando' && isGestor && !isMoveMode && searchTerm === '' && (
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

          {activeTab !== 'visao_comando' && displayFolders.map(folder => (
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

          {activeTab !== 'visao_comando' && filteredMissions.map(mission => {
            const isOpen = openMissionIds.includes(mission.id);
            const total = mission.selectedIds.length;
            const completed = mission.completedIds.length;
            const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
            const isCompleted = total > 0 && total === completed;

            return (
              <div key={mission.id} className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between hover:bg-slate-700 transition-colors">
                <div className="flex-1 overflow-hidden">
                  <h3 className="font-bold text-lg text-slate-200 truncate flex items-center gap-2">
                    {isCompleted ? <CheckCircle size={18} className="text-emerald-500" /> : <Target size={18} className="text-amber-500" />}
                    {mission.name}
                    {mission.isDraft && (
                       <span className="bg-amber-900/50 text-amber-500 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border border-amber-800">Rascunho</span>
                    )}
                  </h3>
                  
                  <div className="text-sm text-slate-400 mt-1 flex gap-4">
                    <span>Criada em: {formatDate(mission.createdAt)}</span>
                  </div>

                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-slate-300 mb-1 font-semibold">
                      <span>Progresso: {completed}/{total} hidrantes</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2">
                      <div className={`h-2 rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-emerald-400'}`} style={{ width: `${progress}%` }}></div>
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
                          if(window.confirm("Deseja realmente apagar esta missão?")) onDeleteMission(mission.id);
                        }}
                        className="p-2 bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white rounded-lg transition-colors"
                      >
                        <Trash2 size={20} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {activeTab !== 'visao_comando' && displayFolders.length === 0 && filteredMissions.length === 0 && (
            <div className="text-center text-slate-500 py-8">Nenhum item encontrado nesta pasta.</div>
          )}
        </div>

      </div>
    </div>
  );
};

export default MissionManagerModal;
