// content.js - Motor de Automação Netuno SEI Integrator (Executado no SEI/SIP DF)

console.log('[Netuno SEI Ext] Content Script Ativo em:', window.location.href);

// Catálogo Oficial das 35 Regiões Administrativas do DF e Numeração Romana
const RA_CATALOG = [
  { name: 'Águas Claras', roman: 'XX' },
  { name: 'Água Quente', roman: 'XXXV' },
  { name: 'Arapoanga', roman: 'XXXIV' },
  { name: 'Arniqueira', roman: 'XXXIII' },
  { name: 'Brasília', roman: 'I' },
  { name: 'Brazlândia', roman: 'IV' },
  { name: 'Candangolândia', roman: 'XIX' },
  { name: 'Ceilândia', roman: 'IX' },
  { name: 'Cruzeiro', roman: 'XI' },
  { name: 'Estrutural', roman: 'XXV' },
  { name: 'Fercal', roman: 'XXXI' },
  { name: 'Gama', roman: 'II' },
  { name: 'Guará', roman: 'X' },
  { name: 'Itapoã', roman: 'XXVIII' },
  { name: 'Jardim Botânico', roman: 'XXVII' },
  { name: 'Lago Norte', roman: 'XVIII' },
  { name: 'Lago Sul', roman: 'XVI' },
  { name: 'Núcleo Bandeirante', roman: 'VIII' },
  { name: 'Paranoá', roman: 'VII' },
  { name: 'Park Way', roman: 'XXIV' },
  { name: 'Planaltina', roman: 'VI' },
  { name: 'Recanto das Emas', roman: 'XV' },
  { name: 'Riacho Fundo', roman: 'XVII' },
  { name: 'Riacho Fundo II', roman: 'XXI' },
  { name: 'Samambaia', roman: 'XII' },
  { name: 'Santa Maria', roman: 'XIII' },
  { name: 'São Sebastião', roman: 'XIV' },
  { name: 'SIA', roman: 'XXIX' },
  { name: 'Sobradinho', roman: 'V' },
  { name: 'Sobradinho II', roman: 'XXVI' },
  { name: 'Sol Nascente/Pôr do Sol', roman: 'XXXII' },
  { name: 'Sudoeste e Octogonal', roman: 'XXII' },
  { name: 'Taguatinga', roman: 'III' },
  { name: 'Varjão', roman: 'XXIII' },
  { name: 'Vicente Pires', roman: 'XXX' }
];

const DESTINO_UNIDADES = [
  { id: '110037655', sigla: 'CBMDF/DIVIS/SEHUR/SUTEC', descricao: 'CBMDF/DIVIS/SEHUR/SUTEC - Subseção Técnica' },
  { id: '110001072', sigla: 'CBMDF/COESP/GPCIU/SEHUR', descricao: 'CBMDF/COESP/GPCIU/SEHUR - Seção de Hidrante Urbano' }
];

function normalizeSearchStr(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getRARomanByName(cidade) {
  const norm = normalizeSearchStr(cidade);
  const found = RA_CATALOG.find(r => normalizeSearchStr(r.name) === norm);
  return found ? found.roman : '';
}

// Mapeamento canônico de prefixos de hidrantes para RA
const PREFIX_RA_MAP = {
  CRU: 'Cruzeiro',
  ARN: 'Arniqueira',
  TAG: 'Taguatinga',
  SAM: 'Samambaia',
  GUA: 'Guará',
  GAM: 'Gama',
  LGS: 'Lago Sul',
  LGN: 'Lago Norte',
  PLA: 'Planaltina',
  CEI: 'Ceilândia',
  SOB: 'Sobradinho',
  STM: 'Santa Maria',
  REC: 'Recanto das Emas',
  SJA: 'São Sebastião',
  SUD: 'Sudoeste e Octogonal',
  NUB: 'Núcleo Bandeirante',
  CAN: 'Candangolândia',
  BRA: 'Brazlândia',
  EST: 'Estrutural',
  FER: 'Fercal',
  ITA: 'Itapoã',
  JAB: 'Jardim Botânico',
  PAR: 'Paranoá',
  PKW: 'Park Way',
  RIA: 'Riacho Fundo',
  RF2: 'Riacho Fundo II',
  SB2: 'Sobradinho II',
  SIA: 'SIA',
  SNP: 'Sol Nascente/Pôr do Sol',
  VAR: 'Varjão',
  VCP: 'Vicente Pires',
  AQU: 'Água Quente',
  ARP: 'Arapoanga',
  ACL: 'Águas Claras',
  BSB: 'Brasília'
};

// Decodifica strings literais ou hexadecimais em conformidade com a especificação PDF
function decodePdfString(raw) {
  if (!raw) return '';
  if (raw.startsWith('<') && raw.endsWith('>')) {
    const hex = raw.slice(1, -1).trim();
    let res = '';
    const step = /^feff/i.test(hex) ? 4 : 2;
    for (let i = step === 4 ? 4 : 0; i < hex.length; i += step) {
      res += String.fromCharCode(parseInt(hex.substr(i, step), 16));
    }
    return res;
  }
  let s = raw.replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
  s = s.replace(/\\[nrtbf()\\]/g, (m) => ({
    '\\n': '\n', '\\r': '\r', '\\t': '\t', '\\b': '\b', '\\f': '\f',
    '\\(': '(', '\\)': ')', '\\\\': '\\'
  })[m] || m);
  if (s.startsWith('\xfe\xff')) {
    let res = '';
    for (let i = 2; i < s.length; i += 2) {
      res += String.fromCharCode((s.charCodeAt(i) << 8) | s.charCodeAt(i + 1));
    }
    return res;
  }
  return s;
}

// Detecta automaticamente a Cidade / RA a partir do conteúdo interno, metadados do PDF e prefixos de hidrantes
function detectRAFromPdfContent(rawPdfStrOrBase64, fileName = '') {
  let rawPdfStr = '';
  if (rawPdfStrOrBase64) {
    if (typeof rawPdfStrOrBase64 === 'string' && rawPdfStrOrBase64.startsWith('JVBERi')) {
      try {
        rawPdfStr = atob(rawPdfStrOrBase64.slice(0, 100000));
      } catch (e) {
        rawPdfStr = rawPdfStrOrBase64;
      }
    } else if (typeof rawPdfStrOrBase64 === 'string') {
      rawPdfStr = rawPdfStrOrBase64;
    }
  }

  const candidates = [];

  if (rawPdfStr) {
    // 1. Extração de /Title (...) ou /Title <...> no dicionário do PDF (gerado automaticamente pelo Netuno/jsPDF)
    const titleMatch = rawPdfStr.match(/\/Title\s*(?:\(([^)]+)\)|<([0-9a-fA-F]+)>)/i);
    if (titleMatch) {
      const titleStr = decodePdfString(titleMatch[1] ? titleMatch[1] : ('<' + titleMatch[2] + '>'));
      candidates.push(titleStr);
    }

    // 2. Extração de /Subject (...) ou /Subject <...>
    const subjMatch = rawPdfStr.match(/\/Subject\s*(?:\(([^)]+)\)|<([0-9a-fA-F]+)>)/i);
    if (subjMatch) {
      candidates.push(decodePdfString(subjMatch[1] ? subjMatch[1] : ('<' + subjMatch[2] + '>')));
    }

    // 3. Extração de tags 'Relatorio...CAESB...' nos primeiros 50k caracteres
    const relMatch = rawPdfStr.slice(0, 50000).match(/Relatorio[a-zA-Z0-9_]*CAESB[a-zA-Z0-9_]*/gi);
    if (relMatch) {
      candidates.push(...relMatch);
    }

    // 4. Reconhecimento por prefixos de hidrantes no documento (ex: CRU00033, ARN00010)
    const hydrantMatches = rawPdfStr.slice(0, 80000).match(/\b([A-Z]{3})\d{4,5}\b/g);
    if (hydrantMatches && hydrantMatches.length > 0) {
      const counts = {};
      for (const h of hydrantMatches) {
        const pref = h.slice(0, 3);
        if (PREFIX_RA_MAP[pref]) {
          counts[pref] = (counts[pref] || 0) + 1;
        }
      }
      const sortedPrefs = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
      if (sortedPrefs.length > 0) {
        const bestRaName = PREFIX_RA_MAP[sortedPrefs[0]];
        const foundRa = RA_CATALOG.find(r => r.name === bestRaName);
        if (foundRa) {
          candidates.push(foundRa.name);
        }
      }
    }
  }

  if (fileName) {
    candidates.push(fileName);
  }

  const sortedRAs = [...RA_CATALOG].sort((a, b) => b.name.length - a.name.length);

  for (const text of candidates) {
    if (!text) continue;
    const clean = normalizeSearchStr(
      text
        .replace(/\.pdf$/i, '')
        .replace(/relatorio|alteracoes|caesb|hidrantes|vistoria|geral|cbmdf/gi, ' ')
        .replace(/\b20\d{2,6}\b/g, ' ')
        .replace(/ano/gi, ' ')
    );

    for (const ra of sortedRAs) {
      const raNorm = normalizeSearchStr(ra.name);
      if (raNorm && clean.includes(raNorm)) {
        return ra;
      }
    }

    if (clean.includes('arniqueiras')) return RA_CATALOG.find(r => r.name === 'Arniqueira');
    if (clean.includes('plano piloto')) return RA_CATALOG.find(r => r.name === 'Brasília');
    if (clean.includes('sol nascente') || clean.includes('por do sol')) return RA_CATALOG.find(r => r.name === 'Sol Nascente/Pôr do Sol');
    if (clean.includes('sudoeste') || clean.includes('octogonal')) return RA_CATALOG.find(r => r.name === 'Sudoeste e Octogonal');
  }

  // Fallback: varre o cabeçalho do PDF diretamente por qualquer menção textual aos nomes das RAs
  if (rawPdfStr) {
    const headChunk = normalizeSearchStr(rawPdfStr.slice(0, 50000));
    for (const ra of sortedRAs) {
      const raNorm = normalizeSearchStr(ra.name);
      if (raNorm && raNorm.length >= 4 && headChunk.includes(raNorm)) {
        return ra;
      }
    }
  }

  return null;
}

// Detecta automaticamente a Cidade/RA a partir do nome do arquivo PDF baixado no Netuno
function detectRAFromFilename(fileName) {
  return detectRAFromPdfContent('', fileName);
}

// Gera o texto oficial do Memorando + Minuta de Ofício para qualquer Cidade/RA selecionada (para cópia em área de transferência)
function generateSeiMemorandoMinutaText({ cidade, raRomano, ano = new Date().getFullYear(), numeroSeiRelatorio = '' }) {
  const nomeCidade = cidade || 'Distrito Federal';
  const romano = raRomano || getRARomanByName(nomeCidade);
  const raSufixo = romano ? ` (RA ${romano})` : '';
  const cidadeUpper = nomeCidade.toUpperCase();
  const docRef = numeroSeiRelatorio && String(numeroSeiRelatorio).trim() !== ''
    ? String(numeroSeiRelatorio).trim()
    : '[Nº SEI DO RELATÓRIO EXTERNO]';

  return `Para: Cel. QOBM/Comb. Comandante do Grupamento de Prevenção e Combate a Incêndio Urbano (GPCIU)
Assunto: Vistoria de Hidrantes em ${nomeCidade}${raSufixo ? ` ${raSufixo}` : ''}

Senhor(a) Comandante,

1.     Informo a Vossa Senhoria que esta Seção de Hidrantes Urbanos procedeu às devidas vistorias anuais em ${nomeCidade}${raSufixo ? ` ${raSufixo}` : ''}.
2.     Conforme registrado no Relatório de Vistoria da Fiscalização (${docRef}), constatou-se que os hidrantes encontram-se com alterações, apresentando avarias estruturais e demandando manutenção corretiva imediata por parte da CAESB conforme previsto no Acordo de Cooperação Técnica CAESB/CBMDF.
3.     Dessa forma, submeto o expediente à apreciação de Vossa Senhoria para conhecimento e posterior encaminhamento de ofício para o ambiente SEI [CAESB/DP] (minuta de ofício em anexo).


**** Anexo - Minuta de ofício ao ambiente CAESB/DP ****

Ao Senhor Diretor de Operações e Manutenção - Companhia de Saneamento Ambiental do Distrito Federal - CAESB
Assunto: Solicitação de Manutenção Corretiva em Hidrantes Urbanos de Incêndio - ${romano ? `RA ${romano} ` : ''}${cidadeUpper} - ${ano}.
Referência: Relatório de Vistoria da Fiscalização (${docRef})

Senhor Diretor,

Cumprimentando-o cordialmente, dirijo-me a Vossa Senhoria para solicitar a atenção dessa Companhia quanto à premente necessidade de manutenção corretiva e/ou substituição de aparelho na rede de hidrantes urbanos de incêndio instalados na Região Administrativa de ${nomeCidade}${raSufixo ? ` ${raSufixo}` : ''}.

Durante vistoria técnica, constatou-se que os hidrantes situados em ${nomeCidade}, encontram-se com avarias e necessidade de manutenção corretiva imediata.

A plena funcionalidade dos referidos dispositivos é indispensável para garantir o suprimento ininterrupto e célere de água às viaturas operacionais em caso de sinistros, sendo medida crucial para a salvaguarda de vidas e proteção ao patrimônio na localidade.

Dessa forma, solicito os valorosos préstimos dessa Companhia para a adoção das providências necessárias visando a regularização dos componentes. O Relatório de Vistoria da Fiscalização (${docRef}) segue com as informações pertinentes para subsidiar as equipes técnicas em campo.

Renovo, na oportunidade, os protestos de elevada estima e consideração institucional.

Atenciosamente,`;
}

