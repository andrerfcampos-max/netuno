import * as XLSX from 'xlsx';
import { loadPrepopBuildingStudies } from './buildingStudiesStorage';
import { getTechnicalStudies } from './technicalStudiesStorage';
import { loadMissions } from './storage';

export const exportGlobalDatabaseCSV = async (hidrantes) => {
  // Cria um workbook do XLSX
  const wb = XLSX.utils.book_new();

  // 1. Aba: Hidrantes e Vistorias
  const hidrantesData = hidrantes.map(h => ({
    'Código': h.nomHidrante || h.codHidrante || '',
    'Status': h.flgAtivo ? 'OPERANTE' : 'INOPERANTE',
    'Latitude': h.numLatitude ? Number(h.numLatitude).toFixed(6) : '',
    'Longitude': h.numLongitude ? Number(h.numLongitude).toFixed(6) : '',
    'Cidade / RA': h.dscLocalidade || '',
    'Endereço': h.dscEndereco || '',
    'Ponto de Referência': h.dscPontoReferencia || '',
    'Data Última Vistoria': h.datHoraUltimaVistoria || 'Sem vistoria',
    'Problemas Registrados': Array.isArray(h.problemasHidrante) ? h.problemasHidrante.join(' | ') : (h.problemasHidrante || 'Nenhum'),
    'Observações': h.dscObservacao || '',
    'Vistoriador / Matrícula': h.vistoriador || h.matricula || '',
  }));
  const wsHidrantes = XLSX.utils.json_to_sheet(hidrantesData);
  XLSX.utils.book_append_sheet(wb, wsHidrantes, "Hidrantes e Vistorias");

  // 2. Aba: Estudos Pré-Pop (Edificações)
  const prepop = await loadPrepopBuildingStudies();
  const prepopData = prepop.map(p => ({
    'Cód. Levantamento': p.codLevantamento || '',
    'Nome Estabelecimento': p.nomeEstabelecimento || '',
    'RA': p.ra || '',
    'Endereço': p.endereco || '',
    'Latitude': p.numLatitude || '',
    'Longitude': p.numLongitude || '',
    'Ocupação': p.ocupacao || '',
    'Carga de Incêndio': p.cargaIncendio || '',
    'Posicionamento ABT': p.posicionamentoABT || '',
    'Hidrantes Próximos': Array.isArray(p.hidrantesProximos) ? p.hidrantesProximos.map(h => h.codigo).join(', ') : (p.hidrantesProximos || '')
  }));
  const wsPrepop = XLSX.utils.json_to_sheet(prepopData);
  XLSX.utils.book_append_sheet(wb, wsPrepop, "Estudos PrePop");

  // 3. Aba: Pareceres Técnicos
  const pareceres = getTechnicalStudies();
  const pareceresData = pareceres.map(p => ({
    'ID Estudo': p.id || '',
    'Finalidade': p.finalidade || '',
    'Referência Documento': p.referenciaDoc || '',
    'Coordenada Alvo': `${p.targetLat || ''}, ${p.targetLng || ''}`,
    'Resultado Análise': p.resultadoAnalise || '',
    'Responsável': p.responsavel || '',
    'Data': p.dataCriacao || ''
  }));
  const wsPareceres = XLSX.utils.json_to_sheet(pareceresData);
  XLSX.utils.book_append_sheet(wb, wsPareceres, "Pareceres Técnicos");

  // 4. Aba: Missões e Rotas
  const missoes = loadMissions();
  const missoesData = missoes.map(m => ({
    'ID Missão': m.id || '',
    'Nome / Operação': m.name || '',
    'Quartel / Equipe': m.atribuicao || '',
    'Total Hidrantes': Array.isArray(m.selectedIds) ? m.selectedIds.length : 0,
    'Hidrantes Concluídos': Array.isArray(m.completedIds) ? m.completedIds.length : 0,
    'Status Rascunho': m.isDraft ? 'Rascunho' : 'Definitiva',
    'Criado em': m.createdAt || ''
  }));
  const wsMissoes = XLSX.utils.json_to_sheet(missoesData);
  XLSX.utils.book_append_sheet(wb, wsMissoes, "Missões");

  // Gera o arquivo Excel (.xlsx) que atende a organização exigida
  XLSX.writeFile(wb, "Base_Completa_Netuno.xlsx");

  // Também gera um arquivo CSV contendo a aba principal (Hidrantes)
  const csvContent = '\uFEFF' + XLSX.utils.sheet_to_csv(wsHidrantes, { FS: ';' });
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "Base_Completa_Netuno.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
