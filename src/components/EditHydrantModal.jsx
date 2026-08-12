import React, { useState, useRef } from 'react';
import { X, ImagePlus, Save } from 'lucide-react';

const EditHydrantModal = ({ hidrante, onClose, onSave, currentUser }) => {
  const [formData, setFormData] = useState({
    nomHidrante: hidrante.nomHidrante || '',
    codHidrante: hidrante.codHidrante || '',
    dscEndereco: hidrante.dscEndereco || '',
    dscPontoReferencia: hidrante.dscPontoReferencia || '',
    numLatitude: hidrante.numLatitude || '',
    numLongitude: hidrante.numLongitude || '',
    fotoPerfil: hidrante.fotoPerfil || ''
  });

  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Compressão via Canvas (Max width 800px)
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scaleSize = MAX_WIDTH / img.width;
        
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Exporta para JPEG reduzindo a qualidade para economizar localStorage
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        setFormData(prev => ({ ...prev, fotoPerfil: dataUrl }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...hidrante,
      ...formData,
      numLatitude: parseFloat(formData.numLatitude),
      numLongitude: parseFloat(formData.numLongitude)
    });
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 w-full max-w-lg rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-600">
        
        <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-900">
          <h2 className="text-xl font-bold text-amber-400">Editar Cadastro de Hidrante</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-red-400 transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4 overflow-y-auto max-h-[80vh]">
          {/* Avatar/Foto */}
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

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400 font-bold uppercase">Nome do Hidrante</label>
              <input name="nomHidrante" value={formData.nomHidrante} onChange={handleChange} className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400 font-bold uppercase">Código do Hidrante</label>
              <input name="codHidrante" value={formData.codHidrante} onChange={handleChange} className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400 font-bold uppercase">Latitude</label>
              <input type="number" step="any" name="numLatitude" value={formData.numLatitude} onChange={handleChange} className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white font-mono" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400 font-bold uppercase">Longitude</label>
              <input type="number" step="any" name="numLongitude" value={formData.numLongitude} onChange={handleChange} className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white font-mono" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400 font-bold uppercase">Endereço</label>
            <input name="dscEndereco" value={formData.dscEndereco} onChange={handleChange} className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400 font-bold uppercase">Ponto de Referência</label>
            <input name="dscPontoReferencia" value={formData.dscPontoReferencia} onChange={handleChange} className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white" />
          </div>

          <button type="submit" className="mt-4 flex items-center justify-center gap-2 w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded shadow-lg active:scale-95 transition-transform">
            <Save size={20} />
            SALVAR ALTERAÇÕES
          </button>
        </form>

      </div>
    </div>
  );
};

export default EditHydrantModal;
