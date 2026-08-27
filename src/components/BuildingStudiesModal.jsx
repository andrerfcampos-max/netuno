import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Building2, 
  Search, 
  PlusCircle, 
  Phone, 
  Navigation, 
  MapPin, 
  ShieldAlert, 
  Flame, 
  Droplets, 
  Zap, 
  AlertTriangle, 
  FileText, 
  Share2, 
  Printer, 
  X, 
  Edit, 
  Trash2, 
  Eye, 
  Maximize2, 
  Users, 
  Truck, 
  ChevronRight, 
  Layers, 
  ExternalLink,
  LocateFixed,
  Radio,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { RA_LIST, normalizeRAName } from '../utils/raList';
import { 
  getBuildingStudies, 
  saveBuildingStudy, 
  deleteBuildingStudy, 
  findNearestHydrantsForBuilding 
} from '../utils/buildingStudiesStorage';
import { isValidDFCoordinate } from '../utils/geoUtils';

const OCCUPANCY_TYPES = [
  'Residencial',
  'Comercial',
  'Hospitalar',
  'Escolar',
  'Industrial',
  'Reunião de Público',
  'Depósito',
  'Mista / Outros'
];

const HAZARD_LEVELS = [
  { value: 'Baixa', label: 'Baixa Carga de Incêndio', color: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40' },
  { value: 'Média', label: 'Média Carga de Incêndio', color: 'bg-amber-950/60 text-amber-300 border-amber-500/40' },
  { value: 'Alta', label: 'Alta Carga de Incêndio (Crítica)', color: 'bg-red-950/60 text-red-300 border-red-500/40' }
];

export default function BuildingStudiesModal({ 
  isOpen, 
  onClose, 
  allHydrantes = [], 
  currentUser 
}) {
  const [studies, setStudies] = useState([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modais secundários
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStudy, setEditingStudy] = useState(null);
  const [tacticalViewStudy, setTacticalViewStudy] = useState(null);
  const [zoomImage, setZoomImage] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Recarregar estudos
  useEffect(() => {
    if (isOpen) {
      const loaded = getBuildingStudies();
      setStudies(loaded);
    }
  }, [isOpen]);

  // Filtragem
  const filteredStudies = useMemo(() => {
    let result = [...studies];

    if (selectedCity) {
      const normCity = normalizeRAName(selectedCity).toLowerCase();
      result = result.filter(s => {
        const sCity = normalizeRAName(s.ra || '').toLowerCase();
        return sCity === normCity;
      });
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      result = result.filter(s => {
        const searchStr = `${s.nomeFantasia || ''} ${s.razaoSocial || ''} ${s.endereco || ''} ${s.ra || ''} ${s.ocupacao || ''} ${s.produtosPerigosos || ''} ${s.areasCriticas || ''} ${s.informacoesExtras || ''}`
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        return searchStr.includes(term);
      });
    }

    return result;
  }, [studies, selectedCity, searchTerm]);

  // Salvar novo/editado
  const handleSaveStudy = (formData, keepOpen = false) => {
    const res = saveBuildingStudy(formData);
    if (res.success) {
      setStudies(res.data);
      if (!keepOpen) {
        setIsFormOpen(false);
        setEditingStudy(null);
      } else {
        const savedItem = res.data.find(s => (formData.id ? s.id === formData.id : true));
        if (savedItem) {
          setEditingStudy(savedItem);
        }
      }
      if (tacticalViewStudy && tacticalViewStudy.id === formData.id) {
        const updated = res.data.find(s => s.id === formData.id);
        setTacticalViewStudy(updated || null);
      }
      return { success: true, studyId: formData.id || res.data[0]?.id };
    }
    return { success: false };
  };

  // Excluir estudo
  const handleDeleteStudy = (id) => {
    const res = deleteBuildingStudy(id);
    if (res.success) {
      setStudies(res.data);
      setDeleteConfirmId(null);
      if (tacticalViewStudy && tacticalViewStudy.id === id) {
        setTacticalViewStudy(null);
      }
    }
  };

  // Compartilhar via WhatsApp estruturado para SCI / CBMDF
  const handleShareWhatsApp = (study) => {
    const text = `🚨 *NETUNO - PRÉ-PLANEJAMENTO OPERACIONAL (PREPOP / CBMDF)* 🚒
━━━━━━━━━━━━━━━━━━━━━━━━━━
🏢 *EDIFICAÇÃO:* ${study.nomeFantasia || 'S/N'}
🏛️ *Razão Social:* ${study.razaoSocial || 'N/I'}
📍 *Endereço:* ${study.ra ? `${study.ra} - ` : ''}${study.endereco || 'N/I'}
🏷️ *Ocupação:* ${study.ocupacao || 'N/I'} | *Carga de Incêndio:* ${study.cargaIncendio || 'N/I'}
👥 *População Prioritária:* ${study.populacaoPrioritaria || 'Sem registro'}

━━━━━━━━━━━━━━━━━━━━━━━━━━
🚒 *TREM DE SOCORRO E ACESSOS:*
• *Via Principal:* ${study.viaPrincipal || 'N/I'}
• *Via Alternativa:* ${study.viaAlternativa || 'N/I'}
• *Posicionamento ABT:* ${study.posicionamentoABT || 'N/I'}
• *Posicionamento AET/Plataforma:* ${study.posicionamentoAET || 'N/I'}
• *Posto de Comando (PC):* ${study.postoComando || 'N/I'}
• *ACV / Triagem START:* ${study.acvStart || 'N/I'}
⚠️ *Restrições/Gabaritos:* ${study.restricoesViarias || 'Nenhuma registrada'}

━━━━━━━━━━━━━━━━━━━━━━━━━━
💧 *RECURSOS HÍDRICOS:*
• *Reserva Técnica (RTI):* ${study.volumeRTI || 'N/I'}
• *Registro de Recalque:* ${study.registroRecalqueTipo || ''} - ${study.registroRecalqueLocal || 'N/I'}
• *Hidrantes CAESB Próximos:*
${study.hidrantesProximos && study.hidrantesProximos.length > 0 
  ? study.hidrantesProximos.map(h => `  - ${h.codigo} (${h.distancia || ''}) | ${h.status} | ${h.endereco}`).join('\n')
  : '  - Consultar hidrantes urbanos no mapa Netuno'}
• *Mananciais Alternativos:* ${study.mananciaisAlternativos || 'Não identificados'}

━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ *PONTOS DE CORTE E SISTEMAS:*
• *Chave Geral Energia:* ${study.chaveGeralEnergia || 'N/I'}
• *Válvula Geral de Gás:* ${study.valvulaGeralGas || 'N/I'}
• *Sprinklers / VGA:* ${study.sprinklersVGA || 'N/I'}
• *Escadas / Pressurização:* ${study.escadasPressurizacao || 'N/I'}
• *Gerador:* ${study.geradorEmergencia || 'N/I'}

━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ *RISCOS ESPECÍFICOS & COLAPSO:*
• *Produtos Perigosos:* ${study.produtosPerigosos || 'Nenhum informado'}
• *Áreas Críticas:* ${study.areasCriticas || 'N/I'}
• *Risco de Colapso:* ${study.riscoColapso || 'N/I'}
${study.informacoesExtras ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n📝 *INFORMAÇÕES EXTRAS & OBSERVAÇÕES:*\n${study.informacoesExtras}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 *CONTATOS DE EMERGÊNCIA:*
${study.contatos && study.contatos.length > 0 
  ? study.contatos.map(c => `• ${c.funcao || 'Contato'}: ${c.nome || ''} - Tel: ${c.telefone || ''}`).join('\n')
  : '• Sem contatos pré-cadastrados'}

🗺️ *Waze:* https://waze.com/ul?ll=${study.numLatitude},${study.numLongitude}&navigate=yes
🌐 *Google Maps:* https://maps.google.com/?q=${study.numLatitude},${study.numLongitude}
━━━━━━━━━━━━━━━━━━━━━━━━━━
_Gerado via Netuno CBMDF - Sistema Tático Operacional_`;

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const baseUrl = isMobile ? 'whatsapp://send' : 'https://web.whatsapp.com/send';
    window.open(`${baseUrl}?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-1 sm:p-4 overflow-hidden animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl sm:rounded-2xl w-full max-w-6xl h-[98dvh] sm:h-[94vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        {/* CABEÇALHO PRINCIPAL */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-950/50 shrink-0">
              <Building2 size={22} className="animate-pulse" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">
                Estudo de edificações - PREPOP
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditingStudy(null);
                setIsFormOpen(true);
              }}
              className="h-9 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-md shadow-emerald-950/50 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              title="Cadastrar novo estudo de edificação"
            >
              <PlusCircle size={17} />
              <span className="hidden sm:inline">Novo estudo</span>
            </button>
            
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 flex items-center justify-center text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700/80 active:scale-95 transition-all"
              title="Fechar (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* MENSAGEM ORIENTATIVA OBRIGATÓRIA (Banner de Boas-Vindas Tático) */}
        <div className="px-4 py-2.5 sm:px-6 bg-gradient-to-r from-blue-950/80 via-slate-800/80 to-blue-950/80 border-b border-blue-900/40 flex items-center gap-2.5 text-xs sm:text-sm text-blue-200">
          <Radio size={16} className="text-cyan-400 shrink-0 animate-pulse" />
          <p className="leading-snug">
            Busque pela cidade e pelo nome da edificação. Acesse a ficha PREPOP e verifique as informações cadastradas para auxiliar a tomada de decisão durante a operação de incêndio.
          </p>
        </div>

        {/* BARRA DE FILTROS (CIDADE / RA + BUSCA LIVRE + CONTADOR TÁTICO) */}
        <div className="p-3 sm:p-4 bg-slate-900/90 border-b border-slate-800 shrink-0 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            {/* Seletor de Cidade / RA */}
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Filtrar por Cidade (Região Administrativa)
              </label>
              <div className="relative">
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 bg-slate-800 border border-slate-700 focus:border-cyan-500 rounded-lg text-xs sm:text-sm text-slate-100 font-medium appearance-none cursor-pointer outline-none transition-all"
                >
                  <option value="">Todas as Cidades ({studies.length} cadastradas)</option>
                  {RA_LIST.map(ra => {
                    const count = studies.filter(s => normalizeRAName(s.ra || '').toLowerCase() === ra.name.toLowerCase()).length;
                    return (
                      <option key={ra.name} value={ra.name}>
                        {ra.name} {count > 0 ? `(${count})` : ''}
                      </option>
                    );
                  })}
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                  ▼
                </div>
              </div>
            </div>

            {/* Campo de Busca Livre com Digitação */}
            <div className="sm:col-span-8">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Buscar Edificação, Endereço ou Ocupação
              </label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Digite o nome do edifício, quadra, hospital, shopping, produtos perigosos..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-800 border border-slate-700 focus:border-cyan-500 rounded-lg text-xs sm:text-sm text-slate-100 placeholder-slate-500 outline-none transition-all"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* MENSAGEM CONTADOR DE EDIFICAÇÕES ENCONTRADAS PELO FILTRO (Estilo Filtro Avançado do Mapa) */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className={`font-bold flex items-center gap-1.5 ${filteredStudies.length > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                <span className={`w-2 h-2 rounded-full ${filteredStudies.length > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                {filteredStudies.length > 0 
                  ? `${filteredStudies.length} edificação(ões) encontrada(s)${selectedCity ? ` em ${selectedCity}` : ' no DF'}`
                  : 'Nenhuma edificação encontrada com os filtros aplicados'}
              </span>
              {searchTerm && (
                <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  Termo: <strong className="text-slate-200">"{searchTerm}"</strong>
                </span>
              )}
            </div>

            {(selectedCity || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCity('');
                  setSearchTerm('');
                }}
                className="text-xs text-slate-400 hover:text-rose-400 underline flex items-center gap-1 transition-colors font-medium"
              >
                ✕ Limpar filtros de busca
              </button>
            )}
          </div>
        </div>

        {/* CORPO DA LISTAGEM DE ESTUDOS */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-950/50 space-y-3">
          {filteredStudies.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl">
              <Building2 size={48} className="text-slate-600 mb-3 animate-bounce" />
              <h3 className="text-base font-bold text-slate-300">Nenhum estudo de edificação encontrado</h3>
              <p className="text-xs text-slate-500 max-w-md mt-1 mb-4">
                {selectedCity || searchTerm 
                  ? 'Nenhum resultado corresponde aos filtros selecionados. Tente limpar os filtros ou cadastrar um novo estudo.'
                  : 'Nenhum estudo tático de edificação cadastrado ainda.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingStudy(null);
                  setIsFormOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm rounded-lg shadow-lg shadow-emerald-950/50 transition-all"
              >
                <PlusCircle size={16} />
                Cadastrar primeiro estudo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredStudies.map((study) => (
                <BuildingTacticalCard
                  key={study.id}
                  study={study}
                  onOpenTacticalView={() => setTacticalViewStudy(study)}
                  onEdit={() => {
                    setEditingStudy(study);
                    setIsFormOpen(true);
                  }}
                  onDelete={() => setDeleteConfirmId(study.id)}
                  onShareWhatsApp={() => handleShareWhatsApp(study)}
                  onOpenZoom={(imgUrl) => setZoomImage(imgUrl)}
                />
              ))}
            </div>
          )}
        </div>

        {/* RODAPÉ INFORMATIVO */}
        <div className="px-4 py-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Total de Edificações: <strong className="text-slate-200">{filteredStudies.length}</strong></span>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Netuno CBMDF • Módulo de Pré-Planejamento Operacional
          </span>
        </div>

      </div>

      {/* MODAL DE FORMULÁRIO (NOVO / EDITAR) */}
      {isFormOpen && (
        <BuildingStudyFormModal
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingStudy(null);
          }}
          studyData={editingStudy}
          onSave={handleSaveStudy}
          allHydrantes={allHydrantes}
        />
      )}

      {/* MODAL DE VISÃO TÁTICA COMPLETA DE RESPOSTA RÁPIDA (SCI / CBMDF) */}
      {tacticalViewStudy && (
        <BuildingTacticalViewModal
          isOpen={!!tacticalViewStudy}
          onClose={() => setTacticalViewStudy(null)}
          study={tacticalViewStudy}
          allHydrantes={allHydrantes}
          onEdit={() => {
            setEditingStudy(tacticalViewStudy);
            setIsFormOpen(true);
          }}
          onShareWhatsApp={() => handleShareWhatsApp(tacticalViewStudy)}
          onOpenZoom={(imgUrl) => setZoomImage(imgUrl)}
        />
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/40 rounded-xl p-5 max-w-sm w-full text-slate-100 shadow-2xl animate-scaleUp">
            <div className="flex items-center gap-3 text-red-400 mb-3">
              <AlertTriangle size={24} />
              <h4 className="font-bold text-base">Excluir Estudo de Edificação?</h4>
            </div>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Esta ação removerá permanentemente os dados pré-cadastrados desta edificação da base local. Deseja continuar?
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteStudy(deleteConfirmId)}
                className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-red-950/50"
              >
                Sim, excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ZOOM DE IMAGEM / CROQUI */}
      {zoomImage && (
        <div 
          className="fixed inset-0 z-[220] bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md"
          onClick={() => setZoomImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
            <img 
              src={zoomImage} 
              alt="Anexo Tático com Zoom" 
              className="max-h-[82vh] max-w-full object-contain rounded-lg shadow-2xl border border-slate-700" 
            />
            <p className="text-xs text-slate-400 mt-2">Clique em qualquer lugar para fechar</p>
            <button 
              type="button"
              onClick={() => setZoomImage(null)}
              className="absolute top-2 right-2 p-2 bg-slate-900/80 hover:bg-slate-800 text-white rounded-full border border-slate-700"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// --------------------------------------------------------------------------------------
// CARD TÁTICO DE RESPOSTA RÁPIDA (ITEM DA LISTA)
// --------------------------------------------------------------------------------------
function BuildingTacticalCard({ 
  study, 
  onOpenTacticalView, 
  onEdit, 
  onDelete, 
  onShareWhatsApp,
  onOpenZoom
}) {
  const hazard = HAZARD_LEVELS.find(h => h.value === study.cargaIncendio) || HAZARD_LEVELS[1];

  return (
    <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 shadow-lg flex flex-col justify-between gap-3 transition-all">
      
      {/* Topo do Card: Nome, RA, Ocupação e Carga de Incêndio */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="px-2 py-0.5 bg-blue-950 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold rounded uppercase">
                {study.ra || 'DF'}
              </span>
              <span className="px-2 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-semibold rounded">
                {study.ocupacao || 'Ocupação N/I'}
              </span>
              <span className={`px-2 py-0.5 border text-[10px] font-bold rounded ${hazard.color}`}>
                Carga {study.cargaIncendio || 'Média'}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug truncate" title={study.nomeFantasia}>
              {study.nomeFantasia || 'Edificação Sem Nome'}
            </h3>
            {study.razaoSocial && (
              <p className="text-xs text-slate-400 truncate" title={study.razaoSocial}>
                {study.razaoSocial}
              </p>
            )}
          </div>

          {/* Miniatura da Fachada se houver */}
          {study.fotoFachada && (
            <button
              type="button"
              onClick={() => onOpenZoom(study.fotoFachada)}
              className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-700 shrink-0 group shadow-md"
              title="Ver foto da fachada"
            >
              <img src={study.fotoFachada} alt="Fachada" className="w-full h-full object-cover group-hover:scale-110 transition-all" />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Maximize2 size={12} className="text-white" />
              </div>
            </button>
          )}
        </div>

        {/* Endereço */}
        <div className="flex items-start gap-1.5 text-xs text-slate-300 my-2">
          <MapPin size={14} className="text-red-400 shrink-0 mt-0.5" />
          <span className="leading-relaxed line-clamp-2">{study.endereco || 'Endereço não informado'}</span>
        </div>

        {/* População Crítica / Prioritária */}
        {study.populacaoPrioritaria && (
          <div className="bg-red-950/40 border border-red-900/40 rounded-lg p-2 my-2 text-xs text-red-200 flex items-start gap-2">
            <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
            <p className="line-clamp-2 leading-relaxed">
              <strong className="text-red-300">Evacuação Prioritária:</strong> {study.populacaoPrioritaria}
            </p>
          </div>
        )}

        {/* Informações Extras no Card */}
        {study.informacoesExtras && (
          <div className="bg-slate-950/60 border border-slate-800/90 rounded-lg p-2 my-2 text-xs text-slate-300 flex items-start gap-1.5">
            <FileText size={13} className="text-emerald-400 shrink-0 mt-0.5" />
            <p className="line-clamp-2 leading-relaxed">
              <strong className="text-emerald-300">Obs / Extras:</strong> {study.informacoesExtras}
            </p>
          </div>
        )}

        {/* Destaques Táticos Rápidos (Recalque, RTI, Hidrantes) */}
        <div className="grid grid-cols-2 gap-2 text-xs my-2.5">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2">
            <div className="flex items-center gap-1.5 text-cyan-400 font-semibold mb-0.5 text-[11px]">
              <Droplets size={12} />
              <span>RTI & Recalque</span>
            </div>
            <p className="text-[11px] text-slate-300 truncate">
              {study.volumeRTI ? `RTI: ${study.volumeRTI}` : 'RTI: N/I'} | {study.registroRecalqueTipo || 'Recalque N/I'}
            </p>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2">
            <div className="flex items-center gap-1.5 text-amber-400 font-semibold mb-0.5 text-[11px]">
              <Zap size={12} />
              <span>Cortes & Energia</span>
            </div>
            <p className="text-[11px] text-slate-300 truncate">
              {study.chaveGeralEnergia ? 'Chave cadastrada' : 'Sem info chave'} | {study.valvulaGeralGas ? 'Gás cadastrado' : 'Sem gás'}
            </p>
          </div>
        </div>

        {/* Botões Rápidos de Contatos de Emergência (Discagem) */}
        {study.contatos && study.contatos.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap my-2">
            {study.contatos.slice(0, 3).map((c, idx) => (
              c.telefone && (
                <a
                  key={idx}
                  href={`tel:${c.telefone.replace(/\D/g, '')}`}
                  className="flex items-center gap-1 px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold rounded-md transition-all active:scale-95"
                  title={`Ligar para ${c.funcao || 'Contato'}: ${c.nome || ''} (${c.telefone})`}
                >
                  <Phone size={11} className="text-emerald-400" />
                  <span>{c.funcao ? c.funcao.split(' ')[0] : 'Ligar'}: {c.telefone}</span>
                </a>
              )
            ))}
          </div>
        )}
      </div>

      {/* Barra de Ações Rápidas do Card */}
      <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-1.5 flex-wrap">
        
        {/* Botão Principal: Visão Tática de Resposta Rápida (Ficha completa PREPOP) */}
        <button
          type="button"
          onClick={onOpenTacticalView}
          className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-lg border border-emerald-500/40 shadow-md shadow-emerald-950/60 active:scale-95 transition-all"
        >
          <Eye size={14} />
          <span>Ficha completa PREPOP</span>
        </button>

        {/* Rotas Rápidas (Waze / Maps) */}
        {isValidDFCoordinate(study.numLatitude, study.numLongitude) && (
          <div className="flex items-center gap-1">
            <a
              href={`https://waze.com/ul?ll=${study.numLatitude},${study.numLongitude}&navigate=yes`}
              target="_blank"
              rel="noreferrer"
              className="p-2 bg-sky-950/80 hover:bg-sky-900 border border-sky-500/40 text-sky-300 rounded-lg text-xs font-bold transition-all"
              title="Navegar via Waze"
            >
              <Navigation size={14} />
            </a>
            <a
              href={`https://maps.google.com/?q=${study.numLatitude},${study.numLongitude}`}
              target="_blank"
              rel="noreferrer"
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all"
              title="Ver no Google Maps"
            >
              <MapPin size={14} />
            </a>
          </div>
        )}

        {/* WhatsApp Despacho */}
        <button
          type="button"
          onClick={onShareWhatsApp}
          className="p-2 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs transition-all"
          title="Compartilhar ficha via WhatsApp"
        >
          <Share2 size={14} />
        </button>

        {/* Editar & Excluir */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all"
            title="Editar estudo"
          >
            <Edit size={14} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-2 bg-red-950/50 hover:bg-red-900/70 text-red-400 rounded-lg transition-all"
            title="Excluir estudo"
          >
            <Trash2 size={14} />
          </button>
        </div>

      </div>

    </div>
  );
}

// --------------------------------------------------------------------------------------
// MODAL DE VISÃO TÁTICA COMPLETA DE RESPOSTA RÁPIDA (SCI / CBMDF)
// --------------------------------------------------------------------------------------
function BuildingTacticalViewModal({ 
  isOpen, 
  onClose, 
  study, 
  allHydrantes = [],
  onEdit, 
  onShareWhatsApp,
  onOpenZoom
}) {
  const [activeSec, setActiveSec] = useState('view-sec-A');
  const scrollContainerRef = useRef(null);

  const hydrantsToDisplay = useMemo(() => {
    if (!study) return [];
    if (study.hidrantesProximos && study.hidrantesProximos.length > 0) {
      const enriched = study.hidrantesProximos.map(h => {
        if (h.lat && h.lng) return h;
        if (Array.isArray(allHydrantes) && allHydrantes.length > 0) {
          const match = allHydrantes.find(ah => (ah.nomHidrante === h.codigo || ah.codHidrante === h.codigo));
          if (match && isValidDFCoordinate(match.numLatitude, match.numLongitude)) {
            return { ...h, lat: match.numLatitude, lng: match.numLongitude };
          }
        }
        return h;
      });
      if (enriched.length >= 3 || !isValidDFCoordinate(study.numLatitude, study.numLongitude)) {
        return enriched.slice(0, 3);
      }
    }
    if (isValidDFCoordinate(study.numLatitude, study.numLongitude) && Array.isArray(allHydrantes) && allHydrantes.length > 0) {
      const computed = findNearestHydrantsForBuilding(study.numLatitude, study.numLongitude, allHydrantes, 3);
      if (computed.length > 0) return computed;
    }
    return study.hidrantesProximos || [];
  }, [study, allHydrantes]);

  if (!isOpen || !study) return null;

  const hazard = HAZARD_LEVELS.find(h => h.value === study.cargaIncendio) || HAZARD_LEVELS[1];

  const tacticalSections = [
    { id: 'view-sec-A', label: 'A. Identificação', icon: Users },
    { id: 'view-sec-B', label: 'B. Trem de socorro / SCI', icon: Truck },
    { id: 'view-sec-C', label: 'C. Recursos hídricos', icon: Droplets },
    { id: 'view-sec-D', label: 'D. Cortes & sistemas', icon: Zap },
    { id: 'view-sec-E', label: 'E. Riscos & carga', icon: Flame },
    ...(study.fotoFachada || study.croquiPlanta ? [{ id: 'view-sec-F', label: 'F. Fotos & croquis', icon: Layers }] : []),
    ...(study.informacoesExtras ? [{ id: 'view-sec-G', label: 'G. Informações extras', icon: FileText }] : [])
  ];

  const scrollToSection = (secId) => {
    setActiveSec(secId);
    const container = scrollContainerRef.current;
    const target = document.getElementById(secId);
    if (container && target) {
      const topOffset = target.offsetTop - container.offsetTop;
      container.scrollTo({ top: topOffset, behavior: 'smooth' });
    }
  };

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const scrollPos = container.scrollTop + 60;
    for (let i = tacticalSections.length - 1; i >= 0; i--) {
      const el = document.getElementById(tacticalSections[i].id);
      if (el) {
        const topOffset = el.offsetTop - container.offsetTop;
        if (scrollPos >= topOffset) {
          setActiveSec(tacticalSections[i].id);
          break;
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[180] bg-black/90 backdrop-blur-md flex items-center justify-center p-1 sm:p-4 overflow-hidden animate-fadeIn">
      <div className="bg-slate-900 border border-emerald-500/40 rounded-xl sm:rounded-2xl w-full max-w-5xl h-[98dvh] sm:h-[94vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        {/* Cabeçalho Ficha Tática */}
        <div className="px-3 py-2 sm:px-6 sm:py-4 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-emerald-950/80 border-b border-emerald-500/30 flex items-center justify-between gap-2 sm:gap-3 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="hidden sm:flex items-center gap-2 flex-wrap mb-1">
              <span className="px-2.5 py-0.5 bg-emerald-600 text-white font-extrabold text-[11px] rounded uppercase tracking-wider shadow">
                SCI / CBMDF • RESPOSTA RÁPIDA
              </span>
              <span className="px-2 py-0.5 bg-blue-950 text-cyan-300 border border-cyan-500/30 text-xs font-bold rounded">
                {study.ra}
              </span>
              <span className={`px-2 py-0.5 border text-xs font-bold rounded ${hazard.color}`}>
                Carga {study.cargaIncendio || 'Média'}
              </span>
            </div>
            <h2 className="text-sm sm:text-2xl font-black text-white tracking-tight leading-tight truncate sm:whitespace-normal">
              {study.nomeFantasia}
            </h2>
            <p className="hidden sm:block text-xs text-slate-300 leading-snug mt-0.5">
              {study.razaoSocial ? `${study.razaoSocial} • ` : ''}{study.endereco}
            </p>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={onShareWhatsApp}
              className="flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-lg shadow-md transition-all active:scale-95"
              title="Despacho WhatsApp"
            >
              <Share2 size={15} />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="p-1.5 sm:p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-all"
              title="Imprimir Ficha"
            >
              <Printer size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* BARRA DE NAVEGAÇÃO HORIZONTAL POR CHIPS DE SEÇÕES (STICKY) */}
        <div className="sticky top-0 z-20 flex items-center overflow-x-auto border-b border-slate-800 bg-slate-950/95 backdrop-blur-md px-3 sm:px-6 py-2 gap-1.5 shrink-0 scrollbar-thin">
          {tacticalSections.map(s => {
            const Icon = s.icon;
            const isActive = activeSec === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollToSection(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 bg-slate-900 border border-slate-800'
                }`}
              >
                <Icon size={14} />
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Conteúdo Tático com Scroll Livre e Contínuo */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-2.5 sm:p-6 space-y-3 sm:space-y-6 text-xs sm:text-sm bg-slate-950/40 scroll-smooth"
        >

          {/* SEÇÃO A: IDENTIFICAÇÃO E POPULAÇÃO */}
          <div id="view-sec-A" className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg scroll-mt-3">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-sm sm:text-base mb-3 pb-2 border-b border-slate-800">
              <Users size={18} />
              <span>A. Identificação, Ocupação e População Prioritária</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                <span className="text-[11px] text-slate-400 block font-semibold">Ocupação (NT/CBMDF)</span>
                <span className="text-sm font-bold text-slate-100">{study.ocupacao || 'Não especificada'}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                <span className="text-[11px] text-slate-400 block font-semibold">População Fixa</span>
                <span className="text-sm font-bold text-slate-100">{study.populacaoFixa || 'Não informada'}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                <span className="text-[11px] text-slate-400 block font-semibold">População Flutuante</span>
                <span className="text-sm font-bold text-slate-100">{study.populacaoFlutuante || 'Não informada'}</span>
              </div>
            </div>

            {study.populacaoPrioritaria && (
              <div className="bg-red-950/40 border border-red-900/60 rounded-xl p-3.5 text-red-200 text-xs sm:text-sm flex items-start gap-2.5 mb-4">
                <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-red-300 font-bold block mb-0.5 uppercase tracking-wide">
                    🚨 PÚBLICO DE EVACUAÇÃO PRIORITÁRIA (SALVAMENTO IMEDIATO):
                  </strong>
                  <p className="leading-relaxed">{study.populacaoPrioritaria}</p>
                </div>
              </div>
            )}

            {/* Contatos com Discagem Rápida */}
            {study.contatos && study.contatos.length > 0 && (
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Contatos de Emergência (Discagem Direta):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {study.contatos.map((c, idx) => (
                    <div key={idx} className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[11px] text-emerald-400 font-bold block uppercase">{c.funcao || 'Contato'}</span>
                        <strong className="text-xs sm:text-sm text-slate-200 truncate block">{c.nome || 'Nome N/I'}</strong>
                        <span className="text-xs text-slate-400">{c.telefone || 'S/ Tel'}</span>
                      </div>
                      {c.telefone && (
                        <a
                          href={`tel:${c.telefone.replace(/\D/g, '')}`}
                          className="flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow transition-all active:scale-95 shrink-0"
                        >
                          <Phone size={14} />
                          <span>Ligar</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SEÇÃO B: ACESSIBILIDADE E SCI */}
          <div id="view-sec-B" className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg scroll-mt-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm sm:text-base mb-3 pb-2 border-b border-slate-800">
              <Truck size={18} />
              <span>B. Acessibilidade e Posicionamento do Trem de Socorro (SCI)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-[11px] text-emerald-400 font-bold block mb-1">🛣️ Via de Acesso Principal</span>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">{study.viaPrincipal || 'Não cadastrada'}</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-[11px] text-emerald-400 font-bold block mb-1">🔄 Via de Acesso Alternativa</span>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">{study.viaAlternativa || 'Não cadastrada'}</p>
              </div>
            </div>

            {study.restricoesViarias && (
              <div className="bg-amber-950/40 border border-amber-900/50 rounded-xl p-3 text-amber-200 text-xs sm:text-sm flex items-start gap-2.5 mb-4">
                <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-300 font-bold block mb-0.5">⚠️ RESTRIÇÕES VIÁRIAS, GABARITOS E PESO SUBTERRÂNEO:</strong>
                  <p className="leading-relaxed">{study.restricoesViarias}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-[11px] text-cyan-400 font-bold block mb-1">🚒 Estacionamento ABT (Combate)</span>
                <p className="text-xs text-slate-300">{study.posicionamentoABT || 'Não definido'}</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-[11px] text-cyan-400 font-bold block mb-1">🪜 Armação AET / Plataforma Aérea</span>
                <p className="text-xs text-slate-300">{study.posicionamentoAET || 'Não definido'}</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-[11px] text-emerald-400 font-bold block mb-1">🚩 Posto de Comando (PC) do SCI</span>
                <p className="text-xs text-slate-300">{study.postoComando || 'Não definido'}</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-[11px] text-red-400 font-bold block mb-1">🏥 Ponto ACV / Triagem START</span>
                <p className="text-xs text-slate-300">{study.acvStart || 'Não definido'}</p>
              </div>
            </div>
          </div>

          {/* SEÇÃO C: ABASTECIMENTO HÍDRICO */}
          <div id="view-sec-C" className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg scroll-mt-3">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm sm:text-base mb-3 pb-2 border-b border-slate-800">
              <Droplets size={18} />
              <span>C. Abastecimento Hídrico (Recursos de Extinção)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-[11px] text-cyan-400 font-bold block mb-1">💧 Reserva Técnica de Incêndio (RTI)</span>
                <p className="text-sm font-bold text-slate-100">{study.volumeRTI || 'Não informado'}</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-[11px] text-cyan-400 font-bold block mb-1">
                  🔌 Registro de Recalque ({study.registroRecalqueTipo || 'Passeio/Fachada'})
                </span>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">{study.registroRecalqueLocal || 'Local não cadastrado'}</p>
              </div>
            </div>

            {/* Hidrantes Urbanos de Coluna Próximos (Top 3 com Waze) */}
            <div className="mb-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Droplets size={14} className="text-cyan-400" />
                  <span>3 Hidrantes Urbanos de Coluna Mais Próximos (CAESB)</span>
                </span>
                <span className="text-[11px] text-cyan-400/90 font-medium">Navegação direta</span>
              </div>
              {hydrantsToDisplay && hydrantsToDisplay.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {hydrantsToDisplay.map((h, idx) => (
                    <div key={idx} className="bg-slate-950 border border-slate-800 hover:border-slate-700 p-3 rounded-xl flex flex-col justify-between gap-2.5 transition-all shadow-md">
                      <div>
                        <div className="flex items-center justify-between gap-1.5 mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <strong className="text-xs text-white font-mono">{h.codigo}</strong>
                            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${h.status === 'Operante' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' : 'bg-red-950 text-red-400 border border-red-500/40'}`}>
                              {h.status}
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30 shrink-0">
                            {h.distancia || 'Próx.'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-snug line-clamp-2" title={h.endereco}>
                          {h.endereco}
                        </p>
                      </div>
                      
                      {h.lat && h.lng ? (
                        <a
                          href={`https://waze.com/ul?ll=${h.lat},${h.lng}&navigate=yes`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-1.5 w-full py-1.5 px-2 bg-sky-950 hover:bg-sky-900 border border-sky-500/40 hover:border-sky-400 text-sky-300 rounded-lg text-xs font-bold transition-all active:scale-95 shadow"
                          title={`Navegar no Waze até o hidrante ${h.codigo}`}
                        >
                          <Navigation size={13} className="text-sky-400" />
                          <span>Navegar no Waze</span>
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-500 italic text-center py-1">Coordenada não informada</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic bg-slate-950 p-3 rounded-lg border border-slate-800">
                  Nenhum hidrante urbano específico associado.
                </p>
              )}
            </div>

            {study.mananciaisAlternativos && (
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
                <span className="text-cyan-300 font-bold block mb-0.5">🏊 Mananciais / Fontes Alternativas:</span>
                <p className="text-slate-300">{study.mananciaisAlternativos}</p>
              </div>
            )}
          </div>

          {/* SEÇÃO D: SISTEMAS DE PROTEÇÃO E PONTOS DE CORTE */}
          <div id="view-sec-D" className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg scroll-mt-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm sm:text-base mb-3 pb-2 border-b border-slate-800">
              <Zap size={18} />
              <span>D. Sistemas de Proteção Contra Incêndio e Pontos de Corte</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-950 p-3 rounded-lg border border-amber-900/40">
                <span className="text-[11px] text-amber-400 font-bold block mb-1">⚡ Chave Geral de Energia Elétrica</span>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">{study.chaveGeralEnergia || 'Não informada'}</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-amber-900/40">
                <span className="text-[11px] text-amber-400 font-bold block mb-1">🔥 Válvula Geral de Gás (GLP / GN)</span>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">{study.valvulaGeralGas || 'Não informada'}</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-[11px] text-cyan-400 font-bold block mb-1">🚿 Sprinklers & Válvula de Governo (VGA)</span>
                <p className="text-xs text-slate-300">{study.sprinklersVGA || 'Não informado'}</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-[11px] text-slate-400 font-bold block mb-1">🚪 Escadas de Emergência & Pressurização</span>
                <p className="text-xs text-slate-300">{study.escadasPressurizacao || 'Não informado'}</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 sm:col-span-2">
                <span className="text-[11px] text-slate-400 font-bold block mb-1">🔋 Grupo Gerador de Emergência</span>
                <p className="text-xs text-slate-300">{study.geradorEmergencia || 'Não informado'}</p>
              </div>
            </div>
          </div>

          {/* SEÇÃO E: RISCOS ESPECÍFICOS E CARGA DE INCÊNDIO */}
          <div id="view-sec-E" className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg scroll-mt-3">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm sm:text-base mb-3 pb-2 border-b border-slate-800">
              <Flame size={18} />
              <span>E. Riscos Específicos, Carga de Incêndio e Colapso Estrutural</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-950 p-3 rounded-lg border border-red-900/40">
                <span className="text-[11px] text-red-400 font-bold block mb-1">☣️ Produtos Perigosos / Químicos (ONU)</span>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">{study.produtosPerigosos || 'Nenhum cadastrado'}</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-red-900/40">
                <span className="text-[11px] text-amber-400 font-bold block mb-1">⚠️ Áreas Críticas Internas</span>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">{study.areasCriticas || 'Nenhuma informada'}</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 sm:col-span-2">
                <span className="text-[11px] text-slate-400 font-bold block mb-1">🏗️ Risco de Colapso Estrutural & Tipo Construtivo</span>
                <p className="text-xs text-slate-200 leading-relaxed">{study.riscoColapso || 'Estrutura não informada'}</p>
              </div>
            </div>
          </div>

          {/* SEÇÃO F: ARQUIVOS TÁTICOS ANEXOS (FACHADA E CROQUI) */}
          {(study.fotoFachada || study.croquiPlanta) && (
            <div id="view-sec-F" className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg scroll-mt-3">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm sm:text-base mb-3 pb-2 border-b border-slate-800">
                <Layers size={18} />
                <span>F. Visualizador de Croqui Tático e Fachada Principal</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {study.fotoFachada && (
                  <div>
                    <span className="text-xs font-bold text-slate-300 block mb-1.5">Foto da Fachada Principal:</span>
                    <button
                      type="button"
                      onClick={() => onOpenZoom(study.fotoFachada)}
                      className="w-full h-48 rounded-xl overflow-hidden border border-slate-700 relative group cursor-pointer shadow-lg"
                    >
                      <img src={study.fotoFachada} alt="Fachada" className="w-full h-full object-cover group-hover:scale-105 transition-all" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/90 text-white rounded-lg text-xs font-bold">
                          <Maximize2 size={14} /> Ampliar foto
                        </span>
                      </div>
                    </button>
                  </div>
                )}

                {study.croquiPlanta && (
                  <div>
                    <span className="text-xs font-bold text-slate-300 block mb-1.5">Croqui Tático / Planta Baixa:</span>
                    <button
                      type="button"
                      onClick={() => onOpenZoom(study.croquiPlanta)}
                      className="w-full h-48 rounded-xl overflow-hidden border border-slate-700 relative group cursor-pointer shadow-lg bg-slate-950"
                    >
                      <img src={study.croquiPlanta} alt="Croqui" className="w-full h-full object-contain group-hover:scale-105 transition-all" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/90 text-white rounded-lg text-xs font-bold">
                          <Maximize2 size={14} /> Ampliar croqui
                        </span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SEÇÃO G: INFORMAÇÕES EXTRAS E OBSERVAÇÕES OPERACIONAIS */}
          {study.informacoesExtras && (
            <div id="view-sec-G" className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg scroll-mt-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm sm:text-base mb-3 pb-2 border-b border-slate-800">
                <FileText size={18} />
                <span>G. Informações extras e observações operacionais</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                {study.informacoesExtras}
              </div>
            </div>
          )}

        </div>

        {/* Rodapé da Ficha Tática */}
        <div className="px-4 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm rounded-lg transition-all"
          >
            <Edit size={16} />
            <span>Editar dados da ficha</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm rounded-lg shadow-lg shadow-emerald-950/50 active:scale-95 transition-all"
          >
            Fechar ficha PREPOP
          </button>
        </div>

      </div>
    </div>
  );
}

// --------------------------------------------------------------------------------------
// FORMULÁRIO COMPLETO DE CADASTRO E EDIÇÃO DE EDIFICAÇÃO (PPO CBMDF)
// --------------------------------------------------------------------------------------
function BuildingStudyFormModal({ 
  isOpen, 
  onClose, 
  studyData, 
  onSave, 
  allHydrantes = [] 
}) {
  const [activeTab, setActiveTab] = useState('form-sec-A');
  const scrollContainerRef = useRef(null);

  const [formData, setFormData] = useState({
    id: studyData?.id || '',
    nomeFantasia: studyData?.nomeFantasia || '',
    razaoSocial: studyData?.razaoSocial || '',
    ra: studyData?.ra || 'Brasília',
    endereco: studyData?.endereco || '',
    cep: studyData?.cep || '',
    numLatitude: studyData?.numLatitude || '',
    numLongitude: studyData?.numLongitude || '',
    ocupacao: studyData?.ocupacao || 'Residencial',
    populacaoFixa: studyData?.populacaoFixa || '',
    populacaoFlutuante: studyData?.populacaoFlutuante || '',
    populacaoPrioritaria: studyData?.populacaoPrioritaria || '',
    contatos: studyData?.contatos || [
      { nome: '', funcao: 'Síndico / Administração', telefone: '' },
      { nome: '', funcao: 'Brigada / Segurança', telefone: '' }
    ],
    viaPrincipal: studyData?.viaPrincipal || '',
    viaAlternativa: studyData?.viaAlternativa || '',
    restricoesViarias: studyData?.restricoesViarias || '',
    posicionamentoABT: studyData?.posicionamentoABT || '',
    posicionamentoAET: studyData?.posicionamentoAET || '',
    postoComando: studyData?.postoComando || '',
    acvStart: studyData?.acvStart || '',
    volumeRTI: studyData?.volumeRTI || '',
    registroRecalqueTipo: studyData?.registroRecalqueTipo || 'Passeio',
    registroRecalqueLocal: studyData?.registroRecalqueLocal || '',
    hidrantesProximos: studyData?.hidrantesProximos || [],
    mananciaisAlternativos: studyData?.mananciaisAlternativos || '',
    chaveGeralEnergia: studyData?.chaveGeralEnergia || '',
    valvulaGeralGas: studyData?.valvulaGeralGas || '',
    sprinklersVGA: studyData?.sprinklersVGA || '',
    escadasPressurizacao: studyData?.escadasPressurizacao || '',
    geradorEmergencia: studyData?.geradorEmergencia || '',
    cargaIncendio: studyData?.cargaIncendio || 'Média',
    produtosPerigosos: studyData?.produtosPerigosos || '',
    areasCriticas: studyData?.areasCriticas || '',
    riscoColapso: studyData?.riscoColapso || '',
    fotoFachada: studyData?.fotoFachada || '',
    croquiPlanta: studyData?.croquiPlanta || '',
    informacoesExtras: studyData?.informacoesExtras || ''
  });

  const [formError, setFormError] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const lastAddedContactIndexRef = useRef(null);

  const formSections = [
    { id: 'form-sec-A', label: 'A. Identificação', icon: Building2 },
    { id: 'form-sec-B', label: 'B. Trem de socorro / SCI', icon: Truck },
    { id: 'form-sec-C', label: 'C. Recursos hídricos', icon: Droplets },
    { id: 'form-sec-D', label: 'D. Cortes & sistemas', icon: Zap },
    { id: 'form-sec-E', label: 'E. Riscos & carga', icon: Flame },
    { id: 'form-sec-F', label: 'F. Fotos & croquis', icon: Layers },
    { id: 'form-sec-G', label: 'G. Informações extras', icon: FileText }
  ];

  // Efeito para rolar suavemente até o novo contato adicionado e dar foco no campo
  useEffect(() => {
    if (lastAddedContactIndexRef.current !== null) {
      const idx = lastAddedContactIndexRef.current;
      lastAddedContactIndexRef.current = null;
      setTimeout(() => {
        const el = document.getElementById(`contact-row-${idx}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const firstInput = el.querySelector('input');
          if (firstInput) firstInput.focus();
        }
      }, 70);
    }
  }, [formData.contatos.length]);

  // Pular direto para uma determinada seção via navegação horizontal
  const scrollToFormSection = (secId) => {
    setActiveTab(secId);
    const container = scrollContainerRef.current;
    const target = document.getElementById(secId);
    if (container && target) {
      const topOffset = target.offsetTop - container.offsetTop;
      container.scrollTo({ top: topOffset, behavior: 'smooth' });
    }
  };

  // Scrollspy para atualizar chip ativo durante rolagem livre para cima e para baixo
  const handleFormScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const scrollPos = container.scrollTop + 70;
    for (let i = formSections.length - 1; i >= 0; i--) {
      const el = document.getElementById(formSections[i].id);
      if (el) {
        const topOffset = el.offsetTop - container.offsetTop;
        if (scrollPos >= topOffset) {
          setActiveTab(formSections[i].id);
          break;
        }
      }
    }
  };

  // Atualizar campo genérico
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Atualizar contatos
  const handleContactChange = (index, field, value) => {
    const updated = [...formData.contatos];
    updated[index] = { ...updated[index], [field]: value };
    setFormData(prev => ({ ...prev, contatos: updated }));
  };

  const handleAddContact = () => {
    const newIndex = formData.contatos.length;
    setFormData(prev => ({
      ...prev,
      contatos: [...prev.contatos, { nome: '', funcao: 'Contato Adicional', telefone: '' }]
    }));
    lastAddedContactIndexRef.current = newIndex;
  };

  const handleRemoveContact = (index) => {
    const updated = formData.contatos.filter((_, idx) => idx !== index);
    setFormData(prev => ({ ...prev, contatos: updated }));
  };

  // Puxar GPS do usuário
  const handleGetGPS = () => {
    if (!navigator.geolocation) {
      alert('Geolocalização não suportada no navegador.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        setFormData(prev => ({ ...prev, numLatitude: lat, numLongitude: lng }));
      },
      (err) => {
        alert(`Erro ao obter GPS: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Buscar automaticamente os 3 hidrantes mais próximos do Netuno
  const handleAutoFindHydrants = () => {
    const lat = parseFloat(formData.numLatitude);
    const lng = parseFloat(formData.numLongitude);
    if (!isValidDFCoordinate(lat, lng)) {
      alert('Preencha coordenadas válidas do DF (Latitude e Longitude) para localizar os hidrantes mais próximos.');
      return;
    }

    const nearest = findNearestHydrantsForBuilding(lat, lng, allHydrantes, 3);
    if (nearest.length === 0) {
      alert('Nenhum hidrante encontrado na base de dados próximo a esta coordenada.');
      return;
    }

    setFormData(prev => ({
      ...prev,
      hidrantesProximos: nearest.map(h => ({
        codigo: h.codigo,
        endereco: h.endereco,
        distancia: h.distancia,
        diametro: h.diametro,
        status: h.status,
        lat: h.lat,
        lng: h.lng
      }))
    }));
  };

  // Salvar rascunho / alterações e continuar na tela de edição
  const handleQuickSave = () => {
    if (!formData.nomeFantasia.trim()) {
      setFormError('O Nome Fantasia / Popular da edificação é obrigatório para salvar.');
      scrollToFormSection('form-sec-A');
      return;
    }
    if (!formData.endereco.trim()) {
      setFormError('O Endereço da edificação é obrigatório para salvar.');
      scrollToFormSection('form-sec-A');
      return;
    }

    setIsSaving(true);
    setFormError('');
    const res = onSave(formData, true);
    if (res && res.studyId && !formData.id) {
      setFormData(prev => ({ ...prev, id: res.studyId }));
    }
    setIsSaving(false);
    setSaveSuccessMsg('✅ Alterações salvas com sucesso! Você pode continuar adicionando o restante das informações.');
    setTimeout(() => setSaveSuccessMsg(''), 4500);
  };

  // Upload e compressão de imagem via Canvas (WebP/JPEG max 120KB)
  const handleImageUpload = (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressed = canvas.toDataURL('image/jpeg', 0.75);
        setFormData(prev => ({ ...prev, [field]: compressed }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Validação e envio
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.nomeFantasia.trim()) {
      setFormError('O Nome Fantasia / Popular da edificação é obrigatório.');
      scrollToFormSection('form-sec-A');
      return;
    }
    if (!formData.endereco.trim()) {
      setFormError('O Endereço da edificação é obrigatório.');
      scrollToFormSection('form-sec-A');
      return;
    }

    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-[190] bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl h-[94vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        {/* Topo do Formulário */}
        <div className="px-3 py-2.5 sm:px-6 sm:py-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-xl font-bold text-white flex items-center gap-2 leading-tight">
              <Building2 size={20} className="text-emerald-400 shrink-0" />
              <span>{studyData?.id ? 'Editar Estudo PREPOP' : 'Novo Estudo PREPOP'}</span>
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-400 leading-tight mt-0.5">
              Preencha com calma e salve quando desejar
            </p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleQuickSave}
              disabled={isSaving}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm rounded-lg shadow-lg shadow-emerald-950/50 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
              title="Salvar alterações no banco e continuar editando nesta mesma tela"
            >
              <CheckCircle2 size={15} className="shrink-0" />
              <span>Salvar e continuar</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-lg transition-all"
              title="Fechar formulário"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* BARRA DE NAVEGAÇÃO HORIZONTAL POR CHIPS DE SEÇÕES (STICKY NO FORMULÁRIO) */}
        <div className="sticky top-0 z-20 flex items-center justify-between overflow-x-auto border-b border-slate-800 bg-slate-950/95 backdrop-blur-md px-2 sm:px-4 py-2 gap-1.5 shrink-0 scrollbar-thin">
          <div className="flex items-center gap-1.5 min-w-max">
            {formSections.map(t => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => scrollToFormSection(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    isActive 
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 bg-slate-900 border border-slate-800'
                  }`}
                >
                  <Icon size={14} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleQuickSave}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-emerald-700/80 hover:bg-emerald-600 border border-emerald-500/50 text-white text-xs font-bold rounded-lg shadow shrink-0 active:scale-95 transition-all ml-2"
            title="Salvar alterações sem fechar a tela"
          >
            <CheckCircle2 size={13} />
            <span>Salvar rascunho</span>
          </button>
        </div>

        {/* Mensagem de Feedback de Sucesso ao Salvar e Continuar */}
        {saveSuccessMsg && (
          <div className="mx-4 mt-3 px-3.5 py-2.5 bg-emerald-950/90 border border-emerald-500/60 rounded-xl text-xs sm:text-sm text-emerald-200 flex items-center justify-between shadow-xl animate-fadeIn shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
              <span className="font-semibold">{saveSuccessMsg}</span>
            </div>
            <button 
              type="button" 
              onClick={() => setSaveSuccessMsg('')} 
              className="text-emerald-400 hover:text-emerald-200 font-bold ml-2 text-sm p-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Mensagem de Erro de Validação */}
        {formError && (
          <div className="mx-4 mt-3 px-3 py-2 bg-red-950 border border-red-500/50 rounded-lg text-xs text-red-200 flex items-center justify-between shrink-0">
            <span>{formError}</span>
            <button type="button" onClick={() => setFormError('')} className="text-red-400 font-bold ml-2">✕</button>
          </div>
        )}

        {/* CORPO DO FORMULÁRIO COM ROLAGEM VERTICAL CONTÍNUA E LIVRE */}
        <form 
          onSubmit={handleSubmit} 
          ref={scrollContainerRef}
          onScroll={handleFormScroll}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs sm:text-sm scroll-smooth"
        >

          {/* ========================================================================= */}
          {/* SEÇÃO A: IDENTIFICAÇÃO E RECONHECIMENTO */}
          {/* ========================================================================= */}
          <div id="form-sec-A" className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4 scroll-mt-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm sm:text-base pb-2 border-b border-slate-800">
              <Building2 size={18} />
              <span>A. Identificação, Ocupação e Contatos</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Nome Fantasia / Popular da Edificação <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.nomeFantasia}
                  onChange={(e) => handleChange('nomeFantasia', e.target.value)}
                  placeholder="Ex: Hospital de Base do DF, JK Shopping, Ed. Venâncio"
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 rounded-xl text-slate-100 placeholder-slate-500 outline-none transition-all text-xs sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Razão Social / Condomínio</label>
                <input
                  type="text"
                  value={formData.razaoSocial}
                  onChange={(e) => handleChange('razaoSocial', e.target.value)}
                  placeholder="Ex: Instituto de Gestão Estratégica de Saúde"
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 rounded-xl text-slate-100 placeholder-slate-500 outline-none transition-all text-xs sm:text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Cidade / Região Administrativa (RA)</label>
                <select
                  value={formData.ra}
                  onChange={(e) => handleChange('ra', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 rounded-xl text-slate-100 outline-none transition-all text-xs sm:text-sm cursor-pointer"
                >
                  {RA_LIST.map(ra => (
                    <option key={ra.name} value={ra.name}>{ra.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Classificação de Ocupação (NT/CBMDF)</label>
                <select
                  value={formData.ocupacao}
                  onChange={(e) => handleChange('ocupacao', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 rounded-xl text-slate-100 outline-none transition-all text-xs sm:text-sm cursor-pointer"
                >
                  {OCCUPANCY_TYPES.map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">CEP</label>
                <input
                  type="text"
                  value={formData.cep}
                  onChange={(e) => handleChange('cep', e.target.value)}
                  placeholder="70000-000"
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 rounded-xl text-slate-100 placeholder-slate-500 outline-none transition-all text-xs sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Endereço Completo Padronizado <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.endereco}
                onChange={(e) => handleChange('endereco', e.target.value)}
                placeholder="Quadra, Bloco, Lote, Setor, Ponto de Referência"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 rounded-xl text-slate-100 placeholder-slate-500 outline-none transition-all text-xs sm:text-sm"
              />
            </div>

            {/* Coordenadas com Botão de GPS */}
            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-400">Coordenadas Geográficas (Lat/Lng)</span>
                <button
                  type="button"
                  onClick={handleGetGPS}
                  className="flex items-center gap-1 px-3 py-1.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 rounded-lg text-xs font-semibold active:scale-95 transition-all"
                >
                  <LocateFixed size={14} />
                  <span>Puxar meu GPS</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.numLatitude}
                    onChange={(e) => handleChange('numLatitude', e.target.value)}
                    placeholder="-15.797400"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 font-mono text-xs outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.numLongitude}
                    onChange={(e) => handleChange('numLongitude', e.target.value)}
                    placeholder="-47.886200"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 font-mono text-xs outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>

            {/* População e Evacuação Prioritária */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">População Fixa Estimada</label>
                <input
                  type="text"
                  value={formData.populacaoFixa}
                  onChange={(e) => handleChange('populacaoFixa', e.target.value)}
                  placeholder="Ex: 500 moradores / 1.200 funcionários"
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 rounded-xl text-slate-100 placeholder-slate-500 outline-none text-xs sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">População Flutuante Estimada</label>
                <input
                  type="text"
                  value={formData.populacaoFlutuante}
                  onChange={(e) => handleChange('populacaoFlutuante', e.target.value)}
                  placeholder="Ex: 10.000 clientes/dia"
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 rounded-xl text-slate-100 placeholder-slate-500 outline-none text-xs sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-red-400 font-bold mb-1">
                🚨 Presença de Público de Evacuação Prioritária (Salas Críticas / PCDs)
              </label>
              <textarea
                rows={3}
                value={formData.populacaoPrioritaria}
                onChange={(e) => handleChange('populacaoPrioritaria', e.target.value)}
                placeholder="Ex: UTIs no 2º andar, ala de queimados, creche no piso térreo, acamados, idosos, cadeirantes..."
                className="w-full p-3 bg-slate-800 border border-red-900/60 focus:border-red-500 focus:ring-2 focus:ring-red-500/30 rounded-xl text-slate-100 placeholder-slate-500 outline-none text-xs sm:text-sm min-h-[90px] focus:min-h-[140px] transition-all duration-200 resize-y leading-relaxed"
              />
            </div>

            {/* Contatos de Emergência */}
            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400">Contatos de Emergência (Discagem Rápida)</span>
                <button
                  type="button"
                  onClick={handleAddContact}
                  className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-bold active:scale-95 transition-all"
                >
                  + Adicionar contato
                </button>
              </div>
              {formData.contatos.map((c, idx) => (
                <div key={idx} id={`contact-row-${idx}`} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800 transition-all scroll-mt-20">
                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      placeholder="Função (ex: Síndico, Brigada)"
                      value={c.funcao}
                      onChange={(e) => handleContactChange(idx, 'funcao', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      placeholder="Nome do Responsável"
                      value={c.nome}
                      onChange={(e) => handleContactChange(idx, 'nome', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      type="text"
                      placeholder="Telefone (61) 9999-9999"
                      value={c.telefone}
                      onChange={(e) => handleContactChange(idx, 'telefone', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="sm:col-span-1 text-right">
                    {formData.contatos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveContact(idx)}
                        className="text-red-400 hover:text-red-300 p-1.5 hover:bg-red-950/40 rounded-lg transition-colors"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SEÇÃO B: ACESSIBILIDADE E SCI */}
          {/* ========================================================================= */}
          <div id="form-sec-B" className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4 scroll-mt-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm sm:text-base pb-2 border-b border-slate-800">
              <Truck size={18} />
              <span>B. Acessibilidade e Posicionamento do Trem de Socorro (SCI)</span>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Via de Acesso Principal para Viaturas</label>
              <textarea
                rows={2}
                value={formData.viaPrincipal}
                onChange={(e) => handleChange('viaPrincipal', e.target.value)}
                placeholder="Ex: Acesso pela W3 Sul, portaria principal sem desnível, portão com 4 metros livres"
                className="w-full p-3 bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 rounded-xl text-slate-100 placeholder-slate-500 outline-none text-xs sm:text-sm min-h-[85px] focus:min-h-[130px] transition-all duration-200 resize-y leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Via de Acesso Alternativa (Desvio / Traseira)</label>
              <textarea
                rows={2}
                value={formData.viaAlternativa}
                onChange={(e) => handleChange('viaAlternativa', e.target.value)}
                placeholder="Ex: Acesso pela L2 Sul, portão de carga e descarga nos fundos"
                className="w-full p-3 bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 rounded-xl text-slate-100 placeholder-slate-500 outline-none text-xs sm:text-sm min-h-[85px] focus:min-h-[130px] transition-all duration-200 resize-y leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-amber-400 font-bold mb-1">
                ⚠️ Restrições Viárias, Gabaritos e Limite de Carga Estrutural
              </label>
              <textarea
                rows={2}
                value={formData.restricoesViarias}
                onChange={(e) => handleChange('restricoesViarias', e.target.value)}
                placeholder="Ex: Limite de 10 ton na laje do subsolo, portão estreito com 3.20m de largura, fiação suspensa na lateral leste"
                className="w-full p-3 bg-slate-800 border border-amber-900/60 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 rounded-xl text-slate-100 placeholder-slate-500 outline-none text-xs sm:text-sm min-h-[85px] focus:min-h-[130px] transition-all duration-200 resize-y leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-cyan-400 font-semibold mb-1">Posicionamento Viatura de Combate (ABT)</label>
                <textarea
                  rows={2}
                  value={formData.posicionamentoABT}
                  onChange={(e) => handleChange('posicionamentoABT', e.target.value)}
                  placeholder="Ex: Estacionamento frontal livre, alinhado à fachada oeste"
                  className="w-full p-3 bg-slate-800 border border-slate-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 rounded-xl text-slate-100 placeholder-slate-500 outline-none text-xs sm:text-sm min-h-[85px] focus:min-h-[130px] transition-all duration-200 resize-y"
                />
              </div>
              <div>
                <label className="block text-cyan-400 font-semibold mb-1">Armação Viatura Aérea (AET / Plataforma)</label>
                <textarea
                  rows={2}
                  value={formData.posicionamentoAET}
                  onChange={(e) => handleChange('posicionamentoAET', e.target.value)}
                  placeholder="Ex: Esplanada norte, piso reforçado, ângulo de 360° livre"
                  className="w-full p-3 bg-slate-800 border border-slate-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 rounded-xl text-slate-100 placeholder-slate-500 outline-none text-xs sm:text-sm min-h-[85px] focus:min-h-[130px] transition-all duration-200 resize-y"
                />
              </div>
              <div>
                <label className="block text-emerald-400 font-semibold mb-1">Ponto de Montagem do Posto de Comando (PC)</label>
                <textarea
                  rows={2}
                  value={formData.postoComando}
                  onChange={(e) => handleChange('postoComando', e.target.value)}
                  placeholder="Ex: Canteiro central oposto à fachada com visão de 3 lados"
                  className="w-full p-3 bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 rounded-xl text-slate-100 placeholder-slate-500 outline-none text-xs sm:text-sm min-h-[85px] focus:min-h-[130px] transition-all duration-200 resize-y"
                />
              </div>
              <div>
                <label className="block text-red-400 font-semibold mb-1">Área de Vítimas (ACV) e Triagem START</label>
                <textarea
                  rows={2}
                  value={formData.acvStart}
                  onChange={(e) => handleChange('acvStart', e.target.value)}
                  placeholder="Ex: Praça de convivência aberta ou quadra poliesportiva lateral"
                  className="w-full p-3 bg-slate-800 border border-slate-700 focus:border-red-500 focus:ring-2 focus:ring-red-500/30 rounded-xl text-slate-100 placeholder-slate-500 outline-none text-xs sm:text-sm min-h-[85px] focus:min-h-[130px] transition-all duration-200 resize-y"
                />
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SEÇÃO C: RECURSOS HÍDRICOS */}
          {/* ========================================================================= */}
          <div id="form-sec-C" className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4 scroll-mt-2">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm sm:text-base pb-2 border-b border-slate-800">
              <Droplets size={18} />
              <span>C. Abastecimento Hídrico (Recursos de Extinção)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Reserva Técnica de Incêndio (RTI)</label>
                <input
                  type="text"
                  value={formData.volumeRTI}
                  onChange={(e) => handleChange('volumeRTI', e.target.value)}
                  placeholder="Ex: 80.000 Litros (80 m³)"
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 rounded-xl text-slate-100 outline-none text-xs sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Tipo do Registro de Recalque</label>
                <select
                  value={formData.registroRecalqueTipo}
                  onChange={(e) => handleChange('registroRecalqueTipo', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 rounded-xl text-slate-100 outline-none text-xs sm:text-sm cursor-pointer"
                >
                  <option value="Passeio">Passeio (Caixa no piso da calçada)</option>
                  <option value="Fachada">Fachada (Parede da edificação)</option>
                  <option value="Misto">Ambos (Passeio e Fachada)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Localização Exata do Registro de Recalque</label>
              <textarea
                rows={2}
                value={formData.registroRecalqueLocal}
                onChange={(e) => handleChange('registroRecalqueLocal', e.target.value)}
                placeholder="Ex: Calçada frontal, 5 metros à esquerda da entrada principal, tampa metálica vermelha"
                className="w-full p-3 bg-slate-800 border border-slate-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 rounded-xl text-slate-100 placeholder-slate-500 outline-none text-xs sm:text-sm min-h-[85px] focus:min-h-[130px] transition-all duration-200 resize-y"
              />
            </div>

            {/* Hidrantes CAESB com Busca Automática */}
            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-cyan-400">
                  3 Hidrantes Urbanos CAESB Mais Próximos (Com Waze)
                </span>
                <button
                  type="button"
                  onClick={handleAutoFindHydrants}
                  className="px-3 py-1.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 rounded-lg text-xs font-bold active:scale-95 transition-all"
                >
                  🔍 Buscar 3 mais próximos automaticamente
                </button>
              </div>

              {formData.hidrantesProximos.length > 0 ? (
                <div className="space-y-2">
                  {formData.hidrantesProximos.map((h, idx) => (
                    <div key={idx} className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <strong className="text-white font-mono">{h.codigo}</strong>
                          <span className={`px-1.5 py-0.2 text-[10px] font-bold rounded ${h.status === 'Operante' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' : 'bg-red-950 text-red-400 border border-red-500/40'}`}>
                            {h.status || 'Operante'}
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px] truncate mt-0.5">{h.endereco}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-cyan-300 font-bold bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/30">
                          {h.distancia}
                        </span>
                        {h.lat && h.lng && (
                          <a
                            href={`https://waze.com/ul?ll=${h.lat},${h.lng}&navigate=yes`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 bg-sky-950 hover:bg-sky-900 border border-sky-500/40 text-sky-300 rounded-lg text-xs font-bold transition-all shadow"
                            title={`Abrir Waze para ${h.codigo}`}
                          >
                            <Navigation size={13} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  Nenhum hidrante vinculado. Clique no botão acima para preencher automaticamente com base nas coordenadas preenchidas na Seção A.
                </p>
              )}
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Mananciais e Fontes Alternativas na Vizinhança</label>
              <textarea
                rows={2}
                value={formData.mananciaisAlternativos}
                onChange={(e) => handleChange('mananciaisAlternativos', e.target.value)}
                placeholder="Ex: Piscina do clube a 150m (capacidade 200m³), espelho d'água frontal acessível com mangote de sucção"
                className="w-full p-3 bg-slate-800 border border-slate-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 rounded-xl text-slate-100 placeholder-slate-500 outline-none text-xs sm:text-sm min-h-[85px] focus:min-h-[130px] transition-all duration-200 resize-y"
              />
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SEÇÃO D: CORTES E SISTEMAS */}
          {/* ========================================================================= */}
          <div id="form-sec-D" className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4 scroll-mt-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm sm:text-base pb-2 border-b border-slate-800">
              <Zap size={18} />
              <span>D. Sistemas de Proteção Contra Incêndio e Pontos de Corte</span>
            </div>

            <div>
              <label className="block text-amber-400 font-bold mb-1">⚡ Chave Geral de Energia Elétrica (QDG / Subestação)</label>
              <textarea
                rows={2}
                value={formData.chaveGeralEnergia}
                onChange={(e) => handleChange('chaveGeralEnergia', e.target.value)}
                placeholder="Ex: Subestação no 1º Subsolo. Procedimento de corte no painel QGBT-01 na sala de comando"
                className="w-full p-3 bg-slate-800 border border-amber-900/60 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 rounded-xl text-slate-100 placeholder-slate-500 outline-none text-xs sm:text-sm min-h-[85px] focus:min-h-[130px] transition-all duration-200 resize-y"
              />
            </div>

            <div>
              <label className="block text-amber-400 font-bold mb-1">🔥 Válvula Geral de Gás (Central de GLP / Gás Natural)</label>
              <textarea
                rows={2}
                value={formData.valvulaGeralGas}
                onChange={(e) => handleChange('valvulaGeralGas', e.target.value)}
                placeholder="Ex: Central externa no pátio traseiro. Válvula esfera amarela com corte manual rápido"
                className="w-full p-3 bg-slate-800 border border-amber-900/60 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 rounded-xl text-slate-100 placeholder-slate-500 outline-none text-xs sm:text-sm min-h-[85px] focus:min-h-[130px] transition-all duration-200 resize-y"
              />
            </div>

            <div>
              <label className="block text-cyan-400 font-semibold mb-1">Chuveiros Automáticos (Sprinklers) e Localização da VGA</label>
              <textarea
                rows={2}
                value={formData.sprinklersVGA}
                onChange={(e) => handleChange('sprinklersVGA', e.target.value)}
                placeholder="Ex: Presente em todos os pisos. VGA no Subsolo 1 corredor técnico"
                className="w-full p-3 bg-slate-800 border border-slate-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 rounded-xl text-slate-100 placeholder-slate-500 outline-none text-xs sm:text-sm min-h-[85px] focus:min-h-[130px] transition-all duration-200 resize-y"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Escadas de Emergência e Pressurização / Exaustão</label>
              <textarea
                rows={2}
                value={formData.escadasPressurizacao}
                onChange={(e) => handleChange('escadasPressurizacao', e.target.value)}
                placeholder="Ex: 2 Caixas de escadas enclausuradas e pressurizadas com acionamento automático por detectores"
                className="w-full p-3 bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 rounded-xl text-slate-100 placeholder-slate-500 outline-none text-xs sm:text-sm min-h-[85px] focus:min-h-[130px] transition-all duration-200 resize-y"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Grupo Gerador de Emergência</label>
              <textarea
                rows={2}
                value={formData.geradorEmergencia}
                onChange={(e) => handleChange('geradorEmergencia', e.target.value)}
                placeholder="Ex: Gerador 500 kVA a Diesel no Subsolo 2 com tanque de 300L"
                className="w-full p-3 bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 rounded-xl text-slate-100 placeholder-slate-500 outline-none text-xs sm:text-sm min-h-[85px] focus:min-h-[130px] transition-all duration-200 resize-y"
              />
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SEÇÃO E: RISCOS E CARGA DE INCÊNDIO */}
          {/* ========================================================================= */}
          <div id="form-sec-E" className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4 scroll-mt-2">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm sm:text-base pb-2 border-b border-slate-800">
              <Flame size={18} />
              <span>E. Riscos Específicos, Carga de Incêndio e Colapso Estrutural</span>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Classificação da Carga de Incêndio</label>
              <select
                value={formData.cargaIncendio}
                onChange={(e) => handleChange('cargaIncendio', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 focus:border-red-500 focus:ring-2 focus:ring-red-500/30 rounded-xl text-slate-100 font-bold outline-none text-xs sm:text-sm cursor-pointer"
              >
                <option value="Baixa">Baixa (&lt; 300 MJ/m²)</option>
                <option value="Média">Média (300 a 1.200 MJ/m²)</option>
                <option value="Alta">Alta (&gt; 1.200 MJ/m² - Crítica)</option>
              </select>
            </div>

            <div>
              <label className="block text-red-400 font-bold mb-1">☣️ Presença de Produtos Perigosos / Químicos (ONU)</label>
              <textarea
                rows={2}
                value={formData.produtosPerigosos}
                onChange={(e) => handleChange('produtosPerigosos', e.target.value)}
                placeholder="Ex: Tanque criogênico de Oxigênio Líquido (10.000m³), Depósito de Álcool 70% no Almoxarifado"
                className="w-full p-3 bg-slate-800 border border-red-900/60 focus:border-red-500 focus:ring-2 focus:ring-red-500/30 rounded-xl text-slate-100 placeholder-slate-500 outline-none text-xs sm:text-sm min-h-[85px] focus:min-h-[130px] transition-all duration-200 resize-y leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-amber-400 font-bold mb-1">⚠️ Áreas Críticas Internas</label>
              <textarea
                rows={2}
                value={formData.areasCriticas}
                onChange={(e) => handleChange('areasCriticas', e.target.value)}
                placeholder="Ex: Cozinha industrial com dutos de exaustão de gordura, depósito de lixo, caldeiras"
                className="w-full p-3 bg-slate-800 border border-amber-900/60 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 rounded-xl text-slate-100 placeholder-slate-500 outline-none text-xs sm:text-sm min-h-[85px] focus:min-h-[130px] transition-all duration-200 resize-y leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Risco de Colapso Estrutural e Tipologia Construtiva</label>
              <textarea
                rows={2}
                value={formData.riscoColapso}
                onChange={(e) => handleChange('riscoColapso', e.target.value)}
                placeholder="Ex: Estrutura em concreto armado, cobertura metálica sem proteção passiva na praça central"
                className="w-full p-3 bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 rounded-xl text-slate-100 placeholder-slate-500 outline-none text-xs sm:text-sm min-h-[85px] focus:min-h-[130px] transition-all duration-200 resize-y leading-relaxed"
              />
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SEÇÃO F: ARQUIVOS TÁTICOS (FACHADA E CROQUI) */}
          {/* ========================================================================= */}
          <div id="form-sec-F" className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4 scroll-mt-2">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm sm:text-base pb-2 border-b border-slate-800">
              <Layers size={18} />
              <span>F. Anexo de Fotos da Fachada e Croqui Tático</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Foto da Fachada */}
              <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
                <span className="text-xs font-bold text-slate-200 block mb-2">Foto da Fachada Principal (Reconhecimento)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'fotoFachada')}
                  className="text-xs text-slate-400 mb-3 block w-full file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700"
                />
                {formData.fotoFachada ? (
                  <div className="relative h-44 rounded-xl overflow-hidden border border-slate-700 shadow-md">
                    <img src={formData.fotoFachada} alt="Fachada" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleChange('fotoFachada', '')}
                      className="absolute top-2 right-2 bg-red-600/90 hover:bg-red-500 text-white rounded-lg px-2.5 py-1 text-xs font-bold shadow-lg transition-all"
                    >
                      ✕ Remover
                    </button>
                  </div>
                ) : (
                  <div className="h-44 border border-dashed border-slate-800 rounded-xl flex items-center justify-center text-xs text-slate-500 bg-slate-950/40">
                    Nenhuma foto da fachada anexada
                  </div>
                )}
              </div>

              {/* Croqui Tático */}
              <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
                <span className="text-xs font-bold text-slate-200 block mb-2">Croqui Tático / Planta Baixa</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'croquiPlanta')}
                  className="text-xs text-slate-400 mb-3 block w-full file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700"
                />
                {formData.croquiPlanta ? (
                  <div className="relative h-44 rounded-xl overflow-hidden border border-slate-700 shadow-md">
                    <img src={formData.croquiPlanta} alt="Croqui" className="w-full h-full object-contain bg-slate-950" />
                    <button
                      type="button"
                      onClick={() => handleChange('croquiPlanta', '')}
                      className="absolute top-2 right-2 bg-red-600/90 hover:bg-red-500 text-white rounded-lg px-2.5 py-1 text-xs font-bold shadow-lg transition-all"
                    >
                      ✕ Remover
                    </button>
                  </div>
                ) : (
                  <div className="h-44 border border-dashed border-slate-800 rounded-xl flex items-center justify-center text-xs text-slate-500 bg-slate-950/40">
                    Nenhum croqui tático anexado
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SEÇÃO G: INFORMAÇÕES EXTRAS E OBSERVAÇÕES OPERACIONAIS */}
          {/* ========================================================================= */}
          <div id="form-sec-G" className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4 scroll-mt-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm sm:text-base pb-2 border-b border-slate-800">
              <FileText size={18} />
              <span>G. Informações Extras e Observações Complementares</span>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Informações Extras, Particularidades e Instruções da Guarnição
              </label>
              <textarea
                rows={4}
                value={formData.informacoesExtras}
                onChange={(e) => handleChange('informacoesExtras', e.target.value)}
                placeholder="Registre quaisquer detalhes operacionais adicionais importantes: instruções de acesso, chaves mestres, histórico de ocorrências/sinistros, particularidades estruturais, contatos complementares, orientações para socorristas, observações das vistorias anteriores..."
                className="w-full p-3.5 bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 rounded-xl text-slate-100 placeholder-slate-500 outline-none text-xs sm:text-sm min-h-[110px] focus:min-h-[180px] transition-all duration-200 resize-y leading-relaxed"
              />
            </div>
          </div>

          {/* Rodapé do Modal de Formulário com Botão Salvar */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-950/50 text-xs sm:text-sm active:scale-95 transition-all"
            >
              Finalizar ficha PREPOP
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
