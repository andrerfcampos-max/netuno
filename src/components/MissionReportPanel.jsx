import React, { useMemo, useState } from 'react';
import { X, Maximize2, Minimize2, Printer, Copy, MessageCircle, Download, FileSpreadsheet } from 'lucide-react';

const MissionReportPanel = ({ hidrantes, currentMission, onClose, currentUser }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sort hydrants chronologically by datHoraUltimaVistoria (oldest to newest)
  const parseDate = (dateStr) => {
    if (!dateStr || dateStr === '-') return 0;
    const parts = dateStr.split(' ');
    if (parts.length < 2) return 0;
    const [date, time] = parts;
    const [d, m, y] = date.split('/');
    if (!d || !m || !y) return 0;
    return new Date(`${y}-${m}-${d}T${time}`).getTime();
  };

  const sortedHidrantes = useMemo(() => {
    return [...hidrantes].sort((a, b) => parseDate(a.datHoraUltimaVistoria) - parseDate(b.datHoraUltimaVistoria));
  }, [hidrantes]);

  // KPIs
  const total = sortedHidrantes.length;
  const operantes = sortedHidrantes.filter(h => h.flgAtivo).length;
  const inoperantes = total - operantes;
  const operantesPercent = total > 0 ? ((operantes / total) * 100).toFixed(1) : 0;
  const inoperantesPercent = total > 0 ? ((inoperantes / total) * 100).toFixed(1) : 0;

  // Top Defeitos
  const topDefeitos = useMemo(() => {
    const defeitosCount = {};
    let totalDefeitos = 0;

    sortedHidrantes.forEach(h => {
      if (!h.flgAtivo && h.problemasHidrante && h.problemasHidrante.trim() !== '-' && h.problemasHidrante.trim() !== '') {
        // Pode haver múltiplos problemas separados por ';'
        const problemas = h.problemasHidrante.split(';').map(p => p.trim()).filter(p => p);
        problemas.forEach(p => {
          defeitosCount[p] = (defeitosCount[p] || 0) + 1;
          totalDefeitos++;
        });
      }
    });

    const sorted = Object.entries(defeitosCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nome, count]) => ({
        nome,
        count,
        percent: totalDefeitos > 0 ? (count / totalDefeitos) * 100 : 0
      }));

    return sorted;
  }, [sortedHidrantes]);

  // Exportações
  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = currentMission ? currentMission.name : 'Rascunho de Hoje';
    window.print();
    document.title = originalTitle;
  };

  const handleCopySEI = async () => {
    try {
      let html = `<table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px;" border="1">`;
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
      
      sortedHidrantes.forEach(h => {
        const wazeLink = `https://waze.com/ul?ll=${h.numLatitude},${h.numLongitude}&navigate=yes`;
        html += `<tr>
          <td style="padding: 8px;">${h.nomHidrante || h.codHidrante}</td>
          <td style="padding: 8px;">${h.dscEndereco || h.dscLocalidade || '-'}</td>
          <td style="padding: 8px;">${h.dscPontoReferencia || '-'}</td>
          <td style="padding: 8px;">${h.datHoraUltimaVistoria || '-'}</td>
          <td style="padding: 8px;">${h.vistoriadorNome || '-'}</td>
          <td style="padding: 8px; text-align: center; color: ${h.flgAtivo ? '#166534' : '#991b1b'}; font-weight: bold;">${h.flgAtivo ? 'OPERANTE' : 'INOPERANTE'}</td>
          <td style="padding: 8px; color: #991b1b;">${!h.flgAtivo && h.problemasHidrante ? h.problemasHidrante : '-'}</td>
          <td style="padding: 8px;">${h.dscObservacao || h.observacoes || h.obsVistoria || '-'}</td>
          <td style="padding: 8px;"><a href="${wazeLink}">Waze</a></td>
        </tr>`;
      });
      html += `</table>`;

      const blobHtml = new Blob([html], { type: 'text/html' });
      const blobText = new Blob([sortedHidrantes.map(h => `${h.nomHidrante || h.codHidrante}\t${h.flgAtivo ? 'OPERANTE' : 'INOPERANTE'}\t${h.problemasHidrante || '-'}`).join('\n')], { type: 'text/plain' });
      
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
    let text = `*${reportName.toUpperCase()}*\n\n`;
    text += `📊 *Resumo*\n`;
    text += `• Total Inspecionado: ${total}\n`;
    text += `• 🟢 Operantes: ${operantes} (${operantesPercent}%)\n`;
    text += `• 🔴 Inoperantes: ${inoperantes} (${inoperantesPercent}%)\n\n`;
    
    if (inoperantes > 0) {
      text += `⚠️ *Prioridade de Manutenção:*\n`;
      const priority = sortedHidrantes.filter(h => !h.flgAtivo).slice(0, 10);
      priority.forEach(h => {
        text += `- ${h.nomHidrante || h.codHidrante}: ${h.problemasHidrante ? h.problemasHidrante.split(';')[0] : 'Inoperante'}\n`;
      });
      if (inoperantes > 10) text += `- ...e mais ${inoperantes - 10}\n`;
    }
    
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleExportCSV = () => {
    const headers = ["CÓDIGO", "ENDEREÇO", "PONTO DE REFERÊNCIA", "DATA DA VISTORIA", "VISTORIADOR", "SITUAÇÃO ATUAL", "PROBLEMAS ENCONTRADOS", "OBSERVAÇÕES", "LOCALIZAÇÃO"];
    const rows = sortedHidrantes.map(h => [
      h.nomHidrante || h.codHidrante || '',
      h.dscEndereco || h.dscLocalidade || '',
      h.dscPontoReferencia || '',
      h.datHoraUltimaVistoria || '',
      h.vistoriadorNome || '',
      h.flgAtivo ? 'OPERANTE' : 'INOPERANTE',
      (h.problemasHidrante || '').replace(/;/g, ' | '),
      (h.dscObservacao || h.observacoes || h.obsVistoria || '').replace(/;/g, ' | '),
      `https://waze.com/ul?ll=${h.numLatitude},${h.numLongitude}&navigate=yes`
    ]);
    
    // Adicionamos o BOM (\uFEFF) para forçar o Excel a abrir o CSV em UTF-8
    const csvContent = '\uFEFF' + [
      headers.join(';'),
      ...rows.map(r => r.join(';'))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_hidrantes_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Classes do container baseadas no estado maximizado
  const containerClasses = isMaximized
    ? "fixed inset-0 z-50 bg-slate-900 flex flex-col print-container overflow-hidden"
    : "flex flex-col p-4 w-full h-full bg-slate-900 print-container overflow-hidden";

  return (
    <div className={containerClasses}>
      {/* TOOLBAR NO PRINT */}
      <div className="flex justify-between items-start mb-4 pb-2 border-b border-slate-700 no-print p-4 lg:p-0">
        <h2 className="text-xl font-bold text-blue-400 flex items-center gap-2 drop-shadow-sm">
          <FileSpreadsheet size={24} /> 
          Módulo Relatório
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsMaximized(!isMaximized)} 
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-full transition-colors"
            title={isMaximized ? "Minimizar" : "Maximizar"}
          >
            {isMaximized ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
          </button>
          <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-red-900/50 hover:text-red-400 text-slate-400 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>
      </div>

      {/* ÁREA IMPRIMÍVEL (Relatório) */}
      <div className="flex-1 overflow-y-auto bg-slate-800/50 lg:bg-slate-800 rounded-xl p-4 lg:p-6 border border-slate-700 report-content print-bg-white print-text-black">
        
        {/* CABEÇALHO CBMDF */}
        <div className="text-center mb-8 border-b-2 border-slate-700 print-border-black pb-4">
          <h1 className="text-2xl font-bold text-slate-100 print-text-black uppercase">Corpo de Bombeiros Militar do Distrito Federal</h1>
          <h2 className="text-lg text-slate-300 print-text-black mt-1">SISTEMA ARGOS - RELATÓRIO TÁTICO DE VISTORIA</h2>
          <div className="mt-4 flex flex-col md:flex-row justify-between text-sm text-slate-400 print-text-black">
            <span><strong>Missão/Filtro:</strong> {currentMission ? currentMission.name : 'Geral (Filtrado)'}</span>
            <span><strong>Data da Geração:</strong> {new Date().toLocaleString('pt-BR')}</span>
          </div>
          <div className="mt-4 text-left text-sm text-slate-400 print-text-black border-t border-slate-700 pt-4 print-border-gray">
            <strong>Relatório gerado por:</strong> {currentUser?.nome ? `${currentUser.nome} (Matrícula: ${currentUser.matricula})` : '_________________________________________________'}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-700 p-4 rounded-lg border border-slate-600 print-border-gray print-bg-white">
            <div className="text-slate-400 text-sm font-bold uppercase mb-1">Total Inspecionado</div>
            <div className="text-3xl font-black text-white print-text-black">{total}</div>
          </div>
          <div className="bg-emerald-900/40 p-4 rounded-lg border border-emerald-800 print-border-gray print-bg-white">
            <div className="text-emerald-400 text-sm font-bold uppercase mb-1">Operantes</div>
            <div className="flex items-end gap-2">
              <div className="text-3xl font-black text-emerald-400 print-text-black">{operantes}</div>
              <div className="text-emerald-500 mb-1">({operantesPercent}%)</div>
            </div>
          </div>
          <div className="bg-red-900/40 p-4 rounded-lg border border-red-800 print-border-gray print-bg-white">
            <div className="text-red-400 text-sm font-bold uppercase mb-1">Inoperantes</div>
            <div className="flex items-end gap-2">
              <div className="text-3xl font-black text-red-500 print-text-black">{inoperantes}</div>
              <div className="text-red-500 mb-1">({inoperantesPercent}%)</div>
            </div>
          </div>
        </div>

        {/* TOP DEFEITOS */}
        {topDefeitos.length > 0 && (
          <div className="mb-8 page-break-inside-avoid">
            <h3 className="text-lg font-bold text-slate-200 mb-4 print-text-black border-b border-slate-700 print-border-gray pb-2">Top Defeitos Registrados</h3>
            <div className="space-y-4">
              {topDefeitos.map((defeito, idx) => (
                <div key={idx} className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm text-slate-300 print-text-black">
                    <span className="truncate pr-4" title={defeito.nome}>{defeito.nome}</span>
                    <span className="font-bold flex-shrink-0">{defeito.count} ocorr.</span>
                  </div>
                  <div className="w-full bg-slate-700 h-3 rounded-full overflow-hidden print-bg-gray">
                    <div 
                      className="bg-red-500 h-full print-bg-black" 
                      style={{ width: `${defeito.percent}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TABELA CONSOLIDADA */}
        <div className="page-break-inside-avoid">
          <h3 className="text-lg font-bold text-slate-200 mb-4 print-text-black border-b border-slate-700 print-border-gray pb-2">Relação de Hidrantes</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300 print-text-black print-table">
              <thead className="text-xs text-slate-400 uppercase bg-slate-700/50 print-bg-gray print-text-black">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg print-border">CÓDIGO</th>
                  <th className="px-4 py-3 print-border">ENDEREÇO</th>
                  <th className="px-4 py-3 print-border">PONTO DE REF.</th>
                  <th className="px-4 py-3 print-border">DATA VISTORIA</th>
                  <th className="px-4 py-3 print-border">VISTORIADOR</th>
                  <th className="px-4 py-3 print-border text-center">SITUAÇÃO</th>
                  <th className="px-4 py-3 print-border">PROBLEMAS</th>
                  <th className="px-4 py-3 print-border">OBSERVAÇÕES</th>
                  <th className="px-4 py-3 rounded-tr-lg print-border text-center">LOCALIZAÇÃO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 print-divide-gray">
                {sortedHidrantes.map((h, i) => (
                  <tr key={h.codHidrante || h.nomHidrante || i} className="hover:bg-slate-700/30 print-row-avoid">
                    <td className="px-4 py-3 font-medium text-slate-200 print-text-black print-border">
                      {h.nomHidrante || h.codHidrante}
                    </td>
                    <td className="px-4 py-3 text-slate-300 print-text-black print-border whitespace-normal" title={h.dscEndereco || h.dscLocalidade}>
                      {h.dscEndereco || h.dscLocalidade || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 print-text-black print-border whitespace-normal" title={h.dscPontoReferencia}>
                      {h.dscPontoReferencia || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap print-border">{h.datHoraUltimaVistoria || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap print-border text-emerald-300 print-text-black text-xs font-bold">{h.vistoriadorNome || '-'}</td>
                    <td className={`px-4 py-3 font-bold text-center ${h.flgAtivo ? 'text-emerald-400' : 'text-red-400'} print-text-black print-border`}>
                      {h.flgAtivo ? 'OPERANTE' : 'INOPERANTE'}
                    </td>
                    <td className="px-4 py-3 text-red-300 print-text-black print-border whitespace-normal" title={h.problemasHidrante}>
                      {!h.flgAtivo && h.problemasHidrante ? h.problemasHidrante : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 print-text-black print-border whitespace-normal" title={h.dscObservacao || h.observacoes || h.obsVistoria}>
                      {h.dscObservacao || h.observacoes || h.obsVistoria || '-'}
                    </td>
                    <td className="px-4 py-3 text-center print-border">
                      <a href={`https://waze.com/ul?ll=${h.numLatitude},${h.numLongitude}&navigate=yes`} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-400 underline font-bold whitespace-nowrap">
                        Waze
                      </a>
                    </td>
                  </tr>
                ))}
                {sortedHidrantes.length === 0 && (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-slate-500 print-border">Nenhum hidrante para exibir no relatório.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ANEXO FOTOGRÁFICO */}
        {(() => {
          const hidrantesComFoto = sortedHidrantes.filter(h => h.fotoVistoria);
          if (hidrantesComFoto.length === 0) return null;
          
          return (
            <div className="mt-12 pt-8 border-t border-slate-700 print-border-gray print-page-break-before">
              <h3 className="text-xl font-bold text-slate-200 mb-6 print-text-black border-b border-slate-700 print-border-gray pb-2 uppercase text-center">
                Anexo Fotográfico - Registro de Defeitos
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {hidrantesComFoto.map((h, i) => (
                  <div key={`foto-${h.codHidrante || i}`} className="bg-slate-700/30 p-4 rounded-lg border border-slate-600 print-border-gray print-bg-white page-break-inside-avoid shadow">
                    <div className="font-bold text-slate-200 print-text-black mb-1 text-lg">
                      {h.nomHidrante || h.codHidrante}
                    </div>
                    <div className="text-sm text-red-400 print-text-black font-bold mb-3">
                      Defeito: {h.problemasHidrante}
                    </div>
                    <div className="flex justify-center bg-black/20 print-bg-transparent p-2 rounded">
                      <img 
                        src={h.fotoVistoria} 
                        alt={`Defeito no hidrante ${h.nomHidrante || h.codHidrante}`} 
                        className="w-full max-w-sm rounded border border-slate-500 object-contain max-h-64"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* BARRA DE EXPORTAÇÃO NO PRINT */}
      <div className="grid grid-cols-2 lg:flex lg:flex-nowrap gap-2 mt-4 pt-4 border-t border-slate-700 no-print p-4 lg:p-0">
        <button onClick={handlePrint} className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-bold h-12 rounded-lg shadow active:scale-95 transition-all text-sm">
          <Printer size={20} />
          <span className="hidden sm:inline">Imprimir / PDF</span>
          <span className="sm:hidden">PDF</span>
        </button>
        
        <button onClick={handleCopySEI} className={`flex-1 flex items-center justify-center gap-2 ${copied ? 'bg-emerald-600' : 'bg-slate-700 hover:bg-slate-600'} text-white font-bold h-12 rounded-lg shadow active:scale-95 transition-all text-sm`}>
          <Copy size={20} />
          <span className="hidden sm:inline">{copied ? 'Copiado!' : 'Copiar p/ SEI'}</span>
          <span className="sm:hidden">{copied ? 'Copiado!' : 'SEI'}</span>
        </button>
        
        <button onClick={handleWhatsApp} className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold h-12 rounded-lg shadow active:scale-95 transition-all text-sm">
          <MessageCircle size={20} />
          WhatsApp
        </button>
        
        <button onClick={handleExportCSV} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold h-12 rounded-lg shadow active:scale-95 transition-all text-sm">
          <Download size={20} />
          <span className="hidden sm:inline">Exportar CSV</span>
          <span className="sm:hidden">CSV</span>
        </button>
      </div>
    </div>
  );
};

export default MissionReportPanel;
