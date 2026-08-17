import React, { useState, useRef, useEffect } from 'react';
import { X, ImagePlus, Save } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const RA_LIST = [
  { name: 'Plano Piloto', lat: -15.793, lng: -47.882 },
  { name: 'Gama', lat: -16.015, lng: -48.065 },
  { name: 'Taguatinga', lat: -15.833, lng: -48.056 },
  { name: 'Brazlândia', lat: -15.670, lng: -48.198 },
  { name: 'Sobradinho', lat: -15.651, lng: -47.794 },
  { name: 'Planaltina', lat: -15.617, lng: -47.653 },
  { name: 'Paranoá', lat: -15.768, lng: -47.771 },
  { name: 'Núcleo Bandeirante', lat: -15.873, lng: -47.962 },
  { name: 'Ceilândia', lat: -15.823, lng: -48.113 },
  { name: 'Guará', lat: -15.820, lng: -47.983 },
  { name: 'Cruzeiro', lat: -15.791, lng: -47.936 },
  { name: 'Samambaia', lat: -15.875, lng: -48.083 },
  { name: 'Santa Maria', lat: -16.019, lng: -47.987 },
  { name: 'São Sebastião', lat: -15.908, lng: -47.769 },
  { name: 'Recanto das Emas', lat: -15.903, lng: -48.064 },
  { name: 'Lago Sul', lat: -15.845, lng: -47.848 },
  { name: 'Riacho Fundo', lat: -15.882, lng: -48.016 },
  { name: 'Lago Norte', lat: -15.733, lng: -47.854 },
  { name: 'Candangolândia', lat: -15.850, lng: -47.947 },
  { name: 'Águas Claras', lat: -15.836, lng: -48.026 },
  { name: 'Riacho Fundo II', lat: -15.903, lng: -48.037 },
  { name: 'Sudoeste/Octogonal', lat: -15.801, lng: -47.923 },
  { name: 'Varjão', lat: -15.708, lng: -47.882 },
  { name: 'Park Way', lat: -15.874, lng: -47.962 },
  { name: 'SCIA/Estrutural', lat: -15.779, lng: -47.994 },
  { name: 'Sobradinho II', lat: -15.626, lng: -47.817 },
  { name: 'Jardim Botânico', lat: -15.877, lng: -47.781 },
  { name: 'Itapoã', lat: -15.738, lng: -47.766 },
  { name: 'SIA', lat: -15.803, lng: -47.957 },
  { name: 'Vicente Pires', lat: -15.802, lng: -48.028 },
  { name: 'Fercal', lat: -15.589, lng: -47.869 },
  { name: 'Sol Nascente/Pôr do Sol', lat: -15.811, lng: -48.140 },
  { name: 'Arniqueira', lat: -15.852, lng: -48.015 }
];

const generateNextHydrantCode = (raName, allHidrantes = []) => {
  if (!raName) return '';
  
  // Localizar hidrantes existentes nesta RA
  const raHidrantes = allHidrantes.filter(h => 
    h.dscLocalidade && h.dscLocalidade.trim().toLowerCase() === raName.trim().toLowerCase()
  );
  
  let prefix = '';
  let maxNum = 0;
  let numDigits = 5;
  
  if (raHidrantes.length > 0) {
    for (const h of raHidrantes) {
      const code = (h.codHidrante || h.nomHidrante || '').trim();
      const match = code.match(/^([A-Za-z]+)(\d+)$/);
      if (match) {
        if (!prefix) prefix = match[1].toUpperCase();
        const num = parseInt(match[2], 10);
        if (num > maxNum) {
          maxNum = num;
          numDigits = match[2].length;
        }
      }
    }
  }
  
  if (!prefix) {
    const prefixMap = {
      'Plano Piloto': 'PLA',
      'Gama': 'GAM',
      'Taguatinga': 'TAG',
      'Brazlândia': 'BRA',
      'Sobradinho': 'SOB',
      'Planaltina': 'PLN',
      'Paranoá': 'PAR',
      'Núcleo Bandeirante': 'NUB',
      'Ceilândia': 'CEI',
      'Guará': 'GUA',
      'Cruzeiro': 'CRU',
      'Samambaia': 'SAM',
      'Santa Maria': 'SMA',
      'São Sebastião': 'SSB',
      'Recanto das Emas': 'REC',
      'Lago Sul': 'LGS',
      'Riacho Fundo': 'RIA',
      'Lago Norte': 'LGN',
      'Candangolândia': 'CAN',
      'Águas Claras': 'ACL',
      'Riacho Fundo II': 'RF2',
      'Sudoeste/Octogonal': 'SUD',
      'Varjão': 'VAR',
      'Park Way': 'PKW',
      'SCIA/Estrutural': 'STR',
      'Sobradinho II': 'SB2',
      'Jardim Botânico': 'JDB',
      'Itapoã': 'ITP',
      'SIA': 'SIA',
      'Vicente Pires': 'VCP',
      'Fercal': 'FRC',
      'Sol Nascente/Pôr do Sol': 'SNP',
      'Arniqueira': 'ARN'
    };
    prefix = prefixMap[raName] || raName.substring(0, 3).toUpperCase();
  }
  
  const nextNum = maxNum + 1;
  const formattedNum = String(nextNum).padStart(Math.max(numDigits, 3), '0');
  return `${prefix}${formattedNum}`;
};

