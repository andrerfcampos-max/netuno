import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Navigation, LocateFixed, GitMerge, Share2, MapPin, Map as MapIcon, RotateCcw, Plus, Save, Edit, CheckCircle, FolderOpen, CheckCircle2, ClipboardCheck, AlertTriangle } from 'lucide-react';
import { sanitizeProblem, extractProblemsList } from '../utils/problemUtils';
import { fixEncoding } from '../utils/textUtils';

// Fórmula de Haversine para cálculo de distância geodésica ultra-rápida (retorna km)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return 999;
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

// Algoritmo Vizinho Mais Próximo (Nearest Neighbor - TSP Instantâneo - 0ms de latência)
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

// Refinamento Viário OSRM em Segundo Plano (Apenas para o lote inicial de até 15 hidrantes imediatos)
const fetchOSRMInitialChunk = async (chunkHydrants, startLat, startLng) => {
  if (!chunkHydrants || chunkHydrants.length === 0) {
    return { route: [], drivingMetrics: {}, isTrafficMode: false };
  }

  try {
    const coords = [[startLng, startLat], ...chunkHydrants.map(h => [h.numLongitude, h.numLatitude])];
    const coordsString = coords.map(c => `${c[0]},${c[1]}`).join(';');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500); 

    const response = await fetch(`https://router.project-osrm.org/table/v1/driving/${coordsString}?annotations=duration,distance`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error("OSRM API respondeu com erro");
    const data = await response.json();
    if (data.code !== 'Ok' || !data.durations) throw new Error("OSRM API retornou payload inválido");

    const durations = data.durations;
    const distances = data.distances || [];
    let unvisited = chunkHydrants.map((h, i) => ({ hydrant: h, matrixIndex: i + 1 }));
    let route = [];
    let currentIndex = 0;
    const drivingMetrics = {};

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
      const targetHydrant = nextNode.hydrant;
      const targetIdx = nextNode.matrixIndex;
      
      const distMeters = distances[currentIndex] ? distances[currentIndex][targetIdx] : null;
      const durSec = durations[currentIndex] ? durations[currentIndex][targetIdx] : null;
      
      const keys = [targetHydrant.codHidrante, targetHydrant._internalId, targetHydrant.nomHidrante].filter(Boolean);
      keys.forEach(k => {
        drivingMetrics[String(k)] = {
          distanceMeters: distMeters,
          durationSeconds: durSec,
          legFromPrevious: currentIndex !== 0
        };
      });

      route.push(targetHydrant);
      currentIndex = nextNode.matrixIndex;
    }
    
    return { route, drivingMetrics, isTrafficMode: true };
  } catch (error) {
    return { route: chunkHydrants, drivingMetrics: {}, isTrafficMode: false };
  }
};

