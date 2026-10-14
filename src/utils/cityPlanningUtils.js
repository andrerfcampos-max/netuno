import { parseDate, formatDateOnly } from './dateUtils';
import { RA_LIST, normalizeRAName } from './raList';

/**
 * Utilitário de Planejamento de Vistoria de Cidades (Netuno CBMDF)
 * Calcula a sequência cronológica de vistorias cidade a cidade (RA a RA)
 * com base na Data Média ponderada das vistorias realizadas no ciclo base.
 * Permite projetar o próximo ciclo ordenando da cidade mais antiga para a mais recente.
 */

export const calculateCityPlanningData = ({ 
  hidrantes = [], 
  baseYear = 2025, 
  targetYear = 2026,
  activeYear = 2026
}) => {
  const detectedYearsSet = new Set();

  // Inicializa mapa com todas as 33 Regiões Administrativas oficiais do DF
  const cityMap = {};
  RA_LIST.forEach(ra => {
    cityMap[ra.name] = {
      name: ra.name,
      prefix: ra.prefix,
      lat: ra.lat,
      lng: ra.lng,
      totalHydrants: 0,
      hydrantIds: [],
      byYear: {},
      lastOverallTimestamp: -Infinity,
      lastOverallDate: null,
      oldestOverallTimestamp: Infinity,
      oldestOverallDate: null
    };
  });

  // Processa todos os hidrantes da base de dados
  hidrantes.forEach(h => {
    const rawRA = h.dscLocalidade;
    const raName = normalizeRAName(rawRA);
    if (!raName || !cityMap[raName]) return;

    cityMap[raName].totalHydrants++;
    const hidId = h._internalId || h.codHidrante || h.nomHidrante;
    if (hidId) cityMap[raName].hydrantIds.push(hidId);

    // Coleta todas as vistorias válidas do hidrante
    const visits = [];
    const mainDt = parseDate(h.datHoraUltimaVistoria || h.datUltimaVistoria || h.dataUltimaVistoria || h.datHoraVistoria);
    if (mainDt) {
      visits.push({ 
        date: mainDt, 
        isOperante: h.flgAtivo !== false 
      });
    }

    if (Array.isArray(h.HISTORICO_VISTORIAS)) {
      h.HISTORICO_VISTORIAS.forEach(entry => {
        const d = parseDate(entry?.datHoraVistoria || entry?.datHoraUltimaVistoria || entry?.dataVistoria || entry?.timestamp);
        if (d) {
          visits.push({ 
            date: d, 
            isOperante: entry.flgAtivo !== false && entry.situacao !== 'Inoperante' 
          });
        }
      });
    }

    // Deduplica vistorias do mesmo hidrante no mesmo ano (prevalece a mais recente daquele ano)
    const byYearHydrant = {};
    visits.forEach(v => {
      const y = v.date.getFullYear();
      if (y >= 2018 && y <= 2035) {
        detectedYearsSet.add(y);
        if (!byYearHydrant[y] || v.date > byYearHydrant[y].date) {
          byYearHydrant[y] = v;
        }
      }
    });

    Object.entries(byYearHydrant).forEach(([yStr, visit]) => {
      const y = parseInt(yStr, 10);
      if (!cityMap[raName].byYear[y]) {
        cityMap[raName].byYear[y] = {
          timestamps: [],
          operantes: 0,
          inoperantes: 0
        };
      }
      const t = visit.date.getTime();
      cityMap[raName].byYear[y].timestamps.push(t);
      if (visit.isOperante) {
        cityMap[raName].byYear[y].operantes++;
      } else {
        cityMap[raName].byYear[y].inoperantes++;
      }

      if (t > cityMap[raName].lastOverallTimestamp) {
        cityMap[raName].lastOverallTimestamp = t;
        cityMap[raName].lastOverallDate = visit.date;
      }
      if (t < cityMap[raName].oldestOverallTimestamp) {
        cityMap[raName].oldestOverallTimestamp = t;
        cityMap[raName].oldestOverallDate = visit.date;
      }
    });
  });

  const availableYears = Array.from(detectedYearsSet).sort((a, b) => b - a);
  if (!availableYears.includes(2026)) availableYears.unshift(2026);
  if (!availableYears.includes(2025)) availableYears.push(2025);

  // Função auxiliar para calcular métricas de um ano para uma RA
  const computeStats = (city, year) => {
    const yearData = city.byYear[year];
    if (!yearData || yearData.timestamps.length === 0) {
      return {
        year,
        inspectedCount: 0,
        coveragePct: 0,
        avgDate: null,
        avgTimestamp: -Infinity,
        minDate: null,
        maxDate: null,
        durationDays: 0,
        operantes: 0,
        inoperantes: 0,
        hasVisits: false
      };
    }

    const ts = yearData.timestamps;
    const sum = ts.reduce((a, b) => a + b, 0);
    const avgTimestamp = Math.round(sum / ts.length);
    const avgDate = new Date(avgTimestamp);
    const minTimestamp = Math.min(...ts);
    const maxTimestamp = Math.max(...ts);
    const minDate = new Date(minTimestamp);
    const maxDate = new Date(maxTimestamp);
    const durationDays = Math.max(1, Math.round((maxTimestamp - minTimestamp) / (1000 * 60 * 60 * 24)) + 1);
    const inspectedCount = ts.length;
    const coveragePct = city.totalHydrants > 0 ? Math.round((inspectedCount / city.totalHydrants) * 100) : 0;

    return {
      year,
      inspectedCount,
      coveragePct,
      avgDate,
      avgTimestamp,
      minDate,
      maxDate,
      durationDays,
      operantes: yearData.operantes,
      inoperantes: yearData.inoperantes,
      hasVisits: true
    };
  };

  // Monta lista de dados enriquecida para cada cidade
  const allCities = Object.values(cityMap).map(city => {
    const baseStats = computeStats(city, baseYear);
    const targetStats = computeStats(city, targetYear);
    const activeStats = computeStats(city, activeYear);

    // Status no ciclo alvo (targetYear)
    let planningStatus = 'pending'; // 'pending' | 'in_progress' | 'completed'
    if (targetStats.coveragePct >= 95 || (targetStats.inspectedCount >= city.totalHydrants && city.totalHydrants > 0)) {
      planningStatus = 'completed';
    } else if (targetStats.inspectedCount > 0) {
      planningStatus = 'in_progress';
    }

    // Status no ano de visualização isolada (activeStats)
    let activeStatus = 'pending';
    if (activeStats.coveragePct >= 95 || (activeStats.inspectedCount >= city.totalHydrants && city.totalHydrants > 0)) {
      activeStatus = 'completed';
    } else if (activeStats.inspectedCount > 0) {
      activeStatus = 'in_progress';
    }

    return {
      ...city,
      baseStats,
      targetStats,
      activeStats,
      planningStatus,
      activeStatus
    };
  });

  // 1. MODO PROJEÇÃO DE PLANEJAMENTO (BaseYear -> TargetYear):
  // Ordenação da mais antiga para a mais recente (ASC)
  // Quem não foi vistoriado no ano base (ou foi vistoriado antes) tem PRIORIDADE MÁXIMA (fica no início)
  const planningList = [...allCities].sort((a, b) => {
    // Caso 1: Uma tem vistorias no ano base e a outra não
    if (a.baseStats.hasVisits && !b.baseStats.hasVisits) return 1; // 'a' vai depois
    if (!a.baseStats.hasVisits && b.baseStats.hasVisits) return -1; // 'b' vai depois

    // Caso 2: Nenhuma tem vistorias no ano base -> prioriza quem tem vistoria geral mais antiga
    if (!a.baseStats.hasVisits && !b.baseStats.hasVisits) {
      if (a.lastOverallTimestamp !== b.lastOverallTimestamp) {
        return a.lastOverallTimestamp - b.lastOverallTimestamp; // Mais antiga primeiro
      }
      return a.name.localeCompare(b.name, 'pt-BR');
    }

    // Caso 3: Ambas têm vistorias no ano base -> compara a Data Média (ASC - mais antiga primeiro)
    return a.baseStats.avgTimestamp - b.baseStats.avgTimestamp;
  });

  // Atribui posições de sequência no planejamento
  planningList.forEach((c, idx) => {
    c.planningRank = idx + 1;
  });

  // Identifica a cidade atual em andamento e a próxima recomendada
  const inProgressCity = planningList.find(c => c.planningStatus === 'in_progress') || null;
  const nextPendingCity = planningList.find(c => c.planningStatus === 'pending') || null;

  // 2. MODO SEQUÊNCIA REALIZADA POR ANO (activeYear):
  // Mostra as cidades que tiveram vistorias no ano selecionado ordenadas pela data média daquele ano
  const activeYearWithVisits = allCities
    .filter(c => c.activeStats.hasVisits)
    .sort((a, b) => a.activeStats.avgTimestamp - b.activeStats.avgTimestamp);

  activeYearWithVisits.forEach((c, idx) => {
    c.activeYearRank = idx + 1;
  });

  const activeYearWithoutVisits = allCities
    .filter(c => !c.activeStats.hasVisits)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  // Métricas agregadas do planejamento
  const totalCities = allCities.length;
  const completedCities = planningList.filter(c => c.planningStatus === 'completed').length;
  const inProgressCities = planningList.filter(c => c.planningStatus === 'in_progress').length;
  const pendingCities = planningList.filter(c => c.planningStatus === 'pending').length;

  return {
    allCities,
    planningList,
    activeYearWithVisits,
    activeYearWithoutVisits,
    availableYears,
    baseYear,
    targetYear,
    activeYear,
    inProgressCity,
    nextPendingCity,
    metrics: {
      totalCities,
      completedCities,
      inProgressCities,
      pendingCities,
      overallProgressPct: totalCities > 0 ? Math.round((completedCities / totalCities) * 100) : 0
    }
  };
};

