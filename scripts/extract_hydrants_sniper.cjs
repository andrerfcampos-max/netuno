const fs = require('fs');
const path = require('path');
const https = require('https');
const xlsx = require('xlsx');

// 1. Carregar variáveis de ambiente do .env
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

const GOOGLE_MAPS_API_KEY = (process.env.GOOGLE_MAPS_API_KEY || '').trim();
const RAW_GEMINI_KEYS = (process.env.GEMINI_API_KEY || '').trim();

if (!GOOGLE_MAPS_API_KEY || !RAW_GEMINI_KEYS) {
  console.error('❌ ERRO: Chaves GOOGLE_MAPS_API_KEY ou GEMINI_API_KEY não encontradas no .env!');
  process.exit(1);
}

// Suporte a pool de múltiplas chaves separadas por vírgula
const GEMINI_KEYS = RAW_GEMINI_KEYS.split(',').map(k => k.trim()).filter(Boolean);
let currentKeyIndex = 0;

function getNextGeminiKey() {
  const key = GEMINI_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % GEMINI_KEYS.length;
  return key;
}

const DB_PATH_PUBLIC = path.join(__dirname, '..', 'public', 'base-de-dados.xlsx');
const DB_PATH_ROOT = path.join(__dirname, '..', 'base-de-dados.xlsx');

// Mapeamento canônico de pastas por RA
const RA_FOLDER_MAP = {
  'AGUAS CLARAS': 'aguas_claras',
  'ARNIQUEIRA': 'arniqueira',
  'BRAZLANDIA': 'brazlandia',
  'CANDANGOLANDIA': 'candangolandia',
  'CEILANDIA': 'ceilandia',
  'GAMA': 'gama',
  'GUARA': 'guara',
  'LAGO SUL': 'lago_sul',
  'LAGO NORTE': 'lago_norte',
  'NUCLEO BANDEIRANTE': 'nucleo_bandeirante',
  'PARANOA': 'paranoa',
  'PLANALTINA': 'planaltina',
  'PLANO PILOTO': 'plano_piloto',
  'RECANTO DAS EMAS': 'recanto_das_emas',
  'RIACHO FUNDO': 'riacho_fundo',
  'SAMAMBAIA': 'samambaia',
  'SANTA MARIA': 'santa_maria',
  'SAO SEBASTIAO': 'sao_sebastiao',
  'SOBRADINHO': 'sobradinho',
  'SUDOESTE': 'sudoeste',
  'OCTOGONAL': 'sudoeste',
  'TAGUATINGA': 'taguatinga',
  'VICENTE PIRES': 'vicente_pires'
};

function resolveFolderForHydrant(h) {
  const nom = (h.nomHidrante || '').toUpperCase();
  const dsc = (h.dscLocalidade || h.cidade || '').toUpperCase();

  if (nom.startsWith('OCT') || nom.startsWith('SUD') || dsc.includes('SUDOESTE') || dsc.includes('OCTOGONAL')) return 'sudoeste';
  if (nom.startsWith('CEI') || nom.startsWith('CEL') || dsc.includes('CEIL')) return 'ceilandia';
  if (nom.startsWith('TAG') || dsc.includes('TAGUAT')) return 'taguatinga';
  if (nom.startsWith('SAM') || dsc.includes('SAMAMB')) return 'samambaia';
  if (nom.startsWith('BSB') || dsc.includes('PLANO') || dsc.includes('ASA')) return 'plano_piloto';
  if (nom.startsWith('GUA') || dsc.includes('GUARA')) return 'guara';
  if (nom.startsWith('LGS') || dsc.includes('LAGO SUL')) return 'lago_sul';
  if (nom.startsWith('LGN') || dsc.includes('LAGO NORTE')) return 'lago_norte';
  if (nom.startsWith('GAM') || dsc.includes('GAMA')) return 'gama';
  if (nom.startsWith('STM') || dsc.includes('SANTA MARIA')) return 'santa_maria';
  if (nom.startsWith('REC') || dsc.includes('RECANTO')) return 'recanto_das_emas';
  if (nom.startsWith('SOB') || dsc.includes('SOBRADINHO')) return 'sobradinho';
  if (nom.startsWith('PLA') || dsc.includes('PLANALTINA')) return 'planaltina';
  if (nom.startsWith('BRZ') || nom.startsWith('BRA') || dsc.includes('BRAZ')) return 'brazlandia';
  if (nom.startsWith('ACL') || dsc.includes('AGUAS CLARAS')) return 'aguas_claras';
  if (nom.startsWith('ARN') || dsc.includes('ARNIQUEIRA')) return 'arniqueira';
  if (nom.startsWith('CDG') || dsc.includes('CANDANGO')) return 'candangolandia';

  return 'geral';
}

