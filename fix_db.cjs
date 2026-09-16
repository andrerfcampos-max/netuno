const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const DB_PATH_PUBLIC = path.join(__dirname, 'public', 'base-de-dados.xlsx');
const DB_PATH_ROOT = path.join(__dirname, 'base-de-dados.xlsx');
const LAGO_SUL_DIR = path.join(__dirname, 'public', 'hidrantes', 'lago_sul');

if (!fs.existsSync(LAGO_SUL_DIR)) {
  console.log("No Lago Sul directory found.");
  process.exit(0);
}

const files = fs.readdirSync(LAGO_SUL_DIR);
const validHydrants = new Set();
files.forEach(f => {
  if (f.endsWith('_hd.jpeg')) {
    validHydrants.add(f.replace('_hd.jpeg', ''));
  }
});

const workbook = xlsx.readFile(DB_PATH_PUBLIC);
const sheetName = workbook.SheetNames[0];
const allRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

let updated = 0;
const updatedRows = allRows.map(r => {
  if (validHydrants.has(r.nomHidrante)) {
    if (!r.fotoPerfil) {
      updated++;
      return { ...r, fotoPerfil: `/hidrantes/lago_sul/${r.nomHidrante}.jpeg` };
    }
  }
  return r;
});

console.log(`Updated ${updated} records.`);
if (updated > 0) {
  const newSheet = xlsx.utils.json_to_sheet(updatedRows);
  const newWorkbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(newWorkbook, newSheet, sheetName);
  xlsx.writeFile(newWorkbook, DB_PATH_PUBLIC);
  xlsx.writeFile(newWorkbook, DB_PATH_ROOT);
  const { execSync } = require('child_process');
  execSync('node scripts/export_clean_database.cjs', {stdio: 'inherit'});
}