/**
 * Formata o texto do planejamento para envio via WhatsApp ou mensagens de comando.
 */
export const formatCityPlanningWhatsAppText = ({
  planningList = [],
  baseYear = 2025,
  targetYear = 2026,
  metrics = {}
}) => {
  let text = `🚒 *CBMDF - PLANEJAMENTO DE VISTORIAS POR CIDADE*\n`;
  text += `📅 *Ciclo de Execução:* ${targetYear} (Baseado no ciclo de ${baseYear})\n`;
  text += `🎯 *Regra Tática:* Sequência da cidade mais antiga para a mais recente por Data Média\n`;
  text += `📊 *Progresso Geral:* ${metrics.completedCities || 0}/${metrics.totalCities || 33} cidades concluídas (${metrics.overallProgressPct || 0}%)\n\n`;

  text += `📋 *ORDEM PRIORITÁRIA DE VISTORIAS (CIDADE A CIDADE):*\n`;

  planningList.forEach(c => {
    const statusIcon = c.planningStatus === 'completed' 
      ? '✅ [CONCLUÍDA]' 
      : c.planningStatus === 'in_progress' 
      ? '⏳ [EM ANDAMENTO]' 
      : '🚨 [PENDENTE]';

    const avgStr = c.baseStats.avgDate ? formatDateOnly(c.baseStats.avgDate) : 'Sem vistoria no ciclo base';
    const progressStr = `${c.targetStats.inspectedCount}/${c.totalHydrants} (${c.targetStats.coveragePct}%)`;

    text += `${c.planningRank}º. *${c.name}* [${c.prefix}]\n`;
    text += `   • Data Média Ref. (${baseYear}): ${avgStr}\n`;
    text += `   • Status em ${targetYear}: ${statusIcon} - ${progressStr}\n\n`;
  });

  text += `_Gerado automaticamente pelo Sistema Netuno - CBMDF em ${new Date().toLocaleDateString('pt-BR')}_`;
  return text;
};

