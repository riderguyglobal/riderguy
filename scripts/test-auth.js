#!/usr/bin/env node

/**
 * ============================================================
 * RiderGuy — Comprehensive Auth Flow Test Script
 * ============================================================
 *
 * Tests every auth endpoint against the live API:
 *   1. Health check
 *   2. Request OTP (REGISTRATION)
 *   3. Verify OTP (REGISTRATION)
 *   4. Register (with PIN)
 *   5. Get /auth/me
 *   6. List sessions
 *   7. Refresh tokens
 *   8. Logout
 *   9. Request OTP (LOGIN)
 *  10. Verify OTP (LOGIN) — optional, can skip if no real OTP
 *  11. Login with OTP
 *  12. Duplicate registration guard
 *  13. Invalid OTP guard
 *  14. Missing credential guard
 *
 * Usage:
 *   node scripts/test-auth.js                      # default: production API
 *   node scripts/test-auth.js http://localhost:4000 # local dev
 *   API_URL=http://localhost:4000 node scripts/test-auth.js
 *
 * Set TEST_PHONE and TEST_OTP env vars for real OTP testing:
 *   TEST_PHONE=+233551149981 TEST_OTP=123456 node scripts/test-auth.js
 */

const BASE =
  process.argv[2] ||
  process.env.API_URL ||
  'https://riderguy-api.onrender.com';

const API = `${BASE}/api/v1`;

// Test phone — use a unique number to avoid conflicts
const PHONE = process.env.TEST_PHONE || '+233550000001';
const MANUAL_OTP = process.env.TEST_OTP || null; // Set if you know the OTP

// ============================================================
// Helpers
// ============================================================

let passed = 0;
let failed = 0;
let skipped = 0;
const results = [];

async function request(method, path, body, headers = {}) {
  const url = `${API}${path}`;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body) opts.body = JSON.stringify(body);

  const start = Date.now();
  try {
    const res = await fetch(url, opts);
    const elapsed = Date.now() - start;
    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data, elapsed, ok: res.ok };
  } catch (err) {
    return { status: 0, data: null, elapsed: Date.now() - start, ok: false, error: err.message };
  }
}

function log(icon, label, detail = '') {
  const line = `${icon} ${label}${detail ? ` — ${detail}` : ''}`;
  console.log(line);
  return line;
}

function pass(label, detail) {
  passed++;
  const line = log('✅', label, detail);
  results.push({ status: 'PASS', label, detail });
}

function fail(label, detail) {
  failed++;
  const line = log('❌', label, detail);
  results.push({ status: 'FAIL', label, detail });
}

function skip(label, detail) {
  skipped++;
  const line = log('⏭️', label, detail);
  results.push({ status: 'SKIP', label, detail });
}

function expect(value, expected, label) {
  if (value === expected) {
    pass(label, `got ${value}`);
    return true;
  }
  fail(label, `expected ${expected}, got ${value}`);
  return false;
}

function expectIn(value, expectedSet, label) {
  if (expectedSet.includes(value)) {
    pass(label, `got ${value}`);
    return true;
  }
  fail(label, `expected one of [${expectedSet}], got ${value}`);
  return false;
}

// ============================================================
// State — tokens from register/login persist across tests
// ============================================================

let accessToken = null;
let refreshToken = null;
let userId = null;

