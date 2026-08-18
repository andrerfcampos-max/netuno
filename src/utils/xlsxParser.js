import * as XLSX from 'xlsx';
import { normalizeRAName } from './raList';
import { sanitizeProblem } from './problemUtils';

export const loadPreloadedDatabase = async (onComplete) => {
  try {
    const response = await fetch('/base-de-dados.xlsx');
    const arrayBuffer = await response.arrayBuffer();
    
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Converte para JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet);
    
    const parsedData = [];
    
    for (let i = 0; i < rawData.length; i++) {
      let row = rawData[i];
      
      const rowCode = row.nomHidrante || row.codHidrante || row['Código'] || row['\uFEFFCódigo'] || '';
      const rowRA = row.dscLocalidade || row.Localidade || row.RA || row['RA'] || row.Cidade || '';
      const rowAddress = row.dscEndereco || row['Endereço'] || '';

      // Pula linhas fantasmas de coordenadas soltas ou cabeçalhos intermediários corrompidos
      if (String(rowCode).trim().startsWith('-15') || String(rowCode).trim().startsWith('-16') || String(rowCode).trim().startsWith('-14') || String(rowCode).trim().startsWith('OBS:') || String(rowCode).trim().startsWith('LOCALIZAÇÃO')) {
        continue;
      }
      
      // Pula linha vazia
      if (!rowCode && !rowRA && !rowAddress) {
        continue;
      }

      let rawLatVal = row.numLatitude !== undefined ? row.numLatitude : (row.Latitude || row.latitude || row.num_latitude || row.LATITUDE);
      let rawLngVal = row.numLongitude !== undefined ? row.numLongitude : (row.Longitude || row.longitude || row.num_longitude || row.LONGITUDE);

      if (!rawLatVal && row['Coordenadas Geográficas']) {
        const coords = String(row['Coordenadas Geográficas']).split(',');
        if (coords.length >= 2) {
          rawLatVal = coords[0].trim();
          rawLngVal = coords[1].trim();
        }
      }

      // Se não encontrou as coordenadas, busca nas 2 linhas seguintes se elas vazaram para baixo
      if (rawLatVal === undefined || rawLatVal === '') {
        for (let j = 1; j <= 2; j++) {
          if (i + j < rawData.length) {
            const nextRow = rawData[i + j];
            if (String(nextRow.nomHidrante || '').trim().startsWith('-15')) {
              rawLatVal = nextRow.nomHidrante;
              if (String(nextRow.datHoraVistoria || '').trim().startsWith('-4')) {
                 rawLngVal = nextRow.datHoraVistoria;
              }
              if (row.flgAtivo === undefined && nextRow.qtdDiasUltimaVistoria !== undefined) {
                 row.flgAtivo = nextRow.qtdDiasUltimaVistoria;
              }
              if (!row.problemasHidrante && nextRow.dscEndereco) {
                 row.problemasHidrante = nextRow.dscEndereco;
              }
              break;
            }
          }
        }
      }

      let rawNom = row.nomHidrante || row.codHidrante || row['Código'] || row['\uFEFFCódigo'] || '';
      let rawCod = row.codHidrante || row.nomHidrante || row['Código'] || row['\uFEFFCódigo'] || '';

      const rawLat = rawLatVal ? String(rawLatVal).replace(/,/g, '.') : '';
      const rawLng = rawLngVal ? String(rawLngVal).replace(/,/g, '.') : '';

      const lat = parseFloat(rawLat);
      const lng = parseFloat(rawLng);

      const flgAtivoRaw = row.flgAtivo !== undefined ? row.flgAtivo : (row.Status || row['Status']);
      const ativoStr = flgAtivoRaw ? String(flgAtivoRaw).trim().toLowerCase() : '';
      const isAtivo = ['true', '1', 'v', 'verdadeiro', 'sim', 's', 'operante', 'ativo'].includes(ativoStr) || flgAtivoRaw === true;

      const rawRA = row.dscLocalidade || row.Localidade || row.RA || row['RA'] || row.Cidade || '';
      const cleanRA = normalizeRAName(rawRA);

      const nomHidrante = rawNom || rawCod || `HID${i + 1}`;

      parsedData.push({
        ...row,
        _internalId: `hid_${i}`,
        nomHidrante: nomHidrante,
        codHidrante: rawCod || nomHidrante,
        dscLocalidade: cleanRA,
        dscEndereco: row.dscEndereco || row['Endereço'] || '',
        dscPontoReferencia: row.dscPontoReferencia || row['Ponto de referência'] || '',
        numLatitude: isNaN(lat) ? 0 : lat,
        numLongitude: isNaN(lng) ? 0 : lng,
        flgAtivo: isAtivo,
        problemasHidrante: sanitizeProblem(row.problemasHidrante || row['Problemas do Hidrante'] || row.Problema || ''),
        datHoraUltimaVistoria: row.datHoraUltimaVistoria || row.datHoraVistoria || row.DataVistoria || row['Data Vistoria'] || row.data_vistoria || row['Última Vistoria'] || row['Ultima Vistoria'] || row.dataHoraUltimaVistoria || '',
      });
    }

    const sanitizedData = parsedData.filter(h => h.dscEndereco || h.dscLocalidade || h.nomHidrante || h.codHidrante);
      
    onComplete(sanitizedData);
  } catch (error) {
    console.error("Erro ao carregar banco de dados pré-carregado:", error);
    onComplete([]);
  }
};
