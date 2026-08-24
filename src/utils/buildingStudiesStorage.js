import { calculateDistanceMeters, isValidDFCoordinate } from './geoUtils';

const STORAGE_KEY = 'netuno_building_studies';

// Dados táticos iniciais de referência para demonstração operacional no DF
export const INITIAL_BUILDING_STUDIES = [
  {
    id: 'ppo_hbdf_01',
    nomeFantasia: 'Hospital de Base do DF (HBDF)',
    razaoSocial: 'Instituto de Gestão Estratégica de Saúde do DF (IGESDF)',
    ra: 'Brasília',
    endereco: 'SMHS - Setor Médico Hospitalar Sul, Área Especial, Quadra 101, Asa Sul',
    cep: '70330-150',
    numLatitude: -15.797400,
    numLongitude: -47.886200,
    ocupacao: 'Hospitalar',
    populacaoFixa: '4.500 profissionais (médicos, enfermagem, suporte)',
    populacaoFlutuante: '6.000 pacientes/visitantes diários',
    populacaoPrioritaria: 'ALTA PRIORIDADE: UTIs (Pisos 2 e 3), Centro Cirúrgico, Trauma, Ala de Queimados, Pacientes Acamados e dependentes de ventilação mecânica',
    contatos: [
      { nome: 'Cap. QOBM Silva (Chefe da Brigada)', funcao: 'Brigada Particular / Emergência', telefone: '(61) 98111-2233' },
      { nome: 'Eng. Marcelo Santos', funcao: 'Chefe de Manutenção / Predial', telefone: '(61) 98222-3344' },
      { nome: 'Dra. Denise (Diretoria de Plantão)', funcao: 'Coordenação Médica / Regulação', telefone: '(61) 3315-1200' },
      { nome: 'Central de Segurança e Monitoramento', funcao: 'Portaria Central / Segurança', telefone: '(61) 3315-1100' }
    ],
    // B. Acessibilidade e Posicionamento do Trem de Socorro
    viaPrincipal: 'Acesso principal via Eixo W Sul (W3/Hospitalar) com entrada direta pela portaria de emergência/trauma.',
    viaAlternativa: 'Acesso alternativo pela via L2 Sul / Setor Bancário Sul (acesso traseiro ao necrotério e docas de serviço).',
    restricoesViarias: 'Atenção: Teto da laje do estacionamento de emergência com limite de 10 toneladas. NÃO posicionar viaturas pesadas sobre a rampa intermediária. Cabos aéreos de alta tensão na lateral leste.',
    posicionamentoABT: 'Estacionamento frontal livre do Pronto Socorro (área balizada para até 3 viaturas ABT).',
    posicionamentoAET: 'Esplanada frontal norte (raio de 360° livre, sem fiação suspensa, piso reforçado com alcance para os 8 pavimentos).',
    postoComando: 'Posto de Comando (PC) em frente ao heliponto / canteiro central do Eixo W, com visão ampla das fachadas norte e oeste.',
    acvStart: 'Área de Concentração de Vítimas (ACV) e Triagem START no gramado adjacente à entrada do ambulatório externo.',
    // C. Abastecimento Hídrico
    volumeRTI: '120.000 Litros (120 m³) em reservatório subterrâneo dedicado.',
    registroRecalqueTipo: 'Passeio',
    registroRecalqueLocal: 'Localizado no passeio público frontal da entrada da Emergência Geral, tampa metálica pintada de vermelho.',
    fotoRecalque: '',
    hidrantesProximos: [
      { codigo: 'BSB00102', endereco: 'SMHS Qd 101 Bloco A (em frente ao Trauma)', distancia: '45m', diametro: '100mm', status: 'Operante' },
      { codigo: 'BSB00108', endereco: 'Via W3 Sul próx. Setor Hospitalar', distancia: '130m', diametro: '150mm', status: 'Operante' }
    ],
    mananciaisAlternativos: 'Espelho d\'água da Praça dos Tribunais a 400m e cisterna suplementar de reserva de 50.000L no bloco de caldeiras.',
    // D. Sistemas de Proteção e Pontos de Corte
    chaveGeralEnergia: 'Subestação Principal localizada no Subsolo 1 (Acesso externo pela rampa de carga). Desligamento por disjuntor de média tensão comandado no painel QGBT-01.',
    valvulaGeralGas: 'Central de Gases Medicinais (Oxigênio líquido/vácuo) e Central de GLP localizadas no pátio dos fundos (externo). Válvula de corte esférica com trava manual amarela.',
    sprinklersVGA: 'Possui Sprinklers em todos os subsolos, almoxarifado central e centro cirúrgico. VGA-01 no Subsolo 1 e VGA-02 no 3º Pavimento.',
    escadasPressurizacao: '4 Caixas de Escada Enclausuradas (Norte, Sul, Leste, Oeste), todas pressurizadas com acionamento automático por detectores de fumaça e painel manual na Portaria Central.',
    geradorEmergencia: '2 Grupos Geradores de 500 kVA a Diesel localizados no pátio térreo isolado (autonomia de 48 horas).',
    // E. Riscos Específicos e Carga de Incêndio
    cargaIncendio: 'Alta',
    produtosPerigosos: 'Central de Oxigênio Líquido (Tanque criogênico de 10.000 m³), Depósito de Álcool 70% e reagentes no Almoxarifado Central (Subsolo 1 - ONU 1170), Isótopos na Medicina Nuclear.',
    areasCriticas: 'Cozinha Industrial (Bloco C), Dutos de exaustão de caldeiras, Depósito de Resíduos Infectantes (Docas Sul), Central de Gases Medicinais.',
    riscoColapso: 'Estrutura robusta em concreto armado. Risco de propagação vertical rápida pelos shafts técnicos centrais caso os selos corta-fogo sejam violados.',
    // F. Arquivos Táticos
    fotoFachada: '',
    croquiPlanta: '',
    // G. Informações Extras
    informacoesExtras: 'Hospital terciário de alta complexidade com heliponto ativo na cobertura. Acesso preferencial de ambulâncias e viaturas de resgate pela rampa oeste. Manter contato imediato com a Central de Regulação Médica em ocorrências com múltiplas vítimas.',
    dataCadastro: '2026-08-20',
    ultimaAtualizacao: '2026-08-24'
  },
  {
    id: 'ppo_jkshopping_02',
    nomeFantasia: 'JK Shopping',
    razaoSocial: 'JK Shopping e Empreendimentos Imobiliários S.A.',
    ra: 'Taguatinga',
    endereco: 'Avenida Hélio Prates, QNM 34, Área Especial 01, M-Norte',
    cep: '72145-450',
    numLatitude: -15.808200,
    numLongitude: -48.106500,
    ocupacao: 'Comercial',
    populacaoFixa: '1.200 funcionários de lojas e administração',
    populacaoFlutuante: '25.000 visitantes/dia (picos de 40.000 em finais de semana)',
    populacaoPrioritaria: 'Cinemas (Piso 3 - Reunião de Público de difícil evacuação no escuro), Praça de Alimentação, Área Kids/Playground',
    contatos: [
      { nome: 'Subten. R1 Marcos (Chefe de Segurança)', funcao: 'Segurança Patrimonial e Brigada', telefone: '(61) 98455-6677' },
      { nome: 'Valter Silva (Gerente Operacional)', funcao: 'Gerência de Operações', telefone: '(61) 99122-3344' },
      { nome: 'Central de Operações do Shopping (CCO)', funcao: 'CCO 24 Horas', telefone: '(61) 3246-8600' }
    ],
    viaPrincipal: 'Avenida Hélio Prates (Pista duplicada, acesso frontal pelas portarias A e B).',
    viaAlternativa: 'Via lateral QNM 34 (Acesso direto às docas de carga/descarga e subsolo).',
    restricoesViarias: 'Intenso fluxo de pedestres e paradas de ônibus na Hélio Prates. Marquise frontal com projeção de 4 metros.',
    posicionamentoABT: 'Estacionamento externo da Hélio Prates ou Pátio de Carga e Descarga traseiro.',
    posicionamentoAET: 'Esplanada frontal da Av. Hélio Prates para salvamento na torre comercial e pavimentos superiores.',
    postoComando: 'Rotatória frontal externa, afastada 60 metros da fachada principal.',
    acvStart: 'Estacionamento aberto externo (frente à Hélio Prates).',
    volumeRTI: '80.000 Litros (80 m³).',
    registroRecalqueTipo: 'Passeio',
    registroRecalqueLocal: 'Calçada frontal próximo à entrada principal da Av. Hélio Prates, protegido por mureta amarela.',
    fotoRecalque: '',
    hidrantesProximos: [
      { codigo: 'TAG00245', endereco: 'Av. Hélio Prates em frente ao Shopping', distancia: '30m', diametro: '150mm', status: 'Operante' },
      { codigo: 'CEI00312', endereco: 'QNM 34 Conjunto A lote 2', distancia: '110m', diametro: '100mm', status: 'Operante' }
    ],
    mananciaisAlternativos: 'Cisterna pluvial do shopping de 100.000L acessível por sucção na área de docas.',
    chaveGeralEnergia: 'Subestação de Entrada no Subsolo 2. Chave de desenergização geral controlada na sala do CCO.',
    valvulaGeralGas: 'Central de Gás GLP a granel (4 tanques P-4000) localizada no nível térreo externo dos fundos. Registro geral tipo esfera com acionamento de corte rápido.',
    sprinklersVGA: 'Rede 100% protegida por sprinklers. VGAs localizadas nos shafts hidráulicos de cada piso (Pisos S2, S1, Térreo, 1, 2 e 3).',
    escadasPressurizacao: '6 Caixas de Escadas Pressurizadas à prova de fumaça com portas corta-fogo classe P-90.',
    geradorEmergencia: 'Gerador de 750 kVA a Diesel no Subsolo 2 com tanque de 500L.',
    cargaIncendio: 'Alta',
    produtosPerigosos: 'GLP a granel, produtos inflamáveis em estoque das lojas âncoras (esmaltes, perfumaria, depósitos).',
    areasCriticas: 'Praça de Alimentação (dutos coletivos de gordura dos restaurantes), Central de GLP, Cabine Primária de Média Tensão.',
    riscoColapso: 'Estrutura mista (Concreto armado e estrutura metálica na cobertura da praça de alimentação e cinemas). Atenção à deformação da cobertura metálica em caso de fogo prolongado.',
    fotoFachada: '',
    croquiPlanta: '',
    // G. Informações Extras
    informacoesExtras: 'Acesso de viaturas pelas docas traseiras possui portão basculante operado pelo CCO 24h. Em caso de sinistro, a chave mestre de desativação dos elevadores encontra-se na portaria de serviço da QNM 34.',
    dataCadastro: '2026-08-18',
    ultimaAtualizacao: '2026-08-24'
  },
  {
    id: 'ppo_venancio_03',
    nomeFantasia: 'Venâncio Shopping',
    razaoSocial: 'Condomínio do Edifício Venâncio 2000',
    ra: 'Brasília',
    endereco: 'SCS - Setor Comercial Sul, Quadra 08, Bloco B, Asa Sul',
    cep: '70333-900',
    numLatitude: -15.796100,
    numLongitude: -47.891300,
    ocupacao: 'Comercial',
    populacaoFixa: '3.000 trabalhadores nas torres empresariais',
    populacaoFlutuante: '15.000 transeuntes e usuários diários de serviços públicos',
    populacaoPrioritaria: 'Poupatempo / Na Hora (grande concentração de idosos e gestantes), agências bancárias e praça de alimentação.',
    contatos: [
      { nome: 'Sgt R1 Souza (Chefe da Brigada)', funcao: 'Brigada de Incêndio', telefone: '(61) 98877-6655' },
      { nome: 'Carlos Eduardo (Gerente Predial)', funcao: 'Administração Predial', telefone: '(61) 98123-4567' },
      { nome: 'Central de Monitoramento CFTV', funcao: 'Segurança 24h', telefone: '(61) 3208-2000' }
    ],
    viaPrincipal: 'Via W3 Sul / Via SCS interna (Acesso pelas pistas de circulação do Setor Comercial Sul).',
    viaAlternativa: 'Via de ligação entre SCS e SBS pelo Eixo Rodoviário.',
    restricoesViarias: 'Vias estreitas do SCS com estacionamento rotativo em ambos os lados e trânsito carregado. Fiação subterrânea.',
    posicionamentoABT: 'Pátio frontal da entrada Sul ou baia de ônibus da W3.',
    posicionamentoAET: 'Esplanada aberta frontal com ângulo para as 3 torres empresariais.',
    postoComando: 'Canteiro da W3 Sul oposto à fachada do shopping.',
    acvStart: 'Praça de convivência externa do SCS.',
    volumeRTI: '95.000 Litros (95 m³).',
    registroRecalqueTipo: 'Fachada',
    registroRecalqueLocal: 'Coluna frontal da torre B, altura de 1,20m do solo, identificação nítida em vermelho.',
    fotoRecalque: '',
    hidrantesProximos: [
      { codigo: 'BSB00078', endereco: 'SCS Qd 08 próx. Galeria Venâncio', distancia: '40m', diametro: '100mm', status: 'Operante' },
      { codigo: 'BSB00082', endereco: 'Via W3 Sul Qd 502', distancia: '95m', diametro: '150mm', status: 'Operante' }
    ],
    mananciaisAlternativos: 'Fontes e cisterna de reserva técnica da Caesb a 500m.',
    chaveGeralEnergia: 'Subestação Central no 2º Subsolo. Chave de seccionamento com comando na guarita de segurança.',
    valvulaGeralGas: 'Central de Gás encanado (Gás Natural/GLP canalizado) com registro mestre localizado no pátio técnico externo.',
    sprinklersVGA: 'Sprinklers em todo o shopping mall e garagens. VGA localizada no Subsolo 1 corredor técnico.',
    escadasPressurizacao: '8 Caixas de escadas à prova de fumaça servindo as torres e o shopping.',
    geradorEmergencia: '2 Geradores de 450 kVA no 3º Subsolo.',
    cargaIncendio: 'Média',
    produtosPerigosos: 'Depósitos de materiais de consumo e combustíveis auxiliares dos geradores.',
    areasCriticas: 'Praça de Alimentação, Subsolos de garagem, Central de TI e Data Center no 4º andar.',
    riscoColapso: 'Concreto armado com lajes maciças.',
    fotoFachada: '',
    croquiPlanta: '',
    // G. Informações Extras
    informacoesExtras: 'Galeria subterrânea interliga as torres A, B e C. Acesso tático aos subsolos deve ser feito preferencialmente com equipes em linha guia devido à compartimentação complexa das garagens.',
    dataCadastro: '2026-08-15',
    ultimaAtualizacao: '2026-08-24'
  }
];

