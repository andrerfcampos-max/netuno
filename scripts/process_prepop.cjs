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
  'SCIA': 'SCIA / Estrutural',
  'ESTRUTURAL': 'SCIA / Estrutural',
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
  'SCIA / Estrutural': { lat: -15.7833, lng: -47.9889 },
  'Sudoeste/Octogonal': { lat: -15.7989, lng: -47.9256 },
  'Varjão': { lat: -15.7167, lng: -47.8833 },
  'Park Way': { lat: -15.8944, lng: -47.9472 },
  'Vicente Pires': { lat: -15.8083, lng: -48.0278 },
  'Jardim Botânico': { lat: -15.8806, lng: -47.8139 },
  'Sol Nascente/Pôr do Sol': { lat: -15.8289, lng: -48.1472 },
  'Arniqueira': { lat: -15.8583, lng: -48.0167 }
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

function cleanAddress(addr) {
  if (!addr || String(addr).trim() === '') return '-';
  const cleaned = String(addr)
    .replace(/coord\.?\s*([-\d.,º'"\sSWNE]+)/gi, '')
    .replace(/complemento\s*-\s*$/i, '')
    .replace(/-\s*DF,?\s*\d{5}-?\d{3}/gi, '')
    .replace(/,\s*Brasília\s*-\s*DF/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned || '-';
}

function expandSchoolName(name, ra) {
  if (!name || String(name).trim() === '') return '';
  let expanded = String(name).trim();
  expanded = expanded.replace(/\bEC\s*(\d+)\b/gi, 'Escola Classe $1');
  expanded = expanded.replace(/\bCEF\s*(\d+)\b/gi, 'Centro de Ensino Fundamental $1');
  expanded = expanded.replace(/\bCEM\s*(\d+)\b/gi, 'Centro de Ensino Médio $1');
  expanded = expanded.replace(/\bCED\s*(\d+)\b/gi, 'Centro Educacional $1');
  expanded = expanded.replace(/\bCAIC\b/gi, 'CAIC');
  expanded = expanded.replace(/\bCEI\s*(\d+)\b/gi, 'Centro de Educação Infantil $1');
  expanded = expanded.replace(/\bCIL\s*(\d+)?\b/gi, 'Centro Interescolar de Línguas $1');
  expanded = expanded.replace(/\bUBS\s*(\d+)?\b/gi, 'Unidade Básica de Saúde $1');
  expanded = expanded.replace(/\bHRT\b/gi, 'Hospital Regional de Taguatinga');
  expanded = expanded.replace(/\bHRG\b/gi, 'Hospital Regional do Gama');
  expanded = expanded.replace(/\bHRS\b/gi, 'Hospital Regional de Sobradinho');
  expanded = expanded.replace(/\bHRC\b/gi, 'Hospital Regional de Ceilândia');
  expanded = expanded.replace(/\bHRL\b/gi, 'Hospital Regional do Leste (Paranoá)');
  expanded = expanded.replace(/\bHRP\b/gi, 'Hospital Regional de Planaltina');
  expanded = expanded.replace(/\bHRAN\b/gi, 'Hospital Regional da Asa Norte');
  expanded = expanded.replace(/\bHRAS\b/gi, 'Hospital Regional da Asa Sul (HMIB)');
  return expanded;
}

function extractEstablishmentName(row, ra) {
  if (row.estabelecimento && String(row.estabelecimento).trim() !== '') {
    return expandSchoolName(String(row.estabelecimento).trim(), ra);
  }
  if (row.endcompl && String(row.endcompl).trim() !== '' && !String(row.endcompl).toLowerCase().startsWith('lote') && !String(row.endcompl).toLowerCase().startsWith('bloco')) {
    const compl = String(row.endcompl).trim();
    if (compl.includes(' - ')) {
      const parts = compl.split(' - ');
      if (parts[0].length > 3 && !parts[0].match(/^\d+$/)) {
        return expandSchoolName(parts[0].trim(), ra);
      }
    } else if (compl.length > 3 && !compl.match(/^\d+$/)) {
      return expandSchoolName(compl, ra);
    }
  }
  const rawAddr = row.dsc_endereco || row.enderecofinal || '';
  if (rawAddr.includes(' - ')) {
    const parts = rawAddr.split(' - ');
    const firstPart = parts[0].trim();
    const isStandardAddress = /^(Q[A-Z0-9]|CL[A-Z]|EQ[A-Z]|SH[A-Z]|SM[A-Z]|AE|ÁREA|LOT[E|ES]|RUA|\d+ª?\s*AVENIDA|VIA|SETOR|TRECHO|CONJUNTO|CHÁCARA|SMPW|SCS|SBS|SBN|SRTV|SIG|SAAN|SIA|SMAS)/i.test(firstPart);
    if (!isStandardAddress && firstPart.length > 3 && !firstPart.startsWith('-15') && !firstPart.startsWith('-16')) {
      return expandSchoolName(firstPart, ra);
    }
    const schoolMatch = firstPart.match(/\b(EC|CEF|CEM|CED|CAIC|CEI|CIL|UBS|HR[A-Z]*)\s*(\d+)?\b/i);
    if (schoolMatch) {
      return expandSchoolName(schoolMatch[0], ra) + ' (' + ra + ')';
    }
  }
  const edMatch = rawAddr.match(/(?:Edifício|Ed\.|Residencial|Condomínio|Cond\.)\s+([^,–\-]+)/i);
  if (edMatch) {
    return edMatch[0].trim();
  }
  const keywordMatch = rawAddr.match(/(?:AEROPORTO|SHOPPING|SUPERMERCADO|ATACADÃO|HOSPITAL|CLÍNICA|HOTEL|ACADEMIA|FACULDADE|COLÉGIO|UNIVERSIDADE|IGREJA|PARÓQUIA|TEMPLO|CENTRO CULTURAL|TEATRO|CONCESSIONÁRIA)\s+[^,\-]+/i);
  if (keywordMatch) {
    return keywordMatch[0].trim();
  }
  const cleanAddr = cleanAddress(row.enddescription || row.dsc_endereco || 'Localidade ' + ra);
  const tipo = row.tipodescription ? String(row.tipodescription).toUpperCase() : 'ESTABELECIMENTO';
  if (tipo.includes('ESCOL')) return 'Unidade Escolar (' + cleanAddr + ')';
  if (tipo.includes('COMERC')) return 'Estabelecimento Comercial (' + cleanAddr + ')';
  if (tipo.includes('RESID')) return 'Edificação Residencial (' + cleanAddr + ')';
  if (tipo.includes('CONCENTRA')) return 'Local de Reunião de Público (' + cleanAddr + ')';
  return cleanAddr && cleanAddr !== '-' ? cleanAddr : 'Edificação Cadastrada - ' + ra;
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