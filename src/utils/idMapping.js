import argosCodToNom from './argosIdMap.json';
import { parseDate } from './dateUtils';

// Inversão lazy em memória para resolver nomHidrante -> codHidrante numérico
let nomToArgosCodCache = null;

const getNomToArgosCod = () => {
  if (!nomToArgosCodCache) {
    nomToArgosCodCache = {};
    for (const [cod, nom] of Object.entries(argosCodToNom)) {
      if (nom && cod) {
        nomToArgosCodCache[nom.toUpperCase()] = cod;
      }
    }
  }
  return nomToArgosCodCache;
};

/**
 * Traduz um identificador (seja numérico do Argos legado ou com prefixo oficial do CBMDF)
 * para sua contraparte.
 * Ex: '3722' -> 'LAS00001' | 'LAS00001' -> '3722'
 */
export const translateId = (id) => {
  if (!id) return null;
  const str = String(id).trim();
  if (argosCodToNom[str]) return argosCodToNom[str];
  const nomMap = getNomToArgosCod();
  const upper = str.toUpperCase();
  if (nomMap[upper]) return nomMap[upper];
  return null;
};

/**
 * Normaliza códigos com prefixo (ex: 'SAM 0082' -> 'SAM00082')
 */
export const normalizeCode = (str) => {
  if (!str) return '';
  const clean = String(str).trim().toUpperCase().replace(/[\.,]/g, '');
  const match = clean.match(/^([A-Z]{3})\s*0*(\d+)$/);
  if (match) {
    return match[1] + String(parseInt(match[2], 10)).padStart(5, '0');
  }
  return clean.replace(/[\s\-_]/g, '');
};

/**
 * Retorna todos os identificadores conhecidos e válidos para um determinado objeto hidrante,
 * incluindo codHidrante, nomHidrante, _internalId, codLegado, equivalentes cruzados e variações de espaçamento/zeros.
 */
export const getHydrantAllIds = (h) => {
  if (!h || typeof h !== 'object') return [];
  if (h._allIdsCache) return h._allIdsCache;
  const ids = new Set();

  const addVal = (v) => {
    if (v !== undefined && v !== null) {
      const s = String(v).trim();
      if (s) {
        ids.add(s);
        ids.add(s.toUpperCase());
        
        // Variações sem espaços
        const noSpaces = s.replace(/\s+/g, '');
        if (noSpaces) {
          ids.add(noSpaces);
          ids.add(noSpaces.toUpperCase());
        }

        // Variações canônicas de prefixo + número (ex: SAM 0082 <-> SAM00082 <-> SAM82)
        const match = s.trim().toUpperCase().match(/^([A-Z]{3})\s*0*(\d+)$/);
        if (match) {
          const prefix = match[1];
          const numInt = parseInt(match[2], 10);
          if (!isNaN(numInt)) {
            const numStr = String(numInt);
            const pad5 = numStr.padStart(5, '0');
            const pad4 = numStr.padStart(4, '0');
            ids.add(`${prefix}${pad5}`);
            ids.add(`${prefix} ${pad5}`);
            ids.add(`${prefix}${pad4}`);
            ids.add(`${prefix} ${pad4}`);
            ids.add(`${prefix}${numStr}`);
            ids.add(`${prefix} ${numStr}`);
            // NUNCA adicione 'numStr' puro sem prefixo: ele remove o prefixo da RA
            // e causa colisão massiva com códigos legados numéricos de outras RAs (ex: Ceilândia vs BSB vs Samambaia)
          }
        }

        // Se for puramente numérico (código legado Argos)
        if (/^\d+$/.test(s)) {
          const numInt = parseInt(s, 10);
          if (!isNaN(numInt)) {
            ids.add(String(numInt));
          }
        }

        const counterpart = translateId(s);
        if (counterpart) {
          ids.add(counterpart);
          ids.add(counterpart.toUpperCase());
          const counterpartNorm = normalizeCode(counterpart);
          if (counterpartNorm) {
            ids.add(counterpartNorm);
            ids.add(counterpartNorm.toUpperCase());
          }
        }
      }
    }
  };

  addVal(h.nomHidrante);
  addVal(h.codHidrante);
  addVal(h.codLegado);
  addVal(h._internalId);
  addVal(h.id);

  const arr = Array.from(ids);
  try {
    h._allIdsCache = arr;
    h._allIdsSetCache = ids;
  } catch (e) {}
  return arr;
};

// Cache WeakMap para reutilização instantânea O(1) de conjuntos expandidos sem re-parsing
const expandedSetCache = new WeakMap();

