import * as XLSX from 'xlsx';
import { normalizeRAName } from './raList';

export const loadPreloadedDatabase = async (onComplete) => {
  try {
    const response = await fetch('/base-de-dados.xlsx');
    const arrayBuffer = await response.arrayBuffer();
    
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Converte para JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet);
    
    const sanitizedData = rawData
      .map((row, index) => {
        let rawLatVal = row.numLatitude !== undefined ? row.numLatitude : (row.Latitude || row.latitude || row.num_latitude || row.LATITUDE);
        let rawLngVal = row.numLongitude !== undefined ? row.numLongitude : (row.Longitude || row.longitude || row.num_longitude || row.LONGITUDE);
        
        let rawNom = row.nomHidrante || row.codHidrante || '';
        let rawCod = row.codHidrante || row.nomHidrante || '';

        // Detecção de colunas deslocadas na planilha onde nomHidrante é -15.xxx e datHoraVistoria é -48.xxx
        if ((!rawLatVal || isNaN(parseFloat(String(rawLatVal).replace(',', '.')))) && String(row.nomHidrante).trim().startsWith('-15')) {
          rawLatVal = row.nomHidrante;
          if (String(row.datHoraVistoria).trim().startsWith('-4')) {
            rawLngVal = row.datHoraVistoria;
          }
        }
        
        const rawLat = rawLatVal ? String(rawLatVal).replace(/,/g, '.') : '';
        const rawLng = rawLngVal ? String(rawLngVal).replace(/,/g, '.') : '';

        const lat = parseFloat(rawLat);
        const lng = parseFloat(rawLng);

        const flgAtivoRaw = row.flgAtivo !== undefined ? row.flgAtivo : row.Status;
        const ativoStr = flgAtivoRaw ? String(flgAtivoRaw).trim().toLowerCase() : '';
        const isAtivo = ['true', '1', 'v', 'verdadeiro', 'sim', 's', 'operante', 'ativo'].includes(ativoStr) || flgAtivoRaw === true;

        const rawRA = row.dscLocalidade || row.Localidade || row.RA || row.Cidade || '';
        const cleanRA = normalizeRAName(rawRA);

        const nomHidrante = rawNom || rawCod || `HID${index + 1}`;

        return {
          ...row,
          _internalId: `hid_${index}`,
          nomHidrante: nomHidrante,
          codHidrante: rawCod || nomHidrante,
          dscLocalidade: cleanRA,
          numLatitude: isNaN(lat) ? 0 : lat,
          numLongitude: isNaN(lng) ? 0 : lng,
          flgAtivo: isAtivo,
          problemasHidrante: row.problemasHidrante || row.Problema || '',
          datHoraUltimaVistoria: row.datHoraUltimaVistoria || row.datHoraVistoria || row.DataVistoria || row.data_vistoria || row['Última Vistoria'] || row['Ultima Vistoria'] || row.dataHoraUltimaVistoria || '',
        };
      })
      .filter(h => h.dscEndereco || h.dscLocalidade || h.nomHidrante || h.codHidrante);
      
    onComplete(sanitizedData);
  } catch (error) {
    console.error("Erro ao carregar banco de dados pré-carregado:", error);
    onComplete([]);
  }
};
