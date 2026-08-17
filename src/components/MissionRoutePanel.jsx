import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Navigation, LocateFixed, GitMerge, Share2, MapPin, Map as MapIcon, RotateCcw, Plus, Save, Edit, CheckCircle, FolderOpen } from 'lucide-react';

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

const MissionRoutePanel = ({ hidrantes, selectedMissionIds, completedMissionIds = [], currentMission, onUpdateMission, onClose, onClearMission, onRemoveFromMission, lastInspectedCoords, onInspect, onEdit, onCenterMap, currentUser, folders, onSaveRouteToFolder, onGenerateReport }) => {
  const [pendingRoute, setPendingRoute] = useState([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isEditingAtribuicao, setIsEditingAtribuicao] = useState(false);
  const [editedAtribuicao, setEditedAtribuicao] = useState('');
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [saveRouteName, setSaveRouteName] = useState('');
  const [saveFolderId, setSaveFolderId] = useState('');
  
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
    return hidrantes.filter(h => selectedMissionIds.includes(h.codHidrante || h.nomHidrante));
  }, [hidrantes, selectedMissionIds]);

  const pendingHydrants = useMemo(() => {
    return missionHydrants.filter(h => !completedMissionIds.includes(h.codHidrante || h.nomHidrante));
  }, [missionHydrants, completedMissionIds]);

  const completedHydrants = useMemo(() => {
    return missionHydrants.filter(h => completedMissionIds.includes(h.codHidrante || h.nomHidrante));
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
    if (pendingRoute.length > 0) {
      const start = userLocation ? pendingRoute[0] : pendingRoute[0]; // TODO startLat startLng
      const startLat = userLocation ? userLocation.lat : start.numLatitude;
      const startLng = userLocation ? userLocation.lng : start.numLongitude;

      const newRoute = await optimizeRouteMultiMode(pendingHydrants, startLat, startLng);
      setPendingRoute(newRoute);
    }
    setIsOptimizing(false);
  };

  const handleShareWhatsApp = () => {
    if (pendingRoute.length === 0) return;
    const baseUrl = window.location.origin + window.location.pathname;
    const idsString = pendingRoute.map(h => h.codHidrante || h.nomHidrante).join(',');
    const magicLink = `${baseUrl}?ds=${idsString}`;
    
    const folder = folders?.find(f => f.id === currentMission?.parentFolderId);
    const folderName = folder ? folder.name : "Central";
    const missionName = currentMission?.name || "Sem Nome";
    
    let text = `*NETUNO - MISSÃO TÁTICA*\n\n`;
    text += `*Carregar Missão:* \n${magicLink}\n\n`;
    text += `*Missão:* ${missionName}\n`;
    text += `*Pasta:* ${folderName}\n`;
    text += `*Vistorias:* Realizadas: ${completedHydrants.length} / Pendentes: ${pendingRoute.length}\n\n`;
    
    pendingRoute.forEach((h, i) => {
      const id = h.codHidrante || h.nomHidrante;
      const linkNetuno = `${baseUrl}?hid=${id}`;
      const linkWaze = `https://waze.com/ul?ll=${h.numLatitude},${h.numLongitude}`;
      text += `*${i + 1}. ${id}*\nNetuno: ${linkNetuno}\nWaze: ${linkWaze}\n\n`;
    });
    
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleWazeRoute = () => {
    if (pendingRoute.length === 0) return;
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

    // Degradê de opacidade
    let itemClasses = "";
    if (isCompleted) {
      itemClasses = "bg-slate-900/50 border-l-4 border-slate-700 rounded-r-lg p-2 flex flex-col lg:flex-row gap-2 items-start lg:items-center justify-between opacity-70 grayscale";
    } else {
      if (index === 0) {
        // 1º Lugar (Mais Próximo): Cor sólida destacada (ciano/verde pulsante com fundo de alto contraste).
        itemClasses = "bg-slate-800/90 border-l-4 border-emerald-400 rounded-r-lg p-3 shadow-[0_0_10px_rgba(52,211,153,0.3)] flex flex-col lg:flex-row gap-2 items-start lg:items-center justify-between animate-pulse-border relative overflow-hidden";
      } else if (index > 0 && index <= 3) {
        // 2º ao 4º Lugar: opacidade gradual
        const opacity = 1 - (index * 0.15); // 0.85, 0.70, 0.55
        itemClasses = `bg-slate-800 border-l-4 border-emerald-600/50 rounded-r-lg p-2 flex flex-col lg:flex-row gap-2 items-start lg:items-center justify-between transition-all` ;
      } else {
        // Demais Hidrantes: fundo com maior transparência
        itemClasses = "bg-slate-800/40 border-l-4 border-slate-600 rounded-r-lg p-2 shadow-sm flex flex-col lg:flex-row gap-2 items-start lg:items-center justify-between";
      }
    }

    return (
      <div key={id || index} className={itemClasses} style={!isCompleted && index > 0 && index <= 3 ? { opacity: 1 - (index * 0.15) } : {}}>
        <div className="flex items-start lg:items-center gap-2 flex-1 overflow-hidden w-full">
          <div className={isCompleted ? "bg-slate-700 text-slate-400 font-bold text-lg rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0" : (index === 0 ? "bg-emerald-500 text-white font-bold text-lg rounded-full w-10 h-10 flex items-center justify-center shadow-lg flex-shrink-0" : "bg-emerald-900/50 text-emerald-400 font-bold text-lg rounded-full w-8 h-8 flex items-center justify-center shadow-inner flex-shrink-0")}>
            {isCompleted ? "✓" : index + 1}
          </div>
          
          {/* FOTO DE PERFIL DO HIDRANTE AQUI (Thumbnail) se houver h.fotoPerfil */}
          {!isCompleted && h.fotoPerfil && (
            <img src={h.fotoPerfil} alt="Perfil" className="w-10 h-10 object-cover rounded-md border border-slate-600 flex-shrink-0 cursor-pointer hover:scale-105 transition-transform" />
          )}
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1 w-full text-sm">
            <div className="flex flex-col">
              <span className="text-slate-400 text-[10px] uppercase tracking-wider">Código / RA</span>
              <span className="font-bold text-slate-200 truncate">{h.nomHidrante || h.codHidrante} - {h.dscLocalidade || 'N/A'}</span>
            </div>
            
            <div className="flex flex-col">
              <span className="text-slate-400 text-[10px] uppercase tracking-wider">Distância</span>
              <span className={`font-bold ${index === 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                📍 {distText || '-'}
              </span>
            </div>
            
            <div className="flex flex-col">
              <span className="text-slate-400 text-[10px] uppercase tracking-wider">Endereço</span>
              <span className="text-slate-300 font-mono text-xs truncate">{h.dscEndereco || '-'}</span>
            </div>
            
            <div className="flex flex-col">
              <span className="text-slate-400 text-[10px] uppercase tracking-wider">Problema</span>
              <span className="text-red-400 truncate" title={h.problemasHidrante}>{h.problemasHidrante || '-'}</span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-end gap-1.5 flex-shrink-0 w-full lg:w-auto mt-2 lg:mt-0 border-t lg:border-t-0 border-slate-700 pt-2 lg:pt-0">
          <button onClick={() => { onCenterMap && onCenterMap(h); onClose(); }} title="Centralizar no Mapa" className="p-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded active:scale-95 transition-transform"><LocateFixed size={16}/></button>
          {!isCompleted && (
            <button 
              onClick={() => window.open(`https://waze.com/ul?ll=${h.numLatitude},${h.numLongitude}&navigate=yes`, '_blank')} 
              title="Waze" 
              className="p-1.5 bg-blue-500 hover:bg-blue-400 text-white rounded active:scale-95 transition-transform"
            >
              <Navigation size={16}/>
            </button>
          )}
          {/* Botão de ação rápida visível em todos para padronizar com a dialog */}
          {!isCompleted && (
            <button onClick={() => onInspect && onInspect(h)} title="Cadastrar Vistoria" className={`flex items-center gap-1 p-1.5 px-3 bg-teal-600 hover:bg-teal-500 text-white rounded active:scale-95 transition-transform font-bold ${index === 0 ? '' : 'text-xs'}`}>
               <Plus size={18} strokeWidth={3}/> CAD. VIST.
            </button>
          )}

          {(!isCompleted && (currentUser?.role === 'gestor' || currentUser?.role === 'admin')) && (
            <button onClick={() => onEdit && onEdit(h)} title="Editar Hidrante" className="p-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded active:scale-95 transition-transform"><Edit size={16}/></button>
          )}
          
          <div className="w-px h-6 bg-slate-600 mx-1 hidden lg:block"></div>
          {canEditRoute && (
            <button onClick={() => onRemoveFromMission(id)} title="Remover da Missão" className="p-1.5 bg-red-900/80 text-red-400 hover:bg-red-600 hover:text-white rounded active:scale-95 transition-transform"><X size={16}/></button>
          )}
        </div>
      </div>
    );
  };

  // Badge Contador Diário
  const vistoriasHoje = completedHydrants.length; // Assumindo que os concluídos da missão são de hoje

  return (
    <div className="flex flex-col p-4 w-full h-full bg-slate-900 relative">

      <div className="flex justify-between items-start mb-4 pb-2 border-b border-slate-700 relative">
        <div className="flex flex-col gap-1 flex-1 min-w-0 mr-2">
          {currentMission ? (
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <GitMerge size={24} className="text-emerald-400 flex-shrink-0" />
                {isEditingName ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <input 
                      type="text" 
                      value={editedName} 
                      onChange={e => setEditedName(e.target.value)} 
                      onKeyDown={e => {
                        if (e.key === 'Enter' && editedName.trim()) {
                          onUpdateMission({ name: editedName.trim(), isDraft: false });
                          setIsEditingName(false);
                        }
                      }}
                      className="bg-slate-800 border border-slate-600 text-white rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500 w-full sm:w-auto"
                      placeholder="Nome da operação..."
                      autoFocus
                    />
                    <button 
                      onClick={() => {
                        if (editedName.trim()) {
                          onUpdateMission({ name: editedName.trim(), isDraft: false });
                        }
                        setIsEditingName(false);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded font-bold text-sm"
                    >
                      Salvar
                    </button>
                    <button onClick={() => setIsEditingName(false)} className="text-slate-400 hover:text-white px-2 py-1 text-sm">Cancelar</button>
                  </div>
                ) : (
                    <div className="flex flex-col flex-1 w-full relative overflow-visible">
                      <div className="flex items-center gap-2 text-slate-300 w-full">
                        <span className="font-bold text-xl drop-shadow-sm truncate flex-1">{currentMission.name}</span>
                        <span className="bg-emerald-900/80 border border-emerald-500 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full shadow whitespace-nowrap">
                          Hoje: {vistoriasHoje}
                        </span>
                        {currentMission.isDraft && (
                          <span className="bg-amber-900/50 text-amber-500 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border border-amber-800 flex-shrink-0">
                            Não Salvo
                          </span>
                        )}
                        {(!currentMission.createdBy || currentMission.createdBy === currentUser?.matricula) && (
                          <button onClick={() => { setEditedName(currentMission.name === 'Rascunho de Hoje' ? '' : currentMission.name); setIsEditingName(true); }} className="text-slate-400 hover:text-emerald-400 transition-colors p-1 bg-slate-800 rounded flex-shrink-0">
                            <Edit size={14} />
                          </button>
                        )}
                      </div>
                    {/* Exibir Caminho da Pasta */}
                    {!currentMission.isDraft && currentMission.parentFolderId && (
                      <div className="text-xs font-bold text-emerald-400 mt-0.5 flex items-center gap-1">
                        <FolderOpen size={12} /> Pasta: {folders?.find(f => f.id === currentMission.parentFolderId)?.name || 'Central'}
                      </div>
                    )}
                    
                    {/* Menu removido do cabeçalho */}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <h2 className="text-xl font-bold text-emerald-400 flex items-center gap-2 drop-shadow-sm">
              <GitMerge size={24} /> Módulo Rota
            </h2>
          )}
        </div>
        
        <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-red-900/50 hover:text-red-400 text-slate-400 rounded-full transition-colors ml-2 flex-shrink-0 z-10">
          <X size={24} />
        </button>
      </div>

      {/* BOTÃO NAVEGAR PRÓXIMO */}
      {pendingRoute.length > 0 && (
        <div className="mb-4">
          <button 
            onClick={handleWazeRoute}
            className="w-full flex flex-col items-center justify-center gap-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-4 rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.5)] active:scale-95 transition-all relative overflow-hidden group"
          >
            <div className="flex items-center gap-2 text-xl drop-shadow-md">
              <Navigation size={28} className="animate-bounce" />
              🚀 NAVEGAR PARA O PRÓXIMO ALVO (WAZE)
            </div>
            <div className="text-sm font-normal opacity-90 drop-shadow-sm">
              Alvo atual: {pendingRoute[0].nomHidrante || pendingRoute[0].codHidrante}
            </div>
            <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] skew-x-12"></div>
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto mb-4 bg-slate-800/50 rounded-xl p-2 border border-slate-700">
        {missionHydrants.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
            <MapPin size={48} className="opacity-20" />
            <p className="text-lg">Nenhum hidrante na missão.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {pendingRoute.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-slate-300 font-bold uppercase tracking-wider text-sm flex items-center gap-2 border-b border-slate-700 pb-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  Faltantes ({pendingRoute.length})
                </h3>
                {pendingRoute.map((h, index) => renderHydrantItem(h, index, false))}
              </div>
            )}

            {completedHydrants.length > 0 && (
              <div className="flex flex-col gap-2 mt-2">
                <h3 className="text-slate-400 font-bold uppercase tracking-wider text-sm flex items-center gap-2 border-b border-slate-700 pb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Concluídos na Missão ({completedHydrants.length})
                </h3>
                {completedHydrants.map((h, index) => renderHydrantItem(h, index, true))}
              </div>
            )}
            
            {pendingRoute.length === 0 && completedHydrants.length > 0 && (
               <div className="p-4 text-center text-emerald-400 font-bold bg-emerald-900/30 rounded-lg border border-emerald-900 mt-4">
                 🎉 Missão totalmente concluída!
               </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap sm:flex-nowrap gap-2 pb-2 pt-2 border-t border-slate-700 relative">

        <button 
          onClick={handleShareWhatsApp}
          disabled={pendingRoute.length === 0}
          className="flex-1 flex items-center justify-center gap-1.5 bg-[#25D366] hover:bg-[#20bd5a] disabled:opacity-50 text-white font-bold py-2 px-3 rounded-lg shadow active:scale-95 transition-all text-sm"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a5.8 5.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
          COMPARTILHAR
        </button>

        {/* Botão de Salvar Rota movido para baixo */}
        {(onSaveRouteToFolder && folders) && (
          <div className="flex-1 flex sm:flex-none relative">
            <button 
              onClick={() => {
                setSaveRouteName(currentMission?.name || 'Rascunho de Hoje');
                setSaveFolderId(currentMission?.parentFolderId || '');
                setShowSaveMenu(!showSaveMenu);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-3 rounded-lg shadow active:scale-95 transition-all text-sm"
              title="Salvar Rota na Central"
            >
              <Save size={18} />
              SALVAR ROTA
            </button>
            
            {showSaveMenu && (
              <div className="absolute bottom-full mb-2 right-0 w-64 bg-slate-800 border border-slate-600 rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.8)] p-3 z-[9999] flex flex-col gap-3">
                <h4 className="text-sm font-bold text-white mb-1">Salvar Rota</h4>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Nome da Missão</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white" 
                    value={saveRouteName} 
                    onChange={e => setSaveRouteName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Pasta de Destino</label>
                  <select 
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                    value={saveFolderId}
                    onChange={e => setSaveFolderId(e.target.value)}
                  >
                    <option value="">Raiz (Sem pasta)</option>
                    {folders.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 justify-end mt-1">
                  <button onClick={() => setShowSaveMenu(false)} className="text-xs px-3 py-1.5 text-slate-400 hover:text-white">Cancelar</button>
                  <button 
                    onClick={() => {
                      onSaveRouteToFolder(saveFolderId ? String(saveFolderId) : null, saveRouteName);
                      setShowSaveMenu(false);
                    }} 
                    className="text-xs px-3 py-1.5 bg-emerald-600 text-white font-bold rounded hover:bg-emerald-500"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        
        {(!currentMission || !currentMission.createdBy || currentMission.createdBy === currentUser?.matricula) && (
          <button 
            onClick={() => {
              if (window.confirm("Deseja limpar a seleção de rota?")) {
                onClearMission();
              }
            }}
            disabled={missionHydrants.length === 0}
            className="flex items-center justify-center gap-1.5 px-3 flex-1 sm:flex-none bg-slate-700 hover:bg-red-600 disabled:opacity-50 text-white font-bold py-2 rounded-lg shadow active:scale-95 transition-all text-sm"
            title="Limpar Seleção de Rota"
          >
            <X size={18} />
            LIMPAR ROTA
          </button>
        )}
        
        {(currentUser?.role === 'gestor' || currentUser?.role === 'admin') && onGenerateReport && (
          <button 
            onClick={onGenerateReport}
            disabled={missionHydrants.length === 0}
            className="flex items-center justify-center gap-1.5 px-3 flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2 rounded-lg shadow active:scale-95 transition-all text-sm"
            title="Gerar Relatório da Missão"
          >
            <FolderOpen size={18} />
            GERAR RELATÓRIO DA MISSÃO
          </button>
        )}
      </div>
    </div>
  );
};

export default MissionRoutePanel;
