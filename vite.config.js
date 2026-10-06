import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const seiApiDevPlugin = () => ({
  name: 'sei-api-dev-plugin',
  configureServer(server) {
    server.middlewares.use('/api/sei/processar', async (req, res) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            req.body = body ? JSON.parse(body) : {};
            const { default: handler } = await import('./api/sei/processar.js');
            const customRes = {
              status: (code) => {
                res.statusCode = code;
                return customRes;
              },
              setHeader: (k, v) => res.setHeader(k, v),
              json: (data) => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
              },
              end: () => res.end()
            };
            await handler(req, customRes);
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      } else {
        res.statusCode = 405;
        res.end('Method Not Allowed');
      }
    });
  }
});

const getBuildTime = () => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const timeStr = now.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit'
  });
  return `${dateStr} às ${timeStr}`;
};

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify('2.1.2'),
    __BUILD_TIME__: JSON.stringify(getBuildTime())
  },
  plugins: [
    react(), 
    tailwindcss(),
    seiApiDevPlugin(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons.svg', 'base-de-dados.xlsx'],
      manifest: {
        name: 'Netuno - Sistema de Vistoria',
        short_name: 'Netuno',
        description: 'Sistema de Mapeamento de Hidrantes Urbanos de Incêndio - SEHUR/GPCIU',
        start_url: '/',
        scope: '/',
        id: '/',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui', 'window-controls-overlay'],
        handle_links: 'preferred',
        launch_handler: {
          client_mode: ['navigate-existing', 'auto']
        },
        icons: [
          {
            src: 'favicon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: 'favicon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Rotas de Missão',
            short_name: 'Missões',
            description: 'Acessar rotas e missões ativas',
            url: '/?view=route',
            icons: [{ src: 'favicon.svg', sizes: '192x192' }]
          },
          {
            name: 'Mapa Operacional',
            short_name: 'Mapa',
            description: 'Visualizar hidrantes no mapa',
            url: '/?view=map',
            icons: [{ src: 'favicon.svg', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,xlsx}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        cleanupOutdatedCaches: true
      }
    })
  ],
})
