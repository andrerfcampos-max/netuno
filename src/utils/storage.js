import { translateId } from './idMapping';

const MISSIONS_STORAGE_KEY = 'netuno_missions';
const LEGACY_MISSIONS_STORAGE_KEY = 'argos_missions';
const FOLDERS_STORAGE_KEY = 'netuno_folders';
const LEGACY_FOLDERS_STORAGE_KEY = 'argos_folders';

export const sanitizeMissionId = (id) => {
  if (!id) return '';
  const s = String(id).trim();
  if (/^\d+$/.test(s)) {
    const canonical = translateId(s);
    if (canonical) return canonical;
  }
  return s;
};

export const sanitizeMissionList = (list) => {
  if (!Array.isArray(list)) return [];
  return Array.from(new Set(list.map(sanitizeMissionId).filter(Boolean)));
};

export const loadMissions = () => {
  try {
    const data = localStorage.getItem(MISSIONS_STORAGE_KEY) || localStorage.getItem(LEGACY_MISSIONS_STORAGE_KEY);
    if (data !== null) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        // Limpeza automática de rascunhos antigos (de dias anteriores)
        const todayString = new Date().toDateString();
        return parsed.filter(m => {
          if (m.isDraft) {
            const createdString = new Date(m.createdAt).toDateString();
            return createdString === todayString;
          }
          return true;
        }).map(m => {
          // Garante recuperação de orderedIds caso tenham sido omitidos ou limpos por sync externo
          let orderedIds = Array.isArray(m.orderedIds) ? m.orderedIds : [];
          if (orderedIds.length === 0 && m.id) {
            try {
              const cached = localStorage.getItem(`netuno_mission_ordered_${m.id}`);
              if (cached) {
                const parsedOrdered = JSON.parse(cached);
                if (Array.isArray(parsedOrdered) && parsedOrdered.length > 0) {
                  orderedIds = parsedOrdered;
                }
              }
            } catch (e) {}
          }
          return {
            ...m,
            selectedIds: sanitizeMissionList(m.selectedIds),
            completedIds: sanitizeMissionList(m.completedIds),
            orderedIds: sanitizeMissionList(orderedIds),
          };
        });
      }
    }
    // Primeira inicialização sem dados: retorna lista vazia dinâmica para produção
    return [];
  } catch (error) {
    console.error("Erro ao ler missões do localStorage", error);
    return [];
  }
};

/**
 * Higieniza as alterações de hidrantes para não estourar a cota de 5MB do localStorage.
 * Fotos em Base64 grandes (>35KB) são preservadas na nuvem / IndexedDB e retiradas
 * do cache de texto bruto do localStorage para manter o sistema leve e veloz.
 */
export const sanitizeChangesForLocalStorage = (changes) => {
  if (!changes || typeof changes !== 'object') return { updated: {}, added: [], deleted: [] };

  const sanitizedUpdated = {};
  const entries = Object.entries(changes.updated || {});

  // Mantém no máximo as últimas 350 alterações recentes na memória do navegador
  const recentEntries = entries.length > 350 ? entries.slice(entries.length - 350) : entries;

  for (const [id, h] of recentEntries) {
    if (!h) continue;
    const cleanH = { ...h };

    // Remove Base64 grandes (>35KB) de fotoVistoria do localStorage
    if (typeof cleanH.fotoVistoria === 'string' && cleanH.fotoVistoria.length > 35000) {
      delete cleanH.fotoVistoria;
    }

    // Filtra fotos pesadas do array fotosVistoria
    if (Array.isArray(cleanH.fotosVistoria)) {
      cleanH.fotosVistoria = cleanH.fotosVistoria.filter(f => typeof f === 'string' && f.length <= 35000);
      if (cleanH.fotosVistoria.length === 0) {
        delete cleanH.fotosVistoria;
      }
    }

    // Limpa fotos em Base64 do histórico de vistorias arquivadas para não inflar o JSON
    if (Array.isArray(cleanH.HISTORICO_VISTORIAS)) {
      cleanH.HISTORICO_VISTORIAS = cleanH.HISTORICO_VISTORIAS.map(v => {
        if (!v) return v;
        const cleanV = { ...v };
        if (typeof cleanV.fotoVistoria === 'string' && cleanV.fotoVistoria.length > 15000) {
          delete cleanV.fotoVistoria;
        }
        if (Array.isArray(cleanV.fotosVistoria)) {
          delete cleanV.fotosVistoria;
        }
        return cleanV;
      });
    }

    sanitizedUpdated[id] = cleanH;
  }

  return {
    updated: sanitizedUpdated,
    added: Array.isArray(changes.added) ? changes.added : [],
    deleted: Array.isArray(changes.deleted) ? changes.deleted : []
  };
};

