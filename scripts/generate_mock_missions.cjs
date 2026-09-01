const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const dbPath = path.join(rootDir, 'public', 'base-de-dados.xlsx');
const wb = xlsx.readFile(dbPath);
const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

const validHydrants = data.filter(h => {
  const code = String(h.nomHidrante || h.codHidrante || '').trim();
  return code && !code.startsWith('-15') && !code.startsWith('OBS');
});

const byPrefix = {};
validHydrants.forEach(h => {
  const code = String(h.nomHidrante || h.codHidrante || '').trim();
  const pfx = code.substring(0, 3).toUpperCase();
  if (!byPrefix[pfx]) byPrefix[pfx] = [];
  byPrefix[pfx].push(code);
});

const folderConfig = [
  {
    id: 'f-sehur',
    name: 'SEHUR',
    pfx: ['BSB', 'SIA'],
    missions: [
      { name: 'Vistoria Estrutural - Esplanada dos Ministérios', atribuicao: 'SEHUR - Equipe Técnica 01', status: 'concluida' },
      { name: 'Inspeção Técnica - Setor de Autarquias e Hoteleiro', atribuicao: 'SEHUR - Equipe de Engenharia', status: 'andamento' },
      { name: 'Planejamento de Vistoria - SIA Trechos Centrais', atribuicao: 'SEHUR - Vistoria Preventiva', status: 'planejada' }
    ]
  },
  {
    id: 'f-1gbm',
    name: '1º GBM - Brasília',
    pfx: ['BSB'],
    missions: [
      { name: 'Operação Eixo Monumental - Setor Bancário Sul', atribuicao: '1º GBM - Ala Alfa', status: 'concluida' },
      { name: 'Vistoria Comercial - Setor Comercial Sul (SCS)', atribuicao: '1º GBM - Ala Charlie', status: 'andamento' },
      { name: 'Planejamento - Setor de Rádio e TV Sul (SRTVS)', atribuicao: '1º GBM - 2º Pelotão', status: 'planejada' }
    ]
  },
  {
    id: 'f-2gbm',
    name: '2º GBM - Taguatinga',
    pfx: ['TAG'],
    missions: [
      { name: 'Vistoria Taguatinga Centro - C 01 a C 12', atribuicao: '2º GBM - Ala Bravo', status: 'concluida' },
      { name: 'Operação Preventiva - Taguatinga Norte (QNF/QNJ)', atribuicao: '2º GBM - 1ª Cia', status: 'andamento' },
      { name: 'Inspeção Pistão Sul e Setor D Sul', atribuicao: '2º GBM - Ala Alfa', status: 'planejada' }
    ]
  },
  {
    id: 'f-3gbm',
    name: '3º GBM - SIA',
    pfx: ['SIA', 'SCI'],
    missions: [
      { name: 'Vistoria SIA Trechos 1 a 4 e Setor de Cargas', atribuicao: '3º GBM - Ala Charlie', status: 'concluida' },
      { name: 'Operação Feira dos Importados e Estrutural', atribuicao: '3º GBM - 1º Pelotão', status: 'andamento' },
      { name: 'Inspeção Estrutural - Quadras Centrais', atribuicao: '3º GBM - Ala Bravo', status: 'planejada' }
    ]
  },
  {
    id: 'f-4gbm',
    name: '4º GBM - Asa Norte',
    pfx: ['BSB'],
    missions: [
      { name: 'Ronda SQN 102 a 108 - Área Residencial', atribuicao: '4º GBM - Ala Alfa', status: 'concluida' },
      { name: 'Inspeção Setor Hospitalar Norte e Campus Darcy Ribeiro', atribuicao: '4º GBM - 2ª Cia', status: 'andamento' },
      { name: 'Planejamento - SQN 400 a 412 Asa Norte', atribuicao: '4º GBM - 1º Pelotão', status: 'planejada' }
    ]
  },
  {
    id: 'f-6gbm',
    name: '6º GBM - Núcleo Bandeirante',
    pfx: ['NBA', 'PAW'],
    missions: [
      { name: 'Vistoria 3ª Avenida e Metropolitana', atribuicao: '6º GBM - Ala Bravo', status: 'concluida' },
      { name: 'Ronda Setor Divinéia e Park Way SMPW', atribuicao: '6º GBM - 1º Pelotão', status: 'andamento' },
      { name: 'Inspeção SMPW Quadras 01 a 08', atribuicao: '6º GBM - Ala Alfa', status: 'planejada' }
    ]
  },
  {
    id: 'f-7gbm',
    name: '7º GBM - Brazlândia',
    pfx: ['BRZ'],
    missions: [
      { name: 'Operação Vila São José e Setor Tradicional', atribuicao: '7º GBM - Ala Alfa', status: 'concluida' },
      { name: 'Vistoria Setor Norte e Setor Sul', atribuicao: '7º GBM - 2º Pelotão', status: 'andamento' },
      { name: 'Inspeção Setor de Expansão e Chácaras', atribuicao: '7º GBM - Ala Charlie', status: 'planejada' }
    ]
  },
  {
    id: 'f-8gbm',
    name: '8º GBM - Ceilândia',
    pfx: ['CEI', 'SNP'],
    missions: [
      { name: 'Operação Ceilândia Centro - CNM 1 e 2', atribuicao: '8º GBM - Ala Charlie', status: 'concluida' },
      { name: 'Vistoria P Sul e Guariroba - QNP/QNN', atribuicao: '8º GBM - 1ª Cia', status: 'andamento' },
      { name: 'Inspeção Setor O e Sol Nascente', atribuicao: '8º GBM - Ala Alfa', status: 'planejada' }
    ]
  },
  {
    id: 'f-9gbm',
    name: '9º GBM - Planaltina',
    pfx: ['PLA', 'AEM'],
    missions: [
      { name: 'Vistoria Setor Tradicional e Centro Histórico', atribuicao: '9º GBM - Ala Bravo', status: 'concluida' },
      { name: 'Operação Preventiva Arapoanga e Buritis', atribuicao: '9º GBM - 1ª Cia', status: 'andamento' },
      { name: 'Inspeção ESECAE e Águas Emendadas', atribuicao: '9º GBM - Ala Alfa', status: 'planejada' }
    ]
  },
  {
    id: 'f-10gbm',
    name: '10º GBM - Paranoá',
    pfx: ['PAR', 'ITA'],
    missions: [
      { name: 'Ronda Avenida Paranoá e Paranoá Parque', atribuicao: '10º GBM - 1º Pelotão', status: 'concluida' },
      { name: 'Inspeção Itapoã Parque - Quadras Centrais', atribuicao: '10º GBM - Ala Alfa', status: 'andamento' },
      { name: 'Planejamento - Setor de Mansões do Lago (SML)', atribuicao: '10º GBM - Ala Charlie', status: 'planejada' }
    ]
  },
  {
    id: 'f-11gbm',
    name: '11º GBM - Lago Sul',
    pfx: ['LAS', 'JAR'],
    missions: [
      { name: 'Vistoria SHIS QI 05 a 15 e Pontão do Lago Sul', atribuicao: '11º GBM - Ala Charlie', status: 'concluida' },
      { name: 'Ronda Preventiva SHIS QL 16 a 28', atribuicao: '11º GBM - 2º Pelotão', status: 'andamento' },
      { name: 'Inspeção Jardim Botânico e Mansões Dom Bosco', atribuicao: '11º GBM - Ala Alfa', status: 'planejada' }
    ]
  },
  {
    id: 'f-13gbm',
    name: '13º GBM - Guará I',
    pfx: ['GUA'],
    missions: [
      { name: 'Vistoria Polo de Modas e Guará II QE 15 a 28', atribuicao: '13º GBM - 2º Pelotão', status: 'concluida' },
      { name: 'Ronda Preventiva - Guará I QI 02 a 12', atribuicao: '13º GBM - Ala Alfa', status: 'andamento' },
      { name: 'Planejamento - Setor de Garagens e SOF Sul', atribuicao: '13º GBM - Ala Bravo', status: 'planejada' }
    ]
  },
  {
    id: 'f-15gbm',
    name: '15º GBM - Asa Sul',
    pfx: ['BSB'],
    missions: [
      { name: 'Operação SQS 202 a 208 e W3 Sul', atribuicao: '15º GBM - Ala Bravo', status: 'concluida' },
      { name: 'Inspeção Setor Hospitalar Sul (SHS)', atribuicao: '15º GBM - 1ª Cia', status: 'andamento' },
      { name: 'Ronda SQS 400 a 416 - Eixinho Sul', atribuicao: '15º GBM - Ala Alfa', status: 'planejada' }
    ]
  },
  {
    id: 'f-16gbm',
    name: '16º GBM - Gama',
    pfx: ['GAM'],
    missions: [
      { name: 'Operação Setor Central e Praça do Relógio', atribuicao: '16º GBM - Ala Alfa', status: 'concluida' },
      { name: 'Vistoria Setor Leste e Setor de Indústrias', atribuicao: '16º GBM - Ala Bravo', status: 'andamento' },
      { name: 'Inspeção Setor Sul e DVO Gama', atribuicao: '16º GBM - 2º Pelotão', status: 'planejada' }
    ]
  },
  {
    id: 'f-17gbm',
    name: '17º GBM - São Sebastião',
    pfx: ['SEB'],
    missions: [
      { name: 'Vistoria Residencial Bosque e Bairro São José', atribuicao: '17º GBM - Ala Charlie', status: 'concluida' },
      { name: 'Operação Vila Nova e Morro da Cruz', atribuicao: '17º GBM - 1ª Cia', status: 'andamento' },
      { name: 'Inspeção Bairro São Francisco e Centro', atribuicao: '17º GBM - Ala Alfa', status: 'planejada' }
    ]
  },
  {
    id: 'f-18gbm',
    name: '18º GBM - Santa Maria',
    pfx: ['STM'],
    missions: [
      { name: 'Operação Santa Maria Norte - QR 100 a 200', atribuicao: '18º GBM - 1º Pelotão', status: 'concluida' },
      { name: 'Vistoria Santa Maria Sul - QR 300 a 400', atribuicao: '18º GBM - Ala Bravo', status: 'andamento' },
      { name: 'Inspeção Total Ville e Setor Habitacional Ribeirão', atribuicao: '18º GBM - Ala Alfa', status: 'planejada' }
    ]
  },
  {
    id: 'f-19gbm',
    name: '19º GBM - Candangolândia',
    pfx: ['CAN'],
    missions: [
      { name: 'Vistoria Quadras Centrais QOF e QR', atribuicao: '19º GBM - Ala Alfa', status: 'concluida' },
      { name: 'Ronda Setor de Transportes e Serviços', atribuicao: '19º GBM - 1ª Cia', status: 'andamento' },
      { name: 'Inspeção Praça dos Estados e Entorno', atribuicao: '19º GBM - Ala Charlie', status: 'planejada' }
    ]
  },
  {
    id: 'f-21gbm',
    name: '21º GBM - Riacho Fundo I',
    pfx: ['RIA', 'RF2'],
    missions: [
      { name: 'Operação Riacho Fundo I - QN 01 a 07', atribuicao: '21º GBM - Ala Bravo', status: 'concluida' },
      { name: 'Vistoria Riacho Fundo II - QN 10 a 16', atribuicao: '21º GBM - 2º Pelotão', status: 'andamento' },
      { name: 'Inspeção Setor Placa das Mercedes e Caub', atribuicao: '21º GBM - Ala Alfa', status: 'planejada' }
    ]
  },
  {
    id: 'f-22gbm',
    name: '22º GBM - Sobradinho',
    pfx: ['SOB', 'SO2', 'FER'],
    missions: [
      { name: 'Vistoria Quadras Centrais 01 a 08 Sobradinho I', atribuicao: '22º GBM - Ala Alfa', status: 'concluida' },
      { name: 'Operação Sobradinho II - AR 05 a 12', atribuicao: '22º GBM - 1ª Cia', status: 'andamento' },
      { name: 'Inspeção Fercal e Setor de Mansões Sobradinho', atribuicao: '22º GBM - Ala Charlie', status: 'planejada' }
    ]
  },
  {
    id: 'f-25gbm',
    name: '25º GBM - Águas Claras',
    pfx: ['ACL', 'ARN'],
    missions: [
      { name: 'Operação Boulevard Norte e Parque Ecológico', atribuicao: '25º GBM - Ala Charlie', status: 'concluida' },
      { name: 'Vistoria Boulevard Sul e Avenidas Araucárias/Castanheiras', atribuicao: '25º GBM - 2º Pelotão', status: 'andamento' },
      { name: 'Inspeção Setor Habitacional Arniqueira', atribuicao: '25º GBM - Ala Alfa', status: 'planejada' }
    ]
  },
  {
    id: 'f-34gbm',
    name: '34º GBM - Lago Norte',
    pfx: ['LAN', 'TAQ', 'VAR'],
    missions: [
      { name: 'Vistoria SHIN CA 01 a 11 e Centro de Atividades', atribuicao: '34º GBM - Ala Bravo', status: 'concluida' },
      { name: 'Ronda SHIN QL e QI 01 a 16 Lago Norte', atribuicao: '34º GBM - 1º Pelotão', status: 'andamento' },
      { name: 'Inspeção Setor Habitacional Taquari e Varjão', atribuicao: '34º GBM - Ala Alfa', status: 'planejada' }
    ]
  },
  {
    id: 'f-36gbm',
    name: '36º GBM - Recanto das Emas Central',
    pfx: ['REC'],
    missions: [
      { name: 'Operação Avenida Central - Quadras 100 e 200', atribuicao: '36º GBM - Ala Alfa', status: 'concluida' },
      { name: 'Vistoria Recanto Sul - Quadras 300 e 400', atribuicao: '36º GBM - 2ª Cia', status: 'andamento' },
      { name: 'Inspeção Quadras 500 a 800 e Setor de Chácaras', atribuicao: '36º GBM - Ala Charlie', status: 'planejada' }
    ]
  },
  {
    id: 'f-37gbm',
    name: '37º GBM - Samambaia Centro',
    pfx: ['SAM'],
    missions: [
      { name: 'Operação Samambaia Sul - QN 100 a 300', atribuicao: '37º GBM - Ala Charlie', status: 'concluida' },
      { name: 'Vistoria Samambaia Norte - QN 200 a 400', atribuicao: '37º GBM - 1º Pelotão', status: 'andamento' },
      { name: 'Inspeção Eixo Central de Samambaia', atribuicao: '37º GBM - Ala Alfa', status: 'planejada' }
    ]
  },
  {
    id: 'f-37gbm-sierra3',
    name: '37º GBM/ SIERRA 3 - Subgrupamento BR 060',
    pfx: ['SAM'],
    missions: [
      { name: 'Operação Corredor BR-060 e QS 500 Samambaia', atribuicao: '37º GBM / SIERRA 3 - Ala A', status: 'concluida' },
      { name: 'Vistoria Expansão Samambaia - Quadras 600 a 800', atribuicao: '37º GBM / SIERRA 3 - Ala B', status: 'andamento' },
      { name: 'Inspeção Perímetro Rodoviário BR-060 e Galpões', atribuicao: '37º GBM / SIERRA 3 - 2º Pelotão', status: 'planejada' }
    ]
  },
  {
    id: 'f-41gbm',
    name: '41º GBM - Setor Industrial da Ceilândia',
    pfx: ['CEI'],
    missions: [
      { name: 'Operação Setor Industrial e P Norte - QNP', atribuicao: '41º GBM - Ala Alfa', status: 'concluida' },
      { name: 'Vistoria Ceilândia Norte - QNN 11 a 25', atribuicao: '41º GBM - 1ª Cia', status: 'andamento' },
      { name: 'Inspeção Setor de Indústria e Materiais Ceilândia', atribuicao: '41º GBM - Ala Bravo', status: 'planejada' }
    ]
  },
  {
    id: 'f-45gbm',
    name: '45º GBM - Sudoeste e Octogonal',
    pfx: ['SUD', 'OCT', 'CRU'],
    missions: [
      { name: 'Vistoria Quadras Centrais QSW / CCSW Sudoeste', atribuicao: '45º GBM - Ala Bravo', status: 'concluida' },
      { name: 'Operação AOS 01 a 08 Octogonal e Cruzeiro Novo', atribuicao: '45º GBM - 2º Pelotão', status: 'andamento' },
      { name: 'Inspeção Cruzeiro Velho e Setor de Grandes Áreas', atribuicao: '45º GBM - Ala Alfa', status: 'planejada' }
    ]
  },
  {
    id: 'f-gaeph',
    name: 'GAEPH - GRUPAMENTO DE ATENDIMENTO DE EMERGÊNCIA PRÉ-HOSPITALAR',
    pfx: ['BSB', 'SIA', 'VIC'],
    missions: [
      { name: 'Ronda Tática APH - Eixo Rodoviário e Centros Médicos', atribuicao: 'GAEPH - Equipe Alpha', status: 'concluida' },
      { name: 'Vistoria de Rotas de Emergência e Resgate', atribuicao: 'GAEPH - 1º Socorro', status: 'andamento' },
      { name: 'Inspeção Pontos Críticos de Deslocamento Rápido', atribuicao: 'GAEPH - Ala Bravo', status: 'planejada' }
    ]
  },
  {
    id: 'f-gavop',
    name: 'GAVOP - GRUPAMENTO DE AVIAÇÃO OPERACIONAL',
    pfx: ['BSB', 'LAS'],
    missions: [
      { name: 'Inspeção Helipontos Oficiais e Eixo Aeroportuário', atribuicao: 'GAVOP - Equipe Aerotática', status: 'concluida' },
      { name: 'Vistoria Perímetro Hangar e Setor de Concessionárias', atribuicao: 'GAVOP - Seção de Apoio', status: 'andamento' },
      { name: 'Planejamento Pontos de Abastecimento para Aeronaves', atribuicao: 'GAVOP - Ala Alfa', status: 'planejada' }
    ]
  },
  {
    id: 'f-gbmot',
    name: 'GBMOT - GRUPAMENTO DE BOMBEIRO MILITAR DE MOTOMECANIZAÇÃO',
    pfx: ['TAG', 'SIA', 'BSB'],
    missions: [
      { name: 'Patrulhamento Preventivo - Vias Expressas EPTG/EPIAL', atribuicao: 'GBMOT - Equipe Motos Alpha', status: 'concluida' },
      { name: 'Vistoria Rápida Vias de Escoamento SIA/Taguatinga', atribuicao: 'GBMOT - 1º Pelotão', status: 'andamento' },
      { name: 'Inspeção Corredor Estrutural e Linha Verde', atribuicao: 'GBMOT - Ala Bravo', status: 'planejada' }
    ]
  },
  {
    id: 'f-gbs',
    name: 'GBS - GRUPAMENTO DE BUSCA E SALVAMENTO',
    pfx: ['LAS', 'LAN'],
    missions: [
      { name: 'Vistoria Orla do Lago Paranoá e Clubes Náuticos', atribuicao: 'GBS - Equipe Aquática', status: 'concluida' },
      { name: 'Inspeção Setor de Clubes Sul e Pontão', atribuicao: 'GBS - 1º Pelotão', status: 'andamento' },
      { name: 'Planejamento Orla Norte e Píers Públicos', atribuicao: 'GBS - Ala Alfa', status: 'planejada' }
    ]
  },
  {
    id: 'f-gpciu',
    name: 'GPCIU - GRUPAMENTO DE PREVENÇÃO E COMBATE A INCÊNDIO URBANO',
    pfx: ['BSB'],
    missions: [
      { name: 'Inspeção Complexos Históricos e Edifícios Públicos', atribuicao: 'GPCIU - Seção de Prevenção', status: 'concluida' },
      { name: 'Vistoria de Alta Densidade - Setor Bancário e Hoteleiro', atribuicao: 'GPCIU - Vistoria Tática', status: 'andamento' },
      { name: 'Planejamento Setor Comercial e Esplanada', atribuicao: 'GPCIU - Ala Charlie', status: 'planejada' }
    ]
  },
  {
    id: 'f-gpram',
    name: 'GPRAM - GRUPAMENTO DE PROTEÇÃO AMBIENTAL',
    pfx: ['PAN', 'BRZ', 'PAW'],
    missions: [
      { name: 'Vistoria Perímetro Parque Nacional e Água Mineral', atribuicao: 'GPRAM - Brigada Ambiental', status: 'concluida' },
      { name: 'Inspeção APA das Bacias e Reservatórios do Descoberto', atribuicao: 'GPRAM - 1ª Cia', status: 'andamento' },
      { name: 'Planejamento Área de Preservação Park Way e Serrinha', atribuicao: 'GPRAM - Ala Alfa', status: 'planejada' }
    ]
  },
  {
    id: 'f-gpram-sam',
    name: 'GPRAM/SAMAMBAIA - GPRAM/SAMAMBAIA',
    pfx: ['SAM'],
    missions: [
      { name: 'Inspeção Parque Ecológico Três Meninas', atribuicao: 'GPRAM / Samambaia - Ala A', status: 'concluida' },
      { name: 'Vistoria Área de Preservação Samambaia Sul', atribuicao: 'GPRAM / Samambaia - Ala B', status: 'andamento' },
      { name: 'Ronda Mata do Córrego e Reserva Ambiental', atribuicao: 'GPRAM / Samambaia - 1º Pel', status: 'planejada' }
    ]
  },
  {
    id: 'f-op-externa',
    name: 'OP EXTERNA - OPERAÇÕES EXTERNAS',
    pfx: ['BSB'],
    missions: [
      { name: 'Operação Grandes Eventos - Estádio Mané Garrincha', atribuicao: 'OP EXTERNA - Comando de Operações', status: 'concluida' },
      { name: 'Vistoria Parque da Cidade Dona Sarah Kubitschek', atribuicao: 'OP EXTERNA - 1º Pelotão', status: 'andamento' },
      { name: 'Inspeção Torre de TV e Feira de Artesanato', atribuicao: 'OP EXTERNA - Ala Alfa', status: 'planejada' }
    ]
  }
];

