import React, { useState } from 'react';
import { X, Target, Plus, CheckCircle, Trash2, FolderOpen } from 'lucide-react';

const MissionManagerModal = ({ missions, openMissionIds, onClose, onOpenMission, onNewMission, onDeleteMission, currentUser }) => {
  const isGestor = currentUser?.role === 'gestor';
  const [activeTab, setActiveTab] = useState('todas');
  const [searchTerm, setSearchTerm] = useState('');

  const availableMissions = isGestor ? missions : missions.filter(m => !m.isDraft);

  const filtered = availableMissions.filter(m => {
    const total = m.selectedIds.length;
    const completed = m.completedIds.length;
    
    // Tratamento para missões vazias (0 hidrantes) serem consideradas Não Iniciadas
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

  const countTodas = availableMissions.length;
  const countNaoIniciadas = availableMissions.filter(m => m.completedIds.length === 0).length;
  const countEmAndamento = availableMissions.filter(m => m.completedIds.length > 0 && m.completedIds.length < m.selectedIds.length).length;
  const countFinalizadas = availableMissions.filter(m => m.selectedIds.length > 0 && m.selectedIds.length === m.completedIds.length).length;

  const formatDate = (isoString) => {
    try {
      if (!isoString) return '';
      const d = new Date(isoString);
      if (isNaN(d.getTime())) throw new Error("Data inválida");
      return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (err) {
      console.error('Erro de parse de data em MissionManagerModal:', err, 'Valor:', isoString);
      return 'Data Inválida';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 w-full max-w-2xl rounded-xl border border-slate-600 shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        
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

        {/* Search Bar */}
        <div className="p-3 bg-slate-900/30 border-b border-slate-700">
          <input 
            type="text" 
            placeholder="Buscar por nome da missão ou guarnição/equipe..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 bg-slate-900/20 overflow-x-auto text-sm">
          <button 
            onClick={() => setActiveTab('todas')}
            className={`px-4 py-3 font-semibold transition-colors whitespace-nowrap ${activeTab === 'todas' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-slate-800' : 'text-slate-400 hover:bg-slate-800/50'}`}
          >
            Todas ({countTodas})
          </button>
          <button 
            onClick={() => setActiveTab('nao_iniciadas')}
            className={`px-4 py-3 font-semibold transition-colors whitespace-nowrap ${activeTab === 'nao_iniciadas' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-slate-800' : 'text-slate-400 hover:bg-slate-800/50'}`}
          >
            Não Iniciadas ({countNaoIniciadas})
          </button>
          <button 
            onClick={() => setActiveTab('em_andamento')}
            className={`px-4 py-3 font-semibold transition-colors whitespace-nowrap ${activeTab === 'em_andamento' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-slate-800' : 'text-slate-400 hover:bg-slate-800/50'}`}
          >
            Em Andamento ({countEmAndamento})
          </button>
          <button 
            onClick={() => setActiveTab('finalizadas')}
            className={`px-4 py-3 font-semibold transition-colors whitespace-nowrap ${activeTab === 'finalizadas' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-slate-800' : 'text-slate-400 hover:bg-slate-800/50'}`}
          >
            Finalizadas ({countFinalizadas})
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {isGestor && activeTab === 'todas' && searchTerm === '' && (
            <button 
              onClick={() => {
                onNewMission();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-emerald-500/50 hover:border-emerald-400 text-emerald-400 bg-emerald-900/10 hover:bg-emerald-900/30 rounded-xl font-bold transition-all"
            >
              <Plus size={20} />
              CRIAR NOVO RASCUNHO DE ROTA
            </button>
          )}

          {filtered.length === 0 && (
            <div className="text-center text-slate-500 py-8">Nenhuma operação encontrada para os filtros atuais.</div>
          )}

          {filtered.map(mission => {
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
                  
                  {mission.atribuicao && (
                    <div className="mt-1">
                      <span className="inline-block px-2 py-0.5 bg-slate-800 border border-slate-600 text-slate-300 text-xs font-bold rounded">
                        Equipe: <span className="text-amber-400">{mission.atribuicao}</span>
                      </span>
                    </div>
                  )}

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

                <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                  <button 
                    onClick={() => {
                      onOpenMission(mission.id);
                      onClose();
                    }}
                    className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors"
                  >
                    {isOpen ? 'Já Aberta' : 'Abrir'}
                  </button>
                  {isGestor && (
                    <button 
                      onClick={() => {
                        if (mission.createdBy && mission.createdBy !== currentUser?.matricula) {
                          alert(`Somente o autor da rota (${mission.createdBy}) pode excluí-la.`);
                          return;
                        }
                        if(window.confirm("Deseja realmente apagar esta missão?")) {
                          onDeleteMission(mission.id);
                        }
                      }}
                      className={`p-2 rounded-lg transition-colors ${
                        mission.createdBy && mission.createdBy !== currentUser?.matricula 
                          ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
                          : 'bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white'
                      }`}
                      title={mission.createdBy && mission.createdBy !== currentUser?.matricula ? "Apenas o autor pode excluir" : "Excluir"}
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};

export default MissionManagerModal;
