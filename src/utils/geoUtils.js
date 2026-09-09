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

/**
 * Calcula distância geodésica em quilômetros (Haversine)
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return 999;
  const R = 6371; // Raio da Terra em km
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
 * Ordena um cluster de anel viário / rotatória de sentido único (ex: Aeroporto de Brasília / balão)
 * de forma contínua e sequencial (sentido horário ou anti-horário), evitando deslocamentos cruzados ineficientes.
 */
export const orderRingCluster = (cluster, entryLat, entryLng) => {
  if (!cluster || cluster.length <= 1) return cluster || [];
  
  const centerLat = cluster.reduce((sum, h) => sum + h.numLatitude, 0) / cluster.length;
  const centerLng = cluster.reduce((sum, h) => sum + h.numLongitude, 0) / cluster.length;

  const withAngle = cluster.map(h => {
    const angle = Math.atan2(
      h.numLatitude - centerLat,
      (h.numLongitude - centerLng) * Math.cos(centerLat * Math.PI / 180)
    );
    return { h, angle };
  });

  const clockwise = [...withAngle].sort((a, b) => a.angle - b.angle).map(x => x.h);
  const counterClockwise = [...clockwise].reverse();

  const distCW = calculateDistance(entryLat, entryLng, clockwise[0].numLatitude, clockwise[0].numLongitude);
  const distCCW = calculateDistance(entryLat, entryLng, counterClockwise[0].numLatitude, counterClockwise[0].numLongitude);

  return distCW <= distCCW ? clockwise : counterClockwise;
};

/**
 * Lógica global de roteirização do Caixeiro-Viajante em Ciclo Fechado (Closed-Loop TSP com 2-Opt)
 * Foca na menor quilometragem total do ciclo completo (partida, atendimento e retorno à origem),
 * preservando anéis viários contínuos sem voltas redundantes no mesmo balão/retorno.
 */
export const optimizeClosedLoopTSP = (hidrantes, startLat, startLng) => {
  if (!hidrantes || hidrantes.length <= 1) return hidrantes ? [...hidrantes] : [];

  const isAirportHydrant = (h) => {
    const end = (h.dscEndereco || '').toUpperCase();
    return end.includes('AEROPORTO') && h.numLatitude < -15.864 && h.numLatitude > -15.875;
  };

  const airportCluster = hidrantes.filter(isAirportHydrant);
  const regularHydrants = hidrantes.filter(h => !isAirportHydrant(h));

  // 1. Constrói tour inicial com Nearest Neighbor integrando clusters de anel viário
  let unvisited = [...regularHydrants];
  let currentLat = startLat;
  let currentLng = startLng;
  let tour = [];
  let airportInserted = airportCluster.length === 0;

  while (unvisited.length > 0 || !airportInserted) {
    let nearestIdx = -1;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const dist = calculateDistance(currentLat, currentLng, unvisited[i].numLatitude, unvisited[i].numLongitude);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIdx = i;
      }
    }

    let distAirport = Infinity;
    if (!airportInserted) {
      const airportCenterLat = airportCluster.reduce((s, h) => s + h.numLatitude, 0) / airportCluster.length;
      const airportCenterLng = airportCluster.reduce((s, h) => s + h.numLongitude, 0) / airportCluster.length;
      distAirport = calculateDistance(currentLat, currentLng, airportCenterLat, airportCenterLng);
    }

    if (!airportInserted && distAirport <= minDistance) {
      const orderedAirport = orderRingCluster(airportCluster, currentLat, currentLng);
      tour.push(...orderedAirport);
      const last = orderedAirport[orderedAirport.length - 1];
      currentLat = last.numLatitude;
      currentLng = last.numLongitude;
      airportInserted = true;
    } else if (nearestIdx >= 0) {
      const nextH = unvisited.splice(nearestIdx, 1)[0];
      tour.push(nextH);
      currentLat = nextH.numLatitude;
      currentLng = nextH.numLongitude;
    } else {
      break;
    }
  }

  // 2. Refinamento 2-Opt para ciclo fechado (Start -> H1 -> ... -> Hn -> Start)
  // Desfaz cruzamentos e minimiza o percurso total completo
  let improved = true;
  let iterations = 0;
  const maxIterations = 50;
  const n = tour.length;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        // Preserva a continuidade sequencial interna do anel viário
        const seg = tour.slice(i, k + 1);
        const hasSomeAirport = seg.some(isAirportHydrant);
        const hasAllAirport = airportCluster.length > 0 && airportCluster.every(ah => seg.some(h => (h.codHidrante || h.nomHidrante) === (ah.codHidrante || ah.nomHidrante)));
        if (hasSomeAirport && !hasAllAirport) {
          continue;
        }

        const p1 = i === 0 ? { numLatitude: startLat, numLongitude: startLng } : tour[i - 1];
        const p2 = tour[i];
        const p3 = tour[k];
        const p4 = k === n - 1 ? { numLatitude: startLat, numLongitude: startLng } : tour[k + 1];

        const dCurrent = calculateDistance(p1.numLatitude, p1.numLongitude, p2.numLatitude, p2.numLongitude) +
                         calculateDistance(p3.numLatitude, p3.numLongitude, p4.numLatitude, p4.numLongitude);
        const dCandidate = calculateDistance(p1.numLatitude, p1.numLongitude, p3.numLatitude, p3.numLongitude) +
                          calculateDistance(p2.numLatitude, p2.numLongitude, p4.numLatitude, p4.numLongitude);

        if (dCandidate < dCurrent - 0.0001) {
          const reversed = tour.slice(i, k + 1).reverse();
          tour = [...tour.slice(0, i), ...reversed, ...tour.slice(k + 1)];
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  return tour;
};

