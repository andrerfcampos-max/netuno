import React, { useState, useEffect } from 'react';
import { 
  X, Send, Lock, FileText, CheckCircle2, AlertCircle, Loader2, 
  ArrowRight, ExternalLink, ShieldCheck, Key, RefreshCw, Terminal, Eye
} from 'lucide-react';
import { toast } from 'react-toastify';
import { SeiAutomationProgressModal } from './SeiAutomationProgressModal';

const INITIAL_STEPS = [
  {
    id: 'login',
    title: 'Acesso e Autenticação no SEI/SIP DF',
    description: 'Validação de credenciais e conexão segura com o servidor do GDF (SUOMA).',
    status: 'pending',
    statusText: '',
    dynamicDescription: '',
    resultInfo: null
  },
  {
    id: 'criar_processo',
    title: 'Criação do Processo Administrativo',
    description: 'Autuação do processo de Fiscalização de Hidrantes Urbanos no SEI.',
    status: 'pending',
    statusText: '',
    dynamicDescription: '',
    resultInfo: null
  },
  {
    id: 'anexar_documento',
    title: 'Upload e Anexo do Relatório Oficial CAESB',
    description: 'Inserção do laudo técnico (documento nato-digital) no processo.',
    status: 'pending',
    statusText: '',
    dynamicDescription: '',
    resultInfo: null
  },
  {
    id: 'criar_memorando',
    title: 'Geração da Minuta do Memorando ao GPCIU',
    description: 'Criação do documento interno no SEI e preenchimento com a minuta de despacho.',
    status: 'pending',
    statusText: '',
    dynamicDescription: '',
    resultInfo: null
  },
  {
    id: 'assinar',
    title: 'Assinatura Eletrônica Institucional',
    description: 'Assinatura digital do Memorando com a matrícula do militar vistoriador.',
    status: 'pending',
    statusText: '',
    dynamicDescription: '',
    resultInfo: null
  },
  {
    id: 'tramitar',
    title: 'Tramitação Oficial para a SUTEC',
    description: 'Remessa do processo para CBMDF/DIVIS/SEHUR/SUTEC mantendo cópia aberta na SUOMA.',
    status: 'pending',
    statusText: '',
    dynamicDescription: '',
    resultInfo: null
  }
];

