const fs = require('fs');
const path = require('path');
const https = require('https');

const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const keyMatch = env.match(/GOOGLE_MAPS_API_KEY=(.*)/);
const geminiMatch = env.match(/GEMINI_API_KEY=(.*)/);
const GOOGLE_KEY = keyMatch ? keyMatch[1].trim().replace(/['"]/g, '') : '';
const GEMINI_KEY = geminiMatch ? geminiMatch[1].trim().replace(/['"]/g, '') : '';

async function downloadStreetView(lat, lng, heading, pitch = -15, fov = 75) {
  const url = `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${lat},${lng}&heading=${heading}&pitch=${pitch}&fov=${fov}&key=${GOOGLE_KEY}`;
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
  const prompt = "Você é um perito do Corpo de Bombeiros. Localize o HIDRANTE DE COLUNA AMARELO na calçada/estacionamento (claramente visível em primeiro plano ou entre os carros). Retorne JSON: {\"encontrado\": true/false, \"confianca\": <int>, \"descricao\": \"...\"}";
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
          resolve(JSON.parse(JSON.parse(data).candidates[0].content.parts[0].text));
        } catch (e) {
          resolve({ encontrado: false, confianca: 0 });
        }
      });
    });
    req.on('error', () => resolve({ encontrado: false, confianca: 0 }));
    req.write(payload);
    req.end();
  });
}

async function run() {
  // Vamos testar o panorama mais recente do estacionamento (2024 ou deslocado para frente)
  // Carro no estacionamento em frente:
  const positions = [
    { label: "Original", lat: -15.832211, lng: -47.878983, headings: [45, 60, 75, 90, 105] },
    { label: "Mais a frente (Leste)", lat: -15.832211, lng: -47.878930, headings: [30, 45, 60, 75, 90] },
    { label: "Norte", lat: -15.832149, lng: -47.879055, headings: [70, 85, 100, 115] }
  ];

  for (const pos of positions) {
    console.log(`\nTestando ${pos.label}: ${pos.lat}, ${pos.lng}`);
    for (const h of pos.headings) {
      const img = await downloadStreetView(pos.lat, pos.lng, h, -15, 75);
      const res = await askGemini(img.base64);
      console.log(`  Heading ${h}°: Encontrado=${res.encontrado} (${res.confianca}%) - ${res.descricao}`);
      if (res.encontrado && res.confianca >= 60) {
        console.log(`  🎯 ACHOU! Salvando foto final perfeita de LAS00004!`);
        fs.writeFileSync(path.join(__dirname, '..', 'public', 'hidrantes', 'lago_sul', 'LAS00004.jpeg'), img.buffer);
        fs.writeFileSync(path.join(__dirname, '..', 'public', 'hidrantes', 'lago_sul', 'LAS00004_hd.jpeg'), img.buffer);
        return;
      }
    }
  }
}

run();
