import { syncHydrantMutationToCloud } from '../services/syncService';

const AUDIT_STORAGE_KEY = 'netuno_audit_logs';
const MAX_AUDIT_LOGS = 250;

/**
 * Obtém todos os registros de auditoria ordenados do mais recente para o mais antigo.
 */
export const getAuditLogs = () => {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
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
