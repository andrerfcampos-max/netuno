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
        const rawLatVal = row.numLatitude !== undefined ? row.numLatitude : (row.Latitude || row.latitude || row.num_latitude || row.LATITUDE);
        const rawLngVal = row.numLongitude !== undefined ? row.numLongitude : (row.Longitude || row.longitude || row.num_longitude || row.LONGITUDE);
        
        const rawLat = rawLatVal ? String(rawLatVal).replace(/,/g, '.') : '';
        const rawLng = rawLngVal ? String(rawLngVal).replace(/,/g, '.') : '';

        const lat = parseFloat(rawLat);
        const lng = parseFloat(rawLng);

        const flgAtivoRaw = row.flgAtivo !== undefined ? row.flgAtivo : row.Status;
        const ativoStr = flgAtivoRaw ? String(flgAtivoRaw).trim().toLowerCase() : '';
        const isAtivo = ['true', '1', 'v', 'verdadeiro', 'sim', 's', 'operante', 'ativo'].includes(ativoStr) || flgAtivoRaw === true;

        const rawRA = row.dscLocalidade || row.Localidade || row.RA || row.Cidade || '';
        const cleanRA = normalizeRAName(rawRA);

        const nomHidrante = row.nomHidrante || row.codHidrante || `HID${index + 1}`;

        return {
          ...row,
          _internalId: `hid_${index}`,
          nomHidrante: nomHidrante,
          codHidrante: row.codHidrante || nomHidrante,
          dscLocalidade: cleanRA,
          numLatitude: lat,
          numLongitude: lng,
          flgAtivo: isAtivo,
          problemasHidrante: row.problemasHidrante || row.Problema || '',
          datHoraUltimaVistoria: row.datHoraUltimaVistoria || row.datHoraVistoria || row.DataVistoria || row.data_vistoria || row['Última Vistoria'] || row['Ultima Vistoria'] || row.dataHoraUltimaVistoria || '',
        };
      })
      .filter(h => !isNaN(h.numLatitude) && !isNaN(h.numLongitude));
      
    onComplete(sanitizedData);
  } catch (error) {
    console.error("Erro ao carregar banco de dados pré-carregado:", error);
    onComplete([]);
  }
};
