# OSM Ghana Custom Tileset — Setup Guide

Upload OpenStreetMap (OSM) data for Ghana as a **Mapbox Custom Tileset** to
improve street-level detail, building outlines and POI coverage on all
RiderGuy maps.

> **Why?** Mapbox's default Ghana street-name coverage is incomplete. OSM has
> community-contributed data that fills many gaps, especially in Accra, Kumasi,
> Takoradi, Tamale and Cape Coast.

---

## 1. Prerequisites

| Tool | Purpose | Install |
|------|---------|---------|
| **Mapbox account** | Upload target | <https://account.mapbox.com> |
| **Mapbox CLI (tilesets-cli)** | Upload & publish | `pip install mapbox-tilesets` |
| **tippecanoe** | Convert GeoJSON → MBTiles | `brew install tippecanoe` (macOS) / build from source on Linux |
| **osmium-tool** | Filter & convert OSM PBF | `brew install osmium-tool` / `apt install osmium-tool` |
| **ogr2ogr** (GDAL) | Convert Shapefiles if needed | `brew install gdal` / `apt install gdal-bin` |
| **Mapbox access token** | With `tilesets:write`, `tilesets:read` scopes | Generate in Dashboard → Tokens |

Set up your Mapbox token:

```bash
export MAPBOX_ACCESS_TOKEN="sk.eyJ1Ijo..."   # secret token with tilesets:write scope
```

---

## 2. Download OSM Ghana Data

Geofabrik mirrors updated daily:

```bash
# Option A: PBF (smaller, 104 MB) — recommended
wget https://download.geofabrik.de/africa/ghana-latest.osm.pbf

# Option B: Shapefiles (278 MB, pre-split by layer)
wget https://download.geofabrik.de/africa/ghana-latest-free.shp.zip
unzip ghana-latest-free.shp.zip -d ghana-shp
```

---

## 3. Extract & Convert to GeoJSON

### 3a. From PBF (recommended)

Extract road network, buildings and POIs into separate GeoJSON files:

```bash
# Roads (highway=*)
osmium tags-filter ghana-latest.osm.pbf w/highway -o ghana-roads.osm.pbf
osmium export ghana-roads.osm.pbf -o ghana-roads.geojson --geometry-types=linestring

# Buildings
osmium tags-filter ghana-latest.osm.pbf w/building -o ghana-buildings.osm.pbf
osmium export ghana-buildings.osm.pbf -o ghana-buildings.geojson --geometry-types=polygon

# Points of Interest (amenity, shop, office, tourism)
osmium tags-filter ghana-latest.osm.pbf n/amenity,shop,office,tourism -o ghana-poi.osm.pbf
osmium export ghana-poi.osm.pbf -o ghana-poi.geojson --geometry-types=point

# Place names / localities
osmium tags-filter ghana-latest.osm.pbf n/place -o ghana-places.osm.pbf
osmium export ghana-places.osm.pbf -o ghana-places.geojson --geometry-types=point
```

### 3b. From Shapefiles (alternative)

```bash
# Convert each shapefile layer to GeoJSON
ogr2ogr -f GeoJSON ghana-roads.geojson ghana-shp/gis_osm_roads_free_1.shp
ogr2ogr -f GeoJSON ghana-buildings.geojson ghana-shp/gis_osm_buildings_a_free_1.shp
ogr2ogr -f GeoJSON ghana-poi.geojson ghana-shp/gis_osm_pois_free_1.shp
ogr2ogr -f GeoJSON ghana-places.geojson ghana-shp/gis_osm_places_free_1.shp
```

---

## 4. Create MBTiles with Tippecanoe

Tippecanoe creates vector tiles optimised for Mapbox:

```bash
# Roads — keep detail at zoom 8-16, drop tiny paths below zoom 12
tippecanoe \
  -o ghana-roads.mbtiles \
  -z 16 -Z 8 \
  --drop-densest-as-needed \
  --extend-zooms-if-still-dropping \
  --force \
  -l ghana_roads \
  ghana-roads.geojson

# Buildings — zoom 13-16 (only visible when zoomed in)
tippecanoe \
  -o ghana-buildings.mbtiles \
  -z 16 -Z 13 \
  --drop-densest-as-needed \
  --force \
  -l ghana_buildings \
  ghana-buildings.geojson

# POIs — zoom 10-16
tippecanoe \
  -o ghana-poi.mbtiles \
  -z 16 -Z 10 \
  --drop-densest-as-needed \
  --force \
  -l ghana_poi \
  ghana-poi.geojson

# Places — zoom 5-16
tippecanoe \
  -o ghana-places.mbtiles \
  -z 16 -Z 5 \
  --force \
  -l ghana_places \
  ghana-places.geojson
```

---

## 5. Upload to Mapbox

### Option A: Mapbox Uploads API (simpler, for < 300 MB)

```bash
# Upload each MBTiles as a tileset
mapbox upload riderguy.ghana-roads ghana-roads.mbtiles
mapbox upload riderguy.ghana-buildings ghana-buildings.mbtiles
mapbox upload riderguy.ghana-poi ghana-poi.mbtiles
mapbox upload riderguy.ghana-places ghana-places.mbtiles
```

