import { SeiClient } from '../../src/services/seiService.js';

/**
 * Endpoint Serverless Vercel / Netuno API: /api/sei/processar
 * Gerencia o ciclo completo de envio, assinatura e tramitação de relatórios ao SEI.
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

    // 1. AÇÃO: Teste de Conexão / Login
    if (action === 'test_login') {
      const { usuario, senha } = payload || {};
      if (!usuario || !senha) {
        return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
      }

      const client = new SeiClient();
      const loginInfo = await client.login(usuario, senha);
      
      return res.status(200).json({
        success: true,
        message: 'Login efetuado com sucesso no SEI/SIP DF.',
        loginInfo
      });
    }

    // 2. AÇÃO: Criar Processo, Anexar Relatório e Gerar Minuta de Memorando
    if (action === 'iniciar_expediente') {
      const { usuario, senha, cidade, raRomano, htmlContent, pdfBase64, fileName, nomeArvore, corpoMemorandoHtml } = payload || {};

      if (!usuario || !senha) {
        return res.status(400).json({ error: 'Credenciais do SEI são obrigatórias.' });
      }

      const client = new SeiClient();
      await client.login(usuario, senha);

      // 1. Criar Processo
      const procInfo = await client.criarProcesso({
        cidade,
        raRomano
      });

      // 2. Anexar Relatório Oficial se fornecido
      let anexoInfo = null;
      if (htmlContent || pdfBase64) {
        const pdfBuffer = pdfBase64 ? Buffer.from(pdfBase64, 'base64') : null;
        anexoInfo = await client.anexarRelatorio({
          idProcedimento: procInfo.idProcedimento,
          pdfBuffer,
          htmlContent,
          fileName: fileName || (htmlContent ? `Relatorio_Vistoria_CAESB_${cidade || 'DF'}.html` : `Relatorio_Vistoria_CAESB_${cidade || 'DF'}.pdf`),
          nomeArvore: nomeArvore || `Relatório CAESB - ${cidade || 'DF'}`
        });
      }

      // Substitui o placeholder no texto do memorando com o número SEI do documento externo criado
      const docRefNumber = anexoInfo?.numeroSei || anexoInfo?.idDocumentoAnexo || '';
      let corpoMemorandoFinal = corpoMemorandoHtml || '';
      if (docRefNumber) {
        corpoMemorandoFinal = corpoMemorandoFinal.replaceAll('[Nº SEI DO RELATÓRIO EXTERNO]', docRefNumber);
      }

      // 3. Criar Memorando com Minuta
      const memoInfo = await client.criarMemorando({
        idProcedimento: procInfo.idProcedimento,
        cidade,
        raRomano,
        corpoMemorandoHtml: corpoMemorandoFinal || '<p>Memorando institucional de solicitação de manutenção de hidrantes.</p>',
        docAnexoSei: docRefNumber
      });

      // Serializa os cookies e o sessionState para permitir continuação na assinatura
      const sessionStateSerialized = Buffer.from(JSON.stringify({
        cookies: Array.from(client.cookies.entries()),
        sessionState: client.sessionState
      })).toString('base64');

      return res.status(200).json({
        success: true,
        idProcedimento: procInfo.idProcedimento,
        numeroProcesso: procInfo.numeroProcesso,
        idDocumentoMemo: memoInfo.idDocumentoMemo,
        idDocumentoAnexo: docRefNumber,
        sessionToken: sessionStateSerialized
      });
    }

    // 3. AÇÃO: Assinar Memorando e Tramitar para SUTEC
    if (action === 'assinar_e_tramitar') {
      const { sessionToken, idProcedimento, idDocumentoMemo, senhaAssinatura, usuario, unidadeDestinoId } = payload || {};

      if (!sessionToken || !idProcedimento || !idDocumentoMemo || !senhaAssinatura) {
        return res.status(400).json({ error: 'Dados insuficientes para assinatura e tramitação.' });
      }

      const client = new SeiClient();
      try {
        const restored = JSON.parse(Buffer.from(sessionToken, 'base64').toString('utf8'));
        client.cookies = new Map(restored.cookies);
        client.sessionState = restored.sessionState;
      } catch (err) {
        return res.status(400).json({ error: 'Sessão do SEI inválida ou expirada. Reinicie o envio.' });
      }

      // 1. Assinar Documento
      await client.assinarDocumento({
        idDocumento: idDocumentoMemo,
        usuario: usuario || client.sessionState.usuario,
        senhaAssinatura
      });

      // 2. Tramitar Processo para a SUTEC (110037655)
      const tramitacao = await client.tramitarProcesso({
        idProcedimento,
        unidadeDestinoId: unidadeDestinoId || '110037655'
      });

      return res.status(200).json({
        success: true,
        message: 'Processo SEI criado, relatório anexado, memorando assinado e tramitado com sucesso para a SUTEC!',
        idProcedimento,
        unidadeDestino: tramitacao.destinoNome
      });
    }

    return res.status(400).json({ error: `Ação desconhecida: ${action}` });

  } catch (error) {
    // Protocolo de Segurança Estrita: Jamais logar payloads contendo credenciais/senhas
    console.error('[API SEI] Erro no processamento:', error?.message || 'Erro interno');
    return res.status(500).json({
      success: false,
      error: error?.message || 'Erro inesperado durante processamento com o SEI DF.'
    });
  }
}