// Gera as 4 seções editáveis oficiais do Editor SEI-GDF para o Memorando (Série 165) com as classes nativas do CKEditor SEI
function buildSeiMemorandoEditorSections({ cidade, raRomano, ano = new Date().getFullYear(), numeroSeiRelatorio = '' }) {
  const nomeCidade = cidade || 'Distrito Federal';
  const romano = raRomano || getRARomanByName(nomeCidade);
  const raSufixo = romano ? ` (RA ${romano})` : '';
  const cidadeUpper = nomeCidade.toUpperCase();
  const docRef = numeroSeiRelatorio && String(numeroSeiRelatorio).trim() !== ''
    ? String(numeroSeiRelatorio).trim()
    : '[Nº SEI DO RELATÓRIO EXTERNO]';

  // Seção txaEditor_15168 (title: "Destinatário")
  const destinatarioHtml = `<p class="I02_Justificado_12">Para: Cel. QOBM/Comb. Comandante do Grupamento de Prevenção e Combate a Incêndio Urbano (GPCIU)</p>\n`;

  // Seção txaEditor_15170 (title: "Assunto")
  const assuntoHtml = `<p class="I02_Justificado_12">Assunto: <strong>Vistoria de Hidrantes em ${nomeCidade}${raSufixo}</strong></p>\n`;

  // Seção txaEditor_15172 (title: "Corpo do Texto" - nota: I11_Paragrafo_Numerado_Nivel1 já numera 1., 2., 3. automaticamente via CSS counter)
  const corpoHtml = [
    `<p class="I02_Justificado_12">Senhor(a) Comandante,</p>`,
    `<p class="I02_Justificado_12">&nbsp;</p>`,
    `<p class="I11_Paragrafo_Numerado_Nivel1">Informo a Vossa Senhoria que esta Seção de Hidrantes Urbanos procedeu às devidas vistorias anuais em ${nomeCidade}${raSufixo}.</p>`,
    `<p class="I11_Paragrafo_Numerado_Nivel1">Conforme registrado no Relatório de Vistoria da Fiscalização (${docRef}), constatou-se que os hidrantes encontram-se com alterações, apresentando avarias estruturais e demandando manutenção corretiva imediata por parte da CAESB conforme previsto no Acordo de Cooperação Técnica CAESB/CBMDF.</p>`,
    `<p class="I11_Paragrafo_Numerado_Nivel1">Dessa forma, submeto o expediente à apreciação de Vossa Senhoria para conhecimento e posterior encaminhamento de ofício para o ambiente SEI [CAESB/DP] (minuta de ofício em anexo).</p>`,
    `<p class="I02_Justificado_12">&nbsp;</p>`,
    `<p class="I03_Centralizado_12"><strong>**** Anexo - Minuta de ofício ao ambiente CAESB/DP ****</strong></p>`,
    `<p class="I02_Justificado_12">&nbsp;</p>`,
    `<p class="I02_Justificado_12">Ao Senhor Diretor de Operações e Manutenção - Companhia de Saneamento Ambiental do Distrito Federal - CAESB</p>`,
    `<p class="I02_Justificado_12">Assunto: <strong>Solicitação de Manutenção Corretiva em Hidrantes Urbanos de Incêndio - ${romano ? `RA ${romano} ` : ''}${cidadeUpper} - ${ano}.</strong></p>`,
    `<p class="I02_Justificado_12">Referência: Relatório de Vistoria da Fiscalização (${docRef})</p>`,
    `<p class="I02_Justificado_12">&nbsp;</p>`,
    `<p class="I02_Justificado_12">Senhor Diretor,</p>`,
    `<p class="I01_Justificado_Recuo_Primeira_Linha">Cumprimentando-o cordialmente, dirijo-me a Vossa Senhoria para solicitar a atenção dessa Companhia quanto à premente necessidade de manutenção corretiva e/ou substituição de aparelho na rede de hidrantes urbanos de incêndio instalados na Região Administrativa de ${nomeCidade}${raSufixo}.</p>`,
    `<p class="I01_Justificado_Recuo_Primeira_Linha">Durante vistoria técnica, constatou-se que os hidrantes situados em ${nomeCidade}, encontram-se com avarias e necessidade de manutenção corretiva imediata.</p>`,
    `<p class="I01_Justificado_Recuo_Primeira_Linha">A plena funcionalidade dos referidos dispositivos é indispensável para garantir o suprimento ininterrupto e célere de água às viaturas operacionais em caso de sinistros, sendo medida crucial para a salvaguarda de vidas e proteção ao patrimônio na localidade.</p>`,
    `<p class="I01_Justificado_Recuo_Primeira_Linha">Dessa forma, solicito os valorosos préstimos dessa Companhia para a adoção das providências necessárias visando a regularização dos componentes. O Relatório de Vistoria da Fiscalização (${docRef}) segue com as informações pertinentes para subsidiar as equipes técnicas em campo.</p>`,
    `<p class="I01_Justificado_Recuo_Primeira_Linha">Renovo, na oportunidade, os protestos de elevada estima e consideração institucional.</p>`
  ].join('\n\n') + '\n';

  // Seção txaEditor_15174 (title: "Fecho")
  const fechoHtml = `<p class="I03_Centralizado_12">Atenciosamente,</p>\n`;

  return {
    destinatarioHtml,
    assuntoHtml,
    corpoHtml,
    fechoHtml
  };
}

// Converte string Base64 pura (ou DataURL) diretamente em Blob PDF sem depender de fetch()
function base64ToPdfBlob(base64Str) {
  const cleanBase64 = String(base64Str || '').replace(/^data:[^;]+;base64,/, '').trim();
  const byteCharacters = atob(cleanBase64);
  const byteArrays = [];
  const sliceSize = 8192;
  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(new Uint8Array(byteNumbers));
  }
  return new Blob(byteArrays, { type: 'application/pdf' });
}

// Formata tamanho de arquivo exatamente igual à função nativa infraFormatarTamanhoBytes do SEI
function formatSeiFileSize(bytes) {
  const b = Number(bytes) || 0;
  if (b >= 1048576) return (b / 1048576).toFixed(2) + ' Mb';
  if (b >= 1024) return (b / 1024).toFixed(2) + ' Kb';
  return b + ' bytes';
}

// Armazena logs de execução para diagnóstico e cópia rápida
const executionLogs = [];

function logAutomation(message, data = null) {
  const timestamp = new Date().toLocaleTimeString('pt-BR');
  const line = `[${timestamp}] ${message}` + (data ? ` | ${typeof data === 'object' ? JSON.stringify(data) : data}` : '');
  console.log('[Netuno SEI]', line);
  executionLogs.push(line);
  if (executionLogs.length > 90) executionLogs.shift();
}

function getErrorLogSummary(error) {
  const lines = [
    `=== RELATÓRIO DE DIAGNÓSTICO NETUNO SEI ===`,
    `Data/Hora: ${new Date().toLocaleString('pt-BR')}`,
    `URL Atual: ${window.location.href}`,
    `Unidade SEI: ${getInfraUnidade()} | Sistema: ${getInfraSistema()}`,
    `Erro Detectado: ${error?.message || error}`,
    `Stack: ${error?.stack || 'Sem stack disponível'}`,
    `-------------------------------------------`,
    `Histórico Recente de Passos:`,
    ...executionLogs.slice(-30),
    `===========================================`
  ];
  return lines.join('\n');
}

function getInfraUnidade() {
  const inputUnidade = document.querySelector('input[name="infra_unidade_atual"], input#infra_unidade_atual');
  if (inputUnidade && inputUnidade.value) return inputUnidade.value;

  const urlMatch = window.location.href.match(/infra_unidade_atual=(\d+)/i);
  if (urlMatch) return urlMatch[1];

  const htmlMatch = document.documentElement.innerHTML.match(/infra_unidade_atual=(\d+)/i);
  return htmlMatch ? htmlMatch[1] : '110037654'; // Fallback SUOMA
}

function getInfraSistema() {
  const urlMatch = window.location.href.match(/infra_sistema=(\d+)/i);
  return urlMatch ? urlMatch[1] : '100000100';
}

// Widget flutuante discreto (sempre disfarçado no canto) com alternância Minimizada / Expandida
let floatingWidgetContainer = null;
let isWidgetExpanded = false;
let activePackage = null;

function setWidgetExpandedState(expand) {
  isWidgetExpanded = expand !== undefined ? expand : !isWidgetExpanded;
  const cardBody = document.getElementById('netuno-sei-card-body');
  const pillBtn = document.getElementById('netuno-sei-pill-btn');
  if (!cardBody || !pillBtn) return;

  if (isWidgetExpanded) {
    cardBody.style.display = 'block';
    pillBtn.style.display = 'none';
  } else {
    cardBody.style.display = 'none';
    pillBtn.style.display = 'flex';
  }
}

function saveActivePackageToStorage(pkg) {
  activePackage = pkg;
  if (chrome.storage?.local && pkg && pkg.pdfBase64) {
    chrome.storage.local.set({
      netuno_sei_package: pkg
    });
  }
}

function clearCurrentLoadedFile() {
  activePackage = null;
  const inputPdf = document.getElementById('input-netuno-pdf');
  if (inputPdf) inputPdf.value = '';
  if (chrome.storage?.local) {
    chrome.storage.local.remove(['netuno_sei_package', 'netuno_sei_last_package']);
  }
  updateWidgetPackageUI(null);
}

function highlightUploadBox() {
  const uploadBox = document.getElementById('netuno-upload-box');
  if (uploadBox) {
    uploadBox.style.transition = 'all 0.3s ease';
    uploadBox.style.borderColor = '#f59e0b';
    uploadBox.style.boxShadow = '0 0 16px rgba(245, 158, 11, 0.7)';
    setTimeout(() => {
      uploadBox.style.borderColor = '#10b981';
      uploadBox.style.boxShadow = 'none';
    }, 2500);
  }
}

function updateWidgetPackageUI(pkg) {
  if (pkg !== undefined) activePackage = pkg;

  const selectRa = document.getElementById('select-netuno-ra');
  const selectDestino = document.getElementById('select-netuno-destino');
  const fileInfoEl = document.getElementById('netuno-file-info');
  const pillBadgeEl = document.getElementById('netuno-pill-badge');
  const runBtn = document.getElementById('btn-netuno-run');

  if (selectRa) {
    if (activePackage?.cidade) {
      const matchedRa = RA_CATALOG.find(r => normalizeSearchStr(r.name) === normalizeSearchStr(activePackage.cidade));
      if (matchedRa) {
        selectRa.value = matchedRa.name;
      }
    } else if (!activePackage?.pdfBase64) {
      selectRa.value = '';
    }
  }

  if (selectDestino && activePackage?.destinoId) {
    selectDestino.value = activePackage.destinoId;
  }

  if (fileInfoEl) {
    if (activePackage?.pdfBase64) {
      const fName = activePackage.fileName || `Relatorio_alteracoes_CAESB_${(activePackage.cidade || 'DF').replace(/\s+/g, '_')}.pdf`;
      const sizeTxt = activePackage.fileSize ? ` (${formatSeiFileSize(activePackage.fileSize)})` : '';
      const cidadeBadge = activePackage.cidade ? `<div style="margin-top: 5px; color: #34d399; font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 4px;"><span>🔒 Cidade no PDF:</span> <strong>${activePackage.cidade} ${activePackage.raRomano ? `(RA ${activePackage.raRomano})` : ''}</strong></div>` : '';
      fileInfoEl.innerHTML = `<span style="color: #34d399; font-weight: 600;">📄 ${fName}${sizeTxt}</span>${cidadeBadge}`;
    } else {
      fileInfoEl.innerHTML = `<span style="color: #fbbf24;">⚠️ Selecione abaixo o PDF do Relatório CAESB baixado no Netuno</span>`;
    }
  }

  if (pillBadgeEl) {
    if (activePackage?.pdfBase64 && activePackage?.cidade) {
      pillBadgeEl.textContent = activePackage.cidade;
    } else {
      pillBadgeEl.textContent = 'SEI';
    }
  }

  if (runBtn && !runBtn.dataset.running) {
    runBtn.disabled = false;
    runBtn.style.opacity = '1';
  }
}

