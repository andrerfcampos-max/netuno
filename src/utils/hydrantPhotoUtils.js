/**
 * hydrantPhotoUtils.js
 * Utilitário centralizado para resolução e pré-carregamento agressivo (0ms) das fotos de hidrantes.
 * Cobre todas as RAs mapeadas (Arniqueira, Águas Claras, Candangolândia, Lago Sul e Brazlândia),
 * eliminando delays e telas em branco pós-login ou durante a navegação em rotas.
 */

/**
 * Retorna o caminho da foto de perfil ou miniatura de fachada do hidrante.
 * @param {Object} h - Objeto do hidrante
 * @returns {string|null} URL ou caminho da foto
 */
export const getHydrantPhoto = (h) => {
  if (!h) return null;
  
  // 1. Foto direta gravada no objeto (perfil, cloud ou base64)
  if (h.fotoPerfil && typeof h.fotoPerfil === 'string' && h.fotoPerfil.trim() !== '') {
    return h.fotoPerfil.trim();
  }

  // 2. Mapeamento tático pelas RAs com fotos locais calibradas no Street View Sniper
  const nom = String(h.nomHidrante || '').toUpperCase().trim();
  if (nom.startsWith('ARN')) {
    return `/hidrantes/arniqueira/${nom}.jpeg`;
  }
  if (nom.startsWith('ACL')) {
    return `/hidrantes/aguas_claras/${nom}.jpeg`;
  }
  if (nom.startsWith('BRZ')) {
    return `/hidrantes/brazlandia/${nom}.jpeg`;
  }
  if (nom.startsWith('CAN') || nom.startsWith('CDG')) {
    return `/hidrantes/candangolandia/${nom}.jpeg`;
  }
  if (nom.startsWith('LAS') || nom.startsWith('LGS')) {
    return `/hidrantes/lago_sul/${nom}.jpeg`;
  }
  if (nom.startsWith('OCT') || nom.startsWith('SUD')) {
    return `/hidrantes/sudoeste/${nom}.jpeg`;
  }
  if (nom.startsWith('CEI') || nom.startsWith('CEL')) {
    return `/hidrantes/ceilandia/${nom}.jpeg`;
  }
  if (nom.startsWith('GAM')) {
    return `/hidrantes/gama/${nom}.jpeg`;
  }

  // 3. Fallbacks secundários de fotos
  if (h.foto && typeof h.foto === 'string' && h.foto.trim() !== '') return h.foto.trim();
  if (h.fotoUrl && typeof h.fotoUrl === 'string' && h.fotoUrl.trim() !== '') return h.fotoUrl.trim();
  if (h.fotoVistoria && typeof h.fotoVistoria === 'string' && h.fotoVistoria.trim() !== '') return h.fotoVistoria.trim();
  if (Array.isArray(h.fotosVistoria) && h.fotosVistoria.length > 0 && typeof h.fotosVistoria[0] === 'string') {
    return h.fotosVistoria[0].trim();
  }

  return null;
};

/**
 * Retorna a versão em Alta Resolução (HD) para lightbox e zoom com pinça
 * @param {Object} h - Objeto do hidrante
 * @returns {string|null}
 */
export const getHydrantHdPhoto = (h) => {
  const standard = getHydrantPhoto(h);
  if (!standard) return null;

  if (standard.endsWith('.jpeg')) {
    return standard.replace('.jpeg', '_hd.jpeg');
  }
  if (standard.endsWith('.jpg')) {
    return standard.replace('.jpg', '_hd.jpg');
  }
  return standard;
};

// Cache em memória para evitar duplicação de requisições de preloading e permitir Web Share API 0ms
const preloadedUrls = new Set();
const photoBlobCache = new Map();
const photoValidUrlCache = new Map();

/**
 * Dispara o pré-carregamento (pre-load) instantâneo de uma foto no cache HTTP do navegador
 * e armazena o Blob em memória para compartilhamento instantâneo (0ms) no WhatsApp Mobile.
 * @param {string} photoUrl 
 */
export const preloadHydrantPhoto = (photoUrl) => {
  if (!photoUrl || typeof photoUrl !== 'string') return;
  const clean = photoUrl.trim();
  if (!clean || preloadedUrls.has(clean)) return;

  preloadedUrls.add(clean);

  // Pré-carrega o Blob em memória (inclusive data URLs) para Web Share API síncrona no clique
  if (typeof fetch !== 'undefined' && !photoBlobCache.has(clean)) {
    fetch(clean)
      .then(res => {
        if (!res.ok) {
          photoValidUrlCache.set(clean, false);
          return null;
        }
        return res.blob();
      })
      .then(blob => {
        if (blob && blob.size > 0 && blob.type.startsWith('image/')) {
          photoBlobCache.set(clean, blob);
          photoValidUrlCache.set(clean, true);
        } else {
          photoValidUrlCache.set(clean, false);
        }
      })
      .catch(() => {
        if (clean.startsWith('http')) {
          photoValidUrlCache.set(clean, true);
        }
      });
  }

  if (clean.startsWith('data:')) return;

  try {
    // 1. Pré-carregamento via objeto Image em memória com alta prioridade
    const img = new Image();
    img.decoding = 'async';
    if ('fetchPriority' in img) {
      img.fetchPriority = 'high';
    }
    img.src = clean;

    // 2. Injeção de link rel="preload" no cabeçalho se em ambiente browser
    if (typeof document !== 'undefined' && document.head) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = clean;
      if ('fetchPriority' in link) {
        link.fetchPriority = 'high';
      }
      document.head.appendChild(link);
    }
  } catch (e) {
    // Falha silenciosa
  }
};

