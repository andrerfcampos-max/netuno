import * as cheerio from 'cheerio';

/**
 * SeiService - Motor de Automação Direta SEI DF (Netuno)
 * Realiza autenticação, extração de tokens infra_hash, criação de processo,
 * upload de anexo PDF, criação e preenchimento de memorando, assinatura e tramitação.
 */

export class SeiClient {
  constructor(options = {}) {
    this.sipUrl = options.sipUrl || 'https://sip.df.gov.br';
    this.seiUrl = options.seiUrl || 'https://sei.df.gov.br';
    this.cookies = new Map();
    this.sessionState = {
      usuario: '',
      unidadeAtual: '110037654', // CBMDF/DIVIS/SEHUR/SUOMA
      infraSistema: '100000100',
      infraHash: null,
      idUsuario: null,
      idOrgao: '7'
    };
  }

  // --- Gerenciamento de Cookies ---
  parseSetCookie(setCookieHeaders) {
    if (!setCookieHeaders) return;
    const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    for (const h of headers) {
      const parts = h.split(';');
      const [nameVal] = parts;
      const eqIdx = nameVal.indexOf('=');
      if (eqIdx > 0) {
        const key = nameVal.substring(0, eqIdx).trim();
        const val = nameVal.substring(eqIdx + 1).trim();
        if (val === '' || val === 'deleted') {
          this.cookies.delete(key);
        } else {
          this.cookies.set(key, val);
        }
      }
    }
  }

  getCookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  async request(url, options = {}) {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      ...(options.headers || {})
    };

    const cookieHeader = this.getCookieHeader();
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    const fetchOptions = {
      method: options.method || 'GET',
      headers,
      redirect: 'manual', // Manual para rastrear os cookies em cada redirecionamento 302
      body: options.body
    };

    let currentUrl = url;
    let redirectCount = 0;
    const maxRedirects = 8;

    while (redirectCount < maxRedirects) {
      const res = await fetch(currentUrl, fetchOptions);
      
      // Armazena cookies recebidos
      const setCookies = res.headers.getSetCookie 
        ? res.headers.getSetCookie() 
        : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
      this.parseSetCookie(setCookies);

      // Trata redirecionamentos (301, 302, 303, 307)
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) break;

