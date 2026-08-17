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

