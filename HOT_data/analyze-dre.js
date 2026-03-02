const fs = require('fs');
const lines = fs.readFileSync('dre_settlements.csv', 'utf-8').split('\n');
console.log('Total rows:', lines.length - 1);

// Parse CSV properly - village_name is field 5
const header = lines[0];
console.log('Header fields:', header.split('","').length);

let named = 0, unnamed = 0;
const names = new Set();
const regionCounts = {};

for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  // Extract fields between quotes
  const matches = lines[i].match(/"([^"]*)"/g);
  if (!matches || matches.length < 7) continue;
  
  const villageName = matches[4].replace(/"/g, '');
  const region = matches[5].replace(/"/g, '');
  
  if (villageName && villageName.length > 0) {
    named++;
    names.add(villageName);
    regionCounts[region] = (regionCounts[region] || 0) + 1;
  } else {
    unnamed++;
  }
}

console.log('Named settlements:', named);
console.log('Unique settlement names:', names.size);
console.log('\n=== REGIONS ===');
Object.entries(regionCounts).sort((a,b) => b[1] - a[1]).forEach(([k,v]) => console.log(v + ' ' + k));

// Show sample names
const arr = [...names].sort();
console.log('\nSample names:', arr.slice(0, 30).join(', '));
