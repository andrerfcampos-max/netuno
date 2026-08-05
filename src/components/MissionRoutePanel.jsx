import React, { useState, useEffect, useMemo } from 'react';
import { X, Navigation, LocateFixed, GitMerge, Share2, MapPin, Map as MapIcon, RotateCcw, ClipboardPlus, Edit } from 'lucide-react';

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
    // Monta a string de coordenadas: lng,lat;lng,lat... 
    // O ponto de partida é o índice 0.
    const coords = [[startLng, startLat], ...hidrantes.map(h => [h.numLongitude, h.numLatitude])];
    
    // O OSRM público tem um limite de coords (geralmente ~100). Acima de 50 vamos para Haversine direto por segurança.
    if (coords.length > 50) {
      throw new Error("Muitos pontos para OSRM público. Forçando Haversine.");
    }
    
    const coordsString = coords.map(c => `${c[0]},${c[1]}`).join(';');
    
    // Timeout para não prender a UI se estiver offline ou rede instável
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500); 

    const response = await fetch(`https://router.project-osrm.org/table/v1/driving/${coordsString}?annotations=duration`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error("OSRM API respondeu com erro");
    
    const data = await response.json();
    if (data.code !== 'Ok' || !data.durations) throw new Error("OSRM API retornou payload inválido");

    const durations = data.durations;
    let unvisited = hidrantes.map((h, i) => ({ hydrant: h, matrixIndex: i + 1 })); // índice 0 é a partida
    let route = [];
    let currentIndex = 0; // começa no ponto de partida

    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let minDuration = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const targetIndex = unvisited[i].matrixIndex;
        const duration = durations[currentIndex][targetIndex];
        
        // Verifica se duration não é null (ocorre se rota for impossível via ruas)
        if (duration !== null && duration < minDuration) {
          minDuration = duration;
          nearestIdx = i;
        }
      }

      // Se nenhum caminho viável for encontrado (minDuration === Infinity), pega o primeiro (falha silenciosa na matriz)
      if (minDuration === Infinity) nearestIdx = 0;

      const nextNode = unvisited.splice(nearestIdx, 1)[0];
      route.push(nextNode.hydrant);
      currentIndex = nextNode.matrixIndex;
    }
    
    console.log("Rota otimizada via malha viária (OSRM).");
    return route;

  } catch (error) {
    console.warn("Falha/Timeout no OSRM. Acionando Fallback para Haversine Euclidiano:", error);
    return optimizeRouteTSP(hidrantes, startLat, startLng);
  }
};

