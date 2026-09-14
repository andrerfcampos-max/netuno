/**
 * streetViewUtils.js
 * Utilitários para geração de links precisos do Google Street View 360°.
 * Suporta metadados calibrados (posição da câmera do veículo e azimute/heading da fachada do hidrante)
 * gerados pelo pipeline de visão computacional e estudo fotográfico do Street View Sniper.
 */

// Catálogo de metadados calibrados no estudo de fotos de fachada
export const HYDRANT_STREET_VIEW_METADATA = {
  // Arniqueira - Lote Piloto
  'ARN00001': {
    heading: 109,
    carLat: -15.86114134649395,
    carLng: -48.00418579313272,
    panoId: 'hUS74TKMtdg5YajAyZokYA'
  },
  '5286': {
    heading: 109,
    carLat: -15.86114134649395,
    carLng: -48.00418579313272,
    panoId: 'hUS74TKMtdg5YajAyZokYA'
  },
  'ARN00002': {
    heading: 182,
    carLat: -15.85566673352878,
    carLng: -47.99605388008419,
    panoId: 'HvFoAqaxr5NlbgON8HNGvA'
  },
  '5287': {
    heading: 182,
    carLat: -15.85566673352878,
    carLng: -47.99605388008419,
    panoId: 'HvFoAqaxr5NlbgON8HNGvA'
  },
  'ARN00003': {
    heading: 73,
    carLat: -15.86141687256286,
    carLng: -48.00067570960101,
    panoId: 'CAoSF0NJSE0wb2dLRUlDQWdJRHkwOVBmekFF'
  },
  '5288': {
    heading: 73,
    carLat: -15.86141687256286,
    carLng: -48.00067570960101,
    panoId: 'CAoSF0NJSE0wb2dLRUlDQWdJRHkwOVBmekFF'
  },
  'ARN00004': {
    heading: 263,
    carLat: -15.86755360312984,
    carLng: -48.01034524687581,
    panoId: 'UjDiU5TKHxxY_kW3omWS3g'
  },
  '5289': {
    heading: 263,
    carLat: -15.86755360312984,
    carLng: -48.01034524687581,
    panoId: 'UjDiU5TKHxxY_kW3omWS3g'
  }
};

/**
 * Retorna a URL otimizada do Google Maps Street View já apontada no ângulo exato do hidrante.
 * @param {Object} hydrant - Objeto do hidrante (com numLatitude, numLongitude, nomHidrante, etc.)
 * @returns {string} URL pronta para abertura direta
 */
export const getStreetViewUrl = (hydrant) => {
  if (!hydrant || !hydrant.numLatitude || !hydrant.numLongitude) {
    return 'https://maps.google.com';
  }

  const nom = hydrant.nomHidrante ? String(hydrant.nomHidrante).trim().toUpperCase() : '';
  const cod = hydrant.codHidrante !== undefined && hydrant.codHidrante !== null ? String(hydrant.codHidrante).trim() : '';

  const meta = HYDRANT_STREET_VIEW_METADATA[nom] || HYDRANT_STREET_VIEW_METADATA[cod] || {};

  const heading = hydrant.streetViewHeading ?? hydrant.heading ?? meta.heading;
  const carLat = hydrant.carLat ?? hydrant.streetViewLat ?? meta.carLat;
  const carLng = hydrant.carLng ?? hydrant.streetViewLng ?? meta.carLng;

  // Viewpoint ideal: se temos a posição do carro onde a foto foi tirada, usamos ela; caso contrário, as coordenadas do hidrante
  const lat = carLat || hydrant.numLatitude;
  const lng = carLng || hydrant.numLongitude;

  if (heading !== undefined && heading !== null && !isNaN(Number(heading))) {
    const roundHeading = Math.round(Number(heading));
    // Formato clássico Google Maps com parâmetro cbp (11 = street view, azimute calibrado)
    return `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lng}&cbp=11,${roundHeading},0,0,0`;
  }

  // Fallback padrão sem ângulo específico
  return `https://maps.google.com/maps?q=&layer=c&cbll=${hydrant.numLatitude},${hydrant.numLongitude}`;
};

/**
 * Abre o Street View em nova aba de forma segura.
 * @param {Object} hydrant 
 */
export const openStreetView = (hydrant) => {
  const url = getStreetViewUrl(hydrant);
  window.open(url, '_blank', 'noopener,noreferrer');
};
