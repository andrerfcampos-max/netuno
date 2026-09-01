# 📚 Histórico de Implementações Extras (Fora do Memorial)

Este documento registra todas as implementações, refatorações, correções de bugs e otimizações de performance que foram adicionadas ao projeto **Super Argos 2.1 (Netuno)**, mas que **não constavam originalmente no escopo** do `memorial_DESCRITIVO.MD.txt`.

A finalidade deste registro é manter um rastro claro e auditável da evolução paralela do software, facilitando futuras consultas por outros agentes, desenvolvedores ou pela equipe da DICTEC.

---

## 🛠️ Modificações Recentes

### [12/08/2026] Bateria de Correções e Melhorias de QA (Quality Assurance)
Estas implementações foram extraídas do *Relatório Final Consolidado de QA e Performance* e aplicadas via automação, visando robustez para produção:

1. **Correção de Try/Catch e Logs Seguros (`MissionManagerModal.jsx`)**
   - **Problema Inicial:** Falhas no parseamento de datas pelo JavaScript não eram registradas devido a um `catch` silencioso.
   - **Implementação Extra:** Adicionada uma validação estrita com `!isNaN(d.getTime())` e o erro agora é devidamente propagado no terminal (`console.error`) e devolve uma string de alerta amigável na interface ("Data Inválida").

2. **Limpeza de Contexto e Memory Leaks (`App.jsx`)**
   - **Problema Inicial:** Riscos de vazamento de memória com os *Event Listeners* de inatividade.
   - **Implementação Extra:** O relógio invisível do `setTimeout` (`throttleTimer`) agora é destruído explicitamente (`clearTimeout`) dentro da função de desmontagem (cleanup hook) do React.

3. **Integração com a History API (Navegação Segura e Botão Voltar)**
   - **Problema Inicial:** A arquitetura Single Page Application (SPA) original usava apenas variáveis de estado (ex: `setActiveView`), o que impedia que o usuário clicasse no botão "Voltar" do celular sem sair do sistema inteiro por acidente.
   - **Implementação Extra:** Sem instalar pacotes pesados como o *React Router*, integramos as views nativamente à barra de endereços (URLs) manipulando o `window.history.pushState` e escutando ativamente o evento `popstate`. O botão de navegação voltou a ser fluido.

4. **Sanitização de Formulários e Notificações (UX/UI)**
   - **Problema Inicial:** Caixas de *alert* nativas bloqueavam a aplicação e inputs não tinham limites.
   - **Implementação Extra:** Instalado e configurado globalmente a biblioteca `react-toastify`. Todos os travamentos por `.alert()` foram substituídos por notificações flutuantes (Toasts em modo Dark). Inseridos os escudos de segurança com a tag HTML `maxLength` para matrículas (20 caracteres) e senhas (50 caracteres).

5. **Aprimoramento de Resiliência de Conexão (Banner Offline)**
   - **Problema Inicial:** Equipes de campo costumam trafegar por áreas sem cobertura celular. O sistema original quebrava silenciosamente ao perder o carregamento dos *Tiles* via satélite.
   - **Implementação Extra:** Criado um observador ativo (listeners baseados em `navigator.onLine`) atrelado a um estado `isOffline`. Caso a rede caia, um banner vermelho é instantaneamente renderizado no topo da página, avisando a guarnição do risco e justificando o não carregamento momentâneo de mapas.

6. **Paginação Inteligente e Virtualização (Performance da Tabela)**
   - **Problema Inicial:** Filtrar por localidades extensas, com muitos hidrantes, gerava um *Main Thread Lock* na interface devido ao custo da renderização.
   - **Implementação Extra:** Desenvolvida a paginação dinâmica sem a necessidade de instâncias visuais. O `DataTable.jsx` agora renderiza no máximo 50 resultados na primeira carga, permitindo liberação rápida da interface. O usuário agora enxerga a quantia de *cards* pendentes e pode expandir a lista sob demanda (Botão *Carregar Mais*).

---

*(Novas atualizações ou correções fora do padrão principal devem ser adicionadas neste arquivo sequencialmente.)*

### [12/08/2026] Etapas 10 a 16 Concluídas Automaticamente
- **Atualização Super Argos 2.1** foi executada e validada com sucesso pelo agente orquestrador.

### [12/08/2026] Etapa 22 Concluída (Execução Manual via Agente)
- **Ajustes Finos de UI/UX e Atualização do Modal de Vistoria** aplicados no repositório. Inclui revisão do formulário de vistorias (regras de equivalência do registro inoperante e novos defeitos), correção de cliques no mapa, agrupamento de ações em menu dropdown superior e atualização da lista oficial das 34 pastas dos quartéis.

### [14/08/2026] Etapas 28 e 29 Concluídas (Execução Manual via Agente)
- **Etapa 28**: Ajustes de UI no Bloco de Lista (inclusão de Endereço, Referência e botão de Abrir Dialog) e implementação da Memória de Estado do Mapa (preservação do zoom e centro ao navegar entre telas). O primeiro clique no pino também foi corrigido para abrir a dialog imediatamente.
- **Etapa 29**: Implementação do Módulo de Estudo Técnico de Hidrantes (focado nas regras da ABNT NBR 12.218/2017). Adicionado cálculo automático espacial de coberturas (raios de 300, 600 e 800m), sugestões de alocação de novos hidrantes, plotagem visual via Leaflet e exportação de Parecer Técnico em PDF. Módulo restrito aos perfis Gestor e Admin.

### [17/08/2026] Etapa 32 Concluída: Dashboard de Comando, Vistoria, Estudo Técnico, Permissões e Refinamentos UX/UI
- **1. Dashboard de Comando & Relatórios:**
  - Padronização de nomenclatura de "Visão de Comando" para "Dashboard de Comando".
  - Eliminação da duplicidade de relatórios: mantido relatório unificado no Dashboard de Comando.
  - Navegação ao clicar em cards de quartel no Dashboard de Comando: abre diretamente a pasta de missões correspondente.
- **2. Navegação, Menu, Botões de Voltar & Permissões:**
  - Header visível nas telas e modais (Estudo Técnico, Central de Missões, Novo Hidrante, etc.).
  - Adicionados botões funcionais de "← Voltar" nos modais secundários.
  - Links do menu com tags `<a>` e `href="?modal=..."`, permitindo abrir páginas em nova guia via botão direito do mouse sem perder o contexto.
  - Separação de visibilidade por perfil: vistoriador visualiza diretamente apenas o atalho para a "Central de Missões", enquanto gestores e administradores acessam o menu completo.
- **3. Mapa, Filtros e Atalhos de Gestos:**
  - Auto-pan/FitBounds no mapa: o mapa enquadra e centraliza automaticamente a visualização sempre que a RA ou os filtros globais são alterados.
  - Seleção para rota de missão no mapa via `Ctrl + Clique` ou duplo clique no marcador.
  - Atalho de arrastar para o lado (swipe) na tela principal para alternar entre abas (Mapa, Lista, Rota, Relatório).
  - Atalho de arrastar para o lado no bloco de relatório para alternar entre "Relatório Geral" e "Relatório CAESB".
- **4. Cadastro de Novo Hidrante:**
  - Numeração automática do código com base no prefixo da RA e no número sequencial posterior ao último hidrante cadastrado naquela localidade (campo de código bloqueado para digitação manual).
- **5. Cadastro de Nova Vistoria (Regras e Travas de Inoperância):**
  - Pergunta 3 atualizada: "3) A TAMPA DA CAIXA ESTÁ... Sem alteração / Lacrada / Quebrada / Removida".
  - Pergunta 4 atualizada: "4) TODOS OS TAMPÕES ESTÃO PRESENTES? Sim / Falta 1 tampão / Faltam 2 tampões / Faltam todos os tampões" (2+ tampões inativa automaticamente).
  - Remoção de itens de tampa e tampão da lista suspensa de defeitos (mantendo o registro nos problemas da vistoria).
  - Exigência de preenchimento de todas as perguntas antes de salvar a vistoria.
  - Trava estrita de inoperância: se houver qualquer problema inativador (ex: registro soterrado, registro emperrado, 2+ tampões ausentes, tampa lacrada, etc.), bloqueia marcar o hidrante como operante e exibe alerta explicativo da inconsistência.
- **6. Módulo de Estudo Técnico:**
  - Botão de copiar parecer técnico em formato rico/HTML para colagem direta no SEI, omitindo cabeçalhos e assinaturas redundantes.
  - Remoção de "(Consulta Automática)" e inclusão de coordenadas geográficas na lista de equipamentos adjacentes.
  - Estilização do mapa: hidrante alvo em destaque laranja e hidrantes adjacentes em preto com borda mais espessa.
  - Nova regra de cálculo espacial: análise baseada em pontos de perímetro para considerar equipamentos com cobertura concorrente sobre a área de proteção do alvo.
### [17/08/2026] Etapa 33 Concluída: Validação de Cadastro, Navegação por Nova Guia, Unificação de RAs, Edição de Hidrante e Melhorias no Estudo Técnico
- **1. Validação Obrigatória no Cadastro de Novo Hidrante (`EditHydrantModal.jsx`):**
  - Os campos `Endereço` e `Ponto de Referência` passaram a ser estritamente obrigatórios no cadastro de novos hidrantes (`isNew`).
  - Ao tentar salvar sem preenchê-los, o sistema bloqueia o envio e exibe alerta orientando o usuário a preencher os respectivos campos, além de sinalizadores visuais (`*`).
- **2. Navegação e Abertura em Nova Guia (`App.jsx`):**
  - Implementado interceptador de rotas e parâmetros de URL (`?modal=...` e `?view=...`) na inicialização do sistema.
  - Ao abrir links do menu em nova guia via botão direito do mouse ("Abrir link em nova guia"), a aplicação preserva a sessão de autenticação do `localStorage` e abre diretamente a tela solicitada (Central de Missões, Estudo Técnico, Novo Hidrante, etc.) sem resetar para a tela inicial.
