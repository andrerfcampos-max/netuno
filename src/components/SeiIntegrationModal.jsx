import React, { useState } from 'react';
import { X, Send, Lock, FileText, CheckCircle2, AlertCircle, Loader2, ArrowRight, ExternalLink, ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';

export const SeiIntegrationModal = ({
  isOpen,
  onClose,
  cidade,
  raRomano,
  currentUser,
  memorandoMinuta,
  getReportPdfBase64 // Função para obter o buffer ou base64 do PDF
}) => {
  const [step, setStep] = useState('login'); // 'login' | 'enviando_processo' | 'assinar' | 'concluido'
  const [usuario, setUsuario] = useState(() => localStorage.getItem('netuno_sei_usuario') || currentUser?.matricula || '');
  const [senha, setSenha] = useState('');
  const [senhaAssinatura, setSenhaAssinatura] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  
  // Estado retornado do backend
  const [processoData, setProcessoData] = useState({
    numeroProcesso: '',
    idProcedimento: '',
    idDocumentoMemo: '',
    sessionToken: ''
  });

  if (!isOpen) return null;

  const handleClose = () => {
    setSenha('');
    setSenhaAssinatura('');
    onClose?.();
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

  // 1. Iniciar Processo e Anexar Documentos
  const handleIniciarProcesso = async (e) => {
    e?.preventDefault();
    if (!usuario.trim() || !senha) {
      toast.warn('Informe a matrícula e a senha de acesso ao SEI.');
      return;
    }

    const senhaTemp = senha;
    setSenha(''); // Limpeza imediata da senha da memória do componente

    try {
      setLoading(true);
      setLoadingStatus('Autenticando no SIP/SEI GDF...');
      localStorage.setItem('netuno_sei_usuario', usuario.trim());

      // Obtém o PDF em base64 se a função estiver disponível
      let pdfBase64 = null;
      if (typeof getReportPdfBase64 === 'function') {
        setLoadingStatus('Gerando documento PDF do Relatório CAESB...');
        pdfBase64 = await getReportPdfBase64();
      }

      setLoadingStatus('Criando processo e anexando relatório...');
      const response = await fetch('/api/sei/processar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'iniciar_expediente',
          payload: {
            usuario: usuario.trim(),
            senha: senhaTemp,
            cidade: cidade || 'Distrito Federal',
            raRomano,
            pdfBase64,
            fileName: `Relatorio_Vistoria_CAESB_${cidade || 'DF'}.pdf`,
            nomeArvore: `Relatório CAESB - ${cidade || 'DF'}`,
            corpoMemorandoHtml: formatMinutaToSeiHtml(memorandoMinuta)
          }
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Falha ao processar criação de processo no SEI.');
      }

      setProcessoData({
        numeroProcesso: data.numeroProcesso,
        idProcedimento: data.idProcedimento,
        idDocumentoMemo: data.idDocumentoMemo,
        sessionToken: data.sessionToken
      });

      toast.success(`Processo ${data.numeroProcesso} criado com sucesso!`);
      setStep('assinar');
    } catch (err) {
      console.error('Erro ao iniciar processo SEI:', err);
      toast.error(err.message || 'Erro ao conectar com o SEI.');
    } finally {
      setLoading(false);
      setLoadingStatus('');
    }
  };

  // 2. Assinar Memorando e Tramitar para a SUTEC
  const handleAssinarETramitar = async (e) => {
    e?.preventDefault();
    if (!senhaAssinatura) {
      toast.warn('Digite a sua senha de assinatura do SEI.');
      return;
    }

    const senhaAssinaturaTemp = senhaAssinatura;
    setSenhaAssinatura(''); // Limpeza imediata da senha de assinatura da memória

    try {
      setLoading(true);
      setLoadingStatus('Assinando memorando eletronicamente...');

      const response = await fetch('/api/sei/processar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assinar_e_tramitar',
          payload: {
            sessionToken: processoData.sessionToken,
            idProcedimento: processoData.idProcedimento,
            idDocumentoMemo: processoData.idDocumentoMemo,
            senhaAssinatura: senhaAssinaturaTemp,
            usuario: usuario.trim(),
            unidadeDestinoId: '110037655' // SUTEC
          }
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Falha ao assinar e tramitar processo no SEI.');
      }

      toast.success('Memorando assinado e processo tramitado com sucesso!');
      setStep('concluido');
    } catch (err) {
      console.error('Erro ao assinar no SEI:', err);
      toast.error(err.message || 'Falha na assinatura eletrônica.');
    } finally {
      setLoading(false);
      setLoadingStatus('');
    }
  };

  const urlAcessoSei = processoData.idProcedimento 
    ? `https://sei.df.gov.br/sei/controlador.php?acao=procedimento_trabalhar&id_procedimento=${processoData.idProcedimento}`
    : 'https://sei.df.gov.br';

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col text-slate-100 max-h-[92vh]">
        
        {/* Cabeçalho do Modal */}
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
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Conteúdo Dinâmico conforme a Etapa */}
        <div className="p-5 overflow-y-auto space-y-4">
          
          {/* ETAPA 1: Login e Confirmação de Envio */}
          {step === 'login' && (
            <form onSubmit={handleIniciarProcesso} className="space-y-4">
              <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/80 text-xs space-y-2">
                <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> Fluxo Automatizado em 1 Toque:
                </div>
                <ul className="list-disc list-inside text-slate-300 space-y-1 text-[11px] leading-relaxed">
                  <li>Criação do Processo de Fiscalização no SEI DF</li>
                  <li>Anexo nato-digital do Relatório CAESB em PDF</li>
                  <li>Geração da Minuta do Memorando ao Comandante do GPCIU</li>
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
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Senha de Acesso (SIP/SEI):
                  </label>
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
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    🔒 Conexão segura e direta com o servidor oficial do SEI DF. Senhas não são persistidas em disco nem registradas em logs.
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold rounded-xl shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>{loadingStatus || 'Conectando ao SEI...'}</span>
                  </>
                ) : (
                  <>
                    <span>Criar Processo e Anexar Documentos</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ETAPA 2: Assinatura e Tramitação */}
          {step === 'assinar' && (
            <form onSubmit={handleAssinarETramitar} className="space-y-4 animate-fadeIn">
              <div className="bg-emerald-950/40 border border-emerald-500/40 p-3.5 rounded-xl space-y-1.5">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                  ✓ Processo Criado com Sucesso!
                </span>
                <p className="text-base font-black text-white font-mono">
                  {processoData.numeroProcesso}
                </p>
                <p className="text-xs text-slate-300">
                  O relatório foi anexado e o Memorando ao GPCIU foi gerado como minuta.
                </p>
              </div>

              <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/80 space-y-2">
                <label className="block text-xs font-semibold text-slate-200">
                  Senha Eletrônica do SEI para Assinar e Tramitar:
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={senhaAssinatura}
                    onChange={(e) => setSenhaAssinatura(e.target.value)}
                    placeholder="Digite a senha para assinar"
                    required
                    autoFocus
                    autoComplete="current-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    spellCheck={false}
                    data-form-type="other"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-3 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                  />
                  <Lock size={16} className="absolute right-3 top-3 text-slate-400" />
                </div>
                <div className="text-[11px] text-amber-300/90 flex items-center gap-1.5 pt-1">
                  <ShieldCheck size={14} className="shrink-0" />
                  <span>Ao confirmar, o memorando será assinado eletronicamente e tramitado para a SUTEC.</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold rounded-xl shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>{loadingStatus || 'Assinando e tramitando...'}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>Assinar e Tramitar para SUTEC</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* ETAPA 3: Concluído */}
          {step === 'concluido' && (
            <div className="text-center py-4 space-y-4 animate-fadeIn">
              <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/40">
                <CheckCircle2 size={32} />
              </div>

              <div className="space-y-1">
                <h4 className="text-lg font-bold text-white">Expediente Concluído!</h4>
                <p className="text-xs text-slate-300">
                  O processo foi gerado, o laudo anexado, o memorando assinado e tramitado para a chefia imediata (SUTEC).
                </p>
                <div className="pt-2 font-mono font-bold text-emerald-400 text-sm">
                  {processoData.numeroProcesso}
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <a
                  href={urlAcessoSei}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Abrir no SEI DF</span>
                  <ExternalLink size={14} />
                </a>
                <button
                  onClick={handleClose}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
