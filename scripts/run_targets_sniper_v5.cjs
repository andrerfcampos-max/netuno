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

async function fetchMetadata(lat, lng) {
  const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&radius=50&source=outdoor&key=${GOOGLE_MAPS_API_KEY}`;
  try {
    return await (await fetch(metaUrl)).json();
  } catch (err) {
    return null;
  }
}

async function downloadStreetView(carLat, carLng, heading, fov = 75, width = 800, height = 600, pitch = -8) {
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
  const prompt = "Você é um sistema de visão computacional de alta precisão do Corpo de Bombeiros. Analise a imagem fornecida e localize um hidrante de calçada/rua (geralmente de cor AMARELA ou VERMELHA, metálico, cilíndrico). ATENÇÃO: Ele pode estar cinza, envelhecido, com pintura descascada, pintado de outras cores para camuflagem ou parcialmente escondido na vegetação densa. Todos no DF são de coluna e formato cilíndrico (não há hidrante de caixa subterrânea). Se encontrado, retorne a coordenada horizontal exata do centro do hidrante na imagem, e uma nota de confiança de 0 a 100. ALÉM DISSO, forneça uma 'justificativa' explicando brevemente o que você detectou na imagem que te fez ter certeza de que é (ou não é) um hidrante de coluna e não um objeto qualquer ou hidrante subterrâneo.\n\nRetorne ESTRITAMENTE um JSON válido neste formato:\n{\"encontrado\": true/false, \"centro_x\": <float entre 0.0 e 1.0>, \"confianca\": <int>, \"justificativa\": \"<sua explicacao detalhada>\"}\n\nSó marque como encontrado se a confiança for >= 60.";
  
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
          const json = JSON.parse(data);
          resolve(JSON.parse(json.candidates[0].content.parts[0].text));
        } catch (e) {
          resolve({ encontrado: false, confianca: 0, justificativa: "Erro ao parsear" });
        }
      });
    });
    req.on('error', () => resolve({ encontrado: false, confianca: 0, justificativa: "Erro rede" }));
    req.write(payload);
    req.end();
  });
}

async function smartScan360(carLat, carLng, gpsLat, gpsLng, nom) {
  const baseHeading = calculateBearing(carLat, carLng, gpsLat, gpsLng);
  const sweeps = [
    { heading: baseHeading, label: "Frontal (0°)", pitch: -8 },
    { heading: (baseHeading + 180) % 360, label: "Traseira Oposta (180°)", pitch: -8 },
    { heading: (baseHeading + 60) % 360, label: "Lateral Direita (+60°)", pitch: -12 },
    { heading: (baseHeading + 300) % 360, label: "Lateral Esquerda (-60°)", pitch: -12 },
    { heading: (baseHeading + 120) % 360, label: "Flanco Direita (+120°)", pitch: -10 },
    { heading: (baseHeading + 240) % 360, label: "Flanco Esquerda (-120°)", pitch: -10 }
  ];

  for (const s of sweeps) {
    console.log(`   📸 [Sniper 360 v5] Varrendo ${s.label} (${s.heading.toFixed(1)}°, Pitch=${s.pitch}°)...`);
    const img = await downloadStreetView(carLat, carLng, s.heading, 75, 640, 640, s.pitch);
    const eval = await locateHydrantWithGemini(img.base64);

    if (eval.encontrado && eval.confianca >= 60 && eval.centro_x !== undefined) {
      const correction = (eval.centro_x - 0.5) * 75;
      const finalHeading = (s.heading + correction + 360) % 360;
      console.log(`   🎯 ACHOU! Confiança: ${eval.confianca}%. Mira Final: ${finalHeading.toFixed(1)}°`);
      console.log(`   📝 Justificativa: ${eval.justificativa}`);
      return { success: true, finalHeading, pitch: s.pitch };
    } else {
      console.log(`   ❌ Não detectou (${s.label}) - Conf: ${eval.confianca}%`);
    }
  }
  return { success: false, finalHeading: baseHeading, pitch: -8 };
}

async function runTargets() {
  const targets = [
    { nom: 'LAS00004', lat: -15.832194, lng: -47.878917 },
    { nom: 'LAS00009', lat: -15.862944, lng: -47.874694 },
    { nom: 'LAS00010', lat: -15.862472, lng: -47.875667 }
  ];

  for (const t of targets) {
    console.log(`\n================== PROCESSANDO ${t.nom} ==================`);
    const meta = await fetchMetadata(t.lat, t.lng);
    if (!meta || meta.status !== 'OK') {
      console.log(`⚠️ Sem Street View outdoor para ${t.nom}`);
      continue;
    }

    const carLat = meta.location.lat;
    const carLng = meta.location.lng;
    const scan = await smartScan360(carLat, carLng, t.lat, t.lng, t.nom);

    console.log(`📸 Salvando foto final de alta resolução com mira otimizada (${scan.finalHeading.toFixed(1)}°)...`);
    const finalStandard = await downloadStreetView(carLat, carLng, scan.finalHeading, 75, 800, 600, scan.pitch);
    const finalHD = await downloadStreetView(carLat, carLng, scan.finalHeading, 75, 1200, 900, scan.pitch);

    fs.writeFileSync(path.join(OUTPUT_DIR, `${t.nom}.jpeg`), finalStandard.buffer);
    fs.writeFileSync(path.join(OUTPUT_DIR, `${t.nom}_hd.jpeg`), finalHD.buffer);
    console.log(`✅ ${t.nom}.jpeg e _hd.jpeg atualizados com sucesso!`);
  }
}

runTargets();
