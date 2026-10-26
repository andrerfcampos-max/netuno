// background.js - Service Worker do Netuno SEI Integrator (MV3)

console.log('[Netuno SEI Ext] Background Service Worker Ativo');

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
});

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
