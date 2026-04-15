// ══════════════════════════════════════════════════════════
// Map Markers — Rider app marker factory functions
//
// Dark theme-aware, professional markers using Google Maps:
// • AdvancedMarkerElement for custom content
// • InfoWindow for popups
// • Status-aware dot with animated pulse
// • Proper anchor positioning via CSS transform
// • ARIA labels for accessibility
// ══════════════════════════════════════════════════════════

import { MARKER_COLORS, ROUTE_COLORS } from '@riderguy/utils';

// ── SVG Icons ─────────────────────────────────────────────

const SVG = {
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

  whiteDot: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="4" fill="white"/></svg>`,
};

// ── HTML Escape utility (prevents XSS in popup content) ──

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Shared InfoWindow instance (only one open at a time) ─

let sharedInfoWindow: google.maps.InfoWindow | null = null;

function attachInfoWindow(
  map: google.maps.Map,
  marker: google.maps.marker.AdvancedMarkerElement,
  html: string,
): void {
  marker.addListener('gmp-click', () => {
    if (!sharedInfoWindow) {
      sharedInfoWindow = new google.maps.InfoWindow();
    }
    sharedInfoWindow.setContent(`<div class="px-3 py-2 text-sm font-medium">${html}</div>`);
    sharedInfoWindow.open({ anchor: marker, map });
  });
}

// ── Helper to convert [lng, lat] to Google LatLng ────────

function toLatLng(lngLat: [number, number]): google.maps.LatLngLiteral {
  return { lat: lngLat[1], lng: lngLat[0] };
}

// ── Pickup Marker ───────────────────────────────────────

export function createPickupMarker(
  map: google.maps.Map,
  lngLat: [number, number],
  options: { popup?: string } = {},
): google.maps.marker.AdvancedMarkerElement {
  const el = document.createElement('div');
  el.className = 'rg-marker pickup';
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', 'Pickup location');
  el.style.transform = 'translateY(-50%)';
  el.innerHTML = `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
      <div style="width:36px;height:36px;border-radius:50%;background:${MARKER_COLORS.pickup};border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,.35),0 0 0 1px rgba(0,0,0,.08);display:flex;align-items:center;justify-content:center;">
        ${SVG.dot(MARKER_COLORS.pickup)}
      </div>
      <div style="width:3px;height:8px;background:${MARKER_COLORS.pickup};border-radius:0 0 2px 2px;box-shadow:0 2px 4px rgba(0,0,0,.2);"></div>
    </div>
  `;

  const marker = new google.maps.marker.AdvancedMarkerElement({
    map,
    position: toLatLng(lngLat),
    content: el,
  });

  if (options.popup) {
    attachInfoWindow(map, marker, escapeHtml(options.popup));
  }

  return marker;
}

// ── Dropoff Marker ──────────────────────────────────────

export function createDropoffMarker(
  map: google.maps.Map,
  lngLat: [number, number],
  options: { popup?: string } = {},
): google.maps.marker.AdvancedMarkerElement {
  const el = document.createElement('div');
  el.className = 'rg-marker dropoff';
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', 'Dropoff location');
  el.style.transform = 'translateY(-50%)';
  el.innerHTML = `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
      <div style="width:36px;height:36px;border-radius:50%;background:${MARKER_COLORS.dropoff};border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,.35),0 0 0 1px rgba(0,0,0,.08);display:flex;align-items:center;justify-content:center;">
        ${SVG.flag}
      </div>
      <div style="width:3px;height:8px;background:${MARKER_COLORS.dropoff};border-radius:0 0 2px 2px;box-shadow:0 2px 4px rgba(0,0,0,.2);"></div>
    </div>
  `;

  const marker = new google.maps.marker.AdvancedMarkerElement({
    map,
    position: toLatLng(lngLat),
    content: el,
  });

  if (options.popup) {
    attachInfoWindow(map, marker, escapeHtml(options.popup));
  }

  return marker;
}

// ── Stop Marker ─────────────────────────────────────────

export function createStopMarker(
  map: google.maps.Map,
  lngLat: [number, number],
  options: { popup?: string; label?: string; type?: 'PICKUP' | 'DROPOFF' } = {},
): google.maps.marker.AdvancedMarkerElement {
  const type = options.type ?? 'PICKUP';
  const label = options.label ?? '•';
  const color = type === 'DROPOFF' ? MARKER_COLORS.dropoff : MARKER_COLORS.pickup;
  const el = document.createElement('div');
  el.className = 'rg-marker stop';
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', `Stop ${label} marker`);
  el.style.transform = 'translateY(-50%)';
  el.innerHTML = `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
      <div style="width:32px;height:32px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3),0 0 0 1px rgba(0,0,0,.08);display:flex;align-items:center;justify-content:center;">
        <span style="color:white;font-size:12px;font-weight:700;line-height:1;">${escapeHtml(label)}</span>
      </div>
      <div style="width:2px;height:6px;background:${color};border-radius:0 0 2px 2px;"></div>
    </div>
  `;

  const marker = new google.maps.marker.AdvancedMarkerElement({
    map,
    position: toLatLng(lngLat),
    content: el,
  });

  if (options.popup) {
    attachInfoWindow(map, marker, escapeHtml(options.popup));
  }

  return marker;
}

// ── Rider Marker (with bike icon) ───────────────────────

export function createRiderMarker(
  map: google.maps.Map,
  lngLat: [number, number],
  options: { popup?: string } = {},
): google.maps.marker.AdvancedMarkerElement {
  const el = document.createElement('div');
  el.className = 'rg-marker rider';
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', 'Rider position');
  el.innerHTML = `
    <div style="position:relative;width:56px;height:56px;display:flex;align-items:center;justify-content:center;">
      <div class="rg-pulse" style="position:absolute;inset:0;border-radius:50%;background:rgba(66,133,244,.18);"></div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:36px;height:36px;border-radius:50%;background:${MARKER_COLORS.rider};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;">
        ${SVG.bike}
      </div>
    </div>
  `;

  const marker = new google.maps.marker.AdvancedMarkerElement({
    map,
    position: toLatLng(lngLat),
    content: el,
  });

  if (options.popup) {
    attachInfoWindow(map, marker, escapeHtml(options.popup));
  }

  return marker;
}

// ── Rider Status Dot ────────────────────────────────────

export type RiderMapStatus = 'offline' | 'online' | 'on-route';

const STATUS_DOT_COLORS: Record<RiderMapStatus, { main: string; glow: string; ring: string }> = {
  offline:    { main: '#9ca3af', glow: 'rgba(156,163,175,.25)', ring: 'rgba(156,163,175,.12)' },
  online:     { main: '#22c55e', glow: 'rgba(34,197,94,.40)',   ring: 'rgba(34,197,94,.15)' },
  'on-route': { main: ROUTE_COLORS.primary, glow: 'rgba(66,133,244,.40)', ring: 'rgba(66,133,244,.15)' },
};

export function createRiderStatusDot(
  map: google.maps.Map,
  lngLat: [number, number],
  status: RiderMapStatus = 'offline',
): { marker: google.maps.marker.AdvancedMarkerElement; element: HTMLDivElement } {
  const c = STATUS_DOT_COLORS[status];
  const el = document.createElement('div');
  el.className = 'rg-marker rider-dot';
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', `Rider status: ${status}`);
  el.innerHTML = `
    <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
      <div data-ring class="rg-pulse" style="position:absolute;inset:0;border-radius:50%;background:${c.ring};${status === 'offline' ? 'animation-play-state:paused;' : ''}"></div>
      <div data-glow style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:24px;height:24px;border-radius:50%;box-shadow:0 0 8px 3px ${c.glow};"></div>
      <div data-dot style="position:relative;z-index:1;width:14px;height:14px;filter:drop-shadow(0 1px 4px rgba(0,0,0,.3));">
        ${SVG.dot(c.main)}
      </div>
    </div>
  `;

  return {
    marker: new google.maps.marker.AdvancedMarkerElement({
      map,
      position: toLatLng(lngLat),
      content: el,
    }),
    element: el,
  };
}

export function updateRiderStatusDot(el: HTMLDivElement, status: RiderMapStatus): void {
  const c = STATUS_DOT_COLORS[status];
  const ringEl = el.querySelector<HTMLDivElement>('[data-ring]');
  const glowEl = el.querySelector<HTMLDivElement>('[data-glow]');
  const dotEl = el.querySelector<HTMLDivElement>('[data-dot]');

  if (ringEl) {
    ringEl.style.background = c.ring;
    ringEl.style.animationPlayState = status === 'offline' ? 'paused' : 'running';
  }
  if (glowEl) glowEl.style.boxShadow = `0 0 8px 3px ${c.glow}`;
  if (dotEl) dotEl.innerHTML = SVG.dot(c.main);
}

// ── Cleanup ─────────────────────────────────────────────

export function removeMarkers(markers: google.maps.marker.AdvancedMarkerElement[]): void {
  for (const m of markers) {
    m.map = null;
  }
}
