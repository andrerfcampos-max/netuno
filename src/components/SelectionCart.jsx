import React, { useState, useRef } from 'react';
import { ShoppingCart, Eye, Trash2, X, Plus, FolderPlus, MapPin } from 'lucide-react';
import { fixEncoding } from '../utils/textUtils';

const SelectionCart = ({
  selectedIds = [],
  hidrantes = [],
  isOpen = false,
  onToggleOpen,
  onRemoveItem,
  onClearAll,
  onFocusHydrant,
  onCreateMission,
  onAddToActiveMission,
  activeMission = null,
  currentUser = null,
  isMapFullscreen = false,
}) => {
  // Apenas Gestores e Administradores possuem acesso ao sistema de seleção/carrinho
  const isGestor = currentUser?.role === 'gestor' || currentUser?.role === 'admin';
  if (!isGestor || selectedIds.length === 0) {
    return null;
  }

  const [dragOffsetY, setDragOffsetY] = useState(0);
  const touchStartY = useRef(0);
  const isDragging = useRef(false);

  // Drag to dismiss no Mobile
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = true;
  };

  const handleTouchMove = (e) => {
    if (!isDragging.current) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;
    if (deltaY > 0) {
      setDragOffsetY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    if (dragOffsetY > 70) {
      if (onToggleOpen) onToggleOpen(false);
    }
    setDragOffsetY(0);
    isDragging.current = false;
  };

  // Obter objetos de hidrantes a partir dos IDs
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

  return (
    <>
      {/* ======================================================== */}
      {/* 1. BALÃO FLUTUANTE (QUANDO FECHADO) */}
      {/* ======================================================== */}
      {!isOpen && (
        <div 
          className={`fixed pointer-events-auto transition-all duration-300 z-[1050] ${
            isMapFullscreen 
              ? 'bottom-6 right-6' 
              : 'bottom-[68px] right-3 md:bottom-16 md:right-6'
          }`}
        >
          <button
            onClick={() => onToggleOpen(true)}
            title="Abrir Seleção de Hidrantes"
            className="group flex items-center gap-2.5 bg-slate-900/95 hover:bg-slate-800 text-slate-100 px-4 py-3 rounded-full border-2 border-emerald-500/80 shadow-[0_0_25px_rgba(16,185,129,0.45)] hover:shadow-[0_0_30px_rgba(16,185,129,0.65)] backdrop-blur-xl transition-all duration-200 active:scale-95 cursor-pointer"
          >
            <div className="relative flex items-center justify-center">
              <ShoppingCart size={22} className="text-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="absolute -top-2 -right-2.5 bg-emerald-500 text-slate-950 font-black text-[11px] px-1.5 py-0.2 rounded-full min-w-[18px] text-center shadow-lg animate-pulse">
                {selectedIds.length}
              </span>
            </div>
            <span className="text-xs font-black tracking-wide text-emerald-300 pr-0.5">
              {selectedIds.length === 1 ? '1 Selecionado' : `${selectedIds.length} Selecionados`}
            </span>
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. PAINEL EXPANDIDO (QUANDO ABERTO) - RESPONSIVO MOBILE / DESKTOP */}
      {/* ======================================================== */}
      {isOpen && (
        <>
          {/* Backdrop escuro no Mobile */}
          <div 
            className="md:hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[1090] transition-opacity"
            onClick={() => onToggleOpen(false)}
          />

          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined,
              transition: isDragging.current ? 'none' : 'transform 0.2s ease-out'
            }}
            className={`fixed z-[1100] bg-slate-900/98 backdrop-blur-2xl border border-emerald-500/50 shadow-[0_10px_40px_rgba(0,0,0,0.85)] flex flex-col pointer-events-auto ${
              isMapFullscreen 
                ? 'bottom-6 right-6 w-[390px] max-h-[540px] rounded-2xl'
                : 'inset-x-0 bottom-0 md:inset-x-auto md:bottom-16 md:right-6 md:w-[390px] max-h-[80vh] md:max-h-[540px] rounded-t-3xl md:rounded-2xl'
            }`}
          >
            {/* Handle visual de arrasto no Mobile */}
            <div 
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="md:hidden w-full pt-2 pb-1 flex items-center justify-center cursor-grab active:cursor-grabbing"
            >
              <div className="w-12 h-1.5 bg-slate-600 rounded-full" />
            </div>

            {/* Cabeçalho do Carrinho */}
            <div 
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
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
              {/* Botão 1: Criar Nova Missão */}
              <button
                onClick={() => {
                  if (onCreateMission) onCreateMission();
                }}
                className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs shadow-md shadow-emerald-950 flex items-center justify-center gap-2 transition-all active:scale-98 tracking-wide cursor-pointer"
              >
                <Plus size={16} strokeWidth={3} />
                <span>CRIAR NOVA MISSÃO ({selectedIds.length})</span>
              </button>

              <div className="flex items-center gap-2 w-full">
                {/* Botão 2: Adicionar à Missão Ativa */}
                <button
                  onClick={() => {
                    if (onAddToActiveMission) onAddToActiveMission();
                  }}
                  className={`flex-1 py-2 px-2.5 rounded-xl font-bold text-[11px] border shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 min-w-0 ${
                    activeMission 
                      ? 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border-cyan-500/40 hover:border-cyan-400' 
                      : 'bg-slate-800/60 hover:bg-slate-700 text-slate-400 border-slate-700'
                  }`}
                  title={activeMission ? `Adicionar à missão "${activeMission.name}"` : 'Adicionar à Missão Aberta'}
                >
                  <FolderPlus size={14} className="shrink-0 text-cyan-400" />
                  <span className="truncate">
                    {activeMission ? `Adicionar a "${activeMission.name}"` : 'Adicionar à Ativa'}
                  </span>
                </button>

                {/* Botão 3: Limpar Seleção */}
                <button
                  onClick={() => {
                    if (onClearAll) onClearAll();
                  }}
                  className="py-2 px-3 bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-800/60 hover:border-red-600 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 transition-all active:scale-95 shrink-0"
                  title="Limpar todos os itens da seleção"
                >
                  <Trash2 size={13} />
                  <span>Limpar</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default SelectionCart;
