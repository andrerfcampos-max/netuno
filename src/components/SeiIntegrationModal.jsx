import React, { useState } from 'react';
import { 
  X, Send, CheckCircle2, ArrowRight, ExternalLink, ShieldCheck, 
  Copy, Check, FileText, Download, Building2, HelpCircle
} from 'lucide-react';
import { toast } from 'react-toastify';

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
  const [copiedMinuta, setCopiedMinuta] = useState(false);
  const [isOpeningSei, setIsOpeningSei] = useState(false);
  const [numeroProcessoInput, setNumeroProcessoInput] = useState('');
  const [processoSalvo, setProcessoSalvo] = useState(false);

  if (!isOpen) return null;

  const handleCopyMinuta = () => {
    if (!memorandoMinuta) {
      toast.warn('Nenhuma minuta gerada para cópia.');
      return;
    }
    navigator.clipboard.writeText(memorandoMinuta);
    setCopiedMinuta(true);
    toast.success('Minuta do Memorando com Minuta de Ofício copiada com sucesso!');
    setTimeout(() => setCopiedMinuta(false), 2500);
  };

  const handleStartBrowserWorkflow = async () => {
    try {
      setIsOpeningSei(true);

      // Prepara os dados do pacote oficial CAESB
      let pdfBase64 = null;
      if (typeof getReportPdfBase64 === 'function') {
        try {
          pdfBase64 = await getReportPdfBase64();
        } catch (pdfErr) {
          console.warn('[SEI] Não foi possível extrair PDF em base64:', pdfErr);
        }
      }

      const payload = {
        tipo: 'caesb',
        cidade: cidade || 'Distrito Federal',
        raRomano: raRomano || '',
        origem: 'CBMDF/DIVIS/SEHUR/SUOMA',
        destino: 'CBMDF/COESP/GPCIU/SEHUR',
        memorandoMinuta: memorandoMinuta || '',
        operador: currentUser?.nome || currentUser?.matricula || 'Militar Vistoriador',
        matricula: currentUser?.matricula || '',
        dataCriacao: new Date().toISOString(),
        pdfBase64: pdfBase64 || null
      };

      // Salva no localStorage para leitura pela extensão/assistente no navegador
      localStorage.setItem('netuno_sei_data', JSON.stringify(payload));
      localStorage.setItem('netuno_sei_active_package', JSON.stringify(payload));

      // Abre o SEI DF oficial em nova aba
      window.open('https://sei.df.gov.br', '_blank', 'noopener,noreferrer');

      toast.info('Navegador aberto na página do SEI DF! Realize seu login com segurança.');
    } catch (err) {
      toast.error(`Falha ao preparar envio: ${err.message}`);
    } finally {
      setIsOpeningSei(false);
    }
  };

  const handleSalvarNumeroProcesso = (e) => {
    e.preventDefault();
    if (!numeroProcessoInput.trim()) {
      toast.warn('Informe o número do processo gerado.');
      return;
    }
    const proc = numeroProcessoInput.trim();
    // Salva referência do processo gerado localmente
    const historico = JSON.parse(localStorage.getItem('netuno_processos_sei') || '[]');
    historico.push({
      numeroProcesso: proc,
      cidade,
      raRomano,
      tipo: 'caesb',
      destino: 'CBMDF/COESP/GPCIU/SEHUR',
      data: new Date().toISOString(),
      militar: currentUser?.nome || currentUser?.matricula
    });
    localStorage.setItem('netuno_processos_sei', JSON.stringify(historico));

    setProcessoSalvo(true);
    toast.success(`Processo ${proc} registrado no histórico do Netuno!`);
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col text-slate-100 max-h-[94vh]">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Send size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">
                  Enviar Direto ao SEI (1 Toque)
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Relatório CAESB
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {cidade || 'DF'} {raRomano ? `(RA ${raRomano})` : ''} • Destino: CBMDF/COESP/GPCIU/SEHUR
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          
          {/* Card de Segurança Institucional */}
          <div className="bg-cyan-950/30 border border-cyan-500/30 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
              <ShieldCheck size={16} className="text-cyan-400 shrink-0" />
              <span>Diretriz de Segurança: Sem Captura de Credenciais</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Por questões de conformidade e segurança da informação do CBMDF e do GDF, o <strong>Netuno não pede, não captura e não armazena nenhuma senha do SEI</strong>. O login oficial é feito diretamente por você no ambiente seguro do navegador.
            </p>
          </div>

          {/* Rito e Etapas com as 2 Senhas */}
          <div className="bg-slate-800/50 rounded-xl p-3.5 border border-slate-700/80 space-y-2.5">
            <div className="font-bold text-white flex items-center gap-2 text-xs">
              <Building2 size={15} className="text-emerald-400" />
              <span>Rito Oficial de Tramitação (Protocolo SUOMA):</span>
            </div>

            <div className="space-y-2 text-[11px]">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-200 font-bold flex items-center justify-center shrink-0 text-[10px]">
                  1
                </span>
                <div>
                  <strong className="text-white">Abertura e 1º Login:</strong> O Netuno abre a aba oficial do SEI DF (<code className="text-cyan-300 font-mono">sei.df.gov.br</code>) para você entrar com sua matrícula e senha de acesso ao SEI.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-200 font-bold flex items-center justify-center shrink-0 text-[10px]">
                  2
                </span>
                <div>
                  <strong className="text-white">Autuação & Documentos:</strong> O processo de Fiscalização de Hidrantes é autuado na SUOMA, o Relatório Oficial CAESB (PDF nato-digital) é anexado e a Minuta do Memorando ao GPCIU (com minuta de ofício acoplada) é inserida.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-200 font-bold flex items-center justify-center shrink-0 text-[10px]">
                  3
                </span>
                <div>
                  <strong className="text-white">Assinatura Eletrônica (2ª Senha):</strong> A tela oficial de assinatura do SEI será exibida para você digitar sua senha de assinatura eletrônica do militar vistoriador/gestor.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold flex items-center justify-center shrink-0 text-[10px]">
                  4
                </span>
                <div>
                  <strong className="text-emerald-300">Tramitação Final:</strong> O processo assinado é tramitado diretamente para <strong className="text-white">CBMDF/COESP/GPCIU/SEHUR</strong>, mantendo o processo aberto na unidade geradora (SUOMA).
                </div>
              </div>
            </div>
          </div>

          {/* Botão de Disparo 1 Toque */}
          <button
            onClick={handleStartBrowserWorkflow}
            disabled={isOpeningSei}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-bold rounded-xl shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer text-sm"
          >
            <span>🚀 Abrir SEI no Navegador e Iniciar Envio</span>
            <ExternalLink size={16} />
          </button>

          {/* Ações Auxiliares (Cópia da Minuta e Registro do Processo) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              onClick={handleCopyMinuta}
              className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
            >
              {copiedMinuta ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copiedMinuta ? 'Minuta Copiada!' : 'Copiar Minuta SEI'}</span>
            </button>

            <a
              href="https://sei.df.gov.br"
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
            >
              <ExternalLink size={14} />
              <span>Acessar SEI DF</span>
            </a>
          </div>

          {/* Registro do Processo Gerado para Histórico */}
          <form onSubmit={handleSalvarNumeroProcesso} className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-2 pt-3">
            <label className="block text-[11px] font-semibold text-slate-300">
              Vincular Nº do Processo SEI gerado (Opcional para Auditoria):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={numeroProcessoInput}
                onChange={(e) => setNumeroProcessoInput(e.target.value)}
                placeholder="Ex: 00053-00012345/2026-00"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={processoSalvo || !numeroProcessoInput.trim()}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
              >
                {processoSalvo ? 'Salvo!' : 'Salvar'}
              </button>
            </div>
            {processoSalvo && (
              <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={12} /> Processo vinculado com sucesso ao histórico da localidade.
              </p>
            )}
          </form>

        </div>

        {/* Rodapé */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
