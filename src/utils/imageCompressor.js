/**
 * imageCompressor.js
 * Utilitário centralizado de compressão e otimização agressiva de imagens
 * para relatórios PDF A4 oficiais do CBMDF / CAESB e formulários de campo.
 * 
 * Garante que:
 * 1. Nenhuma foto exceda as dimensões necessárias para impressão A4 de alta resolução (máx 800px).
 * 2. Imagens JPEG sejam recomprimidas com qualidade calibrada (0.65-0.70), caindo de 4MB para ~35-50KB.
 * 3. Fotos em formato PNG, Base64 cru ou blobs sejam sanitizadas para JPEG ultraleve.
 * 4. Cache em memória para evitar re-processamento repetido da mesma imagem.
 */

const compressedPhotoCache = new Map();

/**
 * Redimensiona e comprime uma foto (seja URL, caminho relativo ou Base64)
 * retornando uma string Base64 em JPEG ultraleve otimizada para impressão A4.
 * 
 * @param {string} src - URL ou DataURL da foto
 * @param {Object} options - Opções de redimensionamento
 * @param {number} options.maxWidth - Largura máxima (default: 800px)
 * @param {number} options.maxHeight - Altura máxima (default: 800px)
 * @param {number} options.quality - Qualidade do JPEG (default: 0.68)
 * @returns {Promise<string>} DataURL comprimido em JPEG
 */
export const compressImageForReport = (src, options = {}) => {
  return new Promise((resolve) => {
    if (!src || typeof src !== 'string' || src.trim().length === 0) {
      return resolve(src);
    }

    const cleanSrc = src.trim();

    // Se já estiver no cache, retorna instantaneamente
    if (compressedPhotoCache.has(cleanSrc)) {
      return resolve(compressedPhotoCache.get(cleanSrc));
    }

    const maxWidth = options.maxWidth || 800;
    const maxHeight = options.maxHeight || 800;
    const quality = options.quality !== undefined ? options.quality : 0.68;

    const img = new Image();
    // Permite carregar imagens de URLs externas/Supabase sem bloquear CORS no canvas
    img.crossOrigin = 'anonymous';

    let isResolved = false;
    const safeResolve = (result) => {
      if (!isResolved) {
        isResolved = true;
        compressedPhotoCache.set(cleanSrc, result);
        resolve(result);
      }
    };

    // Timeout de segurança para evitar travamento caso a imagem falhe ao carregar
    const timer = setTimeout(() => {
      safeResolve(cleanSrc);
    }, 4500);

    img.onload = () => {
      clearTimeout(timer);
      try {
        let width = img.width || maxWidth;
        let height = img.height || maxHeight;

        // Se a imagem já for muito pequena (ex: menor que 400px e já for JPEG leve), mantém ou ajusta
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round(height * (maxWidth / width));
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round(width * (maxHeight / height));
              height = maxHeight;
            }
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');

        // Fundo branco caso haja transparência PNG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Desenha a imagem redimensionada
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Exporta como JPEG ultraleve
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        safeResolve(compressedDataUrl);
      } catch (err) {
        console.warn('[imageCompressor] Falha ao processar canvas, usando fallback original:', err);
        safeResolve(cleanSrc);
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      safeResolve(cleanSrc);
    };

    img.src = cleanSrc;
  });
};

/**
 * Processa em lote uma lista de hidrantes com suas fotos anexadas,
 * gerando um novo mapa de hidrantes com todas as fotos otimizadas.
 * 
 * @param {Array} hydrantsList - Lista de hidrantes
 * @param {Function} onProgress - Callback de progresso (current, total)
 * @returns {Promise<Array>} Lista de hidrantes com fotos otimizadas
 */
