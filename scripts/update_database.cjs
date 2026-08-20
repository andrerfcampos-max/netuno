/**
 * Pipeline Oficial de Atualização e Higienização da Base de Dados - NETUNO / SUPER ARGOS
 * 
 * Uso:
 *   node scripts/update_database.cjs [caminho_do_novo_arquivo.xlsx|csv]
 * 
 * Exemplo:
 *   node scripts/update_database.cjs "C:/Users/andre/Downloads/result (11).xlsx"
 *   npm run update-db
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// 1. Mapeamento Canônico de Prefixos para Regiões Administrativas (RAs)
const PREFIX_TO_RA = {
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

// 2. Mapeamento de Códigos de Localidade CBMDF/CAESB
const RA_LOCALIDADE_MAP = {
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

function resolveRA(row, rawNom, rawCod) {
  let rawRA = row.dscLocalidade || row.Localidade || row.RA || row['RA'] || row.Cidade || '';
  if (rawRA && typeof rawRA === 'string') {
    const clean = rawRA.trim();
    if (clean && !['undefined', 'null', 'falso', 'verdadeiro', '-'].includes(clean.toLowerCase())) {
      return clean;
    }
  }

  const nomStr = String(rawNom || rawCod || '').trim();
  const pfx = nomStr.substring(0, 3).toUpperCase();
  if (PREFIX_TO_RA[pfx]) {
    return PREFIX_TO_RA[pfx];
  }

  if (row.codLocalidade && RA_LOCALIDADE_MAP[row.codLocalidade]) {
    return RA_LOCALIDADE_MAP[row.codLocalidade];
  }

  return 'Brasília';
}

function findLatestSourceFile() {
  const customArg = process.argv[2];
  if (customArg && fs.existsSync(customArg)) {
    return customArg;
  }

  const downloadsDir = path.join(process.env.USERPROFILE || 'C:/Users/andre', 'Downloads');
  if (fs.existsSync(downloadsDir)) {
    const files = fs.readdirSync(downloadsDir)
      .filter(f => /^result.*\.xlsx$/i.test(f) || /^banco_de_dados.*\.csv$/i.test(f) || /^hidrantes_filtrados.*\.csv$/i.test(f))
      .map(f => ({
        name: f,
        path: path.join(downloadsDir, f),
        mtime: fs.statSync(path.join(downloadsDir, f)).mtimeMs
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > 0) {
      return files[0].path;
    }
  }

  const fallback = path.join(__dirname, '../public/base-de-dados.xlsx');
  if (fs.existsSync(fallback)) return fallback;

  throw new Error('Nenhum arquivo de origem encontrado.');
}

function runPipeline() {
  console.log('====================================================');
  console.log('🔄 NETUNO - PIPELINE DE ATUALIZAÇÃO DA BASE DE DADOS');
  console.log('====================================================');

  const sourceFile = findLatestSourceFile();
  console.log(`📁 Arquivo de Origem: ${sourceFile}`);

  // 1. Carregar Banco Existente para preservação de histórico de problemas
  const existingProbMap = {};
  const currentBaseFile = path.join(__dirname, '../public/base-de-dados.xlsx');
  if (fs.existsSync(currentBaseFile)) {
    try {
      const curWb = XLSX.readFile(currentBaseFile);
      const curData = XLSX.utils.sheet_to_json(curWb.Sheets[curWb.SheetNames[0]]);
      curData.forEach(r => {
        const code = (r.nomHidrante || r['Código'] || r.codHidrante || '').trim();
        const prob = (r.problemasHidrante || r['Problemas do Hidrante'] || '').trim();
        if (code && prob) {
          existingProbMap[code] = prob;
        }
      });
      console.log(`ℹ️  Histórico existente indexado: ${Object.keys(existingProbMap).length} hidrantes com problemas catalogados.`);
    } catch (e) {
      console.warn('⚠️  Não foi possível ler base anterior:', e.message);
    }
  }

  // 2. Ler arquivo de entrada (XLSX ou CSV)
  let rawData = [];
  if (sourceFile.endsWith('.csv')) {
    const csvContent = fs.readFileSync(sourceFile, 'latin1');
    const workbook = XLSX.read(csvContent, { type: 'string' });
    rawData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  } else {
    const workbook = XLSX.readFile(sourceFile);
    rawData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  }

  console.log(`📥 Total de registros brutos lidos: ${rawData.length}`);

  // 3. Processar e Enriquecer
  let countOperantes = 0;
  let countInoperantes = 0;
  let countWithDefects = 0;
  let validCoords = 0;
  let invalidCoords = 0;

  const processedData = [];

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];

    const rawNom = String(row.nomHidrante || row['Código'] || row['\uFEFFCódigo'] || '').trim();
    const rawCod = String(row.codHidrante || row.nomHidrante || row['Código'] || '').trim();
    const rowAddress = String(row.dscEndereco || row['Endereço'] || '').trim();

    // Filtros de linhas anômalas
    if (rawNom.startsWith('-15') || rawNom.startsWith('-16') || rawNom.startsWith('-14') || rawNom.startsWith('OBS:')) {
      continue;
    }
    if (!rawNom && !rawCod && !rowAddress) {
      continue;
    }

    const code = (rawNom || rawCod || `HID${i + 1}`).trim();
    const ra = resolveRA(row, rawNom, rawCod);

    // Status Operacional
    const flgAtivoRaw = row.flgAtivo !== undefined ? row.flgAtivo : (row.Status || row['Status'] || row.status);
    const ativoStr = flgAtivoRaw !== undefined && flgAtivoRaw !== null ? String(flgAtivoRaw).trim().toLowerCase() : '';
    const isAtivo = ['true', '1', 'v', 'verdadeiro', 'sim', 's', 'operante', 'ativo'].includes(ativoStr) || flgAtivoRaw === true;

    if (isAtivo) countOperantes++; else countInoperantes++;

    // Problemas / Defeitos
    let problema = String(row.problemasHidrante || row['Problemas do Hidrante'] || row.Problema || '').trim();
    if (!problema && existingProbMap[code]) {
      problema = existingProbMap[code];
    }
    if (problema) countWithDefects++;

    // Coordenadas
    let lat = parseFloat(String(row.numLatitude || row.Latitude || '').replace(/,/g, '.'));
    let lng = parseFloat(String(row.numLongitude || row.Longitude || '').replace(/,/g, '.'));

    if (isNaN(lat) || isNaN(lng) || lat >= -15.0 || lat <= -16.5 || lng >= -47.0 || lng <= -48.5) {
      invalidCoords++;
    } else {
      validCoords++;
    }

    processedData.push({
      ...row,
      nomHidrante: rawNom || code,
      codHidrante: rawCod || code,
      dscLocalidade: ra,
      dscEndereco: rowAddress,
      dscPontoReferencia: String(row.dscPontoReferencia || row['Ponto de referência'] || '').trim(),
      numLatitude: isNaN(lat) ? 0 : lat,
      numLongitude: isNaN(lng) ? 0 : lng,
      flgAtivo: isAtivo,
      status: isAtivo ? 'Operante' : 'Inoperante',
      problemasHidrante: problema,
      datHoraUltimaVistoria: String(row.datHoraUltimaVistoria || row.datHoraVistoria || row.DataVistoria || row['Data Vistoria'] || '').trim()
    });
  }

  // 4. Salvar base atualizada no formato Excel padronizado
  const outWb = XLSX.utils.book_new();
  const outWs = XLSX.utils.json_to_sheet(processedData);
  XLSX.utils.book_append_sheet(outWb, outWs, 'data');

  const publicDest = path.join(__dirname, '../public/base-de-dados.xlsx');
  const rootDest = path.join(__dirname, '../base-de-dados.xlsx');

  XLSX.writeFile(outWb, publicDest);
  XLSX.writeFile(outWb, rootDest);

  console.log('----------------------------------------------------');
  console.log('✅ BASE DE DADOS ATUALIZADA COM SUCESSO:');
  console.log(`   📍 Total Processado: ${processedData.length} hidrantes`);
  console.log(`   🟢 Operantes: ${countOperantes}`);
  console.log(`   🔴 Inoperantes: ${countInoperantes}`);
  console.log(`   🔧 Com Diagnóstico de Defeito: ${countWithDefects}`);
  console.log(`   🗺️  Coordenadas Válidas no DF: ${validCoords} (Inconsistentes: ${invalidCoords})`);
  console.log(`   💾 Arquivo Salvo em: ${publicDest}`);
  console.log('====================================================');
}

runPipeline();
