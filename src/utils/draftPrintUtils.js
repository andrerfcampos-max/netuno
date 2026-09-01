import { fixEncoding } from './textUtils';
import { normalizeRAName } from './raList';

// Cálculo de distância geodésica em km (Haversine)
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return 999;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Algoritmo Vizinho Mais Próximo para ordenação sequencial da rota
export const optimizeRoute = (hidrantes) => {
  if (!hidrantes || hidrantes.length === 0) return [];
  
  let unvisited = [...hidrantes];
  let route = [];
  
  // Inicia a rota pelo primeiro hidrante da lista
  let current = unvisited.shift();
  route.push(current);
  let currentLat = current.numLatitude;
  let currentLng = current.numLongitude;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const h = unvisited[i];
      const dist = calculateDistance(currentLat, currentLng, h.numLatitude, h.numLongitude);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIdx = i;
      }
    }

    const nextHydrant = unvisited.splice(nearestIdx, 1)[0];
    route.push(nextHydrant);
    if (nextHydrant.numLatitude !== undefined && nextHydrant.numLongitude !== undefined) {
      currentLat = nextHydrant.numLatitude;
      currentLng = nextHydrant.numLongitude;
    }
  }

  return route;
};

export const optimizeRouteFromGama = optimizeRoute;

/**
 * Dispara diretamente a impressão/geração de PDF do rascunho de campo da missão,
 * com cálculo de rota sequencial otimizada e tipografia de alta legibilidade.
 */