/**
 * Constrói e normaliza um conjunto expandido de IDs para testes O(1) ultra-rápidos
 */
export const buildExpandedIdSet = (idSetOrArray) => {
  if (!idSetOrArray) return new Set();
  if (idSetOrArray instanceof Set && idSetOrArray._isExpanded) {
    return idSetOrArray;
  }
  if (typeof idSetOrArray === 'object' && idSetOrArray !== null && expandedSetCache.has(idSetOrArray)) {
    return expandedSetCache.get(idSetOrArray);
  }

  const rawList = idSetOrArray instanceof Set 
    ? Array.from(idSetOrArray) 
    : (Array.isArray(idSetOrArray) ? idSetOrArray : [idSetOrArray]);

  const expanded = new Set();
  expanded._isExpanded = true;

  rawList.forEach(x => {
    if (x !== undefined && x !== null) {
      const s = String(x).trim();
      if (s) {
        expanded.add(s);
        expanded.add(s.toUpperCase());
        const norm = normalizeCode(s);
        if (norm) {
          expanded.add(norm);
          expanded.add(norm.toUpperCase());
        }
        const counterpart = translateId(s);
        if (counterpart) {
          expanded.add(counterpart);
          expanded.add(counterpart.toUpperCase());
        }
      }
    }
  });

  if (typeof idSetOrArray === 'object' && idSetOrArray !== null) {
    expandedSetCache.set(idSetOrArray, expanded);
  }

  return expanded;
};

/**
 * Cria ou recupera o índice inverso em memória (ID -> Hidrante) para lookup O(1)
 */
const hydrantIndexWeakMap = new WeakMap();

export const getHydrantIndex = (hidrantes) => {
  if (!Array.isArray(hidrantes) || hidrantes.length === 0) return new Map();
  if (hidrantIndexWeakMap.has(hidrantes)) {
    return hydrantIndexWeakMap.get(hidrantes);
  }
  if (hidrantes._indexMap) return hidrantes._indexMap;

  const indexMap = new Map();
  hidrantes.forEach(h => {
    const allIds = getHydrantAllIds(h);
    allIds.forEach(id => {
      if (!indexMap.has(id)) {
        indexMap.set(id, h);
      }
    });
  });

  try {
    hidrantIndexWeakMap.set(hidrantes, indexMap);
    hidrantes._indexMap = indexMap;
  } catch (e) {}

  return indexMap;
};

/**
 * Localiza com extrema rapidez (O(K)) a lista de hidrantes físicos correspondentes a uma lista de IDs
 */
export const getHydrantsForIds = (idList, hidrantes) => {
  if (!Array.isArray(idList) || idList.length === 0 || !Array.isArray(hidrantes) || hidrantes.length === 0) {
    return [];
  }

  const indexMap = getHydrantIndex(hidrantes);
  const foundSet = new Set();

  idList.forEach(rawId => {
    if (rawId === undefined || rawId === null) return;
    const s = String(rawId).trim();
    if (!s) return;

    let h = indexMap.get(s) || indexMap.get(s.toUpperCase());
    if (!h) {
      const norm = normalizeCode(s);
      if (norm) h = indexMap.get(norm) || indexMap.get(norm.toUpperCase());
    }
    if (!h) {
      const trans = translateId(s);
      if (trans) h = indexMap.get(trans) || indexMap.get(trans.toUpperCase());
    }

    if (h) {
      foundSet.add(h);
    }
  });

  if (foundSet.size > 0) {
    return Array.from(foundSet);
  }

  // Fallback seguro de compatibilidade
  const expanded = buildExpandedIdSet(idList);
  return hidrantes.filter(h => isHydrantInSet(h, expanded));
};

/**
 * Verifica se dois identificadores quaisquer referem-se ao mesmo hidrante.
 * Ex: areIdsEquivalent('3722', 'LAS00001') === true
 */
export const areIdsEquivalent = (idA, idB) => {
  if (!idA || !idB) return false;
  const strA = String(idA).trim();
  const strB = String(idB).trim();
  if (strA === strB) return true;
  if (strA.toUpperCase() === strB.toUpperCase()) return true;

  const normA = normalizeCode(strA);
  const normB = normalizeCode(strB);
  if (normA && normB && (normA === normB || normA.toUpperCase() === normB.toUpperCase())) return true;

  const transA = translateId(strA);
  if (transA && (transA === strB || transA.toUpperCase() === strB.toUpperCase())) return true;

  const transB = translateId(strB);
  if (transB && (transB === strA || transB.toUpperCase() === strA.toUpperCase())) return true;

  return false;
};

