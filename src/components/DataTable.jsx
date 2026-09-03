import React, { useState, useMemo } from 'react';
import { Navigation, Download, Map as MapIcon, MapPin, Plus, Edit, Edit3, MessageSquareText, AlertTriangle, Wrench } from 'lucide-react';
import { sanitizeProblem } from '../utils/problemUtils';
import { fixEncoding } from '../utils/textUtils';
import { isHydrantSelected } from '../utils/geoUtils';

const parseDateToTimestamp = (dateStr) => {
  if (!dateStr || dateStr === '-') return -Infinity;
  const str = String(dateStr).trim();
  if (!str || str === '-') return -Infinity;
  const [datePart, timePart] = str.split(' ');
  let d = 0, m = 0, y = 0, hh = 0, mm = 0, ss = 0;
  if (datePart && datePart.includes('/')) {
    const parts = datePart.split('/');
    if (parts.length === 3) {
      d = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10) - 1;
      y = parseInt(parts[2], 10);
    }
  } else if (datePart && datePart.includes('-')) {
    const parts = datePart.split('-');
    if (parts.length === 3) {
      y = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10) - 1;
      d = parseInt(parts[2], 10);
    }
  }
  if (timePart && timePart.includes(':')) {
    const tParts = timePart.split(':');
    hh = parseInt(tParts[0], 10) || 0;
    mm = parseInt(tParts[1], 10) || 0;
    ss = parseInt(tParts[2], 10) || 0;
  }
  if (y > 0) {
    const dateObj = new Date(y, m, d, hh, mm, ss);
    if (!isNaN(dateObj.getTime())) return dateObj.getTime();
  }
  return -Infinity;
};

