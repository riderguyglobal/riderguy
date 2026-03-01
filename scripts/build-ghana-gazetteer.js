/**
 * build-ghana-gazetteer.js
 * 
 * Merges multiple open data sources into a single comprehensive Ghana gazetteer:
 * 
 * 1. GeoNames.org (CC BY 4.0) — 15,997 populated places
 * 2. HOT/OSM Populated Places (CC BY 4.0) — ~7,903 named settlements
 * 3. HOT/OSM Points of Interest (CC BY 4.0) — ~20,182 named POIs
 *    (includes health facilities, education, financial services, shops, etc.)
 * 
 * Output: apps/api/src/data/ghana-places.json
 * 
 * Data sources:
 * - https://download.geonames.org/export/dump/GH.zip
 * - https://data.humdata.org/dataset/hotosm_gha_populated_places
 * - https://data.humdata.org/dataset/hotosm_gha_points_of_interest
 * 
 * License: All sources are CC BY 4.0. Attribution required:
 * - GeoNames (geonames.org)
 * - OpenStreetMap contributors (openstreetmap.org)
 * - Humanitarian OpenStreetMap Team (hotosm.org)
 */

const fs = require('fs');
const path = require('path');

// =============================================================================
// CONFIG
// =============================================================================

const ROOT = path.resolve(__dirname, '..');
const HOT_DATA_DIR = path.join(ROOT, 'HOT_data');
const GEONAMES_FILE = path.join(ROOT, 'apps', 'api', 'src', 'data', 'ghana-places.json');
const OUTPUT_FILE = path.join(ROOT, 'apps', 'api', 'src', 'data', 'ghana-places.json');

// Minimum proximity (meters) to consider two entries duplicates
const DEDUP_RADIUS_M = 150;

// Haversine distance in meters
function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Normalize a name for dedup comparison
function normName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/\s+/g, '');
}

// =============================================================================
// 1. LOAD EXISTING GEONAMES DATA
// =============================================================================

console.log('=== Loading GeoNames data ===');
let geoEntries = [];
if (fs.existsSync(GEONAMES_FILE)) {
  const raw = JSON.parse(fs.readFileSync(GEONAMES_FILE, 'utf-8'));
  geoEntries = raw.map(e => ({
    n: e.n,               // name
    a: e.a || undefined,  // ascii name
    lat: e.lat,
    lon: e.lon,
    p: e.p || 0,          // population
    r: e.r || '',         // region
    al: e.al || undefined, // alternate names
    t: 'place',           // type: populated place
    src: 'gn',            // source: geonames
  }));
  console.log(`  Loaded ${geoEntries.length} GeoNames entries`);
} else {
  console.log('  WARNING: ghana-places.json not found, starting fresh');
}

// =============================================================================
// 2. LOAD HOT OSM POPULATED PLACES
// =============================================================================

console.log('\n=== Loading HOT OSM Populated Places ===');
const placesFile = path.join(HOT_DATA_DIR, 'places', 'hotosm_gha_populated_places_points_geojson.geojson');
let osmPlaces = [];
if (fs.existsSync(placesFile)) {
  const data = JSON.parse(fs.readFileSync(placesFile, 'utf-8'));
  data.features.forEach(f => {
    const p = f.properties;
    if (!p.name) return; // skip unnamed
    
    const [lon, lat] = f.geometry.coordinates;
    osmPlaces.push({
      n: p.name,
      a: p['name:en'] || undefined,
      lat: parseFloat(lat.toFixed(6)),
      lon: parseFloat(lon.toFixed(6)),
      p: parseInt(p.population) || 0,
      r: '',
      t: 'place',
      st: p.place || p.landuse || 'village', // subtype
      src: 'osm',
    });
  });
  console.log(`  Loaded ${osmPlaces.length} named OSM places (from ${data.features.length} total)`);
} else {
  console.log('  WARNING: OSM places file not found');
}

// =============================================================================
// 3. LOAD HOT OSM POINTS OF INTEREST
// =============================================================================

console.log('\n=== Loading HOT OSM Points of Interest ===');
const poiFile = path.join(HOT_DATA_DIR, 'poi', 'hotosm_gha_points_of_interest_points_geojson.geojson');
let osmPOIs = [];