function renderFloatingCard(pkg) {
  if (window !== window.top) return; // Evita duplicar dentro dos iframes internos do SEI
  if (pkg && pkg.pdfBase64) activePackage = pkg;

  const existingRoot = document.getElementById('netuno-sei-widget-root');
  let restoreExpanded = false;
  if (existingRoot) {
    if (floatingWidgetContainer === existingRoot) {
      updateWidgetPackageUI(activePackage);
      return;
    }
    // Se o elemento no DOM pertencia a um script antigo (ex: extensão recarregada), substitui mantendo o estado aberto/fechado
    restoreExpanded = document.getElementById('netuno-sei-card-body')?.style.display === 'block';
    existingRoot.remove();
  }

  floatingWidgetContainer = document.createElement('div');
  floatingWidgetContainer.id = 'netuno-sei-widget-root';
  floatingWidgetContainer.style.cssText = `
    position: fixed;
    bottom: 16px;
    right: 16px;
    z-index: 9999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  const currentCity = activePackage?.cidade || '';
  const currentDestinoId = activePackage?.destinoId || '110037655';

  const placeholderOption = `<option value="" ${!currentCity ? 'selected' : ''}>— Detectada automaticamente pelo PDF —</option>`;
  const raOptionsHtml = placeholderOption + RA_CATALOG.map(ra => {
    const sel = currentCity && normalizeSearchStr(ra.name) === normalizeSearchStr(currentCity) ? 'selected' : '';
    return `<option value="${ra.name}" ${sel}>${ra.name} (RA ${ra.roman})</option>`;
  }).join('');

  const destinoOptionsHtml = DESTINO_UNIDADES.map(u => {
    const sel = u.id === currentDestinoId ? 'selected' : '';
    return `<option value="${u.id}" ${sel}>${u.descricao}</option>`;
  }).join('');

  floatingWidgetContainer.innerHTML = `
    <!-- BOTÃOZINHO SEMPRE DISFARÇADO NO CANTO (Fica discreto e nunca desaparece ao fechar) -->
    <div id="netuno-sei-pill-btn" title="Clique para abrir o Netuno SEI ou no ▶ para dar Play direto" style="display: flex; align-items: center; gap: 6px; background: rgba(6, 78, 59, 0.85); backdrop-filter: blur(6px); color: #ecfdf5; border: 1px solid rgba(16, 185, 129, 0.55); border-radius: 9999px; padding: 5px 8px 5px 11px; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.35); font-size: 11.5px; font-weight: 600; user-select: none; opacity: 0.45; transition: opacity 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;">
      <div id="netuno-pill-open-area" style="display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 13px;">🚒</span>
        <span>Netuno</span>
        <span id="netuno-pill-badge" style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.18); padding: 1px 6px; border-radius: 999px; font-size: 9.5px; color: #a7f3d0; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${activePackage?.cidade || 'SEI'}</span>
      </div>
      <button id="netuno-pill-quick-play" title="Dar Play agora (Autuar Processo no SEI)" style="background: #10b981; color: #022c22; border: none; border-radius: 999px; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; cursor: pointer; margin-left: 2px; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">▶</button>
    </div>

    <!-- PAINEL COMPLETO EXPANSÍVEL -->
    <div id="netuno-sei-card-body" style="display: none; width: 390px; background: #0f172a; color: #f8fafc; border: 2px solid #059669; border-radius: 14px; padding: 15px; box-shadow: 0 15px 35px rgba(0,0,0,0.75); font-size: 12.5px; line-height: 1.4; margin-bottom: 8px;">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #334155; padding-bottom: 8px; margin-bottom: 10px;">
        <div style="font-weight: bold; font-size: 14px; color: #34d399; display: flex; align-items: center; gap: 6px;">
          🚒 Netuno SEI • Autuação CAESB
        </div>
        <div style="display: flex; align-items: center; gap: 5px;">
          <button id="btn-netuno-minimize" title="Recolher para botãozinho disfarçado" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 16px; padding: 2px 6px;">_</button>
          <button id="btn-netuno-close" title="Fechar painel (mantém botãozinho disfarçado no canto)" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 14px; padding: 2px 6px;">✖</button>
        </div>
      </div>

      <!-- 1. UPLOAD DO PDF DA CAESB -->
      <div id="netuno-upload-box" style="background: #1e293b; border: 1px dashed #10b981; border-radius: 10px; padding: 10px; margin-bottom: 10px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
          <span style="color: #94a3b8; font-size: 10.5px; text-transform: uppercase; font-weight: 700;">1. Arquivo PDF do Relatório CAESB:</span>
          <label for="input-netuno-pdf" style="background: #059669; color: white; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
            📂 Subir PDF
          </label>
          <input type="file" id="input-netuno-pdf" accept=".pdf,application/pdf" style="display: none;" />
        </div>
        <div id="netuno-file-info" style="font-size: 11.5px; word-break: break-all;">
          <span style="color: #fbbf24;">⚠️ Selecione o PDF do Relatório CAESB baixado no Netuno</span>
        </div>
      </div>

      <!-- 2. SELEÇÃO DA CIDADE / RA E DESTINO -->
      <div style="display: grid; grid-template-columns: 1fr; gap: 8px; margin-bottom: 10px;">
        <div>
          <label style="display: block; color: #94a3b8; font-size: 10.5px; text-transform: uppercase; font-weight: 700; margin-bottom: 3px;">
            2. Cidade / Região Administrativa (Detectada ou Manual):
          </label>
          <select id="select-netuno-ra" style="width: 100%; background: #1e293b; color: #f8fafc; border: 1px solid #475569; border-radius: 7px; padding: 6px 8px; font-size: 12px; font-weight: 600; outline: none;">
            ${raOptionsHtml}
          </select>
        </div>

        <div>
          <label style="display: block; color: #94a3b8; font-size: 10.5px; text-transform: uppercase; font-weight: 700; margin-bottom: 3px;">
            3. Unidade de Destino para Tramitação:
          </label>
          <select id="select-netuno-destino" style="width: 100%; background: #1e293b; color: #38bdf8; border: 1px solid #475569; border-radius: 7px; padding: 6px 8px; font-size: 11.5px; font-weight: 600; outline: none;">
            ${destinoOptionsHtml}
          </select>
        </div>
      </div>

      <!-- STATUS AREA -->
      <div id="netuno-status-area" style="background: #1e293b; padding: 10px; border-radius: 8px; margin-bottom: 10px; font-size: 11.5px; border: 1px solid #334155; min-height: 46px; max-height: 200px; overflow-y: auto;">
        <div style="color: #cbd5e1;">Suba o PDF do relatório CAESB acima (a cidade é reconhecida automaticamente pelo arquivo ou pelo seletor) e clique em <strong>Dar Play</strong>.</div>
      </div>

      <!-- Área de Erro com Botão de Cópia -->
      <div id="netuno-error-box" style="display: none; background: #450a0a; border: 1px solid #b91c1c; border-radius: 8px; padding: 10px; margin-bottom: 10px; font-size: 11px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <span style="color: #fca5a5; font-weight: bold;">⚠️ Detalhes do Erro para Diagnóstico:</span>
          <button id="btn-netuno-copy-error" style="background: #7f1d1d; color: #fee2e2; border: 1px solid #ef4444; border-radius: 4px; padding: 3px 8px; cursor: pointer; font-size: 10px; font-weight: bold; display: flex; align-items: center; gap: 4px;">
            📋 Copiar Log
          </button>
        </div>
        <pre id="netuno-error-pre" style="color: #fecaca; margin: 0; font-family: monospace; font-size: 10px; white-space: pre-wrap; word-break: break-all; max-height: 110px; overflow-y: auto; background: rgba(0,0,0,0.3); padding: 6px; border-radius: 4px;"></pre>
      </div>

      <div style="display: flex; gap: 8px;">
        <button id="btn-netuno-run" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #059669, #0d9488); border: none; border-radius: 8px; color: white; font-weight: bold; cursor: pointer; font-size: 12.5px; box-shadow: 0 4px 12px rgba(5,150,105,0.4); display: flex; align-items: center; justify-content: center; gap: 6px;">
          ▶️ Dar Play • Gerar Processo no SEI
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(floatingWidgetContainer);

  const pillBtn = document.getElementById('netuno-sei-pill-btn');
  const pillOpenArea = document.getElementById('netuno-pill-open-area');
  const pillQuickPlay = document.getElementById('netuno-pill-quick-play');
  const btnMinimize = document.getElementById('btn-netuno-minimize');
  const btnClose = document.getElementById('btn-netuno-close');
  const inputPdf = document.getElementById('input-netuno-pdf');
  const selectRa = document.getElementById('select-netuno-ra');
  const selectDestino = document.getElementById('select-netuno-destino');
  const btnRun = document.getElementById('btn-netuno-run');
  const btnCopyError = document.getElementById('btn-netuno-copy-error');

  // Efeito disfarçado: semi-transparente em repouso, 100% visível ao passar o mouse
  pillBtn.addEventListener('mouseenter', () => {
    pillBtn.style.opacity = '1';
    pillBtn.style.transform = 'scale(1.03)';
  });
  pillBtn.addEventListener('mouseleave', () => {
    pillBtn.style.opacity = '0.45';
    pillBtn.style.transform = 'scale(1)';
  });

  pillOpenArea.onclick = (e) => {
    e.stopPropagation();
    setWidgetExpandedState(true);
  };

  pillBtn.onclick = () => setWidgetExpandedState(true);

  pillQuickPlay.onclick = (e) => {
    e.stopPropagation();
    setWidgetExpandedState(true);
    triggerPlayWithSync();
  };

  btnMinimize.onclick = () => setWidgetExpandedState(false);
  btnClose.onclick = () => setWidgetExpandedState(false);

  // Ao subir um arquivo PDF manualmente na extensão
  inputPdf.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;

      // Detecta a RA a partir do conteúdo interno / metadados do PDF (e nome do arquivo)
      const detectedRa = detectRAFromPdfContent(base64, file.name);
      const chosenCity = detectedRa ? detectedRa.name : (selectRa.value || 'Brasília');
      const chosenRoman = detectedRa ? detectedRa.roman : getRARomanByName(chosenCity);
      if (detectedRa) {
        selectRa.value = detectedRa.name;
      }

      const newPkg = {
        ...(activePackage || {}),
        tipo: 'caesb',
        cidade: chosenCity,
        raRomano: chosenRoman,
        fileName: file.name,
        fileSize: file.size,
        pdfBase64: base64,
        destinoId: selectDestino.value || '110037655',
        memorandoMinuta: generateSeiMemorandoMinutaText({ cidade: chosenCity, raRomano: chosenRoman }),
        dataCriacao: new Date().toISOString(),
        uploadedAt: Date.now(),
        consumed: false
      };

      inputPdf.value = '';
      saveActivePackageToStorage(newPkg);
      updateWidgetPackageUI(newPkg);
      updateStatus(`✅ Arquivo "${file.name}" carregado! Cidade identificada: ${chosenCity} (RA ${chosenRoman}). Clique em Dar Play.`, '#34d399');
    };
    reader.readAsDataURL(file);
  });

  // Ao trocar a Cidade / RA manualmente no seletor
  selectRa.addEventListener('change', () => {
    const chosenCity = selectRa.value;
    if (!chosenCity) return;
    const chosenRoman = getRARomanByName(chosenCity);
    const updatedPkg = {
      ...(activePackage || {}),
      cidade: chosenCity,
      raRomano: chosenRoman,
      destinoId: selectDestino.value || '110037655',
      memorandoMinuta: generateSeiMemorandoMinutaText({ cidade: chosenCity, raRomano: chosenRoman })
    };
    saveActivePackageToStorage(updatedPkg);
    updateWidgetPackageUI(updatedPkg);
  });

  // Ao trocar a Unidade de Destino
  selectDestino.addEventListener('change', () => {
    const updatedPkg = {
      ...(activePackage || {}),
      destinoId: selectDestino.value
    };
    saveActivePackageToStorage(updatedPkg);
  });

  btnCopyError.onclick = () => {
    const errorText = document.getElementById('netuno-error-pre').innerText;
    navigator.clipboard.writeText(errorText).then(() => {
      btnCopyError.innerText = '✅ Copiado!';
      setTimeout(() => {
        btnCopyError.innerHTML = '📋 Copiar Log';
      }, 2500);
    });
  };

  btnRun.onclick = () => {
    triggerPlayWithSync();
  };

  updateWidgetPackageUI(activePackage);
  if (restoreExpanded) {
    setWidgetExpandedState(true);
  }
}

function executePlayWithLoadedPackage() {
  const selectRa = document.getElementById('select-netuno-ra');
  const selectDestino = document.getElementById('select-netuno-destino');
  const chosenDestinoId = selectDestino?.value || activePackage?.destinoId || '110037655';

  const finalCity = activePackage.cidade || selectRa?.value || 'Brasília';
  const finalRoman = activePackage.raRomano || getRARomanByName(finalCity);
  activePackage.cidade = finalCity;
  activePackage.raRomano = finalRoman;
  activePackage.destinoId = chosenDestinoId;
  activePackage.memorandoMinuta = generateSeiMemorandoMinutaText({ cidade: finalCity, raRomano: finalRoman });
  saveActivePackageToStorage(activePackage);
  updateWidgetPackageUI(activePackage);
  executeFullAutomation(activePackage);
}

function triggerPlayWithSync() {
  if (activePackage && activePackage.pdfBase64) {
    executePlayWithLoadedPackage();
    return;
  }

  // Verifica se o PDF recém-carregado está salvo no storage local (ex: subido pelo popup ou antes de navegação de página)
  if (chrome.storage?.local) {
    chrome.storage.local.get(['netuno_sei_package'], (res) => {
      const stored = res?.netuno_sei_package;
      if (stored && stored.pdfBase64 && !stored.consumed) {
        activePackage = stored;
        executePlayWithLoadedPackage();
      } else {
        setWidgetExpandedState(true);
        updateStatus('⚠️ Nenhum relatório PDF carregado! Por favor, clique em "📂 Subir PDF" acima e selecione o relatório da CAESB antes de dar Play.', '#fbbf24');
        highlightUploadBox();
      }
    });
    return;
  }

  setWidgetExpandedState(true);
  updateStatus('⚠️ Nenhum relatório PDF carregado! Por favor, clique em "📂 Subir PDF" acima e selecione o relatório da CAESB antes de dar Play.', '#fbbf24');
  highlightUploadBox();
}

function updateStatus(stepText, color = '#38bdf8') {
  logAutomation(stepText);
  const area = document.getElementById('netuno-status-area');
  if (area) {
    area.innerHTML = `<div style="color: ${color}; font-weight: 500;">${stepText}</div>`;
  }
}

function displayAutomationError(err) {
  const fullLog = getErrorLogSummary(err);
  logAutomation('ERRO CRÍTICO: ' + (err?.message || err));
  
  const statusArea = document.getElementById('netuno-status-area');
  if (statusArea) {
    statusArea.innerHTML = `<div style="color: #f43f5e; font-weight: bold;">❌ Falha: ${err.message || err}</div>`;
  }

  const errBox = document.getElementById('netuno-error-box');
  const errPre = document.getElementById('netuno-error-pre');
  if (errBox && errPre) {
    errPre.innerText = fullLog;
    errBox.style.display = 'block';
  }

  setWidgetExpandedState(true);
}

