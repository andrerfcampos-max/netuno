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
 * Retorna todos os identificadores conhecidos e válidos para um determinado objeto hidrante,
 * incluindo codHidrante, nomHidrante, _internalId, codLegado e equivalentes cruzados.
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
        const counterpart = translateId(s);
        if (counterpart) {
          ids.add(counterpart);
          ids.add(counterpart.toUpperCase());
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

  const idSet = idSetOrArray instanceof Set 
    ? idSetOrArray 
    : new Set((Array.isArray(idSetOrArray) ? idSetOrArray : [idSetOrArray]).map(x => String(x).trim()));

  if (idSet.size === 0) return false;

  const allIds = getHydrantAllIds(hydrant);
  for (const id of allIds) {
    if (idSet.has(id)) return true;
  }

  return false;
};

export default {
  translateId,
  getHydrantAllIds,
  areIdsEquivalent,
  isHydrantInSet
};
