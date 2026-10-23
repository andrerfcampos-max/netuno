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
    // 1. "completed": Campanha RECENTE (últimos 180 dias) cobriu 100% dos hidrantes
    // 2. "in_progress": Teve vistoria recente (últimos 180 dias), mas ainda não completou 100%
    // 3. "pending": Não recebe vistorias há mais de 180 dias (ou nunca foi vistoriada) -> Fila de Espera Ativa
    let planningStatus = 'pending';
    let statusLabel = 'Aguardando Fila';

    if (daysSinceLastVisit <= 180 && city.totalHydrants > 0 && recentInspectedCount >= city.totalHydrants) {
      planningStatus = 'completed';
      statusLabel = `Vistoriada Recente (100%)`;
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
  // ORDENAÇÃO E SEPARAÇÃO TÁTICA DOS 3 ESTÁGIOS OPERACIONAIS:
  // 1º Bloco: CIDADES EM ANDAMENTO (frentes de trabalho já abertas que DEVEM ser finalizadas)
  // 2º Bloco: AGUARDANDO NA FILA (cidades pendentes ordenadas da mais antiga sem visita para a mais recente)
  // 3º Bloco: CONCLUÍDAS (cidades que completaram a campanha recente)
  // =========================================================================

  const sortByOldestVisit = (a, b) => {
    // Quem nunca foi vistoriado tem prioridade máxima
    if (!a.hasVisits && b.hasVisits) return -1;
    if (a.hasVisits && !b.hasVisits) return 1;
    if (a.lastVisitTimestamp !== b.lastVisitTimestamp) {
      return a.lastVisitTimestamp - b.lastVisitTimestamp;
    }
    return a.name.localeCompare(b.name, 'pt-BR');
  };

  const inProgressGroup = allCities
    .filter(c => c.planningStatus === 'in_progress')
    .sort(sortByOldestVisit);

  const pendingGroup = allCities
    .filter(c => c.planningStatus === 'pending')
    .sort(sortByOldestVisit);

  const completedGroup = allCities
    .filter(c => c.planningStatus === 'completed')
    .sort(sortByOldestVisit);

  // Lista mestre unificada respeitando a regra operacional:
  // 1º Em Andamento -> 2º Aguardando Fila -> 3º Concluídas
  const planningList = [
    ...inProgressGroup,
    ...pendingGroup,
    ...completedGroup
  ];

  // Atribui classificação sequencial na fila (1º, 2º, ... 33º)
  planningList.forEach((c, idx) => {
    c.planningRank = idx + 1;
  });

  // Identificação clara da Próxima Cidade a Vistoriar:
  // 1. Cidades que já estão em andamento ativo
  const inProgressCities = inProgressGroup;
  const inProgressCity = inProgressCities.length > 0 ? inProgressCities[0] : null;

  // 2. Próxima cidade prioritária da fila para iniciar (primeira que ainda está pendente)
  const nextPendingCity = pendingGroup.length > 0 ? pendingGroup[0] : (planningList[0] || null);

  // Métricas gerais
  const totalCities = allCities.length;
  const completedCities = completedGroup.length;
  const inProgressCount = inProgressCities.length;
  const pendingCities = pendingGroup.length;

  return {
    allCities,
    planningList,
    inProgressGroup,
    pendingGroup,
    completedGroup,
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
  inProgressGroup = [],
  pendingGroup = [],
  completedGroup = [],
  nextPendingCity = null,
  inProgressCity = null,
  metrics = {}
} = {}) => {
  // Caso os grupos não venham prontos, divide a partir da lista
  const inProg = inProgressGroup.length > 0 ? inProgressGroup : planningList.filter(c => c.planningStatus === 'in_progress');
  const pending = pendingGroup.length > 0 ? pendingGroup : planningList.filter(c => c.planningStatus === 'pending');
  const completed = completedGroup.length > 0 ? completedGroup : planningList.filter(c => c.planningStatus === 'completed');

  const nextCity = nextPendingCity || pending[0] || planningList[0];

  let text = `🚒 *CBMDF - FILA PRIORITÁRIA DE VISTORIAS POR CIDADE*\n`;
  text += `🎯 *Diretriz Operacional:* 1º Finalizar cidades em andamento → 2º Abrir cidades da fila por tempo de espera → 3º Cidades já concluídas recentemente\n\n`;

  if (inProgressCity) {
    text += `🔄 *CIDADE PRIORITÁRIA EM ANDAMENTO:*\n`;
    text += `👉 *${inProgressCity.name} [${inProgressCity.prefix}]*\n`;
    text += `   • Progresso atual: *${inProgressCity.recentInspectedCount}/${inProgressCity.totalHydrants} hidrantes vistoriados (${inProgressCity.recentCoveragePct}%)*\n`;
    text += `   • Última vistoria realizada: *${inProgressCity.lastVisitDateStr}* (${inProgressCity.timeAgoLabel})\n`;
    text += `   • *Recomendação Operacional:* Concluir esta cidade antes de abrir nova frente.\n\n`;
  }

  if (nextCity) {
    text += `📍 *PRÓXIMA CIDADE DA FILA A INICIAR (QUANDO LIBERAR):*\n`;
    text += `🎯 *${nextCity.name} [${nextCity.prefix}]*\n`;
    text += `   • Última vistoria: *${nextCity.lastVisitDateStr}* (${nextCity.timeAgoLabel})\n`;
    text += `   • Carga operacional: *${nextCity.totalHydrants} hidrantes*\n\n`;
  }

  text += `📊 *Resumo Geral das 33 Regiões:* ${metrics.inProgressCities || inProg.length} Em Andamento | ${metrics.pendingCities || pending.length} Aguardando Fila | ${metrics.completedCities || completed.length} Concluídas\n\n`;

  // 1º BLOCO: EM ANDAMENTO
  text += `========================================\n`;
  text += `🔄 *1º ESTÁGIO: CIDADES EM ANDAMENTO (${inProg.length})*\n`;
  text += `_(Frentes abertas - Devem ser concluídas prioritariamente)_\n`;
  text += `========================================\n`;
  if (inProg.length === 0) {
    text += `(Nenhuma cidade em andamento no momento)\n`;
  } else {
    inProg.forEach((c, idx) => {
      text += `${idx + 1}º. 🔄 *${c.name}* [${c.prefix}]\n`;
      text += `    • Progresso: ${c.recentInspectedCount}/${c.totalHydrants} hidr. (${c.recentCoveragePct}%) | Última: ${c.lastVisitDateStr} (${c.timeAgoLabel})\n`;
    });
  }
  text += `\n`;

  // 2º BLOCO: AGUARDANDO NA FILA
  text += `========================================\n`;
  text += `⏳ *2º ESTÁGIO: AGUARDANDO NA FILA (${pending.length})*\n`;
  text += `_(Ordem prioritária: Da que está há mais tempo sem vistoria para a mais recente)_\n`;
  text += `========================================\n`;
  if (pending.length === 0) {
    text += `(Nenhuma cidade aguardando na fila)\n`;
  } else {
    pending.forEach((c, idx) => {
      const isTop = idx === 0;
      text += `${idx + 1}º. ${isTop ? '🎯' : '⏳'} *${c.name}* [${c.prefix}] ${isTop ? '*(PRÓXIMA DA FILA)*' : ''}\n`;
      text += `    • Última: ${c.lastVisitDateStr} (${c.timeAgoLabel}) | Carga: ${c.totalHydrants} hidrantes\n`;
    });
  }
  text += `\n`;

  // 3º BLOCO: CONCLUÍDAS
  text += `========================================\n`;
  text += `✅ *3º ESTÁGIO: CIDADES CONCLUÍDAS RECENTEMENTE (${completed.length})*\n`;
  text += `_(Meta operacional atingida: 100% dos hidrantes vistoriados)_\n`;
  text += `========================================\n`;
  if (completed.length === 0) {
    text += `(Nenhuma cidade concluída recentemente)\n`;
  } else {
    completed.forEach((c, idx) => {
      text += `${idx + 1}º. ✅ *${c.name}* [${c.prefix}]\n`;
      text += `    • Cobertura: ${c.recentInspectedCount}/${c.totalHydrants} hidr. (${c.recentCoveragePct}%) | Última: ${c.lastVisitDateStr} (${c.timeAgoLabel})\n`;
    });
  }

  text += `\n_Gerado pelo Sistema Netuno - CBMDF em ${new Date().toLocaleDateString('pt-BR')}_`;
  return text;
};

