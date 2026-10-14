import React, { useState, useMemo } from 'react';
import { 
  X, 
  CalendarRange, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  ArrowUpDown, 
  Printer, 
  Copy, 
  Check, 
  MapPin, 
  Filter, 
  Play, 
  ListOrdered, 
  Milestone,
  ArrowRight,
  TrendingUp,
  FolderOpen
} from 'lucide-react';
import { toast } from 'react-toastify';
import { 
  calculateCityPlanningData, 
  formatCityPlanningWhatsAppText, 
  generateCityPlanningPrintHtml 
} from '../utils/cityPlanningUtils';
import { formatDateOnly } from '../utils/dateUtils';
import { executePrintHtml } from '../utils/officialPrintUtils';

const CityInspectionPlanningModal = ({
  isOpen,
  onClose,
  hidrantes = [],
  currentUser = null,
  onSelectRA = null,
  onOpenMissions = null
}) => {
  // Estado dos Modos de Visualização:
  // 'planning' = Projeção de planejamento (Ano Base -> Ano Alvo)
  // 'realized' = Sequência realizada em um ano específico
  const [activeTab, setActiveTab] = useState('planning');

  // Anos selecionados
  const [baseYear, setBaseYear] = useState(2025);
  const [targetYear, setTargetYear] = useState(2026);
  const [realizedYear, setRealizedYear] = useState(2026);

  // Filtros locais
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'in_progress' | 'completed'
  const [sortBy, setSortBy] = useState('oldest_first'); // 'oldest_first' | 'newest_first' | 'name' | 'progress'

  const [copied, setCopied] = useState(false);

  // Executa os cálculos estatísticos
  const data = useMemo(() => {
    return calculateCityPlanningData({
      hidrantes,
      baseYear,
      targetYear,
      activeYear: realizedYear
    });
  }, [hidrantes, baseYear, targetYear, realizedYear]);

  // Lista a ser exibida conforme a aba ativa
  const currentList = useMemo(() => {
    let list = activeTab === 'planning' ? [...data.planningList] : [...data.activeYearWithVisits, ...data.activeYearWithoutVisits];

    // 1. Filtro por Busca de Texto
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter(c => 
        c.name.toLowerCase().includes(term) || 
        c.prefix.toLowerCase().includes(term)
      );
    }

    // 2. Filtro por Status
    if (statusFilter !== 'all') {
      if (activeTab === 'planning') {
        list = list.filter(c => c.planningStatus === statusFilter);
      } else {
        list = list.filter(c => c.activeStatus === statusFilter);
      }
    }

    // 3. Ordenação
    list.sort((a, b) => {
      if (sortBy === 'oldest_first') {
        if (activeTab === 'planning') {
          return a.planningRank - b.planningRank;
        } else {
          const tA = a.activeStats.hasVisits ? a.activeStats.avgTimestamp : Infinity;
          const tB = b.activeStats.hasVisits ? b.activeStats.avgTimestamp : Infinity;
          return tA - tB;
        }
      } else if (sortBy === 'newest_first') {
        if (activeTab === 'planning') {
          return b.planningRank - a.planningRank;
        } else {
          const tA = a.activeStats.hasVisits ? a.activeStats.avgTimestamp : -Infinity;
          const tB = b.activeStats.hasVisits ? b.activeStats.avgTimestamp : -Infinity;
          return tB - tA;
        }
      } else if (sortBy === 'name') {
        return a.name.localeCompare(b.name, 'pt-BR');
      } else if (sortBy === 'progress') {
        const pA = activeTab === 'planning' ? a.targetStats.coveragePct : a.activeStats.coveragePct;
        const pB = activeTab === 'planning' ? b.targetStats.coveragePct : b.activeStats.coveragePct;
        return pB - pA;
      }
      return 0;
    });

    return list;
  }, [activeTab, data, searchTerm, statusFilter, sortBy]);

  if (!isOpen) return null;

  // Ação de copiar texto para WhatsApp
  const handleCopyWhatsApp = () => {
    const text = formatCityPlanningWhatsAppText({
      planningList: data.planningList,
      baseYear,
      targetYear,
      metrics: data.metrics
    });

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success('Sequência copiada para a área de transferência!');
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      toast.error('Erro ao copiar texto.');
    });
  };

  // Ação de Imprimir / PDF
  const handlePrint = () => {
    const html = generateCityPlanningPrintHtml({
      planningList: data.planningList,
      baseYear,
      targetYear,
      metrics: data.metrics,
      currentUser
    });
    executePrintHtml(html, `Planejamento_Vistorias_${targetYear}_CBMDF`);
  };

  // Ação ao clicar em "Ver no Mapa"
  const handleGoToMap = (raName) => {
    if (typeof onSelectRA === 'function') {
      onSelectRA(raName);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 w-full max-w-6xl rounded-2xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden border border-slate-700/80 text-slate-100">
        
        {/* CABEÇALHO PADRONIZADO CBMDF / NETUNO */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-slate-900 border-b border-slate-700/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button 
              type="button"
              onClick={onClose} 
              className="text-xs px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg font-semibold transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
            >
              ← Voltar
            </button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-950/50 shrink-0">
              <CalendarRange size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate flex items-center gap-2">
                <span>Planejamento de Vistoria de Cidades</span>
                <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2 py-0.5 rounded-full border border-emerald-500/40 font-semibold hidden sm:inline-flex">
                  33 Regiões Administrativas
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Sequência cronológica da cidade mais antiga para a mais recente por Data Média ponderada
              </p>
            </div>
          </div>

          {/* Botões de Ação no Topo */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className="p-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Copiar texto estruturado para WhatsApp"
            >
              {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} className="text-slate-300" />}
              <span className="hidden sm:inline">{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="p-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 border border-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Imprimir ou Salvar PDF com folha de planejamento"
            >
              <Printer size={15} />
              <span className="hidden sm:inline">Imprimir / PDF</span>
            </button>

            <button 
              type="button"
              onClick={onClose} 
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 cursor-pointer ml-1"
              title="Fechar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* CONTROLES PRINCIPAIS: ABAS E SELETORES DE ANO */}
        <div className="px-4 py-2.5 sm:px-6 sm:py-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Alternador de Abas */}
          <div className="inline-flex p-1 bg-slate-950/70 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('planning')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'planning'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListOrdered size={15} />
              <span>Fila do Próximo Ciclo</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('realized')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'realized'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar size={15} />
              <span>Sequência Realizada por Ano</span>
            </button>
          </div>

          {/* Seletores de Ano Conforme a Aba */}
          {activeTab === 'planning' ? (
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
                <span className="text-slate-400 font-medium">Ciclo Base:</span>
                <select
                  value={baseYear}
                  onChange={(e) => setBaseYear(parseInt(e.target.value, 10))}
                  className="bg-slate-900 text-emerald-400 font-bold border border-slate-700 rounded px-2 py-0.5 outline-none cursor-pointer"
                >
                  {data.availableYears.map(y => (
                    <option key={`base-${y}`} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <ArrowRight size={14} className="text-slate-500 hidden sm:block" />

              <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
                <span className="text-slate-400 font-medium">Ciclo Planejado:</span>
                <select
                  value={targetYear}
                  onChange={(e) => setTargetYear(parseInt(e.target.value, 10))}
                  className="bg-slate-900 text-emerald-400 font-bold border border-slate-700 rounded px-2 py-0.5 outline-none cursor-pointer"
                >
                  {data.availableYears.map(y => (
                    <option key={`target-${y}`} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium">Ano de Vistoria:</span>
              <div className="inline-flex gap-1 bg-slate-950/70 p-1 rounded-lg border border-slate-800">
                {data.availableYears.slice(0, 4).map(y => (
                  <button
                    key={`realized-btn-${y}`}
                    type="button"
                    onClick={() => setRealizedYear(y)}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                      realizedYear === y
                        ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* DESTAQUES DA FILA E RESUMO EXECUTIVO (KPIS) */}
        {activeTab === 'planning' && (
          <div className="px-4 py-2.5 sm:px-6 sm:py-3 bg-slate-900/60 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
            {/* Total */}
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-2.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
                <span>Total Cidades</span>
                <Milestone size={14} className="text-slate-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-bold text-white">{data.metrics.totalCities}</span>
                <span className="text-[11px] text-slate-400">RAs no DF</span>
              </div>
            </div>

            {/* Concluídas */}
            <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-2.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-emerald-400 text-[10px] font-semibold uppercase tracking-wider">
                <span>Concluídas {targetYear}</span>
                <CheckCircle2 size={14} className="text-emerald-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-bold text-emerald-300">{data.metrics.completedCities}</span>
                <span className="text-[11px] text-emerald-400/80 font-medium">({data.metrics.overallProgressPct}%)</span>
              </div>
            </div>

            {/* Em Andamento */}
            <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-2.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-amber-400 text-[10px] font-semibold uppercase tracking-wider">
                <span>Em Andamento</span>
                <Clock size={14} className="text-amber-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-bold text-amber-300">{data.metrics.inProgressCities}</span>
                <span className="text-[10px] text-amber-400/80 truncate">
                  {data.inProgressCity ? data.inProgressCity.name : 'Nenhuma'}
                </span>
              </div>
            </div>

            {/* Próxima da Fila */}
            <div className="bg-blue-950/20 border border-blue-800/40 rounded-xl p-2.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-blue-400 text-[10px] font-semibold uppercase tracking-wider">
                <span>Próxima Prioritária</span>
                <Play size={14} className="text-blue-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-base font-bold text-blue-300 truncate" title={data.nextPendingCity?.name || 'Todas iniciadas'}>
                  {data.nextPendingCity ? data.nextPendingCity.name : 'Todas iniciadas'}
                </span>
                {data.nextPendingCity && (
                  <span className="text-[10px] text-blue-400/80 shrink-0">
                    {data.nextPendingCity.planningRank}º Lugar
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* BARRA DE PESQUISA, FILTROS E ORDENAÇÃO */}
        <div className="px-4 py-2 sm:px-6 sm:py-2.5 bg-slate-950/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          {/* Campo de Busca */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar RA ou código (ex: Arniqueira, CEI)..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition-colors"
            />
            {searchTerm && (
              <button 
                type="button"
                onClick={() => setSearchTerm('')} 
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                ×
              </button>
            )}
          </div>

          {/* Filtro de Status */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 hidden sm:inline">Status:</span>
            <div className="inline-flex gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Todas ({currentList.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                  statusFilter === 'pending'
                    ? 'bg-red-900/60 text-red-200 border border-red-700/60'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Pendentes
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('in_progress')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                  statusFilter === 'in_progress'
                    ? 'bg-amber-900/60 text-amber-200 border border-amber-700/60'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Em Andamento
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('completed')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                  statusFilter === 'completed'
                    ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-700/60'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Concluídas
              </button>
            </div>
          </div>

          {/* Seletor de Ordenação */}
          <div className="flex items-center gap-1 text-xs">
            <ArrowUpDown size={14} className="text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-2 py-1 text-xs outline-none cursor-pointer"
            >
              <option value="oldest_first">Data Média (Mais Antiga → Mais Recente)</option>
              <option value="newest_first">Data Média (Mais Recente → Mais Antiga)</option>
              <option value="progress">Maior Progresso (% Conclusão)</option>
              <option value="name">Nome da RA (A → Z)</option>
            </select>
          </div>
        </div>

        {/* LISTAGEM PRINCIPAL COM SCROLL */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">
          {currentList.length === 0 ? (
            <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
              <Search size={32} className="text-slate-600" />
              <p className="text-sm font-medium">Nenhuma Região Administrativa encontrada com os filtros selecionados.</p>
              <button 
                type="button" 
                onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}
                className="mt-2 text-xs text-emerald-400 hover:underline font-semibold cursor-pointer"
              >
                Limpar filtros de busca
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {currentList.map((city) => {
                const rank = activeTab === 'planning' ? city.planningRank : city.activeYearRank || '-';
                const baseAvgStr = city.baseStats.avgDate ? formatDateOnly(city.baseStats.avgDate) : 'Sem vistoria em ' + baseYear;
                const activeAvgStr = city.activeStats.avgDate ? formatDateOnly(city.activeStats.avgDate) : 'Sem vistoria em ' + realizedYear;

                const currentStatus = activeTab === 'planning' ? city.planningStatus : city.activeStatus;
                const progressStats = activeTab === 'planning' ? city.targetStats : city.activeStats;

                // Estilo do badge de ranking
                const rankBadgeClass = rank === 1 
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-black' 
                  : rank === 2 
                  ? 'bg-slate-300/20 text-slate-200 border-slate-400/40 font-bold'
                  : rank === 3
                  ? 'bg-amber-700/20 text-amber-400 border-amber-700/40 font-bold'
                  : 'bg-slate-800 text-slate-400 border-slate-700 font-semibold';

                return (
                  <div 
                    key={`planning-card-${city.name}`}
                    className={`p-3 sm:p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      currentStatus === 'completed'
                        ? 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/60'
                        : currentStatus === 'in_progress'
                        ? 'bg-amber-950/20 border-amber-700/40 hover:bg-amber-950/30'
                        : 'bg-slate-800/80 border-slate-700/90 hover:border-emerald-500/50 hover:bg-slate-800'
                    }`}
                  >
                    {/* Bloco 1: Ranking + Nome da RA + Tags */}
                    <div className="flex items-center gap-3 min-w-0 sm:w-1/3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs shrink-0 border ${rankBadgeClass}`}>
                        {rank}º
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm sm:text-base text-white tracking-tight">
                            {city.name}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-700 text-slate-300 rounded border border-slate-600">
                            {city.prefix}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{city.totalHydrants} hidrantes cadastrados</span>
                        </div>
                      </div>
                    </div>

                    {/* Bloco 2: Datas (Data Média ponderada e janela de execução) */}
                    <div className="flex flex-col sm:items-center text-xs sm:w-1/4">
                      {activeTab === 'planning' ? (
                        <>
                          <div className="flex items-center gap-1 text-slate-300 font-medium">
                            <Calendar size={13} className="text-emerald-400 shrink-0" />
                            <span>Média {baseYear}: </span>
                            <span className="font-bold text-emerald-300">{baseAvgStr}</span>
                          </div>
                          <span className="text-[11px] text-slate-400 mt-0.5">
                            {city.baseStats.hasVisits 
                              ? `${formatDateOnly(city.baseStats.minDate)} a ${formatDateOnly(city.baseStats.maxDate)} (${city.baseStats.durationDays}d)`
                              : 'Vistoriada antes de ' + baseYear}
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-1 text-slate-300 font-medium">
                            <Calendar size={13} className="text-emerald-400 shrink-0" />
                            <span>Média {realizedYear}: </span>
                            <span className="font-bold text-emerald-300">{activeAvgStr}</span>
                          </div>
                          <span className="text-[11px] text-slate-400 mt-0.5">
                            {city.activeStats.hasVisits 
                              ? `${formatDateOnly(city.activeStats.minDate)} a ${formatDateOnly(city.activeStats.maxDate)} (${city.activeStats.durationDays}d)`
                              : 'Sem registros em ' + realizedYear}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Bloco 3: Barra de Progresso e Status do Ciclo */}
                    <div className="flex flex-col sm:w-1/4">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-300">
                          {activeTab === 'planning' ? `Ciclo ${targetYear}` : `Ano ${realizedYear}`}:
                        </span>
                        <span className="font-bold text-white">
                          {progressStats.inspectedCount} / {city.totalHydrants} ({progressStats.coveragePct}%)
                        </span>
                      </div>

                      {/* Barra de Progresso */}
                      <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
                        <div 
                          className={`h-full transition-all duration-500 rounded-full ${
                            progressStats.coveragePct >= 95 
                              ? 'bg-emerald-500' 
                              : progressStats.coveragePct > 0 
                              ? 'bg-amber-500' 
                              : 'bg-transparent'
                          }`}
                          style={{ width: `${Math.min(100, progressStats.coveragePct)}%` }}
                        />
                      </div>

                      {/* Status Tag */}
                      <div className="flex items-center justify-between mt-1 text-[11px]">
                        {currentStatus === 'completed' ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 size={12} /> Concluída
                          </span>
                        ) : currentStatus === 'in_progress' ? (
                          <span className="text-amber-400 font-semibold flex items-center gap-1">
                            <Clock size={12} /> Em Andamento
                          </span>
                        ) : (
                          <span className="text-red-400 font-semibold flex items-center gap-1">
                            <AlertCircle size={12} /> Pendente na Fila
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">
                          {progressStats.operantes} Op / {progressStats.inoperantes} Inop
                        </span>
                      </div>
                    </div>

                    {/* Bloco 4: Ações Rápidas (Mapa & Missões) */}
                    <div className="flex items-center gap-1.5 shrink-0 sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleGoToMap(city.name)}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
                        title={`Filtrar ${city.name} no Mapa Principal`}
                      >
                        <MapPin size={13} className="text-emerald-400" />
                        <span>Ver no Mapa</span>
                      </button>

                      {typeof onOpenMissions === 'function' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (typeof onSelectRA === 'function') onSelectRA(city.name);
                            onOpenMissions();
                            onClose();
                          }}
                          className="px-2.5 py-1.5 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-600/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
                          title={`Abrir Central de Missões para ${city.name}`}
                        >
                          <FolderOpen size={13} className="text-emerald-400" />
                          <span className="hidden lg:inline">Missão</span>
                        </button>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RODAPÉ DO MODAL COM INFORMAÇÕES DE AUDITORIA E DICAS TÁTICAS */}
        <div className="px-4 py-2.5 sm:px-6 sm:py-3 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>
              <strong>Doutrina Operacional CBMDF:</strong> Realização de vistorias cidade a cidade (uma por uma), priorizando as RAs com maior defasagem temporal.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span>Ano Base: <strong className="text-slate-200">{baseYear}</strong></span>
            <span>•</span>
            <span>Ano Planejado: <strong className="text-emerald-400">{targetYear}</strong></span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CityInspectionPlanningModal;