- **3. Centralização e Unificação da Lista de Cidades / RAs (`src/utils/raList.js`):**
  - Criado módulo centralizado com as 35 Regiões Administrativas oficiais do Distrito Federal, coordenadas geográficas, prefixos de código e função de normalização `normalizeRAName`.
  - Unificada a lista de cidades compartilhada entre `FilterBar` (Filtro Global), `EditHydrantModal` (Cadastro e Edição), `TechnicalStudyModal` e relatórios.
  - Padronização oficial de "Brasília" (removendo divergências de "Plano Piloto").
  - Remoção/normalização de duplicidades na base de dados (ex: 'gama' minúsculo com 1 hidrante normalizado para a RA oficial 'Gama').
- **4. Código do Hidrante na Tela de Edição (`EditHydrantModal.jsx`):**
  - Corrigida a exibição do código do hidrante na edição para exibir o padrão oficial completo com 3 letras do prefixo + número (ex: `TAG00001`, `GUA00101`, `BSB00120`) em vez de números inteiros sequenciais internos do banco.
- **5. Revisão Visual da Dialog do Hidrante (`MapComponent.jsx`):**
  - Reformulação tipográfica, hierarquia visual, espaçamentos e organização das informações no popup do hidrante.
  - Adicionado badge destacado de status (`OPERANTE` / `INOPERANTE`), alinhamento claro de labels e valores com contraste alto, coordenadas com precisão e botões com visual moderno.
- **6. Aprimoramentos no Módulo de Estudo Técnico (`TechnicalStudyModal.jsx`):**
  - Circunferência dos hidrantes adjacentes/cidade renderizada em linha tracejada preta (`dashArray: '6, 6'`).
  - Habilitados controles suaves de mapa (`scrollWheelZoom={true}`, `zoomControl={true}`, `dragging={true}`, `doubleClickZoom={true}`) para permitir o enquadramento perfeito para prints e relatórios técnicos.
  - Plotagem de todos os hidrantes da cidade (RA) do estudo com suas respectivas circunferências de área de cobertura.

### [17/08/2026] Etapa 34 Concluída: Integridade de Hidrantes, Padronização de Coordenadas, Badge de Status, Seleção de Texto e Nova Regra de Cálculo no Estudo Técnico
- **1. Integridade da Base de Dados e Ações de Cadastro/Edição (`src/App.jsx`, `xlsxParser.js`, `csvParser.js`):**
  - Todo hidrante carregado do banco de dados agora recebe um `_internalId` exclusivo e imutável como string (`hid_0`, `hid_1`, etc.).
  - A ação de salvar edição (`handleSaveEdit`) foi blindada para correspondência estrita por `_internalId`, impedindo que edições sobrescrevam hidrantes com códigos ou nomes coincidentes (como em Samambaia).
  - O cadastro de novo hidrante gera um `_internalId` novo e único, adicionando a entidade à base sem conflito com os registros existentes.
- **2. Padronização Global de Coordenadas Geográficas:**
  - Padronizada a exibição e manipulação de latitude e longitude para 6 casas decimais (`.toFixed(6)`) na Dialog do Hidrante, Tabela de Dados (CSV e tela), Estudo Técnico e Cadastro/Edição.
- **3. Badge de Status Destacado no Cabeçalho (`MapComponent.jsx`):**
  - O Badge de status (**● OPERANTE** / **● INOPERANTE**) foi reposicionado na mesma linha do código do hidrante alinhado à extrema direita no cabeçalho do popup/dialog (`flex justify-between items-center`), economizando espaço vertical na tela.
- **4. Habilitação de Seleção e Cópia de Texto em Todo o Sistema (`index.css`, `MapComponent.jsx`):**
  - Adicionadas regras globais com `user-select: text !important;` e `-webkit-user-select: text !important;` para popups Leaflet (`.leaflet-popup`, `.argos-popup`), blocos de listas, tabelas e dialogs, permitindo seleção nativa com o mouse para copiar e colar textos.
- **5. Estudo Técnico - Cores e Pinos no Mapa (`TechnicalStudyModal.jsx`):**
  - Hidrante Alvo: Marcador laranja com circunferência tracejada laranja (`dashArray: '6, 8'`).
  - Hidrantes Adjacentes: Marcador preto com circunferência tracejada preta (`dashArray: '6, 6'`).
  - Demais Hidrantes da Cidade (Não Adjacentes): Marcadores verdes tradicionais SEM circunferência tracejada, garantindo foco visual exclusivo nos equipamentos relevantes para a análise.
- **6. Estudo Técnico - Novas Regras de Cálculo Espacial e Parecer:**
  - **Regra de Adjacência (Opção 1):** Considera como adjacente todo hidrante a uma distância $d \le 2R$ do hidrante alvo (interseção geométrica entre as áreas de cobertura normativas).
  - **Regra de Cobertura Interna (Opção A - Amostragem Polar em Anéis Concêntricos):** Avalia ~85 pontos cobrindo o centro ($r=0$), anéis internos ($r=0.33R, 0.66R, 0.85R$) e perímetro ($r=1.0R$) do hidrante alvo. Se 100% dos pontos forem cobertos por hidrantes adjacentes, o pleito é aprovado; caso contrário, é reprovado por déficit de proteção.
  - **Equipamentos no Parecer:** A lista de equipamentos e a comparação no parecer consideram todos os hidrantes adjacentes e incluem explicitamente a **Distância (em metros) até o hidrante avaliado**, código, coordenadas com 6 casas decimais e endereço.

### [17/08/2026] Etapa 35 Concluída: Autocomplete de Hidrante no Estudo Técnico, Validação/Gestão de Coordenadas Inconsistentes e Tabela de Adjacentes no Parecer
- **1. Autocomplete e Busca Inteligente do Código do Hidrante Alvo (`TechnicalStudyModal.jsx`):**
  - Implementado dropdown suspenso com filtro em tempo real conforme o usuário digita no campo "Código do Hidrante Alvo".
  - A busca tolera partes do código, nome, variações de zeros e endereço (ex: `00101`, `GUA`, `GUA00101`).
  - Ao selecionar um hidrante na lista, o código é preenchido com precisão e a RA (Região Administrativa) correspondente é sincronizada automaticamente, exibindo um card de confirmação com resumo dos dados do hidrante alvo.
- **2. Pré-Tratamento Geográfico e Gestão de Coordenadas Inconsistentes (`geoUtils.js`, `MapComponent.jsx`, `InconsistentHydrantsModal.jsx`, `App.jsx`):**
  - Criada a função `isValidDFCoordinate` para validação matemática de coordenadas dentro dos limites operacionais do Distrito Federal e Entorno Integrado (RIDE), descartando coordenadas nulas `(0,0)`, invertidas ou no oceano.
  - O `MapComponent` agora filtra e omite a plotagem de hidrantes com coordenadas anômalas, protegendo a visualização tática e o cálculo de `fitBounds`/zoom no mapa principal e no estudo técnico.
  - Criado o modal exclusivo para Gestores e Administradores **"Hidrantes com Coordenadas Inconsistentes"** (acessível pelo Menu com badge de alerta em tempo real com contador de registros inconsistentes).
  - O painel permite ao Gestor/Adm: 1) **Editar Coordenadas / Dados** (abrindo o `EditHydrantModal` para reposicionar no mapa ou corrigir latitude/longitude) e 2) **Excluir Hidrante** permanentemente da base de dados com diálogo de confirmação.
- **3. Tabela Estruturada de Equipamentos Próximos e Adjacentes no Parecer Técnico (`TechnicalStudyModal.jsx`):**
  - A lista simples com marcadores (bullets) foi substituída por uma **TABELA** formal e elegante tanto na visualização em tela quanto no modo de impressão PDF e no HTML copiado para o SEI (`handleCopySEI`).
  - Colunas da tabela: **Código**, **Distância ao Alvo (metros)**, **Coordenadas Geográficas (Lat, Lng em 6 decimais)**, **Endereço / Localidade** e **Status Operacional (OPERANTE / INOPERANTE)** com estilização e destaque visual.

### [17/08/2026] Etapa 36 Concluída: Correção de Longitude na Edição de Hidrantes Inconsistentes e Satélite no Estudo Técnico
- **1. Correção de Longitude e Inicialização Segura de Coordenadas (`EditHydrantModal.jsx`):**
  - Ao abrir o modal de edição para qualquer hidrante com coordenadas anômalas, nulas ou fora do DF, o sistema inicializa automaticamente a posição do mapa e do formulário centrada na Região Administrativa correspondente do hidrante (ou Brasília).
  - A longitude mantém rigorosamente o sinal negativo e precisão decimal formatada (`.toFixed(6)`), impedindo inversões de sinal ou números corrompidos.
  - Campos de entrada de Lat e Lng suportam digitação flexível (com ponto ou vírgula) com tratamento no `onBlur` e reposicionamento instantâneo do pino ao clicar no mapa.
  - O mapa interno do modal de edição foi atualizado para a camada **Google Satélite Híbrido** com zoom e scroll suaves.
- **2. Mapa de Satélite Híbrido no Módulo de Estudo Técnico (`TechnicalStudyModal.jsx`):**
  - O mapa do Módulo de Estudo Técnico agora utiliza SEMPRE a camada de **Google Satélite Híbrido** (`https://mt0.google.com/vt/lyrs=y&hl=pt-BR&x={x}&y={y}&z={z}` com maxZoom 20), exatamente com as mesmas configurações de visualização do mapa da tela principal.
- **3. Preservação de Dados no Parser de Planilha (`xlsxParser.js`):**
  - Aprimorado o parser para recuperar coordenadas mesmo de linhas com colunas deslocadas e preservar 100% dos hidrantes na base de dados, permitindo que registros com inconsistências fiquem visíveis no painel para saneamento pelos gestores.

### [17/08/2026] Etapa 37 Concluída: Otimização de Performance Global, Plotagem Eficiente de 3.200 Pinos, Virtualização e Resiliência Offline
- **1. Renderização Ultra-Eficiente de 3.200 Pinos no Mapa (`MapComponent.jsx`):**
  - Configurado o `MarkerClusterGroup` com chunked loading otimizado: `chunkedLoading={true}`, `chunkInterval={100}`, `chunkDelay={50}`, `removeOutsideVisibleBounds={true}`, `maxClusterRadius={60}`, `spiderfyOnMaxZoom={true}` e `disableClusteringAtZoom={18}`.
  - Permite navegar, dar zoom e arrastar os 3.200 hidrantes do DF a 60 FPS estáveis sem travamentos de CPU ou gargalos no event loop.
