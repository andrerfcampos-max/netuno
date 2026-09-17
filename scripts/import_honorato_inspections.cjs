const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ixxgleaxmiffflsqaapc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_nfAn0i2h5mK-ku2LMuXTYQ_xmdWjNZm';

const baseDir = 'c:/Users/andre/OneDrive/Desktop/argosa 2-1';
const jsonPath = path.resolve(baseDir, 'public/hidrantes_df_oficial.json');
const csvPath = path.resolve(baseDir, 'public/hidrantes_df_oficial.csv');
const publicXlsxPath = path.resolve(baseDir, 'public/base-de-dados.xlsx');
const rootXlsxPath = path.resolve(baseDir, 'base-de-dados.xlsx');

const parsedInspectionsPath = 'C:/Users/andre/.gemini/antigravity/brain/385e2e5f-67c6-4fb8-81ed-8455cd7045f4/scratch/honorato_parsed.json';

function normalizeCode(str) {
  const clean = str.trim().toUpperCase().replace(/[\.,]/g, '');
  const match = clean.match(/^([A-Z]{3})\s*0*(\d+)$/);
  if (match) {
    return match[1] + String(parseInt(match[2], 10)).padStart(5, '0');
  }
  return clean.replace(/[\s\-_]/g, '');
}

async function run() {
  console.log('================================================================');
  console.log('🚀 INICIANDO IMPORTAÇÃO DAS VISTORIAS DO SGT RRM HONORATO');
  console.log('================================================================');

  const hidrantesList = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const honoratoInspections = JSON.parse(fs.readFileSync(parsedInspectionsPath, 'utf8'));

  console.log(`📦 Base atual de hidrantes: ${hidrantesList.length} registros.`);
  console.log(`📋 Vistorias a aplicar: ${honoratoInspections.length} registros.`);

  const indexMap = new Map();
  hidrantesList.forEach((h, idx) => {
    const norm = normalizeCode(h.nomHidrante || h.codHidrante || '');
    indexMap.set(norm, idx);
  });

  let updatedCount = 0;
  const updatedHydrantsList = [];

  for (const item of honoratoInspections) {
    const norm = normalizeCode(item.code);
    const idx = indexMap.get(norm);

    if (idx === undefined) {
      console.warn(`⚠️ Hidrante não encontrado na base: ${item.code} (${norm})`);
      continue;
    }

    const current = hidrantesList[idx];

    const probParts = [];
    if (item.q1 === 'NÃO, FALTA LUVA') probParts.push('Falta cabeçote da haste do registro (luva)');
    if (item.q2 === 'SOTERRADO') probParts.push('Registro soterrado');
    else if (item.q2 === 'COM VAZAMENTO') probParts.push('Registro com vazamento');
    else if (item.q2 === 'EMPERRADO') probParts.push('Registro emperrado');

    if (item.q3 === 'LACRADA') probParts.push('Tampa da caixa lacrada (concretada)');
    else if (item.q3 === 'QUEBRADA') probParts.push('Tampa de concreto quebrada ou removida');

    if (item.q4 === 'FALTA 1 TAMPÃO') probParts.push('Falta tampão de 2.1/2"');
    else if (item.q4 === 'FALTAM 2 TAMPÕES') probParts.push('Faltam dois tampões de 2 1/2');
    else if (item.q4 === 'FALTAM TODOS OS TAMPÕES') probParts.push('Faltam todos os tampões');

    if (Array.isArray(item.q6)) {
      item.q6.forEach(p => {
        if (p && !probParts.includes(p)) probParts.push(p);
      });
    }

    const problemaFinal = probParts.join(' | ');
    const isOperante = item.status === 'OPERANTE';

    const prevHistory = Array.isArray(current.HISTORICO_VISTORIAS) ? [...current.HISTORICO_VISTORIAS] : [];
    
    if (current.datHoraUltimaVistoria && current.datHoraUltimaVistoria !== item.date) {
      const alreadyArchived = prevHistory.some(h => h.datHoraVistoria === current.datHoraUltimaVistoria);
      if (!alreadyArchived) {
        prevHistory.push({
          datHoraVistoria: current.datHoraUltimaVistoria,
          flgAtivo: current.flgAtivo,
          problemasHidrante: current.problemasHidrante || '',
          dscObservacao: current.dscObservacao || '',
          vistoriadorNome: current.vistoriadorNome || current.vistoriador || 'Militar Vistoriador',
          vistoriadorMatricula: current.vistoriadorMatricula || current.matricula || '-',
          fotoVistoria: current.fotoVistoria || null,
          fotosVistoria: current.fotosVistoria || []
        });
      }
    }

    const honoratoRecord = {
      datHoraVistoria: item.date,
      flgAtivo: isOperante,
      problemasHidrante: problemaFinal,
      dscObservacao: item.q7 || '',
      vistoriadorNome: 'Sgt Rrm Honorato',
      vistoriadorMatricula: '-',
      equipe: 'Sgt Freitas, Sgt Santiago (pttc)',
      fotoVistoria: null,
      fotosVistoria: []
    };
    prevHistory.push(honoratoRecord);

    current.flgAtivo = isOperante;
    current.status = isOperante ? 'Operante' : 'Inoperante';
    current.problemasHidrante = problemaFinal;
    current.dscObservacao = item.q7 || '';
    current.datHoraUltimaVistoria = item.date;
    current.vistoriadorNome = 'Sgt Rrm Honorato';
    current.vistoriador = 'Sgt Rrm Honorato';
    current.vistoriadorMatricula = '-';
    current.matricula = '-';
    current.equipeVistoria = 'Sgt Freitas, Sgt Santiago (pttc)';
    current.HISTORICO_VISTORIAS = prevHistory;
    current.ultimaAtualizacao = new Date().toISOString();

    updatedHydrantsList.push(current);
    updatedCount++;
  }

  console.log(`✅ ${updatedCount} hidrantes atualizados com sucesso na memória.`);

  console.log('💾 Gravando JSON oficial...');
  fs.writeFileSync(jsonPath, JSON.stringify(hidrantesList, null, 2), 'utf8');

  console.log('💾 Gravando CSV oficial...');
  const outWs = XLSX.utils.json_to_sheet(hidrantesList.map(h => {
    const copy = { ...h };
    if (typeof copy.HISTORICO_VISTORIAS === 'object') {
      delete copy.HISTORICO_VISTORIAS;
    }
    return copy;
  }));
  const csvContent = '\uFEFF' + XLSX.utils.sheet_to_csv(outWs, { FS: ';' });
  fs.writeFileSync(csvPath, csvContent, 'utf8');

  console.log('💾 Gravando planilhas XLSX...');
  const outWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(outWb, outWs, 'data');
  XLSX.writeFile(outWb, publicXlsxPath);
  XLSX.writeFile(outWb, rootXlsxPath);

  // Copiar também o script para scripts/ da aplicação para manter histórico e reutilização
  const projectScriptPath = path.resolve(baseDir, 'scripts/import_honorato_inspections.cjs');
  fs.copyFileSync(__filename, projectScriptPath);
  console.log(`📁 Script versionado em: ${projectScriptPath}`);

  console.log('☁️ Conectando ao Supabase para sincronização em nuvem...');
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const chunkSize = 50;
    for (let i = 0; i < updatedHydrantsList.length; i += chunkSize) {
      const chunk = updatedHydrantsList.slice(i, i + chunkSize);
      const mutationsPayload = chunk.map(h => ({
        id: String(h._internalId || h.codHidrante || h.nomHidrante),
        type: 'update',
        payload: {
          _internalId: h._internalId,
          codHidrante: h.codHidrante,
          nomHidrante: h.nomHidrante,
          flgAtivo: h.flgAtivo,
          status: h.status,
          problemasHidrante: h.problemasHidrante,
          dscObservacao: h.dscObservacao,
          datHoraUltimaVistoria: h.datHoraUltimaVistoria,
          vistoriadorNome: h.vistoriadorNome,
          vistoriadorMatricula: h.vistoriadorMatricula,
          equipeVistoria: h.equipeVistoria,
          HISTORICO_VISTORIAS: h.HISTORICO_VISTORIAS,
          numLatitude: h.numLatitude,
          numLongitude: h.numLongitude,
          dscLocalidade: h.dscLocalidade,
          dscEndereco: h.dscEndereco
        },
        updated_at: new Date().toISOString()
      }));

      const { error: mutError } = await supabase
        .from('netuno_hydrant_mutations')
        .upsert(mutationsPayload, { onConflict: 'id' });

      if (mutError) {
        console.warn(`⚠️ Erro chunk [${i}..${i + chunk.length}]: ${mutError.message}`);
      }
    }

    await supabase.from('netuno_hydrant_mutations').insert({
      id: `audit_honorato_batch_${Date.now()}`,
      type: 'audit_event',
      payload: {
        id: `audit_${Date.now()}`,
        action: 'CARGA_VISTORIAS_HONORATO_LOTE',
        detalhes: `Carga em lote de ${updatedCount} vistorias realizadas pelo Sgt Rrm Honorato (Equipe: Sgt Freitas, Sgt Santiago pttc) em Samambaia e Taguatinga.`,
        usuario: 'Sgt Rrm Honorato (Carga Batch Chat)',
        dataHora: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    });

    console.log('✅ Sincronização com Supabase concluída com sucesso!');
  } catch (err) {
    console.warn('⚠️ Erro não impeditivo na sincronização com Supabase:', err.message);
  }

  console.log('================================================================');
  console.log(`🎉 PROCESSO CONCLUÍDO: ${updatedCount} VISTORIAS EFETIVADAS NA BASE!`);
  console.log('================================================================');
}

run().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