/**
 * Verifica com precisão 100% resiliente se um hidrante pertence a um conjunto de IDs da missão
 * (cobrindo códigos numéricos legados, nomes oficiais com prefixo e _internalId).
 * 
 * @param {Object} hydrant Objeto do hidrante
 * @param {Set<string>|Array<string>} idSetOrArray Conjunto ou lista de IDs da missão
 * @returns {boolean}
 */
export const isHydrantInSet = (hydrant, idSetOrArray) => {
  if (!hydrant || !idSetOrArray) return false;

  const idSet = (idSetOrArray instanceof Set && idSetOrArray._isExpanded)
    ? idSetOrArray
    : buildExpandedIdSet(idSetOrArray);

  if (idSet.size === 0) return false;

  if (hydrant._allIdsSetCache) {
    for (const id of hydrant._allIdsSetCache) {
      if (idSet.has(id)) return true;
    }
  }

  const allIds = getHydrantAllIds(hydrant);
  for (let i = 0; i < allIds.length; i++) {
    if (idSet.has(allIds[i])) return true;
  }

  return false;
};

/**
 * Faz parsing resiliente de datas de vistoria em múltiplos formatos (ISO, DD/MM/YYYY HH:mm, etc.)
 */
export const parseInspectionDate = (dateStr) => {
  return parseDate(dateStr);
};

/**
 * Retorna a data mais recente de vistoria encontrada no hidrante
 */
export const getHydrantLatestInspectionDate = (h) => {
  if (!h) return null;
  const direct = h.datHoraUltimaVistoria || h.datUltimaVistoria || h.dataUltimaVistoria || h.dataVistoria || h.datVistoria;
  if (direct && String(direct).trim() !== '-' && String(direct).toLowerCase() !== 'sem vistoria') {
    const d = parseInspectionDate(direct);
    if (d) return d;
  }
  if (Array.isArray(h.HISTORICO_VISTORIAS) && h.HISTORICO_VISTORIAS.length > 0) {
    for (const v of h.HISTORICO_VISTORIAS) {
      const dStr = v.datHoraVistoria || v.dataVistoria || v.datHoraUltimaVistoria || v.timestamp || v.data;
      if (dStr) {
        const d = parseInspectionDate(dStr);
        if (d) return d;
      }
    }
  }
  return null;
};

/**
 * Verifica se duas datas são do mesmo dia civil (ignora fuso e horário)
 */
