import React, { useState } from 'react';
import { History, ShieldAlert, CheckCircle2, AlertTriangle, User, Calendar, X, ArrowLeft, ZoomIn } from 'lucide-react';
import { fixEncoding } from '../utils/encoding';

/**
 * Utilitário para formatar datas no padrão brasileiro
 */
const formatDateTime = (val) => {
  if (!val || val === '-') return 'Não informado';
  return String(val);
};

/**
 * InspectionHistoryModal
 * Modal exclusivo para perfis Gestor e Administrador para consultar
 * e auditar o histórico completo de vistorias anteriores de um hidrante.
 */
const InspectionHistoryModal = ({ hidrante, onClose, currentUser }) => {
  const [fullscreenPhoto, setFullscreenPhoto] = useState(null);

  if (!hidrante) return null;

  const isGestor = currentUser?.role === 'gestor' || currentUser?.role === 'admin';

  // Se não for gestor/admin, bloqueia acesso imediato
  if (!isGestor) {
    return (
      <div className="fixed inset-0 z-[1200] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-red-500/50 rounded-2xl p-6 max-w-md w-full text-center shadow-2xl">
          <ShieldAlert className="w-14 h-14 text-red-400 mx-auto mb-3 animate-pulse" />
          <h3 className="text-lg font-bold text-white mb-2">Acesso Restrito à Gestão</h3>
          <p className="text-sm text-slate-300 mb-6">
            O histórico de vistorias anteriores contém registros de auditoria interna restritos a Gestores e Administradores do CBMDF.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  // Extrair histórico completo
  const rawHistorico = Array.isArray(hidrante.HISTORICO_VISTORIAS) ? hidrante.HISTORICO_VISTORIAS : [];

  // Dados da Vistoria Vigente (Atual) - Regida pelos campos raiz do hidrante
  const vistoriaVigente = {
    datHoraVistoria: hidrante.datHoraUltimaVistoria || 'Sem registro de data',
    flgAtivo: hidrante.flgAtivo,
    problemasHidrante: hidrante.problemasHidrante || '',
    dscObservacao: hidrante.dscObservacao || hidrante.observacoes || hidrante.obsVistoria || '',
    vistoriadorNome: hidrante.vistoriadorNome || 'Militar Vistoriador',
    vistoriadorMatricula: hidrante.vistoriadorMatricula || '-',
    fotoVistoria: hidrante.fotoVistoria || null,
    fotosVistoria: Array.isArray(hidrante.fotosVistoria) && hidrante.fotosVistoria.length > 0 
      ? hidrante.fotosVistoria 
      : (hidrante.fotoVistoria ? [hidrante.fotoVistoria] : [])
  };

  // Vistorias anteriores arquivadas:
  // Se houver histórico salvo, as vistorias anteriores são os itens exceto a última que corresponde à vigente.
  // Caso o histórico tenha N itens (onde o último é a vigente), pegamos os itens de 0 a N-2 (revertidos).
  // Se o histórico tiver apenas 1 item e ele for idêntico à vigente, vistoriasAnteriores fica vazio.
  let vistoriasAnteriores = [];
  if (rawHistorico.length > 1) {
    // Todos exceto o último, ordenados do mais recente passado para o mais antigo
    vistoriasAnteriores = rawHistorico.slice(0, rawHistorico.length - 1).reverse();
  } else if (rawHistorico.length === 1) {
    const item = rawHistorico[0];
    // Se o único item tiver data diferente da vistoria vigente atual, ele é um registro anterior
    if (item.datHoraVistoria && item.datHoraVistoria !== hidrante.datHoraUltimaVistoria) {
      vistoriasAnteriores = [item];
    }
  }

  const codFormatado = fixEncoding(hidrante.nomHidrante) || hidrante.codHidrante || 'HIDRANTE';
  const raFormatada = fixEncoding(hidrante.dscLocalidade) || 'DF';
  const endFormatado = fixEncoding(hidrante.dscEndereco) || 'Endereço não cadastrado';

  return (
    <div 
      className="fixed inset-0 z-[1200] bg-black/85 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900/98 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABEÇALHO PADRÃO NETUNO */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/60 shrink-0 flex items-center gap-1 text-xs font-semibold"
              title="Voltar"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Voltar</span>
            </button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/30 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-sm">
              <History size={19} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight leading-tight truncate">
                  Histórico de Vistorias
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-[10px] uppercase tracking-wider shrink-0">
                  Auditoria de Gestão
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium truncate mt-0.5">
                <strong className="text-slate-200">{codFormatado}</strong> • {raFormatada} • {endFormatado}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors border border-slate-700/60 shrink-0 ml-2"
            title="Fechar"
          >
            <X size={17} />
          </button>
        </div>

        {/* CORPO ROLÁVEL COM AVISO DE AUDITORIA E LINHA DO TEMPO */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* BANNER DE ALERTA DE SEGURANÇA OPERACIONAL (ANTI-CONFUSÃO) */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/50 text-amber-200 text-xs shadow-sm flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-amber-300 font-bold block mb-0.5 uppercase tracking-wide text-[11px]">
                Atenção - Registros Históricos Arquivados (Não Vigentes):
              </strong>
              <span>
                As vistorias anteriores listadas abaixo são de caráter estritamente histórico para auditoria. 
                Elas <strong>NÃO refletem a condição operacional atual</strong> deste hidrante. 
                O mapa tático, os filtros de busca e os relatórios operacionais utilizam exclusivamente a 
                <strong className="text-emerald-300"> Vistoria Vigente Atual</strong> no topo.
              </span>
            </div>
          </div>

          {/* SEÇÃO 1: VISTORIA VIGENTE ATUAL (SOBREPOSTA E ATIVA) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse inline-block"></span>
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  Vistoria Vigente Atual (Regra em Vigor)
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                Governa mapa e consultas
              </span>
            </div>

            <div className={`rounded-xl p-3.5 sm:p-4 border shadow-md transition-all ${
              vistoriaVigente.flgAtivo 
                ? 'bg-emerald-950/30 border-emerald-500/50 shadow-emerald-950/20' 
                : 'bg-red-950/30 border-red-500/50 shadow-red-950/20'
            }`}>
              {/* Topo do Card Vigente: Data, Status e Vistoriador */}
              <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5 mb-2.5">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 font-bold">
                    <Calendar size={14} className="text-emerald-400 shrink-0" />
                    <span>Realizada em: {formatDateTime(vistoriaVigente.datHoraVistoria)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
                    <User size={13} className="text-slate-400 shrink-0" />
                    <span>Militar: <strong className="text-slate-200">{vistoriaVigente.vistoriadorNome}</strong> ({vistoriaVigente.vistoriadorMatricula})</span>
                  </div>
                </div>

                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black tracking-wide border shrink-0 shadow-sm ${
                  vistoriaVigente.flgAtivo 
                    ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60' 
                    : 'bg-red-950/90 text-red-300 border-red-500/60'
                }`}>
                  {vistoriaVigente.flgAtivo ? '● OPERANTE' : '● INOPERANTE'}
                </span>
              </div>

              {/* Defeitos da Vistoria Vigente */}
              <div className="space-y-1.5 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">
                    Defeitos / Condição Atual:
                  </span>
                  {vistoriaVigente.problemasHidrante && vistoriaVigente.problemasHidrante.trim() !== '' ? (
                    <div className="p-2 rounded-lg bg-red-950/70 border border-red-500/40 text-red-200 font-semibold flex items-center gap-2">
                      <AlertTriangle size={15} className="text-red-400 shrink-0" />
                      <span className="leading-tight">{fixEncoding(vistoriaVigente.problemasHidrante)}</span>
                    </div>
                  ) : (
                    <div className="p-2 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 font-semibold flex items-center gap-2">
                      <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                      <span>Sem defeitos registrados. Hidrante operacional e em perfeito estado.</span>
                    </div>
                  )}
                </div>

                {/* Observações da Vistoria Vigente */}
                {vistoriaVigente.dscObservacao && vistoriaVigente.dscObservacao.trim() !== '' && (
                  <div className="pt-1.5 border-t border-slate-800/60">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">
                      Observações Registradas:
                    </span>
                    <p className="text-slate-200 italic font-medium bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                      "{fixEncoding(vistoriaVigente.dscObservacao)}"
                    </p>
                  </div>
                )}

                {/* Fotos da Vistoria Vigente */}
                {vistoriaVigente.fotosVistoria && vistoriaVigente.fotosVistoria.length > 0 && (
                  <div className="pt-1.5 border-t border-slate-800/60">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                      Evidências Fotográficas ({vistoriaVigente.fotosVistoria.length}):
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {vistoriaVigente.fotosVistoria.map((foto, idx) => (
                        <div 
                          key={idx}
                          onClick={() => setFullscreenPhoto(foto)}
                          className="relative group cursor-pointer w-16 h-16 rounded-lg overflow-hidden border border-slate-700 hover:border-emerald-400 transition-all shadow-sm shrink-0"
                        >
                          <img 
                            src={foto} 
                            alt={`Foto ${idx + 1}`} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                            <ZoomIn size={16} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: HISTÓRICO DE VISTORIAS ANTERIORES (ARQUIVADAS) */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <History size={15} className="text-amber-400" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Vistorias Anteriores Arquivadas ({vistoriasAnteriores.length})
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-bold">
                Não Vigentes
              </span>
            </div>

            {vistoriasAnteriores.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-850/60 border border-slate-800 text-center text-slate-400 text-xs py-6">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
                <p className="font-semibold text-slate-300">Nenhuma vistoria anterior arquivada.</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Este hidrante possui apenas a vistoria vigente registrada até o momento.
                </p>
              </div>
            ) : (
              <div className="space-y-3 relative before:absolute before:top-2 before:bottom-2 before:left-3.5 before:w-0.5 before:bg-slate-800">
                {vistoriasAnteriores.map((v, idx) => {
                  const fotosAnteriores = Array.isArray(v.fotosVistoria) && v.fotosVistoria.length > 0
                    ? v.fotosVistoria
                    : (v.fotoVistoria ? [v.fotoVistoria] : []);

                  return (
                    <div 
                      key={v.idVistoria || idx}
                      className="relative pl-8 transition-all"
                    >
                      {/* Ponto na timeline */}
                      <div className="absolute left-2 top-3 w-3.5 h-3.5 rounded-full bg-slate-800 border-2 border-slate-600"></div>

                      <div className="bg-slate-850/80 border border-slate-800 hover:border-slate-700/80 rounded-xl p-3 text-xs shadow-sm transition-all">
                        {/* Topo do Card Passado */}
                        <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2 mb-2">
                          <div>
                            <div className="flex items-center gap-1.5 text-slate-300 font-bold">
                              <Calendar size={13} className="text-slate-400" />
                              <span>{formatDateTime(v.datHoraVistoria)}</span>
                              <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-300/90 font-mono font-bold border border-slate-700/50">
                                ARQUIVADA #{vistoriasAnteriores.length - idx}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                              <User size={12} className="text-slate-500" />
                              <span>Militar na época: {v.vistoriadorNome || '-'} {v.vistoriadorMatricula ? `(${v.vistoriadorMatricula})` : ''}</span>
                            </div>
                          </div>

                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 opacity-80 ${
                            v.flgAtivo 
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40' 
                              : 'bg-red-950/60 text-red-300 border-red-500/40'
                          }`}>
                            {v.flgAtivo ? 'OPERANTE (NA ÉPOCA)' : 'INOPERANTE (NA ÉPOCA)'}
                          </span>
                        </div>

                        {/* Defeitos da Época */}
                        <div className="space-y-1 text-slate-300">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                              Defeitos Constatados Na Época:
                            </span>
                            {v.problemasHidrante && v.problemasHidrante.trim() !== '' ? (
                              <p className="text-slate-300 font-medium bg-slate-900/50 p-1.5 rounded border border-slate-800/60 mt-0.5 leading-snug">
                                {fixEncoding(v.problemasHidrante)}
                              </p>
                            ) : (
                              <p className="text-slate-400 italic text-[11px] mt-0.5">
                                Nenhum defeito registrado na época.
                              </p>
                            )}
                          </div>

                          {/* Observação da Época */}
                          {v.dscObservacao && v.dscObservacao.trim() !== '' && (
                            <div className="pt-1">
                              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                                Observação:
                              </span>
                              <p className="text-slate-300 italic text-[11px] bg-slate-900/40 p-1.5 rounded mt-0.5">
                                "{fixEncoding(v.dscObservacao)}"
                              </p>
                            </div>
                          )}

                          {/* Fotos Anteriores */}
                          {fotosAnteriores.length > 0 && (
                            <div className="pt-1.5">
                              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                                Fotos Registradas Na Época ({fotosAnteriores.length}):
                              </span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {fotosAnteriores.map((f, fIdx) => (
                                  <div 
                                    key={fIdx}
                                    onClick={() => setFullscreenPhoto(f)}
                                    className="relative group cursor-pointer w-12 h-12 rounded-lg overflow-hidden border border-slate-700/80 hover:border-amber-400 transition-all shadow-sm shrink-0 opacity-85 hover:opacity-100"
                                  >
                                    <img 
                                      src={f} 
                                      alt={`Foto anterior ${fIdx + 1}`} 
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                                      <ZoomIn size={14} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RODAPÉ DO MODAL */}
        <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 font-medium">
            Total de registros: <strong className="text-slate-200">{vistoriasAnteriores.length + 1}</strong> (1 Vigente + {vistoriasAnteriores.length} Anteriores)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition-colors border border-slate-700"
          >
            Fechar Histórico
          </button>
        </div>
      </div>

      {/* MODAL FULLSCREEN PARA FOTO */}
      {fullscreenPhoto && (
        <div 
          className="fixed inset-0 z-[1300] bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md"
          onClick={() => setFullscreenPhoto(null)}
        >
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setFullscreenPhoto(null)}
              className="absolute -top-12 right-0 w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 transition-colors border border-slate-600 font-bold"
            >
              ✕
            </button>
            <img 
              src={fullscreenPhoto} 
              alt="Foto Ampliada da Vistoria" 
              className="max-h-[85vh] max-w-full object-contain rounded-xl border border-slate-700 shadow-2xl" 
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default InspectionHistoryModal;