/**
 * Rotina automática de expurgo de caches secundários e desinchaço para recuperação
 * transparente quando o navegador atinge a cota de armazenamento local.
 */
export const purgeExcessLocalStorage = () => {
  try {
    // 1. Remove logs de sincronização secundários
    localStorage.removeItem('netuno_offline_sync_logs');

    // 2. Remove caches temporários ou de ordenação órfãos antigos
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('netuno_mission_ordered_') || k.startsWith('argos_') || k.startsWith('temp_'))) {
        localStorage.removeItem(k);
      }
    }

    // 3. Compacta netuno_hydrant_changes limpando fotos antigas do texto local
    const rawChanges = localStorage.getItem(HYDRANT_CHANGES_KEY);
    if (rawChanges) {
      const parsed = JSON.parse(rawChanges);
      const compacted = sanitizeChangesForLocalStorage(parsed);
      localStorage.setItem(HYDRANT_CHANGES_KEY, JSON.stringify(compacted));
    }
  } catch (e) {
    console.warn('[Storage] Falha ao expurgar excesso do localStorage:', e);
  }
};

const safeSetItem = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`[Storage] Tentativa de escrita falhou para ${key}, acionando recuperação de cota...`, error);
    if (error.name === 'QuotaExceededError' || (error.message && error.message.includes('quota'))) {
      try {
        // Tenta liberar espaço preventivamente
        purgeExcessLocalStorage();

        // Se a chave que falhou for HYDRANT_CHANGES_KEY, compacta antes de tentar novamente
        let valueToSave = value;
        if (key === HYDRANT_CHANGES_KEY) {
          try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            valueToSave = JSON.stringify(sanitizeChangesForLocalStorage(parsed));
          } catch (pe) {}
        }

        localStorage.setItem(key, valueToSave);
        console.info(`[Storage] Auto-recuperação de armazenamento concluída com sucesso para ${key}!`);
        return;
      } catch (retryError) {
        console.error(`[Storage] Falha crítica após auto-limpeza para ${key}:`, retryError);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('netuno_storage_warning', {
            detail: { key, message: 'Armazenamento local otimizado. Sincronize com a nuvem.' }
          }));
        }
      }
    }
  }
};

export const saveMissions = (missions) => {
  safeSetItem(MISSIONS_STORAGE_KEY, JSON.stringify(missions));
  if (Array.isArray(missions)) {
    missions.forEach(m => {
      if (m && m.id && Array.isArray(m.orderedIds) && m.orderedIds.length > 0) {
        try {
          localStorage.setItem(`netuno_mission_ordered_${m.id}`, JSON.stringify(m.orderedIds));
        } catch (e) {}
      }
    });
  }
};

