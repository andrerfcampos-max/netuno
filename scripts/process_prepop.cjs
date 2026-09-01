const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const RA_NORMALIZATION = {
  'BRASILIA': 'Brasília',
  'BRASILIA (PLANO PILOTO)': 'Brasília',
  'PLANO PILOTO': 'Brasília',
  'ASA SUL': 'Brasília',
  'ASA NORTE': 'Brasília',
  'LAGO SUL': 'Lago Sul',
  'LAGO NORTE': 'Lago Norte',
  'NÚCLEO BANDEIRANTE': 'Núcleo Bandeirante',
  'NUCLEO BANDEIRANTE': 'Núcleo Bandeirante',
  'CANDANGOLÂNDIA': 'Candangolândia',
  'CANDANGOLANDIA': 'Candangolândia',
  'GUARA': 'Guará',
  'GUARA I': 'Guará',
  'GUARA II': 'Guará',
  'GUARÁ': 'Guará',
  'GUARÁ I': 'Guará',
  'GUARÁ II': 'Guará',
  'TAGUATINGA': 'Taguatinga',
  'TAGUATINGA NORTE': 'Taguatinga',
  'TAGUATINGA SUL': 'Taguatinga',
  'CEILANDIA': 'Ceilândia',
  'CEILÂNDIA': 'Ceilândia',
  'SAMAMBAIA': 'Samambaia',
  'SANTA MARIA': 'Santa Maria',
  'GAMA': 'Gama',
  'SÃO SEBASTIÃO': 'São Sebastião',
  'SAO SEBASTIAO': 'São Sebastião',
  'SOBRADINHO': 'Sobradinho',
  'SOBRADINHO II': 'Sobradinho II',
  'PLANALTINA': 'Planaltina',
  'PARANOA': 'Paranoá',
  'PARANOÁ': 'Paranoá',
  'RECANTO DAS EMAS': 'Recanto das Emas',
  'RIACHO FUNDO': 'Riacho Fundo I',
  'RIACHO FUNDO I': 'Riacho Fundo I',
  'RIACHO FUNDO II': 'Riacho Fundo II',
  'AGUAS CLARAS': 'Águas Claras',
  'ÁGUAS CLARAS': 'Águas Claras',
  'BRAZLANDIA': 'Brazlândia',
  'BRAZLÂNDIA': 'Brazlândia',
  'SUDOESTE/OCTOGONAL': 'Sudoeste/Octogonal',
  'SUDOESTE E OCTOGONAL': 'Sudoeste/Octogonal',
  'SUDOESTE': 'Sudoeste/Octogonal',
  'SIA': 'SIA',
  'SCIA': 'Estrutural',
  'ESTRUTURAL': 'Estrutural',
  'SCIA / ESTRUTURAL': 'Estrutural',
  'SCIA/ESTRUTURAL': 'Estrutural',
  'VARJAO': 'Varjão',
  'VARJÃO': 'Varjão',
  'PARK WAY': 'Park Way',
  'VICENTE PIRES': 'Vicente Pires',
  'ITAPOA': 'Itapoã',
  'ITAPOÃ': 'Itapoã',
  'JARDIM BOTANICO': 'Jardim Botânico',
  'JARDIM BOTÂNICO': 'Jardim Botânico',
  'SOL NASCENTE/POR DO SOL': 'Sol Nascente/Pôr do Sol',
  'SOL NASCENTE': 'Sol Nascente/Pôr do Sol',
  'ARNIQUEIRA': 'Arniqueira'
};

const OBM_TO_RA = {
  '01º GBM': 'Brasília',
  '02º GBM': 'Taguatinga',
  '03º GBM': 'SIA',
  '04º GBM': 'Brasília',
  '06º GBM': 'Núcleo Bandeirante',
  '07º GBM': 'Brazlândia',
  '08º GBM': 'Ceilândia',
  '09º GBM': 'Planaltina',
  '10º GBM': 'Paranoá',
  '11º GBM': 'Lago Sul',
  '13º GBM': 'Guará',
  '15º GBM': 'Brasília',
  '16º GBM': 'Gama',
  '17º GBM': 'São Sebastião',
  '18º GBM': 'Santa Maria',
  '19º GBM': 'Candangolândia',
  '21º GBM': 'Riacho Fundo I',
  '22º GBM': 'Sobradinho',
  '25º GBM': 'Águas Claras',
  '34º GBM': 'Lago Norte',
  '36º GBM': 'Recanto das Emas',
  '37º GBM': 'Samambaia',
  '41º GBM': 'Ceilândia',
  '45º GBM': 'Sudoeste/Octogonal'
};

