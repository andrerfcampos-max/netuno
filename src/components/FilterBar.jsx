import React, { useState, useMemo } from 'react';
import { Search, MapPin, AlertCircle, SlidersHorizontal, X, Check, Filter } from 'lucide-react';

const FilterBar = ({ onFilterChange, regions, anos = [], problemasAtivos = [], isVisible, currentUser, onLogout, filteredCount = null }) => {
  const [filters, setFilters] = useState(() => {
    try {
      const saved = localStorage.getItem('netuno_saved_filters');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          buscaGeral: parsed.buscaGeral || '',
          ra: parsed.ra || '',
          periodo: parsed.periodo || '',
          dataInicio: parsed.dataInicio || '',
          dataFim: parsed.dataFim || '',
          status: parsed.status || 'Todos',
          problema: parsed.problema || ''
        };
      }
    } catch (e) {
      console.warn('Erro ao carregar filtros persistidos', e);
    }
    return {
      buscaGeral: '',
      ra: '',
      periodo: '',
      dataInicio: '',
      dataFim: '',
      status: 'Todos',
      problema: ''
    };
  });

  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const activeSecondaryFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.status && filters.status !== 'Todos') count++;
    if (filters.periodo && filters.periodo !== '') count++;
    if (filters.problema && filters.problema !== '') count++;
    return count;
  }, [filters.status, filters.periodo, filters.problema]);

  const hasAnyFilterActive = useMemo(() => {
    return Boolean(
      (filters.ra && filters.ra !== '') ||
      (filters.buscaGeral && filters.buscaGeral.trim() !== '') ||
      (filters.status && filters.status !== 'Todos') ||
      (filters.periodo && filters.periodo !== '') ||
      (filters.problema && filters.problema !== '')
    );
  }, [filters]);

  const handleChange = (key, value) => {
    let newFilters = { ...filters, [key]: value };
    if (key === 'ra') {
      if (newFilters.problema) newFilters.problema = '';
    }
    setFilters(newFilters);
    try {
      localStorage.setItem('netuno_saved_filters', JSON.stringify(newFilters));
    } catch (e) {}
    onFilterChange(newFilters);
  };

  const handleClearFilters = () => {
    const defaultFilters = {
      buscaGeral: '',
      ra: '',
      periodo: '',
      dataInicio: '',
      dataFim: '',
      status: 'Todos',
      problema: ''
    };
    setFilters(defaultFilters);
    try {
      localStorage.removeItem('netuno_saved_filters');
    } catch (e) {}
    onFilterChange(defaultFilters);
  };

  const handlePeriodoChange = (val) => {
    let newFilters = { ...filters, periodo: val };
    if (val !== 'personalizado') {
       newFilters.dataInicio = '';
       newFilters.dataFim = '';
    }
    setFilters(newFilters);
    try {
      localStorage.setItem('netuno_saved_filters', JSON.stringify(newFilters));
    } catch (e) {}
    onFilterChange(newFilters);
  };

  if (!isVisible) return null;

  return (
    <div className="w-full z-20 transition-all duration-300">
      
      {/* ======================================================== */}
      {/* 1. VISUALIZAÇÃO MOBILE COMPACTA (< md): 1 LINHA ENXUTA */}
      {/* ======================================================== */}
      <div className="md:hidden flex items-center gap-1.5 bg-slate-800/95 border border-slate-700/80 rounded-xl p-1.5 shadow-md">
        
        {/* Seletor de RA Compacto */}
        <div className="relative flex-1 min-w-[130px]">
          <select 
            className={`w-full h-9 pl-7 pr-2 rounded-lg text-xs font-semibold focus:outline-none transition-all truncate ${
              filters.ra && filters.ra !== ''
                ? 'bg-slate-850 border border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/30' 
                : 'bg-slate-900 border border-slate-700 text-slate-300'
            }`}
            value={filters.ra}
            onChange={(e) => handleChange('ra', e.target.value)}
          >
            <option value="" className="bg-slate-900 text-slate-400">🎯 Escolha a RA...</option>
            {regions.map(r => {
              const name = typeof r === 'object' && r ? r.name : r;
              return <option key={name} value={name} className="bg-slate-900 text-white">{name}</option>;
            })}
          </select>
          <MapPin size={14} className={`absolute left-2 top-2.5 pointer-events-none ${filters.ra ? 'text-emerald-400' : 'text-slate-400'}`} />
        </div>

        {/* Busca Livre Rápida */}
        <div className="relative flex-1 min-w-[100px]">
          <input 
            type="text" 
            placeholder="Buscar..." 
            className="w-full h-9 pl-7 pr-6 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            value={filters.buscaGeral}
            onChange={(e) => handleChange('buscaGeral', e.target.value)}
          />
          <Search size={13} className="absolute left-2 top-3 text-slate-400 pointer-events-none" />
          {filters.buscaGeral && (
            <button 
              onClick={() => handleChange('buscaGeral', '')}
              className="absolute right-2 top-2 text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Botão de Filtros Avançados (Drawer Trigger) */}
        <button
          type="button"
          onClick={() => setIsMobileDrawerOpen(true)}
          className={`h-9 px-2.5 flex items-center gap-1 rounded-lg text-xs font-bold transition-all flex-shrink-0 relative ${
            activeSecondaryFiltersCount > 0
              ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/40'
              : 'bg-slate-700/80 border border-slate-600 text-slate-300 hover:bg-slate-600'
          }`}
          title="Filtros Avançados (Status, Período, Problemas)"
        >
          <SlidersHorizontal size={14} />
          <span className="hidden xs:inline">Filtros</span>
          {activeSecondaryFiltersCount > 0 && (
            <span className="bg-amber-400 text-slate-950 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
              {activeSecondaryFiltersCount}
            </span>
          )}
        </button>

        {/* Botão Rápido de Limpar Filtros se houver algo ativo */}
        {hasAnyFilterActive && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="h-9 px-2 bg-rose-950/60 border border-rose-800/80 text-rose-300 hover:bg-rose-900 rounded-lg text-xs font-bold transition-all flex items-center justify-center flex-shrink-0"
            title="Limpar todos os filtros"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ======================================================== */}
      {/* DRAWER / BOTTOM SHEET MOBILE DE FILTROS AVANÇADOS */}
      {/* ======================================================== */}
      {isMobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-[100] flex flex-col justify-end bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div 
            className="w-full bg-slate-900 border-t border-slate-700 rounded-t-2xl p-4 shadow-2xl flex flex-col max-h-[85vh] overflow-y-auto animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Drawer */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  Filtros Avançados {filteredCount !== null && <span className="text-xs text-emerald-400 font-bold font-mono">({filteredCount})</span>}
                </h3>
                {activeSecondaryFiltersCount > 0 && (
                  <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs px-2 py-0.5 rounded-full font-bold">
                    {activeSecondaryFiltersCount} ativos
                  </span>
                )}
              </div>
              <button 
                onClick={() => setIsMobileDrawerOpen(false)}
                className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Conteúdo do Drawer */}
            <div className="flex flex-col gap-4">
              
              {/* 1. Cidade / RA no Drawer */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                    <MapPin size={14} className="text-emerald-400" />
                    Cidade / Região Administrativa
                  </label>
                  {filters.ra && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-500/40">
                      {filters.ra}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <select 
                    className={`w-full p-2.5 pl-8 rounded-lg text-sm font-semibold focus:outline-none transition-all ${
                      filters.ra && filters.ra !== ''
                        ? 'bg-slate-800 border-2 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/30' 
                        : 'bg-slate-800 border border-slate-700 text-white'
                    }`}
                    value={filters.ra}
                    onChange={(e) => handleChange('ra', e.target.value)}
                  >
                    <option value="" className="bg-slate-900 text-slate-400">🎯 Selecione uma Cidade / RA...</option>
                    {regions.map(r => {
                      const name = typeof r === 'object' && r ? r.name : r;
                      return <option key={name} value={name} className="bg-slate-900 text-white">{name}</option>;
                    })}
                  </select>
                  <MapPin size={15} className={`absolute left-2.5 top-3 pointer-events-none ${filters.ra ? 'text-emerald-400' : 'text-slate-400'}`} />
                </div>
              </div>

              {/* 2. Busca Livre no Drawer */}
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Search size={14} className="text-cyan-400" />
                  Busca Livre (Nome / Rua / Código)
                </label>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Ex: Sobradinho, Q.02, SOB00019..." 
                    className="w-full p-2.5 pl-8 pr-8 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    value={filters.buscaGeral}
                    onChange={(e) => handleChange('buscaGeral', e.target.value)}
                  />
                  <Search size={15} className="absolute left-2.5 top-3 text-slate-400 pointer-events-none" />
                  {filters.buscaGeral && (
                    <button 
                      onClick={() => handleChange('buscaGeral', '')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white text-sm p-0.5"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {filteredCount !== null && (
                  <div className="mt-1.5 flex items-center justify-between text-xs px-1">
                    <span className={`font-semibold flex items-center gap-1 ${filteredCount > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {filteredCount > 0 ? `✓ ${filteredCount} hidrante(s) encontrado(s)` : `⚠️ Nenhum hidrante encontrado`}
                    </span>
                    {filters.buscaGeral && <span className="text-[10px] text-slate-400">Filtrando em tempo real</span>}
                  </div>
                )}
              </div>

              {/* 3. Status Operacional */}
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 block">
                  Status Operacional
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    type="button"
                    onClick={() => handleChange('status', 'Todos')}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                      filters.status === 'Todos' 
                        ? 'bg-slate-700 border-slate-500 text-white ring-2 ring-slate-400/30' 
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    Todos
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleChange('status', 'Operante')}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                      filters.status === 'Operante' 
                        ? 'bg-emerald-600 border-emerald-500 text-white ring-2 ring-emerald-400/30' 
                        : 'bg-slate-800 border-slate-700 text-emerald-400/70'
                    }`}
                  >
                    ● Operantes
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleChange('status', 'Inoperante')}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                      filters.status === 'Inoperante' 
                        ? 'bg-red-600 border-red-500 text-white ring-2 ring-red-400/30' 
                        : 'bg-slate-800 border-slate-700 text-red-400/70'
                    }`}
                  >
                    ● Inoperantes
                  </button>
                </div>
              </div>

              {/* Período da Vistoria */}
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 block">
                  Data da Vistoria
                </label>
                <select 
                  className="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                  value={filters.periodo}
                  onChange={(e) => handlePeriodoChange(e.target.value)}
                >
                  <option value="">Todo o período</option>
                  <option value="hoje">Hoje</option>
                  <option value="semana">Esta semana</option>
                  <option value="mes">Este mês</option>
                  <option value="ano_atual">Este ano</option>
                  <option value="personalizado">Personalizado...</option>
                  {anos.length > 0 && (
                    <optgroup label="Por Ano Específico">
                      {anos.map(a => <option key={a} value={`ano-${a}`}>{a}</option>)}
                    </optgroup>
                  )}
                </select>

                {filters.periodo === 'personalizado' && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">Data Início:</span>
                      <input 
                        type="date" 
                        value={filters.dataInicio} 
                        onChange={(e) => handleChange('dataInicio', e.target.value)}
                        className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">Data Fim:</span>
                      <input 
                        type="date" 
                        value={filters.dataFim} 
                        onChange={(e) => handleChange('dataFim', e.target.value)}
                        className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Filtro de Problemas */}
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <AlertCircle size={14} className="text-orange-400" />
                  Problema Específico
                </label>
                <select 
                  className="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                  value={filters.problema}
                  onChange={(e) => handleChange('problema', e.target.value)}
                >
                  <option value="">Qualquer problema...</option>
                  {problemasAtivos.map((d, idx) => (
                    <option key={`${d}-${idx}`} value={d}>{d}</option>
                  ))}
                </select>
              </div>

            </div>

            {/* Ações do Rodapé do Drawer */}
            <div className="flex items-center gap-2 mt-6 pt-3 border-t border-slate-800">
              {hasAnyFilterActive && (
                <button
                  type="button"
                  onClick={() => {
                    handleClearFilters();
                    setIsMobileDrawerOpen(false);
                  }}
                  className="w-1/3 py-3 bg-slate-800 hover:bg-slate-700 text-rose-400 font-bold rounded-xl text-xs transition-all border border-slate-700"
                >
                  Limpar
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2"
              >
                <Check size={18} />
                {filteredCount !== null ? `Aplicar e Ver ${filteredCount} Hidrante(s)` : 'Aplicar Filtros'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. VISUALIZAÇÃO DESKTOP (>= md): GRADE HORIZONTAL COMPLETA */}
      {/* ======================================================== */}
      <div className="hidden md:block bg-slate-800/90 backdrop-blur-md border border-slate-700 shadow-md rounded-xl p-2 sm:p-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2">
            
          {/* 1. Filtro por RA */}
          <div className="flex flex-col gap-0.5 sm:col-span-1 lg:col-span-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 text-emerald-400">
                <MapPin size={13} className="text-emerald-400 animate-pulse" />
                Cidade / RA
              </label>
              {filters.ra ? (
                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.2 rounded border border-emerald-500/40">
                  Ativo
                </span>
              ) : (
                <span className="text-[9px] bg-slate-700 text-slate-300 font-semibold px-1.5 py-0.2 rounded">
                  Todas
                </span>
              )}
            </div>
            <select 
              className={`min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs sm:text-sm text-white focus:outline-none transition-all duration-300 font-medium ${
                filters.ra && filters.ra !== ''
                  ? 'bg-slate-800 border-2 border-emerald-500 ring-2 ring-emerald-500/30 text-emerald-300' 
                  : 'bg-slate-850 border border-cyan-500/60 ring-1 ring-cyan-500/20 hover:border-cyan-400'
              }`}
              value={filters.ra}
              onChange={(e) => handleChange('ra', e.target.value)}
            >
              <option value="" className="bg-slate-900 text-slate-300">🎯 Selecione uma Cidade / RA...</option>
              {regions.map(r => {
                const name = typeof r === 'object' && r ? r.name : r;
                return <option key={name} value={name} className="bg-slate-900 text-white">{name}</option>;
              })}
            </select>
          </div>

          {/* 2. Busca Textual (Geral) */}
          <div className="flex flex-col gap-0.5 sm:col-span-1 lg:col-span-3">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Busca Livre (Nome/Rua/Código)</label>
            <div className="relative flex items-center">
              <input 
                type="text" 
                placeholder="Ex: Mercado, Guará 57, BSB001..." 
                className="min-h-[38px] w-full px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                value={filters.buscaGeral}
                onChange={(e) => handleChange('buscaGeral', e.target.value)}
              />
              {filters.buscaGeral && (
                <button 
                  onClick={() => handleChange('buscaGeral', '')}
                  className="absolute right-2 text-slate-400 hover:text-slate-200 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* 3. Filtro de Status */}
          <div className="flex flex-col gap-0.5 sm:col-span-1 lg:col-span-2">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status</label>
            <div className="min-h-[38px] flex rounded-lg overflow-hidden border border-slate-700 bg-slate-900/80 text-[10px] xl:text-[11px] font-semibold">
              <button 
                type="button"
                onClick={() => handleChange('status', 'Todos')}
                className={`flex-1 py-1.5 px-0.5 transition-colors truncate ${filters.status === 'Todos' ? 'bg-slate-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Todos
              </button>
              <button 
                type="button"
                onClick={() => handleChange('status', 'Operante')}
                className={`flex-1 py-1.5 px-0.5 transition-colors truncate ${filters.status === 'Operante' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Operantes
              </button>
              <button 
                type="button"
                onClick={() => handleChange('status', 'Inoperante')}
                className={`flex-1 py-1.5 px-0.5 transition-colors truncate ${filters.status === 'Inoperante' ? 'bg-red-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Inoperantes
              </button>
            </div>
          </div>

          {/* 4. Filtro por Período */}
          <div className="flex flex-col gap-0.5 sm:col-span-1 lg:col-span-2">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Data da Vistoria</label>
            <select 
              className="min-h-[38px] px-2 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
              value={filters.periodo}
              onChange={(e) => handlePeriodoChange(e.target.value)}
            >
              <option value="">Todo o período</option>
              <option value="hoje">Hoje</option>
              <option value="semana">Esta semana</option>
              <option value="mes">Este mês</option>
              <option value="ano_atual">Este ano</option>
              <option value="personalizado">Personalizado...</option>
              {anos.length > 0 && <optgroup label="Por Ano Específico">
                {anos.map(a => <option key={a} value={`ano-${a}`}>{a}</option>)}
              </optgroup>}
            </select>
            {filters.periodo === 'personalizado' && (
              <div className="flex gap-1.5 mt-1">
                <input 
                  type="date" 
                  value={filters.dataInicio} 
                  onChange={(e) => handleChange('dataInicio', e.target.value)}
                  className="w-1/2 p-1.5 rounded bg-slate-700 border border-slate-600 text-[10px] text-white focus:outline-none focus:border-emerald-500"
                />
                <input 
                  type="date" 
                  value={filters.dataFim} 
                  onChange={(e) => handleChange('dataFim', e.target.value)}
                  className="w-1/2 p-1.5 rounded bg-slate-700 border border-slate-600 text-[10px] text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}
          </div>

          {/* 5. Filtro de Problemas */}
          <div className="flex flex-col gap-0.5 sm:col-span-1 lg:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <AlertCircle size={12} className="text-orange-400" /> 
                Problema
              </label>
              {(filters.ra || filters.buscaGeral || filters.periodo || filters.status !== 'Todos' || filters.problema) && (
                <button 
                  type="button"
                  onClick={handleClearFilters}
                  className="text-[10px] text-rose-400 hover:text-rose-300 font-bold underline"
                >
                  Limpar
                </button>
              )}
            </div>
            <select 
              className="min-h-[38px] px-2 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500 truncate"
              value={filters.problema}
              onChange={(e) => handleChange('problema', e.target.value)}
            >
              <option value="">Qualquer problema...</option>
              {problemasAtivos.map((d, idx) => <option key={`${d}-${idx}`} value={d}>{d}</option>)}
            </select>
          </div>

        </div>
      </div>
    </div>
  );
};

export default FilterBar;
