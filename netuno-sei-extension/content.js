// content.js - Motor de Automação Netuno SEI Integrator (Executado no SEI/SIP DF)

console.log('[Netuno SEI Ext] Content Script Ativo em:', window.location.href);

// Extrai a unidade ativa no SEI
function getInfraUnidade() {
  const inputUnidade = document.querySelector('input[name="infra_unidade_atual"], input#infra_unidade_atual');
  if (inputUnidade && inputUnidade.value) return inputUnidade.value;

  const urlMatch = window.location.href.match(/infra_unidade_atual=(\d+)/i);
  if (urlMatch) return urlMatch[1];

  const htmlMatch = document.documentElement.innerHTML.match(/infra_unidade_atual=(\d+)/i);
  return htmlMatch ? htmlMatch[1] : '110037654'; // Fallback SUOMA
}

function getInfraSistema() {
  const urlMatch = window.location.href.match(/infra_sistema=(\d+)/i);
  return urlMatch ? urlMatch[1] : '100000100';
}

// Cria a janela flutuante do Netuno no SEI
let floatingCard = null;

function renderFloatingCard(pkg) {
  if (document.getElementById('netuno-sei-floating-card')) return;

  floatingCard = document.createElement('div');
  floatingCard.id = 'netuno-sei-floating-card';
  floatingCard.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 370px;
    background: #0f172a;
    color: #f8fafc;
    border: 2px solid #059669;
    border-radius: 14px;
    padding: 16px;
    z-index: 9999999;
    box-shadow: 0 15px 35px rgba(0,0,0,0.65);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
    line-height: 1.4;
  `;

  const cidadeText = pkg?.cidade || 'Distrito Federal';
  const raText = pkg?.raRomano ? ` (RA ${pkg.raRomano})` : '';

  floatingCard.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #334155; padding-bottom: 8px; margin-bottom: 10px;">
      <div style="font-weight: bold; font-size: 14px; color: #34d399; display: flex; align-items: center; gap: 6px;">
        🚒 Netuno SEI • SUOMA
      </div>
      <button id="btn-netuno-close" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 16px;">✖</button>
    </div>

    <div style="margin-bottom: 12px; font-size: 12px;">
      <div style="color: #94a3b8; font-size: 11px;">PACOTE PRONTO PARA AUTUAÇÃO:</div>
      <div style="font-weight: bold; font-size: 13px; color: #f8fafc; margin-top: 2px;">
        Relatório CAESB: ${cidadeText}${raText}
      </div>
      <div style="color: #34d399; font-size: 11px; margin-top: 4px; font-weight: 500;">
        Processo: CBMDF - Serviço Operacional
      </div>
      <div style="color: #38bdf8; font-size: 11px; margin-top: 2px;">
        Destino: CBMDF/COESP/GPCIU/SEHUR
      </div>
    </div>

    <div id="netuno-status-area" style="background: #1e293b; padding: 10px; border-radius: 8px; margin-bottom: 12px; font-size: 12px; border: 1px solid #334155;">
      <div style="color: #cbd5e1;">Aguardando seu comando. Clique no botão abaixo para autuar o processo, anexar o laudo da CAESB e abrir a assinatura.</div>
    </div>

    <div style="display: flex; gap: 8px;">
      <button id="btn-netuno-run" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #059669, #0d9488); border: none; border-radius: 8px; color: white; font-weight: bold; cursor: pointer; font-size: 12px; box-shadow: 0 4px 12px rgba(5,150,105,0.4);">
        ⚡ Autuar Processo no SEI (1 Toque)
      </button>
    </div>
  `;

  document.body.appendChild(floatingCard);

  document.getElementById('btn-netuno-close').onclick = () => {
    floatingCard.remove();
  };

  document.getElementById('btn-netuno-run').onclick = () => {
    executeFullAutomation(pkg);
  };
}

function updateStatus(stepText, color = '#38bdf8') {
  const area = document.getElementById('netuno-status-area');
  if (area) {
    area.innerHTML = `<div style="color: ${color}; font-weight: 500;">${stepText}</div>`;
  }
}

// Resolve qualquer URL relativa do SEI garantindo o caminho canônico /sei/
function resolveSeiUrl(relativeOrAbsoluteUrl, fallbackBase = window.location.href) {
  if (!relativeOrAbsoluteUrl) return '';
  let str = relativeOrAbsoluteUrl.trim();
  if (str.startsWith('http://') || str.startsWith('https://')) {
    if (str.includes('sei.df.gov.br/controlador.php')) {
      return str.replace('sei.df.gov.br/controlador.php', 'sei.df.gov.br/sei/controlador.php');
    }
    return str;
  }
  
  let base = fallbackBase || window.location.href;
  if (!base.includes('/sei/')) {
    base = `${window.location.origin}/sei/controlador.php`;
  }
  
  const resolved = new URL(str, base).toString();
  if (resolved.includes('sei.df.gov.br/controlador.php')) {
    return resolved.replace('sei.df.gov.br/controlador.php', 'sei.df.gov.br/sei/controlador.php');
  }
  return resolved;
}

