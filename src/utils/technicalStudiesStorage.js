import { calculateDistanceMeters, isValidDFCoordinate } from './geoUtils';
import { syncTechnicalStudyToCloud, deleteTechnicalStudyFromCloud } from '../services/syncService';

const STORAGE_KEY = 'netuno_technical_studies';

// Dados de estudos técnicos de referência para demonstração operacional no DF
export const INITIAL_TECHNICAL_STUDIES = [
  {
    id: 'estudo_bsb_01',
    docRef: 'Memorando 142/2026 - DINSP/CBMDF',
    infoGerais: 'Solicitação da Administração Regional do Plano Piloto para verificação de cobertura devido a obras de reurbanização na W3 Sul.',
    studyType: 'relocation', // 'relocation' | 'new_hydrant'
    selectedRA: 'Brasília',
    occupation: 'unifamiliar', // 800m
    targetCode: 'BSB00102',
    rawPolygon: '',
    rawWaterNetwork: '',
    fotoHidrante: null,
    isApproved: true,
    radius: 800,
    maxDist: 0,
    adjacentCount: 4,
    dataCadastro: '2026-08-22',
    ultimaAtualizacao: '2026-08-25',
    analistaNome: 'Sgt Roméro',
    analistaMatricula: '1997400'
  },
  {
    id: 'estudo_tag_02',
    docRef: 'Ofício 889/2026 - CAESB/NOVACAP',
    infoGerais: 'Avaliação técnica para projeção de novo hidrante no Setor M-Norte em decorrência de novos empreendimentos residenciais e comerciais.',
    studyType: 'new_hydrant',
    selectedRA: 'Taguatinga',
    occupation: 'verticalizada', // 600m
    targetCode: '',
    rawPolygon: '-15.808200, -48.106500\n-15.809500, -48.105200\n-15.807100, -48.104800',
    rawWaterNetwork: '-15.808000, -48.106000\n-15.809000, -48.105000',
    fotoHidrante: null,
    isApproved: true,
    radius: 600,
    maxDist: 420.5,
    suggestedPos: { lat: -15.808266, lng: -48.105500 },
    adjacentCount: 3,
    dataCadastro: '2026-08-19',
    ultimaAtualizacao: '2026-08-24',
    analistaNome: 'Gestor Souza',
    analistaMatricula: '456'
  }
];

/**
 * Obtém todos os estudos técnicos salvos no localStorage (com fallback)
 */
export const getTechnicalStudies = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_TECHNICAL_STUDIES));
      return INITIAL_TECHNICAL_STUDIES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_TECHNICAL_STUDIES));
    return INITIAL_TECHNICAL_STUDIES;
  } catch (e) {
    console.warn('Erro ao carregar estudos técnicos do localStorage:', e);
    return INITIAL_TECHNICAL_STUDIES;
  }
};

/**
 * Salva ou atualiza um estudo técnico
 */
export const saveTechnicalStudy = (studyData, currentUser = null) => {
  try {
    const studies = getTechnicalStudies();
    const now = new Date().toISOString().split('T')[0];
    
    let updated;
    if (studyData.id) {
      // Atualização
      updated = studies.map(s => {
        if (s.id === studyData.id) {
          return {
            ...s,
            ...studyData,
            ultimaAtualizacao: now,
            analistaNome: studyData.analistaNome || s.analistaNome || currentUser?.nome || 'Analista CBMDF',
            analistaMatricula: studyData.analistaMatricula || s.analistaMatricula || currentUser?.matricula || 'CBMDF'
          };
        }
        return s;
      });
    } else {
      // Novo cadastro
      const newStudy = {
        ...studyData,
        id: `et_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        dataCadastro: now,
        ultimaAtualizacao: now,
        analistaNome: currentUser?.nome || 'Analista CBMDF',
        analistaMatricula: currentUser?.matricula || 'CBMDF'
      };
      updated = [newStudy, ...studies];
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    const finalSaved = studyData.id ? updated.find(s => s.id === studyData.id) : updated[0];
    if (finalSaved) {
      syncTechnicalStudyToCloud(finalSaved);
    }
    return { success: true, data: updated, savedStudy: finalSaved };
  } catch (e) {
    console.error('Erro ao salvar estudo técnico:', e);
    return { success: false, error: e.message };
  }
};

/**
 * Exclui um estudo técnico pelo ID
 */
export const deleteTechnicalStudy = (studyId) => {
  try {
    const studies = getTechnicalStudies();
    const filtered = studies.filter(s => s.id !== studyId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    deleteTechnicalStudyFromCloud(studyId);
    return { success: true, data: filtered };
  } catch (e) {
    console.error('Erro ao excluir estudo técnico:', e);
    return { success: false, error: e.message };
  }
};