const DEFAULT_FOLDERS = [
  { id: 'f-sehur', name: 'SEHUR', parentFolderId: null, isFixed: true },
  { id: 'f-1gbm', name: '1º GBM - Brasília', parentFolderId: null, isFixed: true },
  { id: 'f-2gbm', name: '2º GBM - Taguatinga', parentFolderId: null, isFixed: true },
  { id: 'f-3gbm', name: '3º GBM - SIA', parentFolderId: null, isFixed: true },
  { id: 'f-4gbm', name: '4º GBM - Asa Norte', parentFolderId: null, isFixed: true },
  { id: 'f-6gbm', name: '6º GBM - Núcleo Bandeirante', parentFolderId: null, isFixed: true },
  { id: 'f-7gbm', name: '7º GBM - Brazlândia', parentFolderId: null, isFixed: true },
  { id: 'f-8gbm', name: '8º GBM - Ceilândia', parentFolderId: null, isFixed: true },
  { id: 'f-9gbm', name: '9º GBM - Planaltina', parentFolderId: null, isFixed: true },
  { id: 'f-10gbm', name: '10º GBM - Paranoá', parentFolderId: null, isFixed: true },
  { id: 'f-11gbm', name: '11º GBM - Lago Sul', parentFolderId: null, isFixed: true },
  { id: 'f-13gbm', name: '13º GBM - Guará I', parentFolderId: null, isFixed: true },
  { id: 'f-15gbm', name: '15º GBM - Asa Sul', parentFolderId: null, isFixed: true },
  { id: 'f-16gbm', name: '16º GBM - Gama', parentFolderId: null, isFixed: true },
  { id: 'f-17gbm', name: '17º GBM - São Sebastião', parentFolderId: null, isFixed: true },
  { id: 'f-18gbm', name: '18º GBM - Santa Maria', parentFolderId: null, isFixed: true },
  { id: 'f-19gbm', name: '19º GBM - Candangolândia', parentFolderId: null, isFixed: true },
  { id: 'f-21gbm', name: '21º GBM - Riacho Fundo I', parentFolderId: null, isFixed: true },
  { id: 'f-22gbm', name: '22º GBM - Sobradinho', parentFolderId: null, isFixed: true },
  { id: 'f-25gbm', name: '25º GBM - Águas Claras', parentFolderId: null, isFixed: true },
  { id: 'f-34gbm', name: '34º GBM - Lago Norte', parentFolderId: null, isFixed: true },
  { id: 'f-36gbm', name: '36º GBM - Recanto das Emas Central', parentFolderId: null, isFixed: true },
  { id: 'f-37gbm', name: '37º GBM - Samambaia Centro', parentFolderId: null, isFixed: true },
  { id: 'f-37gbm-sierra3', name: '37º GBM/ SIERRA 3 - Subgrupamento de Bombeiro Militar - BR 060', parentFolderId: null, isFixed: true },
  { id: 'f-41gbm', name: '41º GBM - Setor Industrial da Ceilândia', parentFolderId: null, isFixed: true },
  { id: 'f-45gbm', name: '45º GBM - Sudoeste e Octogonal', parentFolderId: null, isFixed: true },
  { id: 'f-gaeph', name: 'GAEPH - GRUPAMENTO DE ATENDIMENTO DE EMERGÊNCIA PRÉ-HOSPITALAR', parentFolderId: null, isFixed: true },
  { id: 'f-gavop', name: 'GAVOP - GRUPAMENTO DE AVIAÇÃO OPERACIONAL', parentFolderId: null, isFixed: true },
  { id: 'f-gbmot', name: 'GBMOT - GRUPAMENTO DE BOMBEIRO MILITAR DE MOTOMECANIZAÇÃO', parentFolderId: null, isFixed: true },
  { id: 'f-gbs', name: 'GBS - GRUPAMENTO DE BUSCA E SALVAMENTO', parentFolderId: null, isFixed: true },
  { id: 'f-gpciu', name: 'GPCIU - GRUPAMENTO DE PREVENÇÃO E COMBATE A INCÊNDIO URBANO', parentFolderId: null, isFixed: true },
  { id: 'f-gpram', name: 'GPRAM - GRUPAMENTO DE PROTEÇÃO AMBIENTAL', parentFolderId: null, isFixed: true },
  { id: 'f-gpram-sam', name: 'GPRAM/SAMAMBAIA - GPRAM/SAMAMBAIA', parentFolderId: null, isFixed: true },
  { id: 'f-op-externa', name: 'OP EXTERNA - OPERAÇÕES EXTERNAS', parentFolderId: null, isFixed: true }
];

export const loadFolders = () => {
  try {
    const data = localStorage.getItem(FOLDERS_STORAGE_KEY) || localStorage.getItem(LEGACY_FOLDERS_STORAGE_KEY);
    let folders = [];
    if (data) {
      folders = JSON.parse(data);
    }
    const map = new Map();
    DEFAULT_FOLDERS.forEach(f => map.set(f.id, { ...f }));
    if (Array.isArray(folders)) {
      folders.forEach(f => {
        if (f && f.id) {
          const existing = map.get(f.id);
          map.set(f.id, existing ? { ...existing, ...f } : f);
        }
      });
    }
    return Array.from(map.values());
  } catch (error) {
    console.error("Erro ao ler pastas do localStorage", error);
  }
  return DEFAULT_FOLDERS;
};

export const saveFolders = (folders) => {
  safeSetItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders));
};

export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const createNewFolder = (name, parentFolderId = null, gbmUnitId = null) => {
  return {
    id: generateId(),
    name,
    parentFolderId,
    gbmUnitId,
    createdAt: new Date().toISOString()
  };
};

export const createNewMission = (name = null, parentFolderId = null, currentUser = null) => {
  const currentYear = new Date().getFullYear();
  const defaultMissionName = (name && String(name).trim()) ? String(name).trim() : `Brasília ${currentYear}`;
  return {
    id: generateId(),
    name: defaultMissionName,
    atribuicao: "", // Ex: 'sehur', '16º GBM Ala B'
    parentFolderId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: currentUser?.matricula || null,
    createdByName: currentUser?.nome || null,
    selectedIds: [],
    completedIds: [],
    isDraft: true // Por padrão, toda nova missão é um rascunho volátil
  };
};

