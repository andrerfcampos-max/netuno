import React, { useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Map as MapIcon, MapPin, ClipboardPlus, Edit, Minimize2, Maximize2, Plus, Share2 } from 'lucide-react';

const fixEncoding = (str) => {
  if (!str) return str;
  try {
    return decodeURIComponent(escape(str));
  } catch(e) {
    return str;
  }
};

// Fix para ícones padrão do Leaflet não quebrarem (embora vamos usar divIcon)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Estilização dos Marcadores (CSS Puro com Alto Contraste)
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

const MapMemory = () => {
  const map = useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      localStorage.setItem('netuno_map_state', JSON.stringify({ lat: center.lat, lng: center.lng, zoom }));
    },
    zoomend: () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      localStorage.setItem('netuno_map_state', JSON.stringify({ lat: center.lat, lng: center.lng, zoom }));
    }
  });
  return null;
};

// Gerencia o comportamento do scroll wheel (Ctrl + scroll = zoom)
const ScrollBehavior = () => {
  const map = useMap();
  
  useEffect(() => {
    map.scrollWheelZoom.disable();
    
    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        map.scrollWheelZoom.enable();
      } else {
        map.scrollWheelZoom.disable();
      }
    };
    
    const container = map.getContainer();
    container.addEventListener('wheel', handleWheel, { capture: true });
    
    return () => {
      container.removeEventListener('wheel', handleWheel, { capture: true });
    };
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
      const timeout = setTimeout(() => map.invalidateSize(), 50);
      return () => clearTimeout(timeout);
    }
  }, [isMapFullscreen, activeView, map]);
  return null;
};

const UserLocationTracker = ({ userLocation }) => {
  const map = useMap();
  useEffect(() => {
    if (userLocation && window.innerWidth < 768) {
      map.setView([userLocation.lat, userLocation.lng], 18, { animate: true });
      map.setMinZoom(18);
      map.setMaxZoom(18);
      
      return () => {
        map.setMinZoom(0);
        map.setMaxZoom(20);
      };
    } else {
      map.setMinZoom(0);
      map.setMaxZoom(20);
    }
  }, [userLocation, map]);
  return null;
};