const MissionRoutePanel = ({ hidrantes, selectedMissionIds, completedMissionIds = [], currentMission, onUpdateMission, onClose, onClearMission, onRemoveFromMission, lastInspectedCoords, onInspect, onCenterMap }) => {
  const [pendingRoute, setPendingRoute] = useState([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  
  // Centro de Brasília como fallback
  const BRASILIA_LAT = -15.793;
  const BRASILIA_LNG = -47.882;

  // Filtrar os hidrantes que estão na missão
  const missionHydrants = useMemo(() => {
    return hidrantes.filter(h => selectedMissionIds.includes(h.codHidrante || h.nomHidrante));
  }, [hidrantes, selectedMissionIds]);

  // Filtra hidrantes pendentes
  const pendingHydrants = useMemo(() => {
    return missionHydrants.filter(h => !completedMissionIds.includes(h.codHidrante || h.nomHidrante));
  }, [missionHydrants, completedMissionIds]);

  // Filtra hidrantes concluídos
  const completedHydrants = useMemo(() => {
    return missionHydrants.filter(h => completedMissionIds.includes(h.codHidrante || h.nomHidrante));
  }, [missionHydrants, completedMissionIds]);

  // Atualização básica da rota pendente (mantendo selecionados)
  useEffect(() => {
    setPendingRoute(prev => {
      // Remove os que não estão mais na missão (ou que foram concluídos)
      const filteredPrev = prev.filter(p => pendingHydrants.some(m => (m.codHidrante || m.nomHidrante) === (p.codHidrante || p.nomHidrante)));
      
      // Adiciona novos que entraram
      const newHydrants = pendingHydrants.filter(m => !filteredPrev.some(p => (p.codHidrante || p.nomHidrante) === (m.codHidrante || m.nomHidrante)));
      
      return [...filteredPrev, ...newHydrants];
    });
  }, [pendingHydrants]);

  // Auto-otimizar quando há uma nova vistoria registrada
  useEffect(() => {
    let isMounted = true;
    const autoOptimize = async () => {
      if (lastInspectedCoords && pendingRoute.length > 0) {
        setIsOptimizing(true);
        const newRoute = await optimizeRouteMultiMode(pendingHydrants, lastInspectedCoords.lat, lastInspectedCoords.lng);
        if (isMounted) {
          setPendingRoute(newRoute);
          setIsOptimizing(false);
        }
      }
    };
    autoOptimize();
    
    return () => { isMounted = false; };
  }, [lastInspectedCoords]); // Executa apenas quando a coordenada atualizar

  const handleOptimizeRoute = async () => {
    setIsOptimizing(true);
    
    // Ponto inicial: o primeiro da lista atual (ou localização do usuário no futuro)
    if (pendingRoute.length > 0) {
      const start = pendingRoute[0];
      const newRoute = await optimizeRouteMultiMode(pendingHydrants, start.numLatitude, start.numLongitude);
      setPendingRoute(newRoute);
    }
    setIsOptimizing(false);
  };

  const handleShareWhatsApp = () => {
    if (pendingRoute.length === 0) return;
    
    const baseUrl = window.location.origin + window.location.pathname;
    const idsString = pendingRoute.map(h => h.codHidrante || h.nomHidrante).join(',');
    const magicLink = `${baseUrl}?ds=${idsString}`;
    
    let text = `*ARGOS 2.1 - MISSÃO TÁTICA*\n\n`;
    text += `*Total Pendentes:* ${pendingRoute.length} Hidrantes\n`;
    text += `*Status:* Rota Otimizada\n\n`;
    
    pendingRoute.forEach((h, i) => {
      text += `*${i + 1}. ${h.nomHidrante || h.codHidrante}*\n`;
      text += `📍 ${h.dscEndereco || ''} ${h.dscPontoReferencia ? `(${h.dscPontoReferencia})` : ''}\n\n`;
    });
    
    text += `*Carregar Missão no Argos:* \n${magicLink}`;
    
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleWazeRoute = () => {
    if (pendingRoute.length === 0) return;
    // Pega APENAS o primeiro alvo faltante para o Waze
    const nextTarget = pendingRoute[0];
    const url = `https://waze.com/ul?ll=${nextTarget.numLatitude},${nextTarget.numLongitude}&navigate=yes`;
    window.open(url, '_blank');
  };

  // Renderizador de Item da Lista para reuso
  const renderHydrantItem = (h, index, isCompleted) => {
    const id = h.codHidrante || h.nomHidrante;
    const itemClasses = isCompleted 
      ? "bg-slate-900/50 border-l-4 border-slate-700 rounded-r-lg p-2 flex flex-col lg:flex-row gap-2 items-start lg:items-center justify-between opacity-70 grayscale"
      : "bg-slate-800 border-l-4 border-emerald-500 rounded-r-lg p-2 shadow flex flex-col lg:flex-row gap-2 items-start lg:items-center justify-between";

    return (
      <div key={id || index} className={itemClasses}>
        <div className="flex items-start lg:items-center gap-2 flex-1 overflow-hidden w-full">
          <div className={isCompleted ? "bg-slate-700 text-slate-400 font-bold text-lg rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0" : "bg-emerald-900/50 text-emerald-400 font-bold text-lg rounded-full w-8 h-8 flex items-center justify-center shadow-inner flex-shrink-0"}>
            {isCompleted ? "✓" : index + 1}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1 w-full text-sm">
            <div className="flex flex-col">
              <span className="text-slate-400 text-[10px] uppercase tracking-wider">Código / RA</span>
              <span className="font-bold text-slate-200 truncate">{h.nomHidrante || h.codHidrante} - {h.dscLocalidade || 'N/A'}</span>
            </div>
            
            <div className="flex flex-col">
              <span className="text-slate-400 text-[10px] uppercase tracking-wider">Status</span>
              <span className={`font-bold ${h.flgAtivo ? 'text-green-400' : 'text-red-400'}`}>
                {h.flgAtivo ? 'OPERANTE' : 'INOPERANTE'}
              </span>
            </div>
            
            <div className="flex flex-col">
              <span className="text-slate-400 text-[10px] uppercase tracking-wider">Data Vistoria</span>
              <span className="text-slate-300 font-mono text-xs truncate">{h.datHoraUltimaVistoria || '-'}</span>
            </div>
            
            <div className="flex flex-col">
              <span className="text-slate-400 text-[10px] uppercase tracking-wider">Problema</span>
              <span className="text-red-400 truncate" title={h.problemasHidrante}>{h.problemasHidrante || '-'}</span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-end gap-1.5 flex-shrink-0 w-full lg:w-auto mt-2 lg:mt-0 border-t lg:border-t-0 border-slate-700 pt-2 lg:pt-0">
          <button onClick={() => { onCenterMap && onCenterMap(h); onClose(); }} title="Centralizar no Mapa" className="p-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded active:scale-95 transition-transform"><LocateFixed size={16}/></button>
          {!isCompleted && <a href={`https://waze.com/ul?ll=${h.numLatitude},${h.numLongitude}&navigate=yes`} target="_blank" rel="noreferrer" title="Waze" className="p-1.5 bg-blue-500 hover:bg-blue-400 text-white rounded active:scale-95 transition-transform"><Navigation size={16}/></a>}
          <a href={`https://maps.google.com/maps?q=${h.numLatitude},${h.numLongitude}`} target="_blank" rel="noreferrer" title="Google Maps" className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded active:scale-95 transition-transform"><MapIcon size={16}/></a>
          <a href={`https://maps.google.com/maps?q=&layer=c&cbll=${h.numLatitude},${h.numLongitude}`} target="_blank" rel="noreferrer" title="Street View" className="p-1.5 bg-orange-500 hover:bg-orange-400 text-white rounded active:scale-95 transition-transform"><MapPin size={16}/></a>
          <button onClick={() => onInspect && onInspect(h)} title="Cadastrar Vistoria" className="p-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded active:scale-95 transition-transform"><ClipboardPlus size={16}/></button>
          <button title="Editar Hidrante" className="p-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded active:scale-95 transition-transform"><Edit size={16}/></button>
          
          <div className="w-px h-6 bg-slate-600 mx-1 hidden lg:block"></div>
          <button onClick={() => onRemoveFromMission(id)} title="Remover da Missão" className="p-1.5 bg-red-900/80 text-red-400 hover:bg-red-600 hover:text-white rounded active:scale-95 transition-transform"><X size={16}/></button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col p-4 w-full h-full bg-slate-900">
      <div className="flex justify-between items-start mb-4 pb-2 border-b border-slate-700">
        <div className="flex flex-col gap-1 w-full">
          {currentMission ? (
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
                  <button 
                    onClick={() => setIsEditingName(false)}
                    className="text-slate-400 hover:text-white px-2 py-1 text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-slate-300 overflow-hidden">
                  <span className="font-bold text-xl drop-shadow-sm truncate">{currentMission.name}</span>
                  {currentMission.isDraft && (
                    <span className="bg-amber-900/50 text-amber-500 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border border-amber-800 flex-shrink-0">
                      Não Salvo
                    </span>
                  )}
                  <button 
                    onClick={() => {
                      setEditedName(currentMission.name === 'Rascunho de Hoje' ? '' : currentMission.name);
                      setIsEditingName(true);
                    }} 
                    className="text-slate-400 hover:text-emerald-400 transition-colors p-1 bg-slate-800 rounded flex-shrink-0"
                    title={currentMission.isDraft ? "Dar nome para salvar permanentemente" : "Renomear operação"}
                  >
                    <Edit size={14} />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <h2 className="text-xl font-bold text-emerald-400 flex items-center gap-2 drop-shadow-sm">
              <GitMerge size={24} /> Módulo Rota
            </h2>
          )}
        </div>
        
        <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-red-900/50 hover:text-red-400 text-slate-400 rounded-full transition-colors ml-2 flex-shrink-0">
          <X size={24} />
        </button>
      </div>

      {/* BOTÃO NAVEGAR PRÓXIMO (WAZE GIGANTE) */}
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
            {/* Efeito de brilho de fundo */}
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
            {/* SEÇÃO FALTANTES */}
            {pendingRoute.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-slate-300 font-bold uppercase tracking-wider text-sm flex items-center gap-2 border-b border-slate-700 pb-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  Faltantes ({pendingRoute.length})
                </h3>
                {pendingRoute.map((h, index) => renderHydrantItem(h, index, false))}
              </div>
            )}

            {/* SEÇÃO CONCLUÍDOS */}
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

      <div className="flex flex-wrap sm:flex-nowrap gap-2 pb-2 pt-2 border-t border-slate-700">
        <button 
          onClick={handleOptimizeRoute} 
          disabled={pendingRoute.length < 2 || isOptimizing}
          className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 px-3 rounded-lg shadow active:scale-95 transition-all text-sm"
        >
          {isOptimizing ? <RotateCcw className="animate-spin" size={18} /> : <LocateFixed size={18} />}
          OTIMIZAR (TSP)
        </button>
        
        <button 
          onClick={handleShareWhatsApp}
          disabled={pendingRoute.length === 0}
          className="flex-1 flex items-center justify-center gap-1.5 bg-[#25D366] hover:bg-[#20bd5a] disabled:opacity-50 text-white font-bold py-2 px-3 rounded-lg shadow active:scale-95 transition-all text-sm"
        >
          <Share2 size={18} />
          COMPARTILHAR
        </button>
        
        <button 
          onClick={() => {
            if (window.confirm("Deseja limpar toda a missão?")) {
              onClearMission();
              onClose();
            }
          }}
          disabled={missionHydrants.length === 0}
          className="flex items-center justify-center px-3 bg-slate-700 hover:bg-red-600 disabled:opacity-50 text-white font-bold py-2 rounded-lg shadow active:scale-95 transition-all"
          title="Limpar Missão"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
};

export default MissionRoutePanel;
