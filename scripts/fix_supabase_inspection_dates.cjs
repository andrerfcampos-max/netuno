const { createClient } = require('@supabase/supabase-js');

const DEFAULT_SUPABASE_URL = 'https://ixxgleaxmiffflsqaapc.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_nfAn0i2h5mK-ku2LMuXTYQ_xmdWjNZm';

const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);

async function fixDates() {
  console.log('=== VERIFICANDO E CORRIGINDO DATAS INVERTIDAS NO SUPABASE ===');

  const { data: rows, error } = await supabase
    .from('netuno_inspections')
    .select('*');

  if (error) {
    console.error('Erro ao buscar vistorias:', error);
    return;
  }

  console.log(`Total de vistorias encontradas: ${rows.length}`);

  let updatedCount = 0;

  for (const r of rows) {
    const dt = r.data_hora_vistoria || '';
    const cr = r.created_at || '';

    let correctedDate = null;

    // Caso 1: data_hora_vistoria em ISO com mês e dia trocados em relação ao created_at
    const mDt = dt.match(/^(\d{4})-(\d{2})-(\d{2})(T.*)$/);
    const mCr = cr.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (mDt && mCr) {
      const y1 = mDt[1];
      const m1 = mDt[2];
      const d1 = mDt[3];
      const rest1 = mDt[4];

      const y2 = mCr[1];
      const m2 = mCr[2];
      const d2 = mCr[3];

      // Se m1 == d2 e d1 == m2 e m1 != d1, houve inversão clara:
      // Exemplo: salvo 2026-06-10 (mês 06, dia 10), mas criado em 2026-10-06 (mês 10, dia 06)
      if (m1 === d2 && d1 === m2 && m1 !== d1) {
        correctedDate = `${y1}-${m2}-${d2}${rest1}`;
      }
    }

    // Caso 2: Se data_hora_vistoria foi enviada como string DD/MM/AAAA (ex: "06/10/2026, ...")
    if (!correctedDate && dt.includes('/')) {
      const brM = dt.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,;\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
      if (brM) {
        const d = brM[1].padStart(2, '0');
        const m = brM[2].padStart(2, '0');
        const y = brM[3];
        const hh = (brM[4] || '12').padStart(2, '0');
        const mm = (brM[5] || '00').padStart(2, '0');
        const ss = (brM[6] || '00').padStart(2, '0');
        correctedDate = `${y}-${m}-${d}T${hh}:${mm}:${ss}+00:00`;
      }
    }

    if (correctedDate && correctedDate !== dt) {
      console.log(`[Correção] Hidrante ${r.nom_hidrante || r.cod_hidrante}:`);
      console.log(`   De:   ${dt}`);
      console.log(`   Para: ${correctedDate}`);

      const { error: updErr } = await supabase
        .from('netuno_inspections')
        .update({ data_hora_vistoria: correctedDate })
        .eq('id', r.id);

      if (updErr) {
        console.error(`   ❌ Erro ao atualizar ${r.id}:`, updErr.message);
      } else {
        updatedCount++;
      }
    }
  }

  console.log(`\n✅ Concluído! Total de vistorias corrigidas no Supabase: ${updatedCount}`);
}

fixDates();
