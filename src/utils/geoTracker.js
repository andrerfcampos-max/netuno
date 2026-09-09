/**
 * geoTracker.js
 * Central de Rastreamento de GPS e Cache de Localização Tática - CBMDF NETUNO
 * Mantém coordenadas em memória e sessionStorage para disponibilização imediata (0ms)
 * ao abrir o painel de rotas ou mapa, evitando que o cálculo inicial caia em fallbacks desordenados.
 */

let memoryLocation = null;
const listeners = new Set();
let globalWatchId = null;

// Tenta restaurar do sessionStorage na inicialização
try {
  const saved = typeof window !== 'undefined' ? sessionStorage.getItem('netuno_last_known_gps') : null;
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
      if (!parsed.timestamp || (Date.now() - parsed.timestamp < 2 * 60 * 60 * 1000)) {
        memoryLocation = parsed;
      }
    }
  }
} catch (e) {
  // Ignora erro de storage
}

/**
 * Retorna a última localização conhecida em memória ou storage (síncrono, 0ms)
 */
export const getLastKnownLocation = () => {
  return memoryLocation ? { ...memoryLocation } : null;
};

/**
 * Atualiza o cache de localização e notifica os ouvintes inscritos
 */
export const setCachedLocation = (coords) => {
  if (!coords) return;
  const lat = typeof coords.lat === 'number' ? coords.lat : coords.latitude;
  const lng = typeof coords.lng === 'number' ? coords.lng : coords.longitude;
  
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return;
  }

  const updated = {
    lat,
    lng,
    accuracy: coords.accuracy || null,
    timestamp: Date.now()
  };

  memoryLocation = updated;

  try {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('netuno_last_known_gps', JSON.stringify(updated));
    }
  } catch (e) { console.warn("[SafeCatch] Erro mitigado:", e); }

  listeners.forEach((fn) => {
    try {
      fn(updated);
    } catch (err) {
      console.warn('Erro ao notificar listener de GPS:', err);
    }
  });
};

/**
 * Assina atualizações de GPS em tempo real (para componentes React)
 */
export const subscribeLocation = (fn) => {
  listeners.add(fn);
  if (memoryLocation) {
    fn({ ...memoryLocation });
  }
  return () => {
    listeners.delete(fn);
  };
};

/**
 * Obtém localização fresca via GPS com timeout controlado.
 * Se demorar ou falhar, resolve com a última conhecida ou null.
 */
export const getFreshLocation = (timeoutMs = 3500) => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      resolve(getLastKnownLocation());
      return;
    }

    let isDone = false;
    const timer = setTimeout(() => {
      if (!isDone) {
        isDone = true;
        resolve(getLastKnownLocation());
      }
    }, timeoutMs);

    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!isDone && pos?.coords) {
            isDone = true;
            clearTimeout(timer);
            setCachedLocation(pos.coords);
            resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          }
        },
        (err) => {
          if (!isDone) {
            isDone = true;
            clearTimeout(timer);
            console.warn('getFreshLocation falhou, usando cache:', err);
            resolve(getLastKnownLocation());
          }
        },
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 10000 }
      );
    } catch (e) {
      if (!isDone) {
        isDone = true;
        clearTimeout(timer);
        resolve(getLastKnownLocation());
      }
    }
  });
};

/**
 * Inicia o rastreador global do navegador (watchPosition)
 */
export const startGlobalGeoTracking = () => {
  if (typeof window === 'undefined' || !('geolocation' in navigator)) return;
  if (globalWatchId !== null) return;

  try {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (pos?.coords) setCachedLocation(pos.coords);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 15000 }
    );

    globalWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (pos?.coords) setCachedLocation(pos.coords);
      },
      (err) => console.warn('Erro watchPosition global:', err),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );
  } catch (e) {
    console.warn('Não foi possível iniciar monitoramento global de GPS:', e);
  }
};