const EditHydrantModal = ({ hidrante, onClose, onSave, currentUser, allHidrantes = [] }) => {
  const isNew = !hidrante._internalId && !hidrante.codHidrante;
  
  const [formData, setFormData] = useState({
    codHidrante: hidrante.codHidrante || '',
    dscLocalidade: hidrante.dscLocalidade || '',
    dscEndereco: hidrante.dscEndereco || '',
    dscPontoReferencia: hidrante.dscPontoReferencia || '',
    numLatitude: hidrante.numLatitude || (isNew ? -15.793 : -15.793),
    numLongitude: hidrante.numLongitude || (isNew ? -47.882 : -47.882),
    fotoPerfil: hidrante.fotoPerfil || ''
  });

  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
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
      numLatitude: ra ? ra.lat : prev.numLatitude,
      numLongitude: ra ? ra.lng : prev.numLongitude
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isNew && !formData.dscLocalidade) {
      alert("Por favor, selecione a Região Administrativa (RA).");
      return;
    }
    if (isNew && !formData.codHidrante) {
      const generated = generateNextHydrantCode(formData.dscLocalidade, allHidrantes);
      formData.codHidrante = generated;
    }
    onSave({
      ...hidrante,
      ...formData,
      nomHidrante: hidrante.nomHidrante || formData.codHidrante,
      numLatitude: parseFloat(formData.numLatitude),
      numLongitude: parseFloat(formData.numLongitude)
    });
  };

  const LocationMarker = () => {
    const map = useMapEvents({
      click(e) {
        setFormData(prev => ({
          ...prev,
          numLatitude: e.latlng.lat,
          numLongitude: e.latlng.lng
        }));
      },
    });

    useEffect(() => {
      if (formData.numLatitude && formData.numLongitude) {
        map.flyTo([formData.numLatitude, formData.numLongitude], map.getZoom() < 13 ? 15 : map.getZoom());
      }
    }, [formData.numLatitude, formData.numLongitude, map]);

    return formData.numLatitude && formData.numLongitude ? (
      <Marker position={[formData.numLatitude, formData.numLongitude]} icon={customIcon} />
    ) : null;
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-600">
        
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
              {isNew ? 'Criar Novo Hidrante' : 'Editar Cadastro de Hidrante'}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-red-400 transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4 overflow-y-auto max-h-[85vh]">
          
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex flex-col gap-4 w-full md:w-1/2">
              <div className="flex flex-col items-center gap-3">
                <div className="w-32 h-32 rounded-lg border-2 border-dashed border-slate-600 bg-slate-700 flex items-center justify-center overflow-hidden relative group">
                  {formData.fotoPerfil ? (
                    <>
                      <img src={formData.fotoPerfil} alt="Perfil" className="w-full h-full object-cover" />
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity"
                      >
                        <ImagePlus className="text-white" size={32} />
                      </div>
                    </>
                  ) : (
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center text-slate-400 hover:text-emerald-400"
                    >
                      <ImagePlus size={32} />
                      <span className="text-xs mt-2 font-bold">Adicionar Foto</span>
                    </button>
                  )}
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
                <label className="text-xs text-slate-400 font-bold uppercase">Região Administrativa (RA)</label>
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
                <label className="text-xs text-slate-400 font-bold uppercase">Endereço</label>
                <input name="dscEndereco" value={formData.dscEndereco} onChange={handleChange} className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-amber-500" />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 font-bold uppercase">Ponto de Referência</label>
                <input name="dscPontoReferencia" value={formData.dscPontoReferencia} onChange={handleChange} className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-amber-500" />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 font-bold uppercase">Lat</label>
                  <input type="number" step="any" name="numLatitude" value={formData.numLatitude} onChange={handleChange} className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white font-mono" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 font-bold uppercase">Lng</label>
                  <input type="number" step="any" name="numLongitude" value={formData.numLongitude} onChange={handleChange} className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white font-mono" />
                </div>
              </div>
            </div>

            <div className="w-full md:w-1/2 h-[300px] md:h-auto border border-slate-600 rounded overflow-hidden">
               <MapContainer center={[formData.numLatitude || -15.793, formData.numLongitude || -47.882]} zoom={isNew && !formData.dscLocalidade ? 10 : 15} style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution="Tiles &copy; Esri"
                  />
                  <LocationMarker />
               </MapContainer>
            </div>
          </div>

          <div className="flex gap-3 mt-2">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded shadow active:scale-95 transition-all"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="flex-[2] flex items-center justify-center gap-2 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded shadow-lg active:scale-95 transition-transform"
            >
              <Save size={20} />
              {isNew ? 'SALVAR NOVO HIDRANTE' : 'SALVAR ALTERAÇÕES'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default EditHydrantModal;
