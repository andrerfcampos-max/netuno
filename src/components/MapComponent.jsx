import React, { useMemo, useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, LocateFixed, Map as MapIcon, MapPin, ClipboardPlus, Edit, Edit3, Minimize2, Maximize2, Plus, Share2, AlertTriangle, Wrench, Route as RouteIcon, Check, X, History, Hash } from 'lucide-react';
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
const createDivIcon = (isOperante, isSelected, isInspected, isMissionItem = false, missionOrder = null, isMissionCompleted = false, showPinCode = false, pinCode = '') => {
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
          ${showPinCode && pinCode ? `
            <div style="
              position: absolute;
              top: 45px;
              left: 50%;
              transform: translateX(-50%);
              background: #0f172a;
              color: #fbbf24;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              font-size: 10px;
              font-weight: 900;
              padding: 1px 6px;
              border-radius: 4px;
              border: 1.5px solid #f59e0b;
              box-shadow: 0 2px 8px rgba(0,0,0,0.9), 0 0 10px rgba(245, 158, 11, 0.5);
              white-space: nowrap;
              pointer-events: none;
              z-index: 30;
              line-height: 1.25;
            ">${pinCode}</div>
          ` : ''}
        </div>
      `,
      iconSize: [56, 56],
      iconAnchor: [28, 28]
    });
  }

  // HIDRANTE DA ROTA DA MISSÃO ATIVA
  if (isMissionItem) {
    if (isMissionCompleted) {
      // Hidrante da Rota Já Vistoriado: Verde Esmeralda escuro com borda neon e checkmark
      return L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div style="
            position: relative;
            width: 34px;
            height: 34px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="
              background-color: #064e3b;
              width: 28px;
              height: 28px;
              border-radius: 50%;
              border: 2.5px solid #10b981;
              box-shadow: 0 0 12px rgba(16, 185, 129, 0.8), 0 2px 5px rgba(0,0,0,0.7);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #ffffff;
              font-weight: 900;
              font-size: 15px;
              line-height: 1;
            ">
              ✓
            </div>
            ${showPinCode && pinCode ? `
              <div style="
                position: absolute;
                top: 32px;
                left: 50%;
                transform: translateX(-50%);
                background: #064e3b;
                color: #a7f3d0;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                font-size: 10px;
                font-weight: 900;
                padding: 1px 5px;
                border-radius: 4px;
                border: 1px solid #10b981;
                box-shadow: 0 2px 6px rgba(0,0,0,0.85);
                white-space: nowrap;
                pointer-events: none;
                z-index: 25;
                line-height: 1.2;
              ">${pinCode}</div>
            ` : ''}
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });
    }

    // Hidrante da Rota Pendente: Marcador Ciano Neon com a ordem de parada na rota (1, 2, 3...)
    const orderLabel = missionOrder !== null && missionOrder !== undefined ? String(missionOrder) : '';
    return L.divIcon({
      className: 'custom-div-icon',
      html: `
        <div style="
          position: relative;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <!-- Pulso sutil de hidrante ativo da rota -->
          <div style="
            position: absolute;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: 2px solid #00ffff;
            opacity: 0.6;
            animation: ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></div>
          <div style="
            background-color: #0f172a;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 3px solid #00ffff;
            box-shadow: 0 0 14px #00ffff, 0 3px 8px rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #00ffff;
            font-family: monospace, sans-serif;
            font-weight: 900;
            font-size: ${orderLabel.length > 2 ? '10px' : '12px'};
            line-height: 1;
            position: relative;
            z-index: 2;
          ">
            ${orderLabel ? orderLabel : `<div style="width: 10px; height: 10px; border-radius: 50%; background-color: ${statusColor};"></div>`}
          </div>
          ${showPinCode && pinCode ? `
            <div style="
              position: absolute;
              top: 34px;
              left: 50%;
              transform: translateX(-50%);
              background: #0f172a;
              color: #00ffff;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              font-size: 10px;
              font-weight: 900;
              padding: 1px 5px;
              border-radius: 4px;
              border: 1px solid #00ffff;
              box-shadow: 0 2px 8px rgba(0,0,0,0.9), 0 0 8px rgba(0,255,255,0.4);
              white-space: nowrap;
              pointer-events: none;
              z-index: 25;
              line-height: 1.2;
            ">${pinCode}</div>
          ` : ''}
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });
  }

  if (isSelected) {
    // Hidrante adicionado à seleção do carrinho: anel ciano neon destacado
    return L.divIcon({
      className: 'custom-div-icon',
      html: `
        <div style="
          position: relative;
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
          ${showPinCode && pinCode ? `
            <div style="
              position: absolute;
              top: 34px;
              left: 50%;
              transform: translateX(-50%);
              background: #0f172a;
              color: #38bdf8;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              font-size: 10px;
              font-weight: 900;
              padding: 1px 5px;
              border-radius: 4px;
              border: 1px solid #38bdf8;
              box-shadow: 0 2px 6px rgba(0,0,0,0.85);
              white-space: nowrap;
              pointer-events: none;
              z-index: 25;
              line-height: 1.2;
            ">${pinCode}</div>
          ` : ''}
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
        position: relative;
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
        ${showPinCode && pinCode ? `
          <div style="
            position: absolute;
            top: 22px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(15, 23, 42, 0.92);
            color: #ffffff;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 10px;
            font-weight: 800;
            padding: 1px 4px;
            border-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.5);
            box-shadow: 0 2px 5px rgba(0,0,0,0.85);
            white-space: nowrap;
            pointer-events: none;
            z-index: 20;
            line-height: 1.2;
            letter-spacing: 0.2px;
          ">${pinCode}</div>
        ` : ''}
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

const AutoFitFilteredBounds = ({ hidrantes, centerPosition, selectedHydrant, hasActiveRoute }) => {
  const map = useMap();
  const prevCountRef = React.useRef(null);
  const prevFirstIdRef = React.useRef(null);

  useEffect(() => {
    // Não força ajuste geral se houver hidrante selecionado ou rota ativa em execução
    if (centerPosition || selectedHydrant || hasActiveRoute) return;

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
  }, [hidrantes, centerPosition, selectedHydrant, hasActiveRoute, map]);

  return null;
};

// COMPONENTE DE ZOOM TÁTICO: Centraliza no usuário e nos 4 ou 5 hidrantes mais próximos da rota ativa
const RouteNearbyAutoFitter = ({ 
  routeFitTrigger, 
  activeMissionHydrants, 
  completedMissionIds = [], 
  userLocation, 
  centerPosition, 
  selectedHydrant 
}) => {
  const map = useMap();
  const lastTriggerRef = useRef(null);
  const pendingFitRef = useRef(false);

  const executeFit = (userLoc) => {
    if (!activeMissionHydrants || activeMissionHydrants.length === 0) return;

    const validHydrants = activeMissionHydrants.filter(h => 
      isValidDFCoordinate(h.numLatitude, h.numLongitude)
    );
    if (validHydrants.length === 0) return;

    const completedSet = new Set((completedMissionIds || []).map(String));
    
    // Prioriza hidrantes pendentes da rota
    let targets = validHydrants.filter(h => {
      const k1 = h.codHidrante !== undefined && h.codHidrante !== null ? String(h.codHidrante) : null;
      const k2 = h.nomHidrante ? String(h.nomHidrante) : null;
      const k3 = h._internalId ? String(h._internalId) : null;
      return !((k1 && completedSet.has(k1)) || (k2 && completedSet.has(k2)) || (k3 && completedSet.has(k3)));
    });

    if (targets.length === 0) {
      targets = validHydrants;
    }

    const hasUserLoc = userLoc && typeof userLoc.lat === 'number' && typeof userLoc.lng === 'number' &&
      !isNaN(userLoc.lat) && !isNaN(userLoc.lng);

    const isMobile = window.innerWidth < 768;

    if (hasUserLoc) {
      // Ordena os hidrantes da rota pela proximidade euclidiana com a posição do usuário
      const sortedByDistance = [...targets].sort((a, b) => {
        const dLatA = a.numLatitude - userLoc.lat;
        const dLngA = a.numLongitude - userLoc.lng;
        const dLatB = b.numLatitude - userLoc.lat;
        const dLngB = b.numLongitude - userLoc.lng;
        return (dLatA * dLatA + dLngA * dLngA) - (dLatB * dLatB + dLngB * dLngB);
      });

      // Pega até 5 hidrantes da rota mais próximos da localização do usuário
      const nearest5 = sortedByDistance.slice(0, 5);

      // Enquadra a posição do usuário + os 4 ou 5 hidrantes mais próximos
      const points = [
        [userLoc.lat, userLoc.lng],
        ...nearest5.map(h => [h.numLatitude, h.numLongitude])
      ];

      const bounds = L.latLngBounds(points);
      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          paddingTopLeft: isMobile ? [40, 40] : [60, 60],
          paddingBottomRight: isMobile ? [40, 95] : [60, 60],
          maxZoom: 17,
          animate: true,
          duration: 0.8
        });
      }
    } else {
      // Fallback gracioso sem GPS: enquadra os 5 primeiros hidrantes da rota
      const first5 = targets.slice(0, 5);
      const points = first5.map(h => [h.numLatitude, h.numLongitude]);
      const bounds = L.latLngBounds(points);
      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: isMobile ? [40, 40] : [60, 60],
          maxZoom: 16,
          animate: true,
          duration: 0.8
        });
      }
    }
  };

  // Dispara quando routeFitTrigger for acionado (ao voltar da rota para o mapa)
  useEffect(() => {
    if (!routeFitTrigger || routeFitTrigger === lastTriggerRef.current) return;
    if (centerPosition || selectedHydrant) return;

    lastTriggerRef.current = routeFitTrigger;

    if (userLocation && typeof userLocation.lat === 'number') {
      executeFit(userLocation);
      pendingFitRef.current = false;
    } else {
      pendingFitRef.current = true;
      const timer = setTimeout(() => {
        if (pendingFitRef.current) {
          pendingFitRef.current = false;
          executeFit(null);
        }
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [routeFitTrigger, centerPosition, selectedHydrant, activeMissionHydrants, completedMissionIds]);

  // Se o GPS atualizou e estávamos aguardando o foco inicial
  useEffect(() => {
    if (pendingFitRef.current && userLocation && typeof userLocation.lat === 'number') {
      pendingFitRef.current = false;
      executeFit(userLocation);
    }
  }, [userLocation]);

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

const UserLocationTracker = ({ userLocation, centerPosition, selectedHydrant, hasFilter, hasActiveRoute }) => {
  const map = useMap();
  const hasCenteredRef = React.useRef(false);

  useEffect(() => {
    try {
      map.setMinZoom(0);
      map.setMaxZoom(20);
      
      if (userLocation && !hasCenteredRef.current && !centerPosition && !selectedHydrant && !hasFilter && !hasActiveRoute) {
        if (typeof userLocation.lat === 'number' && !isNaN(userLocation.lat) && 
            typeof userLocation.lng === 'number' && !isNaN(userLocation.lng)) {
          hasCenteredRef.current = true;
          map.setView([userLocation.lat, userLocation.lng], 16, { animate: true });
        }
      }
    } catch (e) {
      console.warn('Erro ao atualizar visualização do usuário', e);
    }
  }, [userLocation, centerPosition, selectedHydrant, hasFilter, hasActiveRoute, map]);
  return null;
};

const TacticalMapControls = ({ userLocation, isSheetOpen, hasActiveRoute, onFocusRoute, showPinCodes, onTogglePinCodes }) => {
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
    <div className={`leaflet-bottom leaflet-right !right-4 !pointer-events-auto z-[1000] flex flex-col gap-2.5 items-end transition-all duration-300 ${isSheetOpen ? '!bottom-[275px] sm:!bottom-6' : '!bottom-6'}`}>
      {/* Botão Tático: Focar na Rota Próxima (Você + hidrantes mais próximos) */}
      {hasActiveRoute && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onFocusRoute) onFocusRoute();
          }}
          title="Focar na sua posição e nos hidrantes mais próximos da rota"
          className="p-2.5 sm:p-3 bg-cyan-950/90 hover:bg-cyan-900 text-cyan-300 border border-cyan-400/80 hover:border-cyan-300 rounded-full shadow-2xl flex items-center justify-center transition-all active:scale-95 cursor-pointer backdrop-blur-md group"
        >
          <Navigation size={20} className="text-cyan-300 group-hover:text-cyan-200 transition-transform group-hover:rotate-12" />
        </button>
      )}

      {/* Botão Tático: Alternar Exibição dos Códigos dos Pinos (Padrão Argos) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (onTogglePinCodes) onTogglePinCodes();
        }}
        title={showPinCodes ? "Ocultar códigos dos hidrantes no mapa" : "Exibir códigos dos hidrantes no mapa (Padrão Argos)"}
        className={`p-2.5 sm:p-3 rounded-full shadow-2xl flex items-center justify-center transition-all active:scale-95 cursor-pointer backdrop-blur-md border ${
          showPinCodes 
            ? 'bg-cyan-600 text-white border-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.6)] ring-2 ring-cyan-400/50' 
            : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border-slate-700 hover:border-cyan-500/50'
        }`}
      >
        <Hash size={20} className={showPinCodes ? "text-white font-bold" : "text-cyan-400"} />
      </button>

      {/* Botão GPS Padrão */}
      <button
        type="button"
        onClick={handleCenterUser}
        title="Centralizar na Minha Posição (GPS)"
        className={`p-3 bg-slate-900/90 hover:bg-slate-800 text-cyan-400 border border-cyan-500/50 hover:border-cyan-400 rounded-full shadow-2xl flex items-center justify-center transition-all active:scale-95 cursor-pointer backdrop-blur-md ${isLocating ? 'animate-pulse' : ''}`}
      >
        <LocateFixed size={22} className="text-cyan-400" />
      </button>
    </div>
  );
};

const MapComponent = ({ 
  hidrantes, 
  onInspect, 
  onEdit, 
  onEditInspection, 
  centerPosition, 
  onDeselectHydrant, 
  selectedMissionIds = [], 
  onToggleMission, 
  isCartOpen = false, 
  currentUser, 
  onMapClick, 
  onOpenFilters, 
  isMapFullscreen, 
  activeView, 
  isCitySelected = true, 
  selectedCity = '', 
  hasFilter = false,
  activeMission = null,
  activeMissionHydrants = [],
  completedMissionIds = [],
  routeFitTrigger = null,
  onTriggerRouteFit = null,
  isRouteActiveOnMap = false,
  onCloseRouteOnMap = null,
  onOpenInspectionHistory = null
}) => {
  const [fullscreenPhoto, setFullscreenPhoto] = useState(null);
  const isGestor = currentUser?.role === 'gestor' || currentUser?.role === 'admin';
  const [selectedHydrant, setSelectedHydrant] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const touchStartY = useRef(0);
  const isDragging = useRef(false);
  const markerRefs = useRef({});

  const [showPinCodes, setShowPinCodes] = useState(() => {
    try {
      return localStorage.getItem('netuno_show_pin_codes') === 'true';
    } catch (e) {
      return false;
    }
  });

  const handleTogglePinCodes = () => {
    setShowPinCodes(prev => {
      const next = !prev;
      try {
        localStorage.setItem('netuno_show_pin_codes', String(next));
      } catch (e) {}
      return next;
    });
  };

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

  const hasActiveRoute = Boolean(isRouteActiveOnMap && activeMission && activeMissionHydrants && activeMissionHydrants.length > 0);

  const completedIdsSet = useMemo(() => {
    return new Set((completedMissionIds || []).map(String));
  }, [completedMissionIds]);

  const missionOrderMap = useMemo(() => {
    const map = {};
    if (!activeMission) return map;
    const ordered = (activeMission.orderedIds && activeMission.orderedIds.length > 0) 
      ? activeMission.orderedIds 
      : (activeMission.selectedIds || []);
    
    // Numera apenas os hidrantes pendentes/faltantes da rota
    const pendingOrdered = ordered.filter(id => !completedIdsSet.has(String(id)));
    pendingOrdered.forEach((id, idx) => {
      map[String(id)] = idx + 1;
    });
    return map;
  }, [activeMission, completedIdsSet]);

  const activeMissionIdsSet = useMemo(() => {
    return new Set((activeMission?.selectedIds || []).map(String));
  }, [activeMission?.selectedIds]);

  const { missionCompletedCount, missionPendingCount } = useMemo(() => {
    if (!hasActiveRoute || !activeMissionHydrants) return { missionCompletedCount: 0, missionPendingCount: 0 };
    let comp = 0;
    let pend = 0;
    activeMissionHydrants.forEach(h => {
      const k1 = h.codHidrante !== undefined && h.codHidrante !== null ? String(h.codHidrante) : null;
      const k2 = h.nomHidrante ? String(h.nomHidrante) : null;
      const k3 = h._internalId ? String(h._internalId) : null;
      if ((k1 && completedIdsSet.has(k1)) || (k2 && completedIdsSet.has(k2)) || (k3 && completedIdsSet.has(k3))) {
        comp++;
      } else {
        pend++;
      }
    });
    return { missionCompletedCount: comp, missionPendingCount: pend };
  }, [hasActiveRoute, activeMissionHydrants, completedIdsSet]);

  const selectedHydrantMissionStatus = useMemo(() => {
    if (!hasActiveRoute || !selectedHydrant) return null;
    const k1 = selectedHydrant.codHidrante !== undefined && selectedHydrant.codHidrante !== null ? String(selectedHydrant.codHidrante) : null;
    const k2 = selectedHydrant.nomHidrante ? String(selectedHydrant.nomHidrante) : null;
    const k3 = selectedHydrant._internalId ? String(selectedHydrant._internalId) : null;
    const isCompleted = Boolean((k1 && completedIdsSet.has(k1)) || (k2 && completedIdsSet.has(k2)) || (k3 && completedIdsSet.has(k3)));
    const isMission = Boolean(
      (k1 && activeMissionIdsSet.has(k1)) ||
      (k2 && activeMissionIdsSet.has(k2)) ||
      (k3 && activeMissionIdsSet.has(k3)) ||
      (k1 && activeMissionHydrants.some(mh => String(mh.codHidrante) === k1)) ||
      (k2 && activeMissionHydrants.some(mh => mh.nomHidrante === k2)) ||
      (k3 && activeMissionHydrants.some(mh => mh._internalId === k3))
    );
    if (!isMission) return null;
    const order = !isCompleted ? ((k1 && missionOrderMap[k1]) || (k2 && missionOrderMap[k2]) || (k3 && missionOrderMap[k3])) : null;
    return { isCompleted, order };
  }, [hasActiveRoute, selectedHydrant, completedIdsSet, activeMissionIdsSet, activeMissionHydrants, missionOrderMap]);

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

      const k1 = h.codHidrante !== undefined && h.codHidrante !== null ? String(h.codHidrante) : null;
      const k2 = h.nomHidrante ? String(h.nomHidrante) : null;
      const k3 = h._internalId ? String(h._internalId) : null;

      const isMissionCompleted = Boolean(
        (k1 && completedIdsSet.has(k1)) ||
        (k2 && completedIdsSet.has(k2)) ||
        (k3 && completedIdsSet.has(k3))
      );

      // Hidrante pertence à missão ativa se a rota estiver ativa no mapa
      const isMissionItem = Boolean(
        hasActiveRoute && (
          (k1 && activeMissionHydrants.some(mh => String(mh.codHidrante) === k1)) ||
          (k2 && activeMissionHydrants.some(mh => mh.nomHidrante === k2)) ||
          (k3 && activeMissionHydrants.some(mh => mh._internalId === k3)) ||
          (k1 && activeMissionIdsSet.has(k1)) ||
          (k2 && activeMissionIdsSet.has(k2)) ||
          (k3 && activeMissionIdsSet.has(k3))
        )
      );

      const missionOrder = (isMissionItem && !isMissionCompleted)
        ? ((k1 && missionOrderMap[k1]) || (k2 && missionOrderMap[k2]) || (k3 && missionOrderMap[k3]) || null)
        : null;

      const pinCode = fixEncoding(h.nomHidrante) || (h.codHidrante !== undefined && h.codHidrante !== null ? String(h.codHidrante) : '');

      return (
        <Marker 
          key={id} 
          position={[h.numLatitude, h.numLongitude]}
          icon={createDivIcon(h.flgAtivo, isSelected, isCurrentActive, isMissionItem, missionOrder, isMissionCompleted, showPinCodes, pinCode)}
          zIndexOffset={isCurrentActive ? 2500 : (isMissionItem ? (isMissionCompleted ? 1100 : 1500) : (isSelected ? 500 : 0))}
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
      
      {/* AVISO VISUAL CLARO: MODO ROTA ATIVA PLOTADA NO MAPA COM BOTÃO FECHAR */}
      {hasActiveRoute && activeMission && (
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-[1000] bg-slate-900/95 border border-cyan-400/90 shadow-2xl rounded-2xl sm:rounded-full px-3.5 py-2 sm:px-4 sm:py-2 flex items-center justify-between sm:justify-start gap-2.5 sm:gap-4 backdrop-blur-md max-w-[96vw] pointer-events-auto">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
            </span>
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-[11px] sm:text-xs font-bold text-cyan-300">Rota Ativa:</span>
              <span className="text-xs sm:text-sm font-extrabold text-white truncate max-w-[140px] sm:max-w-[240px]">
                {activeMission.name || 'Missão'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-sm">
                <span>✓</span> {missionCompletedCount} {missionCompletedCount === 1 ? 'concluído' : 'concluídos'}
              </span>
              <span className="bg-cyan-950/90 border border-cyan-500/60 text-cyan-300 text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded-full font-bold shadow-sm">
                {missionPendingCount} {missionPendingCount === 1 ? 'faltante' : 'faltantes'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Botão de Foco nos mais próximos */}
            {onTriggerRouteFit && (
              <button
                type="button"
                onClick={onTriggerRouteFit}
                className="hidden xs:flex items-center gap-1 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/60 text-cyan-300 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer active:scale-95"
                title="Centralizar em você e nos hidrantes mais próximos da rota"
              >
                <Navigation size={12} className="text-cyan-400" />
                <span className="hidden sm:inline">Focar Próximos</span>
              </button>
            )}

            {/* Botão Fechar Rota e Restaurar Navegação por Filtros */}
            {onCloseRouteOnMap && (
              <button
                type="button"
                onClick={onCloseRouteOnMap}
                className="flex items-center gap-1 bg-rose-950/90 hover:bg-rose-900 border border-rose-500/80 hover:border-rose-400 text-rose-200 px-2.5 py-1 sm:px-3 rounded-full text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                title="Fechar visualização da rota e voltar à navegação normal por filtros"
              >
                <X size={14} className="text-rose-300" />
                <span>Fechar Rota</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dica de Filtro de Cidade (apenas quando NÃO houver rota ativa plotada) */}
      {!hasActiveRoute && validHidrantes.length === 0 && (
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
        <AutoFitFilteredBounds hidrantes={hidrantes} centerPosition={centerPosition} selectedHydrant={selectedHydrant} hasActiveRoute={hasActiveRoute} />
        <RouteNearbyAutoFitter 
          routeFitTrigger={routeFitTrigger} 
          activeMissionHydrants={activeMissionHydrants} 
          completedMissionIds={completedMissionIds} 
          userLocation={userLocation} 
          centerPosition={centerPosition} 
          selectedHydrant={selectedHydrant} 
        />
        <MapMemory />
        <ScrollBehavior />
        <MapClickHandler selectedHydrant={selectedHydrant} onSelectHydrant={handleCloseHydrant} />
        <MapResizer isMapFullscreen={isMapFullscreen} activeView={activeView} />
        <UserLocationTracker userLocation={userLocation} centerPosition={centerPosition} selectedHydrant={selectedHydrant} hasFilter={hasFilter || isCitySelected} hasActiveRoute={hasActiveRoute} />

        {/* Traçado Tático da Rota Conectando os Hidrantes Pendentes/Faltantes da Missão Ativa */}
        {hasActiveRoute && (
          (() => {
            const pendingList = activeMissionHydrants.filter(h => {
              const k1 = h.codHidrante !== undefined && h.codHidrante !== null ? String(h.codHidrante) : null;
              const k2 = h.nomHidrante ? String(h.nomHidrante) : null;
              const k3 = h._internalId ? String(h._internalId) : null;
              return !((k1 && completedIdsSet.has(k1)) || (k2 && completedIdsSet.has(k2)) || (k3 && completedIdsSet.has(k3)));
            });

            if (pendingList.length <= 1) return null;

            const ordered = (activeMission.orderedIds && activeMission.orderedIds.length > 0)
              ? [...pendingList].sort((a, b) => {
                  const idxA = activeMission.orderedIds.indexOf(a.codHidrante || a._internalId || a.nomHidrante);
                  const idxB = activeMission.orderedIds.indexOf(b.codHidrante || b._internalId || b.nomHidrante);
                  return (idxA >= 0 ? idxA : 999) - (idxB >= 0 ? idxB : 999);
                })
              : pendingList;

            const positions = ordered
              .filter(h => isValidDFCoordinate(h.numLatitude, h.numLongitude))
              .map(h => [h.numLatitude, h.numLongitude]);

            if (positions.length <= 1) return null;

            return (
              <Polyline 
                positions={positions}
                pathOptions={{
                  color: '#00ffff',
                  weight: 3.5,
                  opacity: 0.75,
                  dashArray: '8, 8',
                  lineCap: 'round'
                }}
              />
            );
          })()
        )}

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

        {/* Controles Flutuantes Táticos do Mapa (Foco de Rota Próxima + Códigos + GPS) */}
        <TacticalMapControls 
          userLocation={userLocation} 
          isSheetOpen={Boolean(selectedHydrant)} 
          hasActiveRoute={hasActiveRoute}
          onFocusRoute={() => {
            if (onTriggerRouteFit) {
              onTriggerRouteFit();
            }
          }}
          showPinCodes={showPinCodes}
          onTogglePinCodes={handleTogglePinCodes}
        />
      </MapContainer>

      {/* Legenda Tática do Mapa */}
      <div className={`absolute bottom-6 left-3 z-[1000] bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700 shadow-xl flex items-center gap-2.5 sm:gap-3 text-[11px] font-bold text-slate-200 pointer-events-auto select-none transition-all duration-300 ${selectedHydrant ? 'hidden sm:flex' : 'flex'}`}>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#10b981] border border-white shadow-sm inline-block shrink-0"></span>
          <span className="text-emerald-400">Operante</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#ef4444] border border-white shadow-sm inline-block shrink-0"></span>
          <span className="text-red-400">Inoperante</span>
        </div>
        {hasActiveRoute && (
          <>
            <div className="flex items-center gap-1.5 border-l border-slate-700 pl-2">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-cyan-400 bg-slate-900 text-cyan-300 font-mono text-[9px] flex items-center justify-center font-bold shrink-0 leading-none">1</span>
              <span className="text-cyan-300">Faltante</span>
            </div>
            <div className="flex items-center gap-1.5 border-l border-slate-700 pl-2">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-emerald-400 bg-emerald-950 text-emerald-300 font-mono text-[10px] flex items-center justify-center font-black shrink-0 leading-none">✓</span>
              <span className="text-emerald-300">Concluído</span>
            </div>
          </>
        )}
        {/* Toggle rápido de Códigos na Legenda (Padrão Argos) */}
        <button
          type="button"
          onClick={handleTogglePinCodes}
          className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold transition-all cursor-pointer active:scale-95 border-l border-slate-700 ml-0.5 ${
            showPinCodes
              ? 'bg-cyan-950/90 border-cyan-400 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
              : 'bg-slate-800/90 border-slate-600 text-slate-400 hover:text-slate-200'
          }`}
          title="Alternar visualização dos códigos dos hidrantes nos pinos (Padrão Argos)"
        >
          <Hash size={11} className={showPinCodes ? 'text-cyan-400 font-bold' : 'text-slate-400'} />
          <span>{showPinCodes ? 'Códigos ON' : 'Códigos'}</span>
        </button>
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
              <div className="flex items-center gap-2.5 min-w-0">
                {selectedHydrant.fotoPerfil ? (
                  <img 
                    src={selectedHydrant.fotoPerfil} 
                    alt="Foto" 
                    className="w-10 h-10 rounded-xl object-cover cursor-pointer hover:scale-105 transition-transform border border-slate-600 shrink-0 shadow-sm"
                    onClick={() => setFullscreenPhoto(selectedHydrant.fotoPerfil)}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-lg shrink-0">
                    🚒
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="font-black text-base text-white tracking-tight leading-tight truncate">
                    {fixEncoding(selectedHydrant.nomHidrante) || selectedHydrant.codHidrante}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold flex items-center gap-1 mt-0.5 truncate">
                    <MapPin size={12} className="text-emerald-400 shrink-0" />
                    {fixEncoding(selectedHydrant.dscLocalidade) || 'Região DF'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                {selectedHydrantMissionStatus && (
                  selectedHydrantMissionStatus.isCompleted ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-500/60 shadow-sm shrink-0">
                      <span>✓</span> Concluído
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950/90 text-cyan-300 border border-cyan-500/60 shadow-sm shrink-0">
                      <span>#{selectedHydrantMissionStatus.order || ''}</span> Faltante
                    </span>
                  )
                )}
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black tracking-wide border shadow-sm ${
                  selectedHydrant.flgAtivo 
                    ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60' 
                    : 'bg-red-950/90 text-red-300 border-red-500/60'
                }`}>
                  {selectedHydrant.flgAtivo ? '● OPERANTE' : '● INOPERANTE'}
                </span>
                <button 
                  onClick={handleCloseHydrant}
                  className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors active:scale-95 text-xs font-bold border border-slate-700 shadow-sm"
                  title="Fechar Detalhes"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Informações Estruturadas (Estilo Ficha Cadastral Argos) */}
            <div className="flex flex-col gap-1.5 bg-slate-800/60 rounded-xl p-2.5 border border-slate-700/60 text-xs">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Endereço</span>
                <span className="text-slate-100 font-medium leading-snug">{fixEncoding(selectedHydrant.dscEndereco) || '-'}</span>
              </div>

              {selectedHydrant.dscPontoReferencia && (
                <div className="pt-1 border-t border-slate-700/50">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Ponto de Referência</span>
                  <span className="text-slate-300 italic font-medium">{fixEncoding(selectedHydrant.dscPontoReferencia)}</span>
                </div>
              )}

              {/* Tarja de Alerta em caso de Inoperância/Defeito */}
              {selectedHydrant.problemasHidrante && selectedHydrant.problemasHidrante.trim() !== '' && (
                <div className="mt-0.5 p-2 rounded-lg bg-red-950/80 border border-red-500/50 text-red-200 font-bold text-xs flex items-center gap-2">
                  <AlertTriangle size={15} className="text-red-400 shrink-0" />
                  <span className="leading-tight">{fixEncoding(sanitizeProblem(selectedHydrant.problemasHidrante))}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-700/50 text-[10px]">
                <div>
                  <span className="text-slate-400 block font-medium">Vistoria Vigente:</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shrink-0"></span>
                    <span className="text-slate-200 font-semibold">{selectedHydrant.datHoraUltimaVistoria ? String(selectedHydrant.datHoraUltimaVistoria).split(' ')[0] : 'Sem vistoria'}</span>
                  </div>
                  {isGestor && onOpenInspectionHistory && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenInspectionHistory(selectedHydrant);
                      }}
                      className="mt-1 px-2 py-0.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[9.5px] font-bold flex items-center gap-1 transition-all active:scale-95 shadow-sm"
                      title="Auditar Histórico de Vistorias Anteriores (Exclusivo Gestor)"
                    >
                      <History size={11} className="text-amber-400 shrink-0" />
                      <span>Histórico ({Array.isArray(selectedHydrant.HISTORICO_VISTORIAS) ? selectedHydrant.HISTORICO_VISTORIAS.length : (selectedHydrant.datHoraUltimaVistoria ? 1 : 0)})</span>
                    </button>
                  )}
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Coordenadas:</span>
                  <span className="text-slate-200 font-mono mt-0.5 block">{typeof selectedHydrant.numLatitude === 'number' ? selectedHydrant.numLatitude.toFixed(6) : selectedHydrant.numLatitude}, {typeof selectedHydrant.numLongitude === 'number' ? selectedHydrant.numLongitude.toFixed(6) : selectedHydrant.numLongitude}</span>
                </div>
              </div>
            </div>

            {/* Barra de Ações Táticas: Linha 1 (Waze 4x e Street View 3x) + Linha 2 (Secundários 1x) */}
            <div className="flex flex-col gap-2 pt-1">
              {/* LINHA 1: Waze 4x e Street View 3x */}
              <div className="flex items-center gap-2 w-full">
                <a 
                  href={`https://waze.com/ul?ll=${selectedHydrant.numLatitude},${selectedHydrant.numLongitude}&navigate=yes`} 
                  target="_blank" 
                  rel="noreferrer" 
                  style={{ backgroundColor: '#2563eb' }}
                  className="flex-[4] h-12 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white rounded-xl font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5 transition-all tracking-wide min-w-0 border border-blue-400/40" 
                  title="Navegar pelo Waze"
                >
                  <Navigation size={18} className="shrink-0 text-white" />
                  <span className="truncate font-black text-white">NAVEGAR NO WAZE</span>
                </a>

                <a 
                  href={`https://maps.google.com/maps?q=&layer=c&cbll=${selectedHydrant.numLatitude},${selectedHydrant.numLongitude}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  style={{ backgroundColor: '#d97706' }}
                  className="flex-[3] h-12 bg-amber-600 hover:bg-amber-500 active:scale-98 text-white rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-all tracking-wide min-w-0 border border-amber-400/40" 
                  title="Google Street View 360°"
                >
                  <MapPin size={17} className="shrink-0 text-amber-200" />
                  <span className="truncate text-white">STREET VIEW</span>
                </a>
              </div>

              {/* LINHA 2: Ações Secundárias (1x de tamanho homogêneo) */}
              <div className="flex items-center gap-1.5 w-full">
                {/* Cadastrar Nova Vistoria */}
                <button 
                  onClick={() => { onInspect(selectedHydrant); }}
                  className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 shadow-sm transition-all min-w-0"
                  title="Cadastrar Nova Vistoria Técnica"
                >
                  <Plus size={15} strokeWidth={3} />
                  <span className="text-[9px] uppercase tracking-wider font-extrabold truncate">VISTORIA</span>
                </button>

                {/* Editar Vistoria Cadastrada (Diferenciada com Laranja e Edit3) */}
                {Boolean((selectedHydrant.datHoraUltimaVistoria && selectedHydrant.datHoraUltimaVistoria !== '-') || (selectedHydrant.HISTORICO_VISTORIAS && selectedHydrant.HISTORICO_VISTORIAS.length > 0)) && onEditInspection && (
                  <button 
                    onClick={() => { onEditInspection(selectedHydrant); }}
                    className="flex-1 h-11 bg-orange-600 hover:bg-orange-500 active:scale-95 text-white rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 shadow-sm transition-all min-w-0 border border-orange-400/40"
                    title="Editar Vistoria Cadastrada"
                  >
                    <Edit3 size={14} strokeWidth={2.5} />
                    <span className="text-[9px] uppercase tracking-wider font-extrabold truncate">EDIT VIST.</span>
                  </button>
                )}

                {/* Editar Cadastro do Hidrante (Diferenciado com Wrench e Ciano/Slate para Gestores) */}
                {isGestor && (
                  <button 
                    onClick={() => onEdit && onEdit(selectedHydrant)}
                    className="flex-1 h-11 bg-slate-750 hover:bg-slate-700 active:scale-95 text-cyan-300 rounded-xl flex flex-col items-center justify-center gap-0.5 shadow-sm transition-colors min-w-0 border border-cyan-500/40"
                    title="Editar Cadastro do Hidrante (Coordenadas, RA e Endereço)"
                  >
                    <Wrench size={14} className="text-cyan-400" />
                    <span className="text-[9px] uppercase tracking-wider font-extrabold truncate text-slate-100">EDIT HIDR.</span>
                  </button>
                )}

                {/* Google Maps */}
                <a 
                  href={`https://maps.google.com/maps?q=${selectedHydrant.numLatitude},${selectedHydrant.numLongitude}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex-1 h-11 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm min-w-0" 
                  title="Abrir no Google Maps"
                >
                  <MapIcon size={15} className="text-emerald-400" />
                  <span className="text-[9px] uppercase tracking-wider font-extrabold truncate">Maps</span>
                </a>

                {/* WhatsApp */}
                <button 
                  onClick={() => handleShareWhatsApp(selectedHydrant)}
                  className="flex-1 h-11 bg-green-600 hover:bg-green-500 active:scale-95 text-white rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 shadow-md transition-all min-w-0" 
                  title="Compartilhar no WhatsApp"
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a5.8 5.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                  <span className="text-[9px] uppercase tracking-wider font-extrabold truncate">Zap</span>
                </button>

                {/* Rota da Missão */}
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

              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                {selectedHydrantMissionStatus && (
                  selectedHydrantMissionStatus.isCompleted ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-500/60 shadow-sm shrink-0">
                      <span>✓</span> Concluído
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950/90 text-cyan-300 border border-cyan-500/60 shadow-sm shrink-0">
                      <span>#{selectedHydrantMissionStatus.order || ''}</span> Faltante
                    </span>
                  )
                )}
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
                  <span className="text-slate-400 block font-medium">Vistoria Vigente:</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shrink-0"></span>
                    <span className="text-slate-200 font-semibold">{selectedHydrant.datHoraUltimaVistoria ? String(selectedHydrant.datHoraUltimaVistoria).split(' ')[0] : 'Sem vistoria'}</span>
                  </div>
                  {isGestor && onOpenInspectionHistory && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenInspectionHistory(selectedHydrant);
                      }}
                      className="mt-1.5 px-2 py-0.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95 shadow-sm"
                      title="Auditar Histórico de Vistorias Anteriores (Exclusivo Gestor)"
                    >
                      <History size={12} className="text-amber-400 shrink-0" />
                      <span>Histórico de Vistorias ({Array.isArray(selectedHydrant.HISTORICO_VISTORIAS) ? selectedHydrant.HISTORICO_VISTORIAS.length : (selectedHydrant.datHoraUltimaVistoria ? 1 : 0)})</span>
                    </button>
                  )}
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Coordenadas:</span>
                  <span className="text-slate-200 font-mono text-[10px] mt-0.5 block">{typeof selectedHydrant.numLatitude === 'number' ? selectedHydrant.numLatitude.toFixed(6) : selectedHydrant.numLatitude}, {typeof selectedHydrant.numLongitude === 'number' ? selectedHydrant.numLongitude.toFixed(6) : selectedHydrant.numLongitude}</span>
                </div>
              </div>
            </div>

            {/* Barra de Ações Táticas: Linha 1 (Waze 4x e Street View 3x) + Linha 2 (Secundários 1x) */}
            <div className="flex flex-col gap-2 pt-1">
              {/* LINHA 1: Waze 4x e Street View 3x */}
              <div className="flex items-center gap-2 w-full">
                <a 
                  href={`https://waze.com/ul?ll=${selectedHydrant.numLatitude},${selectedHydrant.numLongitude}&navigate=yes`} 
                  target="_blank" 
                  rel="noreferrer" 
                  style={{ backgroundColor: '#2563eb' }}
                  className="flex-[4] h-12 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white rounded-xl font-extrabold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-all tracking-wide min-w-0 border border-blue-400/40" 
                  title="Navegar pelo Waze"
                >
                  <Navigation size={18} className="shrink-0 text-white" />
                  <span className="truncate font-black text-white">NAVEGAR NO WAZE</span>
                </a>

                <a 
                  href={`https://maps.google.com/maps?q=&layer=c&cbll=${selectedHydrant.numLatitude},${selectedHydrant.numLongitude}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  style={{ backgroundColor: '#d97706' }}
                  className="flex-[3] h-12 bg-amber-600 hover:bg-amber-500 active:scale-98 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-1.5 transition-all tracking-wide min-w-0 border border-amber-400/40" 
                  title="Google Street View 360°"
                >
                  <MapPin size={17} className="shrink-0 text-amber-200" />
                  <span className="truncate text-white">STREET VIEW</span>
                </a>
              </div>

              {/* LINHA 2: Ações Secundárias (1x de tamanho homogêneo) */}
              <div className="flex items-center gap-1.5 w-full">
                {/* Cadastrar Nova Vistoria */}
                <button 
                  onClick={() => { onInspect(selectedHydrant); }}
                  className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 shadow-sm transition-all min-w-0"
                  title="Cadastrar Nova Vistoria Técnica"
                >
                  <Plus size={15} strokeWidth={3} />
                  <span className="text-[9px] uppercase tracking-wider font-extrabold truncate">VISTORIA</span>
                </button>

                {/* Editar Vistoria Cadastrada (Diferenciada com Laranja e Edit3) */}
                {Boolean((selectedHydrant.datHoraUltimaVistoria && selectedHydrant.datHoraUltimaVistoria !== '-') || (selectedHydrant.HISTORICO_VISTORIAS && selectedHydrant.HISTORICO_VISTORIAS.length > 0)) && onEditInspection && (
                  <button 
                    onClick={() => { onEditInspection(selectedHydrant); }}
                    className="flex-1 h-11 bg-orange-600 hover:bg-orange-500 active:scale-95 text-white rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 shadow-sm transition-all min-w-0 border border-orange-400/40"
                    title="Editar Vistoria Cadastrada"
                  >
                    <Edit3 size={14} strokeWidth={2.5} />
                    <span className="text-[9px] uppercase tracking-wider font-extrabold truncate">EDIT VIST.</span>
                  </button>
                )}

                {/* Editar Cadastro do Hidrante (Diferenciado com Wrench e Ciano/Slate para Gestores) */}
                {isGestor && (
                  <button 
                    onClick={() => onEdit && onEdit(selectedHydrant)}
                    className="flex-1 h-11 bg-slate-750 hover:bg-slate-700 active:scale-95 text-cyan-300 rounded-xl flex flex-col items-center justify-center gap-0.5 shadow-sm transition-colors min-w-0 border border-cyan-500/40"
                    title="Editar Cadastro do Hidrante (Coordenadas, RA e Endereço)"
                  >
                    <Wrench size={14} className="text-cyan-400" />
                    <span className="text-[9px] uppercase tracking-wider font-extrabold truncate text-slate-100">EDIT HIDR.</span>
                  </button>
                )}

                {/* Google Maps */}
                <a 
                  href={`https://maps.google.com/maps?q=${selectedHydrant.numLatitude},${selectedHydrant.numLongitude}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex-1 h-11 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm min-w-0" 
                  title="Abrir no Google Maps"
                >
                  <MapIcon size={15} className="text-emerald-400" />
                  <span className="text-[9px] uppercase tracking-wider font-extrabold truncate">Maps</span>
                </a>

                {/* WhatsApp */}
                <button 
                  onClick={() => handleShareWhatsApp(selectedHydrant)}
                  className="flex-1 h-11 bg-green-600 hover:bg-green-500 active:scale-95 text-white rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 shadow-md transition-all min-w-0" 
                  title="Compartilhar no WhatsApp"
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a5.8 5.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                  <span className="text-[9px] uppercase tracking-wider font-extrabold truncate">Zap</span>
                </button>

                {/* Rota da Missão */}
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
