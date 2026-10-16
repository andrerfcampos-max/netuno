import { parseDate, formatDateOnly } from './dateUtils.js';
import { RA_LIST, normalizeRAName } from './raList.js';

/**
 * Utilitário de Planejamento e Fila Prioritária de Vistorias de Cidades (Netuno CBMDF)
 * 
 * Regra Tática Fundamental do CBMDF:
 * A ordem de vistoria é estritamente baseada no tempo decorrido desde a última visita:
 * cidades que foram visitadas há mais tempo (maior número de dias sem vistoria) têm
 * prioridade máxima e ficam no topo da fila.
 */

const formatTimeAgo = (days) => {
  if (days === null || days === undefined || !isFinite(days)) {
    return 'Sem registro';
  }
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem (há 1 dia)';
  if (days < 30) return `Há ${days} dias`;
  
  const months = Math.floor(days / 30);
  const remainingDays = days % 30;
  
  if (days < 365) {
    return remainingDays > 5 
      ? `Há ${months}m e ${remainingDays}d (${days} dias)` 
      : `Há ${months} meses (${days} dias)`;
  }

  const years = Math.floor(days / 365);
  const remMonths = Math.floor((days % 365) / 30);
  return remMonths > 0 
    ? `Há ${years}a e ${remMonths}m (${days} dias)` 
    : `Há ${years} ano(s) (${days} dias)`;
};