const generatedMissions = [];
let missionCounter = 1;

folderConfig.forEach(cfg => {
  let pool = [];
  cfg.pfx.forEach(p => {
    if (byPrefix[p]) pool.push(...byPrefix[p]);
  });
  if (pool.length === 0) {
    pool = [...(byPrefix['BSB'] || [])];
  }

  cfg.missions.forEach((mDef, mIdx) => {
    const missionId = `mock-m-${cfg.id.replace('f-', '')}-${missionCounter++}`;
    const startIdx = (mIdx * 5) % Math.max(1, pool.length - 5);
    const count = Math.min(5, pool.length);
    const selectedIds = [];
    
    for (let i = 0; i < count; i++) {
      const idx = (startIdx + i) % pool.length;
      if (!selectedIds.includes(pool[idx])) {
        selectedIds.push(pool[idx]);
      }
    }
    let fillIdx = 0;
    while (selectedIds.length < 5 && fillIdx < pool.length) {
      if (!selectedIds.includes(pool[fillIdx])) {
        selectedIds.push(pool[fillIdx]);
      }
      fillIdx++;
    }

    let completedIds = [];
    if (mDef.status === 'concluida') {
      completedIds = [...selectedIds];
    } else if (mDef.status === 'andamento') {
      completedIds = selectedIds.slice(0, Math.ceil(selectedIds.length / 2));
    } else {
      completedIds = [];
    }

    generatedMissions.push({
      id: missionId,
      name: mDef.name,
      atribuicao: mDef.atribuicao,
      parentFolderId: cfg.id,
      createdAt: '2026-08-18T08:00:00.000Z',
      updatedAt: '2026-08-19T15:00:00.000Z',
      selectedIds,
      completedIds,
      isDraft: false
    });
  });
});

const fileContent = `// Catálogo Oficial de Missões Mock com Hidrantes 100% Reais da Base de Dados
export const MOCK_TEST_MISSIONS = ` + JSON.stringify(generatedMissions, null, 2) + `;\n`;

const targetPath = path.join(rootDir, 'src', 'utils', 'mockMissions.js');
fs.writeFileSync(targetPath, fileContent, 'utf8');
console.log('Sucesso! Geradas ' + generatedMissions.length + ' missões para ' + folderConfig.length + ' quartéis em ' + targetPath);
