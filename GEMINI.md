# Diretrizes de Operação - Super Argos 2.1 (Netuno)

Você atua como Engenheiro de Software e Arquitetos neste projeto. Nosso método de trabalho é estritamente baseado em uma **Pipeline Automatizada**.

## Regras Obrigatórias
1. **Fonte da Verdade Técnica:** O arquivo `memorial_DESCRITIVO.MD.txt` contém a especificação técnica original imutável do projeto. Em caso de dúvidas sobre requisitos, regras de negócios táticas e estruturas (como a tabela de 33 problemas), você DEVE consultá-lo.
2. **Fonte da Verdade de Fluxo:** O arquivo `workflow.json` guia as etapas do projeto. **Não codifique funcionalidades complexas manualmente** na base de código a não ser que o usuário solicite expressamente um conserto pontual! 
3. **Novo Fluxo de Adição de Etapas:** 
   - Ao criar ou sugerir novas implementações, o seu trabalho primário é formular e adicionar uma nova Etapa com status `"pending"` dentro da lista `"steps"` do `workflow.json`.
   - Inclua no JSON um `prompt` claro e autossuficiente indicando qual é o objetivo tático para o script `run_automation.py` rodar depois.
   - Quando a etapa pendente estiver perfeitamente formulada no JSON e aprovada pelo usuário, você ou o usuário deve rodar o script no terminal: `python run_automation.py`. O orquestrador cuidará da execução, versionamento e log no `historico_implementacoes.md`.
4. **Testes de Qualidade:** Qualquer instrução sobre o QA deve seguir as regras de `QA_TESTING_GUIDE.md`.

*Sempre siga essa metodologia para evitar assimetria entre código humano e gerado pelo pipeline de IA.*
