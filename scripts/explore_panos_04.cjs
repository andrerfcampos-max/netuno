const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const keyMatch = env.match(/GOOGLE_MAPS_API_KEY=(.*)/);
const key = keyMatch ? keyMatch[1].trim().replace(/['"]/g, '') : '';

async function run() {
  const baseLat = -15.832194;
  const baseLng = -47.878917;

  console.log("Coordenada original LAS00004:", baseLat, baseLng);

  // Vamos testar deslocamentos para frente/trás/lados em raio de 10m a 40m
  const steps = [
    { label: "Centro (Original)", dLat: 0, dLng: 0 },
    { label: "Norte (+15m)", dLat: 0.00015, dLng: 0 },
    { label: "Sul (-15m)", dLat: -0.00015, dLng: 0 },
    { label: "Leste (+15m)", dLat: 0, dLng: 0.00015 },
    { label: "Oeste (-15m)", dLat: 0, dLng: -0.00015 },
    { label: "Norte (+30m)", dLat: 0.00030, dLng: 0 },
    { label: "Sul (-30m)", dLat: -0.00030, dLng: 0 },
    { label: "Leste (+30m)", dLat: 0, dLng: 0.00030 },
    { label: "Oeste (-30m)", dLat: 0, dLng: -0.00030 }
  ];

  const seenPanos = new Set();

  for (const s of steps) {
    const lat = baseLat + s.dLat;
    const lng = baseLng + s.dLng;
    const url = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&radius=20&source=outdoor&key=${key}`;
    const res = await (await fetch(url)).json();
    if (res && res.status === 'OK') {
      if (!seenPanos.has(res.pano_id)) {
        seenPanos.add(res.pano_id);
        console.log(`\n👉 ${s.label}:`);
        console.log(`   Pano ID: ${res.pano_id}`);
        console.log(`   Localização Carro: ${res.location.lat}, ${res.location.lng}`);
        console.log(`   Data da foto: ${res.date}`);
      }
    }
  }
}

run();
