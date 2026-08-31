/**
 * Script de Teste Automatizado de Persistência no Banco de Dados / Storage
 * Netuno - CBMDF (Vistorias, PrePOP, Pastas, Rotas, Hidrantes e Estudos Técnicos)
 */

const assert = require('assert');

// Mock simples de localStorage em ambiente Node.js
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] !== undefined ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

global.localStorage = new LocalStorageMock();
global.window = { location: { origin: 'http://localhost:5173', pathname: '/' } };

console.log('═══════════════════════════════════════════════════════════════');
console.log('  INICIANDO BATERIA COMPLETA DE TESTES DE BANCO DE DADOS NETUNO');
console.log('═══════════════════════════════════════════════════════════════\n');

let totalTests = 0;
let passedTests = 0;

function runTest(testName, testFn) {
  totalTests++;
  try {
    testFn();
    passedTests++;
    console.log(`  ✅ [PASSOU] ${testName}`);
  } catch (error) {
    console.error(`  ❌ [FALHOU] ${testName}`);
    console.error(`     Erro: ${error.message}`);
  }
}

// -------------------------------------------------------------
// 1. TESTES DE PREPOP (ESTUDOS DE EDIFICAÇÕES)
// -------------------------------------------------------------
console.log('📦 [1/6] Testando Módulo PrePOP (Estudos de Edificações)...');

const { 
  getBuildingStudies, 
  saveBuildingStudy, 
  deleteBuildingStudy, 
  findNearestHydrantsForBuilding 
} = require('./src/utils/buildingStudiesStorage');

let testPrepopId = null;

runTest('PrePOP: Carregamento inicial de dados padrão', () => {
  const studies = getBuildingStudies();
  assert(Array.isArray(studies), 'Deveria retornar um array');
  assert(studies.length >= 3, 'Deveria conter os estudos mock iniciais');
});

runTest('PrePOP: Criar novo estudo de edificação', () => {
  const newStudy = {
    nomeFantasia: 'Edifício Teste Operacional Alfa',
    razaoSocial: 'Condomínio Alfa LTDA',
    ra: 'Guará',
    endereco: 'QI 15 Bloco B',
    numLatitude: -15.820100,
    numLongitude: -47.980200,
    ocupacao: 'Comercial',
    cargaIncendio: 'Alta',
    volumeRTI: '50.000 Litros',
    contatos: [{ nome: 'Ten. Rocha', funcao: 'Brigada', telefone: '61999999999' }]
  };
  
  const res = saveBuildingStudy(newStudy);
  assert(res.success, 'Deveria salvar com sucesso');
  const stored = getBuildingStudies();
  const created = stored.find(s => s.nomeFantasia === 'Edifício Teste Operacional Alfa');
  assert(created, 'O estudo criado deve estar salvo no storage');
  assert(created.id, 'O estudo deve possuir ID gerado');
  testPrepopId = created.id;
});

runTest('PrePOP: Editar estudo de edificação existente', () => {
  assert(testPrepopId, 'ID do estudo deve existir');
  const updatePayload = {
    id: testPrepopId,
    nomeFantasia: 'Edifício Teste Operacional Alfa (Atualizado)',
    volumeRTI: '65.000 Litros'
  };
  const res = saveBuildingStudy(updatePayload);
  assert(res.success, 'Deveria atualizar com sucesso');
  const stored = getBuildingStudies();
  const updated = stored.find(s => s.id === testPrepopId);
  assert(updated.nomeFantasia === 'Edifício Teste Operacional Alfa (Atualizado)', 'Nome fantasia deve ter sido atualizado');
  assert(updated.volumeRTI === '65.000 Litros', 'RTI deve ter sido atualizado');
});

runTest('PrePOP: Excluir estudo de edificação', () => {
  assert(testPrepopId, 'ID do estudo deve existir');
  const res = deleteBuildingStudy(testPrepopId);
  assert(res.success, 'Deveria excluir com sucesso');
  const stored = getBuildingStudies();
  const found = stored.find(s => s.id === testPrepopId);
  assert(!found, 'Estudo excluído não deve mais existir no storage');
});

