#!/usr/bin/env node
/**
 * Merge NGA/OCHA Ghana Settlements data into the existing gazetteer.
 * 
 * Sources:
 * 1. HDX Ghana Settlements SHP (NGA/OCHA) - local file
 * 2. NGA GEOnet Names Server REST API - fetched via ArcGIS REST
 * 
 * Deduplicates against existing entries by name+proximity.
 */

const fs = require('fs');
const path = require('path');
const shapefile = require('shapefile');

const GAZETTEER_PATH = path.join(__dirname, '..', 'apps', 'api', 'src', 'data', 'ghana-places.json');
const HDX_SHP_PATH = path.join(__dirname, '..', 'HOT_data', 'HDX_Settlements', 'gha_ppl_1m_NGA.shp');
const HDX_DBF_PATH = path.join(__dirname, '..', 'HOT_data', 'HDX_Settlements', 'gha_ppl_1m_NGA.dbf');

// Ghana bounding box for validation
const GHANA_BOUNDS = { minLat: 4.5, maxLat: 11.5, minLon: -3.5, maxLon: 1.5 };

function isInGhana(lat, lon) {
  return lat >= GHANA_BOUNDS.minLat && lat <= GHANA_BOUNDS.maxLat &&
         lon >= GHANA_BOUNDS.minLon && lon <= GHANA_BOUNDS.maxLon;
}

