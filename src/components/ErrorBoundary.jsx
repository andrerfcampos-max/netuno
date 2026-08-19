import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary capturou um erro:', error, errorInfo);
  }

  handleReload = () => {
    try {
      localStorage.removeItem('netuno_map_state');
    } catch (e) {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 bg-slate-900 text-slate-100 rounded-xl border border-slate-700 min-h-[350px] gap-4 text-center my-4 mx-2">
          <AlertTriangle size={48} className="text-amber-400 animate-bounce" />
          <h2 className="text-lg font-bold text-emerald-400">Recuperação Automática do NETUNO</h2>
          <p className="text-sm text-slate-400 max-w-md">
            Ocorreu uma oscilação na renderização de componentes (como GPS ou Mapa). Clique abaixo para recarregar com parâmetros seguros.
          </p>
          <button
            onClick={this.handleReload}
            className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg active:scale-95 transition-all text-sm cursor-pointer"
          >
            <RefreshCw size={18} />
            Recarregar Sistema
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
