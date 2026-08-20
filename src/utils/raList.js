// Lista Oficial e Padronizada das Regiões Administrativas (RAs) do Distrito Federal
export const RA_LIST = [
  { name: 'Brasília', lat: -15.793, lng: -47.882, prefix: 'BSB' },
  { name: 'Gama', lat: -16.015, lng: -48.065, prefix: 'GAM' },
  { name: 'Taguatinga', lat: -15.833, lng: -48.056, prefix: 'TAG' },
  { name: 'Brazlândia', lat: -15.670, lng: -48.198, prefix: 'BRA' },
  { name: 'Sobradinho', lat: -15.651, lng: -47.794, prefix: 'SOB' },
  { name: 'Planaltina', lat: -15.617, lng: -47.653, prefix: 'PLN' },
  { name: 'Paranoá', lat: -15.768, lng: -47.771, prefix: 'PAR' },
  { name: 'Núcleo Bandeirante', lat: -15.873, lng: -47.962, prefix: 'NUB' },
  { name: 'Ceilândia', lat: -15.823, lng: -48.113, prefix: 'CEI' },
  { name: 'Guará', lat: -15.820, lng: -47.983, prefix: 'GUA' },
  { name: 'Cruzeiro', lat: -15.791, lng: -47.936, prefix: 'CRU' },
  { name: 'Samambaia', lat: -15.875, lng: -48.083, prefix: 'SAM' },
  { name: 'Santa Maria', lat: -16.019, lng: -47.987, prefix: 'SMA' },
  { name: 'São Sebastião', lat: -15.908, lng: -47.769, prefix: 'SSB' },
  { name: 'Recanto das Emas', lat: -15.903, lng: -48.064, prefix: 'REC' },
  { name: 'Lago Sul', lat: -15.845, lng: -47.848, prefix: 'LGS' },
  { name: 'Riacho Fundo', lat: -15.882, lng: -48.016, prefix: 'RIA' },
  { name: 'Lago Norte', lat: -15.733, lng: -47.854, prefix: 'LGN' },
  { name: 'Candangolândia', lat: -15.850, lng: -47.947, prefix: 'CAN' },
  { name: 'Águas Claras', lat: -15.836, lng: -48.026, prefix: 'ACL' },
  { name: 'Riacho Fundo II', lat: -15.903, lng: -48.037, prefix: 'RF2' },
  { name: 'Sudoeste e Octogonal', lat: -15.801, lng: -47.923, prefix: 'SUD' },
  { name: 'Varjão', lat: -15.708, lng: -47.882, prefix: 'VAR' },
  { name: 'Park Way', lat: -15.874, lng: -47.962, prefix: 'PKW' },
  { name: 'SCIA/Estrutural', lat: -15.779, lng: -47.994, prefix: 'STR' },
  { name: 'Sobradinho II', lat: -15.626, lng: -47.817, prefix: 'SB2' },
  { name: 'Jardim Botânico', lat: -15.877, lng: -47.781, prefix: 'JDB' },
  { name: 'Itapoã', lat: -15.738, lng: -47.766, prefix: 'ITP' },
  { name: 'SIA', lat: -15.803, lng: -47.957, prefix: 'SIA' },
  { name: 'Vicente Pires', lat: -15.802, lng: -48.028, prefix: 'VCP' },
  { name: 'Fercal', lat: -15.589, lng: -47.869, prefix: 'FRC' },
  { name: 'Sol Nascente/Pôr do Sol', lat: -15.811, lng: -48.140, prefix: 'SNP' },
  { name: 'Arniqueira', lat: -15.852, lng: -48.015, prefix: 'ARN' }
];