const MapComponent = ({ hidrantes, onInspect, onEdit, centerPosition, selectedMissionIds = [], onToggleMission, currentUser, onMapClick, isMapFullscreen, activeView }) => {
  const useClustering = hidrantes.length > 500;
  const isGestor = currentUser?.role === 'gestor' || currentUser?.role === 'admin';

  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    let watchId;
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn('Erro GPS no MapComponent', err),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
    }
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Centro padrão (Brasília)
  const defaultCenter = [-15.793, -47.882];
  
  let initialCenter = hidrantes.length > 0 
    ? [hidrantes[0].numLatitude, hidrantes[0].numLongitude] 
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
    return hidrantes.map((h, i) => {
      const id = h.codHidrante || h._internalId || h.nomHidrante;
      const isSelected = selectedMissionIds.includes(id);
      
      return (
      <Marker 
        key={id || i} 
        position={[h.numLatitude, h.numLongitude]}
        icon={createDivIcon(h.flgAtivo, isSelected)}
        eventHandlers={{
          add: (e) => {
            if (centerPosition && (centerPosition.codHidrante === h.codHidrante || centerPosition.nomHidrante === h.nomHidrante)) {
              setTimeout(() => {
                if (e.target.isPopupOpen && !e.target.isPopupOpen()) {
                  e.target.openPopup();
                }
              }, 300);
            }
          },
          click: (e) => {
            if (e.target.isPopupOpen && !e.target.isPopupOpen()) {
              e.target.openPopup();
            }
          }
        }}
      >
        <Popup minWidth={260} className="argos-popup">
          <div className="flex flex-col gap-1 p-0.5 text-slate-800 text-xs w-full leading-tight">
            <div className="flex gap-2 items-center border-b border-slate-200 pb-1 mb-1">
              {h.fotoPerfil && (
                <img 
                  src={h.fotoPerfil} 
                  alt="Hidrante" 
                  className="w-12 h-12 rounded object-cover cursor-pointer hover:scale-105 transition-transform border border-slate-300"
                  onClick={(e) => {
                    // Simples visualizador full screen sem libs
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
              <div className="font-bold text-base flex-1">{fixEncoding(h.nomHidrante) || h.codHidrante}</div>
            </div>
            
            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 mb-1">
              <div className="font-semibold text-slate-500">Status:</div>
              <div className={h.flgAtivo ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                {h.flgAtivo ? 'OPERANTE' : 'INOPERANTE'}
              </div>
              
              <div className="font-semibold text-slate-500">RA:</div>
              <div>{fixEncoding(h.dscLocalidade) || '-'}</div>
              
              <div className="font-semibold text-slate-500">Endereço:</div>
              <div className="col-span-2 leading-tight">{fixEncoding(h.dscEndereco) || '-'}</div>
              
              <div className="font-semibold text-slate-500">Ponto de referência:</div>
              <div className="col-span-2 leading-tight italic">{fixEncoding(h.dscPontoReferencia) || '-'}</div>

              <div className="font-semibold text-slate-500 mt-1">Dt Vistoria:</div>
              <div className="text-slate-700 font-bold truncate">{h.datHoraUltimaVistoria || 'Sem registro'}</div>
              
              <div className="font-semibold text-slate-500 mt-1">Coordenadas:</div>
              <div className="text-slate-700 text-xs font-mono">{h.numLatitude}, {h.numLongitude}</div>

              <div className="font-semibold text-slate-500 mt-1">Problema:</div>
              <div className="text-slate-700 font-bold text-red-600 break-words max-h-60 overflow-y-auto pr-2" title={fixEncoding(h.problemasHidrante)}>{fixEncoding(h.problemasHidrante) || 'Nenhum'}</div>
            </div>

            {/* Navegação Externa GPS (Botões Reduzidos) */}
            <div className="grid grid-cols-4 gap-1 mt-1">
              <a href={`https://waze.com/ul?ll=${h.numLatitude},${h.numLongitude}&navigate=yes`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 py-1.5 !bg-blue-500 !text-white !rounded font-bold hover:!bg-blue-400 transition-colors" title="Waze">
                <Navigation size={14} />
              </a>
              <a href={`https://maps.google.com/maps?q=${h.numLatitude},${h.numLongitude}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 py-1.5 !bg-emerald-600 !text-white !rounded font-bold hover:!bg-emerald-500 transition-colors" title="Google Maps">
                <MapIcon size={14} />
              </a>
              <a href={`https://maps.google.com/maps?q=&layer=c&cbll=${h.numLatitude},${h.numLongitude}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 py-1.5 !bg-orange-500 !text-white !rounded font-bold hover:!bg-orange-400 transition-colors" title="Street View">
                <MapPin size={14} />
              </a>
              <a href={`https://wa.me/?text=${encodeURIComponent(`🚒 *Hidrante:* ${h.nomHidrante || h.codHidrante}\n📍 *RA:* ${h.dscLocalidade || '-'}\n${h.flgAtivo ? '🟢 *Status:* OPERANTE' : '🔴 *Status:* INOPERANTE'}\n📅 *Última Vistoria:* ${h.datHoraUltimaVistoria || 'Sem registro'}\n⚠️ *Problemas:* ${h.problemasHidrante || 'Nenhum'}\n🗺️ *Endereço:* ${h.dscEndereco || ''} ${h.dscPontoReferencia ? `(${h.dscPontoReferencia})` : ''}\n\n🌐 *Netuno:* ${window.location.origin}${window.location.pathname}?hid=${id}\n🚗 *Waze:* https://waze.com/ul?ll=${h.numLatitude},${h.numLongitude}`)}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 py-1.5 !bg-green-500 !text-white !rounded font-bold hover:!bg-green-400 transition-colors" title="WhatsApp">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a5.8 5.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
              </a>
            </div>

            {/* Ações Táticas (Reduzidas) */}
            <div className="flex flex-col gap-1 mt-1">
              {isGestor && (
                <button 
                  onClick={() => onToggleMission && onToggleMission(id)}
                  className={`flex w-full items-center justify-center gap-1 py-2 rounded font-bold transition-all active:scale-95 ${isSelected ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-cyan-600 hover:bg-cyan-500 text-white'}`}
                >
                  {isSelected ? 'REMOVER DA MISSÃO' : 'ADICIONAR À MISSÃO'}
                </button>
              )}
              
              <div className="flex gap-1">
                <button 
                  onClick={() => onInspect(h)}
                  className="flex-1 flex items-center justify-center gap-1 py-2 bg-teal-600 text-white rounded font-bold hover:bg-teal-500 active:scale-95 transition-all"
                >
                  <Plus size={20} strokeWidth={3} />
                  CAD. VIST.
                </button>
                {isGestor && (
                  <button 
                    onClick={() => onEdit && onEdit(h)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 bg-amber-700 text-white rounded font-bold hover:bg-amber-600 active:scale-95 transition-all"
                  >
                    <Edit size={14} />
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
    <div className={isMapFullscreen ? "fixed inset-0 z-[100] bg-slate-900" : "h-[60vh] min-h-[400px] w-full relative rounded-xl overflow-hidden border border-slate-700 shadow-inner z-0"}>
      
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
        scrollWheelZoom={false}
      >
        {/* Camada OBRIGATÓRIA Google Satélite Híbrido */}
        <TileLayer
          attribution='&copy; Google Maps'
          url="http://mt0.google.com/vt/lyrs=y&hl=pt-BR&x={x}&y={y}&z={z}"
          maxZoom={20}
        />
        
        <RecenterMap centerPosition={centerPosition} />
        <MapMemory />
        <ScrollBehavior />
        <MapClickHandler onMapClick={onMapClick} />
        <MapResizer isMapFullscreen={isMapFullscreen} activeView={activeView} />
        <UserLocationTracker userLocation={userLocation} />

        
        {useClustering ? (
          <MarkerClusterGroup chunkedLoading>
            {renderMarkers()}
          </MarkerClusterGroup>
        ) : (
          <>{renderMarkers()}</>
        )}

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
      </MapContainer>

      {!isMapFullscreen && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            if (onMapClick) onMapClick();
          }}
          className="absolute top-4 right-4 z-[9999] p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-full transition-colors border border-slate-600 shadow-md active:scale-95"
          title="Modo Tela Cheia"
        >
          <Maximize2 size={24} />
        </button>
      )}
    </div>
  );
};

export default MapComponent;