export const printMissionDraft = ({ mission, hidrantes = [], folderName = '', currentUser = null }) => {
  if (!mission) {
    alert('Missão não selecionada.');
    return;
  }

  const selectedIds = mission.selectedIds || [];
  if (selectedIds.length === 0) {
    alert('Esta missão não possui hidrantes selecionados.');
    return;
  }

  // Mapeia os códigos da missão para os objetos completos de hidrantes
  const missionHydrants = selectedIds.map(id => {
    const found = hidrantes.find(h => 
      h.nomHidrante === id || 
      h.codHidrante === id || 
      String(h.codHidrante) === String(id) || 
      h._internalId === id
    );
    if (found) return found;
    return {
      nomHidrante: id,
      codHidrante: id,
      dscEndereco: 'Endereço não localizado na base',
      dscPontoReferencia: '',
      dscLocalidade: '',
      numLatitude: -15.794,
      numLongitude: -47.882
    };
  });

  // Ordenação de rota otimizada
  const orderedList = optimizeRoute(missionHydrants);

  // RAs presentes
  const rasSet = new Set(orderedList.map(h => normalizeRAName(h.dscLocalidade)).filter(Boolean));
  const rasText = Array.from(rasSet).sort().join(', ') || folderName || 'Distrito Federal';

  const today = new Date().toLocaleDateString('pt-BR');
  const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Nome e matrícula do militar
  const militarNome = currentUser?.nome || mission.createdByName || mission.createdBy || 'Vistoriador / Responsável';
  const militarMatricula = currentUser?.matricula ? `Matrícula: ${currentUser.matricula}` : '';
  const currentYear = new Date().getFullYear();
  const defaultCity = Array.from(rasSet)[0] || 'Brasília';
  const missionName = mission.name || `${defaultCity} ${currentYear}`;
  const atribuicaoText = mission.atribuicao ? ` • Equipe: ${mission.atribuicao}` : '';

  // Cria janela de impressão
  const printWindow = window.open('', '_blank', 'width=1000,height=850');
  if (!printWindow) {
    alert('Por favor, autorize a abertura de popups no seu navegador para imprimir o rascunho.');
    return;
  }

  const rowsHtml = orderedList.map((h, idx) => {
    const code = h.nomHidrante || h.codHidrante || '-';
    const end = fixEncoding(h.dscEndereco || 'Endereço não informado');
    const ref = h.dscPontoReferencia ? fixEncoding(h.dscPontoReferencia) : '';
    const ra = normalizeRAName(h.dscLocalidade) || '';

    return `
      <tr>
        <td class="col-seq">${idx + 1}</td>
        <td class="col-code">
          <div class="code-text">${code}</div>
          ${ra ? `<div class="ra-text">${ra}</div>` : ''}
        </td>
        <td class="col-address">
          <div class="end-text">${end}</div>
          ${ref ? `<div class="ref-text"><strong>Ref:</strong> ${ref}</div>` : ''}
        </td>
        <td class="col-obs">
          <div class="obs-lines">
            <div class="obs-line top-line"></div>
            <div class="obs-line bottom-line"></div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <title>Rascunho_Missao_${fixEncoding(missionName).replace(/[^a-zA-Z0-9]/g, '_')}_${today.replace(/\//g, '-')}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 8mm 8mm 8mm 8mm;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: Arial, Helvetica, sans-serif;
          color: #000000;
          background: #ffffff;
          line-height: 1.3;
          font-size: 13px;
          padding: 8px;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #000000;
          padding-bottom: 8px;
          margin-bottom: 8px;
        }
        .header h1 {
          font-size: 15px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #000000;
        }
        .header h2 {
          font-size: 17px;
          font-weight: 900;
          text-transform: uppercase;
          color: #1e3a8a;
          margin: 3px 0;
        }
        .header .mission-title {
          font-size: 15px;
          font-weight: 900;
          color: #047857;
          margin-top: 2px;
        }
        .header-meta {
          margin-top: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #1e293b;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 14px;
        }
        .header-meta span {
          white-space: nowrap;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 6px;
          font-size: 13px;
        }
        th, td {
          border: 1.5px solid #000000;
          padding: 5px 6px;
          vertical-align: middle;
        }
        th {
          background-color: #e2e8f0 !important;
          color: #000000;
          font-weight: 900;
          text-transform: uppercase;
          font-size: 12.5px;
          text-align: center;
        }
        tr {
          page-break-inside: avoid;
        }
        .col-seq {
          width: 34px;
          text-align: center;
          font-weight: 900;
          font-family: monospace;
          font-size: 14px;
          color: #000000;
        }
        .col-code {
          width: 105px;
          text-align: center;
          font-family: monospace;
        }
        .code-text {
          font-weight: 900;
          font-size: 14.5px;
          color: #000000;
        }
        .ra-text {
          font-size: 11.5px;
          color: #0369a1;
          font-family: Arial, sans-serif;
          font-weight: 800;
          margin-top: 1px;
        }
        .col-address {
          min-width: 220px;
          text-align: left;
        }
        .end-text {
          font-weight: 700;
          color: #000000;
          font-size: 13px;
          line-height: 1.25;
        }
        .ref-text {
          font-size: 11.5px;
          color: #334155;
          font-style: italic;
          margin-top: 2px;
          font-weight: 600;
        }
        .col-obs {
          width: 250px;
          height: 52px;
          padding: 4px 6px;
          background: #ffffff;
        }
        .obs-lines {
          height: 100%;
          min-height: 44px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 2px 0;
        }
        .obs-line {
          border-bottom: 1.5px dashed #475569;
          height: 18px;
        }

        .footer {
          margin-top: 16px;
          padding-top: 8px;
          text-align: center;
          page-break-inside: avoid;
        }
        .signature-line {
          width: 280px;
          border-top: 1.5px solid #000000;
          margin: 0 auto 4px auto;
        }
        .sig-name {
          font-weight: 900;
          font-size: 13px;
          color: #000000;
        }
        .sig-mat {
          font-size: 11.5px;
          font-weight: 600;
          color: #334155;
        }
        .sys-meta {
          margin-top: 6px;
          font-size: 10px;
          font-weight: 500;
          color: #64748b;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Corpo de Bombeiros Militar do Distrito Federal</h1>
        <h2>Ficha de Vistoria de Campo • Rascunho de Missão</h2>
        <div class="mission-title">🎯 ${missionName}${atribuicaoText}</div>
        <div class="header-meta">
          <span><strong>Região/Quartel:</strong> ${rasText}</span>
          <span>•</span>
          <span><strong>Total:</strong> ${orderedList.length} hidrantes</span>
          <span>•</span>
          <span><strong>Emissão:</strong> ${today} às ${nowTime}</span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 34px;">Nº</th>
            <th style="width: 105px;">CÓDIGO</th>
            <th>ENDEREÇO E PONTO DE REFERÊNCIA</th>
            <th style="width: 250px;">ANOTAÇÕES / OBSERVAÇÕES DE CAMPO (À CANETA)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="footer">
        <div class="signature-line"></div>
        <div class="sig-name">${militarNome}</div>
        ${militarMatricula ? `<div class="sig-mat">${militarMatricula}</div>` : ''}
        <div class="sys-meta">Sistema Netuno • Gerado em ${today} às ${nowTime}</div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(fullHtml);
  printWindow.document.close();
};
