/**
 * Utilitário de sanitização e correção de encoding (Mojibake, CP1252, CP850, UTF-8 corrompido)
 * para exibição consistente de textos, endereços, pontos de referência e problemas.
 */

export const fixEncoding = (str) => {
  if (!str || typeof str !== 'string') return str || '';
  let res = str;

  // 1. Tenta recuperar UTF-8 duplo quando aplicável
  try {
    if (res.includes('Ã') || res.includes('Â') || res.includes('â')) {
      const decoded = decodeURIComponent(escape(res));
      if (decoded && !/[\uFFFD]/.test(decoded)) {
        res = decoded;
      }
    }
  } catch (e) {
    // Ignora erros de decode
  }

  // 2. Correções de caracteres CP1252 e símbolos herdados de bancos legados
  res = res.replace(/·REA/g, 'ÁREA');
  res = res.replace(/·rea/g, 'Área');
  res = res.replace(/·/g, 'À');
  res = res.replace(/¶/g, 'Â');
  res = res.replace(/§/g, 'º');
  res = res.replace(/¦/g, 'ª');
  res = res.replace(/ø/g, 'º');
  res = res.replace(/ÿ/g, ' ');
  res = res.replace(/«/g, '1/2"');
  res = res.replace(/ï/g, '');
  res = res.replace(/\u00A0/g, ' '); // Non-breaking space
  res = res.replace(/\u00BD/g, '1/2'); // ½

  // 3. Aspas e apóstrofos especiais do Windows CP1252 (0x91..0x94, 0x2018..0x201D, etc.)
  res = res.replace(/[\u0091\u0092\u2018\u2019\u201B\u2032\u00B4]/g, "'");
  res = res.replace(/[\u0093\u0094\u201C\u201D\u201E\u201F\u2033\u00AB\u00BB]/g, '"');
  res = res.replace(/[\u0096\u0097\u2013\u2014\u2015]/g, '-');

  // 4. Corrupção de 'ô' oriundo de aspas no padrão de Brasília (ex: Bl. ôA” -> Bl. "A", CONJ. ôB” -> CONJ. "B")
  res = res.replace(/ô([A-Za-z0-9\s\/\.\-]+)[\u0094\u201d"]/g, '"$1"');
  res = res.replace(/ô([A-Z0-9])/g, '"$1"');
  res = res.replace(/[\u0094\u201d]/g, '"');

  // 5. Qualquer outro 'ô' solto ou grudado em delimitadores/letras maiúsculas que não pertença a palavra legítima
  res = res.replace(/ô(?=[^a-zà-ú]|$)/g, '"');

  // 6. Eliminar quaisquer outros bytes de controle invisíveis ou corrompidos de 0x80 a 0x9F
  res = res.replace(/[\u0080-\u009F]/g, '');

  // 7. Normalização de aspas duplas/simples consecutivas e espaços redundantes
  res = res.replace(/""+/g, '"');
  res = res.replace(/''+/g, "'");
  res = res.replace(/[ \t]+/g, ' ').trim();

  return res;
};

