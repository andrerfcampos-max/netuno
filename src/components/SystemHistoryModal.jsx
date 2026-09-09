import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  History, 
  CheckCheck, 
  Trash2, 
  Search, 
  PlusCircle, 
  Edit3, 
  AlertTriangle, 
  Flame, 
  Building2, 
  ClipboardCheck, 
  MapPin, 
  User, 
  Clock, 
  LocateFixed, 
  Filter,
  Layers,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { 
  getAuditLogs, 
  markAllAuditLogsAsRead, 
  clearAuditLogs, 
  deleteAuditLog 
} from '../utils/auditLogger';

// Formatação amigável de tempo relativo
const formatRelativeTime = (isoString) => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 45) return 'Agora mesmo';
    if (diffMin < 60) return `Há ${diffMin} min`;
    if (diffHours < 24) return `Há ${diffHours}h`;
    if (diffDays === 1) return 'Ontem às ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (diffDays < 7) return `Há ${diffDays} dias`;
    return date.toLocaleDateString('pt-BR') + ' às ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return isoString;
  }
};

export default function SystemHistoryModal({
  isOpen,
  onClose,
  onFocusLocation,
  currentUser
}) {
  const [logs, setLogs] = useState([]);
  const [entityFilter, setEntityFilter] = useState('all'); // 'all' | 'vistoria' | 'hidrante' | 'prepop'
  const [actionFilter, setActionFilter] = useState('all'); // 'all' | 'create' | 'edit' | 'delete'
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLogId, setExpandedLogId] = useState(null);

  // Carrega e assina atualizações do histórico
  useEffect(() => {
    if (!isOpen) return;

    const refreshLogs = () => {
      setLogs(getAuditLogs());
    };

    refreshLogs();

    const handleUpdate = () => refreshLogs();
    window.addEventListener('netuno_audit_updated', handleUpdate);
    return () => window.removeEventListener('netuno_audit_updated', handleUpdate);
  }, [isOpen]);

  // Contadores analíticos
  const metrics = useMemo(() => {
    const unread = logs.filter(l => l.unread).length;
    const vistorias = logs.filter(l => l.entityType === 'vistoria').length;
    const hidrantes = logs.filter(l => l.entityType === 'hidrante').length;
    const prepop = logs.filter(l => l.entityType === 'prepop').length;
    return { total: logs.length, unread, vistorias, hidrantes, prepop };
  }, [logs]);

  // Filtro inteligente
  const filteredLogs = useMemo(() => {
    return logs.filter(item => {
      if (entityFilter !== 'all' && item.entityType !== entityFilter) return false;
      if (actionFilter !== 'all' && item.action !== actionFilter) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const text = `
          ${item.title || ''} 
          ${item.entityName || ''} 
          ${item.entityId || ''} 
          ${item.location || ''} 
          ${item.author?.nome || ''} 
          ${item.author?.matricula || ''} 
          ${typeof item.details === 'string' ? item.details : JSON.stringify(item.details)}
        `.toLowerCase();
        if (!text.includes(term)) return false;
      }

      return true;
    });
  }, [logs, entityFilter, actionFilter, searchTerm]);

  if (!isOpen) return null;

  const handleMarkAllRead = () => {
    const updated = markAllAuditLogsAsRead();
    setLogs(updated);
  };

  const handleClearAll = () => {
    if (window.confirm('Deseja realmente limpar todo o histórico de ações e notificações do sistema? Esta ação não pode ser desfeita.')) {
      const updated = clearAuditLogs();
      setLogs(updated);
    }
  };

  const handleDeleteItem = (id, e) => {
    e.stopPropagation();
    const updated = deleteAuditLog(id);
    setLogs(updated);
  };

  const handleFocusOnMap = (coords, e) => {
    e.stopPropagation();
    if (onFocusLocation && coords) {
      onFocusLocation(coords);
      onClose();
    }
  };

  // Helper para cores de badges de ação
  const getActionBadge = (action) => {
    switch (action) {
      case 'create':
        return {
          label: 'Cadastrado',
          bg: 'bg-emerald-950/70 border-emerald-500/40 text-emerald-400',
          dot: 'bg-emerald-500',
          icon: <PlusCircle size={14} className="text-emerald-400" />
        };
      case 'edit':
        return {
          label: 'Editado',
          bg: 'bg-cyan-950/70 border-cyan-500/40 text-cyan-300',
          dot: 'bg-cyan-400',
          icon: <Edit3 size={14} className="text-cyan-300" />
        };
      case 'delete':
        return {
          label: 'Removido',
          bg: 'bg-rose-950/70 border-rose-500/40 text-rose-400',
          dot: 'bg-rose-500',
          icon: <Trash2 size={14} className="text-rose-400" />
        };
      default:
        return {
          label: action,
          bg: 'bg-slate-800 border-slate-700 text-slate-300',
          dot: 'bg-slate-400',
          icon: <History size={14} />
        };
    }
  };

  // Helper para ícone e etiqueta da entidade
  const getEntityBadge = (entityType) => {
    switch (entityType) {
      case 'vistoria':
        return {
          label: 'Vistoria',
          color: 'text-amber-300 bg-amber-950/50 border-amber-500/30',
          icon: <ClipboardCheck size={14} />
        };
      case 'hidrante':
        return {
          label: 'Hidrante',
          color: 'text-cyan-300 bg-cyan-950/50 border-cyan-500/30',
          icon: <Flame size={14} />
        };
      case 'prepop':
        return {
          label: 'PREPOP',
          color: 'text-emerald-300 bg-emerald-950/50 border-emerald-500/30',
          icon: <Building2 size={14} />
        };
      default:
        return {
          label: entityType,
          color: 'text-slate-300 bg-slate-800 border-slate-700',
          icon: <Layers size={14} />
        };
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-100 animate-scaleUp">
        
        {/* CABEÇALHO DO MODAL */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/70 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
              <History size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  Histórico e Notificações de Ações
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                  Apenas Gestor
                </span>
                {metrics.unread > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 animate-pulse">
                    {metrics.unread} nova{metrics.unread > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Rastreamento em tempo real de cadastros, edições e remoções de vistorias, hidrantes e PREPOP
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {metrics.unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-500/40 rounded-lg transition-all"
                title="Marcar todas como lidas"
              >
                <CheckCheck size={15} />
                <span>Marcar lidas</span>
              </button>
            )}

            {logs.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-400 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/30 rounded-lg transition-all"
                title="Limpar histórico de ações"
              >
                <Trash2 size={15} />
                <span>Limpar</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
              title="Fechar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* CARDS DE MÉTRICAS / RESUMO RÁPIDO */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 sm:p-4 bg-slate-950/40 border-b border-slate-800 shrink-0">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-2.5 flex flex-col">
            <span className="text-[11px] font-medium text-slate-400">Total de Ações</span>
            <span className="text-xl font-bold text-white mt-0.5">{metrics.total}</span>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-2.5 flex flex-col">
            <span className="text-[11px] font-medium text-amber-400 flex items-center gap-1">
              <ClipboardCheck size={12} /> Vistorias
            </span>
            <span className="text-xl font-bold text-amber-300 mt-0.5">{metrics.vistorias}</span>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-2.5 flex flex-col">
            <span className="text-[11px] font-medium text-cyan-400 flex items-center gap-1">
              <Flame size={12} /> Hidrantes
            </span>
            <span className="text-xl font-bold text-cyan-300 mt-0.5">{metrics.hidrantes}</span>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-2.5 flex flex-col">
            <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
              <Building2 size={12} /> PREPOP
            </span>
            <span className="text-xl font-bold text-emerald-300 mt-0.5">{metrics.prepop}</span>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-slate-800/60 border border-slate-700/60 rounded-xl p-2.5 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-purple-400 flex items-center gap-1">
              <Sparkles size={12} /> Não Lidas
            </span>
            <div className="flex items-center justify-between mt-0.5">
              <span className={`text-xl font-bold ${metrics.unread > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                {metrics.unread}
              </span>
              {metrics.unread > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="sm:hidden text-[10px] text-emerald-400 underline font-semibold"
                >
                  Ler todas
                </button>
              )}
            </div>
          </div>
        </div>

        {/* BARRA DE FILTROS E BUSCA */}
        <div className="p-3 sm:p-4 bg-slate-900/80 border-b border-slate-800 space-y-3 shrink-0">
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Campo de Busca */}
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por código, militar, RA ou detalhe da ação..."
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Ações Mobile de Limpar / Marcar Lidas */}
            <div className="flex sm:hidden gap-2">
              {metrics.unread > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="flex-1 py-1.5 px-2 text-xs font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 rounded-lg text-center"
                >
                  Marcar lidas
                </button>
              )}
              {logs.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="flex-1 py-1.5 px-2 text-xs font-semibold text-rose-400 bg-rose-950/40 border border-rose-500/30 rounded-lg text-center"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* Filtros em Abas / Pílulas */}
          <div className="flex flex-wrap items-center gap-2 justify-between">
            {/* Filtro por Entidade */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
              <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
                <Filter size={12} /> Entidade:
              </span>
              {[
                { id: 'all', label: 'Todas' },
                { id: 'vistoria', label: 'Vistorias' },
                { id: 'hidrante', label: 'Hidrantes' },
                { id: 'prepop', label: 'PREPOP' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setEntityFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                    entityFilter === tab.id
                      ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                      : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Filtro por Ação */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
              <span className="text-[11px] font-semibold text-slate-400 mr-1">Ação:</span>
              {[
                { id: 'all', label: 'Todas' },
                { id: 'create', label: 'Cadastros', color: 'text-emerald-400' },
                { id: 'edit', label: 'Edições', color: 'text-cyan-400' },
                { id: 'delete', label: 'Remoções', color: 'text-rose-400' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActionFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                    actionFilter === tab.id
                      ? 'bg-slate-700 text-white border border-slate-600 shadow-sm font-semibold'
                      : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                >
                  <span className={tab.color || ''}>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* LISTAGEM TIMELINE DAS AÇÕES */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 space-y-3">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-500 mb-3">
                <History size={32} />
              </div>
              <h3 className="text-base font-semibold text-slate-300">
                {logs.length === 0 ? 'Nenhum registro de auditoria no histórico' : 'Nenhuma ação encontrada para os filtros atuais'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mt-1">
                {logs.length === 0 
                  ? 'Todas as ações de cadastro, edição ou remoção de vistorias, hidrantes e PREPOP aparecerão automaticamente aqui.' 
                  : 'Tente ajustar o termo de pesquisa ou os seletores de entidade e ação acima.'}
              </p>
            </div>
          ) : (
            filteredLogs.map((item) => {
              const actionBadge = getActionBadge(item.action);
              const entityBadge = getEntityBadge(item.entityType);
              const isExpanded = expandedLogId === item.id;

              return (
                <div
                  key={item.id}
                  className={`group relative bg-slate-800/40 hover:bg-slate-800/80 border rounded-xl p-3 sm:p-4 transition-all ${
                    item.unread 
                      ? 'border-emerald-500/40 bg-emerald-950/10 shadow-sm' 
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Linha Principal do Card */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      
                      {/* Ícone Indicador da Ação */}
                      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${actionBadge.bg}`}>
                        {actionBadge.icon}
                      </div>

                      <div className="flex flex-col min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          {/* Badges de Entidade e Ação */}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${entityBadge.color}`}>
                            {entityBadge.icon}
                            <span>{entityBadge.label}</span>
                          </span>

                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${actionBadge.bg}`}>
                            <span>{actionBadge.label}</span>
                          </span>

                          {item.unread && (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-500 text-slate-950 uppercase tracking-widest shadow">
                              NOVO
                            </span>
                          )}

                          <span className="text-[11px] text-slate-400 flex items-center gap-1 ml-auto sm:ml-0" title={new Date(item.timestamp).toLocaleString('pt-BR')}>
                            <Clock size={12} className="text-slate-500" />
                            {formatRelativeTime(item.timestamp)}
                          </span>
                        </div>

                        {/* Título e Entidade */}
                        <div className="mt-1">
                          <h4 className="text-sm font-bold text-slate-100 group-hover:text-white transition-colors">
                            {item.title}
                          </h4>
                          {(item.entityName || item.entityId) && (
                            <div className="text-xs font-semibold text-slate-300 mt-0.5">
                              {item.entityName} {item.entityId && item.entityId !== item.entityName ? `(${item.entityId})` : ''}
                            </div>
                          )}
                        </div>

                        {/* Localização / RA se existir */}
                        {item.location && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
                            <MapPin size={12} className="text-emerald-400 shrink-0" />
                            <span className="truncate">{item.location}</span>
                          </div>
                        )}

                        {/* Autor da Ação */}
                        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-400">
                          <div className="flex items-center gap-1 bg-slate-900/60 px-2 py-0.5 rounded-md border border-slate-800">
                            <User size={12} className="text-slate-400" />
                            <span className="font-semibold text-slate-300">{item.author?.nome || 'Militar'}</span>
                            {item.author?.matricula && (
                              <span className="text-slate-500">({item.author.matricula})</span>
                            )}
                            {item.author?.role && (
                              <span className="text-emerald-400 text-[10px] ml-1 uppercase font-bold">
                                {item.author.role}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Detalhes específicos */}
                        {item.details && (
                          <div className="mt-2 text-xs text-slate-300 bg-slate-950/60 border border-slate-800/80 rounded-lg p-2 font-mono">
                            {typeof item.details === 'string' ? (
                              <p className="whitespace-pre-wrap font-sans text-xs text-slate-300 leading-relaxed">
                                {item.details}
                              </p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] font-sans">
                                {Object.entries(item.details).map(([k, v]) => (
                                  <div key={k} className="flex items-center gap-1 truncate">
                                    <span className="text-slate-500">{k}:</span>
                                    <span className="text-slate-200 font-semibold truncate">{String(v)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Botões de Ação Rápida no Card */}
                    <div className="flex items-center gap-1 shrink-0">
                      {item.coords && (
                        <button
                          type="button"
                          onClick={(e) => handleFocusOnMap(item.coords, e)}
                          className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 rounded-lg transition-all"
                          title="Centralizar no Mapa Tático"
                        >
                          <LocateFixed size={13} />
                          <span className="hidden sm:inline">Ver no Mapa</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => handleDeleteItem(item.id, e)}
                        className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-md transition-colors"
                        title="Remover este registro"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* RODAPÉ INFORMATIVO */}
        <div className="px-4 py-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Auditoria ativa no Super Argos 2.1</span>
          </div>
          <span>Exclusivo para Gestores de Hidrantes e Administradores</span>
        </div>

      </div>
    </div>
  );
}
