# Guia de Testes Automatizados de QA & Protocolo Avançado de Caça a Bugs (QA_TESTING_GUIDE)

Este documento estabelece o framework oficial e as instruções completas para que o agente (Engenheiro de Software Sênior especializado em QA e Confiabilidade) realize auditorias técnicas de altíssimo nível, caça a bugs (*bug hunting*), testes de resiliência, validação de casos de borda e análise de experiência do usuário.

---

## 🗺️ Fluxo de Trabalho em 3 Etapas

O processo de controle de qualidade opera em um ciclo estrito de 3 etapas:

1. **Etapa 1 (Definição):** Consulta a este guia para alinhamento dos critérios de qualidade, invariantes e taxonomia de erros.
2. **Etapa 2 (Diagnóstico / Execução de Testes):** Execução da varredura técnica e emissão do **Relatório Consolidado de Diagnóstico** (com apontamento da causa raiz e sugestão de correção), **SEM aplicar alterações diretas no código de produção**.
3. **Etapa 3 (Implementação de Correções):** Aplicação sistemática das correções aprovadas com base no relatório, seguida de revalidação dos testes e deploy.

> **Como acionar a Etapa 2:**  
> Solicite ao agente:  
> *"Por favor, execute a bateria de testes de QA conforme especificado no arquivo QA_TESTING_GUIDE.md e gere o Relatório de Diagnóstico sem aplicar correções."*

---

## 1. Taxonomia e Classes Estruturais de Defeitos

Toda auditoria deve cobrir as sete classes fundamentais de falhas em sistemas web/PWA modernos:

1. **Falhas Funcionais e Regras de Negócio:** Violações da lógica estrita de domínio (ex: tabela de 33 problemas de hidrantes, filtros de RA, cálculos incorretos de inoperância, memorial descritivo).
2. **Falhas de Estado e Ciclo de Vida:** Dessincronização entre a interface de usuário, stores reativas, `IndexedDB`, `localStorage` e o ciclo de vida de *Service Workers*.
3. **Falhas Temporais e Concorrência (*Race Conditions*):** Efeitos colaterais por respostas assíncronas fora de ordem (*stale responses*), ausência de *debouncing* ou falta de cancelamento via `AbortController`.
4. **Vazamentos de Recursos e Memória (*Memory Leaks*):** Event listeners órfãos, instâncias de Leaflet/Mapas/Canvas não destruídas em desmontagens de componentes, assinaturas abertas.
5. **Falhas de Resiliência de Rede e Armazenamento:** Colapso em conexões 2G/3G instáveis, erros de cota de armazenamento (*QuotaExceededError*) e falhas em transações offline.
6. **Vulnerabilidades e Integridade de Dados:** Injeções (XSS), fórmulas maliciosas em planilhas importadas, manipulação de estado e ausência de sanitização.
7. **Falhas de Ergonomia Mobile e Acessibilidade:** Áreas de toque inferiores a 44x44px, conflitos com o teclado virtual em smartphones, ausência de contraste e falhas de navegação por teclado.

---

## 2. Estrutura de Execução dos Testes (6 Etapas Técnicas)

### ETAPA 1: Varredura de Código Estático e Integridade Arquitetural
1. Analisar os arquivos-fonte do projeto (`src/`):
   - Mapear funções vazias, pendentes (`TODO/FIXME`) ou blocos `try/catch` com *swallow errors* (`catch (e) {}`).
   - Identificar botões, links ou ícones clicáveis sem manipuladores de evento (`onClick`, `addEventListener`) ou apontando para rotas/ações nulas.
   - Auditar acessos inseguros a propriedades aninhadas sem *optional chaining* (`?.`) ou sem *null safety*.
   - Identificar importações mortas, dependências circulares e variáveis não utilizadas.

### ETAPA 2: Testes E2E de Navegação, Histórico e Preservação de Estado
1. Simular navegação por todas as abas, rotas e painéis da aplicação (Mapa, Lista, Inspeção, Dashboard, Configurações).
2. Testar o botão Voltar/Avançar do navegador e verificar se o estado da tela anterior é preservado sem recarregar do zero.
3. Registrar quaisquer exceções ou avisos (`console.error`, `console.warn`) emitidos durante a navegação.

### ETAPA 3: Validação Exaustiva de Formulários e Casos de Borda (*Edge Cases*)
1. Submeter todos os campos de entrada, filtros e formulários aos seguintes cenários:
   - **Happy Path:** Entradas válidas e preenchimento correto.
   - **Campos Vazios / Nulos:** Envio com campos obrigatórios em branco.
   - **Strings e Overflow:** Textos com 10.000 caracteres, emojis complexos (`👨‍👩‍👧‍👦`), tags HTML/JS (`<script>alert(1)</script>`) e caracteres de escape (`\n`, `\0`, `\r\t`).
   - **Numéricos e Limiares:** `0`, `-1`, decimais de alta precisão flutuante, `NaN`, valores acima de `Number.MAX_SAFE_INTEGER`.
   - **Prevenção de Cliques Múltiplos (*Rage Clicks*):** Disparo de múltiplos cliques rápidos no botão de envio para garantir que o formulário não processe requisições duplicadas.

