// ══════════════════════════════════════════════════════════
// Rider App — Map Marker Factories
// Type-safe factory functions for Google Maps-style markers.
// Dark theme-aware. All markers use consistent styling.
// ══════════════════════════════════════════════════════════

import { MARKER_COLORS, ROUTE_COLORS } from '@riderguy/utils';

// ── SVG icons ─────────────────────────────────────────────
const ICONS = {
  dot: (color: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" fill="${color}" stroke="white" stroke-width="3"/>
      <circle cx="12" cy="12" r="3.5" fill="white"/>
    </svg>`,

  flag: `<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M5 3l3.057-3L20 12 8.057 24 5 21l9-9z"/></svg>`,

  bike: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/>
    <circle cx="15" cy="5" r="1"/><path d="m12 17.5 3.5-7 7 0"/>
    <path d="M6.5 17.5 9 13l4.5 0 1-2"/>
  </svg>`,
};

// ── Pickup marker — Google yellow circle w/ dot + tail ───
export function createPickupMarker(
  mapboxgl: typeof import('mapbox-gl').default,
  lngLat: [number, number],
  map: mapboxgl.Map,
) {
  const el = document.createElement('div');
  el.className = 'rg-marker pickup';
  el.innerHTML = `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
      <div style="width:36px;height:36px;border-radius:50%;background:${MARKER_COLORS.pickup};border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,.35),0 0 0 1px rgba(0,0,0,.08);display:flex;align-items:center;justify-content:center;">
        ${ICONS.dot(MARKER_COLORS.pickup)}
      </div>
      <div style="width:3px;height:8px;background:${MARKER_COLORS.pickup};border-radius:0 0 2px 2px;box-shadow:0 2px 4px rgba(0,0,0,.2);"></div>
    </div>
  `;
  return new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat(lngLat).addTo(map);
}

// ── Dropoff marker — green circle w/ flag + tail ─────────
export function createDropoffMarker(
  mapboxgl: typeof import('mapbox-gl').default,
  lngLat: [number, number],
  map: mapboxgl.Map,
) {
  const el = document.createElement('div');
  el.className = 'rg-marker dropoff';
  el.innerHTML = `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
      <div style="width:36px;height:36px;border-radius:50%;background:${MARKER_COLORS.dropoff};border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,.35),0 0 0 1px rgba(0,0,0,.08);display:flex;align-items:center;justify-content:center;">
        ${ICONS.flag}
      </div>
      <div style="width:3px;height:8px;background:${MARKER_COLORS.dropoff};border-radius:0 0 2px 2px;box-shadow:0 2px 4px rgba(0,0,0,.2);"></div>
    </div>
  `;
  return new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat(lngLat).addTo(map);
}

// ── Stop marker — numbered waypoint ──────────────────────
export function createStopMarker(
  mapboxgl: typeof import('mapbox-gl').default,
  lngLat: [number, number],
  map: mapboxgl.Map,
  index: number,
  type: 'PICKUP' | 'DROPOFF' = 'PICKUP',
) {
  const color = type === 'DROPOFF' ? MARKER_COLORS.dropoff : MARKER_COLORS.pickup;
  const el = document.createElement('div');
  el.className = 'rg-marker stop';
  el.innerHTML = `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
      <div style="width:32px;height:32px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3),0 0 0 1px rgba(0,0,0,.08);display:flex;align-items:center;justify-content:center;">
        <span style="color:white;font-size:12px;font-weight:700;line-height:1;">${index}</span>
      </div>
      <div style="width:2px;height:6px;background:${color};border-radius:0 0 2px 2px;"></div>
    </div>
  `;
  return new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat(lngLat).addTo(map);
}

// ── Rider marker — animated bike dot with pulse ring ─────
export function createRiderMarker(
  mapboxgl: typeof import('mapbox-gl').default,
  lngLat: [number, number],
  map: mapboxgl.Map,
) {
  const el = document.createElement('div');
  el.className = 'rg-marker rider';
  el.innerHTML = `
    <div style="position:relative;width:56px;height:56px;display:flex;align-items:center;justify-content:center;">
      <div class="rg-pulse" style="position:absolute;inset:0;border-radius:50%;background:rgba(66,133,244,.18);"></div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:36px;height:36px;border-radius:50%;background:${MARKER_COLORS.rider};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;">
        ${ICONS.bike}
      </div>
    </div>
  `;
  return new mapboxgl.Marker({ element: el }).setLngLat(lngLat).addTo(map);
}

// ── Rider status dot — Google Maps blue dot style ────────
export type RiderMapStatus = 'offline' | 'online' | 'on-route';

const STATUS_DOT_COLORS: Record<RiderMapStatus, { main: string; glow: string; ring: string }> = {
  offline:    { main: '#9ca3af', glow: 'rgba(156,163,175,.25)', ring: 'rgba(156,163,175,.12)' },
  online:     { main: '#22c55e', glow: 'rgba(34,197,94,.40)',   ring: 'rgba(34,197,94,.15)' },
  'on-route': { main: ROUTE_COLORS.primary, glow: 'rgba(66,133,244,.40)', ring: 'rgba(66,133,244,.15)' },
};

export function createRiderStatusDot(
  mapboxgl: typeof import('mapbox-gl').default,
  lngLat: [number, number],
  map: mapboxgl.Map,
  status: RiderMapStatus = 'offline',
): { marker: mapboxgl.Marker; element: HTMLDivElement } {
  const c = STATUS_DOT_COLORS[status];
  const el = document.createElement('div');
  el.className = 'rg-marker rider-dot';
  el.innerHTML = `
    <div style="position:relative;width:56px;height:56px;display:flex;align-items:center;justify-content:center;">
      <div data-ring class="rg-pulse" style="position:absolute;inset:0;border-radius:50%;background:${c.ring};${status === 'offline' ? 'animation-play-state:paused;' : ''}"></div>
      <div data-glow style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:40px;height:40px;border-radius:50%;box-shadow:0 0 20px 6px ${c.glow};"></div>
      <div data-dot style="position:relative;z-index:1;width:24px;height:24px;filter:drop-shadow(0 2px 6px rgba(0,0,0,.3));">
        ${ICONS.dot(c.main)}
      </div>
    </div>
  `;
  return {
    marker: new mapboxgl.Marker({ element: el }).setLngLat(lngLat).addTo(map),
    element: el,
  };
}

/** Update an existing rider status dot's colors */
export function updateRiderStatusDot(el: HTMLDivElement, status: RiderMapStatus) {
  const c = STATUS_DOT_COLORS[status];
  const ringEl = el.querySelector<HTMLDivElement>('[data-ring]');
  const glowEl = el.querySelector<HTMLDivElement>('[data-glow]');
  const dotEl = el.querySelector<HTMLDivElement>('[data-dot]');

  if (ringEl) {
    ringEl.style.background = c.ring;
    ringEl.style.animationPlayState = status === 'offline' ? 'paused' : 'running';
  }
  if (glowEl) glowEl.style.boxShadow = `0 0 20px 6px ${c.glow}`;
  if (dotEl) dotEl.innerHTML = ICONS.dot(c.main);
}