export const SeiIntegrationModal = ({
  isOpen,
  onClose,
  cidade,
  raRomano,
  currentUser,
  memorandoMinuta,
  getReportFile,
  getReportPdfBase64
}) => {
  const [usuario, setUsuario] = useState(() => localStorage.getItem('netuno_sei_usuario') || currentUser?.matricula || '');
  const [senha, setSenha] = useState('');
  const [senhaAssinatura, setSenhaAssinatura] = useState('');
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [testingLogin, setTestingLogin] = useState(false);

  // Estados do Gerenciador de Etapas
  const [stepsState, setStepsState] = useState(() => JSON.parse(JSON.stringify(INITIAL_STEPS)));
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [logs, setLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorDetails, setErrorDetails] = useState(null);

  // Dados acumulados da execução
  const [processoResult, setProcessoResult] = useState({
    numeroProcesso: '',
    idProcedimento: '',
    idDocumentoMemo: '',
    idDocumentoAnexo: '',
    numeroSeiDoc: '',
    sessionToken: '',
    fileName: ''
  });

  // Guardamos as senhas em refs para permitir fluxo sem re-render que exponha valores
  const savedCredentials = React.useRef({ usuario: '', senha: '', senhaAssinatura: '' });

  if (!isOpen) return null;

  const addLog = (type, message) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
    setLogs(prev => [...prev, { time: timeStr, type, message }]);
  };

  const updateStepStatus = (index, status, statusText = '', dynamicDescription = '', resultInfo = null) => {
    setStepsState(prev => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = {
          ...copy[index],
          status,
          statusText: statusText || copy[index].statusText,
          dynamicDescription: dynamicDescription !== undefined ? dynamicDescription : copy[index].dynamicDescription,
          resultInfo: resultInfo ? { ...(copy[index].resultInfo || {}), ...resultInfo } : copy[index].resultInfo
        };
      }
      return copy;
    });
  };

  const formatMinutaToSeiHtml = (text) => {
    if (!text) return '<p></p>';
    const lines = text.split('\n');
    let html = '';
    let currentP = [];
    for (const line of lines) {
      if (!line.trim()) {
        if (currentP.length > 0) {
          html += `<p style="font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; margin-bottom: 12pt; text-align: justify;">${currentP.join('<br/>')}</p>\n`;
          currentP = [];
        }
      } else {
        currentP.push(line.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
      }
    }
    if (currentP.length > 0) {
      html += `<p style="font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; margin-bottom: 12pt; text-align: justify;">${currentP.join('<br/>')}</p>\n`;
    }
    return html;
  };

  // Teste Rápido de Conexão com o SEI
  const handleTestConnection = async (e) => {
    e?.preventDefault();
    if (!usuario.trim() || !senha) {
      toast.warn('Informe a matrícula e a senha para testar.');
      return;
    }

    try {
      setTestingLogin(true);
      const res = await fetch('/api/sei/processar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'step_login',
          payload: { usuario: usuario.trim(), senha }
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha na autenticação do SEI.');
      }
      toast.success(`Conexão OK! Unidade ativa no SEI: ${data.unidadeAtual}`);
    } catch (err) {
      toast.error(`Falha no teste: ${err.message}`);
    } finally {
      setTestingLogin(false);
    }
  };

  // Início da Orquestração Passo a Passo
  const handleStartAutomation = async (e) => {
    e?.preventDefault();
    if (!usuario.trim() || !senha) {
      toast.warn('Informe a matrícula e a senha de acesso ao SEI.');
      return;
    }

    localStorage.setItem('netuno_sei_usuario', usuario.trim());

    // Armazena credenciais
    savedCredentials.current = {
      usuario: usuario.trim(),
      senha,
      senhaAssinatura: senhaAssinatura.trim()
    };

    // Limpa campos na UI do formulário de entrada por segurança
    setSenha('');
    if (senhaAssinatura) setSenhaAssinatura('');

    // Prepara Pop-up de Progresso
    setStepsState(JSON.parse(JSON.stringify(INITIAL_STEPS)));
    setLogs([]);
    setHasError(false);
    setErrorDetails(null);
    setCurrentStepIndex(0);
    setProcessoResult({
      numeroProcesso: '',
      idProcedimento: '',
      idDocumentoMemo: '',
      idDocumentoAnexo: '',
      numeroSeiDoc: '',
      sessionToken: '',
      fileName: ''
    });

    setShowProgressModal(true);
    executeFromStep(0, {
      usuario: savedCredentials.current.usuario,
      senha: savedCredentials.current.senha,
      sessionToken: '',
      numeroProcesso: '',
      idProcedimento: '',
      idDocumentoMemo: '',
      idDocumentoAnexo: '',
      numeroSeiDoc: '',
      fileName: ''
    });
  };

  // Motor Principal de Execução Sequencial
  const executeFromStep = async (startStepIdx, currentContext) => {
    setIsRunning(true);
    setHasError(false);
    setErrorDetails(null);

    let ctx = { ...currentContext };

    try {
      // ----------------------------------------------------
      // ETAPA 1: Autenticação & Acesso ao SEI/SIP GDF
      // ----------------------------------------------------
      if (startStepIdx <= 0) {
        setCurrentStepIndex(0);
        updateStepStatus(0, 'running', 'Autenticando...', 'Conectando aos servidores do SEI e SIP DF...');
        addLog('info', `Iniciando autenticação no SIP DF com o militar ${ctx.usuario}...`);

        const resLogin = await fetch('/api/sei/processar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'step_login',
            payload: { usuario: ctx.usuario, senha: savedCredentials.current.senha }
          })
        });

        const dataLogin = await resLogin.json();
        if (!resLogin.ok || !dataLogin.success) {
          throw {
            stepIndex: 0,
            stepTitle: 'Acesso e Autenticação no SEI/SIP DF',
            action: 'step_login',
            message: dataLogin.error || 'Falha de login no SEI/SIP DF.',
            technicalDetails: dataLogin.technicalDetails || null
          };
        }

        ctx.sessionToken = dataLogin.sessionToken;
        updateStepStatus(0, 'success', 'Conectado', `Autenticado com sucesso na unidade ${dataLogin.unidadeAtual} (SUOMA).`, {
          detalhes: `Militar: ${dataLogin.usuario} • Unidade: ${dataLogin.unidadeAtual}`
        });
        addLog('success', `Autenticado com sucesso no SEI DF! Unidade ativa: ${dataLogin.unidadeAtual}`);
      }

      // ----------------------------------------------------
      // ETAPA 2: Criação do Processo no SEI
      // ----------------------------------------------------
      if (startStepIdx <= 1) {
        setCurrentStepIndex(1);
        updateStepStatus(1, 'running', 'Criando Processo...', 'Autuando processo de Fiscalização de Hidrantes...');
        addLog('info', `Criando novo processo administrativo para ${cidade || 'DF'} (${raRomano ? `RA ${raRomano}` : ''})...`);

        const resProc = await fetch('/api/sei/processar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'step_criar_processo',
            payload: {
              sessionToken: ctx.sessionToken,
              cidade: cidade || 'Distrito Federal',
              raRomano
            }
          })
        });

        const dataProc = await resProc.json();
        if (!resProc.ok || !dataProc.success) {
          throw {
            stepIndex: 1,
            stepTitle: 'Criação do Processo Administrativo',
            action: 'step_criar_processo',
            message: dataProc.error || 'Falha ao autuar processo no SEI.',
            technicalDetails: dataProc.technicalDetails || null
          };
        }

        ctx.sessionToken = dataProc.sessionToken;
        ctx.idProcedimento = dataProc.idProcedimento;
        ctx.numeroProcesso = dataProc.numeroProcesso;

        setProcessoResult(prev => ({
          ...prev,
          idProcedimento: dataProc.idProcedimento,
          numeroProcesso: dataProc.numeroProcesso,
          sessionToken: dataProc.sessionToken
        }));

        updateStepStatus(1, 'success', 'Processo Autuado', `Processo ${dataProc.numeroProcesso} criado com sucesso.`, {
          numeroProcesso: dataProc.numeroProcesso,
          detalhes: `ID SEI: ${dataProc.idProcedimento}`
        });
        addLog('success', `Processo ${dataProc.numeroProcesso} autuado no SEI (ID: ${dataProc.idProcedimento})`);
      }

      // ----------------------------------------------------
      // ETAPA 3: Anexo do Relatório Oficial CAESB
      // ----------------------------------------------------
      if (startStepIdx <= 2) {
        setCurrentStepIndex(2);
        updateStepStatus(2, 'running', 'Anexando Laudo...', 'Gerando documento e realizando upload do anexo externo...');
        addLog('info', 'Gerando conteúdo oficial do relatório técnico de hidrantes...');

        let htmlContent = null;
        let pdfBase64 = null;
        let fileName = `Relatorio_Vistoria_CAESB_${cidade || 'DF'}.html`;
        let nomeArvore = `Relatório CAESB - ${cidade || 'DF'}`;

        if (typeof getReportFile === 'function') {
          const reportData = await getReportFile();
          if (reportData?.html) {
            htmlContent = reportData.html;
            if (reportData.docTitle) {
              fileName = `${reportData.docTitle}.html`;
              nomeArvore = reportData.docTitle;
            }
          }
        } else if (typeof getReportPdfBase64 === 'function') {
          pdfBase64 = await getReportPdfBase64();
          fileName = `Relatorio_Vistoria_CAESB_${cidade || 'DF'}.pdf`;
        }

        ctx.fileName = fileName;
        addLog('info', `Enviando anexo externo '${fileName}' ao processo SEI...`);

        const resAnexo = await fetch('/api/sei/processar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'step_anexar_documento',
            payload: {
              sessionToken: ctx.sessionToken,
              idProcedimento: ctx.idProcedimento,
              htmlContent,
              pdfBase64,
              fileName,
              nomeArvore
            }
          })
        });

        const dataAnexo = await resAnexo.json();
        if (!resAnexo.ok || !dataAnexo.success) {
          throw {
            stepIndex: 2,
            stepTitle: 'Upload e Anexo do Relatório Oficial CAESB',
            action: 'step_anexar_documento',
            message: dataAnexo.error || 'Falha ao anexar documento no SEI.',
            technicalDetails: dataAnexo.technicalDetails || null
          };
        }

        ctx.sessionToken = dataAnexo.sessionToken;
        ctx.idDocumentoAnexo = dataAnexo.idDocumentoAnexo;
        ctx.numeroSeiDoc = dataAnexo.numeroSei || dataAnexo.idDocumentoAnexo;

        setProcessoResult(prev => ({
          ...prev,
          idDocumentoAnexo: dataAnexo.idDocumentoAnexo,
          numeroSeiDoc: dataAnexo.numeroSei || dataAnexo.idDocumentoAnexo,
          fileName: dataAnexo.fileName,
          sessionToken: dataAnexo.sessionToken
        }));

        updateStepStatus(2, 'success', 'Arquivo Anexado', `Documento nato-digital anexado ao processo.`, {
          fileName: dataAnexo.fileName,
          numeroSei: dataAnexo.numeroSei,
          detalhes: `Nº Documento SEI: ${dataAnexo.numeroSei}`
        });
        addLog('success', `Relatório '${dataAnexo.fileName}' anexado com sucesso! Nº SEI: ${dataAnexo.numeroSei}`);
      }

      // ----------------------------------------------------
      // ETAPA 4: Geração da Minuta do Memorando ao GPCIU
      // ----------------------------------------------------
      if (startStepIdx <= 3) {
        setCurrentStepIndex(3);
        updateStepStatus(3, 'running', 'Gerando Memorando...', 'Elaborando documento interno com minuta de despacho ao GPCIU...');
        addLog('info', 'Gerando minuta do Memorando ao GPCIU e vinculando número do anexo...');

        let corpoFinal = formatMinutaToSeiHtml(memorandoMinuta);
        if (ctx.numeroSeiDoc) {
          corpoFinal = corpoFinal.replaceAll('[Nº SEI DO RELATÓRIO EXTERNO]', ctx.numeroSeiDoc);
        }

        const resMemo = await fetch('/api/sei/processar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'step_criar_memorando',
            payload: {
              sessionToken: ctx.sessionToken,
              idProcedimento: ctx.idProcedimento,
              cidade: cidade || 'Distrito Federal',
              raRomano,
              corpoMemorandoHtml: corpoFinal,
              docAnexoSei: ctx.numeroSeiDoc
            }
          })
        });

        const dataMemo = await resMemo.json();
        if (!resMemo.ok || !dataMemo.success) {
          throw {
            stepIndex: 3,
            stepTitle: 'Geração da Minuta do Memorando ao GPCIU',
            action: 'step_criar_memorando',
            message: dataMemo.error || 'Falha ao gerar minuta do memorando no SEI.',
            technicalDetails: dataMemo.technicalDetails || null
          };
        }

        ctx.sessionToken = dataMemo.sessionToken;
        ctx.idDocumentoMemo = dataMemo.idDocumentoMemo;

        setProcessoResult(prev => ({
          ...prev,
          idDocumentoMemo: dataMemo.idDocumentoMemo,
          sessionToken: dataMemo.sessionToken
        }));

        updateStepStatus(3, 'success', 'Minuta Gerada', 'Memorando ao GPCIU vinculado ao processo com tags atualizadas.', {
          detalhes: `ID Memorando SEI: ${dataMemo.idDocumentoMemo}`
        });
        addLog('success', `Minuta do Memorando ao GPCIU gerada e salva no editor do SEI (ID: ${dataMemo.idDocumentoMemo})`);
      }

      // ----------------------------------------------------
      // ETAPA 5: Assinatura Eletrônica Institucional
      // ----------------------------------------------------
      if (startStepIdx <= 4) {
        setCurrentStepIndex(4);

        // Se a senha de assinatura não foi fornecida previamente, pausa para o usuário digitar
        if (!savedCredentials.current.senhaAssinatura) {
          setIsRunning(false);
          updateStepStatus(4, 'pending', 'Aguardando Senha', 'Informe sua senha de assinatura eletrônica do SEI para continuar.');
          addLog('warn', 'Processo e laudos autuados! Aguardando senha de assinatura eletrônica do militar...');
          return; // Sai da função mantendo ctx; o form de assinatura chamará onProvideSignature
        }

        updateStepStatus(4, 'running', 'Assinando...', 'Aplicando assinatura eletrônica com matrícula institucional...');
        addLog('info', `Assinando memorando eletronicamente com o militar ${ctx.usuario}...`);

        const resAssinar = await fetch('/api/sei/processar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'step_assinar',
            payload: {
              sessionToken: ctx.sessionToken,
              idDocumentoMemo: ctx.idDocumentoMemo,
              usuario: ctx.usuario,
              senhaAssinatura: savedCredentials.current.senhaAssinatura
            }
          })
        });

        const dataAssinar = await resAssinar.json();
        if (!resAssinar.ok || !dataAssinar.success) {
          throw {
            stepIndex: 4,
            stepTitle: 'Assinatura Eletrônica Institucional',
            action: 'step_assinar',
            message: dataAssinar.error || 'Falha na assinatura eletrônica do documento no SEI.',
            technicalDetails: dataAssinar.technicalDetails || null
          };
        }

        ctx.sessionToken = dataAssinar.sessionToken;
        updateStepStatus(4, 'success', 'Assinado', `Documento assinado eletronicamente por ${dataAssinar.assinadoPor || ctx.usuario}.`, {
          detalhes: `Militar: ${dataAssinar.assinadoPor || ctx.usuario}`
        });
        addLog('success', `Memorando assinado eletronicamente com sucesso por ${dataAssinar.assinadoPor || ctx.usuario}`);
      }

      // ----------------------------------------------------
      // ETAPA 6: Tramitação Oficial para a SUTEC
      // ----------------------------------------------------
      if (startStepIdx <= 5) {
        setCurrentStepIndex(5);
        updateStepStatus(5, 'running', 'Tramitando...', 'Enviando processo para CBMDF/DIVIS/SEHUR/SUTEC...');
        addLog('info', 'Tramitando processo para CBMDF/DIVIS/SEHUR/SUTEC (110037655)...');

        const resTramitar = await fetch('/api/sei/processar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'step_tramitar',
            payload: {
              sessionToken: ctx.sessionToken,
              idProcedimento: ctx.idProcedimento,
              unidadeDestinoId: '110037655'
            }
          })
        });

        const dataTramitar = await resTramitar.json();
        if (!resTramitar.ok || !dataTramitar.success) {
          throw {
            stepIndex: 5,
            stepTitle: 'Tramitação Oficial para a SUTEC',
            action: 'step_tramitar',
            message: dataTramitar.error || 'Falha ao tramitar processo no SEI.',
            technicalDetails: dataTramitar.technicalDetails || null
          };
        }

        updateStepStatus(5, 'success', 'Tramitado', `Processo remetido à SUTEC e mantido aberto na SUOMA.`, {
          detalhes: `Destino: ${dataTramitar.unidadeDestino || 'SUTEC'}`
        });
        addLog('success', `Processo tramitado com sucesso para ${dataTramitar.unidadeDestino || 'SUTEC'}!`);

        setIsRunning(false);
        toast.success(`Automação concluída! Processo ${ctx.numeroProcesso} enviado com sucesso!`);
      }

    } catch (err) {
      console.error('[Automação SEI] Erro capturado:', err);
      setIsRunning(false);
      setHasError(true);

      const errIdx = err.stepIndex ?? currentStepIndex;
      const errTitle = err.stepTitle ?? stepsState[errIdx]?.title ?? 'Operação no SEI';
      const errMsg = err.message || 'Erro inesperado na automação do SEI DF.';

      setErrorDetails({
        stepIndex: errIdx,
        stepTitle: errTitle,
        action: err.action || 'desconhecida',
        message: errMsg,
        technicalDetails: err.technicalDetails || null
      });

      updateStepStatus(errIdx, 'error', 'Falha', errMsg);
      addLog('error', `[${errTitle}] ${errMsg}`);
      toast.error(`Erro na etapa "${errTitle}": ${errMsg}`);
    }
  };

  // Reexecuta etapa que deu erro
  const handleRetryStep = () => {
    const retryIdx = errorDetails?.stepIndex ?? currentStepIndex;
    addLog('warn', `Reiniciando execução a partir da etapa #${retryIdx + 1}...`);
    executeFromStep(retryIdx, {
      ...processoResult,
      usuario: savedCredentials.current.usuario
    });
  };

  // Callback quando o usuário preenche a senha de assinatura no meio do fluxo
  const handleProvideSignature = (pwd) => {
    savedCredentials.current.senhaAssinatura = pwd;
    addLog('info', 'Senha de assinatura recebida. Prosseguindo com assinatura e tramitação...');
    executeFromStep(4, {
      ...processoResult,
      usuario: savedCredentials.current.usuario
    });
  };

  // Reiniciar fluxo
  const handleReset = () => {
    setShowProgressModal(false);
    setStepsState(JSON.parse(JSON.stringify(INITIAL_STEPS)));
    setCurrentStepIndex(0);
    setHasError(false);
    setErrorDetails(null);
    setLogs([]);
  };

  const handleCloseAll = () => {
    setShowProgressModal(false);
    onClose?.();
  };

  return (
    <>
      {/* 1. MODAL INICIAL DE CONFIGURAÇÃO E CREDENCIAIS */}
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col text-slate-100 max-h-[92vh]">
          
          {/* Cabeçalho */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <Send size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                  Envio Direto ao SEI DF
                </h3>
                <p className="text-xs text-slate-400">
                  {cidade || 'DF'} {raRomano ? `(RA ${raRomano})` : ''} • SEHUR/SUOMA
                </p>
              </div>
            </div>
            <button
              onClick={handleCloseAll}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Conteúdo do Formulário */}
          <form onSubmit={handleStartAutomation} className="p-5 overflow-y-auto space-y-4">
            
            <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/80 text-xs space-y-2">
              <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Fluxo Automatizado Completo:
              </div>
              <ul className="list-disc list-inside text-slate-300 space-y-1 text-[11px] leading-relaxed">
                <li>Acesso seguro e seleção de unidade (SUOMA)</li>
                <li>Autuação do Processo de Fiscalização no SEI</li>
                <li>Upload nato-digital do Relatório Oficial CAESB</li>
                <li>Elaboração do Memorando ao Comandante do GPCIU</li>
                <li>Assinatura Eletrônica e Remessa à SUTEC</li>
              </ul>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Matrícula / Usuário SEI:
                </label>
                <input
                  type="text"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="Ex: 1997400"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Senha de Acesso (SIP/SEI):
                  </label>
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testingLogin || !usuario.trim() || !senha}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    {testingLogin ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    <span>Testar Conexão</span>
                  </button>
                </div>
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Sua senha do SEI"
                  required
                  autoComplete="current-password"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  spellCheck={false}
                  data-form-type="other"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                />
              </div>

              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-400" />
                    <span>Senha de Assinatura (Opcional antecipada):</span>
                  </label>
                  <span className="text-[10px] text-slate-500">Sem interrupções</span>
                </div>
                <input
                  type="password"
                  value={senhaAssinatura}
                  onChange={(e) => setSenhaAssinatura(e.target.value)}
                  placeholder="Informe agora para assinar direto ou deixe em branco"
                  autoComplete="current-password"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  spellCheck={false}
                  data-form-type="other"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                />
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  💡 Se preencher agora, o fluxo conclui todas as 6 etapas direto. Se deixar em branco, o sistema solicitará a senha após autuar o processo e anexar o laudo.
                </p>
              </div>

              <span className="text-[10px] text-slate-400 block pt-1">
                🔒 Conexão segura e direta com o servidor oficial do SEI DF. Credenciais não são persistidas em disco nem registradas em logs.
              </span>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold rounded-xl shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Iniciar Automação Completa</span>
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>

      {/* 2. JANELA POP-UP DE ACOMPANHAMENTO EM TEMPO REAL E DIAGNÓSTICO DE ERROS */}
      {showProgressModal && (
        <SeiAutomationProgressModal
          isOpen={showProgressModal}
          onClose={handleCloseAll}
          cidade={cidade}
          raRomano={raRomano}
          currentUser={currentUser}
          stepsState={stepsState}
          logs={logs}
          currentStepIndex={currentStepIndex}
          isRunning={isRunning}
          hasError={hasError}
          errorDetails={errorDetails}
          processoResult={processoResult}
          onRetryStep={handleRetryStep}
          onProvideSignature={handleProvideSignature}
          onReset={handleReset}
        />
      )}
    </>
  );
};
