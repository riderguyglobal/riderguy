/**
 * merge-dre-settlements.js
 * 
 * Merges World Bank DRE Atlas settlement data into the existing Ghana gazetteer.
 * 
 * Source: World Bank Data-Rich Ecosystem (DRE) Atlas
 *   - https://datacatalog.worldbank.org/search/dataset/0042284
 *   - License: CC BY 4.0
 *   - 25,342 settlement clusters with population estimates, building counts,
 *     district/region info, infrastructure data
 * 
 * Filters:
 *   - Only entries with real village names (skips "Location #XXXX" entries)
 *   - Deduplicates against existing gazetteer by name + proximity (150m)
 * 
 * Run: node scripts/merge-dre-settlements.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GAZETTEER_FILE = path.join(ROOT, 'apps', 'api', 'src', 'data', 'ghana-places.json');
const DRE_CSV = path.join(ROOT, 'HOT_data', 'dre_settlements.csv');
const OUTPUT_FILE = GAZETTEER_FILE; // overwrite in place

const DEDUP_RADIUS_M = 150;

// =============================================================================
// UTILS
// =============================================================================

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/\s+/g, '');
}

const GRID_SIZE = 0.02; // ~2.2km cells
function gridKey(lat, lon) {
  return `${Math.floor(lat / GRID_SIZE)},${Math.floor(lon / GRID_SIZE)}`;
}

// Parse a CSV line respecting quoted fields
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

// Ghana region name normalization (DRE uses full names)
function normalizeRegion(region) {
  if (!region) return '';
  const r = region.trim();
  // Map common DRE region names to shorter forms
  const map = {
    'Greater Accra': 'Greater Accra',
    'Ashanti': 'Ashanti',
    'Central': 'Central',
    'Eastern': 'Eastern',
    'Northern': 'Northern',
    'Western': 'Western',
    'Volta': 'Volta',
    'Upper East': 'Upper East',
    'Upper West': 'Upper West',
    'Brong Ahafo': 'Brong-Ahafo',
    'Brong-Ahafo': 'Brong-Ahafo',
  };
  return map[r] || r;
}

// =============================================================================
// 1. LOAD EXISTING GAZETTEER
// =============================================================================

console.log('=== Loading existing gazetteer ===');
const existing = JSON.parse(fs.readFileSync(GAZETTEER_FILE, 'utf-8'));
console.log(`  Loaded ${existing.length} entries`);

const placesCount = existing.filter(e => e.t === 'place').length;
const poiCount = existing.filter(e => e.t === 'poi').length;
console.log(`  Places: ${placesCount}, POIs: ${poiCount}`);

// Build spatial index over ALL existing entries (for dedup)
const grid = {};
existing.forEach((e, i) => {
  const key = gridKey(e.lat, e.lon);
  if (!grid[key]) grid[key] = [];
  grid[key].push(i);
});

function findNearby(lat, lon) {
  const results = [];
  const gLat = Math.floor(lat / GRID_SIZE);
  const gLon = Math.floor(lon / GRID_SIZE);
  for (let dLat = -1; dLat <= 1; dLat++) {
    for (let dLon = -1; dLon <= 1; dLon++) {
      const key = `${gLat + dLat},${gLon + dLon}`;
      if (grid[key]) {
        grid[key].forEach(i => results.push(existing[i]));
      }
    }
  }
  return results;
}

// Also build a name lookup set for fast name-based dedup
const existingNames = new Set();
existing.filter(e => e.t === 'place').forEach(e => {
  existingNames.add(normName(e.n));
});

// =============================================================================
// 2. PARSE DRE CSV
// =============================================================================

console.log('\n=== Parsing DRE CSV ===');
const csvRaw = fs.readFileSync(DRE_CSV, 'utf-8');
const csvLines = csvRaw.split('\n');

// Parse header to find column indices
const headers = parseCSVLine(csvLines[0]);
const COL = {};
headers.forEach((h, i) => { COL[h] = i; });

console.log(`  Total CSV rows: ${csvLines.length - 1}`);
console.log(`  Key columns: lat=${COL.lat}, lon=${COL.lon}, village_name=${COL.village_name}, admin_cgaz_1=${COL.admin_cgaz_1}, admin_cgaz_2=${COL.admin_cgaz_2}, population=${COL.population}`);

const dreEntries = [];
let skippedGeneric = 0;
let skippedNoName = 0;
let skippedNoCoord = 0;

for (let i = 1; i < csvLines.length; i++) {
  const line = csvLines[i].trim();
  if (!line) continue;
  
  const fields = parseCSVLine(line);
  
  const villageName = fields[COL.village_name] || '';
  
  // Skip generic "Location #XXXX" entries
  if (!villageName || villageName === 'nan') {
    skippedNoName++;
    continue;
  }
  if (/^Location\s*#\d+$/i.test(villageName)) {
    skippedGeneric++;
    continue;
  }
  
  const lat = parseFloat(fields[COL.lat]);
  const lon = parseFloat(fields[COL.lon]);
  
  if (isNaN(lat) || isNaN(lon)) {
    skippedNoCoord++;
    continue;
  }
  
  const pop = parseInt(fields[COL.population]) || 0;
  const region = normalizeRegion(fields[COL.admin_cgaz_1]);
  const district = (fields[COL.admin_cgaz_2] || '').trim();
  const numBuildings = parseInt(fields[COL.num_buildings]) || 0;
  
  dreEntries.push({
    n: villageName.trim(),
    lat: parseFloat(lat.toFixed(6)),
    lon: parseFloat(lon.toFixed(6)),
    p: pop,
    r: region,
    district,
    numBuildings,
    t: 'place',
    src: 'dre',
  });
}

console.log(`  Parsed ${dreEntries.length} named DRE settlements`);
console.log(`  Skipped: ${skippedGeneric} generic "Location #", ${skippedNoName} no name, ${skippedNoCoord} no coords`);

// =============================================================================
// 3. DEDUP DRE vs EXISTING GAZETTEER
// =============================================================================

console.log('\n=== Deduplicating DRE vs existing gazetteer ===');

let dreDupes = 0;
let dreNew = 0;
let dreUpdated = 0; // existing entries enriched with DRE population/region data
const newDreEntries = [];

dreEntries.forEach(dre => {
  const norm = normName(dre.n);
  const nearby = findNearby(dre.lat, dre.lon);
  
  let isDupe = false;
  for (const ex of nearby) {
    if (ex.t !== 'place') continue; // only dedup against places, not POIs
    
    const dist = haversineM(dre.lat, dre.lon, ex.lat, ex.lon);
    if (dist < DEDUP_RADIUS_M) {
      const normEx = normName(ex.n);
      if (norm === normEx || dist < 50) {
        isDupe = true;
        // Enrich existing entry with DRE data
        let updated = false;
        if (dre.p > 0 && (!ex.p || ex.p === 0)) {
          ex.p = dre.p;
          updated = true;
        }
        if (dre.r && !ex.r) {
          ex.r = dre.r;
          updated = true;
        }
        if (updated) dreUpdated++;
        break;
      }
    }
    
    // Also check by name alone within 5km (larger radius for name-only match)
    if (dist < 5000 && norm === normName(ex.n)) {
      isDupe = true;
      if (dre.p > 0 && (!ex.p || ex.p === 0)) {
        ex.p = dre.p;
        dreUpdated++;
      }
      break;
    }
  }
  
  if (!isDupe) {
    newDreEntries.push(dre);
    dreNew++;
    
    // Add to grid so subsequent DRE entries dedup against each other too
    const key = gridKey(dre.lat, dre.lon);
    if (!grid[key]) grid[key] = [];
    const idx = existing.length + newDreEntries.length - 1;
    // We'll use a temp reference; the actual index doesn't matter for proximity check
  } else {
    dreDupes++;
  }
});

console.log(`  Duplicates: ${dreDupes}`);
console.log(`  Existing entries enriched with DRE data: ${dreUpdated}`);
console.log(`  New unique settlements from DRE: ${dreNew}`);

// Regional breakdown of new entries
const regionBreakdown = {};
newDreEntries.forEach(e => {
  const r = e.r || 'Unknown';
  regionBreakdown[r] = (regionBreakdown[r] || 0) + 1;
});
console.log('\n  New DRE entries by region:');
Object.entries(regionBreakdown)
  .sort((a, b) => b[1] - a[1])
  .forEach(([r, count]) => console.log(`    ${count.toString().padStart(5)} ${r}`));

// =============================================================================
// 4. SELF-DEDUP NEW DRE ENTRIES
// =============================================================================

console.log('\n=== Self-dedup among new DRE entries ===');

// Some DRE entries may refer to the same settlement from different clusters
const dreGrid = {};
newDreEntries.forEach((e, i) => {
  const key = gridKey(e.lat, e.lon);
  if (!dreGrid[key]) dreGrid[key] = [];
  dreGrid[key].push(i);
});

const keptIndices = new Set();
const selfDupes = new Set();

for (let i = 0; i < newDreEntries.length; i++) {
  if (selfDupes.has(i)) continue;
  keptIndices.add(i);
  
  const e = newDreEntries[i];
  const norm = normName(e.n);
  const gLat = Math.floor(e.lat / GRID_SIZE);
  const gLon = Math.floor(e.lon / GRID_SIZE);
  
  for (let dLat = -1; dLat <= 1; dLat++) {
    for (let dLon = -1; dLon <= 1; dLon++) {
      const key = `${gLat + dLat},${gLon + dLon}`;
      if (!dreGrid[key]) continue;
      for (const j of dreGrid[key]) {
        if (j <= i || selfDupes.has(j)) continue;
        const other = newDreEntries[j];
        const dist = haversineM(e.lat, e.lon, other.lat, other.lon);
        if (dist < DEDUP_RADIUS_M && normName(other.n) === norm) {
          selfDupes.add(j);
          // Keep the one with higher population
          if ((other.p || 0) > (e.p || 0)) {
            e.p = other.p;
          }
        }
      }
    }
  }
}

const dedupedDre = newDreEntries.filter((_, i) => keptIndices.has(i));
console.log(`  Self-duplicates removed: ${selfDupes.size}`);
console.log(`  Final new DRE entries: ${dedupedDre.length}`);

// =============================================================================
// 5. MERGE & OUTPUT
// =============================================================================

console.log('\n=== Building Final Merged Gazetteer ===');

// Add DRE entries to existing (converting to final format)
const dreFormatted = dedupedDre.map(e => {
  const entry = {
    n: e.n,
    lat: e.lat,
    lon: e.lon,
    ...(e.p > 0 ? { p: e.p } : {}),
    ...(e.r ? { r: e.r } : {}),
    t: 'place',
    src: 'dre',
  };
  return entry;
});

// Combine: existing (possibly enriched) + new DRE
const all = [...existing, ...dreFormatted];

// Re-sort: places first (by population desc), then POIs (alphabetically)
all.sort((a, b) => {
  if (a.t !== b.t) return a.t === 'place' ? -1 : 1;
  if (a.t === 'place') return (b.p || 0) - (a.p || 0);
  return a.n.localeCompare(b.n);
});

// Stats
const finalPlaces = all.filter(e => e.t === 'place').length;
const finalPOIs = all.filter(e => e.t === 'poi').length;
const fromGN = all.filter(e => e.src === 'gn').length;
const fromOSM = all.filter(e => e.src === 'osm').length;
const fromDRE = all.filter(e => e.src === 'dre').length;

console.log(`  Places: ${finalPlaces}`);
console.log(`  POIs:   ${finalPOIs}`);
console.log(`  From GeoNames: ${fromGN}`);
console.log(`  From OSM:      ${fromOSM}`);
console.log(`  From DRE:      ${fromDRE}`);
console.log(`  TOTAL:         ${all.length}`);

// Write
const jsonStr = JSON.stringify(all);
fs.writeFileSync(OUTPUT_FILE, jsonStr);
const sizeMB = (Buffer.byteLength(jsonStr) / 1024 / 1024).toFixed(2);
console.log(`\n  Output: ${OUTPUT_FILE}`);
console.log(`  Size: ${sizeMB} MB`);

console.log('\n=== DONE ===');
console.log(`  Previous: ${existing.length} entries`);
console.log(`  Added:    ${dedupedDre.length} DRE settlements`);
console.log(`  Enriched: ${dreUpdated} existing entries with DRE population/region data`);
console.log(`  Final:    ${all.length} entries`);
