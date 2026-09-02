import React, { useMemo, useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, LocateFixed, Map as MapIcon, MapPin, ClipboardPlus, Edit, Edit3, Minimize2, Maximize2, Plus, Share2, AlertTriangle } from 'lucide-react';
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
const createDivIcon = (isOperante, isSelected, isInspected) => {
  const statusColor = isOperante ? '#10b981' : '#ef4444'; // Verde Esmeralda ou Vermelho Sólido
  
  if (isInspected) {
    // SUPER-DESTAQUE quando o hidrante está selecionado (dialog/detalhe aberto):
    // Halo pulsante estilo sonar/radar de 56px + anel de alto contraste + ponto de mira
    return L.divIcon({
      className: 'custom-div-icon',
      html: `
        <div style="
          position: relative;
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        ">
          <!-- Onda 1 do Radar (Âmbar Vivo) -->
          <div style="
            position: absolute;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 3px solid #f59e0b;
            animation: netunoRadarPulse 1.8s cubic-bezier(0, 0.2, 0.8, 1) infinite;
          "></div>
          <!-- Onda 2 do Radar (Ciano Elétrico com delay) -->
          <div style="
            position: absolute;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 2px solid #38bdf8;
            animation: netunoRadarPulse 1.8s cubic-bezier(0, 0.2, 0.8, 1) infinite 0.7s;
          "></div>
          <!-- Pino Central em Evidência Máxima com Borda Dupla e Glow -->
          <div style="
            background-color: ${statusColor};
            width: 28px;
            height: 28px;
            border-radius: 50%;
            border: 3px solid #ffffff;
            outline: 2.5px solid #f59e0b;
            animation: netunoActiveGlow 2s ease-in-out infinite;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 20;
            pointer-events: auto;
          ">
            <div style="width: 8px; height: 8px; border-radius: 50%; background-color: #ffffff; box-shadow: 0 0 4px rgba(0,0,0,0.8);"></div>
          </div>
        </div>
      `,
      iconSize: [56, 56],
      iconAnchor: [28, 28]
    });
  }

  if (isSelected) {
    // Hidrante adicionado à rota de missão: anel ciano neon destacado
    return L.divIcon({
      className: 'custom-div-icon',
      html: `
        <div style="
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            background-color: rgba(0,0,0,0.55);
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 3.5px solid #00FFFF;
            box-shadow: 0 0 15px #00FFFF, 0 0 5px rgba(0,0,0,0.9);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="width: 9px; height: 9px; border-radius: 50%; background-color: ${statusColor};"></div>
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });
  }

  // Marcador Padrão no Mapa
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div style="
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          background-color: ${statusColor};
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 0 5px rgba(0,0,0,0.7);
          transition: transform 0.2s ease;
        "></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

const RecenterMap = ({ centerPosition, selectedHydrant }) => {
  const map = useMap();
  useEffect(() => {
    const pos = selectedHydrant || centerPosition;
    if (pos && typeof pos.numLatitude === 'number' && typeof pos.numLongitude === 'number') {
      const currentZoom = map.getZoom();
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        const point = map.project([pos.numLatitude, pos.numLongitude], currentZoom);
        // Deslocamento vertical para baixo em pixels para que o pino suba e fique centralizado na área livre acima do Bottom Sheet
        const targetPoint = new L.Point(point.x, point.y + 115);
        const targetLatLng = map.unproject(targetPoint, currentZoom);
        map.panTo(targetLatLng, { animate: true });
      } else {
        map.panTo([pos.numLatitude, pos.numLongitude], { animate: true });
      }
    }
  }, [centerPosition, selectedHydrant, map]);
  return null;
};

const AutoFitFilteredBounds = ({ hidrantes, centerPosition, selectedHydrant }) => {
  const map = useMap();
  const prevCountRef = React.useRef(null);
  const prevFirstIdRef = React.useRef(null);

  useEffect(() => {
    if (centerPosition || selectedHydrant) return;

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
  }, [hidrantes, centerPosition, selectedHydrant, map]);

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

const MapClickHandler = ({ selectedHydrant, onSelectHydrant }) => {
  useMapEvents({
    click: (e) => {
      if (selectedHydrant && (!e.originalEvent || !e.originalEvent._markerClicked)) {
        onSelectHydrant(null);
      }
    }
  });
  return null;
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

const UserLocationTracker = ({ userLocation, centerPosition, selectedHydrant, hasFilter }) => {
  const map = useMap();
  const hasCenteredRef = React.useRef(false);

  useEffect(() => {
    try {
      map.setMinZoom(0);
      map.setMaxZoom(20);
      
      if (userLocation && !hasCenteredRef.current && !centerPosition && !selectedHydrant && !hasFilter) {
        if (typeof userLocation.lat === 'number' && !isNaN(userLocation.lat) && 
            typeof userLocation.lng === 'number' && !isNaN(userLocation.lng)) {
          hasCenteredRef.current = true;
          map.setView([userLocation.lat, userLocation.lng], 16, { animate: true });
        }
      }
    } catch (e) {
      console.warn('Erro ao atualizar visualização do usuário', e);
    }
  }, [userLocation, centerPosition, selectedHydrant, hasFilter, map]);
  return null;
};

const GpsControl = ({ userLocation, isSheetOpen }) => {
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
    <div className={`leaflet-bottom leaflet-right !right-4 !pointer-events-auto z-[1000] transition-all duration-300 ${isSheetOpen ? '!bottom-[275px] sm:!bottom-6' : '!bottom-6'}`}>
      <button
        onClick={handleCenterUser}
        title="Centralizar na Minha Posição (GPS)"
        className={`p-3 bg-slate-900/90 hover:bg-slate-800 text-cyan-400 border border-cyan-500/50 hover:border-cyan-400 rounded-full shadow-2xl flex items-center justify-center transition-all active:scale-95 cursor-pointer backdrop-blur-md ${isLocating ? 'animate-pulse' : ''}`}
      >
        <LocateFixed size={22} className="text-cyan-400" />
      </button>
    </div>
  );
};

const MapComponent = ({ hidrantes, onInspect, onEdit, onEditInspection, centerPosition, onDeselectHydrant, selectedMissionIds = [], onToggleMission, isCartOpen = false, currentUser, onMapClick, onOpenFilters, isMapFullscreen, activeView, isCitySelected = true, selectedCity = '', hasFilter = false }) => {
  const [fullscreenPhoto, setFullscreenPhoto] = useState(null);
  const isGestor = currentUser?.role === 'gestor' || currentUser?.role === 'admin';
  const [selectedHydrant, setSelectedHydrant] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const touchStartY = useRef(0);
  const isDragging = useRef(false);
  const markerRefs = useRef({});

  const validHidrantes = useMemo(() => {
    const list = hidrantes.filter(h => isValidDFCoordinate(h.numLatitude, h.numLongitude));
    if (selectedHydrant && isValidDFCoordinate(selectedHydrant.numLatitude, selectedHydrant.numLongitude)) {
      const exists = list.some(h => 
        (h._internalId && selectedHydrant._internalId && h._internalId === selectedHydrant._internalId) ||
        (h.codHidrante && selectedHydrant.codHidrante && h.codHidrante === selectedHydrant.codHidrante) ||
        (h.nomHidrante && selectedHydrant.nomHidrante && h.nomHidrante === selectedHydrant.nomHidrante)
      );
      if (!exists) {
        list.push(selectedHydrant);
      }
    }
    return list;
  }, [hidrantes, selectedHydrant]);

  const handleCloseHydrant = () => {
    setSelectedHydrant(null);
    if (onDeselectHydrant) {
      onDeselectHydrant();
    }
  };

  // Fecha imediatamente a dialog/bottom sheet de hidrante quando o carrinho é aberto
  useEffect(() => {
    if (isCartOpen && selectedHydrant) {
      setSelectedHydrant(null);
      if (onDeselectHydrant) {
        onDeselectHydrant();
      }
    }
  }, [isCartOpen]);

  // Suporte a arrastar / deslizar para baixo para fechar o Bottom Sheet
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
    if (dragOffsetY > 65) {
      handleCloseHydrant();
    }
    setDragOffsetY(0);
    isDragging.current = false;
  };

  // Sincronizar com centerPosition externo quando recebido (ex: da Tabela ou Rota)
  useEffect(() => {
    if (centerPosition) {
      setSelectedHydrant(centerPosition);
    } else if (centerPosition === null && selectedHydrant) {
      setSelectedHydrant(null);
    }
  }, [centerPosition]);

  useEffect(() => {
    let watchId;
    if ('geolocation' in navigator) {
      try {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (pos && pos.coords && typeof pos.coords.latitude === 'number' && typeof pos.coords.longitude === 'number') {
              setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            }
          },
          (err) => console.warn('Erro getCurrentPosition no MapComponent', err),
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
        );

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

  const handleShareWhatsApp = (h) => {
    const id = h.codHidrante || h._internalId || h.nomHidrante;
    const text = `🚒 *Hidrante:* ${h.nomHidrante || h.codHidrante}\n📍 *RA:* ${h.dscLocalidade || '-'}\n${h.flgAtivo ? '🟢 *Status:* OPERANTE' : '🔴 *Status:* INOPERANTE'}\n📅 *Última Vistoria:* ${h.datHoraUltimaVistoria || 'Sem registro'}\n⚠️ *Problemas:* ${h.problemasHidrante || 'Nenhum'}\n🗺️ *Endereço:* ${h.dscEndereco || ''} ${h.dscPontoReferencia ? `(${h.dscPontoReferencia})` : ''}\n\n🌐 *Netuno:* ${window.location.origin}${window.location.pathname}?hid=${id}\n🚗 *Waze:* https://waze.com/ul?ll=${h.numLatitude},${h.numLongitude}`;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const waUrl = isMobile 
      ? `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}` 
      : `https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const renderMarkers = () => {
    return validHidrantes.map((h, i) => {
      const id = h.codHidrante || h._internalId || h.nomHidrante || `hid-${i}`;
      const isSelected = selectedMissionIds.includes(h.codHidrante) || selectedMissionIds.includes(h.nomHidrante) || selectedMissionIds.includes(h._internalId);
      const isCurrentActive = Boolean(
        selectedHydrant && (
          (selectedHydrant.codHidrante && selectedHydrant.codHidrante === h.codHidrante) ||
          (selectedHydrant.nomHidrante && selectedHydrant.nomHidrante === h.nomHidrante) ||
          (selectedHydrant._internalId && selectedHydrant._internalId === h._internalId)
        )
      );

      return (
        <Marker 
          key={id} 
          position={[h.numLatitude, h.numLongitude]}
          icon={createDivIcon(h.flgAtivo, isSelected, isCurrentActive)}
          zIndexOffset={isCurrentActive ? 2500 : (isSelected ? 500 : 0)}
          ref={(marker) => {
            if (marker) {
              markerRefs.current[id] = marker;
            } else {
              delete markerRefs.current[id];
            }
          }}
          eventHandlers={{
            click: (e) => {
              if (e.originalEvent) {
                e.originalEvent._markerClicked = true;
              }
              if (e.originalEvent && (e.originalEvent.ctrlKey || e.originalEvent.metaKey)) {
                if (onToggleMission) {
                  onToggleMission(id);
                }
                if (e.originalEvent.preventDefault) e.originalEvent.preventDefault();
                if (e.originalEvent.stopPropagation) e.originalEvent.stopPropagation();
                return;
              }
              // Abre o Bottom Sheet tático e centraliza o pino acima do painel SEM adicionar à rota
              setSelectedHydrant(h);
            },
            dblclick: (e) => {
              if (onToggleMission && isGestor) {
                onToggleMission(id);
                e.originalEvent.preventDefault();
                e.originalEvent.stopPropagation();
              }
            }
          }}
        />
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
            {!isCitySelected 
              ? (isGestor 
                  ? 'Todas as cidades estão ativas no filtro. Selecione uma cidade específica para visualizar os hidrantes no mapa.'
                  : 'Selecione uma cidade para visualizar os hidrantes no mapa.')
              : 'Nenhum hidrante encontrado para os filtros selecionados (Toque aqui)'}
          </span>
        </div>
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
        
        <RecenterMap centerPosition={centerPosition} selectedHydrant={selectedHydrant} />
        <AutoFitFilteredBounds hidrantes={hidrantes} centerPosition={centerPosition} selectedHydrant={selectedHydrant} />
        <MapMemory />
        <ScrollBehavior />
        <MapClickHandler selectedHydrant={selectedHydrant} onSelectHydrant={handleCloseHydrant} />
        <MapResizer isMapFullscreen={isMapFullscreen} activeView={activeView} />
        <UserLocationTracker userLocation={userLocation} centerPosition={centerPosition} selectedHydrant={selectedHydrant} hasFilter={hasFilter || isCitySelected} />

        {/* Plotagem direta de todos os hidrantes */}
        {renderMarkers()}

        {/* Marcador do Usuário com Azul Padrão Google Maps e Pulso */}
        {userLocation && (
          <Marker 
            position={[userLocation.lat, userLocation.lng]}
            icon={L.divIcon({
              className: 'custom-div-icon',
              html: `
                <div style="position: relative; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;">
                  <div style="position: absolute; width: 26px; height: 26px; border-radius: 50%; background-color: rgba(26, 115, 232, 0.35); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                  <div style="background-color: #1a73e8; width: 15px; height: 15px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.4), 0 0 10px rgba(26, 115, 232, 0.8); position: relative; z-index: 2;"></div>
                </div>
              `,
              iconSize: [26, 26],
              iconAnchor: [13, 13]
            })}
            interactive={false}
            zIndexOffset={1000}
          />
        )}

        {/* Botão Flutuante de GPS (Centralizar Posição Atual) */}
        <GpsControl userLocation={userLocation} isSheetOpen={Boolean(selectedHydrant)} />
      </MapContainer>

      {/* Legenda Tática do Mapa */}
      <div className={`absolute bottom-6 left-3 z-[1000] bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700 shadow-xl flex items-center gap-3 text-[11px] font-bold text-slate-200 pointer-events-auto select-none transition-all duration-300 ${selectedHydrant ? 'hidden sm:flex' : 'flex'}`}>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#10b981] border border-white shadow-sm inline-block shrink-0"></span>
          <span className="text-emerald-400">Hidrante operante</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#ef4444] border border-white shadow-sm inline-block shrink-0"></span>
          <span className="text-red-400">Hidrante inoperante</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* PAINEL DE DETALHES DO HIDRANTE SELECIONADO: MOBILE vs DESKTOP */}
      {/* ======================================================== */}
      {selectedHydrant && (
        <>
          {/* 1. VERSÃO MOBILE (md:hidden): Bottom Sheet Tático com Arrastar */}
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{ transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined }}
            className="md:hidden absolute bottom-0 inset-x-0 z-[1050] bg-slate-900/98 backdrop-blur-xl border-t border-slate-700/90 shadow-[0_-10px_35px_rgba(0,0,0,0.85)] rounded-t-2xl p-3.5 text-slate-100 flex flex-col gap-2.5 transition-transform duration-150 ease-out select-text pointer-events-auto"
          >
            {/* Barra de puxar / Handle visual para mobile com suporte a arrastar para baixo */}
            <div 
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="w-full pt-1 pb-2 cursor-grab active:cursor-grabbing flex items-center justify-center -mt-2 -mb-1"
            >
              <div className="w-12 h-1.5 bg-slate-600 hover:bg-slate-500 rounded-full"></div>
            </div>

            {/* Cabeçalho: Código, Foto, RA, Status e Botão Fechar */}
            <div 
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                {selectedHydrant.fotoPerfil && (
                  <img 
                    src={selectedHydrant.fotoPerfil} 
                    alt="Foto" 
                    className="w-10 h-10 rounded-lg object-cover cursor-pointer hover:scale-105 transition-transform border border-slate-600 shrink-0 shadow-sm"
                    onClick={() => setFullscreenPhoto(selectedHydrant.fotoPerfil)}
                  />
                )}
                <div className="flex flex-col min-w-0">
                  <span className="font-black text-base text-white tracking-tight leading-tight truncate">
                    {fixEncoding(selectedHydrant.nomHidrante) || selectedHydrant.codHidrante}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold truncate">
                    📍 {fixEncoding(selectedHydrant.dscLocalidade) || '-'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black tracking-wide border shadow-sm ${
                  selectedHydrant.flgAtivo 
                    ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60' 
                    : 'bg-red-950/90 text-red-300 border-red-500/60'
                }`}>
                  {selectedHydrant.flgAtivo ? '● OPERANTE' : '● INOPERANTE'}
                </span>
                <button 
                  onClick={handleCloseHydrant}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors active:scale-95 text-sm font-bold border border-slate-700 shadow-sm"
                  title="Fechar Detalhes"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Bloco de Informações: Endereço, Referência e Alertas */}
            <div className="flex flex-col gap-1.5 text-xs text-slate-200">
              <div className="leading-snug">
                <span className="font-bold text-slate-400">Endereço: </span>
                <span className="text-slate-100 font-medium">{fixEncoding(selectedHydrant.dscEndereco) || '-'}</span>
                {selectedHydrant.dscPontoReferencia && (
                  <div className="italic text-slate-400 text-[11px] mt-0.5">
                    <span className="font-bold not-italic text-slate-500">Ref: </span>
                    {fixEncoding(selectedHydrant.dscPontoReferencia)}
                  </div>
                )}
              </div>

              {/* Tarja de Alerta em caso de Inoperância/Defeito */}
              {selectedHydrant.problemasHidrante && selectedHydrant.problemasHidrante.trim() !== '' && (
                <div className="px-2.5 py-1.5 rounded-lg bg-red-950/80 border border-red-500/50 text-red-200 font-bold text-[11px] flex items-center gap-2 shadow-inner">
                  <span className="text-sm shrink-0">⚠️</span>
                  <span className="leading-tight">{fixEncoding(sanitizeProblem(selectedHydrant.problemasHidrante))}</span>
                </div>
              )}

              {/* Data e Coordenadas Enxutas */}
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-800/80">
                <span>📅 {selectedHydrant.datHoraUltimaVistoria ? String(selectedHydrant.datHoraUltimaVistoria).split(' ')[0] : 'Sem vistoria'}</span>
                <span>Coord: <strong className="text-slate-300">{typeof selectedHydrant.numLatitude === 'number' ? selectedHydrant.numLatitude.toFixed(6) : selectedHydrant.numLatitude}, {typeof selectedHydrant.numLongitude === 'number' ? selectedHydrant.numLongitude.toFixed(6) : selectedHydrant.numLongitude}</strong></span>
              </div>
            </div>

            {/* Barra de Ações Ergonômicas em Duas Linhas */}
            <div className="flex flex-col gap-2 pt-1">
              {Boolean((selectedHydrant.datHoraUltimaVistoria && selectedHydrant.datHoraUltimaVistoria !== '-') || (selectedHydrant.HISTORICO_VISTORIAS && selectedHydrant.HISTORICO_VISTORIAS.length > 0)) && onEditInspection ? (
                <div className="flex items-center gap-2 w-full">
                  <button 
                    onClick={() => { onInspect(selectedHydrant); }}
                    className="flex-[1.4] h-11 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl font-black text-xs shadow-md flex items-center justify-center gap-1.5 transition-all tracking-wide"
                    title="Cadastrar Nova Vistoria Técnica"
                  >
                    <Plus size={17} strokeWidth={3} />
                    <span>NOVA VISTORIA</span>
                  </button>
                  <button 
                    onClick={() => { onEditInspection(selectedHydrant); }}
                    className="flex-1 h-11 bg-amber-600/90 hover:bg-amber-600 active:scale-95 text-white rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-all tracking-wide border border-amber-500/30"
                    title="Editar Vistoria Cadastrada"
                  >
                    <Edit3 size={15} strokeWidth={2.5} />
                    <span>EDITAR VISTORIA</span>
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => { onInspect(selectedHydrant); }}
                  className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl font-black text-xs shadow-md flex items-center justify-center gap-2 transition-all tracking-wide"
                  title="Cadastrar Vistoria Técnica"
                >
                  <Plus size={19} strokeWidth={3} />
                  <span>CADASTRAR VISTORIA</span>
                </button>
              )}

              <div className="flex items-center gap-1.5 w-full">
                <a 
                  href={`https://waze.com/ul?ll=${selectedHydrant.numLatitude},${selectedHydrant.numLongitude}&navigate=yes`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex-1 h-11 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 shadow-md transition-all min-w-0" 
                  title="Navegar com Waze"
                >
                  <Navigation size={16} />
                  <span className="text-[9px] uppercase tracking-wider font-extrabold truncate">Waze</span>
                </a>

                <a 
                  href={`https://maps.google.com/maps?q=${selectedHydrant.numLatitude},${selectedHydrant.numLongitude}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex-1 h-11 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm min-w-0" 
                  title="Abrir no Google Maps"
                >
                  <MapIcon size={16} className="text-emerald-400" />
                  <span className="text-[9px] uppercase tracking-wider font-extrabold truncate">Maps</span>
                </a>

                <a 
                  href={`https://maps.google.com/maps?q=&layer=c&cbll=${selectedHydrant.numLatitude},${selectedHydrant.numLongitude}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex-1 h-11 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm min-w-0" 
                  title="Street View 360°"
                >
                  <MapPin size={16} className="text-amber-400" />
                  <span className="text-[9px] uppercase tracking-wider font-extrabold truncate">360°</span>
                </a>

                <button 
                  onClick={() => handleShareWhatsApp(selectedHydrant)}
                  className="flex-1 h-11 bg-green-600 hover:bg-green-500 active:scale-95 text-white rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 shadow-md transition-all min-w-0" 
                  title="Compartilhar no WhatsApp"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a5.8 5.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                  <span className="text-[9px] uppercase tracking-wider font-extrabold truncate">Zap</span>
                </button>

                {isGestor && (
                  <button 
                    onClick={() => onToggleMission && onToggleMission(selectedHydrant.codHidrante || selectedHydrant._internalId || selectedHydrant.nomHidrante)}
                    className={`flex-1 h-11 rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 shadow-md transition-all active:scale-95 min-w-0 ${
                      (selectedMissionIds.includes(selectedHydrant.codHidrante) || selectedMissionIds.includes(selectedHydrant.nomHidrante) || selectedMissionIds.includes(selectedHydrant._internalId))
                        ? 'bg-rose-600 text-white ring-1 ring-rose-400' 
                        : 'bg-cyan-600 hover:bg-cyan-500 text-white ring-1 ring-cyan-400/40'
                    }`}
                    title={(selectedMissionIds.includes(selectedHydrant.codHidrante) || selectedMissionIds.includes(selectedHydrant.nomHidrante) || selectedMissionIds.includes(selectedHydrant._internalId)) ? 'Remover da Missão' : 'Adicionar à Missão'}
                  >
                    <span className="text-xs leading-none">{(selectedMissionIds.includes(selectedHydrant.codHidrante) || selectedMissionIds.includes(selectedHydrant.nomHidrante) || selectedMissionIds.includes(selectedHydrant._internalId)) ? '✕' : '➕'}</span>
                    <span className="text-[9px] uppercase tracking-wider font-extrabold truncate">Rota</span>
                  </button>
                )}

                {isGestor && (
                  <button 
                    onClick={() => onEdit && onEdit(selectedHydrant)}
                    className="flex-1 h-11 bg-amber-700/90 hover:bg-amber-600 active:scale-95 text-white rounded-xl flex flex-col items-center justify-center gap-0.5 shadow-md transition-colors min-w-0 border border-amber-600/30"
                    title="Editar Cadastro do Hidrante"
                  >
                    <Edit size={15} />
                    <span className="text-[9px] uppercase tracking-wider font-extrabold truncate">Edit</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 2. VERSÃO DESKTOP (hidden md:flex): Painel Tático Lateral Flutuante Inspirado no Argos */}
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="hidden md:flex absolute top-16 right-4 z-[1050] w-[380px] max-h-[calc(100%-80px)] overflow-y-auto bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.8)] text-slate-100 flex-col gap-3 transition-all duration-200 select-text pointer-events-auto animate-scaleUp"
          >
            {/* Cabeçalho Desktop */}
            <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3 min-w-0">
                {selectedHydrant.fotoPerfil ? (
                  <img 
                    src={selectedHydrant.fotoPerfil} 
                    alt="Foto do Hidrante" 
                    className="w-12 h-12 rounded-xl object-cover cursor-pointer hover:scale-105 transition-transform border border-slate-600 shrink-0 shadow-md"
                    title="Clique para ampliar a foto"
                    onClick={() => setFullscreenPhoto(selectedHydrant.fotoPerfil)}
                  />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xl shrink-0">
                    🚒
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-lg text-white tracking-tight leading-tight truncate">
                      {fixEncoding(selectedHydrant.nomHidrante) || selectedHydrant.codHidrante}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-semibold flex items-center gap-1 mt-0.5 truncate">
                    <MapPin size={13} className="text-emerald-400 shrink-0" />
                    {fixEncoding(selectedHydrant.dscLocalidade) || 'Região DF'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black tracking-wide border shadow-sm ${
                  selectedHydrant.flgAtivo 
                    ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60' 
                    : 'bg-red-950/90 text-red-300 border-red-500/60'
                }`}>
                  {selectedHydrant.flgAtivo ? '● OPERANTE' : '● INOPERANTE'}
                </span>
                <button 
                  onClick={handleCloseHydrant}
                  className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors active:scale-95 text-xs font-bold border border-slate-700"
                  title="Fechar painel"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Informações Estruturadas (Estilo Ficha Cadastral Argos) */}
            <div className="flex flex-col gap-2 bg-slate-800/60 rounded-xl p-3 border border-slate-700/60 text-xs">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Endereço</span>
                <span className="text-slate-100 font-semibold leading-snug">{fixEncoding(selectedHydrant.dscEndereco) || '-'}</span>
              </div>

              {selectedHydrant.dscPontoReferencia && (
                <div className="pt-1.5 border-t border-slate-700/50">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Ponto de Referência</span>
                  <span className="text-slate-300 italic font-medium">{fixEncoding(selectedHydrant.dscPontoReferencia)}</span>
                </div>
              )}

              {/* Alerta de Inoperância/Problema */}
              {selectedHydrant.problemasHidrante && selectedHydrant.problemasHidrante.trim() !== '' && (
                <div className="mt-1 p-2 rounded-lg bg-red-950/80 border border-red-500/50 text-red-200 font-bold text-xs flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-400 shrink-0" />
                  <span className="leading-tight">{fixEncoding(sanitizeProblem(selectedHydrant.problemasHidrante))}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/50 text-[11px]">
                <div>
                  <span className="text-slate-400 block font-medium">Última Vistoria:</span>
                  <span className="text-slate-200 font-semibold">{selectedHydrant.datHoraUltimaVistoria ? String(selectedHydrant.datHoraUltimaVistoria).split(' ')[0] : 'Sem vistoria'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Coordenadas:</span>
                  <span className="text-slate-200 font-mono text-[10px]">{typeof selectedHydrant.numLatitude === 'number' ? selectedHydrant.numLatitude.toFixed(5) : selectedHydrant.numLatitude}, {typeof selectedHydrant.numLongitude === 'number' ? selectedHydrant.numLongitude.toFixed(5) : selectedHydrant.numLongitude}</span>
                </div>
              </div>
            </div>

            {/* Ações Táticas no Desktop */}
            <div className="flex flex-col gap-2 pt-1">
              {Boolean((selectedHydrant.datHoraUltimaVistoria && selectedHydrant.datHoraUltimaVistoria !== '-') || (selectedHydrant.HISTORICO_VISTORIAS && selectedHydrant.HISTORICO_VISTORIAS.length > 0)) && onEditInspection ? (
                <div className="flex items-center gap-2 w-full">
                  <button 
                    onClick={() => { onInspect(selectedHydrant); }}
                    className="flex-[1.4] h-11 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded-xl font-black text-xs sm:text-sm shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-1.5 transition-all tracking-wide"
                    title="Cadastrar Nova Vistoria Técnica"
                  >
                    <Plus size={18} strokeWidth={3} />
                    <span>NOVA VISTORIA</span>
                  </button>
                  <button 
                    onClick={() => { onEditInspection(selectedHydrant); }}
                    className="flex-1 h-11 bg-amber-600/90 hover:bg-amber-600 active:scale-98 text-white rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-all tracking-wide border border-amber-500/40"
                    title="Editar Vistoria Cadastrada"
                  >
                    <Edit3 size={15} strokeWidth={2.5} />
                    <span>EDITAR VISTORIA</span>
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => { onInspect(selectedHydrant); }}
                  className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded-xl font-black text-sm shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 transition-all tracking-wide"
                  title="Cadastrar Vistoria Técnica"
                >
                  <Plus size={19} strokeWidth={3} />
                  <span>CADASTRAR VISTORIA</span>
                </button>
              )}

              {/* Barra de Ações Secundárias / Utilitários */}
              <div className="flex items-center gap-1.5 w-full">
                <a 
                  href={`https://waze.com/ul?ll=${selectedHydrant.numLatitude},${selectedHydrant.numLongitude}&navigate=yes`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex-1 h-11 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 shadow-sm transition-all min-w-0" 
                  title="Navegar com Waze"
                >
                  <Navigation size={16} />
                  <span className="text-[9px] uppercase tracking-wider font-extrabold truncate">Waze</span>
                </a>

                <a 
                  href={`https://maps.google.com/maps?q=${selectedHydrant.numLatitude},${selectedHydrant.numLongitude}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex-1 h-11 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm min-w-0" 
                  title="Abrir no Google Maps"
                >
                  <MapIcon size={16} className="text-emerald-400" />
                  <span className="text-[9px] uppercase tracking-wider font-extrabold truncate">Maps</span>
                </a>

                <a 
                  href={`https://maps.google.com/maps?q=&layer=c&cbll=${selectedHydrant.numLatitude},${selectedHydrant.numLongitude}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex-1 h-11 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm min-w-0" 
                  title="Street View 360°"
                >
                  <MapPin size={16} className="text-amber-400" />
                  <span className="text-[9px] uppercase tracking-wider font-extrabold truncate">360°</span>
                </a>

                <button 
                  onClick={() => handleShareWhatsApp(selectedHydrant)}
                  className="flex-1 h-11 bg-green-600 hover:bg-green-500 active:scale-95 text-white rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 shadow-sm transition-all min-w-0" 
                  title="Compartilhar no WhatsApp"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a5.8 5.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                  <span className="text-[9px] uppercase tracking-wider font-extrabold truncate">Zap</span>
                </button>

                {isGestor && (
                  <button 
                    onClick={() => onToggleMission && onToggleMission(selectedHydrant.codHidrante || selectedHydrant._internalId || selectedHydrant.nomHidrante)}
                    className={`flex-1 h-11 rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 shadow-sm transition-all active:scale-95 min-w-0 ${
                      (selectedMissionIds.includes(selectedHydrant.codHidrante) || selectedMissionIds.includes(selectedHydrant.nomHidrante) || selectedMissionIds.includes(selectedHydrant._internalId))
                        ? 'bg-rose-600 text-white ring-1 ring-rose-400' 
                        : 'bg-cyan-600 hover:bg-cyan-500 text-white ring-1 ring-cyan-400/40'
                    }`}
                    title={(selectedMissionIds.includes(selectedHydrant.codHidrante) || selectedMissionIds.includes(selectedHydrant.nomHidrante) || selectedMissionIds.includes(selectedHydrant._internalId)) ? 'Remover da Missão' : 'Adicionar à Missão'}
                  >
                    <span className="text-xs leading-none">{(selectedMissionIds.includes(selectedHydrant.codHidrante) || selectedMissionIds.includes(selectedHydrant.nomHidrante) || selectedMissionIds.includes(selectedHydrant._internalId)) ? '✕' : '➕'}</span>
                    <span className="text-[9px] uppercase tracking-wider font-extrabold truncate">Rota</span>
                  </button>
                )}

                {isGestor && (
                  <button 
                    onClick={() => onEdit && onEdit(selectedHydrant)}
                    className="flex-1 h-11 bg-amber-700/90 hover:bg-amber-600 active:scale-95 text-white rounded-xl flex flex-col items-center justify-center gap-0.5 shadow-sm transition-colors min-w-0 border border-amber-600/30"
                    title="Editar Cadastro do Hidrante"
                  >
                    <Edit size={15} />
                    <span className="text-[9px] uppercase tracking-wider font-extrabold truncate">Edit</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Botão Unificado de Tela Cheia do Mapa (Alterna entre Maximize e Minimize no canto superior direito) */}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          if (onMapClick) onMapClick();
        }}
        className={`absolute top-3.5 right-4 z-[9999] p-2.5 rounded-full transition-all border shadow-xl active:scale-95 backdrop-blur-md flex items-center justify-center ${
          isMapFullscreen 
            ? 'bg-slate-900/95 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
            : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white border-slate-600'
        }`}
        title={isMapFullscreen ? "Sair da Tela Cheia" : "Modo Tela Cheia"}
      >
        {isMapFullscreen ? <Minimize2 size={22} /> : <Maximize2 size={22} />}
      </button>
      {fullscreenPhoto && (
        <div 
          className="fixed inset-0 bg-black/90 z-[999999] flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setFullscreenPhoto(null)}
        >
          <img 
            src={fullscreenPhoto} 
            alt="Foto Ampliada" 
            className="max-w-[90%] max-h-[90%] object-contain" 
          />
        </div>
      )}
    </div>
  );
};

export default MapComponent;
