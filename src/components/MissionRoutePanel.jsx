import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Navigation, LocateFixed, GitMerge, Share2, MapPin, Map as MapIcon, RotateCcw, Plus, Save, Edit, CheckCircle, FolderOpen } from 'lucide-react';
import { sanitizeProblem, extractProblemsList } from '../utils/problemUtils';

// Fórmula de Haversine para cálculo de distância (retorna km)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Algoritmo Vizinho Mais Próximo (Nearest Neighbor - TSP Aproximado)
const optimizeRouteTSP = (hidrantes, startLat, startLng) => {
  if (!hidrantes || hidrantes.length === 0) return [];
  
  let unvisited = [...hidrantes];
  let route = [];
  let currentLat = startLat;
  let currentLng = startLng;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const h = unvisited[i];
      const dist = calculateDistance(currentLat, currentLng, h.numLatitude, h.numLongitude);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIdx = i;
      }
    }

    const nextHydrant = unvisited.splice(nearestIdx, 1)[0];
    route.push(nextHydrant);
    currentLat = nextHydrant.numLatitude;
    currentLng = nextHydrant.numLongitude;
  }

  return route;
};

// Algoritmo Vizinho Mais Próximo via Matriz OSRM com Fallback para Haversine
const optimizeRouteMultiMode = async (hidrantes, startLat, startLng) => {
  if (!hidrantes || hidrantes.length === 0) return [];
  
  try {
    const coords = [[startLng, startLat], ...hidrantes.map(h => [h.numLongitude, h.numLatitude])];
    if (coords.length > 50) throw new Error("Muitos pontos para OSRM público. Forçando Haversine.");
    
    const coordsString = coords.map(c => `${c[0]},${c[1]}`).join(';');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500); 

    const response = await fetch(`https://router.project-osrm.org/table/v1/driving/${coordsString}?annotations=duration`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error("OSRM API respondeu com erro");
    const data = await response.json();
    if (data.code !== 'Ok' || !data.durations) throw new Error("OSRM API retornou payload inválido");

    const durations = data.durations;
    let unvisited = hidrantes.map((h, i) => ({ hydrant: h, matrixIndex: i + 1 }));
    let route = [];
    let currentIndex = 0;

    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let minDuration = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const targetIndex = unvisited[i].matrixIndex;
        const duration = durations[currentIndex][targetIndex];
        
        if (duration !== null && duration < minDuration) {
          minDuration = duration;
          nearestIdx = i;
        }
      }

      if (minDuration === Infinity) nearestIdx = 0;

      const nextNode = unvisited.splice(nearestIdx, 1)[0];
      route.push(nextNode.hydrant);
      currentIndex = nextNode.matrixIndex;
    }
    
    return route;
  } catch (error) {
    console.warn("Falha/Timeout no OSRM. Acionando Fallback para Haversine Euclidiano:", error);
    return optimizeRouteTSP(hidrantes, startLat, startLng);
  }
};