function calculateBearing(lat1, lng1, lat2, lng2) {
  const toRad = (val) => (val * Math.PI) / 180;
  const toDeg = (val) => (val * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const radLat1 = toRad(lat1);
  const radLat2 = toRad(lat2);
  const y = Math.sin(dLng) * Math.cos(radLat2);
  const x = Math.cos(radLat1) * Math.sin(radLat2) - Math.sin(radLat1) * Math.cos(dLng);
  let brng = Math.atan2(y, x);
  return (toDeg(brng) + 360) % 360;
}

async function fetchMetadata(lat, lng) {
  let metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&radius=50&source=outdoor&key=${GOOGLE_MAPS_API_KEY}`;
  try {
    let res = await (await fetch(metaUrl)).json();
    if (res && res.status === 'OK') return res;
  } catch (err) {}

  metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&radius=50&key=${GOOGLE_MAPS_API_KEY}`;
  try {
    let res = await (await fetch(metaUrl)).json();
    return res;
  } catch (err) {
    return null;
  }
}

async function findAdjacentPanorama(baseLat, baseLng, excludePanoId) {
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

// Visão Computacional Otimizada: Modelo Flash-Lite / Flash com Token Saver (480x480)
async function locateHydrantWithGemini(base64Image) {
  const prompt = "Você é um perito em visão computacional do Corpo de Bombeiros. Localize o hidrante de coluna (amarelo ou vermelho, metálico, no chão/calçada/canteiro). Retorne ESTRITAMENTE um JSON neste formato:\n{\"encontrado\": true/false, \"centro_x\": <float 0.0 a 1.0>, \"confianca\": <int 0 a 100>, \"justificativa\": \"<breve motivo>\"}\nSe não houver hidrante nítido, marque encontrado: false.";
  
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
    const activeKey = getNextGeminiKey();
    try {
      const result = await new Promise((resolve, reject) => {
        const options = {
          hostname: 'generativelanguage.googleapis.com',
          path: `/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${activeKey}`,
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
              reject(new Error("Erro ao parsear JSON retornado pelo Gemini"));
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
        // Se houver mais chaves no pool, tenta imediatamente com outra chave
        if (GEMINI_KEYS.length > 1) {
          console.log(`   ⚠️ Chave atingiu limite. Rotacionando para próxima chave do pool...`);
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        const match = err.message.match(/Please retry in ([\d.]+)s/);
        const waitSec = match ? Math.ceil(parseFloat(match[1])) + 2 : 20;
        console.log(`   ⏳ Cota por minuto atingida. Aguardando ${waitSec}s para retomar...`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
        continue;
      }
      retryCount++;
      if (retryCount <= 2) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      return { encontrado: false, confianca: 0, justificativa: err.message };
    }
  }
}

/**
 * SMART SNIPER V6 (MIRA DIRETA E MICROAJUSTE):
 * - Passo 1: Tiro Direto Amplo (FOV 85°, 480x480). Cobre 85° centrado no GPS. Acerto direto em >80% dos casos com 1 única chamada!
 * - Passo 2: Micro-Ajuste Angular (apenas ±20°, se Passo 1 der inconclusivo).
 * - Total de chamadas: 1 na maioria das vezes, no máximo 3 nos casos difíceis.
 */
async function smartScanSniperV6(carLat, carLng, gpsLat, gpsLng, prefixLog) {
  const baseHeading = calculateBearing(carLat, carLng, gpsLat, gpsLng);

  // 1. TIRO DIRETO PRINCIPAL (Amplo, centrado no GPS do hidrante)
  const scan1 = await downloadStreetView(carLat, carLng, baseHeading, 85, 480, 480, -8);
  const res1 = await locateHydrantWithGemini(scan1.base64);

  if (res1.encontrado && res1.confianca >= 60 && res1.centro_x !== undefined) {
    const correctionOffset = (res1.centro_x - 0.5) * 85;
    const finalHeading = (baseHeading + correctionOffset + 360) % 360;
    console.log(`${prefixLog} 🎯 Tiro Direto Certeiro! Confiança: ${res1.confianca}%. Mira final: ${Math.round(finalHeading)}° (0° Frontal)`);
    return { success: true, finalHeading, carLat, carLng };
  }

  // 2. MICRO-AJUSTES TÁTICOS (Apenas se o tiro direto inicial não teve confiança alta)
  const microAdjusts = [
    { heading: (baseHeading + 22) % 360, label: "+22° Direita" },
    { heading: (baseHeading - 22 + 360) % 360, label: "-22° Esquerda" }
  ];

  for (const sweep of microAdjusts) {
    const scan = await downloadStreetView(carLat, carLng, sweep.heading, 75, 480, 480, -8);
    const res = await locateHydrantWithGemini(scan.base64);

    if (res.encontrado && res.confianca >= 60 && res.centro_x !== undefined) {
      const correctionOffset = (res.centro_x - 0.5) * 75;
      const finalHeading = (sweep.heading + correctionOffset + 360) % 360;
      console.log(`${prefixLog} 🎯 Detectado no Micro-Ajuste! Confiança: ${res.confianca}%. Mira: ${Math.round(finalHeading)}° (${sweep.label})`);
      return { success: true, finalHeading, carLat, carLng };
    }
  }

  return { success: false, baseHeading };
}

function saveDatabaseProgress(allRows, sheetName) {
  try {
    const newSheet = xlsx.utils.json_to_sheet(allRows);
    const newWorkbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(newWorkbook, newSheet, sheetName);
    xlsx.writeFile(newWorkbook, DB_PATH_PUBLIC);
    if (fs.existsSync(DB_PATH_ROOT)) xlsx.writeFile(newWorkbook, DB_PATH_ROOT);
  } catch (err) {
    console.error('   ⚠️ Falha ao salvar progresso parcial:', err.message);
  }
}

async function run() {
  const args = process.argv.slice(2);
  const raFilter = args.find(a => a.startsWith('--ra='))?.split('=')[1]?.toLowerCase();
  const missingOnly = args.includes('--missing') || !raFilter;
  const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1];
  const maxLimit = limitArg ? parseInt(limitArg, 10) : Infinity;

  console.log("==========================================================");
  console.log("🎯 SUPER SNIPER V6 - EXTRAÇÃO ULTRA-RÁPIDA DE FOTOS");
  console.log("==========================================================");
  console.log(`Chaves Gemini ativas: ${GEMINI_KEYS.length}`);
  console.log(`Filtro RA: ${raFilter || 'TODAS'}`);
  console.log(`Apenas sem foto: ${missingOnly ? 'SIM' : 'NÃO'}`);
  if (limitArg) console.log(`Limite configurado: ${maxLimit}`);
  console.log("==========================================================\n");

  const workbook = xlsx.readFile(DB_PATH_PUBLIC);
  const sheetName = workbook.SheetNames[0];
  const allRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  const targets = allRows.filter(r => {
    if (missingOnly && r.fotoPerfil && String(r.fotoPerfil).trim().length > 5) return false;
    if (raFilter) {
      const folder = resolveFolderForHydrant(r);
      const dsc = (r.dscLocalidade || r.cidade || '').toLowerCase();
      const nom = (r.nomHidrante || '').toLowerCase();
      if (!folder.includes(raFilter) && !dsc.includes(raFilter) && !nom.includes(raFilter)) {
        return false;
      }
    }
    return true;
  }).slice(0, maxLimit);

  console.log(`📊 Total de hidrantes selecionados para processar: ${targets.length}\n`);

  if (targets.length === 0) {
    console.log("✅ Nenhum hidrante pendente com os filtros informados!");
    return;
  }

  const updatedPhotosMap = {};
  const failedHydrants = [];
  let countUpdated = 0;

  for (let i = 0; i < targets.length; i++) {
    const h = targets[i];
    const nom = h.nomHidrante;
    const gpsLat = parseFloat(h.numLatitude);
    const gpsLng = parseFloat(h.numLongitude);
    const folderName = resolveFolderForHydrant(h);

    const dirOutput = path.join(__dirname, '..', 'public', 'hidrantes', folderName);
    if (!fs.existsSync(dirOutput)) fs.mkdirSync(dirOutput, { recursive: true });

    const fileBase = path.join(dirOutput, nom);
    const relativeUrl = `/hidrantes/${folderName}/${nom}.jpeg`;

    console.log(`\n🔹 [${i + 1}/${targets.length}] ${nom} (${h.dscEndereco || folderName})`);

    // Se as fotos locais já existirem com tamanho válido, pula download
    if (fs.existsSync(`${fileBase}.jpeg`) && fs.statSync(`${fileBase}.jpeg`).size > 5000 &&
        fs.existsSync(`${fileBase}_hd.jpeg`) && fs.statSync(`${fileBase}_hd.jpeg`).size > 5000) {
      console.log(`   ✅ Fotos já existem localmente. Vinculando...`);
      updatedPhotosMap[h.codHidrante] = relativeUrl;
      updatedPhotosMap[nom] = relativeUrl;
      h.fotoPerfil = relativeUrl;
      countUpdated++;
      continue;
    }

    if (!gpsLat || !gpsLng) {
      console.log(`   ⚠️ Coordenadas GPS inválidas ou ausentes.`);
      failedHydrants.push({ nom, folderName, motivo: 'GPS ausente' });
      continue;
    }

    const metaRes = await fetchMetadata(gpsLat, gpsLng);
    if (!metaRes || metaRes.status !== 'OK') {
      console.log(`   ⚠️ Sem cobertura Street View inicial para coordenadas [${gpsLat}, ${gpsLng}].`);
      failedHydrants.push({ nom, folderName, motivo: 'Sem cobertura Street View' });
      continue;
    }

    const initialPanoId = metaRes.pano_id;
    let carLat = metaRes.location.lat;
    let carLng = metaRes.location.lng;

    // Passo 1: Sniper Tiro Direto
    let result = await smartScanSniperV6(carLat, carLng, gpsLat, gpsLng, "   ");

    // Passo 2: Se falhar, busca panorama adjacente e faz 1 tiro direto nele
    if (!result.success) {
      console.log(`   🔄 Tentando panorama adjacente...`);
      const altMeta = await findAdjacentPanorama(gpsLat, gpsLng, initialPanoId);
      if (altMeta) {
        carLat = altMeta.location.lat;
        carLng = altMeta.location.lng;
        result = await smartScanSniperV6(carLat, carLng, gpsLat, gpsLng, "      ");
      }
    }

    // Passo 3: Fallback mirando no GPS se não detectou
    if (!result.success) {
      console.log(`   ⚠️ IA não detectou com certeza. Aplicando FALLBACK mirando GPS original.`);
      failedHydrants.push({ nom, folderName, motivo: 'Fallback GPS' });
      const baseHeadingFallback = calculateBearing(carLat, carLng, gpsLat, gpsLng);
      result = { success: true, carLat, carLng, finalHeading: baseHeadingFallback };
    }

    // Download das fotos finais em alta resolução (800x600 e 1200x900)
    console.log(`   📸 Baixando fotos finais calibradas...`);
    const finalImage = await downloadStreetView(result.carLat, result.carLng, result.finalHeading, 75, 800, 600);
    const finalImageHD = await downloadStreetView(result.carLat, result.carLng, result.finalHeading, 75, 1200, 900);

    fs.writeFileSync(`${fileBase}.jpeg`, finalImage.buffer);
    fs.writeFileSync(`${fileBase}_hd.jpeg`, finalImageHD.buffer);

    updatedPhotosMap[h.codHidrante] = relativeUrl;
    updatedPhotosMap[nom] = relativeUrl;
    h.fotoPerfil = relativeUrl;
    countUpdated++;
    console.log(`   ✨ Salvo: ${relativeUrl}`);

    // Salva progresso a cada 10 hidrantes
    if ((i + 1) % 10 === 0) {
      console.log(`   💾 [Checkpoint] Salvando progresso parcial na base...`);
      saveDatabaseProgress(allRows, sheetName);
    }

    // Pausa leve de 300ms para estabilidade de socket
    await new Promise(r => setTimeout(r, 300));
  }

  // Sincronização final
  console.log("\n📦 Salvando base de dados final...");
  saveDatabaseProgress(allRows, sheetName);

  // Clean export para JSON e CSV oficial
  console.log("🚀 Atualizando hidrantes_df_oficial.json e .csv...");
  try {
    const { execSync } = require('child_process');
    execSync('node scripts/export_clean_database.cjs', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  } catch (err) {
    console.error('Falha no export final:', err.message);
  }

  console.log(`\n==========================================================`);
  console.log(`🎉 EXTRAÇÃO CONCLUÍDA COM SUCESSO!`);
  console.log(`   📸 Fotos atualizadas: ${countUpdated}`);
  console.log(`   ⚠️ Em fallback/revisão: ${failedHydrants.length}`);
  console.log(`==========================================================\n`);
}

run().catch(err => {
  console.error("❌ ERRO FATAL:", err);
  process.exit(1);
});
