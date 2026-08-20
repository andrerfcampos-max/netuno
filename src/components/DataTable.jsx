import React, { useState, useMemo } from 'react';
import { LocateFixed, Navigation, Download, Map as MapIcon, MapPin, Plus, Edit, MessageSquareText, AlertTriangle } from 'lucide-react';
import { sanitizeProblem } from '../utils/problemUtils';
import { fixEncoding } from '../utils/textUtils';

const DataTable = ({ data, onCenterMap, onInspect, onEdit, selectedMissionIds = [], onToggleMission, onSelectAllMission, currentUser }) => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [displayCount, setDisplayCount] = useState(50);
  const isGestor = currentUser?.role === 'gestor' || currentUser?.role === 'admin';

  const sortedData = useMemo(() => {
    let sortableItems = [...data];
    if (sortConfig !== null && sortConfig.key) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (aValue == null) aValue = '';
        if (bValue == null) bValue = '';
        
        if (typeof aValue === 'boolean') {
           aValue = aValue ? 1 : 0;
           bValue = bValue ? 1 : 0;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [data, sortConfig]);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === 'ascending'
    ) {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'ascending' ? ' ↑' : ' ↓';
    }
    return '';
  };

  const exportCSV = () => {
    if (!data || data.length === 0) return;
    
    // Exportar na mesma sequência organizada da tabela do sistema
    const headersMap = {
      'Código': 'nomHidrante', 
      'RA': 'dscLocalidade',
      'Status': 'flgAtivo',
      'Data Vistoria': 'datHoraUltimaVistoria',
      'Problemas do Hidrante': 'problemasHidrante',
      'Endereço': 'dscEndereco',
      'Ponto de referência': 'dscPontoReferencia',
      'Coordenadas Geográficas': 'coords',
      'Link Maps': 'maps'
    };
    
    const headers = Object.keys(headersMap);
    const csvRows = [];
    
    // Delimitador padrão no Brasil para o Excel é ponto e vírgula
    csvRows.push(headers.join(';'));
    
    data.forEach(row => {
      const values = headers.map(header => {
        let val = '';
        
        if (header === 'Código') {
          val = row['nomHidrante'] || row['codHidrante'];
        } else if (header === 'Status') {
          val = row.flgAtivo ? 'OPERANTE' : 'INOPERANTE';
        } else if (header === 'Coordenadas Geográficas') {
          val = `${Number(row.numLatitude).toFixed(6)}, ${Number(row.numLongitude).toFixed(6)}`;
        } else if (header === 'Link Maps') {
          val = `https://maps.google.com/maps?q=${Number(row.numLatitude).toFixed(6)},${Number(row.numLongitude).toFixed(6)}`;
        } else {
          const key = headersMap[header];
          val = row[key];
        }
        
        if (val === undefined || val === null) val = '';
        
        // Limpar aspas e quebras de linha para não quebrar o CSV
        const strVal = String(val).replace(/"/g, '""').replace(/\n/g, ' ');
        return `"${strVal}"`;
      });
      csvRows.push(values.join(';'));
    });
    
    const csvString = csvRows.join('\n');
    // Adicionar BOM (\uFEFF) para o Excel reconhecer o UTF-8 automaticamente e não quebrar acentos
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'hidrantes_filtrados.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSortCode = () => {
    requestSort('nomHidrante');
  };

  const isAllSelected = data.length > 0 && data.every(h => selectedMissionIds.includes(h.codHidrante || h._internalId || h.nomHidrante));

  const handleSelectAll = (e) => {
    if (onSelectAllMission) {
      onSelectAllMission(e.target.checked, data);
    }
  };

  return (
    <section className="w-full bg-slate-800 rounded-xl border border-slate-700 p-2.5 sm:p-4 shadow-inner flex flex-col h-full min-h-[300px]">
      
      {/* Header com Total e Exportação */}
      <div className="flex justify-between items-center mb-2.5 sm:mb-4 border-b border-slate-700 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          {isGestor && (
            <div className="flex items-center gap-1.5 bg-slate-750 px-2 py-1 rounded-lg border border-slate-600">
              <input 
                type="checkbox" 
                id="select-all-filtered"
                className="w-4 h-4 cursor-pointer accent-emerald-500 rounded"
                checked={isAllSelected}
                onChange={handleSelectAll}
              />
              <label htmlFor="select-all-filtered" className="text-xs text-slate-300 font-bold cursor-pointer select-none">
                Todos
              </label>
            </div>
          )}
          <h2 className="text-sm sm:text-lg font-bold text-slate-200 truncate">
            Lista de vistorias ({data.length})
          </h2>
        </div>

        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-3 rounded-lg transition-colors shadow-md active:scale-95 text-xs sm:text-sm"
        >
          <Download size={15} />
          <span>Exportar CSV</span>
        </button>
      </div>
      
      {data.length === 0 ? (
        <p className="text-slate-400 text-center py-10">Nenhum hidrante encontrado com os filtros selecionados.</p>
      ) : (
        <>
          {/* ======================================================== */}
          {/* 1. VISUALIZAÇÃO MOBILE EM CARDS TÁTICOS (< md) */}
          {/* ======================================================== */}
          <div className="md:hidden flex-1 overflow-y-auto space-y-2 pr-0.5">
            {sortedData.slice(0, displayCount).map((h, i) => {
              const id = h.codHidrante || h._internalId || h.nomHidrante;
              const isSelected = selectedMissionIds.includes(id);
              const dataFormatada = h.datHoraUltimaVistoria && h.datHoraUltimaVistoria !== '-' 
                ? String(h.datHoraUltimaVistoria).split(' ')[0] 
                : 'Não vistoriado';
              const sanitizedProb = h.problemasHidrante ? fixEncoding(sanitizeProblem(h.problemasHidrante)) : null;

              return (
                <div 
                  key={id || i}
                  className={`bg-slate-850 border rounded-xl p-3 shadow-md transition-all flex flex-col gap-2 ${
                    isSelected ? 'border-emerald-500/80 ring-1 ring-emerald-500/40 bg-slate-800' : 'border-slate-700/80'
                  }`}
                >
                  {/* Topo do Card: Checkbox + Código + Badge de Status */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-750 pb-2">
                    <div className="flex items-center gap-2">
                      {isGestor && (
                        <input 
                          type="checkbox"
                          className="w-4 h-4 cursor-pointer accent-emerald-500 rounded"
                          checked={isSelected}
                          onChange={() => onToggleMission && onToggleMission(id)}
                        />
                      )}
                      <span className="font-mono font-black text-sm text-emerald-400">
                        {fixEncoding(h.nomHidrante || h.codHidrante)}
                      </span>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase shadow-sm border ${
                      h.flgAtivo 
                        ? 'bg-emerald-950/70 text-emerald-400 border-emerald-500/50' 
                        : 'bg-red-950/70 text-red-400 border-red-500/50'
                    }`}>
                      ● {h.flgAtivo ? 'OPERANTE' : 'INOPERANTE'}
                    </span>
                  </div>

                  {/* Informações: RA, Data, Endereço */}
                  <div className="text-xs text-slate-300 space-y-1">
                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span className="font-semibold text-slate-200">📍 {fixEncoding(h.dscLocalidade)}</span>
                      <span>📅 {dataFormatada}</span>
                    </div>

                    {sanitizedProb && (
                      <div className="flex items-start gap-1 p-1.5 rounded bg-rose-950/40 border border-rose-800/60 text-rose-300 text-[11px] font-semibold mt-1">
                        <AlertTriangle size={13} className="text-rose-400 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{sanitizedProb}</span>
                      </div>
                    )}

                    <p className="text-slate-300 text-xs mt-1 leading-snug">
                      <span className="text-slate-400 font-semibold">Endereço: </span>
                      {fixEncoding(h.dscEndereco) || 'Não informado'}
                    </p>

                    {h.dscPontoReferencia && (
                      <p className="text-slate-400 text-[11px] italic">
                        <span className="font-semibold not-italic">Ref: </span>
                        {fixEncoding(h.dscPontoReferencia)}
                      </p>
                    )}
                  </div>

                  {/* Botões de Ação Tátil no Mobile */}
                  <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-750 mt-0.5">
                    <button
                      onClick={() => onCenterMap(h)}
                      className="flex flex-col items-center justify-center py-1.5 bg-slate-750 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold active:scale-95 transition-all border border-slate-650"
                      title="Ver no Mapa"
                    >
                      <MessageSquareText size={15} className="text-cyan-400 mb-0.5" />
                      <span>Dialog</span>
                    </button>

                    <button
                      onClick={() => window.open(`https://waze.com/ul?ll=${h.numLatitude},${h.numLongitude}&navigate=yes`, '_blank')}
                      className="flex flex-col items-center justify-center py-1.5 bg-blue-900/40 hover:bg-blue-800/60 text-blue-300 rounded-lg text-[10px] font-bold active:scale-95 transition-all border border-blue-700/50"
                      title="Navegar com Waze"
                    >
                      <Navigation size={15} className="text-blue-400 mb-0.5" />
                      <span>Waze</span>
                    </button>

                    <button
                      onClick={() => onInspect(h)}
                      className="flex flex-col items-center justify-center py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-[10px] font-black active:scale-95 transition-all shadow-sm"
                      title="Cadastrar Vistoria"
                    >
                      <Plus size={16} strokeWidth={3} className="text-emerald-200 mb-0.5" />
                      <span>Vistoria</span>
                    </button>

                    {isGestor ? (
                      <button
                        onClick={() => onEdit && onEdit(h)}
                        className="flex flex-col items-center justify-center py-1.5 bg-amber-900/40 hover:bg-amber-800/60 text-amber-300 rounded-lg text-[10px] font-bold active:scale-95 transition-all border border-amber-700/50"
                        title="Editar Hidrante"
                      >
                        <Edit size={15} className="text-amber-400 mb-0.5" />
                        <span>Editar</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => window.open(`https://maps.google.com/maps?q=${h.numLatitude},${h.numLongitude}`, '_blank')}
                        className="flex flex-col items-center justify-center py-1.5 bg-slate-750 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold active:scale-95 transition-all border border-slate-650"
                        title="Google Maps"
                      >
                        <MapIcon size={15} className="text-emerald-400 mb-0.5" />
                        <span>Maps</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {sortedData.length > displayCount && (
              <div className="flex justify-center pt-2 pb-4">
                <button 
                  onClick={() => setDisplayCount(prev => prev + 50)}
                  className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl text-xs border border-slate-500 active:scale-95 transition-all shadow"
                >
                  Carregar Mais ({sortedData.length - displayCount} restantes)
                </button>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* 2. VISUALIZAÇÃO DESKTOP EM TABELA COMPLETA (>= md) */}
          {/* ======================================================== */}
          <div className="hidden md:block overflow-auto flex-1 max-h-[400px]">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-700 text-slate-200 sticky top-0 z-10 shadow">
                <tr>
                  {isGestor && (
                    <th className="p-2 text-center w-10">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 cursor-pointer accent-emerald-500"
                        checked={isAllSelected}
                        onChange={handleSelectAll}
                        title="Selecionar Todos os Filtrados"
                      />
                    </th>
                  )}
                  <th className="p-2 cursor-pointer hover:bg-slate-600 transition-colors" onClick={handleSortCode}>
                    Código{getSortIndicator('nomHidrante')}
                  </th>
                  <th className="p-2 cursor-pointer hover:bg-slate-600 transition-colors" onClick={() => requestSort('dscLocalidade')}>
                    RA{getSortIndicator('dscLocalidade')}
                  </th>
                  <th className="p-2 cursor-pointer hover:bg-slate-600 transition-colors" onClick={() => requestSort('flgAtivo')}>
                    Status{getSortIndicator('flgAtivo')}
                  </th>
                  <th className="p-2 cursor-pointer hover:bg-slate-600 transition-colors" onClick={() => requestSort('datHoraUltimaVistoria')}>
                    Data Vistoria{getSortIndicator('datHoraUltimaVistoria')}
                  </th>
                  <th className="p-2 cursor-pointer hover:bg-slate-600 transition-colors" onClick={() => requestSort('problemasHidrante')}>
                    Problemas do Hidrante{getSortIndicator('problemasHidrante')}
                  </th>
                  <th className="p-2 cursor-pointer hover:bg-slate-600 transition-colors" onClick={() => requestSort('dscEndereco')}>
                    Endereço{getSortIndicator('dscEndereco')}
                  </th>
                  <th className="p-2 cursor-pointer hover:bg-slate-600 transition-colors" onClick={() => requestSort('dscPontoReferencia')}>
                    Referência{getSortIndicator('dscPontoReferencia')}
                  </th>
                  <th className="p-2 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sortedData.slice(0, displayCount).map((h, i) => {
                  const id = h.codHidrante || h._internalId || h.nomHidrante;
                  const isSelected = selectedMissionIds.includes(id);
                  return (
                  <tr key={id || i} className={`border-b border-slate-700/50 hover:bg-slate-700/50 transition-colors ${isSelected ? 'bg-cyan-900/20' : ''}`}>
                    {isGestor && (
                      <td className="p-2 text-center">
                        <input 
                          type="checkbox"
                          className="w-4 h-4 cursor-pointer accent-emerald-500"
                          checked={isSelected}
                          onChange={() => onToggleMission && onToggleMission(id)}
                        />
                      </td>
                    )}
                    <td className="p-2 font-medium text-slate-200">{fixEncoding(h.nomHidrante || h.codHidrante)}</td>
                    <td className="p-2">{fixEncoding(h.dscLocalidade)}</td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded text-xs font-bold shadow-sm ${h.flgAtivo ? 'bg-green-900/50 text-green-400 border border-green-800' : 'bg-red-900/50 text-red-400 border border-red-800'}`}>
                        {h.flgAtivo ? 'OPERANTE' : 'INOPERANTE'}
                      </span>
                    </td>
                    <td className="p-2 font-mono text-xs">
                      {h.datHoraUltimaVistoria && h.datHoraUltimaVistoria !== '-' ? String(h.datHoraUltimaVistoria).split(' ')[0] : '-'}
                    </td>
                    <td className="p-2 max-w-[150px]">
                      <div className="truncate text-red-400 font-bold" title={fixEncoding(sanitizeProblem(h.problemasHidrante)) || ''}>
                        {h.problemasHidrante ? fixEncoding(sanitizeProblem(h.problemasHidrante)) : '-'}
                      </div>
                    </td>
                    <td className="p-2 truncate max-w-[150px]" title={fixEncoding(h.dscEndereco)}>{fixEncoding(h.dscEndereco) || '-'}</td>
                    <td className="p-2 truncate max-w-[120px]" title={fixEncoding(h.dscPontoReferencia)}>{fixEncoding(h.dscPontoReferencia) || '-'}</td>
                    <td className="p-2">
                      <div className="flex flex-nowrap items-center justify-center gap-1.5">
                        <button
                          onClick={() => onCenterMap(h)}
                          title="Abrir Dialog no Mapa"
                          className="flex items-center justify-center gap-1 p-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded transition-colors active:scale-95 flex-shrink-0 font-bold text-xs"
                        >
                          <MessageSquareText size={16} />
                        </button>
                        <button
                          onClick={() => window.open(`https://waze.com/ul?ll=${h.numLatitude},${h.numLongitude}&navigate=yes`, '_blank')}
                          title="Abrir no Waze"
                          className="p-1.5 bg-blue-500 hover:bg-blue-400 text-white rounded transition-colors active:scale-95"
                        >
                          <Navigation size={16} />
                        </button>
                        <button
                          onClick={() => window.open(`https://maps.google.com/maps?q=${h.numLatitude},${h.numLongitude}`, '_blank')}
                          title="Google Maps"
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors active:scale-95"
                        >
                          <MapIcon size={16} />
                        </button>
                        <button
                          onClick={() => window.open(`https://maps.google.com/maps?q=&layer=c&cbll=${h.numLatitude},${h.numLongitude}`, '_blank')}
                          title="Street View"
                          className="p-1.5 bg-orange-500 hover:bg-orange-400 text-white rounded transition-colors active:scale-95"
                        >
                          <MapPin size={16} />
                        </button>
                        <button 
                          onClick={() => onInspect(h)}
                          title="Cadastrar Vistoria"
                          className="flex items-center gap-1 p-1.5 px-2 bg-teal-600 hover:bg-teal-500 text-white rounded transition-colors active:scale-95 shadow-sm font-bold text-xs"
                        >
                          <Plus size={18} strokeWidth={3} />
                          CAD. VIST.
                        </button>
                        {isGestor && (
                          <button 
                            onClick={() => onEdit && onEdit(h)}
                            title="Editar Hidrante"
                            className="p-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded transition-colors active:scale-95 shadow-sm"
                          >
                            <Edit size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            {sortedData.length > displayCount && (
              <div className="flex justify-center p-4">
                <button 
                  onClick={() => setDisplayCount(prev => prev + 50)}
                  className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-6 rounded-full transition-colors shadow-lg active:scale-95 text-sm border border-slate-500"
                >
                  Carregar Mais ({sortedData.length - displayCount} restantes)
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default DataTable;
