
console.log('Netuno SEI Ext - Content Script Injected');

function createOverlay(text) {
  let div = document.getElementById('netuno-sei-overlay');
  if(!div) {
    div = document.createElement('div');
    div.id = 'netuno-sei-overlay';
    div.style.position = 'fixed';
    div.style.top = '10px';
    div.style.right = '10px';
    div.style.padding = '15px';
    div.style.backgroundColor = 'rgba(0,0,0,0.8)';
    div.style.color = '#00FF00';
    div.style.zIndex = '999999';
    div.style.borderRadius = '5px';
    div.style.fontFamily = 'monospace';
    document.body.appendChild(div);
  }
  div.innerText = '🤖 Netuno Assistente: ' + text;
}

window.addEventListener('load', () => {
  createOverlay('Aguardando usuário...');
  // Aqui entraria a lógica de automação DOM do SEI
});