/**
 * Pré-carrega as fotos de uma lista de hidrantes (ex: primeiros hidrantes da rota ou proximidade)
 * @param {Array} hydrants 
 * @param {number} count 
 */
export const preloadHydrantsList = (hydrants = [], count = 3) => {
  if (!Array.isArray(hydrants) || hydrants.length === 0) return;
  const slice = hydrants.slice(0, count);
  slice.forEach(h => {
    const url = getHydrantPhoto(h);
    if (url) {
      preloadHydrantPhoto(url);
    }
  });
};

/**
 * Compartilha o card completo do hidrante no WhatsApp incluindo a Foto de Perfil, texto e links:
 * - Em dispositivos móveis (Web Share API Level 2 com suporte a files):
 *   Envia o arquivo de imagem (.jpeg) anexado diretamente com o texto completo na legenda (caption).
 * - Em Desktop (WhatsApp Web) ou fallback:
 *   Inclui o link público direto da Foto de Perfil no corpo da mensagem para pré-visualização automática no WhatsApp.
 * @param {Object} h - Objeto do hidrante
 * @param {string} [formattedVistoriaDate] - Data da última vistoria formatada (opcional)
 */
export const shareHydrantOnWhatsApp = async (h, formattedVistoriaDate) => {
  if (!h) return;
  const id = h.codHidrante || h._internalId || h.nomHidrante;
  const displayCode = h.nomHidrante || h.codHidrante || id;
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://netuno-eight.vercel.app';
  const netunoUrl = `${baseUrl}/?hid=${encodeURIComponent(id)}`;
  const wazeUrl = `https://waze.com/ul?ll=${h.numLatitude},${h.numLongitude}`;
  const photoRaw = getHydrantPhoto(h);

  let imageFile = null;
  let isPhotoVerified = false;
  const safeName = String(displayCode).replace(/[^a-zA-Z0-9_-]/g, '_');

  if (photoRaw) {
    const cleanUrl = photoRaw.trim();
    if (photoBlobCache.has(cleanUrl)) {
      const cachedBlob = photoBlobCache.get(cleanUrl);
      if (cachedBlob) {
        const ext = cachedBlob.type.includes('png') ? 'png' : 'jpeg';
        imageFile = new File([cachedBlob], `${safeName}.${ext}`, { type: cachedBlob.type || 'image/jpeg' });
        isPhotoVerified = true;
      }
    } else if (photoValidUrlCache.get(cleanUrl) !== false) {
      try {
        const res = await fetch(cleanUrl);
        if (res.ok) {
          const blob = await res.blob();
          if (blob && blob.size > 0 && blob.type.startsWith('image/')) {
            photoBlobCache.set(cleanUrl, blob);
            photoValidUrlCache.set(cleanUrl, true);
            const ext = blob.type.includes('png') ? 'png' : 'jpeg';
            imageFile = new File([blob], `${safeName}.${ext}`, { type: blob.type || 'image/jpeg' });
            isPhotoVerified = true;
          } else {
            photoValidUrlCache.set(cleanUrl, false);
          }
        } else {
          photoValidUrlCache.set(cleanUrl, false);
        }
      } catch (e) {
        if (cleanUrl.startsWith('http')) {
          isPhotoVerified = true;
        }
      }
    }
  }

  const publicPhotoUrl = (photoRaw && isPhotoVerified)
    ? (photoRaw.startsWith('http') ? photoRaw : (photoRaw.startsWith('/') ? `${baseUrl}${photoRaw}` : ''))
    : '';

  const vistoriaStr = formattedVistoriaDate || h.datHoraUltimaVistoria || 'Sem registro';
  let text = `🚒 *Hidrante:* ${displayCode}\n📍 *RA:* ${h.dscLocalidade || '-'}\n${h.flgAtivo ? '🟢 *Status:* OPERANTE' : '🔴 *Status:* INOPERANTE'}\n📅 *Última Vistoria:* ${vistoriaStr}\n⚠️ *Problemas:* ${h.problemasHidrante || 'Nenhum'}\n🗺️ *Endereço:* ${h.dscEndereco || ''} ${h.dscPontoReferencia ? `(${h.dscPontoReferencia})` : ''}`;

  if (publicPhotoUrl) {
    text += `\n\n📸 *Foto de Perfil:*\n${publicPhotoUrl}`;
  }

  text += `\n\n📲 *Abrir no App Netuno:*\n${netunoUrl}\n\n🚗 *Navegar pelo Waze:*\n${wazeUrl}`;

  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // No Mobile, prioriza o envio nativo com a foto de perfil real anexada como imagem e texto na legenda
  if (isMobile && imageFile && typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      if (navigator.canShare({ files: [imageFile] })) {
        await navigator.share({
          title: `Hidrante ${displayCode}`,
          text: text,
          files: [imageFile]
        });
        return;
      }
    } catch (err) {
      if (err && (err.name === 'AbortError' || String(err.message).toLowerCase().includes('cancel') || String(err.message).toLowerCase().includes('abort'))) {
        return;
      }
    }
  }

  // Fallback universal (WhatsApp Mobile / WhatsApp Web com link da foto de perfil incluso)
  const waUrl = isMobile
    ? `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
    : `https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank');
};