export const isSameCalendarDay = (d1, d2) => {
  if (!d1 || !d2) return false;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

/**
 * Determina com precisão se um hidrante deve ser considerado CONCLUÍDO em uma missão ativa,
 * levando em conta vistorias realizadas offline, histórico de vistorias e reconciliações da base.
 *
 * @param {Object} hydrant
 * @param {Object} mission
 * @param {Object} localChanges Objeto opcional vindo de loadHydrantChanges()
 * @returns {boolean}
 */
export const isHydrantCompletedInMission = (hydrant, mission, localChanges = null, options = {}) => {
  if (!hydrant) return false;

  // 1. Verifica se já consta na lista de completedIds da missão
  if (!options?.skipCompletedIdsCheck && mission?.completedIds && isHydrantInSet(hydrant, mission.completedIds)) {
    return true;
  }

  // 2. Verifica se foi vistoriado/alterado offline localmente no dispositivo (loadHydrantChanges)
  if (localChanges?.updated) {
    const allIds = getHydrantAllIds(hydrant);
    const hasLocal = allIds.some(id => Boolean(localChanges.updated[id]));
    if (hasLocal) {
      const localObj = allIds.map(id => localChanges.updated[id]).find(Boolean);
      if (localObj && (
        (localObj.datHoraUltimaVistoria && localObj.datHoraUltimaVistoria !== '-') ||
        (Array.isArray(localObj.HISTORICO_VISTORIAS) && localObj.HISTORICO_VISTORIAS.length > 0)
      )) {
        return true;
      }
    }
  }

  // 3. Verifica a data da vistoria registrada no próprio hidrante
  const inspDate = getHydrantLatestInspectionDate(hydrant);
  if (!inspDate) return false;

  const now = new Date();

  // A. Vistoriado hoje: qualquer hidrante vistoriado no dia de hoje é considerado concluído
  if (isSameCalendarDay(inspDate, now)) {
    return true;
  }

  // B. Se a missão tiver data de criação ou atualização
  const missionDate = parseInspectionDate(mission?.createdAt || mission?.updatedAt);
  if (missionDate) {
    // Mesma data de criação da missão
    if (isSameCalendarDay(inspDate, missionDate)) {
      return true;
    }
    // Vistoriado após a criação da missão (com tolerância de 12h para fusos)
    if (inspDate.getTime() >= (missionDate.getTime() - 12 * 3600 * 1000)) {
      return true;
    }
  } else {
    // Missão sem data explícita (ou rascunho): se foi vistoriado nos últimos 3 dias
    const diffDays = (now.getTime() - inspDate.getTime()) / (1000 * 3600 * 24);
    if (diffDays >= 0 && diffDays <= 3) {
      return true;
    }
  }

  return false;
};

// Cache LRU em memória para métricas de missões
const missionMetricsCache = new Map();
const MAX_METRICS_CACHE = 200;

/**
 * Calcula com precisão unificada o progresso de uma missão
 * (total de hidrantes, concluídos, pendentes, percentual e status de conclusão).
 * Garante que Central de Missões, Rota de Missão e Relatórios exibam rigorosamente
 * os mesmos números, eliminando discrepâncias por estados locais ou IDs parciais.
 *
 * @param {Object} mission Objeto da missão
 * @param {Array<Object>} [hidrantes] Catálogo completo de hidrantes da aplicação
 * @param {Object} [localChanges] Mutações locais offline (opcional)
 * @returns {{ total: number, completed: number, pending: number, percent: number, isCompleted: boolean }}
 */
export const getMissionProgressMetrics = (mission, hidrantes = [], localChanges = null) => {
  if (!mission) {
    return { total: 0, completed: 0, pending: 0, percent: 0, isCompleted: false };
  }

  const selectedIds = Array.isArray(mission.selectedIds) ? mission.selectedIds : [];
  if (selectedIds.length === 0) {
    return { total: 0, completed: 0, pending: 0, percent: 0, isCompleted: false };
  }

  const completedIds = Array.isArray(mission.completedIds) ? mission.completedIds : [];

  // Chave de cache baseada nos dados essenciais para velocidade extrema (0ms)
  const cacheKey = `${mission.id || 'm'}_${mission.updatedAt || mission.createdAt || ''}_${selectedIds.length}_${completedIds.length}_${Array.isArray(hidrantes) ? hidrantes.length : 0}_${localChanges ? 'l' : ''}`;
  if (missionMetricsCache.has(cacheKey)) {
    return missionMetricsCache.get(cacheKey);
  }

  let result = null;

  // 1. Quando hidrantes está disponível, calcula baseado nos hidrantes físicos reais da missão
  if (Array.isArray(hidrantes) && hidrantes.length > 0) {
    const missionHydrants = getHydrantsForIds(selectedIds, hidrantes);

    if (missionHydrants.length > 0) {
      const completedIdsSet = buildExpandedIdSet(completedIds);
      let completedCount = 0;

      missionHydrants.forEach(h => {
        if (
          isHydrantInSet(h, completedIdsSet) || 
          isHydrantCompletedInMission(h, mission, localChanges, { skipCompletedIdsCheck: true })
        ) {
          completedCount++;
        }
      });

      const total = missionHydrants.length;
      const completed = Math.min(completedCount, total);
      const pending = Math.max(0, total - completed);
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
      const isCompleted = total > 0 && completed >= total;

      result = {
        total,
        completed,
        pending,
        percent,
        isCompleted
      };
    }
  }

  // 2. Fallback caso a lista de hidrantes ainda não tenha sido carregada (apenas IDs)
  if (!result) {
    let fallbackCompleted = 0;
    selectedIds.forEach(sId => {
      if (completedIds.some(cId => areIdsEquivalent(cId, sId))) {
        fallbackCompleted++;
      }
    });

    const total = selectedIds.length;
    const completed = Math.min(fallbackCompleted, total);
    const pending = Math.max(0, total - completed);
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    const isCompleted = total > 0 && completed >= total;

    result = {
      total,
      completed,
      pending,
      percent,
      isCompleted
    };
  }

  if (missionMetricsCache.size >= MAX_METRICS_CACHE) {
    const firstKey = missionMetricsCache.keys().next().value;
    missionMetricsCache.delete(firstKey);
  }
  missionMetricsCache.set(cacheKey, result);

  return result;
};

export default {
  translateId,
  normalizeCode,
  getHydrantAllIds,
  buildExpandedIdSet,
  getHydrantIndex,
  getHydrantsForIds,
  areIdsEquivalent,
  isHydrantInSet,
  parseInspectionDate,
  getHydrantLatestInspectionDate,
  isSameCalendarDay,
  isHydrantCompletedInMission,
  getMissionProgressMetrics
};