const HYDRANT_CHANGES_KEY = 'netuno_hydrant_changes';
const ACTIVE_MISSION_STATE_KEY = 'netuno_active_mission_state';

export const loadHydrantChanges = () => {
  try {
    const data = localStorage.getItem(HYDRANT_CHANGES_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') {
        return {
          updated: parsed.updated || {},
          added: Array.isArray(parsed.added) ? parsed.added : [],
          deleted: Array.isArray(parsed.deleted) ? parsed.deleted : []
        };
      }
    }
  } catch (error) {
    console.error("Erro ao ler alterações de hidrantes do localStorage:", error);
  }
  return { updated: {}, added: [], deleted: [] };
};

export const saveHydrantChanges = (changes) => {
  const sanitized = sanitizeChangesForLocalStorage(changes);
  safeSetItem(HYDRANT_CHANGES_KEY, JSON.stringify(sanitized));
};

export const loadActiveMissionState = () => {
  try {
    const data = localStorage.getItem(ACTIVE_MISSION_STATE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') {
        return {
          openMissionIds: Array.isArray(parsed.openMissionIds) ? parsed.openMissionIds : [],
          activeMissionId: parsed.activeMissionId || null
        };
      }
    }
  } catch (error) {
    console.error("Erro ao ler estado da missão ativa do localStorage:", error);
  }
  return { openMissionIds: [], activeMissionId: null };
};

export const saveActiveMissionState = (state) => {
  safeSetItem(ACTIVE_MISSION_STATE_KEY, JSON.stringify(state));
};

const RBAC_USERS_KEY = 'netuno_rbac_users';

const INITIAL_RBAC_USERS = [
  { matricula: '1997400', nome: 'Sgt Roméro', role: 'admin' },
  { matricula: '1306198', nome: '1º Sgt Ribeiro', role: 'vistoriador' },
  { matricula: '1406228', nome: '1º Sgt Barreira', role: 'vistoriador' },
];

export const loadRbacUsers = () => {
  const initialAdmin = INITIAL_RBAC_USERS[0];

  try {
    const data = localStorage.getItem(RBAC_USERS_KEY);
    if (data !== null) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        let changed = false;
        // Assegura que 1997400 seja administrador
        const adminIdx = parsed.findIndex(u => String(u.matricula).toLowerCase() === '1997400');
        if (adminIdx === -1) {
          parsed.unshift(initialAdmin);
          changed = true;
        } else if (parsed[adminIdx].role !== 'admin') {
          parsed[adminIdx].role = 'admin';
          changed = true;
        }

        // Assegura que os militares padrão estejam na lista
        INITIAL_RBAC_USERS.slice(1).forEach(defUser => {
          const exists = parsed.some(u => String(u.matricula).toLowerCase() === String(defUser.matricula).toLowerCase());
          if (!exists) {
            parsed.push(defUser);
            changed = true;
          }
        });

        if (changed) {
          saveRbacUsers(parsed);
        }
        return parsed;
      }
    }
  } catch (error) {
    console.error("Erro ao ler usuários RBAC", error);
  }
  return [...INITIAL_RBAC_USERS];
};

export const saveRbacUsers = (users) => {
  safeSetItem(RBAC_USERS_KEY, JSON.stringify(users));
};

/**
 * Mescla usuários RBAC locais e da nuvem garantindo admin obrigatório
 */
export const mergeRbacUsers = (localUsers = [], cloudUsers = []) => {
  const map = new Map();
  const initialAdmin = INITIAL_RBAC_USERS[0];
  INITIAL_RBAC_USERS.forEach(u => map.set(String(u.matricula).toLowerCase(), u));

  (localUsers || []).forEach(u => {
    if (u && u.matricula) {
      const existing = map.get(String(u.matricula).toLowerCase());
      map.set(String(u.matricula).toLowerCase(), { ...existing, ...u });
    }
  });

  (cloudUsers || []).forEach(u => {
    if (u && u.matricula) {
      const existing = map.get(String(u.matricula).toLowerCase());
      map.set(String(u.matricula).toLowerCase(), { ...existing, ...u });
    }
  });

  const merged = Array.from(map.values());
  const admin = merged.find(u => String(u.matricula).toLowerCase() === '1997400');
  if (admin) admin.role = 'admin';
  else merged.unshift(initialAdmin);

  safeSetItem(RBAC_USERS_KEY, JSON.stringify(merged));
  return merged;
};

/**
 * Mescla de forma inteligente missões locais e da nuvem sem perda de dados
 */
