const fs = require('fs');
const path = require('path');
const https = require('https');

const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const keyMatch = env.match(/GOOGLE_MAPS_API_KEY=(.*)/);
const geminiMatch = env.match(/GEMINI_API_KEY=(.*)/);
const GOOGLE_KEY = keyMatch ? keyMatch[1].trim().replace(/['"]/g, '') : '';
const GEMINI_KEY = geminiMatch ? geminiMatch[1].trim().replace(/['"]/g, '') : '';

async function downloadStreetView(lat, lng, heading, pitch = -5, fov = 90) {
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

async function askGemini(base64Image, headingLabel) {
  const prompt = `Você é um analista militar do Corpo de Bombeiros. Procure um HIDRANTE DE COLUNA urbano (amarelo ou vermelho, metálico, cilíndrico, no nível da calçada/meio-fio). 
Retorne ESTRITAMENTE este JSON:
{"encontrado": true/false, "confianca": <0-100>, "centro_x": <0.0-1.0>, "descricao": "<o que exatamente está visível na calçada/meio-fio>"}`;

  const payload = JSON.stringify({
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: "image/jpeg", data: base64Image } }
      ]
    }],
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
          const parsed = JSON.parse(json.candidates[0].content.parts[0].text);
          resolve(parsed);
        } catch (e) {
          resolve({ encontrado: false, confianca: 0, descricao: 'Erro parse' });
        }
      });
    });
    req.on('error', () => resolve({ encontrado: false, confianca: 0, descricao: 'Erro req' }));
    req.write(payload);
    req.end();
  });
}

async function testHydrant(nom, carLat, carLng, initialHeading) {
  console.log(`\n================== TESTE 360°: ${nom} ==================`);
  console.log(`Carro Pano: ${carLat}, ${carLng} | Bearing Inicial: ${initialHeading.toFixed(1)}°`);
  
  // Testar 6 fatias de 60 graus (360 cobertura contínua) com pitch normal e pitch mais inclinado para o chão (-15)
  const headings = [0, 60, 120, 180, 240, 300];
  
  for (const h of headings) {
    const angle = (initialHeading + h) % 360;
    // Testa pitch -5 (calçada média) e pitch -15 (calçada perto dos pés)
    const imgNormal = await downloadStreetView(carLat, carLng, angle, -8, 75);
    const evalNormal = await askGemini(imgNormal.base64, `${angle.toFixed(0)}°`);
    
    console.log(`📐 Heading ${angle.toFixed(1)}° (+${h}° do base):`);
    console.log(`   👉 Encontrado: ${evalNormal.encontrado} (${evalNormal.confianca}%)`);
    console.log(`   📝 ${evalNormal.descricao}`);
    
    if (evalNormal.encontrado && evalNormal.confianca >= 60) {
      console.log(`   🎯 ACHOU COM SUCESSO EM ${angle.toFixed(1)}°!`);
      const outPath = path.join(__dirname, '..', 'public', 'hidrantes', 'lago_sul', `${nom}_encontrado_${angle.toFixed(0)}.jpeg`);
      fs.writeFileSync(outPath, imgNormal.buffer);
    }
  }
}

async function main() {
  // LAS00009
  await testHydrant('LAS00009', -15.86289510008779, -47.87469094649013, 183.4);
  // LAS00010
  await testHydrant('LAS00010', -15.86245994977843, -47.87562694260084, 252.6);
  // LAS00004
  await testHydrant('LAS00004', -15.83221105301794, -47.87898304338812, 75.0);
}

main();
