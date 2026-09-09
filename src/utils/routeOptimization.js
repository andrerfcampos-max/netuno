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

// Fallback Instantâneo Euclidiano (0ms - Nearest Neighbor)
export const optimizeRouteEuclidean = (hidrantes, startLat, startLng) => {
  if (!hidrantes || hidrantes.length === 0) return [];
  
  let unvisited = [...hidrantes];
  let route = [];
  let currentLat = startLat;
  let currentLng = startLng;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const h = unvisited[i];
      const dist = calculateDistanceMeters(currentLat, currentLng, h.numLatitude, h.numLongitude);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIdx = i;
      }
    }

    const nextHydrant = unvisited.splice(nearestIdx, 1)[0];
    route.push(nextHydrant);
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

// Custo total direcionado de um caminho
const calculatePathCost = (path, durations, distances) => {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    total += getDirectedCost(path[i], path[i + 1], durations, distances);
  }
  return total;
};

/**
 * Resolvedor ATSP (Asymmetric TSP)
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

  // Insere iterativamente os demais hidrantes na posição de menor aumento de custo direcionado
  while (unvisitedIndices.size > 0) {
    let bestNode = -1;
    let bestPos = -1;
    let minDelta = Infinity;

    for (const node of unvisitedIndices) {
      // Testa inserir no final
      const lastNode = currentPath[currentPath.length - 1];
      const appendCost = getDirectedCost(lastNode, node, durations, distances);
      if (appendCost < minDelta) {
        minDelta = appendCost;
        bestNode = node;
        bestPos = currentPath.length;
      }

      // Testa inserir no meio
      for (let p = 1; p < currentPath.length; p++) {
        const prev = currentPath[p - 1];
        const next = currentPath[p];
        const oldCost = getDirectedCost(prev, next, durations, distances);
        const newCost = getDirectedCost(prev, node, durations, distances) + 
                        getDirectedCost(node, next, durations, distances);
        const delta = newCost - oldCost;

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

  // 2. REFINAMENTO LOCAL 1: Or-Opt / Node Relocation (1-Shift e 2-Shift)
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

        const currentCost = calculatePathCost(currentPath, durations, distances);
        const candidateCost = calculatePathCost(candidate, durations, distances);

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

          const currentCost = calculatePathCost(currentPath, durations, distances);
          const candidateCost = calculatePathCost(candidate, durations, distances);

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

  // 3. REFINAMENTO LOCAL 2: 2-Opt Direcionado
  // Testa inverter um trecho; se for mão dupla e encurtar, aceita;
  // se for mão única, a penalidade do contrafluxo rejeita automaticamente a inversão.
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

        const curCost = calculatePathCost(currentPath, durations, distances);
        const candCost = calculatePathCost(candidate, durations, distances);

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
    const durSec = (durations && durations[prevIdx]) ? durations[prevIdx][curIdx] : null;

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

/**
 * Consulta a API de Roteamento OSRM com Matriz Direcionada de Tempos e Distâncias
 * e aplica o otimizador ATSP 2-Opt.
 */
export const fetchOSRMAndOptimizeRoute = async (hydrants, startLat, startLng, timeoutMs = 4000) => {
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
    console.warn('[RouteOptimizer] OSRM indisponível. Usando fallback instantâneo euclidiano.', err.message);
    const fallbackRoute = optimizeRouteEuclidean(hydrants, startLat, startLng);
    
    // Métricas estimadas em linha reta
    const estimatedMetrics = {};
    let prevLat = startLat;
    let prevLng = startLng;
    fallbackRoute.forEach((h, idx) => {
      const distM = calculateDistanceMeters(prevLat, prevLng, h.numLatitude, h.numLongitude);
      const metric = {
        distanceMeters: distM,
        durationSeconds: Math.round((distM / 1000 / 35) * 3600), // ~35 km/h média
        legFromPrevious: idx !== 0,
        isEstimated: true,
        isTrafficMode: false
      };
      const keys = [h.codHidrante, h.nomHidrante, h._internalId].filter(Boolean);
      keys.forEach(k => { estimatedMetrics[String(k)] = metric; });
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
