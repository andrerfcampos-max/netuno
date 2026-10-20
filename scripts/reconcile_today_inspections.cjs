const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ixxgleaxmiffflsqaapc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_nfAn0i2h5mK-ku2LMuXTYQ_xmdWjNZm';

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log('--- Buscando vistorias de hoje em netuno_inspections ---');
  const { data: insps, error } = await client
    .from('netuno_inspections')
    .select('*')
    .gte('created_at', '2026-10-20T00:00:00')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Erro ao buscar vistorias:', error);
    process.exit(1);
  }

  console.log(`Encontradas ${insps.length} vistorias hoje (20/10/2026).`);

  for (const insp of insps) {
    const cod = String(insp.nom_hidrante || insp.cod_hidrante || '').trim();
    const auditId = `audit_vistoria_${cod}_${new Date(insp.created_at).getTime()}`;
    
    // Converte data ISO para exibição brasileira
    const d = new Date(insp.data_hora_vistoria || insp.created_at);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    const hour = String(d.getUTCHours()).padStart(2, '0');
    const min = String(d.getUTCMinutes()).padStart(2, '0');
    const dtDisplay = `${day}/${month}/${year} às ${hour}:${min}`;

    const auditPayload = {
      id: auditId,
      timestamp: insp.created_at || new Date().toISOString(),
      entityType: 'vistoria',
      action: 'create',
      title: `Nova Vistoria Realizada: ${cod}`,
      entityId: cod,
      entityName: `${cod} - Águas Claras`,
      location: 'Águas Claras',
      author: {
        nome: insp.nom_vistoriador || 'Sgt Roméro',
        matricula: insp.num_matricula || '1997400',
        role: 'vistoriador'
      },
      details: `Status: ${insp.flg_ativo ? 'Operante' : 'Inoperante'}${insp.problemas_hidrante ? ' | Problemas: ' + insp.problemas_hidrante : ''}${insp.observacao ? ' | Obs: ' + insp.observacao : ''}`,
      coords: (insp.latitude && insp.longitude) ? { lat: Number(insp.latitude), lng: Number(insp.longitude) } : null,
      unread: true
    };

    const mutationRow = {
      id: auditId,
      type: 'audit_event',
      payload: auditPayload,
      updated_at: insp.created_at || new Date().toISOString()
    };

    const { error: upsertErr } = await client
      .from('netuno_hydrant_mutations')
      .upsert(mutationRow, { onConflict: 'id' });

    if (upsertErr) {
      console.error(`Erro ao criar audit_event para ${cod}:`, upsertErr.message);
    } else {
      console.log(`✅ Audit event criado com sucesso para ${cod} (${auditId})`);
    }
  }

  console.log('--- Finalizado com sucesso! ---');
}

run();
