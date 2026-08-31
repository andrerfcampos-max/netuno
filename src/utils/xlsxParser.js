import * as XLSX from 'xlsx';
import { normalizeRAName, PREFIX_TO_RA_MAP, RA_LOCALIDADE_MAP } from './raList';
import { sanitizeProblem } from './problemUtils';
import { fixEncoding } from './textUtils';

export const loadPreloadedDatabase = async (onComplete) => {
  try {
    // 1. Tenta carregar a base limpa oficial (JSON/CSV) diretamente
    try {
      const cleanResp = await fetch('/hidrantes_df_oficial.json');
      if (cleanResp.ok) {
        const cleanData = await cleanResp.json();
        if (Array.isArray(cleanData) && cleanData.length > 0) {
          if (onComplete) onComplete(cleanData);
          return cleanData;
        }
      }
    } catch (eClean) {
      console.info('Base limpa JSON não encontrada, carregando fallback XLSX...', eClean);
    }

    // 2. Fallback: Base legada XLSX
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
      const rowAddress = row.dscEndereco || row['Endereço'] || '';

      // Pula linhas fantasmas de coordenadas soltas ou cabeçalhos intermediários corrompidos
      if (String(rowCode).trim().startsWith('-15') || String(rowCode).trim().startsWith('-16') || String(rowCode).trim().startsWith('-14') || String(rowCode).trim().startsWith('OBS:') || String(rowCode).trim().startsWith('LOCALIZAÇÃO')) {
        continue;
      }
      
      // Pula linha vazia
      if (!rowCode && !rowAddress && !row.dscLocalidade && !row.codLocalidade) {
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

      const flgAtivoRaw = row.flgAtivo !== undefined ? row.flgAtivo : (row.Status || row['Status'] || row.status);
      const ativoStr = flgAtivoRaw !== undefined && flgAtivoRaw !== null ? String(flgAtivoRaw).trim().toLowerCase() : '';
      const isAtivo = ['true', '1', 'v', 'verdadeiro', 'sim', 's', 'operante', 'ativo'].includes(ativoStr) || flgAtivoRaw === true;

      // Resolução da Região Administrativa (RA)
      let rawRA = row.dscLocalidade || row.Localidade || row.RA || row['RA'] || row.Cidade || '';
      if (!rawRA) {
        const nomStr = String(rawNom || rawCod || '').trim();
        const pfx = nomStr.substring(0, 3).toUpperCase();
        if (PREFIX_TO_RA_MAP[pfx]) {
          rawRA = PREFIX_TO_RA_MAP[pfx];
        } else if (row.codLocalidade && RA_LOCALIDADE_MAP[row.codLocalidade]) {
          rawRA = RA_LOCALIDADE_MAP[row.codLocalidade];
        }
      }
      const cleanRA = normalizeRAName(rawRA);

      // Resolução do código alfa-numérico oficial com prefixo da RA (ex: GUA00123, BSB00511, TAG00142)
      const officialCode = String(rawNom || rawCod || `HID${i + 1}`).trim();
      const cleanNom = fixEncoding(officialCode);
      const cleanCod = fixEncoding(officialCode);
      const cleanEnd = fixEncoding(row.dscEndereco || row['Endereço'] || '');
      const cleanRef = fixEncoding(row.dscPontoReferencia || row['Ponto de referência'] || '');
      const cleanProb = sanitizeProblem(fixEncoding(row.problemasHidrante || row['Problemas do Hidrante'] || row.Problema || ''));

      parsedData.push({
        ...row,
        _internalId: `hid_${i}`,
        nomHidrante: cleanNom,
        codHidrante: cleanCod,
        dscLocalidade: cleanRA,
        dscEndereco: cleanEnd,
        dscPontoReferencia: cleanRef,
        numLatitude: isNaN(lat) ? 0 : lat,
        numLongitude: isNaN(lng) ? 0 : lng,
        flgAtivo: isAtivo,
        problemasHidrante: cleanProb,
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
