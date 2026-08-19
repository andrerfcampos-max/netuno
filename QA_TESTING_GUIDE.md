# Guia de Testes Automatizados de QA (QA_TESTING_GUIDE)

Este documento contém as instruções para que o agente (Engenheiro de QA e Desenvolvedor Full-Stack Senior) realize uma validação completa e abrangente no sistema/navegador, gerando um Relatório Final Consolidado otimizado.

Para acionar a execução destes testes em novas conversas, basta referenciar este arquivo: **"Por favor, execute a bateria de testes de QA conforme especificado no arquivo QA_TESTING_GUIDE.md"**

---

## Estrutura de Execução dos Testes (5 Etapas)

A validação deve ser focada em identificar falhas técnicas, gargalos de desempenho e problemas de experiência do usuário. O agente deve simular ou criar scripts para analisar os seguintes pontos:

### ETAPA 1: Varredura de Código Estático (Lacunas e Botões Quebrados)
1. Rodar análise estática na pasta do projeto.
2. Mapear:
   - Funções vazias, pendentes ou com blocos `try/catch` sem tratamento de erro.
   - Botões, links ou elementos interativos sem manipuladores de evento (`onClick`, `addEventListener`) ou apontando para rotas/ações nulas.
   - Importações inexistentes, arquivos mortos ou variáveis não utilizadas.

### ETAPA 2: Testes E2E de Navegação e Botões Críticos
1. Executar simulação de navegação por todas as rotas e componentes de interface.
2. Verificar se a troca de telas/abas, histórico do navegador (voltar/avançar) e ações de botões críticos respondem com sucesso e preservam o estado.
3. Registrar quaisquer erros JavaScript lançados no console do navegador durante a navegação.

### ETAPA 3: Validação de Formulários e Campos de Entrada
1. Testar automatizadamente todos os formulários e campos de entrada de texto:
   - **Casos Válidos:** Preenchimento correto e envio de dados esperados.
   - **Campos Vazios / Obrigatórios:** Envio sem preenchimento para testar a validação de borda.
   - **Dados Inválidos:** Inserção de caracteres especiais, textos excessivamente longos (overflow), etc.
2. Validar se o sistema exibe mensagens de erro claras na interface em vez de travar a thread (evitar `alert()`) ou falhar silenciosamente.

### ETAPA 4: Resiliência e Tratamento de Erros de Rede
1. Simular cenários de falha na camada de rede/API e carregamento de assets:
   - Queda de conexão (modo offline / `navigator.onLine`).
   - Respostas de erro (HTTP status 404, 500, 502, Timeout).
2. Garantir que a aplicação trate esses cenários exibindo telas ou mensagens amigáveis de erro em vez de ficar em estado de carregamento infinito, quebrar silenciosamente ou apresentar tela branca.

### ETAPA 5: Monitoramento Básico de Desempenho e Memória
1. Medir e registrar:
   - **Tempo de renderização (UI Thread):** Identificar se a troca para telas pesadas trava a thread principal por mais de 2 segundos.
   - **Vazamentos de Memória (Memory Leaks):** Verificar se o consumo de memória (Heap) cresce continuamente sem ser liberado após abrir, fechar ou alternar entre componentes repetidas vezes (ex: falha ao destruir instâncias de mapas/canvas).

### ETAPA 6: Validação de Responsividade Mobile e PWA em Campo
1. **Ambiente de Testes:** Acessar a URL de Produção Vercel: `https://netuno-eight.vercel.app/`.
2. **Critérios Mobile / Smartphone:**
   - **GPS e Geolocalização:** Testar precisão, permissão do navegador e centralização da posição atual no mapa.
   - **Touch Targets e Gestos:** Garantir tamanho mínimo de toque de 44x44px para botões, pinos de hidrante e controles de mapa.
   - **Teclado Virtual:** Validar se a abertura do teclado no celular não oculta campos de entrada ou quebra o layout de modais/diálogos.
   - **Manifest PWA e Cache Offline:** Verificar instalação na tela de início, ícones de splash e carregamento da aplicação sem conexão de internet ativa.
   - **Orientação:** Verificar consistência em modo Retrato (Portrait) e Paisagem (Landscape).

---

## Formato de Saída Exigido

Após a execução da análise, o agente **NÃO DEVE** enviar logs longos. 
A resposta deve conter **APENAS** um "Relatório Final Consolidado" (em formato de Artifact ou Resumo Markdown) estruturado da seguinte forma:

1. Resumo das falhas encontradas por etapa.
2. Apontamento da **causa exata** das falhas críticas.
3. **Sugestão pontual de correção** para os arquivos afetados.
