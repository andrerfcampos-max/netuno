# Manual Técnico e Diretrizes da Pipeline de Fotos de Hidrantes (Street View Sniper)

> **⚠️ AVISO OBRIGATÓRIO PARA QUALQUER IA EM NOVAS CONVERSAS:**
> Antes de propor código ou executar scripts de extração de fotos, **leia este documento integralmente**. Ele contém todas as decisões técnicas, regras de negócio, limites de cota e arquitetura já validadas e aprovadas pelo Comandante.

---

## 1. O Problema Resolvido: Autocentralização Sniper v4 (Smart Scan & Auto-Healing)
1. **Problema dos Dados Legados:** O GPS cadastral dos hidrantes frequentemente aponta para o meio do lote, parede do imóvel, ou a visão está bloqueada por obstáculos (caminhões, tapumes). Além disso, o ângulo pode cortar o hidrante ou o GPS estar nas costas do carro do Street View.
2. **Solução Definitiva (Modo Sniper v4):**
   - **Fase 1 (Varredura Ampla):** Bate uma foto com FOV aberto (`FOV=100°`) na direção estimada do GPS.
   - **Fase 2 (Visão Computacional IA - Agnosticismo de Cor):** O modelo `gemini-3.5-flash-lite` (ou `gemini-3.6-flash`) analisa a imagem buscando estritamente um **hidrante de coluna urbano (cilíndrico, geralmente amarelo ou vermelho)**. *NOTA: A IA é instruída a ignorar propositalmente hidrantes de recalque (vermelhos de tubulação fina).* Retorna a confiança (0-100) e o `centro_x`.
   - **Fase 3 (Sweep 360°):** Se não achar de frente, o "pescoço" da câmera rotaciona dinamicamente `+120°` e `-120°` e submete novas fotos para a IA (achando hidrantes perdidos atrás da câmera).
   - **Fase 4 (Step-Around Espacial):** Se todas as visões falharem por oclusão (ex: ônibus estacionado na frente), o script consulta o Street View pedindo um deslocamento de ~15 metros (`0.00015` lat/lng). Ao mudar de panorama, ele "fura" o obstáculo e refaz o Scan triangular.
   - **Fase 5 (Correção Angular e Foto em Alta):** Com o hidrante achado, calcula o offset angular e bate a foto final com zoom fechado (`FOV=75°` e resolução `800x600`), enquadrando o hidrante perfeitamente.

---

## 2. Parâmetros Ótimos de Imagem (Foco Mobile) e Progressive Loading
O sistema agora utiliza o conceito de **Progressive Image Loading** (Etapa 87) para garantir zoom com pinça no mapa sem pixelar, mantendo o tempo de resposta instantâneo.
Para isso, os scripts de extração devem baixar e salvar **duas versões** da imagem:

1. **Miniatura Padrão (`[ID].jpeg` ou `.webp`):**
   - Resolução de Captura: **`800x600`** pixels (ou `800x500` 16:9).
   - Função: Usada no banner do mapa e na abertura imediata da tela cheia.
   - Peso por Arquivo: Entre **35 KB e 50 KB**.

2. **Versão Alta Resolução HD (`[ID]_hd.jpeg` ou `.webp`):**
   - Resolução de Captura: **`1200x900`** pixels.
   - Função: Baixada em background quando a foto entra em tela cheia. Ocultamente substitui a foto leve para garantir um zoom (pinch-to-zoom) perfeito e sem pixelar para pessoas com deficiência visual.
   - Peso por Arquivo: Entre **100 KB a 150 KB**.

---

## 3. Gestão de Memória e Capacidade no Supabase (Plano Gratuito)
Para a totalidade dos **~3.500 hidrantes** do Distrito Federal:
1. **No Banco de Dados (PostgreSQL):**
   - **REGRA DE OURO:** NUNCA salve Base64 no banco de dados!
   - Salva-se **estritamente a URL de CDN textual** (ex: `https://[id].supabase.co/storage/v1/object/public/hidrantes/arniqueira/ARN00001.webp` ou caminho relativo `/hidrantes/...`).
   - 3.500 hidrantes $\times$ 90 bytes por link = **~315 KB**.
   - *Impacto:* Apenas **0,06%** dos 500 MB gratuitos do Postgres no Supabase.
2. **No Storage (Bucket de Arquivos):**
   - 3.500 hidrantes $\times$ 40 KB = **~140 MB**.
   - *Impacto:* Apenas **14%** do limite gratuito de 1 GB do Supabase Storage. Sobram 860 MB livres.
3. **No Tráfego de Rede (Bandwidth / Egress):**
   - O aplicativo Netuno utiliza **Lazy Loading**: o celular só faz o download dos 40 KB no momento em que o militar clica no pino do hidrante no mapa.
   - Uma vez aberta, o navegador guarda em cache (HTTP Cache-Control). A cota gratuita de 2 GB/mês suporta mais de **50.000 aberturas de fotos por mês**.

