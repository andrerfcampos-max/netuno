import { fixEncoding } from './textUtils';
import { normalizeRAName } from './raList';
import { sanitizeProblem } from './problemUtils';

/**
 * Utilitário de Geração e Impressão de Documentos Oficiais em Formato A4
 * Padrão Institucional do Corpo de Bombeiros Militar do Distrito Federal (CBMDF)
 * e Companhia de Saneamento Ambiental do Distrito Federal (CAESB).
 */

const formatDateOnly = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr).split(' ')[0] || '-';
    return d.toLocaleDateString('pt-BR');
  } catch {
    return '-';
  }
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return String(dateStr);
  }
};

/**
 * 1. IMPRESSÃO DO RELATÓRIO GERAL (CBMDF)
 */
export const printGeneralReport = ({
  currentData = [],
  currentMission = null,
  rasPresentes = '',
  currentUser = null,
  isMultiCity = false,
  cityOperabilityStats = [],
  topDefeitosComCidades = [],
  total = 0,
  operantes = 0,
  operantesPercent = 0,
  inoperantes = 0,
  inoperantesPercent = 0
}) => {
  const printWindow = window.open('', '_blank', 'width=1050,height=850');
  if (!printWindow) {
    alert('Por favor, autorize a abertura de popups no seu navegador para gerar o PDF oficial.');
    return;
  }

  const nowStr = formatDateTime(new Date());
  const emissorNome = currentUser?.nome || 'Militar Responsável';
  const emissorMatricula = currentUser?.matricula ? `Matrícula: ${currentUser.matricula}` : '';
  const emissorCargo = currentUser?.role === 'admin' ? 'Administrador Técnico' : (currentUser?.role === 'gestor' ? 'Gestor de Seção' : 'Vistoriador Operacional');

  const rowsHtml = currentData.map((h, idx) => {
    const code = h.nomHidrante || h.codHidrante || '-';
    const dataVis = formatDateOnly(h.datHoraUltimaVistoria || h.datHoraVistoria);
    const end = fixEncoding(h.dscEndereco) || h.dscLocalidade || '-';
    const ref = h.dscPontoReferencia ? `Ref: ${fixEncoding(h.dscPontoReferencia)}` : '';
    const vistoriador = h.vistoriadorNome || '-';
    const isOp = Boolean(h.flgAtivo);
    const prob = h.problemasHidrante ? sanitizeProblem(h.problemasHidrante) : (!isOp ? 'INOPERANTE' : '');
    const obs = h.dscObservacao || h.observacoes || h.obsVistoria || '';
    const ra = normalizeRAName(h.dscLocalidade) || '';

    return `
      <tr>
        <td class="col-seq">${idx + 1}</td>
        <td class="col-code">
          <strong>${code}</strong>
          ${ra ? `<div class="sub-text">${ra}</div>` : ''}
          <div class="date-text">${dataVis}</div>
        </td>
        <td class="col-end">
          <div>${end}</div>
          ${ref ? `<div class="ref-text">${ref}</div>` : ''}
        </td>
        <td class="col-vistoriador">${vistoriador}</td>
        <td class="col-status">
          <span class="badge ${isOp ? 'badge-op' : 'badge-inop'}">${isOp ? '● OPERANTE' : '● INOPERANTE'}</span>
          ${prob ? `<div class="prob-text">⚠️ ${prob}</div>` : ''}
          ${obs ? `<div class="obs-text"><em>Obs: ${obs}</em></div>` : ''}
        </td>
      </tr>
    `;
  }).join('');

  const multiCityHtml = (isMultiCity && cityOperabilityStats.length > 0) ? `
    <div class="section-block avoid-break">
      <div class="section-title">📊 Comparativo de Operacionalidade por Região Administrativa (RA)</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Região Administrativa (RA)</th>
            <th class="text-center">Total</th>
            <th class="text-center text-green">Operantes</th>
            <th class="text-center text-red">Inoperantes</th>
            <th style="width: 35%;">Operacionalidade (%)</th>
          </tr>
        </thead>
        <tbody>
          ${cityOperabilityStats.map(c => `
            <tr>
              <td><strong>${c.nome}</strong></td>
              <td class="text-center">${c.total}</td>
              <td class="text-center text-green"><strong>${c.operantes}</strong> (${c.operantesPercent}%)</td>
              <td class="text-center text-red"><strong>${c.inoperantes}</strong> (${c.inoperantesPercent}%)</td>
              <td>
                <div class="bar-container">
                  <div class="bar-fill bar-green" style="width: ${c.operantesPercent}%;"></div>
                  <div class="bar-fill bar-red" style="width: ${c.inoperantesPercent}%;"></div>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

  const topDefeitosHtml = (topDefeitosComCidades && topDefeitosComCidades.length > 0) ? `
    <div class="section-block avoid-break">
      <div class="section-title">⚠️ Principais Defeitos Identificados no DF</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Defeito / Inconformidade Técnica</th>
            <th class="text-center">Ocorrências</th>
            <th class="text-center">% do Total</th>
            <th>Cidades com Maior Incidência</th>
          </tr>
        </thead>
        <tbody>
          ${topDefeitosComCidades.map(d => `
            <tr>
              <td><strong class="text-red">${d.nome}</strong></td>
              <td class="text-center"><strong>${d.total}</strong></td>
              <td class="text-center">${d.percent.toFixed(1)}%</td>
              <td class="sub-text">${d.topCidades.map(tc => `${tc.cidade} (${tc.qtd})`).join(', ') || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <title>Relatorio_Geral_CBMDF_${nowStr.replace(/[^0-9]/g, '_')}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 10mm 10mm 12mm 10mm;
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
          line-height: 1.35;
          font-size: 11px;
          padding: 4px;
        }
        .official-header {
          text-align: center;
          border-bottom: 2.5px solid #0f172a;
          padding-bottom: 10px;
          margin-bottom: 14px;
        }
        .inst-title {
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.8px;
          color: #0f172a;
          text-transform: uppercase;
        }
        .doc-title {
          font-size: 15px;
          font-weight: 900;
          color: #1e3a8a;
          text-transform: uppercase;
          margin: 4px 0;
        }
        .doc-meta {
          font-size: 10.5px;
          color: #334155;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 16px;
          margin-top: 6px;
          font-weight: 600;
        }
        .kpi-row {
          display: flex;
          gap: 10px;
          margin-bottom: 14px;
        }
        .kpi-card {
          flex: 1;
          border: 1.5px solid #cbd5e1;
          border-radius: 6px;
          padding: 8px 12px;
          text-align: center;
          background: #f8fafc;
        }
        .kpi-label {
          font-size: 9.5px;
          font-weight: 800;
          text-transform: uppercase;
          color: #64748b;
        }
        .kpi-value {
          font-size: 18px;
          font-weight: 900;
          margin-top: 2px;
          color: #0f172a;
        }
        .card-green { border-color: #86efac; background: #f0fdf4; }
        .card-green .kpi-value { color: #15803d; }
        .card-red { border-color: #fca5a5; background: #fef2f2; }
        .card-red .kpi-value { color: #b91c1c; }
        
        .bar-container {
          display: flex;
          height: 10px;
          border-radius: 3px;
          overflow: hidden;
          background: #e2e8f0;
          width: 100%;
        }
        .bar-fill { height: 100%; }
        .bar-green { background: #16a34a; }
        .bar-red { background: #dc2626; }

        .section-block { margin-bottom: 14px; }
        .section-title {
          font-size: 11.5px;
          font-weight: 800;
          color: #0f172a;
          text-transform: uppercase;
          border-bottom: 1.5px solid #334155;
          padding-bottom: 3px;
          margin-bottom: 6px;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10.5px;
          margin-bottom: 6px;
        }
        .data-table th {
          background: #f1f5f9;
          color: #0f172a;
          font-weight: 800;
          border: 1px solid #cbd5e1;
          padding: 5px 6px;
          text-align: left;
          font-size: 9.5px;
          text-transform: uppercase;
        }
        .data-table td {
          border: 1px solid #e2e8f0;
          padding: 5px 6px;
          vertical-align: top;
        }
        .data-table tbody tr:nth-child(even) { background: #fafafa; }
        .col-seq { width: 4%; text-align: center; font-weight: bold; color: #64748b; }
        .col-code { width: 15%; }
        .col-end { width: 35%; }
        .col-vistoriador { width: 16%; font-weight: 600; color: #047857; }
        .col-status { width: 30%; }
        .badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 800;
          font-size: 9.5px;
        }
        .badge-op { background: #dcfce7; color: #166534; }
        .badge-inop { background: #fee2e2; color: #991b1b; }
        .prob-text { color: #b91c1c; font-weight: 700; font-size: 10px; margin-top: 3px; }
        .obs-text { color: #475569; font-size: 9.5px; margin-top: 2px; }
        .ref-text { color: #64748b; font-size: 9.5px; font-style: italic; margin-top: 2px; }
        .sub-text { font-size: 9.5px; color: #64748b; }
        .date-text { font-size: 9px; color: #64748b; font-weight: bold; margin-top: 2px; }
        .text-center { text-align: center; }
        .text-green { color: #15803d; }
        .text-red { color: #b91c1c; }
        .avoid-break { page-break-inside: avoid; break-inside: avoid; }
        
        .signature-section {
          margin-top: 28px;
          padding-top: 10px;
          text-align: center;
          page-break-inside: avoid;
        }
        .signature-line {
          width: 320px;
          border-top: 1.5px solid #000000;
          margin: 0 auto 6px auto;
        }
        .signature-name { font-size: 11.5px; font-weight: 800; color: #000000; }
        .signature-role { font-size: 10px; color: #475569; }
      </style>
    </head>
    <body>
      <div class="official-header">
        <div class="inst-title">Governo do Distrito Federal • Corpo de Bombeiros Militar do Distrito Federal</div>
        <div class="doc-title">Relatório de Vistoria de Hidrantes Urbanos</div>
        <div class="doc-meta">
          <span><strong>Localidade / RAs:</strong> ${rasPresentes || 'Todas as Cidades / DF Completo'}</span>
          ${currentMission ? `<span><strong>Missão:</strong> ${currentMission.name}</span>` : ''}
          <span><strong>Emissão:</strong> ${nowStr}</span>
        </div>
      </div>

      <div class="kpi-row avoid-break">
        <div class="kpi-card">
          <div class="kpi-label">Total Vistoriado</div>
          <div class="kpi-value">${total}</div>
        </div>
        <div class="kpi-card card-green">
          <div class="kpi-label">Hidrantes Operantes</div>
          <div class="kpi-value">${operantes} <span style="font-size: 12px;">(${operantesPercent}%)</span></div>
        </div>
        <div class="kpi-card card-red">
          <div class="kpi-label">Hidrantes Inoperantes</div>
          <div class="kpi-value">${inoperantes} <span style="font-size: 12px;">(${inoperantesPercent}%)</span></div>
        </div>
      </div>

      ${multiCityHtml}
      ${topDefeitosHtml}

      <div class="section-block">
        <div class="section-title">📋 Relação Técnica Detalhada (${currentData.length} hidrantes)</div>
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-seq">Nº</th>
              <th class="col-code">Código / Data</th>
              <th class="col-end">Endereço e Referência</th>
              <th class="col-vistoriador">Vistoriador</th>
              <th class="col-status">Situação Operacional / Observações</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <div class="signature-section avoid-break">
        <div class="signature-line"></div>
        <div class="signature-name">${emissorNome}</div>
        <div class="signature-role">${emissorCargo} • ${emissorMatricula}</div>
        <div class="signature-role" style="font-size: 9px; margin-top: 3px;">Sistema NETUNO • CBMDF</div>
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};

/**
 * 2. IMPRESSÃO DO RELATÓRIO OFICIAL CAESB (SOLICITAÇÃO DE MANUTENÇÃO)
 */
export const printCaesbReport = ({
  currentData = [],
  rasPresentes = '',
  currentMission = null,
  currentUser = null,
  stats = {},
  topDefeitos = []
}) => {
  const printWindow = window.open('', '_blank', 'width=1050,height=850');
  if (!printWindow) {
    alert('Por favor, autorize a abertura de popups no seu navegador para gerar o PDF oficial.');
    return;
  }

  const nowStr = formatDateTime(new Date());
  const emissorNome = currentUser?.nome || 'Gestor de Hidrantes Urbanos';
  const emissorMatricula = currentUser?.matricula ? `Matrícula: ${currentUser.matricula}` : '';

  const rowsHtml = currentData.map((h, idx) => {
    const code = h.nomHidrante || h.codHidrante || '-';
    const dataVis = formatDateOnly(h.datHoraUltimaVistoria || h.datHoraVistoria);
    const end = fixEncoding(h.dscEndereco) || h.dscLocalidade || '-';
    const ref = h.dscPontoReferencia ? `Ref: ${fixEncoding(h.dscPontoReferencia)}` : '';
    const prob = h.problemasHidrante ? sanitizeProblem(h.problemasHidrante) : 'INOPERANTE (Necessita Manutenção)';
    const obs = h.dscObservacao || h.observacoes || h.obsVistoria || '';
    const ra = normalizeRAName(h.dscLocalidade) || '';
    const lat = typeof h.numLatitude === 'number' ? h.numLatitude.toFixed(6) : (h.numLatitude || '-');
    const lng = typeof h.numLongitude === 'number' ? h.numLongitude.toFixed(6) : (h.numLongitude || '-');
    const foto = h.fotoUrl || h.fotoPerfil || '';

    return `
      <tr>
        <td class="col-seq">${idx + 1}</td>
        <td class="col-code">
          <strong>${code}</strong>
          ${ra ? `<div class="sub-text">${ra}</div>` : ''}
          <div class="coord-text">${lat}, ${lng}</div>
          <div class="date-text">Vistoria: ${dataVis}</div>
        </td>
        <td class="col-end">
          <div><strong>${end}</strong></div>
          ${ref ? `<div class="ref-text">${ref}</div>` : ''}
        </td>
        <td class="col-prob">
          <div class="prob-box">
            <strong>⚠️ Defeito Constatado:</strong>
            <div class="prob-name">${prob}</div>
            ${obs ? `<div class="obs-box"><em>Obs: ${obs}</em></div>` : ''}
          </div>
        </td>
        <td class="col-photo">
          ${foto ? `
            <div class="photo-box">
              <img src="${foto}" alt="Registro Fotográfico" class="evidence-img" />
              <div class="photo-label">Evidência de Campo</div>
            </div>
          ` : '<div class="no-photo">Sem foto cadastrada</div>'}
        </td>
      </tr>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <title>Relatorio_CAESB_Manutencao_${nowStr.replace(/[^0-9]/g, '_')}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 10mm 10mm 12mm 10mm;
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
          line-height: 1.35;
          font-size: 11px;
          padding: 4px;
        }
        .official-header {
          text-align: center;
          border-bottom: 2.5px solid #047857;
          padding-bottom: 10px;
          margin-bottom: 12px;
        }
        .inst-title {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.5px;
          color: #0f172a;
          text-transform: uppercase;
        }
        .doc-title {
          font-size: 15px;
          font-weight: 900;
          color: #047857;
          text-transform: uppercase;
          margin: 4px 0;
        }
        .legal-term {
          font-size: 10px;
          color: #475569;
          margin-top: 3px;
          font-weight: 600;
        }
        .doc-meta {
          font-size: 10.5px;
          color: #334155;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 16px;
          margin-top: 6px;
          font-weight: 600;
        }
        .caesb-banner {
          background: #ecfdf5;
          border: 1.5px solid #a7f3d0;
          border-radius: 6px;
          padding: 8px 12px;
          margin-bottom: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .caesb-banner strong { color: #065f46; font-size: 12px; }
        .caesb-badge {
          background: #047857;
          color: #ffffff;
          padding: 4px 10px;
          border-radius: 6px;
          font-weight: 800;
          font-size: 12px;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10.5px;
          margin-bottom: 6px;
        }
        .data-table th {
          background: #f1f5f9;
          color: #0f172a;
          font-weight: 800;
          border: 1.5px solid #cbd5e1;
          padding: 6px;
          text-align: left;
          font-size: 9.5px;
          text-transform: uppercase;
        }
        .data-table td {
          border: 1px solid #cbd5e1;
          padding: 6px;
          vertical-align: top;
        }
        .col-seq { width: 4%; text-align: center; font-weight: bold; color: #64748b; }
        .col-code { width: 18%; }
        .col-end { width: 34%; }
        .col-prob { width: 30%; }
        .col-photo { width: 14%; text-align: center; }
        .coord-text { font-family: monospace; font-size: 9px; color: #1e3a8a; font-weight: bold; margin-top: 2px; }
        .sub-text { font-size: 9.5px; color: #64748b; }
        .date-text { font-size: 9px; color: #475569; margin-top: 2px; }
        .ref-text { color: #64748b; font-size: 9.5px; font-style: italic; margin-top: 3px; }
        .prob-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 6px; }
        .prob-name { color: #b91c1c; font-weight: 800; font-size: 10.5px; margin-top: 2px; }
        .obs-box { margin-top: 4px; font-size: 9.5px; color: #475569; }
        .evidence-img {
          width: 65px;
          height: 65px;
          object-fit: cover;
          border-radius: 4px;
          border: 1px solid #94a3b8;
        }
        .photo-label { font-size: 8px; color: #64748b; margin-top: 2px; text-transform: uppercase; font-weight: bold; }
        .no-photo { font-size: 9px; color: #94a3b8; font-style: italic; padding: 10px 0; }
        .avoid-break { page-break-inside: avoid; break-inside: avoid; }
        
        .signature-section {
          margin-top: 32px;
          padding-top: 10px;
          text-align: center;
          page-break-inside: avoid;
        }
        .signature-line {
          width: 340px;
          border-top: 1.5px solid #000000;
          margin: 0 auto 6px auto;
        }
        .signature-name { font-size: 12px; font-weight: 800; color: #000000; }
        .signature-role { font-size: 10px; color: #475569; }
      </style>
    </head>
    <body>
      <div class="official-header">
        <div class="inst-title">Governo do Distrito Federal • CBMDF / CAESB</div>
        <div class="doc-title">Solicitação Oficial de Manutenção de Hidrantes Urbanos</div>
        <div class="legal-term">Conforme Termo de Cooperação Técnica CAESB/CBMDF publicado no DODF em 25/03/2019</div>
        <div class="doc-meta">
          <span><strong>Regiões Administrativas:</strong> ${rasPresentes || 'Todas as Cidades / DF Completo'}</span>
          <span><strong>Data de Notificação:</strong> ${nowStr}</span>
        </div>
      </div>

      <div class="caesb-banner avoid-break">
        <div>
          <strong>Demanda Prioritária de Manutenção Hidráulica</strong>
          <div style="font-size: 10px; color: #047857; margin-top: 2px;">
            Encaminhamento formal à Companhia de Saneamento Ambiental do Distrito Federal (CAESB) para providências de reparo.
          </div>
        </div>
        <div class="caesb-badge">${currentData.length} Hidrantes Inoperantes</div>
      </div>

      <div class="avoid-break">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-seq">Nº</th>
              <th class="col-code">Código / Coordenadas</th>
              <th class="col-end">Endereço e Ponto de Referência</th>
              <th class="col-prob">Inconformidade / Defeito Normatizado</th>
              <th class="col-photo">Evidência</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <div class="signature-section avoid-break">
        <div class="signature-line"></div>
        <div class="signature-name">${emissorNome}</div>
        <div class="signature-role">${emissorMatricula} • Encarregado da Gestão de Hidrantes de Incêndio</div>
        <div class="signature-role" style="font-size: 9px; margin-top: 3px;">Seção de Hidrantes Urbanos • CBMDF</div>
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};

/**
 * 3. IMPRESSÃO DA FICHA TÁTICA PPO (PRÉ-PLANEJAMENTO OPERACIONAL / PRÉ-POP)
 */
export const printBuildingStudyReport = ({ study, currentUser = null }) => {
  if (!study) {
    alert('Nenhuma edificação selecionada.');
    return;
  }

  const printWindow = window.open('', '_blank', 'width=1050,height=850');
  if (!printWindow) {
    alert('Por favor, autorize a abertura de popups no seu navegador para gerar o PDF oficial.');
    return;
  }

  const nowStr = formatDateTime(new Date());
  const emissorNome = currentUser?.nome || 'Oficial de Operações / SCI';
  const emissorMatricula = currentUser?.matricula ? `Matrícula: ${currentUser.matricula}` : '';

  const lat = typeof study.numLatitude === 'number' ? study.numLatitude.toFixed(6) : (study.numLatitude || '-');
  const lng = typeof study.numLongitude === 'number' ? study.numLongitude.toFixed(6) : (study.numLongitude || '-');

  const contatosHtml = (study.contatos && study.contatos.length > 0) ? study.contatos.map(c => `
    <tr>
      <td><strong>${c.nome || '-'}</strong></td>
      <td>${c.funcao || '-'}</td>
      <td><strong>${c.telefone || '-'}</strong></td>
    </tr>
  `).join('') : '<tr><td colspan="3" class="text-center">Nenhum contato de emergência cadastrado</td></tr>';

  const hidrantesHtml = (study.hidrantesProximos && study.hidrantesProximos.length > 0) ? study.hidrantesProximos.map(h => `
    <tr>
      <td><strong>${h.codigo || '-'}</strong></td>
      <td>${h.endereco || '-'}</td>
      <td class="text-center"><strong>${h.distancia || '-'}</strong></td>
      <td class="text-center">${h.diametro || '100mm'}</td>
      <td class="text-center"><span class="badge ${h.status === 'Operante' ? 'badge-op' : 'badge-inop'}">${h.status || 'Operante'}</span></td>
    </tr>
  `).join('') : '<tr><td colspan="5" class="text-center">Nenhum hidrante próximo mapeado</td></tr>';

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <title>Ficha_Tatica_PPO_${fixEncoding(study.nomeFantasia || 'Edificacao').replace(/[^a-zA-Z0-9]/g, '_')}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 10mm 10mm 12mm 10mm;
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
          line-height: 1.35;
          font-size: 11px;
          padding: 4px;
        }
        .official-header {
          text-align: center;
          border-bottom: 2.5px solid #0f172a;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .inst-title {
          font-size: 12px;
          font-weight: 800;
          color: #0f172a;
          text-transform: uppercase;
        }
        .doc-title {
          font-size: 16px;
          font-weight: 900;
          color: #b91c1c;
          text-transform: uppercase;
          margin: 3px 0;
        }
        .building-name {
          font-size: 14px;
          font-weight: 900;
          color: #1e3a8a;
          margin-top: 2px;
        }
        .meta-line {
          font-size: 10px;
          color: #475569;
          margin-top: 4px;
          font-weight: 600;
        }
        .section-box {
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          margin-bottom: 10px;
          overflow: hidden;
          page-break-inside: avoid;
        }
        .section-header {
          background: #f1f5f9;
          border-bottom: 1px solid #cbd5e1;
          padding: 5px 10px;
          font-weight: 800;
          font-size: 11px;
          color: #0f172a;
          text-transform: uppercase;
        }
        .section-body { padding: 8px 10px; }
        .grid-2 { display: flex; gap: 12px; }
        .grid-2 > div { flex: 1; }
        .item-label { font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 2px; }
        .item-value { font-size: 11px; color: #0f172a; margin-bottom: 6px; }
        .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 6px; color: #991b1b; font-size: 10px; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 4px; }
        .data-table th { background: #f8fafc; border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; font-weight: 800; }
        .data-table td { border: 1px solid #e2e8f0; padding: 4px 6px; }
        .text-center { text-align: center; }
        .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 9px; }
        .badge-op { background: #dcfce7; color: #166534; }
        .badge-inop { background: #fee2e2; color: #991b1b; }
        .avoid-break { page-break-inside: avoid; break-inside: avoid; }
        .signature-section {
          margin-top: 24px;
          padding-top: 8px;
          text-align: center;
          page-break-inside: avoid;
        }
        .signature-line {
          width: 320px;
          border-top: 1.5px solid #000000;
          margin: 0 auto 6px auto;
        }
        .signature-name { font-size: 11.5px; font-weight: 800; color: #000000; }
        .signature-role { font-size: 9.5px; color: #475569; }
      </style>
    </head>
    <body>
      <div class="official-header">
        <div class="inst-title">Corpo de Bombeiros Militar do Distrito Federal • Sistema de Comando de Incidentes</div>
        <div class="doc-title">Ficha Tática de Pré-Planejamento Operacional (PPO)</div>
        <div class="building-name">${study.nomeFantasia || 'Edificação de Interesse Operacional'}</div>
        <div class="meta-line">
          Razão Social: ${study.razaoSocial || '-'} • Cidade/RA: ${study.ra || '-'} • Emissão: ${nowStr}
        </div>
      </div>

      <!-- SEÇÃO A -->
      <div class="section-box">
        <div class="section-header">A. Identificação, Localização e Contatos de Emergência</div>
        <div class="section-body">
          <div class="grid-2">
            <div>
              <div class="item-label">Endereço Completo</div>
              <div class="item-value"><strong>${study.endereco || '-'}</strong> (CEP: ${study.cep || '-'})</div>
              <div class="item-label">Coordenadas Geográficas (GPS)</div>
              <div class="item-value" style="font-family: monospace; color: #1e3a8a; font-weight: bold;">${lat}, ${lng}</div>
            </div>
            <div>
              <div class="item-label">Classificação de Ocupação & População</div>
              <div class="item-value"><strong>Ocupação:</strong> ${study.ocupacao || '-'} • <strong>Fixa:</strong> ${study.populacaoFixa || '-'} • <strong>Flutuante:</strong> ${study.populacaoFlutuante || '-'}</div>
              <div class="item-label">Evacuação Prioritária</div>
              <div class="item-value" style="color: #b91c1c; font-weight: bold;">${study.populacaoPrioritaria || 'Sem grupos especiais mapeados'}</div>
            </div>
          </div>
          <div class="item-label" style="margin-top: 6px;">Contatos Críticos da Edificação</div>
          <table class="data-table">
            <thead>
              <tr><th>Nome</th><th>Função / Posto</th><th>Telefone / Ramal</th></tr>
            </thead>
            <tbody>${contatosHtml}</tbody>
          </table>
        </div>
      </div>

      <!-- SEÇÃO B -->
      <div class="section-box">
        <div class="section-header">B. Acessibilidade e Posicionamento do Trem de Socorro</div>
        <div class="section-body">
          <div class="grid-2">
            <div>
              <div class="item-label">Via Principal de Acesso</div>
              <div class="item-value">${study.viaPrincipal || '-'}</div>
              <div class="item-label">Via Alternativa</div>
              <div class="item-value">${study.viaAlternativa || '-'}</div>
            </div>
            <div>
              <div class="item-label">Posicionamento das Viaturas</div>
              <div class="item-value"><strong>ABT:</strong> ${study.posicionamentoABT || '-'}</div>
              <div class="item-value"><strong>AET / Plataforma:</strong> ${study.posicionamentoAET || '-'}</div>
              <div class="item-value"><strong>Posto de Comando (PC):</strong> ${study.postoComando || '-'}</div>
            </div>
          </div>
          ${study.restricoesViarias ? `
            <div class="alert-box" style="margin-top: 6px;">
              <strong>⚠️ Restrições Viárias / Gabaritos de Carga:</strong> ${study.restricoesViarias}
            </div>
          ` : ''}
        </div>
      </div>

      <!-- SEÇÃO C -->
      <div class="section-box">
        <div class="section-header">C. Recursos Hídricos e Hidrantes Urbanos Próximos</div>
        <div class="section-body">
          <div class="grid-2">
            <div>
              <div class="item-label">Reserva Técnica de Incêndio (RTI)</div>
              <div class="item-value"><strong>${study.volumeRTI || 'Não informado'}</strong></div>
            </div>
            <div>
              <div class="item-label">Registro de Recalque</div>
              <div class="item-value">Tipo: <strong>${study.registroRecalqueTipo || '-'}</strong> • Localização: ${study.registroRecalqueLocal || '-'}</div>
            </div>
          </div>
          <div class="item-label" style="margin-top: 6px;">3 Hidrantes Urbanos Mais Próximos (Rede Pública CAESB)</div>
          <table class="data-table">
            <thead>
              <tr><th>Código</th><th>Endereço</th><th class="text-center">Distância</th><th class="text-center">Diâmetro</th><th class="text-center">Status</th></tr>
            </thead>
            <tbody>${hidrantesHtml}</tbody>
          </table>
          ${study.mananciaisAlternativos ? `
            <div class="item-value" style="margin-top: 6px; font-size: 10px; color: #047857;">
              <strong>Mananciais Alternativos:</strong> ${study.mananciaisAlternativos}
            </div>
          ` : ''}
        </div>
      </div>

      <!-- SEÇÃO D & E -->
      <div class="section-box">
        <div class="section-header">D & E. Sistemas de Proteção, Cortes de Emergência e Carga de Incêndio</div>
        <div class="section-body">
          <div class="grid-2">
            <div>
              <div class="item-label">Corte de Energia Elétrica</div>
              <div class="item-value">${study.chaveGeralEnergia || '-'}</div>
              <div class="item-label">Corte de Gás (GLP / GN)</div>
              <div class="item-value">${study.valvulaGeralGas || '-'}</div>
              <div class="item-label">Sprinklers / VGA</div>
              <div class="item-value">${study.sprinklersVGA || '-'}</div>
            </div>
            <div>
              <div class="item-label">Carga de Incêndio & Riscos Específicos</div>
              <div class="item-value">Carga: <strong>${study.cargaIncendio || '-'}</strong> • Produtos Perigosos: ${study.produtosPerigosos || 'Nenhum'}</div>
              <div class="item-label">Áreas Críticas</div>
              <div class="item-value">${study.areasCriticas || '-'}</div>
              <div class="item-label">Risco de Colapso Estrutural</div>
              <div class="item-value">${study.riscoColapso || '-'}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="signature-section avoid-break">
        <div class="signature-line"></div>
        <div class="signature-name">${emissorNome}</div>
        <div class="signature-role">${emissorMatricula} • Oficial Especialista em Pré-Planejamento Operacional</div>
        <div class="signature-role" style="font-size: 9px; margin-top: 3px;">Corpo de Bombeiros Militar do Distrito Federal</div>
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};

/**
 * 4. IMPRESSÃO DO PARECER TÉCNICO (ESTUDO TÉCNICO DE HIDRANTES - PADRÃO SEI)
 */
export const printTechnicalStudyReport = ({ studyData, calcResults, currentUser = null }) => {
  if (!studyData || !calcResults) {
    alert('Dados do estudo técnico incompletos para impressão.');
    return;
  }

  const printWindow = window.open('', '_blank', 'width=1050,height=850');
  if (!printWindow) {
    alert('Por favor, autorize a abertura de popups no seu navegador para gerar o PDF oficial.');
    return;
  }

  const nowStr = formatDateTime(new Date());
  const emissorNome = currentUser?.nome || 'Analista Técnico';
  const emissorMatricula = currentUser?.matricula ? `Matrícula: ${currentUser.matricula}` : '';
  const isRemocao = studyData.studyType === 'remocao';
  const isApproved = calcResults.isApproved;

  const adjacentsHtml = (calcResults.adjacentHydrants || []).map((h, i) => `
    <tr>
      <td class="text-center">${i + 1}</td>
      <td><strong>${h.codHidrante || h.nomHidrante || '-'}</strong></td>
      <td class="text-center"><strong>${h.distance ? Math.round(h.distance) + ' m' : '-'}</strong></td>
      <td style="font-family: monospace;">${h.numLatitude?.toFixed(6) || '-'}, ${h.numLongitude?.toFixed(6) || '-'}</td>
      <td>${fixEncoding(h.dscEndereco) || '-'}</td>
      <td class="text-center"><span class="badge ${h.flgAtivo ? 'badge-op' : 'badge-inop'}">${h.flgAtivo ? 'Operante' : 'Inoperante'}</span></td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <title>Parecer_Tecnico_Hidrantes_${nowStr.replace(/[^0-9]/g, '_')}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 15mm 15mm 15mm 15mm;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: 'Times New Roman', Times, serif;
          color: #000000;
          background: #ffffff;
          line-height: 1.5;
          font-size: 12pt;
          padding: 8px;
        }
        .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #000; padding-bottom: 12px; }
        .inst { font-size: 13pt; font-weight: bold; text-transform: uppercase; }
        .sub-inst { font-size: 11pt; }
        .doc-title { font-size: 14pt; font-weight: bold; margin-top: 10px; text-transform: uppercase; }
        
        .section-num { font-weight: bold; text-transform: uppercase; margin-top: 16px; margin-bottom: 6px; }
        p { text-align: justify; text-indent: 2.5em; margin-bottom: 8px; }
        
        .data-table { width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 9.5pt; margin: 12px 0; }
        .data-table th, .data-table td { border: 1px solid #000; padding: 5px 6px; }
        .data-table th { background: #f2f2f2; font-weight: bold; text-align: left; }
        .text-center { text-align: center; }
        .badge { display: inline-block; padding: 1px 5px; border-radius: 3px; font-weight: bold; font-size: 8.5pt; }
        .badge-op { background: #dcfce7; color: #166534; }
        .badge-inop { background: #fee2e2; color: #991b1b; }
        
        .result-box {
          border: 2px solid #000;
          padding: 10px;
          margin: 14px 0;
          font-family: Arial, sans-serif;
          font-weight: bold;
          text-align: center;
          font-size: 11pt;
        }
        .result-approved { background: #f0fdf4; border-color: #166534; color: #166534; }
        .result-rejected { background: #fef2f2; border-color: #991b1b; color: #991b1b; }
        
        .signature { margin-top: 40px; text-align: center; page-break-inside: avoid; }
        .sig-line { width: 320px; border-top: 1px solid #000; margin: 0 auto 6px auto; }
        .sig-name { font-weight: bold; }
        .sig-role { font-size: 10pt; color: #333; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="inst">Governo do Distrito Federal</div>
        <div class="sub-inst">Corpo de Bombeiros Militar do Distrito Federal</div>
        <div class="sub-inst">Diretoria de Vistorias / Seção Técnica de Hidrantes</div>
        <div class="doc-title">Parecer Técnico de Dimensionamento e Viabilidade de Hidrantes</div>
      </div>

      <div class="section-num">I - Referência</div>
      <p><strong>Documento de Origem:</strong> ${studyData.docRef || 'Estudo Técnico'}</p>
      ${studyData.infoGerais ? `<p>${studyData.infoGerais}</p>` : ''}

      <div class="section-num">II - Finalidade</div>
      <p>
        O presente estudo tem por finalidade analisar tecnicamente a viabilidade de 
        <strong>${isRemocao ? 'remanejamento ou desativação de hidrante urbano' : 'projeção de novo hidrante urbano'}</strong> 
        na localidade de <strong>${studyData.selectedRA || 'Distrito Federal'}</strong>, em atendimento às diretrizes 
        operacionais de segurança pública e combate a incêndios urbanos.
      </p>

      <div class="section-num">III - Fundamentação Normativa</div>
      <p>
        A análise de cobertura fundamenta-se estritamente nas prescrições da <strong>ABNT NBR 12.218/2017</strong> 
        (Projeto de Rede de Distribuição de Água para Abastecimento Público) e Normas Técnicas do CBMDF. 
        Classificação da ocupação adotada: <strong>${studyData.occupation}</strong>, correspondendo a um raio regulamentar de proteção de 
        <strong>${calcResults.radius} metros</strong>.
      </p>

      <div class="section-num">IV - Fatos Observados e Equipamentos Adjacentes</div>
      <p>
        Por meio de processamento georreferenciado e cálculo geodésico na malha urbana de hidrantes cadastrados, 
        foram identificados <strong>${(calcResults.adjacentHydrants || []).length} equipamentos adjacentes</strong> com potencial de cobertura:
      </p>

      <table class="data-table">
        <thead>
          <tr>
            <th class="text-center">Item</th>
            <th>Código</th>
            <th class="text-center">Distância</th>
            <th>Coordenadas</th>
            <th>Endereço / Localidade</th>
            <th class="text-center">Situação</th>
          </tr>
        </thead>
        <tbody>
          ${adjacentsHtml || '<tr><td colspan="6" class="text-center">Nenhum hidrante adjacente detectado</td></tr>'}
        </tbody>
      </table>

      <div class="section-num">V - Parecer Conclusivo</div>
      <div class="result-box ${isApproved ? 'result-approved' : 'result-rejected'}">
        PARECER TÉCNICO: ${isApproved ? 'FAVORÁVEL / APROVADO' : 'DESFAVORÁVEL / REPROVADO'}
      </div>
      <p>
        ${isApproved 
          ? (isRemocao 
              ? `Diante da análise espacial executada, constatou-se que a totalidade da área de proteção do hidrante sob exame encontra-se integralmente sobreposta e salvaguardada pelos hidrantes adjacentes da rede pública, preenchendo os requisitos técnicos da ABNT NBR 12.218/2017.`
              : `A poligonal de interesse encontra-se devidamente contemplada dentro do raio normativo estipulado, garantindo a proteção contra incêndio sem zonas de desabastecimento.`)
          : (isRemocao 
              ? `A remoção pleiteada acarretará desassistência em setores da área de cobertura regulamentar, expondo o perímetro a distâncias superiores ao limite normativo. Não se recomenda o desmantelamento sem reposição tática.`
              : `A cobertura calculada apontou vértices descobertos que extrapolam a distância regulamentar de ${calcResults.radius}m. Sugere-se a realocação das coordenadas conforme indicado na análise.`)}
      </p>

      <div class="signature">
        <div class="sig-line"></div>
        <div class="sig-name">${emissorNome}</div>
        <div class="sig-role">${emissorMatricula} • Analista Técnico de Hidrantes</div>
        <div class="sig-role">Corpo de Bombeiros Militar do Distrito Federal</div>
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};