const MissionRoutePanel = ({ 
  hidrantes = [], 
  selectedMissionIds = [], 
  completedMissionIds = [], 
  currentMission = null, 
  onUpdateMission, 
  onClose, 
  onBackToManager, 
  onClearMission, 
  onRemoveFromMission, 
  lastInspectedCoords, 
  onInspect, 
  onEdit, 
  onCenterMap, 
  currentUser, 
  folders = [], 
  onSaveRouteToFolder, 
  onGenerateReport 
}) => {
  const [pendingRoute, setPendingRoute] = useState([]);
  const [drivingMetrics, setDrivingMetrics] = useState({});
  const [isTrafficOptimized, setIsTrafficOptimized] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const lastOptimizedIdsRef = useRef('');

  // Sincronização GPS Ativa
  useEffect(() => {
    let watchId;
    const startWatching = () => {
      if ('geolocation' in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            if (pos?.coords) {
              setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            }
          },
          (err) => console.warn('Erro no GPS', err),
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );
      }
    };
    
    startWatching();
    
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (pos?.coords) {
                setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
              }
            },
            () => {},
            { enableHighAccuracy: true, timeout: 4000 }
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

  // Conjunto de IDs selecionados normalizados em string
  const selectedIdsSet = useMemo(() => {
    return new Set((selectedMissionIds || []).map(id => String(id)));
  }, [selectedMissionIds]);

  // Conjunto de IDs concluídos normalizados em string
  const completedIdsSet = useMemo(() => {
    return new Set((completedMissionIds || []).map(id => String(id)));
  }, [completedMissionIds]);

  // Hidrantes que pertencem à missão
  const missionHydrants = useMemo(() => {
    if (!selectedMissionIds || selectedMissionIds.length === 0) return [];
    return hidrantes.filter(h => {
      const k1 = h.codHidrante !== undefined && h.codHidrante !== null ? String(h.codHidrante) : null;
      const k2 = h.nomHidrante ? String(h.nomHidrante) : null;
      const k3 = h._internalId ? String(h._internalId) : null;
      return (k1 && selectedIdsSet.has(k1)) || (k2 && selectedIdsSet.has(k2)) || (k3 && selectedIdsSet.has(k3));
    });
  }, [hidrantes, selectedIdsSet]);

  // Hidrantes concluídos na missão
  const completedHydrants = useMemo(() => {
    return missionHydrants.filter(h => {
      const k1 = h.codHidrante !== undefined && h.codHidrante !== null ? String(h.codHidrante) : null;
      const k2 = h.nomHidrante ? String(h.nomHidrante) : null;
      const k3 = h._internalId ? String(h._internalId) : null;
      return (k1 && completedIdsSet.has(k1)) || (k2 && completedIdsSet.has(k2)) || (k3 && completedIdsSet.has(k3));
    });
  }, [missionHydrants, completedIdsSet]);

  // Hidrantes faltantes / pendentes
  const pendingHydrants = useMemo(() => {
    return missionHydrants.filter(h => {
      const k1 = h.codHidrante !== undefined && h.codHidrante !== null ? String(h.codHidrante) : null;
      const k2 = h.nomHidrante ? String(h.nomHidrante) : null;
      const k3 = h._internalId ? String(h._internalId) : null;
      const isDone = (k1 && completedIdsSet.has(k1)) || (k2 && completedIdsSet.has(k2)) || (k3 && completedIdsSet.has(k3));
      return !isDone;
    });
  }, [missionHydrants, completedIdsSet]);

  // Algoritmo Híbrido de Alta Performance (Instantâneo TSP + OSRM para o lote imediato)
  useEffect(() => {
    if (pendingHydrants.length === 0) {
      setPendingRoute([]);
      setDrivingMetrics({});
      setIsTrafficOptimized(false);
      setIsOptimizing(false);
      return;
    }

    const startLat = userLocation?.lat || pendingHydrants[0].numLatitude;
    const startLng = userLocation?.lng || pendingHydrants[0].numLongitude;

    // 1. ORDENAÇÃO INSTANTÂNEA ESPACIAL (0ms): Rota pronta imediatamente
    const fastOrdered = optimizeRouteTSP(pendingHydrants, startLat, startLng);
    setPendingRoute(fastOrdered);

    // 2. MICRO-OTIMIZAÇÃO OSRM EM BACKGROUND (Apenas para os primeiros 15 hidrantes)
    const pendingSignature = pendingHydrants.map(h => h.codHidrante || h._internalId || h.nomHidrante).join(',');
    if (lastOptimizedIdsRef.current === pendingSignature) {
      return;
    }

    let isCancelled = false;
    const refineWithOSRM = async () => {
      setIsOptimizing(true);
      const CHUNK_LIMIT = 15;
      const immediateBatch = fastOrdered.slice(0, CHUNK_LIMIT);
      const remainingBatch = fastOrdered.slice(CHUNK_LIMIT);

      const osrmResult = await fetchOSRMInitialChunk(immediateBatch, startLat, startLng);
      
      if (!isCancelled) {
        lastOptimizedIdsRef.current = pendingSignature;
        if (osrmResult.isTrafficMode && osrmResult.route.length > 0) {
          setPendingRoute([...osrmResult.route, ...remainingBatch]);
          setDrivingMetrics(osrmResult.drivingMetrics);
          setIsTrafficOptimized(true);
        } else {
          // Preenche métricas estimadas geodésicas instantâneas
          const estimatedMetrics = {};
          let prevLat = startLat;
          let prevLng = startLng;
          fastOrdered.forEach((h, idx) => {
            const distKm = calculateDistance(prevLat, prevLng, h.numLatitude, h.numLongitude);
            const k1 = String(h.codHidrante || '');
            const k2 = String(h.nomHidrante || '');
            const k3 = String(h._internalId || '');
            const metric = {
              distanceMeters: Math.round(distKm * 1000),
              durationSeconds: Math.round((distKm / 35) * 3600),
              legFromPrevious: idx !== 0,
              isEstimated: true
            };
            if (k1) estimatedMetrics[k1] = metric;
            if (k2) estimatedMetrics[k2] = metric;
            if (k3) estimatedMetrics[k3] = metric;
            prevLat = h.numLatitude;
            prevLng = h.numLongitude;
          });
          setDrivingMetrics(estimatedMetrics);
          setIsTrafficOptimized(false);
        }
        setIsOptimizing(false);
      }
    };

    const timer = setTimeout(refineWithOSRM, 250);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [pendingHydrants, userLocation?.lat, userLocation?.lng]);

  const handleShareWhatsApp = () => {
    const totalCount = completedHydrants.length + pendingRoute.length;
    if (totalCount === 0) return;
    
    const baseUrl = window.location.origin + window.location.pathname;
    const missionId = currentMission?.id;
    let magicLink = '';
    if (missionId) {
      magicLink = `${baseUrl}?m=${encodeURIComponent(missionId)}`;
    } else {
      const allIds = [...pendingRoute, ...completedHydrants].map(h => h.nomHidrante || h.codHidrante).filter(Boolean);
      magicLink = `${baseUrl}?ds=${allIds.slice(0, 30).join(',')}`;
    }
    
    const missionName = currentMission?.name || "Rascunho de Hoje";
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
    text += `📊 *Progresso:* ${completedHydrants.length}/${totalCount} Concluídos (${Math.round((completedHydrants.length / totalCount) * 100)}%)\n\n`;
    
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

  const handleRemoveItem = (h) => {
    const name = fixEncoding(h.nomHidrante) || h.codHidrante || 'Hidrante';
    if (window.confirm(`Deseja realmente remover "${name}" da rota de missão?`)) {
      // Atualização otimista imediata na UI
      const idKey = h._internalId || h.codHidrante || h.nomHidrante;
      setPendingRoute(prev => prev.filter(item => 
        (item._internalId || item.codHidrante || item.nomHidrante) !== idKey
      ));
      if (onRemoveFromMission) {
        onRemoveFromMission(h);
      }
    }
  };

  const totalCount = completedHydrants.length + pendingRoute.length;
  const completedCount = completedHydrants.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const currentTarget = pendingRoute.length > 0 ? pendingRoute[0] : null;

  const renderHydrantItem = (h, index, isCompleted) => {
    const id = h.codHidrante || h.nomHidrante;
    const canEditRoute = !currentMission?.createdBy || currentMission.createdBy === currentUser?.matricula;
    
    let distText = '';
    const key = String(h.codHidrante || h._internalId || h.nomHidrante || '');
    const metric = drivingMetrics[key];

    if (metric && metric.distanceMeters !== null && metric.distanceMeters !== undefined) {
      const dMeters = metric.distanceMeters;
      const dText = dMeters < 1000 ? `${Math.round(dMeters)}m` : `${(dMeters / 1000).toFixed(1)}km`;
      const durMin = metric.durationSeconds ? `~${Math.max(1, Math.ceil(metric.durationSeconds / 60))}min` : '';
      distText = durMin ? `${dText} • ${durMin}` : dText;
    } else if (userLocation) {
      const dist = calculateDistance(userLocation.lat, userLocation.lng, h.numLatitude, h.numLongitude);
      const dText = dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`;
      distText = `${dText} (reta)`;
    }

    // ========================================================
    // 1º LUGAR (ALVO ATUAL): SUPER CARD TÁTICO DESTACADO
    // ========================================================
    if (!isCompleted && index === 0) {
      return (
        <div 
          key={h._internalId || h.codHidrante || h.nomHidrante || index}
          className="w-full rounded-xl p-2.5 sm:p-3.5 bg-gradient-to-b from-slate-800/98 via-slate-850/95 to-slate-900 border-2 border-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.25)] flex flex-col gap-2 transition-all overflow-hidden relative"
        >
          {/* Cabeçalho do Super Card */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-md shrink-0 ring-2 ring-emerald-300/60">
                1
              </div>

              {h.fotoPerfil && (
                <img src={h.fotoPerfil} alt="Perfil" className="w-8 h-8 object-cover rounded-lg border border-slate-600 shrink-0 cursor-pointer hover:scale-105 transition-transform shadow-sm" />
              )}

              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-extrabold text-slate-100 text-sm sm:text-base tracking-wide truncate">
                    {fixEncoding(h.nomHidrante) || h.codHidrante}
                  </span>
                  {h.dscLocalidade && (
                    <span className="bg-slate-700/80 border border-slate-600/60 text-cyan-300 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm shrink-0">
                      {fixEncoding(h.dscLocalidade)}
                    </span>
                  )}
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-0.5">
                    <span>🎯</span> Próximo
                  </span>
                </div>

                {distText && (
                  <span className="text-[10px] font-mono font-bold text-emerald-300 flex items-center gap-1 mt-0.5">
                    <span>📍</span> {distText}
                  </span>
                )}
              </div>
            </div>

            {/* Ações Rápidas de Topo (Mapa, Editar, X) */}
            <div className="flex items-center gap-1 shrink-0">
              <button 
                onClick={() => { onCenterMap && onCenterMap(h); onClose(); }} 
                title="Localizar no Mapa" 
                className="h-7 px-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-[11px] active:scale-95 transition-all flex items-center gap-1 font-semibold border border-slate-600/60 shadow-sm cursor-pointer"
              >
                <LocateFixed size={13} className="text-cyan-400" />
                <span className="hidden sm:inline">Mapa</span>
              </button>

              {(!isCompleted && (currentUser?.role === 'gestor' || currentUser?.role === 'admin')) && (
                <button 
                  onClick={() => onEdit && onEdit(h)} 
                  title="Editar Hidrante" 
                  className="h-7 w-7 flex items-center justify-center bg-amber-700 hover:bg-amber-600 text-white rounded-lg active:scale-95 transition-all shadow-sm cursor-pointer"
                >
                  <Edit size={13}/>
                </button>
              )}

              {canEditRoute && (
                <button 
                  onClick={() => handleRemoveItem(h)} 
                  title="Remover da Missão" 
                  className="h-7 w-7 flex items-center justify-center bg-rose-950/80 text-rose-400 hover:bg-rose-800 hover:text-white border border-rose-800/40 rounded-lg active:scale-95 transition-all cursor-pointer"
                >
                  <X size={13}/>
                </button>
              )}
            </div>
          </div>

          {/* Endereço Completo e Alertas */}
          <div className="flex flex-col gap-1 bg-slate-950/70 p-2 rounded-lg border border-slate-700/80 text-[11px] sm:text-xs">
            <div className="text-slate-300 break-words leading-tight">
              <strong className="text-slate-400">Endereço: </strong>
              <span className="text-slate-100 font-medium">{fixEncoding(h.dscEndereco) || 'Endereço não informado'}</span>
              {h.dscPontoReferencia && (
                <span className="text-slate-400 italic block mt-0.5 text-[10px]">Ref: {fixEncoding(h.dscPontoReferencia)}</span>
              )}
            </div>

            {h.problemasHidrante && h.problemasHidrante.trim() !== '' && (
              <div className="p-1.5 rounded-md bg-red-950/70 border border-red-500/50 text-red-200 font-bold text-[10px] sm:text-[11px] flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-red-400 shrink-0" />
                <span className="leading-tight break-words">{fixEncoding(sanitizeProblem(h.problemasHidrante))}</span>
              </div>
            )}
          </div>

          {/* BOTÕES DE AÇÃO TÁTICA DO PRÓXIMO ALVO (WAZE LARGO + VISTORIA COMPACTO) */}
          <div className="flex items-center gap-1.5 pt-0.5">
            {/* BOTÃO 1: NAVEGAR COM WAZE (MAIS LARGO) */}
            <button 
              onClick={() => window.open(`https://waze.com/ul?ll=${h.numLatitude},${h.numLongitude}&navigate=yes`, '_blank')} 
              className="flex-[1.6] min-w-0 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold py-2 px-2 rounded-xl shadow-[0_0_12px_rgba(37,99,235,0.35)] active:scale-[0.98] transition-all text-xs cursor-pointer truncate"
              title="Navegar no Waze para o Próximo Alvo"
            >
              <Navigation size={15} className="shrink-0 text-cyan-300 animate-bounce" />
              <span className="truncate tracking-tight">Navegar para o próximo</span>
            </button>

            {/* BOTÃO 2: CADASTRAR VISTORIA (MAIS ESTREITO AO LADO) */}
            <button 
              onClick={() => onInspect && onInspect(h)} 
              title="Cadastrar Vistoria Técnica" 
              className="flex-1 min-w-0 py-2 px-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-950/60 flex items-center justify-center gap-1 transition-all active:scale-[0.98] cursor-pointer ring-1 ring-emerald-400/40 truncate"
            >
              <ClipboardCheck size={16} strokeWidth={2.5} className="shrink-0" />
              <span className="truncate">+ VISTORIA</span>
            </button>
          </div>
        </div>
      );
    }

    // ========================================================
    // DEMAIS LUGARES (2º, 3º, etc. e Concluídos): CARD COMPACTO
    // ========================================================
    let itemClasses = "w-full rounded-xl p-2 sm:p-2.5 flex flex-col sm:flex-row gap-1.5 sm:gap-2 items-start sm:items-center justify-between transition-all overflow-hidden border-l-4 ";
    if (isCompleted) {
      itemClasses += "bg-slate-900/60 border-slate-700 opacity-70 grayscale";
    } else {
      if (index > 0 && index <= 3) {
        itemClasses += "bg-slate-800/90 border-emerald-600/60";
      } else {
        itemClasses += "bg-slate-800/60 border-slate-600 shadow-sm";
      }
    }

    return (
      <div key={h._internalId || h.codHidrante || h.nomHidrante || index} className={itemClasses}>
        <div className="flex items-center gap-2 flex-1 min-w-0 w-full overflow-hidden">
          {/* Sequência / Número */}
          <div className={
            isCompleted 
              ? "bg-slate-700 text-slate-400 font-bold text-[11px] rounded-full w-6 h-6 flex items-center justify-center shrink-0" 
              : "bg-emerald-950 text-emerald-400 border border-emerald-500/30 font-bold text-[11px] rounded-full w-6 h-6 flex items-center justify-center shrink-0"
          }>
            {isCompleted ? "✓" : index + 1}
          </div>
          
          {/* FOTO DE PERFIL DO HIDRANTE (Thumbnail) */}
          {!isCompleted && h.fotoPerfil && (
            <img src={h.fotoPerfil} alt="Perfil" className="w-7 h-7 object-cover rounded-md border border-slate-600 shrink-0 cursor-pointer hover:scale-105 transition-transform" />
          )}
          
          <div className="flex flex-col gap-0.5 flex-1 min-w-0 overflow-hidden">
            {/* Linha 1: Identificador + RA + Distância */}
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="font-bold text-slate-100 text-xs sm:text-sm tracking-wide shrink-0">
                {fixEncoding(h.nomHidrante) || h.codHidrante}
              </span>
              
              {h.dscLocalidade && (
                <span className="bg-slate-700/80 border border-slate-600/60 text-cyan-300 text-[9px] font-semibold px-1.5 py-0.2 rounded shrink-0">
                  {fixEncoding(h.dscLocalidade)}
                </span>
              )}

              {distText && (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border flex items-center gap-0.5 shrink-0 bg-slate-800 border-slate-700 text-slate-300">
                  <span>📍</span> {distText}
                </span>
              )}
            </div>
            
            {/* Linha 2: Endereço responsivo (sem overflow) */}
            <div className="flex flex-col gap-0.5 text-slate-300 text-xs min-w-0 w-full">
              <span className="text-slate-400 text-[11px] break-words line-clamp-1 leading-tight" title={h.dscEndereco || ''}>
                {fixEncoding(h.dscEndereco) || 'Endereço não informado'}
              </span>

              {h.problemasHidrante && h.problemasHidrante.trim() !== '' && (
                <span className="inline-flex items-center gap-1 bg-amber-950/60 border border-amber-600/40 text-amber-300 text-[9px] font-bold px-1.5 py-0.5 rounded truncate w-fit">
                  ⚠️ {fixEncoding(sanitizeProblem(h.problemasHidrante))}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Bloco de Ações do Item */}
        <div className="flex items-center justify-end gap-1 shrink-0 w-full sm:w-auto mt-0.5 sm:mt-0 border-t sm:border-t-0 border-slate-700/60 pt-1 sm:pt-0">
          <button 
            onClick={() => { onCenterMap && onCenterMap(h); onClose(); }} 
            title="Localizar no Mapa" 
            className="h-7 px-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-[11px] active:scale-95 transition-all flex items-center gap-1 font-semibold border border-slate-600/60 shadow-sm cursor-pointer"
          >
            <LocateFixed size={13} className="text-cyan-400" />
            <span className="hidden sm:inline text-xs">Mapa</span>
          </button>

          {!isCompleted && (
            <button 
              onClick={() => window.open(`https://waze.com/ul?ll=${h.numLatitude},${h.numLongitude}&navigate=yes`, '_blank')} 
              title="Navegar no Waze" 
              className="h-7 px-2 bg-blue-600/90 hover:bg-blue-600 text-white rounded-lg text-[11px] active:scale-95 transition-all flex items-center gap-1 font-semibold shadow-sm cursor-pointer"
            >
              <Navigation size={13} />
              <span className="hidden sm:inline text-xs">Waze</span>
            </button>
          )}

          {!isCompleted && (
            <button 
              onClick={() => onInspect && onInspect(h)} 
              title="Cadastrar Vistoria Técnica" 
              className="h-7 px-2.5 text-white rounded-lg active:scale-95 transition-all font-bold text-[11px] flex items-center gap-1 shadow-md cursor-pointer bg-emerald-600 hover:bg-emerald-500"
            >
              <Plus size={13} strokeWidth={3}/>
              <span>VISTORIA</span>
            </button>
          )}

          {(!isCompleted && (currentUser?.role === 'gestor' || currentUser?.role === 'admin')) && (
            <button 
              onClick={() => onEdit && onEdit(h)} 
              title="Editar Hidrante" 
              className="h-7 w-7 flex items-center justify-center bg-amber-700 hover:bg-amber-600 text-white rounded-lg active:scale-95 transition-all shadow-sm cursor-pointer"
            >
              <Edit size={13}/>
            </button>
          )}
          
          {canEditRoute && (
            <button 
              onClick={() => handleRemoveItem(h)} 
              title="Remover da Missão" 
              className="h-7 w-7 flex items-center justify-center bg-rose-950/80 text-rose-400 hover:bg-rose-800 hover:text-white border border-rose-800/40 rounded-lg active:scale-95 transition-all ml-0.5 cursor-pointer"
            >
              <X size={13}/>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col p-2 sm:p-3 w-full h-full bg-slate-900 relative overflow-hidden">

      {/* CABEÇALHO DA ROTA (OTIMIZADO PARA MOBILE) */}
      <div className="flex justify-between items-center mb-1.5 pb-1.5 border-b border-slate-700/80 relative shrink-0 gap-1.5">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {onBackToManager && (
            <button 
              type="button" 
              onClick={onBackToManager}
              className="text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg font-semibold transition-colors flex items-center gap-1 shrink-0 shadow-sm cursor-pointer"
              title="Voltar para a Central de Missões"
            >
              <span>←</span>
              <span className="hidden sm:inline">Voltar</span>
            </button>
          )}
          
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <GitMerge size={17} className="text-emerald-400 shrink-0" />
            <span className="font-extrabold text-sm sm:text-base text-slate-100 drop-shadow-sm truncate" title={currentMission?.name || "Rota de Missão"}>
              {currentMission?.name || "Rota de Missão"}
            </span>
          </div>

          {/* BADGE DE EXECUÇÃO RATIO X/TOTAL (Ex: 1/5 (20%)) */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="bg-emerald-950/90 border border-emerald-500/80 text-emerald-300 font-mono font-bold text-[11px] sm:text-xs px-2 py-0.5 rounded-full shadow-md flex items-center gap-1" title="Hidrantes concluídos / Total">
              <span>{completedCount}/{totalCount}</span>
              <span className="text-[10px] text-emerald-400 font-normal">({progressPercent}%)</span>
            </span>

            {isOptimizing ? (
              <span className="hidden sm:inline-flex bg-amber-950/70 border border-amber-500/50 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full shadow items-center gap-1 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                <span>Calculando vias...</span>
              </span>
            ) : (
              <span className={`hidden sm:inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border items-center gap-1 shrink-0 ${
                isTrafficOptimized 
                  ? 'bg-blue-950/60 border-blue-500/40 text-blue-300' 
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}>
                <span>{isTrafficOptimized ? '🚗 Trânsito' : '📏 Reta'}</span>
              </span>
            )}
          </div>
        </div>
        
        <button onClick={onClose} className="p-1 bg-slate-800 hover:bg-red-900/50 hover:text-red-400 text-slate-400 rounded-full transition-colors shrink-0 cursor-pointer" title="Fechar Rota">
          <X size={16} />
        </button>
      </div>

      {/* BARRA DE PROGRESSO VISUAL DA MISSÃO */}
      {totalCount > 0 && (
        <div className="w-full bg-slate-950 h-1.5 sm:h-2 rounded-full mb-1.5 overflow-hidden border border-slate-700/80 relative shrink-0">
          <div 
            className={`h-full transition-all duration-500 ${
              progressPercent === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-emerald-600 to-cyan-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* LISTA SCROLLÁVEL DE HIDRANTES DA ROTA (SEM TÍTULO REDUNDANTE DE FALTANTES) */}
      <div className="flex-1 overflow-y-auto mb-1.5 bg-slate-800/40 rounded-xl p-1.5 sm:p-2 border border-slate-700/80 scroll-pt-2 custom-scrollbar">
        {missionHydrants.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 p-6 text-center">
            <MapPin size={48} className="text-emerald-400/40 animate-pulse" />
            <p className="text-sm font-semibold text-slate-300 max-w-sm">
              Para criar uma nova rota de missão, selecione os hidrantes no mapa ou na lista.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {pendingRoute.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {pendingRoute.map((h, index) => renderHydrantItem(h, index, false))}
              </div>
            )}

            {completedHydrants.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-2">
                <h3 className="text-slate-400 font-bold uppercase tracking-wider text-[11px] sm:text-xs flex items-center gap-1.5 border-b border-slate-700/80 pb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Concluídos na Missão ({completedHydrants.length})
                </h3>
                {completedHydrants.map((h, index) => renderHydrantItem(h, index, true))}
              </div>
            )}
            
            {pendingRoute.length === 0 && completedHydrants.length > 0 && (
               <div className="p-4 text-center text-emerald-300 font-black bg-emerald-950/60 rounded-xl border border-emerald-500/60 mt-2 text-sm shadow-lg flex flex-col items-center gap-1 animate-fadeIn">
                 <CheckCircle2 size={32} className="text-emerald-400 animate-bounce" />
                 <span>🎉 Missão 100% Concluída!</span>
                 <span className="text-xs font-normal text-slate-300">Todos os {completedHydrants.length} hidrantes foram vistoriados com sucesso.</span>
               </div>
            )}
          </div>
        )}
      </div>

      {/* AÇÕES DO RODAPÉ (WhatsApp e Relatório) */}
      <div className={`grid ${((currentUser?.role === 'gestor' || currentUser?.role === 'admin') && onGenerateReport) ? 'grid-cols-2' : 'grid-cols-1'} gap-2 pb-0.5 pt-1.5 border-t border-slate-700/80 relative flex-shrink-0`}>
        <button 
          onClick={handleShareWhatsApp}
          disabled={missionHydrants.length === 0}
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