// -------------------------------------------------------------
// 2. TESTES DE ESTUDOS TÉCNICOS DE HIDRANTES
// -------------------------------------------------------------
console.log('\n📐 [2/6] Testando Módulo de Estudos Técnicos de Hidrantes...');

const { 
  getTechnicalStudies, 
  saveTechnicalStudy, 
  deleteTechnicalStudy 
} = require('./src/utils/technicalStudiesStorage');

let testEstudoTecnicoId = null;

runTest('Estudos Técnicos: Carregamento inicial', () => {
  const studies = getTechnicalStudies();
  assert(Array.isArray(studies), 'Deveria retornar array de estudos técnicos');
  assert(studies.length >= 2, 'Deveria conter estudos técnicos iniciais');
});

runTest('Estudos Técnicos: Cadastrar novo estudo técnico', () => {
  const newStudy = {
    docRef: 'Memorando 999/2026 - TESTE',
    infoGerais: 'Análise de viabilidade para novo hidrante comercial',
    studyType: 'new_hydrant',
    selectedRA: 'Samambaia',
    occupation: 'verticalizada',
    targetCode: 'SAM00010',
    isApproved: true,
    radius: 600,
    maxDist: 350
  };
  const res = saveTechnicalStudy(newStudy, { nome: 'Sgt Roméro', matricula: '1997400' });
  assert(res.success, 'Deveria salvar estudo técnico com sucesso');
  const stored = getTechnicalStudies();
  const created = stored.find(s => s.docRef === 'Memorando 999/2026 - TESTE');
  assert(created, 'Estudo técnico criado deve estar salvo');
  assert(created.analistaNome === 'Sgt Roméro', 'Analista deve ser gravado');
  testEstudoTecnicoId = created.id;
});

runTest('Estudos Técnicos: Editar estudo técnico existente', () => {
  assert(testEstudoTecnicoId, 'ID do estudo técnico deve existir');
  const updateData = {
    id: testEstudoTecnicoId,
    docRef: 'Memorando 999/2026 - TESTE REVISADO',
    isApproved: false
  };
  const res = saveTechnicalStudy(updateData);
  assert(res.success, 'Deveria atualizar estudo técnico');
  const stored = getTechnicalStudies();
  const updated = stored.find(s => s.id === testEstudoTecnicoId);
  assert(updated.docRef === 'Memorando 999/2026 - TESTE REVISADO', 'DocRef deve ter sido atualizado');
  assert(updated.isApproved === false, 'Status do parecer deve ter sido atualizado');
});

runTest('Estudos Técnicos: Excluir estudo técnico', () => {
  assert(testEstudoTecnicoId, 'ID do estudo técnico deve existir');
  const res = deleteTechnicalStudy(testEstudoTecnicoId);
  assert(res.success, 'Deveria excluir estudo técnico com sucesso');
  const stored = getTechnicalStudies();
  const found = stored.find(s => s.id === testEstudoTecnicoId);
  assert(!found, 'Estudo técnico excluído não deve existir no storage');
});

// -------------------------------------------------------------
// 3. TESTES DE PASTAS DA CENTRAL DE MISSÕES
// -------------------------------------------------------------
console.log('\n📁 [3/6] Testando Gestão de Pastas (Central de Missões)...');

const { 
  loadFolders, 
  saveFolders, 
  createNewFolder, 
  mergeFolders 
} = require('./src/utils/storage');

let testFolderId = null;

runTest('Pastas: Carregamento inicial de pastas de quartéis fixas', () => {
  const folders = loadFolders();
  assert(Array.isArray(folders), 'Deveria carregar array de pastas');
  assert(folders.some(f => f.name.includes('1º GBM')), 'Deve conter 1º GBM');
  assert(folders.some(f => f.name.includes('13º GBM')), 'Deve conter 13º GBM');
});