// Mapa de prefixos de código para a Região Administrativa correspondente
export const PREFIX_TO_RA_MAP = {
  'ACL': 'Águas Claras',
  'ARN': 'Arniqueira',
  'BSB': 'Brasília',
  'PAN': 'Brasília',
  'BRZ': 'Brazlândia',
  'CAN': 'Candangolândia',
  'CEI': 'Ceilândia',
  'CRU': 'Cruzeiro',
  'FER': 'Fercal',
  'GAM': 'Gama',
  'GUA': 'Guará',
  'ITA': 'Itapoã',
  'JAR': 'Jardim Botânico',
  'LAN': 'Lago Norte',
  'TAQ': 'Lago Norte',
  'LAS': 'Lago Sul',
  'NBA': 'Núcleo Bandeirante',
  'PAR': 'Paranoá',
  'PAW': 'Park Way',
  'PLA': 'Planaltina',
  'AEM': 'Planaltina',
  'REC': 'Recanto das Emas',
  'RIA': 'Riacho Fundo',
  'RF2': 'Riacho Fundo II',
  'SAM': 'Samambaia',
  'STM': 'Santa Maria',
  'SEB': 'São Sebastião',
  'SCI': 'SCIA/Estrutural',
  'SIA': 'SIA',
  'SOB': 'Sobradinho',
  'SO2': 'Sobradinho II',
  'SNP': 'Sol Nascente/Pôr do Sol',
  'POR': 'Sol Nascente/Pôr do Sol',
  'SUD': 'Sudoeste e Octogonal',
  'OCT': 'Sudoeste e Octogonal',
  'TAG': 'Taguatinga',
  'VAR': 'Varjão',
  'VIC': 'Vicente Pires'
};

// Mapa de códigos oficiais de localidade (CBMDF/CAESB) para a RA
export const RA_LOCALIDADE_MAP = {
  1: 'Águas Claras',
  1789: 'Brasília',
  1790: 'Brazlândia',
  1791: 'Candangolândia',
  1792: 'Ceilândia',
  1793: 'Cruzeiro',
  1794: 'Gama',
  1795: 'Guará',
  1798: 'Lago Norte',
  1799: 'Lago Sul',
  1800: 'Núcleo Bandeirante',
  1801: 'Paranoá',
  1802: 'Planaltina',
  1803: 'Recanto das Emas',
  1804: 'Riacho Fundo',
  1805: 'Samambaia',
  1806: 'Santa Maria',
  1807: 'São Sebastião',
  1808: 'Sobradinho',
  1809: 'Taguatinga',
  10007: 'SIA',
  10008: 'Itapoã',
  10009: 'Riacho Fundo II',
  10010: 'Sudoeste e Octogonal',
  10011: 'Varjão',
  10012: 'Park Way',
  10013: 'SCIA/Estrutural',
  10014: 'Sobradinho II',
  10015: 'Jardim Botânico',
  10016: 'Fercal',
  10017: 'Vicente Pires',
  10020: 'Arniqueira',
  10021: 'Sol Nascente/Pôr do Sol'
};

// Mapa de normalização para higienizar variações e erros do banco de dados
const RA_NORMALIZATION_MAP = {
  'plano piloto': 'Brasília',
  'brasilia': 'Brasília',
  'brasília': 'Brasília',
  'gama': 'Gama',
  'taguatinga': 'Taguatinga',
  'brazlandia': 'Brazlândia',
  'brazlândia': 'Brazlândia',
  'sobradinho': 'Sobradinho',
  'planaltina': 'Planaltina',
  'paranoa': 'Paranoá',
  'paranoá': 'Paranoá',
  'nucleo bandeirante': 'Núcleo Bandeirante',
  'núcleo bandeirante': 'Núcleo Bandeirante',
  'ceilandia': 'Ceilândia',
  'ceilândia': 'Ceilândia',
  'guara': 'Guará',
  'guará': 'Guará',
  'cruzeiro': 'Cruzeiro',
  'samambaia': 'Samambaia',
  'santa maria': 'Santa Maria',
  'sao sebastiao': 'São Sebastião',
  'são sebastião': 'São Sebastião',
  'recanto das emas': 'Recanto das Emas',
  'lago sul': 'Lago Sul',
  'riacho fundo': 'Riacho Fundo',
  'lago norte': 'Lago Norte',
  'candangolandia': 'Candangolândia',
  'candangolândia': 'Candangolândia',
  'aguas claras': 'Águas Claras',
  'águas claras': 'Águas Claras',
  'riacho fundo ii': 'Riacho Fundo II',
  'riacho fundo 2': 'Riacho Fundo II',
  'sudoeste e octogonal': 'Sudoeste e Octogonal',
  'sudoeste/octogonal': 'Sudoeste e Octogonal',
  'sudoeste': 'Sudoeste e Octogonal',
  'octogonal': 'Sudoeste e Octogonal',
  'varjao': 'Varjão',
  'varjão': 'Varjão',
  'park way': 'Park Way',
  'park way ': 'Park Way',
  'scia (setor complementar de industria e abastamento) e estrutural': 'SCIA/Estrutural',
  'scia/estrutural': 'SCIA/Estrutural',
  'estrutural': 'SCIA/Estrutural',
  'scia': 'SCIA/Estrutural',
  'sobradinho ii': 'Sobradinho II',
  'sobradinho 2': 'Sobradinho II',
  'jardim botanico': 'Jardim Botânico',
  'jardim botânico': 'Jardim Botânico',
  'itapoa': 'Itapoã',
  'itapoã': 'Itapoã',
  'sia (setor de industria e abastecimento)': 'SIA',
  'sia': 'SIA',
  'vicente pires': 'Vicente Pires',
  'fercal': 'Fercal',
  'pâr do sol e sol nascente': 'Sol Nascente/Pôr do Sol',
  'sol nascente e por do sol': 'Sol Nascente/Pôr do Sol',
  'sol nascente/pôr do sol': 'Sol Nascente/Pôr do Sol',
  'sol nascente': 'Sol Nascente/Pôr do Sol',
  'pôr do sol': 'Sol Nascente/Pôr do Sol',
  'arniqueira': 'Arniqueira'
};

