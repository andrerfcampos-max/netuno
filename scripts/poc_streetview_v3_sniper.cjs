const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Carrega variáveis do .env local
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      process.env[match[1]] = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
    }
  });
}

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const DB_PATH = path.join(__dirname, '..', 'public', 'base-de-dados.xlsx');
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'poc_hidrantes_v3');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Matemática do Azimute (Direção Base)
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

// IA - Função Sniper para achar o X,Y com retry infinito inteligente para Rate Limit
async function locateHydrantWithGemini(base64Image) {
  const payload = JSON.stringify({
    contents: [{
      parts: [
        { text: "Você é um sistema de visão computacional de alta precisão. Analise a imagem fornecida e localize um hidrante AMARELO de calçada.\n\nSe encontrado, retorne a coordenada horizontal exata do centro do hidrante na imagem.\n\nRetorne ESTRITAMENTE um JSON válido neste formato:\n{\"encontrado\": true/false, \"centro_x\": <float entre 0.0 e 1.0>}\n\nExemplo: Se o hidrante estiver exatamente no meio da imagem, centro_x é 0.5. Se estiver colado na borda esquerda, é 0.0. Na borda direita, 1.0." },
        { inline_data: { mime_type: "image/jpeg", data: base64Image } }
      ]
    }],
    generationConfig: {
      response_mime_type: "application/json",
      temperature: 0.1
    }
  });

  while (true) {
    try {
      const result = await new Promise((resolve, reject) => {
        const https = require('https');
        const options = {
          hostname: 'generativelanguage.googleapis.com',
          path: `/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          }
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (json.error) {
                return reject(new Error(json.error.message || JSON.stringify(json.error)));
              }
              const text = json.candidates[0].content.parts[0].text;
              resolve(JSON.parse(text));
            } catch (e) {
              reject(new Error("Erro ao parsear resposta: " + data));
            }
          });
        });

        req.on('error', (e) => reject(e));
        req.write(payload);
        req.end();
      });

      return result;
    } catch (err) {
      const isRateLimit = err.message.includes('Quota exceeded') || err.message.includes('rate-limit') || err.message.includes('high demand') || err.message.includes('429');
      if (isRateLimit) {
        // Extrai os segundos exatos que o Google pede para esperar
        const match = err.message.match(/Please retry in ([\d.]+)s/);
        const waitSec = match ? Math.ceil(parseFloat(match[1])) + 3 : 45;
        console.log(`   ⏳ Cota do minuto atingida. Aguardando ${waitSec}s para renovar a cota gratuita do Google...`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
        console.log(`   🔄 Retomando tentativa com cota renovada...`);
      } else {
        throw err;
      }
    }
  }
}

// Baixar Imagem do Maps
async function downloadStreetView(carLat, carLng, heading, fov) {
  const url = `https://maps.googleapis.com/maps/api/streetview?size=640x640&location=${carLat},${carLng}&heading=${heading}&pitch=-5&fov=${fov}&key=${GOOGLE_MAPS_API_KEY}`;
  
  return new Promise((resolve, reject) => {
    const https = require('https');
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({ buffer, base64: buffer.toString('base64') });
      });
    }).on('error', reject);
  });
}

async function runPoCV3() {
  console.log("==================================================");
  console.log("🎯 INICIANDO PoC V3 (MODO SNIPER) - NETUNO");
  console.log("==================================================\n");

  const workbook = xlsx.readFile(DB_PATH);
  const hidrantes = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  
  // Pegando os PRÓXIMOS 20 hidrantes (índices 10 a 30)
  const targetHydrants = hidrantes
    .filter(h => h.numLatitude && h.numLongitude && h.numLatitude < 0)
    .slice(10, 30);

  for (let i = 0; i < targetHydrants.length; i++) {
    const h = targetHydrants[i];
    const id = h.codHidrante || `Hidrante-Lote2-${i+1}`;
    console.log(`\n🔎 [${i+1}/${targetHydrants.length}] Alvo: ${id}`);

    try {
      // 1. Onde o carro passou?
      const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${h.numLatitude},${h.numLongitude}&key=${GOOGLE_MAPS_API_KEY}`;
      const metaRes = await (await fetch(metaUrl)).json();

      if (metaRes.status !== 'OK') {
        console.log(`   ⚠️ Sem cobertura do Street View.`);
        continue;
      }

      // 2. Azimute Básico (Apontando pro GPS cadastrado)
      const baseHeading = calculateBearing(metaRes.location.lat, metaRes.location.lng, h.numLatitude, h.numLongitude);
      const SCAN_FOV = 100; // Visão periférica aberta para varrer a rua

      console.log(`   📸 Fase 1: Tirando foto de varredura (FOV=${SCAN_FOV}, Ângulo=${Math.round(baseHeading)}°)...`);
      const scanImage = await downloadStreetView(metaRes.location.lat, metaRes.location.lng, baseHeading, SCAN_FOV);

      console.log(`   🧠 Fase 2: IA Sniper rastreando o hidrante amarelo...`);
      const aiResult = await locateHydrantWithGemini(scanImage.base64);

      if (aiResult.encontrado && aiResult.centro_x !== undefined) {
        console.log(`   🤖 IA encontrou! Posição X = ${aiResult.centro_x.toFixed(2)}`);
        
        // 3. O Pulo do Gato: Matemática de Centralização
        const correctionOffset = (aiResult.centro_x - 0.5) * SCAN_FOV;
        const perfectHeading = (baseHeading + correctionOffset + 360) % 360;

        console.log(`   ⚙️ Corrigindo mira em ${Math.round(correctionOffset)} graus para enquadrar no centro (Novo Ângulo: ${Math.round(perfectHeading)}°)...`);

        // 4. Bater a foto perfeita (Zoom fechado FOV=75 para focar na fachada)
        const FINAL_FOV = 75;
        const finalImage = await downloadStreetView(metaRes.location.lat, metaRes.location.lng, perfectHeading, FINAL_FOV);

        const filePath = path.join(OUTPUT_DIR, `${id}_V3_Sniper.jpeg`);
        fs.writeFileSync(filePath, finalImage.buffer);
        console.log(`   ✅ SUCESSO! Foto perfeitamente enquadrada salva: ${id}_V3_Sniper.jpeg`);
      } else {
        console.log(`   ❌ A IA rastreou a calçada e não encontrou hidrantes amarelos visíveis.`);
      }

    } catch (error) {
      console.error(`   ❌ Erro ao processar ${id}:`, error.message);
    }

    // Intervalo de segurança anti-rate-limit: 6 segundos para ficar bem abaixo de 15 RPM
    await new Promise(resolve => setTimeout(resolve, 6000));
  }
  
  console.log("\n==================================================");
  console.log("🎉 PoC V3 CONCLUÍDA! Confira a pasta 'public/poc_hidrantes_v3'");
  console.log("==================================================");
}

runPoCV3();
