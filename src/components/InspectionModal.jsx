import React, { useState, useRef, useMemo } from 'react';
import { Camera, Image as ImageIcon, Trash2, ClipboardCheck, X, Edit3 } from 'lucide-react';
import { fixEncoding } from '../utils/textUtils';
import { calculateDistanceMeters } from '../utils/geoUtils';

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

const InspectionModal = ({ hidrante, isEditing = false, onClose, onSave, currentUser }) => {
  // Pré-processamento dos dados existentes caso seja modo edição
  const initialData = useMemo(() => {
    // Se for cadastro de nova vistoria, SEMPRE inicia em branco
    if (!isEditing) {
      return {
        q1: null,
        q2: null,
        q3: null,
        q4: null,
        q5: null,
        q6: '',
        q7: '',
        fotos: []
      };
    }

    const rawProbs = (hidrante.problemasHidrante || '').split(' | ').map(p => p.trim()).filter(Boolean);

    // Q1: Chave T / Luva
    let initialQ1 = 'SIM';
    if (rawProbs.some(p => p.toLowerCase().includes('falta cabeçote da haste do registro') || p.toLowerCase().includes('luva'))) {
      initialQ1 = 'NÃO, FALTA LUVA';
    }

    // Q2: Registro
    let initialQ2 = 'SEM ALTERAÇÃO';
    if (rawProbs.some(p => p.toLowerCase().includes('soterrado'))) {
      initialQ2 = 'SOTERRADO';
    } else if (rawProbs.some(p => p.toLowerCase().includes('vazamento') && p.toLowerCase().includes('registro'))) {
      initialQ2 = 'COM VAZAMENTO';
    } else if (rawProbs.some(p => p.toLowerCase().includes('emperrado') || p.toLowerCase().includes('não funciona'))) {
      initialQ2 = 'EMPERRADO';
    }

    // Q3: Tampa da caixa
    let initialQ3 = 'SEM ALTERAÇÃO';
    if (rawProbs.some(p => p.toLowerCase().includes('lacrada'))) {
      initialQ3 = 'LACRADA';
    } else if (rawProbs.some(p => p.toLowerCase().includes('quebrada'))) {
      initialQ3 = 'QUEBRADA';
    } else if (rawProbs.some(p => p.toLowerCase().includes('removida'))) {
      initialQ3 = 'REMOVIDA';
    }

    // Q4: Tampões
    let initialQ4 = 'SIM';
    if (rawProbs.some(p => p.toLowerCase().includes('todos os tampões'))) {
      initialQ4 = 'FALTAM TODOS OS TAMPÕES';
    } else if (rawProbs.some(p => p.toLowerCase().includes('dois tampões') || p.toLowerCase().includes('2 tampões'))) {
      initialQ4 = 'FALTAM 2 TAMPÕES';
    } else if (rawProbs.some(p => p.toLowerCase().includes('falta 1 tampão') || p.toLowerCase().includes('falta tampão de 2.1/2') || p.toLowerCase().includes('falta tampão'))) {
      initialQ4 = 'FALTA 1 TAMPÃO';
    }

    // Q5: Operante
    const initialQ5 = hidrante.flgAtivo ? 'SIM' : 'NÃO';

    // Q7: Observação
    let initialQ7 = '';
    const obsFound = rawProbs.find(p => p.toLowerCase().startsWith('obs:') || p.toLowerCase().startsWith('obs.:'));
    if (obsFound) {
      initialQ7 = obsFound.replace(/^obs\.?:?\s*/i, '').trim();
    } else if (hidrante.dscObservacao) {
      initialQ7 = hidrante.dscObservacao.trim();
    }

    // Q6: Algum outro problema
    let initialQ6 = '';
    for (const p of rawProbs) {
      const pNorm = p.trim();
      const isKnownButton = 
        pNorm.toLowerCase().startsWith('obs:') ||
        pNorm.toLowerCase().includes('falta cabeçote') ||
        pNorm.toLowerCase().includes('registro soterrado') ||
        pNorm.toLowerCase().includes('registro com vazamento') ||
        pNorm.toLowerCase().includes('registro emperrado') ||
        pNorm.toLowerCase().includes('tampa da caixa') ||
        pNorm.toLowerCase().includes('tampa de concreto') ||
        pNorm.toLowerCase().includes('tampão') ||
        pNorm.toLowerCase().includes('tampões');

      if (!isKnownButton && pNorm) {
        const match = DEFEITOS_OFICIAIS.find(d => d.toLowerCase() === pNorm.toLowerCase() || pNorm.toLowerCase().includes(d.toLowerCase()));
        initialQ6 = match || pNorm;
        break;
      }
    }

    // Fotos na edição (suporte a múltiplas fotos ou foto individual legada)
    let initialFotos = [];
    if (Array.isArray(hidrante.fotosVistoria) && hidrante.fotosVistoria.length > 0) {
      initialFotos = [...hidrante.fotosVistoria];
    } else if (hidrante.fotoVistoria) {
      initialFotos = [hidrante.fotoVistoria];
    } else if (hidrante.fotoUrl) {
      initialFotos = [hidrante.fotoUrl];
    }

    return {
      q1: initialQ1,
      q2: initialQ2,
      q3: initialQ3,
      q4: initialQ4,
      q5: initialQ5,
      q6: initialQ6,
      q7: initialQ7,
      fotos: initialFotos
    };
  }, [hidrante, isEditing]);

  const [q1, setQ1] = useState(initialData.q1); // Chave tipo T: 'SIM' | 'NÃO, FALTA LUVA'
  const [q2, setQ2] = useState(initialData.q2); // Registro: 'SEM ALTERAÇÃO' | 'SOTERRADO' | 'COM VAZAMENTO' | 'EMPERRADO'
  const [q3, setQ3] = useState(initialData.q3); // Tampa da caixa: 'SEM ALTERAÇÃO' | 'LACRADA' | 'QUEBRADA' | 'REMOVIDA'
  const [q4, setQ4] = useState(initialData.q4); // Tampões: 'SIM' | 'FALTA 1 TAMPÃO' | 'FALTAM 2 TAMPÕES' | 'FALTAM TODOS OS TAMPÕES'
  const [q5, setQ5] = useState(initialData.q5); // Operante
  const [q6, setQ6] = useState(initialData.q6); // Algum outro problema
  const [q7, setQ7] = useState(initialData.q7); // Observações
  
  const [fotos, setFotos] = useState(initialData.fotos || []);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const isGestor = currentUser?.role === 'gestor' || currentUser?.role === 'admin';

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

  // Utilitário de compressão de foto para otimizar desempenho e sincronização
  const compressImageFile = (file) => {
    return new Promise((resolve) => {
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
          
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.5);
          resolve(compressedBase64);
        };
        img.onerror = () => resolve(null);
        img.src = event.target.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  // Tirar foto via câmera (adiciona à lista)
  const handleCameraCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await compressImageFile(file);
    if (base64) {
      setFotos(prev => [...prev, base64]);
    }
    e.target.value = '';
  };

  // Selecionar uma ou múltiplas fotos da galeria
  const handleGalleryCapture = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const compressedList = await Promise.all(files.map(compressImageFile));
    const validPhotos = compressedList.filter(Boolean);
    if (validPhotos.length > 0) {
      setFotos(prev => [...prev, ...validPhotos]);
    }
    e.target.value = '';
  };

  // Remover foto individual da lista
  const handleRemovePhoto = (indexToRemove) => {
    setFotos(prev => prev.filter((_, idx) => idx !== indexToRemove));
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

    const isGestor = currentUser?.role === 'gestor' || currentUser?.role === 'admin';

    if (fotos.length === 0 && !isGestor && !isEditing) {
      alert("⚠️ FOTO OBRIGATÓRIA: O vistoriador deve obrigatoriamente cadastrar a foto da vistoria (registre ao menos uma foto do problema ou do hidrante durante a descarga de água).");
      return;
    }

    const bloqueioMsg = "vc está a mais de 100 M de distância do hidrante. Não pode. Se houver problemas técnico, envie o relatório da vistoria através do sei para GPCIU/sehur";

    const procederSalvamento = () => {
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
      const fotoPrincipal = fotos[0] || null;

      let updatedHistorico = [...(hidrante.HISTORICO_VISTORIAS || [])];
      if (isEditing && updatedHistorico.length > 0) {
        const lastIdx = updatedHistorico.length - 1;
        updatedHistorico[lastIdx] = {
          ...updatedHistorico[lastIdx],
          problemasHidrante: problemaFinal,
          flgAtivo: statusFinal,
          fotoVistoria: fotoPrincipal,
          fotosVistoria: fotos,
          datHoraEdicao: dataFormatada
        };
      } else if (isEditing) {
        updatedHistorico = [{
          datHoraVistoria: hidrante.datHoraUltimaVistoria || dataFormatada,
          problemasHidrante: problemaFinal,
          flgAtivo: statusFinal,
          fotoVistoria: fotoPrincipal,
          fotosVistoria: fotos,
          vistoriadorNome: hidrante.vistoriadorNome || currentUser?.nome,
          vistoriadorMatricula: hidrante.vistoriadorMatricula || currentUser?.matricula,
          datHoraEdicao: dataFormatada
        }];
      } else {
        updatedHistorico.push({
          datHoraVistoria: dataFormatada,
          problemasHidrante: problemaFinal,
          flgAtivo: statusFinal,
          fotoVistoria: fotoPrincipal,
          fotosVistoria: fotos,
          vistoriadorNome: currentUser?.nome,
          vistoriadorMatricula: currentUser?.matricula
        });
      }

      const vistoriaAtualizada = {
        ...hidrante,
        flgAtivo: statusFinal,
        problemasHidrante: problemaFinal,
        datHoraUltimaVistoria: isEditing ? (hidrante.datHoraUltimaVistoria || dataFormatada) : dataFormatada,
        datHoraEdicao: isEditing ? dataFormatada : undefined,
        fotoVistoria: fotoPrincipal,
        fotosVistoria: fotos,
        vistoriadorNome: hidrante.vistoriadorNome || currentUser?.nome,
        vistoriadorMatricula: hidrante.vistoriadorMatricula || currentUser?.matricula,
        HISTORICO_VISTORIAS: updatedHistorico
      };

      onSave(vistoriaAtualizada, isEditing);
    };

    // Na edição, isenta de validação do GPS (militar pode estar no quartel ou viatura)
    if (isEditing || isGestor) {
      procederSalvamento();
      return;
    }

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!pos || !pos.coords) {
            alert(bloqueioMsg);
            return;
          }
          const distMeters = calculateDistanceMeters(pos.coords.latitude, pos.coords.longitude, hidrante.numLatitude, hidrante.numLongitude);
          if (distMeters > 100) {
            alert(bloqueioMsg);
          } else {
            procederSalvamento();
          }
        },
        (err) => {
          console.warn('Erro ao obter GPS do vistoriador:', err);
          alert(bloqueioMsg);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
      );
    } else {
      alert(bloqueioMsg);
    }
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-0 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 sm:rounded-2xl shadow-2xl w-full max-w-lg border-0 sm:border border-slate-700/80 overflow-hidden flex flex-col h-[100dvh] sm:h-auto sm:max-h-[92dvh] text-slate-100">
        
        {/* CABEÇALHO PADRONIZADO */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-slate-900 border-b border-slate-700/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button 
              type="button"
              onClick={onClose} 
              className="text-xs px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg font-semibold transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
            >
              ← Voltar
            </button>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md shrink-0 ${isEditing ? 'bg-gradient-to-br from-amber-500 to-amber-700 shadow-amber-950/50' : 'bg-gradient-to-br from-emerald-600 to-teal-700 shadow-emerald-950/50'}`}>
              {isEditing ? <Edit3 size={20} /> : <ClipboardCheck size={20} />}
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate flex items-center gap-2">
                {isEditing ? (
                  <>
                    <span>Editar Vistoria</span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-mono font-bold tracking-wide">EDIÇÃO</span>
                  </>
                ) : (
                  <span>Cadastrar Vistoria</span>
                )}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Hidrante: <span className="font-semibold text-emerald-400">{fixEncoding(hidrante.nomHidrante) || hidrante.codHidrante}</span>
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4 overflow-y-auto">
          
          {/* Pergunta 1 */}
          <div className="flex flex-col gap-2 bg-slate-900/40 p-3 rounded border border-slate-700/50">
            <label className="font-bold text-slate-300 text-sm">
              1) A CHAVE TIPO T ENCAIXA NO REGISTRO? <span className="text-red-500 font-bold ml-1">*</span>
            </label>
            <div className="flex gap-2">
              {renderOption('SIM', q1, setQ1, true)}
              {renderOption('NÃO, FALTA LUVA', q1, setQ1, false)}
            </div>
          </div>

          {/* Pergunta 2 */}
          <div className="flex flex-col gap-2 bg-slate-900/40 p-3 rounded border border-slate-700/50">
            <label className="font-bold text-slate-300 text-sm">
              2) O REGISTRO ESTÁ... <span className="text-red-500 font-bold ml-1">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {renderOption('SEM ALTERAÇÃO', q2, setQ2, true)}
              {renderOption('SOTERRADO', q2, setQ2, false)}
              {renderOption('COM VAZAMENTO', q2, setQ2, false)}
              {renderOption('EMPERRADO', q2, setQ2, false)}
            </div>
          </div>

          {/* Pergunta 3 */}
          <div className="flex flex-col gap-2 bg-slate-900/40 p-3 rounded border border-slate-700/50">
            <label className="font-bold text-slate-300 text-sm">
              3) A TAMPA DA CAIXA ESTÁ... <span className="text-red-500 font-bold ml-1">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {renderOption('SEM ALTERAÇÃO', q3, setQ3, true)}
              {renderOption('LACRADA', q3, setQ3, false)}
              {renderOption('QUEBRADA', q3, setQ3, false)}
              {renderOption('REMOVIDA', q3, setQ3, false)}
            </div>
          </div>

          {/* Pergunta 4 */}
          <div className="flex flex-col gap-2 bg-slate-900/40 p-3 rounded border border-slate-700/50">
            <label className="font-bold text-slate-300 text-sm">
              4) TODOS OS TAMPÕES ESTÃO PRESENTES? <span className="text-red-500 font-bold ml-1">*</span>
            </label>
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
              <label className="font-bold text-slate-300 text-sm">
                5) O HIDRANTE ESTÁ OPERANTE? <span className="text-red-500 font-bold ml-1">*</span>
              </label>
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

          {/* Registro Fotográfico */}
          <div className="flex flex-col gap-2.5 bg-slate-900/40 p-3 rounded-xl border border-slate-700/50">
            <div className="flex flex-col">
              <label className="font-bold text-slate-300 text-sm flex items-center justify-between">
                <span>Registro Fotográfico {!isGestor && !isEditing && <span className="text-red-500 font-bold ml-1">* (Obrigatório)</span>}</span>
                {fotos.length > 0 && (
                  <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/40">
                    {fotos.length} {fotos.length === 1 ? 'foto anexada' : 'fotos anexadas'}
                  </span>
                )}
              </label>
              <p className="text-xs text-amber-300/90 font-medium mt-0.5">
                Registre uma ou mais fotos do problema ou do hidrante durante a descarga de água.
              </p>
            </div>

            {/* Grade de Fotos Anexadas */}
            {fotos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {fotos.map((foto, index) => (
                  <div key={index} className="relative group rounded-xl overflow-hidden border border-slate-600 bg-slate-800 shadow-sm aspect-video sm:aspect-square">
                    <img 
                      src={foto} 
                      alt={`Foto ${index + 1} da vistoria`} 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute top-1 left-1 bg-black/70 backdrop-blur-xs text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded">
                      #{index + 1}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(index)}
                      className="absolute top-1 right-1 bg-red-600 hover:bg-red-500 text-white p-1 rounded-lg shadow-md transition-all active:scale-90 flex items-center justify-center cursor-pointer"
                      title="Remover esta foto"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Botões de Ação para Tirar / Escolher Foto (Permanecem disponíveis para adicionar mais fotos) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="p-2.5 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 border border-emerald-500/60 text-white font-bold text-xs sm:text-sm active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Camera size={16} />
                <span>{fotos.length > 0 ? '📸 + Tirar Foto' : '📸 Tirar Foto (Câmera)'}</span>
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="p-2.5 rounded-lg bg-slate-750 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-xs sm:text-sm active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <ImageIcon size={16} className="text-cyan-400" />
                <span>{fotos.length > 0 ? '🖼️ + Da Galeria' : '🖼️ Galeria (Múltiplas)'}</span>
              </button>
            </div>

            {/* Input Câmera (capture environment) */}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={cameraInputRef}
              className="hidden"
              onChange={handleCameraCapture}
            />
            {/* Input Galeria (multiple: permite selecionar mais de uma foto de uma vez) */}
            <input
              type="file"
              accept="image/*"
              multiple
              ref={galleryInputRef}
              className="hidden"
              onChange={handleGalleryCapture}
            />
          </div>

        </div>

        <div className="p-3.5 bg-slate-900 border-t border-slate-700/80 flex gap-3 sticky bottom-0 z-10 shrink-0">
          <button 
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg font-bold bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white active:scale-95 transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button 
            type="button"
            onClick={handleSave}
            className={`flex-[2] py-2.5 rounded-lg font-bold text-white active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
              isEditing 
                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-950/50 border border-amber-400/30' 
                : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-950/50'
            }`}
          >
            {isEditing ? '💾 Salvar Alterações' : 'Salvar Vistoria'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default InspectionModal;