const RA_DEFAULT_COORDS = {
  'Brasília': { lat: -15.7942, lng: -47.8822 },
  'Taguatinga': { lat: -15.8331, lng: -48.0566 },
  'Ceilândia': { lat: -15.8197, lng: -48.1106 },
  'Samambaia': { lat: -15.8732, lng: -48.0851 },
  'Gama': { lat: -16.0152, lng: -48.0645 },
  'Santa Maria': { lat: -16.0028, lng: -47.9972 },
  'Planaltina': { lat: -15.6237, lng: -47.6541 },
  'Sobradinho': { lat: -15.6543, lng: -47.7915 },
  'Sobradinho II': { lat: -15.6322, lng: -47.8189 },
  'Guará': { lat: -15.8282, lng: -47.9822 },
  'Águas Claras': { lat: -15.8398, lng: -48.0245 },
  'Núcleo Bandeirante': { lat: -15.8686, lng: -47.9625 },
  'Candangolândia': { lat: -15.8542, lng: -47.9508 },
  'Riacho Fundo I': { lat: -15.8822, lng: -48.0167 },
  'Riacho Fundo II': { lat: -15.9011, lng: -48.0578 },
  'Recanto das Emas': { lat: -15.9083, lng: -48.0711 },
  'São Sebastião': { lat: -15.9036, lng: -47.7719 },
  'Paranoá': { lat: -15.7725, lng: -47.7778 },
  'Itapoã': { lat: -15.7489, lng: -47.7656 },
  'Brazlândia': { lat: -15.6764, lng: -48.2047 },
  'Lago Sul': { lat: -15.8456, lng: -47.8767 },
  'Lago Norte': { lat: -15.7367, lng: -47.8489 },
  'SIA': { lat: -15.8167, lng: -47.9556 },
  'Estrutural': { lat: -15.7833, lng: -47.9889 },
  'Sudoeste/Octogonal': { lat: -15.7989, lng: -47.9256 },
  'Varjão': { lat: -15.7167, lng: -47.8833 },
  'Park Way': { lat: -15.8944, lng: -47.9472 },
  'Vicente Pires': { lat: -15.8083, lng: -48.0278 },
  'Jardim Botânico': { lat: -15.8806, lng: -47.8139 },
  'Sol Nascente/Pôr do Sol': { lat: -15.8289, lng: -48.1472 },
  'Arniqueira': { lat: -15.8583, lng: -48.0167 }
};

