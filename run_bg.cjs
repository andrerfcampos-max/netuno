const { execSync } = require('child_process');
try {
  execSync('node scripts/extract_lago_sul.cjs', {stdio: 'inherit'});
  execSync('node scripts/task_queue.cjs complete TASK-114', {stdio: 'inherit'});
  execSync('git add public/base-de-dados.xlsx base-de-dados.xlsx public/hidrantes_df_oficial.json public/hidrantes_df_oficial.csv rascunho_falhas_streetview.md', {stdio: 'inherit'});
  execSync('git commit -m "chore: atualiza banco de dados com fotos de Lago Sul e rascunho de falhas"', {stdio: 'inherit'});
  execSync('git push origin main', {stdio: 'inherit'});
} catch (e) {
  console.error(e);
  execSync('node scripts/task_queue.cjs fail TASK-114 "Failed"', {stdio: 'inherit'});
}