const DataTable = ({ data, onCenterMap, onInspect, onEdit, onEditInspection, selectedMissionIds = [], onToggleMission, onSelectAllMission, currentUser }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'datHoraUltimaVistoria', direction: 'descending' });
  const [displayCount, setDisplayCount] = useState(50);
  const isGestor = currentUser?.role === 'gestor' || currentUser?.role === 'admin';

  const sortedData = useMemo(() => {
    let sortableItems = [...data];
    const key = sortConfig?.key || 'datHoraUltimaVistoria';
    const direction = sortConfig?.direction || 'descending';

    sortableItems.sort((a, b) => {
      let aValue = a[key];
      let bValue = b[key];

      if (key === 'datHoraUltimaVistoria') {
        const timeA = parseDateToTimestamp(aValue);
        const timeB = parseDateToTimestamp(bValue);
        if (timeA === timeB) return 0;
        if (direction === 'ascending') {
          if (timeA === -Infinity) return 1;
          if (timeB === -Infinity) return -1;
          return timeA - timeB;
        } else {
          if (timeA === -Infinity) return 1;
          if (timeB === -Infinity) return -1;
          return timeB - timeA;
        }
      }

      if (aValue == null) aValue = '';
      if (bValue == null) bValue = '';
      
      if (typeof aValue === 'boolean') {
         aValue = aValue ? 1 : 0;
         bValue = bValue ? 1 : 0;
      }

      if (aValue < bValue) {
        return direction === 'ascending' ? -1 : 1;
      }
      if (aValue > bValue) {
        return direction === 'ascending' ? 1 : -1;
      }
      return 0;
    });
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

  const isAllSelected = data.length > 0 && data.every(h => isHydrantSelected(h, selectedMissionIds));

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
          <h2 className="text-sm sm:text-lg font-bold text-slate-200 truncate">
            Lista de vistorias ({data.length})
          </h2>
        </div>

        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white border border-slate-600 font-medium py-1.5 px-3 rounded-lg transition-colors shadow-sm active:scale-95 text-xs sm:text-sm cursor-pointer"
          title="Exportar dados filtrados para planilha CSV"
        >
          <Download size={15} className="text-slate-400" />
          <span>Exportar CSV</span>
        </button>
      </div>
      
      {data.length === 0 ? (
        <p className="text-slate-400 text-center py-10">Nenhum hidrante encontrado com os filtros selecionados.</p>
      ) : (
        <>
          {/* ======================================================== */}
          {/* 1. VISUALIZAÇÃO MOBILE EM CARDS TÁTICOS COMPACTOS (< md) */}
          {/* ======================================================== */}
          <div className="md:hidden flex-1 overflow-y-auto space-y-2 pr-0.5">
            {isGestor && (
              <div className="sticky top-0 z-10 flex items-center justify-between bg-slate-900/95 backdrop-blur-sm border border-slate-700/90 rounded-lg px-2.5 py-1.5 shadow-md">
                <label className="flex items-center gap-2 cursor-pointer text-slate-200 text-xs font-bold select-none">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 cursor-pointer accent-emerald-500 rounded"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                  />
                  <span>Selecionar Todos ({data.length})</span>
                </label>
                <span className="text-[11px] font-semibold text-emerald-400">
                  {selectedMissionIds.length} selecionado(s)
                </span>
              </div>
            )}
            {sortedData.slice(0, displayCount).map((h, i) => {
              const id = h.codHidrante || h._internalId || h.nomHidrante;
              const isSelected = isHydrantSelected(h, selectedMissionIds);
              const dataFormatada = h.datHoraUltimaVistoria && h.datHoraUltimaVistoria !== '-' 
                ? String(h.datHoraUltimaVistoria).split(' ')[0] 
                : 'Não vistoriado';
              const sanitizedProb = h.problemasHidrante ? fixEncoding(sanitizeProblem(h.problemasHidrante)) : null;

              return (
                <div 
                  key={id || i}
                  className={`bg-slate-850 border rounded-xl p-2.5 shadow-md transition-all flex flex-col gap-1.5 ${
                    isSelected ? 'border-emerald-500/80 ring-1 ring-emerald-500/40 bg-slate-800' : 'border-slate-700/80'
                  }`}
                >
                  {/* Topo do Card: Checkbox + Código + Badge de Status */}
                  <div className="flex items-center justify-between gap-1.5 border-b border-slate-750 pb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isGestor && (
                        <input 
                          type="checkbox"
                          className="w-4 h-4 cursor-pointer accent-emerald-500 rounded shrink-0"
                          checked={isSelected}
                          onChange={() => onToggleMission && onToggleMission(id)}
                        />
                      )}
                      <span className="font-mono font-black text-xs sm:text-sm text-emerald-400 truncate">
                        {fixEncoding(h.nomHidrante || h.codHidrante)}
                      </span>
                    </div>

                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase shadow-sm border shrink-0 ${
                      h.flgAtivo 
                        ? 'bg-emerald-950/70 text-emerald-400 border-emerald-500/50' 
                        : 'bg-red-950/70 text-red-400 border-red-500/50'
                    }`}>
                      ● {h.flgAtivo ? 'OPERANTE' : 'INOPERANTE'}
                    </span>
                  </div>

                  {/* Informações: RA, Data, Endereço */}
                  <div className="text-xs text-slate-300 space-y-0.5">
                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span className="font-bold text-slate-200">📍 {fixEncoding(h.dscLocalidade)}</span>
                      <span className="text-[10px]">📅 {dataFormatada}</span>
                    </div>

                    {(sanitizedProb || h.dscObservacao || h.observacoes || (!h.flgAtivo && !h.problemasHidrante)) && (
                      <div className="flex flex-col gap-0.5 p-1 rounded bg-rose-950/40 border border-rose-800/60 text-rose-300 text-[10px] font-semibold my-0.5">
                        <div className="flex items-start gap-1">
                          <AlertTriangle size={12} className="text-rose-400 flex-shrink-0 mt-0.5" />
                          <span className="line-clamp-1">{sanitizedProb || (!h.flgAtivo ? 'INOPERANTE' : '')}</span>
                        </div>
                        {(h.dscObservacao || h.observacoes || h.obsVistoria) && (
                          <div className="text-[9.5px] font-normal text-slate-300 italic pl-4 line-clamp-2">
                            <span className="font-semibold text-slate-400 not-italic">Obs: </span>
                            {fixEncoding(h.dscObservacao || h.observacoes || h.obsVistoria)}
                          </div>
                        )}
                      </div>
                    )}

                    <p className="text-slate-300 text-[11px] leading-tight truncate">
                      <span className="text-slate-400 font-semibold">Endereço: </span>
                      {fixEncoding(h.dscEndereco) || 'Não informado'}
                    </p>

                    {h.dscPontoReferencia && (
                      <p className="text-slate-400 text-[10px] italic leading-tight truncate">
                        <span className="font-semibold not-italic">Ref: </span>
                        {fixEncoding(h.dscPontoReferencia)}
                      </p>
                    )}
                  </div>

                  {/* Barra de Ações Táticas: Linha 1 (Principais de Deslocamento: Waze 4x e Street View 3x) + Linha 2 (Secundários 1x) */}
                  <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-750">
                    {/* LINHA 1: Waze 4x e Street View 3x */}
                    <div className="flex items-center gap-1.5 w-full">
                      <button
                        onClick={() => window.open(`https://waze.com/ul?ll=${h.numLatitude},${h.numLongitude}&navigate=yes`, '_blank')}
                        style={{ backgroundColor: '#2563eb' }}
                        className="flex-[4] h-9 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white rounded-lg font-extrabold text-[11px] shadow-sm flex items-center justify-center gap-1.5 transition-all tracking-wide min-w-0 border border-blue-400/40"
                        title="Navegar pelo Waze"
                      >
                        <Navigation size={14} className="shrink-0 text-white" />
                        <span className="truncate font-black text-white">NAVEGAR NO WAZE</span>
                      </button>

                      <button
                        onClick={() => window.open(`https://maps.google.com/maps?q=&layer=c&cbll=${h.numLatitude},${h.numLongitude}`, '_blank')}
                        style={{ backgroundColor: '#d97706' }}
                        className="flex-[3] h-9 bg-amber-600 hover:bg-amber-500 active:scale-98 text-white rounded-lg font-bold text-[11px] shadow-sm flex items-center justify-center gap-1 transition-all tracking-wide min-w-0 border border-amber-400/40"
                        title="Google Street View 360°"
                      >
                        <MapPin size={14} className="shrink-0 text-amber-200" />
                        <span className="truncate text-white">STREET VIEW</span>
                      </button>
                    </div>

                    {/* LINHA 2: Ações Secundárias (1x homogêneo conforme dialog) */}
                    <div className="flex items-center gap-1 w-full">
                      {/* Vistoria */}
                      <button
                        onClick={() => onInspect(h)}
                        className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-lg font-bold flex items-center justify-center gap-1 shadow-sm transition-all text-[10px] min-w-0"
                        title="Cadastrar Nova Vistoria Técnica"
                      >
                        <Plus size={13} strokeWidth={3} />
                        <span className="truncate uppercase font-extrabold">VISTORIA</span>
                      </button>

                      {/* Editar Vistoria */}
                      {Boolean((h.datHoraUltimaVistoria && h.datHoraUltimaVistoria !== '-') || (h.HISTORICO_VISTORIAS && h.HISTORICO_VISTORIAS.length > 0)) && onEditInspection && (
                        <button
                          onClick={() => onEditInspection(h)}
                          className="flex-1 h-8 bg-orange-600 hover:bg-orange-500 active:scale-95 text-white rounded-lg font-bold flex items-center justify-center gap-1 shadow-sm transition-all text-[10px] min-w-0 border border-orange-400/40"
                          title="Editar Vistoria Cadastrada"
                        >
                          <Edit3 size={12} strokeWidth={2.5} />
                          <span className="truncate uppercase font-extrabold">EDIT VIST.</span>
                        </button>
                      )}

                      {/* Editar Hidrante */}
                      {isGestor && (
                        <button
                          onClick={() => onEdit && onEdit(h)}
                          className="flex-1 h-8 bg-slate-750 hover:bg-slate-700 active:scale-95 text-cyan-300 rounded-lg flex items-center justify-center gap-1 shadow-sm transition-colors text-[10px] min-w-0 border border-cyan-500/40"
                          title="Editar Cadastro do Hidrante"
                        >
                          <Wrench size={12} className="text-cyan-400" />
                          <span className="truncate uppercase font-extrabold text-slate-100">EDIT HIDR.</span>
                        </button>
                      )}

                      {/* Google Maps */}
                      <button
                        onClick={() => window.open(`https://maps.google.com/maps?q=${h.numLatitude},${h.numLongitude}`, '_blank')}
                        className="h-8 px-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 border border-slate-700 rounded-lg font-bold flex items-center justify-center gap-1 transition-all shadow-sm text-[10px]"
                        title="Abrir no Google Maps"
                      >
                        <MapIcon size={12} className="text-emerald-400" />
                        <span className="hidden sm:inline">Maps</span>
                      </button>

                      {/* Detalhes / Ficha no Mapa */}
                      <button
                        onClick={() => onCenterMap(h)}
                        className="h-8 px-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-cyan-300 border border-slate-700 rounded-lg font-bold flex items-center justify-center gap-1 transition-all shadow-sm text-[10px]"
                        title="Ver no Mapa / Abrir Ficha"
                      >
                        <MessageSquareText size={12} className="text-cyan-400" />
                        <span className="hidden sm:inline">Ficha</span>
                      </button>

                      {/* Rota (se gestor) */}
                      {isGestor && onToggleMission && (
                        <button
                          onClick={() => onToggleMission(h.codHidrante || h._internalId || h.nomHidrante)}
                          className={`h-8 px-2 rounded-lg font-bold flex items-center justify-center gap-0.5 shadow-sm transition-all active:scale-95 text-[10px] ${
                            (selectedMissionIds.includes(h.codHidrante) || selectedMissionIds.includes(h.nomHidrante) || selectedMissionIds.includes(h._internalId))
                              ? 'bg-rose-600 text-white ring-1 ring-rose-400'
                              : 'bg-cyan-600 hover:bg-cyan-500 text-white ring-1 ring-cyan-400/40'
                          }`}
                          title="Alternar na Rota da Missão"
                        >
                          <span>{(selectedMissionIds.includes(h.codHidrante) || selectedMissionIds.includes(h.nomHidrante) || selectedMissionIds.includes(h._internalId)) ? '✕' : '+'}</span>
                          <span>Rota</span>
                        </button>
                      )}
                    </div>
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
                  const isSelected = isHydrantSelected(h, selectedMissionIds);
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
                    <td className="p-2 max-w-[200px]">
                      <div className="truncate text-red-400 font-bold" title={fixEncoding(sanitizeProblem(h.problemasHidrante)) || ''}>
                        {h.problemasHidrante ? fixEncoding(sanitizeProblem(h.problemasHidrante)) : (!h.flgAtivo ? 'INOPERANTE' : '-')}
                      </div>
                      {(h.dscObservacao || h.observacoes || h.obsVistoria) && (
                        <div className="truncate text-[10px] text-slate-400 italic" title={fixEncoding(h.dscObservacao || h.observacoes || h.obsVistoria)}>
                          <span className="font-semibold text-slate-500 not-italic">Obs: </span>
                        {fixEncoding(h.dscObservacao || h.observacoes || h.obsVistoria)}
                        </div>
                      )}
                    </td>
                    <td className="p-2 truncate max-w-[150px]" title={fixEncoding(h.dscEndereco)}>{fixEncoding(h.dscEndereco) || '-'}</td>
                    <td className="p-2 truncate max-w-[120px]" title={fixEncoding(h.dscPontoReferencia)}>{fixEncoding(h.dscPontoReferencia) || '-'}</td>
                    <td className="p-2">
                      <div className="flex flex-nowrap items-center justify-center gap-1.5">
                        {/* Principais de Deslocamento: Waze e Street View destacados */}
                        <button
                          onClick={() => window.open(`https://waze.com/ul?ll=${h.numLatitude},${h.numLongitude}&navigate=yes`, '_blank')}
                          title="Navegar pelo Waze"
                          style={{ backgroundColor: '#2563eb' }}
                          className="flex items-center gap-1 py-1 px-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-black transition-all active:scale-95 border border-blue-400/40 shadow-sm"
                        >
                          <Navigation size={13} className="text-white" />
                          <span>Waze</span>
                        </button>

                        <button
                          onClick={() => window.open(`https://maps.google.com/maps?q=&layer=c&cbll=${h.numLatitude},${h.numLongitude}`, '_blank')}
                          title="Google Street View 360°"
                          style={{ backgroundColor: '#d97706' }}
                          className="flex items-center gap-1 py-1 px-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-all active:scale-95 border border-amber-400/40 shadow-sm"
                        >
                          <MapPin size={13} className="text-amber-200" />
                          <span>360°</span>
                        </button>

                        <div className="w-[1px] h-5 bg-slate-700 mx-0.5"></div>

                        {/* Secundários: Vistoria, Edit Vist, Edit Hidr, Maps, Detalhes */}
                        <button 
                          onClick={() => onInspect(h)}
                          title="Cadastrar Nova Vistoria Técnica"
                          className="flex items-center gap-1 py-1 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black transition-all active:scale-95 shadow-sm"
                        >
                          <Plus size={14} strokeWidth={3} />
                          <span>VISTORIA</span>
                        </button>

                        {Boolean((h.datHoraUltimaVistoria && h.datHoraUltimaVistoria !== '-') || (h.HISTORICO_VISTORIAS && h.HISTORICO_VISTORIAS.length > 0)) && onEditInspection && (
                          <button 
                            onClick={() => onEditInspection(h)}
                            title="Editar Vistoria Cadastrada"
                            className="flex items-center gap-1 py-1 px-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm border border-orange-400/40"
                          >
                            <Edit3 size={13} strokeWidth={2.5} />
                            <span>EDIT VIST.</span>
                          </button>
                        )}

                        {isGestor && (
                          <button
                            onClick={() => onEdit && onEdit(h)}
                            title="Editar Cadastro do Hidrante"
                            className="flex items-center gap-1 py-1 px-2 bg-slate-750 hover:bg-slate-700 text-cyan-300 rounded-lg text-xs font-bold transition-all active:scale-95 border border-cyan-500/40 shadow-sm"
                          >
                            <Wrench size={13} className="text-cyan-400" />
                            <span className="hidden lg:inline text-slate-100">EDIT HIDR.</span>
                          </button>
                        )}

                        <button
                          onClick={() => window.open(`https://maps.google.com/maps?q=${h.numLatitude},${h.numLongitude}`, '_blank')}
                          title="Abrir no Google Maps"
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition-colors active:scale-95"
                        >
                          <MapIcon size={14} className="text-emerald-400" />
                        </button>

                        <button
                          onClick={() => onCenterMap(h)}
                          title="Abrir Detalhes e Ficha no Mapa"
                          className="flex items-center justify-center p-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 rounded-lg transition-colors active:scale-95"
                        >
                          <MessageSquareText size={14} />
                        </button>
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
