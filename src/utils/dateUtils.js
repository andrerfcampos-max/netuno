/**
 * Utilitário Central de Datas - Sistema Netuno
 * Unifica a interpretação, validação, ordenação e exibição de datas
 * no padrão canônico brasileiro (DD/MM/AAAA) e evita armadilhas de inversão
 * dia/mês (DD/MM vs MM/DD) em integrações com navegadores, Excel e PostgreSQL/Supabase.
 */

/**
 * Converte qualquer representação de data para um objeto Date válido.
 * Trata:
 * - Formato brasileiro: "DD/MM/AAAA", "DD/MM/AAAA, HH:mm:ss", "DD/MM/AAAA HH:mm:ss"
 * - Formato ISO: "AAAA-MM-DD", "AAAA-MM-DDTHH:mm:ss.sssZ", "AAAA-MM-DD HH:mm:ss"
 * - Objetos Date e timestamps numéricos
 * - Limpa vírgulas e pontuações espúrias finais
 */
export const parseDate = (input) => {
  if (input === null || input === undefined) return null;
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s || s === '-' || s.toLowerCase() === 'sem vistoria' || s.toLowerCase() === 'não informado' || s.toLowerCase() === 'dados argos') {
      return null;
    }
  }

  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }

  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }

  let str = String(input).trim();
  // Limpar vírgulas, pontos e ponto-e-vírgula no final (ex: "22/09/2026,")
  str = str.replace(/[,;]+$/, '').trim();

  // 1. Formato Brasileiro canônico: DD/MM/AAAA ou DD-MM-AAAA com ou sem hora
  // Ex: "06/10/2026", "06/10/2026, 09:58:48", "6/10/2026 09:58", "22/09/2026"
  const brMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[,;\sT]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (brMatch) {
    let p1 = parseInt(brMatch[1], 10);
    let p2 = parseInt(brMatch[2], 10);
    const year = parseInt(brMatch[3], 10);
    const hour = parseInt(brMatch[4] || '0', 10);
    const min = parseInt(brMatch[5] || '0', 10);
    const sec = parseInt(brMatch[6] || '0', 10);

    let day = p1;
    let month = p2;

    // Se p2 > 12 e p1 <= 12, claramente o formato estava em MM/DD/AAAA invertido (ex: 10/22/2026)
    if (p2 > 12 && p1 <= 12) {
      day = p2;
      month = p1;
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(year, month - 1, day, hour, min, sec);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // 2. Formato ISO-8601: AAAA-MM-DD ou AAAA-MM-DDTHH:mm:ss
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    const hour = parseInt(isoMatch[4] || '0', 10);
    const min = parseInt(isoMatch[5] || '0', 10);
    const sec = parseInt(isoMatch[6] || '0', 10);

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(year, month - 1, day, hour, min, sec);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // 3. Fallback genérico para strings nativas
  try {
    const fallback = new Date(str);
    if (!isNaN(fallback.getTime())) return fallback;
  } catch {}

  return null;
};

/**
 * Retorna apenas a data formatada no padrão brasileiro oficial: DD/MM/AAAA.
 * Sem vírgula trailing, sem hora, com zero à esquerda.
 * Se inválida, retorna o fallback indicado (padrão '-').
 */
export const formatDateOnly = (input, fallback = '-') => {
  const d = parseDate(input);
  if (!d) return fallback;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Retorna data e hora formatada no padrão brasileiro:
 * DD/MM/AAAA HH:mm:ss (ou DD/MM/AAAA às HH:mm se curto)
 */
export const formatDateTimeDisplay = (input, { shortTime = false, fallback = 'Não informado' } = {}) => {
  const d = parseDate(input);
  if (!d) return fallback;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');

  if (shortTime) {
    return `${day}/${month}/${year} às ${hour}:${min}`;
  }
  return `${day}/${month}/${year} ${hour}:${min}:${sec}`;
};

/**
 * Converte qualquer representação de data para string ISO-8601 estrita (AAAA-MM-DDTHH:mm:ss.sssZ).
 * ESSENCIAL para envio ao PostgreSQL / Supabase, eliminando o erro onde o Postgres
 * interpreta DD/MM/AAAA como MM/DD/AAAA.
 */
export const dateToIsoString = (input) => {
  const d = parseDate(input);
  if (!d) return new Date().toISOString();
  return d.toISOString();
};

/**
 * Converte data para timestamp numérico para ordenação cronológica precisa.
 * Se a data for inválida ou inexistente, retorna -Infinity para ficar no fim da fila.
 */
export const parseDateToTimestamp = (input) => {
  const d = parseDate(input);
  if (!d) return -Infinity;
  return d.getTime();
};

/**
 * Resolve e formata a data da vistoria vigente de um hidrante.
 * Fonte única de verdade para diálogos do mapa, cards e tabelas.
 * Garante padrão DD/MM/AAAA sem vírgulas extras.
 */
export const getHydrantVistoriaDate = (h) => {
  if (!h) return 'Sem vistoria';

  // 1. Campos diretos de data de vistoria
  const candidate = 
    h.datHoraUltimaVistoria || 
    h.datUltimaVistoria || 
    h.dataUltimaVistoria || 
    h.datHoraVistoria || 
    h.dataVistoria || 
    h.datVistoria || 
    h.timestamp;

  if (candidate) {
    const s = String(candidate).trim();
    if (s && s.toLowerCase() !== 'sem vistoria' && s !== '-') {
      const formatted = formatDateOnly(candidate, '');
      if (formatted) return formatted;
    }
  }

  // 2. Histórico de vistorias se disponível (mais recente no índice 0 ou no fim)
  if (Array.isArray(h.HISTORICO_VISTORIAS) && h.HISTORICO_VISTORIAS.length > 0) {
    // Procura por data válida no histórico
    for (const entry of h.HISTORICO_VISTORIAS) {
      const histDate = entry?.datHoraVistoria || entry?.datHoraUltimaVistoria || entry?.dataVistoria || entry?.timestamp;
      if (histDate) {
        const formatted = formatDateOnly(histDate, '');
        if (formatted) return formatted;
      }
    }
  }

  // 3. Dados consolidados do legado Argos
  if (h.problemasHidrante && h.problemasHidrante.trim() !== '') {
    if (h.datAtualizacao) {
      const formatted = formatDateOnly(h.datAtualizacao, '');
      if (formatted) return formatted;
    }
    return 'Dados Argos';
  }

  if (h.nomVistoriador || h.numMatriculaVistoriador) {
    if (h.datAtualizacao) {
      const formatted = formatDateOnly(h.datAtualizacao, '');
      if (formatted) return formatted;
    }
    return 'Vistoriado (Argos)';
  }

  // 4. Data de atualização/cadastro recente
  if (h.datAtualizacao) {
    const formatted = formatDateOnly(h.datAtualizacao, '');
    if (formatted) return formatted;
  }

  return 'Sem vistoria';
};

/**
 * Ordena lista de hidrantes por data da última vistoria de forma estritamente cronológica.
 * direction: 'descending' (mais recente para mais antigo) ou 'ascending' (mais antigo para mais recente)
 */
export const sortHydrantsByVistoriaDate = (hydrants, direction = 'descending') => {
  if (!Array.isArray(hydrants)) return [];
  const items = [...hydrants];

  return items.sort((a, b) => {
    const valA = a?.datHoraUltimaVistoria || a?.datHoraVistoria || (Array.isArray(a?.HISTORICO_VISTORIAS) && a?.HISTORICO_VISTORIAS[0]?.datHoraVistoria);
    const valB = b?.datHoraUltimaVistoria || b?.datHoraVistoria || (Array.isArray(b?.HISTORICO_VISTORIAS) && b?.HISTORICO_VISTORIAS[0]?.datHoraVistoria);

    const timeA = parseDateToTimestamp(valA);
    const timeB = parseDateToTimestamp(valB);

    if (timeA === timeB) return 0;

    if (direction === 'ascending') {
      if (timeA === -Infinity) return 1;
      if (timeB === -Infinity) return -1;
      return timeA - timeB;
    } else {
      // Mais recente primeiro:
      if (timeA === -Infinity) return 1;
      if (timeB === -Infinity) return -1;
      return timeB - timeA;
    }
  });
};
