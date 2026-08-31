import React, { useState, useEffect } from 'react';
import { Cloud, X, CheckCircle, AlertCircle, RefreshCw, Database, Key, Globe, Shield } from 'lucide-react';
import { getActiveCloudConfig, saveCloudConfig, testCloudConnection, isCloudConfigured } from '../services/supabase';

const CloudConfigModal = ({ onClose, onSyncNow }) => {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [status, setStatus] = useState({ testing: false, success: null, message: '' });
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const config = getActiveCloudConfig();
    setUrl(config.url || '');
    setKey(config.key || '');
    if (config.url && config.key) {
      handleTest(config.url, config.key);
    }
  }, []);

  const handleTest = async (testUrl = url, testKey = key) => {
    if (!testUrl || !testKey) {
      setStatus({ testing: false, success: false, message: 'Preencha a URL e a Chave Anon do Supabase.' });
      return;
    }
    setStatus({ testing: true, success: null, message: 'Testando conexão com o banco de dados...' });
    saveCloudConfig(testUrl, testKey);
    const result = await testCloudConnection();
    setStatus({ testing: false, success: result.success, message: result.message });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    saveCloudConfig(url, key);
    await handleTest(url, key);
    if (onSyncNow) {
      setIsSyncing(true);
      await onSyncNow();
      setIsSyncing(false);
    }
  };

  const handleClear = () => {
    saveCloudConfig('', '');
    setUrl('');
    setKey('');
    setStatus({ testing: false, success: false, message: 'Credenciais removidas. O sistema utilizará apenas o armazenamento local.' });
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col animate-scaleUp text-slate-100">
        
        {/* CABEÇALHO PADRONIZADO */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-slate-900 border-b border-slate-700/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-white shadow-md shadow-cyan-950/50 shrink-0">
              <Database size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base sm:text-lg text-white tracking-tight truncate">
                Banco de Dados em Nuvem (Cloud DB)
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Sincronização multi-dispositivo em tempo real
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 flex flex-col gap-4">
          <div className="bg-cyan-950/40 border border-cyan-500/30 rounded-xl p-3.5 text-xs text-cyan-200 leading-relaxed flex items-start gap-2.5">
            <Globe size={18} className="text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block mb-0.5">Sincronização Multi-Dispositivo Integrada</strong>
              Conecte o Netuno ao seu projeto <strong>Supabase</strong> para que rotas criadas no celular apareçam instantaneamente no computador e vice-versa.
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Globe size={14} className="text-cyan-400" />
              Project URL do Supabase
            </label>
            <input 
              type="url" 
              placeholder="https://xyzproject.supabase.co" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 focus:border-cyan-500 rounded-lg px-3.5 py-2.5 text-sm text-white font-mono placeholder-slate-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Key size={14} className="text-cyan-400" />
              Anon Public API Key
            </label>
            <input 
              type="password" 
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..." 
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 focus:border-cyan-500 rounded-lg px-3.5 py-2.5 text-sm text-white font-mono placeholder-slate-500 outline-none"
              required
            />
          </div>

          {/* Status Banner */}
          {status.message && (
            <div className={`p-3 rounded-lg border text-xs flex items-center gap-2.5 ${
              status.testing ? 'bg-slate-800 border-slate-700 text-slate-300' :
              status.success ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300' :
              'bg-red-950/60 border-red-500/50 text-red-300'
            }`}>
              {status.testing && <RefreshCw size={16} className="animate-spin text-cyan-400 shrink-0" />}
              {!status.testing && status.success && <CheckCircle size={16} className="text-emerald-400 shrink-0" />}
              {!status.testing && status.success === false && <AlertCircle size={16} className="text-red-400 shrink-0" />}
              <span>{status.message}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 justify-between pt-2 border-t border-slate-800 mt-2">
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg text-xs font-semibold transition-colors"
            >
              Desconectar
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleTest()}
                disabled={status.testing}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold rounded-lg text-xs transition-colors border border-slate-700 flex items-center gap-1.5"
              >
                <RefreshCw size={13} className={status.testing ? 'animate-spin' : ''} />
                Testar Conexão
              </button>

              <button
                type="submit"
                disabled={status.testing || isSyncing}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-xs transition-colors shadow-lg shadow-cyan-900/50 flex items-center gap-1.5"
              >
                <Cloud size={14} />
                {isSyncing ? 'Sincronizando...' : 'Salvar e Sincronizar'}
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};

export default CloudConfigModal;
