import React, { useState, useRef } from 'react';

// A MESMA LISTA ESTRITA DE 33 PROBLEMAS
const DEFEITOS_OFICIAIS = [
  "Caixa do hidrante obstruída com esgoto",
  "Hidrante sem água",
  "Hidrante removido ou não encontrado",
  "Hidrante cercado/bloqueado",
  "Falta tampão de 2.1/2\"",
  "Falta tampão de 4\"",
  "Tampa da caixa lacrada (concretada)",
  "Tampa de concreto quebrada ou removida",
  "Tampa metálica T19 quebrada ou removida",
  "Caixa de registro muito profunda",
  "Caixa de registro cheia de lixo",
  "Caixa de registro cheia d'água",
  "Caixa de registro quebrada",
  "Caixa de registro com enxame de abelhas",
  "Falta cabeçote da haste do registro (luva)",
  "Registro com vazamento",
  "Registro emperrado",
  "Faltam bujões e tampões",
  "Rosca de tampão danificado",
  "Carretel do registro danificado",
  "Hidrante com pouca pressão",
  "Hidrante quebrado no flange",
  "Registro concretado",
  "Faltam dois tampões de 2 1/2",
  "Registro danificado",
  "Caixa de concreto danificado",
  "Falta flange",
  "Registro não funciona",
  "Hidrante quebrado",
  "Hidrante soterrado",
  "Registro soterrado",
  "Hidrante empenado",
  "Vazamento no flange (operante)"
];

const InspectionModal = ({ hidrante, onClose, onSave, currentUser }) => {
  const [isOperante, setIsOperante] = useState(hidrante.flgAtivo);
  const [problema, setProblema] = useState(hidrante.problemasHidrante || '');
  const [fotoBase64, setFotoBase64] = useState(null);
  const fileInputRef = useRef(null);

  const handleImageCapture = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Comprime para JPEG qualidade 60%
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
        setFotoBase64(compressedBase64);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!isOperante && problema === '') {
      // Confirmação de segurança caso Inoperante sem problema
      if (!window.confirm("Atenção: Você está marcando como INOPERANTE sem selecionar o defeito. Tem certeza?")) {
        return;
      }
    }

    const agora = new Date();
    // Formato: DD/MM/YYYY, HH:MM:SS
    const dataFormatada = agora.toLocaleString('pt-BR');

    // Dados da vistoria
    const vistoriaAtualizada = {
      ...hidrante,
      flgAtivo: isOperante,
      problemasHidrante: problema,
      datHoraUltimaVistoria: dataFormatada,
      fotoVistoria: fotoBase64,
      vistoriadorNome: currentUser?.nome,
      vistoriadorMatricula: currentUser?.matricula,
      // O histórico de vistorias idealmente iria para o backend
      HISTORICO_VISTORIAS: [
        ...(hidrante.HISTORICO_VISTORIAS || []),
        {
          datHoraVistoria: dataFormatada,
          problemasHidrante: problema,
          flgAtivo: isOperante,
          fotoVistoria: fotoBase64,
          vistoriadorNome: currentUser?.nome,
          vistoriadorMatricula: currentUser?.matricula
        }
      ]
    };

    onSave(vistoriaAtualizada);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md border border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="bg-slate-900 p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">Cadastrar Vistoria</h2>
          <p className="text-sm text-slate-400">Hidrante: {hidrante.nomHidrante || hidrante.codHidrante}</p>
        </div>

        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          
          <div className="grid grid-cols-2 gap-2 text-sm text-slate-300 bg-slate-900/50 p-3 rounded">
            <div><strong className="text-slate-500">Lat:</strong> {hidrante.numLatitude}</div>
            <div><strong className="text-slate-500">Lng:</strong> {hidrante.numLongitude}</div>
            <div className="col-span-2"><strong className="text-slate-500">Data/Hora:</strong> {new Date().toLocaleString('pt-BR')} (Automático)</div>
            <div className="col-span-2 text-xs text-amber-400 font-bold border-t border-slate-700/50 pt-2 mt-1">
              Registro Auditável: {currentUser?.nome} (Mat. {currentUser?.matricula})
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-bold text-slate-300">Status Operacional</label>
            <div className="flex rounded overflow-hidden border border-slate-600 bg-slate-700 text-lg">
              <button 
                onClick={() => setIsOperante(true)}
                className={`flex-1 py-3 ${isOperante ? 'bg-emerald-600 text-white font-bold shadow-inner' : 'text-slate-300'}`}
              >
                OPERANTE
              </button>
              <button 
                onClick={() => setIsOperante(false)}
                className={`flex-1 py-3 ${!isOperante ? 'bg-red-600 text-white font-bold shadow-inner' : 'text-slate-300'}`}
              >
                INOPERANTE
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <label className="font-bold text-slate-300">Defeito Técnico Encontrado</label>
            <select 
              className="p-3 rounded bg-slate-700 border border-slate-600 text-white focus:outline-none focus:border-emerald-500 w-full"
              value={problema}
              onChange={(e) => setProblema(e.target.value)}
            >
              <option value="">Nenhum problema registrado</option>
              {DEFEITOS_OFICIAIS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <label className="font-bold text-slate-300">Anexo Fotográfico (Opcional)</label>
            {!fotoBase64 ? (
              <button
                onClick={() => fileInputRef.current.click()}
                className="p-3 rounded bg-slate-700 border border-slate-600 text-white font-bold hover:bg-slate-600 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                📸 Tirar Foto do Defeito
              </button>
            ) : (
              <div className="relative">
                <img src={fotoBase64} alt="Preview do Defeito" className="w-full h-48 object-cover rounded border border-slate-600" />
                <button
                  onClick={() => setFotoBase64(null)}
                  className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full font-bold text-xs shadow"
                >
                  Remover
                </button>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={fileInputRef}
              className="hidden"
              onChange={handleImageCapture}
            />
          </div>

        </div>

        <div className="p-4 bg-slate-900 border-t border-slate-700 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 rounded font-bold bg-slate-700 text-white hover:bg-slate-600 active:scale-95 transition-all"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            className="flex-[2] py-3 rounded font-bold bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95 transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)]"
          >
            Salvar Vistoria
          </button>
        </div>

      </div>
    </div>
  );
};

export default InspectionModal;
