import React, { useState, useRef, useMemo } from 'react';
import { fixEncoding } from '../utils/textUtils';

// Lista configurável e modular de problemas que tornam o hidrante automaticamente inativo
export const PROBLEMAS_INATIVADORES = [
  "Registro soterrado",
  "Faltam 2 tampões",
  "Faltam todos os tampões",
  "Faltam dois tampões de 2 1/2",
  "Faltam bujões e tampões",
  "Tampa da caixa lacrada",
  "Tampa da caixa lacrada (concretada)",
  "Registro emperrado",
  "Registro não funciona",
  "Hidrante sem água",
  "Hidrante removido ou não encontrado",
  "Registro concretado",
  "Hidrante quebrado no flange",
  "Hidrante quebrado"
];

// Lista de defeitos para o campo opcional "Algum outro problema" (sem itens de tampa e tampões já cobertos pelos botões)
const DEFEITOS_OFICIAIS = [
  "Caixa do hidrante obstruída com esgoto",
  "Hidrante sem água",
  "Hidrante removido ou não encontrado",
  "Hidrante cercado/bloqueado",
  "Caixa de registro muito profunda",
  "Caixa de registro cheia de lixo",
  "Caixa de registro cheia d'água",
  "Caixa de registro com enxame de abelhas",
  "Rosca de tampão danificado",
  "Carretel do registro danificado",
  "Hidrante com pouca pressão",
  "Hidrante quebrado no flange",
  "Registro concretado",
  "Registro danificado",
  "Caixa de concreto danificado",
  "Falta flange",
  "Registro não funciona",
  "Hidrante quebrado",
  "Hidrante empenado",
  "Vazamento no flange (operante)"
];