// Resolve qualquer URL relativa do SEI garantindo o caminho canônico /sei/ e protocolo HTTPS
function resolveSeiUrl(relativeOrAbsoluteUrl, fallbackBase = window.location.href) {
  if (!relativeOrAbsoluteUrl) return '';
  let str = String(relativeOrAbsoluteUrl).trim().replace(/&amp;/g, '&');

  if (str.startsWith('http://sei.df.gov.br')) {
    str = str.replace('http://sei.df.gov.br', 'https://sei.df.gov.br');
  }

  if (/^javascript:/i.test(str) || /infraAbrirJanela|infraNavegar|iniciarEditor/i.test(str)) {
    const matchEmbedded = str.match(/controlador\.php\?[^'"]+/i);
    if (matchEmbedded) {
      str = matchEmbedded[0];
    } else {
      return '';
    }
  }

  if (str === '#' || str.startsWith('#')) return '';

  if (str.startsWith('http://') || str.startsWith('https://')) {
    if (str.includes('sei.df.gov.br/controlador.php')) {
      str = str.replace('sei.df.gov.br/controlador.php', 'sei.df.gov.br/sei/controlador.php');
    }
    return str;
  }
  
  let base = fallbackBase || window.location.href;
  if (!base || !base.includes('/sei/')) {
    base = `${window.location.origin}/sei/controlador.php`;
  }
  if (base.startsWith('http://sei.df.gov.br')) {
    base = base.replace('http://sei.df.gov.br', 'https://sei.df.gov.br');
  }
  
  try {
    let resolved = new URL(str, base).toString();
    if (resolved.startsWith('javascript:')) return '';
    if (resolved.startsWith('http://sei.df.gov.br')) {
      resolved = resolved.replace('http://sei.df.gov.br', 'https://sei.df.gov.br');
    }
    if (resolved.includes('sei.df.gov.br/controlador.php')) {
      resolved = resolved.replace('sei.df.gov.br/controlador.php', 'sei.df.gov.br/sei/controlador.php');
    }
    return resolved;
  } catch (e) {
    return '';
  }
}

function extractCleanLinkUrl(el, fallbackBase) {
  if (!el) return '';

  const href = el.getAttribute('href') || '';
  if (href && !href.startsWith('#') && !/^javascript:(void\(0\)|;?)$/i.test(href.trim())) {
    const resolvedHref = resolveSeiUrl(href, fallbackBase);
    if (resolvedHref && (resolvedHref.startsWith('http://') || resolvedHref.startsWith('https://'))) {
      return resolvedHref;
    }
  }

  const onclick = el.getAttribute('onclick') || '';
  if (onclick) {
    const matchOnclick = onclick.match(/controlador\.php\?[^'"]+/i);
    if (matchOnclick) {
      const resolvedOnclick = resolveSeiUrl(matchOnclick[0], fallbackBase);
      if (resolvedOnclick && (resolvedOnclick.startsWith('http://') || resolvedOnclick.startsWith('https://'))) {
        return resolvedOnclick;
      }
    }
  }

  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i];
    if (attr.name !== 'href' && attr.name !== 'onclick' && /controlador\.php\?/i.test(attr.value)) {
      const m = attr.value.match(/controlador\.php\?[^'"]+/i);
      if (m) {
        const res = resolveSeiUrl(m[0], fallbackBase);
        if (res && (res.startsWith('http://') || res.startsWith('https://'))) return res;
      }
    }
  }

  return '';
}

// Serializa um formulário HTML do SEI exatamente como o navegador faz (ignorando checkboxes/radios desmarcados e botões)
function serializeSeiForm(form) {
  const params = new URLSearchParams();
  if (!form) return params;

  const elements = form.querySelectorAll('input, select, textarea');
  elements.forEach(el => {
    const name = el.getAttribute('name');
    if (!name) return;

    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();

    if (type === 'file' || type === 'button' || type === 'submit' || type === 'reset' || type === 'image') {
      return;
    }
    if ((type === 'checkbox' || type === 'radio') && !el.checked) {
      return;
    }

    if (tag === 'select') {
      if (el.multiple) {
        Array.from(el.selectedOptions || []).forEach(opt => {
          if (opt.value !== undefined && opt.value !== '') {
            params.append(name, opt.value);
          }
        });
      } else {
        params.set(name, el.value !== undefined && el.value !== '' ? el.value : 'null');
      }
    } else {
      params.set(name, el.value || '');
    }
  });

  return params;
}

// Wrapper seguro para fetch com detecção de redirecionamento de segurança do SEI (Hash inválido / Sessão expirada)
async function safeFetch(url, options = {}, contextDescription = '') {
  if (!url || typeof url !== 'string') {
    throw new Error(`Falha de navegação SEI: URL nula ou inválida (${contextDescription || 'sem contexto'}).`);
  }
  let cleanUrl = url.trim().replace(/&amp;/g, '&');
  if (cleanUrl.startsWith('http://sei.df.gov.br')) {
    cleanUrl = cleanUrl.replace('http://sei.df.gov.br', 'https://sei.df.gov.br');
  }
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    throw new Error(`Protocolo incompatível para fetch (${contextDescription || 'SEI'}): "${cleanUrl.slice(0, 80)}".`);
  }

  logAutomation(`[FETCH] ${contextDescription ? contextDescription + ' -> ' : ''}${cleanUrl.length > 130 ? cleanUrl.slice(0, 130) + '...' : cleanUrl}`);

  try {
    const res = await fetch(cleanUrl, {
      ...options,
      credentials: 'include'
    });
    if (res.url && res.url.includes('sip/login.php')) {
      throw new Error(`O SEI rejeitou a requisição (${contextDescription}) por Hash Inválido ou Sessão Expirada: ${res.url}`);
    }
    return res;
  } catch (errDirect) {
    if (options.body instanceof FormData) {
      logAutomation(`[FETCH] Erro no upload de arquivo (${contextDescription}): ${errDirect?.message}`);
      throw errDirect;
    }

    logAutomation(`[FETCH] Falha direta (${errDirect.message}). Acionando proxy via Service Worker para ${contextDescription || 'SEI'}...`);

    return new Promise((resolve, reject) => {
      if (!chrome.runtime || !chrome.runtime.sendMessage) {
        return reject(errDirect);
      }

      let serializedBody = null;
      if (options.body) {
        serializedBody = typeof options.body === 'string' ? options.body : options.body.toString();
      }

      chrome.runtime.sendMessage({
        action: 'netuno_bg_fetch',
        url: cleanUrl,
        method: options.method || 'GET',
        headers: options.headers || {},
        body: serializedBody
      }, response => {
        if (chrome.runtime.lastError) {
          return reject(new Error(`Erro no Service Worker: ${chrome.runtime.lastError.message}`));
        }
        if (!response || !response.success) {
          return reject(new Error(`Falha no proxy background: ${response?.error || 'Sem resposta'}`));
        }

        const data = response.data;
        if (data.url && data.url.includes('sip/login.php')) {
          return reject(new Error(`Sessão ou Hash SEI inválido em "${contextDescription}". Atualize a página do SEI (F5) e tente novamente.`));
        }

        const mockResponse = {
          ok: data.ok,
          status: data.status,
          statusText: data.statusText,
          url: data.url,
          text: async () => data.text,
          json: async () => JSON.parse(data.text),
          blob: async () => new Blob([data.text])
        };
        resolve(mockResponse);
      });
    });
  }
}

// Codifica strings compatíveis com ISO-8859-1 (Latin-1) nativo do SEI DF
function encodeIso88591Url(str) {
  if (str === null || str === undefined) return '';
  // Normaliza travessões e aspas curvas Unicode para equivalentes ASCII/Latin-1 puros
  const s = String(str)
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
  let res = '';
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (
      (code >= 0x41 && code <= 0x5a) || // A-Z
      (code >= 0x61 && code <= 0x7a) || // a-z
      (code >= 0x30 && code <= 0x39) || // 0-9
      code === 0x2d || code === 0x5f || code === 0x2e || code === 0x7e // - _ . ~
    ) {
      res += s[i];
    } else if (code === 0x20) {
      res += '+';
    } else if (code <= 0xff) {
      res += '%' + code.toString(16).toUpperCase().padStart(2, '0');
    } else {
      res += encodeURIComponent(s[i]);
    }
  }
  return res;
}

function encodeSeiFormParams(params) {
  const parts = [];
  const entries = params instanceof URLSearchParams ? params.entries() : Object.entries(params);
  for (const [key, value] of entries) {
    const k = encodeIso88591Url(key);
    const v = encodeIso88591Url(value);
    parts.push(`${k}=${v}`);
  }
  return parts.join('&');
}

function getSeiWorkForm(doc, specificSelector = '') {
  if (!doc) return null;
  if (specificSelector) {
    const el = doc.querySelector(specificSelector);
    if (el) return el;
  }
  const forms = Array.from(doc.querySelectorAll('form'));
  return forms.find(f => {
    const id = (f.id || '').toLowerCase();
    const action = (f.getAttribute('action') || '').toLowerCase();
    return id !== 'frmprotocolopesquisarapida' && !action.includes('pesquisa_rapida');
  }) || null;
}

function extractSeiErrorMessage(htmlOrDoc) {
  if (!htmlOrDoc) return null;
  const doc = typeof htmlOrDoc === 'string' ? new DOMParser().parseFromString(htmlOrDoc, 'text/html') : htmlOrDoc;
  const msgDiv = doc.querySelector('#divInfraExcecao, .infraExcecao, #divInfraMensagens, .infraMensagem, .alert-danger, .infraDivMensagem, #infraMensagem');
  if (msgDiv && msgDiv.textContent.trim()) {
    return msgDiv.textContent.trim().replace(/\s+/g, ' ');
  }
  const text = typeof htmlOrDoc === 'string' ? htmlOrDoc : doc.documentElement.innerHTML;
  const alertMatch = text.match(/alert\s*\(\s*["']([^"']+)["']\s*\)/i);
  if (alertMatch) return alertMatch[1].replace(/\\n/g, ' ').trim();
  return null;
}

// Seleciona um tipo de documento (ex: -1 para Externo, 165 para Memorando) submetendo o form #frmDocumentoEscolherTipo exatamente como no Gabarito SEI 4.1.5
async function selecionarSerieDocumentoSei(urlEscolherDoc, idSerieDesejada, descricaoLog) {
  const resPageEscolher = await safeFetch(urlEscolherDoc, {}, `Catálogo Documentos (${descricaoLog})`);
  let htmlEscolher = await resPageEscolher.text();
  let docEscolher = new DOMParser().parseFromString(htmlEscolher, 'text/html');
  let formEscolher = getSeiWorkForm(docEscolher, 'form#frmDocumentoEscolherTipo');

  if (!formEscolher) {
    throw new Error(`Formulário de escolha de documento (#frmDocumentoEscolherTipo) não encontrado para ${descricaoLog}.`);
  }

  let actionEscolher = resolveSeiUrl(formEscolher.getAttribute('action') || resPageEscolher.url || urlEscolherDoc, resPageEscolher.url || urlEscolherDoc);
  const hdnItensVal = formEscolher.querySelector('#hdnInfraItens, input[name="hdnInfraItens"]')?.value || '';
  const itensList = hdnItensVal.split(',').map(s => s.trim());

  // Se a série desejada (ex: 165) não estiver nos favoritos (hdnFiltroSerie=U), expande para Todos (hdnFiltroSerie=T) antes de selecionar
  if (idSerieDesejada !== '-1' && !itensList.includes(String(idSerieDesejada))) {
    logAutomation(`Série ${idSerieDesejada} não está na lista inicial; expandindo catálogo completo (hdnFiltroSerie=T)...`);
    const postExpandir = serializeSeiForm(formEscolher);
    postExpandir.set('hdnFiltroSerie', 'T');
    postExpandir.set('hdnIdSerie', '');

    const resExpandir = await safeFetch(actionEscolher, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=iso-8859-1' },
      body: encodeSeiFormParams(postExpandir)
    }, `Expandir Catálogo Documentos (${descricaoLog})`);

    htmlEscolher = await resExpandir.text();
    docEscolher = new DOMParser().parseFromString(htmlEscolher, 'text/html');
    formEscolher = getSeiWorkForm(docEscolher, 'form#frmDocumentoEscolherTipo');
    if (formEscolher) {
      actionEscolher = resolveSeiUrl(formEscolher.getAttribute('action') || resExpandir.url || actionEscolher, resExpandir.url || actionEscolher);
    }
  }

  const postEscolher = serializeSeiForm(formEscolher);
  postEscolher.set('hdnIdSerie', String(idSerieDesejada));

  logAutomation(`Submetendo escolha de série ${idSerieDesejada} (${descricaoLog}) via POST ->`, actionEscolher);
  const resFormularioDoc = await safeFetch(actionEscolher, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=iso-8859-1' },
    body: encodeSeiFormParams(postEscolher)
  }, `Abrir Formulário ${descricaoLog}`);

  const htmlFormularioDoc = await resFormularioDoc.text();
  const docFormularioDoc = new DOMParser().parseFromString(htmlFormularioDoc, 'text/html');
  const formCadastro = getSeiWorkForm(docFormularioDoc, 'form#frmDocumentoCadastro, form#frmDocumentoReceber, form#frmDocumentoGerar');

  if (!formCadastro) {
    const msgErro = extractSeiErrorMessage(htmlFormularioDoc);
    throw new Error(msgErro || `Não foi possível abrir o formulário de cadastro para ${descricaoLog} (Série ${idSerieDesejada}).`);
  }

  return {
    resFormularioDoc,
    htmlFormularioDoc,
    docFormularioDoc,
    formCadastro,
    urlFormularioDoc: resFormularioDoc.url || actionEscolher
  };
}