export const mergeMissions = (localMissions = [], cloudMissions = []) => {
  if (!Array.isArray(cloudMissions) || cloudMissions.length === 0) {
    return Array.isArray(localMissions) ? localMissions : [];
  }
  if (!Array.isArray(localMissions) || localMissions.length === 0) {
    return cloudMissions;
  }

  const map = new Map();

  // 1. Carrega todas as missões locais
  localMissions.forEach(m => {
    if (m && m.id) {
      let orderedIds = Array.isArray(m.orderedIds) ? m.orderedIds : [];
      if (orderedIds.length === 0) {
        try {
          const cached = localStorage.getItem(`netuno_mission_ordered_${m.id}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) orderedIds = parsed;
          }
        } catch (e) {}
      }
      map.set(String(m.id), {
        ...m,
        orderedIds: sanitizeMissionList(orderedIds),
        selectedIds: sanitizeMissionList(m.selectedIds),
        completedIds: sanitizeMissionList(m.completedIds),
      });
    }
  });

  // 2. Mescla missões da nuvem
  cloudMissions.forEach(cloudM => {
    if (!cloudM || !cloudM.id) return;
    const key = String(cloudM.id);
    const localM = map.get(key);

    let cloudOrdered = Array.isArray(cloudM.orderedIds) ? cloudM.orderedIds : [];
    if (cloudOrdered.length === 0) {
      try {
        const cached = localStorage.getItem(`netuno_mission_ordered_${cloudM.id}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) cloudOrdered = parsed;
        }
      } catch (e) {}
    }

    const safeCloudM = {
      ...cloudM,
      orderedIds: sanitizeMissionList(cloudOrdered),
      selectedIds: sanitizeMissionList(cloudM.selectedIds),
      completedIds: sanitizeMissionList(cloudM.completedIds),
    };

    if (!localM) {
      map.set(key, safeCloudM);
    } else {
      const localTime = new Date(localM.updatedAt || localM.createdAt || 0).getTime();
      const cloudTime = new Date(safeCloudM.updatedAt || safeCloudM.createdAt || 0).getTime();
      const bestOrderedIds = (localM.orderedIds && localM.orderedIds.length > 0) 
        ? localM.orderedIds 
        : (safeCloudM.orderedIds && safeCloudM.orderedIds.length > 0 ? safeCloudM.orderedIds : []);

      const combinedCompletedIds = Array.from(new Set([
        ...(localM.completedIds || []),
        ...(safeCloudM.completedIds || [])
      ]));

      if (cloudTime > localTime) {
        // Se a nuvem for mais recente, mas não tiver hidrantes e o local tiver, preserva os hidrantes locais
        if (safeCloudM.selectedIds.length === 0 && localM.selectedIds.length > 0) {
          map.set(key, { 
            ...safeCloudM, 
            selectedIds: localM.selectedIds, 
            completedIds: combinedCompletedIds,
            orderedIds: bestOrderedIds,
            atribuicao: safeCloudM.atribuicao || localM.atribuicao || ""
          });
        } else {
          map.set(key, {
            ...safeCloudM,
            completedIds: combinedCompletedIds,
            orderedIds: bestOrderedIds,
            atribuicao: safeCloudM.atribuicao || localM.atribuicao || ""
          });
        }
      } else if (localTime > cloudTime) {
        map.set(key, {
          ...localM,
          completedIds: combinedCompletedIds
        });
      } else {
        if (safeCloudM.selectedIds.length >= localM.selectedIds.length) {
          map.set(key, {
            ...safeCloudM,
            completedIds: combinedCompletedIds,
            orderedIds: bestOrderedIds,
            atribuicao: safeCloudM.atribuicao || localM.atribuicao || ""
          });
        } else {
          map.set(key, {
            ...localM,
            completedIds: combinedCompletedIds
          });
        }
      }
    }
  });

  return Array.from(map.values()).sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    return timeB - timeA;
  });
};

/**
 * Mescla pastas locais e da nuvem garantindo pastas fixas
 */
export const mergeFolders = (localFolders = [], cloudFolders = []) => {
  const combinedMap = new Map();

  // 1. Pastas fixas padrão
  DEFAULT_FOLDERS.forEach(f => combinedMap.set(f.id, { ...f }));

  // 2. Pastas locais
  (localFolders || []).forEach(f => {
    if (f && f.id) {
      const existing = combinedMap.get(f.id);
      combinedMap.set(f.id, existing ? { ...existing, ...f } : f);
    }
  });

  // 3. Pastas da nuvem
  (cloudFolders || []).forEach(f => {
    if (f && f.id) {
      const existing = combinedMap.get(f.id);
      combinedMap.set(f.id, existing ? { ...existing, ...f } : f);
    }
  });

  return Array.from(combinedMap.values());
};


