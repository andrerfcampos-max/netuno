import argosCodToNom from './argosIdMap.json';

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

        // Variações canônicas de prefixo + número (ex: SAM 0082 <-> SAM00082 <-> SAM82 <-> 82)
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
            ids.add(numStr);
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

  return Array.from(ids);
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

  const rawList = idSetOrArray instanceof Set 
    ? Array.from(idSetOrArray) 
    : (Array.isArray(idSetOrArray) ? idSetOrArray : [idSetOrArray]);

  if (rawList.length === 0) return false;

  const idSet = new Set();
  rawList.forEach(x => {
    if (x !== undefined && x !== null) {
      const s = String(x).trim();
      if (s) {
        idSet.add(s);
        idSet.add(s.toUpperCase());
        const norm = normalizeCode(s);
        if (norm) {
          idSet.add(norm);
          idSet.add(norm.toUpperCase());
        }
        const counterpart = translateId(s);
        if (counterpart) {
          idSet.add(counterpart);
          idSet.add(counterpart.toUpperCase());
        }
      }
    }
  });

  if (idSet.size === 0) return false;

  const allIds = getHydrantAllIds(hydrant);
  for (const id of allIds) {
    if (idSet.has(id)) return true;
  }

  return false;
};

/**
 * Faz parsing resiliente de datas de vistoria em múltiplos formatos (ISO, DD/MM/YYYY HH:mm, etc.)
 */
export const parseInspectionDate = (dateStr) => {
  if (!dateStr || dateStr === '-') return null;
  const str = String(dateStr).trim();
  if (!str || str === '-' || str.toLowerCase() === 'sem vistoria') return null;

  // Se tiver T (ISO)
  if (str.includes('T')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
  }

  // DD/MM/YYYY ou DD/MM/YYYY HH:mm(:ss)
  const matchDmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (matchDmy) {
    const day = parseInt(matchDmy[1], 10);
    const month = parseInt(matchDmy[2], 10) - 1;
    const year = parseInt(matchDmy[3], 10);
    const timeMatch = str.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
    if (timeMatch) {
      return new Date(year, month, day, parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10), parseInt(timeMatch[3] || '0', 10));
    }
    return new Date(year, month, day);
  }

  // YYYY-MM-DD ou YYYY-MM-DD HH:mm(:ss)
  const matchYmd = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (matchYmd) {
    const year = parseInt(matchYmd[1], 10);
    const month = parseInt(matchYmd[2], 10) - 1;
    const day = parseInt(matchYmd[3], 10);
    const timeMatch = str.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
    if (timeMatch) {
      return new Date(year, month, day, parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10), parseInt(timeMatch[3] || '0', 10));
    }
    return new Date(year, month, day);
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
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
export const isHydrantCompletedInMission = (hydrant, mission, localChanges = null) => {
  if (!hydrant) return false;

  // 1. Verifica se já consta na lista de completedIds da missão
  if (mission?.completedIds && isHydrantInSet(hydrant, mission.completedIds)) {
    return true;
  }

  // 2. Verifica se foi vistoriado/alterado offline localmente no dispositivo (loadHydrantChanges)
  if (localChanges?.updated) {
    const allIds = getHydrantAllIds(hydrant);
    const updatedKeys = Object.keys(localChanges.updated);
    const foundInLocalChanges = allIds.some(id => updatedKeys.includes(id) || localChanges.updated[id]);
    if (foundInLocalChanges) {
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

export default {
  translateId,
  normalizeCode,
  getHydrantAllIds,
  areIdsEquivalent,
  isHydrantInSet,
  parseInspectionDate,
  getHydrantLatestInspectionDate,
  isSameCalendarDay,
  isHydrantCompletedInMission
};
