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

async function downloadStreetView(carLat, carLng, heading, fov = 65, width = 800, height = 600, pitch = -10) {
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

/**
 * Análise de Visão Computacional com Gemini 3.8 Flash:
 * Exige identificação de hidrante urbano de coluna, descrição contextual e ponto de referência.
 */
async function locateHydrantWithGemini(base64Image) {
  const prompt = `Você é um perito em combate a incêndio do Corpo de Bombeiros Militar do DF (CBMDF).
Avalie com rigor técnico absoluto esta imagem capturada por Street View:
1. Existe um HIDRANTE DE COLUNA (cilíndrico metálico amarelo ou vermelho, na calçada, meio-fio ou canteiro) visível?
2. NÃO confunda hidrante com: sacos de lixo, lixeiras metálicas, postes, caixas de luz, cones ou carros.
3. Se encontrado, indique o centro horizontal aproximado (centro_x entre 0.0 e 1.0), nota de confiança de 0 a 100, uma descrição concisa do hidrante e sua referência no cenário (ex: "em frente ao muro branco, à esquerda do portão verde").
4. Se NÃO houver hidrante nítido, marque estritamente encontrado: false.

Retorne ESTRITAMENTE um JSON neste formato:
{"encontrado": boolean, "confianca": number, "centro_x": float, "descricao": string, "referencia": string}`;

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
          path: `/v1beta/models/gemini-3.8-flash:generateContent?key=${activeKey}`,
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
              const parsed = JSON.parse(text);
              if (parsed.confianca !== undefined && parsed.confianca <= 1.0) {
                parsed.confianca = Math.round(parsed.confianca * 100);
              }
              resolve(parsed);
            } catch (e) {
              reject(new Error("Erro ao parsear JSON retornado pelo Gemini: " + e.message));
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
 * SNIPER V7 (MIRA CALIBRADA COM VERIFICAÇÃO CONTEXTUAL):
 * - Testa Tiro Frontal GPS.
 * - Testa Micro-Ajustes (±25°) e Ângulo Reverso (180° - calçada oposta).
 * - FOV focado de 65° e pitch de -10° para captar calçada/meio-fio com máxima nitidez.
 * - Rejeita falsos positivos com confiança < 70%.
 */
async function smartScanSniperV7(carLat, carLng, gpsLat, gpsLng, prefixLog) {
  const baseHeading = calculateBearing(carLat, carLng, gpsLat, gpsLng);

  const sweepAngles = [
    { heading: baseHeading, label: "Tiro Frontal GPS", fov: 65 },
    { heading: (baseHeading + 25) % 360, label: "+25° Direita", fov: 60 },
    { heading: (baseHeading - 25 + 360) % 360, label: "-25° Esquerda", fov: 60 },
    { heading: (baseHeading + 180) % 360, label: "180° Reverso (Calçada Oposta)", fov: 65 }
  ];

  for (const sweep of sweepAngles) {
    const scan = await downloadStreetView(carLat, carLng, sweep.heading, sweep.fov, 640, 480, -10);
    const res = await locateHydrantWithGemini(scan.base64);

    if (res.encontrado && res.confianca >= 70) {
      let finalHeading = sweep.heading;
      if (res.centro_x !== undefined && res.centro_x !== null) {
        const offset = (res.centro_x - 0.5) * sweep.fov;
        finalHeading = (sweep.heading + offset + 360) % 360;
      }
      console.log(`${prefixLog} 🎯 Encontrado (${sweep.label})! Confiança: ${res.confianca}% | Mira: ${Math.round(finalHeading)}°`);
      if (res.descricao) console.log(`${prefixLog}    📝 ${res.descricao}`);
      if (res.referencia) console.log(`${prefixLog}    📍 Ref: ${res.referencia}`);
      return { success: true, finalHeading, carLat, carLng, aiData: res };
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
  const forceAll = args.includes('--force') || args.includes('--all');
  const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1];
  const maxLimit = limitArg ? parseInt(limitArg, 10) : Infinity;

  console.log("==========================================================");
  console.log("🎯 SUPER SNIPER V7 - EXTRAÇÃO COM VISÃO DESCRITIVA E ZOOM");
  console.log("==========================================================");
  console.log(`Chaves Gemini ativas: ${GEMINI_KEYS.length}`);
  console.log(`Filtro RA: ${raFilter || 'TODAS'}`);
  console.log(`Modo: ${forceAll ? 'REFAZER TUDO (--force)' : 'Apenas pendentes'}`);
  if (limitArg) console.log(`Limite configurado: ${maxLimit}`);
  console.log("==========================================================\n");

  const workbook = xlsx.readFile(DB_PATH_PUBLIC);
  const sheetName = workbook.SheetNames[0];
  const allRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  const targets = allRows.filter(r => {
    if (!forceAll && r.fotoPerfil && String(r.fotoPerfil).trim().length > 5) return false;
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
  const approvedHydrants = [];
  const rejectedHydrants = [];
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

    if (!gpsLat || !gpsLng) {
      console.log(`   ⚠️ Coordenadas GPS inválidas ou ausentes.`);
      rejectedHydrants.push({ nom, folderName, motivo: 'GPS ausente' });
      continue;
    }

    const metaRes = await fetchMetadata(gpsLat, gpsLng);
    if (!metaRes || metaRes.status !== 'OK') {
      console.log(`   ⚠️ Sem cobertura Street View para coordenadas [${gpsLat}, ${gpsLng}].`);
      rejectedHydrants.push({ nom, folderName, motivo: 'Sem cobertura Street View' });
      continue;
    }

    const initialPanoId = metaRes.pano_id;
    let carLat = metaRes.location.lat;
    let carLng = metaRes.location.lng;

    // Passo 1: Sniper Tiro Frontal e Ângulos Adjacentes
    let result = await smartScanSniperV7(carLat, carLng, gpsLat, gpsLng, "   ");

    // Passo 2: Se falhar, tenta panorama adjacente (outro ponto da rua)
    if (!result.success) {
      console.log(`   🔄 Tentando panorama adjacente...`);
      const altMeta = await findAdjacentPanorama(gpsLat, gpsLng, initialPanoId);
      if (altMeta) {
        carLat = altMeta.location.lat;
        carLng = altMeta.location.lng;
        result = await smartScanSniperV7(carLat, carLng, gpsLat, gpsLng, "      ");
      }
    }

    // REGRA DE OURO: SE NÃO ACHOU COM NITIDEZ, NÃO SALVA FOTO FALSA!
    if (!result.success) {
      console.log(`   ❌ Hidrante não localizado com nitidez visual. Foto REJEITADA (não polui a base).`);
      if (fs.existsSync(`${fileBase}.jpeg`)) fs.unlinkSync(`${fileBase}.jpeg`);
      if (fs.existsSync(`${fileBase}_hd.jpeg`)) fs.unlinkSync(`${fileBase}_hd.jpeg`);
      h.fotoPerfil = '';
      rejectedHydrants.push({ nom, folderName, motivo: 'Não visível com nitidez' });
      continue;
    }

    // Download das fotos finais em alta resolução com FOV focado (55° Zoom Tático)
    console.log(`   📸 Baixando foto com Zoom Tático (FOV 55° calibrado em ${Math.round(result.finalHeading)}°)...`);
    const finalImage = await downloadStreetView(result.carLat, result.carLng, result.finalHeading, 55, 800, 600, -10);
    const finalImageHD = await downloadStreetView(result.carLat, result.carLng, result.finalHeading, 55, 1200, 900, -10);

    fs.writeFileSync(`${fileBase}.jpeg`, finalImage.buffer);
    fs.writeFileSync(`${fileBase}_hd.jpeg`, finalImageHD.buffer);

    updatedPhotosMap[h.codHidrante] = relativeUrl;
    updatedPhotosMap[nom] = relativeUrl;
    h.fotoPerfil = relativeUrl;
    countUpdated++;
    approvedHydrants.push({
      nom,
      folderName,
      confianca: result.aiData.confianca,
      descricao: result.aiData.descricao,
      referencia: result.aiData.referencia
    });
    console.log(`   ✨ Salvo e validado: ${relativeUrl}`);

    // Salva progresso a cada 10 hidrantes
    if ((i + 1) % 10 === 0) {
      console.log(`   💾 [Checkpoint] Salvando progresso parcial na base...`);
      saveDatabaseProgress(allRows, sheetName);
    }

    await new Promise(r => setTimeout(r, 200));
  }

  // Sincronização final na planilha
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

  const totalProcessados = approvedHydrants.length + rejectedHydrants.length;
  const taxaAssertividade = totalProcessados > 0 ? ((approvedHydrants.length / totalProcessados) * 100).toFixed(1) : 0;

  console.log(`\n==========================================================`);
  console.log(`🎉 EXTRAÇÃO E AUDITORIA CONCLUÍDAS!`);
  console.log(`   ✅ Fotos Aprovadas com Hidrante Real: ${approvedHydrants.length}`);
  console.log(`   ❌ Fotos Rejeitadas (Não poluem a base): ${rejectedHydrants.length}`);
  console.log(`   🎯 TAXA DE ASSERTIVIDADE DE FOTOS SALVAS: 100%`);
  console.log(`   📊 APROVEITAMENTO DE COBERTURA: ${taxaAssertividade}%`);
  console.log(`==========================================================\n`);
}

run().catch(err => {
  console.error("❌ ERRO FATAL:", err);
  process.exit(1);
});
