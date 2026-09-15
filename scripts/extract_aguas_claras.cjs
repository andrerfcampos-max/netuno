const fs = require('fs');
const path = require('path');
const https = require('https');
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

if (!GOOGLE_MAPS_API_KEY || !GEMINI_API_KEY) {
  console.error('❌ ERRO: Chaves GOOGLE_MAPS_API_KEY ou GEMINI_API_KEY não encontradas no .env!');
  process.exit(1);
}

const DB_PATH_PUBLIC = path.join(__dirname, '..', 'public', 'base-de-dados.xlsx');
const DB_PATH_ROOT = path.join(__dirname, '..', 'base-de-dados.xlsx');
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'hidrantes', 'aguas_claras');

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

// Visão Computacional Sniper com Gemini 3.5 Flash Lite
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

  let retryCount = 0;
  while (true) {
    try {
      const result = await new Promise((resolve, reject) => {
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
      const isRateLimit = err.message.includes('Quota exceeded') || 
                          err.message.includes('rate-limit') || 
                          err.message.includes('high demand') || 
                          err.message.includes('429');
      if (isRateLimit) {
        const match = err.message.match(/Please retry in ([\d.]+)s/);
        const waitSec = match ? Math.ceil(parseFloat(match[1])) + 4 : 45;
        console.log(`   ⏳ Cota do minuto atingida. Aguardando ${waitSec}s para renovar a cota gratuita do Google...`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
        console.log(`   🔄 Retomando tentativa com cota renovada...`);
        continue;
      }

      // Outro erro transitório (503, etc)
      retryCount++;
      if (retryCount <= 3) {
        console.log(`   ⚠️ Erro na IA (${err.message}). Retentando em 6s (Tentativa ${retryCount}/3)...`);
        await new Promise(r => setTimeout(r, 6000));
        continue;
      }

      console.log(`   ⚠️ IA indisponível após 3 tentativas (${err.message}). Prosseguindo com enquadramento GPS padrão.`);
      return { encontrado: false };
    }
  }
}

// Download do Street View em Alta Resolução (800x600)
async function downloadStreetView(carLat, carLng, heading, fov, width = 800, height = 600) {
  const url = `https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}&location=${carLat},${carLng}&heading=${heading}&pitch=-5&fov=${fov}&key=${GOOGLE_MAPS_API_KEY}`;
  
  return new Promise((resolve, reject) => {
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

async function runAguasClaras() {
  console.log("==========================================================");
  console.log("🎯 PIPELINE STREET VIEW SNIPER - ÁGUAS CLARAS");
  console.log("==========================================================\n");

  const workbook = xlsx.readFile(DB_PATH_PUBLIC);
  const sheetName = workbook.SheetNames[0];
  const allRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  // Filtrar os hidrantes de Águas Claras
  const aguasClarasHydrants = allRows.filter(r => 
    (r.nomHidrante || '').toUpperCase().startsWith('ACL') ||
    (r.dscLocalidade || '').toUpperCase().includes('CLARAS') ||
    (r.cidade || '').toUpperCase().includes('CLARAS')
  );

  console.log(`📍 Localizados ${aguasClarasHydrants.length} hidrantes em Águas Claras.\n`);

  const updatedPhotosMap = {};
  let successCount = 0;
  let skippedCount = 0;
  let noCoverageCount = 0;

  for (let i = 0; i < aguasClarasHydrants.length; i++) {
    const h = aguasClarasHydrants[i];
    const cod = h.codHidrante;
    const nom = h.nomHidrante || `ACL_${cod}`;
    const fileName = `${nom}.jpeg`;
    const filePath = path.join(OUTPUT_DIR, fileName);
    const relativeUrl = `/hidrantes/aguas_claras/${fileName}`;

    console.log(`🔎 [${i+1}/${aguasClarasHydrants.length}] Processando: ${nom} (Cód: ${cod})`);
    console.log(`   Endereço: ${h.dscEndereco || 'Sem endereço'} | GPS: ${h.numLatitude}, ${h.numLongitude}`);

    // Se já existir imagem válida local, registra e pula o download para economia de cota
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 5000) {
      console.log(`   ⚡ Foto já existente localmente (${fs.statSync(filePath).size} bytes). Reutilizando...`);
      updatedPhotosMap[cod] = relativeUrl;
      updatedPhotosMap[nom] = relativeUrl;
      skippedCount++;
      continue;
    }

    try {
      // 1. Obter metadados da câmera mais próxima
      const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${h.numLatitude},${h.numLongitude}&key=${GOOGLE_MAPS_API_KEY}`;
      const metaRes = await (await fetch(metaUrl)).json();

      if (metaRes.status !== 'OK') {
        console.log(`   ⚠️ Sem cobertura do Street View neste ponto (Status: ${metaRes.status}).`);
        noCoverageCount++;
        continue;
      }

      const carLat = metaRes.location.lat;
      const carLng = metaRes.location.lng;

      // 2. Azimute inicial (apontando para o GPS cadastrado)
      const baseHeading = calculateBearing(carLat, carLng, h.numLatitude, h.numLongitude);
      const SCAN_FOV = 100;

      console.log(`   📸 Fase 1: Tirando foto de varredura ampla (FOV=${SCAN_FOV}, Ângulo=${Math.round(baseHeading)}°)...`);
      const scanImage = await downloadStreetView(carLat, carLng, baseHeading, SCAN_FOV, 640, 640);

      console.log(`   🧠 Fase 2: IA Sniper rastreando hidrante amarelo...`);
      const aiResult = await locateHydrantWithGemini(scanImage.base64);

      let finalHeading = baseHeading;
      if (aiResult.encontrado && aiResult.centro_x !== undefined) {
        const correctionOffset = (aiResult.centro_x - 0.5) * SCAN_FOV;
        finalHeading = (baseHeading + correctionOffset + 360) % 360;
        console.log(`   🤖 IA encontrou em X=${aiResult.centro_x.toFixed(2)}! Corrigindo mira em ${Math.round(correctionOffset)}° (Novo Ângulo: ${Math.round(finalHeading)}°).`);
      } else {
        console.log(`   ℹ️ Hidrante não detectado com precisão na varredura. Usando enquadramento padrão no GPS.`);
      }

      // 3. Foto Oficial em Alta Resolução (800x600, FOV=75 para foco tático na calçada)
      console.log(`   📸 Fase 3: Bate foto final de alta resolução (800x600, FOV=75)...`);
      const finalImage = await downloadStreetView(carLat, carLng, finalHeading, 75, 800, 600);

      fs.writeFileSync(filePath, finalImage.buffer);

      updatedPhotosMap[cod] = relativeUrl;
      updatedPhotosMap[nom] = relativeUrl;
      successCount++;

      console.log(`   ✅ SUCESSO! Foto salva em: public/hidrantes/aguas_claras/${fileName}`);
      console.log(`   🌐 Link relativo: ${relativeUrl}\n`);

    } catch (error) {
      console.error(`   ❌ Erro ao processar ${nom}:`, error.message);
    }

    // Intervalo de respiro anti-rate-limit (mínimo 5s conforme diretrizes)
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // 4. Gravação Dupla no Banco de Dados (base-de-dados.xlsx e public/base-de-dados.xlsx)
  console.log("\n💾 Sincronizando base de dados com as novas fotos...");
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

  // 5. Atualizar JSON e CSV oficiais via script canônico
  console.log("\n🔄 Executando scripts/export_clean_database.cjs para atualizar JSON e CSV...");
  try {
    const { execSync } = require('child_process');
    execSync('node scripts/export_clean_database.cjs', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  } catch (err) {
    console.error('   ⚠️ Falha ao executar export_clean_database.cjs:', err.message);
  }

  console.log(`\n==========================================================`);
  console.log(`🎉 EXTRAÇÃO DE ÁGUAS CLARAS CONCLUÍDA!`);
  console.log(`   📸 Novas fotos capturadas: ${successCount}`);
  console.log(`   ⚡ Fotos já existentes reutilizadas: ${skippedCount}`);
  console.log(`   ⚠️ Sem cobertura Street View: ${noCoverageCount}`);
  console.log(`   💾 Registros atualizados na base: ${countUpdated}`);
  console.log(`==========================================================\n`);
}

runAguasClaras();