runTest('Pastas: Criar nova pasta customizada', () => {
  const newFolder = createNewFolder('13º GBM - 2ª Cia Operacional', 'f-13gbm');
  testFolderId = newFolder.id;
  const currentFolders = loadFolders();
  const updatedFolders = [...currentFolders, newFolder];
  saveFolders(updatedFolders);

  const stored = loadFolders();
  const found = stored.find(f => f.id === testFolderId);
  assert(found, 'Pasta customizada criada deve estar presente no storage');
  assert(found.parentFolderId === 'f-13gbm', 'Subpasta deve ter parentFolderId correto');
});

runTest('Pastas: Renomear pasta customizada', () => {
  const currentFolders = loadFolders();
  const updatedFolders = currentFolders.map(f => {
    if (f.id === testFolderId) {
      return { ...f, name: '13º GBM - 2ª Cia (Área Sul)' };
    }
    return f;
  });
  saveFolders(updatedFolders);

  const stored = loadFolders();
  const found = stored.find(f => f.id === testFolderId);
  assert(found.name === '13º GBM - 2ª Cia (Área Sul)', 'Nome da pasta deve ter sido atualizado');
});

runTest('Pastas: Excluir pasta customizada', () => {
  const currentFolders = loadFolders();
  const filtered = currentFolders.filter(f => f.id !== testFolderId);
  saveFolders(filtered);

  const stored = loadFolders();
  const found = stored.find(f => f.id === testFolderId);
  assert(!found, 'Pasta excluída não deve mais constar no storage');
});

// -------------------------------------------------------------
// 4. TESTES DE ROTAS E MISSÕES
// -------------------------------------------------------------
console.log('\n🧭 [4/6] Testando Rotas e Missões Operacionais...');

const { 
  loadMissions, 
  saveMissions, 
  createNewMission, 
  mergeMissions 
} = require('./src/utils/storage');

let testMissionId = null;

runTest('Missões: Carregar missões com catálogo mock e persistência', () => {
  const missions = loadMissions();
  assert(Array.isArray(missions), 'Deveria carregar array de missões');
  assert(missions.length > 0, 'Deveria conter missões cadastradas');
});

runTest('Missões: Criar nova missão com hidrantes', () => {
  const newMission = createNewMission('Operação Guará Seguro - QE 15', 'f-13gbm', { matricula: '1997400', nome: 'Sgt Roméro' });
  newMission.selectedIds = ['GUA00001', 'GUA00002', 'GUA00003', 'GUA00004'];
  newMission.completedIds = [];
  testMissionId = newMission.id;

  const currentMissions = loadMissions();
  saveMissions([...currentMissions, newMission]);

  const stored = loadMissions();
  const found = stored.find(m => m.id === testMissionId);
  assert(found, 'Missão criada deve constar no storage');
  assert(found.selectedIds.length === 4, 'Missão deve conter 4 hidrantes selecionados');
});

runTest('Missões: Registrar progresso e hidrantes vistoriados na missão', () => {
  const currentMissions = loadMissions();
  const updatedMissions = currentMissions.map(m => {
    if (m.id === testMissionId) {
      return {
        ...m,
        completedIds: ['GUA00001', 'GUA00002'],
        updatedAt: new Date().toISOString()
      };
    }
    return m;
  });
  saveMissions(updatedMissions);

  const stored = loadMissions();
  const found = stored.find(m => m.id === testMissionId);
  assert(found.completedIds.length === 2, 'Deveria conter 2 hidrantes concluídos');
  assert(found.completedIds.includes('GUA00001'), 'GUA00001 deve estar concluído');
});

runTest('Missões: Excluir missão', () => {
  const currentMissions = loadMissions();
  const filtered = currentMissions.filter(m => m.id !== testMissionId);
  saveMissions(filtered);

  const stored = loadMissions();
  const found = stored.find(m => m.id === testMissionId);
  assert(!found, 'Missão excluída não deve constar no storage');
});

