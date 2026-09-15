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

const DB_PATH_PUBLIC = path.join(__dirname, '..', 'public', 'base-de-dados.xlsx');
const DB_PATH_ROOT = path.join(__dirname, '..', 'base-de-dados.xlsx');
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'hidrantes', 'arniqueira');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Azimute Carro -> Hidrante
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

// Visão Computacional Sniper com Gemini 3.5 Flash
async function locateHydrantWithGemini(base64Image) {
  const payload = JSON.stringify({
    contents: [{
      parts: [
        { text: "Você é um sistema de visão computacional de alta precisão do Corpo de Bombeiros. Analise a imagem fornecida e localize um hidrante AMARELO de calçada/rua.\n\nSe encontrado, retorne a coordenada horizontal exata do centro do hidrante na imagem.\n\nRetorne ESTRITAMENTE um JSON válido neste formato:\n{\"encontrado\": true/false, \"centro_x\": <float entre 0.0 e 1.0>}\n\nExemplo: Se o hidrante estiver no meio da imagem, centro_x é 0.5. Se estiver colado na borda esquerda, é 0.0. Na borda direita, 1.0." },
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
          path: `/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
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

// Download do Street View em Alta Resolução (800x600)
async function downloadStreetView(carLat, carLng, heading, fov, width = 800, height = 600) {
  const url = `https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}&location=${carLat},${carLng}&heading=${heading}&pitch=-5&fov=${fov}&key=${GOOGLE_MAPS_API_KEY}`;
  
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

async function runMVPArniqueiras() {
  console.log("==========================================================");
  console.log("🎯 PILOTO MVP STREET VIEW SNIPER - ARNIQUEIRAS (4 HIDRANTES)");
  console.log("==========================================================\n");

  const workbook = xlsx.readFile(DB_PATH_PUBLIC);
  const sheetName = workbook.SheetNames[0];
  const allRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  // Filtrar os 4 hidrantes de Arniqueira
  const arniqueiraHydrants = allRows.filter(r => 
    (r.dscLocalidade || '').toUpperCase().includes('ARN') || 
    (r.nomHidrante || '').toUpperCase().startsWith('ARN')
  );

  console.log(`📍 Localizados ${arniqueiraHydrants.length} hidrantes em Arniqueira.\n`);

  const updatedPhotosMap = {};

  for (let i = 0; i < arniqueiraHydrants.length; i++) {
    const h = arniqueiraHydrants[i];
    const cod = h.codHidrante;
    const nom = h.nomHidrante || `ARN_${cod}`;
    console.log(`🔎 [${i+1}/${arniqueiraHydrants.length}] Processando: ${nom} (Cód: ${cod})`);
    console.log(`   Endereço: ${h.dscEndereco || 'Sem endereço'}`);

    try {
      // 1. Obter metadados da câmera mais próxima
      const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${h.numLatitude},${h.numLongitude}&key=${GOOGLE_MAPS_API_KEY}`;
      const metaRes = await (await fetch(metaUrl)).json();

      if (metaRes.status !== 'OK') {
        console.log(`   ⚠️ Sem cobertura do Street View neste ponto (Status: ${metaRes.status}).`);
        continue;
      }

      const carLat = metaRes.location.lat;
      const carLng = metaRes.location.lng;

      // 2. Azimute inicial (apontando pro GPS cadastrado ou override validado)
      const HEADING_OVERRIDES = {
        'ARN00004': { heading: 201, pitch: -10, fov: 55 },
        '5289': { heading: 201, pitch: -10, fov: 55 }
      };

      const override = HEADING_OVERRIDES[nom] || HEADING_OVERRIDES[cod];
      let finalHeading;
      let finalFov = 75;

      if (override) {
        console.log(`   🎯 Override validado manualmente detectado: Heading=${override.heading}°, Pitch=${override.pitch}°, FOV=${override.fov}°`);
        finalHeading = override.heading;
        finalFov = override.fov || 75;
      } else {
        const baseHeading = calculateBearing(carLat, carLng, h.numLatitude, h.numLongitude);
        const SCAN_FOV = 100;

        console.log(`   📸 Fase 1: Tirando foto de varredura ampla (FOV=${SCAN_FOV}, Ângulo=${Math.round(baseHeading)}°)...`);
        const scanImage = await downloadStreetView(carLat, carLng, baseHeading, SCAN_FOV, 640, 640);

        console.log(`   🧠 Fase 2: IA Sniper rastreando hidrante amarelo...`);
        const aiResult = await locateHydrantWithGemini(scanImage.base64);

        finalHeading = baseHeading;
        if (aiResult.encontrado && aiResult.centro_x !== undefined) {
          const correctionOffset = (aiResult.centro_x - 0.5) * SCAN_FOV;
          finalHeading = (baseHeading + correctionOffset + 360) % 360;
          console.log(`   🤖 IA encontrou em X=${aiResult.centro_x.toFixed(2)}! Corrigindo mira em ${Math.round(correctionOffset)}° (Novo Ângulo: ${Math.round(finalHeading)}°).`);
        } else {
          console.log(`   ℹ️ Hidrante não detectado com precisão na varredura. Usando enquadramento padrão no GPS.`);
        }
      }

      // 3. Foto Oficial em Alta Resolução (800x600, FOV tático para foco na calçada)
      console.log(`   📸 Fase 3: Bate foto final de alta resolução (800x600, FOV=${finalFov})...`);
      const finalImage = await downloadStreetView(carLat, carLng, finalHeading, finalFov, 800, 600);

      const fileName = `${nom}.jpeg`;
      const filePath = path.join(OUTPUT_DIR, fileName);
      fs.writeFileSync(filePath, finalImage.buffer);

      const relativeUrl = `/hidrantes/arniqueira/${fileName}`;
      updatedPhotosMap[cod] = relativeUrl;
      updatedPhotosMap[nom] = relativeUrl;

      console.log(`   ✅ SUCESSO! Foto salva em: public/hidrantes/arniqueira/${fileName}`);
      console.log(`   🌐 Link relativo: ${relativeUrl}\n`);

    } catch (error) {
      console.error(`   ❌ Erro ao processar ${nom}:`, error.message);
    }

    // Intervalo de respiro anti-rate-limit
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // 4. Gravação Dupla no Banco de Dados (base-de-dados.xlsx e public/base-de-dados.xlsx)
  console.log("💾 Atualizando base de dados com as fotos de perfil...");
  let countUpdated = 0;

  const updatedAllRows = allRows.map(row => {
    const photoUrl = updatedPhotosMap[row.codHidrante] || updatedPhotosMap[row.nomHidrante];
    if (photoUrl) {
      countUpdated++;
      return {
        ...row,
        fotoPerfil: photoUrl
      };
    }
    return row;
  });

  const newSheet = xlsx.utils.json_to_sheet(updatedAllRows);
  const newWorkbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(newWorkbook, newSheet, sheetName);

  xlsx.writeFile(newWorkbook, DB_PATH_PUBLIC);
  console.log(`   ✅ Atualizado: ${DB_PATH_PUBLIC}`);

  if (fs.existsSync(DB_PATH_ROOT)) {
    xlsx.writeFile(newWorkbook, DB_PATH_ROOT);
    console.log(`   ✅ Atualizado: ${DB_PATH_ROOT}`);
  }

  console.log(`\n🎉 MVP ARNIQUEIRAS CONCLUÍDO! ${countUpdated} registros atualizados com fotoPerfil.`);
}

runMVPArniqueiras();
