/**
 * routeOptimization.js
 * Motor de Otimização de Rota ATSP (Asymmetric Traveling Salesperson Problem)
 * CBMDF - Sistema NETUNO
 * 
 * Resolve rotas com respeito estrito a vias de mão única (oneway), canteiros,
 * rotatórias e restrições viárias reais mapeadas pelo OpenStreetMap / OSRM.
 */

// Cálculo de distância geodésica em metros (Haversine)
export const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return 999999;
  const R = 6371000; // Raio da Terra em metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

// Penalidade tática para manobra de retorno / 180° (em segundos)
// Permite que o algoritmo priorize a continuidade da via no mesmo sentido e evite manobras desnecessárias de viatura
export const U_TURN_PENALTY_SECONDS = 40;

// Azimute de navegação entre dois pontos em graus (0 a 359)
export const calculateBearing = (lat1, lon1, lat2, lon2) => {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return null;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  return brng;
};

// Diferença angular de manobra (0 a 180 graus) entre o vetor de aproximação e o vetor de saída
export const calculateTurnAngle = (bearingIn, bearingOut) => {
  if (bearingIn === null || bearingOut === null || isNaN(bearingIn) || isNaN(bearingOut)) return 0;
  let diff = Math.abs(bearingOut - bearingIn) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
};

// Retorna a penalidade em segundos para a manobra entre o vetor de entrada e o vetor de saída
// Ângulos >= 115° indicam retorno agudo / inversão de sentido (U-turn)
export const getManeuverPenaltySeconds = (fromNode, viaNode, toNode, coords, penalty = U_TURN_PENALTY_SECONDS) => {
  if (!coords || !coords[fromNode] || !coords[viaNode] || !coords[toNode]) return 0;
  const p1 = coords[fromNode];
  const p2 = coords[viaNode];
  const p3 = coords[toNode];

  // Se a distância for muito curta (< 5 metros, coordenadas sobrepostas/ruído GPS), não penaliza
  const dist1 = calculateDistanceMeters(p1.lat, p1.lng, p2.lat, p2.lng);
  const dist2 = calculateDistanceMeters(p2.lat, p2.lng, p3.lat, p3.lng);
  if (dist1 < 5 || dist2 < 5) return 0;

  const bIn = calculateBearing(p1.lat, p1.lng, p2.lat, p2.lng);
  const bOut = calculateBearing(p2.lat, p2.lng, p3.lat, p3.lng);
  const angle = calculateTurnAngle(bIn, bOut);

  // Ângulo de manobra de 180 graus: a partir de 115° inicia transição, atingindo o teto de 40s a partir de 140°
  if (angle < 115) return 0;
  if (angle >= 140) return penalty;
  return Math.round(penalty * ((angle - 115) / (140 - 115)));
};

// Fallback Instantâneo Euclidiano (0ms - Nearest Neighbor com Penalidade Direcional de 40s para Retorno 180°)
export const optimizeRouteEuclidean = (hidrantes, startLat, startLng) => {
  if (!hidrantes || hidrantes.length === 0) return [];
  
  let unvisited = [...hidrantes];
  let route = [];
  let currentLat = startLat;
  let currentLng = startLng;
  let prevLat = null;
  let prevLng = null;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minCost = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const h = unvisited[i];
      const dist = calculateDistanceMeters(currentLat, currentLng, h.numLatitude, h.numLongitude);
      
      let penaltyMeters = 0;
      if (prevLat !== null && prevLng !== null && dist > 5) {
        const dPrev = calculateDistanceMeters(prevLat, prevLng, currentLat, currentLng);
        if (dPrev > 5) {
          const bIn = calculateBearing(prevLat, prevLng, currentLat, currentLng);
          const bOut = calculateBearing(currentLat, currentLng, h.numLatitude, h.numLongitude);
          const angle = calculateTurnAngle(bIn, bOut);
          if (angle >= 115) {
            // Converte a penalidade de 40s para metros equivalentes no meio urbano (~30 km/h = 8.33 m/s => 40s ~ 333m)
            const penaltyRatio = angle >= 140 ? 1 : (angle - 115) / (140 - 115);
            penaltyMeters = Math.round(U_TURN_PENALTY_SECONDS * 8.33 * penaltyRatio);
          }
        }
      }

      const totalCost = dist + penaltyMeters;
      if (totalCost < minCost) {
        minCost = totalCost;
        nearestIdx = i;
      }
    }

    const nextHydrant = unvisited.splice(nearestIdx, 1)[0];
    route.push(nextHydrant);
    prevLat = currentLat;
    prevLng = currentLng;
    currentLat = nextHydrant.numLatitude;
    currentLng = nextHydrant.numLongitude;
  }

  return route;
};

