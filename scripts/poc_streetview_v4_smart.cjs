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
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'poc_hidrantes_v4');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Códigos problemáticos para a POC
const TARGET_CODES = [
  'ACL00046', 'ACL00045', 'ACL00043', 'ACL00040', 'ACL00039', 
  'ACL00028', 'ACL00026', 'ACL00025', 'ACL00020', 'ACL00014', 
  'ACL00009', 'ACL00006', 'ACL00005', 'ACL00004'
];

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
  const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&radius=50&key=${GOOGLE_MAPS_API_KEY}`;
  try {
    const res = await (await fetch(metaUrl)).json();
    return res;
  } catch (err) {
    return null;
  }
}

async function findAdjacentPanorama(baseLat, baseLng, excludePanoId) {
  // Deslocamentos de ~15 metros em cruz (Norte, Sul, Leste, Oeste)
  const offsets = [
    { dLat: 0.00015, dLng: 0 },
    { dLat: -0.00015, dLng: 0 },
    { dLat: 0, dLng: 0.00015 },
    { dLat: 0, dLng: -0.00015 }
  ];

  for (const off of offsets) {
    const testLat = baseLat + off.dLat;
    const testLng = baseLng + off.dLng;
    const meta = await fetchMetadata(testLat, testLng);
    
    if (meta && meta.status === 'OK' && meta.pano_id !== excludePanoId) {
      return meta;
    }
  }
  return null;
}

// Visão Computacional Sniper
async function locateHydrantWithGemini(base64Image) {
  const prompt = "Você é um sistema de visão computacional de alta precisão do Corpo de Bombeiros. Analise a imagem fornecida e localize um hidrante de calçada/rua (geralmente de cor AMARELA ou VERMELHA, metálico, cilíndrico).\n\nSe encontrado, retorne a coordenada horizontal exata do centro do hidrante na imagem, e uma nota de confiança de 0 a 100.\n\nRetorne ESTRITAMENTE um JSON válido neste formato:\n{\"encontrado\": true/false, \"centro_x\": <float entre 0.0 e 1.0>, \"confianca\": <int>}\n\nSó marque como encontrado se a confiança for >= 80.";
  
  const payload = JSON.stringify({
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: "image/jpeg", data: base64Image } }
      ]
    }],
    generationConfig: { response_mime_type: "application/json", temperature: 0.1 }
  });

  let retryCount = 0;
  while (true) {
    try {
      const result = await new Promise((resolve, reject) => {
        const options = {
          hostname: 'generativelanguage.googleapis.com',
          path: `/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (json.error) return reject(new Error(json.error.message));
              const text = json.candidates[0].content.parts[0].text;
              resolve(JSON.parse(text));
            } catch (e) {
              reject(new Error("Erro ao parsear resposta."));
            }
          });
        });
        req.on('error', e => reject(e));
        req.write(payload);
        req.end();
      });

      return result;
    } catch (err) {
      const isRateLimit = err.message.includes('Quota exceeded') || err.message.includes('rate-limit') || err.message.includes('429');
      if (isRateLimit) {
        const match = err.message.match(/Please retry in ([\d.]+)s/);
        const waitSec = match ? Math.ceil(parseFloat(match[1])) + 4 : 45;
        console.log(`   ⏳ Cota do Google atingida. Pausa de ${waitSec}s...`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
        continue;
      }
      retryCount++;
      if (retryCount <= 3) {
        await new Promise(r => setTimeout(r, 6000));
        continue;
      }
      return { encontrado: false, confianca: 0 };
    }
  }
}

