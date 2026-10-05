const fs = require('fs');
const path = './src/services/syncService.js';
let content = fs.readFileSync(path, 'utf8');

const offlineManagerCode = `

// ============================================================================
// OFFLINE SYNC MANAGER (FILA DE PENDÊNCIAS OFFLINE)
// ============================================================================
const OFFLINE_QUEUE_KEY = 'netuno_offline_queue';

const getOfflineQueue = () => {
  try {
    const data = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveOfflineQueue = (queue) => {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new Event('offline_queue_updated'));
  } catch {}
};

const enqueueOfflineAction = (action, args) => {
  const queue = getOfflineQueue();
  const newTask = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
    action,
    args,
    timestamp: Date.now()
  };
  queue.push(newTask);
  saveOfflineQueue(queue);
  console.log('[OfflineSync] Tarefa colocada na fila offline:', action);
};

const processOfflineQueue = async () => {
  if (!navigator.onLine) return; 
  
  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  console.log(\`[OfflineSync] Iniciando processamento de \${queue.length} pendências offline...\`);
  let remainingQueue = [...queue];
  let hasErrors = false;

  for (const task of queue) {
    try {
      let success = false;
      if (task.action === 'syncMission') {
        success = await _doSyncMissionToCloud(...task.args);
      } else if (task.action === 'syncInspection') {
        success = await _doSyncInspectionToCloud(...task.args);
      } else if (task.action === 'syncHydrantMutation') {
        success = await _doSyncHydrantMutationToCloud(...task.args);
      }

      if (success) {
        remainingQueue = remainingQueue.filter(t => t.id !== task.id);
        saveOfflineQueue(remainingQueue);
      } else {
        hasErrors = true;
        console.warn('[OfflineSync] Falha ao enviar tarefa, mantendo na fila:', task.id);
        break;
      }
    } catch (err) {
      console.error('[OfflineSync] Erro crítico ao processar fila offline:', err);
      hasErrors = true;
      break;
    }
  }
  
  if (!hasErrors) {
    console.log('[OfflineSync] Fila offline processada com sucesso (Vazia).');
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[OfflineSync] Conexão restabelecida. Processando fila offline...');
    setTimeout(processOfflineQueue, 2000);
  });
}
// ============================================================================
`;

content = content.replace(
  "export const syncMissionToCloud = async (mission) => {",
  "export const syncMissionToCloud = async (mission) => {\n  if (!navigator.onLine) { enqueueOfflineAction('syncMission', [mission]); return; }\n  const success = await _doSyncMissionToCloud(mission);\n  if (!success) enqueueOfflineAction('syncMission', [mission]);\n};\n\nconst _doSyncMissionToCloud = async (mission) => {"
);

content = content.replace(
  /console\.warn\('Falha ao enviar missão para nuvem:', err\);\s*\}/,
  "console.warn('Falha ao enviar missão para nuvem:', err);\n    return false;\n  }\n  return true;\n}"
);
content = content.replace(
  /if \(error\) \{\s*console\.warn\(`Erro ao sincronizar missão \$\{mission\.id\} na nuvem:`, error\.message\);\s*\}/g,
  "if (error) {\n      console.warn(`Erro ao sincronizar missão ${mission.id} na nuvem:`, error.message);\n      return false;\n    }"
);


content = content.replace(
  "export const syncInspectionToCloud = async (hidrante) => {",
  "export const syncInspectionToCloud = async (hidrante) => {\n  if (!navigator.onLine) { enqueueOfflineAction('syncInspection', [hidrante]); return; }\n  const success = await _doSyncInspectionToCloud(hidrante);\n  if (!success) enqueueOfflineAction('syncInspection', [hidrante]);\n};\n\nconst _doSyncInspectionToCloud = async (hidrante) => {"
);
content = content.replace(
  /console\.warn\('Falha ao enviar vistoria para nuvem:', err\);\s*\}/,
  "console.warn('Falha ao enviar vistoria para nuvem:', err);\n    return false;\n  }\n  return true;\n}"
);
content = content.replace(
  /if \(error\) \{\s*console\.warn\('Erro ao salvar vistoria na nuvem:', error\.message\);\s*\}/g,
  "if (error) {\n      console.warn('Erro ao salvar vistoria na nuvem:', error.message);\n      return false;\n    }"
);


content = content.replace(
  "export const syncHydrantMutationToCloud = async (type, payloadData) => {",
  "export const syncHydrantMutationToCloud = async (type, payloadData) => {\n  if (!navigator.onLine) { enqueueOfflineAction('syncHydrantMutation', [type, payloadData]); return; }\n  const success = await _doSyncHydrantMutationToCloud(type, payloadData);\n  if (!success) enqueueOfflineAction('syncHydrantMutation', [type, payloadData]);\n};\n\nconst _doSyncHydrantMutationToCloud = async (type, payloadData) => {"
);
content = content.replace(
  /console\.warn\('Falha ao enviar mutação para nuvem:', err\);\s*\}/,
  "console.warn('Falha ao enviar mutação para nuvem:', err);\n    return false;\n  }\n  return true;\n}"
);
content = content.replace(
  /if \(error\) \{\s*console\.warn\('Erro ao registrar mutação de hidrante na nuvem:', error\.message\);\s*\}/g,
  "if (error) {\n      console.warn('Erro ao registrar mutação de hidrante na nuvem:', error.message);\n      return false;\n    }"
);


content = content.replace(
  /import \{.*\} from '\.\.\/utils\/storage';\n/,
  match => match + offlineManagerCode
);

content = content.replace(
  /export const syncMissionToCloud/,
  "export { getOfflineQueue, saveOfflineQueue, processOfflineQueue };\n\nexport const syncMissionToCloud"
);

fs.writeFileSync(path, content, 'utf8');
console.log('Script injection applied to syncService.js');
