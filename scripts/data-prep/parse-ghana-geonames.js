/**
 * Parse GeoNames GH.txt dataset and generate a compact JSON gazetteer
 * for the Riderguy geocoding service.
 *
 * Source: https://download.geonames.org/export/dump/GH.zip
 * License: Creative Commons Attribution 4.0
 *
 * Usage: node scripts/parse-ghana-geonames.js
 */
const fs = require('fs');
const path = require('path');

const lines = fs.readFileSync(path.join(__dirname, '..', 'GH_data', 'GH.txt'), 'utf8').trim().split('\n');

// Admin1 mapping (GeoNames admin code → region name)
const regionMap = {
  '01': 'Greater Accra', '02': 'Ashanti', '04': 'Central', '05': 'Eastern',
  '06': 'Northern', '08': 'Volta', '09': 'Western', '10': 'Upper East',
  '11': 'Upper West', '12': 'Ahafo', '13': 'Bono', '14': 'Bono East',
  '15': 'North East', '16': 'Oti', '17': 'Savannah', '18': 'Western North'
};

const places = [];
for (const line of lines) {
  const t = line.split('\t');
  if (t[6] !== 'P') continue; // Only populated places

  const name = t[1];
  const asciiName = t[2];
  const pop = parseInt(t[14]) || 0;
  const region = regionMap[t[10]] || '';

  // Parse alternate names (col 3) - keep useful short ones
  const altStr = t[3] || '';
  const rawAlts = altStr.split(',').map(a => a.trim()).filter(Boolean);
  // Only keep ASCII-ish alternate names, max 5, that differ from the main name
  const mainLower = name.toLowerCase();
  const asciiLower = asciiName.toLowerCase();
  const alts = rawAlts
    .filter(a => {
      const al = a.toLowerCase();
      return al !== mainLower && al !== asciiLower && a.length >= 2 && a.length <= 40
        && /^[a-zA-Z0-9\s\-'.()]+$/.test(a);
    })
    .slice(0, 5);

  const entry = {
    n: name,                 // display name (UTF-8)
    lat: parseFloat(parseFloat(t[4]).toFixed(5)),
    lon: parseFloat(parseFloat(t[5]).toFixed(5)),
    p: pop,                  // population (0 for many small places)
    r: region,               // region name
  };

  // Add ascii name only if it differs from display name
  if (asciiName !== name) {
    entry.a = asciiName;
  }

  // Add alternate names if any
  if (alts.length > 0) {
    entry.al = alts;
  }

  places.push(entry);
}

// Sort by population desc then name
places.sort((a, b) => b.p - a.p || a.n.localeCompare(b.n));

console.log('Total places:', places.length);
console.log('Places with pop>0:', places.filter(p => p.p > 0).length);
console.log('Places with alt names:', places.filter(p => p.al).length);
console.log('');
console.log('Top 15:');
places.slice(0, 15).forEach(p => {
  const alts = p.al ? ' [' + p.al.join(', ') + ']' : '';
  console.log('  ' + p.n + ' (' + p.r + ') pop=' + p.p + alts);
});
console.log('');

// Region breakdown
const byRegion = {};
for (const p of places) {
  const r = p.r || 'Unknown';
  byRegion[r] = (byRegion[r] || 0) + 1;
}
console.log('By Region:');
Object.entries(byRegion).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log('  ' + k + ': ' + v));
console.log('');

// Western Region detailed
const western = places.filter(p => p.r === 'Western');
console.log('Western Region (' + western.length + ' places), Top 20:');
western.slice(0, 20).forEach(p => {
  const alts = p.al ? ' [' + p.al.join(', ') + ']' : '';
  console.log('  ' + p.n + ': ' + p.lat + ', ' + p.lon + ' pop=' + p.p + alts);
});

// Create the output directory
const outDir = path.join(__dirname, '..', 'apps', 'api', 'src', 'data');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Write full dataset
const json = JSON.stringify(places);
fs.writeFileSync(path.join(outDir, 'ghana-places.json'), json);
console.log('');
console.log('Written: apps/api/src/data/ghana-places.json');
console.log('File size: ' + (json.length / 1024).toFixed(0) + 'KB');
console.log('Records: ' + places.length);
