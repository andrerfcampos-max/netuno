const fs = require('fs');
const path = require('path');
const https = require('https');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const GOOGLE_KEY = (envContent.match(/GOOGLE_MAPS_API_KEY=(.*)/) || [])[1]?.trim().replace(/['"]/g, '');
const GEMINI_KEY = (envContent.match(/GEMINI_API_KEY=(.*)/) || [])[1]?.trim().replace(/['"]/g, '');

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
  const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&radius=50&source=outdoor&key=${GOOGLE_KEY}`;
  try {
    return await (await fetch(metaUrl)).json();
  } catch (err) {
    return null;
  }
}

async function downloadStreetView(lat, lng, heading, fov = 75, width = 800, height = 600, pitch = -10) {
  const url = `https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}&location=${lat},${lng}&heading=${heading}&pitch=${pitch}&fov=${fov}&key=${GOOGLE_KEY}`;
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({ buffer: buf, base64: buf.toString('base64') });
      });
    }).on('error', reject);
  });
}

async function askGemini(base64Image) {
  const prompt = "Você é um perito do Corpo de Bombeiros. Localize com precisão um HIDRANTE DE COLUNA (amarelo ou vermelho, metálico, no chão/calçada/canteiro). Retorne ESTRITAMENTE: {\"encontrado\": true/false, \"confianca\": <int 0-100>, \"centro_x\": <float 0-1>, \"justificativa\": \"...\"}";
  const payload = JSON.stringify({
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: base64Image } }] }],
    generationConfig: { response_mime_type: "application/json", temperature: 0.1 }
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_KEY}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(JSON.parse(data).candidates[0].content.parts[0].text);
          resolve(parsed);
        } catch (e) {
          resolve({ encontrado: false, confianca: 0, justificativa: "Falha de parsing" });
        }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ encontrado: false, confianca: 0, justificativa: "Timeout" }); });
    req.on('error', () => resolve({ encontrado: false, confianca: 0, justificativa: "Erro req" }));
    req.write(payload);
    req.end();
  });
}

async function runSingle(target) {
  console.log(`\n======================================================`);
  console.log(`🔎 TESTANDO: ${target.nom} (${target.end})`);
  console.log(`📍 GPS: ${target.lat}, ${target.lng} | Ref: ${target.ref}`);
  console.log(`======================================================`);

  const meta = await fetchMetadata(target.lat, target.lng);
  if (!meta || meta.status !== 'OK') {
    console.log(`⚠️ Sem cobertura Street View outdoor.`);
    return;
  }

  const carLat = meta.location.lat;
  const carLng = meta.location.lng;
  const baseHeading = calculateBearing(carLat, carLng, target.lat, target.lng);

  // Varredura de 4 ângulos chaves: Frontal, Oposto 180°, Lateral Direita +60°, Lateral Esquerda -60°
  const angles = [
    { label: "Frontal (0°)", h: baseHeading, p: -8 },
    { label: "Traseira (180°)", h: (baseHeading + 180) % 360, p: -8 },
    { label: "Lateral Direita (+60°)", h: (baseHeading + 60) % 360, p: -12 },
    { label: "Lateral Esquerda (-60°)", h: (baseHeading + 300) % 360, p: -12 }
  ];

  let best = null;

  for (const a of angles) {
    const img = await downloadStreetView(carLat, carLng, a.h, 75, 640, 640, a.p);
    const eval = await askGemini(img.base64);
    console.log(`   Angle ${a.label} (${a.h.toFixed(1)}°): Encontrado=${eval.encontrado} (${eval.confianca}%)`);
    if (eval.justificativa) console.log(`   📝 ${eval.justificativa}`);

    if (eval.encontrado && eval.confianca >= 60) {
      const corr = (eval.centro_x - 0.5) * 75;
      const finalH = (a.h + corr + 360) % 360;
      console.log(`   🎯 BINGO! Encontrado em ${finalH.toFixed(1)}°!`);
      best = { finalH, p: a.p, confianca: eval.confianca };
      break;
    }
  }

  if (best) {
    const finalStd = await downloadStreetView(carLat, carLng, best.finalH, 75, 800, 600, best.p);
    const finalHD = await downloadStreetView(carLat, carLng, best.finalH, 75, 1200, 900, best.p);
    fs.writeFileSync(path.join(OUTPUT_DIR, `${target.nom}.jpeg`), finalStd.buffer);
    fs.writeFileSync(path.join(OUTPUT_DIR, `${target.nom}_hd.jpeg`), finalHD.buffer);
    console.log(`✅ FOTOS SALVAS COM SUCESSO PARA ${target.nom}!`);
  } else {
    console.log(`❌ Não localizado com confiança na visada de rua.`);
  }
}

async function main() {
  const targets = [
    { nom: "LAS00100", lat: -15.846917, lng: -47.884861, end: "QI 15 CONJUNTO 08", ref: "ESQUINA DA ESCOLA CRIARTE" },
    { nom: "LAS00102", lat: -15.851556, lng: -47.877111, end: "QI 15 BLOCO C", ref: "COMÉRCIO LOCAL - IRIS MATERIAIS" },
    { nom: "LAS00112", lat: -15.821167, lng: -47.803222, end: "QI 29 CONJUNTO 04 CASA 02", ref: "FRENTE A CASA 02" },
    { nom: "LAS00116", lat: -15.858464, lng: -47.865406, end: "QI 19 CONJUNTO 01", ref: "FUNDOS DA CASA 15 / VIA EPDB" },
    { nom: "LAS00125", lat: -15.841465, lng: -47.829961, end: "QI 25 CONJUNTO 13 CASA 13", ref: "FRENTE A CASA 13" },
    { nom: "LAS00126", lat: -15.843592, lng: -47.830766, end: "QI 25 CONJUNTO 14 FUNDOS DA CASA 09", ref: "FUNDOS DA CASA 09" }
  ];

  for (const t of targets) {
    await runSingle(t);
  }
}

main();
