import json
import asyncio
import sys
import subprocess
import datetime
from google.antigravity import Agent, LocalAgentConfig, CapabilitiesConfig

def read_workflow():
    with open('workflow.json', 'r', encoding='utf-8') as f:
        return json.load(f)

def write_workflow(workflow):
    with open('workflow.json', 'w', encoding='utf-8') as f:
        json.dump(workflow, f, indent=2, ensure_ascii=False)

def run_git_commit(step_id, step_name):
    print(f"\n[Git] Salvando estado (commit) para a Etapa {step_id}...")
    try:
        subprocess.run(["git", "add", "."], check=True)
        subprocess.run(["git", "commit", "-m", f"feat: Concluída Etapa {step_id} - {step_name}"], check=True)
        print("[Git] Commit realizado com sucesso!")
    except subprocess.CalledProcessError as e:
        print(f"[Git] Erro ao realizar commit. Pode não haver arquivos modificados. Detalhes: {e}")

def log_to_history(step_id, step_name):
    print(f"\n[Logs] Registrando Etapa {step_id} no histórico de implementações...")
    date_str = datetime.datetime.now().strftime('%d/%m/%Y')
    entry = f"\n### [{date_str}] Etapa {step_id} Concluída Automaticamente\n- **{step_name}** foi executada e validada com sucesso pelo agente orquestrador.\n"
    
    try:
        with open('historico_implementacoes.md', 'a', encoding='utf-8') as f:
            f.write(entry)
        print("[Logs] Histórico atualizado com sucesso!")
    except Exception as e:
        print(f"[Logs] Erro ao atualizar histórico: {e}")

async def process_step(step):
    print(f"\n=================================================")
    print(f"🚀 INICIANDO ETAPA {step['id']}: {step['name']}")
    print(f"=================================================\n")

    # Configurando o agente com capacidades (tools) completas
    config = LocalAgentConfig(
        system_instructions=(
            "Você é um Arquiteto de Software e Engenheiro Front-End Sênior. "
            "Você possui acesso completo ao terminal, sistema de arquivos e navegador web (via ferramentas). "
            "Seu objetivo é implementar o que foi pedido no prompt. "
            "1. Crie ou modifique o código necessário. "
            "2. Se precisar validar a interface, rode 'npm run dev' em background e utilize o navegador (browser tool) no endereço localhost:5173 para validar. "
            "3. Encontrando erros, itere e corrija os bugs de forma autônoma. "
            "4. Quando a funcionalidade estiver testada e impecável, encerre sua resposta com a exata string 'ETAPA CONCLUIDA'."
        ),
        capabilities=CapabilitiesConfig()
    )

    async with Agent(config) as agent:
        prompt = step.get('prompt', f"Implemente a etapa {step['id']}: {step['name']}. Teste, valide no navegador e garanta o funcionamento perfeito.")
        
        print(">> Enviando instruções para o agente Anti-Gravity e aguardando raciocínio/execução...\n")
        response = await agent.chat(prompt)

        # Imprime a resposta e verifica a flag de conclusão
        response_text = ""
        async for token in response:
            sys.stdout.write(token)
            sys.stdout.flush()
            response_text += token
        
        print("\n")
        
        # Validar se o agente concluiu com sucesso a etapa
        if "ETAPA CONCLUIDA" in response_text.upper():
            print(f"✅ Agente confirmou a conclusão da Etapa {step['id']} com sucesso.")
            return True
        else:
            print(f"⚠️ Agente terminou sem a flag de conclusão (ETAPA CONCLUIDA). A etapa pode estar incompleta ou bloqueada.")
            return False

async def main():
    print("Iniciando Orquestrador Autônomo Anti-Gravity...")
    workflow = read_workflow()
    
    for step in workflow.get("steps", []):
        if step.get("status") == "pending":
            success = await process_step(step)
            
            if success:
                # Atualiza status e faz commit
                step["status"] = "completed"
                write_workflow(workflow)
                log_to_history(step["id"], step["name"])
                run_git_commit(step["id"], step["name"])
                
                # Contexto é resetado automaticamente quando o 'async with Agent' encerra
                print(f"♻️ Contexto resetado com sucesso. Memória de tokens liberada para a próxima fase.")
            else:
                print(f"❌ O loop autônomo foi pausado na Etapa {step['id']} para intervenção humana.")
                break
                
    print("\n🎉 Processo de orquestração finalizado.")

if __name__ == "__main__":
    asyncio.run(main())