const MissionRoutePanel = ({ hidrantes, selectedMissionIds, completedMissionIds = [], currentMission, onUpdateMission, onClose, onBackToManager, onClearMission, onRemoveFromMission, lastInspectedCoords, onInspect, onEdit, onCenterMap, currentUser, folders, onSaveRouteToFolder, onGenerateReport }) => {
  const [pendingRoute, setPendingRoute] = useState([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isEditingAtribuicao, setIsEditingAtribuicao] = useState(false);
  const [editedAtribuicao, setEditedAtribuicao] = useState('');
  
  const [userLocation, setUserLocation] = useState(null);

  // Throttling GPS Ativo (Apenas enquanto o painel está aberto)
  useEffect(() => {
    let watchId;
    const startWatching = () => {
      if ('geolocation' in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (err) => console.warn('Erro no GPS', err),
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );
      }
    };
    
    startWatching();
    
    // Gatilho Inteligente de Recálculo (Evento de Foco da Janela - Troca Waze/Netuno)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          );
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const missionHydrants = useMemo(() => {
    if (!selectedMissionIds || selectedMissionIds.length === 0) return [];
    return hidrantes.filter(h => 
      selectedMissionIds.includes(h.codHidrante) || 
      selectedMissionIds.includes(h.nomHidrante) || 
      selectedMissionIds.includes(h._internalId)
    );
  }, [hidrantes, selectedMissionIds]);

  const pendingHydrants = useMemo(() => {
    return missionHydrants.filter(h => 
      !completedMissionIds.includes(h.codHidrante) && 
      !completedMissionIds.includes(h.nomHidrante) && 
      !completedMissionIds.includes(h._internalId)
    );
  }, [missionHydrants, completedMissionIds]);

  const completedHydrants = useMemo(() => {
    return missionHydrants.filter(h => 
      completedMissionIds.includes(h.codHidrante) || 
      completedMissionIds.includes(h.nomHidrante) || 
      completedMissionIds.includes(h._internalId)
    );
  }, [missionHydrants, completedMissionIds]);

  // Atualiza e Reordena automaticamente com o GPS
  useEffect(() => {
    let currentPending = pendingHydrants;
    if (userLocation && currentPending.length > 0) {
      // Reordena por proximidade direta se temos GPS
      currentPending = [...currentPending].sort((a, b) => {
        const distA = calculateDistance(userLocation.lat, userLocation.lng, a.numLatitude, a.numLongitude);
        const distB = calculateDistance(userLocation.lat, userLocation.lng, b.numLatitude, b.numLongitude);
        return distA - distB;
      });
    }
    
    setPendingRoute(prev => {
      const orderChanged = currentPending.some((h, i) => h !== prev[i]);
      if (orderChanged || prev.length !== currentPending.length) {
        return currentPending;
      }
      return prev;
    });
  }, [pendingHydrants, userLocation]);

  const handleOptimizeRoute = async () => {
    setIsOptimizing(true);
    if (pendingRoute && pendingRoute.length > 0 && pendingRoute[0]) {
      const start = pendingRoute[0]; // TODO startLat startLng
      const startLat = userLocation ? userLocation.lat : start.numLatitude;
      const startLng = userLocation ? userLocation.lng : start.numLongitude;

      const newRoute = await optimizeRouteMultiMode(pendingHydrants, startLat, startLng);
      setPendingRoute(newRoute);
    }
    setIsOptimizing(false);
  };

  const handleShareWhatsApp = () => {
    const totalCount = (completedHydrants?.length || 0) + (pendingRoute?.length || 0);
    if (totalCount === 0) return;
    
    const baseUrl = window.location.origin + window.location.pathname;
    const missionId = currentMission?.id;
    let magicLink = '';
    if (missionId) {
      magicLink = `${baseUrl}?m=${encodeURIComponent(missionId)}`;
    } else {
      const allIds = [...(pendingRoute || []), ...(completedHydrants || [])].map(h => h.nomHidrante || h.codHidrante).filter(Boolean);
      magicLink = `${baseUrl}?ds=${allIds.slice(0, 30).join(',')}`;
    }
    
    const missionName = currentMission?.name || "Rascunho de Hoje";
    
    // Identificar vistoriadores únicos que realizaram as vistorias
    const vistoriadoresUnicos = Array.from(
      new Set(completedHydrants.map(h => h.vistoriadorNome || h.nomVistoriador).filter(Boolean))
    );
    
    let vistoriadorText = 'Pendente de início';
    if (completedHydrants.length > 0) {
      vistoriadorText = vistoriadoresUnicos.length > 0 
        ? vistoriadoresUnicos.join(', ') 
        : (currentUser?.nome || 'Equipe CBMDF');
    }
    
    let text = `🚒 *NETUNO - STATUS DE MISSÃO*\n\n`;
    text += `📋 *Missão:* ${missionName}\n`;
    text += `👤 *Vistoriador:* ${vistoriadorText}\n`;
    text += `📊 *Progresso:* ${completedHydrants.length} Concluídos / ${pendingRoute.length} Faltantes (Total: ${totalCount})\n\n`;
    
    if (completedHydrants.length > 0) {
      text += `✅ *CONCLUÍDOS (${completedHydrants.length}):*\n`;
      completedHydrants.forEach(h => {
        const id = h.nomHidrante || h.codHidrante;
        const probs = extractProblemsList(h.problemasHidrante);
        const probText = probs.length > 0 ? ` - ${probs.join(', ')}` : '';
        const status = h.flgAtivo ? '🟢 Operante' : `🔴 Inoperante${probText}`;
        text += `• ${id} (${status})\n`;
      });
      text += `\n`;
    }
    
    if (pendingRoute.length > 0) {
      text += `⏳ *FALTANTES (${pendingRoute.length}):*\n`;
      pendingRoute.forEach(h => {
        const id = h.nomHidrante || h.codHidrante;
        const end = h.dscEndereco ? ` - ${h.dscEndereco}` : (h.dscLocalidade ? ` - ${h.dscLocalidade}` : '');
        text += `• ${id}${end}\n`;
      });
      text += `\n`;
    }
    
    text += `🔗 *Link da Missão:* ${magicLink}\n`;
    
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const url = isMobile
      ? `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
      : `https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleWazeRoute = () => {
    if (!pendingRoute || pendingRoute.length === 0 || !pendingRoute[0]) return;
    const nextTarget = pendingRoute[0];
    const url = `https://waze.com/ul?ll=${nextTarget.numLatitude},${nextTarget.numLongitude}&navigate=yes`;
    window.open(url, '_blank');
  };

  const renderHydrantItem = (h, index, isCompleted) => {
    const id = h.codHidrante || h.nomHidrante;
    const canEditRoute = !currentMission?.createdBy || currentMission.createdBy === currentUser?.matricula;
    
    // Distância métrica
    let distText = '';
    if (userLocation) {
      const dist = calculateDistance(userLocation.lat, userLocation.lng, h.numLatitude, h.numLongitude);
      distText = dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`;
    }

    // Degradê de opacidade e estilo de card
    let itemClasses = "";
    if (isCompleted) {
      itemClasses = "bg-slate-900/60 border-l-4 border-slate-700 rounded-xl p-2.5 sm:p-3 flex flex-col lg:flex-row gap-2.5 items-start lg:items-center justify-between opacity-70 grayscale transition-all";
    } else {
      if (index === 0) {
        // 1º Lugar (Mais Próximo): Cor sólida destacada (ciano/verde pulsante com fundo de alto contraste).
        itemClasses = "bg-slate-800/95 border-l-4 border-emerald-400 rounded-xl p-2.5 sm:p-3 shadow-[0_0_14px_rgba(52,211,153,0.25)] flex flex-col lg:flex-row gap-2.5 items-start lg:items-center justify-between animate-pulse-border relative overflow-hidden transition-all";
      } else if (index > 0 && index <= 3) {
        // 2º ao 4º Lugar: opacidade gradual
        itemClasses = "bg-slate-800/90 border-l-4 border-emerald-600/60 rounded-xl p-2.5 sm:p-3 flex flex-col lg:flex-row gap-2.5 items-start lg:items-center justify-between transition-all";
      } else {
        // Demais Hidrantes: fundo com maior transparência
        itemClasses = "bg-slate-800/60 border-l-4 border-slate-600 rounded-xl p-2.5 sm:p-3 shadow-sm flex flex-col lg:flex-row gap-2.5 items-start lg:items-center justify-between transition-all";
      }
    }

    return (
      <div key={id || index} className={itemClasses} style={!isCompleted && index > 0 && index <= 3 ? { opacity: 1 - (index * 0.15) } : {}}>
        <div className="flex items-center gap-3 flex-1 min-w-0 w-full">
          {/* Sequência / Número */}
          <div className={
            isCompleted 
              ? "bg-slate-700 text-slate-400 font-bold text-xs rounded-full w-7 h-7 flex items-center justify-center shrink-0" 
              : (index === 0 
                  ? "bg-emerald-500 text-white font-black text-sm rounded-full w-8 h-8 flex items-center justify-center shadow-md shrink-0 ring-2 ring-emerald-400/30" 
                  : "bg-emerald-950 text-emerald-400 border border-emerald-500/30 font-bold text-xs rounded-full w-7 h-7 flex items-center justify-center shrink-0")
          }>
            {isCompleted ? "✓" : index + 1}
          </div>
          
          {/* FOTO DE PERFIL DO HIDRANTE (Thumbnail) */}
          {!isCompleted && h.fotoPerfil && (
            <img src={h.fotoPerfil} alt="Perfil" className="w-9 h-9 object-cover rounded-md border border-slate-600 shrink-0 cursor-pointer hover:scale-105 transition-transform" />
          )}
          
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            {/* Linha 1: Identificador + RA + Distância + Alerta Inline no Desktop */}
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="font-bold text-slate-100 text-sm tracking-wide shrink-0">
                {h.nomHidrante || h.codHidrante}
              </span>
              
              {h.dscLocalidade && (
                <span className="bg-slate-700/80 border border-slate-600/60 text-cyan-300 text-[11px] font-semibold px-2 py-0.5 rounded shadow-sm shrink-0">
                  {h.dscLocalidade}
                </span>
              )}

              {distText && (
                <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border flex items-center gap-1 shrink-0 ${
                  index === 0 
                    ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.3)]' 
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}>
                  <span>📍</span> {distText}
                </span>
              )}

              {h.problemasHidrante && h.problemasHidrante.trim() !== '' && (
                <span className="hidden xl:inline-flex items-center gap-1 bg-amber-950/60 border border-amber-600/40 text-amber-300 text-[11px] font-semibold px-2 py-0.5 rounded truncate max-w-sm">
                  ⚠️ {sanitizeProblem(h.problemasHidrante)}
                </span>
              )}
            </div>
            
            {/* Linha 2: Endereço & Alerta para Telas Menores */}
            <div className="flex flex-col xl:flex-row xl:items-center gap-1 text-slate-300 text-xs">
              <span className="text-slate-400 text-xs truncate max-w-2xl" title={h.dscEndereco || ''}>
                {h.dscEndereco || 'Endereço não informado'}
              </span>

              {h.problemasHidrante && h.problemasHidrante.trim() !== '' && (
                <span className="xl:hidden inline-flex items-center gap-1 bg-amber-950/60 border border-amber-600/40 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded truncate w-fit mt-0.5">
                  ⚠️ {sanitizeProblem(h.problemasHidrante)}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Bloco de Ações do Item */}
        <div className="flex items-center justify-end gap-1.5 shrink-0 w-full lg:w-auto mt-1 lg:mt-0 border-t lg:border-t-0 border-slate-700/60 pt-1.5 lg:pt-0">
          <button 
            onClick={() => { onCenterMap && onCenterMap(h); onClose(); }} 
            title="Localizar no Mapa" 
            className="h-8 px-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs active:scale-95 transition-all flex items-center gap-1 font-semibold border border-slate-600/60 shadow-sm"
          >
            <LocateFixed size={14} className="text-cyan-400" />
            <span className="hidden sm:inline text-xs">Mapa</span>
          </button>
          {!isCompleted && (
            <button 
              onClick={() => window.open(`https://waze.com/ul?ll=${h.numLatitude},${h.numLongitude}&navigate=yes`, '_blank')} 
              title="Navegar no Waze" 
              className="h-8 px-2.5 bg-blue-600/90 hover:bg-blue-600 text-white rounded-lg text-xs active:scale-95 transition-all flex items-center gap-1 font-semibold shadow-sm"
            >
              <Navigation size={14} />
              <span className="hidden sm:inline text-xs">Waze</span>
            </button>
          )}
          {!isCompleted && (
            <button 
              onClick={() => onInspect && onInspect(h)} 
              title="Cadastrar Vistoria" 
              className="h-8 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg active:scale-95 transition-all font-bold text-xs flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
            >
              <Plus size={15} strokeWidth={3}/>
              <span>VISTORIA</span>
            </button>
          )}

          {(!isCompleted && (currentUser?.role === 'gestor' || currentUser?.role === 'admin')) && (
            <button 
              onClick={() => onEdit && onEdit(h)} 
              title="Editar Hidrante" 
              className="h-8 w-8 flex items-center justify-center bg-amber-700 hover:bg-amber-600 text-white rounded-lg active:scale-95 transition-all shadow-sm"
            >
              <Edit size={14}/>
            </button>
          )}
          
          {canEditRoute && (
            <button 
              onClick={() => {
                const name = h.nomHidrante || h.codHidrante || id;
                if (window.confirm(`Deseja realmente remover o hidrante "${name}" da rota de missão?`)) {
                  onRemoveFromMission(id);
                }
              }} 
              title="Remover da Missão" 
              className="h-8 w-8 flex items-center justify-center bg-rose-950/80 text-rose-400 hover:bg-rose-800 hover:text-white border border-rose-800/40 rounded-lg active:scale-95 transition-all ml-0.5"
            >
              <X size={14}/>
            </button>
          )}
        </div>
      </div>
    );
  };

  // Badge Contador Diário
  const vistoriasHoje = completedHydrants.length; // Assumindo que os concluídos da missão são de hoje

  return (
    <div className="flex flex-col p-2.5 sm:p-4 w-full h-full bg-slate-900 relative">

      <div className="flex justify-between items-center mb-2.5 pb-2.5 border-b border-slate-700 relative">
        <div className="flex items-center gap-2.5 flex-1 min-w-0 mr-2">
          {onBackToManager && (
            <button 
              type="button" 
              onClick={onBackToManager}
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg font-semibold transition-colors flex items-center gap-1.5 shrink-0 shadow-sm"
              title="Voltar para a Central de Missões"
            >
              ← Voltar
            </button>
          )}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {currentMission ? (
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <GitMerge size={20} className="text-emerald-400 shrink-0" />
                  <span className="font-bold text-base sm:text-lg text-slate-100 drop-shadow-sm truncate">
                    {currentMission.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="bg-emerald-900/80 border border-emerald-500 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                    Hoje: {vistoriasHoje}
                  </span>
                  {currentMission.isDraft && (
                    <span className="bg-amber-900/50 text-amber-400 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border border-amber-800">
                      Não Salvo
                    </span>
                  )}
                  {!currentMission.isDraft && currentMission.parentFolderId && (
                    <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded flex items-center gap-1">
                      <FolderOpen size={12} /> {folders?.find(f => f.id === currentMission.parentFolderId)?.name || 'Central'}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <h2 className="text-lg font-bold text-emerald-400 flex items-center gap-2 drop-shadow-sm">
                <GitMerge size={20} /> Rota de Missão
              </h2>
            )}
          </div>
        </div>
        
        <button onClick={onClose} className="p-1.5 bg-slate-800 hover:bg-red-900/50 hover:text-red-400 text-slate-400 rounded-full transition-colors shrink-0 z-10" title="Fechar Rota">
          <X size={20} />
        </button>
      </div>

      {/* BOTÃO NAVEGAR PRÓXIMO COMPACTO */}
      {pendingRoute.length > 0 && (
        <div className="mb-2.5">
          <button 
            onClick={handleWazeRoute}
            className="w-full flex items-center justify-between gap-3 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-3.5 rounded-xl shadow-[0_0_14px_rgba(37,99,235,0.4)] active:scale-[0.99] transition-all relative overflow-hidden group cursor-pointer"
          >
            <div className="flex items-center gap-2.5 text-xs sm:text-sm drop-shadow-md truncate">
              <Navigation size={18} className="animate-bounce shrink-0 text-cyan-300" />
              <span className="truncate tracking-wide">🚀 NAVEGAR PARA PRÓXIMO ALVO (WAZE)</span>
            </div>
            <div className="text-xs font-mono font-bold bg-blue-900/80 px-2.5 py-1 rounded-lg border border-blue-400/50 text-cyan-200 shrink-0 shadow-inner flex items-center gap-1.5">
              <span>🎯</span>
              <span>{pendingRoute[0]?.nomHidrante || pendingRoute[0]?.codHidrante || 'Alvo'}</span>
            </div>
            <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] skew-x-12"></div>
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto mb-1.5 bg-slate-800/50 rounded-xl p-2 border border-slate-700 scroll-pt-2">
        {missionHydrants.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 p-6 text-center">
            <MapPin size={48} className="text-emerald-400/40 animate-pulse" />
            <p className="text-sm font-semibold text-slate-300 max-w-sm">
              Para criar uma nova rota de missão, selecione os hidrantes no mapa ou no bloco de lista.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {pendingRoute.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <h3 className="text-slate-300 font-bold uppercase tracking-wider text-xs flex items-center gap-1.5 border-b border-slate-700 pb-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  Faltantes ({pendingRoute.length})
                </h3>
                {pendingRoute.map((h, index) => renderHydrantItem(h, index, false))}
              </div>
            )}

            {completedHydrants.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-1">
                <h3 className="text-slate-400 font-bold uppercase tracking-wider text-xs flex items-center gap-1.5 border-b border-slate-700 pb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Concluídos na Missão ({completedHydrants.length})
                </h3>
                {completedHydrants.map((h, index) => renderHydrantItem(h, index, true))}
              </div>
            )}
            
            {pendingRoute.length === 0 && completedHydrants.length > 0 && (
               <div className="p-3 text-center text-emerald-400 font-bold bg-emerald-900/30 rounded-lg border border-emerald-900 mt-2 text-xs">
                 🎉 Missão totalmente concluída!
               </div>
            )}
          </div>
        )}
      </div>

      {/* Ações do Rodapé da Rota (WhatsApp e Relatório da Missão) */}
      <div className={`grid ${((currentUser?.role === 'gestor' || currentUser?.role === 'admin') && onGenerateReport) ? 'grid-cols-2' : 'grid-cols-1'} gap-2 pb-1 pt-1.5 border-t border-slate-700 relative flex-shrink-0`}>

        <button 
          onClick={handleShareWhatsApp}
          disabled={pendingRoute.length === 0 && completedHydrants.length === 0}
          className="h-9 flex items-center justify-center gap-1.5 bg-[#25D366] hover:bg-[#20bd5a] disabled:opacity-50 text-white font-bold px-3 rounded-xl shadow-md active:scale-95 transition-all text-xs truncate cursor-pointer"
          title="Compartilhar Rota no WhatsApp"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" className="shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a5.8 5.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
          <span className="truncate">Compartilhar WhatsApp</span>
        </button>

        {(currentUser?.role === 'gestor' || currentUser?.role === 'admin') && onGenerateReport && (
          <button 
            onClick={onGenerateReport}
            disabled={missionHydrants.length === 0}
            className="h-9 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold px-3 rounded-xl shadow-md active:scale-95 transition-all text-xs truncate cursor-pointer"
            title="Gerar Relatório da Missão"
          >
            <FolderOpen size={15} className="shrink-0" />
            <span className="truncate">Relatório da Missão</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default MissionRoutePanel;
