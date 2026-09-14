
console.log('Netuno SEI Ext - Content Script Injected');

function createOverlay(text, subtext = '') {
  let div = document.getElementById('netuno-sei-overlay');
  if (!div) {
    div = document.createElement('div');
    div.id = 'netuno-sei-overlay';
    div.style.position = 'fixed';
    div.style.top = '10px';
    div.style.right = '10px';
    div.style.padding = '12px 16px';
    div.style.backgroundColor = 'rgba(15, 23, 42, 0.95)';
    div.style.color = '#38bdf8';
    div.style.border = '1px solid #0284c7';
    div.style.zIndex = '999999';
    div.style.borderRadius = '8px';
    div.style.fontFamily = 'sans-serif';
    div.style.fontSize = '12px';
    div.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
    document.body.appendChild(div);
  }
  div.innerHTML = `
    <div style="font-weight: bold; color: #34d399; margin-bottom: 4px;">🚒 Netuno SEI • SUOMA</div>
    <div>${text}</div>
    ${subtext ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">${subtext}</div>` : ''}
  `;
}

window.addEventListener('load', () => {
  createOverlay(
    'Unidade de Permanência: CBMDF/DIVIS/SEHUR/SUOMA',
    'Protocolo SUOMA: 1. Anexar PDF CAESB (Externo) | 2. Memorando ao GPCIU com Minuta de Ofício'
  );
});
