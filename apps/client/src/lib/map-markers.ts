// ══════════════════════════════════════════════════════════
// Map Markers — Client app marker factory functions
//
// Professional, accessible markers using Mapbox GL JS v3.19:
// • Marker API with custom HTML elements
// • Popup integration with proper Mapbox Popup API
// • Draggable support for pickup/dropoff adjustment
// • Animated pulse rings for live entities
// • Color-coded markers for status awareness
// • Proper anchor positioning
// • Cleanup-safe (all markers returned for removal)
// ══════════════════════════════════════════════════════════

import type mapboxgl from 'mapbox-gl';
import { MARKER_COLORS } from '@riderguy/utils';

// ── SVG Icon Library ────────────────────────────────────

const SVG = {
  dot: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="4" fill="white"/></svg>`,

  flag: `<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M5 3l3.057-3L20 12 8.057 24 5 21l9-9z"/></svg>`,

  bike: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M5 14l2-4h4l2-3h4l2 10"/><path d="M13 7l2 7"/></svg>`,

  bikeSm: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M5 14l2-4h4l2-3h4l2 10"/><path d="M13 7l2 7"/></svg>`,

  crosshair: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`,

  statusDot: (color: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" fill="${color}" stroke="white" stroke-width="3"/>
      <circle cx="12" cy="12" r="3.5" fill="white"/>
    </svg>`,

  pin: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,

  package: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`,
};

// ── Helpers ─────────────────────────────────────────────

/** Lighten or darken a hex color by an amount */
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Create a marker pin element with tail */
function createPinElement(
  icon: string,
  color: string,
  size: number,
  className: string,
): HTMLDivElement {
  const el = document.createElement('div');
  el.className = `rg-marker ${className}`;
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', className.replace('rg-marker-', '').replace(/-/g, ' ') + ' marker');
  el.innerHTML = `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 6px rgba(0,0,0,.25));cursor:pointer;">
      <div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid white;display:flex;align-items:center;justify-content:center;transition:transform .2s ease;">
        ${icon}
      </div>
      <div style="width:3px;height:8px;background:${color};border-radius:0 0 2px 2px;"></div>
    </div>`;
  return el;
}

// ── Marker Factory Functions ────────────────────────────

/** Pickup marker — yellow pin with white dot center */
export function createPickupMarker(
  mapboxgl: typeof import('mapbox-gl').default,
  lngLat: [number, number],
  options: { color?: string; size?: number; draggable?: boolean; popup?: string } = {},
): mapboxgl.Marker {
  const color = options.color ?? MARKER_COLORS.pickup;
  const size = options.size ?? 36;
  const el = createPinElement(SVG.dot, color, size, 'rg-marker-pickup');

  const marker = new mapboxgl.Marker({
    element: el,
    anchor: 'bottom',
    draggable: options.draggable ?? false,
  }).setLngLat(lngLat);

  if (options.popup) {
    const popup = new mapboxgl.Popup({
      offset: 25,
      closeButton: false,
      closeOnClick: true,
      maxWidth: '200px',
      className: 'rg-popup',
    }).setHTML(`<div class="px-3 py-2 text-sm font-medium">${options.popup}</div>`);
    marker.setPopup(popup);
  }

  return marker;
}

/** Dropoff marker — green pin with flag icon */
export function createDropoffMarker(
  mapboxgl: typeof import('mapbox-gl').default,
  lngLat: [number, number],
  options: { color?: string; size?: number; draggable?: boolean; popup?: string } = {},
): mapboxgl.Marker {
  const color = options.color ?? MARKER_COLORS.dropoff;
  const size = options.size ?? 36;
  const el = createPinElement(SVG.flag, color, size, 'rg-marker-dropoff');

  const marker = new mapboxgl.Marker({
    element: el,
    anchor: 'bottom',
    draggable: options.draggable ?? false,
  }).setLngLat(lngLat);

  if (options.popup) {
    const popup = new mapboxgl.Popup({
      offset: 25,
      closeButton: false,
      closeOnClick: true,
      maxWidth: '200px',
      className: 'rg-popup',
    }).setHTML(`<div class="px-3 py-2 text-sm font-medium">${options.popup}</div>`);
    marker.setPopup(popup);
  }

  return marker;
}

/** Numbered stop/waypoint marker */
export function createStopMarker(
  mapboxgl: typeof import('mapbox-gl').default,
  lngLat: [number, number],
  options: { color?: string; popup?: string; label?: string } = {},
): mapboxgl.Marker {
  const color = options.color ?? MARKER_COLORS.stop;
  const label = options.label ?? '•';
  const el = document.createElement('div');
  el.className = 'rg-marker rg-marker-stop';
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', `Stop ${label} marker`);
  el.innerHTML = `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 5px rgba(0,0,0,.2));">
      <div style="width:32px;height:32px;border-radius:50%;background:${color};border:3px solid white;display:flex;align-items:center;justify-content:center;">
        <span style="color:white;font-size:12px;font-weight:700;line-height:1;">${label}</span>
      </div>
      <div style="width:2px;height:6px;background:${color};border-radius:0 0 2px 2px;"></div>
    </div>`;

  const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
    .setLngLat(lngLat);

  if (options.popup) {
    marker.setPopup(
      new mapboxgl.Popup({ offset: 20, closeButton: false, maxWidth: '200px', className: 'rg-popup' })
        .setHTML(`<div class="px-3 py-2 text-sm font-medium">${options.popup}</div>`),
    );
  }

  return marker;
}

/** Animated rider marker with pulse ring + bike icon */
export function createRiderMarker(
  mapboxgl: typeof import('mapbox-gl').default,
  lngLat: [number, number],
  options: { color?: string; withBike?: boolean; size?: number; popup?: string } = {},
): mapboxgl.Marker {
  const color = options.color ?? MARKER_COLORS.rider;
  const size = options.size ?? 40;
  const showBike = options.withBike ?? true;
  const el = document.createElement('div');
  el.className = 'rg-marker rg-marker-rider';
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', 'Rider location');
  el.innerHTML = `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;width:${size + 16}px;height:${size + 16}px;">
      <div class="rg-pulse-ring" style="position:absolute;inset:0;border-radius:50%;background:${color}20;animation:rg-pulse 2.5s ease-out infinite;"></div>
      <div style="position:absolute;inset:4px;border-radius:50%;background:${color}10;"></div>
      ${showBike
        ? `<div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:14px;background:linear-gradient(135deg,${color},${adjustColor(color, -20)});box-shadow:0 4px 16px ${color}66;border:3px solid white;">${SVG.bike}</div>`
        : `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35);"></div>`
      }
    </div>`;

  const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
    .setLngLat(lngLat);

  if (options.popup) {
    marker.setPopup(
      new mapboxgl.Popup({ offset: 25, closeButton: false, maxWidth: '220px', className: 'rg-popup' })
        .setHTML(`<div class="px-3 py-2 text-sm font-medium">${options.popup}</div>`),
    );
  }

  return marker;
}

/** Small rider marker for nearby-riders overview map */
export function createSmallRiderMarker(
  mapboxgl: typeof import('mapbox-gl').default,
  lngLat: [number, number],
  options: { color?: string; popup?: string } = {},
): mapboxgl.Marker {
  const color = options.color ?? MARKER_COLORS.riderOnline;
  const el = document.createElement('div');
  el.className = 'rg-marker rg-marker-rider-sm';
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', 'Nearby rider');
  el.innerHTML = `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;">
      <div class="rg-pulse-ring" style="position:absolute;inset:-4px;border-radius:14px;background:${color}1F;animation:rg-pulse 2.5s ease-out infinite;"></div>
      <div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:10px;background:linear-gradient(135deg,${color},${adjustColor(color, 30)});box-shadow:0 2px 8px ${color}59;border:2px solid white;">
        ${SVG.bikeSm}
      </div>
    </div>`;

  const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
    .setLngLat(lngLat);

  if (options.popup) {
    marker.setPopup(
      new mapboxgl.Popup({ offset: 15, closeButton: false, maxWidth: '180px', className: 'rg-popup' })
        .setHTML(`<div class="px-2 py-1 text-xs">${options.popup}</div>`),
    );
  }

  return marker;
}

/** User "You are here" blue dot with pulse animation */
export function createUserDotMarker(
  mapboxgl: typeof import('mapbox-gl').default,
  lngLat: [number, number],
  color = MARKER_COLORS.user,
): mapboxgl.Marker {
  const el = document.createElement('div');
  el.className = 'rg-marker rg-marker-user';
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', 'Your location');
  el.innerHTML = `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;">
      <div class="rg-pulse-ring" style="position:absolute;inset:-6px;border-radius:50%;background:${color}26;animation:rg-pulse 2.5s ease-out infinite;"></div>
      <div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 0 8px ${color}80;"></div>
    </div>`;
  return new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat(lngLat);
}

/** Rider status dot — Google Maps-style, changes color based on status */
export function createRiderStatusDot(
  mapboxgl: typeof import('mapbox-gl').default,
  lngLat: [number, number],
  status: 'offline' | 'online' | 'on-route' = 'offline',
): mapboxgl.Marker {
  const colors = getStatusColors(status);
  const el = document.createElement('div');
  el.className = 'rg-marker rg-marker-status';
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', `Rider status: ${status}`);
  el.innerHTML = `
    <div style="position:relative;width:56px;height:56px;display:flex;align-items:center;justify-content:center;">
      <div data-ring style="position:absolute;inset:0;border-radius:50%;background:${colors.ring};animation:rg-pulse 2.5s ease-out infinite;${status === 'offline' ? 'animation-play-state:paused;' : ''}"></div>
      <div data-glow style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:40px;height:40px;border-radius:50%;box-shadow:0 0 20px 6px ${colors.glow};"></div>
      <div data-dot style="position:relative;z-index:1;width:24px;height:24px;filter:drop-shadow(0 2px 6px rgba(0,0,0,.3));">
        ${SVG.statusDot(colors.main)}
      </div>
    </div>`;
  return new mapboxgl.Marker({ element: el }).setLngLat(lngLat);
}

/** Update a rider status dot's colors */
export function updateRiderStatusDot(
  marker: mapboxgl.Marker,
  status: 'offline' | 'online' | 'on-route',
): void {
  const colors = getStatusColors(status);
  const el = marker.getElement();
  const ring = el.querySelector<HTMLDivElement>('[data-ring]');
  const glow = el.querySelector<HTMLDivElement>('[data-glow]');
  const dot = el.querySelector<HTMLDivElement>('[data-dot]');
  if (ring) {
    ring.style.background = colors.ring;
    ring.style.animationPlayState = status === 'offline' ? 'paused' : 'running';
  }
  if (glow) glow.style.boxShadow = `0 0 20px 6px ${colors.glow}`;
  if (dot) dot.innerHTML = SVG.statusDot(colors.main);
}

/** Marker cleanup utility — removes an array of markers */
export function removeMarkers(markers: mapboxgl.Marker[]): void {
  for (const m of markers) {
    m.getPopup()?.remove();
    m.remove();
  }
}

// ── Internal ────────────────────────────────────────────

function getStatusColors(status: 'offline' | 'online' | 'on-route') {
  const map: Record<string, { main: string; glow: string; ring: string }> = {
    offline:    { main: '#9ca3af', glow: 'rgba(156,163,175,.25)', ring: 'rgba(156,163,175,.12)' },
    online:     { main: '#22c55e', glow: 'rgba(34,197,94,.40)',   ring: 'rgba(34,197,94,.15)' },
    'on-route': { main: '#4285F4', glow: 'rgba(66,133,244,.40)',  ring: 'rgba(66,133,244,.15)' },
  };
  return map[status]!;
}
