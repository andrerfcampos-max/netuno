const { createClient } = require('@supabase/supabase-js');

const DEFAULT_SUPABASE_URL = 'https://ixxgleaxmiffflsqaapc.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_nfAn0i2h5mK-ku2LMuXTYQ_xmdWjNZm';

const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);

const sanitizeKey = (v) => String(v || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');

const getInspectionCanonicalId = (row) => {
  const hidKey = sanitizeKey(row.nom_hidrante || row.cod_hidrante || 'HID');
  const dtKey = sanitizeKey(row.data_hora_vistoria || 'RECENT');
  return `insp_${hidKey}_${dtKey}`;
};

async function runCleanup() {
  console.log('=== INICIANDO LIMPEZA E DEDUPLICAÇÃO DE VISTORIAS NO SUPABASE ===');

  // 1. Carregar todas as vistorias de netuno_inspections
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
  console.log(`[Inspections] Total de registros atuais no banco: ${allInspections.length}`);

  // Agrupar por hidrante + data_hora_vistoria
  const inspGroups = new Map();
  allInspections.forEach(row => {
    const hid = (row.nom_hidrante || row.cod_hidrante || '').trim().toUpperCase();
    const dt = (row.data_hora_vistoria || '').trim();
    const key = `${hid}|${dt}`;
    if (!inspGroups.has(key)) inspGroups.set(key, []);
    inspGroups.get(key).push(row);
  });

  console.log(`[Inspections] Total de vistorias distintas (reais): ${inspGroups.size}`);

  const canonicalRowsToUpsert = [];
  const oldIdsToDelete = [];

  inspGroups.forEach((rows, key) => {
    // Escolhe o melhor registro para manter:
    rows.sort((a, b) => {
      if (a.foto_url && !b.foto_url) return -1;
      if (!a.foto_url && b.foto_url) return 1;
      if (a.nom_vistoriador && !b.nom_vistoriador) return -1;
      if (!a.nom_vistoriador && b.nom_vistoriador) return 1;
      return new Date(a.created_at) - new Date(b.created_at);
    });

    const bestRow = rows[0];
    const canonId = getInspectionCanonicalId(bestRow);

    canonicalRowsToUpsert.push({
      ...bestRow,
      id: canonId
    });

    rows.forEach(r => {
      if (r.id !== canonId) {
        oldIdsToDelete.push(r.id);
      }
    });
  });

  console.log(`[Inspections] Vistorias canônicas para UPSERT: ${canonicalRowsToUpsert.length}`);
  console.log(`[Inspections] Registros redundantes/antigos para DELETAR: ${oldIdsToDelete.length}`);

  // Executa upsert das canônicas em lotes de 100
  console.log('[Inspections] Gravando vistorias com IDs canônicos determinísticos...');
  for (let i = 0; i < canonicalRowsToUpsert.length; i += 100) {
    const batch = canonicalRowsToUpsert.slice(i, i + 100);
    const { error } = await supabase
      .from('netuno_inspections')
      .upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error(`Erro ao fazer upsert canônico no lote ${i}:`, error.message);
    }
  }

  // Deleta os IDs redundantes em lotes de 200
  console.log('[Inspections] Removendo cópias duplicadas do banco...');
  for (let i = 0; i < oldIdsToDelete.length; i += 200) {
    const batch = oldIdsToDelete.slice(i, i + 200);
    const { error } = await supabase
      .from('netuno_inspections')
      .delete()
      .in('id', batch);
    if (error) {
      console.error(`Erro ao deletar lote ${i}:`, error.message);
    }
  }

  // Verifica contagem final em netuno_inspections
  const { count: finalInspCount } = await supabase
    .from('netuno_inspections')
    .select('*', { count: 'exact', head: true });
  console.log(`[Inspections] Contagem final após deduplicação: ${finalInspCount} registros (esperado: ${inspGroups.size})`);

  // 2. Higienização de eventos duplicados em netuno_hydrant_mutations (type: audit_event)
  console.log('\n=== HIGIENIZANDO EVENTOS DE AUDITORIA DUPLICADOS EM netuno_hydrant_mutations ===');
  const { data: auditMutations, error: errAudit } = await supabase
    .from('netuno_hydrant_mutations')
    .select('id, payload')
    .eq('type', 'audit_event');

  if (errAudit) {
    console.error('Erro ao buscar audit_events:', errAudit.message);
  } else {
    console.log(`[Audit] Total de audit_events encontrados: ${auditMutations.length}`);
    const auditMap = new Map();
    auditMutations.forEach(m => {
      const p = m.payload || {};
      const sig = `${p.entityId || ''}|${p.timestamp || ''}|${p.action || ''}`;
      if (!auditMap.has(sig)) auditMap.set(sig, []);
      auditMap.get(sig).push(m.id);
    });

    const auditIdsToDelete = [];
    auditMap.forEach((ids, sig) => {
      if (ids.length > 1) {
        // Mantém o primeiro, deleta os excedentes
        for (let i = 1; i < ids.length; i++) {
          auditIdsToDelete.push(ids[i]);
        }
      }
    });

    console.log(`[Audit] Eventos de auditoria duplicados a deletar: ${auditIdsToDelete.length}`);
    for (let i = 0; i < auditIdsToDelete.length; i += 200) {
      const batch = auditIdsToDelete.slice(i, i + 200);
      const { error } = await supabase
        .from('netuno_hydrant_mutations')
        .delete()
        .in('id', batch);
      if (error) {
        console.error(`Erro ao deletar lote audit ${i}:`, error.message);
      }
    }
    console.log('[Audit] Limpeza de eventos de auditoria duplicados concluída.');
  }

  console.log('\n=== PROCESSO DE LIMPEZA CONCLUÍDO COM SUCESSO! ===');
}

runCleanup().catch(console.error);
