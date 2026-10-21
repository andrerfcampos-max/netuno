import { lazy } from 'react';

/**
 * Utilitário para envolver importações dinâmicas (React.lazy) com resiliência
 * a falhas de rede e atualizações contínuas de versão (Vite / Vercel redeploys).
 * 
 * Quando um novo deploy ocorre em produção, os nomes dos chunks sofrem alteração de hash.
 * Se o usuário estiver com a página aberta e clicar para abrir um modal lazy,
 * o navegador tenta buscar o hash antigo e retorna 404 ("Failed to fetch dynamically imported module").
 * 
 * Este helper intercepta o erro, avisa o Service Worker para sincronizar a versão nova
 * e recarrega a página automaticamente de forma suave, prevenindo travamentos ou telas de erro.
 */
export function lazyWithRetry(componentImport) {
  return lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      console.warn('[lazyWithRetry] Falha ao carregar módulo dinâmico:', error);

      const msg = String(error?.message || '').toLowerCase();
      const isChunkOrDynamicError =
        msg.includes('failed to fetch dynamically imported module') ||
        msg.includes('error loading dynamically imported module') ||
        msg.includes('importing a module script failed') ||
        msg.includes('dynamically imported module') ||
        error?.name === 'ChunkLoadError';

      if (isChunkOrDynamicError) {
        const reloadKey = 'netuno_chunk_reload_guard';
        const lastReload = parseInt(sessionStorage.getItem(reloadKey) || '0', 10);
        const now = Date.now();

        // Evita loop contínuo caso o usuário esteja totalmente sem sinal de internet (timeout 15s)
        if (now - lastReload > 15000) {
          sessionStorage.setItem(reloadKey, String(now));
          console.info('[lazyWithRetry] Nova versão do Netuno detectada após deploy. Sincronizando e recarregando...');

          if (typeof window.__netuno_update_sw === 'function') {
            try {
              window.__netuno_update_sw();
            } catch (swErr) {
              console.warn('[lazyWithRetry] Erro ao disparar updateSW:', swErr);
            }
          }

          // Breve delay para permitir que o SW ative a nova versão antes do refresh
          setTimeout(() => {
            window.location.reload();
          }, 150);

          // Retorna Promise pendente para suspender a renderização enquanto a página recarrega
          return new Promise(() => {});
        }
      }

      // Propaga se já tiver recarregado recentemente ou se for outro erro
      throw error;
    }
  });
}
