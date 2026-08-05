import Papa from 'papaparse';

export const parseHydrantsCSV = (csvFile, onComplete) => {
  const reader = new FileReader();
  
  reader.onload = (e) => {
    const text = e.target.result;
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        // Sanitização estrita exigida
        const sanitizedData = results.data
          .map((row, index) => {
            const rawLat = row.numLatitude ? String(row.numLatitude).replace(',', '.') : '';
            const rawLng = row.numLongitude ? String(row.numLongitude).replace(',', '.') : '';

            const lat = parseFloat(rawLat);
            const lng = parseFloat(rawLng);

              const ativoStr = row.flgAtivo ? String(row.flgAtivo).trim().toLowerCase() : '';
              const isAtivo = ['true', '1', 'v', 'verdadeiro', 'sim', 's', 'operante', 'ativo'].includes(ativoStr) || row.flgAtivo === true;

            return {
              ...row,
              // Fallback ID to ensure updates work if missing from CSV
              _internalId: index,
              numLatitude: lat,
              numLongitude: lng,
              flgAtivo: isAtivo,
              problemasHidrante: row.problemasHidrante || '',
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
