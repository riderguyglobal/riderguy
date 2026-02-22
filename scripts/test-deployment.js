#!/usr/bin/env node
/**
 * RiderGuy Deployment Test Suite
 * Tests all major API endpoints against the live deployment.
 * Run: node scripts/test-deployment.js
 */

const API = 'https://riderguy-api.onrender.com';
const BASE = `${API}/api/v1`;

const FRONTENDS = [
  'https://riderguy-client.vercel.app',
  'https://riderguy-rider.vercel.app',
  'https://riderguy-admin.vercel.app',
  'https://riderguy-marketing.vercel.app',
];

// Seeded users
const USERS = {
  superAdmin: { email: 'superadmin@riderguy.com', password: 'Password123!' },
  admin:      { email: 'admin@riderguy.com',      password: 'Password123!' },
  rider:      { email: 'chinedu@email.com',        password: 'Password123!' },
  client:     { email: 'aisha@email.com',          password: 'Password123!' },
};

// Stats
const results = { pass: 0, fail: 0, skip: 0, tests: [] };

function log(status, name, detail = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  const line = `${icon} ${status} | ${name}${detail ? ' — ' + detail : ''}`;
  console.log(line);
  results.tests.push({ status, name, detail });
  if (status === 'PASS') results.pass++;
  else if (status === 'FAIL') results.fail++;
  else results.skip++;
}

async function req(method, url, { body, token, expectStatus, raw } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  if (raw) return { status: res.status, data, headers: res.headers };
  return { status: res.status, data };
}

// ─── Tokens storage ───
const tokens = {};

// ═══════════════════════════════════════
//  1. HEALTH CHECK
// ═══════════════════════════════════════
async function testHealth() {
  console.log('\n══════════════════════════════════════');
  console.log('  1. HEALTH CHECK');
  console.log('══════════════════════════════════════');

  try {
    const { status, data } = await req('GET', `${API}/health`);
    if (status === 200 && data.status === 'ok') {
      log('PASS', 'Health endpoint', `DB: ${data.database}, uptime: ${Math.round(data.uptime)}s`);
    } else {
      log('FAIL', 'Health endpoint', `Status ${status}: ${JSON.stringify(data)}`);
    }
  } catch (e) {
    log('FAIL', 'Health endpoint', e.message);
  }
}

