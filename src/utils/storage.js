import { MOCK_TEST_MISSIONS } from './mockMissions';

const MISSIONS_STORAGE_KEY = 'argos_missions';
const FOLDERS_STORAGE_KEY = 'argos_folders';

export const loadMissions = () => {
  try {
    const data = localStorage.getItem(MISSIONS_STORAGE_KEY);
    let savedMissions = [];
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        // Limpeza automática de rascunhos antigos (de dias anteriores)
        const todayString = new Date().toDateString();
        savedMissions = parsed.filter(m => {
          if (m.isDraft) {
            const createdString = new Date(m.createdAt).toDateString();
            return createdString === todayString;
          }
          return true;
        });
      }
    }

    // Merge: MOCK_TEST_MISSIONS são sempre garantidas com hidrantes reais da base
    const mockIds = new Set(MOCK_TEST_MISSIONS.map(m => m.id));
    // Remove mocks obsoletos e preserva apenas missões criadas pelo usuário
    const userCustomMissions = savedMissions.filter(m => !m.id?.startsWith('mock-') && !mockIds.has(m.id));

    // Se o usuário interagiu e atualizou alguma missão mock atual, preserva vistorias concluídas válidas
    const mergedMocks = MOCK_TEST_MISSIONS.map(mock => {
      const existing = savedMissions.find(m => m.id === mock.id);
      if (existing && Array.isArray(existing.completedIds)) {
        const validCompleted = existing.completedIds.filter(id => mock.selectedIds.includes(id));
        return { ...mock, completedIds: validCompleted, updatedAt: existing.updatedAt || mock.updatedAt };
      }
      return mock;
    });

    return [...mergedMocks, ...userCustomMissions];
  } catch (error) {
    console.error("Erro ao ler missões do localStorage", error);
    return MOCK_TEST_MISSIONS;
  }
};

export const saveMissions = (missions) => {
  try {
    localStorage.setItem(MISSIONS_STORAGE_KEY, JSON.stringify(missions));
  } catch (error) {
    console.error("Erro ao salvar missões no localStorage", error);
  }
};

const DEFAULT_FOLDERS = [
  { id: 'f-sehur', name: 'SEHUR', parentFolderId: null, isFixed: true },
  { id: 'f-1gbm', name: '1º GBM - Brasília', parentFolderId: null, isFixed: true },
  { id: 'f-2gbm', name: '2º GBM - Taguatinga', parentFolderId: null, isFixed: true },
  { id: 'f-3gbm', name: '3º GBM - SIA', parentFolderId: null, isFixed: true },
  { id: 'f-4gbm', name: '4º GBM - Asa Norte', parentFolderId: null, isFixed: true },
  { id: 'f-6gbm', name: '6º GBM - Núcleo Bandeirante', parentFolderId: null, isFixed: true },
  { id: 'f-7gbm', name: '7º GBM - Brazlândia', parentFolderId: null, isFixed: true },
  { id: 'f-8gbm', name: '8º GBM - Ceilândia', parentFolderId: null, isFixed: true },
  { id: 'f-9gbm', name: '9º GBM - Planaltina', parentFolderId: null, isFixed: true },
  { id: 'f-10gbm', name: '10º GBM - Paranoá', parentFolderId: null, isFixed: true },
  { id: 'f-11gbm', name: '11º GBM - Lago Sul', parentFolderId: null, isFixed: true },
  { id: 'f-13gbm', name: '13º GBM - Guará I', parentFolderId: null, isFixed: true },
  { id: 'f-15gbm', name: '15º GBM - Asa Sul', parentFolderId: null, isFixed: true },
  { id: 'f-16gbm', name: '16º GBM - Gama', parentFolderId: null, isFixed: true },
  { id: 'f-17gbm', name: '17º GBM - São Sebastião', parentFolderId: null, isFixed: true },
  { id: 'f-18gbm', name: '18º GBM - Santa Maria', parentFolderId: null, isFixed: true },
  { id: 'f-19gbm', name: '19º GBM - Candangolândia', parentFolderId: null, isFixed: true },
  { id: 'f-21gbm', name: '21º GBM - Riacho Fundo I', parentFolderId: null, isFixed: true },
  { id: 'f-22gbm', name: '22º GBM - Sobradinho', parentFolderId: null, isFixed: true },
  { id: 'f-25gbm', name: '25º GBM - Águas Claras', parentFolderId: null, isFixed: true },
  { id: 'f-34gbm', name: '34º GBM - Lago Norte', parentFolderId: null, isFixed: true },
  { id: 'f-36gbm', name: '36º GBM - Recanto das Emas Central', parentFolderId: null, isFixed: true },
  { id: 'f-37gbm', name: '37º GBM - Samambaia Centro', parentFolderId: null, isFixed: true },
  { id: 'f-37gbm-sierra3', name: '37º GBM/ SIERRA 3 - Subgrupamento de Bombeiro Militar - BR 060', parentFolderId: null, isFixed: true },
  { id: 'f-41gbm', name: '41º GBM - Setor Industrial da Ceilândia', parentFolderId: null, isFixed: true },
  { id: 'f-45gbm', name: '45º GBM - Sudoeste e Octogonal', parentFolderId: null, isFixed: true },
  { id: 'f-gaeph', name: 'GAEPH - GRUPAMENTO DE ATENDIMENTO DE EMERGÊNCIA PRÉ-HOSPITALAR', parentFolderId: null, isFixed: true },
  { id: 'f-gavop', name: 'GAVOP - GRUPAMENTO DE AVIAÇÃO OPERACIONAL', parentFolderId: null, isFixed: true },
  { id: 'f-gbmot', name: 'GBMOT - GRUPAMENTO DE BOMBEIRO MILITAR DE MOTOMECANIZAÇÃO', parentFolderId: null, isFixed: true },
  { id: 'f-gbs', name: 'GBS - GRUPAMENTO DE BUSCA E SALVAMENTO', parentFolderId: null, isFixed: true },
  { id: 'f-gpciu', name: 'GPCIU - GRUPAMENTO DE PREVENÇÃO E COMBATE A INCÊNDIO URBANO', parentFolderId: null, isFixed: true },
  { id: 'f-gpram', name: 'GPRAM - GRUPAMENTO DE PROTEÇÃO AMBIENTAL', parentFolderId: null, isFixed: true },
  { id: 'f-gpram-sam', name: 'GPRAM/SAMAMBAIA - GPRAM/SAMAMBAIA', parentFolderId: null, isFixed: true },
  { id: 'f-op-externa', name: 'OP EXTERNA - OPERAÇÕES EXTERNAS', parentFolderId: null, isFixed: true }
];

