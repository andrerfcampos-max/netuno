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

function normalizeRA(rawText, obmDescription) {
  if (!rawText && obmDescription && OBM_TO_RA[obmDescription]) {
    return OBM_TO_RA[obmDescription];
  }
  if (!rawText) return 'Brasília';
  const upper = String(rawText).toUpperCase().trim();
  for (const [key, val] of Object.entries(RA_NORMALIZATION)) {
    if (upper.includes(key)) return val;
  }
  if (obmDescription && OBM_TO_RA[obmDescription]) {
    return OBM_TO_RA[obmDescription];
  }
  return 'Brasília';
}

function parseCoordinate(val) {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') return val;
  let str = String(val).trim().replace(',', '.');
  const dmsMatch = str.match(/(\d+)º\s*(\d+)['’]\s*([\d.]+)[”"]?\s*([SWNE]?)/i);
  if (dmsMatch) {
    const deg = parseFloat(dmsMatch[1]);
    const min = parseFloat(dmsMatch[2]);
    const sec = parseFloat(dmsMatch[3]);
    const dir = dmsMatch[4].toUpperCase();
    let dec = deg + (min / 60) + (sec / 3600);
    if (dir === 'S' || dir === 'W') dec = -dec;
    return parseFloat(dec.toFixed(6));
  }
  const num = parseFloat(str);
  if (!isNaN(num)) {
    if (Math.abs(num) > 1000) {
      const fixed = num / 100000;
      return fixed > 0 ? -fixed : fixed;
    }
    return parseFloat(num.toFixed(6));
  }
  return null;
}

function extractCoordinatesFromText(text) {
  if (!text) return null;
  const match = String(text).match(/coord\.?\s*([-\d.,º'"\sSWNE]+)/i);
  if (match) {
    const rawCoords = match[1].trim();
    const parts = rawCoords.split(/,|\s{2,}/);
    if (parts.length >= 2) {
      const lat = parseCoordinate(parts[0]);
      const lng = parseCoordinate(parts[1]);
      if (lat && lng) return { lat, lng };
    }
  }
  return null;
}

function normalizeOccupancy(tipoDesc) {
  if (!tipoDesc) return 'Outros';
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
  if (!addr) return '';
  return String(addr)
    .replace(/coord\.?\s*([-\d.,º'"\sSWNE]+)/gi, '')
    .replace(/complemento\s*-\s*$/i, '')
    .replace(/-\s*DF,?\s*\d{5}-?\d{3}/gi, '')
    .replace(/,\s*Brasília\s*-\s*DF/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function expandSchoolName(name, ra) {
  if (!name) return name;
  let expanded = String(name);
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
  return cleanAddr || 'Edificação Cadastrada - ' + ra;
}

function processPrepopFile() {
  const filePath = 'C:/Users/andre/Downloads/oPERACIONALPREPOP-20260827032950.xlsx';
  if (!fs.existsSync(filePath)) {
    console.error('Arquivo não encontrado: ' + filePath);
    return;
  }
  console.log('Lendo arquivo PREPOP: ' + filePath + '...');
  const wb = xlsx.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  const rawRows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
  console.log('Total de linhas brutas: ' + rawRows.length);

  const processedList = [];
  let extractedCount = 0;

  rawRows.forEach((row, idx) => {
    const obm = row.obmdescription || '';
    const ra = normalizeRA(row.dsc_endereco || row.enddescription || row.enderecofinal || '', obm);

    let lat = parseCoordinate(row.endlat || row.obmlatituade);
    let lng = parseCoordinate(row.endllong || row.obmlongitude);

    if (!lat || !lng || lat > -15.0 || lat < -16.6 || lng < -48.6 || lng > -47.0) {
      const extractedCoords = extractCoordinatesFromText(row.dsc_endereco || row.enderecofinal);
      if (extractedCoords) {
        lat = extractedCoords.lat;
        lng = extractedCoords.lng;
      }
    }
    if (!lat || !lng || lat > -15.0 || lat < -16.6 || lng < -48.6 || lng > -47.0) {
      lat = -15.794200;
      lng = -47.882200;
    }

    const nomeEstabelecimento = extractEstablishmentName(row, ra);
    if (!row.estabelecimento || String(row.estabelecimento).trim() === '') {
      extractedCount++;
    }

    const enderecoLimpo = cleanAddress(row.enddescription || row.dsc_endereco || row.enderecofinal);
    const ocupacao = normalizeOccupancy(row.tipodescription);

    const possuiSubsolo = String(row.possuisubsolo).toLowerCase() === 'true' || String(row.possuisubsolo).toLowerCase() === 'sim' || row.possuisubsolo === true;
    const centralGas = String(row.centraldegas).toLowerCase() === 'true' || String(row.centraldegas).toLowerCase() === 'sim' || row.centraldegas === true;
    const apoioAutoescada = String(row.possuilocalparaapoiodeviaturastipoautoescada).toLowerCase() === 'true' || String(row.possuilocalparaapoiodeviaturastipoautoescada).toLowerCase() === 'sim' || row.possuilocalparaapoiodeviaturastipoautoescada === true;

    const cepMatch = (row.dsc_endereco || '').match(/\b\d{5}-?\d{3}\b/);

    const item = {
      id: 'prepop_' + (row.cod_levantamento || idx + 1),
      codLevantamento: row.cod_levantamento || idx + 1,
      nomeEstabelecimento: nomeEstabelecimento,
      nomeFantasia: nomeEstabelecimento,
      razaoSocial: nomeEstabelecimento,
      ra: ra,
      endereco: enderecoLimpo || 'Endereço não especificado',
      cep: cepMatch ? cepMatch[0] : '',
      numLatitude: lat,
      numLongitude: lng,
      ocupacao: ocupacao,
      construcao: row.construcao || 'Alvenaria',
      qtdPavimentos: row.qtdpavimentos || 1,
      corPredominante: row.corpredominante || '',
      hidranteMaisProximoDesc: row.hidrantemaisproximo || '',
      possuisubsolo: possuiSubsolo,
      centraldegas: centralGas,
      localizacaoCentralGas: row.localizacao || '',
      localizacaoQuadroEnergia: row.localizacaodoquadrodeenergia || '',
      qtdAcessos: row.qtddeacessos || 1,
      melhorAcesso: row.melhoracesso || 'Entrada Principal',
      apoioAutoescada: apoioAutoescada,
      pontoImpedimento: row.pontoquepodeimpediraatividadedebm || 'Nenhum',
      materialInflamavel: row.materialinflamavelarmazenadolocalizacao || 'Nenhum',
      classeIncendio: row.classedeincendiopredominante || 'A',
      vulnerabilidades: row.vulnerabilidadeencontradas || 'Nenhuma vulnerabilidade crítica registrada.',
      sistemasPreventivos: row.sistemaspreventivosexistentes || 'Extintores',
      responsavelVistoria: row.responsavelnome || '',
      dataLevantamento: row.responsaveldata || '2026-08-27',
      obmResponsavel: obm || '',
      fotoFachada: '',
      croquiPlanta: ''
    };

    processedList.push(item);
  });

  console.log('Processamento concluído: ' + processedList.length + ' estabelecimentos.');
  console.log('Nomes recuperados/higienizados: ' + extractedCount);

  if (!fs.existsSync(path.resolve(__dirname, '../public'))) {
    fs.mkdirSync(path.resolve(__dirname, '../public'), { recursive: true });
  }

  const outputPath = path.resolve(__dirname, '../public/prepop_estabelecimentos.json');
  fs.writeFileSync(outputPath, JSON.stringify(processedList, null, 2), 'utf8');
  console.log('Arquivo salvo em: ' + outputPath);
}

processPrepopFile();