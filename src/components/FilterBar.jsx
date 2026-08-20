import React, { useState, useEffect } from 'react';
import { Search, MapPin, AlertCircle, RefreshCw } from 'lucide-react';

const DEFEITOS_OFICIAIS = [
  "Caixa do hidrante obstruída com esgoto",
  "Hidrante sem água",
  "Hidrante removido ou não encontrado",
  "Hidrante cercado/bloqueado",
  "Falta tampão de 2.1/2\"",
  "Falta tampão de 4\"",
  "Tampa da caixa lacrada (concretada)",
  "Tampa de concreto quebrada ou removida",
  "Tampa metálica T19 quebrada ou removida",
  "Caixa de registro muito profunda",
  "Caixa de registro cheia de lixo",
  "Caixa de registro cheia d'água",
  "Caixa de registro quebrada",
  "Caixa de registro com enxame de abelhas",
  "Falta cabeçote da haste do registro (luva)",
  "Registro com vazamento",
  "Registro emperrado",
  "Faltam bujões e tampões",
  "Rosca de tampão danificado",
  "Carretel do registro danificado",
  "Hidrante com pouca pressão",
  "Hidrante quebrado no flange",
  "Registro concretado",
  "Faltam dois tampões de 2 1/2",
  "Registro danificado",
  "Caixa de concreto danificado",
  "Falta flange",
  "Registro não funciona",
  "Hidrante quebrado",
  "Hidrante soterrado",
  "Registro soterrado",
  "Hidrante empenado",
  "Vazamento no flange (operante)"
];

const FilterBar = ({ onFilterChange, regions, anos = [], problemasAtivos = [], isVisible, currentUser, onLogout }) => {
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

  return (
    <div className={`w-full z-20 bg-slate-800/90 backdrop-blur-md border border-slate-700 shadow-md rounded-xl p-2 sm:p-2.5 transition-all duration-300 ${isVisible ? 'block' : 'hidden'}`}>
      
      {/* GRADE COMPACTA DE FILTROS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2">
          
        {/* 1. Filtro por RA - Destaque Colorido Tático Principal */}
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
            <option value="__TODAS__" className="bg-slate-900 text-cyan-300 font-semibold">🗺️ Todas as Cidades (Visão DF Completo)</option>
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
          <div className="min-h-[38px] flex rounded-lg overflow-hidden border border-slate-700 bg-slate-900/80 text-[11px] font-semibold">
            <button 
              type="button"
              onClick={() => handleChange('status', 'Todos')}
              className={`flex-1 py-1.5 transition-colors ${filters.status === 'Todos' ? 'bg-slate-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Todos
            </button>
            <button 
              type="button"
              onClick={() => handleChange('status', 'Operante')}
              className={`flex-1 py-1.5 transition-colors ${filters.status === 'Operante' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Oper
            </button>
            <button 
              type="button"
              onClick={() => handleChange('status', 'Inoperante')}
              className={`flex-1 py-1.5 transition-colors ${filters.status === 'Inoperante' ? 'bg-red-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Inop
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
  );
};

export default FilterBar;