// Custo direcionado da aresta (A -> B)
// Prioriza o tempo de condução (segundos) e usa distância (metros) como desempate
const getDirectedCost = (fromIdx, toIdx, durations, distances) => {
  const dur = (durations && durations[fromIdx]) ? durations[fromIdx][toIdx] : null;
  const dist = (distances && distances[fromIdx]) ? distances[fromIdx][toIdx] : null;

  if (dur === null || dur === undefined || isNaN(dur) || dur < 0) {
    return 9999999;
  }
  // Custo = Segundos + 0.03 * Metros (ponderação tática urbana)
  return dur + (dist !== null && !isNaN(dist) ? dist * 0.03 : 0);
};

// Custo total direcionado de um caminho, incluindo penalidade de 40s para manobras de retorno 180°
const calculatePathCost = (path, durations, distances, coords = null) => {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    total += getDirectedCost(path[i], path[i + 1], durations, distances);
  }
  // Penalidade de manobra física 180° (U-turn) nos nós intermediários
  if (coords && coords.length > 0) {
    for (let i = 1; i < path.length - 1; i++) {
      total += getManeuverPenaltySeconds(path[i - 1], path[i], path[i + 1], coords);
    }
  }
  return total;
};

/**
 * Resolvedor ATSP (Asymmetric TSP) com Penalidade Tática de Retorno 180° (40s)
 * @param {Array} hydrants - Lista de hidrantes a ordenar
 * @param {number} startLat - Latitude inicial (GPS ou hidrante vistoriado)
 * @param {number} startLng - Longitude inicial
 * @param {Array<Array<number>>} durations - Matriz de tempos OSRM
 * @param {Array<Array<number>>} distances - Matriz de distâncias OSRM
 * @returns {{ route: Array, drivingMetrics: Object }}
 */