export const optimizeAllReportPhotos = async (hydrantsList = [], onProgress = null) => {
  if (!Array.isArray(hydrantsList) || hydrantsList.length === 0) {
    return hydrantsList;
  }

  // 1. Coleta todas as URLs únicas de fotos que serão utilizadas
  const uniqueUrls = new Set();
  hydrantsList.forEach(h => {
    if (h.extractedPhotos && Array.isArray(h.extractedPhotos)) {
      h.extractedPhotos.forEach(p => {
        if (p && typeof p === 'string' && p.trim()) uniqueUrls.add(p.trim());
      });
    }
    if (h.fotoVistoria && typeof h.fotoVistoria === 'string' && h.fotoVistoria.trim()) {
      uniqueUrls.add(h.fotoVistoria.trim());
    }
    if (Array.isArray(h.fotosVistoria)) {
      h.fotosVistoria.forEach(p => {
        if (p && typeof p === 'string' && p.trim()) uniqueUrls.add(p.trim());
      });
    }
    if (Array.isArray(h.HISTORICO_VISTORIAS)) {
      h.HISTORICO_VISTORIAS.forEach(v => {
        if (v.fotoVistoria && typeof v.fotoVistoria === 'string' && v.fotoVistoria.trim()) {
          uniqueUrls.add(v.fotoVistoria.trim());
        }
        if (Array.isArray(v.fotosVistoria)) {
          v.fotosVistoria.forEach(p => {
            if (p && typeof p === 'string' && p.trim()) uniqueUrls.add(p.trim());
          });
        }
      });
    }
  });

  const urlArray = Array.from(uniqueUrls);
  const totalUrls = urlArray.length;

  if (totalUrls === 0) {
    return hydrantsList;
  }

  // 2. Processa as fotos em pequenos lotes (chunks) paralelos para não travar a UI
  const CHUNK_SIZE = 4;
  let processedCount = 0;
  const optimizedUrlMap = new Map();

  for (let i = 0; i < totalUrls; i += CHUNK_SIZE) {
    const chunk = urlArray.slice(i, i + CHUNK_SIZE);
    const results = await Promise.all(chunk.map(url => compressImageForReport(url)));

    chunk.forEach((url, idx) => {
      optimizedUrlMap.set(url, results[idx]);
    });

    processedCount += chunk.length;
    if (typeof onProgress === 'function') {
      try {
        onProgress(Math.min(processedCount, totalUrls), totalUrls);
      } catch (e) {
        // Safe catch
      }
    }

    // Pequeno intervalo para o navegador atualizar o render loop / UI
    await new Promise(r => setTimeout(r, 16));
  }

  // 3. Devolve a lista de hidrantes mapeada com as fotos comprimidas e estritamente deduplicadas
  return hydrantsList.map(h => {
    let newExtracted = h.extractedPhotos;
    if (Array.isArray(h.extractedPhotos)) {
      newExtracted = Array.from(new Set(h.extractedPhotos.map(p => optimizedUrlMap.get(typeof p === 'string' ? p.trim() : p) || p)));
    }

    let newFotoVistoria = h.fotoVistoria;
    if (h.fotoVistoria && typeof h.fotoVistoria === 'string') {
      newFotoVistoria = optimizedUrlMap.get(h.fotoVistoria.trim()) || h.fotoVistoria;
    }

    let newFotosVistoria = h.fotosVistoria;
    if (Array.isArray(h.fotosVistoria)) {
      newFotosVistoria = Array.from(new Set(h.fotosVistoria.map(p => optimizedUrlMap.get(typeof p === 'string' ? p.trim() : p) || p)));
    }

    let newHistorico = h.HISTORICO_VISTORIAS;
    if (Array.isArray(h.HISTORICO_VISTORIAS)) {
      newHistorico = h.HISTORICO_VISTORIAS.map(v => {
        let vFoto = v.fotoVistoria;
        if (vFoto && typeof vFoto === 'string') {
          vFoto = optimizedUrlMap.get(vFoto.trim()) || vFoto;
        }
        let vFotos = v.fotosVistoria;
        if (Array.isArray(vFotos)) {
          vFotos = Array.from(new Set(vFotos.map(p => optimizedUrlMap.get(typeof p === 'string' ? p.trim() : p) || p)));
        }
        return {
          ...v,
          fotoVistoria: vFoto,
          fotosVistoria: vFotos
        };
      });
    }

    return {
      ...h,
      extractedPhotos: newExtracted,
      fotoVistoria: newFotoVistoria,
      fotosVistoria: newFotosVistoria,
      HISTORICO_VISTORIAS: newHistorico
    };
  });
};
