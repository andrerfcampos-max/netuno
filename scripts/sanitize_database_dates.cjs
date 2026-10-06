const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const jsonPath = path.resolve(__dirname, '../public/hidrantes_df_oficial.json');
const csvPath = path.resolve(__dirname, '../public/hidrantes_df_oficial.csv');
const xlsxPublicPath = path.resolve(__dirname, '../public/base-de-dados.xlsx');
const xlsxRootPath = path.resolve(__dirname, '../base-de-dados.xlsx');

const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

function normalizeDateStr(str) {
  if (!str || str === '-' || str.toLowerCase() === 'sem vistoria' || str.toLowerCase() === 'dados argos') {
    return str || '';
  }

  let s = String(str).trim().replace(/[,;]+$/, '').trim();

  // Caso específico das vistorias de Lago Sul que foram invertidas no histórico:
  // 10/06/2026 -> 06/10/2026 (outubro)
  s = s.replace(/\b10\/06\/2026\b/g, '06/10/2026');
  // 10/01/2026 -> 01/10/2026 (outubro)
  s = s.replace(/\b10\/01\/2026\b/g, '01/10/2026');

  // Normalizar separador de vírgula espúria: "06/10/2026, 09:58:48" -> "06/10/2026 09:58:48"
  s = s.replace(/(\d{2}\/\d{2}\/\d{4}),\s*(\d{2}:\d{2}(?::\d{2})?)/, '$1 $2');

  return s;
}

let fixedCount = 0;

const cleanedList = rawData.map(h => {
  const oldDt = h.datHoraUltimaVistoria;
  const newDt = normalizeDateStr(oldDt);
  if (oldDt !== newDt) fixedCount++;

  h.datHoraUltimaVistoria = newDt;
  h.datHoraVistoria = normalizeDateStr(h.datHoraVistoria);

  if (Array.isArray(h.HISTORICO_VISTORIAS)) {
    h.HISTORICO_VISTORIAS = h.HISTORICO_VISTORIAS.map(v => {
      return {
        ...v,
        datHoraVistoria: normalizeDateStr(v.datHoraVistoria)
      };
    });

    const seen = new Set();
    const deduped = [];
    for (const v of h.HISTORICO_VISTORIAS) {
      const key = `${v.datHoraVistoria}|${v.flgAtivo}|${v.problemasHidrante || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(v);
      }
    }
    h.HISTORICO_VISTORIAS = deduped;
  }

  return h;
});

console.log(`[Sanitize] ${fixedCount} hidrantes tiveram suas datas normalizadas.`);

// 1. Salvar JSON
fs.writeFileSync(jsonPath, JSON.stringify(cleanedList, null, 2), 'utf8');
console.log(`✅ Salvo: ${jsonPath}`);

// 2. Salvar CSV
const headers = [
  '_internalId',
  'codHidrante',
  'nomHidrante',
  'codLegado',
  'dscLocalidade',
  'dscEndereco',
  'pontoReferencia',
  'dscPontoReferencia',
  'numLatitude',
  'numLongitude',
  'flgAtivo',
  'status',
  'problemasHidrante',
  'dscObservacao',
  'datHoraVistoria',
  'datHoraUltimaVistoria',
  'vistoriadorNome',
  'diametro',
  'fotoPerfil'
];

const csvRows = [headers.join(',')];
cleanedList.forEach(r => {
  const rowValues = headers.map(h => {
    const val = r[h];
    if (typeof val === 'string') {
      const escaped = val.replace(/"/g, '""');
      return `"${escaped}"`;
    }
    return val !== undefined && val !== null ? val : '';
  });
  csvRows.push(rowValues.join(','));
});
fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf8');
console.log(`✅ Salvo: ${csvPath}`);

// 3. Salvar XLSX (public e root) via ExcelJS (sem colunas com objetos gigantes)
async function saveXlsx() {
  const flatData = cleanedList.map(h => {
    const clone = { ...h };
    delete clone.HISTORICO_VISTORIAS;
    delete clone.fotosVistoria;
    return clone;
  });

  const outWb = new ExcelJS.Workbook();
  const outWs = outWb.addWorksheet('data');
  if (flatData.length > 0) {
    outWs.columns = Object.keys(flatData[0]).map(k => ({ header: k, key: k }));
    outWs.addRows(flatData);
  }

  await outWb.xlsx.writeFile(xlsxPublicPath);
  await outWb.xlsx.writeFile(xlsxRootPath);
  console.log(`✅ Salvo: ${xlsxPublicPath} e ${xlsxRootPath}`);
}

saveXlsx().then(() => {
  console.log('Sanitização concluída com sucesso!');
}).catch(err => {
  console.error('Erro ao salvar planilhas:', err);
});
