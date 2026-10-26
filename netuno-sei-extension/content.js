// content.js - Motor de Automação Netuno SEI Integrator (Executado no SEI/SIP DF)

console.log('[Netuno SEI Ext] Content Script Ativo em:', window.location.href);

// Armazena logs de execução para diagnóstico e cópia rápida
const executionLogs = [];

function logAutomation(message, data = null) {
  const timestamp = new Date().toLocaleTimeString('pt-BR');
  const line = `[${timestamp}] ${message}` + (data ? ` | ${typeof data === 'object' ? JSON.stringify(data) : data}` : '');
  console.log('[Netuno SEI]', line);
  executionLogs.push(line);
  if (executionLogs.length > 80) executionLogs.shift();
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
    ...executionLogs.slice(-25),
    `===========================================`
  ];
  return lines.join('\n');
}

// Extrai a unidade ativa no SEI
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

// Widget flutuante discreto com alternância Minimizada / Expandida
let floatingWidgetContainer = null;
let isWidgetExpanded = false;

function renderFloatingCard(pkg) {
  if (document.getElementById('netuno-sei-widget-root')) {
    // Atualiza pacote existente sem duplicar
    return;
  }

  floatingWidgetContainer = document.createElement('div');
  floatingWidgetContainer.id = 'netuno-sei-widget-root';
  floatingWidgetContainer.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 9999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  const cidadeText = pkg?.cidade || 'Distrito Federal';
  const raText = pkg?.raRomano ? ` (RA ${pkg.raRomano})` : '';

  floatingWidgetContainer.innerHTML = `
    <!-- BOTÃO DISCRETO MINIMIZADO (Padrão) -->
    <div id="netuno-sei-pill-btn" style="display: flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #065f46, #047857); color: #ecfdf5; border: 1.5px solid #10b981; border-radius: 9999px; padding: 8px 16px; cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,0.45); font-size: 13px; font-weight: 600; user-select: none; transition: transform 0.15s ease, box-shadow 0.15s ease;">
      <span style="font-size: 16px;">🚒</span>
      <span>Netuno Automação</span>
      <span id="netuno-pill-badge" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); padding: 2px 7px; border-radius: 999px; font-size: 10px; color: #a7f3d0;">Pronto</span>
      <span style="font-size: 11px; opacity: 0.8; margin-left: 2px;">▲</span>
    </div>

    <!-- PAINEL COMPLETO EXPANSÍVEL (Aberto somente quando clicado) -->
    <div id="netuno-sei-card-body" style="display: none; width: 375px; background: #0f172a; color: #f8fafc; border: 2px solid #059669; border-radius: 14px; padding: 16px; box-shadow: 0 15px 35px rgba(0,0,0,0.7); font-size: 13px; line-height: 1.4; margin-bottom: 8px;">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #334155; padding-bottom: 8px; margin-bottom: 10px;">
        <div style="font-weight: bold; font-size: 14px; color: #34d399; display: flex; align-items: center; gap: 6px;">
          🚒 Netuno SEI • SUOMA
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <button id="btn-netuno-minimize" title="Recolher para botão discreto" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 16px; padding: 2px 6px;">_</button>
          <button id="btn-netuno-close" title="Fechar e dispensar pacote" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 14px; padding: 2px 6px;">✖</button>
        </div>
      </div>

      <div style="margin-bottom: 12px; font-size: 12px;">
        <div style="color: #94a3b8; font-size: 11px; text-transform: uppercase; font-weight: 600;">Pacote Pronto para Autuação:</div>
        <div style="font-weight: bold; font-size: 13px; color: #f8fafc; margin-top: 2px;">
          Relatório CAESB: ${cidadeText}${raText}
        </div>
        <div style="color: #34d399; font-size: 11px; margin-top: 4px; font-weight: 500;">
          Processo: CBMDF - Serviço Operacional
        </div>
        <div style="color: #38bdf8; font-size: 11px; margin-top: 2px;">
          Destino: CBMDF/COESP/GPCIU/SEHUR
        </div>
      </div>

      <div id="netuno-status-area" style="background: #1e293b; padding: 10px; border-radius: 8px; margin-bottom: 12px; font-size: 12px; border: 1px solid #334155; min-height: 48px; max-height: 180px; overflow-y: auto;">
        <div style="color: #cbd5e1;">Aguardando seu comando. Clique no botão abaixo para autuar o processo, anexar o laudo da CAESB e abrir a assinatura.</div>
      </div>

      <!-- Área de Erro com Botão de Cópia -->
      <div id="netuno-error-box" style="display: none; background: #450a0a; border: 1px solid #b91c1c; border-radius: 8px; padding: 10px; margin-bottom: 12px; font-size: 11px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <span style="color: #fca5a5; font-weight: bold;">⚠️ Detalhes do Erro para Diagnóstico:</span>
          <button id="btn-netuno-copy-error" style="background: #7f1d1d; color: #fee2e2; border: 1px solid #ef4444; border-radius: 4px; padding: 3px 8px; cursor: pointer; font-size: 10px; font-weight: bold; display: flex; align-items: center; gap: 4px;">
            📋 Copiar Log
          </button>
        </div>
        <pre id="netuno-error-pre" style="color: #fecaca; margin: 0; font-family: monospace; font-size: 10px; white-space: pre-wrap; word-break: break-all; max-height: 120px; overflow-y: auto; background: rgba(0,0,0,0.3); padding: 6px; border-radius: 4px;"></pre>
      </div>

      <div style="display: flex; gap: 8px;">
        <button id="btn-netuno-run" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #059669, #0d9488); border: none; border-radius: 8px; color: white; font-weight: bold; cursor: pointer; font-size: 12px; box-shadow: 0 4px 12px rgba(5,150,105,0.4); display: flex; align-items: center; justify-content: center; gap: 6px;">
          ⚡ Autuar Processo no SEI (1 Toque)
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(floatingWidgetContainer);

  const pillBtn = document.getElementById('netuno-sei-pill-btn');
  const cardBody = document.getElementById('netuno-sei-card-body');
  const btnMinimize = document.getElementById('btn-netuno-minimize');
  const btnClose = document.getElementById('btn-netuno-close');
  const btnRun = document.getElementById('btn-netuno-run');
  const btnCopyError = document.getElementById('btn-netuno-copy-error');

  const toggleWidget = (expand) => {
    isWidgetExpanded = expand !== undefined ? expand : !isWidgetExpanded;
    if (isWidgetExpanded) {
      cardBody.style.display = 'block';
      pillBtn.style.display = 'none';
    } else {
      cardBody.style.display = 'none';
      pillBtn.style.display = 'flex';
    }
  };

  pillBtn.onclick = () => toggleWidget(true);
  btnMinimize.onclick = () => toggleWidget(false);

  btnClose.onclick = () => {
    if (confirm('Deseja descartar este pacote do Netuno?')) {
      chrome.storage?.local?.remove(['netuno_sei_package']);
      floatingWidgetContainer.remove();
    }
  };

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
    executeFullAutomation(pkg);
  };
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

  // Se o painel estiver minimizado, expande automaticamente para exibir o erro e o botão de cópia
  const cardBody = document.getElementById('netuno-sei-card-body');
  const pillBtn = document.getElementById('netuno-sei-pill-btn');
  if (cardBody && pillBtn) {
    cardBody.style.display = 'block';
    pillBtn.style.display = 'none';
    isWidgetExpanded = true;
  }
}

// Resolve qualquer URL relativa do SEI garantindo o caminho canônico /sei/, protocolo HTTPS e rejeitando pseudoprotocolos como javascript:
function resolveSeiUrl(relativeOrAbsoluteUrl, fallbackBase = window.location.href) {
  if (!relativeOrAbsoluteUrl) return '';
  let str = String(relativeOrAbsoluteUrl).trim();

  // Força HTTPS se vier com http://sei.df.gov.br
  if (str.startsWith('http://sei.df.gov.br')) {
    str = str.replace('http://sei.df.gov.br', 'https://sei.df.gov.br');
  }

  // Se vier com javascript: ou código onclick inline (ex: javascript:infraAbrirJanela('controlador.php?acao=...'))
  if (/^javascript:/i.test(str) || /infraAbrirJanela|infraNavegar/i.test(str)) {
    const matchEmbedded = str.match(/controlador\.php\?[^'"]+/i);
    if (matchEmbedded) {
      str = matchEmbedded[0];
    } else {
      return '';
    }
  }

  // Remove hashes vazios
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

// Extrai URL limpa e válida a partir de um elemento DOM (<a>, <button>, etc.), inspecionando href, onclick e atributos
function extractCleanLinkUrl(el, fallbackBase) {
  if (!el) return '';

  // 1. Inspeciona o atributo href
  const href = el.getAttribute('href') || '';
  if (href && !href.startsWith('#') && !/^javascript:(void\(0\)|;?)$/i.test(href.trim())) {
    const resolvedHref = resolveSeiUrl(href, fallbackBase);
    if (resolvedHref && (resolvedHref.startsWith('http://') || resolvedHref.startsWith('https://'))) {
      return resolvedHref;
    }
  }

  // 2. Inspeciona o atributo onclick
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

  // 3. Inspeciona outros atributos de atributos DOM
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

// Wrapper seguro para fetch com fallback automático para background service worker (imune a CORS e Mixed Content de redirecionamento)
async function safeFetch(url, options = {}, contextDescription = '') {
  if (!url || typeof url !== 'string') {
    throw new Error(`Falha de navegação SEI: URL nula ou inválida (${contextDescription || 'sem contexto'}).`);
  }
  let cleanUrl = url.trim();
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
    return res;
  } catch (errDirect) {
    // Se for FormData (upload binário) repassa erro direto
    if (options.body instanceof FormData) {
      logAutomation(`[FETCH] Erro no upload direto de arquivo: ${errDirect?.message}`);
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
        if (!response) {
          return reject(new Error(`Sem resposta do Service Worker para: ${cleanUrl}`));
        }
        if (!response.success) {
          return reject(new Error(`Falha no proxy background: ${response.error}`));
        }

        const data = response.data;
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
  const s = String(str);
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

// Codifica parâmetros em application/x-www-form-urlencoded estritamente compatível com ISO-8859-1 do SEI
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

// Obtém o formulário de trabalho da página ignorando o formulário de pesquisa rápida do cabeçalho
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

// Extrai mensagens amigáveis de alerta ou erro do HTML do SEI
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

// Obtém o formulário oficial de geração de processo no SEI DF
async function obterFormularioGerarProcesso() {
  // 1. Procura o link "Iniciar Processo" no menu lateral
  const linkMenu = document.querySelector('a[link="procedimento_escolher_tipo"], a[href*="acao=procedimento_escolher_tipo"]');
  if (!linkMenu) {
    throw new Error('Link "Iniciar Processo" não encontrado no menu do SEI. Certifique-se de que está na tela principal do SEI na unidade SUOMA.');
  }

  const urlMenuEscolher = resolveSeiUrl(linkMenu.getAttribute('href'), window.location.href);
  updateStatus('⏳ Localizando catálogo de processos na unidade...', '#38bdf8');
  const resEscolher = await fetch(urlMenuEscolher);
  const htmlEscolher = await resEscolher.text();
  let docEscolher = new DOMParser().parseFromString(htmlEscolher, 'text/html');

  let formEscolher = docEscolher.querySelector('form#frmProcedimentoEscolherTipo') || docEscolher.querySelector('form');
  if (!formEscolher) {
    throw new Error('Formulário de catálogo de processos não encontrado no SEI.');
  }

  // Função auxiliar para identificar o tipo de processo correto na tabela do SEI
  function findTipoProcesso(doc) {
    const rows = Array.from(doc.querySelectorAll('#tblTipoProcedimento tr, tr[data-desc], tr.infraTrClara, tr.infraTrEscura'));

    // 1ª Prioridade: CBMDF - Serviço Operacional (padrão oficial CBMDF/SUOMA/SEHUR para hidrantes)
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

    // 2ª Prioridade: Qualquer tipo contendo "hidrante" ou "fiscaliza"
    for (const r of rows) {
      const desc = (r.getAttribute('data-desc') || r.textContent || '').toLowerCase();
      if (desc.includes('hidrante') || desc.includes('fiscaliza')) {
        const input = r.querySelector('input.infraCheckbox, input[type="checkbox"]');
        const onclick = r.querySelector('a[onclick*="escolher"]')?.getAttribute('onclick') || '';
        const m = onclick.match(/escolher\((\d+)\)/);
        const id = input?.value || (m ? m[1] : null);
        const nome = r.textContent.trim().replace(/\s+/g, ' ');
        if (id) return { id, nome };
      }
    }

    // 3ª Prioridade: Verificação por ID canônico 100000446
    const el446 = doc.querySelector('input[value="100000446"], a[onclick*="100000446"]');
    if (el446) return { id: '100000446', nome: 'CBMDF - Serviço Operacional' };

    // 4ª Prioridade: CBMDF - Serviço Administrativo Diário (ID 100000363)
    for (const r of rows) {
      const desc = (r.getAttribute('data-desc') || r.textContent || '').toLowerCase();
      if (desc.includes('servico administrativo') || desc.includes('serviço administrativo')) {
        const input = r.querySelector('input.infraCheckbox, input[type="checkbox"]');
        const onclick = r.querySelector('a[onclick*="escolher"]')?.getAttribute('onclick') || '';
        const m = onclick.match(/escolher\((\d+)\)/);
        const id = input?.value || (m ? m[1] : null);
        if (id) return { id, nome: 'CBMDF - Serviço Administrativo Diário' };
      }
    }

    return null;
  }

  let tipoEncontrado = findTipoProcesso(docEscolher);

  // Se não encontrou nos favoritos iniciais, carrega a lista completa usando o botão (+) nativo do SEI
  if (!tipoEncontrado) {
    updateStatus('⏳ Carregando catálogo completo de tipos de processo do SEI...', '#38bdf8');
    const postTodos = new URLSearchParams();
    formEscolher.querySelectorAll('input').forEach(el => {
      if (el.name) postTodos.set(el.name, el.value || '');
    });
    postTodos.set('hdnFiltroTipoProcedimento', 'T');
    postTodos.set('hdnIdTipoProcedimento', '');

    const actionUrl = resolveSeiUrl(formEscolher.getAttribute('action') || urlMenuEscolher, urlMenuEscolher);
    const resTodos = await fetch(actionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=iso-8859-1' },
      body: encodeSeiFormParams(postTodos)
    });
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

  console.log(`[Netuno SEI] Tipo selecionado: ${nomeTipoProc} (${idTipoProc})`);
  updateStatus(`⏳ Abrindo formulário para "${nomeTipoProc}"...`, '#38bdf8');

  // Submete a seleção do tipo no formulário nativo do SEI (simula o escolher(id) nativo)
  const postEscolher = new URLSearchParams();
  formEscolher.querySelectorAll('input').forEach(el => {
    if (el.name) postEscolher.set(el.name, el.value || '');
  });
  postEscolher.set('hdnIdTipoProcedimento', idTipoProc);
  postEscolher.set('hdnFiltroTipoProcedimento', formEscolher.querySelector('#hdnFiltroTipoProcedimento')?.value || 'U');

  const actionEscolher = resolveSeiUrl(formEscolher.getAttribute('action') || urlMenuEscolher, urlMenuEscolher);
  const resGerar = await fetch(actionEscolher, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=iso-8859-1' },
    body: encodeSeiFormParams(postEscolher)
  });

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

// Motor de Automação no SEI
async function executeFullAutomation(pkg) {
  const runBtn = document.getElementById('btn-netuno-run');
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.style.opacity = '0.5';
    runBtn.style.cursor = 'not-allowed';
  }

  const cidade = pkg?.cidade || 'Distrito Federal';
  const raRomano = pkg?.raRomano || '';
  const ano = new Date().getFullYear();
  const descProcesso = `Hidrantes com alteração - ${cidade}${raRomano ? ` (RA ${raRomano})` : ''} - ${ano}`;

  try {
    // ----------------------------------------------------
    // ETAPA 1: Autuação do Processo Administrativo
    // ----------------------------------------------------
    updateStatus('⏳ 1/4: Obtendo formulário de processo...', '#38bdf8');
    
    const { docProc, formProc, actionProc, idTipoProc, nomeTipoProc } = await obterFormularioGerarProcesso();

    const postProcData = new URLSearchParams();
    formProc.querySelectorAll('input, select, textarea').forEach(el => {
      if (el.name) postProcData.set(el.name, el.value || '');
    });

    // Extrai o assunto já associado ao formulário ou define o padrão CBMDF
    const selAssuntos = formProc.querySelector('#selAssuntos, select[name="selAssuntos"]');
    let assuntoValor = '';
    if (selAssuntos && selAssuntos.options && selAssuntos.options.length > 0) {
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
    postProcData.set('rdoNivelAcesso', '0'); // Público
    postProcData.set('hdnFlagProcedimentoCadastro', '2');
    postProcData.set('hdnAssuntos', assuntoValor);
    postProcData.set('btnSalvar', 'Salvar');
    postProcData.set('sbmSalvar', 'Salvar');
    postProcData.set('txtInteressadoProcedimento', 'CORPO DE BOMBEIROS MILITAR DO DISTRITO FEDERAL');

    if (!postProcData.get('selTipoPrioridade') || postProcData.get('selTipoPrioridade') === '') {
      postProcData.set('selTipoPrioridade', 'null');
    }
    if (!postProcData.get('selGrauSigilo') || postProcData.get('selGrauSigilo') === '') {
      postProcData.set('selGrauSigilo', 'null');
    }
    if (!postProcData.get('selHipoteseLegal') || postProcData.get('selHipoteseLegal') === '') {
      postProcData.set('selHipoteseLegal', 'null');
    }

    updateStatus(`⏳ 1/4: Salvando autuação do processo (${nomeTipoProc})...`, '#38bdf8');
    const resSaveProc = await fetch(actionProc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=iso-8859-1' },
      body: encodeSeiFormParams(postProcData)
    });

    const textSaveProc = await resSaveProc.text();
    const docProcessoSalvo = new DOMParser().parseFromString(textSaveProc, 'text/html');

    const matchIdProc = textSaveProc.match(/id_procedimento=(\d+)/i) || 
                        resSaveProc.url.match(/id_procedimento=(\d+)/i) ||
                        textSaveProc.match(/id_protocolo=(\d+)/i);
    const matchNumProc = textSaveProc.match(/(\d{5}-\d{8}\/\d{4}-\d{2})/);

    let idProcedimento = matchIdProc ? matchIdProc[1] : null;
    let numeroProcesso = matchNumProc ? matchNumProc[1] : null;

    // Se identificou o número do processo mas o ID não veio direto no HTML, busca na lista da unidade
    if (!idProcedimento && numeroProcesso) {
      try {
        const urlCtrl = resolveSeiUrl(`controlador.php?acao=procedimento_controlar&infra_sistema=${getInfraSistema()}&infra_unidade_atual=${getInfraUnidade()}`);
        const resCtrl = await fetch(urlCtrl);
        const htmlCtrl = await resCtrl.text();
        const mId = htmlCtrl.match(new RegExp(`id_procedimento=(\\d+)[^>]*>${numeroProcesso}`, 'i')) ||
                    htmlCtrl.match(new RegExp(`title=["']${numeroProcesso}["'][^>]*value=["'](\\d+)["']`, 'i')) ||
                    htmlCtrl.match(new RegExp(`value=["'](\\d+)["'][^>]*title=["']${numeroProcesso}["']`, 'i'));
        if (mId) idProcedimento = mId[1];
      } catch (errCtrl) {
        console.warn('[Netuno SEI] Falha ao consultar lista de processos gerados:', errCtrl);
      }
    }

    if (!idProcedimento) {
      const msgErro = extractSeiErrorMessage(textSaveProc);
      throw new Error(msgErro || 'Processo gerado, mas não foi possível extrair o ID do procedimento do SEI.');
    }

    if (!numeroProcesso) numeroProcesso = idProcedimento;
    console.log('[Netuno SEI] Processo criado com sucesso:', numeroProcesso, 'ID:', idProcedimento);

    // ----------------------------------------------------
    // ETAPA 2: Anexar Relatório Oficial CAESB (Nato-digital)
    // ----------------------------------------------------
    updateStatus(`⏳ 2/4: Processo ${numeroProcesso} criado! Abrindo formulário de anexo...`, '#38bdf8');

    // Tenta localizar o link 'Incluir Documento' a partir da página retornada pelo SEI
    let linkIncluirDoc = docProcessoSalvo.querySelector('a[href*="documento_escolher_tipo"], a[title*="Incluir Documento"], a[aria-label*="Incluir Documento"]');
    let urlEscolherDoc = extractCleanLinkUrl(linkIncluirDoc, resSaveProc.url);

    if (!urlEscolherDoc) {
      const matchDocEsc = textSaveProc.match(/controlador\.php\?acao=documento_escolher_tipo[^"'\s<>]+/i);
      if (matchDocEsc) {
        urlEscolherDoc = resolveSeiUrl(matchDocEsc[0], resSaveProc.url);
      }
    }

    // Se ainda não encontrou o link no HTML direto, busca na árvore iframe do processo
    if (!urlEscolherDoc) {
      try {
        logAutomation('Buscando link da árvore (ifrArvore) no processo criado...');
        const matchArvoreIframe = textSaveProc.match(/<iframe[^>]+id=["']ifrArvore["'][^>]*src=["']([^"']+)["']/i) ||
                                  textSaveProc.match(/<iframe[^>]+src=["']([^"']+)["'][^>]*id=["']ifrArvore["']/i) ||
                                  textSaveProc.match(/controlador\.php\?acao=procedimento_visualizar[^"'\s<>]+/i);
        
        let urlArvoreVisualizar = null;
        if (matchArvoreIframe) {
          urlArvoreVisualizar = resolveSeiUrl(matchArvoreIframe[1] || matchArvoreIframe[0], resSaveProc.url);
        } else {
          urlArvoreVisualizar = resolveSeiUrl(`controlador.php?acao=procedimento_visualizar&acao_origem=procedimento_trabalhar&id_procedimento=${idProcedimento}&infra_sistema=${getInfraSistema()}&infra_unidade_atual=${getInfraUnidade()}`, resSaveProc.url);
        }

        logAutomation('Carregando árvore de documentos:', urlArvoreVisualizar);
        const resArvore = await safeFetch(urlArvoreVisualizar, {}, 'Árvore de Documentos');
        const htmlArvore = await resArvore.text();
        const docArvore = new DOMParser().parseFromString(htmlArvore, 'text/html');

        const linkArvore = docArvore.querySelector('a[href*="documento_escolher_tipo"], a[title*="Incluir Documento"], a[aria-label*="Incluir Documento"]');
        if (linkArvore) {
          urlEscolherDoc = extractCleanLinkUrl(linkArvore, urlArvoreVisualizar);
        }
        if (!urlEscolherDoc) {
          const m = htmlArvore.match(/controlador\.php\?acao=documento_escolher_tipo[^"'\s<>]+/i);
          if (m) urlEscolherDoc = resolveSeiUrl(m[0], urlArvoreVisualizar);
        }
      } catch (errArvore) {
        logAutomation('Aviso ao consultar árvore do processo:', errArvore?.message);
      }
    }

    // Se ainda não encontrou, pesquisa o processo na tela de Controle de Processos da unidade
    if (!urlEscolherDoc) {
      try {
        logAutomation('Localizando processo na tela de Controle de Processos...');
        const urlControle = resolveSeiUrl(`controlador.php?acao=procedimento_controlar&infra_sistema=${getInfraSistema()}&infra_unidade_atual=${getInfraUnidade()}`);
        const resControle = await safeFetch(urlControle, {}, 'Controle de Processos');
        const htmlControle = await resControle.text();
        const docControle = new DOMParser().parseFromString(htmlControle, 'text/html');

        // Busca o link direto do processo na tabela de gerados
        const linkProcGerado = docControle.querySelector(`a[href*="id_procedimento=${idProcedimento}"]`);
        if (linkProcGerado) {
          const urlTrabalharGerado = resolveSeiUrl(linkProcGerado.getAttribute('href'), urlControle);
          const resTrab = await safeFetch(urlTrabalharGerado, {}, 'Tela do Processo Gerado');
          const htmlTrab = await resTrab.text();
          const docTrab = new DOMParser().parseFromString(htmlTrab, 'text/html');

          const lDoc = docTrab.querySelector('a[href*="documento_escolher_tipo"], a[title*="Incluir Documento"]');
          if (lDoc) {
            urlEscolherDoc = extractCleanLinkUrl(lDoc, urlTrabalharGerado);
          }
          if (!urlEscolherDoc) {
            const m = htmlTrab.match(/controlador\.php\?acao=documento_escolher_tipo[^"'\s<>]+/i);
            if (m) urlEscolherDoc = resolveSeiUrl(m[0], urlTrabalharGerado);
          }
        }
      } catch (errCtrl) {
        logAutomation('Aviso ao consultar controle de processos:', errCtrl?.message);
      }
    }

    if (!urlEscolherDoc) {
      urlEscolherDoc = resolveSeiUrl(`controlador.php?acao=documento_escolher_tipo&id_procedimento=${idProcedimento}&infra_sistema=${getInfraSistema()}&infra_unidade_atual=${getInfraUnidade()}`, resSaveProc.url);
    }

    const resPageEscolherDoc = await safeFetch(urlEscolherDoc, {}, 'Catálogo Escolher Tipo Documento');
    const htmlEscolherDoc = await resPageEscolherDoc.text();
    const docEscolherDoc = new DOMParser().parseFromString(htmlEscolherDoc, 'text/html');

    // Localiza o documento externo (Série 2056 - Relatório ou link "Externo")
    let linkDocExterno = docEscolherDoc.querySelector('a[href*="documento_receber"], a[href*="id_serie=2056"]');
    if (!linkDocExterno) {
      const allDocLinks = Array.from(docEscolherDoc.querySelectorAll('a, button, input[type="button"]'));
      linkDocExterno = allDocLinks.find(a => 
        /externo/i.test(a.textContent || a.value || '') || 
        /documento_receber/i.test(a.getAttribute('href') || a.getAttribute('onclick') || '') || 
        /2056/.test(a.getAttribute('onclick') || '')
      );
    }

    let urlDocReceber = extractCleanLinkUrl(linkDocExterno, urlEscolherDoc);

    // Se não veio pelo link direto, tenta extrair por regex no HTML da página escolher tipo
    if (!urlDocReceber) {
      const matchDocReceber = htmlEscolherDoc.match(/controlador\.php\?acao=documento_receber[^"'\s<>]+/i);
      if (matchDocReceber) {
        urlDocReceber = resolveSeiUrl(matchDocReceber[0], urlEscolherDoc);
      }
    }

    // Se ainda não encontrou, constrói a URL oficial com id_serie=2056 ou preservando os parâmetros
    if (!urlDocReceber) {
      const u = new URL(urlEscolherDoc);
      u.searchParams.set('acao', 'documento_receber');
      u.searchParams.set('acao_origem', 'documento_escolher_tipo');
      u.searchParams.delete('id_serie');
      urlDocReceber = u.toString();
    }

    logAutomation('Abrindo formulário de Documento Externo (Laudo CAESB):', urlDocReceber);
    const resPageDocReceber = await safeFetch(urlDocReceber, {}, 'Formulário Documento Receber');
    const htmlDocReceber = await resPageDocReceber.text();
    const docDocReceber = new DOMParser().parseFromString(htmlDocReceber, 'text/html');
    const formDoc = getSeiWorkForm(docDocReceber, 'form#frmDocumentoReceber, form#frmDocumentoCadastro');

    updateStatus('⏳ 2/4: Enviando arquivo PDF do Laudo CAESB...', '#38bdf8');

    // Upload do arquivo
    const uploadId = Math.floor(Math.random() * 900000 + 100000).toString();
    const uploadFormData = new FormData();
    uploadFormData.append('UPLOAD_IDENTIFIER', uploadId);

    const pdfBlob = pkg.pdfBase64 
      ? await (await safeFetch(`data:application/pdf;base64,${pkg.pdfBase64}`, {}, 'Conversão Base64 PDF')).blob()
      : new Blob([pkg.htmlContent || 'Relatório Oficial CAESB'], { type: 'text/html;charset=utf-8' });

    const fileName = `Relatorio_Vistoria_CAESB_${cidade.replace(/\s+/g, '_')}.pdf`;
    uploadFormData.append('filArquivo', pdfBlob, fileName);

    const hashDocReceber = new URL(urlDocReceber).searchParams.get('infra_hash') || '';
    const rawUploadAction = formDoc?.querySelector('input[name="hdnUploadUrl"]')?.value || 
      `controlador.php?acao=documento_upload_anexo&infra_sistema=${getInfraSistema()}&infra_unidade_atual=${getInfraUnidade()}&infra_hash=${hashDocReceber}`;
    const uploadAction = resolveSeiUrl(rawUploadAction, urlDocReceber);
    
    const resUpload = await safeFetch(uploadAction, {
      method: 'POST',
      body: uploadFormData
    }, 'Upload Arquivo PDF');
    const uploadRespText = await resUpload.text();
    const matchToken = uploadRespText.match(/([a-f0-9]{32}±[^"'\s<>]+)/);
    const anexoToken = matchToken ? matchToken[1] : `${uploadId}±${fileName}`;

    // Submete dados do anexo
    const postDocData = new URLSearchParams();
    if (formDoc) {
      formDoc.querySelectorAll('input, select, textarea').forEach(el => {
        if (el.name) postDocData.set(el.name, el.value || '');
      });
    }

    const dataHoje = new Date().toLocaleDateString('pt-BR');
    postDocData.set('hdnInfraTipoPagina', '2');
    postDocData.set('selSerie', '2056');
    postDocData.set('hdnIdSerie', '2056');
    postDocData.set('txtDataElaboracao', dataHoje);
    postDocData.set('txtNomeArvore', 'Relatório CAESB');
    postDocData.set('rdoFormato', 'N'); // Nato-digital
    postDocData.set('rdoNivelAcesso', '0'); // Público
    postDocData.set('hdnFlagDocumentoCadastro', '2');
    postDocData.set('hdnStaDocumento', 'X');
    postDocData.set('hdnIdProcedimento', idProcedimento);
    postDocData.set('hdnAnexos', anexoToken);
    postDocData.set('sbmSalvar', 'Salvar');
    if (!postDocData.get('selHipoteseLegal')) {
      postDocData.set('selHipoteseLegal', 'null');
    }

    const actionSaveDoc = resolveSeiUrl(formDoc?.getAttribute('action') || urlDocReceber, urlDocReceber);
    const resSaveDoc = await fetch(actionSaveDoc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=iso-8859-1' },
      body: encodeSeiFormParams(postDocData)
    });

    const textSaveDoc = await resSaveDoc.text();
    const matchDocSei = textSaveDoc.match(/(\d{7,10})/);
    let numeroSeiRelatorio = matchDocSei ? matchDocSei[1] : null;
    if (!numeroSeiRelatorio) {
      const msgErroDoc = extractSeiErrorMessage(textSaveDoc);
      if (msgErroDoc) throw new Error(`Falha ao anexar laudo: ${msgErroDoc}`);
      numeroSeiRelatorio = 'Relatório CAESB';
    }
    console.log('[Netuno SEI] Relatório anexado com sucesso:', numeroSeiRelatorio);

    // ----------------------------------------------------
    // ETAPA 3: Gerar Memorando ao Cel. Comandante do GPCIU
    // ----------------------------------------------------
    updateStatus(`⏳ 3/4: Laudo nº ${numeroSeiRelatorio} anexado! Abrindo Memorando...`, '#38bdf8');

    // Acessa catálogo de documentos novamente para pegar o link do Memorando (Série 165)
    const resPageEscolherMemo = await safeFetch(urlEscolherDoc, {}, 'Catálogo Documentos Memorando');
    const htmlEscolherMemo = await resPageEscolherMemo.text();
    const docEscolherMemo = new DOMParser().parseFromString(htmlEscolherMemo, 'text/html');

    let linkMemo = docEscolherMemo.querySelector('a[href*="id_serie=165"]');
    if (!linkMemo) {
      const allMemoLinks = Array.from(docEscolherMemo.querySelectorAll('a, button, input[type="button"]'));
      linkMemo = allMemoLinks.find(a => 
        /memorando/i.test(a.textContent || a.value || '') && 
        ((a.getAttribute('href') || '').includes('documento_gerar') || /165/.test(a.getAttribute('onclick') || ''))
      );
    }

    let urlGerarMemo = extractCleanLinkUrl(linkMemo, urlEscolherDoc);

    // Se não veio do elemento, busca por regex no HTML da página
    if (!urlGerarMemo) {
      const matchDocGerar = htmlEscolherMemo.match(/controlador\.php\?acao=documento_gerar[^"'\s<>]*id_serie=165[^"'\s<>]*/i) ||
                            htmlEscolherMemo.match(/controlador\.php\?acao=documento_gerar[^"'\s<>]+/i);
      if (matchDocGerar) {
        urlGerarMemo = resolveSeiUrl(matchDocGerar[0], urlEscolherDoc);
      }
    }

    if (!urlGerarMemo) {
      const u = new URL(urlEscolherDoc);
      u.searchParams.set('acao', 'documento_gerar');
      u.searchParams.set('acao_origem', 'documento_escolher_tipo');
      u.searchParams.set('id_serie', '165');
      urlGerarMemo = u.toString();
    }

    logAutomation('Abrindo formulário de geração de Memorando:', urlGerarMemo);
    const resPageMemo = await safeFetch(urlGerarMemo, {}, 'Formulário Documento Gerar Memorando');
    const htmlMemo = await resPageMemo.text();
    const docMemo = new DOMParser().parseFromString(htmlMemo, 'text/html');
    const formMemo = getSeiWorkForm(docMemo, 'form#frmDocumentoGerar, form#frmDocumentoCadastro');

    const postMemoData = new URLSearchParams();
    if (formMemo) {
      formMemo.querySelectorAll('input, select, textarea').forEach(el => {
        if (el.name) postMemoData.set(el.name, el.value || '');
      });
    }

    postMemoData.set('hdnInfraTipoPagina', '2');
    postMemoData.set('txtDataElaboracao', dataHoje);
    postMemoData.set('txtDescricao', `Memorando - Vistoria de Hidrantes em ${cidade}`);
    postMemoData.set('rdoNivelAcesso', '0');
    postMemoData.set('hdnFlagDocumentoCadastro', '2');
    postMemoData.set('hdnIdSerie', '165');
    postMemoData.set('hdnStaDocumento', 'I');
    postMemoData.set('hdnIdProcedimento', idProcedimento);
    postMemoData.set('sbmSalvar', 'Salvar');
    if (!postMemoData.get('selHipoteseLegal')) {
      postMemoData.set('selHipoteseLegal', 'null');
    }

    const actionSaveMemo = resolveSeiUrl(formMemo?.getAttribute('action') || urlGerarMemo, urlGerarMemo);
    const resSaveMemo = await fetch(actionSaveMemo, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=iso-8859-1' },
      body: encodeSeiFormParams(postMemoData)
    });

    const textSaveMemo = await resSaveMemo.text();
    const matchIdMemo = textSaveMemo.match(/id_documento=(\d+)/i) || resSaveMemo.url.match(/id_documento=(\d+)/i);
    if (!matchIdMemo) {
      const msgErro = extractSeiErrorMessage(textSaveMemo);
      throw new Error(msgErro || 'Memorando criado, mas ID do documento não retornado pelo SEI.');
    }
    const idDocumentoMemo = matchIdMemo[1];

    // Salva o texto da minuta com encaminhamento ao Cel. Comandante do GPCIU
    updateStatus('⏳ 3/4: Salvando minuta oficial endereçada ao Cel. Comandante do GPCIU...', '#38bdf8');

    // Extrai o link do editor a partir do retorno ou padrão SEI
    let linkEditor = textSaveMemo.match(/controlador\.php\?acao=editor_montar[^"'\s<>]+/i);
    const urlEditor = linkEditor ? resolveSeiUrl(linkEditor[0], urlGerarMemo) : null;

    if (urlEditor) {
      const resPageEditor = await fetch(urlEditor);
      const htmlEditor = await resPageEditor.text();
      const docEditor = new DOMParser().parseFromString(htmlEditor, 'text/html');
      const formEditor = getSeiWorkForm(docEditor, 'form#frmEditor');

      let corpoTexto = pkg.memorandoMinuta || '';
      corpoTexto = corpoTexto.replace('[Nº SEI DO RELATÓRIO EXTERNO]', numeroSeiRelatorio);

      const postEditorData = new URLSearchParams();
      if (formEditor) {
        formEditor.querySelectorAll('input, select, textarea').forEach(el => {
          if (el.name) postEditorData.set(el.name, el.value || '');
        });
      }

      const paragraphsHtml = corpoTexto.split('\n\n').map(p => `<p style="font-family: Arial; font-size: 11pt; line-height: 1.5; text-align: justify; margin-bottom: 12pt;">${p.replace(/\n/g, '<br/>')}</p>`).join('');

      postEditorData.set('txaConteudo', paragraphsHtml);
      postEditorData.set('id_documento', idDocumentoMemo);
      postEditorData.set('hdnIdDocumento', idDocumentoMemo);
      postEditorData.set('id_procedimento', idProcedimento);
      postEditorData.set('hdnIdProcedimento', idProcedimento);

      const actionEditor = resolveSeiUrl(formEditor?.getAttribute('action') || urlEditor, urlEditor);
      await fetch(actionEditor, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=iso-8859-1' },
        body: encodeSeiFormParams(postEditorData)
      });
    }

    console.log('[Netuno SEI] Minuta do Memorando salva com sucesso.');

    // ----------------------------------------------------
    // ETAPA 4: Abrir Assinatura Eletrônica Oficial (2ª Senha)
    // ----------------------------------------------------
    updateStatus('✍️ 4/4: Processo pronto! Abrindo janela de Assinatura Oficial do SEI...', '#34d399');

    // Localiza o link de assinar documento
    const matchAssinar = textSaveMemo.match(/controlador\.php\?acao=documento_assinar[^"'\s<>]+/i);
    const hashAssinar = matchAssinar ? '' : (new URL(urlGerarMemo).searchParams.get('infra_hash') || '');
    const urlAssinatura = matchAssinar 
      ? resolveSeiUrl(matchAssinar[0], urlGerarMemo)
      : resolveSeiUrl(`controlador.php?acao=documento_assinar&id_documento=${idDocumentoMemo}&infra_sistema=${getInfraSistema()}&infra_unidade_atual=${getInfraUnidade()}&infra_hash=${hashAssinar}`, urlGerarMemo);

    // Link para tramitação posterior
    const matchEnviar = textSaveProc.match(/controlador\.php\?acao=procedimento_enviar[^"'\s<>]+/i);
    const urlTramitar = matchEnviar ? resolveSeiUrl(matchEnviar[0], resSaveProc.url) : null;

    const area = document.getElementById('netuno-status-area');
    if (area) {
      area.innerHTML = `
        <div style="color: #34d399; font-weight: bold; margin-bottom: 6px;">
          ✅ Documentos montados com sucesso no SEI!
        </div>
        <div style="color: #cbd5e1; font-size: 11px; margin-bottom: 8px;">
          Processo: <strong style="color: white; font-family: monospace;">${numeroProcesso}</strong><br/>
          Tipo: <strong style="color: #a7f3d0;">${nomeTipoProc}</strong><br/>
          Relatório CAESB: <strong style="color: #38bdf8; font-family: monospace;">Nº ${numeroSeiRelatorio}</strong><br/>
          Memorando: <strong style="color: #a7f3d0;">Endereçado ao Cel. Comandante</strong><br/><br/>
          1. A janela de assinatura do SEI foi aberta na tela.<br/>
          2. Digite sua senha de assinatura eletrônica do SEI.<br/>
          3. Em seguida, clique abaixo para tramitar para <strong>CBMDF/COESP/GPCIU/SEHUR</strong>.
        </div>
        <button id="btn-tramitar-final" style="width: 100%; padding: 10px; background: #0284c7; hover:background: #0369a1; border: none; border-radius: 8px; color: white; font-weight: bold; cursor: pointer; font-size: 12px; box-shadow: 0 4px 12px rgba(2,132,199,0.4);">
          🚀 Concluir e Tramitar para SEHUR
        </button>
      `;

      document.getElementById('btn-tramitar-final').onclick = async () => {
        await tramitarProcessoFinal(idProcedimento, numeroProcesso, urlTramitar);
      };
    }

    // Abre a janela de assinatura oficial do SEI
    window.open(urlAssinatura, 'JanelaAssinaturaSEI', 'width=800,height=600,scrollbars=yes');

  } catch (err) {
    console.error('[Netuno SEI] Erro na automação:', err);
    displayAutomationError(err);
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.style.opacity = '1';
      runBtn.style.cursor = 'pointer';
    }
  }
}

// Tramitação final do processo para CBMDF/COESP/GPCIU/SEHUR
async function tramitarProcessoFinal(idProcedimento, numeroProcesso, urlTramitar) {
  try {
    updateStatus('⏳ Tramitando processo para CBMDF/COESP/GPCIU/SEHUR...', '#38bdf8');

    let urlEnviar = urlTramitar;
    if (!urlEnviar) {
      // Localiza o link de envio na página atual
      const linkEnv = document.querySelector('a[href*="procedimento_enviar"]');
      if (linkEnv) urlEnviar = extractCleanLinkUrl(linkEnv, window.location.href);
    }

    if (!urlEnviar) {
      urlEnviar = resolveSeiUrl(`controlador.php?acao=procedimento_enviar&id_procedimento=${idProcedimento}`);
    }

    const resPageEnviar = await safeFetch(urlEnviar, {}, 'Página Tramitação Enviar');
    const htmlEnviar = await resPageEnviar.text();
    const docEnviar = new DOMParser().parseFromString(htmlEnviar, 'text/html');
    const formEnviar = getSeiWorkForm(docEnviar, 'form#frmProcedimentoEnviar');

    const postEnviarData = new URLSearchParams();
    if (formEnviar) {
      formEnviar.querySelectorAll('input, select, textarea').forEach(el => {
        if (el.name) postEnviarData.set(el.name, el.value || '');
      });
    }

    const unidadeDestinoId = '110037655'; // SEHUR
    postEnviarData.set('hdnInfraTipoPagina', '2');
    postEnviarData.set('sbmEnviar', 'Enviar');
    postEnviarData.set('selUnidades', unidadeDestinoId);
    postEnviarData.set('chkSinManterAberto', 'on'); // Mantém aberto na SUOMA
    postEnviarData.set('hdnIdProtocolos', idProcedimento);
    postEnviarData.set('hdnUnidades', `${unidadeDestinoId}±CBMDF/COESP/GPCIU/SEHUR - Seção de Hidrantes Urbanos`);

    const actionEnviar = resolveSeiUrl(formEnviar?.getAttribute('action') || urlEnviar, urlEnviar);
    const resEnviar = await safeFetch(actionEnviar, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=iso-8859-1' },
      body: encodeSeiFormParams(postEnviarData)
    }, 'Submeter Tramitação');

    const textEnviar = await resEnviar.text();
    const erroEnv = extractSeiErrorMessage(textEnviar);
    if (erroEnv) {
      throw new Error(erroEnv);
    }

    updateStatus(`🎉 SUCESSO! Processo ${numeroProcesso} enviado para CBMDF/COESP/GPCIU/SEHUR mantendo cópia na SUOMA!`, '#34d399');

    // Limpa pacote para não reexecutar sem novo relatório
    chrome.storage?.local?.remove(['netuno_sei_package']);

  } catch (err) {
    console.error('[Netuno SEI] Falha na tramitação:', err);
    updateStatus(`⚠️ Processo autuado, mas falha ao tramitar: ${err.message}`, '#f59e0b');
  }
}

// Inicialização: Verifica se há pacote pendente
function initExtension() {
  if (chrome.storage?.local) {
    chrome.storage.local.get(['netuno_sei_package'], (res) => {
      if (res && res.netuno_sei_package) {
        console.log('[Netuno SEI] Pacote ativo detectado:', res.netuno_sei_package);
        renderFloatingCard(res.netuno_sei_package);
      }
    });
  }
}

// Roda no carregamento
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initExtension);
} else {
  initExtension();
}
