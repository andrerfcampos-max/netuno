import Papa from 'papaparse';
import { normalizeRAName } from './raList';
import { sanitizeProblem } from './problemUtils';
import { fixEncoding } from './textUtils';

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
            let rawLatVal = row.numLatitude !== undefined ? row.numLatitude : (row.Latitude || row.latitude || row.num_latitude || row.LATITUDE);
            let rawLngVal = row.numLongitude !== undefined ? row.numLongitude : (row.Longitude || row.longitude || row.num_longitude || row.LONGITUDE);
            
            if (!rawLatVal && row['Coordenadas Geográficas']) {
              const coords = String(row['Coordenadas Geográficas']).split(',');
              if (coords.length >= 2) {
                rawLatVal = coords[0].trim();
                rawLngVal = coords[1].trim();
              }
            }

            const rawLat = rawLatVal ? String(rawLatVal).replace(/,/g, '.') : '';
            const rawLng = rawLngVal ? String(rawLngVal).replace(/,/g, '.') : '';

            const lat = parseFloat(rawLat);
            const lng = parseFloat(rawLng);

            const flgAtivoRaw = row.flgAtivo !== undefined ? row.flgAtivo : (row.Status || row['Status']);
            const ativoStr = flgAtivoRaw ? String(flgAtivoRaw).trim().toLowerCase() : '';
            const isAtivo = ['true', '1', 'v', 'verdadeiro', 'sim', 's', 'operante', 'ativo'].includes(ativoStr) || flgAtivoRaw === true;

            const rawRA = row.dscLocalidade || row.Localidade || row.RA || row['RA'] || row.Cidade || '';
            const cleanRA = normalizeRAName(rawRA);

            const rawNom = row.nomHidrante || row.codHidrante || row['Código'] || '';
            const rawCod = row.codHidrante || row.nomHidrante || row['Código'] || '';
            const nomHidrante = fixEncoding(rawNom || rawCod || `HID${index + 1}`);
            const codHidrante = fixEncoding(rawCod || rawNom || `HID${index + 1}`);

            const rawProb = row.problemasHidrante || row['Problemas do Hidrante'] || row.Problema || '';

            return {
              ...row,
              _internalId: `hid_${index}`,
              nomHidrante: nomHidrante,
              codHidrante: codHidrante,
              dscLocalidade: cleanRA,
              dscEndereco: fixEncoding(row.dscEndereco || row['Endereço'] || ''),
              dscPontoReferencia: fixEncoding(row.dscPontoReferencia || row['Ponto de referência'] || ''),
              numLatitude: lat,
              numLongitude: lng,
              flgAtivo: isAtivo,
              problemasHidrante: sanitizeProblem(fixEncoding(rawProb)),
              datHoraUltimaVistoria: row.datHoraUltimaVistoria || row.datHoraVistoria || row.DataVistoria || row['Data Vistoria'] || row.data_vistoria || row['Última Vistoria'] || row['Ultima Vistoria'] || row.dataHoraUltimaVistoria || '',
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