const InspectionModal = ({ hidrante, onClose, onSave, currentUser }) => {
  const [q1, setQ1] = useState(null); // Chave tipo T: 'SIM' | 'NÃO, FALTA LUVA'
  const [q2, setQ2] = useState(null); // Registro: 'SEM ALTERAÇÃO' | 'SOTERRADO' | 'COM VAZAMENTO' | 'EMPERRADO'
  const [q3, setQ3] = useState(null); // Tampa da caixa: 'SEM ALTERAÇÃO' | 'LACRADA' | 'QUEBRADA' | 'REMOVIDA'
  const [q4, setQ4] = useState(null); // Tampões: 'SIM' | 'FALTA 1 TAMPÃO' | 'FALTAM 2 TAMPÕES' | 'FALTAM TODOS OS TAMPÕES'
  const [q5, setQ5] = useState(hidrante.flgAtivo ? 'SIM' : 'NÃO'); // Operante
  const [q6, setQ6] = useState(''); // Algum outro problema
  const [q7, setQ7] = useState(''); // Observações
  
  const [fotoBase64, setFotoBase64] = useState(null);
  const fileInputRef = useRef(null);

  // Determina se há problemas que forçam o hidrante a ser inoperante
  const motivoInoperante = useMemo(() => {
    if (q2 === 'SOTERRADO') return 'Registro está soterrado';
    if (q2 === 'EMPERRADO') return 'Registro está emperrado';
    if (q3 === 'LACRADA') return 'Tampa da caixa está lacrada';
    if (q4 === 'FALTAM 2 TAMPÕES' || q4 === 'FALTAM TODOS OS TAMPÕES') return 'Faltam 2 ou mais tampões';
    if (q6 && PROBLEMAS_INATIVADORES.includes(q6)) return `Problema selecionado: "${q6}"`;
    return null;
  }, [q2, q3, q4, q6]);

  const handleSelectQ5 = (val) => {
    if (val === 'SIM' && motivoInoperante) {
      alert(`⚠️ ATENÇÃO: O hidrante não pode ser marcado como OPERANTE porque foi assinalado um problema inativador:\n\n👉 ${motivoInoperante}.\n\nPara marcá-lo como operante, revise as respostas anteriores.`);
      setQ5('NÃO');
      return;
    }
    setQ5(val);
  };

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
      alert("Por favor, responda todas as perguntas obrigatórias através dos botões antes de salvar.");
      return;
    }

    if (q5 === 'SIM' && motivoInoperante) {
      alert(`⚠️ ERRO DE VALIDAÇÃO: O hidrante não pode ser salvo como OPERANTE com o seguinte defeito inativador ativo: ${motivoInoperante}.`);
      return;
    }

    let problemas = [];
    
    // q1: Chave T
    if (q1 === 'NÃO, FALTA LUVA') problemas.push("Falta cabeçote da haste do registro (luva)");
    
    // q2: Registro
    if (q2 === 'SOTERRADO') problemas.push("Registro soterrado");
    else if (q2 === 'COM VAZAMENTO') problemas.push("Registro com vazamento");
    else if (q2 === 'EMPERRADO') problemas.push("Registro emperrado");

    // q3: Tampa da caixa do registro
    if (q3 === 'LACRADA') problemas.push("Tampa da caixa lacrada (concretada)");
    else if (q3 === 'QUEBRADA') problemas.push("Tampa de concreto quebrada ou removida");
    else if (q3 === 'REMOVIDA') problemas.push("Tampa da caixa de registro removida");

    // q4: Tampões
    if (q4 === 'FALTA 1 TAMPÃO') problemas.push("Falta tampão de 2.1/2\"");
    else if (q4 === 'FALTAM 2 TAMPÕES') problemas.push("Faltam dois tampões de 2 1/2");
    else if (q4 === 'FALTAM TODOS OS TAMPÕES') problemas.push("Faltam todos os tampões");

    // q6: Outro
    if (q6) problemas.push(q6);

    // q7: Observações
    if (q7.trim() !== '') problemas.push(`Obs: ${q7.trim()}`);

    const problemaFinal = problemas.join(" | ");

    // q5: Operante
    let statusFinal = q5 === 'SIM';
    if (motivoInoperante) {
      statusFinal = false;
    }

    if (!statusFinal && problemas.length === 0) {
      alert("⚠️ MOTIVO OBRIGATÓRIO: Para cadastrar o hidrante como INOPERANTE, é obrigatório indicar o motivo. Por favor, selecione um problema na lista suspensa ('Algum outro problema?') ou digite o motivo no campo 'Observações'.");
      return;
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

  const renderOption = (value, currentVal, setVal, isPositive, onClickOverride) => {
    const isSelected = currentVal === value;
    const baseClass = "flex-1 py-2 px-2 font-bold text-xs sm:text-sm rounded shadow-sm border transition-all active:scale-95 text-center";
    
    const clickHandler = () => {
      if (onClickOverride) {
        onClickOverride(value);
      } else {
        setVal(value);
      }
    };

    if (isSelected) {
      return (
        <button 
          type="button"
          onClick={clickHandler}
          className={`${baseClass} ${isPositive ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-red-600 border-red-500 text-white'}`}
        >
          {value}
        </button>
      );
    }
    return (
      <button 
        type="button"
        onClick={clickHandler}
        className={`${baseClass} bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600`}
      >
        {value}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md border border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="bg-slate-900 p-4 border-b border-slate-700 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white">Vistoria Rápida</h2>
            <p className="text-sm text-slate-400">Hidrante: {fixEncoding(hidrante.nomHidrante) || hidrante.codHidrante}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
            ✕
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4 overflow-y-auto">
          
          {/* Pergunta 1 */}
          <div className="flex flex-col gap-2 bg-slate-900/40 p-3 rounded border border-slate-700/50">
            <label className="font-bold text-slate-300 text-sm">1) A CHAVE TIPO T ENCAIXA NO REGISTRO?</label>
            <div className="flex gap-2">
              {renderOption('SIM', q1, setQ1, true)}
              {renderOption('NÃO, FALTA LUVA', q1, setQ1, false)}
            </div>
          </div>

          {/* Pergunta 2 */}
          <div className="flex flex-col gap-2 bg-slate-900/40 p-3 rounded border border-slate-700/50">
            <label className="font-bold text-slate-300 text-sm">2) O REGISTRO ESTÁ...</label>
            <div className="grid grid-cols-2 gap-2">
              {renderOption('SEM ALTERAÇÃO', q2, setQ2, true)}
              {renderOption('SOTERRADO', q2, setQ2, false)}
              {renderOption('COM VAZAMENTO', q2, setQ2, false)}
              {renderOption('EMPERRADO', q2, setQ2, false)}
            </div>
          </div>

          {/* Pergunta 3 */}
          <div className="flex flex-col gap-2 bg-slate-900/40 p-3 rounded border border-slate-700/50">
            <label className="font-bold text-slate-300 text-sm">3) A TAMPA DA CAIXA ESTÁ...</label>
            <div className="grid grid-cols-2 gap-2">
              {renderOption('SEM ALTERAÇÃO', q3, setQ3, true)}
              {renderOption('LACRADA', q3, setQ3, false)}
              {renderOption('QUEBRADA', q3, setQ3, false)}
              {renderOption('REMOVIDA', q3, setQ3, false)}
            </div>
          </div>

          {/* Pergunta 4 */}
          <div className="flex flex-col gap-2 bg-slate-900/40 p-3 rounded border border-slate-700/50">
            <label className="font-bold text-slate-300 text-sm">4) TODOS OS TAMPÕES ESTÃO PRESENTES?</label>
            <div className="grid grid-cols-2 gap-2">
              {renderOption('SIM', q4, setQ4, true)}
              {renderOption('FALTA 1 TAMPÃO', q4, setQ4, true)}
              {renderOption('FALTAM 2 TAMPÕES', q4, setQ4, false)}
              {renderOption('FALTAM TODOS OS TAMPÕES', q4, setQ4, false)}
            </div>
          </div>

          {/* Pergunta 5 */}
          <div className="flex flex-col gap-2 bg-slate-900/40 p-3 rounded border border-slate-700/50">
            <div className="flex justify-between items-center">
              <label className="font-bold text-slate-300 text-sm">5) O HIDRANTE ESTÁ OPERANTE?</label>
              {motivoInoperante && (
                <span className="text-[10px] bg-red-900/80 text-red-300 font-bold px-2 py-0.5 rounded border border-red-700">
                  Bloqueado (Inoperante)
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {renderOption('SIM', q5, setQ5, true, handleSelectQ5)}
              {renderOption('NÃO', q5, setQ5, false)}
            </div>
          </div>

          {/* Pergunta 6 */}
          <div className="flex flex-col gap-2 bg-slate-900/40 p-3 rounded border border-slate-700/50">
            <label className="font-bold text-slate-300 text-sm">6) ALGUM OUTRO PROBLEMA? (Opcional)</label>
            <select 
              className="p-2 rounded bg-slate-700 border border-slate-600 text-sm text-white focus:outline-none focus:border-emerald-500 w-full"
              value={q6}
              onChange={(e) => {
                const val = e.target.value;
                setQ6(val);
                if (PROBLEMAS_INATIVADORES.includes(val)) {
                  setQ5('NÃO');
                }
              }}
            >
              <option value="">Nenhum</option>
              {DEFEITOS_OFICIAIS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Pergunta 7 */}
          <div className="flex flex-col gap-2 bg-slate-900/40 p-3 rounded border border-slate-700/50">
            <label className="font-bold text-slate-300 text-sm">7) OBSERVAÇÕES (Opcional)</label>
            <textarea
              className="p-2 rounded bg-slate-700 border border-slate-600 text-sm text-white focus:outline-none focus:border-emerald-500 w-full h-16 resize-none"
              placeholder="Digite alguma observação adicional..."
              value={q7}
              onChange={(e) => setQ7(e.target.value)}
            />
          </div>

          {/* Foto */}
          <div className="flex flex-col gap-2 bg-slate-900/40 p-3 rounded border border-slate-700/50">
            <label className="font-bold text-slate-300 text-sm">Anexo Fotográfico (Opcional)</label>
            {!fotoBase64 ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded bg-slate-700 border border-slate-600 text-white font-bold text-sm hover:bg-slate-600 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                📸 Tirar Foto
              </button>
            ) : (
              <div className="relative">
                <img src={fotoBase64} alt="Preview do Defeito" className="w-full h-32 object-cover rounded border border-slate-600" />
                <button
                  type="button"
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
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded font-bold bg-slate-700 text-white hover:bg-slate-600 active:scale-95 transition-all"
          >
            Cancelar
          </button>
          <button 
            type="button"
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
