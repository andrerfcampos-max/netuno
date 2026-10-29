// popup.js - Controle rápido pelo Menu de Extensões do Navegador

let currentPackage = null;

const pkgTitleEl = document.getElementById('pkg-title');
const pkgSubtitleEl = document.getElementById('pkg-subtitle');
const statusEl = document.getElementById('popup-status');
const badgeEl = document.getElementById('ext-badge');
const btnPlay = document.getElementById('btn-popup-play');
const btnShow = document.getElementById('btn-popup-show');
const btnSync = document.getElementById('btn-popup-sync');

function showStatus(text, color = '#38bdf8') {
  statusEl.style.display = 'block';
  statusEl.style.color = color;
  statusEl.textContent = text;
}

function renderPackageInfo(pkg) {
  currentPackage = pkg;
  if (pkg) {
    const cidade = pkg.cidade || 'Distrito Federal';
    const ra = pkg.raRomano ? ` (RA ${pkg.raRomano})` : '';
    pkgTitleEl.textContent = `Relatório CAESB: ${cidade}${ra}`;
    pkgTitleEl.style.color = '#f8fafc';
    pkgSubtitleEl.textContent = 'Processo: CBMDF - Serviço Operacional → SEHUR';
    badgeEl.textContent = 'Pronto';
    btnPlay.disabled = false;
  } else {
    pkgTitleEl.textContent = 'Nenhum relatório enviado ainda';
    pkgTitleEl.style.color = '#94a3b8';
    pkgSubtitleEl.textContent = 'Gere o relatório CAESB no Netuno ou clique em Sincronizar';
    badgeEl.textContent = 'Aguardando';
    btnPlay.disabled = false; // Permite clicar para sincronizar e tentar rodar
  }
}

async function initPopup() {
  const res = await chrome.storage.local.get(['netuno_sei_package', 'netuno_sei_last_package']);
  let pkg = res.netuno_sei_package || res.netuno_sei_last_package || null;

  if (!pkg) {
    // Tenta buscar automaticamente de qualquer aba aberta do Netuno
    chrome.runtime.sendMessage({ action: 'netuno_sync_from_netuno_tabs' }, (syncRes) => {
      if (syncRes && syncRes.package) {
        renderPackageInfo(syncRes.package);
      } else {
        renderPackageInfo(null);
      }
    });
  } else {
    if (!res.netuno_sei_package && res.netuno_sei_last_package) {
      chrome.storage.local.set({ netuno_sei_package: res.netuno_sei_last_package });
    }
    renderPackageInfo(pkg);
  }
}

btnPlay.addEventListener('click', async () => {
  btnPlay.disabled = true;
  showStatus('⏳ Acionando automação na aba do SEI...', '#38bdf8');

  if (!currentPackage) {
    const syncRes = await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'netuno_sync_from_netuno_tabs' }, resolve);
    });
    if (syncRes?.package) {
      renderPackageInfo(syncRes.package);
    }
  }

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
        setTimeout(() => window.close(), 700);
      }
    } else {
      showStatus(`⚠️ ${res?.error || 'Abra a aba do SEI DF para iniciar.'}`, '#f59e0b');
    }
  });
});

btnShow.addEventListener('click', () => {
  showStatus('⏳ Reabrindo painel na tela do SEI...', '#38bdf8');
  chrome.runtime.sendMessage({
    action: 'netuno_dispatch_to_sei',
    command: 'netuno_open_panel',
    package: currentPackage
  }, (res) => {
    if (res && res.success) {
      showStatus('✅ Painel exibido na aba do SEI!', '#34d399');
      setTimeout(() => window.close(), 500);
    } else {
      showStatus(`⚠️ ${res?.error || 'Não foi possível localizar a aba do SEI.'}`, '#f59e0b');
    }
  });
});

btnSync.addEventListener('click', () => {
  showStatus('⏳ Buscando último pacote na aba do Netuno...', '#38bdf8');
  chrome.runtime.sendMessage({ action: 'netuno_sync_from_netuno_tabs' }, (res) => {
    if (res && res.package) {
      renderPackageInfo(res.package);
      showStatus('✅ Pacote sincronizado com sucesso!', '#34d399');
    } else {
      showStatus('⚠️ Nenhum pacote encontrado. Abra o Relatório CAESB no Netuno.', '#f59e0b');
    }
  });
});

initPopup();
