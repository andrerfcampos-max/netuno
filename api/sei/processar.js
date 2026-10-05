import { SeiClient } from '../../src/services/seiService.js';

function serializeSession(client) {
  return Buffer.from(JSON.stringify(client.exportSession())).toString('base64');
}

function restoreSession(sessionToken) {
  if (!sessionToken) {
    throw new Error('Sessão do SEI inválida ou expirada. Reinicie o envio.');
  }
  const client = new SeiClient();
  try {
    const raw = JSON.parse(Buffer.from(sessionToken, 'base64').toString('utf8'));
    client.importSession(raw);
  } catch (err) {
    throw new Error(`Falha ao restaurar sessão do SEI: ${err.message}`);
  }
  return client;
}

/**
 * Endpoint Serverless Vercel / Netuno API: /api/sei/processar
 * Gerencia o ciclo completo de envio, assinatura e tramitação de relatórios ao SEI.
 * Suporta tanto o fluxo em lote clássico quanto a execução granular passo-a-passo
 * com feedback em tempo real de cada etapa e diagnóstico rico de erros.
 */
export default async function handler(req, res) {
  // Configuração CORS para requisições do frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
  }

  try {
    const { action, payload } = req.body || {};

    if (!action) {
      return res.status(400).json({ error: 'Parâmetro "action" é obrigatório.' });
    }

    // ==========================================
    // 1. AÇÃO: Teste de Conexão / Login
    // ==========================================
    if (action === 'test_login' || action === 'step_login') {
      const { usuario, senha } = payload || {};
      if (!usuario || !senha) {
        return res.status(400).json({ 
          success: false, 
          step: 'login', 
          error: 'Usuário (matrícula) e senha são obrigatórios.' 
        });
      }

      const client = new SeiClient();
      try {
        const loginInfo = await client.login(usuario, senha);
        return res.status(200).json({
          success: true,
          step: 'login',
          message: `Login realizado com sucesso no SEI/SIP DF. Unidade: ${client.sessionState.unidadeAtual}`,
          usuario: client.sessionState.usuario,
          unidadeAtual: client.sessionState.unidadeAtual,
          infraHash: client.sessionState.infraHash,
          sessionToken: serializeSession(client),
          loginInfo
        });
      } catch (loginErr) {
        return res.status(401).json({
          success: false,
          step: 'login',
          error: loginErr.message || 'Falha na autenticação do SEI/SIP DF. Verifique matrícula e senha.',
          technicalDetails: {
            action: 'step_login',
            message: loginErr.message,
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // ==========================================
    // 2. ETAPA GRANULAR: Criar Processo
    // ==========================================
    if (action === 'step_criar_processo') {
      const { sessionToken, cidade, raRomano, tipoProcessoId, descricao } = payload || {};
      const client = restoreSession(sessionToken);

      try {
        const procInfo = await client.criarProcesso({
          cidade,
          raRomano,
          tipoProcessoId,
          descricao
        });

        return res.status(200).json({
          success: true,
          step: 'criar_processo',
          message: `Processo administrativo nº ${procInfo.numeroProcesso} criado com sucesso no SEI.`,
          idProcedimento: procInfo.idProcedimento,
          numeroProcesso: procInfo.numeroProcesso,
          descricao: procInfo.descricao,
          sessionToken: serializeSession(client)
        });
      } catch (procErr) {
        console.error('[API SEI] Erro ao criar processo:', procErr.message);
        return res.status(500).json({
          success: false,
          step: 'criar_processo',
          error: procErr.message || 'Falha ao criar processo de fiscalização no SEI.',
          technicalDetails: {
            action: 'step_criar_processo',
            message: procErr.message,
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // ==========================================
    // 3. ETAPA GRANULAR: Anexar Relatório / Documento Externo
    // ==========================================
    if (action === 'step_anexar_documento') {
      const { sessionToken, idProcedimento, htmlContent, pdfBase64, fileName, nomeArvore } = payload || {};
      if (!idProcedimento) {
        return res.status(400).json({ success: false, step: 'anexar_documento', error: 'ID do procedimento é obrigatório para anexo.' });
      }

      const client = restoreSession(sessionToken);

      try {
        const pdfBuffer = pdfBase64 ? Buffer.from(pdfBase64, 'base64') : null;
        const anexoInfo = await client.anexarRelatorio({
          idProcedimento,
          pdfBuffer,
          htmlContent,
          fileName,
          nomeArvore
        });

        return res.status(200).json({
          success: true,
          step: 'anexar_documento',
          message: `Arquivo '${anexoInfo.fileName}' anexado com sucesso (Documento SEI nº ${anexoInfo.numeroSei}).`,
          idDocumentoAnexo: anexoInfo.idDocumentoAnexo,
          numeroSei: anexoInfo.numeroSei,
          fileName: anexoInfo.fileName,
          sessionToken: serializeSession(client)
        });
      } catch (anexoErr) {
        console.error('[API SEI] Erro ao anexar relatório:', anexoErr.message);
        return res.status(500).json({
          success: false,
          step: 'anexar_documento',
          error: anexoErr.message || 'Falha ao anexar relatório técnico no SEI.',
          technicalDetails: {
            action: 'step_anexar_documento',
            message: anexoErr.message,
            fileName,
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // ==========================================
    // 4. ETAPA GRANULAR: Gerar e Preencher Memorando ao GPCIU
    // ==========================================
    if (action === 'step_criar_memorando') {
      const { sessionToken, idProcedimento, cidade, raRomano, corpoMemorandoHtml, docAnexoSei } = payload || {};
      if (!idProcedimento) {
        return res.status(400).json({ success: false, step: 'criar_memorando', error: 'ID do procedimento é obrigatório.' });
      }

      const client = restoreSession(sessionToken);

      try {
        const memoInfo = await client.criarMemorando({
          idProcedimento,
          cidade,
          raRomano,
          corpoMemorandoHtml: corpoMemorandoHtml || '<p>Memorando institucional de solicitação de manutenção de hidrantes.</p>',
          docAnexoSei: docAnexoSei || ''
        });

        return res.status(200).json({
          success: true,
          step: 'criar_memorando',
          message: `Minuta do Memorando ao GPCIU vinculada ao processo com sucesso (ID: ${memoInfo.idDocumentoMemo}).`,
          idDocumentoMemo: memoInfo.idDocumentoMemo,
          descricao: memoInfo.descricao,
          sessionToken: serializeSession(client)
        });
      } catch (memoErr) {
        console.error('[API SEI] Erro ao criar memorando:', memoErr.message);
        return res.status(500).json({
          success: false,
          step: 'criar_memorando',
          error: memoErr.message || 'Falha ao criar minuta do Memorando no SEI.',
          technicalDetails: {
            action: 'step_criar_memorando',
            message: memoErr.message,
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // ==========================================
    // 5. ETAPA GRANULAR: Assinar Memorando
    // ==========================================
    if (action === 'step_assinar') {
      const { sessionToken, idDocumentoMemo, usuario, senhaAssinatura, cargoFuncao } = payload || {};
      if (!idDocumentoMemo || !senhaAssinatura) {
        return res.status(400).json({ success: false, step: 'assinar', error: 'Documento e senha de assinatura são obrigatórios.' });
      }

      const client = restoreSession(sessionToken);

      try {
        const assinaInfo = await client.assinarDocumento({
          idDocumento: idDocumentoMemo,
          usuario: usuario || client.sessionState.usuario,
          senhaAssinatura,
          cargoFuncao
        });

        return res.status(200).json({
          success: true,
          step: 'assinar',
          message: `Documento assinado eletronicamente por ${assinaInfo.assinadoPor}.`,
          idDocumento: assinaInfo.idDocumento,
          assinadoPor: assinaInfo.assinadoPor,
          sessionToken: serializeSession(client)
        });
      } catch (assinarErr) {
        console.error('[API SEI] Erro ao assinar documento:', assinarErr.message);
        return res.status(500).json({
          success: false,
          step: 'assinar',
          error: assinarErr.message || 'Falha na assinatura eletrônica do SEI.',
          technicalDetails: {
            action: 'step_assinar',
            message: assinarErr.message,
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // ==========================================
    // 6. ETAPA GRANULAR: Tramitar Processo para SUTEC
    // ==========================================
    if (action === 'step_tramitar') {
      const { sessionToken, idProcedimento, unidadeDestinoId } = payload || {};
      if (!idProcedimento) {
        return res.status(400).json({ success: false, step: 'tramitar', error: 'ID do procedimento é obrigatório para tramitação.' });
      }

      const client = restoreSession(sessionToken);

      try {
        const tramitacao = await client.tramitarProcesso({
          idProcedimento,
          unidadeDestinoId: unidadeDestinoId || '110037655'
        });

        return res.status(200).json({
          success: true,
          step: 'tramitar',
          message: `Processo tramitado com sucesso para ${tramitacao.destinoNome}.`,
          idProcedimento: tramitacao.idProcedimento,
          unidadeDestino: tramitacao.destinoNome
        });
      } catch (tramitarErr) {
        console.error('[API SEI] Erro ao tramitar processo:', tramitarErr.message);
        return res.status(500).json({
          success: false,
          step: 'tramitar',
          error: tramitarErr.message || 'Falha ao tramitar processo para a SUTEC.',
          technicalDetails: {
            action: 'step_tramitar',
            message: tramitarErr.message,
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // ==========================================
    // AÇÕES EM LOTE (LEGADO / COMPATIBILIDADE)
    // ==========================================
    if (action === 'iniciar_expediente') {
      const { usuario, senha, cidade, raRomano, htmlContent, pdfBase64, fileName, nomeArvore, corpoMemorandoHtml } = payload || {};

      if (!usuario || !senha) {
        return res.status(400).json({ error: 'Credenciais do SEI são obrigatórias.' });
      }

      const client = new SeiClient();

      try {
        await client.login(usuario, senha);
      } catch (loginErr) {
        return res.status(401).json({
          success: false,
          error: loginErr.message || 'Falha na autenticação do SEI/SIP DF. Verifique matrícula e senha.'
        });
      }

      // 1. Criar Processo
      let procInfo;
      try {
        procInfo = await client.criarProcesso({
          cidade,
          raRomano
        });
      } catch (procErr) {
        console.error('[API SEI] Erro ao criar processo:', procErr.message);
        return res.status(500).json({
          success: false,
          error: `[Criação de Processo] ${procErr.message}`
        });
      }

      // 2. Anexar Relatório Oficial se fornecido
      let anexoInfo = null;
      if (htmlContent || pdfBase64) {
        try {
          const pdfBuffer = pdfBase64 ? Buffer.from(pdfBase64, 'base64') : null;
          anexoInfo = await client.anexarRelatorio({
            idProcedimento: procInfo.idProcedimento,
            pdfBuffer,
            htmlContent,
            fileName: fileName || (htmlContent ? `Relatorio_Vistoria_CAESB_${cidade || 'DF'}.html` : `Relatorio_Vistoria_CAESB_${cidade || 'DF'}.pdf`),
            nomeArvore: nomeArvore || `Relatório CAESB - ${cidade || 'DF'}`
          });
        } catch (anexoErr) {
          console.error('[API SEI] Erro ao anexar relatório:', anexoErr.message);
          return res.status(500).json({
            success: false,
            error: `[Anexo de Relatório] ${anexoErr.message}`
          });
        }
      }

      const docRefNumber = anexoInfo?.numeroSei || anexoInfo?.idDocumentoAnexo || '';
      let corpoMemorandoFinal = corpoMemorandoHtml || '';
      if (docRefNumber) {
        corpoMemorandoFinal = corpoMemorandoFinal.replaceAll('[Nº SEI DO RELATÓRIO EXTERNO]', docRefNumber);
      }

      // 3. Criar Memorando com Minuta
      let memoInfo;
      try {
        memoInfo = await client.criarMemorando({
          idProcedimento: procInfo.idProcedimento,
          cidade,
          raRomano,
          corpoMemorandoHtml: corpoMemorandoFinal || '<p>Memorando institucional de solicitação de manutenção de hidrantes.</p>',
          docAnexoSei: docRefNumber
        });
      } catch (memoErr) {
        console.error('[API SEI] Erro ao criar memorando:', memoErr.message);
        return res.status(500).json({
          success: false,
          error: `[Geração de Memorando] ${memoErr.message}`
        });
      }

      return res.status(200).json({
        success: true,
        idProcedimento: procInfo.idProcedimento,
        numeroProcesso: procInfo.numeroProcesso,
        idDocumentoMemo: memoInfo.idDocumentoMemo,
        idDocumentoAnexo: docRefNumber,
        sessionToken: serializeSession(client)
      });
    }

    if (action === 'assinar_e_tramitar') {
      const { sessionToken, idProcedimento, idDocumentoMemo, senhaAssinatura, usuario, unidadeDestinoId } = payload || {};

      if (!sessionToken || !idProcedimento || !idDocumentoMemo || !senhaAssinatura) {
        return res.status(400).json({ error: 'Dados insuficientes para assinatura e tramitação.' });
      }

      const client = restoreSession(sessionToken);

      // 1. Assinar Documento
      try {
        await client.assinarDocumento({
          idDocumento: idDocumentoMemo,
          usuario: usuario || client.sessionState.usuario,
          senhaAssinatura
        });
      } catch (assinarErr) {
        console.error('[API SEI] Erro ao assinar documento:', assinarErr.message);
        return res.status(500).json({
          success: false,
          error: `[Assinatura Eletrônica] ${assinarErr.message}`
        });
      }

      // 2. Tramitar Processo para a SUTEC (110037655)
      let tramitacao;
      try {
        tramitacao = await client.tramitarProcesso({
          idProcedimento,
          unidadeDestinoId: unidadeDestinoId || '110037655'
        });
      } catch (tramitarErr) {
        console.error('[API SEI] Erro ao tramitar processo:', tramitarErr.message);
        return res.status(500).json({
          success: false,
          error: `[Tramitação SUTEC] ${tramitarErr.message}`
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Processo SEI criado, relatório anexado, memorando assinado e tramitado com sucesso para a SUTEC!',
        idProcedimento,
        unidadeDestino: tramitacao.destinoNome
      });
    }

    return res.status(400).json({ error: `Ação desconhecida: ${action}` });

  } catch (error) {
    console.error('[API SEI] Erro geral no processamento:', error?.message || 'Erro interno');
    return res.status(500).json({
      success: false,
      error: error?.message || 'Erro inesperado durante processamento com o SEI DF.'
    });
  }
}
