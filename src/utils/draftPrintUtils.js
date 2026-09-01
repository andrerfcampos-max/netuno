import { fixEncoding } from './textUtils';
import { normalizeRAName } from './raList';

// Ponto de Partida Fixo: Centro do Gama
export const GAMA_CENTER = { lat: -16.015, lng: -48.065, name: 'Centro do Gama' };

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

// Algoritmo Vizinho Mais Próximo saindo do Centro do Gama
export const optimizeRouteFromGama = (hidrantes) => {
  if (!hidrantes || hidrantes.length === 0) return [];
  
  let unvisited = [...hidrantes];
  let route = [];
  let currentLat = GAMA_CENTER.lat;
  let currentLng = GAMA_CENTER.lng;

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
    currentLat = nextHydrant.numLatitude;
    currentLng = nextHydrant.numLongitude;
  }

  return route;
};

/**
 * Dispara diretamente a impressão/geração de PDF do rascunho de campo da missão,
 * com cálculo de rota TSP partindo do Gama, sem abrir nenhuma tela intermediária.
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
      numLatitude: GAMA_CENTER.lat,
      numLongitude: GAMA_CENTER.lng
    };
  });

  // Ordenação TSP a partir do Centro do Gama
  const orderedList = optimizeRouteFromGama(missionHydrants);

  // RAs presentes
  const rasSet = new Set(orderedList.map(h => normalizeRAName(h.dscLocalidade)).filter(Boolean));
  const rasText = Array.from(rasSet).sort().join(', ') || folderName || 'Distrito Federal';

  const today = new Date().toLocaleDateString('pt-BR');
  const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Nome e matrícula do militar
  const militarNome = currentUser?.nome || mission.createdByName || mission.createdBy || 'Vistoriador / Responsável';
  const militarMatricula = currentUser?.matricula ? `Matrícula: ${currentUser.matricula}` : '';
  const missionName = mission.name || 'Ordem de Missão';
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
            <div class="obs-line"></div>
            <div class="obs-line"></div>
            <div class="obs-line"></div>
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
          margin: 8mm 10mm 10mm 10mm;
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
          color: #0f172a;
          background: #ffffff;
          line-height: 1.3;
          font-size: 11px;
          padding: 10px;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 8px;
          margin-bottom: 10px;
        }
        .header h1 {
          font-size: 13px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #0f172a;
        }
        .header h2 {
          font-size: 15px;
          font-weight: 900;
          text-transform: uppercase;
          color: #1e3a8a;
          margin: 2px 0;
        }
        .header .mission-title {
          font-size: 12px;
          font-weight: bold;
          color: #047857;
          margin-top: 1px;
        }
        .header-meta {
          margin-top: 6px;
          font-size: 10px;
          color: #334155;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 12px;
        }
        .header-meta span {
          white-space: nowrap;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 6px;
          font-size: 10.5px;
        }
        th, td {
          border: 1px solid #475569;
          padding: 4px 6px;
          vertical-align: middle;
        }
        th {
          background-color: #f1f5f9 !important;
          color: #0f172a;
          font-weight: 800;
          text-transform: uppercase;
          font-size: 10px;
          text-align: center;
        }
        tr {
          page-break-inside: avoid;
        }
        .col-seq {
          width: 32px;
          text-align: center;
          font-weight: bold;
          font-family: monospace;
          font-size: 11px;
          color: #1e3a8a;
        }
        .col-code {
          width: 95px;
          text-align: center;
          font-family: monospace;
        }
        .code-text {
          font-weight: bold;
          font-size: 11px;
          color: #0f172a;
        }
        .ra-text {
          font-size: 9px;
          color: #0284c7;
          font-family: Arial, sans-serif;
          font-weight: 600;
        }
        .col-address {
          min-width: 220px;
          text-align: left;
        }
        .end-text {
          font-weight: 600;
          color: #0f172a;
          font-size: 10.5px;
        }
        .ref-text {
          font-size: 9.5px;
          color: #475569;
          font-style: italic;
          margin-top: 2px;
        }
        .col-obs {
          width: 240px;
          height: 44px;
          padding: 2px 4px;
          background: #ffffff;
        }
        .obs-lines {
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 1px 0;
        }
        .obs-line {
          border-bottom: 1px dashed #94a3b8;
          height: 12px;
        }

        .footer {
          margin-top: 18px;
          padding-top: 10px;
          text-align: center;
          page-break-inside: avoid;
        }
        .signature-line {
          width: 260px;
          border-top: 1px solid #0f172a;
          margin: 0 auto 4px auto;
        }
        .sig-name {
          font-weight: bold;
          font-size: 11px;
          color: #0f172a;
        }
        .sig-mat {
          font-size: 10px;
          color: #475569;
        }
        .sys-meta {
          margin-top: 8px;
          font-size: 8.5px;
          color: #94a3b8;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Corpo de Bombeiros Militar do Distrito Federal</h1>
        <h2>Ficha de Vistoria de Campo • Rascunho de Missão</h2>
        <div class="mission-title">🎯 ${missionName}${atribuicaoText}</div>
        <div class="header-meta">
          <span><strong>Partida:</strong> Centro do Gama (Rota Otimizada)</span>
          <span>•</span>
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
            <th style="width: 32px;">Nº</th>
            <th style="width: 95px;">CÓDIGO</th>
            <th>ENDEREÇO E PONTO DE REFERÊNCIA</th>
            <th style="width: 240px;">ANOTAÇÕES / OBSERVAÇÕES DE CAMPO (À CANETA)</th>
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
        <div class="sys-meta">Sistema Netuno • Ordem calculada a partir do Centro do Gama • Gerado em ${today} ${nowTime}</div>
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
