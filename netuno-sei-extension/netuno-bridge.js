// netuno-bridge.js - Ponte de dados entre o Web App Netuno e a Extensão SEI

console.log('[Netuno SEI Bridge] Inicializado na página do Netuno.');

// Informa ao Web App que a extensão está presente e ativa
try {
  window.sessionStorage.setItem('netuno_sei_ext_installed', 'true');
  window.postMessage({ type: 'NETUNO_SEI_EXTENSION_INSTALLED', version: '1.5' }, '*');
} catch (_) {}

// Escuta mensagens do Netuno App com pacotes de relatório CAESB
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'NETUNO_SEI_SEND_PACKAGE') {
    const payload = event.data.payload;
    console.log('[Netuno SEI Bridge] Pacote recebido do Netuno:', payload?.cidade);

    if (chrome.runtime?.id) {
      chrome.storage.local.set({ netuno_sei_package: payload }, () => {
        console.log('[Netuno SEI Bridge] Pacote persistido em chrome.storage.local com sucesso!');
        window.postMessage({ type: 'NETUNO_SEI_PACKAGE_SAVED_SUCCESS' }, '*');
      });
    }
  }
});

// Sincroniza periodicamente com o localStorage caso a janela seja fechada/reaberta
function syncLocalStoragePayload() {
  try {
    const raw = localStorage.getItem('netuno_sei_active_package');
    if (raw && chrome.runtime?.id) {
      const parsed = JSON.parse(raw);
      chrome.storage.local.get(['netuno_sei_package'], (res) => {
        if (!res.netuno_sei_package || res.netuno_sei_package.dataCriacao !== parsed.dataCriacao) {
          chrome.storage.local.set({ netuno_sei_package: parsed });
        }
      });
    }
  } catch (_) {}
}

setInterval(syncLocalStoragePayload, 2000);
syncLocalStoragePayload();
