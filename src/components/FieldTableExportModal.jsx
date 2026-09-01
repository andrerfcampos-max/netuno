import React, { useMemo, useState, useRef } from 'react';
import { X, Printer, Download, Share2, Copy, Check, FileSpreadsheet } from 'lucide-react';
import { fixEncoding } from '../utils/textUtils';
import { normalizeRAName } from '../utils/raList';

// Ponto de Partida Fixo: Centro do Gama
const GAMA_CENTER = { lat: -16.015, lng: -48.065, name: 'Centro do Gama' };

// Cálculo de distância geodésica em km
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return 999;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Algoritmo Vizinho Mais Próximo saindo do Centro do Gama
const optimizeRouteFromGama = (hidrantes) => {
  if (!hidrantes || hidrantes.length === 0) return [];
  
  let unvisited = [...hidrantes];
  let route = [];
  let currentLat = GAMA_CENTER.lat;
  let currentLng = GAMA_CENTER.lng;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const h = unvisited[i];
      const dist = calculateDistance(currentLat, currentLng, h.numLatitude, h.numLongitude);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIdx = i;
      }
    }

    const nextHydrant = unvisited.splice(nearestIdx, 1)[0];
    route.push(nextHydrant);
    currentLat = nextHydrant.numLatitude;
    currentLng = nextHydrant.numLongitude;
  }

  return route;
};

