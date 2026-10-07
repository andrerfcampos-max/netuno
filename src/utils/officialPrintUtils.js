import { fixEncoding } from './textUtils';
import { normalizeRAName } from './raList';
import { sanitizeProblem, isHidranteRemovido, extractProblemsList } from './problemUtils';
import { getHydrantPhoto } from './hydrantPhotoUtils';
import { formatDateOnly, formatDateTimeDisplay } from './dateUtils';
export { formatDateOnly };

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

export const formatDateTime = (dateStr) => {
  return formatDateTimeDisplay(dateStr, { shortTime: true, fallback: '-' });
};


/**
 * Verifica se um hidrante ou registro de vistoria possui inconformidade/problema cadastrado
 */
export const hasVistoriaProblem = (item) => {
  if (!item) return false;
  // Inoperante indica presença de defeito/inconformidade
  if (item.flgAtivo === false || item.flgAtivo === 0 || item.flgAtivo === 'false') {
    return true;
  }
  // Problemas descritos no campo problemasHidrante
  if (item.problemasHidrante) {
    const list = extractProblemsList(String(item.problemasHidrante));
    if (list.length > 0) return true;
    const raw = String(item.problemasHidrante).trim().toLowerCase();
    if (
      raw &&
      raw !== '-' &&
      raw !== '.' &&
      raw !== 'sem defeitos registrados' &&
      raw !== 'sem alteração' &&
      raw !== 'sem alteracao' &&
      raw !== 'sem alterações' &&
      raw !== 'sem alteracoes' &&
      raw !== 'nenhum' &&
      raw !== 'falso' &&
      raw !== 'operante'
    ) {
      return true;
    }
  }
  if (item.motivoInoperante && String(item.motivoInoperante).trim() !== '') {
    return true;
  }
  return false;
};

/**
 * Utilitário modular para extração de fotos de problemas cadastrados na vistoria.
 * REGRA: Não anexa fotos banner/perfil do hidrante (fotoPerfil, foto, fotoUrl).
 * Anexa APENAS fotos de problemas cadastrados na vistoria.
 */
export const extractPhotos = (h) => {
  if (!h) return [];
  // Deve anexar apenas as fotos de problema cadastrado na vistoria
  if (!hasVistoriaProblem(h)) {
    return [];
  }

  const photos = [];
  // Conjunto de URLs/base64 de fotos de banner/perfil que NUNCA devem ser anexadas
  const bannerPhotos = new Set();
  if (typeof h.fotoPerfil === 'string' && h.fotoPerfil.trim()) bannerPhotos.add(h.fotoPerfil.trim());
  if (typeof h.foto === 'string' && h.foto.trim()) bannerPhotos.add(h.foto.trim());
  if (typeof h.fotoUrl === 'string' && h.fotoUrl.trim()) bannerPhotos.add(h.fotoUrl.trim());

  const add = (p) => {
    if (typeof p === 'string' && p.trim().length > 10) {
      const cleanP = p.trim();
      // Bloqueia qualquer foto de banner/perfil do hidrante
      if (bannerPhotos.has(cleanP)) return;
      if (!photos.includes(cleanP)) {
        photos.push(cleanP);
      }
    }
  };

  // 1. Fotos da vistoria atual do hidrante
  if (Array.isArray(h.fotosVistoria)) h.fotosVistoria.forEach(add);
  if (h.fotoVistoria) add(h.fotoVistoria);

  // 2. Fotos de vistorias com problemas no histórico
  if (Array.isArray(h.HISTORICO_VISTORIAS)) {
    h.HISTORICO_VISTORIAS.forEach(v => {
      if (hasVistoriaProblem(v)) {
        if (Array.isArray(v.fotosVistoria)) v.fotosVistoria.forEach(add);
        if (v.fotoVistoria) add(v.fotoVistoria);
      }
    });
  }

  return photos;
};

/**
 * Utilitário central de Geração e Impressão Direta do PDF Oficial no Navegador.
 * Elimina a etapa intermediária de popup/barra manual: ao clicar em "Baixar PDF",
 * renderiza o documento em plano de fundo e abre imediatamente o diálogo nativo do Chrome
 * configurado com o nome padronizado oficial (ex: Relatorio_Geral_CBMDF_...).
 */
export const executePrintHtml = (html, docTitle = '') => {
  try {
    // 1. Extrai ou define o título padronizado oficial do documento
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const standardTitle = docTitle || (titleMatch ? titleMatch[1] : 'Relatorio_Netuno_CBMDF');

    // 2. Garante que o documento principal também reflita temporariamente o nome padronizado
    // para que o Chrome sugira exatamente este nome ao salvar como PDF
    const prevMainTitle = document.title;
    document.title = standardTitle;

    // 3. Remove iframe anterior caso existente
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

    const cleanup = () => {
      setTimeout(() => {
        try { document.title = prevMainTitle; } catch (e) { console.warn("[SafeCatch] Erro mitigado:", e); }
        const frame = document.getElementById('netuno-print-iframe');
        if (frame) frame.remove();
      }, 600);
    };

    let printDone = false;
    const doPrint = () => {
      if (printDone) return;
      printDone = true;
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.warn('Falha no iframe.print, utilizando popup direto:', err);
        fallbackPopupPrint(html, standardTitle);
      }
    };

    iframe.contentWindow.addEventListener('afterprint', cleanup);

    // Aguarda fotos/imagens renderizarem antes de abrir o diálogo do PDF
    const images = iframe.contentWindow.document.images;
    if (images && images.length > 0) {
      let loadedCount = 0;
      const totalImages = images.length;

      const checkAllImages = () => {
        loadedCount++;
        if (loadedCount >= totalImages) {
          setTimeout(doPrint, 150);
        }
      };

      for (let i = 0; i < totalImages; i++) {
        if (images[i].complete) {
          loadedCount++;
        } else {
          images[i].onload = checkAllImages;
          images[i].onerror = checkAllImages;
        }
      }

      if (loadedCount >= totalImages) {
        setTimeout(doPrint, 150);
      } else {
        // Timeout de salvaguarda caso alguma imagem demore
        setTimeout(doPrint, 1200);
      }
    } else {
      setTimeout(doPrint, 200);
    }
  } catch (e) {
    console.error('Erro ao acionar impressão direta de PDF:', e);
    fallbackPopupPrint(html, docTitle);
  }
};