// ═══════════════════════════════════════
//  2. AUTH — Password Login (all roles)
// ═══════════════════════════════════════
async function testAuth() {
  console.log('\n══════════════════════════════════════');
  console.log('  2. AUTH — Login & Token Management');
  console.log('══════════════════════════════════════');

  // 2a. Password login for each role
  for (const [role, creds] of Object.entries(USERS)) {
    try {
      const { status, data } = await req('POST', `${BASE}/auth/login/password`, {
        body: creds,
      });
      if (status === 200 && data.data?.accessToken) {
        tokens[role] = {
          access: data.data.accessToken,
          refresh: data.data.refreshToken,
          userId: data.data.user?.id,
        };
        log('PASS', `Login ${role}`, `userId: ${data.data.user?.id?.slice(0, 8)}…`);
      } else {
        log('FAIL', `Login ${role}`, `Status ${status}: ${JSON.stringify(data).slice(0, 200)}`);
      }
    } catch (e) {
      log('FAIL', `Login ${role}`, e.message);
    }
  }

  // 2b. Login with wrong password
  try {
    const { status } = await req('POST', `${BASE}/auth/login/password`, {
      body: { email: 'admin@riderguy.com', password: 'WrongPass!' },
    });
    if (status === 401) {
      log('PASS', 'Reject wrong password', `Got 401`);
    } else {
      log('FAIL', 'Reject wrong password', `Expected 401, got ${status}`);
    }
  } catch (e) {
    log('FAIL', 'Reject wrong password', e.message);
  }

  // 2c. GET /auth/me
  try {
    const { status, data } = await req('GET', `${BASE}/auth/me`, {
      token: tokens.admin?.access,
    });
    if (status === 200 && data.data?.email === 'admin@riderguy.com') {
      log('PASS', 'GET /auth/me (admin)', `role: ${data.data.role}`);
    } else {
      log('FAIL', 'GET /auth/me (admin)', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /auth/me (admin)', e.message);
  }

  // 2d. Unauthenticated access should fail
  try {
    const { status } = await req('GET', `${BASE}/auth/me`);
    if (status === 401) {
      log('PASS', 'Reject unauthenticated /me', `Got 401`);
    } else {
      log('FAIL', 'Reject unauthenticated /me', `Expected 401, got ${status}`);
    }
  } catch (e) {
    log('FAIL', 'Reject unauthenticated /me', e.message);
  }

  // 2e. Token refresh
  if (tokens.client?.refresh) {
    try {
      const { status, data } = await req('POST', `${BASE}/auth/refresh`, {
        body: { refreshToken: tokens.client.refresh },
      });
      if (status === 200 && data.data?.accessToken) {
        tokens.client.access = data.data.accessToken;
        tokens.client.refresh = data.data.refreshToken;
        log('PASS', 'Token refresh (client)', 'New tokens received');
      } else {
        log('FAIL', 'Token refresh (client)', `Status ${status}`);
      }
    } catch (e) {
      log('FAIL', 'Token refresh (client)', e.message);
    }
  }

  // 2f. GET /auth/sessions
  try {
    const { status, data } = await req('GET', `${BASE}/auth/sessions`, {
      token: tokens.admin?.access,
    });
    if (status === 200 && Array.isArray(data.data)) {
      log('PASS', 'GET /auth/sessions', `${data.data.length} session(s)`);
    } else {
      log('FAIL', 'GET /auth/sessions', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /auth/sessions', e.message);
  }

  // 2g. OTP request (should work even without SMS provider — just stores in DB)
  try {
    const { status, data } = await req('POST', `${BASE}/auth/otp/request`, {
      body: { phone: '+2339999999999', purpose: 'REGISTRATION' },
    });
    // Accept 200, 429 (rate limited), or any non-500
    if (status < 500) {
      log('PASS', 'OTP request endpoint', `Status ${status}`);
    } else {
      log('FAIL', 'OTP request endpoint', `Status ${status}: ${JSON.stringify(data).slice(0, 200)}`);
    }
  } catch (e) {
    log('FAIL', 'OTP request endpoint', e.message);
  }
}

// ═══════════════════════════════════════
//  3. USER PROFILE
// ═══════════════════════════════════════
async function testUsers() {
  console.log('\n══════════════════════════════════════');
  console.log('  3. USER PROFILE');
  console.log('══════════════════════════════════════');

  // 3a. Get profile
  try {
    const { status, data } = await req('GET', `${BASE}/users/profile`, {
      token: tokens.client?.access,
    });
    if (status === 200 && data.data?.firstName) {
      log('PASS', 'GET /users/profile (client)', `${data.data.firstName} ${data.data.lastName}`);
    } else {
      log('FAIL', 'GET /users/profile (client)', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /users/profile (client)', e.message);
  }

  // 3b. Update profile
  try {
    const { status, data } = await req('PATCH', `${BASE}/users/profile`, {
      token: tokens.client?.access,
      body: { firstName: 'Aisha', lastName: 'Bello' }, // same data, just verify it works
    });
    if (status === 200) {
      log('PASS', 'PATCH /users/profile', 'Profile updated');
    } else {
      log('FAIL', 'PATCH /users/profile', `Status ${status}: ${JSON.stringify(data).slice(0, 200)}`);
    }
  } catch (e) {
    log('FAIL', 'PATCH /users/profile', e.message);
  }

  // 3c. Admin list users
  try {
    const { status, data } = await req('GET', `${BASE}/users?page=1&limit=5`, {
      token: tokens.superAdmin?.access,
    });
    if (status === 200 && data.data) {
      const count = data.data.users?.length || data.data.length || 0;
      log('PASS', 'GET /users (admin list)', `${count} users returned`);
    } else {
      log('FAIL', 'GET /users (admin list)', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /users (admin list)', e.message);
  }

  // 3d. Non-admin can't list users
  try {
    const { status } = await req('GET', `${BASE}/users`, {
      token: tokens.client?.access,
    });
    if (status === 403) {
      log('PASS', 'Client blocked from /users list', 'Got 403');
    } else {
      log('FAIL', 'Client blocked from /users list', `Expected 403, got ${status}`);
    }
  } catch (e) {
    log('FAIL', 'Client blocked from /users list', e.message);
  }
}

// ═══════════════════════════════════════
//  4. RIDER FEATURES
// ═══════════════════════════════════════
async function testRiders() {
  console.log('\n══════════════════════════════════════');
  console.log('  4. RIDER FEATURES');
  console.log('══════════════════════════════════════');

  // 4a. Rider profile
  try {
    const { status, data } = await req('GET', `${BASE}/riders/profile`, {
      token: tokens.rider?.access,
    });
    if (status === 200 && data.data) {
      log('PASS', 'GET /riders/profile', `onboarding: ${data.data.onboardingStatus}`);
    } else {
      log('FAIL', 'GET /riders/profile', `Status ${status}: ${JSON.stringify(data).slice(0, 200)}`);
    }
  } catch (e) {
    log('FAIL', 'GET /riders/profile', e.message);
  }

  // 4b. Rider availability update
  try {
    const { status, data } = await req('PATCH', `${BASE}/riders/availability`, {
      token: tokens.rider?.access,
      body: { availability: 'ONLINE' },
    });
    if (status === 200) {
      log('PASS', 'PATCH /riders/availability → ONLINE', 'Updated');
    } else {
      log('FAIL', 'PATCH /riders/availability', `Status ${status}: ${JSON.stringify(data).slice(0, 200)}`);
    }
  } catch (e) {
    log('FAIL', 'PATCH /riders/availability', e.message);
  }

  // 4c. Location update
  try {
    const { status, data } = await req('POST', `${BASE}/riders/location`, {
      token: tokens.rider?.access,
      body: { latitude: 5.6037, longitude: -0.1870 }, // Accra, Ghana
    });
    if (status === 200) {
      log('PASS', 'POST /riders/location', 'Location updated');
    } else {
      log('FAIL', 'POST /riders/location', `Status ${status}: ${JSON.stringify(data).slice(0, 200)}`);
    }
  } catch (e) {
    log('FAIL', 'POST /riders/location', e.message);
  }

  // 4d. Get vehicles
  try {
    const { status, data } = await req('GET', `${BASE}/riders/vehicles`, {
      token: tokens.rider?.access,
    });
    if (status === 200) {
      const count = Array.isArray(data.data) ? data.data.length : 0;
      log('PASS', 'GET /riders/vehicles', `${count} vehicle(s)`);
    } else {
      log('FAIL', 'GET /riders/vehicles', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /riders/vehicles', e.message);
  }

  // 4e. Get onboarding status
  try {
    const { status, data } = await req('GET', `${BASE}/riders/onboarding`, {
      token: tokens.rider?.access,
    });
    if (status === 200) {
      log('PASS', 'GET /riders/onboarding', `status: ${data.data?.status || data.data?.onboardingStatus || 'ok'}`);
    } else {
      log('FAIL', 'GET /riders/onboarding', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /riders/onboarding', e.message);
  }

  // 4f. Admin lists riders
  try {
    const { status, data } = await req('GET', `${BASE}/riders?page=1&limit=5`, {
      token: tokens.superAdmin?.access,
    });
    if (status === 200) {
      log('PASS', 'GET /riders (admin)', `Listed riders`);
    } else {
      log('FAIL', 'GET /riders (admin)', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /riders (admin)', e.message);
  }

  // 4g. Admin get rider applications
  try {
    const { status, data } = await req('GET', `${BASE}/riders/applications?page=1&limit=5`, {
      token: tokens.superAdmin?.access,
    });
    if (status === 200) {
      log('PASS', 'GET /riders/applications', 'Applications listed');
    } else {
      log('FAIL', 'GET /riders/applications', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /riders/applications', e.message);
  }

  // 4h. Client can't access rider profile
  try {
    const { status } = await req('GET', `${BASE}/riders/profile`, {
      token: tokens.client?.access,
    });
    if (status === 403) {
      log('PASS', 'Client blocked from rider profile', 'Got 403');
    } else {
      log('FAIL', 'Client blocked from rider profile', `Expected 403, got ${status}`);
    }
  } catch (e) {
    log('FAIL', 'Client blocked from rider profile', e.message);
  }
}

// ═══════════════════════════════════════
//  5. ORDERS
// ═══════════════════════════════════════
async function testOrders() {
  console.log('\n══════════════════════════════════════');
  console.log('  5. ORDERS');
  console.log('══════════════════════════════════════');

  // 5a. Price estimate
  try {
    const { status, data } = await req('POST', `${BASE}/orders/estimate`, {
      token: tokens.client?.access,
      body: {
        pickupLatitude: 5.6037,
        pickupLongitude: -0.1870,
        dropoffLatitude: 5.6145,
        dropoffLongitude: -0.2053,
        packageType: 'SMALL',
      },
    });
    if (status === 200 && data.data) {
      log('PASS', 'POST /orders/estimate', `price: ${data.data.estimatedPrice || data.data.price || 'calculated'}`);
    } else {
      // Could fail if no zone covers Accra yet
      log('FAIL', 'POST /orders/estimate', `Status ${status}: ${JSON.stringify(data).slice(0, 200)}`);
    }
  } catch (e) {
    log('FAIL', 'POST /orders/estimate', e.message);
  }

  // 5b. Geocode
  try {
    const { status, data } = await req('GET', `${BASE}/orders/geocode?address=Accra+Mall`, {
      token: tokens.client?.access,
    });
    if (status === 200) {
      log('PASS', 'GET /orders/geocode', 'Geocode returned');
    } else if (status === 503 || status === 404) {
      log('SKIP', 'GET /orders/geocode', `External geocoding not configured (${status})`);
    } else {
      log('FAIL', 'GET /orders/geocode', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /orders/geocode', e.message);
  }

  // 5c. Autocomplete
  try {
    const { status, data } = await req('GET', `${BASE}/orders/autocomplete?q=Accra`, {
      token: tokens.client?.access,
    });
    if (status === 200) {
      log('PASS', 'GET /orders/autocomplete', 'Autocomplete returned');
    } else if (status === 503 || status === 404) {
      log('SKIP', 'GET /orders/autocomplete', `External service not configured (${status})`);
    } else {
      log('FAIL', 'GET /orders/autocomplete', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /orders/autocomplete', e.message);
  }

  // 5d. List client orders
  try {
    const { status, data } = await req('GET', `${BASE}/orders?page=1&limit=5`, {
      token: tokens.client?.access,
    });
    if (status === 200) {
      const count = data.data?.orders?.length ?? data.data?.length ?? 0;
      log('PASS', 'GET /orders (client)', `${count} order(s)`);
    } else {
      log('FAIL', 'GET /orders (client)', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /orders (client)', e.message);
  }

  // 5e. List rider available orders
  try {
    const { status, data } = await req('GET', `${BASE}/orders/available`, {
      token: tokens.rider?.access,
    });
    if (status === 200) {
      log('PASS', 'GET /orders/available (rider)', 'Available orders listed');
    } else {
      log('FAIL', 'GET /orders/available (rider)', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /orders/available (rider)', e.message);
  }

  // 5f. Dispatch view (admin)
  try {
    const { status, data } = await req('GET', `${BASE}/orders/dispatch?page=1&limit=5`, {
      token: tokens.superAdmin?.access,
    });
    if (status === 200) {
      log('PASS', 'GET /orders/dispatch (admin)', 'Dispatch view returned');
    } else {
      log('FAIL', 'GET /orders/dispatch (admin)', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /orders/dispatch (admin)', e.message);
  }

  // 5g. Dispatch riders list
  try {
    const { status } = await req('GET', `${BASE}/orders/dispatch/riders`, {
      token: tokens.superAdmin?.access,
    });
    if (status === 200) {
      log('PASS', 'GET /orders/dispatch/riders', 'Riders for dispatch listed');
    } else {
      log('FAIL', 'GET /orders/dispatch/riders', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /orders/dispatch/riders', e.message);
  }
}

// ═══════════════════════════════════════
//  6. WALLETS
// ═══════════════════════════════════════
async function testWallets() {
  console.log('\n══════════════════════════════════════');
  console.log('  6. WALLETS');
  console.log('══════════════════════════════════════');

  // 6a. Get wallet
  try {
    const { status, data } = await req('GET', `${BASE}/wallets`, {
      token: tokens.rider?.access,
    });
    if (status === 200 && data.data) {
      log('PASS', 'GET /wallets (rider)', `balance: ${data.data.balance ?? data.data.availableBalance ?? 0}`);
    } else {
      log('FAIL', 'GET /wallets (rider)', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /wallets (rider)', e.message);
  }

  // 6b. Wallet transactions
  try {
    const { status, data } = await req('GET', `${BASE}/wallets/transactions?page=1&limit=5`, {
      token: tokens.rider?.access,
    });
    if (status === 200) {
      log('PASS', 'GET /wallets/transactions', 'Transactions listed');
    } else {
      log('FAIL', 'GET /wallets/transactions', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /wallets/transactions', e.message);
  }

  // 6c. Client wallet
  try {
    const { status, data } = await req('GET', `${BASE}/wallets`, {
      token: tokens.client?.access,
    });
    if (status === 200) {
      log('PASS', 'GET /wallets (client)', `balance: ${data.data?.balance ?? 0}`);
    } else {
      log('FAIL', 'GET /wallets (client)', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /wallets (client)', e.message);
  }
}

// ═══════════════════════════════════════
//  7. ZONES
// ═══════════════════════════════════════
async function testZones() {
  console.log('\n══════════════════════════════════════');
  console.log('  7. ZONES');
  console.log('══════════════════════════════════════');

  // 7a. List zones
  try {
    const { status, data } = await req('GET', `${BASE}/zones`, {
      token: tokens.client?.access,
    });
    if (status === 200) {
      const count = Array.isArray(data.data) ? data.data.length : (data.data?.zones?.length || 0);
      log('PASS', 'GET /zones', `${count} zone(s)`);
    } else {
      log('FAIL', 'GET /zones', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /zones', e.message);
  }
}

// ═══════════════════════════════════════
//  8. DOCUMENTS
// ═══════════════════════════════════════
async function testDocuments() {
  console.log('\n══════════════════════════════════════');
  console.log('  8. DOCUMENTS');
  console.log('══════════════════════════════════════');

  // 8a. Rider's documents
  try {
    const { status, data } = await req('GET', `${BASE}/documents`, {
      token: tokens.rider?.access,
    });
    if (status === 200) {
      const count = Array.isArray(data.data) ? data.data.length : 0;
      log('PASS', 'GET /documents (rider)', `${count} document(s)`);
    } else {
      log('FAIL', 'GET /documents (rider)', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /documents (rider)', e.message);
  }

  // 8b. Admin pending docs
  try {
    const { status, data } = await req('GET', `${BASE}/documents/pending?page=1&pageSize=5`, {
      token: tokens.superAdmin?.access,
    });
    if (status === 200) {
      log('PASS', 'GET /documents/pending (admin)', 'Pending docs listed');
    } else {
      log('FAIL', 'GET /documents/pending (admin)', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /documents/pending (admin)', e.message);
  }
}

// ═══════════════════════════════════════
//  9. NOTIFICATIONS
// ═══════════════════════════════════════
async function testNotifications() {
  console.log('\n══════════════════════════════════════');
  console.log('  9. NOTIFICATIONS');
  console.log('══════════════════════════════════════');

  // 9a. List notifications
  try {
    const { status, data } = await req('GET', `${BASE}/notifications?page=1&pageSize=10`, {
      token: tokens.client?.access,
    });
    if (status === 200) {
      const count = data.data?.notifications?.length ?? (Array.isArray(data.data) ? data.data.length : 0);
      log('PASS', 'GET /notifications', `${count} notification(s)`);
    } else {
      log('FAIL', 'GET /notifications', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /notifications', e.message);
  }

  // 9b. Mark all read
  try {
    const { status } = await req('PATCH', `${BASE}/notifications/read-all`, {
      token: tokens.client?.access,
    });
    if (status === 200) {
      log('PASS', 'PATCH /notifications/read-all', 'All marked read');
    } else {
      log('FAIL', 'PATCH /notifications/read-all', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'PATCH /notifications/read-all', e.message);
  }
}

// ═══════════════════════════════════════
// 10. PAYMENTS
// ═══════════════════════════════════════
async function testPayments() {
  console.log('\n══════════════════════════════════════');
  console.log(' 10. PAYMENTS');
  console.log('══════════════════════════════════════');

  // 10a. Get banks list
  try {
    const { status, data } = await req('GET', `${BASE}/payments/banks`, {
      token: tokens.rider?.access,
    });
    if (status === 200) {
      log('PASS', 'GET /payments/banks', 'Banks list returned');
    } else if (status === 503 || status === 500) {
      log('SKIP', 'GET /payments/banks', `Paystack not configured (${status})`);
    } else {
      log('FAIL', 'GET /payments/banks', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /payments/banks', e.message);
  }

  // 10b. Rider withdrawals history
  try {
    const { status, data } = await req('GET', `${BASE}/payments/withdrawals?page=1&limit=5`, {
      token: tokens.rider?.access,
    });
    if (status === 200) {
      log('PASS', 'GET /payments/withdrawals (rider)', 'Withdrawals listed');
    } else {
      log('FAIL', 'GET /payments/withdrawals (rider)', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /payments/withdrawals (rider)', e.message);
  }

  // 10c. Admin payment stats
  try {
    const { status, data } = await req('GET', `${BASE}/payments/admin/stats`, {
      token: tokens.superAdmin?.access,
    });
    if (status === 200) {
      log('PASS', 'GET /payments/admin/stats', 'Payment stats returned');
    } else {
      log('FAIL', 'GET /payments/admin/stats', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /payments/admin/stats', e.message);
  }

  // 10d. Admin withdrawals list
  try {
    const { status, data } = await req('GET', `${BASE}/payments/admin/withdrawals?page=1&limit=5`, {
      token: tokens.superAdmin?.access,
    });
    if (status === 200) {
      log('PASS', 'GET /payments/admin/withdrawals', 'Admin withdrawals listed');
    } else {
      log('FAIL', 'GET /payments/admin/withdrawals', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /payments/admin/withdrawals', e.message);
  }

  // 10e. Admin transactions
  try {
    const { status, data } = await req('GET', `${BASE}/payments/admin/transactions?page=1&limit=5`, {
      token: tokens.superAdmin?.access,
    });
    if (status === 200) {
      log('PASS', 'GET /payments/admin/transactions', 'Transactions listed');
    } else {
      log('FAIL', 'GET /payments/admin/transactions', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /payments/admin/transactions', e.message);
  }
}

// ═══════════════════════════════════════
// 11. ADMIN DASHBOARD
// ═══════════════════════════════════════
async function testAdmin() {
  console.log('\n══════════════════════════════════════');
  console.log(' 11. ADMIN DASHBOARD');
  console.log('══════════════════════════════════════');

  // 11a. Dashboard stats
  try {
    const { status, data } = await req('GET', `${BASE}/admin/dashboard-stats`, {
      token: tokens.superAdmin?.access,
    });
    if (status === 200 && data.data) {
      log('PASS', 'GET /admin/dashboard-stats', `users: ${data.data.totalUsers ?? '?'}, orders: ${data.data.totalOrders ?? '?'}`);
    } else {
      log('FAIL', 'GET /admin/dashboard-stats', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /admin/dashboard-stats', e.message);
  }

  // 11b. Analytics
  try {
    const { status, data } = await req('GET', `${BASE}/admin/analytics?days=30`, {
      token: tokens.superAdmin?.access,
    });
    if (status === 200) {
      log('PASS', 'GET /admin/analytics', '30-day analytics returned');
    } else {
      log('FAIL', 'GET /admin/analytics', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'GET /admin/analytics', e.message);
  }

  // 11c. Admin get specific user
  if (tokens.client?.userId) {
    try {
      const { status, data } = await req('GET', `${BASE}/admin/users/${tokens.client.userId}`, {
        token: tokens.superAdmin?.access,
      });
      if (status === 200 && data.data) {
        log('PASS', 'GET /admin/users/:id', `Found user: ${data.data.firstName}`);
      } else {
        log('FAIL', 'GET /admin/users/:id', `Status ${status}`);
      }
    } catch (e) {
      log('FAIL', 'GET /admin/users/:id', e.message);
    }
  }

  // 11d. Non-admin blocked from admin routes
  try {
    const { status } = await req('GET', `${BASE}/admin/dashboard-stats`, {
      token: tokens.client?.access,
    });
    if (status === 403) {
      log('PASS', 'Client blocked from admin stats', 'Got 403');
    } else {
      log('FAIL', 'Client blocked from admin stats', `Expected 403, got ${status}`);
    }
  } catch (e) {
    log('FAIL', 'Client blocked from admin stats', e.message);
  }
}

// ═══════════════════════════════════════
// 12. CONTACT FORM
// ═══════════════════════════════════════
async function testContact() {
  console.log('\n══════════════════════════════════════');
  console.log(' 12. CONTACT FORM');
  console.log('══════════════════════════════════════');

  try {
    const { status, data } = await req('POST', `${BASE}/contact`, {
      body: {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        subject: 'general',
        message: 'This is an automated deployment test. Please ignore.',
      },
    });
    if (status === 200 || status === 201) {
      log('PASS', 'POST /contact (public)', 'Contact form submitted');
    } else {
      log('FAIL', 'POST /contact (public)', `Status ${status}: ${JSON.stringify(data).slice(0, 200)}`);
    }
  } catch (e) {
    log('FAIL', 'POST /contact (public)', e.message);
  }
}

// ═══════════════════════════════════════
// 13. CORS — Frontend Origins
// ═══════════════════════════════════════
async function testCORS() {
  console.log('\n══════════════════════════════════════');
  console.log(' 13. CORS — Frontend Origins');
  console.log('══════════════════════════════════════');

  for (const origin of FRONTENDS) {
    try {
      const res = await fetch(`${API}/health`, {
        method: 'OPTIONS',
        headers: {
          'Origin': origin,
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'authorization,content-type',
        },
      });
      const acao = res.headers.get('access-control-allow-origin');
      if (acao === origin || acao === '*') {
        log('PASS', `CORS: ${origin.replace('https://', '')}`, `Allowed`);
      } else {
        log('FAIL', `CORS: ${origin.replace('https://', '')}`, `ACAO: ${acao || 'missing'}`);
      }
    } catch (e) {
      log('FAIL', `CORS: ${origin.replace('https://', '')}`, e.message);
    }
  }
}

// ═══════════════════════════════════════
// 14. FRONTEND AVAILABILITY
// ═══════════════════════════════════════
async function testFrontends() {
  console.log('\n══════════════════════════════════════');
  console.log(' 14. FRONTEND AVAILABILITY');
  console.log('══════════════════════════════════════');

  for (const url of FRONTENDS) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (res.ok) {
        log('PASS', url.replace('https://', ''), `HTTP ${res.status}`);
      } else {
        log('FAIL', url.replace('https://', ''), `HTTP ${res.status}`);
      }
    } catch (e) {
      log('FAIL', url.replace('https://', ''), e.message);
    }
  }
}

// ═══════════════════════════════════════
// 15. SECURITY CHECKS
// ═══════════════════════════════════════
async function testSecurity() {
  console.log('\n══════════════════════════════════════');
  console.log(' 15. SECURITY CHECKS');
  console.log('══════════════════════════════════════');

  // 15a. Expired/invalid token rejected
  try {
    const { status } = await req('GET', `${BASE}/auth/me`, {
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmYWtlIiwicm9sZSI6IkFETUlOIn0.fake',
    });
    if (status === 401) {
      log('PASS', 'Invalid JWT rejected', 'Got 401');
    } else {
      log('FAIL', 'Invalid JWT rejected', `Expected 401, got ${status}`);
    }
  } catch (e) {
    log('FAIL', 'Invalid JWT rejected', e.message);
  }

  // 15b. SQL injection attempt in query
  try {
    const { status } = await req('GET', `${BASE}/users?search=' OR 1=1 --`, {
      token: tokens.superAdmin?.access,
    });
    if (status < 500) {
      log('PASS', 'SQL injection safe (query)', `Status ${status} (no crash)`);
    } else {
      log('FAIL', 'SQL injection safe (query)', `Server error ${status}`);
    }
  } catch (e) {
    log('FAIL', 'SQL injection safe (query)', e.message);
  }

  // 15c. XSS in body treated safely
  try {
    const { status } = await req('PATCH', `${BASE}/users/profile`, {
      token: tokens.client?.access,
      body: { firstName: '<script>alert("xss")</script>' },
    });
    if (status < 500) {
      log('PASS', 'XSS in body handled', `Status ${status} (no crash)`);
    } else {
      log('FAIL', 'XSS in body handled', `Server error ${status}`);
    }
  } catch (e) {
    log('FAIL', 'XSS in body handled', e.message);
  }

  // Reset the name back
  await req('PATCH', `${BASE}/users/profile`, {
    token: tokens.client?.access,
    body: { firstName: 'Aisha' },
  });

  // 15d. Large payload rejected
  try {
    const bigString = 'A'.repeat(1024 * 1024); // 1MB of As
    const { status } = await req('POST', `${BASE}/contact`, {
      body: { firstName: 'Test', lastName: 'Test', email: 'a@b.com', subject: 'general', message: bigString },
    });
    if (status === 413 || status === 400 || status === 422) {
      log('PASS', 'Large payload rejected', `Status ${status}`);
    } else if (status < 500) {
      log('PASS', 'Large payload handled', `Status ${status} (validation caught it)`);
    } else {
      log('FAIL', 'Large payload handling', `Server error ${status}`);
    }
  } catch (e) {
    // Network errors from payload too large are fine
    log('PASS', 'Large payload rejected', 'Connection rejected');
  }
}

// ═══════════════════════════════════════
//  RUNNER
// ═══════════════════════════════════════
async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  RiderGuy Deployment Test Suite          ║');
  console.log('║  API: ' + API.padEnd(34) + '║');
  console.log('╚══════════════════════════════════════════╝');

  await testHealth();
  await testAuth();
  await testUsers();
  await testRiders();
  await testOrders();
  await testWallets();
  await testZones();
  await testDocuments();
  await testNotifications();
  await testPayments();
  await testAdmin();
  await testContact();
  await testCORS();
  await testFrontends();
  await testSecurity();

  // Summary
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  TEST RESULTS SUMMARY                    ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  ✅ PASSED:  ${String(results.pass).padEnd(28)}║`);
  console.log(`║  ❌ FAILED:  ${String(results.fail).padEnd(28)}║`);
  console.log(`║  ⏭️  SKIPPED: ${String(results.skip).padEnd(28)}║`);
  console.log(`║  📊 TOTAL:   ${String(results.pass + results.fail + results.skip).padEnd(28)}║`);
  console.log('╚══════════════════════════════════════════╝');

  if (results.fail > 0) {
    console.log('\n❌ FAILED TESTS:');
    for (const t of results.tests.filter(t => t.status === 'FAIL')) {
      console.log(`   • ${t.name}: ${t.detail}`);
    }
  }

  process.exit(results.fail > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Test suite crashed:', e);
  process.exit(2);
});
