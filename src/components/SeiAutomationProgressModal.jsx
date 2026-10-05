import React, { useState, useEffect, useRef } from 'react';
import { 
  X, CheckCircle2, AlertCircle, AlertOctagon, Clock, Loader2, 
  Terminal, Copy, Check, ExternalLink, RefreshCw, Send, FileText, 
  Lock, ShieldCheck, ChevronDown, ChevronUp, ArrowRight, Info
} from 'lucide-react';
import { toast } from 'react-toastify';

export const SeiAutomationProgressModal = ({
  isOpen,
  onClose,
  cidade,
  raRomano,
  currentUser,
  stepsState,
  logs,
  currentStepIndex,
  isRunning,
  hasError,
  errorDetails,
  processoResult,
  onRetryStep,
  onProvideSignature,
  onReset
}) => {
  const [showConsole, setShowConsole] = useState(false);
  const [copiedLog, setCopiedLog] = useState(false);
  const [copiedProcesso, setCopiedProcesso] = useState(false);
  const [copiedDoc, setCopiedDoc] = useState(false);
  const [signaturePassword, setSignaturePassword] = useState('');
  const logContainerRef = useRef(null);

  // Auto-scroll nos logs do console
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, showConsole]);

  if (!isOpen) return null;

  // Calcula porcentagem do progresso
  const totalSteps = stepsState.length || 6;
  const completedCount = stepsState.filter(s => s.status === 'success').length;
  const progressPercent = Math.min(100, Math.round((completedCount / totalSteps) * 100));

  const handleCopyLogs = () => {
    const fullLogText = logs.map(l => `[${l.time}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(fullLogText);
    setCopiedLog(true);
    toast.info('Logs de depuração copiados!');
    setTimeout(() => setCopiedLog(false), 2500);
  };

  const handleCopyDiagnosticReport = () => {
    const report = [
      `### Relatório de Diagnóstico Netuno - Automação SEI DF`,
      `- **Data/Hora:** ${new Date().toLocaleString('pt-BR')}`,
      `- **Localidade:** ${cidade || 'DF'} ${raRomano ? `(RA ${raRomano})` : ''}`,
      `- **Operador:** ${currentUser?.matricula || currentUser?.nome || 'Não identificado'}`,
      `- **Etapa com Erro:** ${errorDetails?.stepName || stepsState[currentStepIndex]?.title || 'Desconhecida'}`,
      `- **Ação Técnica:** ${errorDetails?.action || 'N/A'}`,
      `- **Mensagem do Erro:** ${errorDetails?.message || 'Erro desconhecido'}`,
      `- **Nº Processo (se gerado):** ${processoResult?.numeroProcesso || 'Não gerado'}`,
      `- **ID Procedimento SEI:** ${processoResult?.idProcedimento || 'N/A'}`,
      `- **ID Doc Anexo:** ${processoResult?.idDocumentoAnexo || 'N/A'}`,
      `- **ID Doc Memo:** ${processoResult?.idDocumentoMemo || 'N/A'}`,
      ``,
      `#### Logs Cronológicos:`,
      '```',
      logs.map(l => `[${l.time}] [${l.type.toUpperCase()}] ${l.message}`).join('\n'),
      '```'
    ].join('\n');

    navigator.clipboard.writeText(report);
    setCopiedLog(true);
    toast.success('Relatório completo copiado para a área de transferência!');
    setTimeout(() => setCopiedLog(false), 2500);
  };

  const handleCopyProcesso = () => {
    if (!processoResult?.numeroProcesso) return;
    navigator.clipboard.writeText(processoResult.numeroProcesso);
    setCopiedProcesso(true);
    toast.success('Número do processo SEI copiado!');
    setTimeout(() => setCopiedProcesso(false), 2500);
  };

  const handleCopyDocAnexo = () => {
    const num = processoResult?.numeroSeiDoc || processoResult?.idDocumentoAnexo;
    if (!num) return;
    navigator.clipboard.writeText(num);
    setCopiedDoc(true);
    toast.success('Número do documento anexo copiado!');
    setTimeout(() => setCopiedDoc(false), 2500);
  };

  const handleSubmitSignature = (e) => {
    e?.preventDefault();
    if (!signaturePassword) {
      toast.warn('Digite a senha de assinatura do SEI.');
      return;
    }
    const pwd = signaturePassword;
    setSignaturePassword('');
    onProvideSignature?.(pwd);
  };

  const isComplete = stepsState.every(s => s.status === 'success');
  const isAwaitingSignature = !isRunning && !hasError && !isComplete && stepsState[currentStepIndex]?.id === 'assinar';

  const seiUrlProcedimento = processoResult?.idProcedimento
    ? `https://sei.df.gov.br/sei/controlador.php?acao=procedimento_trabalhar&id_procedimento=${processoResult.idProcedimento}`
    : 'https://sei.df.gov.br';

  return (
    <div className="fixed inset-0 z-[1050] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col text-slate-100 max-h-[94vh]">
        
        {/* Cabeçalho do Pop-up */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${
              hasError 
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 shadow-lg shadow-rose-950/40' 
                : isComplete 
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-lg shadow-emerald-950/40' 
                : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
            }`}>
              {hasError ? (
                <AlertOctagon size={20} className="animate-bounce" />
              ) : isComplete ? (
                <CheckCircle2 size={20} />
              ) : (
                <Send size={18} className={isRunning ? 'animate-pulse' : ''} />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">
                  Automação do Processo SEI DF
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  hasError 
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                    : isComplete 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                    : isRunning 
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {hasError ? 'Falha Detectada' : isComplete ? 'Concluído 100%' : isRunning ? 'Em Andamento' : 'Pausado'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {cidade || 'DF'} {raRomano ? `(RA ${raRomano})` : ''} • Destino: SUTEC/SEHUR
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowConsole(!showConsole)}
              title="Alternar Console de Depuração"
              className={`p-2 rounded-lg text-xs font-mono transition-colors flex items-center gap-1.5 border ${
                showConsole 
                  ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300' 
                  : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <Terminal size={14} />
              <span className="hidden sm:inline">Debug ({logs.length})</span>
            </button>

            <button
              onClick={onClose}
              disabled={isRunning}
              title={isRunning ? 'Aguarde a conclusão da etapa atual' : 'Fechar Janela'}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Barra de Progresso Visual */}
        <div className="w-full bg-slate-950 px-5 py-2.5 border-b border-slate-800/80 flex items-center gap-3">
          <div className="flex-1 bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 rounded-full ${
                hasError 
                  ? 'bg-rose-500' 
                  : isComplete 
                  ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' 
                  : 'bg-gradient-to-r from-cyan-500 to-emerald-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-mono font-bold text-slate-300 shrink-0">
            {progressPercent}%
          </span>
        </div>

        {/* Corpo Principal com Scroll */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">

          {/* ALERTA DE ERRO DETALHADO (SE HOUVER) */}
          {hasError && (
            <div className="bg-rose-950/50 border border-rose-500/50 rounded-xl p-4 space-y-3 animate-fadeIn">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 shrink-0 border border-rose-500/30">
                  <AlertOctagon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-rose-300 flex items-center gap-2">
                    Falha na Etapa: {errorDetails?.stepTitle || stepsState[currentStepIndex]?.title || 'Operação no SEI'}
                  </h4>
                  <p className="text-xs text-rose-200 mt-1 leading-relaxed break-words font-medium">
                    {errorDetails?.message || 'Ocorreu um erro inesperado durante a comunicação com o SEI DF.'}
                  </p>
                  
                  {errorDetails?.technicalDetails && (
                    <div className="mt-2 text-[11px] text-rose-300/80 font-mono bg-black/40 p-2 rounded border border-rose-900/60 overflow-x-auto">
                      Ação: {errorDetails.technicalDetails.action || 'N/A'} | Horário: {errorDetails.technicalDetails.timestamp || new Date().toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>

              {/* Botões de Ação para o Erro */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-rose-900/60">
                <button
                  onClick={onRetryStep}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-rose-950/40 cursor-pointer"
                >
                  <RefreshCw size={14} />
                  <span>Tentar Esta Etapa Novamente</span>
                </button>

                <button
                  onClick={handleCopyDiagnosticReport}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {copiedLog ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copiedLog ? 'Copiado!' : 'Copiar Diagnóstico Completo'}</span>
                </button>

                <button
                  onClick={onReset}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-xs transition-all ml-auto"
                >
                  Reiniciar do Início
                </button>
              </div>
            </div>
          )}

          {/* PAUSA INTERATIVA: SOLICITAÇÃO DE SENHA DE ASSINATURA */}
          {isAwaitingSignature && (
            <form onSubmit={handleSubmitSignature} className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-4 space-y-3 animate-fadeIn">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <ShieldCheck size={18} />
                <span>Processo e Documentos Prontos! Confirme a Assinatura:</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                O processo <strong className="text-white font-mono">{processoResult?.numeroProcesso}</strong> foi criado, o relatório CAESB foi anexado e o Memorando ao GPCIU foi gerado como minuta.
                Digite sua senha de assinatura eletrônica do SEI para concluir a assinatura e a remessa imediata para a SUTEC:
              </p>

              <div className="relative">
                <input
                  type="password"
                  value={signaturePassword}
                  onChange={(e) => setSignaturePassword(e.target.value)}
                  placeholder="Sua senha de assinatura do SEI"
                  required
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-3 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                />
                <Lock size={16} className="absolute right-3 top-3 text-slate-400" />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-lg text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer"
                >
                  <ShieldCheck size={16} />
                  <span>Assinar e Tramitar para SUTEC</span>
                </button>
              </div>
            </form>
          )}

          {/* LISTA DAS ETAPAS DA AUTOMAÇÃO */}
          <div className="space-y-2.5">
            {stepsState.map((st, idx) => {
              const isCurrent = idx === currentStepIndex;
              const isDone = st.status === 'success';
              const isErr = st.status === 'error';
              const isRunningStep = st.status === 'running';

              return (
                <div 
                  key={st.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isErr 
                      ? 'bg-rose-950/30 border-rose-500/50' 
                      : isDone 
                      ? 'bg-slate-800/40 border-emerald-500/30' 
                      : isRunningStep 
                      ? 'bg-cyan-950/30 border-cyan-500/50 shadow-md shadow-cyan-950/30' 
                      : 'bg-slate-800/20 border-slate-800/80 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Ícone de Status do Passo */}
                    <div className="mt-0.5 shrink-0">
                      {isDone && (
                        <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
                          <Check size={14} />
                        </div>
                      )}
                      {isRunningStep && (
                        <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center">
                          <Loader2 size={14} className="animate-spin" />
                        </div>
                      )}
                      {isErr && (
                        <div className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center">
                          <AlertOctagon size={14} />
                        </div>
                      )}
                      {!isDone && !isRunningStep && !isErr && (
                        <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-500 border border-slate-700 flex items-center justify-center font-mono text-[11px] font-bold">
                          {idx + 1}
                        </div>
                      )}
                    </div>

                    {/* Textos e Detalhes da Etapa */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-bold ${
                          isDone 
                            ? 'text-emerald-300' 
                            : isRunningStep 
                            ? 'text-cyan-300 font-extrabold' 
                            : isErr 
                            ? 'text-rose-300' 
                            : 'text-slate-300'
                        }`}>
                          {idx + 1}. {st.title}
                        </span>

                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          isDone 
                            ? 'text-emerald-400 bg-emerald-950/60' 
                            : isRunningStep 
                            ? 'text-cyan-400 bg-cyan-950/60 animate-pulse' 
                            : isErr 
                            ? 'text-rose-400 bg-rose-950/60' 
                            : 'text-slate-500 bg-slate-900/60'
                        }`}>
                          {st.statusText || (isDone ? 'Concluído' : isRunningStep ? 'Processando...' : isErr ? 'Erro' : 'Pendente')}
                        </span>
                      </div>

                      {/* Subdescrição ou feedback dinâmico */}
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        {st.dynamicDescription || st.description}
                      </p>

                      {/* Dados Específicos Resultantes da Etapa */}
                      {isDone && st.resultInfo && (
                        <div className="mt-2 text-xs bg-slate-950/80 rounded-lg p-2.5 border border-slate-800 text-slate-200 space-y-1 font-mono">
                          {st.resultInfo.numeroProcesso && (
                            <div className="flex items-center justify-between gap-2">
                              <span>Nº Processo: <strong className="text-emerald-400">{st.resultInfo.numeroProcesso}</strong></span>
                              <button
                                onClick={handleCopyProcesso}
                                title="Copiar Número do Processo"
                                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                              >
                                {copiedProcesso ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                              </button>
                            </div>
                          )}

                          {st.resultInfo.fileName && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate">Arquivo: <strong className="text-cyan-300">{st.resultInfo.fileName}</strong></span>
                              {st.resultInfo.numeroSei && (
                                <button
                                  onClick={handleCopyDocAnexo}
                                  title="Copiar Número SEI do Documento"
                                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors shrink-0"
                                >
                                  {copiedDoc ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                </button>
                              )}
                            </div>
                          )}

                          {st.resultInfo.detalhes && (
                            <div className="text-[11px] text-slate-400">
                              {st.resultInfo.detalhes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* SUCESSO COMPLETO */}
          {isComplete && (
            <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-2xl p-4 text-center space-y-3 animate-fadeIn">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/50">
                <CheckCircle2 size={28} />
              </div>

              <div>
                <h4 className="text-base font-bold text-white">
                  Expediente SEI Concluído com Sucesso!
                </h4>
                <p className="text-xs text-slate-300 mt-1">
                  O processo foi autuado, o laudo oficial CAESB anexado, o memorando assinado e remetido à SUTEC.
                </p>
                <div className="mt-2 text-emerald-400 font-mono font-bold text-sm">
                  {processoResult?.numeroProcesso}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                <a
                  href={seiUrlProcedimento}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-emerald-950/50"
                >
                  <span>Abrir no SEI DF</span>
                  <ExternalLink size={14} />
                </a>

                <button
                  onClick={handleCopyDiagnosticReport}
                  className="w-full sm:flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  {copiedLog ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copiedLog ? 'Copiado!' : 'Copiar Comprovante'}</span>
                </button>
              </div>
            </div>
          )}

          {/* CONSOLE DE DEBUG / LOGS TÉCNICOS */}
          {showConsole && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-900 pb-2">
                <span className="font-mono flex items-center gap-1.5 text-cyan-400 font-bold">
                  <Terminal size={14} />
                  Terminal de Diagnóstico em Tempo Real
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyLogs}
                    className="hover:text-white transition-colors flex items-center gap-1 text-[11px]"
                  >
                    {copiedLog ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>Copiar</span>
                  </button>
                </div>
              </div>

              <div 
                ref={logContainerRef}
                className="max-h-44 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1 text-slate-300 pr-1 select-text"
              >
                {logs.length === 0 ? (
                  <div className="text-slate-600 italic py-2">Nenhum log registrado ainda.</div>
                ) : (
                  logs.map((lg, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="text-slate-600 shrink-0">[{lg.time}]</span>
                      <span className={`shrink-0 font-bold uppercase text-[9px] px-1 rounded ${
                        lg.type === 'error' 
                          ? 'bg-rose-950 text-rose-400 border border-rose-900' 
                          : lg.type === 'success' 
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' 
                          : lg.type === 'warn' 
                          ? 'bg-amber-950 text-amber-400 border border-amber-900' 
                          : 'bg-slate-900 text-cyan-400'
                      }`}>
                        {lg.type}
                      </span>
                      <span className={`break-words ${
                        lg.type === 'error' 
                          ? 'text-rose-300' 
                          : lg.type === 'success' 
                          ? 'text-emerald-300' 
                          : 'text-slate-300'
                      }`}>
                        {lg.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>

        {/* Rodapé com Ações Globais */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Sessão Segura SEI DF (SUOMA)</span>
          </div>

          <div className="flex items-center gap-2">
            {isComplete ? (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer"
              >
                Fechar Janela
              </button>
            ) : (
              <button
                onClick={onClose}
                disabled={isRunning}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors disabled:opacity-40"
              >
                {isRunning ? 'Executando...' : 'Fechar'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