// -------------------------------------------------------------
// 5. TESTES DE MUTAÇÕES DE HIDRANTES (NOVO, EDITAR, EXCLUIR)
// -------------------------------------------------------------
console.log('\n🚰 [5/6] Testando Mutações e Cadastro de Hidrantes...');

const { 
  loadHydrantChanges, 
  saveHydrantChanges 
} = require('./src/utils/storage');

runTest('Hidrantes: Gravar novo hidrante cadastrado', () => {
  const newHydrant = {
    _internalId: 'hid_custom_9999',
    codHidrante: 'GUA00999',
    nomHidrante: 'GUA00999',
    dscLocalidade: 'Guará',
    dscEndereco: 'QE 40 Rua 15 Lote 02',
    pontoReferencia: 'Próximo à Padaria',
    numLatitude: -15.825000,
    numLongitude: -47.985000,
    flgAtivo: true
  };

  const changes = loadHydrantChanges();
  changes.added.push(newHydrant);
  saveHydrantChanges(changes);

  const stored = loadHydrantChanges();
  const found = stored.added.find(h => h._internalId === 'hid_custom_9999');
  assert(found, 'Novo hidrante deve estar salvo em changes.added');
  assert(found.codHidrante === 'GUA00999', 'Código deve ser GUA00999');
});

runTest('Hidrantes: Gravar edição de coordenadas e dados de hidrante', () => {
  const changes = loadHydrantChanges();
  changes.updated['GUA00001'] = {
    dscEndereco: 'Endereço Atualizado pelo Gestor',
    numLatitude: -15.821111,
    numLongitude: -47.981111,
    flgAtivo: false
  };
  saveHydrantChanges(changes);

  const stored = loadHydrantChanges();
  const updated = stored.updated['GUA00001'];
  assert(updated, 'Edição de GUA00001 deve estar salva');
  assert(updated.numLatitude === -15.821111, 'Latitude deve ter sido atualizada');
  assert(updated.flgAtivo === false, 'Status deve ter sido alterado');
});

runTest('Hidrantes: Gravar exclusão de hidrante', () => {
  const changes = loadHydrantChanges();
  changes.deleted.push('GUA00099');
  saveHydrantChanges(changes);

  const stored = loadHydrantChanges();
  assert(stored.deleted.includes('GUA00099'), 'GUA00099 deve constar na lista de excluídos');
});

// -------------------------------------------------------------
// 6. TESTES DE VISTORIAS E HISTÓRICO DE INSPEÇÕES
// -------------------------------------------------------------
console.log('\n📋 [6/6] Testando Gravação de Vistorias e Histórico...');

runTest('Vistorias: Gravação completa de vistoria com defeitos e status', () => {
  const inspectionRecord = {
    dataVistoria: new Date().toISOString(),
    flgAtivo: false,
    problemasHidrante: 'Falta luva da haste do registro, Registro soterrado',
    nomVistoriador: 'Sgt Roméro',
    matriculaVistoriador: '1997400',
    observacaoVistoria: 'Registro soterrado por terra e brita após obras da calçada.'
  };

  const changes = loadHydrantChanges();
  changes.updated['GUA00010'] = {
    ...changes.updated['GUA00010'],
    ...inspectionRecord
  };
  saveHydrantChanges(changes);

  const stored = loadHydrantChanges();
  const savedVistoria = stored.updated['GUA00010'];
  assert(savedVistoria, 'Vistoria deve estar gravada nas alterações do hidrante');
  assert(savedVistoria.flgAtivo === false, 'Hidrante deve ter status inoperante');
  assert(savedVistoria.problemasHidrante.includes('Falta luva'), 'Problemas devem estar registrados');
  assert(savedVistoria.nomVistoriador === 'Sgt Roméro', 'Nome do vistoriador gravado');
});

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  RESULTADO FINAL: ${passedTests}/${totalTests} TESTES PASSARAM COM SUCESSO!`);
console.log('═══════════════════════════════════════════════════════════════\n');

if (passedTests !== totalTests) {
  process.exit(1);
} else {
  process.exit(0);
}
