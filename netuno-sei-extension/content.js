// content.js - Motor de Automação Netuno SEI Integrator (Executado no SEI/SIP DF)

console.log('[Netuno SEI Ext] Content Script Ativo em:', window.location.href);

// Extrai parâmetros da URL atual
function getUrlParam(name) {
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
  } catch (_) {
    return null;
  }
}

// Extrai o infra_hash de qualquer lugar da página (URL, forms, scripts)
function getInfraHash() {
  const fromUrl = getUrlParam('infra_hash');
  if (fromUrl) return fromUrl;

  const inputHash = document.querySelector('input[name="infra_hash"], input#infra_hash');
  if (inputHash && inputHash.value) return inputHash.value;

  const match = document.documentElement.innerHTML.match(/infra_hash=([a-f0-9]{64})/i);
  return match ? match[1] : null;
}

// Extrai a unidade ativa no SEI
function getInfraUnidade() {
  const fromUrl = getUrlParam('infra_unidade_atual');
  if (fromUrl) return fromUrl;

  const inputUnidade = document.querySelector('input[name="infra_unidade_atual"], input#infra_unidade_atual');
  if (inputUnidade && inputUnidade.value) return inputUnidade.value;

  const match = document.documentElement.innerHTML.match(/infra_unidade_atual=(\d+)/i);
  return match ? match[1] : '110037654'; // Fallback SUOMA
}