/**
 * Gera documento HTML para impressão e exportação em PDF da Fila Prioritária de Cidades.
 * Nome padrão do arquivo: Fila_Prioritaria_Vistorias_Cidades_CBMDF.pdf
 */
export const generateCityPlanningPrintHtml = ({
  planningList = [],
  inProgressGroup = [],
  pendingGroup = [],
  completedGroup = [],
  nextPendingCity = null,
  inProgressCity = null,
  metrics = {},
  currentUser = null
} = {}) => {
  const now = new Date();
  const dateFormatted = formatDateOnly(now);
  const timeFormatted = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const inProg = inProgressGroup.length > 0 ? inProgressGroup : planningList.filter(c => c.planningStatus === 'in_progress');
  const pending = pendingGroup.length > 0 ? pendingGroup : planningList.filter(c => c.planningStatus === 'pending');
  const completed = completedGroup.length > 0 ? completedGroup : planningList.filter(c => c.planningStatus === 'completed');

  const nextCity = nextPendingCity || pending[0] || planningList[0];

  const renderTableRows = (cities, stageType) => {
    if (!cities || cities.length === 0) {
      return `
        <tr>
          <td colspan="7" style="padding: 10px; text-align: center; color: #64748b; font-style: italic; font-size: 10px;">
            Nenhuma cidade neste estágio operacional.
          </td>
        </tr>
      `;
    }

    return cities.map(c => {
      const isNext = stageType === 'pending' && nextCity && c.name === nextCity.name;
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

      const rowBg = isNext 
        ? 'background-color: #f0fdf4;' 
        : isInProgress 
        ? 'background-color: #fffbeb;' 
        : '';

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 10.5px; ${rowBg}">
          <td style="padding: 5px 6px; text-align: center; font-weight: bold; color: ${isNext ? '#047857' : '#1e293b'}; font-size: 11px;">
            ${c.planningRank}º
          </td>
          <td style="padding: 5px 6px; font-weight: 700; color: #0f172a;">
            ${c.name} <span style="font-size: 8.5px; color: #64748b; font-weight: normal;">(${c.prefix})</span>
          </td>
          <td style="padding: 5px 6px; text-align: center; font-weight: 600; color: #0369a1;">
            ${c.lastVisitDateStr}
          </td>
          <td style="padding: 5px 6px; text-align: center; font-weight: 600; color: ${c.daysSinceLastVisit > 300 ? '#b91c1c' : '#475569'};">
            ${c.timeAgoLabel}
          </td>
          <td style="padding: 5px 6px; text-align: center; font-weight: bold;">
            ${c.totalHydrants}
          </td>
          <td style="padding: 5px 6px; text-align: center; font-weight: 600;">
            ${c.recentInspectedCount} / ${c.totalHydrants}
          </td>
          <td style="padding: 5px 6px; text-align: center;">
            ${badgeHtml}
          </td>
        </tr>
      `;
    }).join('');
  };

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Fila_Prioritaria_Vistorias_Cidades_CBMDF</title>
      <style>
        @page { size: A4 portrait; margin: 8mm 8mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; }
        .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 5px; margin-bottom: 8px; }
        .header h1 { font-size: 13px; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
        .header h2 { font-size: 12px; margin: 2px 0; color: #1e293b; }
        .header p { font-size: 9px; margin: 0; color: #64748b; }
        
        /* Banner de Próxima Cidade */
        .priority-banner {
          background: #f0fdf4;
          border: 2px solid #059669;
          border-radius: 6px;
          padding: 6px 10px;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .priority-banner .target-info {
          font-size: 10px;
          color: #065f46;
        }
        .priority-banner .target-name {
          font-size: 13.5px;
          font-weight: 800;
          color: #047857;
          text-transform: uppercase;
        }
        .priority-banner .details {
          font-size: 10px;
          color: #1e293b;
          text-align: right;
        }

        .kpi-container { display: flex; justify-content: space-between; gap: 6px; margin-bottom: 8px; }
        .kpi-card { flex: 1; border: 1px solid #cbd5e1; border-radius: 5px; padding: 4px; text-align: center; background: #f8fafc; }
        .kpi-card .val { font-size: 12px; font-weight: bold; color: #0f172a; }
        .kpi-card .lbl { font-size: 8px; color: #64748b; text-transform: uppercase; font-weight: 600; }
        
        /* Seções de Estágios */
        .stage-section { margin-top: 8px; margin-bottom: 8px; page-break-inside: avoid; }
        .stage-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .stage-header-in-progress {
          background: #fef3c7;
          color: #92400e;
          border-left: 4px solid #f59e0b;
        }
        .stage-header-pending {
          background: #fee2e2;
          color: #991b1b;
          border-left: 4px solid #ef4444;
        }
        .stage-header-completed {
          background: #d1fae5;
          color: #065f46;
          border-left: 4px solid #10b981;
        }

        table { width: 100%; border-collapse: collapse; margin-top: 3px; }
        th { background: #f1f5f9; color: #334155; font-size: 9px; text-transform: uppercase; padding: 4px 6px; border-bottom: 1.5px solid #cbd5e1; }
        .footer { margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 5px; font-size: 8px; color: #64748b; display: flex; justify-content: space-between; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Corpo de Bombeiros Militar do Distrito Federal</h1>
        <h2>Fila Prioritária de Vistoria de Cidades (Sequência Operacional)</h2>
        <p>Diretriz Tática: <strong>1º Finalizar cidades em andamento → 2º Atender fila por tempo sem visita → 3º Cidades já concluídas</strong></p>
      </div>

      ${nextCity ? `
        <div class="priority-banner">
          <div>
            <div class="target-info">📍 PRÓXIMA CIDADE DA FILA A INICIAR (QUANDO LIBERAR):</div>
            <div class="target-name">${nextCity.name} (${nextCity.prefix})</div>
          </div>
          <div class="details">
            <div>Última Vistoria: <strong>${nextCity.lastVisitDateStr}</strong> (${nextCity.timeAgoLabel})</div>
            <div>Carga Operacional: <strong>${nextCity.totalHydrants} hidrantes</strong> a vistoriar</div>
          </div>
        </div>
      ` : ''}

      ${inProgressCity ? `
        <div style="background: #fffbeb; border: 1.5px solid #f59e0b; border-radius: 5px; padding: 4px 8px; margin-bottom: 8px; font-size: 9.5px; color: #92400e; display: flex; justify-content: space-between; align-items: center;">
          <span>🔄 <strong>EM ANDAMENTO ATUALMENTE:</strong> ${inProgressCity.name} (${inProgressCity.prefix}) — <strong>${inProgressCity.recentInspectedCount}/${inProgressCity.totalHydrants} hidrantes (${inProgressCity.recentCoveragePct}%)</strong></span>
          <span style="font-weight: 700; color: #b45309;">Prioridade: Concluir antes de abrir nova frente</span>
        </div>
      ` : ''}

      <div class="kpi-container">
        <div class="kpi-card">
          <div class="val">${metrics.totalCities || 33}</div>
          <div class="lbl">Total de Regiões</div>
        </div>
        <div class="kpi-card">
          <div class="val" style="color: #d97706;">${inProg.length}</div>
          <div class="lbl">1º Em Andamento</div>
        </div>
        <div class="kpi-card">
          <div class="val" style="color: #dc2626;">${pending.length}</div>
          <div class="lbl">2º Aguardando Fila</div>
        </div>
        <div class="kpi-card">
          <div class="val" style="color: #059669;">${completed.length}</div>
          <div class="lbl">3º Concluídas Recente (${metrics.overallProgressPct || 0}%)</div>
        </div>
      </div>

      <!-- 1º ESTÁGIO: EM ANDAMENTO -->
      <div class="stage-section">
        <div class="stage-header stage-header-in-progress">
          <span>🔄 1º Estágio: Cidades em Andamento (${inProg.length}) — Conclusão Prioritária</span>
          <span>Frentes Ativas</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">Seq.</th>
              <th style="text-align: left;">Região Administrativa</th>
              <th style="width: 80px; text-align: center;">Última Vistoria</th>
              <th style="width: 130px; text-align: center;">Tempo sem Vistoria</th>
              <th style="width: 50px; text-align: center;">Total Hidr.</th>
              <th style="width: 75px; text-align: center;">Progresso</th>
              <th style="width: 120px; text-align: center;">Situação Operacional</th>
            </tr>
          </thead>
          <tbody>
            ${renderTableRows(inProg, 'in_progress')}
          </tbody>
        </table>
      </div>

      <!-- 2º ESTÁGIO: AGUARDANDO NA FILA -->
      <div class="stage-section">
        <div class="stage-header stage-header-pending">
          <span>⏳ 2º Estágio: Aguardando na Fila (${pending.length}) — Ordem: Maior tempo sem vistoria</span>
          <span>Aguardando Liberação</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">Seq.</th>
              <th style="text-align: left;">Região Administrativa</th>
              <th style="width: 80px; text-align: center;">Última Vistoria</th>
              <th style="width: 130px; text-align: center;">Tempo sem Vistoria</th>
              <th style="width: 50px; text-align: center;">Total Hidr.</th>
              <th style="width: 75px; text-align: center;">Progresso</th>
              <th style="width: 120px; text-align: center;">Situação Operacional</th>
            </tr>
          </thead>
          <tbody>
            ${renderTableRows(pending, 'pending')}
          </tbody>
        </table>
      </div>

      <!-- 3º ESTÁGIO: CONCLUÍDAS -->
      <div class="stage-section">
        <div class="stage-header stage-header-completed">
          <span>✅ 3º Estágio: Vistoriadas Recentemente (${completed.length}) — Meta 100% Atingida</span>
          <span>Campanha Concluída</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">Seq.</th>
              <th style="text-align: left;">Região Administrativa</th>
              <th style="width: 80px; text-align: center;">Última Vistoria</th>
              <th style="width: 130px; text-align: center;">Tempo sem Vistoria</th>
              <th style="width: 50px; text-align: center;">Total Hidr.</th>
              <th style="width: 75px; text-align: center;">Progresso</th>
              <th style="width: 120px; text-align: center;">Situação Operacional</th>
            </tr>
          </thead>
          <tbody>
            ${renderTableRows(completed, 'completed')}
          </tbody>
        </table>
      </div>

      <div class="footer">
        <div>Emissão: ${dateFormatted} às ${timeFormatted} por ${currentUser?.nomeGuerra || currentUser?.nome || 'Gestor do Sistema'}</div>
        <div>Sistema Netuno - Gestão Tática e Operacional de Hidrantes Urbanos</div>
      </div>
    </body>
    </html>
  `;
};
