import Papa from 'papaparse';
import { normalizeRAName } from './raList';

export const parseHydrantsCSV = (csvFile, onComplete) => {
  const reader = new FileReader();
  
  reader.onload = (e) => {
    const text = e.target.result;
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
         const sanitizedData = results.data
          .filter(row => Object.keys(row).length > 1) // ignora linhas vazias
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
              _internalId: index,
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
      },
      error: (error) => {
        console.error("Erro no PapaParse:", error);
        onComplete([]);
      }
    });
  };
  
  reader.onerror = () => {
    console.error("Erro ao ler o arquivo CSV");
    onComplete([]);
  };

  // Removida trava de encoding (agora usa o UTF-8 padrão do navegador)
  reader.readAsText(csvFile);
};
