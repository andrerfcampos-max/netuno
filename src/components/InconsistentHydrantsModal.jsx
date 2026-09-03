import React, { useState } from 'react';
import { X, AlertTriangle, Edit, Trash2, CheckCircle2, MapPin, RefreshCw, ShieldAlert } from 'lucide-react';
import { isValidDFCoordinate } from '../utils/geoUtils';
import { fixEncoding } from '../utils/textUtils';

const InconsistentHydrantsModal = ({ isOpen, onClose, hidrantes = [], onEditHydrant, onDeleteHydrant, currentUser }) => {
  const [searchFilter, setSearchFilter] = useState('');

  if (!isOpen) return null;

  // Filtra hidrantes com coordenadas inválidas OU reportados como removidos em vistoria de campo
  const isHydrantInconsistent = (h) => {
    const isCoordInvalid = !isValidDFCoordinate(h.numLatitude, h.numLongitude);
    const isRemovido = Boolean(
      h.isInconsistent || 
      h.flgRemovido || 
      (h.problemasHidrante && h.problemasHidrante.toLowerCase().includes('removido ou não encontrado'))
    );
    return isCoordInvalid || isRemovido;
  };

  const inconsistentList = hidrantes.filter(isHydrantInconsistent);

  const filteredInconsistent = inconsistentList.filter(h => {
    const code = (h.nomHidrante || h.codHidrante || '').toLowerCase();
    const ra = (h.dscLocalidade || '').toLowerCase();
    const end = (h.dscEndereco || '').toLowerCase();
    const term = searchFilter.toLowerCase();
    return code.includes(term) || ra.includes(term) || end.includes(term);
  });

  const getInconsistencyReason = (h) => {
    const isRemovido = Boolean(
      h.isInconsistent || 
      h.flgRemovido || 
      (h.problemasHidrante && h.problemasHidrante.toLowerCase().includes('removido ou não encontrado'))
    );
    if (isRemovido) return 'Hidrante Removido em Vistoria (Avaliar Exclusão Definitiva)';
    const lat = parseFloat(h.numLatitude);
    const lng = parseFloat(h.numLongitude);
    if (isNaN(lat) || isNaN(lng)) return 'Coordenadas Não Numéricas / Indefinidas';
    if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return 'Coordenadas Zeradas (0, 0 / Oceano)';
    if (lat > 0 || lng > 0) return 'Coordenadas no Hemisfério Incorreto / Fora do Brasil';
    if (lat < -40 || lng > -20) return 'Coordenadas Invertidas ou Anômalas';
    return 'Fora do Perímetro do Distrito Federal / Oceano';
  };

  const handleDelete = (h) => {
    const code = h.nomHidrante || h.codHidrante || h._internalId;
    if (window.confirm(`Tem certeza que deseja EXCLUIR o hidrante "${code}" permanentemente da base de dados?`)) {
      onDeleteHydrant(h);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-700/80 text-slate-100">
        
        {/* CABEÇALHO PADRONIZADO */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-slate-900 border-b border-slate-700/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button 
              type="button"
              onClick={onClose} 
              className="text-xs px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg font-semibold transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
            >
              ← Voltar
            </button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center text-white shadow-md shadow-amber-950/50 shrink-0">
              <ShieldAlert size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate flex items-center gap-2">
                <span>Hidrantes Inconsistentes & Removidos</span>
                <span className="bg-amber-500/20 text-amber-300 text-xs px-2 py-0.5 rounded-full border border-amber-500/40 font-semibold">
                  {inconsistentList.length} encontrados
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Hidrantes com anomalias de coordenadas ou reportados como removidos em vistoria para avaliação e exclusão do Gestor
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Informative Banner */}
        <div className="bg-amber-950/40 border-b border-amber-800/40 p-3 sm:px-6 flex flex-col sm:flex-row gap-2.5 items-start sm:items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400 shrink-0" />
            <span>
              Hidrantes com coordenadas fora do Distrito Federal, nulas ou no oceano. O gestor pode <strong>Editar Coordenadas</strong> para reposicioná-los no DF ou <strong>Excluir</strong> do sistema.
            </span>
          </div>
          <input 
            type="text" 
            placeholder="Buscar por código, RA..." 
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none w-full sm:w-56 shrink-0"
          />
        </div>

        {/* Content Table */}
        <div className="p-4 overflow-y-auto flex-1">
          {inconsistentList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <CheckCircle2 size={48} className="text-emerald-400 mb-3" />
              <p className="font-semibold text-slate-200">Excelente! Nenhum hidrante inconsistente ou com pendência de exclusão.</p>
              <p className="text-xs text-slate-400 mt-1">Todos os hidrantes da base de dados possuem coordenadas válidas no DF e nenhuma solicitação de exclusão pendente.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-700/80 rounded-xl shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900/90 text-slate-300 font-semibold border-b border-slate-700/80">
                  <tr>
                    <th className="p-3">Código / Nome</th>
                    <th className="p-3">Região (RA)</th>
                    <th className="p-3">Latitude</th>
                    <th className="p-3">Longitude</th>
                    <th className="p-3">Motivo do Alerta</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60 bg-slate-800/40">
                  {filteredInconsistent.map((h, idx) => (
                    <tr key={h._internalId || h.codHidrante || idx} className="hover:bg-slate-800/80 transition-colors">
                      <td className="p-3 font-bold text-amber-300 font-mono">
                        {fixEncoding(h.nomHidrante || h.codHidrante || '-')}
                      </td>
                      <td className="p-3 text-slate-300">
                        {fixEncoding(h.dscLocalidade || 'Não informada')}
                      </td>
                      <td className="p-3 font-mono text-red-300">
                        {h.numLatitude !== undefined && h.numLatitude !== null && !isNaN(h.numLatitude) ? Number(h.numLatitude).toFixed(6) : 'Inválida'}
                      </td>
                      <td className="p-3 font-mono text-red-300">
                        {h.numLongitude !== undefined && h.numLongitude !== null && !isNaN(h.numLongitude) ? Number(h.numLongitude).toFixed(6) : 'Inválida'}
                      </td>
                      <td className="p-3">
                        <span className="inline-block bg-red-950/80 text-red-300 border border-red-800/80 px-2 py-0.5 rounded text-[11px] font-medium">
                          {getInconsistencyReason(h)}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onEditHydrant(h);
                            }}
                            className="px-2 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                            title="Editar Coordenadas / Dados"
                          >
                            <Edit size={13} />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(h)}
                            className="px-2 py-1.5 bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-500/40 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                            title="Excluir Hidrante"
                          >
                            <Trash2 size={13} />
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:px-6 border-t border-slate-700/80 bg-slate-900 flex justify-between items-center text-xs text-slate-400">
          <span>Exclusivo para Gestores e Administradores</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-semibold transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};

export default InconsistentHydrantsModal;