// Map amenity/shop/tourism types to simpler categories for the gazetteer
const CATEGORY_MAP = {
  // Amenities
  hospital: 'health', clinic: 'health', pharmacy: 'health', doctors: 'health', dentist: 'health',
  school: 'education', university: 'education', college: 'education', kindergarten: 'education',
  bank: 'finance', atm: 'finance', mobile_money_agent: 'finance', bureau_de_change: 'finance',
  fuel: 'transport', bus_station: 'transport', taxi: 'transport', car_wash: 'transport',
  parking: 'transport', charging_station: 'transport',
  restaurant: 'food', fast_food: 'food', cafe: 'food', bar: 'food', pub: 'food',
  place_of_worship: 'worship', 
  police: 'public', fire_station: 'public', post_office: 'public', townhall: 'public',
  library: 'public', community_centre: 'public', courthouse: 'public',
  marketplace: 'market',
  // Shops and tourism handled below
};

if (fs.existsSync(poiFile)) {
  const data = JSON.parse(fs.readFileSync(poiFile, 'utf-8'));
  data.features.forEach(f => {
    const p = f.properties;
    if (!p.name) return; // skip unnamed
    
    const [lon, lat] = f.geometry.coordinates;
    
    // Determine category
    let cat = 'poi';
    let subtype = '';
    
    if (p.amenity) {
      subtype = p.amenity;
      cat = CATEGORY_MAP[p.amenity] || 'amenity';
    } else if (p.shop) {
      subtype = p.shop;
      cat = 'shop';
    } else if (p.tourism) {
      subtype = p.tourism;
      cat = 'tourism';
    } else if (p.man_made) {
      subtype = p.man_made;
      cat = 'infrastructure';
    }
    
    osmPOIs.push({
      n: p.name,
      a: p['name:en'] || undefined,
      lat: parseFloat(lat.toFixed(6)),
      lon: parseFloat(lon.toFixed(6)),
      p: 0,
      r: '',
      t: 'poi',
      c: cat,        // category
      st: subtype,   // subtype (e.g. 'fuel', 'hotel', 'school')
      src: 'osm',
    });
  });
  console.log(`  Loaded ${osmPOIs.length} named OSM POIs (from ${data.features.length} total)`);
  
  // Category breakdown
  const cats = {};
  osmPOIs.forEach(p => { cats[p.c] = (cats[p.c] || 0) + 1; });
  console.log('  Categories:');
  Object.entries(cats).sort((a,b) => b[1] - a[1]).forEach(([k,v]) => console.log(`    ${v} ${k}`));
} else {
  console.log('  WARNING: OSM POIs file not found');
}

// =============================================================================
// 4. DEDUP OSM PLACES vs GEONAMES
// =============================================================================

console.log('\n=== Deduplicating OSM Places vs GeoNames ===');

// Build a spatial index (simple grid) for GeoNames
const GRID_SIZE = 0.02; // ~2.2km grid cells
const geoGrid = {};

function gridKey(lat, lon) {
  return `${Math.floor(lat / GRID_SIZE)},${Math.floor(lon / GRID_SIZE)}`;
}

geoEntries.forEach((e, i) => {
  const key = gridKey(e.lat, e.lon);
  if (!geoGrid[key]) geoGrid[key] = [];
  geoGrid[key].push(i);
});

function findNearbyGeoEntries(lat, lon) {
  const results = [];
  const gLat = Math.floor(lat / GRID_SIZE);
  const gLon = Math.floor(lon / GRID_SIZE);
  for (let dLat = -1; dLat <= 1; dLat++) {
    for (let dLon = -1; dLon <= 1; dLon++) {
      const key = `${gLat + dLat},${gLon + dLon}`;
      if (geoGrid[key]) {
        geoGrid[key].forEach(i => results.push(geoEntries[i]));
      }
    }
  }
  return results;
}

let osmDupes = 0;
let osmNew = 0;
const newOsmPlaces = [];

