// netuno-bridge.js - Ponte de dados entre o Web App Netuno e a Extensão SEI

console.log('[Netuno SEI Bridge] Inicializado na página do Netuno.');

// Informa ao Web App que a extensão está presente e ativa
try {
  window.sessionStorage.setItem('netuno_sei_ext_installed', 'true');
  window.postMessage({ type: 'NETUNO_SEI_EXTENSION_INSTALLED', version: '1.9' }, '*');
} catch (_) {}

// Extrai o pacote mais recente salvo no localStorage do Netuno
function getLocalNetunoPackage() {
  try {
    const rawActive = localStorage.getItem('netuno_sei_active_package');
    if (rawActive) return JSON.parse(rawActive);
    const rawData = localStorage.getItem('netuno_sei_data');
    if (rawData) return JSON.parse(rawData);
  } catch (_) {}
  return null;
}

// Escuta mensagens do Netuno App com pacotes de relatório CAESB
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'NETUNO_SEI_SEND_PACKAGE') {
    const payload = event.data.payload;
    console.log('[Netuno SEI Bridge] Pacote recebido do Netuno:', payload?.cidade);

    if (chrome.runtime?.id && payload) {
      chrome.storage.local.set({
        netuno_sei_package: payload,
        netuno_sei_last_package: payload,
        netuno_sei_panel_open: true
      }, () => {
        console.log('[Netuno SEI Bridge] Pacote persistido em chrome.storage.local com sucesso!');
        window.postMessage({ type: 'NETUNO_SEI_PACKAGE_SAVED_SUCCESS' }, '*');
      });
    }
  }
});

// Responde a solicitações diretas do Popup / Background da extensão
if (chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'netuno_pull_package_from_app') {
      const pkg = getLocalNetunoPackage();
      if (pkg && chrome.runtime?.id) {
        chrome.storage.local.set({
          netuno_sei_package: pkg,
          netuno_sei_last_package: pkg
        }, () => {
          sendResponse({ success: true, package: pkg });
        });
        return true;
      }
      sendResponse({ success: false, package: null });
    }
  });
}

// Sincroniza periodicamente com o localStorage caso a janela seja fechada/reaberta
function syncLocalStoragePayload() {
  try {
    const parsed = getLocalNetunoPackage();
    if (parsed && chrome.runtime?.id) {
      chrome.storage.local.get(['netuno_sei_package', 'netuno_sei_last_package'], (res) => {
        const updates = {};
        if (!res.netuno_sei_last_package || res.netuno_sei_last_package.dataCriacao !== parsed.dataCriacao) {
          updates.netuno_sei_last_package = parsed;
        }
        if (!res.netuno_sei_package || res.netuno_sei_package.dataCriacao !== parsed.dataCriacao) {
          updates.netuno_sei_package = parsed;
        }
        if (Object.keys(updates).length > 0) {
          chrome.storage.local.set(updates);
        }
      });
    }
  } catch (_) {}
}

setInterval(syncLocalStoragePayload, 2000);
syncLocalStoragePayload();
