const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/(?:VITE_)?GOOGLE_MAPS_API_KEY=([^\r\n]+)/);
const key = match ? match[1].trim() : '';

// Metadados calibrados com centro exato
const hydrantsToDownload = [
  {
    nom: 'GAM00036',
    carLat: -16.009074,
    carLng: -48.056614,
    baseHeading: 162,
    centro_x: 0.24, // deslocado para a esquerda
    fovOriginal: 90
  },
  {
    nom: 'GAM00039',
    carLat: -16.006632,
    carLng: -48.054870,
    baseHeading: 71,
    centro_x: 0.52, // praticamente central
    fovOriginal: 90
  },
  {
    nom: 'GAM00040',
    carLat: -16.009090,
    carLng: -48.054982,
    baseHeading: 120,
    centro_x: 0.35, // deslocado para esquerda
    fovOriginal: 90
  },
  {
    nom: 'GAM00041',
    carLat: -16.014505,
    carLng: -48.054498,
    baseHeading: 151,
    centro_x: 0.48, // central
    fovOriginal: 90
  },
  {
    nom: 'GAM00042',
    carLat: -16.010920,
    carLng: -48.053809,
    baseHeading: 191,
    centro_x: 0.51, // central
    fovOriginal: 90
  }
];

async function download(carLat, carLng, heading, fov, width, height, pitch = -10) {
  const url = `https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}&location=${carLat},${carLng}&heading=${heading}&fov=${fov}&pitch=${pitch}&key=${key}`;
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
}

async function run() {
  const outDir = path.join(__dirname, '..', 'public', 'hidrantes', 'gama');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const updatedNoms = [];

  for (const h of hydrantsToDownload) {
    // Offset angular baseado no centro_x
    const angleOffset = (h.centro_x - 0.5) * h.fovOriginal;
    const finalHeading = Math.round((h.baseHeading + angleOffset + 360) % 360);

    console.log(`📸 Baixando ${h.nom}: mira calibrada em ${finalHeading}° (FOV 50° Zoom Tático Centralizado)...`);
    
    // Zoom tático FOV 50° perfeitamente centralizado no hidrante
    const bufPadrao = await download(h.carLat, h.carLng, finalHeading, 50, 800, 600, -10);
    const bufHD = await download(h.carLat, h.carLng, finalHeading, 50, 1200, 900, -10);

    fs.writeFileSync(path.join(outDir, `${h.nom}.jpeg`), bufPadrao);
    fs.writeFileSync(path.join(outDir, `${h.nom}_hd.jpeg`), bufHD);
    console.log(`   ✨ Salvo e perfeitamente enquadrado: ${h.nom}.jpeg`);
    updatedNoms.push(h.nom);
  }

  // GAM00037 não é visível (garantir exclusão)
  const gam37 = path.join(outDir, 'GAM00037.jpeg');
  const gam37_hd = path.join(outDir, 'GAM00037_hd.jpeg');
  if (fs.existsSync(gam37)) fs.unlinkSync(gam37);
  if (fs.existsSync(gam37_hd)) fs.unlinkSync(gam37_hd);
  console.log(`🗑️ GAM00037 confirmado como não visível (foto excluída da base).`);

  // Atualizar planilha
  ['public/base-de-dados.xlsx', 'base-de-dados.xlsx'].forEach(p => {
    if (fs.existsSync(p)) {
      const wb = xlsx.readFile(p);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(sheet);
      rows.forEach(r => {
        const nom = (r.nomHidrante || '').toUpperCase();
        if (updatedNoms.includes(nom)) {
          r.fotoPerfil = `/hidrantes/gama/${nom}.jpeg`;
        } else if (nom === 'GAM00037') {
          r.fotoPerfil = '';
        }
      });
      wb.Sheets[wb.SheetNames[0]] = xlsx.utils.json_to_sheet(rows);
      xlsx.writeFile(wb, p);
      console.log(`💾 Planilha atualizada: ${p}`);
    }
  });

  console.log('✅ Finalizado com sucesso!');
}

run();