// Curated accurate overrides for records where raw address/empty field needs explicit establishment naming
const MANUAL_OVERRIDES = {
  557: 'Churrasquinho do Rodinho',
  480: 'Restaurante Churrascaria Recanto Gaúcho',
  562: 'Shopping Conjunto Nacional',
  450: 'DF Madeira',
  761: 'Centro de Ensino Fundamental 01 de Planaltina',
  237: 'Administração Regional de Planaltina',
  609: 'Feira Central Permanente de Brazlândia',
  313: 'Fazenda Desterro',
  486: 'Festejar Embalagens',
  487: 'Bazar Nossa Senhora Aparecida',
  527: 'CEPI Bem-te-vi',
  425: 'Feira Permanente de Samambaia Norte',
  202: 'Feira do Produtor e Atacadista de Ceilândia',
  1172: 'Parque Distrital do Gama',
  1248: 'Parque Ecológico do Gama',
  495: 'Centro de Ensino Fundamental do Bosque',
  1071: 'Escola Classe São Bartolomeu',
  556: 'Escola Classe 01 do Gama',
  215: 'Edifício Lions',
  1052: 'Edifício Serrano',
  87: 'Edifício Everest',
  8: 'Feira Permanente de São Sebastião',
  33: 'Feira Permanente do Paranoá',
  788: 'Edifício Parque das Águas',
  266: 'Supermercado Nova Rede',
  547: 'Madefort SIA',
  1119: 'Jaguar Utilidades',
  1444: 'Shopping Total Ville Mall',
  1972: 'Condomínio Crixás IV',
  413: 'Academia World Gym (Fazendinha)',
  1262: 'ABC Atacadão Papelaria',
  1104: 'Residencial Isla Life Style',
  1100: 'Edifício Via Boulevard',
  1099: 'Edifício Contemplar',
  1103: 'Residencial Olympique',
  1752: 'Qualidade Gráfica e Editora',
  1749: 'QuimiPlast',
  2391: 'Academia Smart Fit (Santa Maria)',
  1947: 'Academia Smart Fit (Sudoeste)',
  3015: 'Academia Smart Fit (Asa Sul CRS 511)',
  2376: 'Shopping ID',
  1286: 'Shopping Asa Sul (EQS 414/415)',
  2332: 'Shopping Asa Sul (EQS 414/415)',
  123: 'Shopping Popular de Ceilândia',
  420: 'Academia No Limite (Gama)',
  491: 'Escola Normal de Brasília (Gama)',
  528: 'Escola Classe 01 de Ceilândia',
  512: 'Escola Classe 01 da Candangolândia',
  798: 'Escola Classe Boqueirão',
  659: 'Centro de Ensino Fundamental 106 (Recanto das Emas)',
  1195: 'Super Shopping Cristo Rei',
  1108: 'Centro Educacional Darcy Ribeiro (CED Darcy Ribeiro)',
  1253: 'Clube do Bolo (Sobradinho)',
  1196: 'Super 10 Confecções (Sobradinho)',
  429: 'Galpão Comercial AC 419 (Santa Maria)',
  42: 'Aeroporto Internacional de Brasília (Piso de Embarque)',
  92: 'Aeroporto Internacional de Brasília (Terminal de Passageiros)',
  32: 'Aeroporto Internacional de Brasília (Terminal de Passageiros / Check-in)',
  47: 'Aeroporto Internacional de Brasília (Juscelino Kubitschek)',
  509: 'Colégio La Salle (Núcleo Bandeirante)',
  476: 'Centro de Ensino Médio do Núcleo Bandeirante (CEMNB)',
  589: 'Escola Classe Vila Nova Divinéia (Núcleo Bandeirante)',
  143: 'Centro Interescolar de Línguas do Núcleo Bandeirante (CIL NB)',
  652: 'Colégio Olimpo (Taguatinga)',
  869: 'Templo da Boa Vontade / ParlaMundi LBV',
  496: 'Edifício Vitrinni Shopping (Águas Claras)',
  382: 'Colégio Sigma (Águas Claras)',
  1045: 'Prime Casa e Festa (Núcleo Bandeirante)',
  1062: 'Quiosque e Lanchonete 2ª Avenida',
  677: 'Escola Classe 04 do Núcleo Bandeirante',
  772: 'Comércio 2ª Avenida Lt 359A (Núcleo Bandeirante)',
  1208: 'Comércio 2ª Avenida Lt 469A (Núcleo Bandeirante)',
  1246: 'Comércio 3ª Avenida AE 12 Lt D1 (Núcleo Bandeirante)',
  789: 'Quartel 6º GBM (Núcleo Bandeirante)',
  671: 'Ginásio de Esportes do Paranoá',
  1265: 'Comércio SHIN CA 1 (Lago Norte)',
  196: 'Indusplan (ADE Águas Claras)',
  830: 'Du Pneus',
  633: 'CAIC UNESCO (São Sebastião)',
  1528: 'Localiza (SIA Trecho 2)',
  856: 'Estação Estrada Parque - Metrô-DF (EPTG)',
  729: 'Edificação Residencial (Águas Claras / Portaria Central)',
  592: 'Edificação Residencial (Águas Claras / Entrada Central)',
  1106: 'Galpão ADE Ceilândia Q 1 Cj C Lt 30',
  815: 'Condomínio AOS 08 (Octogonal)',
  312: 'Posto de Combustíveis Avenida Central (Núcleo Bandeirante)',
  1169: 'Comércio Avenida Central Lt 990 (Núcleo Bandeirante)',
  447: 'Condomínio Crixás II (São Sebastião)',
  714: 'Chácara 23 Avenida do Contorno (Núcleo Bandeirante)',
  371: 'Comércio Avenida Paranoá Quadra 23',
  902: 'Unidade Escolar Avenida Paranoá Quadra 10',
  711: 'Unidade Escolar Q 107 Recanto das Emas',
  913: 'Centro de Ensino Fundamental 113 do Recanto das Emas',
  333: 'Restaurante e Hotel Recanto das Emas Q 201',
  119: 'Loja Comercial Q 301 Recanto das Emas',
  267: 'Comércio Local Q 205 Recanto das Emas',
  46: 'Supermercado Box R1 e R2 (Núcleo Bandeirante)',
  863: 'Comércio Bairro São Francisco Rua 17 (São Sebastião)',
  1190: 'Comércio 2ª Avenida 317 A (Núcleo Bandeirante)',
  1058: 'Chácara Montes Claros (São Sebastião)',
  157: 'Chácara Santa Edwiges (Jardim Botânico)',
  86: 'Depósito de GLP / Combustíveis São Bartolomeu (São Sebastião)',
  233: 'Comércio Local QN 510 Samambaia Norte',
  201: 'Comércio Local QS 120 Samambaia Sul',
  514: 'Centro Interescolar de Línguas de Samambaia (CIL Samambaia)',
  1266: 'Edifício Comercial SIA AE Lote A',
  232: 'Depósito SIA AE Lote G',
  1230: 'Garagem e Pátio SIA Canteiro Central',
  1212: 'Galpão Comercial SIA Trecho 10 Lt 5',
  1168: 'Comércio Local Santa Maria QR 210',
  36: 'Comércio Local Santa Maria QR 210 Cj C',
  1226: 'Comércio e Serviços QR 211 Santa Maria',
  1243: 'Serviços Profissionais QR 211 Santa Maria',
  728: 'Centro Educacional 310 de Santa Maria',
  1241: 'Complexo Operacional DF-290 KM 03 (Gama)',
  1178: 'Comércio Ponte Alta Norte (Gama)',
  19: 'Condomínio Residencial Quadra 2 Cj A1 Bloco A (Sobradinho)',
  10: 'Área Especial 06 Sobradinho I',
  88: 'Comércio Vila São José Q 48 (Brazlândia)',
  558: 'Setor de Indústria QES Área 4 (Ceilândia)',
  775: 'Setor de Indústria QI 8 Lt 2 (Ceilândia)',
  168: 'Unidade Escolar QNN 31 AE E (Ceilândia)',
  148: 'Garagem de Ônibus QNO 14 AE A (Ceilândia)',
  39: 'Depósito Candangolândia Lote 02',
  85: 'Restaurante QOF Cj I Lt 2 (Candangolândia)',
  141: 'Comércio Local QR 1A (Candangolândia)',
  888: 'Lojas Comerciais QNN 4 Cj O (Ceilândia)',
  81: 'Comércio Setor M QNM 12 CNM 2 (Ceilândia)',
  1167: 'Comércio Setor M QNM 16 Lt G (Ceilândia)',
  554: 'Unidade Escolar EQNN 3/5 Bl E (Ceilândia)',
  548: 'Unidade Escolar EQNN 7/9 Lt B (Ceilândia)',
  1046: 'Edifício Comercial Quadra 02 Lote 910/920 (Plano Piloto)',
  849: 'Edifício Comercial SBS Quadra 1 Bloco L',
  637: 'Edifício SBS Quadra 1 Bloco E',
  1147: 'Edifício SCS Quadra 1 Bloco M',
  238: 'Comércio Local QS 12 Lote C (Riacho Fundo)',
  1188: 'Supermercado Setor G Sul CSG 20 (Taguatinga)',
  328: 'Comércio Vila Buritis Q 3 Cj A (Planaltina)',
  75: 'Setor Recreativo e Esportivo AE 9 (Planaltina)',
  1256: 'Setor de Hotéis e Diversões PJ 1 (Planaltina)',
  208: 'Comércio Local SHIS CL QI 5 Bl F (Lago Sul)',
  442: 'Escola SHIS QI 09 Área Especial (Lago Sul)',
  465: 'Escola SHIS QI 15 (Lago Sul)',
  210: 'Clínica / Hospital SHIS QI 15 Lt G (Lago Sul)',
  564: 'Escola SHIS QI 19 Lt L (Lago Sul)',
  587: 'Unidade Escolar Setor M EQNM 4/6 (Ceilândia)',
  1199: 'Edifício Comercial SHCAO EA 6/8 Bloco A (Octogonal)',
  887: 'Comércio Local SHCES Quadra 303 Bloco C (Cruzeiro)',
  896: 'Comércio Local SHCES Quadra 303 Bloco C (Cruzeiro)',
  1072: 'Unidade Escolar SHCES Quadra 807 (Cruzeiro)',
  1229: 'Comércio Local CLSW 104 Bloco C (Sudoeste)',
  9: 'Hospital / Clínica SHLN Conjunto G Lote 7 (Asa Norte)',
  389: 'Escola Classe 614 de Samambaia Sul',
  1149: 'Unidade Escolar Riacho Fundo II QN 7C',
  1098: 'Edifício SCS Quadra 2 Bloco D',
  538: 'Centro de Ensino Especial do Gama',
  516: 'CEI / Escola EQNP 6/10 Ceilândia',
  517: 'Unidade Escolar QNP 28 Ceilândia',
  3030: 'Edifício Residencial CLS 111 Bloco D (Asa Sul)',
  1779: 'SESC / Igreja SHCS CRS 504 (Asa Sul)',
  3020: 'Galeria Comercial SHCS CRS 509 (Asa Sul)',
  1135: 'Comércio e Serviços SHCSW EQRSW 6/7 (Sudoeste)',
  718: 'Edifício Clínico / Hospitalar SHLS Quadra 716 (Asa Sul)',
  922: 'Escola Vila Vicentina Quadra 17 (Planaltina)'
};

