const fs = require('fs');
const path = require('path');
const https = require('https');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const GEMINI_KEY = (envContent.match(/GEMINI_API_KEY=(.*)/) || [])[1]?.trim().replace(/['"]/g, '');

const img112 = fs.readFileSync('C:/Users/andre/.gemini/antigravity/brain/154ef160-01a9-469b-bd4b-52b283be43ef/.user_uploaded/media_1791385323792.jpg').toString('base64');
const img125 = fs.readFileSync('C:/Users/andre/.gemini/antigravity/brain/154ef160-01a9-469b-bd4b-52b283be43ef/.user_uploaded/media_1791385578398.jpg').toString('base64');

async function testVision(base64Image, label) {
  const prompt = "Você é um perito do Corpo de Bombeiros Militar. Analise detalhadamente a imagem fornecida. Procure o hidrante de coluna urbano de calçada/rua. Descreva exatamente onde ele está na imagem (posição horizontal 0.0 a 1.0, o que tem perto dele, cor, estado, etc.) e diga se você o encontrou e com qual confiança (0 a 100).";
  
  const payload = JSON.stringify({
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: base64Image } }] }],
    generationConfig: { temperature: 0.1 }
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_KEY}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.candidates[0].content.parts[0].text);
        } catch (e) {
          resolve("Erro: " + data);
        }
      });
    });
    req.on('error', e => resolve("Erro req: " + e.message));
    req.write(payload);
    req.end();
  });
}

async function run() {
  console.log("=== ANÁLISE DO PRINT DO USUÁRIO 112 ===");
  console.log(await testVision(img112, "112"));

  console.log("\n=== ANÁLISE DO PRINT DO USUÁRIO 125 ===");
  console.log(await testVision(img125, "125"));
}

run();
