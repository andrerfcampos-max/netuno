import React, { useState, useRef, useEffect } from 'react';
import { X, ImagePlus, Save, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { RA_LIST, normalizeRAName, generateNextHydrantCode } from '../utils/raList';
import { isValidDFCoordinate } from '../utils/geoUtils';
import { fixEncoding } from '../utils/textUtils';

const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const EditHydrantModal = ({ hidrante, onClose, onSave, currentUser, allHidrantes = [] }) => {
  const isNew = !hidrante._internalId && !hidrante.codHidrante && !hidrante.nomHidrante;
  const initialCode = fixEncoding(hidrante.nomHidrante || hidrante.codHidrante || '');
  const initialRA = normalizeRAName(hidrante.dscLocalidade) || '';
  
  const defaultRAObj = RA_LIST.find(r => r.name === initialRA) || RA_LIST[0];

  // Sanitização rigorosa das coordenadas iniciais
  let parsedLat = parseFloat(String(hidrante.numLatitude || '').replace(',', '.'));
  let parsedLng = parseFloat(String(hidrante.numLongitude || '').replace(',', '.'));

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

  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCoordinateBlur = (name) => {
    setFormData(prev => {
      let valStr = String(prev[name] || '').trim().replace(',', '.');
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
    const ra = RA_LIST.find(r => r.name === raName);
    
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

    let lat = parseFloat(String(formData.numLatitude).replace(',', '.'));
    let lng = parseFloat(String(formData.numLongitude).replace(',', '.'));

    if (isNaN(lat) || isNaN(lng)) {
      alert("Por favor, informe coordenadas geográficas válidas.");
      return;
    }

    setShowConfirmSave(true);
  };

  const executeSave = () => {
    let lat = parseFloat(String(formData.numLatitude).replace(',', '.'));
    let lng = parseFloat(String(formData.numLongitude).replace(',', '.'));
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

  const currentNumericLat = parseFloat(String(formData.numLatitude).replace(',', '.'));
  const currentNumericLng = parseFloat(String(formData.numLongitude).replace(',', '.'));

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
      },
    });

    useEffect(() => {
      if (!isNaN(validLat) && !isNaN(validLng)) {
        map.flyTo([validLat, validLng], map.getZoom() < 13 ? 15 : map.getZoom());
      }
    }, [validLat, validLng, map]);

    return !isNaN(validLat) && !isNaN(validLng) ? (
      <Marker position={[validLat, validLng]} icon={customIcon} />
    ) : null;
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 w-full max-w-3xl rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-600">
        
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

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4 overflow-y-auto max-h-[80vh]">
          
          <div className="flex flex-col md:flex-row gap-4">
            
            <div className="w-full md:w-1/2 flex flex-col gap-3">
              
              {/* Foto de Perfil */}
              <div className="flex items-center gap-3 bg-slate-900/50 p-2 rounded border border-slate-700">
                <div className="w-16 h-20 bg-slate-800 border border-slate-600 rounded flex items-center justify-center overflow-hidden shrink-0">
                  {formData.fotoPerfil ? (
                    <img src={formData.fotoPerfil} alt="Perfil" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-slate-500 text-center px-1">Sem Foto</span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded transition-colors"
                  >
                    <ImagePlus size={14} />
                    {formData.fotoPerfil ? 'Alterar Foto' : 'Adicionar Foto'}
                  </button>
                  <span className="text-[10px] text-slate-400">Foto vertical de perfil</span>
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 font-bold uppercase">
                  Região Administrativa (RA) {isNew && <span className="text-red-400">*</span>}
                </label>
                <select 
                  name="dscLocalidade" 
                  value={formData.dscLocalidade} 
                  onChange={handleRAChange} 
                  required={isNew}
                  className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">Selecione uma RA...</option>
                  {RA_LIST.map(ra => (
                    <option key={ra.name} value={ra.name}>{ra.name}</option>
                  ))}
                </select>
              </div>

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

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 font-bold uppercase">
                  Endereço {isNew && <span className="text-red-400">*</span>}
                </label>
                <input 
                  name="dscEndereco" 
                  value={formData.dscEndereco} 
                  onChange={handleChange} 
                  required={isNew}
                  placeholder="Ex: Quadra 02 Conjunto A Lote 15"
                  className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-amber-500" 
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 font-bold uppercase">
                  Ponto de Referência {isNew && <span className="text-red-400">*</span>}
                </label>
                <input 
                  name="dscPontoReferencia" 
                  value={formData.dscPontoReferencia} 
                  onChange={handleChange} 
                  required={isNew}
                  placeholder="Ex: Em frente à farmácia / esquina"
                  className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-amber-500" 
                />
              </div>
              
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
                Dica: Clique no mapa de satélite para reposicionar as coordenadas automaticamente.
              </span>
            </div>

            <div className="w-full md:w-1/2 h-[320px] md:h-auto border border-slate-600 rounded-lg overflow-hidden relative shadow-inner">
               <MapContainer 
                 center={[validLat, validLng]} 
                 zoom={15} 
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

          <div className="flex gap-3 mt-2">
            <button 
              type="button" 
              onClick={onClose} 
              className="w-1/2 py-2 bg-slate-700 text-slate-300 font-bold rounded hover:bg-slate-600 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="w-1/2 py-2 bg-amber-600 text-white font-bold rounded shadow-lg shadow-amber-900/50 hover:bg-amber-500 transition-colors flex items-center justify-center gap-2"
            >
              <Save size={18} />
              Salvar Alterações
            </button>
          </div>
        </form>

        {/* Modal de Confirmação: Salvar ou Descartar */}
        {showConfirmSave && (
          <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
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
