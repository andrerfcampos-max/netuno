const fs = require('fs');
const path = require('path');
const https = require('https');
const xlsx = require('xlsx');

// Carregar variáveis de ambiente do .env
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
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();

if (!GOOGLE_MAPS_API_KEY || !GEMINI_API_KEY) {
  console.error('❌ ERRO: Chaves GOOGLE_MAPS_API_KEY ou GEMINI_API_KEY não encontradas no .env!');
  process.exit(1);
}

const DB_PATH_PUBLIC = path.join(__dirname, '..', 'public', 'base-de-dados.xlsx');
const DB_PATH_ROOT = path.join(__dirname, '..', 'base-de-dados.xlsx');

const DIR_SUDOESTE = path.join(__dirname, '..', 'public', 'hidrantes', 'sudoeste');
const DIR_CEILANDIA = path.join(__dirname, '..', 'public', 'hidrantes', 'ceilandia');

if (!fs.existsSync(DIR_SUDOESTE)) fs.mkdirSync(DIR_SUDOESTE, { recursive: true });
if (!fs.existsSync(DIR_CEILANDIA)) fs.mkdirSync(DIR_CEILANDIA, { recursive: true });

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
  // Tenta primeiro via pública externa (outdoor)
  let metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&radius=50&source=outdoor&key=${GOOGLE_MAPS_API_KEY}`;
  try {
    let res = await (await fetch(metaUrl)).json();
    if (res && res.status === 'OK') return res;
  } catch (err) {}

  // Fallback sem filtro outdoor caso não haja outdoor
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

async function locateHydrantWithGemini(base64Image) {
  const prompt = "Você é um sistema de visão computacional de alta precisão do Corpo de Bombeiros Militar do DF. Analise a imagem fornecida e localize um hidrante de calçada/rua (geralmente de cor AMARELA ou VERMELHA, metálico, cilíNDRICO de coluna). ATENÇÃO: Ele pode estar cinza, envelhecido, com pintura descascada, pintado de outras cores para camuflagem ou parcialmente escondido na vegetação. No DF, todos são de coluna cilíndrica. Se encontrado, retorne a coordenada horizontal exata do centro do hidrante na imagem (0.0 a 1.0), e uma nota de confiança de 0 a 100. Forneça uma 'justificativa' concisa.\n\nRetorne ESTRITAMENTE um JSON válido neste formato:\n{\"encontrado\": true/false, \"centro_x\": <float entre 0.0 e 1.0>, \"confianca\": <int>, \"justificativa\": \"<sua explicacao>\"}\n\nSó marque como encontrado se a confiança for >= 60.";
  
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
              reject(new Error("Erro ao parsear resposta Gemini"));
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
        const waitSec = match ? Math.ceil(parseFloat(match[1])) + 4 : 30;
        console.log(`   ⏳ Cota do Google atingida. Pausa preventiva de ${waitSec}s...`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
        continue;
      }
      retryCount++;
      if (retryCount <= 3) {
        await new Promise(r => setTimeout(r, 4000));
        continue;
      }
      return { encontrado: false, confianca: 0, justificativa: err.message };
    }
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

// Sniper 360 v5: Varredura de 360° em fatias táticas
async function smartScan(carLat, carLng, gpsLat, gpsLng, prefixLog) {
  const baseHeading = calculateBearing(carLat, carLng, gpsLat, gpsLng);
  
  const sweeps = [
    { heading: baseHeading, label: "Frontal (0°)", pitch: -8 },
    { heading: (baseHeading + 180) % 360, label: "Traseira (180°)", pitch: -8 },
    { heading: (baseHeading + 60) % 360, label: "Lateral Direita (+60°)", pitch: -12 },
    { heading: (baseHeading + 300) % 360, label: "Lateral Esquerda (-60°)", pitch: -12 },
    { heading: (baseHeading + 120) % 360, label: "Flanco Direita (+120°)", pitch: -10 },
    { heading: (baseHeading + 240) % 360, label: "Flanco Esquerda (-120°)", pitch: -10 }
  ];

  for (const sweep of sweeps) {
    const scanImage = await downloadStreetView(carLat, carLng, sweep.heading, 75, 640, 640, sweep.pitch);
    const aiResult = await locateHydrantWithGemini(scanImage.base64);

    if (aiResult.encontrado && aiResult.confianca >= 60 && aiResult.centro_x !== undefined) {
      const correctionOffset = (aiResult.centro_x - 0.5) * 75;
      const finalHeading = (sweep.heading + correctionOffset + 360) % 360;
      console.log(`${prefixLog} 🎯 Detectado! Confiança: ${aiResult.confianca}%. Mira calibrada: ${Math.round(finalHeading)}° (${sweep.label})`);
      return { success: true, finalHeading, scanImage: scanImage.buffer, carLat, carLng };
    }
  }

  return { success: false };
}

function saveDatabaseProgress(allRows, sheetName) {
  try {
    const newSheet = xlsx.utils.json_to_sheet(allRows);
    const newWorkbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(newWorkbook, newSheet, sheetName);
    xlsx.writeFile(newWorkbook, DB_PATH_PUBLIC);
    if (fs.existsSync(DB_PATH_ROOT)) xlsx.writeFile(newWorkbook, DB_PATH_ROOT);
  } catch (err) {
    console.error('   ⚠️ Falha ao salvar progresso parcial na planilha:', err.message);
  }
}

async function processHydrantGroup(groupName, targetHydrants, outputDir, urlPrefix, allRows, sheetName, updatedPhotosMap, failedHydrants) {
  console.log(`\n==========================================================`);
  console.log(`📍 PROCESSANDO: ${groupName.toUpperCase()} (${targetHydrants.length} HIDRANTES)`);
  console.log(`📂 Diretório: ${outputDir}`);
  console.log(`==========================================================\n`);

  for (let i = 0; i < targetHydrants.length; i++) {
    const h = targetHydrants[i];
    const nom = h.nomHidrante;
    const gpsLat = parseFloat(h.numLatitude);
    const gpsLng = parseFloat(h.numLongitude);

    const fileBase = path.join(outputDir, nom);
    const relativeUrl = `${urlPrefix}/${nom}.jpeg`;

    console.log(`🔎 [${i + 1}/${targetHydrants.length}] ${nom} (${h.dscEndereco || 'Sem endereço'})`);

    // Verifica se fotos já existem localmente
    if (fs.existsSync(`${fileBase}.jpeg`) && fs.statSync(`${fileBase}.jpeg`).size > 5000 &&
        fs.existsSync(`${fileBase}_hd.jpeg`) && fs.statSync(`${fileBase}_hd.jpeg`).size > 5000) {
      console.log(`   ⚡ Fotos (Padrão e HD) já existem localmente. Registrando...`);
      updatedPhotosMap[h.codHidrante] = relativeUrl;
      updatedPhotosMap[nom] = relativeUrl;
      h.fotoPerfil = relativeUrl;
      continue;
    }

    const metaRes = await fetchMetadata(gpsLat, gpsLng);
    if (!metaRes || metaRes.status !== 'OK') {
      console.log(`   ⚠️ Sem cobertura Street View inicial para coordenadas [${gpsLat}, ${gpsLng}].`);
      failedHydrants.push({ nom, ra: groupName, motivo: 'Sem cobertura Street View inicial' });
      continue;
    }

    const initialPanoId = metaRes.pano_id;
    let carLat = metaRes.location.lat;
    let carLng = metaRes.location.lng;

    console.log(`   [Passo 1] Varredura Sniper 360 no panorama inicial (${initialPanoId})...`);
    let result = await smartScan(carLat, carLng, gpsLat, gpsLng, "      ");

    if (!result.success) {
      console.log(`   [Passo 2] Hidrante não localizado no pano inicial. Buscando panorama adjacente...`);
      const altMeta = await findAdjacentPanorama(gpsLat, gpsLng, initialPanoId);
      
      if (altMeta) {
        console.log(`   🚶‍♂️ Deslocou para pano alternativo (${altMeta.pano_id}). Refazendo varredura...`);
        carLat = altMeta.location.lat;
        carLng = altMeta.location.lng;
        result = await smartScan(carLat, carLng, gpsLat, gpsLng, "         ");
      }
    }

    if (!result.success) {
      console.log(`   ⚠️ IA não detectou com confiança alta (>=60%). Aplicando FALLBACK mirando GPS original.`);
      failedHydrants.push({ nom, ra: groupName, motivo: 'Fallback GPS (baixa confiança da IA)' });
      const baseHeadingFallback = calculateBearing(carLat, carLng, gpsLat, gpsLng);
      result = { success: true, carLat, carLng, finalHeading: baseHeadingFallback };
    }

    if (result.success) {
      console.log(`   📸 Baixando fotos finais calibradas (800x600 e HD 1200x900)...`);
      const finalImage = await downloadStreetView(result.carLat, result.carLng, result.finalHeading, 75, 800, 600);
      const finalImageHD = await downloadStreetView(result.carLat, result.carLng, result.finalHeading, 75, 1200, 900);
      
      fs.writeFileSync(`${fileBase}.jpeg`, finalImage.buffer);
      fs.writeFileSync(`${fileBase}_hd.jpeg`, finalImageHD.buffer);
      
      console.log(`   ✅ SUCESSO! Salvo em: ${nom}.jpeg e ${nom}_hd.jpeg`);
      updatedPhotosMap[h.codHidrante] = relativeUrl;
      updatedPhotosMap[nom] = relativeUrl;
      h.fotoPerfil = relativeUrl;
    }

    // Salva progresso a cada 10 hidrantes
    if ((i + 1) % 10 === 0) {
      console.log(`   💾 [Checkpoint] Salvando progresso parcial na planilha...`);
      saveDatabaseProgress(allRows, sheetName);
    }

    // Throttle tático de 800ms para estabilidade de conexões
    await new Promise(resolve => setTimeout(resolve, 800));
  }
}

async function run() {
  console.log("==========================================================");
  console.log("🚀 EXTRAÇÃO STREET VIEW SNIPER - SUDOESTE & CEILÂNDIA");
  console.log("==========================================================\n");

  const workbook = xlsx.readFile(DB_PATH_PUBLIC);
  const sheetName = workbook.SheetNames[0];
  const allRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  const sudoesteHydrants = allRows.filter(r => 
    (r.nomHidrante || '').toUpperCase().startsWith('OCT') ||
    (r.nomHidrante || '').toUpperCase().startsWith('SUD') ||
    (r.dscLocalidade || '').toUpperCase().includes('SUDOESTE') ||
    (r.dscLocalidade || '').toUpperCase().includes('OCTOGONAL')
  );

  const ceilandiaHydrants = allRows.filter(r => 
    (r.nomHidrante || '').toUpperCase().startsWith('CEI') ||
    (r.nomHidrante || '').toUpperCase().startsWith('CEL') ||
    (r.dscLocalidade || '').toUpperCase().includes('CEIL')
  );

  console.log(`📍 Sudoeste & Octogonal: ${sudoesteHydrants.length} hidrantes`);
  console.log(`📍 Ceilândia: ${ceilandiaHydrants.length} hidrantes`);
  console.log(`📍 Total para extração: ${sudoesteHydrants.length + ceilandiaHydrants.length} hidrantes\n`);

  const updatedPhotosMap = {};
  const failedHydrants = [];

  // 1. Processa Sudoeste
  await processHydrantGroup(
    'Sudoeste e Octogonal',
    sudoesteHydrants,
    DIR_SUDOESTE,
    '/hidrantes/sudoeste',
    allRows,
    sheetName,
    updatedPhotosMap,
    failedHydrants
  );

  // 2. Processa Ceilândia
  await processHydrantGroup(
    'Ceilândia',
    ceilandiaHydrants,
    DIR_CEILANDIA,
    '/hidrantes/ceilandia',
    allRows,
    sheetName,
    updatedPhotosMap,
    failedHydrants
  );

  // Sincronização final da planilha
  console.log("\n💾 Sincronizando base de dados final com todas as fotos...");
  let countUpdated = 0;
  const updatedAllRows = allRows.map(row => {
    const photoUrl = updatedPhotosMap[row.codHidrante] || updatedPhotosMap[row.nomHidrante];
    if (photoUrl) {
      countUpdated++;
      return { ...row, fotoPerfil: photoUrl };
    }
    return row;
  });

  const newSheet = xlsx.utils.json_to_sheet(updatedAllRows);
  const newWorkbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(newWorkbook, newSheet, sheetName);
  xlsx.writeFile(newWorkbook, DB_PATH_PUBLIC);
  if (fs.existsSync(DB_PATH_ROOT)) xlsx.writeFile(newWorkbook, DB_PATH_ROOT);

  // Executa clean export para hidrantes_df_oficial.json e .csv
  console.log("\n🔄 Executando scripts/export_clean_database.cjs...");
  try {
    const { execSync } = require('child_process');
    execSync('node scripts/export_clean_database.cjs', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  } catch (err) {
    console.error('   ⚠️ Falha ao executar export:', err.message);
  }

  // Atualizar rascunho de falhas se houver
  const draftFile = path.join(__dirname, '..', 'rascunho_falhas_streetview.md');
  let failureLog = fs.existsSync(draftFile) ? fs.readFileSync(draftFile, 'utf8') : "# Hidrantes Não Capturados (Revisão Manual)\n\n";

  if (failedHydrants.length > 0) {
    failureLog += `\n## Lote Sudoeste e Ceilândia (${new Date().toLocaleDateString('pt-BR')})\n`;
    failedHydrants.forEach(f => {
      failureLog += `- [${f.ra}] ${f.nom}: ${f.motivo}\n`;
    });
    fs.writeFileSync(draftFile, failureLog);
  }

  console.log(`\n==========================================================`);
  console.log(`🎉 EXTRAÇÃO CONCLUÍDA COM SUCESSO!`);
  console.log(`   📸 Hidrantes atualizados com foto de perfil: ${countUpdated}`);
  console.log(`   ⚠️ Total em fallback/revisão: ${failedHydrants.length}`);
  console.log(`==========================================================\n`);
}

run().catch(err => {
  console.error("❌ ERRO FATAL NA EXECUÇÃO:", err);
  process.exit(1);
});
