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
  Sparkles,
  Calendar
} from 'lucide-react';
import { 
  getAuditLogs, 
  markAllAuditLogsAsRead,
  mergeAuditLogs,
  extractHydrantKeyFromLog
} from '../utils/auditLogger';
import { isCloudConfigured } from '../services/supabase';
import { fetchHydrantMutationsFromCloud, fetchAuditLogsFromCloud } from '../services/syncService';
import { getHydrantAllIds } from '../utils/idMapping';
import { parseDate, formatDateTimeDisplay, isToday, isWithinDays, formatDateOnly } from '../utils/dateUtils';

// Formatação padronizada e canônica de data e horário das ações (DD/MM/AAAA às HH:mm)
const formatActionDateTime = (timestamp) => {
  if (!timestamp) return 'Sem registro';
  try {
    const d = parseDate(timestamp);
    if (!d) return String(timestamp);
    return formatDateTimeDisplay(d, { shortTime: true });
  } catch (e) {
    return String(timestamp);
  }
};

export default function SystemHistoryModal({
  isOpen,
  onClose,
  onFocusLocation,
  currentUser,
  hidrantes = [],
  onEditInspection
}) {
  const [logs, setLogs] = useState([]);
  const [entityFilter, setEntityFilter] = useState('all'); // 'all' | 'vistoria' | 'hidrante' | 'prepop'
  const [actionFilter, setActionFilter] = useState('all'); // 'all' | 'create' | 'edit' | 'delete'
  const [periodFilter, setPeriodFilter] = useState('all'); // 'all' | 'today' | '7days' | '30days'
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLogId, setExpandedLogId] = useState(null);

  // Mapeamento dinâmico de aliases para códigos canônicos de hidrantes
  const hydrantCodeMap = useMemo(() => {
    const map = new Map();
    (hidrantes || []).forEach(h => {
      const canonical = String(h.nomHidrante || h.codHidrante || h._internalId || '').trim().toUpperCase();
      if (!canonical) return;
      getHydrantAllIds(h).forEach(id => {
        const s = String(id).trim().toUpperCase();
        if (s) map.set(s, canonical);
      });
      if (h.nomHidrante) {
        const clean = String(h.nomHidrante).trim().toUpperCase().replace(/[\s\-_]/g, '');
        map.set(clean, canonical);
      }
    });
    return map;
  }, [hidrantes]);

  const resolveHydrantKey = (log) => {
    const baseKey = extractHydrantKeyFromLog(log);
    if (!baseKey) return '';
    return hydrantCodeMap.get(baseKey) || baseKey;
  };

  // Carrega e assina atualizações do histórico
  useEffect(() => {
    if (!isOpen) return;

    const refreshLogs = () => {
      setLogs(getAuditLogs());
    };

    refreshLogs();

    // Sincroniza da nuvem em segundo plano para garantir o histórico multiusuário mais recente
    if (isCloudConfigured() && navigator.onLine) {
      fetchAuditLogsFromCloud(250).then(cloudLogs => {
        if (Array.isArray(cloudLogs) && cloudLogs.length > 0) {
          const merged = mergeAuditLogs(cloudLogs);
          setLogs(merged);
        }
      }).catch(err => console.warn('Erro ao atualizar histórico da nuvem no modal:', err));
    }

    const handleUpdate = () => refreshLogs();
    window.addEventListener('netuno_audit_updated', handleUpdate);
    return () => window.removeEventListener('netuno_audit_updated', handleUpdate);
  }, [isOpen]);

  // Consolidação de redundância total:
  // Garante que todas as vistorias presentes nos hidrantes ativos (mesmo que vindas diretamente da nuvem
  // ou sem mutação audit_event prévia) sejam refletidas no histórico e contadores
  const effectiveLogs = useMemo(() => {
    if (!Array.isArray(hidrantes) || hidrantes.length === 0) return logs;
    const knownKeys = new Set();
    (logs || []).forEach(l => {
      const hKey = resolveHydrantKey(l);
      const dayKey = formatDateOnly(l.timestamp);
      if (hKey && dayKey && dayKey !== '-') {
        knownKeys.add(`${hKey}_${dayKey}`);
      }
    });

    const extraLogs = [];
    hidrantes.forEach(h => {
      const rawDate = h.datHoraUltimaVistoria || h.datHoraVistoria;
      if (!rawDate) return;
      const dayKey = formatDateOnly(rawDate);
      if (!dayKey || dayKey === '-' || dayKey.startsWith('18/06/2025')) return;
      
      const canonicalKey = String(h.nomHidrante || h.codHidrante || h._internalId || '').trim().toUpperCase();
      if (!canonicalKey) return;
      const compoundKey = `${canonicalKey}_${dayKey}`;

      if (!knownKeys.has(compoundKey)) {
        knownKeys.add(compoundKey);
        const parsedD = parseDate(rawDate);
        extraLogs.push({
          id: `audit_synced_h_${canonicalKey}_${dayKey.replace(/\//g, '_')}`,
          timestamp: parsedD ? parsedD.toISOString() : new Date().toISOString(),
          entityType: 'vistoria',
          action: 'create',
          title: `Nova Vistoria Realizada: ${canonicalKey}`,
          entityId: canonicalKey,
          entityName: `${canonicalKey} - ${h.dscEndereco || ''}`.trim(),
          location: h.dscLocalidade || '',
          author: {
            nome: h.vistoriadorNome || 'Militar Vistoriador',
            matricula: h.vistoriadorMatricula || '-',
            role: 'vistoriador'
          },
          details: `Status: ${h.flgAtivo ? 'Operante' : 'Inoperante'}${h.problemasHidrante ? ' | Problemas: ' + h.problemasHidrante : ''}`,
          coords: (h.numLatitude && h.numLongitude) ? { lat: Number(h.numLatitude), lng: Number(h.numLongitude) } : null,
          unread: false
        });
      }
    });

    if (extraLogs.length === 0) return logs;
    return [...logs, ...extraLogs].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  }, [logs, hidrantes, hydrantCodeMap]);

  // Contadores analíticos com Regra Canônica Netuno:
  // Vistorias Hoje: 1 hidrante = 1 vistoria por dia (elimina erros de recadastro ou correções do gestor poucos minutos depois)
  const metrics = useMemo(() => {
    const unread = effectiveLogs.filter(l => l.unread).length;
    const hidrantesCount = effectiveLogs.filter(l => l.entityType === 'hidrante').length;
    const prepop = effectiveLogs.filter(l => l.entityType === 'prepop').length;

    // Vistorias Hoje: hidrantes únicos com vistoria ativa realizada hoje
    const seenTodayHydrants = new Set();
    effectiveLogs.forEach(l => {
      if (l.entityType === 'vistoria' && l.action !== 'delete' && isToday(l.timestamp)) {
        const hKey = resolveHydrantKey(l);
        if (hKey) seenTodayHydrants.add(hKey);
      }
    });
    const vistoriasHoje = seenTodayHydrants.size;

    // Vistorias Total: pares únicos de (hidrante, data)
    const seenAllVistorias = new Set();
    effectiveLogs.forEach(l => {
      if (l.entityType === 'vistoria' && l.action !== 'delete') {
        const hKey = resolveHydrantKey(l);
        const dateKey = formatDateOnly(l.timestamp);
        if (hKey && dateKey && dateKey !== '-') {
          seenAllVistorias.add(`${hKey}_${dateKey}`);
        }
      }
    });
    const vistorias = seenAllVistorias.size;

    return { total: effectiveLogs.length, unread, vistorias, hidrantes: hidrantesCount, prepop, vistoriasHoje };
  }, [effectiveLogs, hydrantCodeMap]);

  // Filtro inteligente multi-dimensão (Entidade, Ação, Período Temporal e Busca)
  const filteredLogs = useMemo(() => {
    // Se estiver filtrando vistorias, aplica deduplicação defensiva no mesmo dia
    const seenSameDayVistoria = new Set();

    return effectiveLogs.filter(item => {
      if (entityFilter === 'unread') {
        if (!item.unread) return false;
      } else if (entityFilter !== 'all' && item.entityType !== entityFilter) {
        return false;
      }
      if (actionFilter !== 'all' && item.action !== actionFilter) return false;

      // Filtro Temporal
      if (periodFilter === 'today') {
        if (!isToday(item.timestamp)) return false;
      } else if (periodFilter === '7days') {
        if (!isWithinDays(item.timestamp, 7)) return false;
      } else if (periodFilter === '30days') {
        if (!isWithinDays(item.timestamp, 30)) return false;
      }

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

      // Regra Canônica de Vistorias: se for vistoria e já vimos este hidrante nesta mesma data (mais recente já passou),
      // ignora a tentativa/recadastro anterior para que a lista reflita exatamente a contagem canônica
      if (item.entityType === 'vistoria' && item.action !== 'delete') {
        const hKey = resolveHydrantKey(item);
        const dayKey = formatDateOnly(item.timestamp);
        const uniqueKey = `${hKey}_${dayKey}`;
        if (seenSameDayVistoria.has(uniqueKey)) {
          return false;
        }
        seenSameDayVistoria.add(uniqueKey);
      }

      return true;
    });
  }, [logs, entityFilter, actionFilter, periodFilter, searchTerm, hydrantCodeMap]);

  if (!isOpen) return null;

  const handleMarkAllRead = () => {
    const updated = markAllAuditLogsAsRead();
    setLogs(updated);
  };


  const handleFocusOnMap = (coords, e) => {
    e.stopPropagation();
    if (onFocusLocation && coords) {
      onFocusLocation(coords);
      onClose();
    }
  };

  const handleDirectEditInspection = (item, e) => {
    e.stopPropagation();
    if (!onEditInspection) return;

    // Tenta localizar o hidrante real correspondente na base
    const targetHydrant = (hidrantes || []).find(h => {
      const allIds = getHydrantAllIds(h);
      if (item.entityId && allIds.includes(String(item.entityId))) return true;
      if (item.entityName && allIds.includes(String(item.entityName))) return true;
      if (item.entityId && String(h.codHidrante) === String(item.entityId)) return true;
      if (item.entityName && String(h.nomHidrante) === String(item.entityName)) return true;
      return false;
    });

    if (targetHydrant) {
      onEditInspection(targetHydrant);
      onClose();
    } else {
      // Fallback seguro com dados do log para abrir o modal de edição
      const fallbackH = {
        _internalId: item.entityId || `hist_${item.id}`,
        codHidrante: item.entityId,
        nomHidrante: item.entityName || item.entityId,
        dscLocalidade: item.location || '',
        numLatitude: item.coords?.lat,
        numLongitude: item.coords?.lng,
        _isEditing: true
      };
      onEditInspection(fallbackH);
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
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-1 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-4xl h-[94vh] sm:h-[88vh] flex flex-col overflow-hidden text-slate-100 animate-scaleUp">
        
        {/* CABEÇALHO DO MODAL */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3.5 border-b border-slate-800 bg-slate-900/95 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-emerald-950/70 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
              <History size={18} className="sm:w-[22px] sm:h-[22px]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-wide truncate">
                  Histórico e Notificações
                </h2>
                <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold tracking-wider uppercase bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 shrink-0">
                  Gestor
                </span>
                {metrics.unread > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-amber-500 text-slate-950 animate-pulse shrink-0">
                    {metrics.unread} nova{metrics.unread > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="hidden sm:block text-xs text-slate-400 mt-0.5 truncate">
                Rastreamento em tempo real de cadastros, edições e remoções de vistorias, hidrantes e PREPOP
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {metrics.unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-500/40 rounded-lg transition-all"
                title="Marcar todas como lidas"
              >
                <CheckCheck size={14} />
                <span className="hidden sm:inline">Marcar lidas</span>
              </button>
            )}


            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all ml-0.5"
              title="Fechar"
            >
              <X size={18} className="sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* CHIPS DE MÉTRICAS & FILTRO POR ENTIDADE (COMPACTO E INTEGRADO) */}
        <div className="flex items-center gap-1.5 px-3 sm:px-6 py-2 bg-slate-950/60 border-b border-slate-800/80 overflow-x-auto shrink-0 scrollbar-none">
          {/* Badge Destacado de Vistorias Hoje */}
          <button
            type="button"
            onClick={() => {
              setEntityFilter('vistoria');
              setPeriodFilter('today');
              setActionFilter('all');
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap border shrink-0 bg-amber-950/70 border-amber-500/50 text-amber-300 shadow-xs hover:bg-amber-900/80 transition-all cursor-pointer"
            title="Filtrar vistorias realizadas hoje"
          >
            <Calendar size={13} className="text-amber-400 shrink-0" />
            <span>Hoje:</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-500 text-slate-950">
              {metrics.vistoriasHoje} {metrics.vistoriasHoje === 1 ? 'vistoria' : 'vistorias'}
            </span>
          </button>

          {[
            { id: 'all', label: 'Todas', count: metrics.total, icon: <Layers size={13} />, color: 'text-slate-300', activeBg: 'bg-emerald-600 text-white border-emerald-500' },
            { id: 'vistoria', label: 'Vistorias', count: metrics.vistorias, icon: <ClipboardCheck size={13} />, color: 'text-amber-400', activeBg: 'bg-amber-600 text-white border-amber-500' },
            { id: 'hidrante', label: 'Hidrantes', count: metrics.hidrantes, icon: <Flame size={13} />, color: 'text-cyan-400', activeBg: 'bg-cyan-600 text-white border-cyan-500' },
            { id: 'prepop', label: 'PREPOP', count: metrics.prepop, icon: <Building2 size={13} />, color: 'text-emerald-400', activeBg: 'bg-emerald-600 text-white border-emerald-500' },
            ...(metrics.unread > 0 ? [{ id: 'unread', label: 'Não Lidas', count: metrics.unread, icon: <Sparkles size={13} />, color: 'text-purple-400', activeBg: 'bg-purple-600 text-white border-purple-500' }] : [])
          ].map((chip) => {
            const isActive = entityFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setEntityFilter(chip.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border shrink-0 cursor-pointer ${
                  isActive
                    ? `${chip.activeBg} shadow-sm`
                    : 'bg-slate-800/70 border-slate-700/60 text-slate-300 hover:bg-slate-700/80 hover:text-white'
                }`}
              >
                <span className={isActive ? 'text-white' : chip.color}>{chip.icon}</span>
                <span>{chip.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-black/30 text-white' : 'bg-slate-900/90 text-slate-300 border border-slate-700/50'
                }`}>
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* BARRA DE BUSCA E FILTRO DE TIPO DE AÇÃO */}
        <div className="px-3 sm:px-6 py-2 bg-slate-900/90 border-b border-slate-800 shrink-0 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          {/* Campo de Busca Slim */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código, militar, RA ou detalhe..."
              className="w-full pl-8 pr-7 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                title="Limpar busca"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filtro por Tipo de Ação (Horizontal compacto) */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 shrink-0">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mr-0.5 hidden sm:inline">Ação:</span>
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
                className={`px-2 py-1 text-[11px] rounded-md font-medium transition-all cursor-pointer whitespace-nowrap border ${
                  actionFilter === tab.id
                    ? 'bg-slate-700 text-white border-slate-500 shadow-xs font-semibold'
                    : 'bg-slate-800/60 border-slate-700/40 text-slate-400 hover:bg-slate-700/60 hover:text-slate-200'
                }`}
              >
                <span className={actionFilter === tab.id ? 'text-white' : tab.color || ''}>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* BARRA DE FILTRO POR PERÍODO DE TEMPO & CONTADOR DINÂMICO */}
        <div className="px-3 sm:px-6 py-1.5 bg-slate-950/75 border-b border-slate-800 flex items-center justify-between gap-2 overflow-x-auto shrink-0 scrollbar-none">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-0.5">
              <Calendar size={12} className="text-slate-500" />
              <span>Período:</span>
            </span>
            {[
              { id: 'all', label: 'Todo Período' },
              { id: 'today', label: 'Hoje' },
              { id: '7days', label: '7 dias' },
              { id: '30days', label: '30 dias' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriodFilter(p.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all border cursor-pointer whitespace-nowrap ${
                  periodFilter === p.id
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                    : 'bg-slate-900/80 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Contador Dinâmico de Resultados Filtrados */}
          <div className="flex items-center gap-1 shrink-0 text-[11px] font-medium text-slate-400">
            <span className="hidden sm:inline">Exibindo:</span>
            <span className="font-bold font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-1.5 py-0.2 rounded text-[10.5px]">
              {filteredLogs.length}
            </span>
            <span className="text-[10.5px] text-slate-400">
              {filteredLogs.length === 1 ? 'registro' : 'registros'}
            </span>
          </div>
        </div>

        {/* LISTAGEM TIMELINE DAS AÇÕES */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-4 space-y-2.5">
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
                  className={`group relative bg-slate-800/50 hover:bg-slate-800/90 border rounded-lg p-2 sm:p-2.5 transition-all shadow-xs ${
                    item.unread 
                      ? 'border-emerald-500/50 bg-emerald-950/20 shadow-xs' 
                      : 'border-slate-700/60 hover:border-slate-600'
                  }`}
                >
                  {/* Linha 1: Badges, Tempo e Ações Rápidas */}
                  <div className="flex items-center justify-between gap-1.5 w-full">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      {/* Ícone Indicador Compacto */}
                      <div className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 ${actionBadge.bg}`}>
                        {React.cloneElement(actionBadge.icon, { size: 12 })}
                      </div>

                      {/* Badges de Entidade e Ação */}
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold border uppercase tracking-wider ${entityBadge.color}`}>
                        {React.cloneElement(entityBadge.icon, { size: 10 })}
                        <span>{entityBadge.label}</span>
                      </span>

                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-bold border ${actionBadge.bg}`}>
                        <span>{actionBadge.label}</span>
                      </span>

                      {item.unread && (
                        <span className="px-1.5 py-0.2 rounded text-[8.5px] font-black bg-emerald-500 text-slate-950 uppercase tracking-wider shadow-xs">
                          NOVO
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span 
                        className="text-[10px] text-slate-400 flex items-center gap-1 font-medium whitespace-nowrap" 
                        title={formatDateTimeDisplay(item.timestamp, { fallback: '' })}
                      >
                        <Clock size={11} className="text-slate-500 shrink-0" />
                        {formatActionDateTime(item.timestamp)}
                      </span>

                      {item.coords && (
                        <button
                          type="button"
                          onClick={(e) => handleFocusOnMap(item.coords, e)}
                          className="p-1 text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 rounded transition-all active:scale-95 cursor-pointer"
                          title="Centralizar no Mapa Tático"
                        >
                          <LocateFixed size={12} />
                        </button>
                      )}

                      {onEditInspection && (item.entityType === 'vistoria' || (item.title && item.title.toLowerCase().includes('vistoria'))) && (
                        <button
                          type="button"
                          onClick={(e) => handleDirectEditInspection(item, e)}
                          className="flex items-center gap-1 px-1.5 py-0.5 text-[9.5px] font-bold text-amber-300 bg-amber-950/70 hover:bg-amber-900/90 border border-amber-500/40 rounded transition-all active:scale-95 cursor-pointer shadow-xs"
                          title="Acessar e editar vistoria diretamente"
                        >
                          <Edit3 size={11} className="text-amber-400 shrink-0" />
                          <span>Editar</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Linha 2: Título e Identificação do Alvo */}
                  <div className="mt-1 flex items-baseline gap-1.5 min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-white transition-colors truncate">
                      {item.title}
                    </h4>
                    {(item.entityName || item.entityId) && item.entityName !== item.title && (
                      <span className="text-[11px] text-slate-300 font-medium truncate hidden sm:inline">
                        • {item.entityName} {item.entityId && item.entityId !== item.entityName ? `(${item.entityId})` : ''}
                      </span>
                    )}
                  </div>

                  {/* Linha 3: Metadados Compactos (Localização e Militar) */}
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-slate-400 mt-0.5">
                    {item.location && (
                      <span className="flex items-center gap-0.5 text-cyan-300 font-medium">
                        <MapPin size={10} className="text-cyan-400 shrink-0" />
                        <span className="truncate max-w-[150px]">{item.location}</span>
                      </span>
                    )}
                    <span className="flex items-center gap-0.5 text-slate-300">
                      <User size={10} className="text-slate-400 shrink-0" />
                      <span className="font-semibold">{item.author?.nome || 'Militar'}</span>
                      {item.author?.matricula && <span className="text-slate-400">({item.author.matricula})</span>}
                      {item.author?.role && (
                        <span className="text-emerald-400 font-bold uppercase ml-0.5 text-[9px]">[{item.author.role}]</span>
                      )}
                    </span>
                  </div>

                  {/* Linha 4: Detalhes específicos (se existirem) */}
                  {item.details && (
                    <div className="mt-1 text-[10.5px] text-slate-300 bg-slate-950/60 border border-slate-800/80 rounded p-1.5 font-sans leading-tight">
                      {typeof item.details === 'string' ? (
                        <p className="whitespace-pre-wrap text-slate-300">
                          {item.details}
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
                          {Object.entries(item.details).map(([k, v]) => (
                            <div key={k} className="flex items-center gap-1 truncate">
                              <span className="text-slate-400">{k}:</span>
                              <span className="text-slate-200 font-medium truncate">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* RODAPÉ INFORMATIVO */}
        <div className="px-3 sm:px-4 py-2 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            <span className="truncate">Auditoria ativa</span>
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400 font-semibold">{filteredLogs.length}</span>
            <span className="text-slate-500">exibido{filteredLogs.length !== 1 ? 's' : ''}</span>
          </div>
          <span className="text-slate-500 text-[10px] sm:text-[11px] shrink-0">
            <span className="hidden sm:inline">Exclusivo Gestores & Admin</span>
            <span className="sm:hidden">Gestores & Admin</span>
          </span>
        </div>

      </div>
    </div>
  );
}