// Obtém o formulário oficial de geração de processo no SEI DF (Gabarito Entry 0 -> 79 -> 81)
async function obterFormularioGerarProcesso() {
  let linkMenu = document.querySelector('a[link="procedimento_escolher_tipo"], a[href*="acao=procedimento_escolher_tipo"]');

  // Caso o usuário esteja numa tela interna sem o menu visível no DOM atual, busca na tela principal
  let urlMenuEscolher = linkMenu ? resolveSeiUrl(linkMenu.getAttribute('href'), window.location.href) : '';
  if (!urlMenuEscolher) {
    throw new Error('Link "Iniciar Processo" não encontrado no menu do SEI. Certifique-se de que está logado na tela principal do SEI.');
  }

  updateStatus('⏳ 1/4: Localizando catálogo de processos na unidade...', '#38bdf8');
  const resEscolher = await safeFetch(urlMenuEscolher, {}, 'Menu Iniciar Processo');
  const htmlEscolher = await resEscolher.text();
  let docEscolher = new DOMParser().parseFromString(htmlEscolher, 'text/html');

  let formEscolher = docEscolher.querySelector('form#frmProcedimentoEscolherTipo') || docEscolher.querySelector('form');
  if (!formEscolher) {
    throw new Error('Formulário de catálogo de processos (#frmProcedimentoEscolherTipo) não encontrado no SEI.');
  }

  function findTipoProcesso(doc) {
    const el446 = doc.querySelector('input[value="100000446"], a[onclick*="100000446"], tr[data-desc*="serviço operacional"], tr[data-desc*="servico operacional"]');
    if (el446) return { id: '100000446', nome: 'CBMDF - Serviço Operacional' };

    const rows = Array.from(doc.querySelectorAll('#tblTipoProcedimento tr, tr[data-desc], tr.infraTrClara, tr.infraTrEscura'));
    for (const r of rows) {
      const desc = (r.getAttribute('data-desc') || r.textContent || '').toLowerCase();
      if (desc.includes('serviço operacional') || desc.includes('servico operacional') || (desc.includes('cbmdf') && desc.includes('operacional'))) {
        const input = r.querySelector('input.infraCheckbox, input[type="checkbox"]');
        const onclick = r.querySelector('a[onclick*="escolher"]')?.getAttribute('onclick') || '';
        const m = onclick.match(/escolher\((\d+)\)/);
        const id = input?.value || (m ? m[1] : null);
        if (id) return { id, nome: 'CBMDF - Serviço Operacional' };
      }
    }
    return null;
  }

  let tipoEncontrado = findTipoProcesso(docEscolher);

  if (!tipoEncontrado) {
    updateStatus('⏳ Carregando catálogo completo de tipos de processo do SEI...', '#38bdf8');
    const postTodos = serializeSeiForm(formEscolher);
    postTodos.set('hdnFiltroTipoProcedimento', 'T');
    postTodos.set('hdnIdTipoProcedimento', '');

    const actionUrl = resolveSeiUrl(formEscolher.getAttribute('action') || urlMenuEscolher, urlMenuEscolher);
    const resTodos = await safeFetch(actionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=iso-8859-1' },
      body: encodeSeiFormParams(postTodos)
    }, 'Expandir Tipos de Processo');
    const htmlTodos = await resTodos.text();
    const docTodos = new DOMParser().parseFromString(htmlTodos, 'text/html');

    tipoEncontrado = findTipoProcesso(docTodos);
    if (tipoEncontrado) {
      docEscolher = docTodos;
      formEscolher = getSeiWorkForm(docTodos, 'form#frmProcedimentoEscolherTipo');
    }
  }

  const idTipoProc = tipoEncontrado ? tipoEncontrado.id : '100000446';
  const nomeTipoProc = tipoEncontrado ? tipoEncontrado.nome : 'CBMDF - Serviço Operacional';

  updateStatus(`⏳ 1/4: Abrindo formulário para "${nomeTipoProc}"...`, '#38bdf8');

  // Serializa apenas os campos hidden (sem marcar checkboxes!), igual ao Entry 79 do Gabarito
  const postEscolher = serializeSeiForm(formEscolher);
  postEscolher.set('hdnIdTipoProcedimento', idTipoProc);
  postEscolher.set('hdnFiltroTipoProcedimento', formEscolher.querySelector('#hdnFiltroTipoProcedimento')?.value || 'U');

  const actionEscolher = resolveSeiUrl(formEscolher.getAttribute('action') || urlMenuEscolher, urlMenuEscolher);
  const resGerar = await safeFetch(actionEscolher, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=iso-8859-1' },
    body: encodeSeiFormParams(postEscolher)
  }, 'Selecionar Tipo de Processo');

  const htmlGerar = await resGerar.text();
  const docGerar = new DOMParser().parseFromString(htmlGerar, 'text/html');
  const formProc = getSeiWorkForm(docGerar, 'form#frmProcedimentoCadastro, form#frmProcedimentoGerar');

  if (!formProc) {
    const erroSei = extractSeiErrorMessage(htmlGerar);
    throw new Error(erroSei || `Não foi possível carregar o formulário para "${nomeTipoProc}".`);
  }

  const actionProc = resolveSeiUrl(formProc.getAttribute('action') || resGerar.url || actionEscolher, resGerar.url || actionEscolher);

  return {
    docProc: docGerar,
    formProc,
    actionProc,
    idTipoProc,
    nomeTipoProc
  };
}