osmPlaces.forEach(osm => {
  const nearby = findNearbyGeoEntries(osm.lat, osm.lon);
  const normOsm = normName(osm.n);
  
  let isDupe = false;
  for (const geo of nearby) {
    const dist = haversineM(osm.lat, osm.lon, geo.lat, geo.lon);
    if (dist < DEDUP_RADIUS_M) {
      const normGeo = normName(geo.n);
      // Same name or very close with similar name
      if (normOsm === normGeo || dist < 50) {
        isDupe = true;
        // If OSM has population data GeoNames doesn't, update
        if (osm.p > 0 && geo.p === 0) {
          geo.p = osm.p;
        }
        break;
      }
    }
  }
  
  if (!isDupe) {
    newOsmPlaces.push(osm);
    osmNew++;
  } else {
    osmDupes++;
  }
});

console.log(`  Duplicates skipped: ${osmDupes}`);
console.log(`  New unique places: ${osmNew}`);

// =============================================================================
// 5. MERGE & OUTPUT
// =============================================================================

console.log('\n=== Building Final Gazetteer ===');

// Combine all entries
const allEntries = [];

// 1. GeoNames places (base)
geoEntries.forEach(e => {
  allEntries.push({
    n: e.n,
    ...(e.a ? { a: e.a } : {}),
    lat: e.lat,
    lon: e.lon,
    ...(e.p > 0 ? { p: e.p } : {}),
    ...(e.r ? { r: e.r } : {}),
    ...(e.al && e.al.length > 0 ? { al: e.al } : {}),
    t: 'place',
    src: 'gn',
  });
});

// 2. New OSM places (not in GeoNames)
newOsmPlaces.forEach(e => {
  allEntries.push({
    n: e.n,
    ...(e.a ? { a: e.a } : {}),
    lat: e.lat,
    lon: e.lon,
    ...(e.p > 0 ? { p: e.p } : {}),
    ...(e.st ? { st: e.st } : {}),
    t: 'place',
    src: 'osm',
  });
});

// 3. POIs
osmPOIs.forEach(e => {
  allEntries.push({
    n: e.n,
    ...(e.a ? { a: e.a } : {}),
    lat: e.lat,
    lon: e.lon,
    c: e.c,
    ...(e.st ? { st: e.st } : {}),
    t: 'poi',
    src: 'osm',
  });
});

// Sort: places first (by population desc), then POIs
allEntries.sort((a, b) => {
  if (a.t !== b.t) return a.t === 'place' ? -1 : 1;
  if (a.t === 'place') return (b.p || 0) - (a.p || 0);
  return a.n.localeCompare(b.n);
});

console.log(`\n  GeoNames places: ${geoEntries.length}`);
console.log(`  New OSM places: ${newOsmPlaces.length}`);
console.log(`  OSM POIs: ${osmPOIs.length}`);
console.log(`  TOTAL entries: ${allEntries.length}`);

// Write output
const jsonStr = JSON.stringify(allEntries);
fs.writeFileSync(OUTPUT_FILE, jsonStr);
const sizeMB = (Buffer.byteLength(jsonStr) / 1024 / 1024).toFixed(2);
console.log(`\n  Output: ${OUTPUT_FILE}`);
console.log(`  Size: ${sizeMB} MB`);

// Summary stats
const placesCount = allEntries.filter(e => e.t === 'place').length;
const poiCount = allEntries.filter(e => e.t === 'poi').length;
const srcGN = allEntries.filter(e => e.src === 'gn').length;
const srcOSM = allEntries.filter(e => e.src === 'osm').length;

console.log(`\n=== FINAL SUMMARY ===`);
console.log(`  Places: ${placesCount}`);
console.log(`  POIs:   ${poiCount}`);
console.log(`  From GeoNames: ${srcGN}`);
console.log(`  From OSM:      ${srcOSM}`);
console.log(`  Grand Total:   ${allEntries.length}`);

// Category breakdown for POIs
const poiCats = {};
allEntries.filter(e => e.t === 'poi').forEach(e => {
  poiCats[e.c] = (poiCats[e.c] || 0) + 1;
});
console.log('\n  POI Categories:');
Object.entries(poiCats).sort((a,b) => b[1] - a[1]).forEach(([k,v]) => {
  console.log(`    ${v.toString().padStart(5)} ${k}`);
});
