const fs = require('fs');
const path = require('path');
const https = require('https');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) process.env[match[1]] = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
  });
}

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'hidrantes', 'lago_sul');

function calculateBearing(lat1, lng1, lat2, lng2) {
  const toRad = (val) => (val * Math.PI) / 180;
  const toDeg = (val) => (val * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const radLat1 = toRad(lat1);
  const radLat2 = toRad(lat2);
  const y = Math.sin(dLng) * Math.cos(radLat2);
  const x = Math.cos(radLat1) * Math.sin(radLat2) - Math.sin(radLat1) * Math.cos(radLat2) * Math.cos(dLng);
  let brng = Math.atan2(y, x);
  return (toDeg(brng) + 360) % 360;
}

async function fetchMetadata(lat, lng, radius = 50) {
  const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&radius=${radius}&source=outdoor&key=${GOOGLE_MAPS_API_KEY}`;
  try {
    return await (await fetch(metaUrl)).json();
  } catch (err) {
    return null;
  }
}

async function downloadStreetView(carLat, carLng, heading, fov = 75, width = 800, height = 600, pitch = -10) {
  const url = `https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}&location=${carLat},${carLng}&heading=${heading}&pitch=${pitch}&fov=${fov}&key=${GOOGLE_MAPS_API_KEY}`;
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({ buffer, base64: buffer.toString('base64') });
      });
    }).on('error', reject);
  });
}

async function locateHydrantWithGemini(base64Image) {
  const prompt = "Você é um perito do Corpo de Bombeiros. Localize com precisão um hidrante de calçada/rua (geralmente AMARELO ou VERMELHO, metálico, cilíndrico de coluna). ATENÇÃO: Ele pode estar em tom esverdeado, cinza, envelhecido ou parcialmente oculto por vegetação/carros. Não existe hidrante subterrâneo no DF. Se encontrado, retorne a coordenada horizontal do centro_x (0.0 a 1.0) e confianca (0 a 100). ALÉM DISSO, forneça uma 'justificativa'.\n\nRetorne ESTRITAMENTE: {\"encontrado\": true/false, \"centro_x\": <float>, \"confianca\": <int>, \"justificativa\": \"...\"}";
  
  const payload = JSON.stringify({
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: base64Image } }] }],
    generationConfig: { response_mime_type: "application/json", temperature: 0.1 }
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(JSON.parse(data).candidates[0].content.parts[0].text));
        } catch (e) {
          resolve({ encontrado: false, confianca: 0, justificativa: "Erro ao parsear" });
        }
      });
    });
    req.on('error', () => resolve({ encontrado: false, confianca: 0, justificativa: "Erro de rede" }));
    req.write(payload);
    req.end();
  });
}

// Descobrir panoramas adjacentes ao longo da via para contornar obstáculos
async function discoverPanoramas(baseLat, baseLng) {
  const offsets = [
    { label: "Ponto Base", dLat: 0, dLng: 0 },
    { label: "Avanço 1 (+15m)", dLat: 0.00014, dLng: 0 },
    { label: "Avanço 2 (-15m)", dLat: -0.00014, dLng: 0 },
    { label: "Avanço 3 (Leste +15m)", dLat: 0, dLng: 0.00014 },
    { label: "Avanço 4 (Oeste -15m)", dLat: 0, dLng: -0.00014 }
  ];

  const panos = [];
  const seenPanoIds = new Set();

  for (const off of offsets) {
    const meta = await fetchMetadata(baseLat + off.dLat, baseLng + off.dLng, 35);
    if (meta && meta.status === 'OK' && !seenPanoIds.has(meta.pano_id)) {
      seenPanoIds.add(meta.pano_id);
      panos.push({
        label: off.label,
        panoId: meta.pano_id,
        lat: meta.location.lat,
        lng: meta.location.lng
      });
    }
  }
  return panos;
}

async function testHydrantMultiPano(target) {
  console.log(`\n======================================================`);
  console.log(`🎯 PROCESSANDO: ${target.nom} (${target.end})`);
  console.log(`📍 GPS: ${target.lat}, ${target.lng} | Ref: ${target.ref}`);
  console.log(`======================================================`);

  const panos = await discoverPanoramas(target.lat, target.lng);
  console.log(`🔍 Panoramas outdoor descobertos: ${panos.length}`);

  let bestResult = null;

  for (let pIdx = 0; pIdx < panos.length; pIdx++) {
    const pano = panos[pIdx];
    console.log(`\n--- Testando Panorama [${pIdx+1}/${panos.length}] (${pano.label}) ---`);
    console.log(`    Coordenadas Carro: ${pano.lat}, ${pano.lng}`);

    const baseHeading = calculateBearing(pano.lat, pano.lng, target.lat, target.lng);
    const sweeps = [
      { heading: baseHeading, label: "Frontal (0°)", pitch: -8 },
      { heading: (baseHeading + 180) % 360, label: "Traseira (180°)", pitch: -8 },
      { heading: (baseHeading + 60) % 360, label: "+60°", pitch: -12 },
      { heading: (baseHeading + 300) % 360, label: "-60°", pitch: -12 }
    ];

    for (const s of sweeps) {
      const img = await downloadStreetView(pano.lat, pano.lng, s.heading, 75, 640, 640, s.pitch);
      const eval = await locateHydrantWithGemini(img.base64);

      if (eval.encontrado && eval.confianca >= 60) {
        const correction = (eval.centro_x - 0.5) * 75;
        const finalHeading = (s.heading + correction + 360) % 360;
        console.log(`    🎯 ACHOU! Confiança: ${eval.confianca}% no ${pano.label} em ${finalHeading.toFixed(1)}°!`);
        console.log(`    📝 ${eval.justificativa}`);

        bestResult = {
          pano,
          finalHeading,
          pitch: s.pitch,
          confianca: eval.confianca,
          justificativa: eval.justificativa
        };
        break;
      }
    }

    if (bestResult && bestResult.confianca >= 80) break;
  }

  if (bestResult) {
    console.log(`\n📸 Salvando fotos FINAIS de alta resolução para ${target.nom}...`);
    const stdImg = await downloadStreetView(bestResult.pano.lat, bestResult.pano.lng, bestResult.finalHeading, 75, 800, 600, bestResult.pitch);
    const hdImg = await downloadStreetView(bestResult.pano.lat, bestResult.pano.lng, bestResult.finalHeading, 75, 1200, 900, bestResult.pitch);

    fs.writeFileSync(path.join(OUTPUT_DIR, `${target.nom}.jpeg`), stdImg.buffer);
    fs.writeFileSync(path.join(OUTPUT_DIR, `${target.nom}_hd.jpeg`), hdImg.buffer);
    console.log(`✅ ${target.nom} ATUALIZADO COM SUCESSO!`);
    return { nom: target.nom, status: "ACHOU", confianca: bestResult.confianca, justificativa: bestResult.justificativa };
  } else {
    console.log(`\n⚠️ ${target.nom}: Nenhum dos panoramas encontrou com confiança >= 60%. Mantendo registro.`);
    return { nom: target.nom, status: "NÃO ENCONTRADO" };
  }
}

async function main() {
  const targets = [
    { nom: "LAS00056", lat: -15.825556, lng: -47.804222, end: "QI 29 CONJUNTO 18 CASA 20", ref: "FUNDOS DA CASA 20" },
    { nom: "LAS00072", lat: -15.798389, lng: -47.808444, end: "QL 32 PARQUE ECOLÓGICO ERMIDA DOM BOSCO", ref: "ERMIDA DOM BOSCO" },
    { nom: "LAS00090", lat: -15.855917, lng: -47.908806, end: "ADM DO VI COMAR", ref: "PRÓXIMA À SERRALHERIA" },
    { nom: "LAS00100", lat: -15.846917, lng: -47.884861, end: "QI 15 CONJUNTO 08", ref: "ESQUINA DA ESCOLA CRIARTE" },
    { nom: "LAS00102", lat: -15.851556, lng: -47.877111, end: "QI 15 BLOCO C", ref: "COMÉRCIO LOCAL - IRIS MATERIAIS" },
    { nom: "LAS00112", lat: -15.821167, lng: -47.803222, end: "QI 29 CONJUNTO 04 CASA 02", ref: "FRENTE A CASA 02" },
    { nom: "LAS00116", lat: -15.858464, lng: -47.865406, end: "QI 19 CONJUNTO 01", ref: "FUNDOS DA CASA 15 / VIA EPDB" },
    { nom: "LAS00125", lat: -15.841465, lng: -47.829961, end: "QI 25 CONJUNTO 13 CASA 13", ref: "FRENTE A CASA 13" },
    { nom: "LAS00126", lat: -15.843592, lng: -47.830766, end: "QI 25 CONJUNTO 14 FUNDOS DA CASA 09", ref: "FUNDOS DA CASA 09" }
  ];

  const results = [];
  for (const t of targets) {
    const res = await testHydrantMultiPano(t);
    results.push(res);
  }

  console.log(`\n======================================================`);
  console.log(`📊 RELATÓRIO CONSOLIDADO STEP-AHEAD:`);
  console.log(JSON.stringify(results, null, 2));
  console.log(`======================================================\n`);
}

main();
