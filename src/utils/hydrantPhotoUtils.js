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

  // 2. Mapeamento tático pelas 5 RAs com fotos locais calibradas no Street View Sniper
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

// Cache em memória para evitar duplicação de requisições de preloading
const preloadedUrls = new Set();

/**
 * Dispara o pré-carregamento (pre-load) instantâneo de uma foto no cache HTTP do navegador
 * @param {string} photoUrl 
 */
export const preloadHydrantPhoto = (photoUrl) => {
  if (!photoUrl || typeof photoUrl !== 'string') return;
  const clean = photoUrl.trim();
  if (!clean || preloadedUrls.has(clean) || clean.startsWith('data:')) return;

  preloadedUrls.add(clean);

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
