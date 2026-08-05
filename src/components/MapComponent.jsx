import React, { useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Map as MapIcon, MapPin, ClipboardPlus, Edit, Minimize2 } from 'lucide-react';

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
  const borderColor = isSelected ? '#00FFFF' : 'white';
  const borderWidth = isSelected ? '4px' : '2px';
  const shadow = isSelected ? '0 0 15px #00FFFF, 0 0 5px rgba(0,0,0,0.9)' : '0 0 5px rgba(0,0,0,0.8)';
  const size = isSelected ? 26 : 20;
  
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="
      background-color: ${bgColor};
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
    iconSize: [24, 24],
    iconAnchor: [12, 12]
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
  useMapEvents({
    click() {
      if (onMapClick) onMapClick();
    },
  });
  return null;
};

const MapResizer = ({ isMapFullscreen }) => {
  const map = useMap();
  useEffect(() => {
    // Dá um tempo para o CSS da transição/fixed terminar antes de recalcular
    const timeout = setTimeout(() => map.invalidateSize(), 50);
    return () => clearTimeout(timeout);
  }, [isMapFullscreen, map]);
  return null;
};

const MapComponent = ({ hidrantes, onInspect, centerPosition, selectedMissionIds = [], onToggleMission, currentUser, onMapClick, isMapFullscreen }) => {
  const useClustering = hidrantes.length > 500;
  const isGestor = currentUser?.role === 'gestor';

  // Centro padrão (Brasília)
  const defaultCenter = [-15.793, -47.882];
  
  const mapCenter = hidrantes.length > 0 
    ? [hidrantes[0].numLatitude, hidrantes[0].numLongitude] 
    : defaultCenter;

  const renderMarkers = () => {
    return hidrantes.map((h, i) => {
      const id = h.codHidrante || h._internalId || h.nomHidrante;
      const isSelected = selectedMissionIds.includes(id);
      
      return (
      <Marker 
        key={id || i} 
        position={[h.numLatitude, h.numLongitude]}
        icon={createDivIcon(h.flgAtivo, isSelected)}
      >
        <Popup minWidth={260} className="argos-popup">
          <div className="flex flex-col gap-1 p-0.5 text-slate-800 text-xs w-full leading-tight">
            <div className="font-bold text-base border-b border-slate-200 pb-1 mb-1">{h.nomHidrante || h.codHidrante}</div>
            
            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 mb-1">
              <div className="font-semibold text-slate-500">Status:</div>
              <div className={h.flgAtivo ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                {h.flgAtivo ? 'OPERANTE' : 'INOPERANTE'}
              </div>
              
              <div className="font-semibold text-slate-500">RA:</div>
              <div>{h.dscLocalidade || '-'}</div>
              
              <div className="font-semibold text-slate-500">Endereço:</div>
              <div className="col-span-2 leading-tight">{h.dscEndereco || '-'}</div>
              
              <div className="font-semibold text-slate-500">Ponto de referência:</div>
              <div className="col-span-2 leading-tight italic">{h.dscPontoReferencia || '-'}</div>

              <div className="font-semibold text-slate-500 mt-1">Dt Vistoria:</div>
              <div className="text-slate-700 font-bold truncate">{h.datHoraUltimaVistoria || 'Sem registro'}</div>

              <div className="font-semibold text-slate-500 mt-1">Problema:</div>
              <div className="text-slate-700 font-bold text-red-600 truncate" title={h.problemasHidrante}>{h.problemasHidrante || 'Nenhum'}</div>
            </div>

            {/* Navegação Externa GPS (Botões Reduzidos) */}
            <div className="grid grid-cols-3 gap-1 mt-1">
              <a href={`https://waze.com/ul?ll=${h.numLatitude},${h.numLongitude}&navigate=yes`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 py-1.5 !bg-blue-500 !text-white !rounded font-bold hover:!bg-blue-400 transition-colors">
                <Navigation size={14} />
                Waze
              </a>
              <a href={`https://maps.google.com/maps?q=${h.numLatitude},${h.numLongitude}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 py-1.5 !bg-emerald-600 !text-white !rounded font-bold hover:!bg-emerald-500 transition-colors">
                <MapIcon size={14} />
                Maps
              </a>
              <a href={`https://maps.google.com/maps?q=&layer=c&cbll=${h.numLatitude},${h.numLongitude}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 py-1.5 !bg-orange-500 !text-white !rounded font-bold hover:!bg-orange-400 transition-colors">
                <MapPin size={14} />
                Street
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
                  <ClipboardPlus size={14} />
                  CAD. VIST.
                </button>
                <button className="flex-1 flex items-center justify-center gap-1 py-2 bg-amber-700 text-white rounded font-bold hover:bg-amber-600 active:scale-95 transition-all">
                  <Edit size={14} />
                  EDITAR
                </button>
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
        center={mapCenter} 
        zoom={12} 
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
        <ScrollBehavior />
        <MapClickHandler onMapClick={onMapClick} />
        <MapResizer isMapFullscreen={isMapFullscreen} />

        
        {useClustering ? (
          <MarkerClusterGroup chunkedLoading>
            {renderMarkers()}
          </MarkerClusterGroup>
        ) : (
          <>{renderMarkers()}</>
        )}
      </MapContainer>
    </div>
  );
};

export default MapComponent;
