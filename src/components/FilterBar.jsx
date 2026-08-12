import React, { useState } from 'react';
import { Search, MapPin, AlertCircle, ChevronDown, ChevronUp, LogOut } from 'lucide-react';

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

const FilterBar = ({ onFilterChange, regions, anos = [], isVisible, currentUser, onLogout }) => {
  const [filters, setFilters] = useState({
    buscaGeral: '',
    ra: '',
    periodo: '',
    dataInicio: '',
    dataFim: '',
    status: 'Todos',
    problema: ''
  });

  const handleChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
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
    onFilterChange(defaultFilters);
  };

  const handlePeriodoChange = (val) => {
    let newFilters = { ...filters, periodo: val };
    if (val !== 'personalizado') {
       newFilters.dataInicio = '';
       newFilters.dataFim = '';
    }
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  return (
    <div className={`w-full z-40 bg-slate-800/80 backdrop-blur-md border border-slate-700 shadow-lg rounded-xl overflow-hidden transition-all duration-300 ${isVisible ? 'block' : 'hidden'}`}>
      
      {currentUser && (
        <div className="bg-slate-900 px-3 py-1 flex justify-between items-center border-b border-slate-700/50">
          <span className="text-[10px] uppercase tracking-wider text-slate-300 font-bold">
            {currentUser.nome} - {currentUser.role === 'gestor' ? 'Gestor de hidrante' : 'Vistoriador de hidrante'}
          </span>
          <button onClick={onLogout} className="text-[10px] text-slate-500 hover:text-red-400 flex items-center gap-1 transition-colors">
            <LogOut size={12} /> Sair
          </button>
        </div>
      )}

      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 bg-slate-900/50">
          
          {/* Busca Textual (Geral) */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Busca Livre (Nome/Ref)</label>
            <input 
              type="text" 
              placeholder="Ex: Mercado, Guará 57..." 
              className="p-2 rounded bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
              value={filters.buscaGeral}
              onChange={(e) => handleChange('buscaGeral', e.target.value)}
            />
          </div>

          {/* Filtro por RA */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Região Administrativa</label>
            <select 
              className="p-2 rounded bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
              value={filters.ra}
              onChange={(e) => handleChange('ra', e.target.value)}
            >
              <option value="">Todas as RAs</option>
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Filtro por Período */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Data da Vistoria</label>
            <select 
              className="p-2 rounded bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
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
              <div className="flex gap-2 mt-1">
                <input 
                  type="date" 
                  value={filters.dataInicio} 
                  onChange={(e) => handleChange('dataInicio', e.target.value)}
                  className="w-1/2 p-1 rounded bg-slate-700 border border-slate-600 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <input 
                  type="date" 
                  value={filters.dataFim} 
                  onChange={(e) => handleChange('dataFim', e.target.value)}
                  className="w-1/2 p-1 rounded bg-slate-700 border border-slate-600 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}
          </div>

          {/* Filtro de Status */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status Operacional</label>
            <div className="flex rounded overflow-hidden border border-slate-700 bg-slate-800 text-sm">
              <button 
                onClick={() => handleChange('status', 'Todos')}
                className={`flex-1 py-1.5 ${filters.status === 'Todos' ? 'bg-slate-600 text-white font-bold' : 'text-slate-400'}`}
              >
                Todos
              </button>
              <button 
                onClick={() => handleChange('status', 'Operante')}
                className={`flex-1 py-1.5 ${filters.status === 'Operante' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400'}`}
              >
                Operantes
              </button>
              <button 
                onClick={() => handleChange('status', 'Inoperante')}
                className={`flex-1 py-1.5 ${filters.status === 'Inoperante' ? 'bg-red-600 text-white font-bold' : 'text-slate-400'}`}
              >
                Inoperantes
              </button>
            </div>
          </div>

          {/* Novo Filtro de Problemas */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <AlertCircle size={14} className="text-orange-400" /> 
              Filtro por Problema
            </label>
            <select 
              className="p-2 rounded bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
              value={filters.problema}
              onChange={(e) => handleChange('problema', e.target.value)}
            >
              <option value="">Qualquer problema / Nenhum</option>
              {DEFEITOS_OFICIAIS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Botão Limpar Filtros */}
          <div className="flex flex-col justify-end gap-1">
            <button 
              onClick={handleClearFilters}
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-slate-300 hover:text-white transition-colors text-sm font-bold w-full"
            >
              LIMPAR FILTROS
            </button>
          </div>

        </div>
    </div>
  );
};

export default FilterBar;