async function downloadStreetView(carLat, carLng, heading, fov, width = 800, height = 600) {
  const url = `https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}&location=${carLat},${carLng}&heading=${heading}&pitch=-5&fov=${fov}&key=${GOOGLE_MAPS_API_KEY}`;
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

// Varredura Inteligente
async function smartScan(carLat, carLng, gpsLat, gpsLng, prefixLog) {
  const baseHeading = calculateBearing(carLat, carLng, gpsLat, gpsLng);
  const sweeps = [
    { heading: baseHeading, label: "Frontal" },
    { heading: (baseHeading + 120) % 360, label: "Sweep Direita (+120°)" },
    { heading: (baseHeading + 240) % 360, label: "Sweep Esquerda (-120°)" }
  ];

  for (const sweep of sweeps) {
    console.log(`${prefixLog} 📸 Tirando foto de varredura ampla (${sweep.label}, FOV=100)...`);
    const scanImage = await downloadStreetView(carLat, carLng, sweep.heading, 100, 640, 640);
    
    console.log(`${prefixLog} 🧠 Analisando com IA...`);
    const aiResult = await locateHydrantWithGemini(scanImage.base64);

    if (aiResult.encontrado && aiResult.confianca >= 80 && aiResult.centro_x !== undefined) {
      const correctionOffset = (aiResult.centro_x - 0.5) * 100;
      const finalHeading = (sweep.heading + correctionOffset + 360) % 360;
      console.log(`${prefixLog} 🤖 Sucesso! Confiança: ${aiResult.confianca}%. Correção: ${Math.round(correctionOffset)}° (Mira final: ${Math.round(finalHeading)}°).`);
      return { success: true, finalHeading, scanImage: scanImage.buffer, carLat, carLng };
    } else {
      console.log(`${prefixLog} ❌ Falhou (${sweep.label}) - Confiança: ${aiResult.confianca || 0}%`);
    }
  }

  return { success: false };
}

async function runPOC() {
  console.log("==========================================================");
  console.log("🎯 INICIANDO POC SNIPER V4 SMART (14 HIDRANTES DIFÍCEIS)");
  console.log("==========================================================\n");

  const workbook = xlsx.readFile(DB_PATH_PUBLIC);
  const sheetName = workbook.SheetNames[0];
  const allRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  const targetHydrants = allRows.filter(r => TARGET_CODES.includes(r.nomHidrante));
  console.log(`📍 Processando ${targetHydrants.length} hidrantes alvo...\n`);

  let failedHydrants = [];

  for (let i = 0; i < targetHydrants.length; i++) {
    const h = targetHydrants[i];
    const nom = h.nomHidrante;
    const gpsLat = h.numLatitude;
    const gpsLng = h.numLongitude;

    console.log(`\n🔎 [${i+1}/${targetHydrants.length}] ${nom}`);

    const filePath = path.join(OUTPUT_DIR, `${nom}_smart.jpeg`);
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 5000) {
      console.log(`   ⚡ Foto já existente localmente (${fs.statSync(filePath).size} bytes). Pulando...`);
      continue;
    }

    // Pega meta inicial
    const metaRes = await fetchMetadata(gpsLat, gpsLng);
    if (!metaRes || metaRes.status !== 'OK') {
      console.log(`   ⚠️ Sem cobertura Street View inicial.`);
      failedHydrants.push(nom);
      continue;
    }

    const initialPanoId = metaRes.pano_id;
    let carLat = metaRes.location.lat;
    let carLng = metaRes.location.lng;

    // TENTATIVA 1: Pano Original (Com Sweeps)
    console.log(`   [Passo 1] Scan no Pano Original...`);
    let result = await smartScan(carLat, carLng, gpsLat, gpsLng, "   ");

    // TENTATIVA 2: "Step-Around" (Mudar de Panorama)
    if (!result.success) {
      console.log(`   🚧 Obstáculo detectado ou hidrante escondido. Iniciando [Passo 2] Step-Around...`);
      const altMeta = await findAdjacentPanorama(gpsLat, gpsLng, initialPanoId);
      
      if (altMeta) {
        console.log(`   🚶‍♂️ Deslocou com sucesso para novo panorama (Pano ID mudou). Refazendo Scan...`);
        carLat = altMeta.location.lat;
        carLng = altMeta.location.lng;
        
        result = await smartScan(carLat, carLng, gpsLat, gpsLng, "      ");
      } else {
        console.log(`   🛑 Não foi possível achar um panorama adjacente diferente.`);
      }
    }

    if (result.success) {
      console.log(`   📸 Bate foto FINAL de alta resolução (800x600, FOV=75)...`);
      const finalImage = await downloadStreetView(result.carLat, result.carLng, result.finalHeading, 75, 800, 600);
      fs.writeFileSync(filePath, finalImage.buffer);
      console.log(`   ✅ SUCESSO V4! Salvo em: ${filePath}`);
    } else {
      console.log(`   💀 FALHA CRÍTICA: Hidrante não encontrado mesmo com Step-Around.`);
      failedHydrants.push(nom);
    }

    // Intervalo de segurança
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  console.log(`\n==========================================================`);
  console.log(`🎉 POC V4 FINALIZADA!`);
  if (failedHydrants.length > 0) {
    console.log(`⚠️ HIDRANTES NÃO ENCONTRADOS (Verificar Manualmente):`);
    failedHydrants.forEach(nom => console.log(` - ${nom}`));
  } else {
    console.log(`✅ Todos os hidrantes foram encontrados!`);
  }
  console.log(`==========================================================\n`);
}

runPOC();
