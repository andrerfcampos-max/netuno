/**
 * Catálogo de Missões Mock para a Fase de Testes - Super Argos / NETUNO
 * Popula todas as pastas fixas de quartéis e grupamentos (DEFAULT_FOLDERS)
 * com missões realistas distribuídas em:
 * - Não Iniciadas (Planejadas)
 * - Em Andamento (Parciais)
 * - Concluídas (100% vistoriadas)
 */

export const MOCK_TEST_MISSIONS = [
  // SEHUR
  {
    id: 'mock-m-sehur-1',
    name: 'Vistoria Estrutural - Esplanada dos Ministérios',
    atribuicao: 'SEHUR - Equipe Técnica 01',
    parentFolderId: 'f-sehur',
    createdAt: '2026-08-18T08:30:00.000Z',
    updatedAt: '2026-08-19T14:20:00.000Z',
    selectedIds: ['BSB00001', 'BSB00002', 'BSB00003', 'BSB00004'],
    completedIds: ['BSB00001', 'BSB00002'],
    isDraft: false
  },
  {
    id: 'mock-m-sehur-2',
    name: 'Inspeção Técnica de Alta Pressão - Setor Hoteleiro',
    atribuicao: 'SEHUR - Equipe de Engenharia',
    parentFolderId: 'f-sehur',
    createdAt: '2026-08-19T09:00:00.000Z',
    updatedAt: '2026-08-19T11:45:00.000Z',
    selectedIds: ['BSB00012', 'BSB00013', 'BSB00014'],
    completedIds: ['BSB00012', 'BSB00013', 'BSB00014'],
    isDraft: false
  },

  // 1º GBM - Brasília
  {
    id: 'mock-m-1gbm-1',
    name: 'Operação Eixo Monumental - Setor Bancário Sul',
    atribuicao: '1º GBM - Ala Alfa',
    parentFolderId: 'f-1gbm',
    createdAt: '2026-08-18T10:00:00.000Z',
    updatedAt: '2026-08-19T15:30:00.000Z',
    selectedIds: ['BSB00005', 'BSB00006', 'BSB00007', 'BSB00008', 'BSB00009'],
    completedIds: ['BSB00005', 'BSB00006', 'BSB00007'],
    isDraft: false
  },
  {
    id: 'mock-m-1gbm-2',
    name: 'Vistoria Preventiva - Setor Comercial Sul (SCS)',
    atribuicao: '1º GBM - Ala Charlie',
    parentFolderId: 'f-1gbm',
    createdAt: '2026-08-19T08:00:00.000Z',
    updatedAt: '2026-08-19T12:00:00.000Z',
    selectedIds: ['BSB00020', 'BSB00021', 'BSB00022'],
    completedIds: ['BSB00020', 'BSB00021', 'BSB00022'],
    isDraft: false
  },
  {
    id: 'mock-m-1gbm-3',
    name: 'Planejamento - Setor de Autarquias Sul',
    atribuicao: '1º GBM - 2º Pelotão',
    parentFolderId: 'f-1gbm',
    createdAt: '2026-08-20T07:30:00.000Z',
    updatedAt: '2026-08-20T07:30:00.000Z',
    selectedIds: ['BSB00030', 'BSB00031', 'BSB00032', 'BSB00033'],
    completedIds: [],
    isDraft: false
  },

  // 2º GBM - Taguatinga
  {
    id: 'mock-m-2gbm-1',
    name: 'Vistoria Comercial - Taguatinga Centro (C1 a C12)',
    atribuicao: '2º GBM - Ala Bravo',
    parentFolderId: 'f-2gbm',
    createdAt: '2026-08-17T09:15:00.000Z',
    updatedAt: '2026-08-18T16:40:00.000Z',
    selectedIds: ['TAG00001', 'TAG00002', 'TAG00003', 'TAG00004'],
    completedIds: ['TAG00001', 'TAG00002', 'TAG00003', 'TAG00004'],
    isDraft: false
  },
  {
    id: 'mock-m-2gbm-2',
    name: 'Operação Preventiva - Taguatinga Norte (QNF/QNJ)',
    atribuicao: '2º GBM - 1ª Cia',
    parentFolderId: 'f-2gbm',
    createdAt: '2026-08-19T08:20:00.000Z',
    updatedAt: '2026-08-19T14:10:00.000Z',
    selectedIds: ['TAG00010', 'TAG00011', 'TAG00012', 'TAG00013', 'TAG00014'],
    completedIds: ['TAG00010', 'TAG00011'],
    isDraft: false
  },
  {
    id: 'mock-m-2gbm-3',
    name: 'Inspeção Semanal - Pistão Sul Comercial',
    atribuicao: '2º GBM - Ala Alfa',
    parentFolderId: 'f-2gbm',
    createdAt: '2026-08-20T08:00:00.000Z',
    updatedAt: '2026-08-20T08:00:00.000Z',
    selectedIds: ['TAG00025', 'TAG00026', 'TAG00027'],
    completedIds: [],
    isDraft: false
  },

  // 3º GBM - SIA
  {
    id: 'mock-m-3gbm-1',
    name: 'Vistoria Setor de Cargas e Trechos 1 a 4',
    atribuicao: '3º GBM - Ala Charlie',
    parentFolderId: 'f-3gbm',
    createdAt: '2026-08-18T11:00:00.000Z',
    updatedAt: '2026-08-19T13:45:00.000Z',
    selectedIds: ['SIA00001', 'SIA00002', 'SIA00003', 'SIA00004'],
    completedIds: ['SIA00001', 'SIA00002'],
    isDraft: false
  },
  {
    id: 'mock-m-3gbm-2',
    name: 'Operação Feira dos Importados e Adjacências',
    atribuicao: '3º GBM - 1º Pelotão',
    parentFolderId: 'f-3gbm',
    createdAt: '2026-08-19T09:30:00.000Z',
    updatedAt: '2026-08-19T15:00:00.000Z',
    selectedIds: ['SIA00010', 'SIA00011', 'SIA00012'],
    completedIds: ['SIA00010', 'SIA00011', 'SIA00012'],
    isDraft: false
  },

  // 4º GBM - Asa Norte
  {
    id: 'mock-m-4gbm-1',
    name: 'Ronda SQN 102 a 106 - Área Residencial',
    atribuicao: '4º GBM - Ala Alfa',
    parentFolderId: 'f-4gbm',
    createdAt: '2026-08-17T08:00:00.000Z',
    updatedAt: '2026-08-18T10:30:00.000Z',
    selectedIds: ['BSB00100', 'BSB00101', 'BSB00102', 'BSB00103', 'BSB00104'],
    completedIds: ['BSB00100', 'BSB00101', 'BSB00102', 'BSB00103', 'BSB00104'],
    isDraft: false
  },
  {
    id: 'mock-m-4gbm-2',
    name: 'Inspeção Setor Hospitalar Norte e Campus UnB',
    atribuicao: '4º GBM - 2ª Cia',
    parentFolderId: 'f-4gbm',
    createdAt: '2026-08-19T10:15:00.000Z',
    updatedAt: '2026-08-20T09:00:00.000Z',
    selectedIds: ['BSB00120', 'BSB00121', 'BSB00122', 'BSB00123'],
    completedIds: ['BSB00120', 'BSB00121'],
    isDraft: false
  },

  // 6º GBM - Núcleo Bandeirante
  {
    id: 'mock-m-6gbm-1',
    name: 'Vistoria 3ª Avenida e Metropolitana',
    atribuicao: '6º GBM - Ala Bravo',
    parentFolderId: 'f-6gbm',
    createdAt: '2026-08-18T08:45:00.000Z',
    updatedAt: '2026-08-18T14:30:00.000Z',
    selectedIds: ['NBA00001', 'NBA00002', 'NBA00003'],
    completedIds: ['NBA00001', 'NBA00002', 'NBA00003'],
    isDraft: false
  },
  {
    id: 'mock-m-6gbm-2',
    name: 'Ronda Setor Divinéia e Parkway Próximo',
    atribuicao: '6º GBM - 1º Pelotão',
    parentFolderId: 'f-6gbm',
    createdAt: '2026-08-20T08:15:00.000Z',
    updatedAt: '2026-08-20T08:15:00.000Z',
    selectedIds: ['NBA00010', 'NBA00011', 'NBA00012'],
    completedIds: [],
    isDraft: false
  },

  // 7º GBM - Brazlândia
  {
    id: 'mock-m-7gbm-1',
    name: 'Operação Vila São José e Setor Tradicional',
    atribuicao: '7º GBM - Ala Alfa',
    parentFolderId: 'f-7gbm',
    createdAt: '2026-08-18T09:00:00.000Z',
    updatedAt: '2026-08-19T11:00:00.000Z',
    selectedIds: ['BRZ00001', 'BRZ00002', 'BRZ00003', 'BRZ00004'],
    completedIds: ['BRZ00001', 'BRZ00002'],
    isDraft: false
  },

  // 8º GBM - Ceilândia
  {
    id: 'mock-m-8gbm-1',
    name: 'Operação Ceilândia Centro - CNM 1 e 2',
    atribuicao: '8º GBM - Ala Charlie',
    parentFolderId: 'f-8gbm',
    createdAt: '2026-08-17T08:30:00.000Z',
    updatedAt: '2026-08-18T16:00:00.000Z',
    selectedIds: ['CEI00001', 'CEI00002', 'CEI00003', 'CEI00004', 'CEI00005'],
    completedIds: ['CEI00001', 'CEI00002', 'CEI00003', 'CEI00004', 'CEI00005'],
    isDraft: false
  },
  {
    id: 'mock-m-8gbm-2',
    name: 'Vistoria P Sul e Guariroba',
    atribuicao: '8º GBM - 1ª Cia',
    parentFolderId: 'f-8gbm',
    createdAt: '2026-08-19T07:45:00.000Z',
    updatedAt: '2026-08-19T13:20:00.000Z',
    selectedIds: ['CEI00015', 'CEI00016', 'CEI00017', 'CEI00018'],
    completedIds: ['CEI00015', 'CEI00016'],
    isDraft: false
  },
  {
    id: 'mock-m-8gbm-3',
    name: 'Inspeção Setor O - QNO 1 a 8',
    atribuicao: '8º GBM - Ala Alfa',
    parentFolderId: 'f-8gbm',
    createdAt: '2026-08-20T08:30:00.000Z',
    updatedAt: '2026-08-20T08:30:00.000Z',
    selectedIds: ['CEI00030', 'CEI00031', 'CEI00032'],
    completedIds: [],
    isDraft: false
  },

  // 9º GBM - Planaltina
  {
    id: 'mock-m-9gbm-1',
    name: 'Vistoria Setor Tradicional e Arapoanga',
    atribuicao: '9º GBM - Ala Bravo',
    parentFolderId: 'f-9gbm',
    createdAt: '2026-08-18T10:00:00.000Z',
    updatedAt: '2026-08-19T14:15:00.000Z',
    selectedIds: ['PLA00001', 'PLA00002', 'PLA00003', 'PLA00004'],
    completedIds: ['PLA00001', 'PLA00002'],
    isDraft: false
  },

  // 10º GBM - Paranoá
  {
    id: 'mock-m-10gbm-1',
    name: 'Ronda Avenida Paranoá e Paranoá Parque',
    atribuicao: '10º GBM - 1º Pelotão',
    parentFolderId: 'f-10gbm',
    createdAt: '2026-08-17T09:00:00.000Z',
    updatedAt: '2026-08-18T11:30:00.000Z',
    selectedIds: ['PAR00001', 'PAR00002', 'PAR00003'],
    completedIds: ['PAR00001', 'PAR00002', 'PAR00003'],
    isDraft: false
  },
  {
    id: 'mock-m-10gbm-2',
    name: 'Inspeção Itapoã Parque - Quadras 500',
    atribuicao: '10º GBM - Ala Alfa',
    parentFolderId: 'f-10gbm',
    createdAt: '2026-08-20T08:00:00.000Z',
    updatedAt: '2026-08-20T08:00:00.000Z',
    selectedIds: ['ITA00001', 'ITA00002', 'ITA00003'],
    completedIds: [],
    isDraft: false
  },

  // 11º GBM - Lago Sul
  {
    id: 'mock-m-11gbm-1',
    name: 'Vistoria SHIS QI 05 a 15 e Pontão',
    atribuicao: '11º GBM - Ala Charlie',
    parentFolderId: 'f-11gbm',
    createdAt: '2026-08-18T08:30:00.000Z',
    updatedAt: '2026-08-19T12:45:00.000Z',
    selectedIds: ['LAS00001', 'LAS00002', 'LAS00003', 'LAS00004'],
    completedIds: ['LAS00001', 'LAS00002'],
    isDraft: false
  },

  // 13º GBM - Guará I
  {
    id: 'mock-m-13gbm-1',
    name: 'Vistoria Polo de Modas e Guará II QE 15 a 28',
    atribuicao: '13º GBM - 2º Pelotão',
    parentFolderId: 'f-13gbm',
    createdAt: '2026-08-18T07:45:00.000Z',
    updatedAt: '2026-08-18T16:00:00.000Z',
    selectedIds: ['GUA00010', 'GUA00011', 'GUA00012', 'GUA00013', 'GUA00014'],
    completedIds: ['GUA00010', 'GUA00011', 'GUA00012', 'GUA00013', 'GUA00014'],
    isDraft: false
  },
  {
    id: 'mock-m-13gbm-2',
    name: 'Ronda Preventiva - Guará I QI 02 a 12',
    atribuicao: '13º GBM - Ala Alfa',
    parentFolderId: 'f-13gbm',
    createdAt: '2026-08-19T08:30:00.000Z',
    updatedAt: '2026-08-19T14:00:00.000Z',
    selectedIds: ['GUA00020', 'GUA00021', 'GUA00022', 'GUA00023'],
    completedIds: ['GUA00020', 'GUA00021'],
    isDraft: false
  },
  {
    id: 'mock-m-13gbm-3',
    name: 'Planejamento - Setor de Garagens e SOF Sul',
    atribuicao: '13º GBM - Ala Bravo',
    parentFolderId: 'f-13gbm',
    createdAt: '2026-08-20T08:00:00.000Z',
    updatedAt: '2026-08-20T08:00:00.000Z',
    selectedIds: ['GUA00030', 'GUA00031', 'GUA00032'],
    completedIds: [],
    isDraft: false
  },

  // 15º GBM - Asa Sul
  {
    id: 'mock-m-15gbm-1',
    name: 'Operação SQS 202 a 208 e W3 Sul',
    atribuicao: '15º GBM - Ala Bravo',
    parentFolderId: 'f-15gbm',
    createdAt: '2026-08-17T08:00:00.000Z',
    updatedAt: '2026-08-18T15:20:00.000Z',
    selectedIds: ['BSB00201', 'BSB00202', 'BSB00203', 'BSB00204'],
    completedIds: ['BSB00201', 'BSB00202', 'BSB00203', 'BSB00204'],
    isDraft: false
  },
  {
    id: 'mock-m-15gbm-2',
    name: 'Inspeção Setor Hospitalar Sul (SHS)',
    atribuicao: '15º GBM - 1ª Cia',
    parentFolderId: 'f-15gbm',
    createdAt: '2026-08-19T09:00:00.000Z',
    updatedAt: '2026-08-19T13:30:00.000Z',
    selectedIds: ['BSB00215', 'BSB00216', 'BSB00217', 'BSB00218'],
    completedIds: ['BSB00215', 'BSB00216'],
    isDraft: false
  },

  // 16º GBM - Gama
  {
    id: 'mock-m-16gbm-1',
    name: 'Vistoria Setor Central e Hospital Regional do Gama',
    atribuicao: '16º GBM - Ala Alfa',
    parentFolderId: 'f-16gbm',
    createdAt: '2026-08-17T09:30:00.000Z',
    updatedAt: '2026-08-18T17:00:00.000Z',
    selectedIds: ['GAM00001', 'GAM00002', 'GAM00003', 'GAM00004', 'GAM00005'],
    completedIds: ['GAM00001', 'GAM00002', 'GAM00003', 'GAM00004', 'GAM00005'],
    isDraft: false
  },
  {
    id: 'mock-m-16gbm-2',
    name: 'Ronda Preventiva - Setor Leste e Sul',
    atribuicao: '16º GBM - Ala Charlie',
    parentFolderId: 'f-16gbm',
    createdAt: '2026-08-19T08:15:00.000Z',
    updatedAt: '2026-08-19T14:45:00.000Z',
    selectedIds: ['GAM00012', 'GAM00013', 'GAM00014', 'GAM00015'],
    completedIds: ['GAM00012', 'GAM00013'],
    isDraft: false
  },
  {
    id: 'mock-m-16gbm-3',
    name: 'Planejamento - Setor Industrial e Ponte Alta',
    atribuicao: '16º GBM - 2º Pelotão',
    parentFolderId: 'f-16gbm',
    createdAt: '2026-08-20T08:00:00.000Z',
    updatedAt: '2026-08-20T08:00:00.000Z',
    selectedIds: ['GAM00025', 'GAM00026', 'GAM00027'],
    completedIds: [],
    isDraft: false
  },

  // 17º GBM - São Sebastião
  {
    id: 'mock-m-17gbm-1',
    name: 'Vistoria Residencial Oeste e Centro Tradicional',
    atribuicao: '17º GBM - Ala Alfa',
    parentFolderId: 'f-17gbm',
    createdAt: '2026-08-18T08:30:00.000Z',
    updatedAt: '2026-08-19T11:40:00.000Z',
    selectedIds: ['SEB00001', 'SEB00002', 'SEB00003', 'SEB00004'],
    completedIds: ['SEB00001', 'SEB00002'],
    isDraft: false
  },

  // 18º GBM - Santa Maria
  {
    id: 'mock-m-18gbm-1',
    name: 'Operação Santa Maria Norte - QR 201 a 215',
    atribuicao: '18º GBM - Ala Bravo',
    parentFolderId: 'f-18gbm',
    createdAt: '2026-08-18T09:00:00.000Z',
    updatedAt: '2026-08-19T16:00:00.000Z',
    selectedIds: ['STM00001', 'STM00002', 'STM00003', 'STM00004'],
    completedIds: ['STM00001', 'STM00002', 'STM00003', 'STM00004'],
    isDraft: false
  },
  {
    id: 'mock-m-18gbm-2',
    name: 'Vistoria Polo JK e Santa Maria Sul',
    atribuicao: '18º GBM - 1ª Cia',
    parentFolderId: 'f-18gbm',
    createdAt: '2026-08-20T07:30:00.000Z',
    updatedAt: '2026-08-20T07:30:00.000Z',
    selectedIds: ['STM00010', 'STM00011', 'STM00012'],
    completedIds: [],
    isDraft: false
  },

  // 19º GBM - Candangolândia
  {
    id: 'mock-m-19gbm-1',
    name: 'Inspeção QR 1 a 5 e Avenida Principal',
    atribuicao: '19º GBM - Ala Charlie',
    parentFolderId: 'f-19gbm',
    createdAt: '2026-08-18T08:00:00.000Z',
    updatedAt: '2026-08-18T15:00:00.000Z',
    selectedIds: ['CAN00001', 'CAN00002', 'CAN00003'],
    completedIds: ['CAN00001', 'CAN00002', 'CAN00003'],
    isDraft: false
  },

  // 21º GBM - Riacho Fundo I
  {
    id: 'mock-m-21gbm-1',
    name: 'Vistoria Riacho Fundo I - QN 1 a 7',
    atribuicao: '21º GBM - Ala Alfa',
    parentFolderId: 'f-21gbm',
    createdAt: '2026-08-19T08:30:00.000Z',
    updatedAt: '2026-08-19T14:30:00.000Z',
    selectedIds: ['RIA00001', 'RIA00002', 'RIA00003', 'RIA00004'],
    completedIds: ['RIA00001', 'RIA00002'],
    isDraft: false
  },

  // 22º GBM - Sobradinho
  {
    id: 'mock-m-22gbm-1',
    name: 'Ronda Quadras Centrais e Grande Colorado',
    atribuicao: '22º GBM - Ala Bravo',
    parentFolderId: 'f-22gbm',
    createdAt: '2026-08-17T09:00:00.000Z',
    updatedAt: '2026-08-18T16:20:00.000Z',
    selectedIds: ['SOB00001', 'SOB00002', 'SOB00003', 'SOB00004'],
    completedIds: ['SOB00001', 'SOB00002', 'SOB00003', 'SOB00004'],
    isDraft: false
  },
  {
    id: 'mock-m-22gbm-2',
    name: 'Inspeção Nova Colina e Fercal',
    atribuicao: '22º GBM - 2º Pelotão',
    parentFolderId: 'f-22gbm',
    createdAt: '2026-08-20T08:00:00.000Z',
    updatedAt: '2026-08-20T08:00:00.000Z',
    selectedIds: ['SOB00015', 'SOB00016', 'FER00001'],
    completedIds: [],
    isDraft: false
  },

  // 25º GBM - Águas Claras
  {
    id: 'mock-m-25gbm-1',
    name: 'Operação Av. Araucárias e Parque Ecológico',
    atribuicao: '25º GBM - Ala Alfa',
    parentFolderId: 'f-25gbm',
    createdAt: '2026-08-18T08:00:00.000Z',
    updatedAt: '2026-08-19T16:00:00.000Z',
    selectedIds: ['ACL00001', 'ACL00002', 'ACL00003', 'ACL00004', 'ACL00005'],
    completedIds: ['ACL00001', 'ACL00002', 'ACL00003', 'ACL00004', 'ACL00005'],
    isDraft: false
  },
  {
    id: 'mock-m-25gbm-2',
    name: 'Vistoria Av. Castanheiras e Arniqueira',
    atribuicao: '25º GBM - 1ª Cia',
    parentFolderId: 'f-25gbm',
    createdAt: '2026-08-19T09:00:00.000Z',
    updatedAt: '2026-08-20T09:30:00.000Z',
    selectedIds: ['ACL00010', 'ACL00011', 'ACL00012', 'ARN00001'],
    completedIds: ['ACL00010', 'ACL00011'],
    isDraft: false
  },
  {
    id: 'mock-m-25gbm-3',
    name: 'Inspeção Setor Habitacional Vicente Pires',
    atribuicao: '25º GBM - Ala Charlie',
    parentFolderId: 'f-25gbm',
    createdAt: '2026-08-20T08:30:00.000Z',
    updatedAt: '2026-08-20T08:30:00.000Z',
    selectedIds: ['VIC00001', 'VIC00002', 'VIC00003'],
    completedIds: [],
    isDraft: false
  },

  // 34º GBM - Lago Norte
  {
    id: 'mock-m-34gbm-1',
    name: 'Vistoria Península Norte - QL 01 a 10',
    atribuicao: '34º GBM - Ala Alfa',
    parentFolderId: 'f-34gbm',
    createdAt: '2026-08-18T08:30:00.000Z',
    updatedAt: '2026-08-19T14:00:00.000Z',
    selectedIds: ['LAN00001', 'LAN00002', 'LAN00003', 'LAN00004'],
    completedIds: ['LAN00001', 'LAN00002'],
    isDraft: false
  },

  // 36º GBM - Recanto das Emas Central
  {
    id: 'mock-m-36gbm-1',
    name: 'Operação Comercial - Quadras 100 a 108',
    atribuicao: '36º GBM - Ala Bravo',
    parentFolderId: 'f-36gbm',
    createdAt: '2026-08-17T08:00:00.000Z',
    updatedAt: '2026-08-18T15:00:00.000Z',
    selectedIds: ['REC00001', 'REC00002', 'REC00003', 'REC00004'],
    completedIds: ['REC00001', 'REC00002', 'REC00003', 'REC00004'],
    isDraft: false
  },
  {
    id: 'mock-m-36gbm-2',
    name: 'Vistoria Preventiva - Quadras 300 e 400',
    atribuicao: '36º GBM - 2º Pelotão',
    parentFolderId: 'f-36gbm',
    createdAt: '2026-08-20T08:00:00.000Z',
    updatedAt: '2026-08-20T08:00:00.000Z',
    selectedIds: ['REC00015', 'REC00016', 'REC00017'],
    completedIds: [],
    isDraft: false
  },

  // 37º GBM - Samambaia Centro
  {
    id: 'mock-m-37gbm-1',
    name: 'Vistoria 1ª Avenida Norte e Centro Urbano',
    atribuicao: '37º GBM - Ala Charlie',
    parentFolderId: 'f-37gbm',
    createdAt: '2026-08-18T08:00:00.000Z',
    updatedAt: '2026-08-19T16:30:00.000Z',
    selectedIds: ['SAM00001', 'SAM00002', 'SAM00003', 'SAM00004', 'SAM00005'],
    completedIds: ['SAM00001', 'SAM00002', 'SAM00003', 'SAM00004', 'SAM00005'],
    isDraft: false
  },
  {
    id: 'mock-m-37gbm-2',
    name: 'Operação Samambaia Sul - QR 301 a 315',
    atribuicao: '37º GBM - 1ª Cia',
    parentFolderId: 'f-37gbm',
    createdAt: '2026-08-19T09:00:00.000Z',
    updatedAt: '2026-08-19T15:00:00.000Z',
    selectedIds: ['SAM00015', 'SAM00016', 'SAM00017', 'SAM00018'],
    completedIds: ['SAM00015', 'SAM00016'],
    isDraft: false
  },

  // 37º GBM / SIERRA 3 - BR 060
  {
    id: 'mock-m-37gbm-sierra3-1',
    name: 'Vistoria Corredor BR-060 e QR 500',
    atribuicao: '37º GBM / Sierra 3',
    parentFolderId: 'f-37gbm-sierra3',
    createdAt: '2026-08-19T08:30:00.000Z',
    updatedAt: '2026-08-19T14:20:00.000Z',
    selectedIds: ['SAM00050', 'SAM00051', 'SAM00052'],
    completedIds: ['SAM00050', 'SAM00051', 'SAM00052'],
    isDraft: false
  },

  // 41º GBM - Setor Industrial da Ceilândia
  {
    id: 'mock-m-41gbm-1',
    name: 'Vistoria Setor de Indústrias da Ceilândia e Pôr do Sol',
    atribuicao: '41º GBM - Ala Alfa',
    parentFolderId: 'f-41gbm',
    createdAt: '2026-08-18T09:00:00.000Z',
    updatedAt: '2026-08-19T15:00:00.000Z',
    selectedIds: ['CEI00050', 'CEI00051', 'CEI00052', 'POR00001'],
    completedIds: ['CEI00050', 'CEI00051'],
    isDraft: false
  },

  // 45º GBM - Sudoeste e Octogonal
  {
    id: 'mock-m-45gbm-1',
    name: 'Operação CCSW / QRSW - Comercial Sudoeste',
    atribuicao: '45º GBM - Ala Bravo',
    parentFolderId: 'f-45gbm',
    createdAt: '2026-08-17T08:30:00.000Z',
    updatedAt: '2026-08-18T14:45:00.000Z',
    selectedIds: ['SUD00001', 'SUD00002', 'SUD00003', 'OCT00001'],
    completedIds: ['SUD00001', 'SUD00002', 'SUD00003', 'OCT00001'],
    isDraft: false
  },
  {
    id: 'mock-m-45gbm-2',
    name: 'Inspeção Setor Sudoeste Residencial SQSW 101 a 105',
    atribuicao: '45º GBM - 1º Pelotão',
    parentFolderId: 'f-45gbm',
    createdAt: '2026-08-20T08:00:00.000Z',
    updatedAt: '2026-08-20T08:00:00.000Z',
    selectedIds: ['SUD00010', 'SUD00011', 'SUD00012'],
    completedIds: [],
    isDraft: false
  },

  // Grupamentos Especializados
  {
    id: 'mock-m-gaeph-1',
    name: 'Rotas de Emergência e Resposta Pré-Hospitalar',
    atribuicao: 'GAEPH - Prontidão Técnica',
    parentFolderId: 'f-gaeph',
    createdAt: '2026-08-18T08:00:00.000Z',
    updatedAt: '2026-08-19T11:30:00.000Z',
    selectedIds: ['BSB00010', 'BSB00011', 'GUA00005'],
    completedIds: ['BSB00010', 'BSB00011'],
    isDraft: false
  },
  {
    id: 'mock-m-gavop-1',
    name: 'Vistoria Helipontos e Áreas Aeroportuárias',
    atribuicao: 'GAVOP - Equipe de Solo',
    parentFolderId: 'f-gavop',
    createdAt: '2026-08-18T09:00:00.000Z',
    updatedAt: '2026-08-19T15:00:00.000Z',
    selectedIds: ['LAS00020', 'LAS00021', 'BSB00025'],
    completedIds: ['LAS00020', 'LAS00021', 'BSB00025'],
    isDraft: false
  },
  {
    id: 'mock-m-gbmot-1',
    name: 'Rotas Rápidas de Motomecanização - Eixos Norte/Sul',
    atribuicao: 'GBMOT - Patrulha Ágil',
    parentFolderId: 'f-gbmot',
    createdAt: '2026-08-19T08:00:00.000Z',
    updatedAt: '2026-08-19T13:00:00.000Z',
    selectedIds: ['BSB00030', 'BSB00031', 'BSB00032'],
    completedIds: ['BSB00030', 'BSB00031'],
    isDraft: false
  },
  {
    id: 'mock-m-gbs-1',
    name: 'Vistoria Orla do Lago Paranoá e Clubes',
    atribuicao: 'GBS - Equipe Aquática',
    parentFolderId: 'f-gbs',
    createdAt: '2026-08-18T10:00:00.000Z',
    updatedAt: '2026-08-18T16:00:00.000Z',
    selectedIds: ['LAS00030', 'LAS00031', 'LAN00015'],
    completedIds: ['LAS00030', 'LAS00031', 'LAN00015'],
    isDraft: false
  },
  {
    id: 'mock-m-gpciu-1',
    name: 'Inspeção Complexos Históricos e Edifícios Públicos',
    atribuicao: 'GPCIU - Seção de Prevenção',
    parentFolderId: 'f-gpciu',
    createdAt: '2026-08-19T08:30:00.000Z',
    updatedAt: '2026-08-19T14:00:00.000Z',
    selectedIds: ['BSB00040', 'BSB00041', 'BSB00042'],
    completedIds: ['BSB00040', 'BSB00041'],
    isDraft: false
  },
  {
    id: 'mock-m-gpram-1',
    name: 'Vistoria Perímetro Floresta Nacional e Parque Água Mineral',
    atribuicao: 'GPRAM - Brigada Ambiental',
    parentFolderId: 'f-gpram',
    createdAt: '2026-08-18T09:00:00.000Z',
    updatedAt: '2026-08-19T12:00:00.000Z',
    selectedIds: ['PAN00001', 'BRZ00010', 'TAG00040'],
    completedIds: ['PAN00001', 'BRZ00010'],
    isDraft: false
  },
  {
    id: 'mock-m-gpram-sam-1',
    name: 'Inspeção Parque Ecológico Três Meninas',
    atribuicao: 'GPRAM / Samambaia',
    parentFolderId: 'f-gpram-sam',
    createdAt: '2026-08-19T08:00:00.000Z',
    updatedAt: '2026-08-19T14:30:00.000Z',
    selectedIds: ['SAM00030', 'SAM00031', 'SAM00032'],
    completedIds: ['SAM00030', 'SAM00031', 'SAM00032'],
    isDraft: false
  },
  {
    id: 'mock-m-op-externa-1',
    name: 'Operação Grandes Eventos - Eixo Monumental e Estádio',
    atribuicao: 'OP EXTERNA - Comando de Operações',
    parentFolderId: 'f-op-externa',
    createdAt: '2026-08-20T07:00:00.000Z',
    updatedAt: '2026-08-20T07:00:00.000Z',
    selectedIds: ['BSB00050', 'BSB00051', 'BSB00052'],
    completedIds: [],
    isDraft: false
  }
];
