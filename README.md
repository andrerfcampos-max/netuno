# Netuno (Super Argos 2.1)

> 🚀 **Ambiente de Testes Mobile (Produção):** [https://netuno-eight.vercel.app/](https://netuno-eight.vercel.app/)  
> 📦 **Repositório GitHub:** [https://github.com/andrerfcampos-max/netuno](https://github.com/andrerfcampos-max/netuno)

O Netuno é um Progressive Web App (PWA) tático e de gestão desenvolvido para o Corpo de Bombeiros Militar do Distrito Federal (CBMDF) e integrado com a Companhia de Saneamento Ambiental do DF (CAESB).


## Funcionalidades Principais

- **Módulo de Vistorias:** Listagem de hidrantes urbanos com filtragens avançadas (RA, Status, RA, Nome, Vistoriador, etc).
- **Central de Missões Hierárquica:** Organização de missões táticas através de pastas (Quartéis/Unidades) e subpastas (Alas/Guarnições).
- **Módulo de Rota Interativo:** 
  - GPS Throttling Inteligente (rastreamento contínuo com baixo consumo, ativado via `visibilitychange` apenas quando o painel de missão está aberto).
  - Geofencing: Trava de segurança (alerta nativo) que previne cadastros remotos (distância > 50 metros).
  - Otimização de Rota (TSP) baseada em localização atual e proximidade de hidrantes.
  - Integração profunda com Waze, Google Maps e Street View.
- **Relatórios Multidimensionais:** 
  - Dashboard consolidado e inteligente para o CBMDF.
  - Dashboard isolado de manutenções pendentes para CAESB.
  - Exportações rápidas (PDF formatado em A4 nativamente, CSV, Clipboard SEI, WhatsApp Tático).
- **Controle de Acesso Baseado em Perfis (RBAC):**
  - **Vistoriador:** Registra vistorias (com geofencing).
  - **Gestor:** Pode editar atributos geográficos/perfil dos hidrantes e montar missões.
  - **Admin:** Pode alterar os papéis de acesso do sistema via Painel Administrativo.
- **Modo Offline:** Capacidade nativa do VitePWA (PWA) para funcionamento e visualização quando desconectado.

## Tecnologias Utilizadas
- **React.js (Vite)**
- **Tailwind CSS** (Design Premium, High-Contrast UI, Micro-interações)
- **Leaflet & React-Leaflet** (Mapas baseados no Google Hybrid Satélite)
- **Lucide Icons** (Ícones vetoriais modernos)
- **OSRM API / Haversine** (Para algoritmos TSP de rotação geográfica)
- **Local Storage** (Persistência no navegador do cliente)

## Como Rodar Localmente
\`\`\`bash
npm install
npm run dev
\`\`\`
*(Para simulação do usuário, digite "123" para Vistoriador, "456" para Gestor ou "admin" para o Painel Administrativo).*
