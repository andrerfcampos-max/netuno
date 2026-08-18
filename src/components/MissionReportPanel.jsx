import React, { useMemo, useState, useRef, useEffect } from 'react';
import { X, Maximize2, Minimize2, Printer, Copy, MessageCircle, Download, FileSpreadsheet, Building2, ShieldHalf, ArrowUp, ArrowDown } from 'lucide-react';
import { extractProblemsList, sanitizeProblem } from '../utils/problemUtils';

const MissionReportPanel = ({ hidrantes, currentMission, onClose, currentUser }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const panelRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [reportType, setReportType] = useState(() => {
    return localStorage.getItem('lastReportType') || 'interno';
  });

  useEffect(() => {
    localStorage.setItem('lastReportType', reportType);
  }, [reportType]);

  const parseDate = (dateStr) => {
    if (!dateStr || dateStr === '-') return 0;
    const parts = dateStr.split(' ');
    if (parts.length < 2) return 0;
    const [date, time] = parts;
    const [d, m, y] = date.split('/');
    if (!d || !m || !y) return 0;
    return new Date(`${y}-${m}-${d}T${time}`).getTime();
  };

  const formatDateOnly = (dateStr) => {
    if (!dateStr || dateStr === '-') return '-';
    return dateStr.split(' ')[0];
  };

  const getYear = (dateStr) => {
    if (!dateStr || dateStr === '-') return 'N/A';
    const parts = dateStr.split(' ');
    if (parts.length < 1) return 'N/A';
    const [d, m, y] = parts[0].split('/');
    return y || 'N/A';
  };

  const sortedHidrantesGeral = useMemo(() => {
    return [...hidrantes]
      .sort((a, b) => parseDate(a.datHoraUltimaVistoria) - parseDate(b.datHoraUltimaVistoria));
  }, [hidrantes]);

  const sortedHidrantesCaesb = useMemo(() => {
    return sortedHidrantesGeral.filter(h => 
      !h.flgAtivo && 
      (!h.problemasHidrante || !h.problemasHidrante.toLowerCase().includes("removido ou não encontrado"))
    );
  }, [sortedHidrantesGeral]);

  const currentData = reportType === 'interno' ? sortedHidrantesGeral : sortedHidrantesCaesb;

  const total = currentData.length;
  const operantes = currentData.filter(h => h.flgAtivo).length;
  const inoperantes = total - operantes;
  const operantesPercent = total > 0 ? ((operantes / total) * 100).toFixed(1) : 0;
  const inoperantesPercent = total > 0 ? ((inoperantes / total) * 100).toFixed(1) : 0;

  const rasPresentes = useMemo(() => {
    const r = new Set(currentData.map(h => h.dscLocalidade).filter(Boolean));
    return Array.from(r).sort().join(', ');
  }, [currentData]);

  const topDefeitos = useMemo(() => {
    const defeitosCount = {};
    let totalDefeitos = 0;
    currentData.forEach(h => {
      if (!h.flgAtivo && h.problemasHidrante) {
        const problemas = extractProblemsList(h.problemasHidrante);
        problemas.forEach(p => {
          defeitosCount[p] = (defeitosCount[p] || 0) + 1;
          totalDefeitos++;
        });
      }
    });
    return Object.entries(defeitosCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nome, count]) => ({
        nome, count, percent: totalDefeitos > 0 ? (count / totalDefeitos) * 100 : 0
      }));
  }, [currentData]);

  const raStats = useMemo(() => {
    const counts = {};
    currentData.forEach(h => {
      const ra = h.dscLocalidade || 'N/A';
      counts[ra] = (counts[ra] || 0) + 1;
    });
    const max = Math.max(...Object.values(counts), 1);
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nome, count]) => ({ nome, count, percent: (count / max) * 100 }));
  }, [currentData]);

  const yearStats = useMemo(() => {
    const counts = {};
    currentData.forEach(h => {
      const year = getYear(h.datHoraUltimaVistoria);
      if (year !== 'N/A') {
        counts[year] = (counts[year] || 0) + 1;
      }
    });
    const max = Math.max(...Object.values(counts), 1);
    return Object.entries(counts)
      .sort((a, b) => b[0].localeCompare(a[0])) // Sort by year descending
      .map(([nome, count]) => ({ nome, count, percent: (count / max) * 100 }));
  }, [currentData]);

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = currentMission ? `${currentMission.name} - ${reportType === 'interno' ? 'CBMDF' : 'CAESB'}` : 'Relatório';
    window.print();
    document.title = originalTitle;
  };

  const handleCopySEI = async () => {
    try {
      let html = `<table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px;" border="1">`;
      
      if (reportType === 'interno') {
        html += `<tr style="background-color: #f2f2f2;">
          <th style="padding: 8px; text-align: left;">CÓDIGO</th>
          <th style="padding: 8px; text-align: left;">ENDEREÇO</th>
          <th style="padding: 8px; text-align: left;">PONTO DE REFERÊNCIA</th>
          <th style="padding: 8px; text-align: left;">DATA DA VISTORIA</th>
          <th style="padding: 8px; text-align: left;">VISTORIADOR</th>
          <th style="padding: 8px; text-align: center;">SITUAÇÃO ATUAL</th>
          <th style="padding: 8px; text-align: left;">PROBLEMAS ENCONTRADOS</th>
          <th style="padding: 8px; text-align: left;">OBSERVAÇÕES</th>
          <th style="padding: 8px; text-align: left;">LOCALIZAÇÃO</th>
        </tr>`;
      } else {
        html += `<tr style="background-color: #f2f2f2;">
          <th style="padding: 8px; text-align: left;">CÓDIGO</th>
          <th style="padding: 8px; text-align: left;">ENDEREÇO</th>
          <th style="padding: 8px; text-align: left;">PONTO DE REFERÊNCIA</th>
          <th style="padding: 8px; text-align: left;">PROBLEMA DO HIDRANTE</th>
          <th style="padding: 8px; text-align: left;">LOCALIZAÇÃO</th>
        </tr>`;
      }
      
      currentData.forEach(h => {
        const wazeLink = `https://waze.com/ul?ll=${h.numLatitude},${h.numLongitude}&navigate=yes`;
        html += `<tr>`;
        html += `<td style="padding: 8px;">${h.nomHidrante || h.codHidrante}</td>`;
        html += `<td style="padding: 8px;">${h.dscEndereco || h.dscLocalidade || '-'}</td>`;
        html += `<td style="padding: 8px;">${h.dscPontoReferencia || '-'}</td>`;
        if (reportType === 'interno') {
          html += `<td style="padding: 8px;">${formatDateOnly(h.datHoraUltimaVistoria)}</td>`;
          html += `<td style="padding: 8px;">${h.vistoriadorNome || '-'}</td>`;
          html += `<td style="padding: 8px; text-align: center; color: ${h.flgAtivo ? '#166534' : '#991b1b'}; font-weight: bold;">${h.flgAtivo ? 'OPERANTE' : 'INOPERANTE'}</td>`;
          html += `<td style="padding: 8px; color: #991b1b;">${!h.flgAtivo && h.problemasHidrante ? sanitizeProblem(h.problemasHidrante) : '-'}</td>`;
          html += `<td style="padding: 8px;">${h.dscObservacao || h.observacoes || h.obsVistoria || '-'}</td>`;
        } else {
          html += `<td style="padding: 8px; color: #991b1b;">${h.problemasHidrante ? sanitizeProblem(h.problemasHidrante) : '-'}</td>`;
        }
        html += `<td style="padding: 8px;"><a href="${wazeLink}">Waze</a></td>`;
        html += `</tr>`;
      });
      html += `</table>`;

      const blobHtml = new Blob([html], { type: 'text/html' });
      const blobText = new Blob([currentData.map(h => `${h.nomHidrante || h.codHidrante}\t${h.flgAtivo ? 'OPERANTE' : 'INOPERANTE'}\t${h.problemasHidrante ? sanitizeProblem(h.problemasHidrante) : '-'}`).join('\n')], { type: 'text/plain' });
      
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': blobHtml,
          'text/plain': blobText,
        })
      ]);
      
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error("Falha ao copiar:", err);
      alert("Não foi possível copiar para a área de transferência.");
    }
  };

  const handleWhatsApp = () => {
    const reportName = currentMission ? currentMission.name : 'Relatório Tático de Hidrantes';
    let text = `*NETUNO - ${reportName.toUpperCase()} (${reportType === 'interno' ? 'GERAL' : 'MANUTENÇÃO'})*\n\n`;
    
    if (reportType === 'interno') {
      text += `📊 *Resumo*\n`;
      text += `• Total Vistoriado: ${total}\n`;
      text += `• 🟢 Operantes: ${operantes} (${operantesPercent}%)\n`;
      text += `• 🔴 Inoperantes: ${inoperantes} (${inoperantesPercent}%)\n\n`;
    } else {
      text += `📊 *Resumo de Manutenção*\n`;
      text += `• Regiões Afetadas: ${rasPresentes || 'Nenhuma informada'}\n`;
      text += `• Total para Reparo: ${total}\n\n`;
    }
    
    if (inoperantes > 0) {
      text += `⚠️ *Prioridade de Manutenção:*\n`;
      const priority = currentData.filter(h => !h.flgAtivo).slice(0, 10);
      priority.forEach(h => {
        const probs = extractProblemsList(h.problemasHidrante);
        const probText = probs.length > 0 ? probs.join(', ') : 'Inoperante';
        text += `- ${h.nomHidrante || h.codHidrante}: ${probText}\n`;
      });
      if (inoperantes > 10) text += `- ...e mais ${inoperantes - 10}\n`;
    }
    
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleExportCSV = () => {
    let headers = [];
    let rows = [];
    
    if (reportType === 'interno') {
      headers = ["CÓDIGO", "ENDEREÇO", "PONTO DE REFERÊNCIA", "DATA DA VISTORIA", "VISTORIADOR", "SITUAÇÃO ATUAL", "PROBLEMAS ENCONTRADOS", "OBSERVAÇÕES", "LOCALIZAÇÃO"];
      rows = currentData.map(h => [
        h.nomHidrante || h.codHidrante || '',
        h.dscEndereco || h.dscLocalidade || '',
        h.dscPontoReferencia || '',
        formatDateOnly(h.datHoraUltimaVistoria),
        h.vistoriadorNome || '',
        h.flgAtivo ? 'OPERANTE' : 'INOPERANTE',
        (sanitizeProblem(h.problemasHidrante) || '').replace(/[;|]/g, ' - '),
        (h.dscObservacao || h.observacoes || h.obsVistoria || '').replace(/[;|]/g, ' - '),
        `https://waze.com/ul?ll=${h.numLatitude},${h.numLongitude}&navigate=yes`
      ]);
    } else {
      headers = ["CÓDIGO", "ENDEREÇO", "PONTO DE REFERÊNCIA", "PROBLEMA DO HIDRANTE", "LOCALIZAÇÃO"];
      rows = currentData.map(h => [
        h.nomHidrante || h.codHidrante || '',
        h.dscEndereco || h.dscLocalidade || '',
        h.dscPontoReferencia || '',
        (sanitizeProblem(h.problemasHidrante) || '').replace(/[;|]/g, ' - '),
        `https://waze.com/ul?ll=${h.numLatitude},${h.numLongitude}&navigate=yes`
      ]);
    }
    
    const csvContent = '\uFEFF' + [
      headers.join(';'),
      ...rows.map(r => r.join(';'))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_${reportType}_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = touchStartX.current - e.changedTouches[0].clientX;
    const diffY = touchStartY.current - e.changedTouches[0].clientY;
    
    // Se o movimento horizontal for maior que vertical e significativo (> 50px)
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
      if (diffX > 0) {
        // Arrastou para a esquerda -> CAESB
        setReportType('caesb');
      } else {
        // Arrastou para a direita -> Geral (interno)
        setReportType('interno');
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const scrollToTop = () => {
    if (panelRef.current) {
      if (isMaximized) {
        panelRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const scrollToBottom = () => {
    if (panelRef.current) {
      if (isMaximized) {
        panelRef.current.scrollTo({ top: panelRef.current.scrollHeight, behavior: 'smooth' });
      } else {
        panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }
  };

  const containerClasses = isMaximized
    ? "fixed inset-0 z-[100] bg-slate-900 flex flex-col print-container overflow-y-auto p-4 select-none touch-pan-y"
    : "flex flex-col p-2 lg:p-4 w-full h-auto bg-slate-900/50 print-container select-none touch-pan-y";

  return (
    <div 
      className={containerClasses} 
      ref={panelRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <style>{`
        @media print {
          @page { size: A4; margin: 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white; }
          .page-break-inside-avoid { break-inside: avoid; }
          .print-bg-white { background-color: white !important; }
          .print-text-black { color: black !important; }
          .print-border-black { border-color: black !important; }
          .print-divide-gray > :not([hidden]) ~ :not([hidden]) { border-color: #e5e7eb !important; }
        }
      `}</style>
      
      {/* BOTÕES FLUTUANTES (ELEVADOR) */}
      <div className="fixed right-4 bottom-24 z-50 flex flex-col gap-2 no-print">
        <button 
          onClick={scrollToTop} 
          className="p-3 bg-slate-700/80 backdrop-blur hover:bg-slate-600 text-white rounded-full shadow-[0_0_15px_rgba(0,0,0,0.3)] transition-all active:scale-95"
          title="Ir para o topo"
        >
          <ArrowUp size={20} />
        </button>
        <button 
          onClick={scrollToBottom} 
          className="p-3 bg-slate-700/80 backdrop-blur hover:bg-slate-600 text-white rounded-full shadow-[0_0_15px_rgba(0,0,0,0.3)] transition-all active:scale-95"
          title="Ir para o final"
        >
          <ArrowDown size={20} />
        </button>
      </div>


      {/* TOOLBAR SUPERIOR NO PRINT */}
      <div className={`flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4 pb-2 border-b border-slate-700 no-print px-2 lg:px-0 gap-4 ${isMaximized ? 'sticky top-0 z-[110] bg-slate-900/95 backdrop-blur-sm pt-4 shadow-sm' : ''}`}>
        <h2 className="text-xl font-bold text-blue-400 flex items-center gap-2 drop-shadow-sm">
          <FileSpreadsheet size={24} /> 
          Módulo Relatório
        </h2>
        
        <div className="flex bg-slate-800 rounded-lg p-1 w-full lg:w-auto shadow-inner border border-slate-700">
          <button 
            onClick={() => setReportType('interno')}
            className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-md font-bold text-sm transition-all ${reportType === 'interno' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <ShieldHalf size={16} /> Relatório Geral (CBMDF)
          </button>
          <button 
            onClick={() => setReportType('caesb')}
            className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-md font-bold text-sm transition-all ${reportType === 'caesb' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Building2 size={16} /> Relatório de Alterações (CAESB)
          </button>
        </div>

        <div className="flex gap-2 self-end lg:self-auto">
          <button 
            onClick={() => setIsMaximized(!isMaximized)} 
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-full transition-colors border border-slate-600"
            title={isMaximized ? "Minimizar" : "Maximizar"}
          >
            {isMaximized ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
          </button>
          <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-red-900/50 hover:text-red-400 text-slate-400 rounded-full transition-colors border border-slate-600">
            <X size={24} />
          </button>
        </div>
      </div>

      {/* ÁREA IMPRIMÍVEL (Relatório) */}
      <div className="w-full h-auto bg-slate-800/50 lg:bg-slate-800 rounded-xl p-4 lg:p-6 border border-slate-700 report-content print-bg-white print-text-black pb-24">
        
        {/* CABEÇALHO DA PÁGINA IMPRESSA */}
        <div className="text-center mb-8 border-b-2 border-slate-700 print-border-black pb-4">
          {reportType === 'interno' ? (
            <>
              <h1 className="text-2xl font-bold text-slate-100 print-text-black uppercase tracking-wide">Corpo de Bombeiros Militar do Distrito Federal</h1>
              <h2 className="text-lg text-slate-300 print-text-black mt-1 uppercase">Sistema Netuno - Relatório Tático de Vistoria</h2>
              <div className="mt-4 flex flex-col items-center text-sm text-slate-400 print-text-black bg-slate-700/30 print-bg-transparent py-2 rounded">
                <span><strong>Filtro / Missão:</strong> {currentMission ? currentMission.name : 'Geral (Filtrado)'}</span>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-slate-100 print-text-black uppercase tracking-wide">Corpo de Bombeiros Militar do Distrito Federal</h1>
              <h2 className="text-lg text-emerald-400 print-text-black mt-1 uppercase font-black">Solicitação de Manutenção de Hidrantes Urbanos de Incêndio - CBMDF / CAESB</h2>
              <p className="text-xs text-slate-400 print-text-gray mt-1 uppercase tracking-wider font-bold">
                De acordo com o Termo de Cooperação Técnica CAESB/CBMDF publicado no DODF em 25/03/2019
              </p>
              <div className="mt-4 flex flex-col items-center text-sm text-slate-300 print-text-black">
                <span className="bg-slate-700/50 print-bg-transparent px-4 py-2 rounded-full border border-slate-600 print-border-gray shadow-sm">
                  <strong>Regiões Administrativas (RAs):</strong> {rasPresentes || 'Nenhuma região filtrada'}
                </span>
              </div>
            </>
          )}
        </div>

        {/* KPIs e GRÁFICOS */}
        {reportType === 'interno' ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8 print-flex print-flex-row">
            
            {/* Bloco de Totais */}
            <div className="md:col-span-4 flex flex-col justify-between gap-4 print-w-1/3">
              <div className="bg-slate-700 p-4 rounded-lg border border-slate-600 print-border-gray print-bg-white flex-1 flex flex-col justify-center">
                <div className="text-slate-400 text-sm font-bold uppercase mb-1">Total Vistoriado</div>
                <div className="text-3xl font-black text-white print-text-black">{total}</div>
              </div>
              <div className="bg-emerald-900/40 p-4 rounded-lg border border-emerald-800 print-border-gray print-bg-white flex-1 flex justify-between items-end">
                <div>
                  <div className="text-emerald-400 text-sm font-bold uppercase mb-1">Operantes</div>
                  <div className="text-3xl font-black text-emerald-400 print-text-black">{operantes}</div>
                </div>
                <div className="text-emerald-500 font-bold mb-1 text-lg">{operantesPercent}%</div>
              </div>
              <div className="bg-red-900/40 p-4 rounded-lg border border-red-800 print-border-gray print-bg-white flex-1 flex justify-between items-end">
                <div>
                  <div className="text-red-400 text-sm font-bold uppercase mb-1">Inoperantes</div>
                  <div className="text-3xl font-black text-red-500 print-text-black">{inoperantes}</div>
                </div>
                <div className="text-red-500 font-bold mb-1 text-lg">{inoperantesPercent}%</div>
              </div>
            </div>
            
            {/* Bloco de Gráficos Principais */}
            <div className="md:col-span-8 flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-6 bg-slate-800 p-4 rounded-lg border border-slate-700 print-border-gray print-bg-white items-center justify-around page-break-inside-avoid print-w-full">
                <div className="flex flex-col items-center gap-4">
                  <h3 className="text-sm font-bold text-slate-300 print-text-black uppercase tracking-wider text-center">Índice de Operacionalidade</h3>
                  <div className="relative w-32 h-32 rounded-full print-donut shadow-inner border-4 border-slate-900 print-border-white" style={{ background: `conic-gradient(#34d399 ${operantesPercent}%, #ef4444 ${operantesPercent}% 100%)` }}>
                    <div className="absolute inset-2 bg-slate-800 print-bg-white rounded-full flex flex-col items-center justify-center shadow-md">
                      <span className="text-xl font-black text-white print-text-black">{operantesPercent}%</span>
                      <span className="text-[10px] text-slate-400 print-text-black font-bold uppercase">OK</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 w-full flex flex-col justify-center max-w-sm">
                  <h3 className="text-sm font-bold text-slate-300 print-text-black uppercase tracking-wider mb-4 border-b border-slate-700 print-border-gray pb-2">Top Defeitos Registrados</h3>
                  {topDefeitos.length > 0 ? (
                    <div className="space-y-3">
                      {topDefeitos.slice(0, 4).map((defeito, idx) => (
                        <div key={idx} className="flex flex-col gap-1">
                          <div className="flex justify-between text-xs text-slate-300 print-text-black">
                            <span className="truncate pr-2 font-medium" title={defeito.nome}>{defeito.nome}</span>
                            <span className="font-bold">{defeito.count}</span>
                          </div>
                          <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden print-bg-gray">
                            <div className="bg-red-500 h-full print-bg-black transition-all duration-1000" style={{ width: `${defeito.percent}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 text-center italic mt-4">Nenhum defeito registrado.</p>
                  )}
                </div>
              </div>

              {/* Gráficos de RA e Anos */}
              <div className="flex flex-col md:flex-row gap-4 page-break-inside-avoid">
                <div className="flex-1 bg-slate-800 p-4 rounded-lg border border-slate-700 print-border-gray print-bg-white flex flex-col justify-center">
                  <h3 className="text-sm font-bold text-slate-300 print-text-black uppercase tracking-wider mb-4 border-b border-slate-700 print-border-gray pb-2">Distribuição por Região (RAs)</h3>
                  {raStats.length > 0 ? (
                    <div className="space-y-3">
                      {raStats.map((ra, idx) => (
                        <div key={idx} className="flex flex-col gap-1">
                          <div className="flex justify-between text-xs text-slate-300 print-text-black">
                            <span className="font-medium">{ra.nome}</span>
                            <span className="font-bold">{ra.count} vist.</span>
                          </div>
                          <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden print-bg-gray">
                            <div className="bg-blue-500 h-full print-bg-black transition-all duration-1000" style={{ width: `${ra.percent}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 text-center italic mt-4">Sem dados regionais.</p>
                  )}
                </div>
                
                <div className="flex-1 bg-slate-800 p-4 rounded-lg border border-slate-700 print-border-gray print-bg-white flex flex-col justify-center">
                  <h3 className="text-sm font-bold text-slate-300 print-text-black uppercase tracking-wider mb-4 border-b border-slate-700 print-border-gray pb-2">Vistorias por Ano</h3>
                  {yearStats.length > 0 ? (
                    <div className="space-y-3">
                      {yearStats.map((y, idx) => (
                        <div key={idx} className="flex flex-col gap-1">
                          <div className="flex justify-between text-xs text-slate-300 print-text-black">
                            <span className="font-medium">{y.nome}</span>
                            <span className="font-bold">{y.count} vist.</span>
                          </div>
                          <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden print-bg-gray">
                            <div className="bg-emerald-500 h-full print-bg-black transition-all duration-1000" style={{ width: `${y.percent}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 text-center italic mt-4">Sem histórico temporal.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* CAESB KPIs e Gráficos */
          <div className="flex flex-col md:flex-row gap-6 mb-8 page-break-inside-avoid">
            <div className="bg-red-900/20 p-6 rounded-lg border border-red-800/50 print-border-gray print-bg-white flex-shrink-0 flex flex-col items-center justify-center min-w-[200px] shadow-sm">
              <div className="text-slate-400 text-sm font-bold uppercase mb-2">Total de Reparos</div>
              <div className="text-6xl font-black text-red-500 print-text-black drop-shadow-md">{total}</div>
            </div>
            
            <div className="flex-1 bg-slate-800/50 p-6 rounded-lg border border-slate-700 print-border-gray print-bg-white shadow-sm">
              <h3 className="text-sm font-bold text-slate-300 print-text-black uppercase tracking-wider mb-4 border-b border-slate-700 print-border-gray pb-2">Principais Tipos de Problemas (CAESB)</h3>
              {topDefeitos.length > 0 ? (
                <div className="space-y-4">
                  {topDefeitos.map((defeito, idx) => (
                    <div key={idx} className="flex flex-col gap-1">
                      <div className="flex justify-between text-sm text-slate-300 print-text-black">
                        <span className="truncate pr-4" title={defeito.nome}>{defeito.nome}</span>
                        <span className="font-bold flex-shrink-0 text-orange-400 print-text-black">{defeito.count} ocorr.</span>
                      </div>
                      <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden print-bg-gray">
                        <div className="bg-gradient-to-r from-orange-600 to-orange-400 h-full print-bg-black transition-all duration-1000" style={{ width: `${defeito.percent}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic mt-4">Nenhum defeito de manutenção registrado.</p>
              )}
            </div>
          </div>
        )}

        {/* TABELA CONSOLIDADA */}
        <div className="page-break-inside-avoid">
          <h3 className="text-lg font-bold text-slate-200 mb-4 print-text-black border-b border-slate-700 print-border-gray pb-2 flex items-center gap-2">
            {reportType === 'interno' ? 'Relação Geral de Hidrantes' : 'Lista de Hidrantes com Problemas'}
          </h3>
          <div className="overflow-x-auto shadow-md rounded-lg">
            <table className="w-full text-left text-sm text-slate-300 print-text-black print-table">
              <thead className="text-xs text-slate-400 uppercase bg-slate-700/80 print-bg-gray print-text-black">
                {reportType === 'interno' ? (
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg print-border">CÓDIGO</th>
                    <th className="px-4 py-3 print-border">ENDEREÇO</th>
                    <th className="px-4 py-3 print-border">PONTO DE REF.</th>
                    <th className="px-4 py-3 print-border">DATA VISTORIA</th>
                    <th className="px-4 py-3 print-border">VISTORIADOR</th>
                    <th className="px-4 py-3 print-border text-center">SITUAÇÃO</th>
                    <th className="px-4 py-3 print-border">PROBLEMAS</th>
                    <th className="px-4 py-3 print-border">OBSERVAÇÕES</th>
                    <th className="px-4 py-3 rounded-tr-lg print-border text-center no-print">LOCALIZAÇÃO</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg print-border">CÓDIGO</th>
                    <th className="px-4 py-3 print-border">ENDEREÇO</th>
                    <th className="px-4 py-3 print-border">PONTO DE REF.</th>
                    <th className="px-4 py-3 print-border">PROBLEMA DO HIDRANTE</th>
                    <th className="px-4 py-3 rounded-tr-lg print-border text-center no-print">LOCALIZAÇÃO</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-700/50 print-divide-gray bg-slate-800/30 print-bg-transparent">
                {currentData.map((h, i) => (
                  <tr key={h.codHidrante || h.nomHidrante || i} className="hover:bg-slate-700/50 transition-colors print-row-avoid">
                    <td className="px-4 py-3 font-medium text-slate-100 print-text-black print-border">
                      {h.nomHidrante || h.codHidrante}
                    </td>
                    <td className="px-4 py-3 text-slate-300 print-text-black print-border whitespace-normal" title={h.dscEndereco || h.dscLocalidade}>
                      {h.dscEndereco || h.dscLocalidade || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 print-text-black print-border whitespace-normal" title={h.dscPontoReferencia}>
                      {h.dscPontoReferencia || '-'}
                    </td>
                    
                    {reportType === 'interno' ? (
                      <>
                        <td className="px-4 py-3 whitespace-nowrap print-border text-xs">{formatDateOnly(h.datHoraUltimaVistoria)}</td>
                        <td className="px-4 py-3 whitespace-nowrap print-border text-emerald-300 print-text-black text-xs font-bold">{h.vistoriadorNome || '-'}</td>
                        <td className={`px-4 py-3 font-bold text-center ${h.flgAtivo ? 'text-emerald-400' : 'text-red-400'} print-text-black print-border`}>
                          {h.flgAtivo ? 'OPERANTE' : 'INOPERANTE'}
                        </td>
                        <td className="px-4 py-3 text-red-300 print-text-black print-border whitespace-normal text-xs" title={sanitizeProblem(h.problemasHidrante)}>
                          {!h.flgAtivo && h.problemasHidrante ? sanitizeProblem(h.problemasHidrante) : '-'}
                        </td>
                        <td className="px-4 py-3 text-slate-400 print-text-black print-border whitespace-normal text-xs" title={h.dscObservacao || h.observacoes || h.obsVistoria}>
                          {h.dscObservacao || h.observacoes || h.obsVistoria || '-'}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-bold text-red-400 print-text-black print-border whitespace-normal text-xs" title={sanitizeProblem(h.problemasHidrante)}>
                          {h.problemasHidrante ? sanitizeProblem(h.problemasHidrante) : '-'}
                        </td>
                      </>
                    )}
                    
                    <td className="px-4 py-3 text-center print-border no-print">
                      <a href={`https://waze.com/ul?ll=${h.numLatitude},${h.numLongitude}&navigate=yes`} target="_blank" rel="noreferrer" className="inline-block bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-3 py-1 rounded text-xs font-bold transition-all whitespace-nowrap">
                        Waze
                      </a>
                    </td>
                  </tr>
                ))}
                {currentData.length === 0 && (
                  <tr>
                    <td colSpan={reportType === 'interno' ? 9 : 5} className="px-4 py-12 text-center text-slate-500 print-border text-lg font-bold">
                      Nenhum hidrante correspondente aos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ANEXO FOTOGRÁFICO */}
        {(() => {
          const hidrantesComFoto = currentData.filter(h => h.fotoVistoria);
          if (hidrantesComFoto.length === 0) return null;
          
          return (
            <div className="mt-12 pt-8 border-t border-slate-700 print-border-gray print-page-break-before">
              <h3 className="text-xl font-bold text-slate-200 mb-6 print-text-black border-b border-slate-700 print-border-gray pb-2 uppercase text-center flex items-center justify-center gap-2">
                Anexo Fotográfico - Registro de Defeitos
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {hidrantesComFoto.map((h, i) => (
                  <div key={`foto-${h.codHidrante || i}`} className="bg-slate-700/30 p-4 rounded-xl border border-slate-600 print-border-gray print-bg-white page-break-inside-avoid shadow-lg hover:shadow-xl transition-shadow">
                    <div className="font-black text-slate-100 print-text-black mb-1 text-lg border-b border-slate-600 print-border-gray pb-1">
                      {h.nomHidrante || h.codHidrante}
                    </div>
                    <div className="text-sm text-red-400 print-text-black font-bold mb-3 mt-2 line-clamp-2" title={sanitizeProblem(h.problemasHidrante)}>
                      Defeito: {sanitizeProblem(h.problemasHidrante)}
                    </div>
                    <div className="flex justify-center bg-black/40 print-bg-transparent p-2 rounded-lg overflow-hidden">
                      <img 
                        src={h.fotoVistoria} 
                        alt={`Defeito no hidrante ${h.nomHidrante || h.codHidrante}`} 
                        className="w-full h-48 object-cover rounded shadow-inner hover:scale-105 transition-transform duration-300 cursor-pointer"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* RODAPÉ DO DOCUMENTO DE RELATÓRIO */}
        <div className="mt-24 pt-6 flex flex-col items-center justify-center text-sm text-slate-400 print-text-black page-break-inside-avoid">
          <div className="w-64 border-t border-slate-400 print-border-black mb-2 mt-8"></div>
          <p className="font-bold text-center text-lg text-slate-200 print-text-black">
            {currentUser?.nome ? `${currentUser.nome}` : 'Assinatura do Responsável'}
          </p>
          {currentUser?.matricula && (
            <p className="text-center text-slate-300 print-text-black">Matrícula: {currentUser.matricula}</p>
          )}
          
          <p className="mt-8 mb-2"><strong>Gerado em:</strong> {new Date().toLocaleString('pt-BR')}</p>
          <p className="mt-2 text-xs opacity-50">Sistema Netuno - CBMDF © {new Date().getFullYear()}</p>
        </div>

      </div>

      {/* BARRA FLUTUANTE DE EXPORTAÇÃO (Agrupada no final para Sticky Scroll) */}
      <div className="sticky bottom-4 z-[90] flex justify-center w-full pointer-events-none no-print mt-4">
        <div className="pointer-events-auto bg-slate-800/95 backdrop-blur border border-slate-600 p-2 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.5)] flex flex-wrap md:flex-nowrap gap-2 justify-center w-[95%] md:w-auto">
          <button onClick={handlePrint} className="flex-1 md:flex-none px-4 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-bold h-10 rounded-lg transition-all text-xs sm:text-sm">
            <Printer size={16} />
            <span className="hidden sm:inline">Imprimir / PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>
          <button onClick={handleCopySEI} className={`flex-1 md:flex-none px-4 flex items-center justify-center gap-2 ${copied ? 'bg-emerald-600' : 'bg-slate-700 hover:bg-slate-600'} text-white font-bold h-10 rounded-lg transition-all text-xs sm:text-sm`}>
            <Copy size={16} />
            <span className="hidden sm:inline">{copied ? 'Copiado!' : 'Copiar p/ SEI'}</span>
            <span className="sm:hidden">{copied ? 'Copiado!' : 'SEI'}</span>
          </button>
          <button onClick={handleWhatsApp} className="flex-1 md:flex-none px-4 flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold h-10 rounded-lg transition-all text-xs sm:text-sm">
            <MessageCircle size={16} />
            WhatsApp
          </button>
          <button onClick={handleExportCSV} className="flex-1 md:flex-none px-4 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold h-10 rounded-lg transition-all text-xs sm:text-sm">
            <Download size={16} />
            <span className="hidden sm:inline">Exportar CSV</span>
            <span className="sm:hidden">CSV</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MissionReportPanel;
