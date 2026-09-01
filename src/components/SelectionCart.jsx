import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, 
  Eye, 
  Trash2, 
  X, 
  Plus, 
  FolderPlus, 
  MapPin, 
  ArrowLeft, 
  Folder, 
  FolderOpen, 
  Search, 
  Check, 
  Sparkles
} from 'lucide-react';
import { fixEncoding } from '../utils/textUtils';
import { normalizeRAName } from '../utils/raList';

const SelectionCart = ({
  selectedIds = [],
  hidrantes = [],
  isOpen = false,
  onToggleOpen,
  onRemoveItem,
  onClearAll,
  onFocusHydrant,
  onCreateMission,
  onAddToMission,
  activeMission = null,
  folders = [],
  missions = [],
  currentUser = null,
  isMapFullscreen = false,
}) => {
  const isGestor = currentUser?.role === 'gestor' || currentUser?.role === 'admin';
  if (!isGestor || selectedIds.length === 0) {
    return null;
  }

  // ==========================================
  // ESTADOS DO MODAL E SUB-TELAS
  // ==========================================
  const [modalView, setModalView] = useState('list'); // 'list' | 'create' | 'add'
  const [newMissionName, setNewMissionName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState(() => {
    return localStorage.getItem('netuno_default_folder') || '';
  });
  const [missionSearchTerm, setMissionSearchTerm] = useState('');
  const [selectedTargetMissionId, setSelectedTargetMissionId] = useState(activeMission?.id || '');

  const defaultFolderId = localStorage.getItem('netuno_default_folder') || '';

  const sortedFolders = useMemo(() => {
    return [...folders].sort((a, b) => {
      const aIsFav = defaultFolderId && a.id === defaultFolderId;
      const bIsFav = defaultFolderId && b.id === defaultFolderId;
      if (aIsFav && !bIsFav) return -1;
      if (!aIsFav && bIsFav) return 1;
      return (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base', numeric: true });
    });
  }, [folders, defaultFolderId]);

  // Atualiza sugestão de nome ao mudar hidrantes ou abrir
  useEffect(() => {
    if (selectedIds.length > 0) {
      const firstHydrant = hidrantes.find(h => 
        h.codHidrante === selectedIds[0] || h.nomHidrante === selectedIds[0] || h._internalId === selectedIds[0]
      );
      const loc = firstHydrant?.dscLocalidade ? (normalizeRAName(firstHydrant.dscLocalidade) || fixEncoding(firstHydrant.dscLocalidade)) : 'Brasília';
      const year = new Date().getFullYear();
      setNewMissionName(`${loc} ${year}`);
    }
  }, [selectedIds.length, isOpen]);

  // Se a aba fechar, reseta a visão para a lista inicial
  useEffect(() => {
    if (!isOpen) {
      setModalView('list');
    } else {
      if (activeMission?.id) {
        setSelectedTargetMissionId(activeMission.id);
      }
      const favFolder = localStorage.getItem('netuno_default_folder') || '';
      setSelectedFolderId(favFolder);
    }
  }, [isOpen, activeMission?.id]);

  // ==========================================
  // ESTADOS DE ARRASTO DO BALÃO FLUTUANTE (DRAG & DROP)
  // ==========================================
  const [pillPosition, setPillPosition] = useState(() => {
    if (typeof window !== 'undefined') {
      const defaultRight = 16;
      const defaultBottom = 84;
      const defaultX = Math.max(12, window.innerWidth - 190 - defaultRight);
      const defaultY = Math.max(60, window.innerHeight - 56 - defaultBottom);
      return { x: defaultX, y: defaultY };
    }
    return null;
  });

  const [isDraggingPill, setIsDraggingPill] = useState(false);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const dragStartRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });
  const hasMovedRef = useRef(false);
  const pillBtnRef = useRef(null);

  // Handler de Início de Arrasto do Balão
  const handlePillStart = (clientX, clientY) => {
    const rect = pillBtnRef.current?.getBoundingClientRect();
    const currentX = rect ? rect.left : (pillPosition?.x || (window.innerWidth - 190));
    const currentY = rect ? rect.top : (pillPosition?.y || (window.innerHeight - 130));

    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      initialX: currentX,
      initialY: currentY
    };
    hasMovedRef.current = false;
  };

  // Handler de Movimento de Arrasto do Balão
  const handlePillMove = (clientX, clientY) => {
    const deltaX = clientX - dragStartRef.current.startX;
    const deltaY = clientY - dragStartRef.current.startY;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance > 10) {
      if (!isDraggingPill) setIsDraggingPill(true);
      hasMovedRef.current = true;

      const newX = Math.min(Math.max(12, dragStartRef.current.initialX + deltaX), window.innerWidth - 170);
      const newY = Math.min(Math.max(48, dragStartRef.current.initialY + deltaY), window.innerHeight - 60);

      setPillPosition({ x: newX, y: newY });

      // Detecção de colisão com a zona da lixeira (inferior da tela)
      const isNearBottomTrash = clientY >= window.innerHeight - 120;
      setIsOverTrash(isNearBottomTrash);
    }
  };

  // Handler de Fim de Arrasto do Balão
  const suppressClickRef = useRef(false);

  const handlePillEnd = (e) => {
    if (e) {
      if (e.stopPropagation) e.stopPropagation();
      if (e.cancelable && e.preventDefault) e.preventDefault();
    }

    if (isDraggingPill) {
      if (isOverTrash) {
        if (navigator.vibrate) {
          try { navigator.vibrate(60); } catch (err) {}
        }
        if (onClearAll) onClearAll();
      }
      setIsDraggingPill(false);
      setIsOverTrash(false);
      suppressClickRef.current = true;
      setTimeout(() => { suppressClickRef.current = false; }, 300);
    } else {
      // Se não houve arraste expressivo, interpreta como clique/toque para abrir o carrinho
      if (!hasMovedRef.current && onToggleOpen) {
        suppressClickRef.current = true;
        onToggleOpen(true);
        setTimeout(() => { suppressClickRef.current = false; }, 300);
      }
    }
    hasMovedRef.current = false;
  };

  // Listeners globais de toque e mouse para arrasto suave do balão
  const onTouchStartPill = (e) => {
    if (e.stopPropagation) e.stopPropagation();
    if (e.touches.length > 0) {
      handlePillStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const onTouchMovePill = (e) => {
    if (e.stopPropagation) e.stopPropagation();
    if (e.touches.length > 0) {
      handlePillMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const onMouseDownPill = (e) => {
    if (e.stopPropagation) e.stopPropagation();
    if (e.button !== 0) return; // Apenas botão esquerdo
    handlePillStart(e.clientX, e.clientY);

    const onMouseMoveWindow = (moveEvent) => {
      handlePillMove(moveEvent.clientX, moveEvent.clientY);
    };

    const onMouseUpWindow = (upEvent) => {
      if (upEvent && upEvent.stopPropagation) upEvent.stopPropagation();
      handlePillEnd(upEvent);
      window.removeEventListener('mousemove', onMouseMoveWindow);
      window.removeEventListener('mouseup', onMouseUpWindow);
    };

    window.addEventListener('mousemove', onMouseMoveWindow);
    window.addEventListener('mouseup', onMouseUpWindow);
  };

  // ==========================================
  // ARRASTO DO PAINEL ABERTO (DRAG TO DISMISS)
  // ==========================================
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const touchStartY = useRef(0);
  const isSheetDragging = useRef(false);

  const handleSheetTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    isSheetDragging.current = true;
  };

  const handleSheetTouchMove = (e) => {
    if (!isSheetDragging.current) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;
    if (deltaY > 0) {
      setDragOffsetY(deltaY);
    }
  };

  const handleSheetTouchEnd = () => {
    if (dragOffsetY > 70) {
      if (onToggleOpen) onToggleOpen(false);
    }
    setDragOffsetY(0);
    isSheetDragging.current = false;
  };

  // Hidrantes Selecionados Formatados
  const selectedHydrantsList = selectedIds.map(id => {
    const found = hidrantes.find(h => 
      h.codHidrante === id || 
      h.nomHidrante === id || 
      h._internalId === id ||
      String(h.codHidrante) === String(id) ||
      String(h._internalId) === String(id)
    );
    return found || { codHidrante: id, nomHidrante: id, _internalId: id, flgAtivo: true };
  });

  // Submeter Criação de Nova Missão
  const handleConfirmCreateMission = () => {
    const firstHydrant = hidrantes.find(h => 
      h.codHidrante === selectedIds[0] || h.nomHidrante === selectedIds[0] || h._internalId === selectedIds[0]
    );
    const loc = firstHydrant?.dscLocalidade ? (normalizeRAName(firstHydrant.dscLocalidade) || fixEncoding(firstHydrant.dscLocalidade)) : 'Brasília';
    const year = new Date().getFullYear();
    const defaultName = `${loc} ${year}`;
    const finalName = newMissionName.trim() || defaultName;
    if (onCreateMission) {
      onCreateMission({
        name: finalName,
        parentFolderId: selectedFolderId ? String(selectedFolderId) : null
      });
    }
  };

  // Submeter Adição à Missão Existente
  const handleConfirmAddToMission = () => {
    if (!selectedTargetMissionId) return;
    if (onAddToMission) {
      onAddToMission(selectedTargetMissionId);
    }
  };

  // Filtragem de missões para a tela de adicionar
  const filteredMissions = missions.filter(m => {
    if (!missionSearchTerm) return true;
    const term = missionSearchTerm.toLowerCase();
    const folder = folders.find(f => f.id === m.parentFolderId);
    const folderName = folder ? folder.name.toLowerCase() : 'central';
    return (m.name || '').toLowerCase().includes(term) || folderName.includes(term);
  });

  return (
    <>
      {/* ======================================================== */}
      {/* 1. ZONA DE LIXEIRA DE DESCARTE (QUANDO ARRASTANDO O BALÃO) */}
      {/* ======================================================== */}
      {isDraggingPill && !isOpen && (
        <div 
          className={`fixed bottom-0 inset-x-0 z-[1099] flex flex-col items-center justify-center pb-6 pt-5 transition-all duration-200 pointer-events-none ${
            isOverTrash 
              ? 'bg-gradient-to-t from-red-700/90 via-red-900/80 to-transparent scale-105' 
              : 'bg-gradient-to-t from-slate-950/80 via-slate-900/50 to-transparent'
          }`}
        >
          <div className={`flex items-center gap-2 px-5 py-2.5 rounded-full border-2 transition-all shadow-2xl ${
            isOverTrash
              ? 'bg-red-600 border-white text-white scale-110 shadow-[0_0_30px_rgba(239,68,68,0.9)] animate-pulse'
              : 'bg-slate-900/90 border-red-500/70 text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.4)]'
          }`}>
            <Trash2 size={22} className={isOverTrash ? 'animate-bounce' : ''} />
            <span className="text-xs font-black tracking-wide uppercase">
              {isOverTrash ? 'Solte para Limpar Seleção' : 'Arraste aqui para limpar'}
            </span>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. BALÃO FLUTUANTE LIVREMENTE MÓVEL (QUANDO FECHADO) */}
      {/* ======================================================== */}
      {!isOpen && (
        <div 
          ref={pillBtnRef}
          onTouchStart={onTouchStartPill}
          onTouchMove={onTouchMovePill}
          onTouchEnd={handlePillEnd}
          onMouseDown={onMouseDownPill}
          onClick={(e) => {
            e.stopPropagation();
            if (suppressClickRef.current) return;
            if (!isDraggingPill && !hasMovedRef.current && onToggleOpen) {
              onToggleOpen(true);
            }
          }}
          style={{
            position: 'fixed',
            left: pillPosition ? `${pillPosition.x}px` : undefined,
            top: pillPosition ? `${pillPosition.y}px` : undefined,
            right: !pillPosition ? '16px' : undefined,
            bottom: !pillPosition ? (isMapFullscreen ? '24px' : '84px') : undefined,
            touchAction: 'none',
            userSelect: 'none'
          }}
          className={`z-[1050] pointer-events-auto transition-transform ${
            isDraggingPill ? 'scale-105 opacity-90 cursor-grabbing' : 'cursor-grab'
          }`}
        >
          <div
            title="Arraste para mover ou até a lixeira para excluir. Toque para abrir seleção."
            className={`group flex items-center gap-2.5 bg-slate-900/95 hover:bg-slate-800 text-slate-100 px-4 py-3 rounded-full border-2 shadow-[0_0_25px_rgba(16,185,129,0.45)] hover:shadow-[0_0_30px_rgba(16,185,129,0.65)] backdrop-blur-xl transition-all active:scale-95 select-none cursor-pointer ${
              isOverTrash ? 'border-red-500 ring-2 ring-red-400' : 'border-emerald-500/80'
            }`}
          >
            <div className="relative flex items-center justify-center pointer-events-none">
              <ShoppingCart size={22} className="text-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="absolute -top-2 -right-2.5 bg-emerald-500 text-slate-950 font-black text-[11px] px-1.5 py-0.2 rounded-full min-w-[18px] text-center shadow-lg animate-pulse">
                {selectedIds.length}
              </span>
            </div>
            <span className="text-xs font-black tracking-wide text-emerald-300 pr-0.5 pointer-events-none">
              {selectedIds.length === 1 ? '1 Selecionado' : `${selectedIds.length} Selecionados`}
            </span>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. PAINEL MODAL DO CARRINHO (QUANDO ABERTO) */}
      {/* ======================================================== */}
      {isOpen && (
        <>
          {/* Backdrop escuro no Mobile */}
          <div 
            className="md:hidden fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[1090] transition-opacity animate-fadeIn"
            onClick={() => onToggleOpen(false)}
          />

          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined,
              transition: isSheetDragging.current ? 'none' : 'transform 0.2s ease-out'
            }}
            className={`fixed z-[1100] bg-slate-900/98 backdrop-blur-2xl border border-emerald-500/50 shadow-[0_10px_40px_rgba(0,0,0,0.85)] flex flex-col pointer-events-auto animate-scaleUp ${
              isMapFullscreen 
                ? 'bottom-6 right-6 w-[400px] max-h-[580px] rounded-2xl'
                : 'inset-x-0 bottom-0 md:inset-x-auto md:bottom-16 md:right-6 md:w-[410px] max-h-[85vh] md:max-h-[580px] rounded-t-3xl md:rounded-2xl'
            }`}
          >
            {/* Handle visual de arrasto no Mobile */}
            <div 
              onTouchStart={handleSheetTouchStart}
              onTouchMove={handleSheetTouchMove}
              onTouchEnd={handleSheetTouchEnd}
              className="md:hidden w-full pt-2 pb-1 flex items-center justify-center cursor-grab active:cursor-grabbing"
            >
              <div className="w-12 h-1.5 bg-slate-600 rounded-full" />
            </div>

            {/* ======================================================== */}
            {/* VISTA 1: LISTA PRINCIPAL DE HIDRANTES */}
            {/* ======================================================== */}
            {modalView === 'list' && (
              <>
                {/* Cabeçalho */}
                <div 
                  onTouchStart={handleSheetTouchStart}
                  onTouchMove={handleSheetTouchMove}
                  onTouchEnd={handleSheetTouchEnd}
                  className="p-3.5 px-4 border-b border-slate-800 flex items-center justify-between bg-slate-850/80 rounded-t-3xl md:rounded-t-2xl"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-emerald-950/90 border border-emerald-500/50 flex items-center justify-center shrink-0 shadow-inner">
                      <ShoppingCart size={17} className="text-emerald-400" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-white tracking-tight">
                          Seleção Temporária
                        </span>
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                          {selectedIds.length}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 truncate">
                        Hidrantes marcados para operações
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => onToggleOpen(false)}
                    className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors active:scale-95 text-xs font-bold border border-slate-700 shrink-0"
                    title="Minimizar Carrinho"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Lista Scrollável de Hidrantes Selecionados */}
                <div className="p-3 overflow-y-auto flex-1 flex flex-col gap-2 min-h-[140px] max-h-[300px] md:max-h-[320px] custom-scrollbar">
                  {selectedHydrantsList.map((h, index) => {
                    const id = h.codHidrante || h.nomHidrante || h._internalId;
                    const isOperante = h.flgAtivo !== false && h.flgAtivo !== 0;

                    return (
                      <div 
                        key={id || index}
                        className="flex items-center justify-between p-2.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl gap-2 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span 
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              isOperante ? 'bg-emerald-400 shadow-[0_0_6px_#10b981]' : 'bg-red-400 shadow-[0_0_6px_#ef4444]'
                            }`} 
                            title={isOperante ? 'Operante' : 'Inoperante'}
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="font-mono font-bold text-xs text-white truncate">
                              {fixEncoding(h.nomHidrante) || h.codHidrante || id}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                              <MapPin size={10} className="text-emerald-400 shrink-0" />
                              {fixEncoding(h.dscLocalidade) || 'Região DF'}
                              {h.dscEndereco && ` • ${fixEncoding(h.dscEndereco)}`}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => {
                              if (onFocusHydrant) onFocusHydrant(h);
                              if (window.innerWidth < 768 && onToggleOpen) onToggleOpen(false);
                            }}
                            className="p-1.5 bg-slate-700/80 hover:bg-cyan-900/60 text-cyan-300 hover:text-cyan-200 border border-slate-600 hover:border-cyan-500/50 rounded-lg transition-colors active:scale-95"
                            title="Focar no mapa"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => onRemoveItem && onRemoveItem(id)}
                            className="p-1.5 bg-slate-700/80 hover:bg-red-900/60 text-slate-400 hover:text-red-300 border border-slate-600 hover:border-red-500/50 rounded-lg transition-colors active:scale-95"
                            title="Remover da seleção"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Rodapé com Ações de Missão */}
                <div className="p-3 border-t border-slate-800 flex flex-col gap-2 bg-slate-850/90 rounded-b-none md:rounded-b-2xl">
                  {/* Botão 1: Criar Nova Missão (Abre Tela de Criação com Pasta e Nome) */}
                  <button
                    onClick={() => setModalView('create')}
                    className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs shadow-md shadow-emerald-950 flex items-center justify-center gap-2 transition-all active:scale-98 tracking-wide cursor-pointer"
                  >
                    <Plus size={16} strokeWidth={3} />
                    <span>CRIAR NOVA MISSÃO ({selectedIds.length})</span>
                  </button>

                  <div className="flex items-center gap-2 w-full">
                    {/* Botão 2: Adicionar a Missão Existente (Abre Navegador de Pastas/Missões) */}
                    <button
                      onClick={() => setModalView('add')}
                      className="flex-1 py-2 px-2.5 rounded-xl font-bold text-[11px] bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 hover:border-cyan-400 shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 min-w-0 cursor-pointer"
                      title="Escolher qual missão existente receberá estes hidrantes"
                    >
                      <FolderPlus size={14} className="shrink-0 text-cyan-400" />
                      <span className="truncate">Adicionar à Missão...</span>
                    </button>

                    {/* Botão 3: Limpar Seleção */}
                    <button
                      onClick={() => {
                        if (onClearAll) onClearAll();
                      }}
                      className="py-2 px-3 bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-800/60 hover:border-red-600 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 transition-all active:scale-95 shrink-0 cursor-pointer"
                      title="Limpar todos os itens da seleção"
                    >
                      <Trash2 size={13} />
                      <span>Limpar</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ======================================================== */}
            {/* VISTA 2: CRIAR NOVA MISSÃO COM ESCOLHA DE NOME E PASTA */}
            {/* ======================================================== */}
            {modalView === 'create' && (
              <div className="flex flex-col flex-1 p-4 gap-3.5">
                {/* Cabeçalho */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <button
                    onClick={() => setModalView('list')}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-1 text-xs font-bold transition-colors"
                  >
                    <ArrowLeft size={14} /> Voltar
                  </button>
                  <span className="font-black text-sm text-emerald-400 flex items-center gap-1.5">
                    <Plus size={16} /> Nova Missão ({selectedIds.length})
                  </span>
                  <button
                    onClick={() => onToggleOpen(false)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Campo 1: Nome da Missão */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                    Nome da Missão <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newMissionName}
                    onChange={(e) => setNewMissionName(e.target.value)}
                    placeholder="Ex: Ronda Preventiva Gama"
                    className="w-full bg-slate-800/90 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3 py-2.5 text-sm text-white font-medium focus:outline-none transition-all"
                    autoFocus
                  />
                </div>

                {/* Campo 2: Pasta de Destino (Quartel) */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <FolderOpen size={13} className="text-amber-400" />
                    Pasta de Destino (Quartel/Área)
                  </label>
                  <select
                    value={selectedFolderId}
                    onChange={(e) => setSelectedFolderId(e.target.value)}
                    className="w-full bg-slate-800/90 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 font-medium focus:outline-none transition-all"
                  >
                    <option value="">📁 Central / Raiz (Sem pasta fixa)</option>
                    {sortedFolders.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.id === defaultFolderId ? '★ ' : '🏢 '}{f.name}{f.id === defaultFolderId ? ' (Favorita)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Resumo da Seleção */}
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-2.5 flex items-center justify-between text-xs text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <MapPin size={13} className="text-emerald-400" />
                    Hidrantes a incluir:
                  </span>
                  <span className="font-black text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/40">
                    {selectedIds.length} hidrantes
                  </span>
                </div>

                {/* Ações */}
                <div className="flex gap-2 pt-2 border-t border-slate-800 mt-auto">
                  <button
                    onClick={() => setModalView('list')}
                    className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmCreateMission}
                    className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-950 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                  >
                    <Check size={16} strokeWidth={3} />
                    <span>Criar e Abrir Rota</span>
                  </button>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* VISTA 3: ADICIONAR À MISSÃO EXISTENTE (COM SELEÇÃO DE PASTA/MISSÃO) */}
            {/* ======================================================== */}
            {modalView === 'add' && (
              <div className="flex flex-col flex-1 p-4 gap-3 max-h-[500px]">
                {/* Cabeçalho */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <button
                    onClick={() => setModalView('list')}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-1 text-xs font-bold transition-colors"
                  >
                    <ArrowLeft size={14} /> Voltar
                  </button>
                  <span className="font-black text-sm text-cyan-400 flex items-center gap-1.5">
                    <FolderPlus size={16} /> Adicionar à Missão
                  </span>
                  <button
                    onClick={() => onToggleOpen(false)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Campo de Busca Rápida */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={missionSearchTerm}
                    onChange={(e) => setMissionSearchTerm(e.target.value)}
                    placeholder="Buscar missão ou quartel..."
                    className="w-full bg-slate-800/90 border border-slate-700 focus:border-cyan-500 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none"
                  />
                </div>

                {/* Se houver missão ativa no momento, exibir atalho em destaque */}
                {activeMission && (
                  <div 
                    onClick={() => setSelectedTargetMissionId(activeMission.id)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      selectedTargetMissionId === activeMission.id
                        ? 'bg-cyan-950/80 border-cyan-400 ring-1 ring-cyan-400 text-white'
                        : 'bg-slate-800/80 border-cyan-500/40 hover:bg-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="text-[10px] font-extrabold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles size={11} /> Missão Aberta no Momento
                      </span>
                      <span className="font-bold text-xs truncate">
                        {activeMission.name}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {folders.find(f => f.id === activeMission.parentFolderId)?.name || 'Central'} • {(activeMission.selectedIds || []).length} hidrantes atuais
                      </span>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                      selectedTargetMissionId === activeMission.id ? 'bg-cyan-500 border-cyan-400 text-slate-950 font-bold' : 'border-slate-600'
                    }`}>
                      {selectedTargetMissionId === activeMission.id && <Check size={12} strokeWidth={3} />}
                    </div>
                  </div>
                )}

                {/* Lista de Missões Existentes Agrupadas por Pasta */}
                <div className="flex-1 overflow-y-auto flex flex-col gap-2 max-h-[220px] custom-scrollbar pr-1">
                  {filteredMissions.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                      <Folder size={24} className="text-slate-600" />
                      <span>Nenhuma missão encontrada com esse termo.</span>
                    </div>
                  ) : (
                    filteredMissions.map((m) => {
                      const isSelected = selectedTargetMissionId === m.id;
                      const folder = folders.find(f => f.id === m.parentFolderId);
                      const currentCount = (m.selectedIds || []).length;

                      return (
                        <div
                          key={m.id}
                          onClick={() => setSelectedTargetMissionId(m.id)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-cyan-950/70 border-cyan-400 ring-1 ring-cyan-400 text-white'
                              : 'bg-slate-800/60 border-slate-700 hover:bg-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FolderOpen size={16} className={isSelected ? 'text-cyan-400 shrink-0' : 'text-amber-400 shrink-0'} />
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-xs truncate">
                                {m.name}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate">
                                {folder ? folder.name : 'Central / Raiz'} • {currentCount} hidrante(s)
                              </span>
                            </div>
                          </div>

                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-cyan-500 border-cyan-400 text-slate-950' : 'border-slate-600'
                          }`}>
                            {isSelected && <Check size={11} strokeWidth={3} />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Ações */}
                <div className="flex gap-2 pt-2 border-t border-slate-800 mt-auto">
                  <button
                    onClick={() => setModalView('list')}
                    className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={!selectedTargetMissionId}
                    onClick={handleConfirmAddToMission}
                    className="flex-1 py-2.5 px-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                  >
                    <Plus size={16} strokeWidth={3} />
                    <span>Adicionar ({selectedIds.length})</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
};

export default SelectionCart;