---

## 4. Organização das Pastas e Nomenclatura dos Arquivos
Os arquivos de fotos devem ser estritamente organizados em pastas por Região Administrativa (cidade) e nomeados com o código canônico oficial do hidrante:
```text
hidrantes/
├── arniqueira/
│   ├── ARN00001.jpeg (ou .webp)
│   ├── ARN00002.jpeg
│   ├── ARN00003.jpeg
│   └── ARN00004.jpeg
├── taguatinga/
│   ├── TAG00001.webp
│   └── ...
├── ceilandia/
│   ├── CEI00001.webp
│   └── ...
└── brasilia/
    ├── BSB00001.webp
    └── ...
```

---

## 5. Regra Crucial: Sincronização de Tripla Fonte de Dados
Ao executar extrações e atualizar as fotos no Netuno, o script ou agente **DEVE atualizar simultaneamente as três fontes de dados**:
1. **`public/base-de-dados.xlsx`** (planilha pública)
2. **`base-de-dados.xlsx`** (planilha da raiz)
3. **`public/hidrantes_df_oficial.json` e `public/hidrantes_df_oficial.csv`** (base canônica oficial).
   - *Atenção Crítica:* O Netuno no celular carrega prioritariamente o arquivo `/hidrantes_df_oficial.json` por ser ultra leve. Se você atualizar apenas o Excel e não rodar o exportador (`node scripts/export_clean_database.cjs`), **as fotos não aparecerão no aplicativo**!
   - Após atualizar o Excel, sempre execute:
     ```bash
     node scripts/export_clean_database.cjs
     ```

---

## 6. Tratamento de Rate Limit e Cota do Google AI Studio
1. **Intervalo Anti-Rate-Limit:** Mínimo de 4.5s a 5s de respiro entre cada requisição.
2. **Modelo Recomendado:** `gemini-3.5-flash-lite` (possui alta estabilidade e cotas liberadas para visão computacional). O `gemini-3.6-flash` pode ser usado como alternativa.
3. **Retry Inteligente com Captura de Tempo:**
   Caso o Google retorne erro `429 Quota exceeded` ou `High demand`, o script **não deve abortar nem pular o hidrante**. Ele deve capturar o tempo exato retornado na mensagem (`Please retry in Xs`), pausar os segundos necessários e retentar o mesmo hidrante automaticamente.
4. **Segurança de Chaves de API (GitHub Push Protection):**
   - NUNCA coloque as chaves de API hardcoded nos scripts `.cjs`!
   - As chaves `GOOGLE_MAPS_API_KEY` e `GEMINI_API_KEY` vivem no arquivo `.env` (ignorado pelo `.gitignore`).
   - Os scripts devem ler dinamicamente de `process.env`.

---

## 7. Scripts Existentes no Repositório
- [`scripts/extract_arniqueiras.cjs`](file:///c:/Users/andre/OneDrive/Desktop/argosa%202-1/scripts/extract_arniqueiras.cjs): Script piloto executado com sucesso no MVP de Arniqueiras (4 hidrantes).
- [`scripts/extract_aguas_claras.cjs`](file:///c:/Users/andre/OneDrive/Desktop/argosa%202-1/scripts/extract_aguas_claras.cjs): Script de extração e autocentralização Sniper para os 40 hidrantes de Águas Claras (`ACL00001` a `ACL00049`).
- [`scripts/poc_streetview_v3_sniper.cjs`](file:///c:/Users/andre/OneDrive/Desktop/argosa%202-1/scripts/poc_streetview_v3_sniper.cjs): Script de testes do algoritmo Sniper.
- [`scripts/export_clean_database.cjs`](file:///c:/Users/andre/OneDrive/Desktop/argosa%202-1/scripts/export_clean_database.cjs): Converte a planilha Excel nos arquivos oficiais `public/hidrantes_df_oficial.json` e `.csv`, preservando o campo `fotoPerfil`.
- [`scripts/task_queue.cjs`](file:///c:/Users/andre/OneDrive/Desktop/argosa%202-1/scripts/task_queue.cjs): Gerenciador da fila de concorrência entre conversas.

---

## 8. Status Atual do Projeto
- **Etapa 85 Concluída:** MVP de Arniqueiras (4 hidrantes) publicado.
- **Águas Claras e POC v4 Smart Concluídos:** O lote de Águas Claras (49 hidrantes) serviu como base para desenvolvimento da **Arquitetura Sniper v4**. A nova inteligência de Step-Around resolveu oclusões severas (ônibus, tapumes) e lidou perfeitamente com hidrantes de diferentes cores, ignorando com sucesso falsos-positivos (hidrantes de recalque). Imagens em alta resolução HD também estão documentadas.
- **Próxima Etapa:** Disparar a extração em massa (utilizando a nova lógica Sniper v4) para as demais cidades do DF (Taguatinga, Ceilândia, Brasília, etc.) em uma nova pipeline de conversa.
