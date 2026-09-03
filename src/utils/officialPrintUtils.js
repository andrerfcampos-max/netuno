import { fixEncoding } from './textUtils';
import { normalizeRAName } from './raList';
import { sanitizeProblem, isHidranteRemovido } from './problemUtils';

/**
 * Utilitário de Geração e Impressão de Documentos Oficiais em Formato A4
 * Padrão Institucional do Corpo de Bombeiros Militar do Distrito Federal (CBMDF)
 * e Companhia de Saneamento Ambiental do Distrito Federal (CAESB).
 */

// Brasões removidos conforme diretriz de simplificação e layout limpo institucional
export const GDF_EMBLEM_SVG = '';
export const CBMDF_EMBLEM_SVG = '';

// Gerador de Hash Criptográfico Curto para Controle e Rastreabilidade Documental
export const generateDocHash = (seedStr) => {
  let hashVal = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hashVal = ((hashVal << 5) - hashVal) + seedStr.charCodeAt(i);
    hashVal |= 0;
  }
  return Math.abs(hashVal).toString(16).toUpperCase().padStart(8, '0');
};

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
 * Utilitário modular para extração consistente de fotos/evidências de hidrantes
 */
export const extractPhotos = (h) => {
  if (!h) return [];
  const photos = [];
  const add = (p) => {
    if (typeof p === 'string' && p.trim().length > 10 && !photos.includes(p)) {
      photos.push(p);
    }
  };
  if (Array.isArray(h.fotosVistoria)) h.fotosVistoria.forEach(add);
  if (Array.isArray(h.fotos)) h.fotos.forEach(add);
  if (Array.isArray(h.HISTORICO_VISTORIAS)) {
    h.HISTORICO_VISTORIAS.forEach(v => {
      if (Array.isArray(v.fotosVistoria)) v.fotosVistoria.forEach(add);
      if (v.fotoVistoria) add(v.fotoVistoria);
      if (v.fotoUrl) add(v.fotoUrl);
    });
  }
  if (h.fotoVistoria) add(h.fotoVistoria);
  if (h.fotoPerfil) add(h.fotoPerfil);
  if (h.foto) add(h.foto);
  if (h.fotoUrl) add(h.fotoUrl);
  return photos;
};

/**
 * Utilitário central de abertura no Leitor de PDF / Impressão Nativo do Navegador.
 * Permite ao usuário visualizar o documento em tela cheia, com barra de ações
 * imediatas para Salvar como PDF, Compartilhar ou Fechar.
 * Restaura o nome padronizado original do arquivo no diálogo de download, eliminando 'netuno.pdf'.
 */
export const executePrintHtml = (html, docTitle = '') => {
  try {
    // 1. Extrai ou define o título padronizado oficial do documento
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const standardTitle = docTitle || (titleMatch ? titleMatch[1] : 'Relatorio_Netuno_CBMDF');

    // 2. Garante que o documento principal também reflita temporariamente o nome padronizado
    // prevenindo que navegadores desktop/mobile salvem como "netuno.pdf"
    const prevMainTitle = document.title;
    document.title = standardTitle;
    setTimeout(() => {
      try { document.title = prevMainTitle; } catch (e) {}
    }, 20000);

    // 3. Estilos e Barra Superior do Leitor de PDF (ativa em tela, oculta na impressão física/PDF)
    const readerToolbarStyle = `
      <style>
        .netuno-pdf-toolbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 48px;
          background: #0f172a;
          color: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          z-index: 999999;
          box-shadow: 0 4px 14px rgba(0,0,0,0.3);
          font-family: Arial, Helvetica, sans-serif;
        }
        .netuno-pdf-title {
          font-size: 13px;
          font-weight: bold;
          color: #38bdf8;
          display: flex;
          align-items: center;
          gap: 8px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .netuno-pdf-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .netuno-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: bold;
          cursor: pointer;
          border: none;
          transition: background 0.2s, transform 0.1s;
        }
        .netuno-btn:active { transform: scale(0.97); }
        .netuno-btn-print {
          background: #0284c7;
          color: #ffffff;
        }
        .netuno-btn-print:hover { background: #0369a1; }
        .netuno-btn-share {
          background: #059669;
          color: #ffffff;
        }
        .netuno-btn-share:hover { background: #047857; }
        .netuno-btn-close {
          background: #334155;
          color: #e2e8f0;
        }
        .netuno-btn-close:hover { background: #475569; }
        @media screen {
          body {
            padding-top: 56px !important;
            background: #cbd5e1 !important;
            margin: 0 !important;
          }
          .netuno-document-sheet {
            max-width: 210mm;
            margin: 16px auto !important;
            background: #ffffff !important;
            box-shadow: 0 6px 24px rgba(0,0,0,0.18) !important;
            border-radius: 4px;
            padding: 12mm 10mm !important;
            box-sizing: border-box;
          }
        }
        @media print {
          .netuno-pdf-toolbar {
            display: none !important;
          }
          body {
            padding-top: 0 !important;
            background: #ffffff !important;
            margin: 0 !important;
          }
          .netuno-document-sheet {
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
            box-shadow: none !important;
            background: transparent !important;
          }
        }
      </style>
    `;

    const readerToolbarHtml = `
      <div class="netuno-pdf-toolbar no-print">
        <div class="netuno-pdf-title">
          <span>📄</span>
          <span>${standardTitle.replace(/_/g, ' ')}</span>
        </div>
        <div class="netuno-pdf-actions">
          <button type="button" class="netuno-btn netuno-btn-print" onclick="window.print()" title="Salvar como PDF ou Imprimir">
            🖨️ Salvar PDF / Imprimir
          </button>
          <button type="button" class="netuno-btn netuno-btn-share" onclick="handleShareDocumento()" title="Compartilhar documento">
            📲 Compartilhar
          </button>
          <button type="button" class="netuno-btn netuno-btn-close" onclick="window.close()" title="Fechar leitor">
            ✕ Fechar
          </button>
        </div>
      </div>
      <script>
        function handleShareDocumento() {
          if (navigator.share) {
            navigator.share({
              title: document.title,
              text: 'Relatório Oficial Sistema Netuno - CBMDF: ' + document.title,
              url: window.location.href
            }).catch(function() {});
          } else {
            window.print();
          }
        }
      </script>
    `;

    // Injeta estilo no head e toolbar no body, envolvendo o conteúdo na folha .netuno-document-sheet
    let fullHtml = html;
    if (fullHtml.includes('</head>')) {
      fullHtml = fullHtml.replace('</head>', `${readerToolbarStyle}</head>`);
    } else {
      fullHtml = readerToolbarStyle + fullHtml;
    }

    if (fullHtml.includes('<body')) {
      fullHtml = fullHtml.replace(/<body([^>]*)>([\s\S]*)<\/body>/i, (match, bodyAttrs, bodyContent) => {
        return `<body${bodyAttrs}>${readerToolbarHtml}<div class="netuno-document-sheet">${bodyContent}</div></body>`;
      });
    } else {
      fullHtml = `${readerToolbarHtml}<div class="netuno-document-sheet">${fullHtml}</div>`;
    }

    // 4. Abre em nova aba no leitor padrão/nativo do navegador
    let printWindow = null;
    try {
      printWindow = window.open('', '_blank');
    } catch (err) {
      console.warn('Falha ao abrir nova aba para leitor de PDF:', err);
    }

    if (printWindow && printWindow.document) {
      printWindow.document.open();
      printWindow.document.write(fullHtml);
      printWindow.document.close();
      if (printWindow.focus) printWindow.focus();
      return;
    }

    // Fallback: se o navegador bloquear popup, aciona iframe invisível de impressão
    fallbackIframePrint(fullHtml);
  } catch (e) {
    console.error('Erro ao acionar leitor de PDF/impressão:', e);
    fallbackPopupPrint(html);
  }
};

