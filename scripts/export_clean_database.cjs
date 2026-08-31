const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

function generateCleanDatabase() {
  const xlsxPath = path.resolve(__dirname, '../public/base-de-dados.xlsx');
  if (!fs.existsSync(xlsxPath)) {
    console.error('Arquivo public/base-de-dados.xlsx não encontrado.');
    return;
  }

  console.log('Lendo base de dados atual...');
  const wb = xlsx.readFile(xlsxPath);
  const rawData = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });

  console.log(`Processando ${rawData.length} linhas brutas para formato canônico limpo...`);

  const cleanRecords = [];

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    const code = String(row.nomHidrante || row.codHidrante || row['Código'] || '').trim();
    const address = String(row.dscEndereco || row['Endereço'] || '').trim();
    const ra = String(row.dscLocalidade || row['RA'] || row['Cidade'] || '').trim();

    if (!code && !address && !ra) continue;
    if (code.startsWith('-15') || code.startsWith('-16') || code.startsWith('OBS:')) continue;

    let lat = parseFloat(String(row.numLatitude || row.Latitude || '').replace(',', '.'));
    let lng = parseFloat(String(row.numLongitude || row.Longitude || '').replace(',', '.'));

    if (isNaN(lat)) lat = -15.7942;
    if (isNaN(lng)) lng = -47.8822;

    const flgAtivoRaw = row.flgAtivo !== undefined ? row.flgAtivo : (row.Status || row.status);
    const ativoStr = String(flgAtivoRaw).toLowerCase().trim();
    const isAtivo = ['true', '1', 'v', 'verdadeiro', 'sim', 's', 'operante', 'ativo'].includes(ativoStr) || flgAtivoRaw === true;

    const record = {
      _internalId: `hid_${i + 1}`,
      codHidrante: code,
      nomHidrante: code,
      dscLocalidade: ra || 'Brasília',
      dscEndereco: address,
      pontoReferencia: String(row.dscPontoReferencia || row['Ponto de referência'] || '').trim(),
      numLatitude: parseFloat(lat.toFixed(6)),
      numLongitude: parseFloat(lng.toFixed(6)),
      flgAtivo: isAtivo,
      problemasHidrante: String(row.problemasHidrante || row['Problemas'] || '').trim(),
      datHoraVistoria: String(row.datHoraVistoria || row['Data da Vistoria'] || '').trim(),
      vistoriadorNome: String(row.vistoriadorNome || row['Vistoriador'] || '').trim(),
      diametro: String(row.diametro || '100mm').trim(),
      fotoPerfil: String(row.fotoPerfil || '').trim()
    };

    cleanRecords.push(record);
  }

  // Gera CSV Limpo
  const headers = [
    '_internalId',
    'codHidrante',
    'nomHidrante',
    'dscLocalidade',
    'dscEndereco',
    'pontoReferencia',
    'numLatitude',
    'numLongitude',
    'flgAtivo',
    'problemasHidrante',
    'datHoraVistoria',
    'vistoriadorNome',
    'diametro',
    'fotoPerfil'
  ];

  const csvRows = [headers.join(',')];

  cleanRecords.forEach(r => {
    const rowValues = headers.map(h => {
      const val = r[h];
      if (typeof val === 'string') {
        const escaped = val.replace(/"/g, '""');
        return `"${escaped}"`;
      }
      return val;
    });
    csvRows.push(rowValues.join(','));
  });

  const csvOutput = path.resolve(__dirname, '../public/hidrantes_df_oficial.csv');
  fs.writeFileSync(csvOutput, csvRows.join('\n'), 'utf8');
  console.log(`✅ Base limpa oficial em CSV gerada com sucesso (${cleanRecords.length} hidrantes): ${csvOutput}`);

  const jsonOutput = path.resolve(__dirname, '../public/hidrantes_df_oficial.json');
  fs.writeFileSync(jsonOutput, JSON.stringify(cleanRecords, null, 2), 'utf8');
  console.log(`✅ Base limpa oficial em JSON gerada: ${jsonOutput}`);
}

generateCleanDatabase();