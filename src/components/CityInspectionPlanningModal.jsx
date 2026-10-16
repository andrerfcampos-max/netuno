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
  Play, 
  ListOrdered, 
  Milestone,
  ArrowRight,
  TrendingUp,
  FolderOpen,
  LayoutGrid,
  ListFilter,
  BarChart3,
  Layers,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { toast } from 'react-toastify';
import { 
  calculateCityPlanningData, 
  formatCityPlanningWhatsAppText, 
  generateCityPlanningPrintHtml 
} from '../utils/cityPlanningUtils';
import { formatDateOnly } from '../utils/dateUtils';
import { executePrintHtml } from '../utils/officialPrintUtils';

const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_FULL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const CityInspectionPlanningModal = ({
  isOpen,
  onClose,
  hidrantes = [],
  currentUser = null,
  onSelectRA = null,
  onOpenMissions = null
}) => {
  // Modo de visão principal:
  // 'planning' = Fila Operacional & Próximas Cidades
  // 'realized' = Histórico e Linha do Tempo Realizada
  const [activeTab, setActiveTab] = useState('planning');

  // Modo de exibição na tela:
  // 'matrix' = Gráfico Sintético / Matriz Geral (visão de bater o olho em todas as 33 RAs)
  // 'compact' = Lista Compacta de Alta Densidade
  // 'cards' = Detalhado com Sparklines Mensais
  const [viewMode, setViewMode] = useState('matrix');

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
    <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-1 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 w-full max-w-6xl rounded-xl sm:rounded-2xl shadow-2xl flex flex-col h-[96vh] sm:h-[92vh] max-h-[96vh] overflow-hidden border border-slate-700/80 text-slate-100">
        
        {/* CABEÇALHO PADRONIZADO CBMDF / NETUNO (COMPACTO MOBILE) */}
        <div className="px-3 py-2 sm:px-6 sm:py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button 
              type="button"
              onClick={onClose} 
              className="text-xs px-2 py-1 sm:px-2.5 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg font-semibold transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
            >
              ← Voltar
            </button>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-950/50 shrink-0">
              <CalendarRange size={17} className="sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight truncate flex items-center gap-1.5">
                <span>Planejamento de Vistorias</span>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] sm:text-xs px-2 py-0.2 rounded-full border border-emerald-500/40 font-semibold hidden md:inline-flex">
                  33 Regiões DF
                </span>
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                {activeTab === 'planning' 
                  ? 'Sequência da cidade mais antiga para a mais recente (Data Média Ponderada)' 
                  : 'Cronograma e histórico das campanhas realizadas por ano'}
              </p>
            </div>
          </div>

          {/* Botões de Ação no Topo */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className="p-1.5 sm:px-3 sm:py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Copiar texto estruturado para WhatsApp"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-slate-300" />}
              <span className="hidden sm:inline">{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="p-1.5 sm:px-3 sm:py-1 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 border border-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Imprimir ou Salvar PDF com folha de planejamento"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">PDF</span>
            </button>

            <button 
              type="button"
              onClick={onClose} 
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 cursor-pointer ml-0.5"
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* BARRA SUPERIOR: ABAS + SELETORES DE ANO + MODO DE VISUALIZAÇÃO */}
        <div className="px-3 py-2 sm:px-6 sm:py-2.5 bg-slate-900/95 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 shrink-0">
          {/* Alternador de Abas */}
          <div className="inline-flex p-0.5 bg-slate-950/80 border border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab('planning')}
              className={`px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'planning'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListOrdered size={14} />
              <span>Fila do Ciclo</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('realized')}
              className={`px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'realized'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar size={14} />
              <span>Linha do Tempo / Histórico</span>
            </button>
          </div>

          {/* Seletores de Ano e Modos de Exibição */}
          <div className="flex items-center gap-2 flex-wrap text-xs ml-auto">
            {activeTab === 'planning' ? (
              <div className="flex items-center gap-1.5 bg-slate-800/90 px-2 py-0.5 rounded-lg border border-slate-700/80">
                <span className="text-slate-400 text-[10px] sm:text-xs font-medium">Base:</span>
                <select
                  value={baseYear}
                  onChange={(e) => setBaseYear(parseInt(e.target.value, 10))}
                  className="bg-slate-900 text-emerald-400 font-bold border-none text-xs rounded px-1.5 py-0.5 outline-none cursor-pointer"
                >
                  {data.availableYears.map(y => (
                    <option key={`base-${y}`} value={y}>{y}</option>
                  ))}
                </select>
                <ArrowRight size={11} className="text-slate-500" />
                <span className="text-slate-400 text-[10px] sm:text-xs font-medium">Alvo:</span>
                <select
                  value={targetYear}
                  onChange={(e) => setTargetYear(parseInt(e.target.value, 10))}
                  className="bg-slate-900 text-emerald-400 font-bold border-none text-xs rounded px-1.5 py-0.5 outline-none cursor-pointer"
                >
                  {data.availableYears.map(y => (
                    <option key={`target-${y}`} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-slate-800/90 px-2 py-0.5 rounded-lg border border-slate-700/80">
                <span className="text-slate-400 text-xs font-medium mr-1">Ano:</span>
                {data.availableYears.slice(0, 4).map(y => (
                  <button
                    key={`realized-btn-${y}`}
                    type="button"
                    onClick={() => setRealizedYear(y)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                      realizedYear === y
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}

            {/* Alternador de Modo de Visualização (Bater o Olho / Sintético / Compacto / Detalhado) */}
            <div className="inline-flex p-0.5 bg-slate-950/80 border border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode('matrix')}
                className={`p-1 sm:px-2 sm:py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === 'matrix' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Visão Sintética Geral (Todas as 33 cidades de relance)"
              >
                <BarChart3 size={13} />
                <span className="hidden md:inline">Sintético</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('compact')}
                className={`p-1 sm:px-2 sm:py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === 'compact' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Tabela Compacta de Alta Densidade"
              >
                <ListFilter size={13} />
                <span className="hidden md:inline">Compacto</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1 sm:px-2 sm:py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === 'cards' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Cards Detalhados com Histograma Mensal"
              >
                <LayoutGrid size={13} />
                <span className="hidden md:inline">Cards</span>
              </button>
            </div>
          </div>
        </div>

        {/* RESUMO EXECUTIVO (KPIS) EM 1 LINHA COMPACTA E ROLÁVEL (NÃO ENGROSSA A TELA) */}
        <div className="px-3 py-1.5 sm:px-6 sm:py-2 bg-slate-950/40 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 text-xs">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1 flex items-center gap-2 shrink-0">
            <span className="text-slate-400 text-[10px] uppercase font-semibold">Total RAs:</span>
            <span className="font-bold text-white text-xs">{data.metrics.totalCities}</span>
          </div>

          <div className="bg-emerald-950/30 border border-emerald-700/50 rounded-lg px-2.5 py-1 flex items-center gap-2 shrink-0">
            <CheckCircle2 size={13} className="text-emerald-400" />
            <span className="text-emerald-300 text-[10px] uppercase font-semibold">Concluídas:</span>
            <span className="font-bold text-emerald-300 text-xs">{data.metrics.completedCities} ({data.metrics.overallProgressPct}%)</span>
          </div>

          <div className="bg-amber-950/30 border border-amber-700/50 rounded-lg px-2.5 py-1 flex items-center gap-2 shrink-0">
            <Clock size={13} className="text-amber-400" />
            <span className="text-amber-300 text-[10px] uppercase font-semibold">Em Andamento:</span>
            <span className="font-bold text-amber-300 text-xs">
              {data.metrics.inProgressCities} {data.inProgressCity ? `(${data.inProgressCity.name})` : ''}
            </span>
          </div>

          {data.nextPendingCity && (
            <div className="bg-blue-950/30 border border-blue-700/50 rounded-lg px-2.5 py-1 flex items-center gap-2 shrink-0 ml-auto">
              <Play size={12} className="text-blue-400" />
              <span className="text-blue-300 text-[10px] uppercase font-semibold">Próxima Prioritária:</span>
              <span className="font-bold text-blue-200 text-xs">
                {data.nextPendingCity.name} ({data.nextPendingCity.planningRank}º)
              </span>
            </div>
          )}
        </div>

        {/* BARRA DE FILTROS E PESQUISA COMPACTA */}
        <div className="px-3 py-1.5 sm:px-6 sm:py-2 bg-slate-900 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="relative flex-1 min-w-[150px] max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar RA..."
              className="w-full pl-7 pr-3 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition-colors"
            />
            {searchTerm && (
              <button 
                type="button" 
                onClick={() => setSearchTerm('')} 
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
              >
                ×
              </button>
            )}
          </div>

          {/* Filtros de Status em botões compactos */}
          <div className="flex items-center gap-1 text-[11px] overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-0.5 rounded font-semibold cursor-pointer transition-colors ${
                statusFilter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todas ({currentList.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-2 py-0.5 rounded font-semibold cursor-pointer transition-colors ${
                statusFilter === 'pending' ? 'bg-red-900/60 text-red-200 border border-red-700/60' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pendentes
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('in_progress')}
              className={`px-2 py-0.5 rounded font-semibold cursor-pointer transition-colors ${
                statusFilter === 'in_progress' ? 'bg-amber-900/60 text-amber-200 border border-amber-700/60' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Em Andamento
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('completed')}
              className={`px-2 py-0.5 rounded font-semibold cursor-pointer transition-colors ${
                statusFilter === 'completed' ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-700/60' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Concluídas
            </button>
          </div>

          {/* Ordenação */}
          <div className="flex items-center gap-1 text-xs">
            <ArrowUpDown size={12} className="text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-300 rounded px-1.5 py-0.5 text-[11px] outline-none cursor-pointer"
            >
              <option value="oldest_first">Mais Antiga → Mais Recente</option>
              <option value="newest_first">Mais Recente → Mais Antiga</option>
              <option value="progress">Maior Progresso (%)</option>
              <option value="name">Nome (A → Z)</option>
            </select>
          </div>
        </div>

        {/* ÁREA DE CONTEÚDO PRINCIPAL (OCUPA 80% DA TELA ÚTIL COM SCROLL PERFEITO NO MOBILE) */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2 sm:p-4 bg-slate-950/20">
          
          {currentList.length === 0 ? (
            <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
              <Search size={28} className="text-slate-600" />
              <p className="text-xs font-medium">Nenhuma Região Administrativa encontrada com os filtros atuais.</p>
              <button 
                type="button" 
                onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}
                className="text-xs text-emerald-400 hover:underline font-semibold cursor-pointer"
              >
                Limpar filtros de busca
              </button>
            </div>
          ) : viewMode === 'matrix' ? (
            /* ============================================================== */
            /* 1. VISÃO SINTÉTICA GERAL (TODAS AS 33 CIDADES DE RELANCE)     */
            /* ============================================================== */
            <div className="space-y-3">
              <div className="text-[11px] text-slate-400 flex items-center justify-between pb-1 border-b border-slate-800">
                <span className="font-semibold text-slate-300">
                  Matriz Operacional das 33 RAs do DF (Sequência Cronológica e Período de Atuação)
                </span>
                <span className="text-[10px] text-slate-400">
                  Clique na cidade para ver ações e detalhes
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {currentList.map((city) => {
                  const rank = activeTab === 'planning' ? city.planningRank : city.activeYearRank || '-';
                  const currentStatus = activeTab === 'planning' ? city.planningStatus : city.activeStatus;
                  const progressStats = activeTab === 'planning' ? city.targetStats : city.activeStats;
                  const baseAvg = city.baseStats.avgDate ? formatDateOnly(city.baseStats.avgDate) : 'Antiga';
                  const hasContinuous = city.continuousCampaign && city.continuousCampaign.hasCampaign;

                  return (
                    <div
                      key={`matrix-${city.name}`}
                      className={`p-2 rounded-lg border transition-all flex flex-col justify-between gap-1.5 ${
                        currentStatus === 'completed'
                          ? 'bg-slate-900/90 border-emerald-700/40 hover:border-emerald-500'
                          : currentStatus === 'in_progress'
                          ? 'bg-amber-950/20 border-amber-600/50 hover:border-amber-400'
                          : 'bg-slate-900/90 border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      {/* Topo do Mini-Card: Rank + Nome + Status Badge */}
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0 border ${
                            rank === 1 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}>
                            {rank}
                          </span>
                          <span className="font-bold text-xs text-white truncate" title={city.name}>
                            {city.name}
                          </span>
                          <span className="text-[9px] font-mono px-1 py-0.2 bg-slate-800 text-slate-400 rounded">
                            {city.prefix}
                          </span>
                        </div>

                        {currentStatus === 'completed' ? (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-700/50 shrink-0">
                            100% Concluída
                          </span>
                        ) : currentStatus === 'in_progress' ? (
                          <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-700/50 shrink-0">
                            {progressStats.coveragePct}% Andamento
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-400 bg-slate-800/80 px-1.5 py-0.2 rounded shrink-0">
                            Pendente
                          </span>
                        )}
                      </div>

                      {/* Barra de Progresso Compacta */}
                      <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                        <div 
                          className={`h-full transition-all duration-300 rounded-full ${
                            currentStatus === 'completed'
                              ? 'bg-emerald-500' 
                              : progressStats.coveragePct > 0 
                              ? 'bg-amber-500' 
                              : 'bg-transparent'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(progressStats.coveragePct, currentStatus === 'completed' ? 100 : 0))}%` }}
                        />
                      </div>

                      {/* Informações de Período e Mini-Histograma Mensal (Jan a Dez) */}
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                        <div className="truncate mr-1">
                          {hasContinuous && city.continuousCampaign.spansTwoYears ? (
                            <span className="text-emerald-300 font-medium" title="Campanha realizada entre anos contíguos">
                              {city.continuousCampaign.cycleName} ({city.continuousCampaign.durationDays}d)
                            </span>
                          ) : city.baseStats.hasVisits ? (
                            <span>{city.baseStats.summaryPeriod}</span>
                          ) : (
                            <span>{city.totalHydrants} hidrantes</span>
                          )}
                        </div>

                        {/* Sparkline de 12 meses (mostra onde se concentrou) */}
                        <div className="flex items-end gap-0.5 h-3 shrink-0" title={`Distribuição mensal de vistorias (${baseYear}/${targetYear})`}>
                          {(city.baseStats.monthlyDistribution || Array(12).fill(0)).map((cnt, mIdx) => {
                            const isPeak = city.baseStats.peakMonth && city.baseStats.peakMonth.index === mIdx;
                            const hPct = cnt > 0 ? Math.max(25, Math.min(100, Math.round((cnt / (city.baseStats.peakMonth?.count || 1)) * 100))) : 0;
                            return (
                              <div
                                key={`m-${city.name}-${mIdx}`}
                                className={`w-1 rounded-xs transition-all ${
                                  cnt === 0 
                                    ? 'bg-slate-800 h-0.5' 
                                    : isPeak 
                                    ? 'bg-emerald-400' 
                                    : 'bg-teal-700/80'
                                }`}
                                style={{ height: cnt === 0 ? '2px' : `${hPct}%` }}
                                title={`${MONTH_FULL[mIdx]}: ${cnt} vistorias`}
                              />
                            );
                          })}
                        </div>
                      </div>

                      {/* Rodapé do Mini-Card: Botão de ação rápida para o mapa */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px]">
                        <span className="text-slate-500">
                          {progressStats.inspectedCount}/{city.totalHydrants} vistoriados
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleGoToMap(city.name)}
                            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px] font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <MapPin size={9} className="text-emerald-400" />
                            <span>Mapa</span>
                          </button>
                          {typeof onOpenMissions === 'function' && (
                            <button
                              type="button"
                              onClick={() => {
                                if (typeof onSelectRA === 'function') onSelectRA(city.name);
                                onOpenMissions();
                                onClose();
                              }}
                              className="px-1.5 py-0.5 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 rounded text-[9px] font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <FolderOpen size={9} className="text-emerald-400" />
                              <span>Missão</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : viewMode === 'compact' ? (
            /* ============================================================== */
            /* 2. VISÃO TABELA COMPACTA (ALTA DENSIDADE / SEM ROLAGEM CHATA)  */
            /* ============================================================== */
            <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden text-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950/90 text-slate-400 border-b border-slate-800 text-[10px] uppercase font-bold tracking-wider">
                      <th className="py-2 px-2.5 text-center w-10">Seq.</th>
                      <th className="py-2 px-3">Região Administrativa</th>
                      <th className="py-2 px-2.5 text-center">Data Média</th>
                      <th className="py-2 px-3">Período / Campanha</th>
                      <th className="py-2 px-2.5 text-center">Pico Mensal</th>
                      <th className="py-2 px-2.5 text-center">Progresso</th>
                      <th className="py-2 px-2.5 text-center">Situação</th>
                      <th className="py-2 px-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {currentList.map((city) => {
                      const rank = activeTab === 'planning' ? city.planningRank : city.activeYearRank || '-';
                      const currentStatus = activeTab === 'planning' ? city.planningStatus : city.activeStatus;
                      const progressStats = activeTab === 'planning' ? city.targetStats : city.activeStats;
                      const baseAvgStr = city.baseStats.avgDate ? formatDateOnly(city.baseStats.avgDate) : '-';
                      const peakStr = city.baseStats.peakMonth ? `${city.baseStats.peakMonth.name} (${city.baseStats.peakMonth.pct}%)` : '-';

                      return (
                        <tr 
                          key={`compact-${city.name}`} 
                          className="hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="py-1.5 px-2.5 text-center font-bold text-slate-300">
                            {rank}º
                          </td>
                          <td className="py-1.5 px-3">
                            <span className="font-bold text-white mr-1.5">{city.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">({city.prefix})</span>
                          </td>
                          <td className="py-1.5 px-2.5 text-center font-semibold text-emerald-400">
                            {baseAvgStr}
                          </td>
                          <td className="py-1.5 px-3 text-slate-300 text-[11px]">
                            {city.continuousCampaign && city.continuousCampaign.spansTwoYears ? (
                              <span className="text-emerald-300 font-semibold">
                                {city.continuousCampaign.cycleName} ({city.continuousCampaign.durationDays}d)
                              </span>
                            ) : (
                              city.baseStats.summaryPeriod
                            )}
                          </td>
                          <td className="py-1.5 px-2.5 text-center text-[11px] text-slate-300">
                            {peakStr}
                          </td>
                          <td className="py-1.5 px-2.5 text-center font-semibold text-white">
                            {progressStats.inspectedCount}/{city.totalHydrants} ({progressStats.coveragePct}%)
                          </td>
                          <td className="py-1.5 px-2.5 text-center">
                            {currentStatus === 'completed' ? (
                              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-700/50">
                                Concluída
                              </span>
                            ) : currentStatus === 'in_progress' ? (
                              <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-700/50">
                                Andamento
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                                Pendente
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleGoToMap(city.name)}
                              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[10px] font-semibold transition-all cursor-pointer inline-flex items-center gap-1"
                            >
                              <MapPin size={10} className="text-emerald-400" />
                              <span>Mapa</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ============================================================== */
            /* 3. VISÃO CARDS DETALHADOS COM HISTOGRAMA E DISTRIBUIÇÃO MENSAL */
            /* ============================================================== */
            <div className="space-y-2.5">
              {currentList.map((city) => {
                const rank = activeTab === 'planning' ? city.planningRank : city.activeYearRank || '-';
                const baseAvgStr = city.baseStats.avgDate ? formatDateOnly(city.baseStats.avgDate) : 'Sem vistoria em ' + baseYear;
                const currentStatus = activeTab === 'planning' ? city.planningStatus : city.activeStatus;
                const progressStats = activeTab === 'planning' ? city.targetStats : city.activeStats;

                return (
                  <div 
                    key={`card-${city.name}`}
                    className="p-3 rounded-xl border border-slate-800 bg-slate-900/90 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    {/* Bloco 1: Ranking + Nome */}
                    <div className="flex items-center gap-2.5 min-w-0 md:w-1/4">
                      <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                        {rank}º
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-white tracking-tight">{city.name}</span>
                          <span className="text-[10px] font-mono px-1 bg-slate-800 text-slate-400 rounded">{city.prefix}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {city.totalHydrants} hidrantes cadastrados
                        </div>
                      </div>
                    </div>

                    {/* Bloco 2: Período e Concentração Mensal */}
                    <div className="flex flex-col text-xs md:w-1/3">
                      <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                        <Calendar size={13} className="text-emerald-400 shrink-0" />
                        <span>Média: <strong className="text-emerald-300">{baseAvgStr}</strong></span>
                      </div>
                      <span className="text-[11px] text-slate-400 mt-0.5">
                        {city.continuousCampaign?.spansTwoYears 
                          ? `Campanha contínua: ${city.continuousCampaign.cycleName} (${city.continuousCampaign.durationDays} dias)`
                          : city.baseStats.summaryPeriod}
                      </span>

                      {/* Gráfico Mensal de Jan a Dez em Linha */}
                      <div className="mt-2 flex items-center gap-1">
                        <span className="text-[9px] text-slate-500 uppercase font-semibold mr-1">Meses:</span>
                        <div className="flex items-center gap-0.5 flex-1 bg-slate-950/70 p-1 rounded border border-slate-800">
                          {MONTH_LABELS.map((lbl, mIdx) => {
                            const count = city.baseStats.monthlyDistribution ? city.baseStats.monthlyDistribution[mIdx] : 0;
                            const isPeak = city.baseStats.peakMonth?.index === mIdx;
                            return (
                              <div 
                                key={`badge-${city.name}-${mIdx}`}
                                className={`flex-1 text-center py-0.5 rounded text-[8px] font-bold ${
                                  count > 0 
                                    ? isPeak 
                                      ? 'bg-emerald-500 text-white' 
                                      : 'bg-emerald-950 text-emerald-300 border border-emerald-700/50' 
                                    : 'text-slate-600'
                                }`}
                                title={`${MONTH_FULL[mIdx]}: ${count} vistorias`}
                              >
                                {lbl}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Bloco 3: Progresso e Status */}
                    <div className="flex flex-col md:w-1/4">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-300">Progresso Ciclo:</span>
                        <span className="font-bold text-white">
                          {progressStats.inspectedCount} / {city.totalHydrants} ({progressStats.coveragePct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            currentStatus === 'completed' ? 'bg-emerald-500' : progressStats.coveragePct > 0 ? 'bg-amber-500' : 'bg-transparent'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(progressStats.coveragePct, currentStatus === 'completed' ? 100 : 0))}%` }}
                        />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px]">
                        <span className={currentStatus === 'completed' ? 'text-emerald-400 font-bold' : currentStatus === 'in_progress' ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                          {currentStatus === 'completed' ? 'Concluída' : currentStatus === 'in_progress' ? 'Em Andamento' : 'Pendente na Fila'}
                        </span>
                        <span className="text-slate-500">
                          {progressStats.operantes} Op / {progressStats.inoperantes} Inop
                        </span>
                      </div>
                    </div>

                    {/* Bloco 4: Ações */}
                    <div className="flex items-center gap-1.5 justify-end shrink-0 pt-1 md:pt-0 border-t md:border-t-0 border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleGoToMap(city.name)}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <MapPin size={12} className="text-emerald-400" />
                        <span>Ver no Mapa</span>
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* RODAPÉ DO MODAL (COMPACTO COM INDICADOR DOUTRINÁRIO) */}
        <div className="px-3 py-1.5 sm:px-6 sm:py-2 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>
              <strong>Doutrina Operacional CBMDF:</strong> Vistoria ordenada cidade a cidade priorizando maior defasagem temporal.
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <span>Ciclo: <strong className="text-emerald-400">{baseYear} → {targetYear}</strong></span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CityInspectionPlanningModal;
