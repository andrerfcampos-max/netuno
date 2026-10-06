const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const DEFAULT_SUPABASE_URL = 'https://ixxgleaxmiffflsqaapc.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_nfAn0i2h5mK-ku2LMuXTYQ_xmdWjNZm';

const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);

const JSON_PATH = path.join(__dirname, '..', 'public', 'hidrantes_df_oficial.json');

async function main() {
  console.log('=== INICIANDO RECONCILIAÇÃO GERAL DE VISTORIAS E HISTÓRICO ===');

  // 1. Carregar hidrantes atuais
  const currentList = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  console.log(`[1] Total de hidrantes no JSON atual: ${currentList.length}`);

  // 2. Recuperar HISTORICO_VISTORIAS que estava no commit 078f5ef~1
  console.log('[2] Recuperando dados históricos do git antes do commit 078f5ef...');
  let prevList = [];
  try {
    const rawPrev = execSync('git show 078f5ef~1:public/hidrantes_df_oficial.json', { 
      maxBuffer: 50 * 1024 * 1024,
      cwd: path.join(__dirname, '..')
    });
    prevList = JSON.parse(rawPrev);
    console.log(`    Recuperados ${prevList.length} hidrantes do commit anterior.`);
  } catch (err) {
    console.warn('    Não foi possível ler git anterior:', err.message);
  }

  const prevMap = new Map();
  prevList.forEach(h => {
    const key = (h.nomHidrante || h.codHidrante || h._internalId || '').trim().toUpperCase();
    if (key) prevMap.set(key, h);
    if (h._internalId) prevMap.set(String(h._internalId).trim().toUpperCase(), h);
    if (h.codHidrante) prevMap.set(String(h.codHidrante).trim().toUpperCase(), h);
  });

  let restoredHistCount = 0;
  currentList.forEach(h => {
    const key = (h.nomHidrante || h.codHidrante || h._internalId || '').trim().toUpperCase();
    const prev = prevMap.get(key) || (h._internalId ? prevMap.get(String(h._internalId).toUpperCase()) : null);
    if (prev) {
      if (Array.isArray(prev.HISTORICO_VISTORIAS) && prev.HISTORICO_VISTORIAS.length > 0) {
        if (!h.HISTORICO_VISTORIAS || h.HISTORICO_VISTORIAS.length === 0) {
          h.HISTORICO_VISTORIAS = prev.HISTORICO_VISTORIAS;
          restoredHistCount++;
        }
      }
      if (prev.vistoriador && !h.vistoriador) h.vistoriador = prev.vistoriador;
      if (prev.vistoriadorMatricula && !h.vistoriadorMatricula) h.vistoriadorMatricula = prev.vistoriadorMatricula;
      if (prev.matricula && !h.matricula) h.matricula = prev.matricula;
      if (prev.equipeVistoria && !h.equipeVistoria) h.equipeVistoria = prev.equipeVistoria;
      if (prev.ultimaAtualizacao && !h.ultimaAtualizacao) h.ultimaAtualizacao = prev.ultimaAtualizacao;
    }
  });
  console.log(`[2] HISTORICO_VISTORIAS restaurado em ${restoredHistCount} hidrantes que haviam sido limpos.`);

  // 3. Buscar todas as vistorias de netuno_inspections no Supabase
  console.log('[3] Buscando vistorias de netuno_inspections no Supabase...');
  let allInspections = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('netuno_inspections')
      .select('*')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error || !data || data.length === 0) break;
    allInspections = allInspections.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  console.log(`    Total de vistorias em netuno_inspections: ${allInspections.length}`);

  // Ordenar cronologicamente crescente para construir histórico
  allInspections.sort((a, b) => new Date(a.data_hora_vistoria || 0) - new Date(b.data_hora_vistoria || 0));

  // Mapa de hidrantes atuais por vários identificadores
  const currentById = new Map();
  currentList.forEach((h, index) => {
    if (h.nomHidrante) currentById.set(String(h.nomHidrante).trim().toUpperCase(), index);
    if (h.codHidrante) currentById.set(String(h.codHidrante).trim().toUpperCase(), index);
    if (h.codLegado) currentById.set(String(h.codLegado).trim().toUpperCase(), index);
    if (h._internalId) currentById.set(String(h._internalId).trim().toUpperCase(), index);
  });

  let appliedInspectionsCount = 0;
  allInspections.forEach(insp => {
    const nom = (insp.nom_hidrante || '').trim().toUpperCase();
    const cod = (insp.cod_hidrante || '').trim().toUpperCase();
    const idx = currentById.get(nom) !== undefined ? currentById.get(nom) : currentById.get(cod);

    if (idx !== undefined) {
      const h = currentList[idx];
      appliedInspectionsCount++;

      // Formatar data amigável (DD/MM/AAAA HH:mm:ss) de forma determinística
      let dtStr = insp.data_hora_vistoria;
      const isoM = String(insp.data_hora_vistoria || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
      if (isoM) {
        dtStr = `${isoM[3]}/${isoM[2]}/${isoM[1]} ${isoM[4] || '00'}:${isoM[5] || '00'}:${isoM[6] || '00'}`;
      }

      // Atualizar dados principais da vistoria mais recente
      h.datHoraUltimaVistoria = dtStr;
      h.datHoraVistoria = dtStr;
      h.vistoriadorNome = insp.nom_vistoriador || h.vistoriadorNome;
      h.vistoriador = insp.nom_vistoriador || h.vistoriador;
      h.vistoriadorMatricula = insp.num_matricula || h.vistoriadorMatricula;
      h.flgAtivo = Boolean(insp.flg_ativo);
      h.status = insp.flg_ativo ? 'Operante' : 'Inoperante';
      h.problemasHidrante = insp.problemas_hidrante || '';
      h.dscObservacao = insp.observacao || h.dscObservacao || '';
      if (insp.foto_url) {
        h.fotoVistoria = insp.foto_url;
      }

      // Adicionar ou mesclar no HISTORICO_VISTORIAS
      if (!Array.isArray(h.HISTORICO_VISTORIAS)) {
        h.HISTORICO_VISTORIAS = [];
      }

      const vistoriaEntry = {
        datHoraVistoria: dtStr,
        flgAtivo: Boolean(insp.flg_ativo),
        problemasHidrante: insp.problemas_hidrante || '',
        dscObservacao: insp.observacao || '',
        vistoriadorNome: insp.nom_vistoriador || 'Militar Vistoriador',
        vistoriadorMatricula: insp.num_matricula || '-',
        fotoVistoria: insp.foto_url || null,
        fotosVistoria: insp.foto_url ? [insp.foto_url] : []
      };

      // Verificar se já existe no histórico com data similar
      const exists = h.HISTORICO_VISTORIAS.some(entry => {
        const dtA = String(entry.datHoraVistoria || '').replace(/[^0-9]/g, '');
        const dtB = String(dtStr || '').replace(/[^0-9]/g, '');
        return dtA && dtB && (dtA.includes(dtB.slice(0, 8)) || dtB.includes(dtA.slice(0, 8)));
      });

      if (!exists) {
        h.HISTORICO_VISTORIAS.push(vistoriaEntry);
      }
    }
  });

  console.log(`[3] Vistorias sincronizadas para hidrantes: ${appliedInspectionsCount} processadas.`);

  // 4. Também mesclar mutações de 'update' do netuno_hydrant_mutations
  console.log('[4] Verificando mutações adicionais em netuno_hydrant_mutations...');
  const { data: updateMutations } = await supabase
    .from('netuno_hydrant_mutations')
    .select('payload')
    .eq('type', 'update');

  if (Array.isArray(updateMutations)) {
    let mutCount = 0;
    updateMutations.forEach(m => {
      const p = m.payload;
      if (!p) return;
      const nom = (p.nomHidrante || '').trim().toUpperCase();
      const cod = (p.codHidrante || '').trim().toUpperCase();
      const internalId = (p._internalId || '').trim().toUpperCase();
      const idx = currentById.get(nom) !== undefined ? currentById.get(nom) : 
                 (currentById.get(cod) !== undefined ? currentById.get(cod) : currentById.get(internalId));

      if (idx !== undefined) {
        const h = currentList[idx];
        if (p.datHoraUltimaVistoria) {
          h.datHoraUltimaVistoria = p.datHoraUltimaVistoria;
          h.datHoraVistoria = p.datHoraUltimaVistoria;
        }
        if (p.vistoriadorNome) h.vistoriadorNome = p.vistoriadorNome;
        if (p.vistoriadorMatricula) h.vistoriadorMatricula = p.vistoriadorMatricula;
        if (p.problemasHidrante !== undefined) h.problemasHidrante = p.problemasHidrante;
        if (p.flgAtivo !== undefined) {
          h.flgAtivo = p.flgAtivo;
          h.status = p.flgAtivo ? 'Operante' : 'Inoperante';
        }
        if (Array.isArray(p.HISTORICO_VISTORIAS) && p.HISTORICO_VISTORIAS.length > 0) {
          if (!Array.isArray(h.HISTORICO_VISTORIAS)) h.HISTORICO_VISTORIAS = [];
          p.HISTORICO_VISTORIAS.forEach(entry => {
            const hasEntry = h.HISTORICO_VISTORIAS.some(e => e.datHoraVistoria === entry.datHoraVistoria);
            if (!hasEntry) h.HISTORICO_VISTORIAS.push(entry);
          });
        }
        mutCount++;
      }
    });
    console.log(`    Mutações de atualização aplicadas: ${mutCount}`);
  }

  // 5. Salvar JSON oficial
  console.log('[5] Gravando public/hidrantes_df_oficial.json atualizado...');
  fs.writeFileSync(JSON_PATH, JSON.stringify(currentList, null, 2), 'utf8');

  // 6. Atualizar CSV oficial
  console.log('[6] Atualizando public/hidrantes_df_oficial.csv...');
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
  currentList.forEach(r => {
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
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'hidrantes_df_oficial.csv'), csvRows.join('\n'), 'utf8');

  // 7. Atualizar planilhas XLSX
  console.log('[7] Sincronizando planilhas XLSX...');
  try {
    const xlsx = require('xlsx');
    const flatForExcel = currentList.map(h => {
      const copy = { ...h };
      delete copy.HISTORICO_VISTORIAS;
      if (copy.fotoVistoria && copy.fotoVistoria.length > 1000) {
        copy.fotoVistoria = '[FOTO SALVA NA NUVEM]';
      }
      delete copy.fotosVistoria;
      return copy;
    });
    const sheet = xlsx.utils.json_to_sheet(flatForExcel);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, sheet, 'hidrantes');
    xlsx.writeFile(wb, path.join(__dirname, '..', 'public', 'base-de-dados.xlsx'));
    xlsx.writeFile(wb, path.join(__dirname, '..', 'base-de-dados.xlsx'));
    console.log('    Planilhas XLSX atualizadas com sucesso.');
  } catch (errXlsx) {
    console.warn('    Aviso ao atualizar XLSX:', errXlsx.message);
  }

  // 8. Resumo final
  const finalWithHist = currentList.filter(h => Array.isArray(h.HISTORICO_VISTORIAS) && h.HISTORICO_VISTORIAS.length > 0);
  const lagoSulInspected = currentList.filter(h => (h.nomHidrante && h.nomHidrante.startsWith('LAS')) && h.datHoraUltimaVistoria && h.datHoraUltimaVistoria !== '18/06/2025 12:00:00');

  console.log('\n=== RECONCILIAÇÃO CONCLUÍDA COM SUCESSO! ===');
  console.log(`✅ Hidrantes com HISTORICO_VISTORIAS na base oficial: ${finalWithHist.length}`);
  console.log(`✅ Hidrantes do Lago Sul com vistorias recentes ativas: ${lagoSulInspected.length}`);
  console.log('============================================\n');
}

main().catch(console.error);
