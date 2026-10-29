// background.js - Service Worker do Netuno SEI Integrator (MV3)

console.log('[Netuno SEI Ext] Background Service Worker Ativo (v1.9)');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'netuno_bg_fetch') {
    handleBackgroundFetch(request)
      .then(res => sendResponse({ success: true, data: res }))
      .catch(err => {
        console.error('[Netuno SEI BG] Erro no background fetch:', err);
        sendResponse({ success: false, error: err.message || String(err) });
      });
    return true; // Comunicação assíncrona
  }

  if (request.action === 'netuno_sync_from_netuno_tabs') {
    syncPackageFromOpenNetunoTabs()
      .then(pkg => sendResponse({ success: !!pkg, package: pkg }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'netuno_dispatch_to_sei') {
    dispatchCommandToSeiTab(request.command, request.package)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// Busca em qualquer aba aberta do Netuno o pacote mais recente no localStorage
async function syncPackageFromOpenNetunoTabs() {
  const tabs = await chrome.tabs.query({
    url: [
      'https://netuno-eight.vercel.app/*',
      'http://localhost/*',
      'http://127.0.0.1/*'
    ]
  });

  for (const tab of tabs) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          try {
            const rawActive = localStorage.getItem('netuno_sei_active_package');
            if (rawActive) return JSON.parse(rawActive);
            const rawData = localStorage.getItem('netuno_sei_data');
            if (rawData) return JSON.parse(rawData);
          } catch (_) {}
          return null;
        }
      });

      const foundPkg = results?.[0]?.result;
      if (foundPkg) {
        await chrome.storage.local.set({
          netuno_sei_package: foundPkg,
          netuno_sei_last_package: foundPkg
        });
        return foundPkg;
      }
    } catch (e) {
      console.warn('[Netuno SEI BG] Não foi possível ler aba Netuno:', e);
    }
  }

  // Fallback para o último pacote salvo no storage
  const stored = await chrome.storage.local.get(['netuno_sei_package', 'netuno_sei_last_package']);
  const fallbackPkg = stored.netuno_sei_package || stored.netuno_sei_last_package || null;
  if (fallbackPkg && !stored.netuno_sei_package) {
    await chrome.storage.local.set({ netuno_sei_package: fallbackPkg });
  }
  return fallbackPkg;
}

// Localiza (ou abre) a aba do SEI, garante que o content.js está injetado e envia o comando (abrir painel ou dar Play)
async function dispatchCommandToSeiTab(command, pkg = null) {
  if (pkg) {
    await chrome.storage.local.set({
      netuno_sei_package: pkg,
      netuno_sei_last_package: pkg
    });
  }

  // 1. Verifica se a aba ativa atual já é do SEI/SIP
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let targetTab = null;

  if (activeTab && activeTab.url && (activeTab.url.includes('sei.df.gov.br') || activeTab.url.includes('sip.df.gov.br'))) {
    targetTab = activeTab;
  } else {
    // 2. Procura qualquer aba aberta do SEI/SIP
    const seiTabs = await chrome.tabs.query({
      url: ['*://sei.df.gov.br/*', '*://sip.df.gov.br/*']
    });
    if (seiTabs.length > 0) {
      targetTab = seiTabs[0];
      await chrome.tabs.update(targetTab.id, { active: true });
      if (targetTab.windowId) {
        await chrome.windows.update(targetTab.windowId, { focused: true });
      }
    }
  }

  // 3. Se não houver nenhuma aba do SEI aberta, abre uma nova aba
  if (!targetTab) {
    await chrome.storage.local.set({
      netuno_sei_panel_open: true,
      netuno_sei_auto_play: command === 'netuno_start_play'
    });
    const newTab = await chrome.tabs.create({ url: 'https://sei.df.gov.br' });
    return {
      success: true,
      openedNewTab: true,
      tabId: newTab.id,
      message: 'Aba do SEI DF aberta! Faça o login e o painel abrirá automaticamente.'
    };
  }

  // 4. Tenta enviar mensagem para o content.js na aba do SEI; se não responder, injeta o content.js na hora
  try {
    const response = await chrome.tabs.sendMessage(targetTab.id, {
      action: command,
      package: pkg
    });
    return { success: true, response };
  } catch (err) {
    console.log('[Netuno SEI BG] Injetando content.js na aba do SEI já aberta...');
    await chrome.scripting.executeScript({
      target: { tabId: targetTab.id },
      files: ['content.js']
    });
    // Aguarda breve inicialização e reenvia comando
    await new Promise(r => setTimeout(r, 250));
    const response = await chrome.tabs.sendMessage(targetTab.id, {
      action: command,
      package: pkg
    });
    return { success: true, response };
  }
}

async function handleBackgroundFetch({ url, method = 'GET', headers = {}, body = null }) {
  let targetUrl = url;
  if (targetUrl.startsWith('http://sei.df.gov.br')) {
    targetUrl = targetUrl.replace('http://sei.df.gov.br', 'https://sei.df.gov.br');
  }

  const fetchOptions = {
    method,
    headers: { ...headers },
    credentials: 'include',
    redirect: 'follow'
  };

  if (body && method !== 'GET' && method !== 'HEAD') {
    fetchOptions.body = body;
  }

  const response = await fetch(targetUrl, fetchOptions);
  let finalUrl = response.url;
  if (finalUrl.startsWith('http://sei.df.gov.br')) {
    finalUrl = finalUrl.replace('http://sei.df.gov.br', 'https://sei.df.gov.br');
  }
  const text = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    url: finalUrl,
    text
  };
}
