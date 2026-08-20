import React, { useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Map as MapIcon, MapPin, ClipboardPlus, Edit, Minimize2, Maximize2, Plus, Share2 } from 'lucide-react';
import { isValidDFCoordinate } from '../utils/geoUtils';
import { sanitizeProblem } from '../utils/problemUtils';
import { fixEncoding } from '../utils/textUtils';

// Fix para ícones padrão do Leaflet não quebrarem
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Estilização Original dos Marcadores (CSS com Alto Contraste, Borda e Sombra)
const createDivIcon = (isOperante, isSelected) => {
  const statusColor = isOperante ? '#00FF00' : '#FF0000'; // Neon Verde ou Vermelho
  
  // Se selecionado, o pino fica "vazio" (fundo transparente) com borda ciano muito destacada
  const bgColor = isSelected ? 'rgba(0,0,0,0.5)' : statusColor; 
  const bgImage = `background-color: ${bgColor};`;
  
  const borderColor = isSelected ? '#00FFFF' : 'white';
  const borderWidth = isSelected ? '4px' : '2px';
  const shadow = isSelected ? '0 0 15px #00FFFF, 0 0 5px rgba(0,0,0,0.9)' : `0 0 5px ${statusColor}`;
  const size = isSelected ? 32 : 20;
  
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="
      ${bgImage}
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      border: ${borderWidth} solid ${borderColor};
      box-shadow: ${shadow};
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      ${isSelected ? `<div style="width: 8px; height: 8px; border-radius: 50%; background-color: ${statusColor};"></div>` : ''}
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
};

const RecenterMap = ({ centerPosition }) => {
  const map = useMap();
  useEffect(() => {
    if (centerPosition) {
      map.setView([centerPosition.numLatitude, centerPosition.numLongitude], 17);
    }
  }, [centerPosition, map]);
  return null;
};

const AutoFitFilteredBounds = ({ hidrantes, centerPosition }) => {
  const map = useMap();
  const prevCountRef = React.useRef(null);
  const prevFirstIdRef = React.useRef(null);
  const isInitialLoadRef = React.useRef(true);

  useEffect(() => {
    if (centerPosition) return;

    if (hidrantes && hidrantes.length > 0) {
      const firstId = hidrantes[0]?.codHidrante || hidrantes[0]?.nomHidrante;

      // Na primeira carga dos hidrantes após abrir/recarregar a página:
      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
        prevCountRef.current = hidrantes.length;
        prevFirstIdRef.current = firstId;

        // Se o usuário possui posição e zoom persistidos, preserva a visão sem forçar fitBounds
        const savedState = localStorage.getItem('netuno_map_state');
        if (savedState) {
          try {
            const parsed = JSON.parse(savedState);
            if (parsed.lat && parsed.lng && parsed.zoom) {
              return;
            }
          } catch(e) {}
        }
      }

      if (prevCountRef.current !== hidrantes.length || prevFirstIdRef.current !== firstId) {
        prevCountRef.current = hidrantes.length;
        prevFirstIdRef.current = firstId;

        const validCoords = hidrantes
          .filter(h => isValidDFCoordinate(h.numLatitude, h.numLongitude))
          .map(h => [h.numLatitude, h.numLongitude]);

        if (validCoords.length > 0) {
          const bounds = L.latLngBounds(validCoords);
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16, animate: true });
          }
        }
      }
    }
  }, [hidrantes, centerPosition, map]);

  return null;
};

const MapMemory = () => {
  const map = useMapEvents({
    moveend: () => {
      try {
        const center = map.getCenter();
        const zoom = map.getZoom();
        localStorage.setItem('netuno_map_state', JSON.stringify({ lat: center.lat, lng: center.lng, zoom }));
      } catch(e) {}
    },
    zoomend: () => {
      try {
        const center = map.getCenter();
        const zoom = map.getZoom();
        localStorage.setItem('netuno_map_state', JSON.stringify({ lat: center.lat, lng: center.lng, zoom }));
      } catch(e) {}
    }
  });
  return null;
};

const ScrollBehavior = () => {
  const map = useMap();
  useEffect(() => {
    map.scrollWheelZoom.enable();
  }, [map]);
  return null;
};


const MapClickHandler = ({ onMapClick }) => {
  return null; // Removida a regra obsoleto que bloqueava o fullscreen no primeiro clique
};