// Obtém o formulário de trabalho da página ignorando o formulário de pesquisa rápida do cabeçalho
function getSeiWorkForm(doc, specificSelector = '') {
  if (!doc) return null;
  if (specificSelector) {
    const el = doc.querySelector(specificSelector);
    if (el) return el;
  }
  const forms = Array.from(doc.querySelectorAll('form'));
  return forms.find(f => {
    const id = (f.id || '').toLowerCase();
    const action = (f.getAttribute('action') || '').toLowerCase();
    return id !== 'frmprotocolopesquisarapida' && !action.includes('pesquisa_rapida');
  }) || null;
}

// Extrai mensagens amigáveis de alerta ou erro do HTML do SEI
function extractSeiErrorMessage(htmlOrDoc) {
  if (!htmlOrDoc) return null;
  const doc = typeof htmlOrDoc === 'string' ? new DOMParser().parseFromString(htmlOrDoc, 'text/html') : htmlOrDoc;
  const msgDiv = doc.querySelector('#divInfraMensagens, .infraMensagem, .alert-danger, .infraDivMensagem, #infraMensagem');
  if (msgDiv && msgDiv.textContent.trim()) {
    return msgDiv.textContent.trim().replace(/\s+/g, ' ');
  }
  const text = typeof htmlOrDoc === 'string' ? htmlOrDoc : doc.documentElement.innerHTML;
  const alertMatch = text.match(/alert\s*\(\s*["']([^"']+)["']\s*\)/i);
  if (alertMatch) return alertMatch[1].replace(/\\n/g, ' ').trim();
  return null;
}

