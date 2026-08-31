import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, ImagePlus, Save, MapPin, LocateFixed, Loader2, Sparkles, Navigation, Check, Camera, Image as ImageIcon, Trash2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { RA_LIST, normalizeRAName, generateNextHydrantCode } from '../utils/raList';
import { isValidDFCoordinate } from '../utils/geoUtils';
import { fixEncoding } from '../utils/textUtils';

const redPinIcon = L.divIcon({
  className: 'custom-red-marker-icon bg-transparent border-0',
  html: `
    <div style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; transform: translate(0, 0);">
      <svg viewBox="0 0 24 24" width="40" height="40" fill="#dc2626" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 4px 8px rgba(0,0,0,0.8));">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3.8" fill="#ffffff"></circle>
        <circle cx="12" cy="2" fill="#dc2626"></circle>
      </svg>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40]
});

const normalizeStr = (s) => {
  if (!s) return '';
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

const EditHydrantModal = ({ hidrante, onClose, onSave, currentUser, allHidrantes = [] }) => {
  const isNew = !hidrante._internalId && !hidrante.codHidrante && !hidrante.nomHidrante;
  const initialCode = fixEncoding(hidrante.nomHidrante || hidrante.codHidrante || '');
  const initialRA = normalizeRAName(hidrante.dscLocalidade) || '';
  
  // Lista de RAs rigorosamente em ordem alfabética
  const sortedRAList = useMemo(() => {
    return [...RA_LIST].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, []);

  const defaultRAObj = sortedRAList.find(r => r.name === initialRA) || sortedRAList[0];

  // Sanitização rigorosa das coordenadas iniciais
  let parsedLat = parseFloat(String(hidrante.numLatitude || '').replace(/,/g, '.'));
  let parsedLng = parseFloat(String(hidrante.numLongitude || '').replace(/,/g, '.'));

  // Se a longitude estiver positiva (ex: 47.88 ou 48.05), ajusta para negativa no DF
  if (!isNaN(parsedLng) && parsedLng > 0) {
    parsedLng = -parsedLng;
  }

  // Se as coordenadas forem inválidas ou fora do DF, utiliza o centro da RA correspondente
  if (isNaN(parsedLat) || isNaN(parsedLng) || !isValidDFCoordinate(parsedLat, parsedLng)) {
    parsedLat = defaultRAObj.lat;
    parsedLng = defaultRAObj.lng;
  }

  const [formData, setFormData] = useState({
    codHidrante: isNew ? '' : initialCode,
    dscLocalidade: initialRA,
    dscEndereco: fixEncoding(hidrante.dscEndereco || ''),
    dscPontoReferencia: fixEncoding(hidrante.dscPontoReferencia || ''),
    numLatitude: parsedLat.toFixed(6),
    numLongitude: parsedLng.toFixed(6),
    fotoPerfil: hidrante.fotoPerfil || ''
  });

  const [isLocatingGPS, setIsLocatingGPS] = useState(false);
  const [gpsObtained, setGpsObtained] = useState(false);
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);
  const [apiSuggestions, setApiSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [mapSuggestedAddress, setMapSuggestedAddress] = useState(null);

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const addressInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // 1. OBTENÇÃO AUTOMÁTICA DE LOCALIZAÇÃO DO USUÁRIO AO ABRIR TELA DE NOVO HIDRANTE
  const handleFetchCurrentGPS = (isInitialAuto = false) => {
    if ('geolocation' in navigator) {
      setIsLocatingGPS(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setIsLocatingGPS(false);
          if (pos && pos.coords) {
            const userLat = pos.coords.latitude;
            const userLng = pos.coords.longitude;
            
            if (isValidDFCoordinate(userLat, userLng)) {
              setGpsObtained(true);

              // Detecta a RA mais próxima caso nenhuma tenha sido escolhida
              let closestRA = null;
              let minDistance = Infinity;
              sortedRAList.forEach(ra => {
                const dist = Math.hypot(ra.lat - userLat, ra.lng - userLng);
                if (dist < minDistance) {
                  minDistance = dist;
                  closestRA = ra;
                }
              });

              setFormData(prev => {
                const nextRA = prev.dscLocalidade || (closestRA ? closestRA.name : '');
                const nextCode = prev.codHidrante || (isNew && nextRA ? generateNextHydrantCode(nextRA, allHidrantes) : prev.codHidrante);
                return {
                  ...prev,
                  dscLocalidade: nextRA,
                  codHidrante: nextCode,
                  numLatitude: userLat.toFixed(6),
                  numLongitude: userLng.toFixed(6)
                };
              });

              // Sugere endereço por proximidade da coordenada obtida
              findNearestAddressSuggestion(userLat, userLng);
            }
          }
        },
        (err) => {
          setIsLocatingGPS(false);
          if (!isInitialAuto) {
            console.warn('GPS não obtido:', err);
          }
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
      );
    }
  };

  useEffect(() => {
    if (isNew) {
      handleFetchCurrentGPS(true);
    }
  }, [isNew]);

  // 2. SUGESTÕES INTELIGENTES DE ENDEREÇO (ESTILO IFOOD)
  // Busca em tempo real na base de hidrantes + OpenStreetMap Nominatim
  const localAddressSuggestions = useMemo(() => {
    const text = normalizeStr(formData.dscEndereco);
    if (!text || text.length < 2) return [];

    const currentRA = normalizeStr(formData.dscLocalidade);
    const seen = new Set();
    const suggestions = [];

    // Prioriza hidrantes da mesma RA, depois DF completo
    allHidrantes.forEach(h => {
      const addr = fixEncoding(h.dscEndereco || '').trim();
      const ref = fixEncoding(h.dscPontoReferencia || '').trim();
      const ra = normalizeRAName(h.dscLocalidade);
      if (!addr) return;

      const normAddr = normalizeStr(addr);
      const normRef = normalizeStr(ref);

      if (normAddr.includes(text) || normRef.includes(text)) {
        const key = `${normAddr}|${normalizeStr(ra)}`;
        if (!seen.has(key)) {
          seen.add(key);
          suggestions.push({
            type: 'local',
            address: addr,
            reference: ref,
            ra: ra,
            lat: h.numLatitude,
            lng: h.numLongitude
          });
        }
      }
    });

    // Ordena colocando a RA selecionada primeiro
    return suggestions.sort((a, b) => {
      if (currentRA) {
        if (normalizeStr(a.ra) === currentRA && normalizeStr(b.ra) !== currentRA) return -1;
        if (normalizeStr(b.ra) === currentRA && normalizeStr(a.ra) !== currentRA) return 1;
      }
      return a.address.localeCompare(b.address, 'pt-BR');
    }).slice(0, 8);
  }, [formData.dscEndereco, formData.dscLocalidade, allHidrantes]);

  // Consulta API de Geocoding com debounce quando usuário digita
  useEffect(() => {
    if (!formData.dscEndereco || formData.dscEndereco.length < 3) {
      setApiSuggestions([]);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setIsLoadingSuggestions(true);
        const query = `${formData.dscEndereco}, ${formData.dscLocalidade || 'Distrito Federal'}, DF, Brasil`;
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=4&countrycodes=br&viewbox=-48.3,-16.1,-47.3,-15.5&bounded=1`,
          { headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' } }
        );
        if (res.ok) {
          const data = await res.json();
          const parsed = data.map(item => ({
            type: 'osm',
            address: item.display_name.split(',')[0],
            fullTitle: item.display_name,
            ra: item.address?.city_district || item.address?.suburb || item.address?.city || '',
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon)
          }));
          setApiSuggestions(parsed);
        }
      } catch (e) {
        // Silencioso em caso de falha de rede
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 400);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [formData.dscEndereco, formData.dscLocalidade]);

  // Busca sugestão de endereço mais próximo com base em coordenadas do mapa
  const findNearestAddressSuggestion = (lat, lng) => {
    if (!lat || !lng || !allHidrantes.length) return;
    let closest = null;
    let minDist = Infinity;

    allHidrantes.forEach(h => {
      if (h.numLatitude && h.numLongitude && h.dscEndereco) {
        const d = Math.hypot(h.numLatitude - lat, h.numLongitude - lng);
        if (d < minDist) {
          minDist = d;
          closest = h;
        }
      }
    });

    if (closest && minDist < 0.005) { // ~500 metros
      setMapSuggestedAddress({
        address: fixEncoding(closest.dscEndereco),
        reference: fixEncoding(closest.dscPontoReferencia),
        ra: normalizeRAName(closest.dscLocalidade)
      });
    } else {
      setMapSuggestedAddress(null);
    }
  };

  const handleSelectSuggestion = (sug) => {
    const nextRA = sug.ra ? normalizeRAName(sug.ra) : formData.dscLocalidade;
    const nextCode = (isNew && nextRA && !formData.codHidrante) 
      ? generateNextHydrantCode(nextRA, allHidrantes) 
      : formData.codHidrante;

    setFormData(prev => ({
      ...prev,
      dscEndereco: sug.address,
      dscPontoReferencia: sug.reference ? sug.reference : prev.dscPontoReferencia,
      dscLocalidade: nextRA || prev.dscLocalidade,
      codHidrante: nextCode || prev.codHidrante,
      numLatitude: sug.lat ? Number(sug.lat).toFixed(6) : prev.numLatitude,
      numLongitude: sug.lng ? Number(sug.lng).toFixed(6) : prev.numLongitude
    }));

    setShowAddressDropdown(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'dscEndereco') {
      setShowAddressDropdown(true);
    }
  };

  const handleCoordinateBlur = (name) => {
    setFormData(prev => {
      let valStr = String(prev[name] || '').trim().replace(/,/g, '.');
      let num = parseFloat(valStr);
      if (isNaN(num)) return prev;

      // Para longitude no Brasil/DF, deve ser sempre negativa
      if (name === 'numLongitude' && num > 0) {
        num = -num;
      }

      return {
        ...prev,
        [name]: num.toFixed(6)
      };
    });
  };

  const handleRAChange = (e) => {
    const raName = e.target.value;
    const ra = sortedRAList.find(r => r.name === raName);
    
    let nextCode = formData.codHidrante;
    if (isNew && raName) {
      nextCode = generateNextHydrantCode(raName, allHidrantes);
    }

    setFormData(prev => ({
      ...prev,
      dscLocalidade: raName,
      codHidrante: isNew ? nextCode : prev.codHidrante,
      numLatitude: ra ? ra.lat.toFixed(6) : prev.numLatitude,
      numLongitude: ra ? ra.lng.toFixed(6) : prev.numLongitude
    }));

    if (ra) {
      findNearestAddressSuggestion(ra.lat, ra.lng);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scaleSize = MAX_WIDTH / img.width;
        
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        setFormData(prev => ({ ...prev, fotoPerfil: dataUrl }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const [showConfirmSave, setShowConfirmSave] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isNew && !formData.dscLocalidade) {
      alert("Por favor, selecione a Região Administrativa (RA).");
      return;
    }
    if (isNew && (!formData.dscEndereco || !formData.dscEndereco.trim())) {
      alert("Por favor, preencha o campo Endereço para cadastrar o novo hidrante.");
      return;
    }
    if (isNew && (!formData.dscPontoReferencia || !formData.dscPontoReferencia.trim())) {
      alert("Por favor, preencha o campo Ponto de Referência para cadastrar o novo hidrante.");
      return;
    }
    if (isNew && !formData.codHidrante) {
      const generated = generateNextHydrantCode(formData.dscLocalidade, allHidrantes);
      formData.codHidrante = generated;
    }

    let lat = parseFloat(String(formData.numLatitude).replace(/,/g, '.'));
    let lng = parseFloat(String(formData.numLongitude).replace(/,/g, '.'));

    if (isNaN(lat) || isNaN(lng)) {
      alert("Por favor, informe coordenadas geográficas válidas.");
      return;
    }

    setShowConfirmSave(true);
  };

  const executeSave = () => {
    let lat = parseFloat(String(formData.numLatitude).replace(/,/g, '.'));
    let lng = parseFloat(String(formData.numLongitude).replace(/,/g, '.'));
    if (lng > 0) lng = -lng;

    onSave({
      ...hidrante,
      ...formData,
      nomHidrante: formData.codHidrante || hidrante.nomHidrante,
      codHidrante: formData.codHidrante || hidrante.codHidrante,
      dscLocalidade: normalizeRAName(formData.dscLocalidade),
      numLatitude: parseFloat(lat.toFixed(6)),
      numLongitude: parseFloat(lng.toFixed(6))
    });
    setShowConfirmSave(false);
  };

  const currentNumericLat = parseFloat(String(formData.numLatitude).replace(/,/g, '.'));
  const currentNumericLng = parseFloat(String(formData.numLongitude).replace(/,/g, '.'));

  const validLat = !isNaN(currentNumericLat) ? currentNumericLat : defaultRAObj.lat;
  const validLng = !isNaN(currentNumericLng) ? (currentNumericLng > 0 ? -currentNumericLng : currentNumericLng) : defaultRAObj.lng;

  const LocationMarker = () => {
    const map = useMapEvents({
      click(e) {
        setFormData(prev => ({
          ...prev,
          numLatitude: e.latlng.lat.toFixed(6),
          numLongitude: e.latlng.lng.toFixed(6)
        }));
        findNearestAddressSuggestion(e.latlng.lat, e.latlng.lng);
      },
    });

    useEffect(() => {
      if (!isNaN(validLat) && !isNaN(validLng)) {
        map.flyTo([validLat, validLng], map.getZoom() < 13 ? 16 : map.getZoom());
      }
    }, [validLat, validLng, map]);

    return !isNaN(validLat) && !isNaN(validLng) ? (
      <Marker position={[validLat, validLng]} icon={redPinIcon} />
    ) : null;
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-800 w-full max-w-3xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden border-0 sm:border border-slate-600 h-[100dvh] sm:h-auto sm:max-h-[90dvh]">
        
        <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-900">
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={onClose} 
              className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded font-semibold transition-colors"
            >
              ← Voltar
            </button>
            <h2 className="text-xl font-bold text-amber-400">
              {isNew ? 'Cadastrar Novo Hidrante' : `Editar Hidrante: ${formData.codHidrante || initialCode}`}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-red-400 transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          
          <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4">
              
              <div className="w-full md:w-1/2 flex flex-col gap-3">
                
                {/* Foto de Perfil */}
                <div className="flex items-center gap-3 bg-slate-900/50 p-2.5 rounded-lg border border-slate-700">
                  <div className="w-16 h-20 bg-slate-800 border border-slate-600 rounded-lg flex items-center justify-center overflow-hidden shrink-0 relative">
                    {formData.fotoPerfil ? (
                      <img src={formData.fotoPerfil} alt="Perfil" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-slate-500 text-center px-1">Sem Foto</span>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button 
                        type="button" 
                        onClick={() => cameraInputRef.current?.click()}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-700/80 hover:bg-emerald-600 text-white text-xs font-bold rounded-md transition-colors active:scale-95 shadow-sm"
                        title="Tirar foto com a câmera"
                      >
                        <Camera size={13} />
                        <span>Câmera</span>
                      </button>
                      <button 
                        type="button" 
                        onClick={() => galleryInputRef.current?.click()}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-md transition-colors active:scale-95 shadow-sm"
                        title="Escolher foto da galeria"
                      >
                        <ImageIcon size={13} className="text-cyan-400" />
                        <span>Galeria</span>
                      </button>
                      {formData.fotoPerfil && (
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, fotoPerfil: '' }))}
                          className="p-1.5 bg-red-900/60 hover:bg-red-800 text-red-300 rounded-md transition-colors active:scale-95"
                          title="Remover foto"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400">Foto vertical de perfil do hidrante</span>
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment"
                    className="hidden" 
                    ref={cameraInputRef}
                    onChange={handleImageUpload}
                  />
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={galleryInputRef}
                    onChange={handleImageUpload}
                  />
                </div>

                {/* Região Administrativa (RA) em Ordem Alfabética */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs text-slate-400 font-bold uppercase">
                      Região Administrativa (RA) {isNew && <span className="text-red-400">*</span>}
                    </label>
                    <span className="text-[10px] text-slate-400 font-semibold">Ordem Alfabética</span>
                  </div>
                  <select 
                    name="dscLocalidade" 
                    value={formData.dscLocalidade} 
                    onChange={handleRAChange} 
                    required={isNew}
                    className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Selecione uma RA...</option>
                    {sortedRAList.map(ra => (
                      <option key={ra.name} value={ra.name}>{ra.name}</option>
                    ))}
                  </select>
                </div>

                {/* Código do Hidrante (Sequencial Automático para Novo) */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs text-slate-400 font-bold uppercase">Código do Hidrante</label>
                    {isNew && (
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
                        Preenchimento Automático
                      </span>
                    )}
                  </div>
                  <input 
                    name="codHidrante" 
                    value={formData.codHidrante} 
                    readOnly
                    placeholder={isNew ? "Gerado automaticamente ao escolher a RA..." : ""}
                    className="border border-slate-700 rounded p-2 text-sm font-mono bg-slate-900/70 text-emerald-400 font-bold cursor-not-allowed" 
                  />
                </div>

                {/* Endereço com Sugestões Inteligentes (estilo iFood) */}
                <div className="flex flex-col gap-1 relative" ref={addressInputRef}>
                  <div className="flex justify-between items-center">
                    <label className="text-xs text-slate-400 font-bold uppercase flex items-center gap-1">
                      Endereço {isNew && <span className="text-red-400">*</span>}
                    </label>
                    <span className="text-[10px] text-amber-400 flex items-center gap-1 font-semibold">
                      <Sparkles size={11} />
                      Sugestões ao digitar
                    </span>
                  </div>
                  <div className="relative">
                    <input 
                      name="dscEndereco" 
                      value={formData.dscEndereco} 
                      onChange={handleChange} 
                      onFocus={() => setShowAddressDropdown(true)}
                      required={isNew}
                      placeholder="Ex: Quadra 02 Conjunto A Lote 15, Av. Central..."
                      autoComplete="off"
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 pr-8 text-sm text-white focus:outline-none focus:border-amber-500" 
                    />
                    {isLoadingSuggestions && (
                      <Loader2 size={15} className="absolute right-2.5 top-3 text-amber-400 animate-spin" />
                    )}
                  </div>

                  {/* Chip de Endereço Sugerido a partir do Pino do Mapa */}
                  {mapSuggestedAddress && mapSuggestedAddress.address !== formData.dscEndereco && (
                    <div 
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          dscEndereco: mapSuggestedAddress.address,
                          dscPontoReferencia: mapSuggestedAddress.reference || prev.dscPontoReferencia,
                          dscLocalidade: mapSuggestedAddress.ra || prev.dscLocalidade
                        }));
                      }}
                      className="mt-1 p-1.5 bg-amber-950/40 border border-amber-500/40 rounded-lg text-xs text-amber-300 flex items-center justify-between cursor-pointer hover:bg-amber-900/50 transition-all"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin size={13} className="text-amber-400 shrink-0" />
                        <span className="truncate"><strong>Ponto no mapa:</strong> {mapSuggestedAddress.address}</span>
                      </div>
                      <span className="text-[10px] font-bold text-amber-400 underline shrink-0 ml-2">Usar este</span>
                    </div>
                  )}

                  {/* Dropdown de Sugestões de Endereço (iFood Style) */}
                  {showAddressDropdown && (localAddressSuggestions.length > 0 || apiSuggestions.length > 0) && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[300] max-h-56 overflow-y-auto divide-y divide-slate-800">
                      <div className="p-1.5 bg-slate-850 text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
                        <span>Sugestões de Endereço</span>
                        <button 
                          type="button" 
                          onClick={() => setShowAddressDropdown(false)}
                          className="text-slate-400 hover:text-white"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Sugestões da Base de Dados de Hidrantes */}
                      {localAddressSuggestions.map((sug, idx) => (
                        <div
                          key={`loc_${idx}`}
                          onClick={() => handleSelectSuggestion(sug)}
                          className="p-2.5 hover:bg-slate-800 cursor-pointer transition-colors flex items-start gap-2 text-left"
                        >
                          <MapPin size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-white truncate">{sug.address}</div>
                            {sug.reference && (
                              <div className="text-[10px] text-slate-400 truncate">Ref: {sug.reference}</div>
                            )}
                            <div className="text-[10px] text-emerald-400 font-semibold">
                              {sug.ra || 'Distrito Federal'} • Base Netuno
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Sugestões OSM / Mapa */}
                      {apiSuggestions.map((sug, idx) => (
                        <div
                          key={`osm_${idx}`}
                          onClick={() => handleSelectSuggestion(sug)}
                          className="p-2.5 hover:bg-slate-800 cursor-pointer transition-colors flex items-start gap-2 text-left"
                        >
                          <Navigation size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-white truncate">{sug.address}</div>
                            <div className="text-[10px] text-slate-400 truncate">{sug.fullTitle}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ponto de Referência */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 font-bold uppercase">
                    Ponto de Referência {isNew && <span className="text-red-400">*</span>}
                  </label>
                  <input 
                    name="dscPontoReferencia" 
                    value={formData.dscPontoReferencia} 
                    onChange={handleChange} 
                    required={isNew}
                    placeholder="Ex: Em frente à farmácia / esquina / portaria"
                    className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-amber-500" 
                  />
                </div>
                
                {/* Coordenadas */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-400 font-bold uppercase">Latitude (Lat)</label>
                    <input 
                      type="text" 
                      name="numLatitude" 
                      value={formData.numLatitude} 
                      onChange={handleChange} 
                      onBlur={() => handleCoordinateBlur('numLatitude')}
                      placeholder="-15.820000"
                      className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white font-mono focus:border-amber-500 outline-none" 
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-400 font-bold uppercase">Longitude (Lng)</label>
                    <input 
                      type="text" 
                      name="numLongitude" 
                      value={formData.numLongitude} 
                      onChange={handleChange} 
                      onBlur={() => handleCoordinateBlur('numLongitude')}
                      placeholder="-47.980000"
                      className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white font-mono focus:border-amber-500 outline-none" 
                    />
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 italic">
                  Dica: Clique no mapa de satélite para reposicionar o pino vermelho nas coordenadas exatas.
                </span>
              </div>

              {/* Container do Mapa com Satélite e Botão de Localização GPS */}
              <div className="w-full md:w-1/2 min-h-[260px] h-[280px] md:h-auto md:min-h-[380px] border border-slate-600 rounded-lg overflow-hidden relative shadow-inner z-0">
                 
                 {/* Botão de Localização GPS do Usuário */}
                 <div className="absolute top-3 right-3 z-[1000] flex flex-col items-end gap-1">
                   <button
                     type="button"
                     onClick={() => handleFetchCurrentGPS(false)}
                     disabled={isLocatingGPS}
                     className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-xl border backdrop-blur-md flex items-center gap-1.5 transition-all active:scale-95 ${
                       isLocatingGPS
                         ? 'bg-slate-900/90 text-amber-300 border-amber-500/50 cursor-wait'
                         : (gpsObtained
                             ? 'bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 border-emerald-500 shadow-emerald-950/50'
                             : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-600')
                     }`}
                     title="Centralizar e mover o pino para a sua localização atual via GPS"
                   >
                     {isLocatingGPS ? (
                       <Loader2 size={14} className="animate-spin text-amber-400" />
                     ) : (
                       <LocateFixed size={14} className={gpsObtained ? 'text-emerald-400' : 'text-slate-300'} />
                     )}
                     <span>{isLocatingGPS ? 'Obtendo GPS...' : (gpsObtained ? 'GPS Localizado' : 'Minha Localização')}</span>
                   </button>
                 </div>

                 <MapContainer 
                   center={[validLat, validLng]} 
                   zoom={16} 
                   scrollWheelZoom={true}
                   style={{ height: '100%', width: '100%' }}
                 >
                    {/* Camada Google Satélite Híbrido idêntica à tela principal */}
                    <TileLayer
                      attribution='&copy; Google Maps'
                      url="https://mt0.google.com/vt/lyrs=y&hl=pt-BR&x={x}&y={y}&z={z}"
                      maxZoom={20}
                    />
                    <LocationMarker />
                 </MapContainer>
              </div>
            </div>
          </div>

          {/* Footer Fixo sempre visível e nunca sobreposto */}
          <div className="p-4 bg-slate-900 border-t border-slate-700 flex gap-3 shrink-0 z-30">
            <button 
              type="button" 
              onClick={onClose} 
              className="w-1/2 py-2.5 bg-slate-700 text-slate-300 font-bold rounded-lg hover:bg-slate-600 transition-colors active:scale-95 text-sm"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="w-1/2 py-2.5 bg-amber-600 text-white font-bold rounded-lg shadow-lg shadow-amber-900/50 hover:bg-amber-500 transition-colors flex items-center justify-center gap-2 active:scale-95 text-sm"
            >
              <Save size={18} />
              Salvar Alterações
            </button>
          </div>
        </form>

        {/* Modal de Confirmação: Salvar ou Descartar */}
        {showConfirmSave && (
          <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-amber-500/50 rounded-2xl p-5 max-w-md w-full shadow-2xl flex flex-col gap-4 animate-scaleUp">
              <div className="flex items-center gap-2.5 text-amber-400 border-b border-slate-800 pb-3">
                <Save size={22} />
                <h3 className="text-base font-bold text-white">Salvar Alterações do Hidrante</h3>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                Deseja <strong className="text-white">salvar</strong> ou <strong className="text-white">descartar</strong> as alterações cadastrais deste hidrante ({formData.codHidrante || 'Novo Hidrante'})?
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-end mt-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-red-950/60 text-red-400 hover:text-red-300 font-semibold rounded-lg text-xs transition-colors border border-slate-700 hover:border-red-850"
                >
                  Descartar Alterações
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmSave(false)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs transition-colors border border-slate-700"
                >
                  Continuar Editando
                </button>
                <button
                  type="button"
                  onClick={executeSave}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs transition-colors shadow-lg shadow-amber-900/50 flex items-center justify-center gap-1.5"
                >
                  <Save size={14} /> Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default EditHydrantModal;
