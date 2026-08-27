import React, { useMemo, useState, useRef, useEffect } from 'react';
import { X, Maximize2, Minimize2, Printer, Copy, MessageCircle, Download, FileSpreadsheet, Building2, ShieldHalf, ArrowUp, ArrowDown, Share2, ChevronDown, Check } from 'lucide-react';
import { extractProblemsList, sanitizeProblem } from '../utils/problemUtils';

const MissionReportPanel = ({ hidrantes, currentMission, onClose, currentUser }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const panelRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [showSeiModal, setShowSeiModal] = useState(false);
  const [reportType, setReportType] = useState(() => {
    return localStorage.getItem('lastReportType') || 'interno';
  });

  useEffect(() => {
    localStorage.setItem('lastReportType', reportType);
  }, [reportType]);

  // Fecha dropdown ao clicar fora
  const exportDropdownRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
        setIsExportMenuOpen(false);
      }
    };
    if (isExportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isExportMenuOpen]);

  const parseDate = (dateStr) => {
    if (!dateStr || dateStr === '-') return 0;
    const str = String(dateStr).trim();
    const parts = str.split(' ');
    if (parts.length < 2) {
      if (parts.length === 1 && str.includes('/')) {
        const [d, m, y] = str.split('/');
        if (d && m && y) {
          const t = new Date(`${y}-${m}-${d}T00:00:00`).getTime();
          return isNaN(t) ? 0 : t;
        }
      }
      return 0;
    }
    const [date, time] = parts;
    const [d, m, y] = date.split('/');
    if (!d || !m || !y) return 0;
    const timeVal = time || '00:00:00';
    const timestamp = new Date(`${y}-${m}-${d}T${timeVal}`).getTime();
    return isNaN(timestamp) ? 0 : timestamp;
  };

  const formatDateOnly = (dateStr) => {
    if (!dateStr || dateStr === '-') return '-';
    return String(dateStr).split(' ')[0];
  };

  const getYear = (dateStr) => {
    if (!dateStr || dateStr === '-') return 'N/A';
    const str = String(dateStr).trim();
    const parts = str.split(' ');
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
      (!h.flgAtivo || (h.problemasHidrante && extractProblemsList(h.problemasHidrante).length > 0) || (h.dscObservacao && h.dscObservacao.trim().length > 0)) && 
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
      if (h.problemasHidrante) {
        const problemas = extractProblemsList(h.problemasHidrante);
        problemas.forEach(p => {
          defeitosCount[p] = (defeitosCount[p] || 0) + 1;
          totalDefeitos++;
        });
      } else if (!h.flgAtivo) {
        defeitosCount['Inoperante (sem detalhe)'] = (defeitosCount['Inoperante (sem detalhe)'] || 0) + 1;
        totalDefeitos++;
      }
    });
    const max = Math.max(...Object.values(defeitosCount), 1);
    return Object.entries(defeitosCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nome, count]) => ({
        nome,
        count,
        percent: totalDefeitos > 0 ? (count / totalDefeitos) * 100 : 0,
        barPercent: (count / max) * 100
      }));
  }, [currentData]);

  // Estatísticas Detalhadas por Cidade (para visão multi-cidade)
  const cityOperabilityStats = useMemo(() => {
    const statsByCity = {};
    currentData.forEach(h => {
      const city = h.dscLocalidade || 'Não informada';
      if (!statsByCity[city]) {
        statsByCity[city] = { nome: city, total: 0, operantes: 0, inoperantes: 0 };
      }
      statsByCity[city].total += 1;
      if (h.flgAtivo) {
        statsByCity[city].operantes += 1;
      } else {
        statsByCity[city].inoperantes += 1;
      }
    });

    return Object.values(statsByCity)
      .map(c => ({
        ...c,
        operantesPercent: c.total > 0 ? ((c.operantes / c.total) * 100).toFixed(1) : '0.0',
        inoperantesPercent: c.total > 0 ? ((c.inoperantes / c.total) * 100).toFixed(1) : '0.0',
      }))
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return b.inoperantes - a.inoperantes;
      });
  }, [currentData]);

  const maxCityTotal = useMemo(() => {
    if (!cityOperabilityStats || cityOperabilityStats.length === 0) return 1;
    return Math.max(...cityOperabilityStats.map(c => c.total), 1);
  }, [cityOperabilityStats]);

  const isMultiCity = cityOperabilityStats.length > 1;

  // Top Defeitos com distribuição pelas Cidades com maior incidência
  const topDefeitosComCidades = useMemo(() => {
    const defeitosMap = {};
    let totalDefeitos = 0;
    currentData.forEach(h => {
      const city = h.dscLocalidade || 'Não informada';
      const countDefect = (p) => {
        if (!defeitosMap[p]) {
          defeitosMap[p] = { nome: p, total: 0, cidades: {} };
        }
        defeitosMap[p].total += 1;
        defeitosMap[p].cidades[city] = (defeitosMap[p].cidades[city] || 0) + 1;
        totalDefeitos += 1;
      };

      if (h.problemasHidrante) {
        const problemas = extractProblemsList(h.problemasHidrante);
        problemas.forEach(p => countDefect(p));
      } else if (!h.flgAtivo) {
        countDefect('Inoperante (sem detalhe)');
      }
    });

    const maxDefeito = Math.max(...Object.values(defeitosMap).map(d => d.total), 1);

    return Object.values(defeitosMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)
      .map(d => {
        const topCidades = Object.entries(d.cidades)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([cidade, qtd]) => ({ cidade, qtd }));
        return {
          nome: d.nome,
          total: d.total,
          percent: totalDefeitos > 0 ? (d.total / totalDefeitos) * 100 : 0,
          barPercent: (d.total / maxDefeito) * 100,
          topCidades
        };
      });
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
      .slice(0, 8)
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
      const nowStr = `${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      
      let html = `<div style="font-family: Arial, Helvetica, sans-serif; color: #1e293b; max-width: 1000px; line-height: 1.4;">`;
      
      // 1. Cabeçalho Oficial
      html += `<div style="text-align: center; border-bottom: 2px solid #334155; padding-bottom: 12px; margin-bottom: 16px;">
        <h2 style="margin: 0; font-size: 16px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Corpo de Bombeiros Militar do Distrito Federal</h2>
        <h3 style="margin: 4px 0 0 0; font-size: 14px; color: ${reportType === 'interno' ? '#1e40af' : '#047857'}; text-transform: uppercase; font-weight: bold;">
          ${reportType === 'interno' ? 'Sistema Netuno - Relatório de Vistoria de Hidrantes Urbanos' : 'Solicitação de Manutenção de Hidrantes Urbanos de Incêndio - CBMDF / CAESB'}
        </h3>
        ${reportType === 'caesb' ? '<p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b;">De acordo com o Termo de Cooperação Técnica CAESB/CBMDF publicado no DODF em 25/03/2019</p>' : ''}
        <div style="margin-top: 8px; font-size: 12px; color: #475569;">
          <strong>Regiões Administrativas (RAs):</strong> ${rasPresentes || 'Todas as Cidades / DF Completo'}<br/>
          ${currentMission ? `<strong>Missão Ativa:</strong> ${currentMission.name}<br/>` : ''}
          <strong>Data de Emissão:</strong> ${nowStr}
        </div>
      </div>`;

      // 2. Quadro de Indicadores Gerais (KPIs)
      if (reportType === 'interno') {
        html += `<div style="margin-bottom: 20px;">
          <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #0f172a; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">
            📊 Resumo Geral de Operacionalidade
          </h4>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-family: Arial, sans-serif; font-size: 12px;">
            <tr>
              <td style="width: 33%; padding: 10px; background-color: #f1f5f9; border: 1px solid #cbd5e1; text-align: center;">
                <span style="font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase;">Total Vistoriado</span><br/>
                <span style="font-size: 20px; font-weight: bold; color: #0f172a;">${total}</span>
              </td>
              <td style="width: 33%; padding: 10px; background-color: #ecfdf5; border: 1px solid #a7f3d0; text-align: center;">
                <span style="font-size: 10px; color: #065f46; font-weight: bold; text-transform: uppercase;">Operantes</span><br/>
                <span style="font-size: 20px; font-weight: bold; color: #166534;">${operantes}</span>
                <span style="font-size: 12px; font-weight: bold; color: #059669;"> (${operantesPercent}%)</span>
              </td>
              <td style="width: 33%; padding: 10px; background-color: #fef2f2; border: 1px solid #fecaca; text-align: center;">
                <span style="font-size: 10px; color: #991b1b; font-weight: bold; text-transform: uppercase;">Inoperantes</span><br/>
                <span style="font-size: 20px; font-weight: bold; color: #dc2626;">${inoperantes}</span>
                <span style="font-size: 12px; font-weight: bold; color: #b91c1c;"> (${inoperantesPercent}%)</span>
              </td>
            </tr>
          </table>

          <div style="padding: 8px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
            <div style="font-size: 11px; font-weight: bold; color: #334155; margin-bottom: 6px; text-transform: uppercase;">
              Operacionalidade Global: ${operantesPercent}% OK (${operantes} Operantes / ${inoperantes} Inoperantes)
            </div>
            <table style="width: 100%; height: 16px; border-collapse: collapse; background-color: #e2e8f0; border-radius: 4px; overflow: hidden;">
              <tr>
                ${operantesPercent > 0 ? `<td style="width: ${operantesPercent}%; background-color: #10b981;" title="Operantes: ${operantesPercent}%"></td>` : ''}
                ${inoperantesPercent > 0 ? `<td style="width: ${inoperantesPercent}%; background-color: #ef4444;" title="Inoperantes: ${inoperantesPercent}%"></td>` : ''}
              </tr>
            </table>
          </div>
        </div>`;
      } else {
        html += `<div style="margin-bottom: 20px; padding: 10px; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 4px;">
          <strong style="color: #065f46; font-size: 13px;">Total de Hidrantes com Solicitação de Manutenção / Alteração:</strong>
          <span style="font-size: 18px; font-weight: bold; color: #166534; margin-left: 8px;">${currentData.length}</span>
        </div>`;
      }

      // 3. Comparativo por Região Administrativa (Multi-Cidades)
      if (reportType === 'interno' && isMultiCity && cityOperabilityStats.length > 0) {
        html += `<div style="margin-bottom: 20px;">
          <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #0f172a; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">
            📊 Comparativo de Operacionalidade por Região Administrativa (RA)
          </h4>
          <table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11px;" border="1" bordercolor="#cbd5e1">
            <tr style="background-color: #f1f5f9; font-weight: bold;">
              <th style="padding: 6px; text-align: left;">Região Administrativa (RA)</th>
              <th style="padding: 6px; text-align: center;">Total</th>
              <th style="padding: 6px; text-align: center; color: #166534;">Operantes</th>
              <th style="padding: 6px; text-align: center; color: #991b1b;">Inoperantes</th>
              <th style="padding: 6px; text-align: left; width: 35%;">Proporção Visual (Operante / Inoperante)</th>
            </tr>
            ${cityOperabilityStats.map(c => `
              <tr>
                <td style="padding: 6px; font-weight: bold;">${c.nome}</td>
                <td style="padding: 6px; text-align: center;">${c.total}</td>
                <td style="padding: 6px; text-align: center; color: #166534; font-weight: bold;">${c.operantes} (${c.operantesPercent}%)</td>
                <td style="padding: 6px; text-align: center; color: #991b1b; font-weight: bold;">${c.inoperantes} (${c.inoperantesPercent}%)</td>
                <td style="padding: 6px;">
                  <table style="width: 100%; height: 12px; border-collapse: collapse; background-color: #e2e8f0; border-radius: 3px; overflow: hidden;">
                    <tr>
                      ${c.operantesPercent > 0 ? `<td style="width: ${c.operantesPercent}%; background-color: #10b981;" title="Operantes: ${c.operantesPercent}%"></td>` : ''}
                      ${c.inoperantesPercent > 0 ? `<td style="width: ${c.inoperantesPercent}%; background-color: #ef4444;" title="Inoperantes: ${c.inoperantesPercent}%"></td>` : ''}
                    </tr>
                  </table>
                </td>
              </tr>
            `).join('')}
          </table>
        </div>`;
      }

      // 4. Top Defeitos e Cidades Mais Afetadas
      if (reportType === 'interno' && topDefeitosComCidades && topDefeitosComCidades.length > 0) {
        html += `<div style="margin-bottom: 20px;">
          <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #991b1b; text-transform: uppercase; border-bottom: 1px solid #fecaca; padding-bottom: 4px;">
            ⚠️ Principais Defeitos do DF e Cidades Mais Afetadas
          </h4>
          <table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11px;" border="1" bordercolor="#cbd5e1">
            <tr style="background-color: #fef2f2; font-weight: bold; color: #991b1b;">
              <th style="padding: 6px; text-align: left;">Defeito / Inconformidade</th>
              <th style="padding: 6px; text-align: center;">Ocorrências</th>
              <th style="padding: 6px; text-align: center;">% do Total de Defeitos</th>
              <th style="padding: 6px; text-align: left;">Cidades com Maior Incidência</th>
            </tr>
            ${topDefeitosComCidades.map(d => `
              <tr>
                <td style="padding: 6px; font-weight: bold; color: #7f1d1d;">${d.nome}</td>
                <td style="padding: 6px; text-align: center; font-weight: bold;">${d.total}</td>
                <td style="padding: 6px; text-align: center;">${d.percent.toFixed(1)}%</td>
                <td style="padding: 6px; color: #475569;">${d.topCidades.map(tc => `${tc.cidade} (${tc.qtd})`).join(', ') || '-'}</td>
              </tr>
            `).join('')}
          </table>
        </div>`;
      }

      // 5. Tabela Detalhada de Hidrantes
      html += `<div style="margin-bottom: 20px;">
        <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #0f172a; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">
          📋 Relação Detalhada dos Hidrantes (${currentData.length} registros)
        </h4>
        <table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11px;" border="1" bordercolor="#cbd5e1">`;
      
      if (reportType === 'interno') {
        html += `<tr style="background-color: #f1f5f9; font-weight: bold;">
          <th style="padding: 6px; text-align: left;">CÓDIGO</th>
          <th style="padding: 6px; text-align: left;">ENDEREÇO</th>
          <th style="padding: 6px; text-align: left;">PONTO DE REFERÊNCIA</th>
          <th style="padding: 6px; text-align: left;">DATA DA VISTORIA</th>
          <th style="padding: 6px; text-align: left;">VISTORIADOR</th>
          <th style="padding: 6px; text-align: center;">SITUAÇÃO</th>
          <th style="padding: 6px; text-align: left;">PROBLEMAS ENCONTRADOS</th>
          <th style="padding: 6px; text-align: left;">OBSERVAÇÕES</th>
          <th style="padding: 6px; text-align: center;">LOCALIZAÇÃO</th>
        </tr>`;
      } else {
        html += `<tr style="background-color: #f1f5f9; font-weight: bold;">
          <th style="padding: 6px; text-align: left;">CÓDIGO</th>
          <th style="padding: 6px; text-align: left;">ENDEREÇO</th>
          <th style="padding: 6px; text-align: left;">PONTO DE REFERÊNCIA</th>
          <th style="padding: 6px; text-align: left;">PROBLEMA DO HIDRANTE</th>
          <th style="padding: 6px; text-align: center;">LOCALIZAÇÃO</th>
        </tr>`;
      }
      
      currentData.forEach(h => {
        const wazeLink = `https://waze.com/ul?ll=${h.numLatitude},${h.numLongitude}&navigate=yes`;
        html += `<tr>`;
        html += `<td style="padding: 6px; font-weight: bold;">${h.nomHidrante || h.codHidrante}</td>`;
        html += `<td style="padding: 6px;">${h.dscEndereco || h.dscLocalidade || '-'}</td>`;
        html += `<td style="padding: 6px;">${h.dscPontoReferencia || '-'}</td>`;
        if (reportType === 'interno') {
          html += `<td style="padding: 6px;">${formatDateOnly(h.datHoraUltimaVistoria)}</td>`;
          html += `<td style="padding: 6px;">${h.vistoriadorNome || '-'}</td>`;
          html += `<td style="padding: 6px; text-align: center; color: ${h.flgAtivo ? '#166534' : '#991b1b'}; font-weight: bold; background-color: ${h.flgAtivo ? '#f0fdf4' : '#fef2f2'};">${h.flgAtivo ? 'OPERANTE' : 'INOPERANTE'}</td>`;
          html += `<td style="padding: 6px; color: #991b1b; font-weight: ${!h.flgAtivo ? 'bold' : 'normal'};">${h.problemasHidrante ? sanitizeProblem(h.problemasHidrante) : (!h.flgAtivo ? 'INOPERANTE' : '-')}</td>`;
          html += `<td style="padding: 6px;">${h.dscObservacao || h.observacoes || h.obsVistoria || '-'}</td>`;
        } else {
          html += `<td style="padding: 6px; color: #991b1b; font-weight: bold;">${h.problemasHidrante ? sanitizeProblem(h.problemasHidrante) : (!h.flgAtivo ? 'INOPERANTE' : '-')}</td>`;
        }
        html += `<td style="padding: 6px; text-align: center;"><a href="${wazeLink}" style="color: #2563eb; text-decoration: underline;">Waze</a></td>`;
        html += `</tr>`;
      });
      html += `</table></div></div>`;

      // Plain text fallback
      let text = `========================================================\n`;
      text += `CORPO DE BOMBEIROS MILITAR DO DISTRITO FEDERAL\n`;
      text += `SISTEMA NETUNO - RELATÓRIO DE VISTORIA\n`;
      text += `Emissão: ${nowStr}\n`;
      text += `Regiões: ${rasPresentes || 'Todas as RAs'}\n`;
      if (currentMission) text += `Missão: ${currentMission.name}\n`;
      text += `========================================================\n\n`;
      text += `RESUMO: Total: ${total} | Operantes: ${operantes} (${operantesPercent}%) | Inoperantes: ${inoperantes} (${inoperantesPercent}%)\n\n`;
      text += `CÓDIGO\tENDEREÇO\tSITUAÇÃO\tPROBLEMAS\n`;
      currentData.forEach(h => {
        text += `${h.nomHidrante || h.codHidrante}\t${h.dscEndereco || h.dscLocalidade || '-'}\t${h.flgAtivo ? 'OPERANTE' : 'INOPERANTE'}\t${h.problemasHidrante ? sanitizeProblem(h.problemasHidrante) : (!h.flgAtivo ? 'INOPERANTE' : '-')}\n`;
      });

      const blobHtml = new Blob([html], { type: 'text/html' });
      const blobText = new Blob([text], { type: 'text/plain' });
      
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
    const reportName = currentMission ? currentMission.name : 'Status de Vistoria';
    
    // Identificar hidrantes concluídos e faltantes
    const completedIds = currentMission?.completedIds || [];
    let completedList = [];
    let pendingList = [];
    
    if (currentMission) {
      completedList = currentData.filter(h => completedIds.includes(h.codHidrante || h.nomHidrante) || completedIds.includes(h._internalId));
      pendingList = currentData.filter(h => !completedIds.includes(h.codHidrante || h.nomHidrante) && !completedIds.includes(h._internalId));
    } else {
      completedList = currentData.filter(h => h.vistoriadorNome);
      pendingList = currentData.filter(h => !h.vistoriadorNome);
      if (completedList.length === 0 && pendingList.length === currentData.length) {
        completedList = currentData;
        pendingList = [];
      }
    }

    // Identificar vistoriadores que executaram as vistorias
    const vistoriadoresUnicos = Array.from(
      new Set(completedList.map(h => h.vistoriadorNome || h.nomVistoriador).filter(Boolean))
    );
    
    let vistoriadorText = 'Pendente de início';
    if (completedList.length > 0) {
      vistoriadorText = vistoriadoresUnicos.length > 0 
        ? vistoriadoresUnicos.join(', ') 
        : (currentUser?.nome || 'Equipe CBMDF');
    }

    let text = `🚒 *NETUNO - STATUS DE VISTORIA*\n\n`;
    text += `📋 *Missão:* ${reportName}\n`;
    text += `👤 *Vistoriador:* ${vistoriadorText}\n`;
    text += `📊 *Progresso:* ${completedList.length} Concluídos / ${pendingList.length} Faltantes (Total: ${currentData.length})\n\n`;
    
    if (completedList.length > 0) {
      text += `✅ *CONCLUÍDOS (${completedList.length}):*\n`;
      completedList.forEach(h => {
        const id = h.nomHidrante || h.codHidrante;
        const probs = extractProblemsList(h.problemasHidrante);
        const probText = probs.length > 0 ? ` - ${probs.join(', ')}` : '';
        const status = h.flgAtivo ? '🟢 Operante' : `🔴 Inoperante${probText}`;
        text += `• ${id} (${status})\n`;
      });
      text += `\n`;
    }
    
    if (pendingList.length > 0) {
      text += `⏳ *FALTANTES (${pendingList.length}):*\n`;
      pendingList.forEach(h => {
        const id = h.nomHidrante || h.codHidrante;
        const end = h.dscEndereco ? ` - ${h.dscEndereco}` : (h.dscLocalidade ? ` - ${h.dscLocalidade}` : '');
        text += `• ${id}${end}\n`;
      });
      text += `\n`;
    }
    
    if (currentMission) {
      const baseUrl = window.location.origin + window.location.pathname;
      const idsString = currentData.map(h => h.nomHidrante || h.codHidrante).join(',');
      text += `🔗 *Link da Missão:* ${baseUrl}?ds=${idsString}\n`;
    } else {
      text += `🌐 *Netuno Web:* ${window.location.origin}\n`;
    }
    
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const url = isMobile
      ? `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
      : `https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  
  const handleGenerateSeiProcess = () => {
    const dataPack = {
      rasPresentes,
      total,
      operantes,
      inoperantes,
      operantesPercent,
      inoperantesPercent,
      ano: new Date().getFullYear(),
      origem: 'SEHUR/SUOMA',
      destino: 'SEHUR/SUTEC',
      htmlContent: document.getElementById('report-content-to-print')?.innerHTML || ''
    };
    localStorage.setItem('netuno_sei_data', JSON.stringify(dataPack));
    setShowSeiModal(false);
    window.open('https://sei.df.gov.br', '_blank');
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
    ? "fixed inset-0 z-[100] bg-slate-900 flex flex-col print-container overflow-y-auto p-4 select-none"
    : "flex flex-col p-2 lg:p-4 w-full h-auto bg-slate-900/50 print-container select-none";

  return (
    <div 
      className={containerClasses} 
      ref={panelRef}
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
      
      
  {showSeiModal && (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="bg-emerald-600/20 p-4 border-b border-emerald-500/30 flex justify-between items-center">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🚀</span> Integração SEI-GDF
          </h3>
          <button onClick={() => setShowSeiModal(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-slate-700/50 p-4 rounded-lg space-y-2">
            <p className="text-slate-300"><span className="font-semibold text-white">Cidade (RA):</span> {rasPresentes || 'Todas as Cidades'}</p>
            <p className="text-slate-300"><span className="font-semibold text-white">Total de Hidrantes:</span> {total}</p>
            <p className="text-slate-300"><span className="font-semibold text-white">Inoperantes:</span> {inoperantes} ({inoperantesPercent}%)</p>
            <hr className="border-slate-600 my-2" />
            <p className="text-slate-300"><span className="font-semibold text-white">Unidade Origem:</span> SEHUR/SUOMA</p>
            <p className="text-slate-300"><span className="font-semibold text-white">Destino Teste:</span> SEHUR/SUTEC</p>
          </div>
          <p className="text-sm text-amber-400 bg-amber-400/10 p-3 rounded-lg border border-amber-400/20">
            Atenção: Ao confirmar, a extensão do navegador assumirá o controle no SEI para gerar o processo automaticamente.
          </p>
        </div>
        <div className="p-4 bg-slate-800/80 border-t border-slate-700 flex justify-end gap-3">
          <button onClick={() => setShowSeiModal(false)} className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 font-semibold transition-colors">Cancelar</button>
          <button onClick={handleGenerateSeiProcess} className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 font-bold transition-all shadow-lg">Iniciar Automação</button>
        </div>
      </div>
    </div>
  )}
  

        {/* BOTÕES FLUTUANTES (ELEVADOR + EXPORTAÇÃO RÁPIDA) */}
      <div className="fixed right-3 sm:right-4 bottom-20 sm:bottom-24 z-50 flex flex-col gap-2 no-print">
        {/* Botão Flutuante de Compartilhar/Exportar */}
        <div className="relative">
          <button 
            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} 
            className="p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all active:scale-95 flex items-center justify-center"
            title="Exportar / Compartilhar Relatório"
          >
            <Share2 size={20} />
          </button>

          {isExportMenuOpen && (
            <div className="absolute right-0 bottom-full mb-2 w-56 sm:w-60 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-[120] py-1.5 text-xs sm:text-sm text-slate-200 animate-scaleUp">
              <button 
                onClick={() => { handlePrint(); setIsExportMenuOpen(false); }}
                className="flex items-center gap-2.5 sm:gap-3 w-full px-3.5 sm:px-4 py-2.5 text-left hover:bg-slate-700 text-white font-semibold transition-colors"
              >
                <Printer size={16} className="text-cyan-400 shrink-0" />
                <span>Imprimir / Gerar PDF</span>
              </button>
              <button 
                onClick={() => { handleCopySEI(); setIsExportMenuOpen(false); }}
                className="flex items-center gap-2.5 sm:gap-3 w-full px-3.5 sm:px-4 py-2.5 text-left hover:bg-slate-700 text-white font-semibold transition-colors"
                title="Copiar dados e gráficos formatados para SEI / Word"
              >
                <Copy size={16} className="text-amber-400 shrink-0" />
                <span>{copied ? 'DADOS COPIADOS!' : 'COPIAR DADOS'}</span>
              </button>
              <button 
                onClick={() => { handleWhatsApp(); setIsExportMenuOpen(false); }}
                className="flex items-center gap-2.5 sm:gap-3 w-full px-3.5 sm:px-4 py-2.5 text-left hover:bg-slate-700 text-white font-semibold transition-colors"
              >
                <MessageCircle size={16} className="text-emerald-400 shrink-0" />
                <span>Compartilhar WhatsApp</span>
              </button>
              <button 
                onClick={() => { handleExportCSV(); setIsExportMenuOpen(false); }}
                className="flex items-center gap-2.5 sm:gap-3 w-full px-3.5 sm:px-4 py-2.5 text-left hover:bg-slate-700 text-white font-semibold transition-colors"
              >
                <Download size={16} className="text-blue-400 shrink-0" />
                <span>Exportar Planilha (CSV)</span>
              </button>

                <button 
                  onClick={() => { setShowSeiModal(true); setIsExportMenuOpen(false); }}
                  className="flex items-center gap-2.5 sm:gap-3 w-full px-3.5 sm:px-4 py-2.5 text-left hover:bg-slate-700 text-white font-semibold transition-colors border-t border-slate-700"
                >
                  <span className="shrink-0">🚀</span>
                  <span className="text-emerald-400">Gerar Processo no SEI</span>
                </button>

            </div>
          )}
        </div>

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
      <div className={`flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4 pb-2 border-b border-slate-700 no-print px-2 lg:px-0 gap-3 ${isMaximized ? 'sticky top-0 z-[110] bg-slate-900/95 backdrop-blur-sm pt-4 shadow-sm' : ''}`}>
        <div className="flex items-center justify-between w-full lg:w-auto gap-2">
          <h2 className="text-lg sm:text-xl font-bold text-blue-400 flex items-center gap-2 drop-shadow-sm truncate">
            <FileSpreadsheet size={22} className="shrink-0" /> 
            <span>Relatórios de Vistoria</span>
          </h2>

          <div className="flex items-center gap-1.5 lg:hidden">
            <button 
              onClick={() => setIsMaximized(!isMaximized)} 
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg transition-colors border border-slate-600"
              title={isMaximized ? "Minimizar" : "Maximizar"}
            >
              {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button onClick={onClose} className="p-1.5 bg-slate-800 hover:bg-red-900/50 hover:text-red-400 text-slate-400 rounded-lg transition-colors border border-slate-600">
              <X size={18} />
            </button>
          </div>
        </div>
        
        <div className="flex bg-slate-800 rounded-lg p-1 w-full lg:w-auto shadow-inner border border-slate-700">
          <button 
            onClick={() => setReportType('interno')}
            className={`flex-1 lg:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-1.5 sm:py-2 rounded-md font-bold text-xs sm:text-sm transition-all ${reportType === 'interno' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <ShieldHalf size={15} /> Relatório Geral (CBMDF)
          </button>
          <button 
            onClick={() => setReportType('caesb')}
            className={`flex-1 lg:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-1.5 sm:py-2 rounded-md font-bold text-xs sm:text-sm transition-all ${reportType === 'caesb' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Building2 size={15} /> Relatório de Alterações (CAESB)
          </button>
        </div>

        {/* Controles Desktop */}
        <div className="hidden lg:flex items-center gap-2">
          <button 
            onClick={() => setIsMaximized(!isMaximized)} 
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-full transition-colors border border-slate-600"
            title={isMaximized ? "Minimizar" : "Maximizar"}
          >
            {isMaximized ? <Minimize2 size={22} /> : <Maximize2 size={22} />}
          </button>
          <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-red-900/50 hover:text-red-400 text-slate-400 rounded-full transition-colors border border-slate-600">
            <X size={22} />
          </button>
        </div>
      </div>

      {/* ÁREA IMPRIMÍVEL (Relatório) */}
      <div className="w-full h-auto bg-slate-800/50 lg:bg-slate-800 rounded-xl p-3 sm:p-6 border border-slate-700 report-content print-bg-white print-text-black pb-24">
        
        {/* CABEÇALHO DA PÁGINA IMPRESSA */}
        <div className="text-center mb-6 sm:mb-8 border-b-2 border-slate-700 print-border-black pb-4">
          {reportType === 'interno' ? (
            <>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100 print-text-black uppercase tracking-wide">Corpo de Bombeiros Militar do Distrito Federal</h1>
              <h2 className="text-base sm:text-lg text-slate-300 print-text-black mt-1 uppercase font-bold">Sistema Netuno - Relatório de Vistoria</h2>
              <div className="mt-4 flex flex-col items-center gap-1 text-xs sm:text-sm text-slate-300 print-text-black">
                <span className="bg-slate-700/50 print-bg-transparent px-3 sm:px-4 py-1.5 rounded-full border border-slate-600 print-border-gray shadow-sm">
                  <strong>Regiões Administrativas (RAs):</strong> {rasPresentes || 'Todas as Cidades / DF Completo'}
                </span>
                {currentMission && (
                  <span className="text-[11px] sm:text-xs text-slate-400 print-text-black font-semibold mt-1">
                    <strong>Missão Ativa:</strong> {currentMission.name}
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100 print-text-black uppercase tracking-wide">Corpo de Bombeiros Militar do Distrito Federal</h1>
              <h2 className="text-base sm:text-lg text-emerald-400 print-text-black mt-1 uppercase font-black">Solicitação de Manutenção de Hidrantes Urbanos de Incêndio - CBMDF / CAESB</h2>
              <p className="text-[11px] sm:text-xs text-slate-400 print-text-gray mt-1 uppercase tracking-wider font-bold">
                De acordo com o Termo de Cooperação Técnica CAESB/CBMDF publicado no DODF em 25/03/2019
              </p>
              <div className="mt-4 flex flex-col items-center text-xs sm:text-sm text-slate-300 print-text-black">
                <span className="bg-slate-700/50 print-bg-transparent px-3 sm:px-4 py-1.5 rounded-full border border-slate-600 print-border-gray shadow-sm">
                  <strong>Regiões Administrativas (RAs):</strong> {rasPresentes || 'Nenhuma região filtrada'}
                </span>
              </div>
            </>
          )}
        </div>

        {/* KPIs e GRÁFICOS */}
        {reportType === 'interno' ? (
          <div className="flex flex-col gap-5 sm:gap-6 mb-8">
            
            {/* Bloco de Totais e Indicador Geral */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 print-flex print-flex-row">
              {/* Bloco de Totais Numéricos */}
              <div className="md:col-span-8 grid grid-cols-3 gap-2 sm:gap-3">
                <div className="bg-slate-800 p-2.5 sm:p-4 rounded-xl border border-slate-700 print-border-gray print-bg-white flex flex-col justify-between shadow-sm">
                  <div className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1 truncate">Total Vistoriado</div>
                  <div className="text-xl sm:text-3xl font-black text-white print-text-black">{total}</div>
                </div>
                <div className="bg-emerald-950/40 p-2.5 sm:p-4 rounded-xl border border-emerald-800/60 print-border-gray print-bg-white flex flex-col justify-between shadow-sm">
                  <div className="text-emerald-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1 truncate">Operantes</div>
                  <div className="flex items-baseline justify-between gap-1 flex-wrap">
                    <span className="text-xl sm:text-3xl font-black text-emerald-400 print-text-black">{operantes}</span>
                    <span className="text-[10px] sm:text-xs font-bold text-emerald-300 bg-emerald-900/60 px-1.5 py-0.5 rounded border border-emerald-700/60">{operantesPercent}%</span>
                  </div>
                </div>
                <div className="bg-red-950/40 p-2.5 sm:p-4 rounded-xl border border-red-800/60 print-border-gray print-bg-white flex flex-col justify-between shadow-sm">
                  <div className="text-red-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1 truncate">Inoperantes</div>
                  <div className="flex items-baseline justify-between gap-1 flex-wrap">
                    <span className="text-xl sm:text-3xl font-black text-red-500 print-text-black">{inoperantes}</span>
                    <span className="text-[10px] sm:text-xs font-bold text-red-300 bg-red-900/60 px-1.5 py-0.5 rounded border border-red-700/60">{inoperantesPercent}%</span>
                  </div>
                </div>
              </div>

              {/* Donut Geral de Operacionalidade */}
              <div className="md:col-span-4 bg-slate-800 p-3 sm:p-4 rounded-xl border border-slate-700 print-border-gray print-bg-white flex items-center justify-around shadow-sm page-break-inside-avoid">
                <div className="flex flex-col items-center">
                  <h3 className="text-[10px] sm:text-xs font-bold text-slate-300 print-text-black uppercase tracking-wider text-center mb-1.5">Operacionalidade Geral</h3>
                  <div className="relative w-20 h-20 sm:w-28 sm:h-28 rounded-full print-donut shadow-inner border-4 border-slate-900 print-border-white" style={{ background: `conic-gradient(#10b981 ${operantesPercent}%, #ef4444 ${operantesPercent}% 100%)` }}>
                    <div className="absolute inset-1.5 sm:inset-2 bg-slate-800 print-bg-white rounded-full flex flex-col items-center justify-center shadow-md">
                      <span className="text-base sm:text-xl font-black text-white print-text-black">{operantesPercent}%</span>
                      <span className="text-[8px] sm:text-[9px] text-slate-400 print-text-black font-bold uppercase">OK</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-semibold">
                  <div className="flex items-center gap-1.5 text-emerald-400 print-text-black">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shrink-0"></span>
                    <span>{operantes} Operantes</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-red-400 print-text-black">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block shrink-0"></span>
                    <span>{inoperantes} Inoperantes</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SEÇÃO MULTI-CIDADES: Comparativo de Operacionalidade por Cidade e Quebra de Problemas */}
            {isMultiCity ? (
              <div className="space-y-6">
                
                {/* 1. Gráfico de Barras Empilhadas por Cidade */}
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 print-border-gray print-bg-white shadow-sm page-break-inside-avoid">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-slate-700 print-border-gray gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-100 print-text-black uppercase tracking-wide">
                        📊 Comparativo de Operacionalidade por Cidade (RAs)
                      </h3>
                      <p className="text-xs text-slate-400 print-text-gray">
                        Cidades ordenadas por volume total de hidrantes cadastrados / vistoriados (ordem decrescente).
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-bold self-start sm:self-auto">
                      <span className="flex items-center gap-1 text-emerald-400 print-text-black">
                        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span> Operante
                      </span>
                      <span className="flex items-center gap-1 text-red-400 print-text-black">
                        <span className="w-2.5 h-2.5 rounded-sm bg-red-500"></span> Inoperante
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    {cityOperabilityStats.map((c, idx) => (
                      <div key={idx} className="flex flex-col gap-1">
                        <div className="flex justify-between items-center text-xs font-medium">
                          <span className="text-slate-200 print-text-black font-bold text-sm">
                            {c.nome} <span className="text-slate-400 font-normal text-xs">({c.total} hidrantes)</span>
                          </span>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-emerald-400 print-text-black font-bold">🟢 {c.operantes} ({c.operantesPercent}%)</span>
                            <span className="text-slate-500">|</span>
                            <span className={`font-bold ${c.inoperantes > 0 ? 'text-red-400 print-text-black' : 'text-slate-400'}`}>
                              🔴 {c.inoperantes} ({c.inoperantesPercent}%)
                            </span>
                          </div>
                        </div>
                        {/* Barra Proporcional ao Volume da Cidade com Divisão Operante / Inoperante */}
                        <div className="w-full h-3 bg-slate-900/60 rounded-full overflow-hidden flex shadow-inner print-bg-gray border border-slate-700/50">
                          <div 
                            className="h-full rounded-full overflow-hidden flex transition-all duration-700"
                            style={{ width: `${Math.max(6, (c.total / maxCityTotal) * 100)}%` }}
                          >
                            <div 
                              className="bg-emerald-500 h-full transition-all duration-700 hover:brightness-110" 
                              style={{ width: `${c.operantesPercent}%` }}
                              title={`${c.nome}: ${c.operantes} operantes (${c.operantesPercent}%)`}
                            ></div>
                            <div 
                              className="bg-red-500 h-full transition-all duration-700 hover:brightness-110" 
                              style={{ width: `${c.inoperantesPercent}%` }}
                              title={`${c.nome}: ${c.inoperantes} inoperantes (${c.inoperantesPercent}%)`}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Top Defeitos com Distribuição pelas Cidades com Maior Incidência */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 page-break-inside-avoid">
                  
                  <div className="lg:col-span-7 bg-slate-800 p-5 rounded-xl border border-slate-700 print-border-gray print-bg-white shadow-sm">
                    <h3 className="text-sm font-bold text-slate-100 print-text-black uppercase tracking-wider mb-4 border-b border-slate-700 print-border-gray pb-2">
                      ⚠️ Top Defeitos do DF e Cidades Mais Afetadas
                    </h3>
                    {topDefeitosComCidades.length > 0 ? (
                      <div className="space-y-4">
                        {topDefeitosComCidades.map((defeito, idx) => (
                          <div key={idx} className="flex flex-col gap-1.5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                              <span className="font-bold text-slate-200 print-text-black text-xs sm:text-sm break-words leading-tight" title={defeito.nome}>
                                {defeito.nome}
                              </span>
                              <span className="font-bold text-rose-400 print-text-black text-[11px] sm:text-xs shrink-0 whitespace-nowrap bg-rose-950/40 border border-rose-800/40 px-2 py-0.5 rounded">
                                {defeito.total} ocorr. ({defeito.percent.toFixed(1)}%)
                              </span>
                            </div>
                            
                            {/* Barra de Progresso Geral */}
                            <div className="w-full bg-slate-700 h-2.5 rounded-full overflow-hidden print-bg-gray">
                              <div 
                                className="bg-red-500 h-full print-bg-black transition-all duration-700" 
                                style={{ width: `${Math.max(4, defeito.barPercent)}%` }}
                              ></div>
                            </div>

                            {/* Cidades Líderes desse Defeito */}
                            {defeito.topCidades && defeito.topCidades.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] text-slate-400 uppercase font-semibold">Cidades c/ maior foco:</span>
                                {defeito.topCidades.map((tc, tcIdx) => (
                                  <span key={tcIdx} className="text-[11px] bg-slate-700/80 print-bg-gray text-slate-200 print-text-black px-2 py-0.5 rounded font-medium border border-slate-600">
                                    📍 <strong>{tc.cidade}</strong>: {tc.qtd}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 text-center italic mt-4">Nenhum defeito registrado no período.</p>
                    )}
                  </div>

                  {/* Vistorias por Ano */}
                  <div className="lg:col-span-5 bg-slate-800 p-5 rounded-xl border border-slate-700 print-border-gray print-bg-white shadow-sm flex flex-col justify-start">
                    <h3 className="text-sm font-bold text-slate-100 print-text-black uppercase tracking-wider mb-4 border-b border-slate-700 print-border-gray pb-2">
                      📅 Distribuição Temporal (Vistorias por Ano)
                    </h3>
                    {yearStats.length > 0 ? (
                      <div className="space-y-3">
                        {yearStats.map((y, idx) => (
                          <div key={idx} className="flex flex-col gap-1">
                            <div className="flex justify-between text-xs text-slate-300 print-text-black">
                              <span className="font-bold text-sm">{y.nome}</span>
                              <span className="font-black text-emerald-400 print-text-black">{y.count} vistorias</span>
                            </div>
                            <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden print-bg-gray">
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
            ) : (
              /* MODO CIDADE ÚNICA */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 page-break-inside-avoid">
                {/* Top Defeitos */}
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 print-border-gray print-bg-white shadow-sm">
                  <h3 className="text-sm font-bold text-slate-200 print-text-black uppercase tracking-wider mb-4 border-b border-slate-700 print-border-gray pb-2">Top Defeitos Registrados</h3>
                  {topDefeitos.length > 0 ? (
                    <div className="space-y-3.5">
                      {topDefeitos.map((defeito, idx) => (
                        <div key={idx} className="flex flex-col gap-1">
                          <div className="flex justify-between items-center text-xs text-slate-300 print-text-black gap-2">
                            <span className="truncate font-medium" title={defeito.nome}>{defeito.nome}</span>
                            <span className="font-bold text-rose-400 bg-rose-950/40 border border-rose-800/40 px-2 py-0.5 rounded text-[11px] shrink-0">{defeito.count} ocorr. ({defeito.percent.toFixed(1)}%)</span>
                          </div>
                          <div className="w-full bg-slate-700 h-2.5 rounded-full overflow-hidden print-bg-gray">
                            <div 
                              className="bg-red-500 h-full print-bg-black transition-all duration-700" 
                              style={{ width: `${Math.max(4, defeito.barPercent)}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 text-center italic mt-4">Nenhum defeito registrado.</p>
                  )}
                </div>

                {/* Vistorias por Ano */}
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 print-border-gray print-bg-white shadow-sm">
                  <h3 className="text-sm font-bold text-slate-200 print-text-black uppercase tracking-wider mb-4 border-b border-slate-700 print-border-gray pb-2">Vistorias por Ano</h3>
                  {yearStats.length > 0 ? (
                    <div className="space-y-3.5">
                      {yearStats.map((y, idx) => (
                        <div key={idx} className="flex flex-col gap-1">
                          <div className="flex justify-between text-xs text-slate-300 print-text-black">
                            <span className="font-medium">{y.nome}</span>
                            <span className="font-bold">{y.count} vist.</span>
                          </div>
                          <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden print-bg-gray">
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
            )}

          </div>
        ) : (
          /* CAESB KPIs e GRÁFICOS (MODO MULTI-CIDADE E CIDADE ÚNICA) */
          <div className="space-y-6 mb-6 page-break-inside-avoid">
            
            {/* Bloco de Totais de Reparo CAESB */}
            <div className="bg-red-950/30 p-5 rounded-xl border border-red-800/60 print-border-gray print-bg-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="text-5xl font-black text-red-500 print-text-black drop-shadow-md">{total}</div>
                <div>
                  <div className="text-slate-100 text-sm sm:text-base font-extrabold uppercase">Total de Hidrantes para Reparo</div>
                  <div className="text-xs text-slate-400">Encaminhamento para manutenção preventiva e corretiva CAESB</div>
                </div>
              </div>
              {isMultiCity && (
                <div className="text-xs font-bold text-amber-400 bg-amber-950/40 px-3.5 py-2 rounded-lg border border-amber-800/50">
                  📍 {cityOperabilityStats.filter(c => c.total > 0).length} cidades com demanda de reparo
                </div>
              )}
            </div>

            {/* Se for multi-cidade, exibe a Demanda de Manutenção por Cidade em Barras Horizontais Idêntico ao Relatório Geral */}
            {isMultiCity && (
              <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 print-border-gray print-bg-white shadow-sm page-break-inside-avoid">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-slate-700 print-border-gray gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-100 print-text-black uppercase tracking-wide">
                      🏢 Demanda de Manutenção por Cidade (Ranking CAESB)
                    </h3>
                    <p className="text-xs text-slate-400 print-text-gray">
                      Cidades ordenadas por volume de hidrantes que necessitam de intervenção ou reparo (ordem decrescente).
                    </p>
                  </div>
                  <div className="text-xs font-bold text-slate-400 self-start sm:self-auto">
                    Total CAESB: <span className="text-amber-400 font-black">{total} reparos</span>
                  </div>
                </div>

                <div className="space-y-3.5">
                  {cityOperabilityStats.filter(c => c.total > 0).map((c, idx) => {
                    const percentDF = total > 0 ? ((c.total / total) * 100).toFixed(1) : '0.0';
                    return (
                      <div key={idx} className="flex flex-col gap-1">
                        <div className="flex justify-between items-center text-xs font-medium">
                          <span className="text-slate-200 print-text-black font-bold text-sm">
                            {c.nome} <span className="text-slate-400 font-normal text-xs">({c.total} hidrantes para reparo)</span>
                          </span>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-amber-400 print-text-black font-black">
                              🛠️ {c.total} reparos ({percentDF}% do DF)
                            </span>
                          </div>
                        </div>
                        {/* Barra Proporcional ao Volume de Reparos da Cidade */}
                        <div className="w-full h-3 bg-slate-900/60 rounded-full overflow-hidden flex shadow-inner print-bg-gray border border-slate-700/50">
                          <div 
                            className="h-full rounded-full overflow-hidden flex transition-all duration-700"
                            style={{ width: `${Math.max(6, (c.total / maxCityTotal) * 100)}%` }}
                          >
                            <div 
                              className="bg-amber-500 h-full transition-all duration-700 hover:brightness-110 w-full rounded-full" 
                              title={`${c.nome}: ${c.total} reparos (${percentDF}% do DF)`}
                            ></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Principais Defeitos CAESB com Foco Regional */}
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 print-border-gray print-bg-white shadow-sm">
              <h3 className="text-sm font-bold text-slate-100 print-text-black uppercase tracking-wider mb-4 border-b border-slate-700 print-border-gray pb-2">
                🛠️ Principais Tipos de Defeitos para Intervenção CAESB {isMultiCity && 'e Cidades com Maior Volume'}
              </h3>
              {topDefeitosComCidades.length > 0 ? (
                <div className="space-y-4">
                  {topDefeitosComCidades.map((defeito, idx) => (
                    <div key={idx} className="flex flex-col gap-1.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                        <span className="font-bold text-slate-200 print-text-black text-xs sm:text-sm break-words leading-tight" title={defeito.nome}>
                          {defeito.nome}
                        </span>
                        <span className="font-bold text-rose-400 print-text-black text-[11px] sm:text-xs shrink-0 whitespace-nowrap bg-rose-950/40 border border-rose-800/40 px-2 py-0.5 rounded">
                          {defeito.total} ocorr. ({defeito.percent.toFixed(1)}%)
                        </span>
                      </div>
                      
                      <div className="w-full bg-slate-700 h-2.5 rounded-full overflow-hidden print-bg-gray">
                        <div 
                          className="bg-rose-500 h-full print-bg-black transition-all duration-700" 
                          style={{ width: `${Math.max(4, defeito.barPercent)}%` }}
                        ></div>
                      </div>

                      {/* Cidades onde a CAESB deve priorizar peças e equipes */}
                      {isMultiCity && defeito.topCidades && defeito.topCidades.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Priorizar em:</span>
                          {defeito.topCidades.map((tc, tcIdx) => (
                            <span key={tcIdx} className="text-[11px] bg-slate-700/80 print-bg-gray text-slate-200 print-text-black px-2 py-0.5 rounded font-medium border border-slate-600">
                              📍 <strong>{tc.cidade}</strong>: {tc.qtd}
                            </span>
                          ))}
                        </div>
                      )}
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
                          {h.problemasHidrante ? sanitizeProblem(h.problemasHidrante) : (!h.flgAtivo ? 'INOPERANTE' : '-')}
                        </td>
                        <td className="px-4 py-3 text-slate-400 print-text-black print-border whitespace-normal text-xs" title={h.dscObservacao || h.observacoes || h.obsVistoria}>
                          {h.dscObservacao || h.observacoes || h.obsVistoria || '-'}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-bold text-red-400 print-text-black print-border whitespace-normal text-xs" title={sanitizeProblem(h.problemasHidrante)}>
                          <div>
                            {h.problemasHidrante ? sanitizeProblem(h.problemasHidrante) : (!h.flgAtivo ? 'INOPERANTE' : '-')}
                          </div>
                          {(h.dscObservacao || h.observacoes || h.obsVistoria) && (
                            <div className="mt-1 text-[11px] font-normal text-slate-300 print-text-black italic bg-slate-900/40 print-bg-transparent p-1 rounded border border-slate-700/50 print-border-0">
                              <span className="font-semibold text-slate-400 print-text-black not-italic">Obs: </span>
                              {h.dscObservacao || h.observacoes || h.obsVistoria}
                            </div>
                          )}
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
    </div>
  );
};

export default MissionReportPanel;
