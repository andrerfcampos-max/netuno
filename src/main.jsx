import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Nova versão do Netuno detectada em segundo plano.
    // NUNCA forçar updateSW(true) aqui para evitar que o navegador recarregue a página
    // sozinho e interrompa a navegação do usuário em campo.
    console.info('[PWA] Nova versão do Netuno pronta para ativação.');
    try {
      window.dispatchEvent(new CustomEvent('netuno-pwa-update-available'));
    } catch (e) {
      console.warn('[PWA] Erro ao despachar evento de atualização:', e);
    }
  },
  onOfflineReady() {
    console.info('[PWA] Netuno pronto para uso offline.');
  },
  onNeedReload() {
    // Sobrescreve para prevenir recarregamento forçado inesperado
    console.info('[PWA] Novo service worker ativo.');
  }
})

// Disponibiliza o atualizador manualmente caso o usuário queira atualizar via interface
window.__netuno_update_sw = () => updateSW(true);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
