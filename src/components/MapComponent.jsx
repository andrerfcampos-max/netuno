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

// Estilização dos Marcadores (Design Consistente com Desktop e Mobile)
const createDivIcon = (isOperante, isSelected) => {
  const statusColor = isOperante ? '#10b981' : '#ef4444'; // Verde Esmeralda ou Vermelho Sólido de Alta Definição
  
  // Se selecionado, o pino fica "vazio" (fundo transparente) com borda ciano muito destacada
  const bgColor = isSelected ? 'rgba(0,0,0,0.5)' : statusColor; 
  const bgImage = `background-color: ${bgColor};`;
  
  const borderColor = isSelected ? '#00FFFF' : 'white';
  const borderWidth = isSelected ? '4px' : '2px';
  const shadow = isSelected ? '0 0 15px #00FFFF, 0 0 5px rgba(0,0,0,0.9)' : `0 0 4px rgba(0,0,0,0.6)`;
  const size = isSelected ? 32 : 18;
  
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
    iconSize: [26, 26],
    iconAnchor: [13, 13]
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

  useEffect(() => {
    if (centerPosition) return;

    if (hidrantes && hidrantes.length > 0) {
      const firstId = hidrantes[0]?.codHidrante || hidrantes[0]?.nomHidrante;

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
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [isMapFullscreen, activeView, map]);
  return null;
};

const UserLocationTracker = ({ userLocation, centerPosition }) => {
  const map = useMap();
  const hasCenteredRef = React.useRef(false);

  useEffect(() => {
    try {
      map.setMinZoom(0);
      map.setMaxZoom(20);
      
      // Centraliza automaticamente na primeira detecção da posição do usuário via GPS se não houver um hidrante explicitamente selecionado
      if (userLocation && !hasCenteredRef.current && !centerPosition) {
        if (typeof userLocation.lat === 'number' && !isNaN(userLocation.lat) && 
            typeof userLocation.lng === 'number' && !isNaN(userLocation.lng)) {
          hasCenteredRef.current = true;
          map.setView([userLocation.lat, userLocation.lng], 16, { animate: true });
        }
      }
    } catch (e) {
      console.warn('Erro ao atualizar visualização do usuário', e);
    }
  }, [userLocation, centerPosition, map]);
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
        // Tenta obter posição imediata
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (pos && pos.coords && typeof pos.coords.latitude === 'number' && typeof pos.coords.longitude === 'number') {
              setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            }
          },
          (err) => console.warn('Erro getCurrentPosition no MapComponent', err),
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
        );

        // Acompanhamento contínuo
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            if (pos && pos.coords && typeof pos.coords.latitude === 'number' && typeof pos.coords.longitude === 'number') {
              setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            }
          },
          (err) => console.warn('Erro GPS no MapComponent', err),
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
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
        key={isCentered ? `${id}-center-${Date.now()}` : (id || i)} 
        position={[h.numLatitude, h.numLongitude]}
        icon={createDivIcon(h.flgAtivo, isSelected)}
        ref={(marker) => {
          if (marker && isCentered) {
            setTimeout(() => {
              try {
                if (marker.openPopup && (!marker.isPopupOpen || !marker.isPopupOpen())) {
                  marker.openPopup();
                }
              } catch (err) {}
            }, 350);
          }
        }}
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
        <Popup minWidth={270} maxWidth={320} className="argos-popup">
          <div className="flex flex-col gap-1.5 p-0.5 text-slate-800 text-xs w-full max-h-[50vh] sm:max-h-[55vh] overflow-y-auto leading-tight select-text">
            {/* Cabeçalho do Hidrante com Foto e Status */}
            <div className="flex gap-2 items-center border-b border-slate-200 pb-1.5">
              {h.fotoPerfil && (
                <img 
                  src={h.fotoPerfil} 
                  alt="Foto Hidrante" 
                  className="w-10 h-10 rounded-md object-cover cursor-pointer hover:scale-105 transition-transform border border-slate-300 shadow-sm shrink-0"
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
              <div className="flex items-center justify-between gap-1.5 flex-1 min-w-0">
                <span className="font-extrabold text-sm tracking-tight text-slate-900 truncate">
                  {fixEncoding(h.nomHidrante) || h.codHidrante}
                </span>
                <span className={`inline-flex items-center shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-black tracking-wide ${
                  h.flgAtivo 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                    : 'bg-red-100 text-red-800 border border-red-300'
                }`}>
                  {h.flgAtivo ? '● OPERANTE' : '● INOPERANTE'}
                </span>
              </div>
            </div>
            
            {/* Informações Estruturadas Compactas */}
            <div className="flex flex-col gap-1 text-[11px] text-slate-700 bg-slate-50 p-1.5 rounded-lg border border-slate-150">
              <div className="flex justify-between items-center text-slate-500 font-semibold">
                <span className="text-slate-900 font-bold">📍 {fixEncoding(h.dscLocalidade) || '-'}</span>
                <span>📅 {h.datHoraUltimaVistoria ? String(h.datHoraUltimaVistoria).split(' ')[0] : 'Sem vistoria'}</span>
              </div>
              
              <div className="text-slate-800 leading-snug">
                <span className="font-bold text-slate-500">Endereço: </span>
                {fixEncoding(h.dscEndereco) || '-'}
              </div>
              
              {h.dscPontoReferencia && (
                <div className="italic text-slate-600 text-[10px] leading-snug">
                  <span className="font-bold not-italic text-slate-500">Ref: </span>
                  {fixEncoding(h.dscPontoReferencia)}
                </div>
              )}

              <div className="flex justify-between items-center text-[10px] text-slate-500 pt-0.5 border-t border-slate-200/50">
                <span>Coord:</span>
                <span className="font-mono text-slate-700 font-semibold">
                  {typeof h.numLatitude === 'number' ? h.numLatitude.toFixed(6) : (Number(h.numLatitude) ? Number(h.numLatitude).toFixed(6) : (h.numLatitude || '-'))}, {typeof h.numLongitude === 'number' ? h.numLongitude.toFixed(6) : (Number(h.numLongitude) ? Number(h.numLongitude).toFixed(6) : (h.numLongitude || '-'))}
                </span>
              </div>

              {h.problemasHidrante && h.problemasHidrante.trim() !== '' && (
                <div className="p-1 rounded bg-red-50 border border-red-200 text-red-700 font-bold text-[10px] max-h-16 overflow-y-auto">
                  ⚠️ {fixEncoding(sanitizeProblem(h.problemasHidrante))}
                </div>
              )}
            </div>

            {/* Linha 1: Ações Principais Táticas (Destaque Ergonômico) */}
            <div className="flex items-center gap-1 pt-0.5">
              <button 
                onClick={() => onInspect(h)}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-md font-bold text-xs shadow-sm transition-all"
                title="Cadastrar Vistoria"
              >
                <Plus size={16} strokeWidth={3} />
                VISTORIA
              </button>
              <a 
                href={`https://waze.com/ul?ll=${h.numLatitude},${h.numLongitude}&navigate=yes`} 
                target="_blank" 
                rel="noreferrer" 
                className="flex items-center justify-center gap-1 py-1.5 px-2.5 !bg-blue-600 hover:!bg-blue-500 active:scale-95 !text-white !rounded-md font-bold text-xs shadow-sm transition-all" 
                title="Navegar no Waze"
              >
                <Navigation size={13} /> Waze
              </a>
              <a 
                href={`https://wa.me/?text=${encodeURIComponent(`🚒 *NETUNO - HIDRANTE ${h.nomHidrante || h.codHidrante}*\n📍 *RA:* ${h.dscLocalidade || '-'}\n${h.flgAtivo ? '🟢 *Status:* OPERANTE' : '🔴 *Status:* INOPERANTE'}\n📅 *Última Vistoria:* ${h.datHoraUltimaVistoria || 'Sem registro'}\n👤 *Vistoriador:* ${h.vistoriadorNome || currentUser?.nome || 'Sem registro'}\n⚠️ *Problemas:* ${h.problemasHidrante || 'Nenhum'}\n🗺️ *Endereço:* ${h.dscEndereco || ''}${h.dscPontoReferencia ? ` (${h.dscPontoReferencia})` : ''}\n\n🌐 *Netuno:* ${window.location.origin}${window.location.pathname}?hid=${id}\n🚗 *Waze:* https://waze.com/ul?ll=${h.numLatitude},${h.numLongitude}`)}`} 
                target="_blank" 
                rel="noreferrer" 
                className="flex items-center justify-center p-1.5 px-2 !bg-green-600 hover:!bg-green-500 active:scale-95 !text-white !rounded-md font-bold text-xs shadow-sm transition-all" 
                title="Compartilhar no WhatsApp"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a5.8 5.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
              </a>
            </div>

            {/* Linha 2: Ferramentas Secundárias Compactas */}
            <div className="flex items-center gap-1">
              <a 
                href={`https://maps.google.com/maps?q=${h.numLatitude},${h.numLongitude}`} 
                target="_blank" 
                rel="noreferrer" 
                className="flex-1 flex items-center justify-center gap-1 py-1 !bg-slate-700 hover:!bg-slate-600 !text-slate-200 !rounded font-semibold text-[10px] transition-colors" 
                title="Google Maps"
              >
                <MapIcon size={12} className="text-emerald-400" /> Maps
              </a>
              <a 
                href={`https://maps.google.com/maps?q=&layer=c&cbll=${h.numLatitude},${h.numLongitude}`} 
                target="_blank" 
                rel="noreferrer" 
                className="flex-1 flex items-center justify-center gap-1 py-1 !bg-slate-700 hover:!bg-slate-600 !text-slate-200 !rounded font-semibold text-[10px] transition-colors" 
                title="Street View 360°"
              >
                <MapPin size={12} className="text-orange-400" /> 360°
              </a>
              {isGestor && (
                <button 
                  onClick={() => onToggleMission && onToggleMission(id)}
                  className={`flex-1 flex items-center justify-center gap-0.5 py-1.5 rounded font-black text-[10px] transition-all active:scale-95 ${
                    isSelected ? 'bg-rose-600 text-white shadow-sm ring-1 ring-rose-400' : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm ring-1 ring-cyan-400/40'
                  }`}
                  title={isSelected ? 'Remover da Missão' : 'Adicionar à Missão'}
                >
                  {isSelected ? '✕ Rota' : '➕ Rota'}
                </button>
              )}
              {isGestor && (
                <button 
                  onClick={() => onEdit && onEdit(h)}
                  className="flex items-center justify-center p-1 px-2 bg-amber-700 hover:bg-amber-600 text-white rounded font-bold text-[10px] transition-colors"
                  title="Editar Hidrante"
                >
                  <Edit size={12} />
                </button>
              )}
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
        <UserLocationTracker userLocation={userLocation} centerPosition={centerPosition} />

        {/* Plotagem direta de todos os hidrantes (Sem agrupamento/cluster) */}
        {renderMarkers()}

        {/* Marcador do Usuário com Azul Destacado e Pulso */}
        {userLocation && (
          <Marker 
            position={[userLocation.lat, userLocation.lng]}
            icon={L.divIcon({
              className: 'custom-div-icon',
              html: `
                <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
                  <div style="position: absolute; width: 24px; height: 24px; border-radius: 50%; background-color: rgba(0, 229, 255, 0.45); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                  <div style="background-color: #00E5FF; width: 14px; height: 14px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 0 10px #00E5FF, 0 0 4px rgba(0,0,0,0.8); position: relative; z-index: 2;"></div>
                </div>
              `,
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            })}
            interactive={false}
            zIndexOffset={1000}
          />
        )}

        {/* Botão Flutuante de GPS (Centralizar Posição Atual) */}
        <GpsControl userLocation={userLocation} />
      </MapContainer>

      {/* Legenda Tática do Mapa */}
      <div className="absolute bottom-6 left-3 z-[1000] bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700 shadow-xl flex items-center gap-3 text-[11px] font-bold text-slate-200 pointer-events-auto select-none">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#10b981] border border-white shadow-sm inline-block shrink-0"></span>
          <span className="text-emerald-400">Operante</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#ef4444] border border-white shadow-sm inline-block shrink-0"></span>
          <span className="text-red-400">Inoperante</span>
        </div>
      </div>

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
