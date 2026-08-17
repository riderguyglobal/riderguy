#!/usr/bin/env node
/**
 * Play Console state check via Android Publisher API.
 * Usage: node scripts/play-console-check.js <path-to-service-account.json> <packageName>
 */
const fs = require('fs');
const crypto = require('crypto');

const [, , keyPath, packageName] = process.argv;
if (!keyPath || !packageName) {
  console.error('Usage: node play-console-check.js <key.json> <packageName>');
  process.exit(1);
}

const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

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
  const jwt = `${header}.${claims}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Token exchange failed: ${JSON.stringify(body)}`);
  return body.access_token;
}

async function api(token, method, path, body) {
  const res = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

(async () => {
  const token = await getAccessToken();
  console.log(`=== ${packageName} ===`);

  const edit = await api(token, 'POST', '/edits');
  if (edit.status !== 200) {
    console.log('EDIT CREATE FAILED:', edit.status, JSON.stringify(edit.json));
    process.exit(2);
  }
  const editId = edit.json.id;
  console.log('Edit created:', editId);

  const tracks = await api(token, 'GET', `/edits/${editId}/tracks`);
  console.log('--- TRACKS ---');
  console.log(JSON.stringify(tracks.json, null, 2));

  const listings = await api(token, 'GET', `/edits/${editId}/listings`);
  console.log('--- LISTINGS ---');
  console.log(JSON.stringify(listings.json, null, 2));

  const details = await api(token, 'GET', `/edits/${editId}/details`);
  console.log('--- DETAILS ---');
  console.log(JSON.stringify(details.json, null, 2));

  const bundles = await api(token, 'GET', `/edits/${editId}/bundles`);
  console.log('--- BUNDLES ---');
  console.log(JSON.stringify(bundles.json, null, 2));

  // Store graphics (edits.images.list: .../listings/{lang}/{imageType})
  for (const imageType of ['phoneScreenshots', 'featureGraphic', 'icon']) {
    const res = await api(token, 'GET', `/edits/${editId}/listings/en-US/${imageType}`);
    const count = Array.isArray(res.json.images) ? res.json.images.length : 0;
    console.log(`--- ${imageType}: ${res.status === 200 ? count + ' image(s)' : 'HTTP ' + res.status} ---`);
  }

  // Abandon the edit (read-only run)
  await api(token, 'DELETE', `/edits/${editId}`);
  console.log('Edit abandoned (read-only check complete).');
})().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