export const fallbackIframePrint = (html) => {
  try {
    const existing = document.getElementById('netuno-print-iframe');
    if (existing) existing.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'netuno-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.top = '-10000px';
    iframe.style.left = '-10000px';
    iframe.style.width = '1024px';
    iframe.style.height = '768px';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    const doPrint = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        fallbackPopupPrint(html);
      }
    };

    const cleanup = () => {
      setTimeout(() => {
        const frame = document.getElementById('netuno-print-iframe');
        if (frame) frame.remove();
      }, 500);
    };

    iframe.contentWindow.addEventListener('afterprint', cleanup);
    setTimeout(doPrint, 350);
  } catch (err) {
    fallbackPopupPrint(html);
  }
};

export const fallbackPopupPrint = (html) => {
  const printWindow = window.open('', '_blank', 'width=1050,height=850');
  if (!printWindow) {
    alert('Por favor, autorize a abertura de popups no seu navegador para gerar o PDF oficial.');
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.addEventListener('afterprint', () => {
    try { printWindow.close(); } catch (e) {}
  });
};

/**
 * Constrói nome padronizado do arquivo de relatório / PDF contendo o tipo, a Cidade (RA),
 * os filtros aplicados e a data.
 */
export const buildReportFileName = ({
  prefix = 'Relatorio_CBMDF',
  cidade = '',
  rasPresentes = '',
  activeFilters = null,
  currentMission = null
}) => {
  const parts = [prefix];

  // 1. Nome da Cidade / Região Administrativa
  let cidadeStr = '';
  if (activeFilters?.ra && activeFilters.ra.trim()) {
    cidadeStr = normalizeRAName(activeFilters.ra) || activeFilters.ra;
  } else if (cidade && cidade.trim()) {
    cidadeStr = normalizeRAName(cidade) || cidade;
  } else if (rasPresentes && rasPresentes.trim()) {
    const list = rasPresentes.split(',').map(s => s.trim()).filter(Boolean);
    if (list.length === 1) {
      cidadeStr = list[0];
    } else if (list.length <= 3) {
      cidadeStr = list.join('_');
    } else {
      cidadeStr = 'DF_Multiplas_RAs';
    }
  } else {
    cidadeStr = 'DF_Geral';
  }

  if (cidadeStr) {
    parts.push(cidadeStr.replace(/[^a-zA-Z0-9]/g, '_'));
  }

  // 2. Missão (se ativa)
  if (currentMission?.name) {
    parts.push(`Missao_${currentMission.name.replace(/[^a-zA-Z0-9]/g, '_')}`);
  }

  // 3. Filtros aplicados
  if (activeFilters) {
    if (activeFilters.status && activeFilters.status !== 'Todos') {
      parts.push(activeFilters.status.replace(/[^a-zA-Z0-9]/g, '_'));
    }
    if (activeFilters.periodo) {
      parts.push(`Ano_${String(activeFilters.periodo).replace(/[^a-zA-Z0-9]/g, '_')}`);
    }
    if (activeFilters.problema && activeFilters.problema.trim()) {
      parts.push(`Defeito_${activeFilters.problema.trim().replace(/[^a-zA-Z0-9]/g, '_')}`);
    }
    if (activeFilters.buscaGeral && activeFilters.buscaGeral.trim()) {
      parts.push(`Busca_${activeFilters.buscaGeral.trim().replace(/[^a-zA-Z0-9]/g, '_')}`);
    }
    if (activeFilters.dataInicio || activeFilters.dataFim) {
      const dIni = activeFilters.dataInicio ? activeFilters.dataInicio.replace(/[^0-9]/g, '') : '';
      const dFim = activeFilters.dataFim ? activeFilters.dataFim.replace(/[^0-9]/g, '') : '';
      parts.push(`Periodo_${dIni}_${dFim}`);
    }
  }

  // 4. Data de emissão (AAAAMMDD)
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  parts.push(`${year}${month}${day}`);

  return parts.filter(Boolean).join('_').replace(/_+/g, '_');
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
  inoperantesPercent = 0,
  topDefeitos = [],
  yearStats = [],
  activeFilters = null
}) => {
  const nowStr = formatDateTime(new Date());
  const emissorNome = currentUser?.nome || 'Militar Responsável';
  const emissorMatricula = currentUser?.matricula ? `Matrícula: ${currentUser.matricula}` : '';
  const emissorCargo = currentUser?.role === 'admin' ? 'Administrador Técnico' : (currentUser?.role === 'gestor' ? 'Gestor de Hidrante' : 'Vistoriador Operacional');

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
    const lat = typeof h.numLatitude === 'number' ? h.numLatitude.toFixed(6) : (h.numLatitude || '');
    const lng = typeof h.numLongitude === 'number' ? h.numLongitude.toFixed(6) : (h.numLongitude || '');
    const coordStr = (lat && lng && lat !== '-' && lng !== '-') ? `${lat}, ${lng}` : '';

    return `
      <tr>
        <td class="col-seq">${idx + 1}</td>
        <td class="col-code">
          <strong>${code}</strong>
          ${ra ? `<div class="sub-text">${ra}</div>` : ''}
          <div class="date-text">${dataVis}</div>
          ${coordStr ? `<div class="coord-text">${coordStr}</div>` : ''}
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

  const hasDefeitos = (topDefeitosComCidades && topDefeitosComCidades.length > 0) || (topDefeitos && topDefeitos.length > 0);
  const defeitosList = (isMultiCity && topDefeitosComCidades && topDefeitosComCidades.length > 0) ? topDefeitosComCidades : (topDefeitos || []);
  const hasYears = yearStats && yearStats.length > 0;

  let chartsHtml = '';
  if (hasDefeitos || hasYears) {
    chartsHtml = `
      <div class="charts-row avoid-break">
        ${hasDefeitos ? `
          <div class="chart-card">
            <div class="chart-title">⚠️ ${isMultiCity ? 'Top Defeitos no DF' : 'Top Defeitos Registrados'}</div>
            <div class="bar-items-list">
              ${defeitosList.map(d => {
                const countVal = d.total !== undefined ? d.total : d.count;
                const pctVal = typeof d.percent === 'number' ? d.percent.toFixed(1) : d.percent;
                const barWidth = Math.max(4, d.barPercent || d.percent || 4);
                return `
                  <div class="bar-item">
                    <div class="bar-item-header">
                      <span class="bar-item-label" title="${d.nome}">${d.nome}</span>
                      <span class="bar-item-value text-red">${countVal} ocorr. (${pctVal}%)</span>
                    </div>
                    <div class="bar-track">
                      <div class="bar-fill bar-red" style="width: ${barWidth}%;"></div>
                    </div>
                    ${d.topCidades && d.topCidades.length > 0 ? `
                      <div class="bar-item-tags">
                        ${d.topCidades.map(tc => `<span class="bar-tag">📍 ${tc.cidade}: ${tc.qtd}</span>`).join('')}
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        ${hasYears ? `
          <div class="chart-card">
            <div class="chart-title">📅 Vistorias por Ano</div>
            <div class="bar-items-list">
              ${yearStats.map(y => {
                const yearLabel = String(y.nome).replace(/[^0-9]/g, '') || y.nome;
                const barWidth = Math.max(4, y.percent || 4);
                return `
                  <div class="bar-item">
                    <div class="bar-item-header">
                      <span class="bar-item-label">${yearLabel}</span>
                      <span class="bar-item-value text-green">${y.count} vistoria${y.count > 1 ? 's' : ''}</span>
                    </div>
                    <div class="bar-track">
                      <div class="bar-fill bar-green" style="width: ${barWidth}%;"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  const hidrantesComFotos = currentData.map(h => ({
    ...h,
    extractedPhotos: extractPhotos(h)
  })).filter(item => item.extractedPhotos.length > 0);

  const totalFotosCount = hidrantesComFotos.reduce((acc, h) => acc + h.extractedPhotos.length, 0);
  const shouldBreakPage = currentData.length > 2 || totalFotosCount > 1;

  const anexoFotograficoHtml = hidrantesComFotos.length > 0 ? `
    <div class="section-block ${shouldBreakPage ? 'page-break-before' : 'avoid-break'}">
      <div class="section-title" style="font-size: 12.5px; border-bottom: 2px solid #0f172a; padding-bottom: 4px; margin-top: ${shouldBreakPage ? '16px' : '10px'}; margin-bottom: 12px;">
        📷 Anexo Fotográfico - Evidências das Vistorias (${totalFotosCount} ${totalFotosCount === 1 ? 'registro fotográfico' : 'registros fotográficos'}${hidrantesComFotos.length > 1 ? ` em ${hidrantesComFotos.length} hidrantes` : ''})
      </div>
      <div class="photos-grid">
        ${hidrantesComFotos.map((h, i) => {
          const cod = h.nomHidrante || h.codHidrante || `HID-${i + 1}`;
          const dataVis = formatDateOnly(h.datHoraUltimaVistoria || h.datHoraVistoria);
          const ra = normalizeRAName(h.dscLocalidade) || 'DF';
          const end = fixEncoding(h.dscEndereco) || '-';
          const ref = h.dscPontoReferencia ? `Ref: ${fixEncoding(h.dscPontoReferencia)}` : '';
          const isOp = Boolean(h.flgAtivo);
          const defeito = h.problemasHidrante ? sanitizeProblem(h.problemasHidrante) : (!isOp ? 'Inoperante (necessita manutenção)' : 'Sem alterações / Operante');
          const hLat = typeof h.numLatitude === 'number' ? h.numLatitude.toFixed(6) : (h.numLatitude || '');
          const hLng = typeof h.numLongitude === 'number' ? h.numLongitude.toFixed(6) : (h.numLongitude || '');
          const hCoord = (hLat && hLng && hLat !== '-' && hLng !== '-') ? `${hLat}, ${hLng}` : '';
          const pList = h.extractedPhotos;
          const pCount = pList.length;

          let galleryClass = 'photo-gallery-many';
          let itemClass = 'photo-item-many';
          if (pCount === 1) {
            galleryClass = 'photo-gallery-1';
            itemClass = 'photo-item-1';
          } else if (pCount === 2) {
            galleryClass = 'photo-gallery-2';
            itemClass = 'photo-item-2';
          } else if (pCount === 3) {
            galleryClass = 'photo-gallery-3';
            itemClass = 'photo-item-3';
          } else if (pCount === 4) {
            galleryClass = 'photo-gallery-4';
            itemClass = 'photo-item-4';
          } else if (pCount === 5 || pCount === 6) {
            galleryClass = 'photo-gallery-6';
            itemClass = 'photo-item-6';
          }

          return `
            <div class="photo-card avoid-break">
              <div class="photo-card-header">
                <div class="photo-card-title-box">
                  <span class="photo-card-code">${cod}</span>
                  <span class="photo-card-ra">${ra} • ${dataVis}</span>
                </div>
                <div class="photo-card-badges">
                  <span class="photo-count-pill">📷 ${pCount} ${pCount === 1 ? 'foto' : 'fotos'}</span>
                  <span class="badge ${isOp ? 'badge-op' : 'badge-inop'}">${isOp ? 'OPERANTE' : 'INOPERANTE'}</span>
                </div>
              </div>
              <div class="photo-card-body">
                <div class="photo-meta-box">
                  <div class="photo-end">📍 <strong>${end}</strong></div>
                  ${ref ? `<div class="photo-ref">${ref}</div>` : ''}
                  ${hCoord ? `<div class="photo-coord">🌐 GPS: ${hCoord}</div>` : ''}
                </div>
                <div class="photo-defect ${isOp ? 'is-operante text-green' : 'text-red'}">
                  ⚠️ <strong>${isOp ? 'Condição Operacional:' : 'Inconformidades / Defeitos:'}</strong> ${defeito}
                </div>
                <div class="${galleryClass}">
                  ${pList.map((fotoSrc, pIdx) => `
                    <div class="photo-img-wrapper ${itemClass}">
                      <img src="${fotoSrc}" alt="Evidência ${pIdx + 1} - ${cod}" class="photo-evidence-img" />
                      ${pCount > 1 ? `<span class="photo-badge">${pIdx + 1}/${pCount}</span>` : ''}
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  ` : '';

  const docSeed = `${nowStr}_${currentData.length}_${operantes}_${inoperantes}_${emissorNome}_${rasPresentes}`;
  const docHash = generateDocHash(docSeed);

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <title>Relatorio_Geral_CBMDF_${nowStr.replace(/[^0-9]/g, '_')}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 8mm 10mm 14mm 10mm;
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
          padding: 2px 2px 22px 2px;
        }
        .official-header {
          border-bottom: 2.5px solid #0f172a;
          padding-bottom: 10px;
          margin-bottom: 14px;
          text-align: center;
        }
        .header-title-box {
          text-align: center;
        }
        .inst-gov {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.8px;
          color: #334155;
          text-transform: uppercase;
        }
        .inst-cbmdf {
          font-size: 13.5px;
          font-weight: 900;
          letter-spacing: 0.5px;
          color: #0f172a;
          text-transform: uppercase;
          margin-top: 1px;
        }
        .doc-title {
          font-size: 14.5px;
          font-weight: 900;
          color: #1e3a8a;
          text-transform: uppercase;
          margin: 3px 0;
        }
        .doc-meta {
          font-size: 10px;
          color: #475569;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 14px;
          margin-top: 4px;
          font-weight: 600;
        }
        
        .kpi-overview-container {
          display: flex;
          gap: 10px;
          margin-bottom: 14px;
          align-items: stretch;
        }
        .kpi-cards-grid {
          flex: 7;
          display: flex;
          gap: 8px;
        }
        .kpi-card {
          flex: 1;
          border: 1.5px solid #cbd5e1;
          border-radius: 6px;
          padding: 8px 10px;
          text-align: center;
          background: #f8fafc;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .kpi-label {
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          color: #64748b;
        }
        .kpi-value {
          font-size: 17px;
          font-weight: 900;
          margin-top: 2px;
          color: #0f172a;
        }
        .card-green { border-color: #86efac; background: #f0fdf4; }
        .card-green .kpi-value { color: #15803d; }
        .card-red { border-color: #fca5a5; background: #fef2f2; }
        .card-red .kpi-value { color: #b91c1c; }
        
        .kpi-donut-card {
          flex: 5;
          border: 1.5px solid #cbd5e1;
          border-radius: 6px;
          padding: 6px 10px;
          background: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .donut-wrapper {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          justify-content: space-around;
        }
        .donut-svg-box {
          position: relative;
          width: 58px;
          height: 58px;
          flex-shrink: 0;
        }
        .donut-svg {
          width: 58px;
          height: 58px;
          transform: rotate(-90deg);
        }
        .donut-center-text {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .donut-percent {
          font-size: 11px;
          font-weight: 900;
          color: #0f172a;
          line-height: 1;
        }
        .donut-sub {
          font-size: 7.5px;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
        }
        .donut-legend {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 9.5px;
          font-weight: 700;
        }
        .legend-item { display: flex; align-items: center; gap: 5px; }
        .legend-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
        .bg-green { background: #16a34a; }
        .bg-red { background: #dc2626; }
        
        .bar-container {
          display: flex;
          height: 8px;
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
          vertical-align: middle;
        }
        .data-table tbody tr:nth-child(even) { background: #fafafa; }
        .col-seq { width: 4%; text-align: center; font-weight: bold; color: #64748b; }
        .col-code { width: 17%; }
        .col-end { width: 33%; }
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
        .coord-text { font-size: 8.5px; color: #475569; font-family: monospace; margin-top: 2px; }
        .text-center { text-align: center; }
        .text-green { color: #15803d; }
        .text-red { color: #b91c1c; }
        .avoid-break { page-break-inside: avoid; break-inside: avoid; }
        .page-break-before { page-break-before: always; break-before: page; }
        
        .photos-grid {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-top: 10px;
          width: 100%;
        }
        .photo-card {
          border: 1.5px solid #cbd5e1;
          border-radius: 6px;
          padding: 10px 12px;
          background: #ffffff;
          width: 100%;
          box-sizing: border-box;
        }
        .photo-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1.5px solid #e2e8f0;
          padding-bottom: 6px;
          margin-bottom: 8px;
        }
        .photo-card-title-box {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .photo-card-code {
          font-size: 13px;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: 0.3px;
        }
        .photo-card-ra {
          font-size: 9.5px;
          color: #475569;
          font-weight: 700;
          background: #f1f5f9;
          padding: 2px 7px;
          border-radius: 4px;
          border: 1px solid #e2e8f0;
        }
        .photo-card-badges {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .photo-count-pill {
          font-size: 9px;
          font-weight: 800;
          background: #f1f5f9;
          color: #334155;
          padding: 2px 7px;
          border-radius: 12px;
          border: 1px solid #cbd5e1;
        }
        .photo-meta-box {
          margin-bottom: 6px;
        }
        .photo-end { font-size: 10.5px; color: #1e293b; margin-bottom: 2px; }
        .photo-ref { font-size: 9.5px; color: #64748b; font-style: italic; margin-bottom: 2px; }
        .photo-coord { font-size: 9px; color: #475569; font-family: monospace; font-weight: 600; margin-bottom: 3px; }
        .photo-defect {
          font-size: 9.5px;
          font-weight: 600;
          margin-bottom: 10px;
          line-height: 1.35;
          padding: 5px 8px;
          border-radius: 4px;
          background: #fef2f2;
          border-left: 3px solid #dc2626;
          color: #991b1b;
        }
        .photo-defect.is-operante {
          background: #f0fdf4;
          border-left: 3px solid #16a34a;
          color: #166534;
        }

        /* Galerias Responsivas para Fotos do Relatório em Largura Total da Página A4 */
        .photo-img-wrapper {
          position: relative;
          border-radius: 5px;
          overflow: hidden;
          background: #090d16;
          border: 1px solid #cbd5e1;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          box-sizing: border-box;
        }
        .photo-evidence-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .photo-badge {
          position: absolute;
          bottom: 4px;
          right: 4px;
          background: rgba(15, 23, 42, 0.85);
          color: #ffffff;
          font-size: 8.5px;
          font-weight: 800;
          padding: 1.5px 5px;
          border-radius: 3px;
          border: 0.5px solid rgba(255, 255, 255, 0.3);
          letter-spacing: 0.5px;
        }

        /* 1 Foto: Showcase amplo centralizado na página */
        .photo-gallery-1 {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
        }
        .photo-item-1 {
          max-width: 520px;
          height: 270px;
        }
        .photo-item-1 .photo-evidence-img {
          object-fit: contain;
        }

        /* 2 Fotos: 2 Colunas lado a lado ocupando 100% da largura */
        .photo-gallery-2 {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          width: 100%;
        }
        .photo-item-2 {
          height: 220px;
        }

        /* 3 Fotos: 3 Colunas na mesma linha ocupando 100% da largura */
        .photo-gallery-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          width: 100%;
        }
        .photo-item-3 {
          height: 185px;
        }

        /* 4 Fotos: Grid 2x2 harmonioso e equilibrado */
        .photo-gallery-4 {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          width: 100%;
        }
        .photo-item-4 {
          height: 190px;
        }

        /* 5 ou 6 Fotos: 3 Colunas x 2 Linhas aproveitando toda a largura da página */
        .photo-gallery-6 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          width: 100%;
        }
        .photo-item-6 {
          height: 165px;
        }

        /* Mais de 6 Fotos: 4 Colunas compactas e nítidas */
        .photo-gallery-many {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
          width: 100%;
        }
        .photo-item-many {
          height: 145px;
        }

        .charts-row {
          display: flex;
          gap: 12px;
          margin-bottom: 12px;
          width: 100%;
        }
        .chart-card {
          flex: 1;
          border: 1.5px solid #cbd5e1;
          border-radius: 6px;
          padding: 8px 10px;
          background: #f8fafc;
        }
        .chart-title {
          font-size: 11px;
          font-weight: 800;
          color: #0f172a;
          text-transform: uppercase;
          border-bottom: 1.5px solid #cbd5e1;
          padding-bottom: 4px;
          margin-bottom: 8px;
        }
        .bar-items-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .bar-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .bar-item-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 9px;
        }
        .bar-item-label {
          font-weight: 700;
          color: #0f172a;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 68%;
        }
        .bar-item-value {
          font-weight: 800;
          font-size: 8.5px;
          white-space: nowrap;
        }
        .bar-track {
          width: 100%;
          height: 6px;
          background-color: #e2e8f0;
          border-radius: 3px;
          overflow: hidden;
        }
        .bar-fill {
          height: 100%;
          border-radius: 3px;
        }
        .bar-red { background-color: #ef4444; }
        .bar-green { background-color: #10b981; }
        .bar-item-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 1px;
          font-size: 8px;
          color: #475569;
        }
        .bar-tag {
          background: #e2e8f0;
          padding: 0.5px 3px;
          border-radius: 2px;
          font-weight: 600;
        }

        .inst-sub {
          font-size: 11px;
          font-weight: 800;
          color: #334155;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 1px 0 2px 0;
        }

        .signature-section {
          margin-top: 20px;
          padding-top: 8px;
          text-align: center;
          page-break-inside: avoid;
        }
        .signature-name { font-size: 10px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
        .signature-role { font-size: 9px; color: #475569; margin-top: 1px; }
        .doc-hash-footer {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 8px;
          color: #64748b;
          background: #ffffff;
          border-top: 1px solid #cbd5e1;
          padding: 3px 10px;
          font-family: 'Courier New', Courier, monospace;
          letter-spacing: 0.3px;
        }
      </style>
    </head>
    <body>
      <div class="official-header">
        <div class="header-title-box">
          <div class="inst-cbmdf">Corpo de Bombeiros Militar do Distrito Federal</div>
          <div class="inst-sub">SEHUR / GPCIU</div>
          <div class="doc-title">Relatório de Vistoria de Hidrantes Urbanos</div>
          <div class="doc-meta">
            <span><strong>Localidade / RAs:</strong> ${rasPresentes || 'Todas as Cidades / DF Completo'}</span>
            ${currentMission ? `<span><strong>Missão:</strong> ${currentMission.name}</span>` : ''}
            <span><strong>Emissão:</strong> ${nowStr}</span>
          </div>
        </div>
      </div>

      <div class="kpi-overview-container avoid-break">
        <div class="kpi-cards-grid">
          <div class="kpi-card">
            <div class="kpi-label">Total Vistoriado</div>
            <div class="kpi-value">${total}</div>
          </div>
          <div class="kpi-card card-green">
            <div class="kpi-label">Hidrantes Operantes</div>
            <div class="kpi-value">${operantes} <span style="font-size: 11px;">(${operantesPercent}%)</span></div>
          </div>
          <div class="kpi-card card-red">
            <div class="kpi-label">Hidrantes Inoperantes</div>
            <div class="kpi-value">${inoperantes} <span style="font-size: 11px;">(${inoperantesPercent}%)</span></div>
          </div>
        </div>

        <div class="kpi-donut-card">
          <div class="donut-wrapper">
            <div class="donut-svg-box">
              <svg viewBox="0 0 36 36" class="donut-svg">
                <circle cx="18" cy="18" r="15.91549430918954" fill="transparent" stroke="#ef4444" stroke-width="4.2"></circle>
                <circle cx="18" cy="18" r="15.91549430918954" fill="transparent" stroke="#10b981" stroke-width="4.2" stroke-dasharray="${operantesPercent} ${100 - operantesPercent}" stroke-dashoffset="25"></circle>
              </svg>
              <div class="donut-center-text">
                <span class="donut-percent">${operantesPercent}%</span>
                <span class="donut-sub">OK</span>
              </div>
            </div>
            <div class="donut-legend">
              <div class="legend-item text-green">
                <span class="legend-dot bg-green"></span>
                <span><strong>${operantes}</strong> Operantes</span>
              </div>
              <div class="legend-item text-red">
                <span class="legend-dot bg-red"></span>
                <span><strong>${inoperantes}</strong> Inoperantes</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      ${multiCityHtml}
      ${chartsHtml}

      <div class="section-block">
        <div class="section-title">📋 Relação Técnica Detalhada (${currentData.length} ${currentData.length === 1 ? 'hidrante' : 'hidrantes'})</div>
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-seq">Nº</th>
              <th class="col-code">Código / Data / GPS</th>
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

      ${anexoFotograficoHtml}

      <div class="signature-section avoid-break">
        <div class="signature-name">${emissorNome}</div>
        <div class="signature-role">${emissorCargo} • ${emissorMatricula}</div>
        <div class="signature-role" style="font-size: 9px; margin-top: 2px; font-weight: bold;">SEHUR / GPCIU • CBMDF</div>
      </div>

      <div class="doc-hash-footer">
        Controle / Hash: NETUNO-DF-${docHash} • Emitido eletronicamente via Sistema NETUNO • CBMDF
      </div>
    </body>
    </html>
  `;

  const docTitle = buildReportFileName({
    prefix: 'Relatorio_Geral_CBMDF',
    rasPresentes,
    activeFilters,
    currentMission
  });
  executePrintHtml(html, docTitle);
};

/**
 * 2. IMPRESSÃO DO RELATÓRIO OFICIAL CAESB (SOLICITAÇÃO DE MANUTENÇÃO)
 */
export const printCaesbReport = ({
  currentData = [],
  rasPresentes = '',
  currentMission = null,
  currentUser = null,
  isMultiCity = false,
  cityOperabilityStats = [],
  topDefeitosComCidades = [],
  stats = {},
  topDefeitos = [],
  activeFilters = null
}) => {
  const nowStr = formatDateTime(new Date());
  const emissorNome = currentUser?.nome || 'Gestor de Hidrantes Urbanos';
  const emissorMatricula = currentUser?.matricula ? `Matrícula: ${currentUser.matricula}` : '';

  // Regra institucional: hidrante com defeito de "removido ou não encontrado" não deve aparecer no relatório CAESB, apenas no relatório geral
  const caesbData = currentData.filter(h => !isHidranteRemovido(h));

  const rowsHtml = caesbData.length === 0 
    ? `<tr><td colspan="4" style="text-align:center; padding: 24px; font-weight: bold; color: #64748b;">Nenhum hidrante com pendência ou defeito registrado para o relatório CAESB.</td></tr>`
    : caesbData.map((h, idx) => {
    const code = h.nomHidrante || h.codHidrante || '-';
    const dataVis = formatDateOnly(h.datHoraUltimaVistoria || h.datHoraVistoria);
    const end = fixEncoding(h.dscEndereco) || h.dscLocalidade || '-';
    const ref = h.dscPontoReferencia ? `Ref: ${fixEncoding(h.dscPontoReferencia)}` : '';
    const isOp = Boolean(h.flgAtivo);
    const prob = h.problemasHidrante ? sanitizeProblem(h.problemasHidrante) : (!isOp ? 'INOPERANTE (Necessita Manutenção)' : '');
    const obs = h.dscObservacao || h.observacoes || h.obsVistoria || '';
    const ra = normalizeRAName(h.dscLocalidade) || '';
    const lat = typeof h.numLatitude === 'number' ? h.numLatitude.toFixed(6) : (h.numLatitude || '');
    const lng = typeof h.numLongitude === 'number' ? h.numLongitude.toFixed(6) : (h.numLongitude || '');
    const coordStr = (lat && lng && lat !== '-' && lng !== '-') ? `${lat}, ${lng}` : '';

    return `
      <tr>
        <td class="col-seq">${idx + 1}</td>
        <td class="col-code">
          <strong>${code}</strong>
          ${ra ? `<div class="sub-text">${ra}</div>` : ''}
          <div class="date-text">Vistoria: ${dataVis}</div>
          ${coordStr ? `<div class="coord-text">${coordStr}</div>` : ''}
        </td>
        <td class="col-end">
          <div><strong>${end}</strong></div>
          ${ref ? `<div class="ref-text">${ref}</div>` : ''}
        </td>
        <td class="col-prob">
          <span class="badge ${isOp ? 'badge-op' : 'badge-inop'}">${isOp ? '● OPERANTE C/ DEFEITO' : '● INOPERANTE'}</span>
          <div class="prob-box" style="margin-top: 4px;">
            <strong>⚠️ Defeito Constatado:</strong>
            <div class="prob-name">${prob || 'Defeito não especificado'}</div>
            ${obs ? `<div class="obs-box"><em>Obs: ${obs}</em></div>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  const multiCityHtml = (isMultiCity && cityOperabilityStats.filter(c => c.total > 0).length > 0) ? `
    <div class="section-block avoid-break">
      <div class="section-title" style="color: #065f46; border-bottom-color: #047857;">🏢 Demanda de Manutenção por Cidade (Ranking CAESB)</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Região Administrativa (RA)</th>
            <th class="text-center">Hidrantes para Reparo</th>
            <th style="width: 40%;">Proporção da Demanda no DF</th>
          </tr>
        </thead>
        <tbody>
          ${cityOperabilityStats.filter(c => c.total > 0).map(c => {
            const pct = caesbData.length > 0 ? ((c.total / caesbData.length) * 100).toFixed(1) : '0';
            return `
              <tr>
                <td><strong>${c.nome}</strong></td>
                <td class="text-center text-red"><strong>${c.total} reparo${c.total > 1 ? 's' : ''}</strong></td>
                <td>
                  <div class="bar-container">
                    <div class="bar-fill bar-red" style="width: ${pct}%;"></div>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

  const filteredTopDefeitos = (topDefeitos || []).filter(d => {
    const n = (d.nome || '').toLowerCase();
    return !n.includes('removido') && !n.includes('não encontrado') && !n.includes('nao encontrado');
  });
  const filteredTopDefeitosComCidades = (topDefeitosComCidades || []).filter(d => {
    const n = (d.nome || '').toLowerCase();
    return !n.includes('removido') && !n.includes('não encontrado') && !n.includes('nao encontrado');
  });

  const hasDefeitos = (filteredTopDefeitosComCidades && filteredTopDefeitosComCidades.length > 0) || (filteredTopDefeitos && filteredTopDefeitos.length > 0);
  const defeitosList = (isMultiCity && filteredTopDefeitosComCidades && filteredTopDefeitosComCidades.length > 0) ? filteredTopDefeitosComCidades : (filteredTopDefeitos || []);

  let chartsHtml = '';
  if (hasDefeitos) {
    chartsHtml = `
      <div class="charts-row avoid-break">
        <div class="chart-card" style="flex: 1;">
          <div class="chart-title" style="color: #065f46;">🛠️ Principais Tipos de Defeitos para Intervenção CAESB ${isMultiCity ? 'e Cidades com Maior Volume' : ''}</div>
          <div class="bar-items-list">
            ${defeitosList.slice(0, 6).map(d => {
              const countVal = d.total !== undefined ? d.total : d.count;
              const pctVal = typeof d.percent === 'number' ? d.percent.toFixed(1) : (d.percent || '0');
              const barWidth = Math.max(4, d.barPercent || d.percent || 4);
              return `
                <div class="bar-item">
                  <div class="bar-item-header">
                    <span class="bar-item-label" title="${d.nome}">${d.nome}</span>
                    <span class="bar-item-value text-red">${countVal} ocorr. (${pctVal}%)</span>
                  </div>
                  <div class="bar-track">
                    <div class="bar-fill bar-red" style="width: ${barWidth}%;"></div>
                  </div>
                  ${d.topCidades && d.topCidades.length > 0 ? `
                    <div class="bar-item-tags">
                      ${d.topCidades.map(tc => `<span class="bar-tag">📍 ${tc.cidade}: ${tc.qtd}</span>`).join('')}
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  const hidrantesComFotos = caesbData.map(h => ({
    ...h,
    extractedPhotos: extractPhotos(h)
  })).filter(item => item.extractedPhotos.length > 0);

  const totalFotosCount = hidrantesComFotos.reduce((acc, h) => acc + h.extractedPhotos.length, 0);
  const shouldBreakPage = caesbData.length > 2 || totalFotosCount > 1;

  const anexoFotograficoHtml = hidrantesComFotos.length > 0 ? `
    <div class="section-block ${shouldBreakPage ? 'page-break-before' : 'avoid-break'}">
      <div class="section-title" style="font-size: 12.5px; border-bottom: 2px solid #047857; color: #065f46; padding-bottom: 4px; margin-top: ${shouldBreakPage ? '16px' : '10px'}; margin-bottom: 12px;">
        📷 Anexo Fotográfico - Evidências das Vistorias (${totalFotosCount} ${totalFotosCount === 1 ? 'registro fotográfico' : 'registros fotográficos'}${hidrantesComFotos.length > 1 ? ` em ${hidrantesComFotos.length} hidrantes` : ''})
      </div>
      <div class="photos-grid">
        ${hidrantesComFotos.map((h, i) => {
          const cod = h.nomHidrante || h.codHidrante || `HID-${i + 1}`;
          const dataVis = formatDateOnly(h.datHoraUltimaVistoria || h.datHoraVistoria);
          const ra = normalizeRAName(h.dscLocalidade) || 'DF';
          const end = fixEncoding(h.dscEndereco) || '-';
          const ref = h.dscPontoReferencia ? `Ref: ${fixEncoding(h.dscPontoReferencia)}` : '';
          const isOp = Boolean(h.flgAtivo);
          const defeito = h.problemasHidrante ? sanitizeProblem(h.problemasHidrante) : (!isOp ? 'Inoperante (necessita manutenção)' : 'Sem alterações / Operante');
          const hLat = typeof h.numLatitude === 'number' ? h.numLatitude.toFixed(6) : (h.numLatitude || '');
          const hLng = typeof h.numLongitude === 'number' ? h.numLongitude.toFixed(6) : (h.numLongitude || '');
          const hCoord = (hLat && hLng && hLat !== '-' && hLng !== '-') ? `${hLat}, ${hLng}` : '';
          const pList = h.extractedPhotos;
          const pCount = pList.length;

          let galleryClass = 'photo-gallery-many';
          let itemClass = 'photo-item-many';
          if (pCount === 1) {
            galleryClass = 'photo-gallery-1';
            itemClass = 'photo-item-1';
          } else if (pCount === 2) {
            galleryClass = 'photo-gallery-2';
            itemClass = 'photo-item-2';
          } else if (pCount === 3) {
            galleryClass = 'photo-gallery-3';
            itemClass = 'photo-item-3';
          } else if (pCount === 4) {
            galleryClass = 'photo-gallery-4';
            itemClass = 'photo-item-4';
          } else if (pCount === 5 || pCount === 6) {
            galleryClass = 'photo-gallery-6';
            itemClass = 'photo-item-6';
          }

          return `
            <div class="photo-card avoid-break">
              <div class="photo-card-header">
                <div class="photo-card-title-box">
                  <span class="photo-card-code">${cod}</span>
                  <span class="photo-card-ra">${ra} • ${dataVis}</span>
                </div>
                <div class="photo-card-badges">
                  <span class="photo-count-pill">📷 ${pCount} ${pCount === 1 ? 'foto' : 'fotos'}</span>
                  <span class="badge ${isOp ? 'badge-op' : 'badge-inop'}">${isOp ? 'OPERANTE C/ DEFEITO' : 'INOPERANTE'}</span>
                </div>
              </div>
              <div class="photo-card-body">
                <div class="photo-meta-box">
                  <div class="photo-end">📍 <strong>${end}</strong></div>
                  ${ref ? `<div class="photo-ref">${ref}</div>` : ''}
                  ${hCoord ? `<div class="photo-coord">🌐 GPS: ${hCoord}</div>` : ''}
                </div>
                <div class="photo-defect ${isOp ? 'is-operante text-green' : 'text-red'}">
                  ⚠️ <strong>${isOp ? 'Defeito / Inconformidade:' : 'Defeito Crítico:'}</strong> ${defeito}
                </div>
                <div class="${galleryClass}">
                  ${pList.map((fotoSrc, pIdx) => `
                    <div class="photo-img-wrapper ${itemClass}">
                      <img src="${fotoSrc}" alt="Evidência ${pIdx + 1} - ${cod}" class="photo-evidence-img" />
                      ${pCount > 1 ? `<span class="photo-badge">${pIdx + 1}/${pCount}</span>` : ''}
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  ` : '';

  const docSeed = `${nowStr}_${caesbData.length}_${emissorNome}_${rasPresentes}`;
  const docHash = generateDocHash(docSeed);

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <title>Relatorio_CAESB_Manutencao_${nowStr.replace(/[^0-9]/g, '_')}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 8mm 10mm 14mm 10mm;
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
          padding: 2px 2px 22px 2px;
        }
        .official-header {
          border-bottom: 2.5px solid #047857;
          padding-bottom: 10px;
          margin-bottom: 12px;
          text-align: center;
        }
        .header-title-box {
          text-align: center;
        }
        .inst-gov {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.8px;
          color: #334155;
          text-transform: uppercase;
        }
        .inst-cbmdf {
          font-size: 13.5px;
          font-weight: 900;
          letter-spacing: 0.5px;
          color: #0f172a;
          text-transform: uppercase;
          margin-top: 1px;
        }
        .doc-title {
          font-size: 14.5px;
          font-weight: 900;
          color: #047857;
          text-transform: uppercase;
          margin: 3px 0;
        }
        .legal-term {
          font-size: 9.5px;
          color: #475569;
          margin-top: 2px;
          font-weight: 600;
        }
        .doc-meta {
          font-size: 10px;
          color: #334155;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 16px;
          margin-top: 5px;
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

        .bar-container {
          display: flex;
          height: 8px;
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
          vertical-align: middle;
        }
        .data-table tbody tr:nth-child(even) { background: #fafafa; }
        .col-seq { width: 4%; text-align: center; font-weight: bold; color: #64748b; }
        .col-code { width: 18%; }
        .col-end { width: 38%; }
        .col-prob { width: 40%; }
        .coord-text { font-family: monospace; font-size: 9px; color: #1e3a8a; font-weight: bold; margin-top: 2px; }
        .sub-text { font-size: 9.5px; color: #64748b; }
        .date-text { font-size: 9px; color: #475569; margin-top: 2px; }
        .ref-text { color: #64748b; font-size: 9.5px; font-style: italic; margin-top: 3px; }
        .prob-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 6px; }
        .prob-name { color: #b91c1c; font-weight: 800; font-size: 10.5px; margin-top: 2px; }
        .obs-box { margin-top: 4px; font-size: 9.5px; color: #475569; }
        .badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 800;
          font-size: 9.5px;
        }
        .badge-op { background: #dcfce7; color: #166534; }
        .badge-inop { background: #fee2e2; color: #991b1b; }
        
        .charts-row {
          display: flex;
          gap: 12px;
          margin-bottom: 14px;
        }
        .chart-card {
          flex: 1;
          border: 1.5px solid #cbd5e1;
          border-radius: 6px;
          padding: 8px 12px;
          background: #f8fafc;
        }
        .chart-title {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          color: #334155;
          margin-bottom: 6px;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 3px;
        }
        .bar-items-list {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .bar-item { width: 100%; }
        .bar-item-header {
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          margin-bottom: 1px;
        }
        .bar-item-label {
          font-weight: 700;
          color: #1e293b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 70%;
        }
        .bar-item-value { font-weight: 800; }
        .bar-track {
          height: 6px;
          background: #e2e8f0;
          border-radius: 3px;
          overflow: hidden;
          width: 100%;
        }
        .bar-item-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 1px;
          font-size: 8px;
          color: #475569;
        }
        .bar-tag {
          background: #e2e8f0;
          padding: 0.5px 3px;
          border-radius: 2px;
          font-weight: 600;
        }

        .photos-grid {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-top: 10px;
          width: 100%;
        }
        .photo-card {
          border: 1.5px solid #cbd5e1;
          border-radius: 6px;
          padding: 10px 12px;
          background: #ffffff;
          width: 100%;
          box-sizing: border-box;
        }
        .photo-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1.5px solid #e2e8f0;
          padding-bottom: 6px;
          margin-bottom: 8px;
        }
        .photo-card-title-box {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .photo-card-code {
          font-size: 13px;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: 0.3px;
        }
        .photo-card-ra {
          font-size: 9.5px;
          color: #475569;
          font-weight: 700;
          background: #f1f5f9;
          padding: 2px 7px;
          border-radius: 4px;
          border: 1px solid #e2e8f0;
        }
        .photo-card-badges {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .photo-count-pill {
          font-size: 9px;
          font-weight: 800;
          background: #f1f5f9;
          color: #334155;
          padding: 2px 7px;
          border-radius: 12px;
          border: 1px solid #cbd5e1;
        }
        .photo-meta-box {
          margin-bottom: 6px;
        }
        .photo-end { font-size: 10.5px; color: #1e293b; margin-bottom: 2px; }
        .photo-ref { font-size: 9.5px; color: #64748b; font-style: italic; margin-bottom: 2px; }
        .photo-coord { font-size: 9px; color: #475569; font-family: monospace; font-weight: 600; margin-bottom: 3px; }
        .photo-defect {
          font-size: 9.5px;
          font-weight: 600;
          margin-bottom: 10px;
          line-height: 1.35;
          padding: 5px 8px;
          border-radius: 4px;
          background: #fef2f2;
          border-left: 3px solid #dc2626;
          color: #991b1b;
        }
        .photo-defect.is-operante {
          background: #f0fdf4;
          border-left: 3px solid #16a34a;
          color: #166534;
        }

        .photo-img-wrapper {
          position: relative;
          border-radius: 5px;
          overflow: hidden;
          background: #090d16;
          border: 1px solid #cbd5e1;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          box-sizing: border-box;
        }
        .photo-evidence-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .photo-badge {
          position: absolute;
          bottom: 4px;
          right: 4px;
          background: rgba(15, 23, 42, 0.85);
          color: #ffffff;
          font-size: 8.5px;
          font-weight: 800;
          padding: 1.5px 5px;
          border-radius: 3px;
          border: 0.5px solid rgba(255, 255, 255, 0.3);
          letter-spacing: 0.5px;
        }

        .photo-gallery-1 {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
        }
        .photo-item-1 {
          max-width: 520px;
          height: 270px;
        }
        .photo-item-1 .photo-evidence-img {
          object-fit: contain;
        }

        .photo-gallery-2 {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          width: 100%;
        }
        .photo-item-2 {
          height: 220px;
        }

        .photo-gallery-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          width: 100%;
        }
        .photo-item-3 {
          height: 185px;
        }

        .photo-gallery-4 {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          width: 100%;
        }
        .photo-item-4 {
          height: 190px;
        }

        .photo-gallery-6 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          width: 100%;
        }
        .photo-item-6 {
          height: 165px;
        }

        .photo-gallery-many {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
          width: 100%;
        }
        .photo-item-many {
          height: 145px;
        }

        .avoid-break { page-break-inside: avoid; break-inside: avoid; }
        .page-break-before { page-break-before: always; break-before: page; }
        .text-center { text-align: center; }
        .text-green { color: #15803d; }
        .text-red { color: #b91c1c; }
        
        .inst-sub {
          font-size: 11px;
          font-weight: 800;
          color: #334155;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 1px 0 2px 0;
        }

        .signature-section {
          margin-top: 20px;
          padding-top: 8px;
          text-align: center;
          page-break-inside: avoid;
        }
        .signature-name { font-size: 10px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
        .signature-role { font-size: 9.5px; color: #475569; margin-top: 1px; }
        .doc-hash-footer {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 8px;
          color: #64748b;
          background: #ffffff;
          border-top: 1px solid #cbd5e1;
          padding: 3px 10px;
          font-family: 'Courier New', Courier, monospace;
          letter-spacing: 0.3px;
        }
      </style>
    </head>
    <body>
      <div class="official-header">
        <div class="header-title-box">
          <div class="inst-cbmdf">Corpo de Bombeiros Militar do Distrito Federal</div>
          <div class="inst-sub">SEHUR / GPCIU</div>
          <div class="doc-title">Solicitação Oficial de Manutenção de Hidrantes Urbanos</div>
          <div class="legal-term">Conforme Termo de Cooperação Técnica CAESB/CBMDF publicado no DODF em 25/03/2019</div>
          <div class="doc-meta">
            <span><strong>Regiões Administrativas:</strong> ${rasPresentes || 'Todas as Cidades / DF Completo'}</span>
            ${currentMission ? `<span><strong>Missão:</strong> ${currentMission.name}</span>` : ''}
            <span><strong>Data de Notificação:</strong> ${nowStr}</span>
          </div>
        </div>
      </div>

      ${multiCityHtml}
      ${chartsHtml}

      <div class="section-block">
        <div class="section-title" style="color: #065f46; border-bottom-color: #047857;">📋 Relação de Hidrantes para Intervenção CAESB (${caesbData.length} ${caesbData.length === 1 ? 'hidrante' : 'hidrantes'})</div>
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-seq">Nº</th>
              <th class="col-code">Código / Data / GPS</th>
              <th class="col-end">Endereço e Ponto de Referência</th>
              <th class="col-prob">Inconformidade / Defeito Normatizado</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      ${anexoFotograficoHtml}

      <div class="signature-section avoid-break">
        <div class="signature-name">${emissorNome}</div>
        <div class="signature-role">${emissorMatricula} • Encarregado da Gestão de Hidrantes de Incêndio</div>
        <div class="signature-role" style="font-size: 9px; margin-top: 2px; font-weight: bold;">SEHUR / GPCIU • CBMDF</div>
      </div>

      <div class="doc-hash-footer">
        Controle / Hash: NETUNO-CAESB-${docHash} • Emitido eletronicamente via Sistema NETUNO • CBMDF
      </div>
    </body>
    </html>
  `;

  const docTitle = buildReportFileName({
    prefix: 'Relatorio_CAESB_Manutencao',
    rasPresentes,
    activeFilters,
    currentMission
  });
  executePrintHtml(html, docTitle);
};

/**
 * 3. IMPRESSÃO DA FICHA TÁTICA PPO (PRÉ-PLANEJAMENTO OPERACIONAL / PRÉ-POP)
 */
export const printBuildingStudyReport = ({ study, currentUser = null }) => {
  if (!study) {
    alert('Nenhuma edificação selecionada.');
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
        <div class="signature-name">${emissorNome}</div>
        <div class="signature-role">${emissorMatricula} • Oficial Especialista em Pré-Planejamento Operacional</div>
        <div class="signature-role" style="font-size: 9px; margin-top: 2px; font-weight: bold;">SEHUR / GPCIU • CBMDF</div>
      </div>
    </body>
    </html>
  `;

  const docTitle = `Ficha_Tatica_PPO_${fixEncoding(study.nomeFantasia || 'Edificacao').replace(/[^a-zA-Z0-9]/g, '_')}_${nowStr.replace(/[^0-9]/g, '_')}`;
  executePrintHtml(html, docTitle);
};

/**
 * 4. IMPRESSÃO DO PARECER TÉCNICO (ESTUDO TÉCNICO DE HIDRANTES - PADRÃO SEI)
 */
export const printTechnicalStudyReport = ({ studyData, calcResults, currentUser = null }) => {
  if (!studyData || !calcResults) {
    alert('Dados do estudo técnico incompletos para impressão.');
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
        }
        body {
          font-family: 'Times New Roman', Times, serif;
          font-size: 12pt;
          line-height: 1.5;
          color: #000;
        }
        .header {
          text-align: center;
          margin-bottom: 25px;
        }
        .inst { font-size: 13pt; font-weight: bold; text-transform: uppercase; }
        .sub-inst { font-size: 11pt; margin-top: 2px; }
        .doc-title {
          font-size: 14pt;
          font-weight: bold;
          text-transform: uppercase;
          margin-top: 15px;
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
          padding: 6px 0;
        }
        .section-num { font-weight: bold; margin-top: 14px; text-transform: uppercase; }
        p { text-align: justify; text-indent: 2.5cm; margin-bottom: 8px; }
        
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-family: Arial, sans-serif;
          font-size: 9.5pt;
          margin: 12px 0;
        }
        .data-table th {
          background: #f1f5f9;
          border: 1px solid #000;
          padding: 5px;
          text-align: left;
        }
        .data-table td {
          border: 1px solid #000;
          padding: 5px;
        }
        .text-center { text-align: center; }
        .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 8pt; }
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
        .sig-name { font-size: 10.5pt; font-weight: bold; }
        .sig-role { font-size: 9.5pt; color: #333; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="inst">Corpo de Bombeiros Militar do Distrito Federal</div>
        <div class="sub-inst">SEHUR / GPCIU • Seção Técnica de Hidrantes</div>
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
        ${emissorMatricula ? `<div class="sig-role">${emissorMatricula} • Analista Técnico de Hidrantes</div>` : ''}
        <div class="sig-role">SEHUR / GPCIU • Corpo de Bombeiros Militar do Distrito Federal</div>
      </div>
    </body>
    </html>
  `;

  const docTitle = `Parecer_Tecnico_Hidrantes_${fixEncoding(studyData.docRef || 'Estudo').replace(/[^a-zA-Z0-9]/g, '_')}_${nowStr.replace(/[^0-9]/g, '_')}`;
  executePrintHtml(html, docTitle);
};