        const nextUrl = new URL(location, currentUrl).toString();
        currentUrl = nextUrl;
        fetchOptions.method = 'GET';
        delete fetchOptions.body;
        delete fetchOptions.headers['Content-Type'];
        fetchOptions.headers['Cookie'] = this.getCookieHeader();
        redirectCount++;
        continue;
      }

      const text = await res.text();
      return {
        status: res.status,
        url: currentUrl,
        headers: res.headers,
        text,
        $ : cheerio.load(text)
      };
    }

    throw new Error(`Limite de redirecionamentos excedido (${maxRedirects}) ao acessar ${url}`);
  }

  // --- Extração de Tokens do SEI ---
  extractInfraHash(contentOrUrl) {
    if (!contentOrUrl) return null;
    const match = contentOrUrl.match(/infra_hash=([a-f0-9]{64})/i);
    return match ? match[1] : null;
  }

  // --- 1. Login no SIP / SEI ---
  async login(usuario, senha) {
    this.sessionState.usuario = usuario;
    const loginUrl = `${this.sipUrl}/sip/login.php?sigla_orgao_sistema=GDF&sigla_sistema=SEI&infra_url=L3NlaS8=`;
    
    // Passo 1: Acessa tela de login para capturar cookies iniciais
    await this.request(loginUrl);

    // Passo 2: Envia credenciais
    const bodyParams = new URLSearchParams({
      txtUsuario: usuario,
      pwdSenha: senha,
      selOrgao: this.sessionState.idOrgao,
      hdnAcao: '2'
    });

    const postRes = await this.request(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': this.sipUrl,
        'Referer': loginUrl
      },
      body: bodyParams.toString()
    });

    // Se continuar na página de login, a senha está incorreta
    if (postRes.text.includes('Usuário ou senha inválidos') || postRes.text.includes('pwdSenha')) {
      const errorMsg = postRes.$('#divInfraBarraLocalizacao').text() || 'Usuário ou senha incorretos no SEI';
      throw new Error(errorMsg.trim() || 'Falha de autenticação no SEI (SIP DF). Verifique matrícula e senha.');
    }

    // Salva hash e unidade atual
    const hash = this.extractInfraHash(postRes.url) || this.extractInfraHash(postRes.text);
    if (hash) {
      this.sessionState.infraHash = hash;
    }

    const unidadeMatch = postRes.text.match(/infra_unidade_atual=(\d+)/i) || postRes.url.match(/infra_unidade_atual=(\d+)/i);
    if (unidadeMatch) {
      this.sessionState.unidadeAtual = unidadeMatch[1];
    }

    return {
      success: true,
      usuario,
      unidadeAtual: this.sessionState.unidadeAtual,
      infraHash: this.sessionState.infraHash
    };
  }

  // --- 2. Criar Processo de Fiscalização ---
  async criarProcesso({ tipoProcessoId = '100000446', descricao, cidade, raRomano }) {
    const desc = descricao || `Vistoria em Hidrantes Urbanos - ${cidade || 'DF'} ${raRomano ? `(RA ${raRomano})` : ''} - ${new Date().getFullYear()}`;
    const urlGerar = `${this.seiUrl}/sei/controlador.php?acao=procedimento_gerar&acao_origem=procedimento_escolher_tipo&id_tipo_procedimento=${tipoProcessoId}&infra_sistema=${this.sessionState.infraSistema}&infra_unidade_atual=${this.sessionState.unidadeAtual}&infra_hash=${this.sessionState.infraHash}`;

    // Acessa formulário de geração
    const formPage = await this.request(urlGerar);
    const hashForm = this.extractInfraHash(formPage.url) || this.extractInfraHash(formPage.text) || this.sessionState.infraHash;
    this.sessionState.infraHash = hashForm;

    const dataHoje = new Date().toLocaleDateString('pt-BR');
    
    // Dados para gravação do processo (Mapeados diretamente do HAR)
    const postData = new URLSearchParams({
      hdnInfraTipoPagina: '1',
      rdoProtocolo: 'A',
      txtProtocoloInformar: '',
      txtDtaGeracaoInformar: '',
      selTipoProcedimento: tipoProcessoId,
      txtDescricao: desc,
      selTipoPrioridade: 'null',
      txtAssunto: '',
      hdnIdAssunto: '',
      txtInteressadoProcedimento: '',
      hdnIdInteressadoProcedimento: '',
      txtInteressadoUsuario: '',
      hdnIdInteressadoUsuario: '',
      txaObservacoes: '',
      selGrauSigilo: 'null',
      rdoNivelAcesso: '0', // Público
      selHipoteseLegal: 'null',
      hdnFlagProcedimentoCadastro: '2',
      hdnIdTipoProcedimento: tipoProcessoId,
      hdnNomeTipoProcedimento: '',
      hdnAssuntos: '339±081.00 - CBMDF - CORPO DE BOMBEIROS MILITAR DO DISTRITO FEDERAL',
      hdnInteressadosProcedimento: '',
      hdnIdProcedimento: '',
      hdnProtocoloFormatado: '',
      hdnStaNivelAcessoGlobal: '',
      hdnSinIndividual: 'N',
      hdnIdHipoteseLegalSugestao: '',
      hdnDtaGeracao: dataHoje,
      hdnContatoObject: '',
      hdnContatoIdentificador: '',
      hdnAssuntoIdentificador: ''
    });

    const submitRes = await this.request(
      `${this.seiUrl}/sei/controlador.php?acao=procedimento_gerar&acao_origem=procedimento_gerar&infra_sistema=${this.sessionState.infraSistema}&infra_unidade_atual=${this.sessionState.unidadeAtual}&infra_hash=${this.sessionState.infraHash}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': urlGerar
        },
        body: postData.toString()
      }
    );

    // Extrai o id_procedimento gerado
    const procMatch = submitRes.text.match(/id_procedimento=(\d+)/i) || submitRes.url.match(/id_procedimento=(\d+)/i);
    const procNumeroMatch = submitRes.text.match(/(\d{5}-\d{8}\/\d{4}-\d{2})/); // Formato de processo GDF

    const idProcedimento = procMatch ? procMatch[1] : null;
    const numeroProcesso = procNumeroMatch ? procNumeroMatch[1] : 'Processo Gerado';

    if (!idProcedimento) {
      throw new Error('Não foi possível identificar o ID do processo recém-criado no SEI.');
    }

    this.sessionState.infraHash = this.extractInfraHash(submitRes.url) || this.sessionState.infraHash;

    return {
      idProcedimento,
      numeroProcesso,
      descricao: desc
    };
  }

  // --- 3. Upload e Anexo do Relatório CAESB em PDF ---
  async anexarRelatorioPdf({ idProcedimento, pdfBuffer, fileName = 'Relatorio_Vistoria_CAESB.pdf', nomeArvore = 'Relatório CAESB' }) {
    const hash = this.sessionState.infraHash;
    const unidade = this.sessionState.unidadeAtual;
    const sistema = this.sessionState.infraSistema;
    const dataHoje = new Date().toLocaleDateString('pt-BR');

    // 1. Acessa tela de documento externo (serie 2056 = Relatório)
    const urlDoc = `${this.seiUrl}/sei/controlador.php?acao=documento_receber&acao_origem=documento_escolher_tipo&id_procedimento=${idProcedimento}&id_serie=2056&infra_sistema=${sistema}&infra_unidade_atual=${unidade}&infra_hash=${hash}`;
    const formDoc = await this.request(urlDoc);
    const currentHash = this.extractInfraHash(formDoc.url) || hash;
    this.sessionState.infraHash = currentHash;

    // 2. Upload do binário via multipart FormData
    const uploadIdentifier = Math.floor(Math.random() * 900000 + 100000).toString();
    const formData = new FormData();
    formData.append('UPLOAD_IDENTIFIER', uploadIdentifier);
    
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    formData.append('filArquivo', blob, fileName);

    const uploadUrl = `${this.seiUrl}/sei/controlador.php?acao=documento_upload_anexo&infra_sistema=${sistema}&infra_unidade_atual=${unidade}&infra_hash=${this.sessionState.infraHash}`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Cookie': this.getCookieHeader(),
        'Referer': urlDoc
      },
      body: formData
    });

    const uploadText = await uploadRes.text();
    // O retorno do upload traz o token interno do anexo
    const anexoTokenMatch = uploadText.match(/([a-f0-9]{32}±[^"'\s<>]+)/);
    const anexoToken = anexoTokenMatch ? anexoTokenMatch[1] : `${uploadIdentifier}±${fileName}`;

    // 3. Salva os metadados do documento externo anexado
    const postParams = new URLSearchParams({
      hdnInfraTipoPagina: '2',
      selSerie: '2056',
      txtDataElaboracao: dataHoje,
      txtProtocoloDocumentoTextoBase: '',
      txtTextoPadrao: '',
      hdnIdTextoPadrao: '',
      rdoTextoInicial: 'N',
      hdnIdDocumentoTextoBase: '',
      txtDescricao: '',
      txtNumero: '',
      txtNomeArvore: nomeArvore,
      txtDinValor: '',
      rdoFormato: 'N', // Nato-digital
      selTipoConferencia: 'null',
      txtRemetente: '',
      hdnIdRemetente: '',
      txtInteressado: '',
      hdnIdInteressado: '',
      txtDestinatario: '',
      hdnIdDestinatario: '',
      txtAssunto: '',
      hdnIdAssunto: '',
      txaObservacoes: '',
      selGrauSigilo: 'null',
      rdoNivelAcesso: '0', // Público
      selHipoteseLegal: 'null',
      hdnFlagDocumentoCadastro: '2',
      hdnAssuntos: '',
      hdnInteressados: '',
      hdnDestinatarios: '',
      hdnIdSerie: '2056',
      hdnIdUnidadeGeradoraProtocolo: unidade,
      hdnStaDocumento: 'X',
      hdnIdTipoConferencia: '',
      hdnSinArquivamento: 'N',
      hdnStaNivelAcessoLocal: '',
      hdnIdHipoteseLegal: '115',
      hdnStaGrauSigilo: '',
      hdnIdDocumento: '',
      hdnIdProcedimento: idProcedimento,
      hdnAnexos: anexoToken,
      hdnIdHipoteseLegalSugestao: '',
      hdnIdTipoProcedimento: '100000446',
      hdnUnidadesReabertura: '',
      hdnSinBloqueado: 'N',
      hdnContatoObject: '',
      hdnContatoIdentificador: '',
      hdnAssuntoIdentificador: ''
    });

    const salvarDocRes = await this.request(
      `${this.seiUrl}/sei/controlador.php?acao=documento_receber&acao_origem=documento_receber&infra_sistema=${sistema}&infra_unidade_atual=${unidade}&infra_hash=${this.sessionState.infraHash}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': urlDoc
        },
        body: postParams.toString()
      }
    );

    const docIdMatch = salvarDocRes.text.match(/id_documento=(\d+)/i) || salvarDocRes.url.match(/id_documento=(\d+)/i);
    const idDocumentoAnexo = docIdMatch ? docIdMatch[1] : null;

    this.sessionState.infraHash = this.extractInfraHash(salvarDocRes.url) || this.sessionState.infraHash;

    return {
      success: true,
      idDocumentoAnexo,
      fileName
    };
  }

  // --- 4. Gerar e Preencher Memorando ao GPCIU com Minuta de Ofício ---
  async criarMemorando({ idProcedimento, cidade, raRomano, corpoMemorandoHtml, docAnexoSei = '' }) {
    const hash = this.sessionState.infraHash;
    const unidade = this.sessionState.unidadeAtual;
    const sistema = this.sessionState.infraSistema;
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    const desc = `Memorando - Vistoria de Hidrantes em ${cidade || 'DF'}`;

    // 1. Gera documento interno (serie 165 = Memorando)
    const urlGerarMemo = `${this.seiUrl}/sei/controlador.php?acao=documento_gerar&acao_origem=documento_escolher_tipo&id_procedimento=${idProcedimento}&id_serie=165&infra_sistema=${sistema}&infra_unidade_atual=${unidade}&infra_hash=${hash}`;
    const formMemo = await this.request(urlGerarMemo);
    this.sessionState.infraHash = this.extractInfraHash(formMemo.url) || hash;

    const postParams = new URLSearchParams({
      hdnInfraTipoPagina: '2',
      txtDataElaboracao: dataHoje,
      txtProtocoloDocumentoTextoBase: '',
      txtTextoPadrao: '',
      hdnIdTextoPadrao: '',
      rdoTextoInicial: 'N',
      hdnIdDocumentoTextoBase: '',
      txtDescricao: desc,
      txtNumero: '',
      txtNomeArvore: '',
      txtDinValor: '',
      txtRemetente: '',
      hdnIdRemetente: '',
      txtInteressado: '',
      hdnIdInteressado: '',
      txtDestinatario: '',
      hdnIdDestinatario: '',
      txtAssunto: '',
      hdnIdAssunto: '',
      txaObservacoes: '',
      selGrauSigilo: 'null',
      rdoNivelAcesso: '0',
      selHipoteseLegal: 'null',
      hdnFlagDocumentoCadastro: '2',
      hdnAssuntos: '',
      hdnInteressados: '',
      hdnDestinatarios: '',
      hdnIdSerie: '165',
      hdnIdUnidadeGeradoraProtocolo: unidade,
      hdnStaDocumento: 'I',
      hdnIdTipoConferencia: '',
      hdnSinArquivamento: 'N',
      hdnStaNivelAcessoLocal: '',
      hdnIdHipoteseLegal: '115',
      hdnStaGrauSigilo: '',
      hdnIdDocumento: '',
      hdnIdProcedimento: idProcedimento,
      hdnAnexos: '',
      hdnIdHipoteseLegalSugestao: '',
      hdnIdTipoProcedimento: '100000446',
      hdnUnidadesReabertura: '',
      hdnSinBloqueado: 'N',
      hdnContatoObject: '',
      hdnContatoIdentificador: '',
      hdnAssuntoIdentificador: ''
    });

    const submitMemoRes = await this.request(
      `${this.seiUrl}/sei/controlador.php?acao=documento_gerar&acao_origem=documento_gerar&infra_sistema=${sistema}&infra_unidade_atual=${unidade}&infra_hash=${this.sessionState.infraHash}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': urlGerarMemo
        },
        body: postParams.toString()
      }
    );

    const docIdMatch = submitMemoRes.text.match(/id_documento=(\d+)/i) || submitMemoRes.url.match(/id_documento=(\d+)/i);
    const idDocumentoMemo = docIdMatch ? docIdMatch[1] : null;

    if (!idDocumentoMemo) {
      throw new Error('Não foi possível identificar o ID do Memorando gerado.');
    }

    // 2. Salva o conteúdo textual na minuta do editor do SEI
    const editorUrl = `${this.seiUrl}/sei/controlador.php?acao=editor_montar&id_procedimento=${idProcedimento}&id_documento=${idDocumentoMemo}&infra_sistema=${sistema}&infra_unidade_atual=${unidade}&infra_hash=${this.sessionState.infraHash}`;
    const editorPage = await this.request(editorUrl);
    this.sessionState.infraHash = this.extractInfraHash(editorPage.url) || this.sessionState.infraHash;

    const salvarTextoParams = new URLSearchParams({
      hdnInfraTipoPagina: '2',
      txaConteudo: corpoMemorandoHtml,
      id_documento: idDocumentoMemo,
      id_procedimento: idProcedimento
    });

    await this.request(
      `${this.seiUrl}/sei/controlador.php?acao=editor_salvar&infra_sistema=${sistema}&infra_unidade_atual=${unidade}&infra_hash=${this.sessionState.infraHash}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': editorUrl
        },
        body: salvarTextoParams.toString()
      }
    );

    return {
      success: true,
      idDocumentoMemo,
      descricao: desc
    };
  }

  // --- 5. Assinatura Eletrônica do Documento ---
  async assinarDocumento({ idDocumento, usuario, senhaAssinatura, cargoFuncao = '' }) {
    const hash = this.sessionState.infraHash;
    const unidade = this.sessionState.unidadeAtual;
    const sistema = this.sessionState.infraSistema;

    // Acessa pop-up modal de assinatura do SEI
    const urlModal = `${this.seiUrl}/sei/controlador.php?acao=documento_assinar&id_documento=${idDocumento}&infra_sistema=${sistema}&infra_unidade_atual=${unidade}&infra_hash=${hash}`;
    const modalPage = await this.request(urlModal);
    this.sessionState.infraHash = this.extractInfraHash(modalPage.url) || hash;

    // Localiza opções de cargo/função se não especificado
    let cargoEscolhido = cargoFuncao;
    if (!cargoEscolhido) {
      const selectCargo = modalPage.$('select[name="selCargoFuncao"] option');
      if (selectCargo.length > 0) {
        cargoEscolhido = selectCargo.eq(1).val() || selectCargo.eq(0).val() || '';
      }
    }

    const postParams = new URLSearchParams({
      hdnInfraTipoPagina: '1',
      txtUsuario: usuario || this.sessionState.usuario,
      pwdSenha: senhaAssinatura,
      selCargoFuncao: cargoEscolhido,
      selOrgao: this.sessionState.idOrgao,
      hdnIdDocumento: idDocumento,
      sbmAssinar: 'Assinar'
    });

    const assinarRes = await this.request(
      `${this.seiUrl}/sei/controlador.php?acao=documento_assinar&acao_origem=documento_assinar&infra_sistema=${sistema}&infra_unidade_atual=${unidade}&infra_hash=${this.sessionState.infraHash}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': urlModal
        },
        body: postParams.toString()
      }
    );

    if (assinarRes.text.includes('Senha inválida') || assinarRes.text.includes('Senha incorreta')) {
      throw new Error('Senha de assinatura eletrônica do SEI inválida.');
    }

    this.sessionState.infraHash = this.extractInfraHash(assinarRes.url) || this.sessionState.infraHash;

    return {
      success: true,
      idDocumento,
      assinadoPor: usuario || this.sessionState.usuario
    };
  }

  // --- 6. Tramitar/Enviar Processo para Unidade de Destino (SUTEC) ---
  async tramitarProcesso({ idProcedimento, unidadeDestinoId = '110037655' }) {
    const hash = this.sessionState.infraHash;
    const unidade = this.sessionState.unidadeAtual;
    const sistema = this.sessionState.infraSistema;

    // Acessa formulário de tramitação
    const urlEnviar = `${this.seiUrl}/sei/controlador.php?acao=procedimento_enviar&id_procedimento=${idProcedimento}&infra_sistema=${sistema}&infra_unidade_atual=${unidade}&infra_hash=${hash}`;
    const formEnviar = await this.request(urlEnviar);
    this.sessionState.infraHash = this.extractInfraHash(formEnviar.url) || hash;

    // Mapeamento extraído do HAR oficial da SUTEC
    const postParams = new URLSearchParams({
      hdnInfraTipoPagina: '2',
      sbmEnviar: 'Enviar',
      selOrgao: '',
      txtUnidade: '',
      hdnIdUnidade: '',
      selUnidades: unidadeDestinoId,
      chkSinManterAberto: 'on', // Mantém o processo aberto na unidade geradora
      txtPrazoRetornoProgramado: '',
      txtDiasRetornoProgramado: '',
      txtPrazoReaberturaProgramada: '',
      txtDiasReaberturaProgramada: '',
      hdnIdProtocolos: idProcedimento,
      hdnIdAtividades: '',
      hdnUnidades: `${unidadeDestinoId}±CBMDF/DIVIS/SEHUR/SUTEC - Subseção Técnica de Hidrantes`
    });

    const submitEnviar = await this.request(
      `${this.seiUrl}/sei/controlador.php?acao=procedimento_enviar&acao_origem=procedimento_enviar&infra_sistema=${sistema}&infra_unidade_atual=${unidade}&infra_hash=${this.sessionState.infraHash}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': urlEnviar
        },
        body: postParams.toString()
      }
    );

    this.sessionState.infraHash = this.extractInfraHash(submitEnviar.url) || this.sessionState.infraHash;

    return {
      success: true,
      idProcedimento,
      unidadeDestinoId,
      destinoNome: 'CBMDF/DIVIS/SEHUR/SUTEC'
    };
  }
}