const FieldTableExportModal = ({ isOpen, onClose, hidrantes = [], activeFilters = {}, currentUser }) => {
  const [copied, setCopied] = useState(false);
  const contentRef = useRef(null);

  // Ordenação TSP a partir do Centro do Gama
  const orderedList = useMemo(() => {
    return optimizeRouteFromGama(hidrantes);
  }, [hidrantes]);

  const rasPresentes = useMemo(() => {
    const r = new Set(orderedList.map(h => normalizeRAName(h.dscLocalidade)).filter(Boolean));
    return Array.from(r).sort().join(', ');
  }, [orderedList]);

  if (!isOpen) return null;

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `Tabela_de_Campo_Gama_${new Date().toISOString().split('T')[0]}`;
    window.print();
    document.title = originalTitle;
  };

  const handleExportCSV = () => {
    const headers = ["SEQ", "CÓDIGO", "CIDADE (RA)", "ENDEREÇO", "PONTO DE REFERÊNCIA", "OBSERVAÇÕES DE CAMPO", "COORDENADAS"];
    const rows = orderedList.map((h, idx) => [
      idx + 1,
      h.nomHidrante || h.codHidrante || '',
      normalizeRAName(h.dscLocalidade) || '',
      fixEncoding(h.dscEndereco || '').replace(/[;|]/g, ' - '),
      fixEncoding(h.dscPontoReferencia || '').replace(/[;|]/g, ' - '),
      '', // Coluna em branco para preenchimento
      `${h.numLatitude}, ${h.numLongitude}`
    ]);

    const csvContent = '\uFEFF' + [
      headers.join(';'),
      ...rows.map(r => r.join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `tabela_campo_gama_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopy = async () => {
    try {
      let text = `========================================================\n`;
      text += `CORPO DE BOMBEIROS MILITAR DO DISTRITO FEDERAL\n`;
      text += `TABELA DE CAMPO - ROTA OTIMIZADA (PARTIDA: CENTRO DO GAMA)\n`;
      text += `Data: ${new Date().toLocaleDateString('pt-BR')}\n`;
      text += `Regiões: ${rasPresentes || 'Todas as RAs'}\n`;
      text += `Total de Hidrantes: ${orderedList.length}\n`;
      text += `========================================================\n\n`;
      text += `SEQ\tCÓDIGO\tENDEREÇO E REFERÊNCIA\tOBSERVAÇÕES\n`;
      
      orderedList.forEach((h, idx) => {
        const code = h.nomHidrante || h.codHidrante;
        const end = fixEncoding(h.dscEndereco) || '-';
        const ref = h.dscPontoReferencia ? ` (Ref: ${fixEncoding(h.dscPontoReferencia)})` : '';
        text += `${idx + 1}\t${code}\t${end}${ref}\t\n`;
      });

      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      alert("Não foi possível copiar para a área de transferência.");
    }
  };

  const handleWhatsApp = () => {
    let text = `🚒 *NETUNO - TABELA DE CAMPO (ROTA OTIMIZADA)*\n\n`;
    text += `📍 *Origem da Rota:* Centro do Gama\n`;
    text += `🏙️ *Regiões:* ${rasPresentes || 'Todas as RAs'}\n`;
    text += `📊 *Total:* ${orderedList.length} hidrantes na sequência de trânsito\n\n`;
    
    orderedList.slice(0, 40).forEach((h, idx) => {
      const code = h.nomHidrante || h.codHidrante;
      const end = fixEncoding(h.dscEndereco) || '-';
      text += `${idx + 1}. *${code}* - ${end}\n`;
    });

    if (orderedList.length > 40) {
      text += `\n... e mais ${orderedList.length - 40} hidrantes na sequência.\n`;
    }

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const url = isMobile
      ? `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
      : `https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 animate-fadeIn print-container">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white !important; }
          .no-print { display: none !important; }
          .print-bg-white { background-color: white !important; }
          .print-text-black { color: black !important; }
          .print-border-black { border: 1px solid #111 !important; }
          .print-border-gray { border-color: #cbd5e1 !important; }
          .print-table th, .print-table td { border: 1px solid #94a3b8 !important; }
        }
      `}</style>

      <div className="bg-slate-900 w-full max-w-5xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border-0 sm:border border-slate-700/80 h-[100dvh] sm:h-auto sm:max-h-[92dvh] text-slate-100 print-bg-white print-text-black">
        
        {/* CABEÇALHO PADRONIZADO (NO-PRINT) */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-slate-900 border-b border-slate-700/80 flex items-center justify-between gap-3 shrink-0 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button 
              type="button"
              onClick={onClose} 
              className="text-xs px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg font-semibold transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
            >
              ← Voltar
            </button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center text-white shadow-md shadow-indigo-950/50 shrink-0">
              <FileSpreadsheet size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate flex items-center gap-2">
                <span>Tabela de Campo para Impressão</span>
                <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2 py-0.5 rounded-full border border-indigo-500/40 font-semibold">
                  {orderedList.length} hidrantes
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Sequência de trânsito otimizada (partida fixa: <strong>Centro do Gama</strong>) com espaço para escrita à caneta
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

        {/* BARRA DE AÇÕES RÁPIDAS (NO-PRINT) */}
        <div className="bg-slate-850 p-2.5 sm:px-6 border-b border-slate-700/80 flex flex-wrap items-center justify-between gap-2 no-print">
          <div className="text-xs text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span><strong>Filtros Ativos:</strong> {rasPresentes || 'Todas as Cidades'}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Printer size={15} />
              <span>Imprimir / PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-500/40 font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Download size={15} />
              <span>Exportar CSV</span>
            </button>

            <button
              type="button"
              onClick={handleWhatsApp}
              className="px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Share2 size={15} />
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
              <span>{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>
          </div>
        </div>

        {/* CONTEÚDO IMPRIMÍVEL DA TABELA */}
        <div className="p-3 sm:p-6 overflow-y-auto flex-1 print-bg-white print-text-black" ref={contentRef}>
          
          {/* CABEÇALHO FORMAL IMPRESSO */}
          <div className="text-center pb-4 mb-4 border-b-2 border-slate-700 print-border-black">
            <h1 className="text-base sm:text-lg font-bold text-slate-100 print-text-black uppercase tracking-wide">
              Corpo de Bombeiros Militar do Distrito Federal
            </h1>
            <h2 className="text-sm sm:text-base text-indigo-400 print-text-black font-extrabold uppercase mt-0.5">
              Ficha de Vistoria de Campo - Rota Otimizada de Trânsito
            </h2>
            <div className="mt-2 text-xs text-slate-300 print-text-black flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <span><strong>Ponto de Saída da Rota:</strong> Centro do Gama</span>
              <span>•</span>
              <span><strong>Regiões (RAs):</strong> {rasPresentes || 'Distrito Federal'}</span>
              <span>•</span>
              <span><strong>Total:</strong> {orderedList.length} hidrantes</span>
              <span>•</span>
              <span><strong>Data de Emissão:</strong> {new Date().toLocaleDateString('pt-BR')}</span>
            </div>
          </div>

          {/* TABELA VISUAL */}
          {orderedList.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <p className="font-semibold text-slate-200">Nenhum hidrante encontrado com os filtros selecionados.</p>
              <p className="text-xs mt-1">Ajuste os filtros de cidade ou status no topo da aplicação.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-700/80 print-border-black rounded-xl shadow-sm">
              <table className="w-full text-left text-xs border-collapse print-table">
                <thead className="bg-slate-800 text-slate-200 font-bold border-b border-slate-700 print-bg-white print-text-black uppercase">
                  <tr>
                    <th className="p-2.5 w-12 text-center border-r border-slate-700 print-border-black">Nº</th>
                    <th className="p-2.5 w-28 text-center border-r border-slate-700 print-border-black">CÓDIGO</th>
                    <th className="p-2.5 flex-1 min-w-[240px] border-r border-slate-700 print-border-black">ENDEREÇO E PONTO DE REFERÊNCIA</th>
                    <th className="p-2.5 w-72 sm:w-96 text-center">ANOTAÇÕES / OBSERVAÇÕES DE CAMPO (À CANETA)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60 print-divide-gray bg-slate-900/40 print-bg-white">
                  {orderedList.map((h, idx) => {
                    const code = h.nomHidrante || h.codHidrante;
                    const end = fixEncoding(h.dscEndereco) || 'Endereço não informado';
                    const ref = h.dscPontoReferencia ? fixEncoding(h.dscPontoReferencia) : '';
                    const ra = normalizeRAName(h.dscLocalidade) || '';

                    return (
                      <tr key={h._internalId || h.codHidrante || idx} className="hover:bg-slate-800/60 print-bg-white page-break-inside-avoid">
                        {/* Nº da Parada na Rota */}
                        <td className="p-2 text-center font-bold text-indigo-400 print-text-black font-mono border-r border-slate-700/60 print-border-black">
                          {idx + 1}
                        </td>

                        {/* Código do Hidrante */}
                        <td className="p-2 text-center font-bold text-slate-100 print-text-black font-mono border-r border-slate-700/60 print-border-black whitespace-nowrap">
                          <div>{code}</div>
                          {ra && (
                            <span className="text-[10px] text-cyan-300 print-text-black font-sans font-medium block">
                              {ra}
                            </span>
                          )}
                        </td>

                        {/* Endereço e Ponto de Referência na mesma célula */}
                        <td className="p-2 border-r border-slate-700/60 print-border-black">
                          <div className="font-medium text-slate-200 print-text-black leading-tight">
                            {end}
                          </div>
                          {ref && (
                            <div className="text-[11px] text-slate-400 print-text-black italic mt-0.5">
                              <strong>Ref:</strong> {ref}
                            </div>
                          )}
                        </td>

                        {/* Coluna de Observações em Branco Grande com Linhas Pautadas para Escrita à Caneta */}
                        <td className="p-2 min-h-[50px] h-14 bg-slate-950/20 print-bg-white relative">
                          <div className="w-full h-full flex flex-col justify-between py-0.5 opacity-40 print-opacity-100">
                            <div className="border-b border-dashed border-slate-600 print-border-gray h-3"></div>
                            <div className="border-b border-dashed border-slate-600 print-border-gray h-3"></div>
                            <div className="border-b border-dashed border-slate-600 print-border-gray h-3"></div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ASSINATURA NO RODAPÉ */}
          <div className="mt-8 pt-4 flex flex-col items-center justify-center text-xs text-slate-400 print-text-black page-break-inside-avoid">
            <div className="w-64 border-t border-slate-400 print-border-black mb-1.5 mt-4"></div>
            <p className="font-bold text-center text-sm text-slate-200 print-text-black">
              {currentUser?.nome ? currentUser.nome : 'Assinatura do Vistoriador / Responsável'}
            </p>
            {currentUser?.matricula && (
              <p className="text-center text-slate-400 print-text-black">Matrícula: {currentUser.matricula}</p>
            )}
            <p className="mt-4 text-[10px] opacity-60">Sistema Netuno - Rota Gerada em {new Date().toLocaleString('pt-BR')}</p>
          </div>

        </div>

        {/* RODAPÉ DO MODAL (NO-PRINT) */}
        <div className="p-3 sm:px-6 border-t border-slate-700/80 bg-slate-900 flex justify-between items-center text-xs text-slate-400 no-print">
          <span>Rota sequenciada por proximidade partindo do Gama</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-semibold transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};

export default FieldTableExportModal;