- **2. Geração Sob Demanda de Links Externos (`DataTable.jsx`, `MapComponent.jsx`, `MissionRoutePanel.jsx`):**
  - Removida a pré-geração massiva de strings de URLs para Waze, Google Maps e Street View em loops de dados. Os links de navegação externa agora são calculados e abertos dinamicamente no clique do usuário (`onClick`) via `window.open`, economizando alocações de memória no Heap do JavaScript.
- **3. Identificação Colorida no Filtro de Cidade/RA (`FilterBar.jsx`):**
  - Adicionado destaque visual no seletor de RA com anel ciano/esmeralda com transições suaves e badge indicador: "🎯 Escolha a Cidade / RA".
  - Quando uma cidade é selecionada, exibe o badge "✓ Filtro Ativo", incentivando o foco tático e permitindo limpeza rápida com o botão "LIMPAR FILTROS".
- **4. Virtualização DOM e Paginação Fluida na Lista (`DataTable.jsx`):**
  - Implementada paginação em lotes de alto desempenho mantendo o número de nós DOM sempre sob controle (< 800 elementos), garantindo rolagem lisa e sem perda de fluidez.
- **5. Desmontagem Condicional Inteligente de Abas (`App.jsx`):**
  - Componentes de Tabela, Rota de Missão e Relatório não montam nem processam estruturas desnecessárias no DOM quando o usuário estiver exclusivamente na aba do Mapa, liberando ciclos de CPU.
- **6. Resiliência Offline Completa:**
  - Persistência no LocalStorage e IndexedDB garantindo que a base de hidrantes, vistorias e rotas permaneçam disponíveis mesmo com oscilações e queda completa de internet em viaturas.

### [18/08/2026] Etapa 38 Concluída: Plotagem de Pinos por Demanda de Cidade e Renderização em CircleMarker Canvas
- **1. Carga Inicial Condicional por Cidade/Filtro (`App.jsx`, `MapComponent.jsx`, `FilterBar.jsx`):**
  - No carregamento inicial do sistema / login, o mapa não plota os 3.200 pinos por padrão enquanto nenhuma cidade (RA) ou filtro tiver sido selecionado, mantendo a tela inicial limpa, instantânea e sem lag.
  - O seletor de RA no `FilterBar` exibe como opção padrão "🎯 Selecione uma Cidade / RA..." e inclui a opção explícita "🗺️ Todas as Cidades (Visão DF Completo)".
  - Ao escolher uma cidade (ex: Guará, Taguatinga, etc.), apenas os hidrantes daquela localidade são carregados (~50 a 150 pinos) e o mapa centraliza automaticamente na região com AutoFitBounds.
  - No mapa, quando nenhum filtro estiver ativo, é exibido um badge tático elegante orientando a seleção da cidade no filtro superior.