### ETAPA 4: Resiliência de Rede, Offline e Manipulação de Dados
1. **Instabilidade e Queda de Conexão:**
   - Simular modo offline (`navigator.onLine = false`), conexões 2G lentas e respostas HTTP com erro (404, 500, 502, Timeout).
   - Garantir que a interface exiba estados amigáveis de erro ou fallback em vez de tela branca (*White Screen of Death*) ou carregamento infinito.
2. **Importação e Manipulação de Planilhas/Arquivos:**
   - Testar o upload/leitura de arquivos `.xlsx`/`.csv` vazios, corrompidos, com colunas renomeadas ou com milhares de linhas.
   - Verificar se o parsing ocorre sem travar a thread de renderização da UI (uso adequado de Workers ou processamento assíncrono em fatias).

### ETAPA 5: Monitoramento de Performance, Renderização e Memória
1. **Tempo de Bloqueio da UI:** Verificar se a troca de telas pesadas (ex: renderização de milhares de marcadores de hidrantes no mapa) trava a thread principal por mais de 300ms.
2. **Consumo de Memória (Heap Retention):** Verificar se abrir, interagir e fechar componentes de mapa repetidas vezes causa acúmulo contínuo de memória sem liberação pelo *Garbage Collector*.
3. **Clustering & Virtualização:** Garantir que grandes volumes de dados utilizem agrupamento (*marker clustering*) ou listas virtualizadas para manter 60 FPS nas interações.

### ETAPA 6: Validação de Responsividade Mobile e PWA em Campo
1. **Ambiente de Testes Mobile:** URL de Produção: `https://netuno-eight.vercel.app/`.
2. **Critérios Mobile / Smartphone:**
   - **GPS e Geolocalização:** Permissões, tratamento de recusa de permissão pelo usuário, precisão e centralização da posição atual no mapa.
   - **Touch Targets & Gestos:** Garantir dimensão mínima de 44x44px (preferencialmente 48x48px) para todos os elementos interativos.
   - **Teclado Virtual (*Visual Viewport*):** Abertura do teclado no celular não deve ocultar campos de formulários ou quebrar o layout de modais.
   - **PWA & Cache Offline:** Verificação do `manifest.webmanifest`, service worker ativo, ícones de inicialização e funcionamento 100% offline após primeiro acesso.
   - **Orientação de Tela:** Estabilidade em modo Retrato (*Portrait*) e Paisagem (*Landscape*).

---

## 3. Critérios de Qualidade de Software (ISO/IEC 25010)

Para que o software seja aprovado com excelência, ele deve atender a:

- **Core Web Vitals:** LCP $\le 2.5\text{s}$, INP $\le 200\text{ms}$, CLS $< 0.1$.
- **Acessibilidade (WCAG 2.1 AA):** Contraste mínimo de $4.5:1$ em textos e navegação completa por teclado.
- **Idempotência:** A repetição de uma mesma ação de gravação não deve duplicar registros no banco.
- **Zero Perda de Dados:** Rascunhos e preenchimentos em andamento devem ser preservados localmente em caso de fechamento acidental da aba.

---

## 4. Formato Exigido para o Relatório de Diagnóstico (Saída da Etapa 2)

Após executar os testes, o agente **NÃO deve enviar logs brutos prolixos**. A resposta deve conter **APENAS** o **Relatório Consolidado de Diagnóstico** estruturado no seguinte padrão:

```markdown
# 📋 Relatório Consolidado de Diagnóstico e Auditoria de QA

## 1. Sumário Executivo
- Total de Cenários Auditados: [X]
- Falhas Críticas (Bloqueantes): [N]
- Falhas Médias (Comportamentais/UX): [N]
- Oportunidades de Otimização: [N]

## 2. Detalhamento das Ocorrências

### 🔴 [CRÍTICO / MÉDIO / BAIXO] IDENTIFICADOR: [Título Conciso da Ocorrência]
- **Módulo / Arquivo Afetado:** `caminho/do/arquivo.ts` (Linhas X a Y)
- **Método de Descoberta:** [Estático / Borda / Concorrência / Offline / Mobile]
- **Passos para Reprodução:**
  1. Passo 1
  2. Passo 2
- **Comportamento Observado (Falha):** Descrição precisa do erro ocorrido.
- **Comportamento Esperado:** O que o software deveria fazer.
- **Causa Raiz Técnica:** Explicação técnica do porquê o código falha.
- **Sugestão Pontual de Correção (Para a Etapa 3):** Código ou lógica sugerida para o conserto.

## 3. Conclusão e Prontidão para Correções (Etapa 3)
```
