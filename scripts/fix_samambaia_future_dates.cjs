const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const ExcelJS = require('exceljs');

const SUPABASE_URL = 'https://ixxgleaxmiffflsqaapc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_nfAn0i2h5mK-ku2LMuXTYQ_xmdWjNZm';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const baseDir = path.resolve(__dirname, '..');
const jsonPath = path.resolve(baseDir, 'public/hidrantes_df_oficial.json');
const csvPath = path.resolve(baseDir, 'public/hidrantes_df_oficial.csv');
const xlsxPublicPath = path.resolve(baseDir, 'public/base-de-dados.xlsx');
const xlsxRootPath = path.resolve(baseDir, 'base-de-dados.xlsx');

const BATCH_JUNHO = [
  'SAM00148',
  'SAM00163',
  'SAM00221',
  'SAM00229',
  'SAM00271',
  'SAM00274',
  'SAM00335',
  'SAM00336'
]; // Vistoriados em 11/06/2026 (não 06/11/2026)

const BATCH_MAIO = [
  'SAM00278',
  'SAM00279',
  'SAM00280',
  'SAM00291',
  'SAM00292',
  'SAM00293',
  'SAM00294',
  'SAM00295'
]; // Vistoriados em 12/05/2026 (não 05/12/2026)

async function fixSupabaseInspections() {
  console.log('=== 1. CORRIGINDO VISTORIAS NO SUPABASE (netuno_inspections) ===');
  
  // Junho: 2026-11-06 -> 2026-06-11T00:00:00+00:00
  for (const nom of BATCH_JUNHO) {
    const { data, error } = await supabase
      .from('netuno_inspections')
      .update({ data_hora_vistoria: '2026-06-11T00:00:00+00:00' })
      .eq('nom_hidrante', nom);
    
    if (error) {
      console.error(`❌ Erro ao atualizar ${nom} para 11/06/2026:`, error.message);
    } else {
      console.log(`✅ ${nom} atualizado no Supabase para 11/06/2026 (2026-06-11T00:00:00+00:00)`);
    }
  }

  // Maio: 2026-12-05 -> 2026-05-12T00:00:00+00:00
  for (const nom of BATCH_MAIO) {
    const { data, error } = await supabase
      .from('netuno_inspections')
      .update({ data_hora_vistoria: '2026-05-12T00:00:00+00:00' })
      .eq('nom_hidrante', nom);
    
    if (error) {
      console.error(`❌ Erro ao atualizar ${nom} para 12/05/2026:`, error.message);
    } else {
      console.log(`✅ ${nom} atualizado no Supabase para 12/05/2026 (2026-05-12T00:00:00+00:00)`);
    }
  }
}

async function fixLocalDatabases() {
  console.log('\n=== 2. HIGIENIZANDO BASE LOCAL (JSON, CSV, XLSX) ===');
  const hidrantes = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  let cleanedHistCount = 0;

  hidrantes.forEach(h => {
    const nom = h.nomHidrante || '';

    if (BATCH_JUNHO.includes(nom)) {
      h.datHoraUltimaVistoria = '11/06/2026';
      h.datHoraVistoria = '11/06/2026';
    } else if (BATCH_MAIO.includes(nom)) {
      h.datHoraUltimaVistoria = '12/05/2026';
      h.datHoraVistoria = '12/05/2026';
    }

    if (Array.isArray(h.HISTORICO_VISTORIAS)) {
      const initialLen = h.HISTORICO_VISTORIAS.length;
      // Remove entradas espúrias no futuro (novembro/dezembro 2026 que vieram de inversões)
      h.HISTORICO_VISTORIAS = h.HISTORICO_VISTORIAS.filter(v => {
        const dt = String(v.datHoraVistoria || '').trim();
        if (dt.includes('05/11/2026') || dt.includes('06/11/2026') || dt.includes('04/12/2026') || dt.includes('05/12/2026')) {
          return false;
        }
        if (nom === 'GAM00146' && dt.includes('09/11/2026')) {
          return false;
        }
        return true;
      });

      if (h.HISTORICO_VISTORIAS.length !== initialLen) {
        cleanedHistCount++;
      }
    }
  });

  console.log(`🧹 Histórico de vistorias limpo em ${cleanedHistCount} hidrantes.`);

  // 1. Salvar JSON
  fs.writeFileSync(jsonPath, JSON.stringify(hidrantes, null, 2), 'utf8');
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
  hidrantes.forEach(r => {
    const rowValues = headers.map(hdr => {
      const val = r[hdr];
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

  // 3. Salvar XLSX (public e root)
  const flatData = hidrantes.map(h => {
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

async function main() {
  await fixSupabaseInspections();
  await fixLocalDatabases();
  console.log('\n🎉 TODAS AS DATAS DE SAMAMBAIA FORAM RESTAURADAS COM SUCESSO!');
}

main().catch(err => {
  console.error('Erro na execução:', err);
  process.exit(1);
});
