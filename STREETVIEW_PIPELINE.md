# Manual Técnico e Diretrizes da Pipeline de Fotos de Hidrantes (Street View Sniper)

> **⚠️ AVISO OBRIGATÓRIO PARA QUALQUER IA EM NOVAS CONVERSAS:**
> Antes de propor código ou executar scripts de extração de fotos, **leia este documento integralmente**. Ele contém todas as decisões técnicas, regras de negócio, limites de cota e arquitetura já validadas e aprovadas pelo Comandante.

---

## 1. O Problema Resolvido: Autocentralização Sniper
1. **Problema dos Dados Legados:** O GPS cadastral dos hidrantes frequentemente aponta para o meio do lote ou parede do imóvel, e não para o meio-fio/calçada. Um cálculo trigonométrico simples (Azimute básico) apontava a câmera para o muro errado ou cortava o hidrante na borda da foto.
2. **Solução Definitiva (Modo Sniper):**
   - **Fase 1 (Varredura Ampla):** Bate uma foto com FOV aberto (`FOV=100°`) na direção estimada do GPS.
   - **Fase 2 (Visão Computacional IA):** O modelo `gemini-3.5-flash-lite` (ou `gemini-3.6-flash`) analisa a imagem e identifica as coordenadas de um **hidrante AMARELO** de calçada, retornando estritamente: `{"encontrado": true, "centro_x": <float 0.0 a 1.0>}`.
   - **Fase 3 (Correção Angular):** O script calcula o desvio: `offset = (centro_x - 0.5) * FOV`. O ângulo da câmera é girado dinamicamente para o ponto exato.
   - **Fase 4 (Foto de Alta Resolução):** Bate a foto final com zoom fechado (`FOV=75°` e resolução `800x600`), enquadrando o hidrante cravado no centro com a fachada nítida ao fundo.

---

## 2. Parâmetros Ótimos de Imagem (Foco Mobile)
- **Formato:** `.webp` (com compressão em **80%**) ou `.jpeg` como transição.
- **Resolução de Captura:** **`800x600`** pixels (ou `800x500` 16:9).
  - *Por que não 640x640?* Imagens de 640px ficam levemente pixeladas quando esticadas em monitores de computador. Telas de smartphone possuem telas Retina com densidade 2x/3x DPR: uma imagem de `800x600` possui superamostragem perfeita, ficando ultra nítida no celular.
- **Peso por Arquivo:** Entre **35 KB e 50 KB** por hidrante.

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
- [`scripts/poc_streetview_v3_sniper.cjs`](file:///c:/Users/andre/OneDrive/Desktop/argosa%202-1/scripts/poc_streetview_v3_sniper.cjs): Script de testes do algoritmo Sniper.
- [`scripts/export_clean_database.cjs`](file:///c:/Users/andre/OneDrive/Desktop/argosa%202-1/scripts/export_clean_database.cjs): Converte a planilha Excel nos arquivos oficiais `public/hidrantes_df_oficial.json` e `.csv`, preservando o campo `fotoPerfil`.
- [`scripts/task_queue.cjs`](file:///c:/Users/andre/OneDrive/Desktop/argosa%202-1/scripts/task_queue.cjs): Gerenciador da fila de concorrência entre conversas.

---

## 8. Status Atual do Projeto
- **Etapa 85 Concluída:** MVP de Arniqueiras (4 hidrantes: `ARN00001` a `ARN00004`) extraído, gravado e publicado na Vercel.
- **Frontend Preparado:** O `MapComponent.jsx` possui Hero Banner panorâmico 16:9, modal Lightbox fullscreen com botão de Street View 360°, e fallback por convenção para cidades testadas.
- **Próxima Etapa:** Após validação do usuário no mobile, criar rotina para converter em `.webp` (via `sharp`), configurar o Bucket no Supabase Storage e disparar os lotes das demais cidades (Taguatinga, Ceilândia, Brasília, etc.).