You can also upload via the Mapbox Studio web UI:
**Studio → Tilesets → New tileset → Upload file**

### Option B: Mapbox Tiling Service (MTS) — for larger datasets

```bash
# 1. Create tileset source from line-delimited GeoJSON
tilesets upload-source YOUR_USERNAME ghana-roads-src ghana-roads.geojson

# 2. Create a recipe (see recipe example below)
tilesets create YOUR_USERNAME.ghana-roads --recipe recipe-roads.json --name "Ghana Roads"

# 3. Publish
tilesets publish YOUR_USERNAME.ghana-roads
```

**Recipe example (`recipe-roads.json`):**

```json
{
  "version": 1,
  "layers": {
    "ghana_roads": {
      "source": "mapbox://tileset-source/YOUR_USERNAME/ghana-roads-src",
      "minzoom": 8,
      "maxzoom": 16,
      "features": {
        "attributes": {
          "allowed_output": ["name", "highway", "ref", "surface", "oneway"]
        }
      }
    }
  }
}
```

---

## 6. Add Tileset as a Layer in Mapbox Studio

1. Open **Mapbox Studio** → **Styles** → your RiderGuy style
2. Click **+** (Add layer)
3. Source → choose your uploaded tileset (e.g. `riderguy.ghana-roads`)
4. Style the layer (line color, width, label placement)
5. **Publish** the style

The tileset will now appear automatically on all RiderGuy maps that use the
published style URL.

---

## 7. Add Tileset Programmatically (optional)

If you want to add the layer at runtime instead of in the Studio style,
use the `map.addSource` + `map.addLayer` API:

```typescript
// In map-core.ts or after map 'load' event
map.addSource('ghana-roads', {
  type: 'vector',
  url: 'mapbox://riderguy.ghana-roads',
});

map.addLayer({
  id: 'ghana-roads-layer',
  type: 'line',
  source: 'ghana-roads',
  'source-layer': 'ghana_roads',
  paint: {
    'line-color': '#888',
    'line-width': 1.5,
  },
  // Insert below labels so text is still readable
}, 'road-label');

// Optional: add road name labels
map.addLayer({
  id: 'ghana-roads-labels',
  type: 'symbol',
  source: 'ghana-roads',
  'source-layer': 'ghana_roads',
  layout: {
    'text-field': ['get', 'name'],
    'text-size': 11,
    'symbol-placement': 'line',
    'text-max-angle': 30,
  },
  paint: {
    'text-color': '#555',
    'text-halo-color': '#fff',
    'text-halo-width': 1,
  },
}, 'road-label');
```

---

## 8. Keeping Data Fresh

OSM Ghana data changes daily. To keep the tileset current:

```bash
#!/bin/bash
# update-ghana-tileset.sh — run weekly via cron

set -e

cd /path/to/osm-data

# 1. Download fresh data
wget -N https://download.geofabrik.de/africa/ghana-latest.osm.pbf

# 2. Extract roads
osmium tags-filter ghana-latest.osm.pbf w/highway -o ghana-roads.osm.pbf --overwrite
osmium export ghana-roads.osm.pbf -o ghana-roads.geojson --geometry-types=linestring --overwrite

# 3. Rebuild tiles
tippecanoe -o ghana-roads.mbtiles -z 16 -Z 8 \
  --drop-densest-as-needed --extend-zooms-if-still-dropping \
  --force -l ghana_roads ghana-roads.geojson

# 4. Re-upload
mapbox upload riderguy.ghana-roads ghana-roads.mbtiles

echo "✓ Ghana roads tileset updated $(date)"
```

Add to crontab:
```bash
# Every Sunday at 2 AM
0 2 * * 0 /path/to/update-ghana-tileset.sh >> /var/log/ghana-tileset.log 2>&1
```

---

## 9. Coverage Notes

- **OSM Ghana is community-contributed.** Coverage varies — Accra and major
  cities have good road data; rural areas may be sparse.
- **Contribute back:** Encourage riders to use StreetComplete or iD editor to
  add missing roads. Every edit improves the dataset for everyone.
- **License:** OSM data is ODbL. You can use it freely but must credit
  "© OpenStreetMap contributors" on the map alongside the Mapbox attribution.
- **Data size:** The PBF is ~104 MB. After filtering to roads only, the
  GeoJSON is typically 30-60 MB. MBTiles will be 10-30 MB.

---

## 10. Related

- [Plus Codes integration](../packages/utils/src/plus-codes.ts) — Universal
  addressing for locations without street names
- [Mapbox Tiling Service docs](https://docs.mapbox.com/mapbox-tiling-service/guides/)
- [Geofabrik download server](https://download.geofabrik.de/africa/ghana.html)
- [OSM Wiki: Ghana](https://wiki.openstreetmap.org/wiki/Ghana)
- [Tippecanoe](https://github.com/mapbox/tippecanoe)
