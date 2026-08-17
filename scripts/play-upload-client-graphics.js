#!/usr/bin/env node
/**
 * Generate and upload Play Store graphics for the RiderGuy client app.
 * - icon: 512x512 from apps/client-native/assets/icon.png
 * - featureGraphic: 1024x500 brand canvas with logo + tagline
 * - phoneScreenshots: device captures framed onto 1080x1920 brand canvases
 *
 * Usage: node scripts/play-upload-client-graphics.js [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const KEY_PATH = path.join(ROOT, 'apps/client-native/play-store-key.json');
const PACKAGE = 'com.riderguy.client';
const OUT_DIR = path.join(ROOT, 'assets/play-store/client');
const DRY_RUN = process.argv.includes('--dry-run');

const BRAND = '#40BE89';
const BRAND_DARK = '#079B61';
const INK = '#0B1512';

const SCREENSHOTS = [
  { file: '.artifacts/mobile/artifacts-client-home.png', caption: 'Book a rider in seconds' },
  { file: '.artifacts/mobile/artifacts-client-ui.png', caption: 'Fast. Reliable. Secure.' },
  { file: '.artifacts/mobile/artifacts-client-tracking-map-after-key.png', caption: 'Track your delivery live' },
  { file: '.artifacts/mobile/artifacts-client-orders.png', caption: 'Every order in one place' },
];

const key = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8'));

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(key.private_key).toString('base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${header}.${claims}.${signature}`,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Token exchange failed: ${JSON.stringify(body)}`);
  return body.access_token;
}

async function jsonApi(token, method, p, body) {
  const res = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}${p}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 300) }; }
  if (!res.ok) throw new Error(`${method} ${p} -> ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  return json;
}

async function uploadImage(token, editId, imageType, filePath) {
  const bytes = fs.readFileSync(filePath);
  const res = await fetch(
    `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE}/edits/${editId}/listings/en-US/${imageType}?uploadType=media`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/png' },
      body: bytes,
    },
  );
  const body = await res.json();
  if (!res.ok) throw new Error(`upload ${imageType} (${path.basename(filePath)}) -> ${res.status}: ${JSON.stringify(body).slice(0, 400)}`);
  return body;
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function buildIcon() {
  const out = path.join(OUT_DIR, 'icon-512.png');
  await sharp(path.join(ROOT, 'apps/client-native/assets/icon.png'))
    .resize(512, 512)
    .png()
    .toFile(out);
  return out;
}

async function buildFeatureGraphic() {
  const out = path.join(OUT_DIR, 'feature-1024x500.png');
  const logo = await sharp(path.join(ROOT, 'apps/client-native/assets/icon.png'))
    .resize(300, 300)
    .png()
    .toBuffer();

  const svg = Buffer.from(`
    <svg width="1024" height="500" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${BRAND}"/>
          <stop offset="100%" stop-color="${BRAND_DARK}"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="500" fill="url(#bg)"/>
      <circle cx="930" cy="60" r="170" fill="rgba(255,255,255,0.08)"/>
      <circle cx="80" cy="460" r="140" fill="rgba(255,255,255,0.07)"/>
      <text x="400" y="225" font-family="Arial, Helvetica, sans-serif" font-size="76" font-weight="900" fill="#FFFFFF">RiderGuy</text>
      <text x="402" y="290" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="rgba(255,255,255,0.92)">Send packages across the city.</text>
      <text x="402" y="340" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="rgba(255,255,255,0.92)">Book. Track live. Pay in-app.</text>
    </svg>
  `);

  await sharp(svg)
    .composite([{ input: logo, left: 64, top: 100 }])
    .png()
    .toFile(out);
  return out;
}

async function buildScreenshot(srcFile, caption, index) {
  const out = path.join(OUT_DIR, `screenshot-${index + 1}.png`);
  const W = 1080;
  const H = 1920;
  const shotH = 1610;
  const src = await sharp(path.join(ROOT, srcFile))
    .resize({ height: shotH })
    .png()
    .toBuffer();
  const meta = await sharp(src).metadata();

  // Rounded-corner mask for the framed device capture
  const radius = 36;
  const mask = Buffer.from(
    `<svg width="${meta.width}" height="${meta.height}"><rect width="${meta.width}" height="${meta.height}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`,
  );
  const rounded = await sharp(src)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const bg = Buffer.from(`
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${BRAND}"/>
          <stop offset="100%" stop-color="${BRAND_DARK}"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#bg)"/>
      <circle cx="${W - 90}" cy="120" r="190" fill="rgba(255,255,255,0.07)"/>
      <circle cx="70" cy="${H - 120}" r="150" fill="rgba(255,255,255,0.06)"/>
      <text x="${W / 2}" y="150" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="900" fill="#FFFFFF">${escapeXml(caption)}</text>
    </svg>
  `);

  await sharp(bg)
    .composite([{ input: rounded, left: Math.round((W - meta.width) / 2), top: 230 }])
    .png()
    .toFile(out);
  return out;
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('Building graphics...');
  const iconPath = await buildIcon();
  const featurePath = await buildFeatureGraphic();
  const screenshotPaths = [];
  for (let i = 0; i < SCREENSHOTS.length; i++) {
    screenshotPaths.push(await buildScreenshot(SCREENSHOTS[i].file, SCREENSHOTS[i].caption, i));
  }
  console.log('Built:', [iconPath, featurePath, ...screenshotPaths].map((p) => path.basename(p)).join(', '));

  if (DRY_RUN) {
    console.log('Dry run — not uploading.');
    return;
  }

  const token = await getAccessToken();
  const edit = await jsonApi(token, 'POST', '/edits');
  const editId = edit.id;
  console.log('Edit:', editId);

  console.log('Uploading icon...');
  await uploadImage(token, editId, 'icon', iconPath);
  console.log('Uploading feature graphic...');
  await uploadImage(token, editId, 'featureGraphic', featurePath);
  for (const p of screenshotPaths) {
    console.log('Uploading', path.basename(p), '...');
    await uploadImage(token, editId, 'phoneScreenshots', p);
  }

  await jsonApi(token, 'POST', `/edits/${editId}:validate`);
  console.log('Edit validated.');
  await jsonApi(token, 'POST', `/edits/${editId}:commit`);
  console.log('Edit committed — client store graphics are live in Play Console.');
})().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
