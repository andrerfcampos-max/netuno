import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { loadPrepopBuildingStudies } from './buildingStudiesStorage';
import { getTechnicalStudies } from './technicalStudiesStorage';
import { loadMissions } from './storage';

export const exportHidrantesCSV = async (hidrantes, selectedCity = '') => {
  const hidrantesData = (hidrantes || []).map(h => ({
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

  const csvContent = '\uFEFF' + Papa.unparse(hidrantesData, { delimiter: ';' });
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  const dateStr = new Date().toISOString().slice(0, 10);

  let cityName = (selectedCity || '').trim();
  if (!cityName && hidrantes && hidrantes.length > 0) {
    const uniqueCities = Array.from(
      new Set(hidrantes.map(h => h.dscLocalidade || h.nomLocalidade || h.ra).filter(Boolean))
    );
    if (uniqueCities.length === 1) {
      cityName = uniqueCities[0];
    } else if (uniqueCities.length > 1 && uniqueCities.length <= 2) {
      cityName = uniqueCities.join('_');
    }
  }

  let fileName = `Hidrantes_Netuno_${dateStr}.csv`;
  if (cityName) {
    const safeCity = cityName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .toLowerCase();
    fileName = `Hidrantes_Netuno_${safeCity}_${dateStr}.csv`;
  }

  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportGlobalDatabaseXLSX = async (hidrantes, selectedCity = '') => {
  // Cria um workbook do exceljs
  const wb = new ExcelJS.Workbook();

  const addSheet = (name, data) => {
    const ws = wb.addWorksheet(name);
    if (data.length > 0) {
      ws.columns = Object.keys(data[0]).map(key => ({ header: key, key: key }));
      ws.addRows(data);
    }
  };

  // 1. Aba: Hidrantes e Vistorias
  const hidrantesData = (hidrantes || []).map(h => ({
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
  addSheet("Hidrantes e Vistorias", hidrantesData);

  // 2. Aba: Estudos Pré-Pop (Edificações)
  const prepop = await loadPrepopBuildingStudies();
  const prepopData = (prepop || []).map(p => ({
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
  addSheet("Estudos PrePop", prepopData);

  // 3. Aba: Pareceres Técnicos
  const pareceres = getTechnicalStudies();
  const pareceresData = (pareceres || []).map(p => ({
    'ID Estudo': p.id || '',
    'Finalidade': p.finalidade || '',
    'Referência Documento': p.referenciaDoc || '',
    'Coordenada Alvo': `${p.targetLat || ''}, ${p.targetLng || ''}`,
    'Resultado Análise': p.resultadoAnalise || '',
    'Responsável': p.responsavel || '',
    'Data': p.dataCriacao || ''
  }));
  addSheet("Pareceres Técnicos", pareceresData);

  // 4. Aba: Missões e Rotas
  const missoes = loadMissions();
  const missoesData = (missoes || []).map(m => ({
    'ID Missão': m.id || '',
    'Nome / Operação': m.name || '',
    'Quartel / Equipe': m.atribuicao || '',
    'Total Hidrantes': Array.isArray(m.selectedIds) ? m.selectedIds.length : 0,
    'Hidrantes Concluídos': Array.isArray(m.completedIds) ? m.completedIds.length : 0,
    'Status Rascunho': m.isDraft ? 'Rascunho' : 'Definitiva',
    'Criado em': m.createdAt || ''
  }));
  addSheet("Missões", missoesData);

  // Gera o arquivo Excel (.xlsx) que atende a organização exigida
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  const dateStr = new Date().toISOString().slice(0, 10);

  let cityName = (selectedCity || '').trim();
  if (!cityName && hidrantes && hidrantes.length > 0) {
    const uniqueCities = Array.from(
      new Set(hidrantes.map(h => h.dscLocalidade || h.nomLocalidade || h.ra).filter(Boolean))
    );
    if (uniqueCities.length === 1) {
      cityName = uniqueCities[0];
    } else if (uniqueCities.length > 1 && uniqueCities.length <= 2) {
      cityName = uniqueCities.join('_');
    }
  }

  let fileName = `Base_Completa_Netuno_${dateStr}.xlsx`;
  if (cityName) {
    const safeCity = cityName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .toLowerCase();
    fileName = `Base_Completa_Netuno_${safeCity}_${dateStr}.xlsx`;
  }

  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportGlobalDatabaseCSV = async (hidrantes) => {
  await exportGlobalDatabaseXLSX(hidrantes);
};