export const loadFolders = () => {
  try {
    const data = localStorage.getItem(FOLDERS_STORAGE_KEY);
    let folders = [];
    if (data) {
      folders = JSON.parse(data);
    }
    const fixedIds = DEFAULT_FOLDERS.map(f => f.id);
    const customFolders = folders.filter(f => !fixedIds.includes(f.id));
    return [...DEFAULT_FOLDERS, ...customFolders];
  } catch (error) {
    console.error("Erro ao ler pastas do localStorage", error);
  }
  return DEFAULT_FOLDERS;
};

export const saveFolders = (folders) => {
  try {
    localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders));
  } catch (error) {
    console.error("Erro ao salvar pastas no localStorage", error);
  }
};

export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const createNewFolder = (name, parentFolderId = null, gbmUnitId = null) => {
  return {
    id: generateId(),
    name,
    parentFolderId,
    gbmUnitId,
    createdAt: new Date().toISOString()
  };
};

export const createNewMission = (name = "Rascunho de Hoje", parentFolderId = null, currentUser = null) => {
  return {
    id: generateId(),
    name,
    atribuicao: "", // Ex: 'sehur', '16º GBM Ala B'
    parentFolderId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: currentUser?.matricula || null,
    createdByName: currentUser?.nome || null,
    selectedIds: [],
    completedIds: [],
    isDraft: true // Por padrão, toda nova missão é um rascunho volátil
  };
};

const HYDRANT_CHANGES_KEY = 'netuno_hydrant_changes';
const ACTIVE_MISSION_STATE_KEY = 'netuno_active_mission_state';

export const loadHydrantChanges = () => {
  try {
    const data = localStorage.getItem(HYDRANT_CHANGES_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') {
        return {
          updated: parsed.updated || {},
          added: Array.isArray(parsed.added) ? parsed.added : [],
          deleted: Array.isArray(parsed.deleted) ? parsed.deleted : []
        };
      }
    }
  } catch (error) {
    console.error("Erro ao ler alterações de hidrantes do localStorage:", error);
  }
  return { updated: {}, added: [], deleted: [] };
};

export const saveHydrantChanges = (changes) => {
  try {
    localStorage.setItem(HYDRANT_CHANGES_KEY, JSON.stringify(changes));
  } catch (error) {
    console.error("Erro ao salvar alterações de hidrantes no localStorage:", error);
  }
};

export const loadActiveMissionState = () => {
  try {
    const data = localStorage.getItem(ACTIVE_MISSION_STATE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') {
        return {
          openMissionIds: Array.isArray(parsed.openMissionIds) ? parsed.openMissionIds : [],
          activeMissionId: parsed.activeMissionId || null
        };
      }
    }
  } catch (error) {
    console.error("Erro ao ler estado da missão ativa do localStorage:", error);
  }
  return { openMissionIds: [], activeMissionId: null };
};

export const saveActiveMissionState = (state) => {
  try {
    localStorage.setItem(ACTIVE_MISSION_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Erro ao salvar estado da missão ativa no localStorage:", error);
  }
};