/**
 * Gera documento HTML para impressão e exportação em PDF da sequência de planejamento.
 */
export const generateCityPlanningPrintHtml = ({
  planningList = [],
  baseYear = 2025,
  targetYear = 2026,
  metrics = {},
  currentUser = null
}) => {
  const now = new Date();
  const dateFormatted = formatDateOnly(now);
  const timeFormatted = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const rowsHtml = planningList.map(c => {
    const statusLabel = c.planningStatus === 'completed'
      ? '<span style="color: #059669; font-weight: bold;">Concluída (100%)</span>'
      : c.planningStatus === 'in_progress'
      ? `<span style="color: #d97706; font-weight: bold;">Em Andamento (${c.targetStats.coveragePct}%)</span>`
      : '<span style="color: #dc2626; font-weight: bold;">Pendente (0%)</span>';

    const avgDateStr = c.baseStats.avgDate ? formatDateOnly(c.baseStats.avgDate) : '<em style="color:#64748b;">Anterior a ' + baseYear + '</em>';
    const minMaxStr = c.baseStats.minDate && c.baseStats.maxDate
      ? `${formatDateOnly(c.baseStats.minDate)} a ${formatDateOnly(c.baseStats.maxDate)} (${c.baseStats.durationDays}d)`
      : '-';

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 6px 8px; text-align: center; font-weight: bold; color: #1e293b;">${c.planningRank}º</td>
        <td style="padding: 6px 8px; font-weight: 600; color: #0f172a;">${c.name} <span style="font-size: 9px; color: #64748b;">(${c.prefix})</span></td>
        <td style="padding: 6px 8px; text-align: center; font-weight: 600; color: #0284c7;">${avgDateStr}</td>
        <td style="padding: 6px 8px; text-align: center; color: #475569;">${minMaxStr}</td>
        <td style="padding: 6px 8px; text-align: center;">${c.totalHydrants}</td>
        <td style="padding: 6px 8px; text-align: center; font-weight: 600;">${c.targetStats.inspectedCount} / ${c.totalHydrants}</td>
        <td style="padding: 6px 8px; text-align: center;">${statusLabel}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Planejamento_Vistorias_Cidades_${targetYear}_CBMDF</title>
      <style>
        @page { size: A4 portrait; margin: 12mm 10mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; }
        .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
        .header h1 { font-size: 15px; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
        .header h2 { font-size: 13px; margin: 3px 0; color: #1e293b; }
        .header p { font-size: 10px; margin: 0; color: #64748b; }
        .kpi-container { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
        .kpi-card { flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px; text-align: center; background: #f8fafc; }
        .kpi-card .val { font-size: 14px; font-weight: bold; color: #0f172a; }
        .kpi-card .lbl { font-size: 9px; color: #64748b; text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background: #f1f5f9; color: #334155; font-size: 10px; text-transform: uppercase; padding: 6px 8px; border-bottom: 2px solid #cbd5e1; }
        .footer { margin-top: 14px; border-top: 1px solid #e2e8f0; padding-top: 6px; font-size: 9px; color: #64748b; display: flex; justify-content: space-between; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Corpo de Bombeiros Militar do Distrito Federal</h1>
        <h2>Planejamento de Vistoria de Cidades (Sequência Anual)</h2>
        <p>Ciclo Alvo: <strong>${targetYear}</strong> | Base de Referência: <strong>${baseYear}</strong> | Critério: Data Média Ponderada (Mais Antiga → Mais Recente)</p>
      </div>

      <div class="kpi-container">
        <div class="kpi-card">
          <div class="val">${metrics.totalCities || 33}</div>
          <div class="lbl">Total de Regiões</div>
        </div>
        <div class="kpi-card">
          <div class="val" style="color: #059669;">${metrics.completedCities || 0}</div>
          <div class="lbl">Concluídas (${metrics.overallProgressPct || 0}%)</div>
        </div>
        <div class="kpi-card">
          <div class="val" style="color: #d97706;">${metrics.inProgressCities || 0}</div>
          <div class="lbl">Em Andamento</div>
        </div>
        <div class="kpi-card">
          <div class="val" style="color: #dc2626;">${metrics.pendingCities || 0}</div>
          <div class="lbl">Pendentes na Fila</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 35px; text-align: center;">Seq.</th>
            <th style="text-align: left;">Região Administrativa</th>
            <th style="width: 90px; text-align: center;">Data Média (${baseYear})</th>
            <th style="width: 140px; text-align: center;">Período (${baseYear})</th>
            <th style="width: 50px; text-align: center;">Total Hidr.</th>
            <th style="width: 80px; text-align: center;">Progresso (${targetYear})</th>
            <th style="width: 110px; text-align: center;">Situação (${targetYear})</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="footer">
        <div>Emissão: ${dateFormatted} às ${timeFormatted} por ${currentUser?.nomeGuerra || currentUser?.nome || 'Gestor do Sistema'}</div>
        <div>Sistema Netuno - Gestão Tática e Operacional de Hidrantes Urbanos</div>
      </div>
    </body>
    </html>
  `;
};
