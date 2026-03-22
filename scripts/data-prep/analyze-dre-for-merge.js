/**
 * analyze-dre-for-merge.js
 * 
 * Analyze the DRE settlements CSV to understand what unique data
 * it adds beyond what we already have in the gazetteer.
 */
const fs = require('fs');
const path = require('path');

const DRE_FILE = path.join(__dirname, '..', 'HOT_data', 'dre_settlements.csv');
const GAZETTEER_FILE = path.join(__dirname, '..', 'apps', 'api', 'src', 'data', 'ghana-places.json');

// Load existing gazetteer
const gazetteer = JSON.parse(fs.readFileSync(GAZETTEER_FILE, 'utf-8'));
const gazNames = new Set();
gazetteer.forEach(e => {
  gazNames.add(e.n.toLowerCase().trim());
  if (e.a) gazNames.add(e.a.toLowerCase().trim());
});
console.log(`Existing gazetteer: ${gazetteer.length} entries, ${gazNames.size} unique names`);

// Parse DRE CSV
const lines = fs.readFileSync(DRE_FILE, 'utf-8').split('\n');
console.log(`DRE CSV: ${lines.length - 1} rows`);

const dreEntries = [];
let noName = 0;
let duplicateInGaz = 0;
let uniqueNew = 0;
const regionCounts = {};
const uniqueNames = new Set();

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  // Extract quoted fields
  const matches = line.match(/"([^"]*)"/g);
  if (!matches || matches.length < 7) continue;

  const lat = parseFloat(matches[2].replace(/"/g, ''));
  const lon = parseFloat(matches[3].replace(/"/g, ''));
  const villageName = matches[4].replace(/"/g, '').trim();
  const region = matches[5].replace(/"/g, '').trim();
  const district = matches[6].replace(/"/g, '').trim();

  // Get population (field index 14)
  const population = matches.length > 14 ? parseInt(matches[14].replace(/"/g, '')) || 0 : 0;
  // Get num_buildings (field index 9)
  const numBuildings = matches.length > 9 ? parseInt(matches[9].replace(/"/g, '')) || 0 : 0;

  if (!villageName || villageName.length < 2) {
    noName++;
    continue;
  }

  // Check if already in gazetteer
  const nameLower = villageName.toLowerCase().trim();
  if (gazNames.has(nameLower)) {
    duplicateInGaz++;
    continue;
  }

  uniqueNew++;
  uniqueNames.add(nameLower);
  regionCounts[region] = (regionCounts[region] || 0) + 1;

  dreEntries.push({
    name: villageName,
    lat: parseFloat(lat.toFixed(6)),
    lon: parseFloat(lon.toFixed(6)),
    region,
    district,
    population,
    numBuildings,
  });
}

console.log(`\n=== DRE ANALYSIS ===`);
console.log(`No name: ${noName}`);
console.log(`Already in gazetteer (by name): ${duplicateInGaz}`);
console.log(`Unique new entries: ${uniqueNew}`);
console.log(`Unique new names: ${uniqueNames.size}`);

console.log(`\n=== NEW ENTRIES BY REGION ===`);
Object.entries(regionCounts).sort((a,b) => b[1] - a[1]).forEach(([k,v]) => console.log(`  ${v} ${k}`));

// Show some sample NEW entries
console.log(`\n=== SAMPLE NEW ENTRIES (first 20) ===`);
dreEntries.slice(0, 20).forEach(e => {
  console.log(`  ${e.name} | ${e.district}, ${e.region} | pop=${e.population} bldgs=${e.numBuildings} | ${e.lat},${e.lon}`);
});

// Show entries with significant population
const withPop = dreEntries.filter(e => e.population > 500).sort((a,b) => b.population - a.population);
console.log(`\n=== ENTRIES WITH POP > 500 (${withPop.length} total, first 30) ===`);
withPop.slice(0, 30).forEach(e => {
  console.log(`  ${e.name} | pop=${e.population} | ${e.district}, ${e.region}`);
});

// Show entries with many buildings (>100 = significant settlement)
const bigSettlements = dreEntries.filter(e => e.numBuildings > 100).sort((a,b) => b.numBuildings - a.numBuildings);
console.log(`\n=== SETTLEMENTS WITH >100 BUILDINGS (${bigSettlements.length}, first 20) ===`);
bigSettlements.slice(0, 20).forEach(e => {
  console.log(`  ${e.name} | bldgs=${e.numBuildings} pop=${e.population} | ${e.district}, ${e.region}`);
});

console.log(`\nTotal DRE entries that would be added: ${dreEntries.length}`);