function authHeaders() {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

// ============================================================
// Tests
// ============================================================

async function testHealthCheck() {
  console.log('\n── 1. Health Check ──');
  const r = await request('GET', '/../health');
  if (r.status === 0) {
    // Try alternative paths
    const r2 = await request('GET', '/../../health');
    if (r2.ok) {
      pass('Health check', `${r2.elapsed}ms`);
      return true;
    }
  }
  if (r.ok) {
    pass('Health check', `${r.elapsed}ms`);
    return true;
  }
  // The health endpoint might be at the root, not under /api/v1
  const r3 = await request('GET', '');
  if (r3.status !== 0) {
    pass('API reachable', `status ${r3.status}, ${r3.elapsed}ms`);
    return true;
  }
  fail('Health check', `status ${r.status} — ${r.error || 'API unreachable'}`);
  return false;
}

async function testRequestOtp(purpose = 'REGISTRATION') {
  console.log(`\n── 2. Request OTP (${purpose}) ──`);
  const r = await request('POST', '/auth/otp/request', { phone: PHONE, purpose });
  if (expectIn(r.status, [200, 429], `POST /auth/otp/request → ${purpose}`)) {
    if (r.status === 429) {
      log('⚠️', 'Rate limited — wait and retry');
    }
    console.log('   Response:', JSON.stringify(r.data, null, 2));
    return r.status === 200;
  }
  console.log('   Response:', JSON.stringify(r.data, null, 2));
  return false;
}

async function testVerifyOtp(purpose = 'REGISTRATION') {
  console.log(`\n── 3. Verify OTP (${purpose}) ──`);
  if (!MANUAL_OTP) {
    skip('Verify OTP', 'No TEST_OTP env var — skipping (need real SMS code)');
    return false;
  }
  const r = await request('POST', '/auth/otp/verify', {
    phone: PHONE,
    otp: MANUAL_OTP,
    purpose,
  });
  expect(r.status, 200, `POST /auth/otp/verify → ${purpose}`);
  console.log('   Response:', JSON.stringify(r.data, null, 2));
  return r.status === 200;
}

async function testRegister() {
  console.log('\n── 4. Register ──');
  const r = await request('POST', '/auth/register', {
    phone: PHONE,
    firstName: 'Test',
    lastName: 'User',
    pin: '123456',
    role: 'RIDER',
  });

  console.log(`   Status: ${r.status} (${r.elapsed}ms)`);
  console.log('   Response:', JSON.stringify(r.data, null, 2));

  if (r.status === 201 && r.data?.data?.accessToken) {
    pass('Register', 'user created + tokens received');
    accessToken = r.data.data.accessToken;
    refreshToken = r.data.data.refreshToken;
    userId = r.data.data.user?.id;
    return true;
  }

  // Analyse the specific error
  const code = r.data?.error?.code;
  const msg = r.data?.error?.message;

  if (code === 'OTP_NOT_VERIFIED') {
    fail('Register', `OTP_NOT_VERIFIED — phone not verified before register. ${msg}`);
  } else if (code === 'PHONE_EXISTS') {
    fail('Register', `PHONE_EXISTS — user already exists. Delete first.`);
  } else if (code === 'DATABASE_ERROR') {
    fail('Register', `DATABASE_ERROR — Prisma threw a non-standard error. Likely $transaction issue with Neon pooler. Message: ${msg}`);
  } else if (code === 'CREDENTIAL_REQUIRED') {
    fail('Register', `CREDENTIAL_REQUIRED — neither password nor PIN provided`);
  } else if (code === 'VALIDATION_ERROR') {
    fail('Register', `Validation failed: ${JSON.stringify(r.data?.error?.details)}`);
  } else if (code === 'INTERNAL_ERROR') {
    fail('Register', `INTERNAL_ERROR (500) — unhandled exception. ${msg}`);
  } else {
    fail('Register', `Unexpected response: ${r.status} ${code} ${msg}`);
  }
  return false;
}

async function testMe() {
  console.log('\n── 5. GET /auth/me ──');
  if (!accessToken) {
    skip('GET /auth/me', 'No access token');
    return false;
  }
  const r = await request('GET', '/auth/me', null, authHeaders());
  console.log(`   Status: ${r.status} (${r.elapsed}ms)`);
  console.log('   Response:', JSON.stringify(r.data, null, 2));

  if (r.status === 200 && r.data?.data?.id) {
    pass('GET /auth/me', `userId=${r.data.data.id}`);
    return true;
  }
  fail('GET /auth/me', `${r.status} ${r.data?.error?.code}`);
  return false;
}

async function testListSessions() {
  console.log('\n── 6. GET /auth/sessions ──');
  if (!accessToken) {
    skip('GET /auth/sessions', 'No access token');
    return false;
  }
  const r = await request('GET', '/auth/sessions', null, authHeaders());
  console.log(`   Status: ${r.status} (${r.elapsed}ms)`);

  if (r.status === 200) {
    const count = Array.isArray(r.data?.data) ? r.data.data.length : '?';
    pass('GET /auth/sessions', `${count} session(s)`);
    return true;
  }
  fail('GET /auth/sessions', `${r.status} ${r.data?.error?.code}`);
  return false;
}

async function testRefreshTokens() {
  console.log('\n── 7. Refresh Tokens ──');
  if (!refreshToken) {
    skip('Refresh tokens', 'No refresh token');
    return false;
  }
  const r = await request('POST', '/auth/refresh', { refreshToken });
  console.log(`   Status: ${r.status} (${r.elapsed}ms)`);

  if (r.status === 200 && r.data?.data?.accessToken) {
    pass('Refresh tokens', 'new tokens received');
    accessToken = r.data.data.accessToken;
    refreshToken = r.data.data.refreshToken;
    return true;
  }
  fail('Refresh tokens', `${r.status} ${r.data?.error?.code}: ${r.data?.error?.message}`);
  return false;
}

async function testLogout() {
  console.log('\n── 8. Logout ──');
  if (!accessToken) {
    skip('Logout', 'No access token');
    return false;
  }
  const r = await request('POST', '/auth/logout', {}, authHeaders());
  console.log(`   Status: ${r.status} (${r.elapsed}ms)`);

  if (r.status === 200) {
    pass('Logout', 'session destroyed');
    accessToken = null;
    refreshToken = null;
    return true;
  }
  fail('Logout', `${r.status} ${r.data?.error?.code}`);
  return false;
}

async function testDuplicateRegister() {
  console.log('\n── 9. Duplicate Registration Guard ──');
  const r = await request('POST', '/auth/register', {
    phone: PHONE,
    firstName: 'Dup',
    lastName: 'Test',
    pin: '123456',
    role: 'RIDER',
  });
  console.log(`   Status: ${r.status} (${r.elapsed}ms)`);
  console.log('   Response:', JSON.stringify(r.data, null, 2));

  const code = r.data?.error?.code;
  if (r.status === 409 && code === 'PHONE_EXISTS') {
    pass('Duplicate register blocked', 'PHONE_EXISTS');
    return true;
  }
  if (r.status === 400 && (code === 'OTP_NOT_VERIFIED' || code === 'OTP_EXPIRED')) {
    pass('Duplicate register blocked', `${code} (OTP gate prevents re-register)`);
    return true;
  }
  if (r.status === 409 && code === 'DUPLICATE_ENTRY') {
    pass('Duplicate register blocked', 'DUPLICATE_ENTRY from Prisma');
    return true;
  }
  fail('Duplicate register guard', `Expected 409 or OTP gate, got ${r.status} ${code}`);
  return false;
}

async function testInvalidOtp() {
  console.log('\n── 10. Invalid OTP Guard ──');
  const r = await request('POST', '/auth/otp/verify', {
    phone: PHONE,
    otp: '000000',
    purpose: 'REGISTRATION',
  });
  console.log(`   Status: ${r.status}`);

  const code = r.data?.error?.code;
  if (r.status === 400 && (code === 'OTP_INVALID' || code === 'OTP_NOT_FOUND')) {
    pass('Invalid OTP rejected', code);
    return true;
  }
  fail('Invalid OTP guard', `Expected 400, got ${r.status} ${code}`);
  return false;
}

async function testMissingCredential() {
  console.log('\n── 11. Missing Credential Guard ──');
  const r = await request('POST', '/auth/register', {
    phone: '+233550000099',
    firstName: 'No',
    lastName: 'Cred',
    role: 'RIDER',
    // No password or PIN!
  });
  console.log(`   Status: ${r.status}`);
  console.log('   Response:', JSON.stringify(r.data, null, 2));

  // Could be caught by Zod (validation) or by auth service (CREDENTIAL_REQUIRED)
  // OR by OTP gate (OTP_NOT_VERIFIED for a different phone)
  const code = r.data?.error?.code;
  if (r.status === 400) {
    pass('Missing credential caught', `${code}: ${r.data?.error?.message}`);
    return true;
  }
  fail('Missing credential guard', `Expected 400, got ${r.status} ${code}`);
  return false;
}

async function testLoginOtpFlow() {
  console.log('\n── 12. Login OTP Request ──');
  // Only makes sense if user was registered
  if (!userId) {
    skip('Login OTP flow', 'No user registered in this test run');
    return false;
  }

  const r = await request('POST', '/auth/otp/request', { phone: PHONE, purpose: 'LOGIN' });
  console.log(`   Status: ${r.status}`);
  if (r.status === 200) {
    pass('Login OTP request', 'sent');
  } else {
    fail('Login OTP request', `${r.status} ${r.data?.error?.code}`);
  }

  // Can't test actual login without real OTP code
  if (!MANUAL_OTP) {
    skip('Login with OTP', 'No TEST_OTP env var');
    return false;
  }

  const r2 = await request('POST', '/auth/login', { phone: PHONE, otp: MANUAL_OTP });
  console.log(`   Login status: ${r2.status}`);
  if (r2.status === 200 && r2.data?.data?.accessToken) {
    pass('Login with OTP', 'tokens received');
    accessToken = r2.data.data.accessToken;
    refreshToken = r2.data.data.refreshToken;
    return true;
  }
  fail('Login with OTP', `${r2.status} ${r2.data?.error?.code}`);
  return false;
}

async function testExpiredToken() {
  console.log('\n── 13. Expired/Invalid Token Guard ──');
  const r = await request('GET', '/auth/me', null, {
    Authorization: 'Bearer invalid.token.here',
  });
  console.log(`   Status: ${r.status}`);
  if (r.status === 401) {
    pass('Invalid token rejected', '401');
    return true;
  }
  fail('Invalid token guard', `Expected 401, got ${r.status}`);
  return false;
}

async function testNoAuthHeader() {
  console.log('\n── 14. No Auth Header Guard ──');
  const r = await request('GET', '/auth/me');
  console.log(`   Status: ${r.status}`);
  if (r.status === 401) {
    pass('No auth header rejected', '401');
    return true;
  }
  fail('No auth header guard', `Expected 401, got ${r.status}`);
  return false;
}

// ============================================================
// Runner
// ============================================================

async function main() {
  console.log('='.repeat(60));
  console.log('  RiderGuy Auth Test Suite');
  console.log(`  API: ${API}`);
  console.log(`  Phone: ${PHONE}`);
  console.log(`  OTP: ${MANUAL_OTP || '(auto — some tests will be skipped)'}`);
  console.log('='.repeat(60));

  // Connectivity
  const healthy = await testHealthCheck();
  if (!healthy) {
    console.log('\n⛔ API unreachable — aborting remaining tests.');
    printSummary();
    process.exit(1);
  }

  // Security guards (don't require registration)
  await testExpiredToken();
  await testNoAuthHeader();
  await testInvalidOtp();

  // OTP flow
  const otpSent = await testRequestOtp('REGISTRATION');
  const otpVerified = await testVerifyOtp('REGISTRATION');

  // Register
  const registered = await testRegister();

  // Authenticated operations
  await testMe();
  await testListSessions();
  await testRefreshTokens();

  // Duplicate guard
  await testDuplicateRegister();

  // Missing credential guard
  await testMissingCredential();

  // Logout
  await testLogout();

  // Login flow
  await testLoginOtpFlow();

  // Summary
  printSummary();
}

function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('  RESULTS');
  console.log('='.repeat(60));
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️';
    console.log(`  ${icon} ${r.label}`);
    if (r.status === 'FAIL') console.log(`     → ${r.detail}`);
  }
  console.log('─'.repeat(60));
  console.log(`  ✅ Passed: ${passed}   ❌ Failed: ${failed}   ⏭️ Skipped: ${skipped}`);
  console.log('='.repeat(60));

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(2);
});
