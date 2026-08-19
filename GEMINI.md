# Diretrizes de Operação - Super Argos 2.1 (Netuno)

Você atua como Engenheiro de Software e Arquitetos neste projeto. Nosso método de trabalho é estritamente baseado em uma **Pipeline Automatizada**.

## Regras Obrigatórias
1. **Fonte da Verdade Técnica:** O arquivo `memorial_DESCRITIVO.MD.txt` contém a especificação técnica original imutável do projeto. Em caso de dúvidas sobre requisitos, regras de negócios táticas e estruturas (como a tabela de 33 problemas), você DEVE consultá-lo.
2. **Fonte da Verdade de Fluxo:** O arquivo `workflow.json` guia as etapas do projeto. **Não codifique funcionalidades complexas manualmente** na base de código a não ser que o usuário solicite expressamente um conserto pontual! 
3. **Novo Fluxo de Adição de Etapas:** 
   - Ao criar ou sugerir novas implementações, o seu trabalho primário é formular e adicionar uma nova Etapa com status `"pending"` dentro da lista `"steps"` do `workflow.json`.
   - Inclua no JSON um `prompt` claro e autossuficiente indicando qual é o objetivo tático para o script `run_automation.js` rodar depois.
   - Quando a etapa pendente estiver perfeitamente formulada no JSON e aprovada pelo usuário, você ou o usuário deve rodar o script no terminal: `node run_automation.js`. O orquestrador cuidará da execução, versionamento e log no `historico_implementacoes.md`.
4. **Testes de Qualidade:** Qualquer instrução sobre o QA deve seguir as regras de `QA_TESTING_GUIDE.md`, incluindo a seção de Testes Mobile e PWA em campo.
5. **Deploy Contínuo e Testes Mobile (Produção):**
   - **Repositório GitHub:** `https://github.com/andrerfcampos-max/netuno`
   - **Ambiente de Testes Mobile (Vercel):** `https://netuno-eight.vercel.app/`
   - **Ciclo de Atualização:** Toda alteração validada localmente deve ser versionada com `git commit` e enviada via `git push origin main` para que a Vercel atualize o ambiente mobile imediatamente.

*Sempre siga essa metodologia para evitar assimetria entre código humano e gerado pelo pipeline de IA.*

