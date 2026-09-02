const fs = require('fs');
const path = require('path');

const QUEUE_FILE = path.resolve(__dirname, '..', 'task_queue.json');
const STALE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos de timeout para processos abandonados

function readQueue() {
  if (!fs.existsSync(QUEUE_FILE)) {
    return { version: '1.0', activeTaskId: null, queue: [] };
  }
  try {
    const raw = fs.readFileSync(QUEUE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[TaskQueue] Erro ao ler task_queue.json:', err.message);
    return { version: '1.0', activeTaskId: null, queue: [] };
  }
}

function writeQueue(data) {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function cleanStaleTasks(queueData) {
  const now = Date.now();
  let changed = false;

  for (const item of queueData.queue) {
    if (item.status === 'running') {
      const started = item.startedAt ? new Date(item.startedAt).getTime() : 0;
      if (now - started > STALE_TIMEOUT_MS) {
        console.warn(`[TaskQueue] ⚠️ Tarefa ${item.id} expirou por inatividade (> 15 min). Liberando vaga...`);
        item.status = 'timed_out';
        item.completedAt = new Date().toISOString();
        changed = true;
      }
    }
  }

  if (queueData.activeTaskId) {
    const active = queueData.queue.find(q => q.id === queueData.activeTaskId);
    if (!active || active.status !== 'running') {
      queueData.activeTaskId = null;
      changed = true;
    }
  }

  if (changed) {
    writeQueue(queueData);
  }
}

function enqueue(description, conversationId = 'default') {
  const queueData = readQueue();
  cleanStaleTasks(queueData);

  const nextSeq = (queueData.queue.length > 0)
    ? Math.max(...queueData.queue.map(q => q.seq || 0)) + 1
    : 1;

  const id = `TASK-${nextSeq}`;
  const newItem = {
    id,
    seq: nextSeq,
    conversationId: conversationId || 'unknown',
    description: description || 'Tarefa sem descrição',
    status: 'queued',
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null
  };

  queueData.queue.push(newItem);
  writeQueue(queueData);

  console.log(`[TaskQueue] 📥 Tarefa ${id} enfileirada com sucesso na posição #${queueData.queue.filter(q => q.status === 'queued' || q.status === 'running').length}!`);
  return newItem;
}

function getNextEligibleTask(queueData) {
  const pending = queueData.queue.filter(q => q.status === 'queued');
  return pending.length > 0 ? pending[0] : null;
}

function acquire(taskId) {
  const queueData = readQueue();
  cleanStaleTasks(queueData);

  const currentRunning = queueData.queue.find(q => q.status === 'running');
  if (currentRunning && currentRunning.id !== taskId) {
    return { success: false, reason: `Tarefa ${currentRunning.id} em execução (${currentRunning.description})` };
  }

  const nextEligible = getNextEligibleTask(queueData);
  if (!nextEligible || nextEligible.id !== taskId) {
    const currentPos = queueData.queue.filter(q => q.status === 'queued').findIndex(q => q.id === taskId);
    return { success: false, reason: `Aguardando a sua vez. Posição na fila: #${currentPos + 1}` };
  }

  nextEligible.status = 'running';
  nextEligible.startedAt = new Date().toISOString();
  queueData.activeTaskId = taskId;
  writeQueue(queueData);

  console.log(`[TaskQueue] 🚀 Lock adquirido com sucesso para ${taskId}! Pode iniciar a execução.`);
  return { success: true };
}

function complete(taskId) {
  const queueData = readQueue();
  const item = queueData.queue.find(q => q.id === taskId);
  if (item) {
    item.status = 'completed';
    item.completedAt = new Date().toISOString();
  }
  if (queueData.activeTaskId === taskId) {
    queueData.activeTaskId = null;
  }
  writeQueue(queueData);
  console.log(`[TaskQueue] ✅ Tarefa ${taskId} concluída e vaga liberada na fila.`);
}

function fail(taskId, errorMsg = '') {
  const queueData = readQueue();
  const item = queueData.queue.find(q => q.id === taskId);
  if (item) {
    item.status = 'failed';
    item.error = errorMsg;
    item.completedAt = new Date().toISOString();
  }
  if (queueData.activeTaskId === taskId) {
    queueData.activeTaskId = null;
  }
  writeQueue(queueData);
  console.log(`[TaskQueue] ❌ Tarefa ${taskId} marcada como falha. Fila liberada para o próximo.`);
}

async function waitTurn(taskId, maxWaitSeconds = 600) {
  const startTime = Date.now();
  console.log(`[TaskQueue] ⏳ Aguardando a vez da tarefa ${taskId} na fila (máx ${maxWaitSeconds}s)...`);

  while (Date.now() - startTime < maxWaitSeconds * 1000) {
    const res = acquire(taskId);
    if (res.success) {
      return true;
    }
    process.stdout.write(`\r[TaskQueue] ⏳ ${res.reason}. Aguardando liberação...`);
    await new Promise(r => setTimeout(r, 4000));
  }

  console.log(`\n[TaskQueue] ❌ Tempo limite de espera excedido para ${taskId}.`);
  return false;
}

function showStatus() {
  const queueData = readQueue();
  cleanStaleTasks(queueData);
  console.log('\n================ STATUS DA FILA DE TAREFAS ================');
  console.log(`Tarefa Ativa em Execução: ${queueData.activeTaskId || 'NENHUMA (Fila Livre)'}`);
  console.log('------------------------------------------------------------');
  const activeItems = queueData.queue.filter(q => q.status === 'queued' || q.status === 'running');
  if (activeItems.length === 0) {
    console.log('Nenhuma tarefa pendente na fila.');
  } else {
    activeItems.forEach((q, idx) => {
      console.log(`${idx + 1}. [${q.status.toUpperCase()}] ${q.id} (${q.conversationId}): ${q.description}`);
    });
  }
  console.log('============================================================\n');
}

const args = process.argv.slice(2);
const command = args[0];

if (command === 'enqueue') {
  const desc = args[1] || 'Nova tarefa';
  const convId = args[2] || 'chat';
  const item = enqueue(desc, convId);
  console.log(JSON.stringify(item));
} else if (command === 'acquire') {
  const taskId = args[1];
  const res = acquire(taskId);
  if (!res.success) {
    console.error(res.reason);
    process.exit(1);
  }
} else if (command === 'wait') {
  const taskId = args[1];
  const maxWait = parseInt(args[2], 10) || 600;
  waitTurn(taskId, maxWait).then(ok => {
    if (!ok) process.exit(1);
  });
} else if (command === 'complete') {
  const taskId = args[1];
  complete(taskId);
} else if (command === 'fail') {
  const taskId = args[1];
  const reason = args.slice(2).join(' ');
  fail(taskId, reason);
} else if (command === 'status') {
  showStatus();
}

module.exports = {
  readQueue,
  writeQueue,
  enqueue,
  acquire,
  waitTurn,
  complete,
  fail,
  showStatus
};