const MapResizer = ({ isMapFullscreen, activeView }) => {
  const map = useMap();
  useEffect(() => {
    if (activeView === 'map' || isMapFullscreen) {
      const timeout = setTimeout(() => {
        map.invalidateSize();
        try {
          const savedState = localStorage.getItem('netuno_map_state');
          if (savedState) {
            const parsed = JSON.parse(savedState);
            if (parsed.lat && parsed.lng && parsed.zoom) {
              map.setView([parsed.lat, parsed.lng], parsed.zoom, { animate: false });
            }
          }
        } catch(e) {}
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [isMapFullscreen, activeView, map]);
  return null;
};

const UserLocationTracker = ({ userLocation }) => {
  const map = useMap();
  const hasCenteredRef = React.useRef(false);

  useEffect(() => {
    try {
      map.setMinZoom(0);
      map.setMaxZoom(20);
      
      // Centraliza apenas uma única vez na inicialização se o usuário não tiver posição salva
      if (userLocation && !hasCenteredRef.current) {
        hasCenteredRef.current = true;
        const savedState = localStorage.getItem('netuno_map_state');
        if (!savedState && typeof userLocation.lat === 'number' && !isNaN(userLocation.lat) && typeof userLocation.lng === 'number' && !isNaN(userLocation.lng)) {
          map.setView([userLocation.lat, userLocation.lng], 16, { animate: true });
        }
      }
    } catch (e) {
      console.warn('Erro ao atualizar visualização do usuário', e);
    }
  }, [userLocation, map]);
  return null;
};

const GpsControl = ({ userLocation }) => {
  const map = useMap();
  const [isLocating, setIsLocating] = useState(false);

  const handleCenterUser = (e) => {
    e.stopPropagation();
    setIsLocating(true);
    try {
      if (userLocation && typeof userLocation.lat === 'number' && !isNaN(userLocation.lat) && typeof userLocation.lng === 'number' && !isNaN(userLocation.lng)) {
        map.setView([userLocation.lat, userLocation.lng], 17, { animate: true });
        setIsLocating(false);
      } else if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (pos && pos.coords && typeof pos.coords.latitude === 'number' && typeof pos.coords.longitude === 'number') {
              map.setView([pos.coords.latitude, pos.coords.longitude], 17, { animate: true });
            }
            setIsLocating(false);
          },
          (err) => {
            console.warn('Erro GPS', err);
            setIsLocating(false);
            alert('GPS: Não foi possível obter sua posição atual. Verifique se o GPS está ativo.');
          },
          { enableHighAccuracy: true, timeout: 6000 }
        );
      } else {
        setIsLocating(false);
      }
    } catch (e) {
      console.warn('Erro ao centralizar no GPS', e);
      setIsLocating(false);
    }
  };

  return (
    <div className="leaflet-bottom leaflet-right !bottom-6 !right-4 !pointer-events-auto z-[1000]">
      <button
        onClick={handleCenterUser}
        title="Centralizar na Minha Posição (GPS)"
        className={`p-3 bg-slate-900/90 hover:bg-slate-800 text-cyan-400 border border-cyan-500/50 hover:border-cyan-400 rounded-full shadow-2xl flex items-center justify-center transition-all active:scale-95 cursor-pointer backdrop-blur-md ${isLocating ? 'animate-pulse' : ''}`}
      >
        <Navigation size={22} className="text-cyan-400" />
      </button>
    </div>
  );
};

const MapComponent = ({ hidrantes, onInspect, onEdit, centerPosition, selectedMissionIds = [], onToggleMission, currentUser, onMapClick, onOpenFilters, isMapFullscreen, activeView, isAllCitiesOnly = false }) => {
  const isGestor = currentUser?.role === 'gestor' || currentUser?.role === 'admin';
  const validHidrantes = useMemo(() => {
    return hidrantes.filter(h => isValidDFCoordinate(h.numLatitude, h.numLongitude));
  }, [hidrantes]);

  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    let watchId;
    if ('geolocation' in navigator) {
      try {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            if (pos && pos.coords && typeof pos.coords.latitude === 'number' && typeof pos.coords.longitude === 'number') {
              setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            }
          },
          (err) => console.warn('Erro GPS no MapComponent', err),
          { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 }
        );
      } catch (e) {
        console.warn('Falha ao iniciar watchPosition GPS', e);
      }
    }
    return () => {
      if (watchId && 'geolocation' in navigator) {
        try {
          navigator.geolocation.clearWatch(watchId);
        } catch (e) {}
      }
    };
  }, []);

  // Centro padrão (Brasília)
  const defaultCenter = [-15.793, -47.882];
  
  let initialCenter = validHidrantes.length > 0 
    ? [validHidrantes[0].numLatitude, validHidrantes[0].numLongitude] 
    : defaultCenter;
  let initialZoom = 12;

  try {
    const savedState = localStorage.getItem('netuno_map_state');
    if (savedState) {
      const parsed = JSON.parse(savedState);
      if (parsed.lat && parsed.lng && parsed.zoom) {
        initialCenter = [parsed.lat, parsed.lng];
        initialZoom = parsed.zoom;
      }
    }
  } catch(e) {}

  const renderMarkers = () => {
    return validHidrantes.map((h, i) => {
      const id = h.codHidrante || h._internalId || h.nomHidrante;
      const isSelected = selectedMissionIds.includes(h.codHidrante) || selectedMissionIds.includes(h.nomHidrante) || selectedMissionIds.includes(h._internalId);
      const isCentered = centerPosition && (centerPosition.codHidrante === h.codHidrante || centerPosition.nomHidrante === h.nomHidrante);
      
      return (
      <Marker 
        key={isCentered ? `${id}-center` : (id || i)} 
        position={[h.numLatitude, h.numLongitude]}
        icon={createDivIcon(h.flgAtivo, isSelected)}
        eventHandlers={{
          click: (e) => {
            if (e.originalEvent && (e.originalEvent.ctrlKey || e.originalEvent.metaKey)) {
              if (e.target && typeof e.target.closePopup === 'function') {
                e.target.closePopup();
              }
              if (onToggleMission) {
                onToggleMission(id);
              }
              if (e.originalEvent.preventDefault) e.originalEvent.preventDefault();
              if (e.originalEvent.stopPropagation) e.originalEvent.stopPropagation();
              setTimeout(() => {
                if (e.target && typeof e.target.closePopup === 'function') {
                  e.target.closePopup();
                }
              }, 0);
              setTimeout(() => {
                if (e.target && typeof e.target.closePopup === 'function') {
                  e.target.closePopup();
                }
              }, 50);
            }
          },
          dblclick: (e) => {
            if (onToggleMission && isGestor) {
              onToggleMission(id);
              e.originalEvent.preventDefault();
              e.originalEvent.stopPropagation();
            }
          },
          add: (e) => {
            if (isCentered) {
              setTimeout(() => {
                if (e.target.isPopupOpen && !e.target.isPopupOpen()) {
                  e.target.openPopup();
                }
              }, 300);
            }
          }
        }}
      >
        <Popup minWidth={310} className="argos-popup">
          <div className="flex flex-col gap-2 p-1.5 text-slate-800 text-sm w-full leading-normal select-text">
            {/* Cabeçalho do Hidrante com Foto e Status */}
            <div className="flex gap-3 items-center border-b border-slate-200 pb-2 mb-1">
              {h.fotoPerfil && (
                <img 
                  src={h.fotoPerfil} 
                  alt="Foto Hidrante" 
                  className="w-14 h-14 rounded-lg object-cover cursor-pointer hover:scale-105 transition-transform border border-slate-300 shadow-sm"
                  onClick={() => {
                    const img = document.createElement('img');
                    img.src = h.fotoPerfil;
                    img.style.maxWidth = '90%';
                    img.style.maxHeight = '90%';
                    img.style.objectFit = 'contain';
                    
                    const div = document.createElement('div');
                    div.style.position = 'fixed';
                    div.style.inset = '0';
                    div.style.backgroundColor = 'rgba(0,0,0,0.9)';
                    div.style.zIndex = '999999';
                    div.style.display = 'flex';
                    div.style.alignItems = 'center';
                    div.style.justifyContent = 'center';
                    
                    div.onclick = () => document.body.removeChild(div);
                    div.appendChild(img);
                    document.body.appendChild(div);
                  }}
                />
              )}
              <div className="flex items-center justify-between gap-2 flex-1 min-w-0">
                <span className="font-extrabold text-base tracking-tight text-slate-900 truncate">
                  {fixEncoding(h.nomHidrante) || h.codHidrante}
                </span>
                <span className={`inline-flex items-center shrink-0 px-2 py-0.5 rounded-full text-xs font-black tracking-wide ${
                  h.flgAtivo 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                    : 'bg-red-100 text-red-800 border border-red-300'
                }`}>
                  {h.flgAtivo ? '● OPERANTE' : '● INOPERANTE'}
                </span>
              </div>
            </div>
            
            {/* Informações Estruturadas */}
            <div className="flex flex-col gap-1.5 text-xs text-slate-700 bg-slate-50/80 p-2 rounded-lg border border-slate-100">
              <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">RA / Cidade</span>
                <span className="font-semibold text-slate-900">{fixEncoding(h.dscLocalidade) || '-'}</span>
              </div>
              
              <div className="flex flex-col py-0.5 border-b border-slate-200/60">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">Endereço</span>
                <span className="font-medium text-slate-800 mt-0.5 leading-tight">{fixEncoding(h.dscEndereco) || '-'}</span>
              </div>
              
              {h.dscPontoReferencia && (
                <div className="flex flex-col py-0.5 border-b border-slate-200/60">
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">Ponto de Referência</span>
                  <span className="italic text-slate-600 mt-0.5 leading-tight">{fixEncoding(h.dscPontoReferencia)}</span>
                </div>
              )}

              <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">Última Vistoria</span>
                <span className="font-bold text-slate-800">{h.datHoraUltimaVistoria || 'Sem registro'}</span>
              </div>
              
              <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">Coordenadas</span>
                <span className="font-mono text-slate-700 font-semibold">
                  {typeof h.numLatitude === 'number' ? h.numLatitude.toFixed(6) : (Number(h.numLatitude) ? Number(h.numLatitude).toFixed(6) : (h.numLatitude || '-'))}, {typeof h.numLongitude === 'number' ? h.numLongitude.toFixed(6) : (Number(h.numLongitude) ? Number(h.numLongitude).toFixed(6) : (h.numLongitude || '-'))}
                </span>
              </div>

              {h.problemasHidrante && h.problemasHidrante.trim() !== '' && (
                <div className="flex flex-col py-0.5">
                  <span className="font-bold text-red-600 uppercase tracking-wider text-[11px]">Problemas Registrados</span>
                  <span className="font-bold text-red-700 mt-0.5 break-words bg-red-50 p-1.5 rounded border border-red-200 max-h-24 overflow-y-auto">
                    {fixEncoding(sanitizeProblem(h.problemasHidrante))}
                  </span>
                </div>
              )}
            </div>

            {/* Navegação Externa GPS */}
            <div className="grid grid-cols-4 gap-1.5 mt-1">
              <a href={`https://waze.com/ul?ll=${h.numLatitude},${h.numLongitude}&navigate=yes`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 py-1.5 !bg-blue-600 !text-white !rounded-md font-bold text-xs hover:!bg-blue-500 transition-colors shadow-sm" title="Abrir no Waze">
                <Navigation size={14} /> Waze
              </a>
              <a href={`https://maps.google.com/maps?q=${h.numLatitude},${h.numLongitude}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 py-1.5 !bg-emerald-600 !text-white !rounded-md font-bold text-xs hover:!bg-emerald-500 transition-colors shadow-sm" title="Google Maps">
                <MapIcon size={14} /> Maps
              </a>
              <a href={`https://maps.google.com/maps?q=&layer=c&cbll=${h.numLatitude},${h.numLongitude}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 py-1.5 !bg-orange-500 !text-white !rounded-md font-bold text-xs hover:!bg-orange-400 transition-colors shadow-sm" title="Street View">
                <MapPin size={14} /> 360°
              </a>
              <a href={`https://wa.me/?text=${encodeURIComponent(`🚒 *Hidrante:* ${h.nomHidrante || h.codHidrante}\n📍 *RA:* ${h.dscLocalidade || '-'}\n${h.flgAtivo ? '🟢 *Status:* OPERANTE' : '🔴 *Status:* INOPERANTE'}\n📅 *Última Vistoria:* ${h.datHoraUltimaVistoria || 'Sem registro'}\n⚠️ *Problemas:* ${h.problemasHidrante || 'Nenhum'}\n🗺️ *Endereço:* ${h.dscEndereco || ''} ${h.dscPontoReferencia ? `(${h.dscPontoReferencia})` : ''}\n\n🌐 *Netuno:* ${window.location.origin}${window.location.pathname}?hid=${id}\n🚗 *Waze:* https://waze.com/ul?ll=${h.numLatitude},${h.numLongitude}`)}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 py-1.5 !bg-green-600 !text-white !rounded-md font-bold text-xs hover:!bg-green-500 transition-colors shadow-sm" title="Compartilhar no WhatsApp">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a5.8 5.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
              </a>
            </div>

            {/* Ações Táticas */}
            <div className="flex flex-col gap-1.5 mt-1">
              {isGestor && (
                <button 
                  onClick={() => onToggleMission && onToggleMission(id)}
                  className={`flex w-full items-center justify-center gap-1.5 py-2 rounded-lg font-bold text-xs transition-all active:scale-95 shadow-sm ${isSelected ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-cyan-600 hover:bg-cyan-500 text-white'}`}
                >
                  {isSelected ? 'REMOVER DA MISSÃO' : 'ADICIONAR À MISSÃO'}
                </button>
              )}
              
              <div className="flex gap-1.5">
                <button 
                  onClick={() => onInspect(h)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-teal-600 text-white rounded-lg font-bold text-xs hover:bg-teal-500 active:scale-95 transition-all shadow-sm"
                >
                  <Plus size={18} strokeWidth={2.5} />
                  CAD. VISTORIA
                </button>
                {isGestor && (
                  <button 
                    onClick={() => onEdit && onEdit(h)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-amber-700 text-white rounded-lg font-bold text-xs hover:bg-amber-600 active:scale-95 transition-all shadow-sm"
                  >
                    <Edit size={15} />
                    EDITAR
                  </button>
                )}
              </div>
            </div>
          </div>
        </Popup>
      </Marker>
      );
    });
  };

  return (
    <div className={isMapFullscreen ? "fixed inset-0 z-[100] bg-slate-900" : "h-full min-h-[300px] w-full relative rounded-xl overflow-hidden border border-slate-700 shadow-inner z-0"}>
      
      {validHidrantes.length === 0 && (
        <div 
          onClick={() => {
            if (onOpenFilters) onOpenFilters();
          }}
          className={`absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-slate-900/95 text-cyan-300 px-5 py-2.5 rounded-full border border-cyan-500/50 shadow-2xl text-xs font-semibold backdrop-blur-md flex items-center gap-2 text-center max-w-[92vw] transition-all active:scale-95 ${onOpenFilters ? 'cursor-pointer hover:border-emerald-400 hover:text-emerald-300' : 'pointer-events-none'}`}
          title="Clique para abrir os filtros e selecionar uma Cidade"
        >
          <MapPin size={15} className="text-emerald-400 shrink-0 animate-pulse" />
          <span>
            {isAllCitiesOnly 
              ? '🗺️ Visão do DF Completo ativa: A Lista e os Relatórios contêm todos os hidrantes. Clique aqui para selecionar uma Cidade/RA no mapa.'
              : 'Selecione uma Cidade no filtro acima para visualizar os hidrantes (Toque aqui)'}
          </span>
        </div>
      )}

      {isMapFullscreen && (
        <button 
          onClick={(e) => {
            e.stopPropagation(); // Evita que o click vaze para o mapa
            if (onMapClick) onMapClick();
          }}
          className="absolute top-6 left-1/2 transform -translate-x-1/2 z-[9999] bg-slate-900/90 hover:bg-slate-800 text-slate-100 font-bold px-6 py-3 rounded-full border border-emerald-500/50 shadow-[0_0_20px_rgba(0,0,0,0.6)] flex items-center gap-2 transition-all active:scale-95 animate-bounce-short"
          style={{ animationIterationCount: 3 }} // Pisca um pouco pra chamar atenção e para
        >
          <Minimize2 size={20} className="text-emerald-400" />
          Clique aqui para Sair da Tela Cheia
        </button>
      )}

      <MapContainer 
        center={initialCenter} 
        zoom={initialZoom} 
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        preferCanvas={true}
      >
        {/* Camada OBRIGATÓRIA Google Satélite Híbrido */}
        <TileLayer
          attribution='&copy; Google Maps'
          url="https://mt0.google.com/vt/lyrs=y&hl=pt-BR&x={x}&y={y}&z={z}"
          maxZoom={20}
        />
        
        <RecenterMap centerPosition={centerPosition} />
        <AutoFitFilteredBounds hidrantes={hidrantes} centerPosition={centerPosition} />
        <MapMemory />
        <ScrollBehavior />
        <MapClickHandler onMapClick={onMapClick} />
        <MapResizer isMapFullscreen={isMapFullscreen} activeView={activeView} />
        <UserLocationTracker userLocation={userLocation} />

        {/* Plotagem direta de todos os hidrantes (Sem agrupamento/cluster) */}
        {renderMarkers()}

        {/* Marcador do Usuário */}
        {userLocation && (
          <Marker 
            position={[userLocation.lat, userLocation.lng]}
            icon={L.divIcon({
              className: 'custom-div-icon',
              html: `<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(59, 130, 246, 0.8);"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            })}
            interactive={false}
            zIndexOffset={1000}
          />
        )}

        {/* Botão Flutuante de GPS (Centralizar Posição Atual) */}
        <GpsControl userLocation={userLocation} />
      </MapContainer>

      {!isMapFullscreen && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            if (onMapClick) onMapClick();
          }}
          className="absolute top-4 right-4 z-[9999] p-2.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 rounded-full transition-all border border-slate-600 shadow-xl active:scale-95 backdrop-blur-md"
          title="Modo Tela Cheia"
        >
          <Maximize2 size={22} />
        </button>
      )}
    </div>
  );
};

export default MapComponent;
