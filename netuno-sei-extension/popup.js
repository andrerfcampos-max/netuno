// popup.js - Controle e Upload do Relatório CAESB pelo Menu de Extensões

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
    const titleMatch = rawPdfStr.match(/\/Title\s*(?:\(([^)]+)\)|<([0-9a-fA-F]+)>)/i);
    if (titleMatch) {
      candidates.push(decodePdfString(titleMatch[1] ? titleMatch[1] : ('<' + titleMatch[2] + '>')));
    }
    const subjMatch = rawPdfStr.match(/\/Subject\s*(?:\(([^)]+)\)|<([0-9a-fA-F]+)>)/i);
    if (subjMatch) {
      candidates.push(decodePdfString(subjMatch[1] ? subjMatch[1] : ('<' + subjMatch[2] + '>')));
    }
    const relMatch = rawPdfStr.slice(0, 50000).match(/Relatorio[a-zA-Z0-9_]*CAESB[a-zA-Z0-9_]*/gi);
    if (relMatch) {
      candidates.push(...relMatch);
    }
    const hydrantMatches = rawPdfStr.slice(0, 80000).match(/\b([A-Z]{3})\d{4,5}\b/g);
    if (hydrantMatches && hydrantMatches.length > 0) {
      const counts = {};
      for (const h of hydrantMatches) {
        const pref = h.slice(0, 3);
        if (PREFIX_RA_MAP[pref]) counts[pref] = (counts[pref] || 0) + 1;
      }
      const sortedPrefs = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
      if (sortedPrefs.length > 0) {
        const bestRaName = PREFIX_RA_MAP[sortedPrefs[0]];
        const foundRa = RA_CATALOG.find(r => r.name === bestRaName);
        if (foundRa) candidates.push(foundRa.name);
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
      if (raNorm && clean.includes(raNorm)) return ra;
    }

    if (clean.includes('arniqueiras')) return RA_CATALOG.find(r => r.name === 'Arniqueira');
    if (clean.includes('plano piloto')) return RA_CATALOG.find(r => r.name === 'Brasília');
    if (clean.includes('sol nascente') || clean.includes('por do sol')) return RA_CATALOG.find(r => r.name === 'Sol Nascente/Pôr do Sol');
    if (clean.includes('sudoeste') || clean.includes('octogonal')) return RA_CATALOG.find(r => r.name === 'Sudoeste e Octogonal');
  }

  if (rawPdfStr) {
    const headChunk = normalizeSearchStr(rawPdfStr.slice(0, 50000));
    for (const ra of sortedRAs) {
      const raNorm = normalizeSearchStr(ra.name);
      if (raNorm && raNorm.length >= 4 && headChunk.includes(raNorm)) return ra;
    }
  }

  return null;
}

function detectRAFromFilename(fileName) {
  return detectRAFromPdfContent('', fileName);
}

function formatSize(bytes) {
  const b = Number(bytes) || 0;
  if (b >= 1048576) return (b / 1048576).toFixed(2) + ' Mb';
  if (b >= 1024) return (b / 1024).toFixed(2) + ' Kb';
  return b + ' bytes';
}

let currentPackage = null;

const fileInput = document.getElementById('popup-input-pdf');
const fileInfoEl = document.getElementById('popup-file-info');
const selectRa = document.getElementById('popup-select-ra');
const selectDestino = document.getElementById('popup-select-destino');
const statusEl = document.getElementById('popup-status');
const badgeEl = document.getElementById('ext-badge');
const btnPlay = document.getElementById('btn-popup-play');
const btnShow = document.getElementById('btn-popup-show');

// Popula o select de RAs
selectRa.innerHTML = RA_CATALOG.map(r => `<option value="${r.name}">${r.name} (RA ${r.roman})</option>`).join('');

function showStatus(text, color = '#38bdf8') {
  statusEl.style.display = 'block';
  statusEl.style.color = color;
  statusEl.textContent = text;
}

function renderPackageInfo(pkg) {
  currentPackage = pkg;
  if (pkg?.cidade) {
    const matched = RA_CATALOG.find(r => normalizeSearchStr(r.name) === normalizeSearchStr(pkg.cidade));
    if (matched) selectRa.value = matched.name;
  }
  if (pkg?.destinoId) {
    selectDestino.value = pkg.destinoId;
  }
  if (pkg?.pdfBase64) {
    const fName = pkg.fileName || `Relatorio_alteracoes_CAESB_${(pkg.cidade || 'DF').replace(/\s+/g, '_')}.pdf`;
    const sizeStr = pkg.fileSize ? ` (${formatSize(pkg.fileSize)})` : '';
    const cidadeBadge = pkg.cidade ? `<div style="margin-top: 4px; color: #34d399; font-size: 11px; font-weight: 600;">🔒 Localidade no PDF: ${pkg.cidade} ${pkg.raRomano ? `(RA ${pkg.raRomano})` : ''}</div>` : '';
    fileInfoEl.innerHTML = `<span style="color:#34d399; font-weight:600;">📄 ${fName}${sizeStr}</span>${cidadeBadge}`;
    badgeEl.textContent = 'Pronto';
  } else {
    fileInfoEl.innerHTML = `⚠️ Selecione o PDF do relatório baixado no Netuno`;
    badgeEl.textContent = 'Subir PDF';
  }
}

fileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result || '');
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;

    const detected = detectRAFromPdfContent(base64, file.name);
    const chosenCity = detected ? detected.name : (selectRa.value || 'Brasília');
    const chosenRoman = detected ? detected.roman : getRARomanByName(chosenCity);
    if (detected) selectRa.value = detected.name;

    const newPkg = {
      ...(currentPackage || {}),
      tipo: 'caesb',
      cidade: chosenCity,
      raRomano: chosenRoman,
      fileName: file.name,
      fileSize: file.size,
      pdfBase64: base64,
      destinoId: selectDestino.value || '110037655',
      dataCriacao: new Date().toISOString()
    };

    chrome.storage.local.set({
      netuno_sei_package: newPkg,
      netuno_sei_last_package: newPkg
    }, () => {
      renderPackageInfo(newPkg);
      showStatus(`✅ PDF carregado! Cidade identificada: ${chosenCity} (RA ${chosenRoman})`, '#34d399');
    });
  };
  reader.readAsDataURL(file);
});

selectRa.addEventListener('change', () => {
  const chosenCity = selectRa.value;
  const chosenRoman = getRARomanByName(chosenCity);
  const updated = {
    ...(currentPackage || {}),
    cidade: chosenCity,
    raRomano: chosenRoman,
    destinoId: selectDestino.value || '110037655'
  };
  currentPackage = updated;
  chrome.storage.local.set({
    netuno_sei_package: updated,
    netuno_sei_last_package: updated
  });
});

selectDestino.addEventListener('change', () => {
  const updated = {
    ...(currentPackage || {}),
    destinoId: selectDestino.value
  };
  currentPackage = updated;
  chrome.storage.local.set({
    netuno_sei_package: updated,
    netuno_sei_last_package: updated
  });
});

btnPlay.addEventListener('click', () => {
  if (!currentPackage || !currentPackage.pdfBase64) {
    showStatus('⚠️ Clique em "📂 Subir PDF" acima e selecione o arquivo PDF antes de dar Play.', '#fbbf24');
    return;
  }

  currentPackage.cidade = selectRa.value;
  currentPackage.raRomano = getRARomanByName(selectRa.value);
  currentPackage.destinoId = selectDestino.value;

  btnPlay.disabled = true;
  showStatus('⏳ Acionando automação na aba do SEI...', '#38bdf8');

  chrome.runtime.sendMessage({
    action: 'netuno_dispatch_to_sei',
    command: 'netuno_start_play',
    package: currentPackage
  }, (res) => {
    btnPlay.disabled = false;
    if (res && res.success) {
      if (res.openedNewTab) {
        showStatus('✅ Aba do SEI aberta! Entre com seu login.', '#34d399');
      } else {
        showStatus('🚀 Play iniciado na aba do SEI!', '#34d399');
        setTimeout(() => window.close(), 600);
      }
    } else {
      showStatus(`⚠️ ${res?.error || 'Abra a aba do SEI DF para iniciar.'}`, '#f59e0b');
    }
  });
});

btnShow.addEventListener('click', () => {
  showStatus('⏳ Abrindo painel na tela do SEI...', '#38bdf8');
  chrome.runtime.sendMessage({
    action: 'netuno_dispatch_to_sei',
    command: 'netuno_open_panel',
    package: currentPackage
  }, (res) => {
    if (res && res.success) {
      showStatus('✅ Painel exibido na aba do SEI!', '#34d399');
      setTimeout(() => window.close(), 400);
    } else {
      showStatus(`⚠️ ${res?.error || 'Não foi possível localizar a aba do SEI.'}`, '#f59e0b');
    }
  });
});

async function initPopup() {
  const res = await chrome.storage.local.get(['netuno_sei_package', 'netuno_sei_last_package']);
  const pkg = res.netuno_sei_package || res.netuno_sei_last_package || { cidade: 'Samambaia', raRomano: 'XII', destinoId: '110037655' };
  renderPackageInfo(pkg);
}

initPopup();
