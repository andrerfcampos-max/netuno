const MISSIONS_STORAGE_KEY = 'argos_missions';
const FOLDERS_STORAGE_KEY = 'argos_folders';

export const loadMissions = () => {
  try {
    const data = localStorage.getItem(MISSIONS_STORAGE_KEY);
    if (data) {
      let parsed = JSON.parse(data);
      // Limpeza automática de rascunhos antigos (de dias anteriores)
      const todayString = new Date().toDateString(); // Ex: "Tue Aug 04 2026"
      parsed = parsed.filter(m => {
        if (m.isDraft) {
          const createdString = new Date(m.createdAt).toDateString();
          return createdString === todayString; // Mantém apenas se for de hoje
        }
        return true; // Missões salvas permanentemente não são deletadas
      });
      return parsed;
    }
  } catch (error) {
    console.error("Erro ao ler missões do localStorage", error);
  }
  return [];
};

export const saveMissions = (missions) => {
  try {
    localStorage.setItem(MISSIONS_STORAGE_KEY, JSON.stringify(missions));
  } catch (error) {
    console.error("Erro ao salvar missões no localStorage", error);
  }
};

export const loadFolders = () => {
  try {
    const data = localStorage.getItem(FOLDERS_STORAGE_KEY);
    if (data) return JSON.parse(data);
  } catch (error) {
    console.error("Erro ao ler pastas do localStorage", error);
  }
  return [];
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

export const createNewMission = (name = "Rascunho de Hoje", parentFolderId = null) => {
  return {
    id: generateId(),
    name,
    atribuicao: "", // Ex: 'sehur', '16º GBM Ala B'
    parentFolderId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    selectedIds: [],
    completedIds: [],
    isDraft: true // Por padrão, toda nova missão é um rascunho volátil
  };
};

