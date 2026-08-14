import React, { useState, useRef } from 'react';

const fixEncoding = (str) => {
  if (!str) return str;
  try {
    return decodeURIComponent(escape(str));
  } catch(e) {
    return str;
  }
};


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
  const [q1, setQ1] = useState(hidrante.flgAtivo ? 'SIM' : 'NÃO');
  const [q2, setQ2] = useState(null);
  const [q3, setQ3] = useState(null);
  const [q4, setQ4] = useState(null);
  const [q5, setQ5] = useState(null);
  const [q6, setQ6] = useState('');
  
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
        
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
        setFotoBase64(compressedBase64);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (q1 === null || q2 === null || q3 === null || q4 === null || q5 === null) {
      alert("Por favor, responda todas as perguntas obrigatórias (1 a 5).");
      return;
    }

    const isOperante = q1 === 'SIM';
    let problemas = [];
    
    if (q2 === 'NÃO') problemas.push("Faltam tampões");
    
    if (q3 === 'SOTERRADA') problemas.push("Hidrante soterrado");
    else if (q3 === 'TAMPA QUEBRADA') problemas.push("Caixa de registro quebrada");
    
    if (q4 === 'SOTERRADO') problemas.push("Registro soterrado");
    else if (q4 === 'COM VAZAMENTO') problemas.push("Registro com vazamento");
    else if (q4 === 'EMPERRADO') problemas.push("Registro emperrado");

    if (q5 === 'NÃO, FALTA LUVA') problemas.push("Falta cabeçote da haste do registro (luva)");

    if (q6) problemas.push(q6);

    const problemaFinal = problemas.join(" | ");

    let statusFinal = isOperante;
    if (q4 === 'SOTERRADO' || q4 === 'EMPERRADO') {
      statusFinal = false; // Força INOPERANTE
    }

    if (!statusFinal && problemas.length === 0) {
      if (!window.confirm("Atenção: Você está marcando como INOPERANTE sem defeitos listados. Tem certeza?")) {
        return;
      }
    }

    const agora = new Date();
    const dataFormatada = agora.toLocaleString('pt-BR');

    const vistoriaAtualizada = {
      ...hidrante,
      flgAtivo: statusFinal,
      problemasHidrante: problemaFinal,
      datHoraUltimaVistoria: dataFormatada,
      fotoVistoria: fotoBase64,
      vistoriadorNome: currentUser?.nome,
      vistoriadorMatricula: currentUser?.matricula,
      HISTORICO_VISTORIAS: [
        ...(hidrante.HISTORICO_VISTORIAS || []),
        {
          datHoraVistoria: dataFormatada,
          problemasHidrante: problemaFinal,
          flgAtivo: statusFinal,
          fotoVistoria: fotoBase64,
          vistoriadorNome: currentUser?.nome,
          vistoriadorMatricula: currentUser?.matricula
        }
      ]
    };

    onSave(vistoriaAtualizada);
  };

  const renderOption = (value, currentVal, setVal, isPositive) => {
    const isSelected = currentVal === value;
    const baseClass = "flex-1 py-2 font-bold text-sm rounded shadow-sm border transition-all active:scale-95";
    
    if (isSelected) {
      return (
        <button 
          onClick={() => setVal(value)}
          className={`${baseClass} ${isPositive ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-red-600 border-red-500 text-white'}`}
        >
          {value}
        </button>
      );
    }
    return (
      <button 
        onClick={() => setVal(value)}
        className={`${baseClass} bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600`}
      >
        {value}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md border border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="bg-slate-900 p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">Vistoria Rápida</h2>
          <p className="text-sm text-slate-400">Hidrante: {fixEncoding(hidrante.nomHidrante) || hidrante.codHidrante}</p>
        </div>

        <div className="p-4 flex flex-col gap-4 overflow-y-auto">
          
          {/* Pergunta 1 */}
          <div className="flex flex-col gap-2 bg-slate-900/40 p-3 rounded border border-slate-700/50">
            <label className="font-bold text-slate-300 text-sm">1) O HIDRANTE ESTÁ OPERANTE?</label>
            <div className="flex gap-2">
              {renderOption('SIM', q1, setQ1, true)}
              {renderOption('NÃO', q1, setQ1, false)}
            </div>
          </div>

          {/* Pergunta 2 */}
          <div className="flex flex-col gap-2 bg-slate-900/40 p-3 rounded border border-slate-700/50">
            <label className="font-bold text-slate-300 text-sm">2) TODOS OS TAMPÕES ESTÃO PRESENTES?</label>
            <div className="flex gap-2">
              {renderOption('SIM', q2, setQ2, true)}
              {renderOption('NÃO', q2, setQ2, false)}
            </div>
          </div>

          {/* Pergunta 3 */}
          <div className="flex flex-col gap-2 bg-slate-900/40 p-3 rounded border border-slate-700/50">
            <label className="font-bold text-slate-300 text-sm">3) A CAIXA DO REGISTRO ESTÁ...</label>
            <div className="flex gap-2">
              {renderOption('SEM ALTERAÇÃO', q3, setQ3, true)}
              {renderOption('SOTERRADA', q3, setQ3, false)}
              {renderOption('TAMPA QUEBRADA', q3, setQ3, false)}
            </div>
          </div>

          {/* Pergunta 4 */}
          <div className="flex flex-col gap-2 bg-slate-900/40 p-3 rounded border border-slate-700/50">
            <label className="font-bold text-slate-300 text-sm">4) O REGISTRO ESTÁ...</label>
            <div className="flex flex-wrap gap-2">
              {renderOption('SEM ALTERAÇÃO', q4, setQ4, true)}
              {renderOption('SOTERRADO', q4, setQ4, false)}
              {renderOption('COM VAZAMENTO', q4, setQ4, false)}
              {renderOption('EMPERRADO', q4, setQ4, false)}
            </div>
          </div>

          {/* Pergunta 5 */}
          <div className="flex flex-col gap-2 bg-slate-900/40 p-3 rounded border border-slate-700/50">
            <label className="font-bold text-slate-300 text-sm">5) A CHAVE TIPO T ENCAIXA NO REGISTRO?</label>
            <div className="flex gap-2">
              {renderOption('SIM', q5, setQ5, true)}
              {renderOption('NÃO, FALTA LUVA', q5, setQ5, false)}
            </div>
          </div>

          {/* Pergunta 6 */}
          <div className="flex flex-col gap-2 bg-slate-900/40 p-3 rounded border border-slate-700/50">
            <label className="font-bold text-slate-300 text-sm">6) ALGUM OUTRO PROBLEMA? (Opcional)</label>
            <select 
              className="p-2 rounded bg-slate-700 border border-slate-600 text-sm text-white focus:outline-none focus:border-emerald-500 w-full"
              value={q6}
              onChange={(e) => setQ6(e.target.value)}
            >
              <option value="">Nenhum</option>
              {DEFEITOS_OFICIAIS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Foto */}
          <div className="flex flex-col gap-2 bg-slate-900/40 p-3 rounded border border-slate-700/50">
            <label className="font-bold text-slate-300 text-sm">Anexo Fotográfico (Opcional)</label>
            {!fotoBase64 ? (
              <button
                onClick={() => fileInputRef.current.click()}
                className="p-2 rounded bg-slate-700 border border-slate-600 text-white font-bold text-sm hover:bg-slate-600 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                📸 Tirar Foto
              </button>
            ) : (
              <div className="relative">
                <img src={fotoBase64} alt="Preview do Defeito" className="w-full h-32 object-cover rounded border border-slate-600" />
                <button
                  onClick={() => setFotoBase64(null)}
                  className="absolute top-2 right-2 bg-red-600 text-white p-1 px-3 rounded-full font-bold text-xs shadow"
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

        <div className="p-3 bg-slate-900 border-t border-slate-700 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-2.5 rounded font-bold bg-slate-700 text-white hover:bg-slate-600 active:scale-95 transition-all"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            className="flex-[2] py-2.5 rounded font-bold bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95 transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)]"
          >
            Salvar Vistoria
          </button>
        </div>

      </div>
    </div>
  );
};

export default InspectionModal;
