import { getSupabaseClient, isCloudConfigured } from './supabase';
import { loadMissions, saveMissions, loadFolders, saveFolders, loadHydrantChanges, saveHydrantChanges } from '../utils/storage';

/**
 * ==============================================================================
 * SERVIÇO DE SINCRONIZAÇÃO EM NUVEM (CLOUD SYNC SERVICE)
 * Garante persistência permanente e sincronização em tempo real entre Mobile e Desktop.
 * ==============================================================================
 */

// ------------------------------------------------------------------------------
// 1. SINCRONIZAÇÃO DE MISSÕES (netuno_missions)
// ------------------------------------------------------------------------------

/**
 * Busca todas as missões cadastradas no banco em nuvem
 */
export const fetchMissionsFromCloud = async () => {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('netuno_missions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Erro ao buscar missões do Supabase:', error.message);
      return null;
    }

    return (data || []).map(row => {
      let selected = row.selected_ids || [];
      if (typeof selected === 'string') {
        try { selected = JSON.parse(selected); } catch { selected = []; }
      }
      let completed = row.completed_ids || [];
      if (typeof completed === 'string') {
        try { completed = JSON.parse(completed); } catch { completed = []; }
      }

      return {
        id: String(row.id),
        name: row.name || 'Missão sem título',
        parentFolderId: row.parent_folder_id || null,
        selectedIds: Array.isArray(selected) ? selected : [],
        completedIds: Array.isArray(completed) ? completed : [],
        isDraft: Boolean(row.is_draft),
        createdBy: row.created_by || null,
        createdByName: row.created_by_name || null,
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
      };
    });
  } catch (err) {
    console.warn('Falha na requisição de missões:', err);
    return null;
  }
};

/**
 * Salva ou atualiza uma missão no banco em nuvem
 */
export const syncMissionToCloud = async (mission) => {
  const client = getSupabaseClient();
  if (!client || !mission) return;

  try {
    const payload = {
      id: String(mission.id),
      name: mission.name,
      parent_folder_id: mission.parentFolderId || null,
      selected_ids: mission.selectedIds || [],
      completed_ids: mission.completedIds || [],
      is_draft: Boolean(mission.isDraft),
      created_by: mission.createdBy || null,
      created_by_name: mission.createdByName || null,
      updated_at: new Date().toISOString(),
    };

    if (mission.createdAt) {
      payload.created_at = mission.createdAt;
    }

    const { error } = await client
      .from('netuno_missions')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn(`Erro ao sincronizar missão ${mission.id} na nuvem:`, error.message);
    }
  } catch (err) {
    console.warn('Falha ao enviar missão para nuvem:', err);
  }
};

/**
 * Remove uma missão do banco em nuvem
 */
export const deleteMissionFromCloud = async (missionId) => {
  const client = getSupabaseClient();
  if (!client || !missionId) return;

  try {
    const { error } = await client
      .from('netuno_missions')
      .delete()
      .eq('id', String(missionId));

    if (error) {
      console.warn(`Erro ao excluir missão ${missionId} da nuvem:`, error.message);
    }

    // Registra mutação para propagar exclusão para todos os dispositivos conectados
    await client.from('netuno_hydrant_mutations').upsert({
      id: `del_mission_${missionId}`,
      type: 'deleted_mission',
      payload: { missionId: String(missionId), deletedAt: new Date().toISOString() },
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Falha ao excluir missão da nuvem:', err);
  }
};

// ------------------------------------------------------------------------------
// 2. SINCRONIZAÇÃO DE PASTAS (netuno_folders)
// ------------------------------------------------------------------------------

/**
 * Busca todas as pastas do banco em nuvem
 */
export const fetchFoldersFromCloud = async () => {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('netuno_folders')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.warn('Erro ao buscar pastas do Supabase:', error.message);
      return null;
    }

    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      parentFolderId: row.parent_folder_id,
      createdBy: row.created_by,
      createdAt: row.created_at,
    }));
  } catch (err) {
    console.warn('Falha na requisição de pastas:', err);
    return null;
  }
};

/**
 * Salva ou atualiza uma pasta no banco em nuvem
 */
export const syncFolderToCloud = async (folder) => {
  const client = getSupabaseClient();
  if (!client || !folder) return;

  try {
    const payload = {
      id: String(folder.id),
      name: folder.name,
      parent_folder_id: folder.parentFolderId || null,
      created_by: folder.createdBy || null,
    };

    if (folder.createdAt) {
      payload.created_at = folder.createdAt;
    }

    const { error } = await client
      .from('netuno_folders')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn(`Erro ao sincronizar pasta ${folder.id} na nuvem:`, error.message);
    }
  } catch (err) {
    console.warn('Falha ao enviar pasta para nuvem:', err);
  }
};