// Obtém o formulário oficial de geração de processo no SEI DF
async function obterFormularioGerarProcesso() {
  // 1. Procura o link "Iniciar Processo" no menu lateral
  const linkMenu = document.querySelector('a[link="procedimento_escolher_tipo"], a[href*="acao=procedimento_escolher_tipo"]');
  if (!linkMenu) {
    throw new Error('Link "Iniciar Processo" não encontrado no menu do SEI. Certifique-se de que está na tela principal do SEI na unidade SUOMA.');
  }

  const urlMenuEscolher = resolveSeiUrl(linkMenu.getAttribute('href'), window.location.href);
  updateStatus('⏳ Localizando catálogo de processos na unidade...', '#38bdf8');
  const resEscolher = await fetch(urlMenuEscolher);
  const htmlEscolher = await resEscolher.text();
  let docEscolher = new DOMParser().parseFromString(htmlEscolher, 'text/html');

  let formEscolher = docEscolher.querySelector('form#frmProcedimentoEscolherTipo') || docEscolher.querySelector('form');
  if (!formEscolher) {
    throw new Error('Formulário de catálogo de processos não encontrado no SEI.');
  }

  // Função auxiliar para identificar o tipo de processo correto na tabela do SEI
  function findTipoProcesso(doc) {
    const rows = Array.from(doc.querySelectorAll('#tblTipoProcedimento tr, tr[data-desc], tr.infraTrClara, tr.infraTrEscura'));

    // 1ª Prioridade: CBMDF - Serviço Operacional (padrão oficial CBMDF/SUOMA/SEHUR para hidrantes)
    for (const r of rows) {
      const desc = (r.getAttribute('data-desc') || r.textContent || '').toLowerCase();
      if (desc.includes('serviço operacional') || desc.includes('servico operacional') || (desc.includes('cbmdf') && desc.includes('operacional'))) {
        const input = r.querySelector('input.infraCheckbox, input[type="checkbox"]');
        const onclick = r.querySelector('a[onclick*="escolher"]')?.getAttribute('onclick') || '';
        const m = onclick.match(/escolher\((\d+)\)/);
        const id = input?.value || (m ? m[1] : null);
        if (id) return { id, nome: 'CBMDF - Serviço Operacional' };
      }
    }

    // 2ª Prioridade: Qualquer tipo contendo "hidrante" ou "fiscaliza"
    for (const r of rows) {
      const desc = (r.getAttribute('data-desc') || r.textContent || '').toLowerCase();
      if (desc.includes('hidrante') || desc.includes('fiscaliza')) {
        const input = r.querySelector('input.infraCheckbox, input[type="checkbox"]');
        const onclick = r.querySelector('a[onclick*="escolher"]')?.getAttribute('onclick') || '';
        const m = onclick.match(/escolher\((\d+)\)/);
        const id = input?.value || (m ? m[1] : null);
        const nome = r.textContent.trim().replace(/\s+/g, ' ');
        if (id) return { id, nome };
      }
    }

    // 3ª Prioridade: Verificação por ID canônico 100000446
    const el446 = doc.querySelector('input[value="100000446"], a[onclick*="100000446"]');
    if (el446) return { id: '100000446', nome: 'CBMDF - Serviço Operacional' };

    // 4ª Prioridade: CBMDF - Serviço Administrativo Diário (ID 100000363)
    for (const r of rows) {
      const desc = (r.getAttribute('data-desc') || r.textContent || '').toLowerCase();
      if (desc.includes('servico administrativo') || desc.includes('serviço administrativo')) {
        const input = r.querySelector('input.infraCheckbox, input[type="checkbox"]');
        const onclick = r.querySelector('a[onclick*="escolher"]')?.getAttribute('onclick') || '';
        const m = onclick.match(/escolher\((\d+)\)/);
        const id = input?.value || (m ? m[1] : null);
        if (id) return { id, nome: 'CBMDF - Serviço Administrativo Diário' };
      }
    }

    return null;
  }

  let tipoEncontrado = findTipoProcesso(docEscolher);

  // Se não encontrou nos favoritos iniciais, carrega a lista completa usando o botão (+) nativo do SEI
  if (!tipoEncontrado) {
    updateStatus('⏳ Carregando catálogo completo de tipos de processo do SEI...', '#38bdf8');
    const postTodos = new URLSearchParams();
    formEscolher.querySelectorAll('input').forEach(el => {
      if (el.name) postTodos.set(el.name, el.value || '');
    });
    postTodos.set('hdnFiltroTipoProcedimento', 'T');
    postTodos.set('hdnIdTipoProcedimento', '');

    const actionUrl = resolveSeiUrl(formEscolher.getAttribute('action') || urlMenuEscolher, urlMenuEscolher);
    const resTodos = await fetch(actionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postTodos.toString()
    });
    const htmlTodos = await resTodos.text();
    const docTodos = new DOMParser().parseFromString(htmlTodos, 'text/html');

    tipoEncontrado = findTipoProcesso(docTodos);
    if (tipoEncontrado) {
      docEscolher = docTodos;
      formEscolher = docTodos.querySelector('form#frmProcedimentoEscolherTipo') || docTodos.querySelector('form');
    }
  }

  const idTipoProc = tipoEncontrado ? tipoEncontrado.id : '100000446';
  const nomeTipoProc = tipoEncontrado ? tipoEncontrado.nome : 'CBMDF - Serviço Operacional';

  console.log(`[Netuno SEI] Tipo selecionado: ${nomeTipoProc} (${idTipoProc})`);
  updateStatus(`⏳ Abrindo formulário para "${nomeTipoProc}"...`, '#38bdf8');

  // Submete a seleção do tipo no formulário nativo do SEI (simula o escolher(id) nativo)
  const postEscolher = new URLSearchParams();
  formEscolher.querySelectorAll('input').forEach(el => {
    if (el.name) postEscolher.set(el.name, el.value || '');
  });
  postEscolher.set('hdnIdTipoProcedimento', idTipoProc);
  postEscolher.set('hdnFiltroTipoProcedimento', formEscolher.querySelector('#hdnFiltroTipoProcedimento')?.value || 'U');

  const actionEscolher = resolveSeiUrl(formEscolher.getAttribute('action') || urlMenuEscolher, urlMenuEscolher);
  const resGerar = await fetch(actionEscolher, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: postEscolher.toString()
  });

  const htmlGerar = await resGerar.text();
  const docGerar = new DOMParser().parseFromString(htmlGerar, 'text/html');
  const formProc = getSeiWorkForm(docGerar, 'form#frmProcedimentoCadastro, form#frmProcedimentoGerar');

  if (!formProc) {
    const erroSei = extractSeiErrorMessage(htmlGerar);
    throw new Error(erroSei || `Não foi possível carregar o formulário para "${nomeTipoProc}".`);
  }

  const actionProc = resolveSeiUrl(formProc.getAttribute('action') || resGerar.url || actionEscolher, resGerar.url || actionEscolher);

  return {
    docProc: docGerar,
    formProc,
    actionProc,
    idTipoProc,
    nomeTipoProc
  };
}

