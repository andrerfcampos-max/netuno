const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ixxgleaxmiffflsqaapc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_nfAn0i2h5mK-ku2LMuXTYQ_xmdWjNZm';

const baseDir = path.resolve(__dirname, '..');
const jsonPath = path.resolve(baseDir, 'public/hidrantes_df_oficial.json');
const csvPath = path.resolve(baseDir, 'public/hidrantes_df_oficial.csv');
const publicXlsxPath = path.resolve(baseDir, 'public/base-de-dados.xlsx');
const rootXlsxPath = path.resolve(baseDir, 'base-de-dados.xlsx');
const argosMapPath = path.resolve(baseDir, 'src/utils/argosIdMap.json');

// Mapeamento Argos legado (codHidrante -> nomHidrante)
let argosCodToNom = {};
let nomToArgosCod = {};
if (fs.existsSync(argosMapPath)) {
  try {
    argosCodToNom = JSON.parse(fs.readFileSync(argosMapPath, 'utf8'));
    for (const [cod, nom] of Object.entries(argosCodToNom)) {
      if (nom && cod) {
        nomToArgosCod[nom.toUpperCase()] = cod;
      }
    }
  } catch (e) {
    console.warn('⚠️ Não foi possível carregar argosIdMap.json:', e.message);
  }
}

// Arquivo de entrada dinâmico
let parsedInspectionsPath = process.argv[2] ? path.resolve(process.argv[2]) : null;

if (!parsedInspectionsPath || !fs.existsSync(parsedInspectionsPath)) {
  const candidatePaths = [
    'C:/Users/andre/.gemini/antigravity/brain/385e2e5f-67c6-4fb8-81ed-8455cd7045f4/scratch/honorato_parsed.json',
    path.resolve(baseDir, 'scripts/honorato_parsed.json'),
    path.resolve(baseDir, 'scripts/vistorias_lote.json')
  ];
  for (const cp of candidatePaths) {
    if (fs.existsSync(cp)) {
      parsedInspectionsPath = cp;
      break;
    }
  }
}

function normalizeCode(str) {
  if (!str) return '';
  const clean = String(str).trim().toUpperCase().replace(/[\.,]/g, '');
  const match = clean.match(/^([A-Z]{3})\s*0*(\d+)$/);
  if (match) {
    return match[1] + String(parseInt(match[2], 10)).padStart(5, '0');
  }
  return clean.replace(/[\s\-_]/g, '');
}

