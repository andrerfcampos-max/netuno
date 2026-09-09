/**
 * Utilitário para exportação da base de dados PREPOP (Estudos das Edificações) em formato CSV.
 * Padrão: Delimitador ponto-e-vírgula (;), aspas duplas escapadas e BOM UTF-8 (\uFEFF)
 * para abertura direta no Microsoft Excel e Google Planilhas sem desconfigurar acentos.
 */

export const exportPrepopToCSV = (studies = []) => {
  if (!Array.isArray(studies) || studies.length === 0) {
    throw new Error('Nenhum registro de estudo PREPOP disponível para exportação.');
  }

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'codLevantamento', label: 'Cód. Levantamento' },
    { key: 'nomeEstabelecimento', label: 'Nome Estabelecimento' },
    { key: 'nomeFantasia', label: 'Nome Fantasia' },
    { key: 'razaoSocial', label: 'Razão Social' },
    { key: 'ra', label: 'Região Administrativa (RA / Cidade)' },
    { key: 'endereco', label: 'Endereço Completo' },
    { key: 'cep', label: 'CEP' },
    { key: 'numLatitude', label: 'Latitude' },
    { key: 'numLongitude', label: 'Longitude' },
    { key: 'ocupacao', label: 'Ocupação / Atividade' },
    { key: 'construcao', label: 'Tipo de Construção' },
    { key: 'qtdPavimentos', label: 'Qtd Pavimentos' },
    { key: 'corPredominante', label: 'Cor Predominante' },
    { 
      key: 'possuisubsolo', 
      label: 'Possui Subsolo', 
      format: v => (v === true || v === 'true' || v === 'Sim' || v === 'sim') ? 'Sim' : 'Não' 
    },
    { 
      key: 'centraldegas', 
      label: 'Central de Gás', 
      format: v => (v === true || v === 'true' || v === 'Sim' || v === 'sim') ? 'Sim' : 'Não' 
    },
    { key: 'localizacaoCentralGas', label: 'Localização Central de Gás' },
    { key: 'localizacaoQuadroEnergia', label: 'Localização Quadro de Energia' },
    { key: 'chaveGeralEnergia', label: 'Chave Geral de Energia' },
    { key: 'valvulaGeralGas', label: 'Válvula Geral de Gás' },
    { key: 'qtdAcessos', label: 'Qtd Acessos' },
    { key: 'melhorAcesso', label: 'Melhor Acesso' },
    { key: 'viaPrincipal', label: 'Via Principal' },
    { key: 'viaAlternativa', label: 'Via Alternativa' },
    { key: 'restricoesViarias', label: 'Restrições Viárias' },
    { key: 'posicionamentoABT', label: 'Posicionamento ABT' },
    { key: 'posicionamentoAET', label: 'Posicionamento AET' },
    { 
      key: 'apoioAutoescada', 
      label: 'Apoio Autoescada (AET)', 
      format: v => (v === true || v === 'true' || v === 'Sim' || v === 'sim') ? 'Sim' : 'Não' 
    },
    { key: 'postoComando', label: 'Posto de Comando Sugerido' },
    { key: 'pontoImpedimento', label: 'Ponto de Impedimento' },
    { key: 'materialInflamavel', label: 'Materiais Inflamáveis' },
    { key: 'classeIncendio', label: 'Classe de Incêndio' },
    { key: 'vulnerabilidades', label: 'Vulnerabilidades' },
    { key: 'cargaIncendio', label: 'Carga de Incêndio' },
    { key: 'produtosPerigosos', label: 'Produtos Perigosos' },
    { key: 'areasCriticas', label: 'Áreas Críticas' },
    { key: 'riscoColapso', label: 'Risco de Colapso' },
    { key: 'sistemasPreventivos', label: 'Sistemas Preventivos' },
    { key: 'sprinklersVGA', label: 'Sprinklers / VGA' },
    { key: 'escadasPressurizacao', label: 'Escadas Pressurizadas' },
    { key: 'geradorEmergencia', label: 'Gerador de Emergência' },
    { key: 'acvStart', label: 'ACV / START' },
    { key: 'volumeRTI', label: 'Volume RTI' },
    { key: 'registroRecalqueTipo', label: 'Tipo Registro de Recalque' },
    { key: 'registroRecalqueLocal', label: 'Localização Registro de Recalque' },
    { key: 'hidranteMaisProximoDesc', label: 'Hidrante Mais Próximo (Desc.)' },
    { key: 'populacaoFixa', label: 'População Fixa' },
    { key: 'populacaoFlutuante', label: 'População Flutuante' },
    { key: 'populacaoPrioritaria', label: 'População Prioritária' },
    { 
      key: 'contatos', 
      label: 'Contatos de Emergência',
      format: (val) => {
        if (!val) return '';
        if (Array.isArray(val)) {
          return val.map(c => {
            if (typeof c === 'string') return c;
            const parts = [];
            if (c.nome) parts.push(c.nome);
            if (c.cargo) parts.push(`(${c.cargo})`);
            if (c.telefone) parts.push(c.telefone);
            return parts.join(' ');
          }).filter(Boolean).join(' | ');
        }
        return String(val);
      }
    },
    {
      key: 'hidrantesProximos',
      label: 'Hidrantes Urbanos Próximos',
      format: (val) => {
        if (!val) return '';
        if (Array.isArray(val)) {
          return val.map(h => {
            if (typeof h === 'string') return h;
            return `${h.codigo || ''} (${h.distancia || ''}) - ${h.status || ''} [${h.endereco || ''}]`.trim();
          }).filter(Boolean).join(' | ');
        }
        return String(val);
      }
    },
    { key: 'mananciaisAlternativos', label: 'Mananciais Alternativos' },
    { key: 'obmResponsavel', label: 'OBM Responsável' },
    { key: 'responsavelVistoria', label: 'Responsável Levantamento' },
    { key: 'dataLevantamento', label: 'Data do Levantamento' },
    { key: 'informacoesExtras', label: 'Informações Extras' },
    { key: 'dataCadastro', label: 'Data de Cadastro' },
    { key: 'ultimaAtualizacao', label: 'Última Atualização' }
  ];

  const headerRow = columns.map(c => `"${c.label.replace(/"/g, '""')}"`).join(';');
  const dataRows = studies.map(item => {
    return columns.map(col => {
      let raw = item[col.key];
      let val = col.format ? col.format(raw, item) : raw;
      if (val === undefined || val === null) val = '';
      const strVal = String(val).replace(/"/g, '""').replace(/[\r\n]+/g, ' ').trim();
      return `"${strVal}"`;
    }).join(';');
  });

  const csvContent = [headerRow, ...dataRows].join('\r\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  link.setAttribute('download', `base_prepop_edificacoes_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