/**
 * Obtém todos os estudos de edificações salvos no localStorage (com fallback para os dados iniciais)
 */
export const getBuildingStudies = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_BUILDING_STUDIES));
      return INITIAL_BUILDING_STUDIES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_BUILDING_STUDIES));
    return INITIAL_BUILDING_STUDIES;
  } catch (e) {
    console.warn('Erro ao carregar estudos de edificações do localStorage:', e);
    return INITIAL_BUILDING_STUDIES;
  }
};

/**
 * Salva ou atualiza um estudo de edificação
 */
export const saveBuildingStudy = (studyData) => {
  try {
    const studies = getBuildingStudies();
    const now = new Date().toISOString().split('T')[0];
    
    let updated;
    if (studyData.id) {
      // Atualização
      updated = studies.map(s => {
        if (s.id === studyData.id) {
          return {
            ...s,
            ...studyData,
            ultimaAtualizacao: now
          };
        }
        return s;
      });
    } else {
      // Novo cadastro
      const newStudy = {
        ...studyData,
        id: `ppo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        dataCadastro: now,
        ultimaAtualizacao: now
      };
      updated = [newStudy, ...studies];
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return { success: true, data: updated };
  } catch (e) {
    console.error('Erro ao salvar estudo de edificação:', e);
    return { success: false, error: e.message };
  }
};

/**
 * Exclui um estudo de edificação pelo ID
 */
export const deleteBuildingStudy = (studyId) => {
  try {
    const studies = getBuildingStudies();
    const filtered = studies.filter(s => s.id !== studyId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return { success: true, data: filtered };
  } catch (e) {
    console.error('Erro ao excluir estudo de edificação:', e);
    return { success: false, error: e.message };
  }
};

/**
 * Encontra os hidrantes urbanos mais próximos de uma coordenada no DF
 */
export const findNearestHydrantsForBuilding = (lat, lng, allHydrants = [], limit = 2) => {
  if (!isValidDFCoordinate(lat, lng) || !Array.isArray(allHydrants) || allHydrants.length === 0) {
    return [];
  }

  const validHydrants = allHydrants.filter(h => isValidDFCoordinate(h.numLatitude, h.numLongitude));
  
  const hydrantsWithDist = validHydrants.map(h => {
    const dist = calculateDistanceMeters(lat, lng, h.numLatitude, h.numLongitude);
    return {
      codigo: h.nomHidrante || h.codHidrante || 'S/C',
      endereco: `${h.dscLocalidade || ''} - ${h.dscEndereco || ''} ${h.pontoReferencia ? `(${h.pontoReferencia})` : ''}`.trim(),
      distancia: dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(2)}km`,
      distanciaNum: dist,
      diametro: h.diametro || '100mm',
      status: h.flgAtivo ? 'Operante' : 'Inoperante',
      lat: h.numLatitude,
      lng: h.numLongitude
    };
  });

  hydrantsWithDist.sort((a, b) => a.distanciaNum - b.distanciaNum);
  return hydrantsWithDist.slice(0, limit);
};
