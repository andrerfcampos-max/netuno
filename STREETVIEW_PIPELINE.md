# Pipeline Automática de Fotos de Hidrantes (Sniper V3)

> **⚠️ AVISO PARA A IA:** Ao iniciar uma nova conversa sobre a extração de fotos do Street View, **leia este documento integralmente** antes de sugerir soluções. Ele contém as decisões arquiteturais já validadas pelo Comandante (usuário).

## 1. O Problema Resolvido
O script extrai fotos de hidrantes do Google Street View. No entanto, as coordenadas de GPS antigas (da planilha/banco) costumam apontar para o lote/prédio e não para a calçada, fazendo o cálculo de Azimute (Trigonometria) apontar a câmera para o lugar errado. 
**Solução (Modo Sniper):** Usamos o `gemini-3.6-flash` para fazer rastreamento espacial (*Bounding Box / Centro X*). O script gira a câmera dinamicamente e bate a foto com o hidrante amarelo perfeitamente centralizado. O script atual (`scripts/poc_streetview_v3_sniper.cjs`) já implementa essa lógica com sucesso absoluto.

## 2. Decisões de Arquitetura (O Padrão de Trabalho)

Foi estritamente definido que **NENHUMA IMAGEM SERÁ SALVA EM BASE64 NO BANCO DE DADOS** e não faremos upload para o repositório Git/Vercel (public/) na versão de produção para evitar travamentos e custos.

O fluxo de trabalho para a versão final de produção deverá ser ESTRITAMENTE o seguinte:

1. **Varredura (Rate Limit de 4.5s):** 
   O script processa 1 hidrante a cada 4.5 segundos. Essa pausa é obrigatória para não estourar a cota Free Tier do Gemini (15 RPM).
2. **Centralização (Sniper V3):** 
   A IA encontra a coordenada X. O script corrige o `heading` e baixa a foto em alta qualidade (JPEG) do Street View.
3. **Otimização (Sharp):** 
   O script DEVE usar a biblioteca `sharp` no Node.js para converter o JPEG em formato `.WEBP` com 75-80% de qualidade, reduzindo o arquivo de 150KB para ~25KB.
4. **Armazenamento (Supabase Storage):** 
   O script faz upload da imagem WebP para um Bucket público do **Supabase** (que será criado pelo usuário/IA, ex: `bucket_hidrantes`).
5. **Atualização do Banco (Supabase DB):** 
   O script pega a URL pública do Bucket (ex: `https://.../hidrante-23.webp`) e faz um `UPDATE` no banco de dados, salvando **APENAS O LINK** na coluna correspondente do hidrante.
6. **Frontend (App Netuno):** 
   O App exibirá o link usando *Lazy Loading*, garantindo consumo mínimo de dados móveis e alta velocidade na rua.

## 3. Próximos Passos (Para a próxima conversa)

Quando o usuário pedir para continuar o desenvolvimento da extração das fotos, execute na seguinte ordem:
- [ ] 1. Instalar a biblioteca de processamento de imagem (`npm install sharp`). *(Atenção: verifique as políticas de execução de script do usuário se for usar o npm pelo powershell)*
- [ ] 2. Pedir ao usuário para confirmar as chaves do Supabase (URL e Service Role Key) no `.env`.
- [ ] 3. Criar (ou pedir para o usuário criar via painel) o Bucket no Supabase Storage.
- [ ] 4. Evoluir o script V3 atual para o script de produção final (inserindo Sharp + Supabase Upload + Supabase Update DB).
- [ ] 5. Testar o pipeline de ponta a ponta com 1 hidrante.
- [ ] 6. Integrar a interface para rodar isso direto do painel (se for do desejo do usuário).

*Histórico de Modelos Usados:*
Google Maps Static API e `gemini-3.6-flash` (AI Studio). Módulo nativo `https` foi usado para contornar travamentos de rede do `fetch` do NodeJS com IPv6.
