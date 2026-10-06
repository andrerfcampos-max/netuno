const fs = require('fs');

function patch() {
  let content = fs.readFileSync('scripts/update_database.cjs', 'utf8');

  content = content.replace(/const XLSX = require\('xlsx'\);/, "const ExcelJS = require('exceljs');\nconst Papa = require('papaparse');");
  content = content.replace(/function runPipeline\(\) \{/, "async function runPipeline() {");

  content = content.replace(
    /const workbook = XLSX\.readFile\(inputFilePath\);\s+const sheetName = workbook\.SheetNames\[0\];\s+const worksheet = workbook\.Sheets\[sheetName\];\s+rawData = XLSX\.utils\.sheet_to_json\(worksheet\);/g,
    `const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(inputFilePath);
    const worksheet = workbook.worksheets[0];
    rawData = [];
    let headers = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        headers = row.values;
      } else {
        let obj = {};
        headers.forEach((h, i) => { if (h && i > 0) obj[h] = row.values[i]; });
        rawData.push(obj);
      }
    });`
  );

  content = content.replace(
    /const outWb = XLSX\.utils\.book_new\(\);\s+const outWs = XLSX\.utils\.json_to_sheet\(processedData\);\s+XLSX\.utils\.book_append_sheet\(outWb, outWs, 'data'\);/g,
    `const outWb = new ExcelJS.Workbook();
  const outWs = outWb.addWorksheet('data');
  if (processedData.length > 0) {
    outWs.columns = Object.keys(processedData[0]).map(k => ({ header: k, key: k }));
    outWs.addRows(processedData);
  }`
  );

  content = content.replace(
    /XLSX\.writeFile\(outWb, publicDest\);\s+XLSX\.writeFile\(outWb, rootDest\);/g,
    `await outWb.xlsx.writeFile(publicDest);
  await outWb.xlsx.writeFile(rootDest);`
  );

  content = content.replace(
    /const csvContent = '\\uFEFF' \+ XLSX\.utils\.sheet_to_csv\(outWs, \{ FS: ';' \}\);/g,
    `const csvContent = '\\uFEFF' + Papa.unparse(processedData, { delimiter: ';' });`
  );

  fs.writeFileSync('scripts/update_database.cjs', content, 'utf8');
  console.log('patched');
}

patch();