// Extrai informações e links assinados da página procedimento_visualizar (Entry 238 / 637 / 1146 do Gabarito)
function parseProcedimentoVisualizar(htmlProcVis, baseUrl) {
  const docVis = new DOMParser().parseFromString(htmlProcVis, 'text/html');

  // 1. Número formatado do processo (ex: 00053-00122277/2026-79)
  const matchNumProc = htmlProcVis.match(/(\d{5}-\d{8}\/\d{4}-\d{2})/);
  const numeroProcesso = matchNumProc ? matchNumProc[1] : null;

  // 2. Link assinado de "Incluir Documento" (acao=documento_escolher_tipo)
  let urlEscolherDoc = '';
  const mEscolher = htmlProcVis.match(/controlador\.php\?acao=documento_escolher_tipo[^"'\s<>]+/i);
  if (mEscolher) {
    urlEscolherDoc = resolveSeiUrl(mEscolher[0], baseUrl);
  } else {
    const linkEl = docVis.querySelector('a[href*="documento_escolher_tipo"]');
    if (linkEl) urlEscolherDoc = extractCleanLinkUrl(linkEl, baseUrl);
  }

  // 3. Link assinado de "Enviar Processo" (acao=procedimento_enviar)
  let urlEnviarProc = '';
  const mEnviar = htmlProcVis.match(/controlador\.php\?acao=procedimento_enviar[^"'\s<>]+/i);
  if (mEnviar) {
    urlEnviarProc = resolveSeiUrl(mEnviar[0], baseUrl);
  } else {
    const linkEnvEl = docVis.querySelector('a[href*="procedimento_enviar"]');
    if (linkEnvEl) urlEnviarProc = extractCleanLinkUrl(linkEnvEl, baseUrl);
  }

  // 4. Lista de nós de documentos da árvore (new infraArvoreNo("DOCUMENTO", idDoc, idProc, ..., "Titulo (218531117)", ..., "218531117"))
  const documentos = [];
  const regexNos = /new\s+infraArvoreNo\s*\(\s*"DOCUMENTO"\s*,\s*"(\d+)"[^\n]*?"([^"\n]*\((\d{6,12})\))"[^\n]*?"(\d{6,12})"\s*\)/gi;
  let matchNo;
  while ((matchNo = regexNos.exec(htmlProcVis)) !== null) {
    documentos.push({
      idDocumento: matchNo[1],
      tituloCompleto: matchNo[2],
      numeroSei: matchNo[4] || matchNo[3]
    });
  }

  return {
    numeroProcesso,
    urlEscolherDoc,
    urlEnviarProc,
    documentos
  };
}

// Motor Principal de Automação no SEI (Seguindo 100% o Gabarito Oficial SEI 4.1.5)
async function executeFullAutomation(pkg) {
  if (!pkg || !pkg.pdfBase64) {
    updateStatus('⚠️ Selecione primeiro o arquivo PDF do Relatório CAESB clicando em "📂 Subir PDF"!', '#fbbf24');
    return;
  }

  const runBtn = document.getElementById('btn-netuno-run');
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.dataset.running = 'true';
    runBtn.style.opacity = '0.5';
    runBtn.style.cursor = 'not-allowed';
  }

  const errBox = document.getElementById('netuno-error-box');
  if (errBox) errBox.style.display = 'none';

  const cidade = pkg.cidade || 'Distrito Federal';
  const raRomano = pkg.raRomano || getRARomanByName(cidade);
  const ano = new Date().getFullYear();
  const descProcesso = `Hidrantes com alteração - ${cidade}${raRomano ? ` (RA ${raRomano})` : ''} - ${ano}`;
  const dataHoje = new Date().toLocaleDateString('pt-BR');

  try {
    // =========================================================================
    // ETAPA 1: Autuação do Processo Administrativo (Gabarito Entries 0 -> 165)
    // =========================================================================
    updateStatus(`⏳ 1/4: Iniciando processo para ${cidade}${raRomano ? ` (RA ${raRomano})` : ''}...`, '#38bdf8');
    
    const { formProc, actionProc, idTipoProc, nomeTipoProc } = await obterFormularioGerarProcesso();

    const postProcData = serializeSeiForm(formProc);

    const selAssuntos = formProc.querySelector('#selAssuntos, select[name="selAssuntos"]');
    let assuntoValor = postProcData.get('hdnAssuntos') || '';
    if (!assuntoValor && selAssuntos && selAssuntos.options && selAssuntos.options.length > 0) {
      const opts = Array.from(selAssuntos.options);
      assuntoValor = opts.map(o => `${o.value}±${o.text.trim()}`).join('¥');
    }
    if (!assuntoValor) {
      assuntoValor = '339±081.00 - CBMDF - CORPO DE BOMBEIROS MILITAR DO DF';
    }

    postProcData.set('hdnInfraTipoPagina', '1');
    postProcData.set('rdoProtocolo', 'A');
    postProcData.set('selTipoProcedimento', idTipoProc);
    postProcData.set('hdnIdTipoProcedimento', idTipoProc);
    postProcData.set('txtDescricao', descProcesso);
    postProcData.set('selTipoPrioridade', 'null');
    postProcData.set('selGrauSigilo', 'null');
    postProcData.set('rdoNivelAcesso', '0'); // Público
    postProcData.set('selHipoteseLegal', 'null');
    postProcData.set('hdnFlagProcedimentoCadastro', '2');
    postProcData.set('hdnAssuntos', assuntoValor);

    updateStatus(`⏳ 1/4: Salvando autuação do processo (${descProcesso})...`, '#38bdf8');
    const resSaveProc = await safeFetch(actionProc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=iso-8859-1' },
      body: encodeSeiFormParams(postProcData)
    }, 'Salvar Autuação Processo');

    const textSaveProc = await resSaveProc.text();
    const urlProcedimentoTrabalhar = resSaveProc.url;

    const matchIdProc = textSaveProc.match(/id_procedimento=(\d+)/i) || 
                        urlProcedimentoTrabalhar.match(/id_procedimento=(\d+)/i) ||
                        textSaveProc.match(/id_protocolo=(\d+)/i);

    let idProcedimento = matchIdProc ? matchIdProc[1] : null;
    if (!idProcedimento) {
      const msgErro = extractSeiErrorMessage(textSaveProc);
      throw new Error(msgErro || 'Processo gerado, mas não foi possível extrair o ID do procedimento do SEI.');
    }

    // Carrega procedimento_visualizar (ifrArvore - Entry 238 do Gabarito) para obter os links assinados da árvore
    const matchArvoreIframe = textSaveProc.match(/<iframe[^>]+id=["']ifrArvore["'][^>]*src=["']([^"']+)["']/i) ||
                              textSaveProc.match(/<iframe[^>]+src=["']([^"']+)["'][^>]*id=["']ifrArvore["']/i) ||
                              textSaveProc.match(/controlador\.php\?acao=procedimento_visualizar[^"'\s<>]+/i);

    if (!matchArvoreIframe) {
      throw new Error('Não foi possível localizar o link assinado da árvore do processo (ifrArvore).');
    }

    const urlProcVisualizar1 = resolveSeiUrl(matchArvoreIframe[1] || matchArvoreIframe[0], urlProcedimentoTrabalhar);
    const resProcVis1 = await safeFetch(urlProcVisualizar1, {}, 'Árvore do Processo (procedimento_visualizar)');
    const htmlProcVis1 = await resProcVis1.text();
    const arvoreInfo1 = parseProcedimentoVisualizar(htmlProcVis1, urlProcVisualizar1);

    const numeroProcesso = arvoreInfo1.numeroProcesso || idProcedimento;
    let urlEscolherDoc = arvoreInfo1.urlEscolherDoc;
    let urlTramitar = arvoreInfo1.urlEnviarProc;

    if (!urlEscolherDoc) {
      throw new Error('Link assinado de "Incluir Documento" (documento_escolher_tipo) não encontrado na árvore do processo.');
    }

    logAutomation(`Processo ${numeroProcesso} (ID ${idProcedimento}) criado com sucesso.`);

    // =========================================================================
    // ETAPA 2: Anexar Relatório Oficial CAESB (Gabarito Entries 421 -> 637)
    // =========================================================================
    updateStatus(`⏳ 2/4: Processo ${numeroProcesso} criado! Abrindo cadastro de Documento Externo...`, '#38bdf8');

    // Seleciona "Externo" (id_serie = -1) via POST no #frmDocumentoEscolherTipo (Entry 469 -> 470)
    const {
      htmlFormularioDoc: htmlDocReceberInit,
      formCadastro: formDocInit,
      urlFormularioDoc: urlDocReceber
    } = await selecionarSerieDocumentoSei(urlEscolherDoc, '-1', 'Documento Externo');

    const actionDocReceber = resolveSeiUrl(formDocInit.getAttribute('action') || urlDocReceber, urlDocReceber);

    // Faz o POST intermediário (Entry 523 do Gabarito: hdnFlagDocumentoCadastro=1, selSerie=2056)
    const postDocStep1 = serializeSeiForm(formDocInit);
    postDocStep1.set('hdnInfraTipoPagina', '2');
    postDocStep1.set('selSerie', '2056');
    postDocStep1.set('hdnIdSerie', '2056');
    postDocStep1.set('rdoTextoInicial', 'N');
    postDocStep1.set('rdoFormato', 'N');
    postDocStep1.set('selTipoConferencia', 'null');
    postDocStep1.set('selGrauSigilo', 'null');
    postDocStep1.set('selHipoteseLegal', 'null');
    postDocStep1.set('hdnFlagDocumentoCadastro', '1');
    postDocStep1.set('hdnStaDocumento', 'X');
    postDocStep1.set('hdnIdProcedimento', idProcedimento);

    const resDocStep1 = await safeFetch(actionDocReceber, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=iso-8859-1' },
      body: encodeSeiFormParams(postDocStep1)
    }, 'Configurar Série 2056 (Relatório de Vistoria da Fiscalização)');

    const htmlDocReceber = await resDocStep1.text();
    const docDocReceber = new DOMParser().parseFromString(htmlDocReceber, 'text/html');
    const formDoc = getSeiWorkForm(docDocReceber, 'form#frmDocumentoCadastro, form#frmDocumentoReceber') || formDocInit;

    // Extrai a URL assinada exclusiva de documento_upload_anexo de dentro de new infraUpload(...) (Entry 523 -> 581)
    const matchUploadUrl = htmlDocReceber.match(/controlador\.php\?acao=documento_upload_anexo[^"'\s<>)]+/i) ||
                           htmlDocReceberInit.match(/controlador\.php\?acao=documento_upload_anexo[^"'\s<>)]+/i);
    if (!matchUploadUrl) {
      throw new Error('URL assinada de upload (documento_upload_anexo) não encontrada no formulário do SEI.');
    }
    const uploadAction = resolveSeiUrl(matchUploadUrl[0], urlDocReceber);

    // Extrai idUsuario e siglaUnidade da funcaoConclusao da página (Entry 523)
    const matchUserUnit = htmlDocReceber.match(/infraFormatarTamanhoBytes\(arr\['tamanho'\]\)\s*,\s*'([^']*)'\s*,\s*'([^']*)'/i) ||
                          htmlDocReceberInit.match(/infraFormatarTamanhoBytes\(arr\['tamanho'\]\)\s*,\s*'([^']*)'\s*,\s*'([^']*)'/i);
    const idUsuarioUpload = matchUserUnit ? matchUserUnit[1] : '1997400';
    const siglaUnidadeUpload = matchUserUnit ? matchUserUnit[2] : 'CBMDF/DIVIS/SEHUR/SUOMA';

    updateStatus('⏳ 2/4: Enviando arquivo PDF do Relatório de Vistoria CAESB...', '#38bdf8');

    const uploadId = Math.floor(Math.random() * 899999 + 100000).toString();
    const pdfBlob = base64ToPdfBlob(pkg.pdfBase64);
    const rawFileName = pkg.fileName || `Relatorio_alteracoes_CAESB_${cidade.replace(/\s+/g, '_')}.pdf`;
    // Higieniza caracteres especiais que o SEI bloqueia (&#)
    const cleanFileName = rawFileName.replace(/[&#]/g, '_');

    const uploadFormData = new FormData();
    uploadFormData.append('UPLOAD_IDENTIFIER', uploadId);
    uploadFormData.append('filArquivo', pdfBlob, cleanFileName);

    const resUpload = await safeFetch(uploadAction, {
      method: 'POST',
      body: uploadFormData
    }, 'Upload Arquivo PDF');

    const uploadRespText = (await resUpload.text()).trim();
    logAutomation('Resposta bruta do upload:', uploadRespText);

    // Formato oficial do SEI (Entry 581): hash#nome#mime#tamanho#data_hora#
    const uploadParts = uploadRespText.split('#');
    if (uploadParts.length < 5 || !/^[a-f0-9]{16,64}$/i.test(uploadParts[0])) {
      const msgErroUp = extractSeiErrorMessage(uploadRespText);
      throw new Error(msgErroUp || `Resposta inesperada no upload do PDF: ${uploadRespText.slice(0, 180)}`);
    }

    const nomeUploadHash = uploadParts[0];
    const nomeArqRetornado = uploadParts[1] || cleanFileName;
    const tamanhoBytes = uploadParts[3] || String(pdfBlob.size);
    const dataHoraUpload = uploadParts[4] || `${dataHoje} ${new Date().toLocaleTimeString('pt-BR')}`;
    const tamanhoFormatado = formatSeiFileSize(tamanhoBytes);

    // Formato oficial de 7 colunas separado por ± (Entry 590 do Gabarito):
    // hash±nome±data_hora±tamanho±tamanhoFormatado±idUsuario±siglaUnidade
    const anexoToken = `${nomeUploadHash}±${nomeArqRetornado}±${dataHoraUpload}±${tamanhoBytes}±${tamanhoFormatado}±${idUsuarioUpload}±${siglaUnidadeUpload}`;

    // Verificação opcional AJAX de duplicidade (Entry 589 do Gabarito)
    const matchAjaxDup = htmlDocReceber.match(/controlador_ajax\.php\?acao_ajax=documento_recebido_duplicado[^"'\s<>)]+/i);
    if (matchAjaxDup) {
      try {
        const urlAjaxDup = resolveSeiUrl(matchAjaxDup[0], urlDocReceber);
        const dupParams = new URLSearchParams();
        dupParams.set('dta_elaboracao', dataHoje);
        dupParams.set('id_serie', '2056');
        dupParams.set('numero', '');
        await safeFetch(urlAjaxDup, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=iso-8859-1' },
          body: encodeSeiFormParams(dupParams)
        }, 'Verificação AJAX Duplicidade');
      } catch (_) {}
    }

    // Submete o cadastro final do Documento Externo (Entry 590 do Gabarito)
    const postDocSave = serializeSeiForm(formDoc);
    postDocSave.set('hdnInfraTipoPagina', '2');
    postDocSave.set('selSerie', '2056');
    postDocSave.set('hdnIdSerie', '2056');
    postDocSave.set('txtDataElaboracao', dataHoje);
    postDocSave.set('rdoTextoInicial', 'N');
    postDocSave.set('rdoFormato', 'N'); // Nato-digital
    postDocSave.set('selTipoConferencia', 'null');
    postDocSave.set('selGrauSigilo', 'null');
    postDocSave.set('rdoNivelAcesso', '0'); // Público
    postDocSave.set('selHipoteseLegal', 'null');
    postDocSave.set('hdnFlagDocumentoCadastro', '2');
    postDocSave.set('hdnStaDocumento', 'X');
    postDocSave.set('hdnIdProcedimento', idProcedimento);
    postDocSave.set('hdnAnexos', anexoToken);

    const actionSaveDoc = resolveSeiUrl(formDoc.getAttribute('action') || actionDocReceber, urlDocReceber);
    const resSaveDoc = await safeFetch(actionSaveDoc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=iso-8859-1' },
      body: encodeSeiFormParams(postDocSave)
    }, 'Salvar Documento Externo (Laudo CAESB)');

    const textSaveDoc = await resSaveDoc.text();
    const matchIdDocExterno = resSaveDoc.url.match(/id_documento=(\d+)/i) || textSaveDoc.match(/id_documento=(\d+)/i);
    if (!matchIdDocExterno) {
      const msgErroDoc = extractSeiErrorMessage(textSaveDoc);
      throw new Error(msgErroDoc || 'Falha ao salvar o Relatório CAESB no processo.');
    }
    const idDocExterno = matchIdDocExterno[1];

    // Segue para procedimento_visualizar (Entry 637 do Gabarito) para extrair o Número SEI real (ex: 218531117)
    let numeroSeiRelatorio = idDocExterno;
    const matchProcVis2 = textSaveDoc.match(/controlador\.php\?acao=procedimento_visualizar[^"'\s<>]*id_documento=\d+[^"'\s<>]*/i) ||
                          textSaveDoc.match(/controlador\.php\?acao=procedimento_visualizar[^"'\s<>]+/i);
    if (matchProcVis2) {
      const urlProcVis2 = resolveSeiUrl(matchProcVis2[0], resSaveDoc.url);
      const resProcVis2 = await safeFetch(urlProcVis2, {}, 'Atualizar Árvore após Anexo');
      const htmlProcVis2 = await resProcVis2.text();
      const arvoreInfo2 = parseProcedimentoVisualizar(htmlProcVis2, urlProcVis2);

      if (arvoreInfo2.urlEscolherDoc) urlEscolherDoc = arvoreInfo2.urlEscolherDoc;
      if (arvoreInfo2.urlEnviarProc) urlTramitar = arvoreInfo2.urlEnviarProc;

      const docRelatorioNode = arvoreInfo2.documentos.find(d => d.idDocumento === idDocExterno) || arvoreInfo2.documentos[0];
      if (docRelatorioNode && docRelatorioNode.numeroSei) {
        numeroSeiRelatorio = docRelatorioNode.numeroSei;
      }
    }

    logAutomation(`Relatório de Vistoria da Fiscalização anexado! Nº SEI: ${numeroSeiRelatorio} (ID: ${idDocExterno})`);

    // =========================================================================
    // ETAPA 3: Gerar Memorando (Série 165 - Gabarito Entries 996 -> 1146)
    // =========================================================================
    updateStatus(`⏳ 3/4: Relatório (${numeroSeiRelatorio}) anexado! Gerando Memorando...`, '#38bdf8');

    const {
      formCadastro: formMemo,
      urlFormularioDoc: urlGerarMemo
    } = await selecionarSerieDocumentoSei(urlEscolherDoc, '165', 'Memorando');

    const postMemoData = serializeSeiForm(formMemo);
    postMemoData.set('hdnInfraTipoPagina', '2');
    postMemoData.set('txtDataElaboracao', dataHoje);
    postMemoData.set('rdoTextoInicial', 'N');
    postMemoData.set('txtDescricao', '');
    postMemoData.set('selGrauSigilo', 'null');
    postMemoData.set('rdoNivelAcesso', '0'); // Público
    postMemoData.set('selHipoteseLegal', 'null');
    postMemoData.set('hdnFlagDocumentoCadastro', '2');
    postMemoData.set('hdnIdSerie', '165');
    postMemoData.set('hdnStaDocumento', 'I');
    postMemoData.set('hdnIdProcedimento', idProcedimento);

    const actionSaveMemo = resolveSeiUrl(formMemo.getAttribute('action') || urlGerarMemo, urlGerarMemo);
    const resSaveMemo = await safeFetch(actionSaveMemo, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=iso-8859-1' },
      body: encodeSeiFormParams(postMemoData)
    }, 'Salvar Cadastro do Memorando');

    const textSaveMemo = await resSaveMemo.text();
    const matchIdMemo = resSaveMemo.url.match(/id_documento=(\d+)/i) || textSaveMemo.match(/id_documento=(\d+)/i);
    if (!matchIdMemo) {
      const msgErro = extractSeiErrorMessage(textSaveMemo);
      throw new Error(msgErro || 'Memorando criado, mas ID do documento não retornado pelo SEI.');
    }
    const idDocumentoMemo = matchIdMemo[1];

    // Prepara o texto oficial do Memorando + Minuta de Ofício com o Nº SEI real do Relatório Externo
    const corpoTexto = generateSeiMemorandoMinutaText({
      cidade,
      raRomano,
      ano,
      numeroSeiRelatorio
    });

    // Copia automaticamente para a área de transferência do militar como garantia
    try {
      await navigator.clipboard.writeText(corpoTexto);
    } catch (_) {}

    // Extrai links assinados de editor_montar, documento_assinar e documento_verificar_assinatura de arvore_visualizar (Entry 1099 do Gabarito / Entry 18 do HAT)
    const matchEditor = textSaveMemo.match(/controlador\.php\?acao=editor_montar[^"'\s<>]+/i);
    const urlEditor = matchEditor ? resolveSeiUrl(matchEditor[0], resSaveMemo.url) : null;

    const matchAssinar = textSaveMemo.match(/controlador\.php\?acao=documento_assinar[^"'\s<>]+/i);
    const urlAssinatura = matchAssinar ? resolveSeiUrl(matchAssinar[0], resSaveMemo.url) : null;

    const matchVerifAss = textSaveMemo.match(/controlador_ajax\.php\?acao_ajax=documento_verificar_assinatura[^"'\s<>)]+/i);
    const urlVerificarAssinatura = matchVerifAss ? resolveSeiUrl(matchVerifAss[0], resSaveMemo.url) : null;

    // Atualiza árvore após o Memorando (Entry 1146 do Gabarito) para pegar o número SEI do Memorando e link de tramitação
    let tituloMemorando = `Memorando (ID ${idDocumentoMemo})`;
    let urlProcVis3Saved = null;
    const matchProcVis3 = textSaveMemo.match(/controlador\.php\?acao=procedimento_visualizar[^"'\s<>]*id_documento=\d+[^"'\s<>]*/i) ||
                          textSaveMemo.match(/controlador\.php\?acao=procedimento_visualizar[^"'\s<>]+/i);
    if (matchProcVis3) {
      try {
        urlProcVis3Saved = resolveSeiUrl(matchProcVis3[0], resSaveMemo.url);
        const resProcVis3 = await safeFetch(urlProcVis3Saved, {}, 'Atualizar Árvore após Memorando');
        const htmlProcVis3 = await resProcVis3.text();
        const arvoreInfo3 = parseProcedimentoVisualizar(htmlProcVis3, urlProcVis3Saved);
        if (arvoreInfo3.urlEnviarProc) urlTramitar = arvoreInfo3.urlEnviarProc;
        const memoNode = arvoreInfo3.documentos.find(d => d.idDocumento === idDocumentoMemo);
        if (memoNode && memoNode.tituloCompleto) {
          tituloMemorando = memoNode.tituloCompleto;
        }
      } catch (_) {}
    }

    // Preenche e salva automaticamente as seções editáveis do Memorando no Editor do SEI (Entry 20 & 21 do HAT)
    let editorAutoSaved = false;
    if (urlEditor) {
      try {
        updateStatus('⏳ 3/4: Inserindo texto modelo oficial no Editor do Memorando...', '#38bdf8');
        const resPageEditor = await safeFetch(urlEditor, {}, 'Carregar Editor do Memorando');
        const htmlEditor = await resPageEditor.text();
        const docEditor = new DOMParser().parseFromString(htmlEditor, 'text/html');
        const formEditor = getSeiWorkForm(docEditor, 'form#frmEditor');

        if (formEditor && formEditor.getAttribute('action')) {
          const postEditorData = serializeSeiForm(formEditor);
          const editorSections = buildSeiMemorandoEditorSections({
            cidade,
            raRomano,
            ano,
            numeroSeiRelatorio
          });

          // No SEI 4.1.5, cada seção txaEditor_XXXXX tem title e readOnly configurados via CKEDITOR.replace('txaEditor_XXXXX', {...})
          const regexCk = /CKEDITOR\.replace\s*\(\s*['"](txaEditor_\d+)['"]\s*,\s*\{([^\n]+)\}\s*\)/gi;
          let matchCk;
          let mappedCount = 0;

          while ((matchCk = regexCk.exec(htmlEditor)) !== null) {
            const fieldName = matchCk[1];
            const configStr = matchCk[2];
            const titleMatch = configStr.match(/title\s*:\s*["']([^"']+)["']/i);
            const readOnlyMatch = configStr.match(/["']?readOnly["']?\s*:\s*(true|false)/i);
            const isReadOnly = readOnlyMatch ? readOnlyMatch[1].toLowerCase() === 'true' : false;
            const normTitle = normalizeSearchStr(titleMatch ? titleMatch[1] : '');

            if (!isReadOnly) {
              if (normTitle.includes('destinatario') || fieldName === 'txaEditor_15168') {
                postEditorData.set(fieldName, editorSections.destinatarioHtml);
                mappedCount++;
              } else if (normTitle.includes('assunto') || fieldName === 'txaEditor_15170') {
                postEditorData.set(fieldName, editorSections.assuntoHtml);
                mappedCount++;
              } else if (normTitle.includes('corpo') || normTitle.includes('texto') || fieldName === 'txaEditor_15172') {
                postEditorData.set(fieldName, editorSections.corpoHtml);
                mappedCount++;
              } else if (normTitle.includes('fecho') || fieldName === 'txaEditor_15174') {
                postEditorData.set(fieldName, editorSections.fechoHtml);
                mappedCount++;
              }
            }
          }

          // Fallback direto pelos nomes de campos do modelo Memorando GDF caso o regex não case
          if (mappedCount === 0) {
            if (postEditorData.has('txaEditor_15168')) postEditorData.set('txaEditor_15168', editorSections.destinatarioHtml);
            if (postEditorData.has('txaEditor_15170')) postEditorData.set('txaEditor_15170', editorSections.assuntoHtml);
            if (postEditorData.has('txaEditor_15172')) postEditorData.set('txaEditor_15172', editorSections.corpoHtml);
            if (postEditorData.has('txaEditor_15174')) postEditorData.set('txaEditor_15174', editorSections.fechoHtml);
          }

          const actionEditor = resolveSeiUrl(formEditor.getAttribute('action'), urlEditor);
          const resSaveEditor = await safeFetch(actionEditor, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=iso-8859-1' },
            body: encodeSeiFormParams(postEditorData)
          }, 'Salvar Texto no Editor SEI');
          const txtSaveEditor = (await resSaveEditor.text()).trim();
          logAutomation('Resposta do salvamento do Editor SEI:', txtSaveEditor.slice(0, 80));

          if (/^OK\b/i.test(txtSaveEditor) || (resSaveEditor.ok && !extractSeiErrorMessage(txtSaveEditor))) {
            editorAutoSaved = true;
          }
        }
      } catch (errEd) {
        logAutomation('Aviso ao salvar automaticamente no editor (disponível via botão): ' + errEd.message);
      }
    }

    // =========================================================================
    // ETAPA 4: Painel de Conclusão, Assinatura e Envio Automático para SUTEC (Entry 1607 -> 1661)
    // =========================================================================
    const destinoEscolhidoId = document.getElementById('select-netuno-destino')?.value || pkg.destinoId || '110037655';
    const destinoObj = DESTINO_UNIDADES.find(u => u.id === destinoEscolhidoId) || DESTINO_UNIDADES[0];

    const area = document.getElementById('netuno-status-area');
    if (area) {
      area.innerHTML = `
        <div style="color: #34d399; font-weight: bold; margin-bottom: 6px;">
          ✅ Processo e Memorando preenchidos com sucesso!
        </div>
        <div style="color: #cbd5e1; font-size: 11px; margin-bottom: 8px; line-height: 1.45;">
          Processo: <strong style="color: white; font-family: monospace;">${numeroProcesso}</strong><br/>
          Cidade/RA: <strong style="color: #a7f3d0;">${cidade}${raRomano ? ` (RA ${raRomano})` : ''}</strong><br/>
          Relatório CAESB: <strong style="color: #38bdf8; font-family: monospace;">Nº SEI ${numeroSeiRelatorio}</strong><br/>
          Documento: <strong style="color: #a7f3d0;">${tituloMemorando}</strong><br/>
          <span id="netuno-assinatura-feedback" style="color: #fcd34d; font-size: 10.5px;">✍️ Assine na janela aberta: assim que assinar, a janela fechará e o processo será enviado automaticamente para <strong>${destinoObj.sigla}</strong>!</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 7px;">
          <button id="btn-abrir-editor-sei" style="padding: 7px; background: #334155; border: 1px solid #475569; border-radius: 6px; color: #f8fafc; font-weight: 600; cursor: pointer; font-size: 11px;">
            ✏️ Abrir Editor Memorando
          </button>
          <button id="btn-abrir-assinatura-sei" style="padding: 7px; background: #0f766e; border: 1px solid #14b8a6; border-radius: 6px; color: #f8fafc; font-weight: 600; cursor: pointer; font-size: 11px;">
            ✍️ Assinar Memorando
          </button>
        </div>

        <button id="btn-tramitar-final" style="width: 100%; padding: 9px; background: #0284c7; border: none; border-radius: 7px; color: white; font-weight: bold; cursor: pointer; font-size: 11.5px; box-shadow: 0 4px 12px rgba(2,132,199,0.4); margin-bottom: 6px;">
          🚀 Enviar Processo Agora para ${destinoObj.sigla}
        </button>

        <button id="btn-abrir-processo-tela" style="width: 100%; padding: 6px; background: transparent; border: 1px solid #475569; border-radius: 6px; color: #94a3b8; font-weight: 600; cursor: pointer; font-size: 10.5px;">
          📂 Visualizar Processo ${numeroProcesso} na Tela do SEI
        </button>
      `;

      const btnEd = document.getElementById('btn-abrir-editor-sei');
      if (btnEd) {
        btnEd.onclick = () => {
          navigator.clipboard.writeText(corpoTexto).catch(() => {});
          if (urlEditor) {
            window.open(urlEditor, 'JanelaEditorSEI', 'width=1050,height=760,scrollbars=yes,resizable=yes');
          } else if (urlProcedimentoTrabalhar) {
            window.location.href = urlProcedimentoTrabalhar;
          }
        };
      }

      const btnAss = document.getElementById('btn-abrir-assinatura-sei');
      if (btnAss) {
        btnAss.onclick = () => {
          if (urlAssinatura) {
            openSeiSignaturePopup(urlAssinatura);
          }
        };
      }

      const btnTram = document.getElementById('btn-tramitar-final');
      if (btnTram) {
        btnTram.onclick = async () => {
          const currentDestId = document.getElementById('select-netuno-destino')?.value || destinoEscolhidoId;
          await tramitarProcessoFinal(idProcedimento, numeroProcesso, urlTramitar, currentDestId, urlProcedimentoTrabalhar, urlProcVis3Saved);
        };
      }

      const btnVerProc = document.getElementById('btn-abrir-processo-tela');
      if (btnVerProc) {
        btnVerProc.onclick = () => {
          if (urlProcedimentoTrabalhar) {
            window.location.href = urlProcedimentoTrabalhar;
          }
        };
      }
    }

    // Assim que o Processo, PDF Externo e Memorando foram gerados no SEI, consome/limpa o PDF carregado para nunca repetir em outro processo
    clearCurrentLoadedFile();

    // Registra o contexto ativo para envio automático imediato assim que o Memorando for assinado
    registerAutoTramitacaoOnSign({
      idProcedimento,
      idDocumentoMemo,
      numeroProcesso,
      urlTramitar,
      destinoId: destinoEscolhidoId,
      urlProcedimentoTrabalhar,
      urlProcVis3: urlProcVis3Saved,
      urlVerificarAssinatura
    });

    // Abre automaticamente a janela de Assinatura (com fechamento e tramitação automáticos após assinar)
    if (urlAssinatura && editorAutoSaved) {
      openSeiSignaturePopup(urlAssinatura);
    } else if (urlEditor) {
      window.open(urlEditor, 'JanelaEditorSEI', 'width=1050,height=760,scrollbars=yes,resizable=yes');
    }

  } catch (err) {
    console.error('[Netuno SEI] Erro na automação:', err);
    displayAutomationError(err);
  } finally {
    if (runBtn) {
      runBtn.disabled = false;
      delete runBtn.dataset.running;
      runBtn.style.opacity = '1';
      runBtn.style.cursor = 'pointer';
    }
  }
}

// Referência da janela popup de assinatura e monitor de envio automático pós-assinatura
let janelaAssinaturaRef = null;
let activeSignWatchInterval = null;
let pendingTramitacaoContext = null;

function openSeiSignaturePopup(urlAssinatura) {
  if (!urlAssinatura) return;
  janelaAssinaturaRef = window.open(urlAssinatura, 'JanelaAssinaturaSEI', 'width=680,height=490,scrollbars=yes,resizable=yes');
}

// Verifica no endpoint AJAX oficial do SEI se o Memorando já consta como assinado (<complemento nome="SinAssinado">S</complemento>)
async function checkMemorandoSignedViaAjax(urlVerificarAssinatura) {
  if (!urlVerificarAssinatura) return false;
  try {
    const res = await fetch(urlVerificarAssinatura, {
      method: 'POST',
      credentials: 'include'
    });
    if (!res.ok) return false;
    const xmlText = await res.text();
    return /nome=["']SinAssinado["'][^>]*>\s*S\s*</i.test(xmlText) || /<SinAssinado>\s*S\s*<\/SinAssinado>/i.test(xmlText);
  } catch (_) {
    return false;
  }
}

function registerAutoTramitacaoOnSign(ctx) {
  if (activeSignWatchInterval) {
    clearInterval(activeSignWatchInterval);
    activeSignWatchInterval = null;
  }
  pendingTramitacaoContext = { ...ctx, triggered: false };

  const startTime = Date.now();
  activeSignWatchInterval = setInterval(async () => {
    if (!pendingTramitacaoContext || pendingTramitacaoContext.triggered) {
      clearInterval(activeSignWatchInterval);
      activeSignWatchInterval = null;
      return;
    }

    // Expira após 10 minutos
    if (Date.now() - startTime > 600000) {
      clearInterval(activeSignWatchInterval);
      activeSignWatchInterval = null;
      return;
    }

    // 1. Verifica via AJAX nativo do SEI se o documento já foi assinado
    if (pendingTramitacaoContext.urlVerificarAssinatura) {
      const isSigned = await checkMemorandoSignedViaAjax(pendingTramitacaoContext.urlVerificarAssinatura);
      if (isSigned) {
        logAutomation('Assinatura detectada via AJAX (documento_verificar_assinatura)! Disparando envio automático para SUTEC...');
        await triggerAutoTramitacaoAfterSignature();
        return;
      }
    }

    // 2. Se a janela de assinatura foi fechada pelo usuário, verifica uma última vez se assinou
    if (janelaAssinaturaRef && janelaAssinaturaRef.closed) {
      janelaAssinaturaRef = null;
      if (pendingTramitacaoContext.urlVerificarAssinatura) {
        const isSignedAfterClose = await checkMemorandoSignedViaAjax(pendingTramitacaoContext.urlVerificarAssinatura);
        if (isSignedAfterClose) {
          logAutomation('Janela de assinatura fechada e documento assinado! Disparando envio automático para SUTEC...');
          await triggerAutoTramitacaoAfterSignature();
        }
      }
    }
  }, 1200);
}

async function triggerAutoTramitacaoAfterSignature() {
  if (!pendingTramitacaoContext || pendingTramitacaoContext.triggered) return;
  pendingTramitacaoContext.triggered = true;

  if (activeSignWatchInterval) {
    clearInterval(activeSignWatchInterval);
    activeSignWatchInterval = null;
  }

  if (janelaAssinaturaRef && !janelaAssinaturaRef.closed) {
    try {
      janelaAssinaturaRef.close();
    } catch (_) {}
  }

  const btnAss = document.getElementById('btn-abrir-assinatura-sei');
  if (btnAss) {
    btnAss.innerHTML = '✅ Memorando Assinado!';
    btnAss.style.background = '#059669';
    btnAss.style.borderColor = '#34d399';
  }

  const fbEl = document.getElementById('netuno-assinatura-feedback');
  if (fbEl) {
    fbEl.style.color = '#38bdf8';
    fbEl.style.fontWeight = 'bold';
    fbEl.textContent = '⏳ Memorando assinado! Enviando processo automaticamente para a unidade de destino...';
  }

  const ctx = pendingTramitacaoContext;
  const currentDestId = document.getElementById('select-netuno-destino')?.value || ctx.destinoId || '110037655';
  await tramitarProcessoFinal(
    ctx.idProcedimento,
    ctx.numeroProcesso,
    ctx.urlTramitar,
    currentDestId,
    ctx.urlProcedimentoTrabalhar,
    ctx.urlProcVis3
  );
}

// Escuta notificação da janela popup de assinatura (documento_assinar) para fechá-la imediatamente e enviar o processo para SUTEC
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'NETUNO_SEI_ASSINATURA_OK') {
    logAutomation('Evento NETUNO_SEI_ASSINATURA_OK recebido da janela de assinatura!');
    triggerAutoTramitacaoAfterSignature();
  }
});

// Gerencia o fechamento automático da janelinha popup de assinatura (acao=documento_assinar) após o militar clicar em Assinar
function handleSignaturePopupLifecycle() {
  if (!window.location.href.includes('acao=documento_assinar')) return;

  const htmlSource = document.documentElement.innerHTML || '';
  const erroAssinatura = extractSeiErrorMessage(document);
  const subTs = Number(sessionStorage.getItem('netuno_sei_signing_submitted') || 0);
  const justSubmitted = subTs > 0 && (Date.now() - subTs) < 45000;

  // Detecta se o SEI executou a rotina de fechamento pós-assinatura no inicializar() ou se informou que já foi assinado
  const initMatch = htmlSource.match(/function\s+inicializar\s*\(\s*\)\s*\{([\s\S]*?)\}/i);
  const seiWantsToCloseModal = initMatch && /infraFecharJanelaModal|atualizarArvore|recarregar/i.test(initMatch[1]);
  const alreadySignedMsg = erroAssinatura && /j[aá]\s+(foi\s+assinado|consta\s+assinatura)/i.test(erroAssinatura);
  const hasPasswordInput = Boolean(document.querySelector('#pwdSenha, input[type="password"]'));

  if (seiWantsToCloseModal || alreadySignedMsg || (justSubmitted && !erroAssinatura) || (!hasPasswordInput && !erroAssinatura && justSubmitted)) {
    sessionStorage.removeItem('netuno_sei_signing_submitted');
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'NETUNO_SEI_ASSINATURA_OK' }, '*');
      }
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'NETUNO_SEI_ASSINATURA_OK' }, '*');
      }
    } catch (_) {}

    // Exibe aviso rápido de sucesso e fecha a janela imediatamente
    try {
      document.body.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#0f172a;color:#34d399;font-family:sans-serif;text-align:center;padding:20px;">
          <div style="font-size:38px;margin-bottom:10px;">✅</div>
          <div style="font-size:16px;font-weight:bold;margin-bottom:6px;">Memorando Assinado com Sucesso!</div>
          <div style="font-size:12px;color:#94a3b8;">Fechando janela e enviando processo para SUTEC...</div>
        </div>
      `;
    } catch (_) {}

    window.close();
    setTimeout(() => {
      try { window.close(); } catch (_) {}
    }, 150);
    return;
  }

  // Se houve erro de senha (ex: Senha inválida), limpa a flag para permitir nova tentativa na mesma janela
  if (erroAssinatura) {
    sessionStorage.removeItem('netuno_sei_signing_submitted');
  }

  // Registra quando o militar submeter a assinatura (clicar em Assinar ou pressionar Enter na senha)
  const markSubmitted = () => {
    const pwd = document.querySelector('#pwdSenha, input[type="password"]');
    const flag = document.getElementById('hdnFlagAssinatura');
    if ((flag && flag.value === '1') || (pwd && pwd.value && pwd.value.trim().length > 0)) {
      sessionStorage.setItem('netuno_sei_signing_submitted', String(Date.now()));
    }
  };

  window.addEventListener('beforeunload', markSubmitted);
  const formAss = document.getElementById('frmAssinaturas') || document.querySelector('form');
  if (formAss) {
    formAss.addEventListener('submit', () => {
      sessionStorage.setItem('netuno_sei_signing_submitted', String(Date.now()));
    });
  }
  const btnAssinar = document.getElementById('btnAssinar') || document.querySelector('button[name="btnAssinar"], input[name="btnAssinar"]');
  if (btnAssinar) {
    btnAssinar.addEventListener('click', () => {
      const pwd = document.querySelector('#pwdSenha, input[type="password"]');
      if (pwd && pwd.value && pwd.value.trim().length > 0) {
        sessionStorage.setItem('netuno_sei_signing_submitted', String(Date.now()));
      }
    });
  }
}

// Tramitação final do processo seguindo 100% os Entries 1607 -> 1661 do Gabarito (#frmAtividadeListar + hdnIdAtividades)
async function tramitarProcessoFinal(idProcedimento, numeroProcesso, urlTramitar, destinoId = '110037655', urlProcedimentoTrabalhar = null, urlProcVisRefresh = null) {
  try {
    const destinoObj = DESTINO_UNIDADES.find(u => u.id === destinoId) || DESTINO_UNIDADES[0];
    updateStatus(`⏳ 4/4: Enviando processo ${numeroProcesso} para ${destinoObj.sigla}...`, '#38bdf8');

    // Atualiza a árvore após a assinatura caso urlProcVisRefresh esteja disponível para garantir link de envio fresco
    let urlEnviar = urlTramitar;
    if (urlProcVisRefresh) {
      try {
        const resVis = await safeFetch(urlProcVisRefresh, {}, 'Atualizar Árvore antes de Tramitar');
        const htmlVis = await resVis.text();
        const infoVis = parseProcedimentoVisualizar(htmlVis, urlProcVisRefresh);
        if (infoVis.urlEnviarProc) {
          urlEnviar = infoVis.urlEnviarProc;
        }
      } catch (_) {}
    }

    if (!urlEnviar) {
      const linkEnv = document.querySelector('a[href*="procedimento_enviar"]');
      if (linkEnv) urlEnviar = extractCleanLinkUrl(linkEnv, window.location.href);
    }

    if (!urlEnviar) {
      throw new Error('Link assinado de tramitação (procedimento_enviar) não encontrado.');
    }

    const resPageEnviar = await safeFetch(urlEnviar, {}, 'Página Tramitação Enviar');
    const htmlEnviar = await resPageEnviar.text();
    const docEnviar = new DOMParser().parseFromString(htmlEnviar, 'text/html');

    // No SEI 4.1.5 (Entry 1607 do Gabarito), o form de envio tem id="frmAtividadeListar"
    const formEnviar = getSeiWorkForm(docEnviar, 'form#frmAtividadeListar, form#frmProcedimentoEnviar');
    if (!formEnviar) {
      const erroPag = extractSeiErrorMessage(htmlEnviar);
      throw new Error(erroPag || 'Formulário de envio (#frmAtividadeListar) não encontrado no SEI.');
    }

    const hdnTipoPag = formEnviar.querySelector('#hdnInfraTipoPagina, input[name="hdnInfraTipoPagina"]')?.value || '2';
    const hdnProtocolos = formEnviar.querySelector('#hdnIdProtocolos, input[name="hdnIdProtocolos"]')?.value || idProcedimento;
    const hdnAtividades = formEnviar.querySelector('#hdnIdAtividades, input[name="hdnIdAtividades"]')?.value || '';

    // Monta exatamente os 14 parâmetros do Entry 1661 do Gabarito na mesma ordem (sem selProcedimentos)
    const postEnviarData = new URLSearchParams();
    postEnviarData.set('hdnInfraTipoPagina', hdnTipoPag);
    postEnviarData.set('sbmEnviar', 'Enviar');
    postEnviarData.set('selOrgao', '');
    postEnviarData.set('txtUnidade', '');
    postEnviarData.set('hdnIdUnidade', '');
    postEnviarData.set('selUnidades', destinoObj.id);
    postEnviarData.set('chkSinManterAberto', 'on'); // Mantém aberto na SUOMA (igual ao Gabarito Entry 1661)
    postEnviarData.set('txtPrazoRetornoProgramado', '');
    postEnviarData.set('txtDiasRetornoProgramado', '');
    postEnviarData.set('txtPrazoReaberturaProgramada', '');
    postEnviarData.set('txtDiasReaberturaProgramada', '');
    postEnviarData.set('hdnIdProtocolos', hdnProtocolos);
    postEnviarData.set('hdnIdAtividades', hdnAtividades);
    postEnviarData.set('hdnUnidades', `${destinoObj.id}±${destinoObj.descricao}`);

    const actionEnviar = resolveSeiUrl(formEnviar.getAttribute('action') || urlEnviar, resPageEnviar.url || urlEnviar);
    const resEnviar = await safeFetch(actionEnviar, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=iso-8859-1' },
      body: encodeSeiFormParams(postEnviarData)
    }, 'Submeter Tramitação Final');

    const textEnviar = await resEnviar.text();
    const erroEnv = extractSeiErrorMessage(textEnviar);
    if (erroEnv) {
      throw new Error(erroEnv);
    }

    // Verifica se o SEI redirecionou para arvore_visualizar (sucesso real da tramitação, igual Entry 1662 do Gabarito)
    if (textEnviar.includes('id="frmAtividadeListar"') && !(resEnviar.url || '').includes('acao=arvore_visualizar')) {
      throw new Error('O SEI não concluiu a tramitação para a unidade de destino (verifique se o Memorando foi assinado).');
    }

    updateStatus(`🎉 SUCESSO TOTAL! Processo ${numeroProcesso} assinado e enviado para ${destinoObj.descricao} (mantido aberto na SUOMA)!`, '#34d399');

    // Limpa imediatamente o arquivo PDF carregado para evitar reutilização errônea
    clearCurrentLoadedFile();

    if (urlProcedimentoTrabalhar) {
      setTimeout(() => {
        window.location.href = urlProcedimentoTrabalhar;
      }, 1200);
    }
  } catch (err) {
    console.error('[Netuno SEI] Falha na tramitação:', err);
    if (pendingTramitacaoContext) {
      pendingTramitacaoContext.triggered = false;
    }
    displayAutomationError(err);
  }
}

// Escuta comandos vindos do menu de extensões (popup.js / background.js)
if (chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (window !== window.top) return;

    if (request.action === 'netuno_open_panel') {
      if (request.package && request.package.pdfBase64) {
        activePackage = request.package;
      }
      renderFloatingCard(activePackage);
      updateWidgetPackageUI(activePackage);
      setWidgetExpandedState(true);
      sendResponse({ success: true });
      return true;
    }

    if (request.action === 'netuno_start_play') {
      if (request.package && request.package.pdfBase64) {
        activePackage = request.package;
      }
      renderFloatingCard(activePackage);
      updateWidgetPackageUI(activePackage);
      setWidgetExpandedState(true);
      triggerPlayWithSync();
      sendResponse({ success: true });
      return true;
    }
  });
}

// Atualiza automaticamente caso o PDF ou a Cidade sejam enviados pelo Popup da extensão
if (chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || window !== window.top) return;
    const newPkg = changes.netuno_sei_package?.newValue;
    if (newPkg && newPkg.pdfBase64 && !newPkg.consumed) {
      activePackage = newPkg;
      renderFloatingCard(newPkg);
      updateWidgetPackageUI(newPkg);
    }
  });
}

// Inicialização: Sempre mantém o botãozinho disfarçado disponível no SEI e preserva PDF recém-subido ainda não utilizado
function initExtension() {
  if (window.location.href.includes('acao=documento_assinar')) {
    handleSignaturePopupLifecycle();
    return;
  }

  if (window !== window.top) return;

  renderFloatingCard(activePackage);

  if (chrome.storage?.local) {
    // Remove sempre o cache persistente legado
    chrome.storage.local.remove(['netuno_sei_last_package']);

    chrome.storage.local.get(['netuno_sei_package', 'netuno_sei_panel_open', 'netuno_sei_auto_play'], (res) => {
      if (res?.netuno_sei_panel_open) {
        setWidgetExpandedState(true);
        chrome.storage.local.remove(['netuno_sei_panel_open']);
      }

      const pkg = res?.netuno_sei_package;
      const isFreshUnconsumed = Boolean(
        pkg &&
        pkg.pdfBase64 &&
        !pkg.consumed &&
        (!pkg.uploadedAt || (Date.now() - pkg.uploadedAt) < 30 * 60 * 1000)
      );

      if (isFreshUnconsumed) {
        activePackage = pkg;
        renderFloatingCard(pkg);
        updateWidgetPackageUI(pkg);

        if (res?.netuno_sei_auto_play) {
          chrome.storage.local.remove(['netuno_sei_auto_play']);
          setWidgetExpandedState(true);
          setTimeout(() => {
            triggerPlayWithSync();
          }, 400);
        }
      } else {
        chrome.storage.local.remove(['netuno_sei_package', 'netuno_sei_auto_play']);
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initExtension);
} else {
  initExtension();
}
