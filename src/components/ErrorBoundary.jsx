import React from 'react';
import { RefreshCw, AlertTriangle, Trash2, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, copied: false, showDetails: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary capturou um erro:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    try {
      localStorage.removeItem('netuno_map_state');
    } catch (e) {}
    window.location.reload();
  };

  handleResetAll = () => {
    try {
      localStorage.removeItem('netuno_map_state');
      localStorage.removeItem('netuno_saved_filters');
      localStorage.removeItem('netuno_active_view');
      localStorage.removeItem('lastReportType');
    } catch (e) {}
    window.location.href = window.location.pathname;
  };

  handleCopyError = () => {
    const errorText = `Erro NETUNO:\n${this.state.error?.toString()}\n\nStack:\n${this.state.error?.stack || ''}\n\nComponentStack:\n${this.state.errorInfo?.componentStack || ''}`;
    navigator.clipboard.writeText(errorText);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2500);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 bg-slate-900 text-slate-100 rounded-xl border border-slate-700 min-h-[350px] gap-4 text-center my-4 mx-2">
          <AlertTriangle size={48} className="text-amber-400 animate-bounce" />
          <h2 className="text-lg font-bold text-emerald-400">Recuperação Automática do NETUNO</h2>
          <p className="text-sm text-slate-400 max-w-md">
            Ocorreu uma instabilidade na renderização de componentes. Escolha uma das opções abaixo para restaurar o sistema:
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
            <button
              onClick={this.handleReload}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg active:scale-95 transition-all text-sm cursor-pointer"
            >
              <RefreshCw size={18} />
              Recarregar Sistema
            </button>

            <button
              onClick={this.handleResetAll}
              className="flex items-center gap-2 px-5 py-2.5 bg-rose-700 hover:bg-rose-600 text-white font-bold rounded-lg shadow-lg active:scale-95 transition-all text-sm cursor-pointer"
              title="Limpa filtros, mapa e cache salvos no navegador e reinicia"
            >
              <Trash2 size={18} />
              Limpar Cache e Reiniciar
            </button>
          </div>

          <div className="w-full max-w-md mt-4 border-t border-slate-800 pt-3">
            <button
              onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1 mx-auto"
            >
              {this.state.showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {this.state.showDetails ? 'Ocultar detalhes técnicos' : 'Ver detalhes técnicos do erro'}
            </button>

            {this.state.showDetails && (
              <div className="mt-2 text-left bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] font-mono text-red-300 overflow-x-auto max-h-48">
                <div className="flex justify-between items-center mb-1 text-slate-400 border-b border-slate-800 pb-1">
                  <span>Mensagem de erro:</span>
                  <button
                    onClick={this.handleCopyError}
                    className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                  >
                    {this.state.copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    {this.state.copied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <p className="font-bold text-red-400">{this.state.error?.toString()}</p>
                {this.state.error?.stack && (
                  <pre className="mt-2 text-slate-500 whitespace-pre-wrap text-[10px]">{this.state.error.stack}</pre>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