// ------------------------------------------------------------------------------
// 3. SINCRONIZAÇÃO DE VISTORIAS TÉCNICAS (netuno_inspections)
// ------------------------------------------------------------------------------

/**
 * Salva uma nova vistoria técnica realizada no banco em nuvem
 */
export const syncInspectionToCloud = async (hidrante) => {
  const client = getSupabaseClient();
  if (!client || !hidrante) return;

  try {
    const payload = {
      id: `insp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      cod_hidrante: String(hidrante.codHidrante || ''),
      nom_hidrante: String(hidrante.nomHidrante || ''),
      flg_ativo: Boolean(hidrante.flgAtivo),
      problemas_hidrante: hidrante.problemasHidrante || '',
      nom_vistoriador: hidrante.vistoriadorNome || hidrante.nomVistoriador || '',
      num_matricula: hidrante.vistoriadorMatricula || '',
      data_hora_vistoria: hidrante.datHoraUltimaVistoria || new Date().toISOString(),
      observacao: hidrante.dscObservacao || '',
      foto_url: hidrante.fotoUrl || null,
      latitude: hidrante.numLatitude ? parseFloat(hidrante.numLatitude) : null,
      longitude: hidrante.numLongitude ? parseFloat(hidrante.numLongitude) : null,
      created_at: new Date().toISOString(),
    };

    const { error } = await client
      .from('netuno_inspections')
      .insert(payload);

    if (error) {
      console.warn('Erro ao salvar vistoria na nuvem:', error.message);
    }
  } catch (err) {
    console.warn('Falha ao enviar vistoria para nuvem:', err);
  }
};

// ------------------------------------------------------------------------------
// 4. SINCRONIZAÇÃO DE MUTAÇÕES DA BASE DE HIDRANTES (netuno_hydrant_mutations)
// ------------------------------------------------------------------------------

/**
 * Salva uma mutação de hidrante (atualização, adição ou exclusão) no banco em nuvem
 */
export const syncHydrantMutationToCloud = async (type, payloadData) => {
  const client = getSupabaseClient();
  if (!client || !payloadData) return;

  try {
    const idKey = payloadData._internalId || payloadData.codHidrante || payloadData.nomHidrante || `mut_${Date.now()}`;
    const payload = {
      id: String(idKey),
      type, // 'update', 'add', 'delete'
      payload: payloadData,
      updated_at: new Date().toISOString(),
    };

    const { error } = await client
      .from('netuno_hydrant_mutations')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('Erro ao registrar mutação de hidrante na nuvem:', error.message);
    }
  } catch (err) {
    console.warn('Falha ao enviar mutação para nuvem:', err);
  }
};

/**
 * Busca todas as mutações de hidrantes da nuvem
 */
export const fetchHydrantMutationsFromCloud = async () => {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('netuno_hydrant_mutations')
      .select('*')
      .order('updated_at', { ascending: true });

    if (error) {
      console.warn('Erro ao buscar mutações do Supabase:', error.message);
      return null;
    }

    const result = { 
      updated: {}, 
      added: [], 
      deleted: [],
      deletedMissions: [],
      buildingStudies: {},
      deletedBuildingStudies: [],
      technicalStudies: {},
      deletedTechnicalStudies: []
    };

    (data || []).forEach(row => {
      if (row.type === 'update' && row.payload) {
        const key = row.payload._internalId || row.payload.codHidrante || row.payload.nomHidrante || row.id;
        result.updated[key] = row.payload;
      } else if (row.type === 'add' && row.payload) {
        result.added.push(row.payload);
      } else if (row.type === 'delete') {
        const key = typeof row.payload === 'string' ? row.payload : (row.payload?._internalId || row.payload?.codHidrante || row.id);
        if (!result.deleted.includes(key)) {
          result.deleted.push(key);
        }
      } else if (row.type === 'deleted_mission') {
        const mId = row.payload?.missionId || row.id.replace('del_mission_', '');
        if (mId && !result.deletedMissions.includes(mId)) {
          result.deletedMissions.push(mId);
        }
      } else if (row.type === 'building_study' && row.payload) {
        const id = row.payload.id || row.id.replace('ppo_', '');
        result.buildingStudies[id] = row.payload;
      } else if (row.type === 'deleted_building_study') {
        const id = row.payload?.id || row.id.replace('del_ppo_', '');
        if (id && !result.deletedBuildingStudies.includes(id)) {
          result.deletedBuildingStudies.push(id);
        }
      } else if (row.type === 'technical_study' && row.payload) {
        const id = row.payload.id || row.id.replace('tech_', '');
        result.technicalStudies[id] = row.payload;
      } else if (row.type === 'deleted_technical_study') {
        const id = row.payload?.id || row.id.replace('del_tech_', '');
        if (id && !result.deletedTechnicalStudies.includes(id)) {
          result.deletedTechnicalStudies.push(id);
        }
      }
    });

    return result;
  } catch (err) {
    console.warn('Falha ao carregar mutações da nuvem:', err);
    return null;
  }
};

/**
 * Sincronização em tempo real de Edificações / Pré-POP (netuno_hydrant_mutations type: building_study)
 */
export const syncBuildingStudyToCloud = async (study) => {
  const client = getSupabaseClient();
  if (!client || !study?.id) return;
  try {
    await client.from('netuno_hydrant_mutations').upsert({
      id: `ppo_${study.id}`,
      type: 'building_study',
      payload: study,
      updated_at: new Date().toISOString()
    });
  } catch (e) {
    console.warn('Falha ao sincronizar estudo de edificação na nuvem:', e);
  }
};

export const deleteBuildingStudyFromCloud = async (studyId) => {
  const client = getSupabaseClient();
  if (!client || !studyId) return;
  try {
    await client.from('netuno_hydrant_mutations').delete().eq('id', `ppo_${studyId}`);
    await client.from('netuno_hydrant_mutations').upsert({
      id: `del_ppo_${studyId}`,
      type: 'deleted_building_study',
      payload: { id: studyId },
      updated_at: new Date().toISOString()
    });
  } catch (e) {
    console.warn('Falha ao registrar exclusão de edificação na nuvem:', e);
  }
};

/**
 * Sincronização em tempo real de Estudos Técnicos (netuno_hydrant_mutations type: technical_study)
 */
export const syncTechnicalStudyToCloud = async (study) => {
  const client = getSupabaseClient();
  if (!client || !study?.id) return;
  try {
    await client.from('netuno_hydrant_mutations').upsert({
      id: `tech_${study.id}`,
      type: 'technical_study',
      payload: study,
      updated_at: new Date().toISOString()
    });
  } catch (e) {
    console.warn('Falha ao sincronizar estudo técnico na nuvem:', e);
  }
};

export const deleteTechnicalStudyFromCloud = async (studyId) => {
  const client = getSupabaseClient();
  if (!client || !studyId) return;
  try {
    await client.from('netuno_hydrant_mutations').delete().eq('id', `tech_${studyId}`);
    await client.from('netuno_hydrant_mutations').upsert({
      id: `del_tech_${studyId}`,
      type: 'deleted_technical_study',
      payload: { id: studyId },
      updated_at: new Date().toISOString()
    });
  } catch (e) {
    console.warn('Falha ao registrar exclusão de estudo técnico na nuvem:', e);
  }
};

// ------------------------------------------------------------------------------
// 5. LISTENER REALTIME EM NUVEM (WEB SOCKETS)
// ------------------------------------------------------------------------------

/**
 * Subscreve às alterações em tempo real no Supabase
 */
export const subscribeToCloudRealtime = ({ onMissionsChange, onFoldersChange, onHydrantChange }) => {
  const client = getSupabaseClient();
  if (!client) return () => {};

  try {
    const channel = client.channel('netuno_realtime_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'netuno_missions' }, async () => {
        if (onMissionsChange) {
          const freshMissions = await fetchMissionsFromCloud();
          if (freshMissions) onMissionsChange(freshMissions);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'netuno_folders' }, async () => {
        if (onFoldersChange) {
          const freshFolders = await fetchFoldersFromCloud();
          if (freshFolders) onFoldersChange(freshFolders);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'netuno_hydrant_mutations' }, async () => {
        if (onHydrantChange) {
          const freshMutations = await fetchHydrantMutationsFromCloud();
          if (freshMutations) onHydrantChange(freshMutations);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'netuno_inspections' }, async () => {
        if (onHydrantChange) {
          const freshMutations = await fetchHydrantMutationsFromCloud();
          if (freshMutations) onHydrantChange(freshMutations);
        }
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  } catch (err) {
    console.warn('Falha ao configurar canal Realtime:', err);
    return () => {};
  }
};