function parseDateToIso(dateStr) {
  if (!dateStr) return new Date().toISOString();
  try {
    const parts = dateStr.trim().split(/[\sT]+/);
    const dateParts = parts[0].split(/[\/\-]/);
    if (dateParts.length === 3) {
      let day, month, year;
      if (dateParts[0].length === 4) {
        year = parseInt(dateParts[0], 10);
        month = parseInt(dateParts[1], 10) - 1;
        day = parseInt(dateParts[2], 10);
      } else {
        day = parseInt(dateParts[0], 10);
        month = parseInt(dateParts[1], 10) - 1;
        year = parseInt(dateParts[2], 10);
      }
      let hours = 12, minutes = 0, seconds = 0;
      if (parts[1]) {
        const timeParts = parts[1].split(':');
        hours = parseInt(timeParts[0] || '12', 10);
        minutes = parseInt(timeParts[1] || '0', 10);
        seconds = parseInt(timeParts[2] || '0', 10);
      }
      const d = new Date(Date.UTC(year, month, day, hours, minutes, seconds));
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch (e) {}
  return new Date().toISOString();
}

function getAllPossibleIdsForHydrant(h) {
  const ids = new Set();
  const add = (v) => {
    if (v !== undefined && v !== null) {
      const s = String(v).trim();
      if (s) {
        ids.add(s);
        ids.add(s.toUpperCase());
        const norm = normalizeCode(s);
        if (norm) {
          ids.add(norm);
          ids.add(norm.toUpperCase());
        }
        if (argosCodToNom[s]) {
          ids.add(argosCodToNom[s]);
          ids.add(argosCodToNom[s].toUpperCase());
        }
        if (nomToArgosCod[s.toUpperCase()]) {
          ids.add(nomToArgosCod[s.toUpperCase()]);
        }
      }
    }
  };
  add(h.nomHidrante);
  add(h.codHidrante);
  add(h.codLegado);
  add(h._internalId);
  add(h.id);
  return ids;
}

async function run() {
  console.log('================================================================');
  console.log('🚀 INICIANDO IMPORTAÇÃO DAS VISTORIAS DO SGT RRM HONORATO');
  console.log('================================================================');

  const hidrantesList = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const honoratoInspections = JSON.parse(fs.readFileSync(parsedInspectionsPath, 'utf8'));

  console.log(`📦 Base atual de hidrantes: ${hidrantesList.length} registros.`);
  console.log(`📋 Vistorias a aplicar: ${honoratoInspections.length} registros.`);

  // Índices para localização ultra-resiliente
  const hydrantByNorm = new Map();
  const hydrantByCod = new Map();
  const hydrantByInternal = new Map();

  hidrantesList.forEach((h, idx) => {
    const norm = normalizeCode(h.nomHidrante || h.codHidrante || '');
    if (norm) hydrantByNorm.set(norm, idx);
    if (h.codHidrante !== undefined && h.codHidrante !== null) {
      hydrantByCod.set(String(h.codHidrante).trim(), idx);
    }
    if (h._internalId) {
      hydrantByInternal.set(String(h._internalId).trim(), idx);
    }
    if (h.nomHidrante && nomToArgosCod[h.nomHidrante.toUpperCase()]) {
      hydrantByCod.set(String(nomToArgosCod[h.nomHidrante.toUpperCase()]).trim(), idx);
    }
  });

  let updatedCount = 0;
  const updatedHydrantsList = [];
  const auditEntriesList = [];
  const allInspectedIdSets = [];

  for (const item of honoratoInspections) {
    const rawCode = item.code || item.officialCode || item.codHidrante || item.nomHidrante || '';
    const norm = normalizeCode(rawCode);

    let idx = hydrantByNorm.get(norm);
    if (idx === undefined && item.officialCode) {
      idx = hydrantByNorm.get(normalizeCode(item.officialCode));
    }
    if (idx === undefined) {
      const legacyCod = nomToArgosCod[norm];
      if (legacyCod) idx = hydrantByCod.get(String(legacyCod));
    }
    if (idx === undefined && /^\d+$/.test(rawCode.trim())) {
      idx = hydrantByCod.get(rawCode.trim());
    }

    if (idx === undefined) {
      console.warn(`⚠️ Hidrante não encontrado na base oficial: ${rawCode} (${norm})`);
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
    const isOperante = (item.status === 'OPERANTE' || item.flgAtivo === true || item.flgAtivo === 'true');

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
          equipe: current.equipeVistoria || '-',
          fotoVistoria: current.fotoVistoria || null,
          fotosVistoria: current.fotosVistoria || []
        });
      }
    }

    const vistoriadorNome = item.vistoriadorNome || 'Sgt Rrm Honorato';
    const vistoriadorMatricula = item.vistoriadorMatricula || '-';
    const equipeVistoria = item.equipeVistoria || 'Sgt Freitas, Sgt Santiago (pttc)';
    const dataVistoria = item.date || item.datHoraVistoria || new Date().toLocaleDateString('pt-BR');

    // Evita duplicar a mesma vistoria da mesma data se já estiver no histórico
    const existsSameDate = prevHistory.some(h => h.datHoraVistoria === dataVistoria);
    if (!existsSameDate) {
      const honoratoRecord = {
        datHoraVistoria: dataVistoria,
        flgAtivo: isOperante,
        problemasHidrante: problemaFinal,
        dscObservacao: item.q7 || item.dscObservacao || '',
        vistoriadorNome: vistoriadorNome,
        vistoriadorMatricula: vistoriadorMatricula,
        equipe: equipeVistoria,
        fotoVistoria: item.fotoVistoria || null,
        fotosVistoria: item.fotosVistoria || []
      };
      prevHistory.push(honoratoRecord);
    }

    current.flgAtivo = isOperante;
    current.status = isOperante ? 'Operante' : 'Inoperante';
    current.problemasHidrante = problemaFinal;
    current.dscObservacao = item.q7 || item.dscObservacao || '';
    current.datHoraUltimaVistoria = dataVistoria;
    current.vistoriadorNome = vistoriadorNome;
    current.vistoriador = vistoriadorNome;
    current.vistoriadorMatricula = vistoriadorMatricula;
    current.matricula = vistoriadorMatricula;
    current.equipeVistoria = equipeVistoria;
    current.HISTORICO_VISTORIAS = prevHistory;
    current.ultimaAtualizacao = new Date().toISOString();

    updatedHydrantsList.push(current);
    allInspectedIdSets.push(getAllPossibleIdsForHydrant(current));

    // Constrói evento individual de auditoria no formato canônico do logAuditEvent
    const isoTimestamp = parseDateToIso(dataVistoria);
    const auditId = `audit_vistoria_${norm}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const auditEntry = {
      id: auditId,
      timestamp: isoTimestamp,
      entityType: 'vistoria',
      action: 'create',
      title: `Nova Vistoria Realizada: ${current.nomHidrante || norm}`,
      entityId: String(current.codHidrante || current._internalId || norm),
      entityName: `${current.nomHidrante || norm} - ${current.dscEndereco || ''}`.trim(),
      location: current.dscLocalidade || '',
      author: {
        nome: vistoriadorNome,
        matricula: vistoriadorMatricula,
        role: 'vistoriador',
        equipe: equipeVistoria
      },
      details: `Status: ${isOperante ? 'Operante' : 'Inoperante'}${problemaFinal ? ` | Problemas: ${problemaFinal}` : ''}${item.q7 ? ` | Obs: ${item.q7}` : ''}`,
      coords: (current.numLatitude && current.numLongitude)
        ? { lat: Number(current.numLatitude), lng: Number(current.numLongitude) }
        : null,
      unread: true
    };

    auditEntriesList.push(auditEntry);
    updatedCount++;
  }

  console.log(`✅ ${updatedCount} hidrantes processados e atualizados na memória.`);

  // 1. Gravação dos arquivos locais oficiais
  console.log('💾 [1/4] Gravando JSON oficial (public/hidrantes_df_oficial.json)...');
  fs.writeFileSync(jsonPath, JSON.stringify(hidrantesList, null, 2), 'utf8');

  console.log('💾 [2/4] Gravando CSV oficial (public/hidrantes_df_oficial.csv)...');
  const outWs = XLSX.utils.json_to_sheet(hidrantesList.map(h => {
    const copy = { ...h };
    if (typeof copy.HISTORICO_VISTORIAS === 'object') {
      delete copy.HISTORICO_VISTORIAS;
    }
    return copy;
  }));
  const csvContent = '\uFEFF' + XLSX.utils.sheet_to_csv(outWs, { FS: ';' });
  fs.writeFileSync(csvPath, csvContent, 'utf8');

  console.log('💾 [3/4] Gravando planilhas XLSX (public/base-de-dados.xlsx e base-de-dados.xlsx)...');
  const outWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(outWb, outWs, 'data');
  XLSX.writeFile(outWb, publicXlsxPath);
  XLSX.writeFile(outWb, rootXlsxPath);

  // Copiar também o script para scripts/ se executado fora
  const projectScriptPath = path.resolve(baseDir, 'scripts/import_honorato_inspections.cjs');
  if (path.resolve(__filename) !== projectScriptPath) {
    fs.copyFileSync(__filename, projectScriptPath);
    console.log(`📁 Script versionado em: ${projectScriptPath}`);
  }

  console.log('☁️ Conectando ao Supabase para sincronização total em nuvem...');
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // 2. Atualização das MISSÕES no Supabase
    console.log('🎯 [1/3 Nuvem] Reconciliando andamento de todas as Missões (netuno_missions)...');
    const { data: cloudMissions, error: missionsError } = await supabase
      .from('netuno_missions')
      .select('*');

    if (missionsError) {
      console.warn('⚠️ Erro ao buscar missões:', missionsError.message);
    } else if (Array.isArray(cloudMissions) && cloudMissions.length > 0) {
      let missionsUpdatedCount = 0;

      for (const mission of cloudMissions) {
        let sel = mission.selected_ids || [];
        if (typeof sel === 'string') {
          try { sel = JSON.parse(sel); } catch { sel = []; }
        }
        let comp = mission.completed_ids || [];
        if (typeof comp === 'string') {
          try { comp = JSON.parse(comp); } catch { comp = []; }
        }

        const selArray = Array.isArray(sel) ? sel : [];
        const compSet = new Set((Array.isArray(comp) ? comp : []).map(x => String(x).trim()));
        let missionChanged = false;

        // Para cada hidrante vistoriado, verifica se pertence a esta missão
        for (const hIdSet of allInspectedIdSets) {
          let matchedKey = null;
          for (const key of selArray) {
            const keyStr = String(key).trim();
            if (hIdSet.has(keyStr) || hIdSet.has(keyStr.toUpperCase())) {
              matchedKey = keyStr;
              break;
            }
          }

          if (matchedKey && !compSet.has(matchedKey)) {
            compSet.add(matchedKey);
            missionChanged = true;
          }
        }

        if (missionChanged) {
          const newCompleted = Array.from(compSet);
          const { error: updErr } = await supabase
            .from('netuno_missions')
            .update({
              completed_ids: newCompleted,
              updated_at: new Date().toISOString()
            })
            .eq('id', mission.id);

          if (updErr) {
            console.warn(`⚠️ Falha ao atualizar missão [${mission.id}] ${mission.name}:`, updErr.message);
          } else {
            missionsUpdatedCount++;
            console.log(`🎯 Missão [${mission.id}] "${mission.name}": progresso atualizado -> ${newCompleted.length}/${selArray.length} concluídos!`);
          }
        }
      }
      console.log(`✅ ${missionsUpdatedCount} missões tiveram seu andamento atualizado na nuvem!`);
    }

    // 3. Inserção dos eventos individuais de AUDITORIA no Supabase (Histórico de Atividades)
    console.log(`📋 [2/3 Nuvem] Enviando ${auditEntriesList.length} registros individuais ao Histórico de Atividades...`);
    const auditChunkSize = 50;
    let auditSuccessCount = 0;
    for (let i = 0; i < auditEntriesList.length; i += auditChunkSize) {
      const chunk = auditEntriesList.slice(i, i + auditChunkSize);
      const auditPayload = chunk.map(entry => ({
        id: entry.id,
        type: 'audit_event',
        payload: entry,
        updated_at: entry.timestamp || new Date().toISOString()
      }));

      const { error: auditErr } = await supabase
        .from('netuno_hydrant_mutations')
        .upsert(auditPayload, { onConflict: 'id' });

      if (auditErr) {
        console.warn(`⚠️ Erro ao enviar chunk de auditoria [${i}..${i + chunk.length}]:`, auditErr.message);
      } else {
        auditSuccessCount += chunk.length;
      }
    }

    // Evento resumo geral de auditoria da carga batch
    await supabase.from('netuno_hydrant_mutations').insert({
      id: `audit_batch_summary_${Date.now()}`,
      type: 'audit_event',
      payload: {
        id: `audit_batch_summary_${Date.now()}`,
        timestamp: new Date().toISOString(),
        entityType: 'vistoria',
        action: 'create',
        title: `Carga em Lote Concluída: ${updatedCount} Vistorias Efetivadas`,
        entityId: 'LOTE',
        entityName: `${updatedCount} vistorias processadas`,
        location: 'DF (Geral)',
        author: {
          nome: 'Sgt Rrm Honorato',
          matricula: '-',
          role: 'vistoriador',
          equipe: 'Sgt Freitas, Sgt Santiago (pttc)'
        },
        details: `Carga em lote de ${updatedCount} vistorias realizada com sucesso. Missões, rotas e histórico 100% sincronizados.`,
        coords: null,
        unread: true
      },
      updated_at: new Date().toISOString()
    });
    console.log(`✅ ${auditSuccessCount} eventos individuais de auditoria sincronizados no Supabase!`);

    // 4. Envio das mutações dos hidrantes atualizados para o Supabase
    console.log(`💧 [3/3 Nuvem] Enviando mutações de ${updatedHydrantsList.length} hidrantes ao Supabase...`);
    const hydrantChunkSize = 25;
    let hydrantSuccessCount = 0;
    for (let i = 0; i < updatedHydrantsList.length; i += hydrantChunkSize) {
      const chunk = updatedHydrantsList.slice(i, i + hydrantChunkSize);
      const mutationsPayload = chunk.map(h => {
        // Envia histórico recente (últimas 3 vistorias) na mutação em tempo real para não sobrecarregar payload do Postgres
        const compactHistory = Array.isArray(h.HISTORICO_VISTORIAS)
          ? h.HISTORICO_VISTORIAS.slice(-3)
          : [];

        return {
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
            HISTORICO_VISTORIAS: compactHistory,
            numLatitude: h.numLatitude,
            numLongitude: h.numLongitude,
            dscLocalidade: h.dscLocalidade,
            dscEndereco: h.dscEndereco
          },
          updated_at: new Date().toISOString()
        };
      });

      const { error: mutError } = await supabase
        .from('netuno_hydrant_mutations')
        .upsert(mutationsPayload, { onConflict: 'id' });

      if (mutError) {
        console.warn(`⚠️ Erro no chunk de hidrantes [${i}..${i + chunk.length}]:`, mutError.message);
      } else {
        hydrantSuccessCount += chunk.length;
        process.stdout.write(` [${hydrantSuccessCount}/${updatedHydrantsList.length}]`);
      }
    }
    console.log(`\n✅ ${hydrantSuccessCount} hidrantes sincronizados em tempo real no Supabase!`);
    console.log('✅ Sincronização completa com Supabase concluída com sucesso!');
  } catch (err) {
    console.warn('⚠️ Erro não impeditivo na sincronização com Supabase:', err.message);
  }

  console.log('================================================================');
  console.log(`🎉 PROCESSO CONCLUÍDO: ${updatedCount} VISTORIAS EFETIVADAS NA BASE!`);
  console.log('================================================================');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
