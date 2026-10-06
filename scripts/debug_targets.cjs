const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const keyMatch = env.match(/GOOGLE_MAPS_API_KEY=(.*)/);
const key = keyMatch ? keyMatch[1].trim().replace(/['"]/g, '') : '';

async function getMeta(lat, lng) {
  const url = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&radius=50&key=${key}`;
  const res = await (await fetch(url)).json();
  return res;
}

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

async function run() {
  const targets = [
    { nom: 'LAS00004', lat: -15.832194, lng: -47.878917 },
    { nom: 'LAS00009', lat: -15.862944, lng: -47.874694 },
    { nom: 'LAS00010', lat: -15.862472, lng: -47.875667 }
  ];

  for (const t of targets) {
    const meta = await getMeta(t.lat, t.lng);
    console.log(`\n=== ${t.nom} ===`);
    console.log('GPS Cadastro:', t.lat, t.lng);
    if (meta && meta.status === 'OK') {
      const carLat = meta.location.lat;
      const carLng = meta.location.lng;
      const heading = calculateBearing(carLat, carLng, t.lat, t.lng);
      console.log('Street View Carro:', carLat, carLng, 'PanoId:', meta.pano_id);
      console.log('Bearing Carro -> GPS:', heading.toFixed(1) + '°');
      console.log('Oposto (180°):', ((heading + 180) % 360).toFixed(1) + '°');
    } else {
      console.log('Meta Status:', meta ? meta.status : 'null');
    }
  }
}

run();