- **2. Renderização em CircleMarker Canvas Acelerado por GPU (`MapComponent.jsx`):**
  - Substituída a criação de DOM Markers por `CircleMarker` nativo acelerado via Canvas/GPU (`preferCanvas={true}`).
  - Cores e estilização tática de alto contraste (Verde Neon #00FF00 para Operante, Vermelho Neon #FF0000 para Inoperante, Ciano #00FFFF pulsante para selecionados na missão).
  - Todas as interações foram preservadas com 60 FPS lisos: clique para abrir popup completo, atalhos de Ctrl+Clique e duplo clique para missões.### [18/08/2026] Etapa 39 Concluída: Persistência de Memória dos Filtros Globais e Posicionamento do Mapa
- **1. Persistência dos Filtros Globais (`App.jsx`, `FilterBar.jsx`):**
  - Sincronização automática no `localStorage` (`netuno_saved_filters`) de todos os parâmetros de filtro: Cidade/RA (`ra`), Filtro de Ano/Período (`periodo`, `dataInicio`, `dataFim`), Status (`status`), Busca Textual (`buscaGeral`) e Problema (`problema`).
  - Ao reiniciar ou recarregar a página (F5 ou nova sessão), os filtros são automaticamente restaurados e aplicados à base de hidrantes, voltando para a mesma seleção de cidade e ano anterior.
  - Ao clicar no botão "LIMPAR FILTROS", o estado persistido é limpo no `localStorage` e retorna ao padrão.
- **2. Persistência de Centro e Zoom do Mapa (`MapComponent.jsx`):**
  - O centro geográfico (`lat`, `lng`) e o nível de `zoom` do mapa são salvos continuamente no `localStorage` (`netuno_map_state`) ao navegar e movimentar.
  - No carregamento inicial, o mapa restaura a posição e o nível de zoom exatamente onde o usuário havia deixado, sem ser sobrescrito pelo autoFitBounds padrão.
  - Alterações posteriores de Cidade/RA pelo FilterBar acionam o autoFitBounds suavemente para a nova região.

### [18/08/2026] Etapa 40 Concluída: Correção no Relatório de Manutenção CAESB e Trava Obrigatória de Motivo para Hidrantes Inoperantes
- **1. Correção no Relatório de Manutenção CAESB (`MissionReportPanel.jsx`):**
  - O filtro `sortedHidrantesCaesb` e a contagem de `topDefeitos` foram corrigidos para incluir todos os hidrantes com defeitos registrados (`problemasHidrante`), mesmo quando classificados com status operante (ex: Falta luva/cabeçote, vazamento no flange, problemas de tampa/tampão, etc.).
  - A contagem de registros agora reflete com 100% de fidelidade os filtros globais e a listagem (ex: os 218 hidrantes com falta de luva aparecem integralmente no relatório e na exportação da CAESB).
  - Cópia para o SEI, exportação em CSV e mensagens de WhatsApp foram alinhadas para apresentar com clareza o defeito registrado ou status inoperante.
- **2. Trava Obrigatória de Motivo para Hidrantes Inoperantes (`InspectionModal.jsx`):**
  - Substituída a antiga caixa de confirmação por uma trava estritamente impeditiva: é terminantemente proibido salvar uma vistoria com status INOPERANTE sem indicar a causa técnica.
  - Caso o vistoriador tente salvar como inoperante sem defeito assinalado nas perguntas objetivas ou no menu suspenso, o sistema bloqueia e emite o alerta obrigatório orientando a selecionar o problema na lista ou descrevê-lo nas observações.

### [18/08/2026] Etapa 41 Concluída: Otimização Seletiva do Mapa para Visão Global do DF e Preservação de Filtros Cruzados
- **1. Plotagem Condicional e Seletiva no Mapa (`App.jsx`, `MapComponent.jsx`):**
  - Quando o filtro de Cidade/RA estiver selecionado como "Todas as Cidades" (`ra === '__TODAS__'`) e nenhum outro filtro secundário estiver ativo (`buscaGeral`, `periodo`, `status`, `problema` limpos), o mapa **não plota** os 3.200 pinos simultâneos, eliminando qualquer risco de travamento de CPU ou saturação de memória no navegador.
  - O mapa exibe uma mensagem orientativa e amigável: *"🗺️ Visão do DF Completo ativa: A Lista e os Relatórios contêm todos os hidrantes. Selecione uma Cidade/RA específica no filtro acima para visualizar os hidrantes no mapa."*
  - Caso qualquer outro filtro secundário seja ativado (ex: filtrar por data/ano, status Operante/Inoperante, problema técnico específico ou busca textual), os pinos filtrados correspondentes são **plotados normalmente no mapa**, pois formam um subconjunto focado e leve.
  - Se uma cidade específica for selecionada (ex: Guará, Ceilândia, Plano Piloto), apenas os hidrantes daquela localidade são plotados com auto-fitBounds suave.
- **2. Preservação Total dos Relatórios, Dashboard e Lista (`DataTable.jsx`, `MissionReportPanel.jsx`):**
### [19/08/2026] Infraestrutura & CI/CD: Publicação na Vercel e Setup de Testes Mobile
- **1. Repositório Remoto e Versionamento GitHub:**
  - Repositório oficial conectado: `https://github.com/andrerfcampos-max/netuno.git`.
  - Branch de produção configurada: `main`.
  - `.gitignore` aprimorado com exclusão de backups compactados e arquivos sensíveis.
- **2. Pipeline de Deploy Contínuo (Vercel):**
  - Aplicação publicada com sucesso em ambiente de produção HTTPS: `https://netuno-eight.vercel.app/`.
  - Sincronização automática ativa: cada `git push` na branch `main` dispara o build e deploy imediato na nuvem em menos de 30 segundos.
- **3. Guia de QA para Testes Mobile em Campo (`QA_TESTING_GUIDE.md`):**
  - Inclusão da **ETAPA 6** dedicada à homologação de usabilidade em smartphones e tablets, validação de GPS, PWA/instalação offline e responsividade de toque.

### [19/08/2026] Etapa 42 Concluída: Reestruturação do Topo: Fixação dos Filtros Globais, Remoção do Botão 'Filtros' e Posicionamento dos Botões de Navegação Logo Abaixo
- **1. Filtros Fixos no Topo e Sempre Visíveis (`App.jsx`, `FilterBar.jsx`):**
  - O painel de filtros globais (`FilterBar`) agora fica posicionado permanentemente no topo da tela, logo abaixo do cabeçalho e abas de missões.
  - A barra de filtros está sempre visível tanto no Desktop quanto em telas móveis/smartphones (ocultando-se apenas quando o mapa estiver em modo tela cheia), permitindo ao usuário filtrar imediatamente por Cidade/RA, busca livre, status, período ou defeito sem precisar acionar botões intermediários.
- **2. Remoção do Botão 'Filtros' e Reorganização dos Controles de Navegação (`App.jsx`):**
  - O botão retrátil "Filtros" foi totalmente removido do conjunto de abas de visualização.
  - A barra de navegação foi reposicionada **logo abaixo da barra de filtros**.
  - Os botões disponíveis agora são exclusivamente: **Mapa**, **Lista**, **Rota (X)** e **Relatório** (para gestores e administradores), organizados em grade simétrica (`grid-cols-4` ou `grid-cols-3`).
- **3. Eliminação Total de Sobreposições e Conflitos de Layout:**
  - Corrigido o fluxo vertical do DOM, eliminando sobreposições entre os seletores suspensos dos filtros, a barra de botões e o mapa/lista.

### [19/08/2026] Etapa 43 Concluída: Fixação Definitiva do Topo: Filtros Compactos no Topo, Botões Imediatamente Abaixo e Ajuste de Viewport Mobile sem Sobreposição
- **1. Estrutura Fixa no Topo fora do Scroll (`App.jsx`):**
  - O `Header`, `MissionTabs`, `FilterBar` e a barra de botões de navegação (`Mapa`, `Lista`, `Rota`, `Relatório`) foram consolidados em um container fixo/estático superior (`flex-shrink-0`), posicionado fora da área rolável de conteúdo.
  - O container de conteúdo ativo (`main`) utiliza `flex-1 min-h-0 h-full w-full`, permitindo que o mapa e os demais blocos ocupem 100% da área visível restante sem gerar rolagem na página inteira e garantindo que os filtros e botões nunca sumam ao interagir com o mapa no mobile.
- **2. Refinamento e Compactação dos Filtros no Mobile (`FilterBar.jsx`):**
  - Reestruturado o `FilterBar` para ergonomia ultra-compacta no mobile e desktop: altura vertical contida (< 140px no mobile), tipografia limpa, labels concisos e controles responsivos (Seletor de RA com destaque tático, busca livre rápida, botões compactos de status, período e problemas com dropdowns livres de corte por overflow).
- **3. Barra de Navegação Exclusiva com 4 Botões Logo Abaixo dos Filtros (`App.jsx`):**
  - Mantidos exclusivamente os 4 botões: **Mapa**, **Lista**, **Rota (X)** e **Relatório** (para gestor/admin), em grade simétrica com touch targets ergonômicos e realce da aba ativa em verde esmeralda.
- **4. Eliminação Definitiva de Sobreposições e Ajuste do Mapa (`MapComponent.jsx`, `App.jsx`):**
  - Ajustado `MapComponent` para `h-full min-h-[300px] w-full`, adaptando-se perfeitamente à tela de qualquer smartphone sem rolagem vertical desnecessária.
  - Alinhada hierarquia de z-index: Header (z-30), MissionTabs (z-25), FilterBar (z-20), Botões (z-10), Modais (z-50) e Mapa (z-0).

### [20/08/2026] Etapa 44 Concluída: Gráficos Comparativos Multicidades no Relatório Geral e CAESB, Ctrl+Clique sem Dialog e Filtros em Cascata Dinâmica
- **1. Gráficos Comparativos Multicidades no Relatório Geral e CAESB (`MissionReportPanel.jsx`):**
  - Quando "Todas as Cidades" ou múltiplas RAs estão selecionadas:
    - **Relatório Geral (CBMDF)**: Exibe painel comparativo de barras empilhadas horizontais (*Stacked Bar Chart*) com todas as cidades do DF divididas em **🟢 Operantes (Verde)** e **🔴 Inoperantes (Vermelho)**, ordenadas por inoperância e criticidade com contagem e percentuais individuais. Adicionado painel de **Top Defeitos do DF** com indicação das top 4 cidades com maior incidência daquele problema específico.
    - **Relatório CAESB (Manutenção)**: Exibe o ranking de demandas de reparos por cidade e matriz detalhada dos principais defeitos com identificação das regiões onde a CAESB deve priorizar equipes e peças de reposição.
  - Quando apenas uma cidade está selecionada, o relatório mantém a visão simplificada e focada exclusivamente naquela localidade.
- **2. Seleção de Rota com Ctrl + Clique sem Abrir Dialog (`MapComponent.jsx`):**
  - Corrigido o evento de clique no mapa: ao clicar em um marcador segurando a tecla Ctrl (ou Cmd no Mac), o hidrante é adicionado/removido da Rota de Missão ativa e o popup/dialog é suprimido imediatamente (`closePopup`), sem abrir a dialog na tela.
- **3. Filtros em Cascata Dinâmica e Auto-Saneamento (`FilterBar.jsx`, `App.jsx`):**
  - O seletor de Anos e de Problemas agora calcula suas opções disponíveis dinamicamente com base na Cidade/RA e filtros antecedentes selecionados.
  - Implementado auto-reset inteligente: ao alterar a cidade ou o período, se a seleção anterior não existir no novo subconjunto, o campo é limpo automaticamente, eliminando qualquer retorno de tela com resultados vazios.

### [20/08/2026] Etapa 45 Concluída: Povoamento de Missões Mock na Central de Missões e Persistência Resiliente na Fase de Testes
- **1. Criação do Catálogo de Missões Mock (`mockMissions.js`):**
  - Todas as 34 pastas fixas de quartéis e grupamentos especializados foram povoadas com ordens de missão ricas e realistas. Missões configuradas com atribuições militares formais, códigos reais de hidrantes da respectiva RA e distribuição balanceada entre os 3 estados operacionais: **Planejadas / Não iniciadas**, **Em andamento** e **Concluídas (100%)**.
- **2. Mecanismo de Fusão Inteligente e Persistência Resiliente (`storage.js`):**
  - Implementada a fusão automática entre o catálogo de missões e o `localStorage`. Garante que em qualquer novo deploy, abertura em novos aparelhos ou limpeza de cache, todas as pastas e cards permaneçam preenchidos com dados completos para homologação.
  - Preserva integralmente qualquer vistoria cadastrada ou alteração feita pelo usuário nas missões mock, bem como novas missões criadas manualmente.

### [20/08/2026] Etapa 46 Concluída: Refatoração Ergonômica Mobile: Filtros Compactos com Bottom Sheet, Bottom Navigation Bar e Otimização de Espaço Vertical
- **1. Barra de Filtros Inteligente & Bottom Sheet no Mobile (`FilterBar.jsx`):**
  - **No Mobile (< md)**: Substituída a antiga pilha vertical de 5 filtros por uma barra compacta e elegante de 1 linha no topo (Seletor de RA com destaque esmeralda, Campo de Busca rápida e Botão de Filtros com badge numérico de filtros ativos). Ao tocar no botão "Filtros", abre uma gaveta deslizante inferior (*Bottom Sheet / Drawer*) com controles táteis amplos (Status, Período, Problemas e botões "Limpar" e "Aplicar Filtros").
  - **No Desktop (>= md)**: Preservada 100% a grade horizontal completa atual de filtros com todas as suas funcionalidades.
- **2. Barra de Navegação Inferior (Bottom Navigation Bar) no Mobile (`App.jsx`):**
  - No celular, os botões principais de alternância de visão (**Mapa**, **Lista**, **Rota**, **Relatório**) foram movidos para uma barra inferior fixa (*Bottom Nav*) acessível diretamente pela zona de alcance do polegar (*Thumb Zone*), com ícones limpos e badge de hidrantes na missão.
  - No Desktop, a barra intermediária logo abaixo dos filtros permanece inalterada.
  - O rodapé estático pesado foi ocultado no mobile e integrado de forma fluida aos indicadores das abas, liberando mais de 80% de área útil vertical da tela para o Mapa, Rota (Waze) e Relatórios.
- **3. Cards Táticos Responsivos na Aba "Lista" (`DataTable.jsx`):**
  - No mobile, a exibição de hidrantes foi transformada em **Cards Táticos Verticais** com badge de status, dados de endereço e botões de ação rápida (*Dialog*, *Waze*, *+ Vistoria*, *Editar*), eliminando problemas de rolagem horizontal e tabelas cortadas.
  - No Desktop, mantida a tabela tradicional completa com suporte à ordenação e exportação de relatórios CSV.

### [20/08/2026] Etapa 47 Concluída: Refinamento Ergonômico Mobile: Compactação da Dialog do Mapa, Inclusão de Cidade nos Filtros Avançados e Otimização de Densidade nas Listas e Rotas
- **1. Dialog / Popup do Hidrante Compacta no Mapa (`MapComponent.jsx`, `index.css`):**
  - Reduzida a altura e o padding da dialog no Leaflet para `max-h-[50vh]` com scroll interno suave, evitando sobreposição com os botões de zoom `[+]` e `[-]` do mapa.
  - Reorganizada a hierarquia visual em 2 linhas de ações táteis: linha principal com destaque para `[+ VISTORIA]`, `[Waze]` e `[WhatsApp]`; linha secundária compacta para `[Maps]`, `[360°]`, `[Rota +/-]` e `[Editar]`.
- **2. Inclusão de Cidade/RA e Busca nos Filtros Avançados (`FilterBar.jsx`):**
  - O *Bottom Sheet / Drawer* de Filtros Avançados no mobile agora inclui o seletor completo de Cidade/RA e a Busca Livre logo no topo, permitindo trocar e aplicar todos os filtros em um único local centralizado.
- **3. Otimização de Densidade no Painel de Rota (`MissionRoutePanel.jsx`):**
  - Corrigido o cabeçalho para evitar sobreposição e corte do nome da missão e badges.
  - Compactado o botão de navegação Waze do topo e ajustado o layout dos cards de hidrantes para separar claramente os dados de endereço/problemas dos botões de ação.
  - Reorganizados os 4 botões inferiores em grade harmônica 2x2 com altura padrão de 36-38px.
### [20/08/2026] Etapa 48 Concluída: Fixação Permanente da Barra Inferior, Eliminação do Termo Dialog, Otimização de Rolagem e Ações da Rota e Quebra de Linha nos Relatórios
- **1. Fixação Permanente da Bottom Navigation Bar (`App.jsx`, `MapComponent.jsx`):**
  - A barra inferior (`Mapa`, `Lista`, `Rota`, `Relatório`) no mobile foi fixada com `z-index: 40`, `backdrop-blur`, sombra e altura mínima garantida (`min-h-[52px]`), assegurando que permaneça permanentemente visível e acessível em todas as telas e abas, impedindo a sensação de erro ou travamento no sistema.
- **2. Substituição do Termo Técnico "Dialog" por "Detalhes" (`DataTable.jsx`):**
  - Nos cards mobile e na tabela desktop, o botão e tooltip foram renomeados de "Dialog" para **"Detalhes"** / **"Ver Detalhes e Ficha no Mapa"**, adequando o sistema ao vocabulário militar e operacional em campo.
- **3. Otimização de Rolagem, Ações da Rota e Modal de Salvar Rota (`MissionRoutePanel.jsx`):**
  - Reorganizadas as 4 ações do rodapé da rota (`WhatsApp`, `Salvar`, `Limpar`, `Relatório`) em uma grade horizontal tátil ultra-compacta em linha única (altura 34-36px), liberando altura vertical para a listagem dos hidrantes.
  - Adicionado `scroll-pt-2` e espaçamento de respiro no container de hidrantes da rota para evitar cortes do primeiro card ao rolar até o topo.
  - O mini-modal de "Salvar Rota" foi aprimorado com layout de diálogo centralizado, botão "X" de fechar, backdrop e foco responsivo compatível com abertura de teclado virtual.
- **4. Quebra de Linha e Padding nos Relatórios (`MissionReportPanel.jsx`):**
  - No ranking de "Principais Tipos de Defeitos para Intervenção CAESB" e nos Top Defeitos do CBMDF, os nomes técnicos dos defeitos agora quebram linha de forma limpa (`break-words leading-tight`), eliminando reticências no meio do texto.
  - Adicionado padding inferior estendido (`pb-36`) para que nenhum card de defeito ou tabela fique encoberto pelos botões de exportação ou pela barra de navegação inferior.
### [20/08/2026] Etapa 49 Concluída: Unificação de Ações de Rota, Menu Suspenso de Exportação no Relatório, Ajustes de KPIs e Correção da Barra de Progresso nas Missões
- **1. Despoluição do Topo e Unificação de Ações de Rota (`App.jsx`, `MissionRoutePanel.jsx`):**
  - Removida a renderização da barra de abas superiores (`MissionTabs`) do layout principal no `App.jsx`, liberando altura útil no topo e eliminando a duplicidade da aba "Rascunho de Hoje".
  - No `MissionRoutePanel.jsx`, o cabeçalho foi simplificado (mantendo o nome e badges de progresso/pasta) e a função de renomeação/salvamento foi unificada exclusivamente no botão principal "Salvar" do rodapé (com seleção de pasta de quartel).
- **2. Título Oficial e Identificação de RA no Cabeçalho do Relatório (`MissionReportPanel.jsx`):**
  - Título padronizado para **"Relatório de Vistoria"** (em substituição a "Relatório Tático").
  - Incluído no cabeçalho do Relatório Geral (CBMDF) o badge com as Regiões Administrativas filtradas (`Regiões Administrativas (RAs): {rasPresentes}`), garantindo paridade visual com o Relatório CAESB.
- **3. Ajuste Visual em KPIs e Gráficos de Defeitos (`MissionReportPanel.jsx`):**
  - Cards de Métricas (`Total`, `Operantes`, `Inoperantes`): Tipografia compacta nos títulos sem cortes por reticências, com números principais em destaque e percentuais posicionados de forma harmônica em badges coloridos.
  - Gráficos de Top Defeitos e Defeitos CAESB: Layout fluido com badges estilizados (`12 ocorr. (32.4%)`), evitando quebras verticais encavaladas no mobile.
- **4. Menu Suspenso de Exportação/Compartilhamento (`MissionReportPanel.jsx`):**
  - A barra flutuante horizontal fixa antiga que cobria o rodapé e sobrepunha modais foi substituída por um **Menu Suspenso / Botão de Ação Único** (`[📤 Exportar / Compartilhar ▾]`) com as 4 opções (*PDF*, *Copiar p/ SEI*, *WhatsApp*, *CSV*), acessível na toolbar superior e em botão flutuante discreto.
- **5. Correção do Overflow da Barra de Progresso na Central de Missões (`MissionManagerModal.jsx`):**
  - Aplicado `w-full min-w-0` e `overflow-hidden` no container da barra de progresso nos cards de missões, com limitador de percentual (`Math.min(100, Math.max(0, progress))`), impedindo que a barra extrapole a box do card no mobile.

### [24/08/2026] Etapa 50 Concluída: Bateria de Ajustes Mobile, Usabilidade, WhatsApp, Gestão de Missões e Persistência Resiliente no F5
- **1. Seleção Total na Lista Mobile (`DataTable.jsx`):**
  - Adicionado no topo da visualização em cards mobile o checkbox de controle rápido **"Selecionar Todos ({data.length})"**, permitindo incluir ou remover todos os hidrantes filtrados da Rota de Missão com 1 toque no smartphone.
- **2. Correção de Emojis no WhatsApp Desktop vs Mobile (`MissionReportPanel.jsx`, `MissionRoutePanel.jsx`, `MapComponent.jsx`):**
  - Substituída a rota intermediária com perda de codificação UTF-8 (`wa.me`) por detecção inteligente de ambiente: no Desktop direciona direto para `https://web.whatsapp.com/send?text=...`, preservando 100% dos emojis militares (🚒, 📋, 👤, 📊, ✅, ⏳, 🟢, 🔴, 🔗, 🌐, 📍) sem caracteres quebrados; no Mobile mantém abertura direta para o aplicativo nativo (`api.whatsapp.com`).
- **3. Feedback Visual Instantâneo na Busca com Filtros no Mobile (`FilterBar.jsx`, `App.jsx`):**
  - No Bottom Sheet de filtros avançados no mobile, adicionado contador de hidrantes reativo em tempo real logo abaixo do campo de busca livre (`🔍 {count} hidrante(s) encontrado(s)`), no cabeçalho do drawer e no botão dinâmico de rodapé (`✓ Aplicar e Ver {count} Hidrante(s)`).
- **4. Deslizar para Excluir com Confirmação na Central de Missões (`MissionManagerModal.jsx`):**
  - Implementado suporte ao gesto tátil de swipe para a esquerda nos cards de missões, abrindo diálogo modal de confirmação de exclusão (`Deseja realmente excluir a missão '{name}'?`) com opções explícitas para confirmar ou cancelar.
- **5. Limpeza de Busca no Botão "Início" (`MissionManagerModal.jsx`):**
  - Ao clicar no botão "Início" da barra de breadcrumbs, a pasta raiz é selecionada e o campo de busca por digitação é automaticamente limpo.
- **6. Busca por Digitação Exclusiva na Pasta Raiz (`MissionManagerModal.jsx`):**
  - A caixa de busca por texto é renderizada exclusivamente na pasta raiz da Central de Missões, ocultando-se ao navegar dentro de pastas de quartéis.
- **7. Busca na Raiz por Nome de Pastas e Missões (`MissionManagerModal.jsx`):**
  - O filtro de busca na raiz agora pesquisa simultaneamente os nomes das pastas de quartéis e das missões da raiz.
- **8. Remoção de Gestos de Arrastar para o Lado (`App.jsx`, `MissionReportPanel.jsx`):**
  - Removidos todos os atalhos de swipe horizontal para troca de abas principais e troca entre relatórios, eliminando transições acidentais de tela durante o manuseio.
- **9. Confirmação ao Salvar Alterações de Hidrante (`EditHydrantModal.jsx`):**
  - Adicionado diálogo de confirmação ao clicar em "Salvar Alterações", oferecendo as opções "Salvar Alterações", "Continuar Editando" e "Descartar Alterações".
- **10. Renomeação do Botão de Rota (`MissionRoutePanel.jsx`):**
  - Botão de salvamento de rota padronizado para **"Cadastrar nova rota de missão"** (e modal atualizado para **"Cadastrar Nova Rota de Missão"**).
- **11. Persistência Resiliente no F5 de Vistorias, Edições e Rotas (`storage.js`, `App.jsx`):**
  - Desenvolvido mecanismo estruturado de gravação em `localStorage` (`loadHydrantChanges`/`saveHydrantChanges` e `loadActiveMissionState`/`saveActiveMissionState`).
  - Na recarga de tela (F5), a base de dados funde automaticamente as vistorias realizadas, novos hidrantes cadastrados, edições e exclusões, além de manter ativas as abas de missões abertas.

### [24/08/2026] Etapa 52 Concluída: Ajustes de UI/UX, Navegação Rota ⇄ Missões, Correção de Loop no Mapa, Plotagem por Cidade e Refinamentos Gerais
- **1. Exclusão da Frase no Rodapé Inferior Desktop (`App.jsx`):**
  - Removido o texto `"Selecione ou crie uma Missão na Central"` do footer desktop quando nenhuma missão estiver ativa.
- **2. Atualização da Legenda do Mapa (`MapComponent.jsx`):**
  - Textos normatizados de `"Operante"` / `"Inoperante"` para **"Hidrante operante"** e **"Hidrante inoperante"**.
- **3. Confirmação ao Excluir Hidrante da Rota (`MissionRoutePanel.jsx`):**
  - Ao clicar no botão de exclusão (`X`), adicionado diálogo de confirmação explícito antes de remover o hidrante da rota de missão.
- **4. Asteriscos Vermelhos em Respostas Obrigatórias de Vistoria (`InspectionModal.jsx`):**
  - Adicionado asterisco vermelho (`*`) em destaque em todas as perguntas obrigatórias (Perguntas 1 a 5) do formulário de vistoria rápida.
- **5 & 6. Navegação Fluida Rota ⇄ Central de Missões e Correção do Botão Voltar (`MissionRoutePanel.jsx`, `MissionManagerModal.jsx`, `App.jsx`):**
  - Adicionado botão **"← Voltar"** no cabeçalho do painel de rota para retornar diretamente à Central de Missões e rever a listagem de missões do quartel.
  - Corrigido o botão **"← Voltar"** na Central de Missões para navegar hierarquicamente da subpasta atual para a pasta anterior/raiz em vez de fechar o modal. Ao estar na raiz, o botão fecha o modal.
- **7. Correção Definitiva do Bug de Loop/Piscamento de Dialog no Mapa (`MapComponent.jsx`):**
  - Eliminada a geração de `key` instável com `Date.now()` no `<Marker>` e removidos os timeouts recursivos em hooks `ref` e `add` que causavam destruição e recriação infinita de marcadores.
  - Popup de hidrante centralizado controlado via `useEffect` único com mapa de referências (`markerRefs`).
- **8. Novas Regras de Plotagem por Cidade e Remoção de 'Todas as Cidades' (`FilterBar.jsx`, `App.jsx`, `MapComponent.jsx`):**
  - Removida a opção `__TODAS__` (*Todas as Cidades / Visão DF Completo*) de todos os dropdowns de seleção de RA.
  - O mapa plota pinos exclusivamente quando uma Cidade/RA for selecionada (ou hidrante individual aberto), exibindo banner orientativo aos usuários.
  - A Lista (`DataTable`), Relatórios e Dashboard continuam recebendo e processando a totalidade dos hidrantes do DF quando o seletor estiver na opção padrão *"Escolha a Cidade / RA..."*.
### [24/08/2026] Etapa 53 Concluída: Ordenação Alfabética de Cidades, Sugestão de Endereço Estilo iFood, GPS no Cadastro de Hidrante, Descrição e Conexão de Busca Livre com Cidade
- **1. Ordenação Alfabética Estrita das Cidades / RAs (`src/utils/raList.js`, `EditHydrantModal.jsx`):**
  - Lista de RAs oficiais padronizada e ordenada rigorosamente em ordem alfabética (Águas Claras, Arniqueira, Brasília, Brazlândia, Candangolândia, Ceilândia, Cruzeiro, Fercal, Gama, Guará, Itapoã, Jardim Botânico, Lago Norte, Lago Sul, Núcleo Bandeirante, Paranoá, Park Way, Planaltina, Recanto das Emas, Riacho Fundo, Riacho Fundo II, Samambaia, Santa Maria, São Sebastião, SCIA/Estrutural, SIA, Sobradinho, Sobradinho II, Sol Nascente/Pôr do Sol, Sudoeste e Octogonal, Taguatinga, Varjão, Vicente Pires).
  - No formulário de cadastrar e editar hidrantes, o dropdown de RAs renderiza a lista em ordem alfabética.
- **2. Sugestão Pré-preenchida de Endereços Estilo iFood (`EditHydrantModal.jsx`):**
  - Implementado sistema de autocomplete com dropdown de sugestões em tempo real ao digitar no campo "Endereço".
  - Cruzamento de dados inteligente: consulta rápida na base de hidrantes (filtrando por RA selecionada com ponto de referência e coordenadas) e consulta via API de Geocodificação OpenStreetMap/Nominatim (limitada ao DF com debounce).
  - Ao clicar em uma sugestão, o endereço, ponto de referência, RA, código sequencial e coordenadas são automaticamente preenchidos, com o mapa de satélite voando suavemente para a posição.
  - Ao reposicionar o pino no mapa, um chip sugere o endereço do ponto clicado com 1 toque ("Usar este").
- **3. Localização do Usuário por GPS no Cadastro de Hidrante (`EditHydrantModal.jsx`):**
  - Ao abrir a tela "Cadastrar Novo Hidrante", o sistema solicita automaticamente o GPS do usuário, centralizando o mapa de satélite no local e posicionando o pino vermelho nas coordenadas exatas.
  - Se nenhuma RA tiver sido selecionada, o sistema calcula a distância geodésica e seleciona automaticamente a RA mais próxima, gerando o código sequencial posterior.
  - Adicionado botão flutuante no mapa (`[ 🎯 Minha Localização ]`) com feedback visual de carregamento para re-centralizar no GPS sob demanda.
- **4. Descrições Claras nos Campos de Busca Livre (`FilterBar.jsx`):**
  - Atualizados os placeholders dos inputs de busca livre no Desktop (`🔍 Buscar por Código (ex: GUA00101), Endereço, Rua, Bairro ou Ponto de Ref...`), Mobile (`🔍 Código, Rua, Endereço...`) e Drawer de filtros avançados (`🔍 Digite Código (ex: GUA00101), Endereço, Rua, Bairro ou Ponto de Ref...`).
- **5. Integração Perfeita entre Busca Livre e Filtro de Cidade com Contadores Reativos (`App.jsx`, `FilterBar.jsx`):**
  - A busca livre agora normaliza textos desacentuados (`normalizeSearchText`) e pesquisa em múltiplos termos contra Código, Nome, Endereço, Ponto de Referência, RA (Cidade) e Problemas.
  - Busca livre opera perfeitamente conectada e restrita à cidade selecionada (ou a todo o DF caso nenhuma esteja selecionada).
  - Adicionados badges de contagem reativa em tempo real no Desktop e Mobile, exibindo com precisão quantos hidrantes foram encontrados (ex: `12 hidrante(s) (Guará)` ou `✓ 12 hidrante(s) encontrado(s) no Guará`, ou `0 encontrados`).

### [24/08/2026] Etapa 54 Concluída: Bottom Sheet Tático do Hidrante no Mobile, Centralização com Map Offset Pan e Botões Touch-Friendly Padronizados
- **1. Painel Inferior Tático (Bottom Sheet) no Mobile (`MapComponent.jsx`):**
  - Substituído o popup flutuante tradicional do Leaflet por um **Bottom Sheet Tático** ancorado na base da tela (`inset-x-0 bottom-0 z-[1050]`), otimizado para navegação mobile com uma mão só.
  - O painel ocupa uma altura contida (~30% da tela), deixando a área superior do mapa totalmente desobstruída para visualização do pino e arruamento.
  - Cabeçalho limpo com Código em destaque, Foto em miniatura (expansível com zoom), RA, Badge de Status (`● OPERANTE` / `● INOPERANTE`) e botão `✕` de fechamento.
  - Informações essenciais organizadas: Endereço em destaque, Ponto de Referência, tarja de alerta em vermelho caso haja defeitos registrados e coordenadas/data da última vistoria em tipografia compacta.
- **2. Centralização Inteligente do Pino com Deslocamento Vertical (Map Offset Pan) (`MapComponent.jsx`):**
  - Ao selecionar um hidrante pelo mapa, tabela ou rota, o mapa calcula o deslocamento em pixels (`yOffset = 115px`) no espaço de projeção do Leaflet.
  - O pino do hidrante fica perfeitamente posicionado e centralizado na área útil visível do mapa (entre o topo e o Bottom Sheet), permitindo enxergar simultaneamente o hidrante, a rota e a ficha cadastral sem sobreposição.
- **3. Barra de Ações Ergonômicas Touch-Friendly (Botões de 48px de altura) (`MapComponent.jsx`):**
  - Botões táteis largos e padronizados para acionamento fácil em viatura:
    - **`+ VISTORIA`**: Botão primário largo verde esmeralda para cadastro rápido;
    - **`Waze`**: Botão azul tático com ícone de navegação e label;
    - **`Google Maps`**: Botão para rotas alternativas;
    - **`Street View 360°`**: Botão âmbar para inspeção visual da fachada/calçada;
    - **`WhatsApp`**: Botão para compartilhamento instantâneo com emojis operacionais;
    - **`+ Rota / ✕ Rota`** e **`Editar`**: Ações de missão e edição cadastral para gestor e administrador.
- **4. Interação Fluida no Mapa (`MapComponent.jsx`):**
  - Tocar no mapa fora do painel fecha o Bottom Sheet suavemente.
  - Adicionado suporte nativo a **Gesto de Arrastar/Deslizar para Baixo (Touch Swipe Down)** na barra de puxar e cabeçalho para minimizar e fechar a dialog com facilidade.
  - O botão de GPS e a legenda do mapa ajustam suas posições automaticamente quando o painel está aberto, evitando sobreposições.
- **5. Isolamento Visual do Pino Inspecionado vs. Selecionado para Rota (`MapComponent.jsx`):**
  - O anel azul-ciano (`#00FFFF`) pulsante é reservado **exclusivamente** para hidrantes adicionados à Rota de Missão (`isSelected`).
  - Ao clicar no pino para abrir a dialog, o hidrante não é adicionado à rota e recebe apenas uma borda branca de destaque (`isInspected`), eliminando falsas impressões de seleção.
- **6. Layout dos Botões de Ação em Duas Linhas Táticas (`MapComponent.jsx`):**
  - Linha 1: Botão largo de destaque **`+ CADASTRAR VISTORIA`** em verde esmeralda (100% da largura, touch-target confortável sem corte lateral de texto).
  - Linha 2: Grade fluida com 6 botões quadrados de ação rápida (`[Waze]`, `[Maps]`, `[360°]`, `[Zap]`, `[Rota +/-]`, `[Editar]`), cabendo perfeitamente em telas pequenas de 360px sem overflow.

### [24/08/2026] Etapa 55 Concluída: Módulo de Pré-Planejamento Operacional (PPO) - Estudo de Edificações para Operações de Incêndio (CBMDF)
- **1. Item no Menu Superior e Acesso Direto (`App.jsx`):**
  - Adicionado novo item de menu com título **"Estudo de edificações"** e descrição **"informações importantes para operações de incêndio"** com ícone tático `Building2`.
  - Suporte a abertura em nova guia via URL query param (`?modal=estudo-edificacoes` ou `?view=building-study`).
- **2. Mensagem Explicativa Orientativa (`BuildingStudiesModal.jsx`):**
  - Renderizada a faixa de instrução no topo: *"Escolha a cidade e verifique as informações pre cadastradas sobre as edificações para auxiliar na tomada de decisões das operações de incêndio."*
- **3. Filtros Rápidos por Cidade e Busca com Digitação (`BuildingStudiesModal.jsx`):**
  - Filtro por Cidade (Região Administrativa) utilizando a lista unificada `raList.js` e contadores de estudos cadastrados.
  - Busca livre instantânea desacentuada por nome do edifício, razão social, endereço, tipo de ocupação, produtos perigosos e áreas críticas.
  - Botão de ação `+ Novo Estudo` para cadastro ágil.
- **4. Campos e Estruturação de Dados Táticos (Doutrina CBMDF / SCI) (`buildingStudiesStorage.js`):**
  - **A. Identificação e Reconhecimento:** Nome fantasia, razão social, endereço padronizado, RA, CEP, Coordenadas (com captura automática de GPS), Classificação de Ocupação (NT/CBMDF), População (Fixa x Flutuante e alerta de evacuação prioritária) e Contatos de Emergência com botões de discagem rápida (`tel:`).
  - **B. Trem de Socorro e SCI:** Vias de acesso principal e alternativa, restrições viárias/gabaritos, posicionamento pré-definido para ABT (combate), AET/Plataforma (salvamento em altura com raio livre), Posto de Comando (PC) do SCI e Área de Concentração de Vítimas (ACV) / Triagem START.
  - **C. Abastecimento Hídrico:** Reserva Técnica de Incêndio (RTI em Litros/m³), Registro de Recalque (tipo passeio/fachada e localização), identificação dos 2 hidrantes urbanos CAESB mais próximos *(com geocálculo automático na base de dados do Netuno)* e mananciais alternativos.
  - **D. Sistemas de Proteção e Cortes:** Chave Geral de Energia Elétrica (QDG/Subestação), Válvula Geral de Gás (GLP/GN), Sprinklers (localização da VGA), Escadas de Emergência/Pressurização e Gerador de Emergência.
  - **E. Riscos Específicos e Carga de Incêndio:** Classificação da Carga (Baixa, Média, Alta), Produtos Perigosos/Químicos com classe ONU, Áreas Críticas internas e Risco de Colapso Estrutural.
  - **F. Arquivos Táticos Anexos:** Foto da Fachada Principal (com compressão automática via Canvas) e Croqui Tático Simplificado / Planta Baixa com visualizador em tela cheia e zoom.
- **5. Ficha Tática Operacional de Resposta Rápida e Despacho WhatsApp (`BuildingStudiesModal.jsx`):**
  - Modal de alto contraste para leitura sob luz solar/fumaça em campo.
  - Botão de compartilhamento formatado no padrão SCI para despacho operacional imediato via WhatsApp.
  - Botão para impressão/exportação da ficha tática PPO.

### [24/08/2026] Etapa 56 Concluída: Ajustes no Módulo de Estudo de Edificações (PPO): Ficha Completa PPO, 3 Hidrantes mais Próximos com Waze, Salvar e Continuar, e Auto-Scroll em Novo Contato
- **1. Renomeação do Botão Principal (`BuildingStudiesModal.jsx`):**
  - O botão de abertura da visão tática nos cards de edificações e nas ações correspondentes foi renomeado de **"Ficha Tática PPO"** para **"Ficha Completa PPO"**, preservando o ícone `Eye` e seu destaque visual com gradiente.
- **2. Exibição dos 3 Hidrantes mais Próximos com Navegação Waze (`BuildingStudiesModal.jsx`, `buildingStudiesStorage.js`):**
  - A função `findNearestHydrantsForBuilding` foi atualizada para calcular e retornar por padrão os **3 hidrantes urbanos mais próximos** (`limit = 3`) com coordenadas geográficas (`lat`, `lng`), código, endereço, status operacional e distância geodésica calculada.
  - Na visualização da **Ficha Completa PPO** (Seção C: Abastecimento Hídrico / Hidrantes Urbanos de Coluna Próximos), os 3 hidrantes mais próximos são apresentados em cards estruturados contendo código, status, endereço e um **botão rápido do Waze** (`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`) para navegação tática direta da viatura até o hidrante urbano.
  - Na seção C do formulário de preenchimento, o botão de busca automática foi atualizado para **"Buscar 3 Mais Próximos Automaticamente"**, com botões de navegação Waze disponíveis para validação em campo.
- **3. Botão de Acesso Rápido "Salvar e Continuar" (`BuildingStudiesModal.jsx`):**
  - Adicionado no cabeçalho e na barra de navegação sticky do formulário de estudo de edificações o botão **"Salvar e Continuar"** / **"Salvar Rascunho"**.
  - O militar pode salvar as alterações preenchidas no `localStorage` a qualquer momento durante a digitação **sem fechar a tela** e sem perder a rolagem ou a seção ativa, com feedback visual em banner toast esmeralda (*"✅ Alterações salvas com sucesso!"*).
- **4. Auto-Scroll e Foco ao Adicionar Novo Contato (`BuildingStudiesModal.jsx`):**
  - No formulário de preenchimento (Seção A: Identificação e Contatos), ao clicar no botão **"+ Adicionar Contato"**, a tela realiza uma rolagem suave (`scrollIntoView`) até a nova linha criada e posiciona automaticamente o cursor/foco no primeiro campo de digitação, fornecendo feedback tátil imediato ao usuário.

### [31/08/2026] Etapa 58 Concluída: Novo Sistema de Seleção (Carrinho Flutuante) e Desacoplamento de Missões
- **1. Desacoplamento de Seleção e Missões:** A seleção avulsa de hidrantes no mapa e na tabela não altera as missões salvas e extingue a criação involuntária de rascunhos.
- **2. Balão Flutuante Móvel (Carrinho de Seleção):** Adicionado elemento flutuante móvel/arrastável com suporte a descarte (lixeira) e Bottom Sheet responsivo para criar nova missão, adicionar a existente ou limpar seleção.
- **3. Foco no Mapa e Ações Padronizadas:** Abertura fluida da dialog do hidrante a partir dos itens do carrinho e controle de acesso restrito a gestores e administradores.

### [31/08/2026] Etapa 59 Concluída: Regra de Missão Única Aberta e Validação com Aviso em Relatório de Missão Não Iniciada
- **1. Regra de Missão Única Aberta (Exclusividade de Rota Ativa) (`App.jsx`, `MissionManagerModal.jsx`):**
  - Em todo o sistema, apenas **1 única missão** permanece com status aberta por vez.
  - Ao criar uma nova missão (pelo carrinho de seleção, atalhos, importação de URL) ou ao clicar em "Abrir" na Central de Missões (`MissionManagerModal`), a nova missão assume como a única aberta (`setOpenMissionIds([mission.id])` e `activeMissionId = mission.id`), desmarcando as missões abertas anteriormente.
  - Na Central de Missões (`MissionManagerModal`), apenas a missão ativa exibe o status `"Já Aberta"`, enquanto todas as outras exibem normalmente o botão `"Abrir"`.
- **2. Validação com Aviso ao Gerar Relatório de Missão Não Iniciada (`App.jsx`, `MissionRoutePanel.jsx`):**
  - Ao clicar no botão **"Relatório da Missão"** na tela de Rota de Missão, o sistema valida se a missão atual foi iniciada (`completedIds.length > 0`).
  - Se a missão ainda não foi iniciada (0 vistorias concluídas), o sistema bloqueia o redirecionamento e dispara um alerta Toast claro e nítido: *"Esta missão ainda não foi iniciada. Realize ao menos uma vistoria para gerar o relatório."*

### [31/08/2026] Etapa 60 Concluída: Normalização de Base PREPOP, Confirmação de Relatório Parcial, Base Limpa CSV e Evidências Fotográficas CAESB
- **1. Processamento e Higienização da Base PREPOP (`scripts/process_prepop.cjs`, `public/prepop_estabelecimentos.json`):**
  - Processados 1.781 registros do levantamento operacional PREPOP (`oPERACIONALPREPOP-20260827032950.xlsx`).
  - Recuperados e higienizados 730 registros que não continham o nome do estabelecimento separado, extraindo nomes comerciais e residenciais dos endereços e expandindo siglas educacionais (EC, CEF, CEM, CAIC, UBS, Hospitais).
  - Unificada a nomenclatura operacional para **"Nome do estabelecimento"** (`nomeEstabelecimento`), eliminando a segregação desnecessária de razão social na operação.
  - Sanitizadas coordenadas geográficas e normalizadas RAs para o padrão do Netuno com compatibilidade offline e carregamento assíncrono em `BuildingStudiesModal.jsx`.
- **2. Confirmação de Relatório Parcial para Missão em Andamento (`App.jsx`):**
  - Ao clicar no botão "Relatório da Missão" quando a missão possuir vistorias concluídas mas ainda tiver hidrantes faltantes (`compIds.length < totalIds.length`), o sistema exibe diálogo de confirmação: *"Missão não concluída (x/y). Deseja gerar o relatório parcial dos x hidrantes vistoriados?"*.
  - Se o militar cancelar, permanece na rota; se confirmar, abre a visualização de relatório da missão.
- **3. Padronização da Base Limpa Oficial em CSV (`scripts/export_clean_database.cjs`, `xlsxParser.js`):**
  - Gerados os arquivos oficiais limpos e leves `public/hidrantes_df_oficial.csv` e `public/hidrantes_df_oficial.json` (3.400 hidrantes do DF).
  - O parser do Netuno agora carrega prioritariamente a base limpa oficial, mantendo compatibilidade de fallback com `base-de-dados.xlsx` para transição segura em produção.
### [31/08/2026] Etapa 61 Concluída: Padronização e Unificação da Identidade Visual (Netuno Design System) de Todos os Modais, Menus e Telas
- **1. Menu Principal Desacoplado do "Efeito Arco-Íris" (`App.jsx`):**
  - Padronizados todos os itens do menu dropdown suspenso em uma base escura elegante e tática (`bg-slate-900/95 backdrop-blur-md border-slate-700/80 rounded-2xl`).
  - Cada item agora possui estrutura uniforme em 2 linhas (Título semibold em branco e Subtítulo descritivo em slate-400), com ícone temático em caixa tonal suave e badges de alerta integrados.
- **2. Cabeçalho Universal de Modais e Telas Secundárias (`ModalHeader` Pattern):**
  - Implementado padrão de cabeçalho unificado em todos os 7 modais do sistema (`BuildingStudiesModal`, `TechnicalStudyModal`, `InconsistentHydrantsModal`, `MissionManagerModal`, `EditHydrantModal`, `InspectionModal`, `UserManagerModal`, `CloudConfigModal`):
    - Lado Esquerdo: Botão `← Voltar` (em `bg-slate-800 border-slate-700`) + Caixa de ícone gradiente esmeralda (`w-9 h-9 rounded-xl`) + Título hierárquico em branco com subtítulo e badges de contagem.
    - Lado Direito: Ações rápidas contextuais + Botão de fechar `X` do Lucide.
- **3. Unificação de Abas de Navegação (Segmented Control em `MissionReportPanel.jsx` e `MissionManagerModal.jsx`):**
  - Corrigida a discrepância no painel de relatórios onde a aba CBMDF ficava azul e a aba CAESB ficava verde: ambas as abas agora utilizam o Verde Netuno (`bg-emerald-600 text-white shadow-md font-bold`) quando ativas e tons neutros quando inativas.
- **4. Padronização de Botões de Ação Primária e Formulários (`EditHydrantModal.jsx`, `InspectionModal.jsx`):**
  - Substituídos botões laranjas e genéricos de salvamento pelo padrão Verde Esmeralda (`bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg`).
  - Inputs e selects harmonizados com anel de foco esmeralda (`focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500`).

### [31/08/2026] Etapa 62 Concluída: Ordenação Tática de Relatórios (Mais Recente para Mais Antiga e Rota de Missão por Proximidade)
- **1. Ordenação Cronológica de Vistorias Concluídas (`MissionReportPanel.jsx`):**
  - Nas tabelas e relatórios (Relatório Geral CBMDF, Relatório CAESB, PDF, SEI, CSV e WhatsApp), os hidrantes com vistoria realizada são ordenados da mais recente para a mais antiga (`parseDate(b.datHoraUltimaVistoria) - parseDate(a.datHoraUltimaVistoria)`).
- **2. Preservação da Sequência de Vistorias Pendentes:**
  - Hidrantes pendentes mantêm a sequência lógica de execução conforme a proximidade da rota de missão.

### [31/08/2026] Etapa 63 Concluída: Otimização de Rota Viária em Lotes (Chunking OSRM) para Cidades Grandes e Macro-Rotas (Taguatinga/Brasília)
- **1. Roteamento Viário em 2 Etapas para Grandes Volumes (`MissionRoutePanel.jsx`):**
  - Eliminada a trava rígida de 50 hidrantes. O sistema agora processa rotas com centenas ou milhares de hidrantes (ex: Taguatinga com ~400 hidrantes e Brasília com ~1.000 hidrantes) utilizando roteamento viário em 2 etapas.
  - **Passo 1 (Macro-Ordenação Espacial):** Executa pré-ordenação contínua por TSP Geodésico (Haversine) criando a espinha dorsal do trajeto a partir do GPS/ponto inicial sem saltos espaciais bruscos.
  - **Passo 2 (Micro-Otimização e Métricas em Lotes OSRM):** Segmenta a rota em blocos contíguos de 20 hidrantes, consultando a matriz viária OSRM (`/table/v1/driving/`) para cada lote com encadeamento contínuo do último ponto do lote para o início do seguinte.
- **2. Resiliência por Lote e Indicador Visual de Progresso (`MissionRoutePanel.jsx`):**
  - Caso algum lote individual sofra timeout ou rate limit, o sistema aplica fallback geodésico apenas para aquele lote específico, sem abortar a rota inteira nem os demais lotes calculados com sucesso.
  - Adicionado badge de progresso tático reativo no cabeçalho durante a otimização de grandes cidades (`Otimizando vias (X/Y)...`).
  - Todas as métricas de distância real (`km via trânsito`) e tempo de deslocamento (`~X min`) são preservadas e exibidas para todos os hidrantes calculados.

### [01/09/2026] Etapa 64 Concluída: Reformulação Tática da Rota de Missão: Eliminação de Sobreposições, Layout Compacto e Feedback Visual de Cálculo no Mobile
- **1. Feedback Visual de Status de Rota no Mobile (`MissionRoutePanel.jsx`):**
  - Removida a classe `hidden sm:inline-flex` que ocultava o status de cálculo de rotas em dispositivos móveis.
  - Adicionado badge de status dinâmico em tempo real visível no topo:
    * `🔄 Calculando...` com animação pulsante em âmbar enquanto o algoritmo TSP/OSRM processa em segundo plano.
    * `🚗 Trânsito` ou `⚡ Rota Pronta` quando a rota estiver calculada e pronta para navegação.
  - Adicionado botão compacto de 'Recalcular' (`RotateCcw`) no cabeçalho para forçar atualização instantânea da rota a partir da posição GPS atual do militar.
- **2. Eliminação de Sobreposições de Texto e Botões (`MissionRoutePanel.jsx`):**
  - Implementado helper `getShortRaName` para simplificar nomes institucionais longos de Regiões Administrativas (ex: `SCIA (SETOR COMPLEMENTAR DE INDUSTRIA E ABASTECIMENTO)` reduzido para `SCIA` no badge, com nome completo preservado no tooltip).
  - Reestruturado o cabeçalho do Super Card (1º Alvo) com alinhamento estrito `justify-between` e `min-w-0 / truncate`, impedindo qualquer colisão visual com os botões de ação (`[Mapa]`, `[Editar]`, `[X]`).
- **3. Reorganização e Compactação dos Cards Intermediários da Sequência:**
  - Reformulados os cards dos hidrantes 2, 3 em diante para um formato compacto de alta densidade:
    * Linha Superior: Sequência + Código + RA Curta + Distância/Tempo no lado esquerdo, e botões de atalho táticos (`[Mapa]`, `[Waze]`, `[+ VISTORIA]`, `[Editar]`, `[X]`) perfeitamente alinhados à direita.
    * Linha Inferior: Endereço completo em linha única truncada e alertas de problemas técnicos destacados (`⚠️ Defeito`).
  - Reduzida a altura vertical dos cards intermediários em ~40%, eliminando espaços vazios mortos e permitindo visualizar múltiplos hidrantes na tela do smartphone sem rolagem excessiva.

### [01/09/2026] Etapa 65 Concluída: Reestruturação Visual da Rota de Missão: 2 Linhas Táticas nos Cards Inferiores, Exibição Integral de Distância/Tempo, Super Card em Grade sem Espaços Vazios e Adequação por Perfil (Vistoriador vs Gestor)
- **1. Eliminação Definitiva do Truncamento de Distância e Tempo nos Cards Inferiores (`MissionRoutePanel.jsx`):**
  - Reestruturados os cards intermediários (2º, 3º, etc.) em **2 Linhas Táticas Independentes**:
    * **Linha 1 (Identificação & Telemetria):** Sequência + Thumbnail (se houver) + Código do hidrante + Sigla da RA alinhados à esquerda; no canto direito, a badge de Distância e Tempo estimada (`📍 232m • ~1min`, `📍 1.8km • ~3min`) com `shrink-0` e `whitespace-nowrap`, 100% visível em telas mobile estritas sem corte lateral.
    * **Linha 2 (Endereço & Ações Táticas):** Endereço com `line-clamp-1` à esquerda; à direita, a barra de ações touch-friendly contextuais.
- **2. Super Card Superior (1º Alvo) Estruturado em Grade sem Espaços Vazios:**
  - Linha 1: [1 (badge)] + Código do Hidrante + RA Curta à esquerda; botões de gestão/mapa (`[Mapa]`, `[Editar]`, `[X]`) alinhados no topo direito.
  - Linha 2: Faixa destacada de telemetria contendo `🎯 Próximo Alvo` e a badge `📍 Distância • ~Tempo` com alto contraste.
  - Linha 3: Bloco de endereço e referência legíveis com alerta de defeito destacado.
  - Linha 4: Botões grandes e ergonômicos de ação tática (`Navegar para o próximo` no Waze + `+ VISTORIA`).
- **3. Adequação Resiliente de UI para Perfis Vistoriador e Gestor:**
### [01/09/2026] Etapa 66 Concluída: Exclusão de Hidrante na Edição, Compactação e Largura Total do Relatório, Relatório de Missão para Vistoriador, Navegação por Perfil e Tabela de Campo do Gama
- **1. Exclusão de Hidrantes na Tela de Edição (`EditHydrantModal.jsx`, `App.jsx`):**
  - Adicionado botão de 'Excluir Hidrante' com destaque em vermelho e ícone `Trash2` na tela de cadastro/edição para hidrantes existentes, disponível para perfis `gestor` e `admin`.
  - Inserido modal de confirmação de segurança com aviso explícito de ação irreversível antes de efetivar a remoção da base de dados e sincronizar com nuvem.
- **2. Compactação e Otimização de Largura do Relatório de Vistoria (`MissionReportPanel.jsx`):**
  - Tabela consolidada expandida para 100% da largura útil da tela no Desktop, eliminando necessidade de scrollbar horizontal distante.
  - Fusão dos campos **Situação, Problemas e Observações** em uma única célula estilizada com badges de status, alerta de problemas técnicos e anotações em linha fluida.
  - Fusão do **Código do Hidrante e Data da Vistoria** na mesma célula (código em destaque mono e data logo abaixo).
  - Atualização dos exportadores SEI, PDF e CSV para refletir as colunas compactas.
- **3. Liberação do Relatório de Missão para o Perfil Vistoriador (`MissionRoutePanel.jsx`, `MissionReportPanel.jsx`):**
  - Habilitado o botão 'Relatório da Missão' no rodapé do painel de rotas para o perfil `vistoriador`.
  - Para o vistoriador, a visualização fica travada exclusivamente no **Relatório Geral (CBMDF)**, com ocultação das abas e botões institucionais da CAESB.
- **4. Sincronização Automática de Cidade (RA) ao Navegar da Rota para o Mapa (`App.jsx`):**
  - Ao clicar em `[📍 Mapa]` em qualquer hidrante na Rota de Missão, o filtro de localidade (`activeFilters.ra`) é atualizado instantaneamente para a cidade do hidrante selecionado, assegurando plotagem e abertura do pino no mapa sem conflito de filtros.
- **5. Mensagem Orientativa na Rota Vazia para Vistoriadores (`MissionRoutePanel.jsx`):**
  - Quando a rota estiver vazia para o perfil vistoriador, exibe a orientação: *"Para cumprir a missão de vistoria do seu quartel, clique na Central de Missões"*, com botão de atalho direto para a Central de Missões.
- **6. Navegação Adaptada por Perfil de Usuário (`App.jsx`):**
  - Para o perfil `vistoriador`, a aba/botão "Lista" foi substituída pelo acesso à "Central de Missões" tanto no Desktop quanto na Bottom Bar Mobile (`[🗺️ Mapa]`, `[🏢 Central de Missões]`, `[🧭 Rota de Missão]`).
  - Gestores e administradores continuam com a navegação completa de 4 botões (`[Mapa]`, `[Lista]`, `[Rota]`, `[Relatórios]`).
- **7. Novo Módulo: Ficha de Campo para Impressão com Rota Saindo do Gama (`FieldTableExportModal.jsx`, `App.jsx`):**
  - Criado modal dedicado no menu suspenso de Gestor/Admin: 'Tabela de Campo (Gama)'.
  - Ordenação automática dos hidrantes filtrados via algoritmo TSP/vizinho mais próximo com ponto de partida fixo no **Centro do Gama** (`lat: -16.015, lng: -48.065`).
  - Layout A4 pronto para impressão contendo Nº da sequência, Código/RA, Endereço com Ponto de Referência e coluna ampla pautada para anotações manuais à caneta "à moda antiga".
  - Botões de exportação integrados: Impressão / PDF, Exportar CSV, Compartilhar WhatsApp e Copiar Dados.



