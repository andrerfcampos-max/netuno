import React, { useState } from 'react';
import { X, FileSpreadsheet, FileText, Download, Loader2, Database } from 'lucide-react';
import { exportHidrantesCSV, exportGlobalDatabaseXLSX } from '../utils/exportGlobalCsv';
import { toast } from 'react-toastify';

const DownloadDatabaseModal = ({ isOpen, onClose, hidrantes = [] }) => {
  const [loadingType, setLoadingType] = useState(null); // 'csv' | 'xlsx' | null

  if (!isOpen) return null;

  const handleExportCSV = async () => {
    try {
      setLoadingType('csv');
      await exportHidrantesCSV(hidrantes);
      toast.success('Download do arquivo CSV dos hidrantes concluído!');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao exportar arquivo CSV dos hidrantes.');
    } finally {
      setLoadingType(null);
    }
  };

  const handleExportXLSX = async () => {
    try {
      setLoadingType('xlsx');
      await exportGlobalDatabaseXLSX(hidrantes);
      toast.success('Download da base completa XLSX concluído!');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao exportar base completa em XLSX.');
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-100 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="px-5 py-4 border-b border-slate-700/80 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Database size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                Baixar Base de Dados
              </h3>
              <p className="text-xs text-slate-400">
                Escolha o formato e o conteúdo para exportação
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loadingType !== null}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corpo com as opções */}
        <div className="p-5 flex flex-col gap-4">
          <p className="text-xs sm:text-sm text-slate-300">
            Selecione qual arquivo você deseja baixar:
          </p>

          {/* Opção 1: CSV dos Hidrantes */}
          <div className="flex flex-col gap-2.5 p-4 rounded-xl border border-slate-700/70 bg-slate-800/50 hover:bg-slate-800/80 hover:border-cyan-500/50 transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                  <FileText size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-white">
                      Arquivo CSV dos Hidrantes
                    </h4>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      .CSV
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Exporta apenas a tabela com os hidrantes cadastrados, coordenadas, endereços, status operacional e histórico de vistorias/defeitos.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={loadingType !== null}
              className="mt-2 w-full py-2 px-3 bg-cyan-600/20 hover:bg-cyan-600/30 active:bg-cyan-600/40 text-cyan-200 hover:text-white border border-cyan-500/40 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {loadingType === 'csv' ? (
                <>
                  <Loader2 size={16} className="animate-spin text-cyan-400" />
                  <span>Gerando arquivo CSV...</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>Baixar CSV (Hidrantes)</span>
                </>
              )}
            </button>
          </div>

          {/* Opção 2: XLSX de Todos os Dados */}
          <div className="flex flex-col gap-2.5 p-4 rounded-xl border border-slate-700/70 bg-slate-800/50 hover:bg-slate-800/80 hover:border-emerald-500/50 transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                  <FileSpreadsheet size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-white">
                      Arquivo XLSX de Todos os Dados
                    </h4>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      .XLSX
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Exporta a pasta de trabalho completa com 4 abas: <strong>Hidrantes e Vistorias</strong>, <strong>Estudos Pré-Pop</strong>, <strong>Pareceres Técnicos</strong> e <strong>Missões</strong>.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportXLSX}
              disabled={loadingType !== null}
              className="mt-2 w-full py-2 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 active:bg-emerald-600/40 text-emerald-200 hover:text-white border border-emerald-500/40 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {loadingType === 'xlsx' ? (
                <>
                  <Loader2 size={16} className="animate-spin text-emerald-400" />
                  <span>Gerando planilha XLSX...</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>Baixar XLSX (Todos os Dados)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-5 py-3 border-t border-slate-700/80 bg-slate-900/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loadingType !== null}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default DownloadDatabaseModal;
