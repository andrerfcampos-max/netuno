import React, { useState, useMemo } from 'react';
import { 
  X, 
  CalendarRange, 
  Clock, 
  CheckCircle2, 
  Search, 
  ArrowUpDown, 
  Printer, 
  Copy, 
  Check, 
  MapPin, 
  Play, 
  ListOrdered, 
  FolderOpen,
  LayoutGrid,
  ListFilter,
  BarChart3,
  Target,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { toast } from 'react-toastify';
import { 
  calculateCityPlanningData, 
  formatCityPlanningWhatsAppText, 
  generateCityPlanningPrintHtml 
} from '../utils/cityPlanningUtils';
import { executePrintHtml } from '../utils/officialPrintUtils';

const MONTH_FULL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const CityInspectionPlanningModal = ({
  isOpen,
  onClose,
  hidrantes = [],
  currentUser = null,
  onSelectRA = null,
  onOpenMissions = null
}) => {
  // Modo de exibição na tela:
  // 'matrix' = Gráfico Sintético / Matriz Geral (visão de bater o olho em todas as 33 RAs)
  // 'compact' = Lista Compacta de Alta Densidade
  // 'cards' = Detalhado
  const [viewMode, setViewMode] = useState('matrix');

  // Filtros locais
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'in_progress' | 'completed'
  const [sortBy, setSortBy] = useState('oldest_first'); // 'oldest_first' | 'newest_first' | 'name' | 'hydrants'

  const [copied, setCopied] = useState(false);

  // Executa os cálculos estatísticos com critério estrito de tempo sem vistoria
  const data = useMemo(() => {
    return calculateCityPlanningData({ hidrantes });
  }, [hidrantes]);

  // Lista a ser exibida conforme busca, filtro e ordenação
  const currentList = useMemo(() => {
    let list = [...data.planningList];

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
      list = list.filter(c => c.planningStatus === statusFilter);
    }

    // 3. Ordenação
    list.sort((a, b) => {
      if (sortBy === 'oldest_first') {
        return a.planningRank - b.planningRank;
      } else if (sortBy === 'newest_first') {
        return b.planningRank - a.planningRank;
      } else if (sortBy === 'name') {
        return a.name.localeCompare(b.name, 'pt-BR');
      } else if (sortBy === 'hydrants') {
        return b.totalHydrants - a.totalHydrants;
      }
      return 0;
    });

    return list;
  }, [data, searchTerm, statusFilter, sortBy]);

  if (!isOpen) return null;

  const nextCity = data.nextPendingCity || data.planningList[0];
  const inProgressCity = data.inProgressCity;

  // Ação de copiar texto para WhatsApp
  const handleCopyWhatsApp = () => {
    const text = formatCityPlanningWhatsAppText({
      planningList: data.planningList,
      inProgressGroup: data.inProgressGroup,
      pendingGroup: data.pendingGroup,
      completedGroup: data.completedGroup,
      nextPendingCity: nextCity,
      inProgressCity,
      metrics: data.metrics
    });

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success('Fila prioritária copiada para a área de transferência!');
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      toast.error('Erro ao copiar texto.');
    });
  };

  // Ação de Imprimir / PDF
  const handlePrint = () => {
    const html = generateCityPlanningPrintHtml({
      planningList: data.planningList,
      inProgressGroup: data.inProgressGroup,
      pendingGroup: data.pendingGroup,
      completedGroup: data.completedGroup,
      nextPendingCity: nextCity,
      inProgressCity,
      metrics: data.metrics,
      currentUser
    });
    executePrintHtml(html, `Fila_Prioritaria_Vistorias_Cidades_CBMDF`);
  };

  // Ação ao clicar em "Ver no Mapa"
  const handleGoToMap = (raName) => {
    if (typeof onSelectRA === 'function') {
      onSelectRA(raName);
    }
    onClose();
  };

  // Ação para criar missão
  const handleStartMission = (raName) => {
    if (typeof onSelectRA === 'function') onSelectRA(raName);
    if (typeof onOpenMissions === 'function') onOpenMissions();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-1 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 w-full max-w-6xl rounded-xl sm:rounded-2xl shadow-2xl flex flex-col h-[96vh] sm:h-[92vh] max-h-[96vh] overflow-hidden border border-slate-700/80 text-slate-100">
        
        {/* CABEÇALHO PADRONIZADO CBMDF / NETUNO */}
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
              <Target size={17} className="sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight truncate flex items-center gap-1.5">
                <span>Fila Prioritária de Vistorias de Cidades</span>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] sm:text-xs px-2 py-0.2 rounded-full border border-emerald-500/40 font-semibold hidden md:inline-flex">
                  33 Regiões DF
                </span>
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                Critério Tático: Cidades visitadas há mais tempo têm prioridade máxima na fila
              </p>
            </div>
          </div>

          {/* Botões de Ação no Topo */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className="p-1.5 sm:px-3 sm:py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Copiar fila prioritária estruturada para WhatsApp"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-slate-300" />}
              <span className="hidden sm:inline">{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="p-1.5 sm:px-3 sm:py-1 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 border border-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Imprimir ou Salvar PDF da Fila Prioritária"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Gerar PDF</span>
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

        {/* ========================================================================= */}
        {/* SUPER DESTAQUE TÁTICO: A PRÓXIMA CIDADE A VISTORIAR (CLAREZA MÁXIMA)       */}
        {/* ========================================================================= */}
        <div className="px-3 py-2 sm:px-6 sm:py-3 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/60 border-b border-emerald-600/40 shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
            {nextCity && (
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-950">
                  <Target size={22} className="animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-600/50">
                      🎯 Próxima Cidade da Fila
                    </span>
                    <span className="text-xs text-slate-400 hidden sm:inline">•</span>
                    <span className="text-xs text-slate-300 hidden sm:inline">
                      Visitada há mais tempo
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                      {nextCity.planningRank}º. {nextCity.name}
                    </h3>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      [{nextCity.prefix}]
                    </span>
                    <span className="text-xs text-slate-300 font-semibold">
                      — {nextCity.totalHydrants} hidrantes
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Última vistoria: <strong className="text-amber-300">{nextCity.lastVisitDateStr}</strong> ({nextCity.timeAgoLabel})
                  </p>
                </div>
              </div>
            )}

            {/* Ações Rápidas para a Próxima Cidade */}
            {nextCity && (
              <div className="flex items-center gap-2 shrink-0 ml-auto md:ml-0">
                <button
                  type="button"
                  onClick={() => handleGoToMap(nextCity.name)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <MapPin size={13} className="text-emerald-400" />
                  <span>Ver no Mapa</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStartMission(nextCity.name)}
                  className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950 cursor-pointer active:scale-95"
                >
                  <FolderOpen size={13} />
                  <span>Criar Missão para {nextCity.name}</span>
                </button>
              </div>
            )}
          </div>

          {/* Alerta de continuidade se houver cidades em andamento no momento */}
          {inProgressCity && inProgressCity.name !== nextCity?.name && (
            <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-amber-300 bg-amber-950/30 px-2.5 py-1.5 rounded-lg border border-amber-600/30">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                <span>
                  <strong>Em andamento atualmente:</strong> {inProgressCity.name} [{inProgressCity.prefix}] com {inProgressCity.recentInspectedCount} de {inProgressCity.totalHydrants} hidrantes ({inProgressCity.recentCoveragePct}%).
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleGoToMap(inProgressCity.name)}
                className="text-[11px] underline font-bold hover:text-white shrink-0 ml-2"
              >
                Continuar vistoria →
              </button>
            </div>
          )}
        </div>

        {/* BARRA DE CONTROLE: RESUMO RÁPIDO + FILTROS + VISUALIZAÇÃO */}
        <div className="px-3 py-2 sm:px-6 sm:py-2 bg-slate-900 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 shrink-0">
          {/* Busca por Nome ou Prefixo */}
          <div className="relative flex-1 min-w-[150px] max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar cidade ou prefixo..."
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

          {/* Filtros de Status */}
          <div className="flex items-center gap-1 text-[11px] overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-0.5 rounded font-semibold cursor-pointer transition-colors ${
                statusFilter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todas (33)
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-2 py-0.5 rounded font-semibold cursor-pointer transition-colors ${
                statusFilter === 'pending' ? 'bg-red-900/60 text-red-200 border border-red-700/60' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Aguardando Fila ({data.metrics.pendingCities})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('in_progress')}
              className={`px-2 py-0.5 rounded font-semibold cursor-pointer transition-colors ${
                statusFilter === 'in_progress' ? 'bg-amber-900/60 text-amber-200 border border-amber-700/60' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Em Andamento ({data.metrics.inProgressCities})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('completed')}
              className={`px-2 py-0.5 rounded font-semibold cursor-pointer transition-colors ${
                statusFilter === 'completed' ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-700/60' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Concluídas Recente ({data.metrics.completedCities})
            </button>
          </div>

          {/* Ordenação + Alternador de Visualização */}
          <div className="flex items-center gap-2 ml-auto text-xs">
            <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-lg px-2 py-0.5">
              <ArrowUpDown size={12} className="text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent border-none text-slate-300 text-[11px] outline-none cursor-pointer"
              >
                <option value="oldest_first">Mais antiga sem visita primeiro</option>
                <option value="newest_first">Mais recente primeiro</option>
                <option value="hydrants">Mais hidrantes primeiro</option>
                <option value="name">Nome (A → Z)</option>
              </select>
            </div>

            <div className="inline-flex p-0.5 bg-slate-950/80 border border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode('matrix')}
                className={`p-1 sm:px-2 sm:py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === 'matrix' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Visão Sintética Geral"
              >
                <BarChart3 size={13} />
                <span className="hidden md:inline">Sintético</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('compact')}
                className={`p-1 sm:px-2 sm:py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === 'compact' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Tabela Compacta"
              >
                <ListFilter size={13} />
                <span className="hidden md:inline">Compacto</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1 sm:px-2 sm:py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === 'cards' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Cards Detalhados"
              >
                <LayoutGrid size={13} />
                <span className="hidden md:inline">Cards</span>
              </button>
            </div>
          </div>
        </div>

        {/* ÁREA DE CONTEÚDO PRINCIPAL (COM SCROLL FLUIDO) */}
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
            /* 1. VISÃO SINTÉTICA COM SEPARAÇÃO EXPLÍCITA DOS 3 ESTÁGIOS     */
            /* ============================================================== */
            <div className="space-y-4">
              {/* Função auxiliar inline para renderizar um card da matriz */}
              {(() => {
                const renderCard = (city) => {
                  const isNext = city.planningStatus === 'pending' && nextCity && city.name === nextCity.name;
                  const isCompleted = city.planningStatus === 'completed';
                  const isInProgress = city.planningStatus === 'in_progress';

                  return (
                    <div
                      key={`matrix-${city.name}`}
                      className={`p-2.5 rounded-lg border transition-all flex flex-col justify-between gap-2 ${
                        isNext
                          ? 'bg-gradient-to-br from-emerald-950/80 to-slate-900 border-emerald-500 shadow-md shadow-emerald-950 ring-1 ring-emerald-500/50'
                          : isCompleted
                          ? 'bg-slate-900/90 border-emerald-800/40 hover:border-emerald-600'
                          : isInProgress
                          ? 'bg-amber-950/20 border-amber-600/50 hover:border-amber-400'
                          : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Topo do Mini-Card: Rank + Nome + Status Badge */}
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0 border ${
                            isNext
                              ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}>
                            {city.planningRank}
                          </span>
                          <span className="font-bold text-xs text-white truncate" title={city.name}>
                            {city.name}
                          </span>
                          <span className="text-[9px] font-mono px-1 py-0.2 bg-slate-800 text-slate-400 rounded">
                            {city.prefix}
                          </span>
                        </div>

                        {isNext ? (
                          <span className="text-[10px] font-black text-emerald-300 bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-500 shrink-0">
                            🎯 1º da Fila
                          </span>
                        ) : isCompleted ? (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-700/50 shrink-0">
                            Concluída ({city.recentCoveragePct}%)
                          </span>
                        ) : isInProgress ? (
                          <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-700/50 shrink-0">
                            Andamento ({city.recentCoveragePct}%)
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-400 bg-slate-800/80 px-1.5 py-0.2 rounded shrink-0">
                            Aguardando Fila
                          </span>
                        )}
                      </div>

                      {/* Informações Centrais: Tempo sem Vistoria + Total de Hidrantes */}
                      <div className="text-[11px] bg-slate-950/60 p-1.5 rounded border border-slate-800/80 flex items-center justify-between">
                        <div>
                          <div className="text-[10px] text-slate-400">Última Vistoria:</div>
                          <div className="font-semibold text-white">
                            {city.lastVisitDateStr}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-slate-400">Tempo sem visita:</div>
                          <div className={`font-bold ${city.daysSinceLastVisit > 300 ? 'text-amber-400' : 'text-slate-300'}`}>
                            {city.timeAgoLabel}
                          </div>
                        </div>
                      </div>

                      {/* Barra de Progresso Compacta */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>{city.recentInspectedCount} de {city.totalHydrants} hidrantes</span>
                          <span>{city.recentCoveragePct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                          <div 
                            className={`h-full transition-all duration-300 rounded-full ${
                              isCompleted ? 'bg-emerald-500' : isInProgress ? 'bg-amber-500' : 'bg-slate-700'
                            }`}
                            style={{ width: `${Math.min(100, city.recentCoveragePct)}%` }}
                          />
                        </div>
                      </div>

                      {/* Rodapé do Mini-Card: Botão de ação rápida */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px]">
                        <span className="text-slate-500">
                          {city.totalHydrants} hidrantes no DF
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
                              onClick={() => handleStartMission(city.name)}
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
                };

                // Se o usuário selecionou uma aba específica (pending/in_progress/completed), mostra lista simples correspondente
                if (statusFilter !== 'all') {
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {currentList.map(renderCard)}
                    </div>
                  );
                }

                // Na visão 'all' (Todas as cidades), separa explicitamente nos 3 estágios operacionais
                const inProgList = currentList.filter(c => c.planningStatus === 'in_progress');
                const pendingList = currentList.filter(c => c.planningStatus === 'pending');
                const compList = currentList.filter(c => c.planningStatus === 'completed');

                return (
                  <div className="space-y-5">
                    {/* 1º ESTÁGIO: EM ANDAMENTO */}
                    {inProgList.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-amber-950/40 border border-amber-600/40 text-amber-300">
                          <div className="flex items-center gap-2">
                            <span className="text-base">🔄</span>
                            <div>
                              <span className="font-extrabold text-xs uppercase tracking-wide">
                                1º Estágio: Cidades em Andamento ({inProgList.length})
                              </span>
                              <span className="text-[11px] text-amber-200/80 ml-2 hidden sm:inline">
                                • Frentes já abertas — Concluir prioritariamente antes de iniciar outras
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-900/60 border border-amber-600/40 text-amber-200">
                            Frentes Ativas
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {inProgList.map(renderCard)}
                        </div>
                      </div>
                    )}

                    {/* 2º ESTÁGIO: AGUARDANDO NA FILA */}
                    {pendingList.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-red-950/40 border border-red-700/40 text-red-200">
                          <div className="flex items-center gap-2">
                            <span className="text-base">⏳</span>
                            <div>
                              <span className="font-extrabold text-xs uppercase tracking-wide">
                                2º Estágio: Aguardando na Fila ({pendingList.length})
                              </span>
                              <span className="text-[11px] text-red-200/80 ml-2 hidden sm:inline">
                                • Prioridade por maior tempo decorrido sem vistoria (Mais antiga → Mais recente)
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-900/60 border border-red-700/40 text-red-200">
                            Aguardando Liberação
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {pendingList.map(renderCard)}
                        </div>
                      </div>
                    )}

                    {/* 3º ESTÁGIO: CONCLUÍDAS */}
                    {compList.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-700/40 text-emerald-300">
                          <div className="flex items-center gap-2">
                            <span className="text-base">✅</span>
                            <div>
                              <span className="font-extrabold text-xs uppercase tracking-wide">
                                3º Estágio: Vistoriadas Recentemente ({compList.length})
                              </span>
                              <span className="text-[11px] text-emerald-200/80 ml-2 hidden sm:inline">
                                • Meta operacional atingida (100% dos hidrantes vistoriados nos últimos 180 dias)
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-900/60 border border-emerald-700/40 text-emerald-200">
                            Campanha Concluída
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {compList.map(renderCard)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : viewMode === 'compact' ? (
            /* ============================================================== */
            /* 2. VISÃO TABELA COMPACTA (ALTA DENSIDADE OPERACIONAL)          */
            /* ============================================================== */
            <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden text-xs">
              <div className="overflow-x-auto">
                {(() => {
                  const renderRow = (city) => {
                    const isNext = city.planningStatus === 'pending' && nextCity && city.name === nextCity.name;
                    const isCompleted = city.planningStatus === 'completed';
                    const isInProgress = city.planningStatus === 'in_progress';

                    return (
                      <tr 
                        key={`compact-${city.name}`} 
                        className={`transition-colors ${isNext ? 'bg-emerald-950/30' : isInProgress ? 'bg-amber-950/15' : 'hover:bg-slate-800/50'}`}
                      >
                        <td className="py-1.5 px-2.5 text-center font-bold text-slate-300">
                          {city.planningRank}º
                        </td>
                        <td className="py-1.5 px-3">
                          <span className="font-bold text-white mr-1.5">{city.name}</span>
                          <span className="text-[10px] font-mono text-slate-400">({city.prefix})</span>
                        </td>
                        <td className="py-1.5 px-2.5 text-center font-semibold text-emerald-400">
                          {city.lastVisitDateStr}
                        </td>
                        <td className={`py-1.5 px-3 text-center text-[11px] font-medium ${city.daysSinceLastVisit > 300 ? 'text-amber-400' : 'text-slate-300'}`}>
                          {city.timeAgoLabel}
                        </td>
                        <td className="py-1.5 px-2.5 text-center font-bold text-slate-200">
                          {city.totalHydrants}
                        </td>
                        <td className="py-1.5 px-2.5 text-center font-semibold text-white">
                          {city.recentInspectedCount}/{city.totalHydrants} ({city.recentCoveragePct}%)
                        </td>
                        <td className="py-1.5 px-2.5 text-center">
                          {isNext ? (
                            <span className="text-[10px] font-black text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500">
                              🎯 1º da Fila
                            </span>
                          ) : isCompleted ? (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-700/50">
                              Concluída ({city.recentCoveragePct}%)
                            </span>
                          ) : isInProgress ? (
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-700/50">
                              Em Andamento ({city.recentCoveragePct}%)
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                              Aguardando Fila
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
                  };

                  const renderTableSection = (title, badgeText, list, headerClass) => {
                    if (!list || list.length === 0) return null;
                    return (
                      <>
                        <tr className={headerClass}>
                          <td colSpan="8" className="py-1.5 px-3 font-extrabold text-[11px] uppercase tracking-wider">
                            <div className="flex items-center justify-between">
                              <span>{title} ({list.length})</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded border bg-black/20">{badgeText}</span>
                            </div>
                          </td>
                        </tr>
                        {list.map(renderRow)}
                      </>
                    );
                  };

                  const inProgList = currentList.filter(c => c.planningStatus === 'in_progress');
                  const pendingList = currentList.filter(c => c.planningStatus === 'pending');
                  const compList = currentList.filter(c => c.planningStatus === 'completed');

                  return (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-950/90 text-slate-400 border-b border-slate-800 text-[10px] uppercase font-bold tracking-wider">
                          <th className="py-2 px-2.5 text-center w-10">Seq.</th>
                          <th className="py-2 px-3">Região Administrativa</th>
                          <th className="py-2 px-2.5 text-center">Última Vistoria</th>
                          <th className="py-2 px-3 text-center">Tempo sem Vistoria</th>
                          <th className="py-2 px-2.5 text-center">Total Hidr.</th>
                          <th className="py-2 px-2.5 text-center">Progresso</th>
                          <th className="py-2 px-2.5 text-center">Situação Operacional</th>
                          <th className="py-2 px-3 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {statusFilter !== 'all' ? (
                          currentList.map(renderRow)
                        ) : (
                          <>
                            {renderTableSection(
                              '🔄 1º Estágio: Cidades em Andamento',
                              'Conclusão Prioritária',
                              inProgList,
                              'bg-amber-950/60 text-amber-300 border-y border-amber-600/40'
                            )}
                            {renderTableSection(
                              '⏳ 2º Estágio: Aguardando na Fila',
                              'Por tempo sem vistoria',
                              pendingList,
                              'bg-red-950/60 text-red-200 border-y border-red-700/40'
                            )}
                            {renderTableSection(
                              '✅ 3º Estágio: Vistoriadas Recentemente',
                              'Meta 100% Atingida',
                              compList,
                              'bg-emerald-950/60 text-emerald-300 border-y border-emerald-700/40'
                            )}
                          </>
                        )}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </div>
          ) : (
            /* ============================================================== */
            /* 3. VISÃO CARDS DETALHADOS COM SEPARAÇÃO DOS 3 ESTÁGIOS         */
            /* ============================================================== */
            <div className="space-y-4">
              {(() => {
                const renderDetailCard = (city) => {
                  const isNext = city.planningStatus === 'pending' && nextCity && city.name === nextCity.name;
                  const isCompleted = city.planningStatus === 'completed';
                  const isInProgress = city.planningStatus === 'in_progress';

                  return (
                    <div 
                      key={`card-${city.name}`}
                      className={`p-3 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                        isNext
                          ? 'bg-emerald-950/40 border-emerald-500 shadow-md ring-1 ring-emerald-500/50'
                          : isInProgress
                          ? 'bg-amber-950/20 border-amber-600/40 hover:border-amber-500'
                          : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Bloco 1: Ranking + Nome */}
                      <div className="flex items-center gap-2.5 min-w-0 md:w-1/3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 border ${
                          isNext ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400' : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {city.planningRank}º
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

                      {/* Bloco 2: Dados de Última Vistoria */}
                      <div className="flex items-center gap-4 text-xs">
                        <div>
                          <div className="text-[10px] text-slate-400">Última Vistoria</div>
                          <div className="font-bold text-white">{city.lastVisitDateStr}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">Tempo sem visita</div>
                          <div className={`font-bold ${city.daysSinceLastVisit > 300 ? 'text-amber-400' : 'text-slate-300'}`}>
                            {city.timeAgoLabel}
                          </div>
                        </div>
                      </div>

                      {/* Bloco 3: Situação e Ações */}
                      <div className="flex items-center gap-2 ml-auto">
                        {isNext ? (
                          <span className="text-xs font-black text-emerald-300 bg-emerald-950 px-2 py-1 rounded border border-emerald-500">
                            🎯 1º da Fila
                          </span>
                        ) : isCompleted ? (
                          <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2 py-1 rounded border border-emerald-700/50">
                            Concluída ({city.recentCoveragePct}%)
                          </span>
                        ) : isInProgress ? (
                          <span className="text-xs font-bold text-amber-400 bg-amber-950/60 px-2 py-1 rounded border border-amber-700/50">
                            Andamento ({city.recentCoveragePct}%)
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400 bg-slate-800 px-2 py-1 rounded">
                            Aguardando Fila
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleGoToMap(city.name)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <MapPin size={11} className="text-emerald-400" />
                          <span>Mapa</span>
                        </button>

                        {typeof onOpenMissions === 'function' && (
                          <button
                            type="button"
                            onClick={() => handleStartMission(city.name)}
                            className="px-2.5 py-1 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/50 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <FolderOpen size={11} />
                            <span>Missão</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                };

                if (statusFilter !== 'all') {
                  return (
                    <div className="space-y-2.5">
                      {currentList.map(renderDetailCard)}
                    </div>
                  );
                }

                const inProgList = currentList.filter(c => c.planningStatus === 'in_progress');
                const pendingList = currentList.filter(c => c.planningStatus === 'pending');
                const compList = currentList.filter(c => c.planningStatus === 'completed');

                return (
                  <div className="space-y-5">
                    {/* 1º Estágio */}
                    {inProgList.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-amber-950/40 border border-amber-600/40 text-amber-300">
                          <span className="font-extrabold text-xs uppercase tracking-wide">
                            🔄 1º Estágio: Cidades em Andamento ({inProgList.length}) — Conclusão Prioritária
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-900/60 border border-amber-600/40">
                            Frentes Ativas
                          </span>
                        </div>
                        {inProgList.map(renderDetailCard)}
                      </div>
                    )}

                    {/* 2º Estágio */}
                    {pendingList.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-red-950/40 border border-red-700/40 text-red-200">
                          <span className="font-extrabold text-xs uppercase tracking-wide">
                            ⏳ 2º Estágio: Aguardando na Fila ({pendingList.length}) — Ordem por Tempo sem Visita
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-900/60 border border-red-700/40">
                            Aguardando Liberação
                          </span>
                        </div>
                        {pendingList.map(renderDetailCard)}
                      </div>
                    )}

                    {/* 3º Estágio */}
                    {compList.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-700/40 text-emerald-300">
                          <span className="font-extrabold text-xs uppercase tracking-wide">
                            ✅ 3º Estágio: Vistoriadas Recentemente ({compList.length}) — Meta 100% Atingida
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-900/60 border border-emerald-700/40">
                            Campanha Concluída
                          </span>
                        </div>
                        {compList.map(renderDetailCard)}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

        </div>

        {/* RODAPÉ DO MODAL (INDICADOR TÁTICO) */}
        <div className="px-3 py-2 sm:px-6 sm:py-2.5 bg-slate-900 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <div>
            Total: <strong>33 Regiões do DF</strong> | Prioridade: <strong>Cidades visitadas há mais tempo no topo</strong>
          </div>
          <div className="hidden sm:block text-slate-500">
            Sistema Netuno • Gestão Operacional CBMDF
          </div>
        </div>

      </div>
    </div>
  );
};

export default CityInspectionPlanningModal;
