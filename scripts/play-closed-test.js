#!/usr/bin/env node
/**
 * Inspect and update the closed-testing (alpha) track.
 * Usage:
 *   node scripts/play-closed-test.js <key.json> <packageName>            # inspect testers + track
 *   node scripts/play-closed-test.js <key.json> <packageName> --promote <versionCode>  # promote build to alpha
 */
const fs = require('fs');
const crypto = require('crypto');

const [, , keyPath, packageName, ...rest] = process.argv;
if (!keyPath || !packageName) {
  console.error('Usage: node play-closed-test.js <key.json> <packageName> [--promote <versionCode>]');
  process.exit(1);
}
const promoteIdx = rest.indexOf('--promote');
const promoteVc = promoteIdx >= 0 ? parseInt(rest[promoteIdx + 1], 10) : null;
const asDraft = rest.includes('--draft');

const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

function b64url(input) { return Buffer.from(input).toString('base64url'); }

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

async function api(token, method, p, body) {
  const res = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}${p}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, json };
}

(async () => {
  const token = await getAccessToken();
  const edit = await api(token, 'POST', '/edits');
  if (edit.status !== 200) throw new Error(`edit create: ${JSON.stringify(edit.json)}`);
  const editId = edit.json.id;

  const testers = await api(token, 'GET', `/edits/${editId}/testers/alpha`);
  console.log('--- ALPHA (closed test) TESTERS ---');
  console.log(JSON.stringify(testers.json, null, 2));

  const track = await api(token, 'GET', `/edits/${editId}/tracks/alpha`);
  console.log('--- ALPHA TRACK ---');
  console.log(JSON.stringify(track.json, null, 2));

  if (!promoteVc) {
    await api(token, 'DELETE', `/edits/${editId}`);
    console.log('(read-only, edit abandoned)');
    return;
  }

  const update = await api(token, 'PUT', `/edits/${editId}/tracks/alpha`, {
    track: 'alpha',
    releases: [
      {
        name: `${packageName === 'com.riderguy.rider' ? 'RiderGuy Rider' : 'RiderGuy'} 1.0.0 (${promoteVc}) - Closed Test`,
        versionCodes: [String(promoteVc)],
        status: asDraft ? 'draft' : 'completed',
        releaseNotes: [
          {
            language: 'en-US',
            text: packageName === 'com.riderguy.rider'
              ? 'Reliability update for closed testing:\n' +
                '• Push notifications for new delivery jobs and order updates now arrive reliably, including in the background.\n' +
                '• Tapping a notification opens the related delivery directly.\n' +
                '• Staying signed in is now more reliable on poor connections.\n' +
                "• Today's earnings now display correctly on the home screen."
              : 'Reliability update for closed testing:\n' +
                '• Order status push notifications now arrive reliably, including in the background.\n' +
                '• Tapping a notification opens the related order directly.\n' +
                '• Staying signed in is now more reliable on poor connections.\n' +
                '• Improved address search fallbacks when booking a delivery.',
          },
        ],
      },
    ],
  });
  console.log('--- PROMOTE RESULT ---');
  console.log(update.status, JSON.stringify(update.json, null, 2));
  if (update.status !== 200) {
    await api(token, 'DELETE', `/edits/${editId}`);
    throw new Error('track update failed; edit abandoned');
  }

  const val = await api(token, 'POST', `/edits/${editId}:validate`);
  console.log('validate:', val.status);
  const commit = await api(token, 'POST', `/edits/${editId}:commit`);
  console.log('commit:', commit.status, JSON.stringify(commit.json));
})().catch((err) => { console.error('FAILED:', err.message); process.exit(1); });
