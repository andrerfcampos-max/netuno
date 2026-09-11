import { syncHydrantMutationToCloud } from '../services/syncService';

const AUDIT_STORAGE_KEY = 'netuno_audit_logs';
const MAX_AUDIT_LOGS = 250;

/**
 * Obtém todos os registros de auditoria ordenados do mais recente para o mais antigo,
 * com higienização automática contra duplicidades ocorridas em curto intervalo.
 */
export const getAuditLogs = () => {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Deduplicação inteligente de registros redundantes gravados com pequeno intervalo (< 6 segundos)
    const deduplicated = [];
    for (let i = 0; i < parsed.length; i++) {
      const current = parsed[i];
      if (!current || !current.id) continue;

      const isDuplicate = deduplicated.some(existing => {
        if (existing.entityType !== current.entityType) return false;
        
        // Verifica compatibilidade de entidade (mesmo ID ou nome contido)
        const idMatch = existing.entityId && current.entityId && String(existing.entityId) === String(current.entityId);
        const nameMatch = existing.entityName && current.entityName && (
          existing.entityName.includes(current.entityName) || current.entityName.includes(existing.entityName)
        );
        if (!idMatch && !nameMatch) return false;

        // Verifica proximidade temporal (< 6 segundos)
        const timeDiff = Math.abs(new Date(existing.timestamp).getTime() - new Date(current.timestamp).getTime());
        return !isNaN(timeDiff) && timeDiff < 6000;
      });

      if (!isDuplicate) {
        deduplicated.push(current);
      }
    }

    if (deduplicated.length !== parsed.length) {
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(deduplicated));
    }

    return deduplicated;
  } catch (err) {
    console.error('Erro ao ler logs de auditoria:', err);
    return [];
  }
};

/**
 * Salva a lista de logs no localStorage e dispara evento de sincronização local.
 */
const saveAuditLogs = (logs) => {
  try {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(logs.slice(0, MAX_AUDIT_LOGS)));
    window.dispatchEvent(new CustomEvent('netuno_audit_updated', { detail: logs }));
  } catch (err) {
    console.error('Erro ao salvar logs de auditoria:', err);
  }
};

/**
 * Registra uma nova ação de auditoria no sistema.
 * 
 * @param {Object} entry
 * @param {'vistoria'|'hidrante'|'prepop'} entry.entityType - Tipo da entidade
 * @param {'create'|'edit'|'delete'} entry.action - Tipo da ação (cadastrar, editar, remover)
 * @param {string} entry.title - Título descritivo da ação
 * @param {string} [entry.entityId] - Identificador único da entidade
 * @param {string} [entry.entityName] - Nome ou código da entidade (ex: BSB0012, JK Shopping)
 * @param {string} [entry.location] - Localidade/RA ou endereço
 * @param {Object} [entry.author] - Dados do usuário autor { nome, matricula, role }
 * @param {string|Object} [entry.details] - Detalhes específicos da ação
 * @param {{lat: number, lng: number}} [entry.coords] - Coordenadas geográficas para localização
 */
export const logAuditEvent = ({
  entityType,
  action,
  title,
  entityId = '',
  entityName = '',
  location = '',
  author = null,
  details = '',
  coords = null
}) => {
  try {
    const currentLogs = getAuditLogs();

    // Evita duplicações em rápida sucessão (< 4 segundos) para a mesma entidade e ação
    const isRecentDuplicate = currentLogs.slice(0, 10).some(log => {
      if (log.entityType !== (entityType || 'hidrante')) return false;
      if (log.action !== (action || 'create')) return false;
      
      const idMatch = entityId && log.entityId && String(log.entityId) === String(entityId);
      const nameMatch = entityName && log.entityName && (
        log.entityName.includes(entityName) || entityName.includes(log.entityName)
      );
      if (!idMatch && !nameMatch) return false;

      const diffMs = Math.abs(Date.now() - new Date(log.timestamp).getTime());
      return !isNaN(diffMs) && diffMs < 4000;
    });

    if (isRecentDuplicate) {
      console.warn('[auditLogger] Evento duplicado prevenido e ignorado:', title);
      return null;
    }
    
    // Obter dados do autor da sessão se não fornecido
    let finalAuthor = author;
    if (!finalAuthor) {
      try {
        const savedUser = localStorage.getItem('netuno_auth_user');
        if (savedUser) finalAuthor = JSON.parse(savedUser);
      } catch (e) { console.warn("[SafeCatch] Erro mitigado:", e); }
    }

    const newEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      entityType: entityType || 'hidrante', // 'vistoria' | 'hidrante' | 'prepop'
      action: action || 'create', // 'create' | 'edit' | 'delete'
      title: title || 'Ação no Sistema',
      entityId: String(entityId || ''),
      entityName: String(entityName || ''),
      location: String(location || ''),
      author: {
        nome: finalAuthor?.nome || 'Militar em Campo',
        matricula: finalAuthor?.matricula || 'N/I',
        role: finalAuthor?.role || 'vistoriador'
      },
      details: typeof details === 'object' ? details : String(details || ''),
      coords: coords && typeof coords.lat === 'number' && typeof coords.lng === 'number' ? coords : null,
      unread: true
    };

    const updatedLogs = [newEntry, ...currentLogs];
    saveAuditLogs(updatedLogs);

    // Propaga mutação para a nuvem caso o Supabase esteja configurado
    try {
      syncHydrantMutationToCloud('audit_event', newEntry);
    } catch (syncErr) {
      console.warn('Não foi possível enviar log de auditoria para a nuvem:', syncErr);
    }

    return newEntry;
  } catch (err) {
    console.error('Erro ao registrar log de auditoria:', err);
    return null;
  }
};

/**
 * Retorna o número de ações não lidas registradas.
 */
export const getUnreadAuditCount = () => {
  const logs = getAuditLogs();
  return logs.filter(l => l.unread === true).length;
};

/**
 * Marca todas as ações do histórico como lidas.
 */
export const markAllAuditLogsAsRead = () => {
  const logs = getAuditLogs();
  const updated = logs.map(l => ({ ...l, unread: false }));
  saveAuditLogs(updated);
  return updated;
};

/**
 * Remove um item individual do histórico.
 */
export const deleteAuditLog = (id) => {
  const logs = getAuditLogs();
  const updated = logs.filter(l => l.id !== id);
  saveAuditLogs(updated);
  return updated;
};

/**
 * Limpa todo o histórico de auditoria local.
 */
export const clearAuditLogs = () => {
  saveAuditLogs([]);
  return [];
};
