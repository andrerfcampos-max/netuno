const fs = require('fs');
const path = require('path');
const https = require('https');

const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const keyMatch = env.match(/GOOGLE_MAPS_API_KEY=(.*)/);
const geminiMatch = env.match(/GEMINI_API_KEY=(.*)/);
const GOOGLE_KEY = keyMatch ? keyMatch[1].trim().replace(/['"]/g, '') : '';
const GEMINI_KEY = geminiMatch ? geminiMatch[1].trim().replace(/['"]/g, '') : '';

function calculateBearing(lat1, lng1, lat2, lng2) {
  const toRad = (val) => (val * Math.PI) / 180;
  const toDeg = (val) => (val * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const radLat1 = toRad(lat1);
  const radLat2 = toRad(lat2);
  const y = Math.sin(dLng) * Math.cos(radLat2);
  const x = Math.cos(radLat1) * Math.sin(radLat2) - Math.cos(radLat1) * Math.cos(radLat2) * Math.cos(dLng);
  let brng = Math.atan2(y, x);
  return (toDeg(brng) + 360) % 360;
}

async function downloadStreetView(lat, lng, heading, pitch = -12, fov = 75) {
  const url = `https://maps.googleapis.com/maps/api/streetview?size=640x640&location=${lat},${lng}&heading=${heading}&pitch=${pitch}&fov=${fov}&key=${GOOGLE_KEY}`;
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
  const prompt = "Você é um perito militar do CBMDF. Analise a imagem e localize um hidrante de coluna (amarelo ou vermelho, metálico, no chão/calçada/canteiro entre carros ou na calçada). Retorne ESTRITAMENTE: {\"encontrado\": true/false, \"confianca\": <int 0-100>, \"centro_x\": <float 0-1>, \"descricao\": \"<detalhes do hidrante ou do obstaculo>\"}";
  const payload = JSON.stringify({
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: base64Image } }] }],
    generationConfig: { response_mime_type: "application/json", temperature: 0.1 }
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_KEY}`,
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
          resolve({ encontrado: false, confianca: 0, descricao: 'Erro' });
        }
      });
    });
    req.on('error', () => resolve({ encontrado: false, confianca: 0, descricao: 'Erro rede' }));
    req.write(payload);
    req.end();
  });
}

async function run() {
  const targetGps = { lat: -15.832194, lng: -47.878917 };
  const panos = [
    { label: "Original (vc0m...)", lat: -15.83221105301794, lng: -47.87898304338812 },
    { label: "Sul -15m (sNmW...)", lat: -15.83236583519459, lng: -47.87893771474764 },
    { label: "Oeste -15m (sxhu...)", lat: -15.83214918875307, lng: -47.87905499608457 },
    { label: "Norte +15m (CAoS...)", lat: -15.83217176442315, lng: -47.87884343733258 }
  ];

  for (const p of panos) {
    const baseHeading = calculateBearing(p.lat, p.lng, targetGps.lat, targetGps.lng);
    console.log(`\n================ PANORAMA: ${p.label} ================`);
    console.log(`Posição Carro: ${p.lat}, ${p.lng} | Azimute até GPS: ${baseHeading.toFixed(1)}°`);

    // Testar 4 ângulos: Frontal, Oposto (+180°), +60°, -60°
    const angles = [0, 60, -60, 180];
    for (const a of angles) {
      const h = (baseHeading + a + 360) % 360;
      const img = await downloadStreetView(p.lat, p.lng, h, -12, 75);
      const eval = await askGemini(img.base64);

      console.log(`   Angle ${h.toFixed(1)}° (${a >= 0 ? '+' : ''}${a}°): Encontrado: ${eval.encontrado} (${eval.confianca}%)`);
      console.log(`   📝 ${eval.descricao}`);

      if (eval.encontrado && eval.confianca >= 60) {
        console.log(`   🎯🎯🎯 BINGO! ENCONTRADO NO PANORAMA ${p.label} EM ${h.toFixed(1)}°!`);
        fs.writeFileSync(path.join(__dirname, '..', 'public', 'hidrantes', 'lago_sul', `LAS00004_achado.jpeg`), img.buffer);
      }
    }
  }
}

run();