export const calculateCityPlanningData = ({ 
  hidrantes = [],
  baseYear = null,
  targetYear = null,
  activeYear = null
} = {}) => {
  const now = new Date();
  const nowTimestamp = now.getTime();

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
      allVisits: [],
      lastVisitTimestamp: -Infinity,
      lastVisitDate: null,
      oldestVisitTimestamp: Infinity,
      oldestVisitDate: null
    };
  });

  // Processa todos os hidrantes da base de dados
  hidrantes.forEach(h => {
    const rawRA = h.dscLocalidade;
    const raName = normalizeRAName(rawRA);
    if (!raName || !cityMap[raName]) return;

    const city = cityMap[raName];
    city.totalHydrants++;
    const hidId = h._internalId || h.codHidrante || h.nomHidrante;
    if (hidId) city.hydrantIds.push(hidId);

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

    visits.forEach(v => {
      const t = v.date.getTime();
      city.allVisits.push({
        timestamp: t,
        date: v.date,
        isOperante: v.isOperante,
        hydrantId: hidId
      });

      if (t > city.lastVisitTimestamp) {
        city.lastVisitTimestamp = t;
        city.lastVisitDate = v.date;
      }
      if (t < city.oldestVisitTimestamp) {
        city.oldestVisitTimestamp = t;
        city.oldestVisitDate = v.date;
      }
    });
  });

  const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  // Processa estatísticas operacionais de cada RA
  const allCities = Object.values(cityMap).map(city => {
    const visits = city.allVisits || [];
    visits.sort((a, b) => a.timestamp - b.timestamp);

    // Identifica última campanha contígua (gap máximo de 90 dias entre vistorias sucessivas)
    const campaigns = [];
    let currentCamp = [];

    visits.forEach(v => {
      if (currentCamp.length === 0) {
        currentCamp.push(v);
      } else {
        const lastV = currentCamp[currentCamp.length - 1];
        const gapDays = (v.timestamp - lastV.timestamp) / (1000 * 60 * 60 * 24);
        if (gapDays <= 120) {
          currentCamp.push(v);
        } else {
          campaigns.push(currentCamp);
          currentCamp = [v];
        }
      }
    });
    if (currentCamp.length > 0) campaigns.push(currentCamp);

    const latestCamp = campaigns[campaigns.length - 1] || [];
    const uniqueHydrantIdsInCampaign = new Set(latestCamp.map(v => v.hydrantId));
    const recentInspectedCount = uniqueHydrantIdsInCampaign.size;
    const recentCoveragePct = city.totalHydrants > 0 
      ? Math.round((recentInspectedCount / city.totalHydrants) * 100) 
      : 0;

    const campStartDate = latestCamp.length > 0 ? latestCamp[0].date : null;
    const campEndDate = latestCamp.length > 0 ? latestCamp[latestCamp.length - 1].date : null;
    const campDurationDays = (campStartDate && campEndDate) 
      ? Math.max(1, Math.round((campEndDate.getTime() - campStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)
      : 0;

    const campAvgTimestamp = latestCamp.length > 0
      ? Math.round(latestCamp.reduce((sum, v) => sum + v.timestamp, 0) / latestCamp.length)
      : -Infinity;
    const campAvgDate = isFinite(campAvgTimestamp) && campAvgTimestamp > 0 ? new Date(campAvgTimestamp) : null;

    // Cálculo de tempo decorrido desde a última vistoria
    const hasVisits = city.lastVisitDate !== null && isFinite(city.lastVisitTimestamp);
    const daysSinceLastVisit = hasVisits 
      ? Math.max(0, Math.round((nowTimestamp - city.lastVisitTimestamp) / (1000 * 60 * 60 * 24)))
      : Infinity;

    const timeAgoLabel = formatTimeAgo(daysSinceLastVisit);

    // Definição de Situação Operacional Clara e sem contradições:
    // 1. "completed": Campanha RECENTE (últimos 180 dias) cobriu >= 90% dos hidrantes
    // 2. "in_progress": Teve vistoria recente (últimos 180 dias), mas ainda não completou 90%
    // 3. "pending": Não recebe vistorias há mais de 180 dias (ou nunca foi vistoriada) -> Fila de Espera Ativa
    let planningStatus = 'pending';
    let statusLabel = 'Aguardando Fila';

    if (daysSinceLastVisit <= 180 && (recentCoveragePct >= 90 || (recentInspectedCount >= city.totalHydrants && city.totalHydrants > 0))) {
      planningStatus = 'completed';
      statusLabel = `Vistoriada Recente (${recentCoveragePct}%)`;
    } else if (daysSinceLastVisit <= 180 && recentInspectedCount > 0) {
      planningStatus = 'in_progress';
      statusLabel = `Em Andamento (${recentCoveragePct}%)`;
    } else {
      planningStatus = 'pending';
      statusLabel = daysSinceLastVisit === Infinity 
        ? 'Nunca Vistoriada' 
        : 'Aguardando Fila';
    }

    // Histograma mensal de vistorias da última campanha
    const monthlyDistribution = Array(12).fill(0);
    latestCamp.forEach(v => {
      monthlyDistribution[v.date.getMonth()]++;
    });

    let maxMonthCount = 0;
    let peakMonthIndex = 0;
    monthlyDistribution.forEach((cnt, idx) => {
      if (cnt > maxMonthCount) {
        maxMonthCount = cnt;
        peakMonthIndex = idx;
      }
    });

    const peakMonth = maxMonthCount > 0 ? {
      name: MONTH_NAMES[peakMonthIndex],
      index: peakMonthIndex,
      count: maxMonthCount,
      pct: recentInspectedCount > 0 ? Math.round((maxMonthCount / recentInspectedCount) * 100) : 0
    } : null;

    let summaryPeriod = '-';
    if (campStartDate && campEndDate) {
      if (campStartDate.getTime() === campEndDate.getTime()) {
        summaryPeriod = `${formatDateOnly(campStartDate)} (1d)`;
      } else {
        summaryPeriod = `${formatDateOnly(campStartDate)} a ${formatDateOnly(campEndDate)} (${campDurationDays}d)`;
      }
    }

    // Objeto retrocompatível para evitar quebras em telas legadas
    const baseStats = {
      inspectedCount: recentInspectedCount,
      coveragePct: recentCoveragePct,
      avgDate: campAvgDate,
      avgTimestamp: campAvgTimestamp,
      minDate: campStartDate,
      maxDate: campEndDate,
      durationDays: campDurationDays,
      hasVisits,
      monthlyDistribution,
      peakMonth,
      summaryPeriod
    };

    const targetStats = {
      inspectedCount: recentInspectedCount,
      coveragePct: recentCoveragePct
    };

    return {
      ...city,
      hasVisits,
      daysSinceLastVisit,
      timeAgoLabel,
      lastVisitDateStr: city.lastVisitDate ? formatDateOnly(city.lastVisitDate) : 'Sem registro',
      recentInspectedCount,
      recentCoveragePct,
      campStartDate,
      campEndDate,
      campDurationDays,
      campAvgDate,
      planningStatus,
      statusLabel,
      baseStats,
      targetStats,
      activeStats: targetStats
    };
  });

  // =========================================================================
  // ORDENAÇÃO DA FILA OPERACIONAL:
  // Critério Tático Estrito: DA CIDADE VISITADA HÁ MAIS TEMPO PARA A MAIS RECENTE
  // Quem está há mais tempo sem vistoria fica no 1º lugar da fila!
  // =========================================================================
  const planningList = [...allCities].sort((a, b) => {
    // 1. Quem nunca foi vistoriado tem prioridade absoluta
    if (!a.hasVisits && b.hasVisits) return -1;
    if (a.hasVisits && !b.hasVisits) return 1;

    // 2. Compara pelo timestamp da última vistoria (ASC = mais antiga primeiro = maior tempo sem visita)
    if (a.lastVisitTimestamp !== b.lastVisitTimestamp) {
      return a.lastVisitTimestamp - b.lastVisitTimestamp;
    }

    return a.name.localeCompare(b.name, 'pt-BR');
  });

  // Atribui classificação na fila (1º, 2º, ... 33º)
  planningList.forEach((c, idx) => {
    c.planningRank = idx + 1;
  });

  // Identificação clara da Próxima Cidade a Vistoriar:
  // 1. Cidades que já estão em andamento ativo
  const inProgressCities = planningList.filter(c => c.planningStatus === 'in_progress');
  const inProgressCity = inProgressCities.length > 0 ? inProgressCities[0] : null;

  // 2. Próxima cidade prioritária da fila para iniciar (primeira que ainda está pendente)
  const nextPendingCity = planningList.find(c => c.planningStatus === 'pending') || planningList[0] || null;

  // Métricas gerais
  const totalCities = allCities.length;
  const completedCities = planningList.filter(c => c.planningStatus === 'completed').length;
  const inProgressCount = inProgressCities.length;
  const pendingCities = planningList.filter(c => c.planningStatus === 'pending').length;

  return {
    allCities,
    planningList,
    activeYearWithVisits: planningList,
    activeYearWithoutVisits: [],
    availableYears: [2026, 2025],
    inProgressCity,
    inProgressCities,
    nextPendingCity,
    metrics: {
      totalCities,
      completedCities,
      inProgressCities: inProgressCount,
      pendingCities,
      overallProgressPct: totalCities > 0 ? Math.round((completedCities / totalCities) * 100) : 0
    }
  };
};

/**
 * Formata texto simples e direto para WhatsApp com indicação cristalina da próxima cidade
 */
export const formatCityPlanningWhatsAppText = ({
  planningList = [],
  nextPendingCity = null,
  inProgressCity = null,
  metrics = {}
} = {}) => {
  const nextCity = nextPendingCity || planningList.find(c => c.planningStatus === 'pending') || planningList[0];

  let text = `🚒 *CBMDF - FILA PRIORITÁRIA DE VISTORIAS POR CIDADE*\n`;
  text += `🎯 *Critério Operacional:* Cidade visitada há mais tempo (Maior tempo sem vistoria → Mais recente)\n\n`;

  if (nextCity) {
    text += `📍 *PRÓXIMA CIDADE DA FILA A VISTORIAR:*\n`;
    text += `👉 *${nextCity.planningRank}º. ${nextCity.name} [${nextCity.prefix}]*\n`;
    text += `   • Última vistoria: *${nextCity.lastVisitDateStr}* (${nextCity.timeAgoLabel})\n`;
    text += `   • Carga operacional: *${nextCity.totalHydrants} hidrantes*\n\n`;
  }

  if (inProgressCity && inProgressCity.name !== nextCity?.name) {
    text += `🔄 *CIDADE EM ANDAMENTO ATUALMENTE:*\n`;
    text += `   • *${inProgressCity.name} [${inProgressCity.prefix}]:* ${inProgressCity.recentInspectedCount}/${inProgressCity.totalHydrants} hidrantes vistoriados (${inProgressCity.recentCoveragePct}%)\n`;
    text += `   • Recomendação: Concluir antes de abrir nova frente.\n\n`;
  }

  text += `📊 *Resumo Geral:* ${metrics.completedCities || 0} Concluídas | ${metrics.inProgressCities || 0} Em Andamento | ${metrics.pendingCities || 0} Pendentes\n\n`;
  text += `📋 *ORDEM COMPLETA DA FILA PRIORITÁRIA (1º ao 33º):*\n`;

  planningList.forEach(c => {
    const icon = c.planningStatus === 'completed'
      ? '✅'
      : c.planningStatus === 'in_progress'
      ? '🔄'
      : c.planningRank === 1
      ? '🎯'
      : '⏳';

    text += `${c.planningRank}º. ${icon} *${c.name}* [${c.prefix}]\n`;
    text += `   • Última: ${c.lastVisitDateStr} (${c.timeAgoLabel}) | Total: ${c.totalHydrants} hidr. | ${c.statusLabel}\n`;
  });

  text += `\n_Gerado pelo Sistema Netuno - CBMDF em ${new Date().toLocaleDateString('pt-BR')}_`;
  return text;
};

/**
 * Gera documento HTML para impressão e exportação em PDF da Fila Prioritária de Cidades.
 * Nome padrão do arquivo: Fila_Prioritaria_Vistorias_Cidades_CBMDF.pdf
 */
export const generateCityPlanningPrintHtml = ({
  planningList = [],
  nextPendingCity = null,
  inProgressCity = null,
  metrics = {},
  currentUser = null
} = {}) => {
  const now = new Date();
  const dateFormatted = formatDateOnly(now);
  const timeFormatted = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const nextCity = nextPendingCity || planningList.find(c => c.planningStatus === 'pending') || planningList[0];

  const rowsHtml = planningList.map(c => {
    const isNext = nextCity && c.name === nextCity.name;
    const isCompleted = c.planningStatus === 'completed';
    const isInProgress = c.planningStatus === 'in_progress';

    let badgeHtml = '';
    if (isNext) {
      badgeHtml = '<span style="color: #0369a1; font-weight: bold; background: #e0f2fe; padding: 2px 6px; border-radius: 4px; border: 1px solid #7dd3fc;">🎯 Próxima da Fila</span>';
    } else if (isCompleted) {
      badgeHtml = `<span style="color: #059669; font-weight: bold; background: #d1fae5; padding: 2px 6px; border-radius: 4px;">Concluída (${c.recentCoveragePct}%)</span>`;
    } else if (isInProgress) {
      badgeHtml = `<span style="color: #d97706; font-weight: bold; background: #fef3c7; padding: 2px 6px; border-radius: 4px;">Em Andamento (${c.recentCoveragePct}%)</span>`;
    } else {
      badgeHtml = '<span style="color: #dc2626; font-weight: 600; background: #fee2e2; padding: 2px 6px; border-radius: 4px;">Aguardando Fila</span>';
    }

    const rowBg = isNext ? 'background-color: #f0fdf4;' : '';

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px; ${rowBg}">
        <td style="padding: 6px 8px; text-align: center; font-weight: bold; color: ${isNext ? '#047857' : '#1e293b'}; font-size: 12px;">
          ${c.planningRank}º
        </td>
        <td style="padding: 6px 8px; font-weight: 700; color: #0f172a;">
          ${c.name} <span style="font-size: 9px; color: #64748b; font-weight: normal;">(${c.prefix})</span>
        </td>
        <td style="padding: 6px 8px; text-align: center; font-weight: 600; color: #0369a1;">
          ${c.lastVisitDateStr}
        </td>
        <td style="padding: 6px 8px; text-align: center; font-weight: 600; color: ${c.daysSinceLastVisit > 300 ? '#b91c1c' : '#475569'};">
          ${c.timeAgoLabel}
        </td>
        <td style="padding: 6px 8px; text-align: center; font-weight: bold;">
          ${c.totalHydrants}
        </td>
        <td style="padding: 6px 8px; text-align: center; font-weight: 600;">
          ${c.recentInspectedCount} / ${c.totalHydrants}
        </td>
        <td style="padding: 6px 8px; text-align: center;">
          ${badgeHtml}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Fila_Prioritaria_Vistorias_Cidades_CBMDF</title>
      <style>
        @page { size: A4 portrait; margin: 10mm 10mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; }
        .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 6px; margin-bottom: 10px; }
        .header h1 { font-size: 14px; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
        .header h2 { font-size: 13px; margin: 2px 0; color: #1e293b; }
        .header p { font-size: 9.5px; margin: 0; color: #64748b; }
        
        /* Banner de Próxima Cidade */
        .priority-banner {
          background: #f0fdf4;
          border: 2px solid #059669;
          border-radius: 8px;
          padding: 8px 12px;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .priority-banner .target-info {
          font-size: 11px;
          color: #065f46;
        }
        .priority-banner .target-name {
          font-size: 15px;
          font-weight: 800;
          color: #047857;
          text-transform: uppercase;
        }
        .priority-banner .details {
          font-size: 10.5px;
          color: #1e293b;
          text-align: right;
        }

        .kpi-container { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
        .kpi-card { flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px; text-align: center; background: #f8fafc; }
        .kpi-card .val { font-size: 13px; font-weight: bold; color: #0f172a; }
        .kpi-card .lbl { font-size: 8.5px; color: #64748b; text-transform: uppercase; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-top: 4px; }
        th { background: #f1f5f9; color: #334155; font-size: 9.5px; text-transform: uppercase; padding: 6px 6px; border-bottom: 2px solid #cbd5e1; }
        .footer { margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 6px; font-size: 8.5px; color: #64748b; display: flex; justify-content: space-between; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Corpo de Bombeiros Militar do Distrito Federal</h1>
        <h2>Fila Prioritária de Vistoria de Cidades (Sequência Operacional)</h2>
        <p>Critério Tático: <strong>Cidade visitada há mais tempo</strong> (Maior tempo decorrido sem vistoria → Mais recente)</p>
      </div>

      ${nextCity ? `
        <div class="priority-banner">
          <div>
            <div class="target-info">🎯 PRÓXIMA CIDADE DA FILA A VISTORIAR:</div>
            <div class="target-name">${nextCity.planningRank}º. ${nextCity.name} (${nextCity.prefix})</div>
          </div>
          <div class="details">
            <div>Última Vistoria: <strong>${nextCity.lastVisitDateStr}</strong> (${nextCity.timeAgoLabel})</div>
            <div>Carga Operacional: <strong>${nextCity.totalHydrants} hidrantes</strong> a vistoriar</div>
          </div>
        </div>
      ` : ''}

      ${inProgressCity && inProgressCity.name !== nextCity?.name ? `
        <div style="background: #fffbeb; border: 1px solid #f59e0b; border-radius: 6px; padding: 5px 10px; margin-bottom: 10px; font-size: 10px; color: #92400e; display: flex; justify-content: space-between;">
          <span>🔄 <strong>EM ANDAMENTO ATUALMENTE:</strong> ${inProgressCity.name} (${inProgressCity.prefix})</span>
          <span><strong>${inProgressCity.recentInspectedCount} de ${inProgressCity.totalHydrants} hidrantes vistoriados (${inProgressCity.recentCoveragePct}%)</strong> - Recomendação: Concluir antes de abrir nova cidade</span>
        </div>
      ` : ''}

      <div class="kpi-container">
        <div class="kpi-card">
          <div class="val">${metrics.totalCities || 33}</div>
          <div class="lbl">Total de Regiões</div>
        </div>
        <div class="kpi-card">
          <div class="val" style="color: #dc2626;">${metrics.pendingCities || 0}</div>
          <div class="lbl">Aguardando na Fila</div>
        </div>
        <div class="kpi-card">
          <div class="val" style="color: #d97706;">${metrics.inProgressCities || 0}</div>
          <div class="lbl">Em Andamento</div>
        </div>
        <div class="kpi-card">
          <div class="val" style="color: #059669;">${metrics.completedCities || 0}</div>
          <div class="lbl">Vistoriadas Recentemente (${metrics.overallProgressPct || 0}%)</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 35px; text-align: center;">Seq.</th>
            <th style="text-align: left;">Região Administrativa</th>
            <th style="width: 85px; text-align: center;">Última Vistoria</th>
            <th style="width: 140px; text-align: center;">Tempo sem Vistoria</th>
            <th style="width: 50px; text-align: center;">Total Hidr.</th>
            <th style="width: 75px; text-align: center;">Progresso</th>
            <th style="width: 120px; text-align: center;">Situação Operacional</th>
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