// Motor de Automação no SEI
async function executeFullAutomation(pkg) {
  const runBtn = document.getElementById('btn-netuno-run');
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.style.opacity = '0.5';
    runBtn.style.cursor = 'not-allowed';
  }

  const cidade = pkg?.cidade || 'Distrito Federal';
  const raRomano = pkg?.raRomano || '';
  const ano = new Date().getFullYear();
  const descProcesso = `Vistoria em Hidrantes Urbanos - ${cidade}${raRomano ? ` (RA ${raRomano})` : ''} - ${ano}`;

  try {
    // ----------------------------------------------------
    // ETAPA 1: Autuação do Processo Administrativo
    // ----------------------------------------------------
    updateStatus('⏳ 1/4: Obtendo formulário de processo...', '#38bdf8');
    
    const { docProc, formProc, actionProc, idTipoProc, nomeTipoProc } = await obterFormularioGerarProcesso();

    const postProcData = new URLSearchParams();
    formProc.querySelectorAll('input, select, textarea').forEach(el => {
      if (el.name) postProcData.set(el.name, el.value || '');
    });

    // Extrai o assunto já associado ao formulário ou define o padrão CBMDF
    const selAssuntos = formProc.querySelector('#selAssuntos, select[name="selAssuntos"]');
    let assuntoValor = '';
    if (selAssuntos && selAssuntos.options && selAssuntos.options.length > 0) {
      const opts = Array.from(selAssuntos.options);
      assuntoValor = opts.map(o => `${o.value}±${o.text.trim()}`).join('¥');
    }
    if (!assuntoValor) {
      assuntoValor = '339±081.00 - CBMDF - CORPO DE BOMBEIROS MILITAR DO DF';
    }

    postProcData.set('hdnInfraTipoPagina', '1');
    postProcData.set('rdoProtocolo', 'A');
    postProcData.set('selTipoProcedimento', idTipoProc);
    postProcData.set('hdnIdTipoProcedimento', idTipoProc);
    postProcData.set('txtDescricao', descProcesso);
    postProcData.set('rdoNivelAcesso', '0'); // Público
    postProcData.set('hdnFlagProcedimentoCadastro', '2');
    postProcData.set('hdnAssuntos', assuntoValor);
    postProcData.set('btnSalvar', 'Salvar');
    postProcData.set('sbmSalvar', 'Salvar');
    postProcData.set('txtInteressadoProcedimento', 'CORPO DE BOMBEIROS MILITAR DO DISTRITO FEDERAL');

    if (!postProcData.get('selTipoPrioridade') || postProcData.get('selTipoPrioridade') === '') {
      postProcData.set('selTipoPrioridade', 'null');
    }
    if (!postProcData.get('selGrauSigilo') || postProcData.get('selGrauSigilo') === '') {
      postProcData.set('selGrauSigilo', 'null');
    }
    if (!postProcData.get('selHipoteseLegal') || postProcData.get('selHipoteseLegal') === '') {
      postProcData.set('selHipoteseLegal', 'null');
    }

    updateStatus(`⏳ 1/4: Salvando autuação do processo (${nomeTipoProc})...`, '#38bdf8');
    const resSaveProc = await fetch(actionProc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postProcData.toString()
    });

    const textSaveProc = await resSaveProc.text();
    const docProcessoSalvo = new DOMParser().parseFromString(textSaveProc, 'text/html');

    const matchIdProc = textSaveProc.match(/id_procedimento=(\d+)/i) || resSaveProc.url.match(/id_procedimento=(\d+)/i);
    const matchNumProc = textSaveProc.match(/(\d{5}-\d{8}\/\d{4}-\d{2})/);

    if (!matchIdProc) {
      const msgErro = extractSeiErrorMessage(textSaveProc);
      throw new Error(msgErro || 'Processo gerado, mas não foi possível extrair o ID do procedimento do SEI.');
    }

    const idProcedimento = matchIdProc[1];
    const numeroProcesso = matchNumProc ? matchNumProc[1] : idProcedimento;
    console.log('[Netuno SEI] Processo criado com sucesso:', numeroProcesso, 'ID:', idProcedimento);

    // ----------------------------------------------------
    // ETAPA 2: Anexar Relatório Oficial CAESB (Nato-digital)
    // ----------------------------------------------------
    updateStatus(`⏳ 2/4: Processo ${numeroProcesso} criado! Abrindo formulário de anexo...`, '#38bdf8');

    // Localiza o link 'Incluir Documento' a partir da página do processo
    let linkIncluirDoc = docProcessoSalvo.querySelector('a[href*="documento_escolher_tipo"], a[title*="Incluir Documento"], a[aria-label*="Incluir Documento"]');
    let urlEscolherDoc = linkIncluirDoc ? resolveSeiUrl(linkIncluirDoc.getAttribute('href'), resSaveProc.url) : null;

    if (!urlEscolherDoc) {
      // Procura qualquer link com documento_escolher_tipo
      const matchDocEsc = textSaveProc.match(/controlador\.php\?acao=documento_escolher_tipo[^"'\s<>]+/i);
      if (matchDocEsc) {
        urlEscolherDoc = resolveSeiUrl(matchDocEsc[0], resSaveProc.url);
      }
    }

    if (!urlEscolherDoc) {
      try {
        const urlArvore = resolveSeiUrl(`controlador.php?acao=procedimento_trabalhar&id_procedimento=${idProcedimento}&infra_sistema=${getInfraSistema()}&infra_unidade_atual=${getInfraUnidade()}`, resSaveProc.url);
        const resArvore = await fetch(urlArvore);
        const htmlArvore = await resArvore.text();
        const docArvore = new DOMParser().parseFromString(htmlArvore, 'text/html');
        const linkArvore = docArvore.querySelector('a[href*="documento_escolher_tipo"], a[title*="Incluir Documento"], a[aria-label*="Incluir Documento"]');
        if (linkArvore) {
          urlEscolherDoc = resolveSeiUrl(linkArvore.getAttribute('href'), urlArvore);
        } else {
          const m = htmlArvore.match(/controlador\.php\?acao=documento_escolher_tipo[^"'\s<>]+/i);
          if (m) urlEscolherDoc = resolveSeiUrl(m[0], urlArvore);
        }
      } catch (errArvore) {
        console.warn('[Netuno SEI] Falha ao consultar árvore do processo:', errArvore);
      }
    }

    if (!urlEscolherDoc) {
      throw new Error('Não foi possível localizar o botão "Incluir Documento" no processo recém-criado.');
    }

    const resPageEscolherDoc = await fetch(urlEscolherDoc);
    const htmlEscolherDoc = await resPageEscolherDoc.text();
    const docEscolherDoc = new DOMParser().parseFromString(htmlEscolherDoc, 'text/html');

    // Localiza o documento externo (Série 2056 - Relatório ou link "Externo")
    let linkDocExterno = docEscolherDoc.querySelector('a[href*="documento_receber"], a[href*="id_serie=2056"]');
    if (!linkDocExterno) {
      const allDocLinks = Array.from(docEscolherDoc.querySelectorAll('a'));
      linkDocExterno = allDocLinks.find(a => /externo/i.test(a.textContent) || /documento_receber/i.test(a.href) || /2056/.test(a.getAttribute('onclick') || ''));
    }

    let urlDocReceber = linkDocExterno && linkDocExterno.getAttribute('href') && !linkDocExterno.getAttribute('href').startsWith('#')
      ? resolveSeiUrl(linkDocExterno.getAttribute('href'), urlEscolherDoc)
      : null;

    if (!urlDocReceber) {
      const u = new URL(urlEscolherDoc);
      u.searchParams.set('acao', 'documento_receber');
      u.searchParams.set('acao_origem', 'documento_escolher_tipo');
      u.searchParams.set('id_serie', '2056');
      urlDocReceber = u.toString();
    }

    const resPageDocReceber = await fetch(urlDocReceber);
    const htmlDocReceber = await resPageDocReceber.text();
    const docDocReceber = new DOMParser().parseFromString(htmlDocReceber, 'text/html');
    const formDoc = getSeiWorkForm(docDocReceber, 'form#frmDocumentoReceber, form#frmDocumentoCadastro');

    updateStatus('⏳ 2/4: Enviando arquivo PDF do Laudo CAESB...', '#38bdf8');

    // Upload do arquivo
    const uploadId = Math.floor(Math.random() * 900000 + 100000).toString();
    const uploadFormData = new FormData();
    uploadFormData.append('UPLOAD_IDENTIFIER', uploadId);

    const pdfBlob = pkg.pdfBase64 
      ? await (await fetch(`data:application/pdf;base64,${pkg.pdfBase64}`)).blob()
      : new Blob([pkg.htmlContent || 'Relatório Oficial CAESB'], { type: 'text/html;charset=utf-8' });

    const fileName = `Relatorio_Vistoria_CAESB_${cidade.replace(/\s+/g, '_')}.pdf`;
    uploadFormData.append('filArquivo', pdfBlob, fileName);

    const hashDocReceber = new URL(urlDocReceber).searchParams.get('infra_hash') || '';
    const rawUploadAction = formDoc?.querySelector('input[name="hdnUploadUrl"]')?.value || 
      `controlador.php?acao=documento_upload_anexo&infra_sistema=${getInfraSistema()}&infra_unidade_atual=${getInfraUnidade()}&infra_hash=${hashDocReceber}`;
    const uploadAction = resolveSeiUrl(rawUploadAction, urlDocReceber);
    
    const resUpload = await fetch(uploadAction, {
      method: 'POST',
      body: uploadFormData
    });
    const uploadRespText = await resUpload.text();
    const matchToken = uploadRespText.match(/([a-f0-9]{32}±[^"'\s<>]+)/);
    const anexoToken = matchToken ? matchToken[1] : `${uploadId}±${fileName}`;

    // Submete dados do anexo
    const postDocData = new URLSearchParams();
    if (formDoc) {
      formDoc.querySelectorAll('input, select, textarea').forEach(el => {
        if (el.name) postDocData.set(el.name, el.value || '');
      });
    }

    const dataHoje = new Date().toLocaleDateString('pt-BR');
    postDocData.set('hdnInfraTipoPagina', '2');
    postDocData.set('selSerie', '2056');
    postDocData.set('hdnIdSerie', '2056');
    postDocData.set('txtDataElaboracao', dataHoje);
    postDocData.set('txtNomeArvore', 'Relatório CAESB');
    postDocData.set('rdoFormato', 'N'); // Nato-digital
    postDocData.set('rdoNivelAcesso', '0'); // Público
    postDocData.set('hdnFlagDocumentoCadastro', '2');
    postDocData.set('hdnStaDocumento', 'X');
    postDocData.set('hdnIdProcedimento', idProcedimento);
    postDocData.set('hdnAnexos', anexoToken);
    postDocData.set('sbmSalvar', 'Salvar');
    if (!postDocData.get('selHipoteseLegal')) {
      postDocData.set('selHipoteseLegal', 'null');
    }

    const actionSaveDoc = resolveSeiUrl(formDoc?.getAttribute('action') || urlDocReceber, urlDocReceber);
    const resSaveDoc = await fetch(actionSaveDoc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postDocData.toString()
    });

    const textSaveDoc = await resSaveDoc.text();
    const matchDocSei = textSaveDoc.match(/(\d{7,10})/);
    const numeroSeiRelatorio = matchDocSei ? matchDocSei[1] : 'Relatório CAESB';
    console.log('[Netuno SEI] Relatório anexado com sucesso:', numeroSeiRelatorio);

    // ----------------------------------------------------
    // ETAPA 3: Gerar Memorando ao Cel. Comandante do GPCIU
    // ----------------------------------------------------
    updateStatus(`⏳ 3/4: Laudo nº ${numeroSeiRelatorio} anexado! Abrindo Memorando...`, '#38bdf8');

    // Acessa catálogo de documentos novamente para pegar o link do Memorando (Série 165)
    const resPageEscolherMemo = await fetch(urlEscolherDoc);
    const htmlEscolherMemo = await resPageEscolherMemo.text();
    const docEscolherMemo = new DOMParser().parseFromString(htmlEscolherMemo, 'text/html');

    let linkMemo = docEscolherMemo.querySelector('a[href*="id_serie=165"]');
    if (!linkMemo) {
      const allMemoLinks = Array.from(docEscolherMemo.querySelectorAll('a'));
      linkMemo = allMemoLinks.find(a => /memorando/i.test(a.textContent) && (a.href.includes('documento_gerar') || /165/.test(a.getAttribute('onclick') || '')));
    }

    let urlGerarMemo = linkMemo && linkMemo.getAttribute('href') && !linkMemo.getAttribute('href').startsWith('#')
      ? resolveSeiUrl(linkMemo.getAttribute('href'), urlEscolherDoc)
      : null;

    if (!urlGerarMemo) {
      const u = new URL(urlEscolherDoc);
      u.searchParams.set('acao', 'documento_gerar');
      u.searchParams.set('acao_origem', 'documento_escolher_tipo');
      u.searchParams.set('id_serie', '165');
      urlGerarMemo = u.toString();
    }

    const resPageMemo = await fetch(urlGerarMemo);
    const htmlMemo = await resPageMemo.text();
    const docMemo = new DOMParser().parseFromString(htmlMemo, 'text/html');
    const formMemo = getSeiWorkForm(docMemo, 'form#frmDocumentoGerar, form#frmDocumentoCadastro');

    const postMemoData = new URLSearchParams();
    if (formMemo) {
      formMemo.querySelectorAll('input, select, textarea').forEach(el => {
        if (el.name) postMemoData.set(el.name, el.value || '');
      });
    }

    postMemoData.set('hdnInfraTipoPagina', '2');
    postMemoData.set('txtDataElaboracao', dataHoje);
    postMemoData.set('txtDescricao', `Memorando - Vistoria de Hidrantes em ${cidade}`);
    postMemoData.set('rdoNivelAcesso', '0');
    postMemoData.set('hdnFlagDocumentoCadastro', '2');
    postMemoData.set('hdnIdSerie', '165');
    postMemoData.set('hdnStaDocumento', 'I');
    postMemoData.set('hdnIdProcedimento', idProcedimento);
    postMemoData.set('sbmSalvar', 'Salvar');
    if (!postMemoData.get('selHipoteseLegal')) {
      postMemoData.set('selHipoteseLegal', 'null');
    }

    const actionSaveMemo = resolveSeiUrl(formMemo?.getAttribute('action') || urlGerarMemo, urlGerarMemo);
    const resSaveMemo = await fetch(actionSaveMemo, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postMemoData.toString()
    });

    const textSaveMemo = await resSaveMemo.text();
    const matchIdMemo = textSaveMemo.match(/id_documento=(\d+)/i) || resSaveMemo.url.match(/id_documento=(\d+)/i);
    if (!matchIdMemo) {
      const msgErro = extractSeiErrorMessage(textSaveMemo);
      throw new Error(msgErro || 'Memorando criado, mas ID do documento não retornado pelo SEI.');
    }
    const idDocumentoMemo = matchIdMemo[1];

    // Salva o texto da minuta com encaminhamento ao Cel. Comandante do GPCIU
    updateStatus('⏳ 3/4: Salvando minuta oficial endereçada ao Cel. Comandante do GPCIU...', '#38bdf8');

    // Extrai o link do editor a partir do retorno ou padrão SEI
    let linkEditor = textSaveMemo.match(/controlador\.php\?acao=editor_montar[^"'\s<>]+/i);
    const urlEditor = linkEditor ? resolveSeiUrl(linkEditor[0], urlGerarMemo) : null;

    if (urlEditor) {
      const resPageEditor = await fetch(urlEditor);
      const htmlEditor = await resPageEditor.text();
      const docEditor = new DOMParser().parseFromString(htmlEditor, 'text/html');
      const formEditor = getSeiWorkForm(docEditor, 'form#frmEditor');

      let corpoTexto = pkg.memorandoMinuta || '';
      corpoTexto = corpoTexto.replace('[Nº SEI DO RELATÓRIO EXTERNO]', numeroSeiRelatorio);

      const postEditorData = new URLSearchParams();
      if (formEditor) {
        formEditor.querySelectorAll('input, select, textarea').forEach(el => {
          if (el.name) postEditorData.set(el.name, el.value || '');
        });
      }

      const paragraphsHtml = corpoTexto.split('\n\n').map(p => `<p style="font-family: Arial; font-size: 11pt; line-height: 1.5; text-align: justify; margin-bottom: 12pt;">${p.replace(/\n/g, '<br/>')}</p>`).join('');

      postEditorData.set('txaConteudo', paragraphsHtml);
      postEditorData.set('id_documento', idDocumentoMemo);
      postEditorData.set('hdnIdDocumento', idDocumentoMemo);
      postEditorData.set('id_procedimento', idProcedimento);
      postEditorData.set('hdnIdProcedimento', idProcedimento);

      const actionEditor = resolveSeiUrl(formEditor?.getAttribute('action') || urlEditor, urlEditor);
      await fetch(actionEditor, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: postEditorData.toString()
      });
    }

    console.log('[Netuno SEI] Minuta do Memorando salva com sucesso.');

    // ----------------------------------------------------
    // ETAPA 4: Abrir Assinatura Eletrônica Oficial (2ª Senha)
    // ----------------------------------------------------
    updateStatus('✍️ 4/4: Processo pronto! Abrindo janela de Assinatura Oficial do SEI...', '#34d399');

    // Localiza o link de assinar documento
    const matchAssinar = textSaveMemo.match(/controlador\.php\?acao=documento_assinar[^"'\s<>]+/i);
    const hashAssinar = matchAssinar ? '' : (new URL(urlGerarMemo).searchParams.get('infra_hash') || '');
    const urlAssinatura = matchAssinar 
      ? resolveSeiUrl(matchAssinar[0], urlGerarMemo)
      : resolveSeiUrl(`controlador.php?acao=documento_assinar&id_documento=${idDocumentoMemo}&infra_sistema=${getInfraSistema()}&infra_unidade_atual=${getInfraUnidade()}&infra_hash=${hashAssinar}`, urlGerarMemo);

    // Link para tramitação posterior
    const matchEnviar = textSaveProc.match(/controlador\.php\?acao=procedimento_enviar[^"'\s<>]+/i);
    const urlTramitar = matchEnviar ? resolveSeiUrl(matchEnviar[0], resSaveProc.url) : null;

    const area = document.getElementById('netuno-status-area');
    if (area) {
      area.innerHTML = `
        <div style="color: #34d399; font-weight: bold; margin-bottom: 6px;">
          ✅ Documentos montados com sucesso no SEI!
        </div>
        <div style="color: #cbd5e1; font-size: 11px; margin-bottom: 8px;">
          Processo: <strong style="color: white; font-family: monospace;">${numeroProcesso}</strong><br/>
          Tipo: <strong style="color: #a7f3d0;">${nomeTipoProc}</strong><br/>
          Relatório CAESB: <strong style="color: #38bdf8; font-family: monospace;">Nº ${numeroSeiRelatorio}</strong><br/>
          Memorando: <strong style="color: #a7f3d0;">Endereçado ao Cel. Comandante</strong><br/><br/>
          1. A janela de assinatura do SEI foi aberta na tela.<br/>
          2. Digite sua senha de assinatura eletrônica do SEI.<br/>
          3. Em seguida, clique abaixo para tramitar para <strong>CBMDF/COESP/GPCIU/SEHUR</strong>.
        </div>
        <button id="btn-tramitar-final" style="width: 100%; padding: 10px; background: #0284c7; hover:background: #0369a1; border: none; border-radius: 8px; color: white; font-weight: bold; cursor: pointer; font-size: 12px; box-shadow: 0 4px 12px rgba(2,132,199,0.4);">
          🚀 Concluir e Tramitar para SEHUR
        </button>
      `;

      document.getElementById('btn-tramitar-final').onclick = async () => {
        await tramitarProcessoFinal(idProcedimento, numeroProcesso, urlTramitar);
      };
    }

    // Abre a janela de assinatura oficial do SEI
    window.open(urlAssinatura, 'JanelaAssinaturaSEI', 'width=800,height=600,scrollbars=yes');

  } catch (err) {
    console.error('[Netuno SEI] Erro na automação:', err);
    updateStatus(`❌ Falha: ${err.message}`, '#f43f5e');
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.style.opacity = '1';
      runBtn.style.cursor = 'pointer';
    }
  }
}

// Tramitação final do processo para CBMDF/COESP/GPCIU/SEHUR
async function tramitarProcessoFinal(idProcedimento, numeroProcesso, urlTramitar) {
  try {
    updateStatus('⏳ Tramitando processo para CBMDF/COESP/GPCIU/SEHUR...', '#38bdf8');

    let urlEnviar = urlTramitar;
    if (!urlEnviar) {
      // Localiza o link de envio na página atual
      const linkEnv = document.querySelector('a[href*="procedimento_enviar"]');
      if (linkEnv) urlEnviar = resolveSeiUrl(linkEnv.getAttribute('href'));
    }

    if (!urlEnviar) {
      urlEnviar = resolveSeiUrl(`controlador.php?acao=procedimento_enviar&id_procedimento=${idProcedimento}`);
    }

    const resPageEnviar = await fetch(urlEnviar);
    const htmlEnviar = await resPageEnviar.text();
    const docEnviar = new DOMParser().parseFromString(htmlEnviar, 'text/html');
    const formEnviar = getSeiWorkForm(docEnviar, 'form#frmProcedimentoEnviar');

    const postEnviarData = new URLSearchParams();
    if (formEnviar) {
      formEnviar.querySelectorAll('input, select, textarea').forEach(el => {
        if (el.name) postEnviarData.set(el.name, el.value || '');
      });
    }

    const unidadeDestinoId = '110037655'; // SEHUR
    postEnviarData.set('hdnInfraTipoPagina', '2');
    postEnviarData.set('sbmEnviar', 'Enviar');
    postEnviarData.set('selUnidades', unidadeDestinoId);
    postEnviarData.set('chkSinManterAberto', 'on'); // Mantém aberto na SUOMA
    postEnviarData.set('hdnIdProtocolos', idProcedimento);
    postEnviarData.set('hdnUnidades', `${unidadeDestinoId}±CBMDF/COESP/GPCIU/SEHUR - Seção de Hidrantes Urbanos`);

    const actionEnviar = resolveSeiUrl(formEnviar?.getAttribute('action') || urlEnviar, urlEnviar);
    await fetch(actionEnviar, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postEnviarData.toString()
    });

    updateStatus(`🎉 SUCESSO! Processo ${numeroProcesso} enviado para CBMDF/COESP/GPCIU/SEHUR mantendo cópia na SUOMA!`, '#34d399');

    // Limpa pacote para não reexecutar sem novo relatório
    chrome.storage?.local?.remove(['netuno_sei_package']);

  } catch (err) {
    console.error('[Netuno SEI] Falha na tramitação:', err);
    updateStatus(`⚠️ Processo autuado, mas falha ao tramitar: ${err.message}`, '#f59e0b');
  }
}

// Inicialização: Verifica se há pacote pendente
function initExtension() {
  if (chrome.storage?.local) {
    chrome.storage.local.get(['netuno_sei_package'], (res) => {
      if (res && res.netuno_sei_package) {
        console.log('[Netuno SEI] Pacote ativo detectado:', res.netuno_sei_package);
        renderFloatingCard(res.netuno_sei_package);
      }
    });
  }
}

// Roda no carregamento
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initExtension);
} else {
  initExtension();
}
