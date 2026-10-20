/**
 * Gerenciador nativo de armazenamento de mídia/fotos via IndexedDB
 * Permite persistir fotos de vistorias offline sem consumir a cota de 5MB do localStorage.
 */

const DB_NAME = 'netuno_media_db';
const DB_VERSION = 1;
const STORE_NAME = 'inspection_photos';

const openPhotoDB = () => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn('[photoStorage] Erro ao abrir IndexedDB:', request.error);
      resolve(null);
    };
  });
};

/**
 * Salva uma ou mais fotos associadas a um hidrante ou vistoria no IndexedDB
 */
export const savePhotosToIndexedDB = async (inspectionId, photos = []) => {
  try {
    const db = await openPhotoDB();
    if (!db || !photos || photos.length === 0) return false;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const entry = {
        id: String(inspectionId),
        photos: photos.filter(Boolean),
        timestamp: Date.now()
      };

      store.put(entry);

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => {
        console.warn('[photoStorage] Erro ao salvar fotos no IndexedDB:', tx.error);
        resolve(false);
      };
    });
  } catch (err) {
    console.warn('[photoStorage] Falha ao persistir no IndexedDB:', err);
    return false;
  }
};

/**
 * Recupera as fotos salvas para uma vistoria ou hidrante do IndexedDB
 */
export const getPhotosFromIndexedDB = async (inspectionId) => {
  try {
    const db = await openPhotoDB();
    if (!db || !inspectionId) return [];

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(String(inspectionId));

      req.onsuccess = () => {
        const result = req.result;
        resolve(result && Array.isArray(result.photos) ? result.photos : []);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
};

/**
 * Remove fotos antigas de mais de 30 dias para liberar espaço no IndexedDB
 */
export const cleanOldIndexedDBPhotos = async (maxAgeDays = 30) => {
  try {
    const db = await openPhotoDB();
    if (!db) return;

    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.openCursor();

    req.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        if (cursor.value && cursor.value.timestamp && (now - cursor.value.timestamp > maxAgeMs)) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
  } catch (e) {
    console.warn('[photoStorage] Erro na limpeza do IndexedDB:', e);
  }
};
