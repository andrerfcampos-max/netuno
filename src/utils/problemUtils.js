// Lista Oficial dos 33 Problemas Técnicos (memorial_DESCRITIVO.MD.txt)
export const PROBLEMAS_OFICIAIS = [
  "Caixa do hidrante obstruída com esgoto",
  "Hidrante sem água",
  "Hidrante removido ou não encontrado",
  "Hidrante cercado/bloqueado",
  "Falta tampão de 2.1/2\"",
  "Falta tampão de 4\"",
  "Tampa da caixa lacrada (concretada)",
  "Tampa de concreto quebrada ou removida",
  "Tampa metálica T19 quebrada ou removida",
  "Caixa de registro muito profunda",
  "Caixa de registro cheia de lixo",
  "Caixa de registro cheia d'água",
  "Caixa de registro quebrada",
  "Caixa de registro com enxame de abelhas",
  "Falta cabeçote da haste do registro (luva)",
  "Registro com vazamento",
  "Registro emperrado",
  "Faltam bujões e tampões",
  "Rosca de tampão danificado",
  "Carretel do registro danificado",
  "Hidrante com pouca pressão",
  "Hidrante quebrado no flange",
  "Registro concretado",
  "Faltam dois tampões de 2 1/2",
  "Registro danificado",
  "Caixa de concreto danificado",
  "Falta flange",
  "Registro não funciona",
  "Hidrante quebrado",
  "Hidrante soterrado",
  "Registro soterrado",
  "Hidrante empenado",
  "Vazamento no flange (operante)"
];

/**
 * Remove aspas espúrias (início e fim) preservando notação de polegadas (ex: 2.1/2" ou 4")
 * e remove pontuações residuais de separação.
 */
export const sanitizeProblem = (problemStr) => {
  if (!problemStr) return '';
  let str = String(problemStr).trim();
  
  // Remove aspas no início: ", ', “, ”, `, etc.
  str = str.replace(/^["'“”`]+/, '').trim();
  
  // Remove aspas no final se não for precedido de dígito (polegadas)
  if (!/\d["'“”]$/.test(str)) {
    str = str.replace(/["'“”`]+$/, '').trim();
  }
  
  // Corrige aspas duplas no final como 2.1/2"" -> 2.1/2"
  str = str.replace(/""+$/, '"');
  
  // Remove pontuações de separação soltas nas extremidades
  str = str.replace(/^[;|,.\s]+/, '').replace(/[;|,.\s]+$/, '').trim();
  
  return str;
};

/**
 * Normaliza o nome do problema para o padrão canônico em UPPERCASE,
 * casando com a lista oficial de 33 problemas técnicos.
 */
export const normalizeProblemName = (p) => {
  const clean = sanitizeProblem(p);
  if (!clean) return '';
  
  const upper = clean.toUpperCase();
  
  // 1. Casamento direto por comparação exata maiúscula
  const exactMatch = PROBLEMAS_OFICIAIS.find(oficial => oficial.toUpperCase() === upper);
  if (exactMatch) {
    return exactMatch.toUpperCase();
  }
  
  // 2. Casamento sem acentos e espaços normalizados
  const cleanNorm = upper.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ');
  const matchFuzzy = PROBLEMAS_OFICIAIS.find(oficial => {
    const ofNorm = oficial.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ');
    return ofNorm === cleanNorm;
  });
  if (matchFuzzy) {
    return matchFuzzy.toUpperCase();
  }
  
  return upper;
};

/**
 * Extrai lista de problemas únicos a partir de uma string composta delimitada por ; | ou quebra de linha.
 */
export const extractProblemsList = (raw) => {
  if (!raw || typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '-' || trimmed.toLowerCase() === 'nenhum' || trimmed.toLowerCase() === 'falso' || trimmed === '.') return [];
  
  return trimmed.split(/[;|\n]+/)
    .map(p => normalizeProblemName(p))
    .filter(p => p && p !== '-' && p !== '.');
};