/**
 * Normaliza qualquer nome de localidade/RA para o padrão oficial canônico.
 * Retorna string vazia caso seja um valor inválido (ex: 'undefined', 'FALSO', 'VERDADEIRO').
 */
export const normalizeRAName = (rawName) => {
  if (!rawName || typeof rawName !== 'string') return '';
  const cleaned = rawName.trim();
  if (!cleaned || ['undefined', 'null', 'falso', 'verdadeiro', 'true', 'false', '-'].includes(cleaned.toLowerCase())) {
    return '';
  }
  
  const key = cleaned.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos para busca flexível
    .replace(/\s+/g, ' ');

  // Busca direta
  if (RA_NORMALIZATION_MAP[cleaned.toLowerCase()]) {
    return RA_NORMALIZATION_MAP[cleaned.toLowerCase()];
  }

  // Busca desacentuada no mapa
  for (const [mapKey, officialName] of Object.entries(RA_NORMALIZATION_MAP)) {
    const normMapKey = mapKey.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
    if (normMapKey === key) {
      return officialName;
    }
  }

  // Busca se bate com algum nome canônico
  const directMatch = RA_LIST.find(r => r.name.toLowerCase() === cleaned.toLowerCase());
  if (directMatch) return directMatch.name;

  return cleaned;
};

/**
 * Gera o próximo código de hidrante sequencial para uma determinada RA.
 * Formato padrão: 3 letras do prefixo + número (ex: GAM00143, BSB00894, GUA00114)
 */
export const generateNextHydrantCode = (raName, allHidrantes = []) => {
  const normRA = normalizeRAName(raName);
  if (!normRA) return '';

  const raObj = RA_LIST.find(r => r.name === normRA);
  const defaultPrefix = raObj ? raObj.prefix : normRA.substring(0, 3).toUpperCase();

  // Filtrar hidrantes existentes da RA
  const raHidrantes = allHidrantes.filter(h => {
    const hRA = normalizeRAName(h.dscLocalidade);
    return hRA && hRA.toLowerCase() === normRA.toLowerCase();
  });

  let prefix = '';
  let maxNum = 0;
  let numDigits = 5;

  if (raHidrantes.length > 0) {
    for (const h of raHidrantes) {
      const code = (h.nomHidrante || h.codHidrante || '').trim();
      const match = code.match(/^([A-Za-z]+)(\d+)$/);
      if (match) {
        if (!prefix) prefix = match[1].toUpperCase();
        const num = parseInt(match[2], 10);
        if (num > maxNum) {
          maxNum = num;
          numDigits = match[2].length;
        }
      }
    }
  }

  const finalPrefix = prefix || defaultPrefix;
  const nextNum = maxNum + 1;
  const formattedNum = String(nextNum).padStart(Math.max(numDigits, 3), '0');
  return `${finalPrefix}${formattedNum}`;
};