export const fallbackIframePrint = (html, docTitle = '') => {
  executePrintHtml(html, docTitle);
};

export const fallbackPopupPrint = (html, docTitle = '') => {
  try {
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const standardTitle = docTitle || (titleMatch ? titleMatch[1] : 'Relatorio_Netuno_CBMDF');

    const printWindow = window.open('', '_blank', 'width=1050,height=850');
    if (!printWindow) {
      alert('Por favor, autorize popups para que o diálogo de Salvar PDF possa ser acionado.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.document.title = standardTitle;

    printWindow.addEventListener('afterprint', () => {
      try { printWindow.close(); } catch (e) { console.warn("[SafeCatch] Erro mitigado:", e); }
    });

    setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch (e) {
        console.warn('Falha no printWindow.print:', e);
      }
    }, 450);
  } catch (err) {
    console.error('Falha no fallbackPopupPrint:', err);
  }
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
    const isPartial = Boolean(currentMission.selectedIds && currentMission.selectedIds.length > currentData.length);
    parts.push(`Missao_${currentMission.name.replace(/[^a-zA-Z0-9]/g, '_')}${isPartial ? '_Parcial' : ''}`);
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
  const emissorCargo = (currentUser?.role === 'admin' || currentUser?.role === 'gestor') ? 'Gestor de Hidrante' : 'Vistoriador Operacional';

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
    const wazeLink = (lat && lng && lat !== '-' && lng !== '-') ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes` : '';

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
        <td class="col-local text-center">
          ${wazeLink ? `<a href="${wazeLink}" target="_blank" class="waze-btn" title="Abrir localização no Waze">Waze</a>` : '-'}
        </td>
      </tr>
    `;
  }).join('');

  const maxCityTotal = cityOperabilityStats.reduce((max, c) => Math.max(max, c.total || 0), 1);

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
          ${cityOperabilityStats.map(c => {
            const barWidth = Math.max(6, ((c.total / maxCityTotal) * 100)).toFixed(1);
            return `
            <tr>
              <td><strong>${c.nome}</strong></td>
              <td class="text-center">${c.total}</td>
              <td class="text-center text-green"><strong>${c.operantes}</strong> (${c.operantesPercent}%)</td>
              <td class="text-center text-red"><strong>${c.inoperantes}</strong> (${c.inoperantesPercent}%)</td>
              <td>
                <div class="bar-container">
                  <div style="width: ${barWidth}%; height: 100%; display: flex;">
                    <div class="bar-fill bar-green" style="width: ${c.operantesPercent}%;"></div>
                    <div class="bar-fill bar-red" style="width: ${c.inoperantesPercent}%;"></div>
                  </div>
                </div>
              </td>
            </tr>
          `;
          }).join('')}
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
  const shouldBreakPage = currentData.length > 3 || (currentData.length > 1 && totalFotosCount > 2) || totalFotosCount > 4;

  const anexoFotograficoHtml = hidrantesComFotos.length > 0 ? `
    <div class="section-block ${shouldBreakPage ? 'page-break-before' : 'avoid-break'}">
      <div class="section-title" style="font-size: 12px; border-bottom: 2px solid #0f172a; padding-bottom: 3px; margin-top: ${shouldBreakPage ? '14px' : '6px'}; margin-bottom: 8px;">
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

  const docTitle = buildReportFileName({
    prefix: 'Relatorio_Geral_CBMDF',
    rasPresentes,
    activeFilters,
    currentMission
  });

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <title>${docTitle}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 6mm 8mm 6mm 8mm;
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
          font-size: 10.5px;
          padding: 2px 2px 8px 2px;
        }
        .official-header {
          border-bottom: 2px solid #0f172a;
          padding-bottom: 6px;
          margin-bottom: 8px;
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
          gap: 8px;
          margin-bottom: 8px;
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
          display: block;
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
        .data-table tr {
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .data-table tbody tr:nth-child(even) { background: #fafafa; }
        .col-seq { width: 3.5%; text-align: center; font-weight: bold; color: #64748b; }
        .col-code { width: 16.5%; }
        .col-end { width: 30%; }
        .col-vistoriador { width: 15%; font-weight: 600; color: #047857; }
        .col-status { width: 27%; }
        .col-local { width: 8%; text-align: center; }
        .waze-btn {
          display: inline-block;
          background: #2563eb;
          color: #ffffff !important;
          text-decoration: none !important;
          padding: 2.5px 7px;
          border-radius: 4px;
          font-weight: 800;
          font-size: 9px;
          letter-spacing: 0.3px;
          white-space: nowrap;
        }
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
          gap: 8px;
          width: 100%;
        }
        .photo-item-2 {
          height: 185px;
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
          gap: 10px;
          margin-bottom: 8px;
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
          margin-top: 10px;
          padding-top: 4px;
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
          <div class="doc-title">${currentMission && currentMission.selectedIds && currentMission.selectedIds.length > currentData.length ? 'Relatório Parcial de Vistoria de Hidrantes Urbanos' : 'Relatório de Vistoria de Hidrantes Urbanos'}</div>
          <div class="doc-meta">
            <span><strong>Localidade / RAs:</strong> ${rasPresentes || 'Todas as Cidades / DF Completo'}</span>
            ${currentMission ? `<span><strong>Missão:</strong> ${currentMission.name} ${currentMission.selectedIds && currentMission.selectedIds.length > currentData.length ? `<span style="color: #b45309; font-weight: bold;">(Relatório Parcial: ${currentData.length} de ${currentMission.selectedIds.length} vistoriados)</span>` : `<span style="color: #15803d; font-weight: bold;">(Conclusivo: ${currentData.length} vistoriados)</span>`}</span>` : ''}
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
                <g transform="rotate(-90 18 18)">
                  <circle cx="18" cy="18" r="15.91549430918954" fill="transparent" stroke="#ef4444" stroke-width="4.2"></circle>
                  <circle cx="18" cy="18" r="15.91549430918954" fill="transparent" stroke="#10b981" stroke-width="4.2" stroke-dasharray="${operantesPercent} ${100 - operantesPercent}" stroke-dashoffset="25"></circle>
                </g>
                <text x="18" y="16.5" text-anchor="middle" dominant-baseline="central" font-size="6.8" font-weight="900" fill="#0f172a">${operantesPercent}%</text>
                <text x="18" y="22.5" text-anchor="middle" dominant-baseline="central" font-size="4.2" font-weight="800" fill="#64748b">OK</text>
              </svg>
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
              <th class="col-local text-center">Local</th>
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

  executePrintHtml(html, docTitle);
};

/**
 * 2. GERAÇÃO E IMPRESSÃO DO RELATÓRIO OFICIAL CAESB (SOLICITAÇÃO DE MANUTENÇÃO)
 */
export const generateCaesbReportHtml = ({
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
    const wazeLink = (lat && lng && lat !== '-' && lng !== '-') ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes` : '';

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
        <td class="col-local text-center">
          ${wazeLink ? `<a href="${wazeLink}" target="_blank" class="waze-btn" title="Abrir localização no Waze">Waze</a>` : '-'}
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
  const shouldBreakPage = caesbData.length > 3 || (caesbData.length > 1 && totalFotosCount > 2) || totalFotosCount > 4;

  const anexoFotograficoHtml = hidrantesComFotos.length > 0 ? `
    <div class="section-block ${shouldBreakPage ? 'page-break-before' : 'avoid-break'}">
      <div class="section-title" style="font-size: 12px; border-bottom: 2px solid #047857; color: #065f46; padding-bottom: 3px; margin-top: ${shouldBreakPage ? '14px' : '6px'}; margin-bottom: 8px;">
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

  const docTitle = buildReportFileName({
    prefix: 'Relatorio_Vistoria_Fiscalizacao',
    rasPresentes,
    activeFilters,
    currentMission
  });

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <title>${docTitle}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 6mm 8mm 6mm 8mm;
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
          font-size: 10.5px;
          padding: 2px 2px 8px 2px;
        }
        .official-header {
          border-bottom: 2px solid #0f172a;
          padding-bottom: 6px;
          margin-bottom: 8px;
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
          background: #fef2f2;
          border: 1.5px solid #f87171;
          border-radius: 6px;
          padding: 8px 14px;
          margin-bottom: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .caesb-banner-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .caesb-count-box {
          font-size: 26px;
          font-weight: 900;
          color: #dc2626;
          line-height: 1;
        }
        .caesb-banner-title {
          font-size: 11.5px;
          font-weight: 900;
          color: #991b1b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .caesb-banner-sub {
          font-size: 9.5px;
          color: #475569;
          margin-top: 1px;
        }
        .caesb-city-badge {
          font-size: 9.5px;
          font-weight: 800;
          color: #b45309;
          background: #fef3c7;
          border: 1px solid #fde68a;
          padding: 3px 8px;
          border-radius: 4px;
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
        .col-seq { width: 3.5%; text-align: center; font-weight: bold; color: #64748b; }
        .col-code { width: 17%; }
        .col-end { width: 34.5%; }
        .col-prob { width: 37%; }
        .col-local { width: 8%; text-align: center; }
        .waze-btn {
          display: inline-block;
          background: #2563eb;
          color: #ffffff !important;
          text-decoration: none !important;
          padding: 2.5px 7px;
          border-radius: 4px;
          font-weight: 800;
          font-size: 9px;
          letter-spacing: 0.3px;
          white-space: nowrap;
        }
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
          gap: 8px;
          width: 100%;
        }
        .photo-item-2 {
          height: 185px;
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
          margin-top: 10px;
          padding-top: 4px;
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
          <div class="doc-title">${currentMission && currentMission.selectedIds && currentMission.selectedIds.length > currentData.length ? 'Relatório Parcial de Alterações e Manutenção - CAESB' : 'Relatório de Alterações e Manutenção - CAESB'}</div>
          <div class="legal-term">Encaminhamento Institucional para Intervenção Preventiva e Corretiva • CBMDF / CAESB</div>
          <div class="doc-meta">
            <span><strong>Localidade / RAs:</strong> ${rasPresentes || 'Todas as Cidades / DF Completo'}</span>
            ${currentMission ? `<span><strong>Missão:</strong> ${currentMission.name} ${currentMission.selectedIds && currentMission.selectedIds.length > currentData.length ? `<span style="color: #b45309; font-weight: bold;">(Relatório Parcial: ${currentData.length} de ${currentMission.selectedIds.length} vistoriados)</span>` : `<span style="color: #15803d; font-weight: bold;">(Conclusivo: ${currentData.length} vistoriados)</span>`}</span>` : ''}
            <span><strong>Emissão:</strong> ${nowStr}</span>
          </div>
        </div>
      </div>

      <div class="caesb-banner avoid-break">
        <div class="caesb-banner-left">
          <div class="caesb-count-box">${caesbData.length}</div>
          <div>
            <div class="caesb-banner-title">Total de Hidrantes para Reparo</div>
            <div class="caesb-banner-sub">Encaminhamento para manutenção preventiva e corretiva CAESB</div>
          </div>
        </div>
        ${(isMultiCity && cityOperabilityStats.filter(c => c.total > 0).length > 0) ? `
          <div class="caesb-city-badge">
            📍 ${cityOperabilityStats.filter(c => c.total > 0).length} cidades com demanda de reparo
          </div>
        ` : ''}
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
              <th class="col-local text-center">Local</th>
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

  return {
    html,
    docTitle,
    docHash,
    caesbData
  };
};

export const printCaesbReport = (params) => {
  const { html, docTitle } = generateCaesbReportHtml(params);
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
/**
 * Extrai fotos de vistoria (atual ou do histórico recente)
 */
export const extractVistoriaPhotos = (h) => {
  if (!h) return [];
  const photos = [];
  const add = (p) => {
    if (typeof p === 'string' && p.trim().length > 10 && !photos.includes(p.trim())) {
      photos.push(p.trim());
    }
  };
  // 1. Fotos da vistoria atual do hidrante
  if (Array.isArray(h.fotosVistoria)) h.fotosVistoria.forEach(add);
  if (h.fotoVistoria) add(h.fotoVistoria);

  // 2. Se não encontrar fotos diretas, procurar no histórico de vistorias (ordem cronológica mais recente)
  if (photos.length === 0 && Array.isArray(h.HISTORICO_VISTORIAS)) {
    for (const v of h.HISTORICO_VISTORIAS) {
      if (Array.isArray(v.fotosVistoria)) v.fotosVistoria.forEach(add);
      if (v.fotoVistoria) add(v.fotoVistoria);
      if (Array.isArray(v.fotos)) v.fotos.forEach(add);
      if (v.foto) add(v.foto);
      if (photos.length > 0) break;
    }
  }
  return photos;
};

/**
 * Extrai e normaliza informações cadastrais e de vistoria de um hidrante para pareceres técnicos
 */
export const getHydrantAuditInfo = (h) => {
  if (!h) return null;
  const codigo = h.nomHidrante || h.codHidrante || '-';
  const endereco = h.dscEndereco || 'Endereço não cadastrado';
  const ra = h.dscLocalidade || 'Distrito Federal';
  const latNum = Number(h.numLatitude);
  const lngNum = Number(h.numLongitude);
  const coords = (!isNaN(latNum) && !isNaN(lngNum)) 
    ? `${latNum.toFixed(6)}, ${lngNum.toFixed(6)}` 
    : '-';
  const isOperante = (h.flgAtivo === true || h.flgAtivo === 1 || h.flgAtivo === 'true' || h.flgAtivo === '1');
  const situacao = isOperante ? 'Operante' : 'Inoperante';

  // Extração inteligente da data da última vistoria cadastrada
  let dataVistoria = 'Não registrada';
  const rawCandidate = h.datHoraUltimaVistoria || h.datUltimaVistoria || h.dataUltimaVistoria || h.dataVistoria || h.datVistoria;
  if (rawCandidate && String(rawCandidate).trim().toLowerCase() !== 'sem vistoria') {
    dataVistoria = String(rawCandidate).split(' ')[0];
  } else if (Array.isArray(h.HISTORICO_VISTORIAS) && h.HISTORICO_VISTORIAS.length > 0) {
    const last = h.HISTORICO_VISTORIAS[0];
    const d = last?.datHoraUltimaVistoria || last?.dataVistoria || last?.datVistoria || last?.timestamp || last?.data;
    if (d) dataVistoria = String(d).split(' ')[0];
  } else if (h.datAtualizacao) {
    dataVistoria = String(h.datAtualizacao).split(' ')[0];
  }

  // Defeitos e condições verificadas em campo
  let condicoes = 'Sem anomalias ou defeitos apontados (Pronto emprego operacional)';
  if (!isOperante) {
    condicoes = h.problemasHidrante && h.problemasHidrante.trim()
      ? `Inoperante: ${h.problemasHidrante}`
      : 'Inoperante (necessita intervenção / manutenção)';
  } else if (h.problemasHidrante && h.problemasHidrante.trim()) {
    condicoes = `Operante com apontamentos: ${h.problemasHidrante}`;
  }

  const vazaoPressao = [
    h.numVazao ? `Vazão: ${h.numVazao} L/min` : null,
    h.numPressao ? `Pressão: ${h.numPressao} kgf/cm²` : null
  ].filter(Boolean).join(' • ') || 'Pressão e vazão nominais da rede de distribuição pública';

  // Resolução automática de fotos (Perfil e Última Vistoria)
  const fotoPerfil = getHydrantPhoto(h);
  const fotosVistoria = extractVistoriaPhotos(h);

  return {
    codigo,
    endereco,
    ra,
    coords,
    situacao,
    isOperante,
    dataVistoria,
    condicoes,
    vazaoPressao,
    fotoPerfil,
    fotosVistoria
  };
};

/**
 * Gera um mapa cartográfico vetorial em SVG para o parecer técnico impresso em A4 / PDF
 */
export const generateTechnicalMapSvg = (targetPos, radius = 600, adjacentHydrants = [], evalHydrant = null) => {
  if (!targetPos || !targetPos.lat || !targetPos.lng) {
    return '';
  }

  const width = 680;
  const height = 300;
  const cx = width / 2;
  const cy = height / 2;

  // Escala gráfica no SVG
  const rPixels = 105;
  const scale = rPixels / radius;

  const targetCode = evalHydrant?.nomHidrante || evalHydrant?.codHidrante || 'ALVO';
  const targetLat = Number(targetPos.lat);
  const targetLng = Number(targetPos.lng);

  // Bounding box para export de mapa base ArcGIS
  const metersSpan = width / scale;
  const latSpan = (height / scale) / 111320;
  const lngSpan = metersSpan / (111320 * Math.cos(targetLat * Math.PI / 180));
  const minLat = (targetLat - latSpan * 0.55).toFixed(6);
  const maxLat = (targetLat + latSpan * 0.55).toFixed(6);
  const minLng = (targetLng - lngSpan * 0.55).toFixed(6);
  const maxLng = (targetLng + lngSpan * 0.55).toFixed(6);
  const esriMapUrl = `https://services.arcgisonline.com/arcgis/rest/services/World_Street_Map/MapServer/export?bbox=${minLng},${minLat},${maxLng},${maxLat}&bboxSR=4326&imageSR=4326&size=${width},${height}&format=png&f=image`;

  const adjacentsRender = (adjacentHydrants || []).map(h => {
    const lat = Number(h.numLatitude);
    const lng = Number(h.numLongitude);
    if (isNaN(lat) || isNaN(lng)) return null;

    const dLat = (lat - targetLat) * 111320;
    const dLng = (lng - targetLng) * (111320 * Math.cos(targetLat * Math.PI / 180));
    const px = cx + dLng * scale;
    const py = cy - dLat * scale;
    const dist = Math.round(h.distanceToTarget || h.distance || Math.sqrt(dLat * dLat + dLng * dLng));
    const code = h.nomHidrante || h.codHidrante || '';
    const isOp = (h.flgAtivo === true || h.flgAtivo === 1 || h.flgAtivo === 'true' || h.flgAtivo === '1');

    return {
      px,
      py,
      dist,
      code,
      isOp,
      midX: (cx + px) / 2,
      midY: (cy + py) / 2
    };
  }).filter(Boolean);

  return `
    <div style="margin: 12px 0; border: 1.5px solid #334155; border-radius: 6px; overflow: hidden; background: #f8fafc; font-family: Arial, sans-serif; page-break-inside: avoid;">
      <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="display: block; background: #f8fafc;">
        <defs>
          <pattern id="techGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#cbd5e1" stroke-width="0.75" stroke-dasharray="2,2"/>
          </pattern>
        </defs>

        <!-- Fundo de Mapa com Fallback de Grade Geodésica -->
        <rect width="${width}" height="${height}" fill="url(#techGrid)" />
        <image href="${esriMapUrl}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none" opacity="0.40" />

        <!-- Círculo de Referência Métrica Concéntrica (300m) -->
        <circle cx="${cx}" cy="${cy}" r="${rPixels * 0.5}" fill="none" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3,3" opacity="0.5"/>
        <text x="${cx + rPixels * 0.5 + 4}" y="${cy - 3}" font-size="8.5" fill="#64748b" font-weight="bold">${Math.round(radius * 0.5)}m</text>

        <!-- Linhas e Círculos de Cobertura dos Hidrantes Adjacentes (Sem Preenchimento) -->
        ${adjacentsRender.map(a => `
          <line x1="${cx}" y1="${cy}" x2="${a.px}" y2="${a.py}" stroke="#0284c7" stroke-width="1.2" stroke-dasharray="4,3" opacity="0.7"/>
          <circle cx="${a.px}" cy="${a.py}" r="${rPixels}" fill="none" stroke="#0284c7" stroke-width="1.4" stroke-dasharray="5,4" opacity="0.85"/>
          <rect x="${a.midX - 18}" y="${a.midY - 8}" width="36" height="15" rx="3" fill="#ffffff" stroke="#0284c7" stroke-width="1" opacity="0.95"/>
          <text x="${a.midX}" y="${a.midY + 3}" text-anchor="middle" font-size="8.5" font-weight="bold" fill="#0369a1">${a.dist}m</text>
        `).join('')}

        <!-- Círculo de Cobertura do Hidrante Alvo (Sombreado Laranja Translúcido) -->
        <circle cx="${cx}" cy="${cy}" r="${rPixels}" fill="#ea580c" fill-opacity="0.10" stroke="#ea580c" stroke-width="2.2" stroke-dasharray="6,4"/>
        <text x="${cx}" y="${cy - rPixels - 5}" text-anchor="middle" font-size="9.5" font-weight="bold" fill="#c2410c">Raio Regulamentar de Cobertura: ${radius}m</text>

        <!-- Marcadores dos Hidrantes Adjacentes -->
        ${adjacentsRender.map(a => `
          <g>
            <circle cx="${a.px}" cy="${a.py}" r="6.5" fill="${a.isOp ? '#0284c7' : '#dc2626'}" stroke="#ffffff" stroke-width="2"/>
            <rect x="${a.px - 22}" y="${a.py + 8}" width="44" height="14" rx="3" fill="#0f172a" opacity="0.85"/>
            <text x="${a.px}" y="${a.py + 18}" text-anchor="middle" font-size="8.5" font-weight="bold" fill="#ffffff">${a.code}</text>
          </g>
        `).join('')}

        <!-- Marcador Central do Hidrante Alvo -->
        <g>
          <circle cx="${cx}" cy="${cy}" r="9" fill="#ea580c" stroke="#ffffff" stroke-width="2.5"/>
          <circle cx="${cx}" cy="${cy}" r="3.5" fill="#ffffff"/>
          <rect x="${cx - 28}" y="${cy + 12}" width="56" height="16" rx="3" fill="#c2410c" opacity="0.95"/>
          <text x="${cx}" y="${cy + 24}" text-anchor="middle" font-size="9" font-weight="bold" fill="#ffffff">${targetCode}</text>
        </g>

        <!-- Indicador de Norte Técnico -->
        <g transform="translate(${width - 45}, 40)">
          <circle cx="0" cy="0" r="15" fill="#ffffff" stroke="#475569" stroke-width="1.2" opacity="0.9"/>
          <polygon points="0,-12 4,0 0,-2 -4,0" fill="#dc2626"/>
          <polygon points="0,12 4,0 0,2 -4,0" fill="#475569"/>
          <text x="0" y="-14" text-anchor="middle" font-size="8.5" font-weight="bold" fill="#dc2626">N</text>
        </g>

        <!-- Escala Gráfica Métrica -->
        <g transform="translate(18, ${height - 24})">
          <rect x="-4" y="-12" width="${(200 * scale) + 20}" height="24" rx="3" fill="#ffffff" opacity="0.92" stroke="#94a3b8" stroke-width="0.8"/>
          <line x1="6" y1="3" x2="${6 + 200 * scale}" y2="3" stroke="#0f172a" stroke-width="2.2"/>
          <line x1="6" y1="-1" x2="6" y2="7" stroke="#0f172a" stroke-width="1.2"/>
          <line x1="${6 + 100 * scale}" y1="1" x2="${6 + 100 * scale}" y2="5" stroke="#0f172a" stroke-width="1"/>
          <line x1="${6 + 200 * scale}" y1="-1" x2="${6 + 200 * scale}" y2="7" stroke="#0f172a" stroke-width="1.2"/>
          <text x="6" y="-3" font-size="7.5" font-weight="bold" fill="#0f172a">0</text>
          <text x="${6 + 100 * scale}" y="-3" text-anchor="middle" font-size="7.5" font-weight="bold" fill="#0f172a">100m</text>
          <text x="${6 + 200 * scale}" y="-3" text-anchor="middle" font-size="7.5" font-weight="bold" fill="#0f172a">200m</text>
        </g>
      </svg>
      
      <!-- Legenda Oficial Integrada -->
      <div style="background: #ffffff; border-top: 1px solid #cbd5e1; padding: 6px 12px; font-size: 8pt; display: flex; flex-wrap: wrap; justify-content: space-around; align-items: center; color: #1e293b;">
        <div><strong style="color: #ea580c;">● Hidrante Alvo:</strong> Raio de ${radius}m (Sombreado Laranja)</div>
        <div><strong style="color: #0284c7;">- - Hidrantes Adjacentes:</strong> Raio de ${radius}m (Contorno Azul, sem sobreposição)</div>
        <div><strong>Distâncias Medidas:</strong> Cotas geodésicas em metros</div>
      </div>
    </div>
  `;
};

