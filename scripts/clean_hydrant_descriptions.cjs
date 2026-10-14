/**
 * Script de higienização de anotações de Processo SEI / CAESB e "LOCALIZAÇÃO CORRETA"
 * dos campos de endereço (dscEndereco) e ponto de referência (dscPontoReferencia / pontoReferencia).
 *
 * Atualiza atômica e simultaneamente:
 *   1. public/hidrantes_df_oficial.json
 *   2. public/hidrantes_df_oficial.csv
 *   3. public/base-de-dados.xlsx
 *   4. base-de-dados.xlsx (raiz)
 */

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const Papa = require('papaparse');

const jsonPath = path.resolve(__dirname, '../public/hidrantes_df_oficial.json');
const raw = fs.readFileSync(jsonPath, 'utf8');
const data = JSON.parse(raw);

function cleanText(val) {
  if (!val || typeof val !== 'string') return val;
  let text = val;

  // 1. Remove notas entre parênteses como "(FEITO DOC. P/CAESB. SEI 00053-00177090/2022-89)"
  text = text.replace(/\s*\(\s*(?:feito\s+doc\.?\s*(?:p\/caesb\.?)?\s*)?(?:processo\s*(?:sei)?|sei)[\s\S]*?\)/gi, '');

  // 2. Remove "Processo SEI - CAESB - ..." ou "Processo SEI 00053-..." em linhas separadas ou após ponto final
  text = text.replace(/(?:^|\r?\n|\.\s*)\s*processo\s*(?:sei)?\s*(?:[-–:]\s*caesb)?\s*[-–:]?\s*[0-9\/\.\-]+[^\r\n]*/gi, '');
  text = text.replace(/(?:^|\r?\n)\s*processo\s*(?:sei|caesb)[\s\S]*?(?=\r?\n|$)/gi, '');

  // 3. Remove "A LOCALIZAÇÃO ESTÁ ERRADA"
  text = text.replace(/(?:^|\r?\n|\.\s*|\s+)\s*(?:a\s+)?localiza[çc][ãa]o\s+est[áa]\s+errada\s*[:;\.]?/gi, '');

  // 4. Remove "LOCALIZAÇÃO CORRETA" (inclusive com "OBS:", erros de digitação como LOCALIUZAÇÃO e coordenadas adjacentes)
  text = text.replace(/(?:^|\r?\n|\.\s*|\s+)\s*(?:obs\s*[:\-]\s*)?locali[a-z]*[çc][ãa]o\s+correta\s*[:;]?\s*(?:[^\r\n]*(?:\r?\n\s*[sS\d][^\r\n]*)?)?/gi, '');

  // 5. Remove coordenadas geográficas soltas inseridas no texto (ex: S16º... W48º... ou 15º39'03.0"S 47º49'07.0"W)
  text = text.replace(/(?:^|\r?\n)\s*[sS]?\s*\d{1,2}\s*[º°]\s*\d{1,2}['\u2032\u00B4]\s*[\d\.]+["\u201D\u2033]?\s*[sS]?\s*[,/]?\s*[wW]?\s*\d{1,2}\s*[º°]\s*\d{1,2}['\u2032\u00B4]\s*[\d\.]+["\u201D\u2033]?\s*[wW]?[^\r\n]*/gi, '');

  // 6. Remove marcadores "OBS:" órfãos ao final
  text = text.replace(/(?:^|\r?\n)\s*obs\s*[:\.]?\s*$/gi, '');
  text = text.replace(/[\s\.\-,;]+obs\s*[:\.]?\s*$/gi, '');

  // 7. Normaliza quebras de linha e espaços múltiplos
  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/\n\s*\n+/g, '\n');
  text = text.replace(/[ \t]{2,}/g, ' ');
  text = text.trim();

  // 8. Limpa pontuações soltas ao final, preservando ponto final de frase
  text = text.replace(/[\s\.\-,;]+$/, (match) => {
    if (match.trim() === '.') return '.';
    return '';
  }).trim();

  return text;
}

async function run() {
  console.log(`Iniciando higienização em ${data.length} hidrantes...`);

  let modifiedCount = 0;
  const changes = [];

  const processedData = data.map((h) => {
    let modified = false;
    const newH = { ...h };
    const logItem = { nom: h.nomHidrante || h.codHidrante, cod: h.codHidrante, fields: [] };

    ['dscEndereco', 'dscPontoReferencia', 'pontoReferencia'].forEach(field => {
      const orig = newH[field];
      if (orig && typeof orig === 'string') {
        const cleaned = cleanText(orig);
        if (cleaned !== orig) {
          logItem.fields.push({
            field,
            before: orig,
            after: cleaned
          });
          newH[field] = cleaned;
          modified = true;
        }
      }
    });

    if (modified) {
      modifiedCount++;
      changes.push(logItem);
    }
    return newH;
  });

  console.log(`✅ Higienização concluída: ${modifiedCount} hidrantes modificados.`);

  // 1. Gravar JSON oficial
  const jsonDest = path.resolve(__dirname, '../public/hidrantes_df_oficial.json');
  fs.writeFileSync(jsonDest, JSON.stringify(processedData, null, 2), 'utf8');
  console.log(`💾 JSON salvo: ${jsonDest}`);

  // 2. Gravar CSV oficial
  const csvDest = path.resolve(__dirname, '../public/hidrantes_df_oficial.csv');
  const csvContent = '\uFEFF' + Papa.unparse(processedData, { delimiter: ';' });
  fs.writeFileSync(csvDest, csvContent, 'utf8');
  console.log(`💾 CSV salvo: ${csvDest}`);

  // 3. Gravar Excel oficial (público e raiz)
  const publicDest = path.resolve(__dirname, '../public/base-de-dados.xlsx');
  const rootDest = path.resolve(__dirname, '../base-de-dados.xlsx');

  const outWb = new ExcelJS.Workbook();
  const outWs = outWb.addWorksheet('data');
  if (processedData.length > 0) {
    outWs.columns = Object.keys(processedData[0]).map(k => ({ header: k, key: k }));
    outWs.addRows(processedData);
  }

  await outWb.xlsx.writeFile(publicDest);
  console.log(`💾 Excel público salvo: ${publicDest}`);

  await outWb.xlsx.writeFile(rootDest);
  console.log(`💾 Excel raiz salvo: ${rootDest}`);

  console.log('\n================ RESUMO DA HIGIENIZAÇÃO ================');
  console.log(`Total de Hidrantes: ${processedData.length}`);
  console.log(`Hidrantes Higienizados: ${modifiedCount}`);
  console.log('Amostra de alterações (primeiras 5):');
  changes.slice(0, 5).forEach(c => {
    console.log(`- ${c.nom} (${c.cod}):`);
    c.fields.forEach(f => {
      console.log(`    [${f.field}]`);
      console.log(`    DE:   ${JSON.stringify(f.before)}`);
      console.log(`    PARA: ${JSON.stringify(f.after)}`);
    });
  });
  console.log('========================================================\n');
}

run().catch(err => {
  console.error('Erro na execução:', err);
  process.exit(1);
});
