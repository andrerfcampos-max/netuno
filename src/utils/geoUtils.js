/**
 * Utilitários de geolocalização e validação de coordenadas do Distrito Federal e Entorno
 */

/**
 * Valida se uma coordenada geográfica está dentro dos limites operacionais do Distrito Federal e Entorno
 * @param {number|string} lat Latitude
 * @param {number|string} lng Longitude
 * @returns {boolean} true se a coordenada estiver dentro do DF/Entorno
 */
export const isValidDFCoordinate = (lat, lng) => {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  const numLat = typeof lat === 'number' ? lat : parseFloat(lat);
  const numLng = typeof lng === 'number' ? lng : parseFloat(lng);

  if (isNaN(numLat) || isNaN(numLng)) return false;
  
  // Coordenadas nulas (0,0 no oceano / Null Island)
  if (Math.abs(numLat) < 0.0001 && Math.abs(numLng) < 0.0001) return false;

  // Limites geográficos do Distrito Federal com margem de segurança operacional (RIDE imediata)
  // Latitude do DF: ~ -15.50 a -16.05 -> Intervalo seguro: -16.08 a -15.30
  // Longitude do DF: ~ -48.28 a -47.30 -> Intervalo seguro: -48.60 a -47.00
  const isLatInDF = numLat >= -16.08 && numLat <= -15.30;
  const isLngInDF = numLng >= -48.60 && numLng <= -47.00;

  return isLatInDF && isLngInDF;
};

/**
 * Valida se o hidrante possui coordenadas geográficas válidas para plotagem no mapa
 * @param {Object} hydrant Objeto hidrante
 * @returns {boolean}
 */
export const isHydrantValid = (hydrant) => {
  if (!hydrant) return false;
  return isValidDFCoordinate(hydrant.numLatitude, hydrant.numLongitude);
};

/**
 * Calcula distância geodésica em metros (Haversine)
 */
export const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Raio da Terra em metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Valida de forma uniforme se o hidrante está contido em uma lista de IDs (selecionados ou concluídos),
 * cruzando codHidrante, nomHidrante e _internalId para prevenir problemas de dessincronização.
 * @param {Object} hydrant O objeto do hidrante
 * @param {Array<string>} selectedIds A lista de IDs da missão
 * @returns {boolean}
 */
export const isHydrantSelected = (hydrant, selectedIds) => {
  if (!hydrant || !Array.isArray(selectedIds)) return false;
  return selectedIds.includes(hydrant.codHidrante) || 
         selectedIds.includes(hydrant.nomHidrante) || 
         (hydrant._internalId && selectedIds.includes(hydrant._internalId));
};