export const printTechnicalStudyReport = ({ studyData, calcResults, currentUser = null }) => {
  if (!studyData || !calcResults) {
    alert('Dados do estudo técnico incompletos para impressão.');
    return;
  }

  const nowStr = formatDateTime(new Date());
  const emissorNome = currentUser?.nome || 'Analista Técnico';
  const emissorMatricula = currentUser?.matricula ? `Matrícula: ${currentUser.matricula}` : '';
  const isRemocao = studyData.studyType === 'relocation' || studyData.studyType === 'remocao';
  const isApproved = calcResults.isApproved;

  const evalHydrant = calcResults.evalHydrant || studyData.evalHydrant;
  const auditInfo = getHydrantAuditInfo(evalHydrant);
  const targetPos = calcResults.targetPos || (evalHydrant ? { lat: Number(evalHydrant.numLatitude), lng: Number(evalHydrant.numLongitude) } : null);

  const adjacentsHtml = (calcResults.adjacentHydrants || []).map((h, i) => {
    const distVal = Math.round(h.distanceToTarget || h.distance || 0);
    const isOp = (h.flgAtivo === true || h.flgAtivo === 1 || h.flgAtivo === 'true' || h.flgAtivo === '1');
    return `
      <tr>
        <td class="text-center">${i + 1}</td>
        <td><strong>${h.codHidrante || h.nomHidrante || '-'}</strong></td>
        <td class="text-center font-bold" style="color: #0369a1;">${distVal > 0 ? distVal + ' m' : '-'}</td>
        <td style="font-family: monospace; font-size: 8.5pt;">${Number(h.numLatitude)?.toFixed(6) || '-'}, ${Number(h.numLongitude)?.toFixed(6) || '-'}</td>
        <td>${fixEncoding(h.dscEndereco || h.dscLocalidade) || '-'}</td>
        <td class="text-center"><span class="badge ${isOp ? 'badge-op' : 'badge-inop'}">${isOp ? 'Operante' : 'Inoperante'}</span></td>
      </tr>
    `;
  }).join('');

  const mapSvg = generateTechnicalMapSvg(targetPos, calcResults.radius || 600, calcResults.adjacentHydrants || [], evalHydrant);

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <title>Parecer_Tecnico_Hidrantes_${nowStr.replace(/[^0-9]/g, '_')}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm 15mm 15mm 15mm;
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
          font-size: 11pt;
          line-height: 1.45;
          color: #000;
        }
        .header {
          text-align: center;
          margin-bottom: 18px;
        }
        .inst { font-size: 12pt; font-weight: bold; text-transform: uppercase; }
        .sub-inst { font-size: 10.5pt; margin-top: 1px; color: #1e293b; }
        .doc-title {
          font-size: 13pt;
          font-weight: bold;
          text-transform: uppercase;
          margin-top: 10px;
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
          padding: 5px 0;
        }
        .section-num { font-weight: bold; margin-top: 12px; margin-bottom: 4px; text-transform: uppercase; font-size: 11pt; }
        p { text-align: justify; text-indent: 1.5cm; margin-bottom: 6px; }
        .no-indent { text-indent: 0 !important; }
        
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-family: Arial, sans-serif;
          font-size: 9pt;
          margin: 8px 0;
        }
        .data-table th {
          background: #f1f5f9;
          border: 1px solid #475569;
          padding: 5px 6px;
          text-align: left;
        }
        .data-table td {
          border: 1px solid #475569;
          padding: 5px 6px;
        }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 8pt; }
        .badge-op { background: #dcfce7; color: #166534; }
        .badge-inop { background: #fee2e2; color: #991b1b; }
        
        .result-box {
          border: 2px solid #000;
          padding: 8px;
          margin: 10px 0;
          font-family: Arial, sans-serif;
          font-weight: bold;
          text-align: center;
          font-size: 10.5pt;
        }
        .result-approved { background: #f0fdf4; border-color: #166534; color: #166534; }
        .result-rejected { background: #fef2f2; border-color: #991b1b; color: #991b1b; }
        
        .signature { margin-top: 30px; text-align: center; page-break-inside: avoid; }
        .sig-line { width: 300px; border-top: 1px solid #000; margin: 0 auto 5px auto; }
        .sig-name { font-size: 10.5pt; font-weight: bold; }
        .sig-role { font-size: 9pt; color: #333; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="inst">Corpo de Bombeiros Militar do Distrito Federal</div>
        <div class="sub-inst">SEHUR / GPCIU • Seção Técnica de Hidrantes</div>
        <div class="doc-title">Parecer Técnico de Dimensionamento e Viabilidade de Hidrantes</div>
      </div>

      <div class="section-num">I - Referência</div>
      <p><strong>Documento de Origem:</strong> ${studyData.docRef || 'Estudo Técnico S/N'}</p>
      <p><strong>Tipo de Pleito:</strong> ${isRemocao ? 'Remanejamento / Remoção de Hidrante Instalado' : 'Projeção / Implantação de Novo Hidrante Urbano'}</p>
      ${studyData.infoGerais ? `<p>${studyData.infoGerais}</p>` : ''}

      <div class="section-num">II - Objeto de Análise e Equipamento Avaliado</div>
      ${isRemocao && auditInfo ? `
        <p>O presente estudo analisa tecnicamente o hidrante urbano abaixo caracterizado, vistoriado e cadastrado na malha do Distrito Federal:</p>
        <table class="data-table" style="margin-bottom: 8px;">
          <tbody>
            <tr>
              <td style="width: 25%; background: #f8fafc;"><strong>Identificação / Código:</strong></td>
              <td style="width: 25%; font-weight: bold; font-family: monospace;">${auditInfo.codigo}</td>
              <td style="width: 25%; background: #f8fafc;"><strong>Situação Operacional:</strong></td>
              <td style="width: 25%;"><span class="badge ${auditInfo.isOperante ? 'badge-op' : 'badge-inop'}">${auditInfo.situacao}</span></td>
            </tr>
            <tr>
              <td style="background: #f8fafc;"><strong>Endereço / Localidade:</strong></td>
              <td colspan="3">${auditInfo.endereco} • ${auditInfo.ra}</td>
            </tr>
            <tr>
              <td style="background: #f8fafc;"><strong>Coordenadas Geodésicas:</strong></td>
              <td style="font-family: monospace;">${auditInfo.coords}</td>
              <td style="background: #f8fafc;"><strong>Data da Última Vistoria:</strong></td>
              <td><strong>${auditInfo.dataVistoria}</strong></td>
            </tr>
            <tr>
              <td style="background: #f8fafc;"><strong>Condições Verificadas:</strong></td>
              <td colspan="3">${auditInfo.condicoes} (${auditInfo.vazaoPressao})</td>
            </tr>
          </tbody>
        </table>
      ` : `
        <p>O presente estudo tem por finalidade analisar tecnicamente a viabilidade de projeção e implantação de novo hidrante urbano na localidade de <strong>${studyData.selectedRA || 'Distrito Federal'}</strong>, para expansão e garantia de abastecimento das linhas de combate a incêndio.</p>
      `}

      ${(auditInfo?.fotoPerfil || (auditInfo?.fotosVistoria && auditInfo.fotosVistoria.length > 0) || studyData.fotoHidrante) ? `
        <div style="margin: 10px 0 14px 0; page-break-inside: avoid;">
          <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; align-items: flex-start;">
            ${auditInfo?.fotoPerfil ? `
              <div style="text-align: center; flex: 1; min-width: 200px; max-width: 310px;">
                <div style="border: 1px solid #475569; border-radius: 4px; overflow: hidden; height: 175px; background: #0f172a; display: flex; align-items: center; justify-content: center;">
                  <img src="${auditInfo.fotoPerfil}" style="max-height: 175px; max-width: 100%; object-fit: contain;" alt="Perfil do Hidrante" />
                </div>
                <div style="font-size: 8.5pt; color: #1e293b; margin-top: 3px; font-weight: bold;">
                  Figura: Foto de Perfil / Fachada (${auditInfo.codigo})
                </div>
              </div>
            ` : ''}

            ${(auditInfo?.fotosVistoria && auditInfo.fotosVistoria.length > 0) ? `
              <div style="text-align: center; flex: 1; min-width: 200px; max-width: 310px;">
                <div style="border: 1px solid #475569; border-radius: 4px; overflow: hidden; height: 175px; background: #0f172a; display: flex; align-items: center; justify-content: center;">
                  <img src="${auditInfo.fotosVistoria[0]}" style="max-height: 175px; max-width: 100%; object-fit: contain;" alt="Última Vistoria" />
                </div>
                <div style="font-size: 8.5pt; color: #1e293b; margin-top: 3px; font-weight: bold;">
                  Figura: Registro da Última Vistoria (${auditInfo.dataVistoria})
                </div>
              </div>
            ` : ''}

            ${studyData.fotoHidrante ? `
              <div style="text-align: center; flex: 1; min-width: 200px; max-width: 310px;">
                <div style="border: 1px solid #475569; border-radius: 4px; overflow: hidden; height: 175px; background: #0f172a; display: flex; align-items: center; justify-content: center;">
                  <img src="${studyData.fotoHidrante}" style="max-height: 175px; max-width: 100%; object-fit: contain;" alt="Motivação do Pleito" />
                </div>
                <div style="font-size: 8.5pt; color: #1e293b; margin-top: 3px; font-weight: bold;">
                  Figura: Situação Motivadora Anexada
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}

      <div class="section-num">III - Metodologia e Fundamentação Normativa (ABNT NBR 12.218)</div>
      <p>
        A análise de cobertura fundamenta-se estritamente nas prescrições da <strong>ABNT NBR 12.218/2017</strong> 
        (Projeto de Rede de Distribuição de Água para Abastecimento Público) e nas diretrizes técnicas do CBMDF. A referida norma estabelece o dimensionamento de hidrantes urbanos com base nos seguintes raios regulamentares de cobertura por tipologia de ocupação:
      </p>
      <div style="margin: 4px 0 6px 3.5cm; font-size: 10pt; line-height: 1.4;">
        <div>• <strong>Ocupação Unifamiliar (Baixa densidade demográfica):</strong> Raio regulamentar de <strong>800 metros</strong>.</div>
        <div>• <strong>Ocupação Verticalizada / Comercial (Média e alta densidade):</strong> Raio regulamentar de <strong>600 metros</strong>.</div>
        <div>• <strong>Ocupações Especiais (Hospitais, shoppings, alta carga de incêndio):</strong> Raio regulamentar de <strong>300 metros</strong>.</div>
      </div>
      <p>
        <strong>Enquadramento e Critério de Adjacência:</strong> O setor em análise classifica-se como <strong>${studyData.occupation}</strong>, correspondendo a um raio de proteção de <strong>${calcResults.radius} metros</strong>. São considerados hidrantes adjacentes com capacidade de salvaguarda mútua exclusivamente os equipamentos situados a uma distância de até <strong>${calcResults.radius} metros</strong> (distância d ≤ ${calcResults.radius} m) do hidrante avaliado, limite técnico de sobreposição direta de cobertura. Equipamentos além desse raio não garantem a proteção do ponto analisado.
      </p>

      <div class="section-num">IV - Fatos Observados e Levantamento Espacial</div>
      <p>
        Por meio de processamento georreferenciado e cálculo geodésico na malha urbana, 
        foram identificados <strong>${(calcResults.adjacentHydrants || []).length} equipamento(s) adjacente(s)</strong> situados dentro do raio regulamentar de ${calcResults.radius}m:
      </p>

      ${mapSvg}

      <table class="data-table">
        <thead>
          <tr>
            <th class="text-center" style="width: 35px;">Item</th>
            <th style="width: 75px;">Código</th>
            <th class="text-center" style="width: 80px;">Distância</th>
            <th style="width: 140px;">Coordenadas</th>
            <th>Endereço / Localidade</th>
            <th class="text-center" style="width: 75px;">Situação</th>
          </tr>
        </thead>
        <tbody>
          ${adjacentsHtml || '<tr><td colspan="6" class="text-center">Nenhum hidrante adjacente identificado dentro do raio regulamentar.</td></tr>'}
        </tbody>
      </table>

      <div class="section-num">V - Parecer Conclusivo</div>
      <div class="result-box ${isApproved ? 'result-approved' : 'result-rejected'}">
        PARECER TÉCNICO: ${isApproved ? 'FAVORÁVEL / APROVADO' : 'DESFAVORÁVEL / REPROVADO'}
      </div>
      <p>
        ${isApproved 
          ? (isRemocao 
              ? `Diante da análise espacial executada, constatou-se que a totalidade da área de proteção regulamentar (${calcResults.radius}m) do hidrante ${auditInfo?.codigo || 'avaliado'} encontra-se plenamente sobreposta e salvaguardada pelos hidrantes adjacentes operantes da rede pública (${(calcResults.adjacentHydrants || []).length} equipamentos a menos de ${calcResults.radius}m), atendendo aos requisitos técnicos da ABNT NBR 12.218/2017 sem gerar zonas de desabastecimento. Parecer FAVORÁVEL ao remanejamento/remoção.`
              : `A área de interesse indicada encontra-se devidamente contemplada dentro do raio normativo estipulado de ${calcResults.radius}m, garantindo o pronto emprego operacional e o abastecimento das linhas de combate a incêndio. Parecer FAVORÁVEL à implantação.`)
          : (isRemocao 
              ? `A desativação do hidrante sob exame acarretará déficit de cobertura na malha urbana de combate a incêndios, deixando edificações desassistidas acima da distância regulamentar de ${calcResults.radius}m por insuficiência de hidrantes adjacentes operantes no raio normativo. Parecer DESFAVORÁVEL à remoção sem a prévia instalação de equipamento substituto na área de influência.`
              : `A cobertura calculada apontou vértices descobertos que extrapolam a distância regulamentar de ${calcResults.radius}m (maior distância identificada: ${calcResults.maxDist?.toFixed(2)}m). Parecer DESFAVORÁVEL na configuração original, recomendando-se a realocação para as coordenadas sugeridas.`)}
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