export const solveATSPRoute = (hydrants, startLat, startLng, durations, distances) => {
  if (!hydrants || hydrants.length === 0) {
    return { route: [], drivingMetrics: {} };
  }

  // O índice 0 na matriz OSRM corresponde ao ponto de partida [startLng, startLat]
  // Os índices 1 .. N correspondem aos hidrantes em ordem original de chunk
  const N = hydrants.length;
  const coords = [
    { lat: startLat, lng: startLng },
    ...hydrants.map(h => ({ lat: h.numLatitude, lng: h.numLongitude }))
  ];

  const unvisitedIndices = new Set();
  for (let i = 1; i <= N; i++) {
    unvisitedIndices.add(i);
  }

  // 1. CONSTRUÇÃO INICIAL: Inserção Mais Barata Direcionada (Cheapest Directed Insertion)
  // Inicia com o ponto de partida [0]
  let currentPath = [0];

  // Adiciona o primeiro hidrante mais próximo da partida em custo direcionado
  let firstBest = -1;
  let firstMinCost = Infinity;
  for (const idx of unvisitedIndices) {
    const cost = getDirectedCost(0, idx, durations, distances);
    if (cost < firstMinCost) {
      firstMinCost = cost;
      firstBest = idx;
    }
  }

  if (firstBest !== -1) {
    currentPath.push(firstBest);
    unvisitedIndices.delete(firstBest);
  }

  // Insere iterativamente os demais hidrantes na posição de menor aumento de custo direcionado (incluindo manobras 180°)
  while (unvisitedIndices.size > 0) {
    let bestNode = -1;
    let bestPos = -1;
    let minDelta = Infinity;
    const baseCost = calculatePathCost(currentPath, durations, distances, coords);

    for (const node of unvisitedIndices) {
      // Testa inserir no final
      const candEnd = [...currentPath, node];
      const appendCost = calculatePathCost(candEnd, durations, distances, coords) - baseCost;
      if (appendCost < minDelta) {
        minDelta = appendCost;
        bestNode = node;
        bestPos = currentPath.length;
      }

      // Testa inserir no meio
      for (let p = 1; p < currentPath.length; p++) {
        const candMid = [...currentPath.slice(0, p), node, ...currentPath.slice(p)];
        const delta = calculatePathCost(candMid, durations, distances, coords) - baseCost;

        if (delta < minDelta) {
          minDelta = delta;
          bestNode = node;
          bestPos = p;
        }
      }
    }

    if (bestNode !== -1) {
      currentPath.splice(bestPos, 0, bestNode);
      unvisitedIndices.delete(bestNode);
    } else {
      // Fallback para esgotar nós não conectados
      const remaining = Array.from(unvisitedIndices);
      currentPath.push(...remaining);
      break;
    }
  }

  // 2. REFINAMENTO LOCAL 1: Or-Opt / Node Relocation (1-Shift e 2-Shift com Penalidade 180°)
  // Muito eficiente para ATSP pois reposiciona nós sem inverter a mão das vias internas!
  let improved = true;
  let iterations = 0;
  const MAX_OR_OPT_ITERATIONS = 40;

  while (improved && iterations < MAX_OR_OPT_ITERATIONS) {
    improved = false;
    iterations++;

    // 1-Shift: Tenta reposicionar o nó i para a posição j
    for (let i = 1; i < currentPath.length; i++) {
      for (let j = 1; j < currentPath.length; j++) {
        if (i === j || i === j - 1) continue;

        const candidate = [...currentPath];
        const [movedNode] = candidate.splice(i, 1);
        const insertIdx = j > i ? j - 1 : j;
        candidate.splice(insertIdx, 0, movedNode);

        const currentCost = calculatePathCost(currentPath, durations, distances, coords);
        const candidateCost = calculatePathCost(candidate, durations, distances, coords);

        if (candidateCost + 1.0 < currentCost) {
          currentPath = candidate;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }

    // 2-Shift: Tenta reposicionar um bloco de 2 nós vizinhos
    if (!improved && currentPath.length > 4) {
      for (let i = 1; i < currentPath.length - 1; i++) {
        for (let j = 1; j < currentPath.length - 1; j++) {
          if (Math.abs(i - j) <= 2) continue;

          const candidate = [...currentPath];
          const movedBlock = candidate.splice(i, 2);
          const insertIdx = j > i ? j - 2 : j;
          candidate.splice(insertIdx, 0, ...movedBlock);

          const currentCost = calculatePathCost(currentPath, durations, distances, coords);
          const candidateCost = calculatePathCost(candidate, durations, distances, coords);

          if (candidateCost + 1.0 < currentCost) {
            currentPath = candidate;
            improved = true;
            break;
          }
        }
        if (improved) break;
      }
    }
  }

  // 3. REFINAMENTO LOCAL 2: 2-Opt Direcionado com Penalidade 180°
  // Testa inverter um trecho; se for mão dupla e encurtar, aceita;
  // se for mão única ou gerar manobra brusca de 180°, a penalidade rejeita automaticamente a inversão.
  let twoOptImproved = true;
  let twoOptIter = 0;
  const MAX_2OPT_ITERATIONS = 30;

  while (twoOptImproved && twoOptIter < MAX_2OPT_ITERATIONS) {
    twoOptImproved = false;
    twoOptIter++;

    for (let i = 1; i < currentPath.length - 1; i++) {
      for (let k = i + 1; k < currentPath.length; k++) {
        const candidate = [
          ...currentPath.slice(0, i),
          ...currentPath.slice(i, k + 1).reverse(),
          ...currentPath.slice(k + 1)
        ];

        const curCost = calculatePathCost(currentPath, durations, distances, coords);
        const candCost = calculatePathCost(candidate, durations, distances, coords);

        if (candCost + 1.0 < curCost) {
          currentPath = candidate;
          twoOptImproved = true;
          break;
        }
      }
      if (twoOptImproved) break;
    }
  }

  // Mapeia os índices de volta para os objetos hidrantes e calcula métricas
  const orderedHydrants = [];
  const drivingMetrics = {};

  for (let step = 1; step < currentPath.length; step++) {
    const prevIdx = currentPath[step - 1];
    const curIdx = currentPath[step];
    const targetHydrant = hydrants[curIdx - 1];

    if (!targetHydrant) continue;

    const distMeters = (distances && distances[prevIdx]) ? distances[prevIdx][curIdx] : null;
    let durSec = (durations && durations[prevIdx]) ? durations[prevIdx][curIdx] : null;

    // Se houve manobra de 180° neste passo (a partir do 2º passo na rota), adiciona a penalidade real na estimativa de tempo
    if (durSec !== null && step >= 2) {
      const beforeIdx = currentPath[step - 2];
      const maneuverPen = getManeuverPenaltySeconds(beforeIdx, prevIdx, curIdx, coords);
      if (maneuverPen > 0) {
        durSec += maneuverPen;
      }
    }

    const keys = [
      targetHydrant.codHidrante,
      targetHydrant._internalId,
      targetHydrant.nomHidrante
    ].filter(Boolean);

    keys.forEach(k => {
      drivingMetrics[String(k)] = {
        distanceMeters: distMeters !== null ? Math.round(distMeters) : null,
        durationSeconds: durSec !== null ? Math.round(durSec) : null,
        legFromPrevious: step !== 1,
        isTrafficMode: true
      };
    });

    orderedHydrants.push(targetHydrant);
  }

  return {
    route: orderedHydrants,
    drivingMetrics
  };
};

export const ROUTE_CHUNK_SIZE = 30;

/**
 * Consulta a API de Roteamento OSRM para um único lote (até 30 hidrantes)
 * e aplica o otimizador ATSP 2-Opt.
 */
export const fetchOSRMSingleChunk = async (hydrants, startLat, startLng, timeoutMs = 4000) => {
  if (!hydrants || hydrants.length === 0) {
    return { route: [], drivingMetrics: {}, isTrafficMode: false };
  }

  try {
    const coords = [
      [startLng, startLat],
      ...hydrants.map(h => [h.numLongitude, h.numLatitude])
    ];
    const coordsString = coords.map(c => `${c[0]},${c[1]}`).join(';');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(
      `https://router.project-osrm.org/table/v1/driving/${coordsString}?annotations=duration,distance`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`OSRM HTTP ${response.status}`);
    const data = await response.json();
    if (data.code !== 'Ok' || !data.durations) throw new Error('OSRM retornou payload sem matriz');

    const result = solveATSPRoute(hydrants, startLat, startLng, data.durations, data.distances || []);
    return {
      route: result.route,
      drivingMetrics: result.drivingMetrics,
      isTrafficMode: true
    };
  } catch (err) {
    console.warn('[RouteOptimizer] OSRM indisponível para o lote. Usando fallback instantâneo euclidiano.', err.message);
    const fallbackRoute = optimizeRouteEuclidean(hydrants, startLat, startLng);
    
    // Métricas estimadas em linha reta com penalidade de 40s para manobras de 180°
    const estimatedMetrics = {};
    let prevLat = startLat;
    let prevLng = startLng;
    let beforeLat = null;
    let beforeLng = null;
    fallbackRoute.forEach((h, idx) => {
      const distM = calculateDistanceMeters(prevLat, prevLng, h.numLatitude, h.numLongitude);
      let durSec = Math.round((distM / 1000 / 35) * 3600); // ~35 km/h média
      if (beforeLat !== null && beforeLng !== null && distM > 5) {
        const dBefore = calculateDistanceMeters(beforeLat, beforeLng, prevLat, prevLng);
        if (dBefore > 5) {
          const bIn = calculateBearing(beforeLat, beforeLng, prevLat, prevLng);
          const bOut = calculateBearing(prevLat, prevLng, h.numLatitude, h.numLongitude);
          const angle = calculateTurnAngle(bIn, bOut);
          if (angle >= 115) {
            const ratio = angle >= 140 ? 1 : (angle - 115) / (140 - 115);
            durSec += Math.round(U_TURN_PENALTY_SECONDS * ratio);
          }
        }
      }
      const metric = {
        distanceMeters: distM,
        durationSeconds: durSec,
        legFromPrevious: idx !== 0,
        isEstimated: true,
        isTrafficMode: false
      };
      const keys = [h.codHidrante, h.nomHidrante, h._internalId].filter(Boolean);
      keys.forEach(k => { estimatedMetrics[String(k)] = metric; });
      beforeLat = prevLat;
      beforeLng = prevLng;
      prevLat = h.numLatitude;
      prevLng = h.numLongitude;
    });

    return {
      route: fallbackRoute,
      drivingMetrics: estimatedMetrics,
      isTrafficMode: false
    };
  }
};

/**
 * Consulta a API de Roteamento OSRM com Matriz Direcionada de Tempos e Distâncias
 * e aplica o otimizador ATSP 2-Opt em lotes sequenciais de 30 em 30 hidrantes.
 * 
 * Regra Tática CBMDF:
 * Lotes de 30 em 30 hidrantes garantem estabilidade de requisição HTTP sem estourar limites
 * de URL do OSRM, permitindo roteamento de missões de qualquer porte (30, 60, 90, 100+ hidrantes).
 */
export const fetchOSRMAndOptimizeRoute = async (hydrants, startLat, startLng, timeoutMs = 4000, chunkSize = ROUTE_CHUNK_SIZE) => {
  if (!hydrants || hydrants.length === 0) {
    return { route: [], drivingMetrics: {}, isTrafficMode: false };
  }

  // Se a lista couber em um único lote (<= 30), executa diretamente
  if (hydrants.length <= chunkSize) {
    return await fetchOSRMSingleChunk(hydrants, startLat, startLng, timeoutMs);
  }

  // Para listas maiores que 30: particiona e calcula sequencialmente de 30 em 30
  const allOrderedRoute = [];
  const allDrivingMetrics = {};
  let isAnyTrafficMode = false;
  let currentStartLat = startLat;
  let currentStartLng = startLng;

  for (let i = 0; i < hydrants.length; i += chunkSize) {
    const chunk = hydrants.slice(i, i + chunkSize);
    const chunkResult = await fetchOSRMSingleChunk(chunk, currentStartLat, currentStartLng, timeoutMs);
    
    if (chunkResult.isTrafficMode) {
      isAnyTrafficMode = true;
    }

    const chunkRoute = (chunkResult.route && chunkResult.route.length > 0)
      ? chunkResult.route
      : optimizeRouteEuclidean(chunk, currentStartLat, currentStartLng);

    allOrderedRoute.push(...chunkRoute);
    Object.assign(allDrivingMetrics, chunkResult.drivingMetrics || {});

    // Próximo lote de 30 parte do último hidrante alcançado neste lote
    if (chunkRoute.length > 0) {
      const lastHydrant = chunkRoute[chunkRoute.length - 1];
      if (typeof lastHydrant.numLatitude === 'number' && typeof lastHydrant.numLongitude === 'number') {
        currentStartLat = lastHydrant.numLatitude;
        currentStartLng = lastHydrant.numLongitude;
      }
    }
  }

  return {
    route: allOrderedRoute,
    drivingMetrics: allDrivingMetrics,
    isTrafficMode: isAnyTrafficMode
  };
};
