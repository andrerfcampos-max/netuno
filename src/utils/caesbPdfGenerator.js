import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { fixEncoding } from './textUtils.js';
import { sanitizeProblem } from './problemUtils.js';

export async function generateCaesbReportPdfBytes({
  cidade = 'Distrito Federal',
  raRomano = '',
  hidrantes = [],
  emissorNome = 'Gestor de Hidrantes Urbanos',
  emissorMatricula = '',
  docHash = '00000000'
}) {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 40;
  const contentWidth = pageWidth - (margin * 2);

  let currentPage = null;
  let currentY = 0;
  const pages = [];

  function addPage() {
    currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    pages.push(currentPage);
    currentY = pageHeight - margin;
    return currentPage;
  }

  // 1ª Página
  addPage();

  // Cabeçalho institucional
  currentPage.drawText('GOVERNO DO DISTRITO FEDERAL', {
    x: margin,
    y: currentY,
    size: 8.5,
    font: fontBold,
    color: rgb(0.2, 0.25, 0.3)
  });
  currentY -= 13;

  currentPage.drawText('CORPO DE BOMBEIROS MILITAR DO DISTRITO FEDERAL', {
    x: margin,
    y: currentY,
    size: 11,
    font: fontBold,
    color: rgb(0.06, 0.09, 0.16)
  });
  currentY -= 12;

  currentPage.drawText('SEHUR / GPCIU • Seção Técnica de Hidrantes Urbanos', {
    x: margin,
    y: currentY,
    size: 9,
    font: fontRegular,
    color: rgb(0.3, 0.35, 0.4)
  });
  currentY -= 16;

  currentPage.drawLine({
    start: { x: margin, y: currentY },
    end: { x: pageWidth - margin, y: currentY },
    thickness: 1.5,
    color: rgb(0.06, 0.09, 0.16)
  });
  currentY -= 18;

  // Título do Relatório
  const title = `RELATÓRIO DE VISTORIA DA FISCALIZAÇÃO - DEMANDA CAESB`;
  currentPage.drawText(title, {
    x: margin,
    y: currentY,
    size: 11.5,
    font: fontBold,
    color: rgb(0.05, 0.45, 0.35)
  });
  currentY -= 14;

  const subTitle = `Região Administrativa: ${cidade}${raRomano ? ` (RA ${raRomano})` : ''} • Emissão: ${new Date().toLocaleDateString('pt-BR')}`;
  currentPage.drawText(subTitle, {
    x: margin,
    y: currentY,
    size: 9,
    font: fontRegular,
    color: rgb(0.25, 0.3, 0.35)
  });
  currentY -= 20;

  // Card resumo
  currentPage.drawRectangle({
    x: margin,
    y: currentY - 32,
    width: contentWidth,
    height: 36,
    color: rgb(0.96, 0.98, 0.96),
    borderColor: rgb(0.1, 0.6, 0.4),
    borderWidth: 1
  });

  currentPage.drawText(`TOTAL DE HIDRANTES PARA INTERVENÇÃO / REPARO: ${hidrantes.length}`, {
    x: margin + 12,
    y: currentY - 14,
    size: 9.5,
    font: fontBold,
    color: rgb(0.05, 0.45, 0.3)
  });

  currentPage.drawText(`Destinatário: Companhia de Saneamento Ambiental do DF (CAESB) • Acordo de Cooperação Técnica`, {
    x: margin + 12,
    y: currentY - 26,
    size: 8,
    font: fontRegular,
    color: rgb(0.3, 0.35, 0.4)
  });
  currentY -= 48;

  // Tabela de Hidrantes
  const cols = [
    { name: 'Nº', width: 25 },
    { name: 'Código', width: 70 },
    { name: 'Endereço / Referência', width: 200 },
    { name: 'Inconformidade / Defeito', width: 160 },
    { name: 'GPS', width: 60 }
  ];

  function drawTableHeader(y) {
    currentPage.drawRectangle({
      x: margin,
      y: y - 16,
      width: contentWidth,
      height: 18,
      color: rgb(0.92, 0.95, 0.98),
      borderColor: rgb(0.8, 0.85, 0.9),
      borderWidth: 0.5
    });

    let colX = margin;
    for (const col of cols) {
      currentPage.drawText(col.name, {
        x: colX + 4,
        y: y - 12,
        size: 8,
        font: fontBold,
        color: rgb(0.1, 0.15, 0.2)
      });
      colX += col.width;
    }
  }

  drawTableHeader(currentY);
  currentY -= 20;

  for (let idx = 0; idx < hidrantes.length; idx++) {
    const h = hidrantes[idx];
    const rowHeight = 30;

    if (currentY - rowHeight < margin + 65) {
      addPage();
      currentPage.drawText(`RELATÓRIO DE FISCALIZAÇÃO CAESB - ${cidade} (Continuação)`, {
        x: margin,
        y: currentY,
        size: 9,
        font: fontBold,
        color: rgb(0.3, 0.35, 0.4)
      });
      currentY -= 16;
      drawTableHeader(currentY);
      currentY -= 20;
    }

    if (idx % 2 === 1) {
      currentPage.drawRectangle({
        x: margin,
        y: currentY - rowHeight + 4,
        width: contentWidth,
        height: rowHeight,
        color: rgb(0.98, 0.98, 0.99)
      });
    }

    currentPage.drawLine({
      start: { x: margin, y: currentY - rowHeight + 4 },
      end: { x: pageWidth - margin, y: currentY - rowHeight + 4 },
      thickness: 0.5,
      color: rgb(0.88, 0.9, 0.92)
    });

    const cod = String(h.nomHidrante || h.codHidrante || `HID-${idx+1}`);
    const rawEnd = fixEncoding(h.dscEndereco) || h.dscLocalidade || '-';
    const end = rawEnd.length > 40 ? rawEnd.substring(0, 38) + '...' : rawEnd;
    const ref = h.dscPontoReferencia ? `Ref: ${fixEncoding(h.dscPontoReferencia).substring(0, 33)}` : '';
    const prob = sanitizeProblem(h.problemasHidrante) || (!h.flgAtivo ? 'INOPERANTE' : 'Avaria');
    const probTrunc = prob.length > 33 ? prob.substring(0, 31) + '...' : prob;
    const obs = (h.dscObservacao || h.observacoes || '').trim();
    const obsTrunc = obs ? `Obs: ${obs.substring(0, 28)}` : '';
    const lat = typeof h.numLatitude === 'number' ? h.numLatitude.toFixed(5) : (h.numLatitude || '');
    const lng = typeof h.numLongitude === 'number' ? h.numLongitude.toFixed(5) : (h.numLongitude || '');

    // Nº
    currentPage.drawText(String(idx + 1), {
      x: margin + 6,
      y: currentY - 11,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.4, 0.45, 0.5)
    });

    // Código
    currentPage.drawText(cod, {
      x: margin + cols[0].width + 4,
      y: currentY - 11,
      size: 8,
      font: fontBold,
      color: rgb(0.06, 0.09, 0.16)
    });

    // Endereço e Referência
    currentPage.drawText(end, {
      x: margin + cols[0].width + cols[1].width + 4,
      y: currentY - 11,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.15, 0.2, 0.25)
    });
    if (ref) {
      currentPage.drawText(ref, {
        x: margin + cols[0].width + cols[1].width + 4,
        y: currentY - 21,
        size: 6.5,
        font: fontRegular,
        color: rgb(0.45, 0.5, 0.55)
      });
    }

    // Inconformidade
    currentPage.drawText(probTrunc, {
      x: margin + cols[0].width + cols[1].width + cols[2].width + 4,
      y: currentY - 11,
      size: 7.5,
      font: fontBold,
      color: rgb(0.75, 0.1, 0.1)
    });
    if (obsTrunc) {
      currentPage.drawText(obsTrunc, {
        x: margin + cols[0].width + cols[1].width + cols[2].width + 4,
        y: currentY - 21,
        size: 6.5,
        font: fontRegular,
        color: rgb(0.4, 0.45, 0.5)
      });
    }

    // Coordenadas
    if (lat && lng) {
      currentPage.drawText(String(lat), {
        x: margin + cols[0].width + cols[1].width + cols[2].width + cols[3].width + 4,
        y: currentY - 10,
        size: 6.5,
        font: fontMono,
        color: rgb(0.1, 0.25, 0.5)
      });
      currentPage.drawText(String(lng), {
        x: margin + cols[0].width + cols[1].width + cols[2].width + cols[3].width + 4,
        y: currentY - 20,
        size: 6.5,
        font: fontMono,
        color: rgb(0.1, 0.25, 0.5)
      });
    } else {
      currentPage.drawText('-', {
        x: margin + cols[0].width + cols[1].width + cols[2].width + cols[3].width + 4,
        y: currentY - 11,
        size: 7,
        font: fontRegular,
        color: rgb(0.5, 0.5, 0.5)
      });
    }

    currentY -= rowHeight;
  }

  // Assinatura
  if (currentY - 55 < margin + 30) {
    addPage();
  }
  currentY -= 20;

  currentPage.drawText(emissorNome, {
    x: margin,
    y: currentY,
    size: 9,
    font: fontBold,
    color: rgb(0.1, 0.15, 0.2)
  });
  currentY -= 12;

  currentPage.drawText(`${emissorMatricula ? `${emissorMatricula} • ` : ''}Encarregado da Gestão de Hidrantes de Incêndio`, {
    x: margin,
    y: currentY,
    size: 8,
    font: fontRegular,
    color: rgb(0.35, 0.4, 0.45)
  });
  currentY -= 10;

  currentPage.drawText('SEHUR / GPCIU • Corpo de Bombeiros Militar do Distrito Federal', {
    x: margin,
    y: currentY,
    size: 8,
    font: fontRegular,
    color: rgb(0.35, 0.4, 0.45)
  });

  // Rodapés
  const totalPages = pages.length;
  for (let i = 0; i < totalPages; i++) {
    const page = pages[i];
    page.drawLine({
      start: { x: margin, y: margin + 14 },
      end: { x: pageWidth - margin, y: margin + 14 },
      thickness: 0.5,
      color: rgb(0.8, 0.85, 0.9)
    });

    page.drawText(`Controle / Hash: NETUNO-CAESB-${docHash} • Emitido eletronicamente via Sistema NETUNO • CBMDF`, {
      x: margin,
      y: margin + 4,
      size: 6.5,
      font: fontMono,
      color: rgb(0.4, 0.45, 0.5)
    });

    page.drawText(`Pág. ${i + 1} de ${totalPages}`, {
      x: pageWidth - margin - 50,
      y: margin + 4,
      size: 7,
      font: fontRegular,
      color: rgb(0.4, 0.45, 0.5)
    });
  }

  return await pdfDoc.save();
}

export async function generateCaesbReportPdfBase64(params) {
  const bytes = await generateCaesbReportPdfBytes(params);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
