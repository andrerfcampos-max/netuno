import React, { useState } from 'react';
import { X, AlertTriangle, Edit, Trash2, CheckCircle2, MapPin, RefreshCw, ShieldAlert } from 'lucide-react';
import { isValidDFCoordinate } from '../utils/geoUtils';

const InconsistentHydrantsModal = ({ isOpen, onClose, hidrantes = [], onEditHydrant, onDeleteHydrant, currentUser }) => {
  const [searchFilter, setSearchFilter] = useState('');

  if (!isOpen) return null;

  // Filtra hidrantes que possuem coordenadas inválidas ou fora do DF
  const inconsistentList = hidrantes.filter(h => !isValidDFCoordinate(h.numLatitude, h.numLongitude));

  const filteredInconsistent = inconsistentList.filter(h => {
    const code = (h.nomHidrante || h.codHidrante || '').toLowerCase();
    const ra = (h.dscLocalidade || '').toLowerCase();
    const end = (h.dscEndereco || '').toLowerCase();
    const term = searchFilter.toLowerCase();
    return code.includes(term) || ra.includes(term) || end.includes(term);
  });

  const getInconsistencyReason = (h) => {
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
    <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 w-full max-w-4xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-amber-600/50">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-900">
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={onClose} 
              className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded font-semibold transition-colors"
            >
              ← Voltar
            </button>
            <div className="flex items-center gap-2">
              <ShieldAlert className="text-amber-400" size={24} />
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Hidrantes com Coordenadas Inconsistentes
                  <span className="bg-amber-500/20 text-amber-300 text-xs px-2 py-0.5 rounded-full border border-amber-500/40">
                    {inconsistentList.length} encontrados
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Pré-tratamento geográfico: Estes hidrantes são ocultados do mapa para não quebrar a visualização.
                </p>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-red-400 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Informative Banner */}
        <div className="bg-amber-950/40 border-b border-amber-800/40 p-3 px-4 flex items-center justify-between text-xs text-amber-200">
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
            className="bg-slate-900 border border-slate-700 text-slate-200 px-3 py-1 rounded text-xs focus:ring-1 focus:ring-amber-500 outline-none w-48"
          />
        </div>

        {/* Content Table */}
        <div className="p-4 overflow-y-auto flex-1">
          {inconsistentList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <CheckCircle2 size={48} className="text-emerald-400 mb-3" />
              <p className="font-semibold text-slate-200">Excelente! Nenhum hidrante com coordenada inconsistente.</p>
              <p className="text-xs text-slate-400 mt-1">Todos os hidrantes da base de dados possuem coordenadas válidas no Distrito Federal.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-700 rounded-lg shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900/80 text-slate-300 font-semibold border-b border-slate-700">
                  <tr>
                    <th className="p-2.5">Código / Nome</th>
                    <th className="p-2.5">Região (RA)</th>
                    <th className="p-2.5">Latitude</th>
                    <th className="p-2.5">Longitude</th>
                    <th className="p-2.5">Motivo do Alerta</th>
                    <th className="p-2.5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60 bg-slate-800/60">
                  {filteredInconsistent.map((h, idx) => (
                    <tr key={h._internalId || h.codHidrante || idx} className="hover:bg-slate-700/40 transition-colors">
                      <td className="p-2.5 font-bold text-amber-300 font-mono">
                        {h.nomHidrante || h.codHidrante || '-'}
                      </td>
                      <td className="p-2.5 text-slate-300">
                        {h.dscLocalidade || 'Não informada'}
                      </td>
                      <td className="p-2.5 font-mono text-red-300">
                        {h.numLatitude !== undefined && h.numLatitude !== null && !isNaN(h.numLatitude) ? Number(h.numLatitude).toFixed(6) : 'Inválida'}
                      </td>
                      <td className="p-2.5 font-mono text-red-300">
                        {h.numLongitude !== undefined && h.numLongitude !== null && !isNaN(h.numLongitude) ? Number(h.numLongitude).toFixed(6) : 'Inválida'}
                      </td>
                      <td className="p-2.5">
                        <span className="inline-block bg-red-950/80 text-red-300 border border-red-800/80 px-2 py-0.5 rounded text-[11px] font-medium">
                          {getInconsistencyReason(h)}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onEditHydrant(h);
                            }}
                            className="p-1.5 bg-blue-600/80 hover:bg-blue-500 text-white rounded transition-colors flex items-center gap-1 text-[11px] font-semibold"
                            title="Editar Coordenadas / Dados"
                          >
                            <Edit size={13} />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(h)}
                            className="p-1.5 bg-red-600/80 hover:bg-red-500 text-white rounded transition-colors flex items-center gap-1 text-[11px] font-semibold"
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
        <div className="p-3 border-t border-slate-700 bg-slate-900 flex justify-between items-center text-xs text-slate-400">
          <span>Exclusivo para Gestores e Administradores</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded font-semibold transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};

export default InconsistentHydrantsModal;