function getInfraSistema() {
  return getUrlParam('infra_sistema') || '100000100';
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
    width: 360px;
    background: #0f172a;
    color: #f8fafc;
    border: 2px solid #059669;
    border-radius: 14px;
    padding: 16px;
    z-index: 9999999;
    box-shadow: 0 15px 35px rgba(0,0,0,0.6);
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
      <div style="color: #38bdf8; font-size: 11px; margin-top: 4px;">
        Destino: CBMDF/COESP/GPCIU/SEHUR
      </div>
    </div>

    <div id="netuno-status-area" style="background: #1e293b; padding: 10px; border-radius: 8px; margin-bottom: 12px; font-size: 12px; border: 1px solid #334155;">
      <div style="color: #cbd5e1;">Aguardando seu comando. Clique no botão abaixo para criar o processo, anexar o laudo e abrir a assinatura.</div>
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

// Motor de Automação no SEI
async function executeFullAutomation(pkg) {
  const runBtn = document.getElementById('btn-netuno-run');
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.style.opacity = '0.5';
    runBtn.style.cursor = 'not-allowed';
  }

  const infraHash = getInfraHash();
  const infraUnidade = getInfraUnidade();
  const infraSistema = getInfraSistema();
  const cidade = pkg?.cidade || 'Distrito Federal';
  const raRomano = pkg?.raRomano || '';
  const ano = new Date().getFullYear();

  try {
    // ----------------------------------------------------
    // ETAPA 1: Autuação do Processo Administrativo
    // ----------------------------------------------------
    updateStatus('⏳ 1/4: Autuando processo de Fiscalização de Hidrantes...', '#38bdf8');
    
    const descProcesso = `Vistoria em Hidrantes Urbanos - ${cidade}${raRomano ? ` (RA ${raRomano})` : ''} - ${ano}`;
    const urlGerarProc = `/sei/controlador.php?acao=procedimento_gerar&acao_origem=procedimento_escolher_tipo&id_tipo_procedimento=100000446&infra_sistema=${infraSistema}&infra_unidade_atual=${infraUnidade}&infra_hash=${infraHash}`;

    const resPageProc = await fetch(urlGerarProc);
    const htmlProc = await resPageProc.text();
    const docProc = new DOMParser().parseFromString(htmlProc, 'text/html');

    const formProc = docProc.querySelector('form#frmProcedimentoGerar') || docProc.querySelector('form');
    if (!formProc) {
      throw new Error('Não foi possível abrir o formulário de geração de processo do SEI.');
    }

    const postProcData = new URLSearchParams();
    formProc.querySelectorAll('input, select, textarea').forEach(el => {
      if (el.name) postProcData.set(el.name, el.value || '');
    });

    postProcData.set('hdnInfraTipoPagina', '1');
    postProcData.set('rdoProtocolo', 'A');
    postProcData.set('selTipoProcedimento', '100000446');
    postProcData.set('hdnIdTipoProcedimento', '100000446');
    postProcData.set('txtDescricao', descProcesso);
    postProcData.set('rdoNivelAcesso', '0'); // Público
    postProcData.set('hdnFlagProcedimentoCadastro', '2');
    postProcData.set('sbmSalvar', 'Salvar');
    postProcData.set('txtInteressadoProcedimento', 'CORPO DE BOMBEIROS MILITAR DO DISTRITO FEDERAL');
    postProcData.set('hdnAssuntos', '339±081.00 - CBMDF - CORPO DE BOMBEIROS MILITAR DO DISTRITO FEDERAL');

    const actionProc = formProc.getAttribute('action') || urlGerarProc;
    const resSaveProc = await fetch(actionProc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postProcData.toString()
    });

    const textSaveProc = await resSaveProc.text();
    const matchIdProc = textSaveProc.match(/id_procedimento=(\d+)/i) || resSaveProc.url.match(/id_procedimento=(\d+)/i);
    const matchNumProc = textSaveProc.match(/(\d{5}-\d{8}\/\d{4}-\d{2})/);

    if (!matchIdProc) {
      throw new Error('Processo criado, mas ID do procedimento não retornado pelo SEI.');
    }

    const idProcedimento = matchIdProc[1];
    const numeroProcesso = matchNumProc ? matchNumProc[1] : idProcedimento;
    console.log('[Netuno SEI] Processo criado com sucesso:', numeroProcesso, 'ID:', idProcedimento);

    // ----------------------------------------------------
    // ETAPA 2: Anexar Relatório Oficial CAESB (Nato-digital)
    // ----------------------------------------------------
    updateStatus(`⏳ 2/4: Processo ${numeroProcesso} criado! Anexando Laudo CAESB...`, '#38bdf8');

    const urlDocReceber = `/sei/controlador.php?acao=documento_receber&acao_origem=documento_escolher_tipo&id_procedimento=${idProcedimento}&id_serie=2056&infra_sistema=${infraSistema}&infra_unidade_atual=${infraUnidade}&infra_hash=${infraHash}`;
    const resPageDoc = await fetch(urlDocReceber);
    const htmlDoc = await resPageDoc.text();
    const docDoc = new DOMParser().parseFromString(htmlDoc, 'text/html');

    const formDoc = docDoc.querySelector('form#frmDocumentoReceber') || docDoc.querySelector('form');
    
    // Upload do arquivo
    const uploadId = Math.floor(Math.random() * 900000 + 100000).toString();
    const uploadFormData = new FormData();
    uploadFormData.append('UPLOAD_IDENTIFIER', uploadId);

    const pdfBlob = pkg.pdfBase64 
      ? await (await fetch(`data:application/pdf;base64,${pkg.pdfBase64}`)).blob()
      : new Blob([pkg.htmlContent || 'Relatório Oficial CAESB'], { type: 'text/html;charset=utf-8' });

    const fileName = `Relatorio_Vistoria_CAESB_${cidade.replace(/\s+/g, '_')}.pdf`;
    uploadFormData.append('filArquivo', pdfBlob, fileName);

    const uploadUrl = `/sei/controlador.php?acao=documento_upload_anexo&infra_sistema=${infraSistema}&infra_unidade_atual=${infraUnidade}&infra_hash=${infraHash}`;
    const resUpload = await fetch(uploadUrl, {
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
    postDocData.set('hdnIdUnidadeGeradoraProtocolo', infraUnidade);
    postDocData.set('hdnStaDocumento', 'X');
    postDocData.set('hdnIdProcedimento', idProcedimento);
    postDocData.set('hdnAnexos', anexoToken);

    const actionDoc = formDoc ? (formDoc.getAttribute('action') || urlDocReceber) : urlDocReceber;
    const resSaveDoc = await fetch(actionDoc, {
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
    updateStatus('⏳ 3/4: Laudo anexado! Elaborando Memorando ao Cel. Comandante do GPCIU...', '#38bdf8');

    const urlGerarMemo = `/sei/controlador.php?acao=documento_gerar&acao_origem=documento_escolher_tipo&id_procedimento=${idProcedimento}&id_serie=165&infra_sistema=${infraSistema}&infra_unidade_atual=${infraUnidade}&infra_hash=${infraHash}`;
    const resPageMemo = await fetch(urlGerarMemo);
    const htmlMemo = await resPageMemo.text();
    const docMemo = new DOMParser().parseFromString(htmlMemo, 'text/html');
    const formMemo = docMemo.querySelector('form#frmDocumentoGerar') || docMemo.querySelector('form');

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
    postMemoData.set('hdnIdUnidadeGeradoraProtocolo', infraUnidade);
    postMemoData.set('hdnStaDocumento', 'I');
    postMemoData.set('hdnIdProcedimento', idProcedimento);

    const actionMemo = formMemo ? (formMemo.getAttribute('action') || urlGerarMemo) : urlGerarMemo;
    const resSaveMemo = await fetch(actionMemo, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postMemoData.toString()
    });

    const textSaveMemo = await resSaveMemo.text();
    const matchIdMemo = textSaveMemo.match(/id_documento=(\d+)/i) || resSaveMemo.url.match(/id_documento=(\d+)/i);
    if (!matchIdMemo) {
      throw new Error('Memorando criado, mas ID do documento não retornado pelo SEI.');
    }
    const idDocumentoMemo = matchIdMemo[1];

    // Salva o texto da minuta com encaminhamento ao Cel. Comandante do GPCIU
    const urlEditor = `/sei/controlador.php?acao=editor_montar&id_procedimento=${idProcedimento}&id_documento=${idDocumentoMemo}&infra_sistema=${infraSistema}&infra_unidade_atual=${infraUnidade}&infra_hash=${infraHash}`;
    const resPageEditor = await fetch(urlEditor);
    const htmlEditor = await resPageEditor.text();
    const docEditor = new DOMParser().parseFromString(htmlEditor, 'text/html');
    const formEditor = docEditor.querySelector('form#frmEditor') || docEditor.querySelector('form');

    let corpoTexto = pkg.memorandoMinuta || '';
    corpoTexto = corpoTexto.replace('[Nº SEI DO RELATÓRIO EXTERNO]', numeroSeiRelatorio);

    const postEditorData = new URLSearchParams();
    if (formEditor) {
      formEditor.querySelectorAll('input, select, textarea').forEach(el => {
        if (el.name) postEditorData.set(el.name, el.value || '');
      });
    }

    // Formata parágrafos em HTML para o editor do SEI
    const paragraphsHtml = corpoTexto.split('\n\n').map(p => `<p style="font-family: Arial; font-size: 11pt; line-height: 1.5; text-align: justify; margin-bottom: 12pt;">${p.replace(/\n/g, '<br/>')}</p>`).join('');

    postEditorData.set('txaConteudo', paragraphsHtml);
    postEditorData.set('id_documento', idDocumentoMemo);
    postEditorData.set('hdnIdDocumento', idDocumentoMemo);
    postEditorData.set('id_procedimento', idProcedimento);
    postEditorData.set('hdnIdProcedimento', idProcedimento);

    const actionEditor = formEditor ? (formEditor.getAttribute('action') || `/sei/controlador.php?acao=editor_salvar&infra_sistema=${infraSistema}&infra_unidade_atual=${infraUnidade}&infra_hash=${infraHash}`) : urlEditor;
    await fetch(actionEditor, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postEditorData.toString()
    });

    console.log('[Netuno SEI] Minuta do Memorando salva com sucesso no editor SEI.');

    // ----------------------------------------------------
    // ETAPA 4: Abrir Assinatura Eletrônica Oficial (2ª Senha)
    // ----------------------------------------------------
    updateStatus('✍️ 4/4: Processo pronto! Abrindo Assinatura Eletrônica Oficial do SEI...', '#34d399');

    // Abre pop-up nativo de assinatura do SEI
    const urlAssinatura = `/sei/controlador.php?acao=documento_assinar&id_documento=${idDocumentoMemo}&infra_sistema=${infraSistema}&infra_unidade_atual=${infraUnidade}&infra_hash=${infraHash}`;
    
    // Adiciona botão para tramitação após assinar
    const area = document.getElementById('netuno-status-area');
    if (area) {
      area.innerHTML = `
        <div style="color: #34d399; font-weight: bold; margin-bottom: 6px;">
          ✅ Documentos montados com sucesso no SEI!
        </div>
        <div style="color: #cbd5e1; font-size: 11px; margin-bottom: 8px;">
          Processo: <strong style="color: white;">${numeroProcesso}</strong><br/>
          1. Uma janela de assinatura foi aberta na tela.<br/>
          2. Digite sua senha de assinatura eletrônica do SEI.<br/>
          3. Em seguida, clique abaixo para tramitar para <strong>CBMDF/COESP/GPCIU/SEHUR</strong>.
        </div>
        <button id="btn-tramitar-final" style="width: 100%; padding: 8px; background: #0284c7; border: none; border-radius: 6px; color: white; font-weight: bold; cursor: pointer; font-size: 11px;">
          🚀 Concluir e Tramitar para SEHUR
        </button>
      `;

      document.getElementById('btn-tramitar-final').onclick = async () => {
        await tramitarProcessoFinal(idProcedimento, numeroProcesso, infraSistema, infraUnidade, infraHash);
      };
    }

    // Abre a tela de assinatura oficial do SEI
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
async function tramitarProcessoFinal(idProcedimento, numeroProcesso, infraSistema, infraUnidade, infraHash) {
  try {
    updateStatus('⏳ Tramitando processo para CBMDF/COESP/GPCIU/SEHUR...', '#38bdf8');

    const urlEnviar = `/sei/controlador.php?acao=procedimento_enviar&id_procedimento=${idProcedimento}&infra_sistema=${infraSistema}&infra_unidade_atual=${infraUnidade}&infra_hash=${infraHash}`;
    const resPageEnviar = await fetch(urlEnviar);
    const htmlEnviar = await resPageEnviar.text();
    const docEnviar = new DOMParser().parseFromString(htmlEnviar, 'text/html');
    const formEnviar = docEnviar.querySelector('form#frmProcedimentoEnviar') || docEnviar.querySelector('form');

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

    const actionEnviar = formEnviar ? (formEnviar.getAttribute('action') || urlEnviar) : urlEnviar;
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