function normalizeString(s) {
  if (!s) return '';
  return s.trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function loadExistingGazetteer() {
  console.log('Loading existing gazetteer...');
  const data = JSON.parse(fs.readFileSync(GAZETTEER_PATH, 'utf8'));
  console.log(`  Existing entries: ${data.length}`);
  return data;
}

async function readHDXShapefile() {
  console.log('\n--- Reading HDX Ghana Settlements Shapefile ---');
  const entries = [];
  const source = await shapefile.open(HDX_SHP_PATH, HDX_DBF_PATH);
  
  let first = true;
  let count = 0;
  
  while (true) {
    const result = await source.read();
    if (result.done) break;
    count++;
    
    const feature = result.value;
    const props = feature.properties;
    
    // Log first record to understand schema
    if (first) {
      console.log('  Sample record fields:', Object.keys(props));
      console.log('  Sample record:', JSON.stringify(props, null, 2).substring(0, 500));
      first = false;
    }
    
    // Extract coordinates
    let lat, lon;
    if (feature.geometry && feature.geometry.type === 'Point') {
      [lon, lat] = feature.geometry.coordinates;
    } else if (feature.geometry && feature.geometry.type === 'MultiPoint') {
      [lon, lat] = feature.geometry.coordinates[0];
    } else {
      continue;
    }
    
    if (!isInGhana(lat, lon)) continue;
    
    // Filter by country code
    const cntry = props.CNTRY_CODE || props.cntry_code || '';
    if (cntry && cntry !== 'GHA') continue;
    
    // Try to extract name - common field names in NGA data
    const name = props.NAME || props.name || props.Name || props.FULL_NAME || 
                 props.full_name || props.FEATURE_NA || props.feature_na ||
                 props.TOWN || props.town || props.SETTLEMENT || props.settlement ||
                 props.LABEL || props.label || '';
    
    if (!name || name.trim().length < 2) continue;
    
    // Try to extract admin info
    const admin = props.ADM1_NAME || props.adm1_name || props.ADMIN1 || props.admin1 ||
                  props.REGION || props.region || props.PROVINCE || props.province || '';
    
    const entry = {
      n: name.trim(),
      lat: Math.round(lat * 10000) / 10000,
      lon: Math.round(lon * 10000) / 10000,
      t: 'place',
      src: 'nga'
    };
    
    if (admin) entry.r = admin.trim();
    
    entries.push(entry);
  }
  
  console.log(`  Total features read: ${count}`);
  console.log(`  Valid entries with names in Ghana: ${entries.length}`);
  return entries;
}

async function fetchNGARestAPI() {
  console.log('\n--- Fetching NGA GEOnet Names Server REST API ---');
  console.log('  Using ArcGIS REST endpoint (max 3000 per request)...');
  
  const baseUrl = 'https://geonames.nga.mil/geon-ags/rest/services/RESEARCH/GIS_OUTPUT/MapServer/0/query';
  const allEntries = [];
  let offset = 0;
  const batchSize = 2000; // Stay under 3000 limit
  let totalFetched = 0;
  let hasMore = true;
  
  // Ghana bbox: -3.5,4.5,1.5,11.5
  const geometry = '-3.5,4.5,1.5,11.5';
  
  while (hasMore) {
    const params = new URLSearchParams({
      where: "cc_ft='GHA'",
      outFields: '*',
      returnGeometry: 'true',
      resultOffset: offset.toString(),
      resultRecordCount: batchSize.toString(),
      f: 'json'
    });
    
    const url = `${baseUrl}?${params}`;
    console.log(`  Fetching batch at offset ${offset}...`);
    
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(60000)
      });
      
      if (!response.ok) {
        console.log(`  HTTP ${response.status} - stopping`);
        hasMore = false;
        continue;
      }
      
      const data = await response.json();
      
      if (data.error) {
        console.log(`  API Error: ${data.error.message}`);
        hasMore = false;
        continue;
      }
      
      const features = data.features || [];
      console.log(`  Got ${features.length} features`);
      
      if (features.length === 0) {
        hasMore = false;
        continue;
      }
      
      // Log first record schema
      if (totalFetched === 0 && features.length > 0) {
        const attrs = features[0].attributes;
        console.log('  Sample fields:', Object.keys(attrs));
        console.log('  Sample:', JSON.stringify(attrs, null, 2).substring(0, 500));
      }
      
      for (const feat of features) {
        const attrs = feat.attributes;
        const geom = feat.geometry;
        
        if (!geom || geom.x === undefined || geom.y === undefined) continue;
        
        const lat = geom.y;
        const lon = geom.x;
        
        if (!isInGhana(lat, lon)) continue;
        
        // Filter by country code - NGA GNS uses cc_ft for country
        const cc = attrs.cc_ft || attrs.CC_FT || '';
        if (cc && cc !== 'GHA') continue;
        
        // Get name - NGA GNS schema uses FULL_NAME_RO, FULL_NAME, NAME
        const name = attrs.FULL_NAME_RO || attrs.FULL_NAME || attrs.NAME || 
                     attrs.full_name_ro || attrs.full_name || attrs.name || '';
        
        if (!name || name.trim().length < 2) continue;
        
        // Check feature class (P = populated place, S = spot, L = locality, etc.)
        const fc = attrs.FC || attrs.FEAT_CLASS || attrs.feat_class || '';
        
        const entry = {
          n: name.trim(),
          lat: Math.round(lat * 10000) / 10000,
          lon: Math.round(lon * 10000) / 10000,
          t: (fc === 'P' || fc === 'A' || fc === 'L') ? 'place' : 'poi',
          src: 'nga'
        };
        
        // Admin region
        const adm1 = attrs.ADM1_NAME || attrs.adm1_name || '';
        if (adm1) entry.r = adm1.trim();
        
        allEntries.push(entry);
      }
      
      totalFetched += features.length;
      offset += features.length;
      
      // Check if there are more records
      if (data.exceededTransferLimit === true || features.length >= batchSize) {
        hasMore = true;
      } else {
        hasMore = false;
      }
      
      // Safety limit
      if (totalFetched >= 50000) {
        console.log('  Safety limit reached (50K features)');
        hasMore = false;
      }
      
    } catch (err) {
      console.log(`  Fetch error: ${err.message}`);
      hasMore = false;
    }
  }
  
  console.log(`  Total features fetched: ${totalFetched}`);
  console.log(`  Valid entries: ${allEntries.length}`);
  return allEntries;
}

