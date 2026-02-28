// ══════════════════════════════════════════════════════════
// Map Markers — Professional marker factory functions
// Creates consistent, animated HTML markers for all map uses
// ══════════════════════════════════════════════════════════

import type mapboxgl from 'mapbox-gl';

// ── SVG Icons ───────────────────────────────────────────

const ICONS = {
  crosshair: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`,
  pin: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  flag: `<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M5 3l3.057-3L20 12 8.057 24 5 21l9-9z"/></svg>`,
  bike: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="m12 17.5 2-4.5h3l1.5-5"/><path d="M5.5 17.5 8 12l4-1V7"/></svg>`,
  bikeSm: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="m12 17.5 2-4.5h3l1.5-5"/><path d="M5.5 17.5 8 12l4-1V7"/></svg>`,
  dot: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="4" fill="white"/></svg>`,
};

// ── Marker Factory Functions ────────────────────────────

/** Google Maps-style pickup pin — yellow circle with center dot + tail */
export function createPickupMarker(
  mapboxgl: typeof import('mapbox-gl').default,
  lngLat: [number, number],
  map: mapboxgl.Map,
  options: { color?: string; size?: number } = {},
): mapboxgl.Marker {
  const color = options.color ?? '#fbbc04';
  const size = options.size ?? 36;
  const el = document.createElement('div');
  el.className = 'rg-marker rg-marker-pickup';
  el.innerHTML = `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 6px rgba(0,0,0,.25));">
      <div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid white;display:flex;align-items:center;justify-content:center;transition:transform .2s;">
        ${ICONS.dot}
      </div>
      <div style="width:3px;height:8px;background:${color};border-radius:0 0 2px 2px;"></div>
    </div>`;
  return new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat(lngLat).addTo(map);
}

/** Google Maps-style dropoff pin — green circle with arrow + tail */
export function createDropoffMarker(
  mapboxgl: typeof import('mapbox-gl').default,
  lngLat: [number, number],
  map: mapboxgl.Map,
  options: { color?: string; size?: number } = {},
): mapboxgl.Marker {
  const color = options.color ?? '#34A853';
  const size = options.size ?? 36;
  const el = document.createElement('div');
  el.className = 'rg-marker rg-marker-dropoff';
  el.innerHTML = `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 6px rgba(0,0,0,.25));">
      <div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid white;display:flex;align-items:center;justify-content:center;transition:transform .2s;">
        ${ICONS.flag}
      </div>
      <div style="width:3px;height:8px;background:${color};border-radius:0 0 2px 2px;"></div>
    </div>`;
  return new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat(lngLat).addTo(map);
}

/** Numbered stop/waypoint marker */
export function createStopMarker(
  mapboxgl: typeof import('mapbox-gl').default,
  lngLat: [number, number],
  map: mapboxgl.Map,
  label: string,
  color = '#6366f1',
): mapboxgl.Marker {
  const el = document.createElement('div');
  el.className = 'rg-marker rg-marker-stop';
  el.innerHTML = `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 5px rgba(0,0,0,.2));">
      <div style="width:32px;height:32px;border-radius:50%;background:${color};border:3px solid white;display:flex;align-items:center;justify-content:center;">
        <span style="color:white;font-size:12px;font-weight:700;line-height:1;">${label}</span>
      </div>
      <div style="width:2px;height:6px;background:${color};border-radius:0 0 2px 2px;"></div>
    </div>`;
  return new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat(lngLat).addTo(map);
}

/** Animated rider marker — blue dot with pulse ring + bike icon */
export function createRiderMarker(
  mapboxgl: typeof import('mapbox-gl').default,
  lngLat: [number, number],
  map: mapboxgl.Map,
  options: { color?: string; withBike?: boolean; size?: number } = {},
): mapboxgl.Marker {
  const color = options.color ?? '#4285F4';
  const size = options.size ?? 40;
  const showBike = options.withBike ?? true;
  const el = document.createElement('div');
  el.className = 'rg-marker rg-marker-rider';
  el.innerHTML = `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;width:${size + 16}px;height:${size + 16}px;">
      <div class="rg-pulse-ring" style="position:absolute;inset:0;border-radius:50%;background:${color}20;animation:rg-pulse 2.5s ease-out infinite;"></div>
      <div style="position:absolute;inset:4px;border-radius:50%;background:${color}10;"></div>
      ${showBike
        ? `<div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:14px;background:linear-gradient(135deg,${color},${adjustColor(color, -20)});box-shadow:0 4px 16px ${color}66;border:3px solid white;">${ICONS.bike}</div>`
        : `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35);"></div>`
      }
    </div>`;
  return new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat(lngLat).addTo(map);
}

/** Small rider marker for nearby-riders map */
export function createSmallRiderMarker(
  mapboxgl: typeof import('mapbox-gl').default,
  lngLat: [number, number],
  map: mapboxgl.Map,
  color = '#22c55e',
): mapboxgl.Marker {
  const el = document.createElement('div');
  el.className = 'rg-marker rg-marker-rider-sm';
  el.innerHTML = `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;">
      <div class="rg-pulse-ring" style="position:absolute;inset:-4px;border-radius:14px;background:${color}1F;animation:rg-pulse 2.5s ease-out infinite;"></div>
      <div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:10px;background:linear-gradient(135deg,${color},${adjustColor(color, 30)});box-shadow:0 2px 8px ${color}59;border:2px solid white;">
        ${ICONS.bikeSm}
      </div>
    </div>`;
  return new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat(lngLat).addTo(map);
}

/** User "You are here" blue dot with pulse animation */
export function createUserDotMarker(
  mapboxgl: typeof import('mapbox-gl').default,
  lngLat: [number, number],
  map: mapboxgl.Map,
  color = '#3b82f6',
): mapboxgl.Marker {
  const el = document.createElement('div');
  el.className = 'rg-marker rg-marker-user';
  el.innerHTML = `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;">
      <div class="rg-pulse-ring" style="position:absolute;inset:-6px;border-radius:50%;background:${color}26;animation:rg-pulse 2.5s ease-out infinite;"></div>
      <div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 0 8px ${color}80;"></div>
    </div>`;
  return new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat(lngLat).addTo(map);
}

/** Rider status dot — changes color based on status (offline/online/on-route) */
export function createRiderStatusDot(
  mapboxgl: typeof import('mapbox-gl').default,
  lngLat: [number, number],
  map: mapboxgl.Map,
  status: 'offline' | 'online' | 'on-route' = 'offline',
): mapboxgl.Marker {
  const colors = {
    offline:    { main: '#9ca3af', glow: 'rgba(156,163,175,.25)', ring: 'rgba(156,163,175,.12)' },
    online:     { main: '#22c55e', glow: 'rgba(34,197,94,.40)',   ring: 'rgba(34,197,94,.15)' },
    'on-route': { main: '#4285F4', glow: 'rgba(66,133,244,.40)',  ring: 'rgba(66,133,244,.15)' },
  };
  const c = colors[status];
  const el = document.createElement('div');
  el.className = 'rg-marker rg-marker-status';
  el.innerHTML = `
    <div style="position:relative;width:56px;height:56px;display:flex;align-items:center;justify-content:center;">
      <div data-ring style="position:absolute;inset:0;border-radius:50%;background:${c.ring};animation:rg-pulse 2.5s ease-out infinite;${status === 'offline' ? 'animation-play-state:paused;' : ''}"></div>
      <div data-glow style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:40px;height:40px;border-radius:50%;box-shadow:0 0 20px 6px ${c.glow};"></div>
      <div data-dot style="position:relative;z-index:1;width:24px;height:24px;filter:drop-shadow(0 2px 6px rgba(0,0,0,.3));">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" fill="${c.main}" stroke="white" stroke-width="3"/>
          <circle cx="12" cy="12" r="3.5" fill="white"/>
        </svg>
      </div>
    </div>`;
  return new mapboxgl.Marker({ element: el }).setLngLat(lngLat).addTo(map);
}

/** Update a rider status dot's colors */
export function updateRiderStatusDot(
  marker: mapboxgl.Marker,
  status: 'offline' | 'online' | 'on-route',
): void {
  const colors = {
    offline:    { main: '#9ca3af', glow: 'rgba(156,163,175,.25)', ring: 'rgba(156,163,175,.12)' },
    online:     { main: '#22c55e', glow: 'rgba(34,197,94,.40)',   ring: 'rgba(34,197,94,.15)' },
    'on-route': { main: '#4285F4', glow: 'rgba(66,133,244,.40)',  ring: 'rgba(66,133,244,.15)' },
  };
  const c = colors[status];
  const el = marker.getElement();
  const ring = el.querySelector<HTMLDivElement>('[data-ring]');
  const glow = el.querySelector<HTMLDivElement>('[data-glow]');
  const dot = el.querySelector<HTMLDivElement>('[data-dot]');
  if (ring) {
    ring.style.background = c.ring;
    ring.style.animationPlayState = status === 'offline' ? 'paused' : 'running';
  }
  if (glow) glow.style.boxShadow = `0 0 20px 6px ${c.glow}`;
  if (dot) {
    dot.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" fill="${c.main}" stroke="white" stroke-width="3"/>
      <circle cx="12" cy="12" r="3.5" fill="white"/>
    </svg>`;
  }
}

// ── Helpers ─────────────────────────────────────────────

/** Lighten or darken a hex color */
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
