import * as XLSX from 'xlsx';

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
        const rawLat = row.numLatitude ? String(row.numLatitude).replace(',', '.') : '';
        const rawLng = row.numLongitude ? String(row.numLongitude).replace(',', '.') : '';

        const lat = parseFloat(rawLat);
        const lng = parseFloat(rawLng);

        const flgAtivoRaw = row.flgAtivo !== undefined ? row.flgAtivo : row.Status;
        const ativoStr = flgAtivoRaw ? String(flgAtivoRaw).trim().toLowerCase() : '';
        const isAtivo = ['true', '1', 'v', 'verdadeiro', 'sim', 's', 'operante', 'ativo'].includes(ativoStr) || flgAtivoRaw === true;

        return {
          ...row,
          _internalId: index,
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