function deduplicateAgainstExisting(newEntries, existingEntries) {
  console.log('\n--- Deduplicating ---');
  
  // Build lookup index from existing entries
  const existingIndex = new Map();
  for (const entry of existingEntries) {
    const key = normalizeString(entry.n);
    if (!existingIndex.has(key)) {
      existingIndex.set(key, []);
    }
    existingIndex.get(key).push(entry);
  }
  
  const unique = [];
  let dupeCount = 0;
  
  for (const entry of newEntries) {
    const key = normalizeString(entry.n);
    const existing = existingIndex.get(key);
    
    if (existing) {
      // Check spatial proximity - if within 1km, it's a duplicate
      const isDupe = existing.some(e => 
        haversineKm(entry.lat, entry.lon, e.lat, e.lon) < 1.0
      );
      if (isDupe) {
        dupeCount++;
        continue;
      }
    }
    
    unique.push(entry);
    
    // Also add to index so new entries don't duplicate each other
    if (!existingIndex.has(key)) {
      existingIndex.set(key, []);
    }
    existingIndex.get(key).push(entry);
  }
  
  console.log(`  Duplicates found: ${dupeCount}`);
  console.log(`  New unique entries: ${unique.length}`);
  return unique;
}

async function main() {
  console.log('=== NGA Ghana Data Integration ===\n');
  
  // Step 1: Load existing gazetteer
  const existing = await loadExistingGazetteer();
  
  // Step 2: Read HDX shapefile
  let hdxEntries = [];
  try {
    hdxEntries = await readHDXShapefile();
  } catch (err) {
    console.log(`  HDX shapefile error: ${err.message}`);
  }
  
  // Step 3: Fetch NGA REST API
  let ngaEntries = [];
  try {
    ngaEntries = await fetchNGARestAPI();
  } catch (err) {
    console.log(`  NGA REST API error: ${err.message}`);
  }
  
  // Step 4: Combine all new entries
  const allNew = [...hdxEntries, ...ngaEntries];
  console.log(`\nTotal new entries before dedup: ${allNew.length}`);
  console.log(`  From HDX SHP: ${hdxEntries.length}`);
  console.log(`  From NGA REST: ${ngaEntries.length}`);
  
  if (allNew.length === 0) {
    console.log('\nNo new entries to merge. Exiting.');
    return;
  }
  
  // Step 5: Deduplicate within new entries first
  console.log('\n--- Deduplicating within new source ---');
  const deduped = [];
  const seenNew = new Map();
  for (const entry of allNew) {
    const key = normalizeString(entry.n);
    if (!seenNew.has(key)) {
      seenNew.set(key, []);
    }
    const isDupe = seenNew.get(key).some(e =>
      haversineKm(entry.lat, entry.lon, e.lat, e.lon) < 1.0
    );
    if (!isDupe) {
      deduped.push(entry);
      seenNew.get(key).push(entry);
    }
  }
  console.log(`  After internal dedup: ${deduped.length}`);
  
  // Step 6: Deduplicate against existing gazetteer
  const unique = deduplicateAgainstExisting(deduped, existing);
  
  if (unique.length === 0) {
    console.log('\nAll entries are duplicates. No changes needed.');
    return;
  }
  
  // Step 7: Merge into gazetteer
  console.log('\n--- Merging ---');
  const merged = [...existing, ...unique];
  
  // Sort: places first (by pop desc), then POIs (alphabetically)
  merged.sort((a, b) => {
    if (a.t !== b.t) return a.t === 'place' ? -1 : 1;
    if (a.t === 'place') {
      const popA = a.p || 0;
      const popB = b.p || 0;
      if (popA !== popB) return popB - popA;
    }
    return a.n.localeCompare(b.n);
  });
  
  // Step 8: Save
  console.log(`\n--- Saving ---`);
  console.log(`  Previous: ${existing.length} entries`);
  console.log(`  Added: ${unique.length} entries`);
  console.log(`  New total: ${merged.length} entries`);
  
  fs.writeFileSync(GAZETTEER_PATH, JSON.stringify(merged));
  
  const stats = fs.statSync(GAZETTEER_PATH);
  console.log(`  File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  
  // Source breakdown
  const sources = {};
  for (const e of merged) {
    sources[e.src || 'unknown'] = (sources[e.src || 'unknown'] || 0) + 1;
  }
  console.log('\n--- Source Breakdown ---');
  for (const [src, count] of Object.entries(sources)) {
    console.log(`  ${src}: ${count}`);
  }
  
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
