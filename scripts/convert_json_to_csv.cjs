const fs = require('fs');
const path = require('path');

function jsonToCsv(jsonPath, csvPath) {
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const data = JSON.parse(raw);
  
  const headers = ['id', 'german', 'word_class', 'gender', 'plural', 'english', 'pronunciation', 'theme', 'antonym', 'example_de', 'example_en'];
  
  const csvRows = [];
  // Write BOM for Excel UTF-8 support just in case
  csvRows.push('\ufeff' + headers.join(','));
  
  for (const item of data) {
    const row = headers.map(header => {
      let val = item[header];
      if (val === null || val === undefined) {
        return '""';
      }
      // Replace double quotes with double-double quotes for CSV compliance
      const cleanVal = String(val).replace(/"/g, '""');
      return `"${cleanVal}"`;
    });
    csvRows.push(row.join(','));
  }
  
  fs.writeFileSync(csvPath, csvRows.join('\r\n'), 'utf8');
  console.log(`✓ Converted ${jsonPath} to ${csvPath} successfully.`);
}

try {
  jsonToCsv('a1/wordlist.json', 'a1/wordlist.csv');
  jsonToCsv('a2/wordlist.json', 'a2/wordlist.csv');
  jsonToCsv('b1/wordlist.json', 'b1/wordlist.csv');
  console.log('🎉 All levels successfully converted to CSV!');
} catch (e) {
  console.error('Failed to convert json to csv:', e);
  process.exit(1);
}
