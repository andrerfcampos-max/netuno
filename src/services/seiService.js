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

  // --- Helper para extrair mensagens de erro e alertas do HTML do SEI ---
  extractSeiErrorMessage(res, defaultMsg = 'Erro na operação do SEI.') {
    if (!res) return defaultMsg;
    const text = typeof res === 'string' ? res : (res.text || '');
    const $ = res.$ || cheerio.load(text);

    // 1. Mensagens de erro em caixas de aviso do InfraPHP
    const barraLoc = $('#divInfraBarraLocalizacao').text().trim();
    if (barraLoc && !barraLoc.includes('Você está aqui') && !barraLoc.includes('Principal')) {
      return barraLoc;
    }

    const infraMsg = $('.infraMensagem, .infraAlerta, #divInfraMensagem, #divMensagens').text().trim();
    if (infraMsg) return infraMsg;

    // 2. Alertas em javascript: alert("...") ou infraAlerta("...")
    const alertMatch = text.match(/(?:alert|infraAlerta)\s*\(\s*['"]([^'"]+)['"]\s*\)/i);
    if (alertMatch && alertMatch[1]) {
      return alertMatch[1].replace(/\\n/g, ' ').replace(/\\'/g, "'").trim();
    }

    // 3. Spans ou divs de erro comuns
    const lblErro = $('#lblErro, .mensagemErro, .alert-danger').text().trim();
    if (lblErro) return lblErro;

    // 4. Verificação de sessão
    if (text.includes('Sessão expirada') || text.includes('sessao_finalizada') || text.includes('Sesso expirada')) {
      return 'Sessão expirada no SEI. Autentique-se novamente.';
    }

    if (text.includes('Usuário não autenticado') || text.includes('Acesso negado')) {
      return 'Acesso não autorizado ou sessão expirada no SEI DF.';
    }

    return defaultMsg;
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
    const maxRedirects = 10;

    while (redirectCount < maxRedirects) {
      const res = await fetch(currentUrl, fetchOptions);
      
      // Armazena cookies recebidos
      const setCookies = res.headers.getSetCookie 
        ? res.headers.getSetCookie() 
        : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
      this.parseSetCookie(setCookies);

      // Trata redirecionamentos HTTP (301, 302, 303, 307)
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

      // Trata redirecionamentos do lado cliente (Meta refresh ou JS location.href) caso retornem status 200
      const metaRefresh = text.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["']\d+;\s*url=([^"']+)["']/i);
      const jsRedirect = text.match(/(?:window\.)?location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/i);
      const clientRedirectUrl = metaRefresh ? metaRefresh[1] : (jsRedirect ? jsRedirect[1] : null);

      if (clientRedirectUrl && !text.includes('<form') && !text.includes('pwdSenha') && redirectCount < maxRedirects) {
        try {
          const nextUrl = new URL(clientRedirectUrl, currentUrl).toString();
          currentUrl = nextUrl;
          fetchOptions.method = 'GET';
          delete fetchOptions.body;
          delete fetchOptions.headers['Content-Type'];
          fetchOptions.headers['Cookie'] = this.getCookieHeader();
          redirectCount++;
          continue;
        } catch (_) {
          // Ignora URLs malformadas de JS
        }
      }

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
      hdnAcao: '2',
      hdnInfraPrefixoCookie: 'Sistema_Eletrônico_de_Informações'
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
    if (postRes.text.includes('Usuário ou senha inválidos') || postRes.text.includes('pwdSenha') || postRes.text.includes('Senha inválida')) {
      const errorMsg = this.extractSeiErrorMessage(postRes) || 'Usuário ou senha incorretos no SEI';
      throw new Error(errorMsg.trim() || 'Falha de autenticação no SEI (SIP DF). Verifique matrícula e senha.');
    }

    // Passo 3: Acessa a tela principal do SEI para inicializar a sessão do SEI e obter infra_hash e unidade ativa
    const seiMainUrl = `${this.seiUrl}/sei/controlador.php?acao=procedimento_controlar&infra_sistema=${this.sessionState.infraSistema}`;
    const seiMainRes = await this.request(seiMainUrl);

    // Atualiza infraHash
    const hash = this.extractInfraHash(seiMainRes.url) 
      || this.extractInfraHash(seiMainRes.text) 
      || this.extractInfraHash(postRes.url) 
      || this.extractInfraHash(postRes.text);
    if (hash) {
      this.sessionState.infraHash = hash;
    }

    // Identifica unidade ativa
    const unidadeMatch = seiMainRes.text.match(/infra_unidade_atual=(\d+)/i) 
      || seiMainRes.url.match(/infra_unidade_atual=(\d+)/i)
      || postRes.text.match(/infra_unidade_atual=(\d+)/i);
    if (unidadeMatch) {
      this.sessionState.unidadeAtual = unidadeMatch[1];
    }

    // Se o usuário não estiver na SUOMA (110037654), tenta alternar para SUOMA se disponível na lista de unidades
    const suomaId = '110037654';
    if (this.sessionState.unidadeAtual !== suomaId && seiMainRes.text.includes(suomaId)) {
      try {
        const switchUrl = `${this.seiUrl}/sei/controlador.php?acao=infra_unidade_selecionar&id_infra_unidade=${suomaId}&infra_sistema=${this.sessionState.infraSistema}&infra_hash=${this.sessionState.infraHash}`;
        const switchRes = await this.request(switchUrl);
        const switchHash = this.extractInfraHash(switchRes.url) || this.extractInfraHash(switchRes.text);
        if (switchHash) {
          this.sessionState.infraHash = switchHash;
        }
        this.sessionState.unidadeAtual = suomaId;
      } catch (switchErr) {
        console.warn('[SeiService] Aviso ao alternar para unidade SUOMA:', switchErr.message);
      }
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
    const nomeCidade = (cidade || '').trim() || 'Distrito Federal';
    const sufixoRa = raRomano ? `(RA ${raRomano})` : '';
    const desc = descricao || `Vistoria em Hidrantes Urbanos - ${nomeCidade}${sufixoRa ? ` ${sufixoRa}` : ''} - ${new Date().getFullYear()}`;
    const urlGerar = `${this.seiUrl}/sei/controlador.php?acao=procedimento_gerar&acao_origem=procedimento_escolher_tipo&id_tipo_procedimento=${tipoProcessoId}&infra_sistema=${this.sessionState.infraSistema}&infra_unidade_atual=${this.sessionState.unidadeAtual}&infra_hash=${this.sessionState.infraHash}`;

    // Acessa formulário de geração
    const formPage = await this.request(urlGerar);

    // Verifica se houve erro na abertura do formulário
    const erroForm = this.extractSeiErrorMessage(formPage);
    if (erroForm && erroForm !== 'Erro na operação do SEI.') {
      if (erroForm.toLowerCase().includes('permissão') || erroForm.toLowerCase().includes('sessão') || erroForm.toLowerCase().includes('inválid')) {
        throw new Error(`SEI DF: ${erroForm}`);
      }
    }

    const hashForm = this.extractInfraHash(formPage.url) || this.extractInfraHash(formPage.text) || this.sessionState.infraHash;
    this.sessionState.infraHash = hashForm;

    const dataHoje = new Date().toLocaleDateString('pt-BR');
    
    // Extrai o formulário gerado pelo SEI para preservar tokens de segurança e campos ocultos
    const form = formPage.$('form#frmProcedimentoGerar').length ? formPage.$('form#frmProcedimentoGerar') : formPage.$('form');
    const formAction = form.attr('action');

    const postData = new URLSearchParams();

    // Copia campos e parâmetros gerados pelo SEI na página
    if (form.length > 0) {
      form.find('input, textarea, select').each((_, el) => {
        const name = formPage.$(el).attr('name');
        const val = formPage.$(el).attr('value') ?? formPage.$(el).val() ?? '';
        if (name) {
          postData.set(name, val);
        }
      });
    }

    // Sobrescreve com os parâmetros do processo Netuno
    postData.set('hdnInfraTipoPagina', '1');
    postData.set('rdoProtocolo', 'A');
    postData.set('selTipoProcedimento', tipoProcessoId);
    postData.set('hdnIdTipoProcedimento', tipoProcessoId);
    postData.set('txtDescricao', desc);
    postData.set('rdoNivelAcesso', '0'); // Público
    postData.set('hdnFlagProcedimentoCadastro', '2');
    postData.set('hdnDtaGeracao', dataHoje);

    if (!postData.get('hdnAssuntos') || postData.get('hdnAssuntos').trim() === '') {
      postData.set('hdnAssuntos', '339±081.00 - CBMDF - CORPO DE BOMBEIROS MILITAR DO DISTRITO FEDERAL');
    }

    if (!postData.get('hdnInteressadosProcedimento') && !postData.get('txtInteressadoProcedimento')) {
      postData.set('txtInteressadoProcedimento', 'CORPO DE BOMBEIROS MILITAR DO DISTRITO FEDERAL');
    }

    const submitUrl = formAction 
      ? new URL(formAction, urlGerar).toString()
      : `${this.seiUrl}/sei/controlador.php?acao=procedimento_gerar&acao_origem=procedimento_gerar&infra_sistema=${this.sessionState.infraSistema}&infra_unidade_atual=${this.sessionState.unidadeAtual}&infra_hash=${this.sessionState.infraHash}`;

    const submitRes = await this.request(submitUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': urlGerar
      },
      body: postData.toString()
    });

    // Extrai o id_procedimento gerado
    const procMatch = submitRes.text.match(/id_procedimento=(\d+)/i) || submitRes.url.match(/id_procedimento=(\d+)/i);
    const procNumeroMatch = submitRes.text.match(/(\d{5}-\d{8}\/\d{4}-\d{2})/); // Formato de processo GDF

    const idProcedimento = procMatch ? procMatch[1] : null;
    const numeroProcesso = procNumeroMatch ? procNumeroMatch[1] : 'Processo Gerado';

    if (!idProcedimento) {
      const seiError = this.extractSeiErrorMessage(submitRes);
      console.error('[SeiService] Falha ao criar processo. Resposta SEI URL:', submitRes.url, 'Detalhes:', seiError);
      throw new Error(seiError || 'Não foi possível identificar o ID do processo recém-criado no SEI.');
    }

    this.sessionState.infraHash = this.extractInfraHash(submitRes.url) || this.sessionState.infraHash;

    return {
      idProcedimento,
      numeroProcesso,
      descricao: desc
    };
  }

  // --- 3. Upload e Anexo do Relatório Oficial CAESB (HTML / PDF) ---
  async anexarRelatorio({ idProcedimento, pdfBuffer, htmlContent, fileName = 'Relatorio_Vistoria_CAESB.html', nomeArvore = 'Relatório CAESB' }) {
    const hash = this.sessionState.infraHash;
    const unidade = this.sessionState.unidadeAtual;
    const sistema = this.sessionState.infraSistema;
    const dataHoje = new Date().toLocaleDateString('pt-BR');

    // 1. Acessa tela de documento externo (serie 2056 = Relatório)
    const urlDoc = `${this.seiUrl}/sei/controlador.php?acao=documento_receber&acao_origem=documento_escolher_tipo&id_procedimento=${idProcedimento}&id_serie=2056&infra_sistema=${sistema}&infra_unidade_atual=${unidade}&infra_hash=${hash}`;
    const formDoc = await this.request(urlDoc);
    const currentHash = this.extractInfraHash(formDoc.url) || hash;
    this.sessionState.infraHash = currentHash;

    // 2. Upload do binário ou documento via multipart FormData
    const uploadIdentifier = Math.floor(Math.random() * 900000 + 100000).toString();
    const formData = new FormData();
    formData.append('UPLOAD_IDENTIFIER', uploadIdentifier);
    
    let blob;
    let finalFileName = fileName;
    if (htmlContent) {
      blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      if (!finalFileName.endsWith('.html') && !finalFileName.endsWith('.htm')) {
        finalFileName = `${finalFileName.replace(/\.[^/.]+$/, '')}.html`;
      }
    } else if (pdfBuffer) {
      blob = new Blob([pdfBuffer], { type: 'application/pdf' });
      if (!finalFileName.endsWith('.pdf')) {
        finalFileName = `${finalFileName}.pdf`;
      }
    } else {
      blob = new Blob([''], { type: 'text/plain' });
    }
    formData.append('filArquivo', blob, finalFileName);

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
    const anexoToken = anexoTokenMatch ? anexoTokenMatch[1] : `${uploadIdentifier}±${finalFileName}`;

    // 3. Salva os metadados do documento externo anexado
    const form = formDoc.$('form#frmDocumentoReceber').length ? formDoc.$('form#frmDocumentoReceber') : formDoc.$('form');
    const formAction = form.attr('action');

    const postParams = new URLSearchParams();
    if (form.length > 0) {
      form.find('input, textarea, select').each((_, el) => {
        const name = formDoc.$(el).attr('name');
        const val = formDoc.$(el).attr('value') ?? formDoc.$(el).val() ?? '';
        if (name) {
          postParams.set(name, val);
        }
      });
    }

    // Configurações do anexo externo
    postParams.set('hdnInfraTipoPagina', '2');
    postParams.set('selSerie', '2056');
    postParams.set('hdnIdSerie', '2056');
    postParams.set('txtDataElaboracao', dataHoje);
    postParams.set('txtNomeArvore', nomeArvore);
    postParams.set('rdoFormato', 'N'); // Nato-digital
    postParams.set('rdoNivelAcesso', '0'); // Público
    postParams.set('hdnFlagDocumentoCadastro', '2');
    postParams.set('hdnIdUnidadeGeradoraProtocolo', unidade);
    postParams.set('hdnStaDocumento', 'X');
    postParams.set('hdnIdProcedimento', idProcedimento);
    postParams.set('hdnAnexos', anexoToken);
    postParams.set('hdnIdTipoProcedimento', '100000446');

    const saveDocUrl = formAction
      ? new URL(formAction, urlDoc).toString()
      : `${this.seiUrl}/sei/controlador.php?acao=documento_receber&acao_origem=documento_receber&infra_sistema=${sistema}&infra_unidade_atual=${unidade}&infra_hash=${this.sessionState.infraHash}`;

    const salvarDocRes = await this.request(saveDocUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': urlDoc
      },
      body: postParams.toString()
    });

    const docIdMatch = salvarDocRes.text.match(/id_documento=(\d+)/i) || salvarDocRes.url.match(/id_documento=(\d+)/i);
    const idDocumentoAnexo = docIdMatch ? docIdMatch[1] : null;

    if (!idDocumentoAnexo) {
      const seiError = this.extractSeiErrorMessage(salvarDocRes);
      console.error('[SeiService] Falha ao anexar documento externo no SEI:', seiError);
      throw new Error(`Falha ao anexar relatório no SEI: ${seiError}`);
    }

    // Extrai o Número SEI formatado ou protocolo do documento externo gerado
    const protocoloMatch = salvarDocRes.text.match(/protocolo_formatado=([^&"']+)/i)
      || salvarDocRes.text.match(/hdnProtocoloFormatado['"]?\s*value=['"]([^'"]+)['"]/i)
      || salvarDocRes.text.match(/id="txtNumeroDocumento"[^>]*value="([^"]+)"/i)
      || salvarDocRes.text.match(/id="txtProtocolo"[^>]*value="([^"]+)"/i)
      || salvarDocRes.text.match(/Relat[oó]rio[^\d]*(\d{7,10})/i)
      || salvarDocRes.text.match(/(\d{7,10})/);
    const numeroSei = protocoloMatch ? (protocoloMatch[1] || protocoloMatch[0]) : idDocumentoAnexo;

    this.sessionState.infraHash = this.extractInfraHash(salvarDocRes.url) || this.sessionState.infraHash;

    return {
      success: true,
      idDocumentoAnexo,
      numeroSei: numeroSei || idDocumentoAnexo,
      fileName: finalFileName
    };
  }

  // Compatibilidade com chamadas legadas
  async anexarRelatorioPdf(params) {
    return this.anexarRelatorio(params);
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

    const form = formMemo.$('form#frmDocumentoGerar').length ? formMemo.$('form#frmDocumentoGerar') : formMemo.$('form');
    const formAction = form.attr('action');

    const postParams = new URLSearchParams();
    if (form.length > 0) {
      form.find('input, textarea, select').each((_, el) => {
        const name = formMemo.$(el).attr('name');
        const val = formMemo.$(el).attr('value') ?? formMemo.$(el).val() ?? '';
        if (name) {
          postParams.set(name, val);
        }
      });
    }

    // Configurações do Memorando
    postParams.set('hdnInfraTipoPagina', '2');
    postParams.set('txtDataElaboracao', dataHoje);
    postParams.set('txtDescricao', desc);
    postParams.set('rdoNivelAcesso', '0');
    postParams.set('hdnFlagDocumentoCadastro', '2');
    postParams.set('hdnIdSerie', '165');
    postParams.set('hdnIdUnidadeGeradoraProtocolo', unidade);
    postParams.set('hdnStaDocumento', 'I');
    postParams.set('hdnIdProcedimento', idProcedimento);
    postParams.set('hdnIdTipoProcedimento', '100000446');

    const submitMemoUrl = formAction
      ? new URL(formAction, urlGerarMemo).toString()
      : `${this.seiUrl}/sei/controlador.php?acao=documento_gerar&acao_origem=documento_gerar&infra_sistema=${sistema}&infra_unidade_atual=${unidade}&infra_hash=${this.sessionState.infraHash}`;

    const submitMemoRes = await this.request(submitMemoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': urlGerarMemo
      },
      body: postParams.toString()
    });

    const docIdMatch = submitMemoRes.text.match(/id_documento=(\d+)/i) || submitMemoRes.url.match(/id_documento=(\d+)/i);
    const idDocumentoMemo = docIdMatch ? docIdMatch[1] : null;

    if (!idDocumentoMemo) {
      const seiError = this.extractSeiErrorMessage(submitMemoRes);
      console.error('[SeiService] Falha ao gerar documento de memorando no SEI:', seiError);
      throw new Error(`Falha ao gerar Memorando no SEI: ${seiError}`);
    }

    this.sessionState.infraHash = this.extractInfraHash(submitMemoRes.url) || this.sessionState.infraHash;

    // 2. Salva o conteúdo textual na minuta do editor do SEI
    const editorUrl = `${this.seiUrl}/sei/controlador.php?acao=editor_montar&id_procedimento=${idProcedimento}&id_documento=${idDocumentoMemo}&infra_sistema=${sistema}&infra_unidade_atual=${unidade}&infra_hash=${this.sessionState.infraHash}`;
    const editorPage = await this.request(editorUrl);
    this.sessionState.infraHash = this.extractInfraHash(editorPage.url) || this.sessionState.infraHash;

    // Se docAnexoSei foi informado, substitui o placeholder no texto caso ainda esteja presente
    let htmlSalvar = corpoMemorandoHtml || '';
    if (docAnexoSei) {
      htmlSalvar = htmlSalvar.replaceAll('[Nº SEI DO RELATÓRIO EXTERNO]', docAnexoSei);
    }

    const editorForm = editorPage.$('form#frmEditor').length ? editorPage.$('form#frmEditor') : editorPage.$('form');
    const editorFormAction = editorForm.attr('action');
    const salvarTextoParams = new URLSearchParams();

    // Copia todos os parâmetros e tokens do formulário gerado pelo SEI
    editorForm.find('input, textarea, select').each((_, el) => {
      const name = editorPage.$(el).attr('name');
      const val = editorPage.$(el).attr('value') ?? editorPage.$(el).val() ?? '';
      if (name) {
        salvarTextoParams.set(name, val);
      }
    });

    // Sobrescreve com o conteúdo definitivo do documento
    salvarTextoParams.set('txaConteudo', htmlSalvar);
    salvarTextoParams.set('id_documento', idDocumentoMemo);
    salvarTextoParams.set('hdnIdDocumento', idDocumentoMemo);
    salvarTextoParams.set('id_procedimento', idProcedimento);
    salvarTextoParams.set('hdnIdProcedimento', idProcedimento);
    salvarTextoParams.set('hdnInfraTipoPagina', '2');

    const saveUrl = editorFormAction
      ? new URL(editorFormAction, editorUrl).toString()
      : `${this.seiUrl}/sei/controlador.php?acao=editor_salvar&infra_sistema=${sistema}&infra_unidade_atual=${unidade}&infra_hash=${this.sessionState.infraHash}`;

    const saveRes = await this.request(
      saveUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': editorUrl
        },
        body: salvarTextoParams.toString()
      }
    );

    this.sessionState.infraHash = this.extractInfraHash(saveRes.url) || this.sessionState.infraHash;

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

    const erroAssinar = this.extractSeiErrorMessage(assinarRes);
    if (erroAssinar && erroAssinar !== 'Erro na operação do SEI.') {
      if (erroAssinar.toLowerCase().includes('inválid') || erroAssinar.toLowerCase().includes('erro') || erroAssinar.toLowerCase().includes('sessão')) {
        throw new Error(`Falha na assinatura eletrônica do SEI: ${erroAssinar}`);
      }
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
    const form = formEnviar.$('form#frmProcedimentoEnviar').length ? formEnviar.$('form#frmProcedimentoEnviar') : formEnviar.$('form');
    const formAction = form.attr('action');

    const postParams = new URLSearchParams();
    if (form.length > 0) {
      form.find('input, textarea, select').each((_, el) => {
        const name = formEnviar.$(el).attr('name');
        const val = formEnviar.$(el).attr('value') ?? formEnviar.$(el).val() ?? '';
        if (name) {
          postParams.set(name, val);
        }
      });
    }

    postParams.set('hdnInfraTipoPagina', '2');
    postParams.set('sbmEnviar', 'Enviar');
    postParams.set('selUnidades', unidadeDestinoId);
    postParams.set('chkSinManterAberto', 'on'); // Mantém o processo aberto na unidade geradora
    postParams.set('hdnIdProtocolos', idProcedimento);
    postParams.set('hdnUnidades', `${unidadeDestinoId}±CBMDF/DIVIS/SEHUR/SUTEC - Subseção Técnica de Hidrantes`);

    const submitUrl = formAction
      ? new URL(formAction, urlEnviar).toString()
      : `${this.seiUrl}/sei/controlador.php?acao=procedimento_enviar&acao_origem=procedimento_enviar&infra_sistema=${sistema}&infra_unidade_atual=${unidade}&infra_hash=${this.sessionState.infraHash}`;

    const submitEnviar = await this.request(submitUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': urlEnviar
      },
      body: postParams.toString()
    });

    const erroTramitar = this.extractSeiErrorMessage(submitEnviar);
    if (erroTramitar && erroTramitar !== 'Erro na operação do SEI.') {
      if (erroTramitar.toLowerCase().includes('erro') || erroTramitar.toLowerCase().includes('permissão') || erroTramitar.toLowerCase().includes('inválid')) {
        throw new Error(`Falha na tramitação para SUTEC: ${erroTramitar}`);
      }
    }

    this.sessionState.infraHash = this.extractInfraHash(submitEnviar.url) || this.sessionState.infraHash;

    return {
      success: true,
      idProcedimento,
      unidadeDestinoId,
      destinoNome: 'CBMDF/DIVIS/SEHUR/SUTEC'
    };
  }
}
