import fs from 'fs';
import { execSync } from 'child_process';

function readWorkflow() {
  return JSON.parse(fs.readFileSync('workflow.json', 'utf8'));
}

function writeWorkflow(workflow) {
  fs.writeFileSync('workflow.json', JSON.stringify(workflow, null, 2), 'utf8');
}

function logToHistory(stepId, stepName) {
  console.log(`\n[Logs] Registrando Etapa ${stepId} no histórico de implementações...`);
  const dateStr = new Date().toLocaleDateString('pt-BR');
  const entry = `\n### [${dateStr}] Etapa ${stepId} Concluída Automaticamente\n- **${stepName}** foi executada e validada com sucesso pelo agente orquestrador.\n`;
  
  try {
    fs.appendFileSync('historico_implementacoes.md', entry, 'utf8');
    console.log("[Logs] Histórico atualizado com sucesso!");
  } catch (e) {
    console.log(`[Logs] Erro ao atualizar histórico: ${e.message}`);
  }
}

function runGitCommit(stepId, stepName) {
  console.log(`\n[Git] Salvando estado (commit & push) para a Etapa ${stepId}...`);
  try {
    execSync('git add .');
    execSync(`git commit -m "feat: Concluída Etapa ${stepId} - ${stepName}"`);
    console.log("[Git] Commit realizado com sucesso!");
    console.log("[Git] Enviando para GitHub/Vercel (git push origin main)...");
    execSync('git push origin main');
    console.log("🚀 [Deploy] Push concluído com sucesso! Vercel atualizando automaticamente.");
  } catch (e) {
    console.log(`[Git] Erro ao realizar commit/push: ${e.message}`);
  }
}

function processStep(step) {
  console.log(`\n=================================================`);
  console.log(`🚀 INICIANDO ETAPA ${step.id}: ${step.name}`);
  console.log(`=================================================\n`);

  const prompt = step.prompt || `Implemente a etapa ${step.id}: ${step.name}. Teste, valide e garanta o funcionamento.`;
  
  // Usando a CLI nativa da IDE (agy) para rodar o agente!
  const agyCommand = `agy do "Atue como Arquiteto e Engenheiro Front-End e execute rigorosamente esta tarefa: ${prompt.replace(/"/g, '\\"')}"`;
  
  console.log(">> Enviando instruções para a CLI do Antigravity (agy)...\n");
  try {
    // stdio: 'inherit' permite que os logs do agente apareçam direto no seu terminal
    execSync(agyCommand, { stdio: 'inherit' });
    console.log(`✅ Agente confirmou a conclusão da Etapa ${step.id} com sucesso.`);
    return true;
  } catch (error) {
    console.log(`⚠️ A execução falhou ou foi interrompida. Detalhes: ${error.message}`);
    return false;
  }
}

function main() {
  console.log("Iniciando Orquestrador Autônomo (Node.js)...");
  let workflow;
  try {
    workflow = readWorkflow();
  } catch (e) {
    console.log("Erro ao ler o workflow.json", e.message);
    return;
  }
  
  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    if (step.status === 'pending') {
      const success = processStep(step);
      
      if (success) {
        step.status = 'completed';
        writeWorkflow(workflow);
        logToHistory(step.id, step.name);
        runGitCommit(step.id, step.name);
        
        console.log(`♻️ Contexto resetado com sucesso para a próxima etapa.`);
      } else {
        console.log(`❌ O loop autônomo pausou na Etapa ${step.id} para intervenção humana.`);
        break;
      }
    }
  }
  console.log("\n🎉 Processo de orquestração finalizado.");
}

main();