function normalizeRA(rawText, obmDescription) {
  if (!rawText && obmDescription && OBM_TO_RA[obmDescription]) {
    return OBM_TO_RA[obmDescription];
  }
  if (!rawText) return obmDescription && OBM_TO_RA[obmDescription] ? OBM_TO_RA[obmDescription] : 'Brasília';
  const upper = String(rawText).toUpperCase().trim();
  for (const [key, val] of Object.entries(RA_NORMALIZATION)) {
    if (upper.includes(key)) return val;
  }
  if (obmDescription && OBM_TO_RA[obmDescription]) {
    return OBM_TO_RA[obmDescription];
  }
  return 'Brasília';
}

function parseSingleCoord(val) {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') {
    if (Math.abs(val) > 100) {
      let f = val;
      while (Math.abs(f) > 100) f /= 10;
      return parseFloat((f > 0 ? -f : f).toFixed(6));
    }
    return parseFloat(val.toFixed(6));
  }
  let str = String(val).trim().replace(',', '.');
  
  const dmsMatch = str.match(/(\d+)º\s*(\d+)['’]\s*([\d.]+)[”"]?\s*([SWNE]?)/i);
  if (dmsMatch) {
    const deg = parseFloat(dmsMatch[1]);
    const min = parseFloat(dmsMatch[2]);
    const sec = parseFloat(dmsMatch[3]);
    const dir = (dmsMatch[4] || '').toUpperCase();
    let dec = deg + (min / 60) + (sec / 3600);
    if (dir === 'S' || dir === 'W' || (!dir && deg > 0)) dec = -dec;
    return parseFloat(dec.toFixed(6));
  }

  const num = parseFloat(str);
  if (!isNaN(num)) {
    if (Math.abs(num) > 100) {
      let f = num;
      while (Math.abs(f) > 100) f /= 10;
      return parseFloat((f > 0 ? -f : f).toFixed(6));
    }
    return parseFloat(num.toFixed(6));
  }
  return null;
}

function parseCoordinatePair(rawStr) {
  if (!rawStr) return null;
  let str = String(rawStr);

  const hrefMatch = str.match(/maps\?q=([-\d.,º'"\sSWNE]+)/i);
  if (hrefMatch) {
    str = hrefMatch[1];
  }

  const parts = str.split(/[,;\/]+|\s{2,}/).map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const lat = parseSingleCoord(parts[0]);
    const lng = parseSingleCoord(parts[1]);
    if (isValidDF(lat, lng)) {
      return { lat, lng };
    }
  }

  const decMatches = str.match(/-1[56]\.\d+|-4[78]\.\d+/g);
  if (decMatches && decMatches.length >= 2) {
    const lat = parseFloat(decMatches[0]);
    const lng = parseFloat(decMatches[1]);
    if (isValidDF(lat, lng)) {
      return { lat, lng };
    }
  }

  return null;
}

function isValidDF(lat, lng) {
  return typeof lat === 'number' && typeof lng === 'number' &&
         !isNaN(lat) && !isNaN(lng) &&
         lat <= -15.0 && lat >= -16.6 &&
         lng <= -47.0 && lng >= -48.6;
}

function normalizeOccupancy(tipoDesc) {
  if (!tipoDesc || String(tipoDesc).trim() === '') return '-';
  const upper = String(tipoDesc).toUpperCase().trim();
  if (upper.includes('ESCOL')) return 'Escolar / Educacional';
  if (upper.includes('COMERC')) return 'Comercial';
  if (upper.includes('RESID')) return 'Residencial Multifamiliar';
  if (upper.includes('PÚBLIC') || upper.includes('PUBLICO') || upper.includes('CONCENTRA')) return 'Reunião de Público';
  if (upper.includes('HOSP') || upper.includes('SAUDE') || upper.includes('SAÚDE')) return 'Hospitalar / Saúde';
  if (upper.includes('INDUS')) return 'Industrial';
  if (upper.includes('ARMAZEN') || upper.includes('ALTO RISCO')) return 'Depósito / Alto Risco';
  if (upper.includes('POSTO')) return 'Posto de Combustíveis';
  return tipoDesc;
}

function cleanExtractedName(str) {
  if (!str) return '';
  let clean = String(str)
    .replace(/^["'“]+|["'”]+$/g, '')
    .replace(/^complemento\s*-\s*/i, '')
    .replace(/coord\.?\s*\(?[-\d.,º'"\s;SWNE!]+\)?/gi, '')
    .replace(/-\s*DF,?\s*\d{5}-?\d{3}/gi, '')
    .replace(/,\s*Brasília\s*-\s*DF/gi, '')
    .replace(/,\s*Brasília/gi, '')
    .replace(/,\s*DF/gi, '')
    .replace(/[;,\-\s]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return clean;
}

function cleanAddress(addr) {
  if (!addr || String(addr).trim() === '') return '-';
  const cleaned = String(addr)
    .replace(/coord\.?\s*\(?[-\d.,º'"\s;SWNE!]+\)?/gi, '')
    .replace(/complemento\s*-\s*$/i, '')
    .replace(/-\s*DF,?\s*\d{5}-?\d{3}/gi, '')
    .replace(/,\s*Brasília\s*-\s*DF/gi, '')
    .replace(/,\s*Brasília/gi, '')
    .replace(/,\s*DF/gi, '')
    .replace(/[;,\-\s]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned || '-';
}

function expandSchoolName(name, ra) {
  if (!name || String(name).trim() === '') return '';
  let expanded = String(name).trim();
  expanded = expanded.replace(/\bEC\s*0*(\d+)\b/gi, 'Escola Classe $1');
  expanded = expanded.replace(/\bCEF\s*0*(\d+)\b/gi, 'Centro de Ensino Fundamental $1');
  expanded = expanded.replace(/\bCEM\s*0*(\d+)\b/gi, 'Centro de Ensino Médio $1');
  expanded = expanded.replace(/\bCED\s*0*(\d+)\b/gi, 'Centro Educacional $1');
  expanded = expanded.replace(/\bCAIC\b/gi, 'CAIC');
  expanded = expanded.replace(/\bCEI\s*0*(\d+)\b/gi, 'Centro de Educação Infantil $1');
  expanded = expanded.replace(/\bCIL\s*0*(\d+)?\b/gi, 'Centro Interescolar de Línguas $1');
  expanded = expanded.replace(/\bUBS\s*0*(\d+)?\b/gi, 'Unidade Básica de Saúde $1');
  expanded = expanded.replace(/\bHRT\b/gi, 'Hospital Regional de Taguatinga');
  expanded = expanded.replace(/\bHRG\b/gi, 'Hospital Regional do Gama');
  expanded = expanded.replace(/\bHRS\b/gi, 'Hospital Regional de Sobradinho');
  expanded = expanded.replace(/\bHRC\b/gi, 'Hospital Regional de Ceilândia');
  expanded = expanded.replace(/\bHRL\b/gi, 'Hospital Regional do Leste (Paranoá)');
  expanded = expanded.replace(/\bHRP\b/gi, 'Hospital Regional de Planaltina');
  expanded = expanded.replace(/\bHRAN\b/gi, 'Hospital Regional da Asa Norte');
  expanded = expanded.replace(/\bHRAS\b/gi, 'Hospital Regional da Asa Sul (HMIB)');
  expanded = expanded.replace(/\bHMIB\b/gi, 'Hospital Materno Infantil de Brasília (HMIB)');
  expanded = expanded.replace(/\bHFA\b/gi, 'Hospital das Forças Armadas (HFA)');
  expanded = expanded.replace(/\bHUB\b/gi, 'Hospital Universitário de Brasília (HUB)');
  return expanded;
}

function extractEstablishmentName(row, ra) {
  const cod = row.cod_levantamento;
  if (MANUAL_OVERRIDES[cod]) {
    return MANUAL_OVERRIDES[cod];
  }

  // 1. Explicit row.estabelecimento
  if (row.estabelecimento && String(row.estabelecimento).trim() !== '') {
    const rawEst = String(row.estabelecimento).trim();
    if (!/^(Q[A-Z0-9]|CL[A-Z]|EQ[A-Z]|SH[A-Z]|SM[A-Z]|AE|ÁREA|LOT[E|ES]|RUA|\d+ª?\s*AVENIDA|VIA|SETOR|TRECHO|CONJUNTO|CHÁCARA|SMPW|SCS|SBS|SBN|SRTV|SIG|SAAN|SIA|SMAS|VILA|AV|AOS|SQS|SQN|CLN|CLS|SHCS|SHCN|QI|QN|QR|QS|QNL|QNM|QNN|QNO|QNJ|QNA|QNB|QNC|QND|QNE|QNF|QNG|QNH|\d+)/i.test(rawEst)) {
      return expandSchoolName(rawEst, ra);
    }
  }

  const dsc = String(row.dsc_endereco || '').trim();
  const compl = String(row.endcompl || '').trim();
  const prox = String(row.enderecomaisproximo || '').trim();
  const final = String(row.enderecofinal || '').trim();
  const all = [dsc, compl, prox, final].join(' || ');

  // 2. Quoted trade name
  const qm = all.match(/["“]([^"”]+)["”]/);
  if (qm && qm[1].trim().length > 2) {
    const qName = cleanExtractedName(qm[1]);
    if (!/^(lote|bloco|casa|loja|apto|sala|conjunto|quadra|cep|df|\d+)/i.test(qName)) {
      return expandSchoolName(qName, ra);
    }
  }

  // 3. Name after CEP in dsc / final / prox (e.g. 72737502 CHURRASQUINHO DO RODINHO)
  const cepMatch = dsc.match(/\b\d{5}-?\d{3}\s+([^coord]+?)(?:\s+coord|\s*$)/i) || dsc.match(/\b\d{8}\s+([^coord]+?)(?:\s+coord|\s*$)/i);
  if (cepMatch) {
    let after = cepMatch[1].replace(/^[,\-\s]+/, '').trim();
    after = cleanExtractedName(after);
    if (after.length > 2 && !/^(coord|df|brasília|brasilia|\d+)/i.test(after) && !/^(lote|bloco|casa|loja|apto|sala|conjunto|quadra)/i.test(after)) {
      return expandSchoolName(after, ra);
    }
  }

  // 4. Complemento text
  const cm = dsc.match(/complemento\s*-\s*([^,\-]+)/i);
  if (cm && cm[1].trim().length > 2) {
    const cName = cleanExtractedName(cm[1]);
    if (!/^(lote|bloco|casa|loja|apto|sala|conjunto|quadra|cep|df|\d+)/i.test(cName)) {
      return expandSchoolName(cName, ra);
    }
  }
  if (compl && !/^(lote|bloco|casa|loja|apto|sala|conjunto|quadra|cep|df|\d+)/i.test(compl)) {
    const cleanCompl = cleanExtractedName(compl.replace(/^complemento\s*-\s*/i, '').split(' - ')[0]);
    if (cleanCompl.length > 2 && !/^\d+$/.test(cleanCompl) && !/^(lote|bloco|casa|loja|apto|sala|conjunto|quadra|cep|df|\d+)/i.test(cleanCompl)) {
      return expandSchoolName(cleanCompl, ra);
    }
  }

  // 5. Keyword in text
  const keyMatch = all.match(/(?:Edifício|Ed\.|Residencial|Condomínio|Cond\.|Restaurante|Churrascaria|Academia|Shopping|Supermercado|Atacadão|Atacado|Hospital|Clínica|Hotel|Faculdade|Colégio|Universidade|Igreja|Paróquia|Templo|Teatro|Galpão|Posto|Drogaria|Farmácia|Padaria|Auto Posto|Lanchonete|Pizzaria|Aeroporto|Feira|Parque|Ginásio|Estádio|Complexo)\s+[^,\-\|\/]+/i);
  if (keyMatch) {
    const kName = cleanExtractedName(keyMatch[0]);
    if (kName.length > 3) {
      return expandSchoolName(kName, ra);
    }
  }

  // 6. School / Health acronym
  const schMatch = all.match(/\b(EC\s*0*\d+|CEF\s*0*\d+|CEM\s*0*\d+|CED\s*0*\d+|CAIC|CEI\s*0*\d+|CIL\s*0*\d*|UBS\s*0*\d*|HR[A-Z]*)\b/i);
  if (schMatch) {
    return expandSchoolName(schMatch[0], ra) + ` (${ra})`;
  }

  // 7. Prefix before dash if not standard address prefix
  if (dsc.includes(' - ')) {
    const parts = dsc.split(' - ');
    const first = parts[0].trim();
    const isAddr = /^(Q[A-Z0-9]|CL[A-Z]|EQ[A-Z]|SH[A-Z]|SM[A-Z]|AE|ÁREA|LOT[E|ES]|RUA|\d+ª?\s*AVENIDA|VIA|SETOR|TRECHO|CONJUNTO|CHÁCARA|SMPW|SCS|SBS|SBN|SRTV|SIG|SAAN|SIA|SMAS|VILA|AV|AOS|SQS|SQN|CLN|CLS|SHCS|SHCN|QI|QN|QR|QS|QNL|QNM|QNN|QNO|QNJ|QNA|QNB|QNC|QND|QNE|QNF|QNG|QNH|\d+)/i.test(first);
    if (!isAddr && first.length > 3 && !first.startsWith('-15') && !first.startsWith('-16')) {
      return expandSchoolName(cleanExtractedName(first), ra);
    }
  }

  // 8. Check melhoracesso for trade names e.g. "ENTRADA PRINCIPAL DU PNEUS"
  if (row.melhoracesso) {
    const cleanMelhor = String(row.melhoracesso)
      .replace(/^(ENTRADA\s+PRINCIPAL|ACESSO\s+PRINCIPAL|ENTRADA|PORTA\s+DE\s+ENTRADA|PORTAO\s+PRINCIPAL|PORTÃO\s+PRINCIPAL)\s+(?:DA|DO|DE|NA|NO)?\s*/i, '')
      .trim();
    if (cleanMelhor.length > 2 && !/^(frente|fundos|lateral|principal|rua|avenida|garagem|estacionamento|nao\s+se\s+aplica|não\s+se\s+aplica|única|unica|\d+)/i.test(cleanMelhor)) {
      return expandSchoolName(cleanExtractedName(cleanMelhor), ra);
    }
  }

  // 8. Fallback to row.tipodescription with cleaned address
  const cleanAddr = cleanAddress(row.enddescription || row.dsc_endereco || row.enderecofinal || 'Edificação ' + ra);
  const tipo = row.tipodescription ? String(row.tipodescription).toUpperCase() : 'ESTABELECIMENTO';
  if (tipo.includes('ESCOL')) return 'Unidade Escolar (' + cleanAddr + ')';
  if (tipo.includes('COMERC')) return 'Estabelecimento Comercial (' + cleanAddr + ')';
  if (tipo.includes('RESID')) return 'Edificação Residencial (' + cleanAddr + ')';
  if (tipo.includes('CONCENTRA')) return 'Local de Reunião de Público (' + cleanAddr + ')';
  if (tipo.includes('HOSP')) return 'Unidade Hospitalar / Saúde (' + cleanAddr + ')';
  if (tipo.includes('INDUS') || tipo.includes('ARMAZEN')) return 'Galpão / Depósito (' + cleanAddr + ')';

  return cleanAddr || ('Edificação ' + ra);
}

function cleanVal(v) {
  if (v === undefined || v === null) return '-';
  const str = String(v).trim();
  if (str === '' || str.toLowerCase() === 'não informado' || str.toLowerCase() === 'nao informado' || str.toLowerCase() === 'não cadastrada' || str.toLowerCase() === 'nao cadastrada' || str.toLowerCase() === 'null') {
    return '-';
  }
  return str;
}

function determineHazard(row) {
  const classe = String(row.classedeincendiopredominante || '').toUpperCase().trim();
  const tipo = String(row.tipodescription || '').toUpperCase().trim();
  if (classe.includes('B') || classe.includes('C') || classe.includes('D') || tipo.includes('INDUS') || tipo.includes('ARMAZEN') || tipo.includes('POSTO')) {
    return 'Alta';
  }
  if (classe.includes('A') || tipo.includes('COMERC') || tipo.includes('CONCENTRA') || tipo.includes('HOSP')) {
    return 'Média';
  }
  return 'Baixa';
}

function processPrepopFile() {
  const possiblePaths = [
    'C:/Users/andre/Downloads/oPERACIONALPREPOP-20260827032950.xlsx',
    path.resolve(__dirname, '../oPERACIONALPREPOP-20260827032950.xlsx'),
    path.resolve(__dirname, '../../oPERACIONALPREPOP-20260827032950.xlsx')
  ];

  let filePath = possiblePaths.find(p => fs.existsSync(p));
  if (!filePath) {
    console.error('Arquivo PREPOP não encontrado em nenhum dos caminhos:', possiblePaths);
    process.exit(1);
  }

  console.log('Lendo arquivo PREPOP: ' + filePath + '...');
  const wb = xlsx.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  const rawRows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
  console.log('Total de registros brutos: ' + rawRows.length);

  const processedList = [];

  rawRows.forEach((row, idx) => {
    const obm = cleanVal(row.obmdescription);
    const obmText = obm !== '-' ? obm : '';
    const ra = normalizeRA(row.dsc_endereco || row.enddescription || row.enderecofinal || '', obmText);

    let coords = null;
    if (row.endlat && row.endllong) {
      const lat = parseSingleCoord(row.endlat);
      const lng = parseSingleCoord(row.endllong);
      if (isValidDF(lat, lng)) {
        coords = { lat, lng };
      }
    }
    if (!coords && row.coodernadasdogooglemaps) {
      coords = parseCoordinatePair(row.coodernadasdogooglemaps);
    }
    if (!coords && row.irparamapa) {
      coords = parseCoordinatePair(row.irparamapa);
    }
    if (!coords && row.vermapa) {
      coords = parseCoordinatePair(row.vermapa);
    }
    if (!coords && row.dsc_endereco) {
      const coordMatch = row.dsc_endereco.match(/coord\.?\s*([-\d.,º'"\sSWNE]+)/i);
      if (coordMatch) coords = parseCoordinatePair(coordMatch[1]);
    }
    if (!coords && row.obmlatituade && row.obmlongitude) {
      const lat = parseSingleCoord(row.obmlatituade);
      const lng = parseSingleCoord(row.obmlongitude);
      if (isValidDF(lat, lng)) {
        coords = { lat, lng };
      }
    }
    if (!coords) {
      coords = RA_DEFAULT_COORDS[ra] || { lat: -15.7942, lng: -47.8822 };
    }

    const nomeEstabelecimento = extractEstablishmentName(row, ra) || 'Edificação ' + (row.cod_levantamento || idx + 1);
    const enderecoLimpo = cleanAddress(row.enddescription || row.dsc_endereco || row.enderecofinal);
    const ocupacao = normalizeOccupancy(row.tipodescription);
    const cargaIncendio = determineHazard(row);

    const possuiSubsolo = String(row.possuisubsolo).toLowerCase() === 'true' || String(row.possuisubsolo).toLowerCase() === 'sim' || row.possuisubsolo === true;
    const centralGas = String(row.centraldegas).toLowerCase() === 'true' || String(row.centraldegas).toLowerCase() === 'sim' || row.centraldegas === true;
    const apoioAutoescada = String(row.possuilocalparaapoiodeviaturastipoautoescada).toLowerCase() === 'true' || String(row.possuilocalparaapoiodeviaturastipoautoescada).toLowerCase() === 'sim' || row.possuilocalparaapoiodeviaturastipoautoescada === true;

    const cepMatch = (row.dsc_endereco || row.enderecofinal || '').match(/\b\d{5}-?\d{3}\b/);
    const cepLimpo = cepMatch ? cepMatch[0] : '-';

    const respVistoria = cleanVal(row.responsavelnome);
    const dataVistoria = cleanVal(row.responsaveldata);
    const melhorAcesso = cleanVal(row.melhoracesso);
    const pontoImpedimento = cleanVal(row.pontoquepodeimpediraatividadedebm);
    const materialInflamavel = cleanVal(row.materialinflamavelarmazenadolocalizacao);
    const vulnerabilidades = cleanVal(row.vulnerabilidadeencontradas);
    const sistemasExistentes = cleanVal(row.sistemaspreventivosexistentes);
    const quadroEnergia = cleanVal(row.localizacaodoquadrodeenergia);
    const locGas = cleanVal(row.localizacao);
    const hidranteProxDesc = cleanVal(row.hidrantemaisproximo);

    const item = {
      id: 'prepop_' + (row.cod_levantamento || idx + 1),
      codLevantamento: row.cod_levantamento || (idx + 1),
      nomeEstabelecimento: nomeEstabelecimento,
      nomeFantasia: nomeEstabelecimento,
      razaoSocial: nomeEstabelecimento,
      ra: ra,
      endereco: enderecoLimpo,
      cep: cepLimpo,
      numLatitude: coords.lat,
      numLongitude: coords.lng,
      ocupacao: ocupacao,
      construcao: cleanVal(row.construcao),
      qtdPavimentos: row.qtdpavimentos ? Number(row.qtdpavimentos) || 1 : 1,
      corPredominante: cleanVal(row.corpredominante),
      hidranteMaisProximoDesc: hidranteProxDesc,
      possuisubsolo: possuiSubsolo,
      centraldegas: centralGas,
      localizacaoCentralGas: centralGas ? (locGas !== '-' ? locGas : 'Possui central de gás') : '-',
      localizacaoQuadroEnergia: quadroEnergia,
      qtdAcessos: row.qtddeacessos ? (Number(row.qtddeacessos) || 1) : 1,
      melhorAcesso: melhorAcesso,
      apoioAutoescada: apoioAutoescada,
      pontoImpedimento: pontoImpedimento,
      materialInflamavel: materialInflamavel,
      classeIncendio: cleanVal(row.classedeincendiopredominante) !== '-' ? cleanVal(row.classedeincendiopredominante) : 'A',
      vulnerabilidades: vulnerabilidades,
      sistemasPreventivos: sistemasExistentes,
      responsavelVistoria: respVistoria,
      dataLevantamento: dataVistoria,
      obmResponsavel: obm,
      fotoFachada: '',
      croquiPlanta: '',

      populacaoFixa: '-',
      populacaoFlutuante: '-',
      populacaoPrioritaria: vulnerabilidades !== '-' && (vulnerabilidades.toUpperCase().includes('CRIANÇA') || vulnerabilidades.toUpperCase().includes('IDOSO') || vulnerabilidades.toUpperCase().includes('HOSP') || vulnerabilidades.toUpperCase().includes('ALTO')) ? vulnerabilidades : '-',
      contatos: [],
      viaPrincipal: melhorAcesso !== '-' ? melhorAcesso : (enderecoLimpo !== '-' ? enderecoLimpo : '-'),
      viaAlternativa: '-',
      restricoesViarias: pontoImpedimento,
      posicionamentoABT: melhorAcesso !== '-' ? `Acesso sugerido: ${melhorAcesso}` : '-',
      posicionamentoAET: apoioAutoescada ? 'Possui local para apoio e armação de viatura Autoescada (AET)' : (row.possuilocalparaapoiodeviaturastipoautoescada !== '' ? 'Sem apoio específico para viatura Autoescada (AET)' : '-'),
      postoComando: '-',
      acvStart: '-',
      volumeRTI: '-',
      registroRecalqueTipo: '-',
      registroRecalqueLocal: '-',
      hidrantesProximos: hidranteProxDesc !== '-' ? [
        {
          codigo: 'PREPOP',
          endereco: hidranteProxDesc,
          distancia: '-',
          diametro: '-',
          status: 'Operante'
        }
      ] : [],
      mananciaisAlternativos: '-',
      chaveGeralEnergia: quadroEnergia,
      valvulaGeralGas: centralGas ? (locGas !== '-' ? locGas : 'Possui central de gás') : '-',
      sprinklersVGA: sistemasExistentes !== '-' && sistemasExistentes.toUpperCase().includes('SPRINK') ? sistemasExistentes : '-',
      escadasPressurizacao: row.qtdpavimentos ? `${row.qtdpavimentos} pavimento(s)` : '-',
      geradorEmergencia: '-',
      cargaIncendio: cargaIncendio,
      produtosPerigosos: '-',
      areasCriticas: vulnerabilidades,
      riscoColapso: `Estrutura: ${cleanVal(row.construcao)}, ${row.qtdpavimentos || 1} pavimento(s)${cleanVal(row.corpredominante) !== '-' ? ', cor ' + cleanVal(row.corpredominante) : ''}`,
      informacoesExtras: `Reconhecimento PREPOP realizado em ${dataVistoria} por ${respVistoria} (${obm}). Acessos: ${row.qtddeacessos || '-'}. Hidrante mais próximo: ${hidranteProxDesc}. Central de gás: ${centralGas ? (locGas !== '-' ? locGas : 'Sim') : 'Não'}. Combustíveis armazenados: ${materialInflamavel}.`,
      dataCadastro: dataVistoria !== '-' ? dataVistoria : '2026-08-27',
      ultimaAtualizacao: dataVistoria !== '-' ? dataVistoria : '2026-08-27'
    };

    processedList.push(item);
  });

  console.log(`Processamento concluído com sucesso: ${processedList.length} estabelecimentos PREPOP.`);

  const publicDir = path.resolve(__dirname, '../public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const outputPath = path.resolve(publicDir, 'prepop_estabelecimentos.json');
  fs.writeFileSync(outputPath, JSON.stringify(processedList, null, 2), 'utf8');
  console.log('Arquivo salvo em: ' + outputPath);

  const distDir = path.resolve(__dirname, '../dist');
  if (fs.existsSync(distDir)) {
    const distOutputPath = path.resolve(distDir, 'prepop_estabelecimentos.json');
    fs.writeFileSync(distOutputPath, JSON.stringify(processedList, null, 2), 'utf8');
    console.log('Arquivo salvo no dist em: ' + distOutputPath);
  }
}

processPrepopFile();