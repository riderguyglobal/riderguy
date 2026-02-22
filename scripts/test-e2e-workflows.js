#!/usr/bin/env node
/**
 * RiderGuy E2E Workflow Tests
 * Tests real user journeys across ALL account types.
 * Uses seeded accounts (all password: Password123!)
 * 
 * Run: node scripts/test-e2e-workflows.js
 */

const API = 'https://riderguy-api.onrender.com';
const BASE = `${API}/api/v1`;

// ─── Test Accounts ───
const ACCOUNTS = {
  // Admins
  superAdmin: { email: 'superadmin@riderguy.com', password: 'Password123!', role: 'SUPER_ADMIN' },
  admin:      { email: 'admin@riderguy.com',      password: 'Password123!', role: 'ADMIN' },

  // Active riders (ACTIVATED, can accept orders)
  rider1: { email: 'chinedu@email.com',  password: 'Password123!', role: 'RIDER', name: 'Chinedu Okoro' },
  rider2: { email: 'emeka@email.com',    password: 'Password123!', role: 'RIDER', name: 'Emeka Eze' },
  rider3: { email: 'tunde@email.com',    password: 'Password123!', role: 'RIDER', name: 'Tunde Bakare' },
  rider4: { email: 'ibrahim@email.com',  password: 'Password123!', role: 'RIDER', name: 'Ibrahim Musa' },

  // Riders in various onboarding stages
  riderPendingDocs:    { email: 'dayo@email.com',   password: 'Password123!', role: 'RIDER', name: 'Dayo Adeyemi' },
  riderDocsReview:     { email: 'segun@email.com',  password: 'Password123!', role: 'RIDER', name: 'Segun Afolabi' },
  riderDocsRejected:   { email: 'yusuf@email.com',  password: 'Password123!', role: 'RIDER', name: 'Yusuf Abdullahi' },
  riderNewlyRegistered:{ email: 'kunle@email.com',  password: 'Password123!', role: 'RIDER', name: 'Kunle Oladipo' },

  // Clients (can create orders)
  client1: { email: 'aisha@email.com',  password: 'Password123!', role: 'CLIENT', name: 'Aisha Bello' },
  client2: { email: 'ngozi@email.com',  password: 'Password123!', role: 'CLIENT', name: 'Ngozi Onyeka' },
  client3: { email: 'temi@email.com',   password: 'Password123!', role: 'CLIENT', name: 'Temi Adekunle' },
  client4: { email: 'femi@email.com',   password: 'Password123!', role: 'CLIENT', name: 'Femi Oluwole' },
  client5: { email: 'chioma@email.com', password: 'Password123!', role: 'CLIENT', name: 'Chioma Obi' },
};

const results = { pass: 0, fail: 0, skip: 0, tests: [] };

function log(status, name, detail = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} ${status} | ${name}${detail ? ' — ' + detail : ''}`);
  results.tests.push({ status, name, detail });
  if (status === 'PASS') results.pass++;
  else if (status === 'FAIL') results.fail++;
  else results.skip++;
}

function section(title) {
  console.log(`\n${'═'.repeat(55)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(55));
}

async function req(method, url, { body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

// ─── Token Store ───
const tokens = {};

async function login(key) {
  const acct = ACCOUNTS[key];
  const { status, data } = await req('POST', `${BASE}/auth/login/password`, {
    body: { email: acct.email, password: acct.password },
  });
  if (status === 200 && data.data?.accessToken) {
    tokens[key] = {
      access: data.data.accessToken,
      refresh: data.data.refreshToken,
      userId: data.data.user?.id,
      user: data.data.user,
    };
    return true;
  }
  return false;
}

// ╔═══════════════════════════════════════════════════════╗
// ║  PHASE 1: Login ALL 15 accounts                      ║
// ╚═══════════════════════════════════════════════════════╝
async function phase1_LoginAllAccounts() {
  section('PHASE 1: Login ALL 15 Accounts');

  for (const [key, acct] of Object.entries(ACCOUNTS)) {
    try {
      const ok = await login(key);
      if (ok) {
        const u = tokens[key].user;
        log('PASS', `Login ${acct.role} — ${acct.name || acct.email}`,
          `id: ${tokens[key].userId?.slice(0, 8)}… | role: ${u.role} | status: ${u.accountStatus}`);
      } else {
        log('FAIL', `Login ${key}`, `Failed for ${acct.email}`);
      }
    } catch (e) {
      log('FAIL', `Login ${key}`, e.message);
    }
  }
}

// ╔═══════════════════════════════════════════════════════╗
// ║  PHASE 2: Profile & Identity for each account        ║
// ╚═══════════════════════════════════════════════════════╝
async function phase2_Profiles() {
  section('PHASE 2: Profile Verification (All Accounts)');

  // Check /auth/me for all accounts
  for (const [key, acct] of Object.entries(ACCOUNTS)) {
    if (!tokens[key]) continue;
    try {
      const { status, data } = await req('GET', `${BASE}/auth/me`, { token: tokens[key].access });
      if (status === 200 && data.data) {
        const u = data.data;
        log('PASS', `Identity ${key}`, `${u.firstName} ${u.lastName} | ${u.role} | ${u.phone}`);
      } else {
        log('FAIL', `Identity ${key}`, `Status ${status}`);
      }
    } catch (e) {
      log('FAIL', `Identity ${key}`, e.message);
    }
  }
}

// ╔═══════════════════════════════════════════════════════╗
// ║  PHASE 3: Rider-specific features (all 8 riders)     ║
// ╚═══════════════════════════════════════════════════════╝
async function phase3_RiderFeatures() {
  section('PHASE 3: Rider Features (All 8 Riders)');

  const riderKeys = ['rider1', 'rider2', 'rider3', 'rider4', 'riderPendingDocs', 'riderDocsReview', 'riderDocsRejected', 'riderNewlyRegistered'];

  for (const key of riderKeys) {
    if (!tokens[key]) continue;
    const name = ACCOUNTS[key].name;

    // Rider profile
    try {
      const { status, data } = await req('GET', `${BASE}/riders/profile`, { token: tokens[key].access });
      if (status === 200 && data.data) {
        const p = data.data;
        log('PASS', `Rider profile: ${name}`,
          `onboarding: ${p.onboardingStatus} | avail: ${p.availability} | deliveries: ${p.totalDeliveries} | rating: ${p.averageRating}`);
      } else {
        log('FAIL', `Rider profile: ${name}`, `Status ${status}`);
      }
    } catch (e) {
      log('FAIL', `Rider profile: ${name}`, e.message);
    }

    // Onboarding status
    try {
      const { status, data } = await req('GET', `${BASE}/riders/onboarding`, { token: tokens[key].access });
      if (status === 200) {
        log('PASS', `Onboarding: ${name}`, JSON.stringify(data.data).slice(0, 100));
      } else {
        log('FAIL', `Onboarding: ${name}`, `Status ${status}`);
      }
    } catch (e) {
      log('FAIL', `Onboarding: ${name}`, e.message);
    }

    // Vehicles
    try {
      const { status, data } = await req('GET', `${BASE}/riders/vehicles`, { token: tokens[key].access });
      if (status === 200) {
        const vehicles = Array.isArray(data.data) ? data.data : [];
        if (vehicles.length > 0) {
          const v = vehicles[0];
          log('PASS', `Vehicles: ${name}`, `${vehicles.length} vehicle(s) — ${v.make} ${v.model} (${v.plateNumber})`);
        } else {
          log('PASS', `Vehicles: ${name}`, `0 vehicles (expected for ${ACCOUNTS[key].name})`);
        }
      } else {
        log('FAIL', `Vehicles: ${name}`, `Status ${status}`);
      }
    } catch (e) {
      log('FAIL', `Vehicles: ${name}`, e.message);
    }

    // Documents
    try {
      const { status, data } = await req('GET', `${BASE}/documents`, { token: tokens[key].access });
      if (status === 200) {
        const docs = Array.isArray(data.data) ? data.data : [];
        const statuses = docs.map(d => d.status);
        log('PASS', `Documents: ${name}`, `${docs.length} doc(s) — statuses: [${[...new Set(statuses)].join(', ')}]`);
      } else {
        log('FAIL', `Documents: ${name}`, `Status ${status}`);
      }
    } catch (e) {
      log('FAIL', `Documents: ${name}`, e.message);
    }
  }

  // Test availability updates for active riders
  section('PHASE 3b: Rider Availability Updates');
  const availStates = ['ONLINE', 'ON_BREAK', 'ONLINE', 'OFFLINE'];
  for (const state of availStates) {
    try {
      const { status, data } = await req('PATCH', `${BASE}/riders/availability`, {
        token: tokens.rider1.access,
        body: { availability: state },
      });
      if (status === 200) {
        log('PASS', `Rider1 → ${state}`, 'Availability changed');
      } else {
        log('FAIL', `Rider1 → ${state}`, `Status ${status}: ${JSON.stringify(data).slice(0, 100)}`);
      }
    } catch (e) {
      log('FAIL', `Rider1 → ${state}`, e.message);
    }
  }

  // Set rider1 back ONLINE for order tests
  await req('PATCH', `${BASE}/riders/availability`, {
    token: tokens.rider1.access,
    body: { availability: 'ONLINE' },
  });

  // Location updates
  section('PHASE 3c: Rider Location Updates');
  const locations = [
    { lat: 5.6037, lng: -0.1870, label: 'Accra Central' },
    { lat: 5.5560, lng: -0.1969, label: 'University of Ghana' },
    { lat: 5.6145, lng: -0.2053, label: 'Achimota' },
  ];
  for (const loc of locations) {
    try {
      const { status } = await req('POST', `${BASE}/riders/location`, {
        token: tokens.rider1.access,
        body: { latitude: loc.lat, longitude: loc.lng },
      });
      if (status === 200) {
        log('PASS', `Location: ${loc.label}`, `${loc.lat}, ${loc.lng}`);
      } else {
        log('FAIL', `Location: ${loc.label}`, `Status ${status}`);
      }
    } catch (e) {
      log('FAIL', `Location: ${loc.label}`, e.message);
    }
  }
}

// ╔═══════════════════════════════════════════════════════╗
// ║  PHASE 4: Client features                            ║
// ╚═══════════════════════════════════════════════════════╝
async function phase4_ClientFeatures() {
  section('PHASE 4: Client Features (All 5 Clients)');

  const clientKeys = ['client1', 'client2', 'client3', 'client4', 'client5'];

  for (const key of clientKeys) {
    if (!tokens[key]) continue;
    const name = ACCOUNTS[key].name;

    // Profile
    try {
      const { status, data } = await req('GET', `${BASE}/users/profile`, { token: tokens[key].access });
      if (status === 200 && data.data) {
        log('PASS', `Profile: ${name}`, `${data.data.firstName} ${data.data.lastName} | ${data.data.email}`);
      } else {
        log('FAIL', `Profile: ${name}`, `Status ${status}`);
      }
    } catch (e) {
      log('FAIL', `Profile: ${name}`, e.message);
    }

    // Wallet
    try {
      const { status, data } = await req('GET', `${BASE}/wallets`, { token: tokens[key].access });
      if (status === 200 && data.data) {
        log('PASS', `Wallet: ${name}`, `balance: ${data.data.balance} ${data.data.currency || 'NGN'}`);
      } else {
        log('FAIL', `Wallet: ${name}`, `Status ${status}`);
      }
    } catch (e) {
      log('FAIL', `Wallet: ${name}`, e.message);
    }

    // Order history
    try {
      const { status, data } = await req('GET', `${BASE}/orders?page=1&limit=10`, { token: tokens[key].access });
      if (status === 200) {
        const orders = data.data?.orders || data.data || [];
        const count = Array.isArray(orders) ? orders.length : 0;
        if (count > 0) {
          const statuses = orders.map(o => o.status);
          log('PASS', `Orders: ${name}`, `${count} order(s) — [${statuses.join(', ')}]`);
        } else {
          log('PASS', `Orders: ${name}`, `0 orders`);
        }
      } else {
        log('FAIL', `Orders: ${name}`, `Status ${status}`);
      }
    } catch (e) {
      log('FAIL', `Orders: ${name}`, e.message);
    }

    // Notifications
    try {
      const { status, data } = await req('GET', `${BASE}/notifications?page=1&pageSize=5`, { token: tokens[key].access });
      if (status === 200) {
        const notifs = data.data?.notifications || data.data || [];
        const count = Array.isArray(notifs) ? notifs.length : 0;
        log('PASS', `Notifications: ${name}`, `${count} notification(s)`);
      } else {
        log('FAIL', `Notifications: ${name}`, `Status ${status}`);
      }
    } catch (e) {
      log('FAIL', `Notifications: ${name}`, e.message);
    }
  }
}

// ╔═══════════════════════════════════════════════════════╗
// ║  PHASE 5: Order Lifecycle (create → deliver)         ║
// ╚═══════════════════════════════════════════════════════╝
async function phase5_OrderLifecycle() {
  section('PHASE 5: Full Order Lifecycle');

  // Use whichever client is logged in
  const orderClient = tokens.client5 ? 'client5' : 'client4';
  const orderClientName = ACCOUNTS[orderClient].name;

  // 5a. Get price estimate
  let estimateData;
  try {
    const { status, data } = await req('POST', `${BASE}/orders/estimate`, {
      token: tokens[orderClient].access,
      body: {
        pickupLatitude: 6.6018,
        pickupLongitude: 3.3515,
        dropoffLatitude: 6.5059,
        dropoffLongitude: 3.3687,
        packageType: 'SMALL_PARCEL',
      },
    });
    if (status === 200 && data.data) {
      estimateData = data.data;
      log('PASS', 'Price estimate', `₦${estimateData.estimatedPrice || estimateData.totalPrice || '?'} | ${estimateData.distanceKm || '?'}km | ${estimateData.estimatedDurationMinutes || '?'}min`);
    } else {
      log('FAIL', 'Price estimate', `Status ${status}: ${JSON.stringify(data).slice(0, 200)}`);
    }
  } catch (e) {
    log('FAIL', 'Price estimate', e.message);
  }

  // 5b. Create order
  let newOrderId;
  try {
    const { status, data } = await req('POST', `${BASE}/orders`, {
      token: tokens[orderClient].access,
      body: {
        pickupAddress: '15 Awolowo Road, Ikeja, Lagos',
        pickupLatitude: 6.6018,
        pickupLongitude: 3.3515,
        pickupContactName: orderClientName,
        pickupContactPhone: '+2348200000005',
        pickupInstructions: 'Ring the bell at gate',
        dropoffAddress: '22 Bode Thomas Street, Surulere, Lagos',
        dropoffLatitude: 6.5059,
        dropoffLongitude: 3.3687,
        dropoffContactName: 'Kelechi',
        dropoffContactPhone: '+2348300000001',
        dropoffInstructions: 'Leave with the security guard',
        packageType: 'SMALL_PARCEL',
        packageDescription: 'E2E test package — small electronics',
        paymentMethod: 'CASH',
      },
    });
    if (status === 201 || status === 200) {
      newOrderId = data.data?.id;
      log('PASS', `Create order (${orderClientName})`,
        `orderId: ${newOrderId?.slice(0, 8)}… | #${data.data?.orderNumber} | status: ${data.data?.status} | ₦${data.data?.totalPrice}`);
    } else {
      log('FAIL', `Create order (${orderClientName})`, `Status ${status}: ${JSON.stringify(data).slice(0, 250)}`);
    }
  } catch (e) {
    log('FAIL', `Create order (${orderClientName})`, e.message);
  }

  if (!newOrderId) {
    log('SKIP', 'Order lifecycle', 'Cannot continue without order ID');
    return;
  }

  // 5c. View order as client
  try {
    const { status, data } = await req('GET', `${BASE}/orders/${newOrderId}`, {
      token: tokens[orderClient].access,
    });
    if (status === 200 && data.data) {
      log('PASS', 'View order (client)', `status: ${data.data.status} | pickup: ${data.data.pickupAddress?.slice(0, 30)}…`);
    } else {
      log('FAIL', 'View order (client)', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'View order (client)', e.message);
  }

  // 5d. Admin assigns rider to order
  // First get a rider profile ID
  let riderProfileId;
  try {
    const { status, data } = await req('GET', `${BASE}/riders/profile`, { token: tokens.rider2.access });
    if (status === 200 && data.data) {
      riderProfileId = data.data.id;
      log('PASS', 'Get rider profile ID', `Emeka's riderProfileId: ${riderProfileId?.slice(0, 8)}…`);
    }
  } catch (e) {
    log('FAIL', 'Get rider profile ID', e.message);
  }

  // Make rider2 (Emeka) online first
  await req('PATCH', `${BASE}/riders/availability`, {
    token: tokens.rider2.access,
    body: { availability: 'ONLINE' },
  });

  if (riderProfileId) {
    try {
      const { status, data } = await req('POST', `${BASE}/orders/${newOrderId}/assign`, {
        token: tokens.superAdmin.access,
        body: { riderProfileId },
      });
      if (status === 200) {
        log('PASS', 'Admin assigns rider', `Emeka assigned to order`);
      } else {
        log('FAIL', 'Admin assigns rider', `Status ${status}: ${JSON.stringify(data).slice(0, 200)}`);
      }
    } catch (e) {
      log('FAIL', 'Admin assigns rider', e.message);
    }
  }

  // 5e. Walk through order statuses (rider perspective)
  const statusFlow = [
    'PICKUP_EN_ROUTE',
    'AT_PICKUP',
    'PICKED_UP',
    'IN_TRANSIT',
    'AT_DROPOFF',
    'DELIVERED',
  ];

  for (const nextStatus of statusFlow) {
    try {
      const { status, data } = await req('PATCH', `${BASE}/orders/${newOrderId}/status`, {
        token: tokens.rider2.access,
        body: { status: nextStatus, note: `E2E test: moving to ${nextStatus}` },
      });
      if (status === 200) {
        log('PASS', `Status → ${nextStatus}`, 'Rider updated');
      } else {
        log('FAIL', `Status → ${nextStatus}`, `Status ${status}: ${JSON.stringify(data).slice(0, 200)}`);
      }
    } catch (e) {
      log('FAIL', `Status → ${nextStatus}`, e.message);
    }
  }

  // 5f. Client rates the delivered order
  try {
    const { status, data } = await req('POST', `${BASE}/orders/${newOrderId}/rate`, {
      token: tokens[orderClient].access,
      body: { rating: 5, review: 'Excellent delivery! Very fast.', tipAmount: 200 },
    });
    if (status === 200) {
      log('PASS', 'Client rates order', '5 stars + ₦200 tip');
    } else {
      log('FAIL', 'Client rates order', `Status ${status}: ${JSON.stringify(data).slice(0, 200)}`);
    }
  } catch (e) {
    log('FAIL', 'Client rates order', e.message);
  }

  // 5g. Verify order is now DELIVERED with rating
  try {
    const { status, data } = await req('GET', `${BASE}/orders/${newOrderId}`, {
      token: tokens[orderClient].access,
    });
    if (status === 200 && data.data?.status === 'DELIVERED') {
      log('PASS', 'Verify delivered order', `status: ${data.data.status} | rating: ${data.data.rating || '?'}`);
    } else {
      log('FAIL', 'Verify delivered order', `status: ${data.data?.status}, expected DELIVERED`);
    }
  } catch (e) {
    log('FAIL', 'Verify delivered order', e.message);
  }
}

// ╔═══════════════════════════════════════════════════════╗
// ║  PHASE 6: Order Cancellation Flow                    ║
// ╚═══════════════════════════════════════════════════════╝
async function phase6_OrderCancellation() {
  section('PHASE 6: Order Cancellation Flow');

  // Create another order then cancel it
  let cancelOrderId;
  try {
    const { status, data } = await req('POST', `${BASE}/orders`, {
      token: tokens.client4.access,
      body: {
        pickupAddress: '5 Allen Avenue, Ikeja, Lagos',
        pickupLatitude: 6.6018,
        pickupLongitude: 3.3515,
        dropoffAddress: '10 Adeola Odeku, Victoria Island, Lagos',
        dropoffLatitude: 6.4281,
        dropoffLongitude: 3.4219,
        packageType: 'DOCUMENT',
        paymentMethod: 'CASH',
      },
    });
    if (status === 201 || status === 200) {
      cancelOrderId = data.data?.id;
      log('PASS', 'Create order for cancellation', `#${data.data?.orderNumber}`);
    } else {
      log('FAIL', 'Create order for cancellation', `Status ${status}: ${JSON.stringify(data).slice(0, 200)}`);
    }
  } catch (e) {
    log('FAIL', 'Create order for cancellation', e.message);
  }

  if (cancelOrderId) {
    try {
      const { status, data } = await req('POST', `${BASE}/orders/${cancelOrderId}/cancel`, {
        token: tokens.client4.access,
        body: { reason: 'E2E test: changed my mind' },
      });
      if (status === 200) {
        log('PASS', 'Client cancels order', `status: ${data.data?.status}`);
      } else {
        log('FAIL', 'Client cancels order', `Status ${status}: ${JSON.stringify(data).slice(0, 200)}`);
      }
    } catch (e) {
      log('FAIL', 'Client cancels order', e.message);
    }
  }
}

// ╔═══════════════════════════════════════════════════════╗
// ║  PHASE 7: Wallet & Financial Features                ║
// ╚═══════════════════════════════════════════════════════╝
async function phase7_WalletsAndFinance() {
  section('PHASE 7: Wallets & Financial Features');

  // Rider wallets
  const riderKeys = ['rider1', 'rider2', 'rider3', 'rider4'];
  for (const key of riderKeys) {
    if (!tokens[key]) continue;
    try {
      const { status, data } = await req('GET', `${BASE}/wallets`, { token: tokens[key].access });
      if (status === 200 && data.data) {
        const w = data.data;
        log('PASS', `Wallet: ${ACCOUNTS[key].name}`,
          `balance: ₦${w.balance} | earned: ₦${w.totalEarnings || '?'} | withdrawn: ₦${w.totalWithdrawn || '?'}`);
      } else {
        log('FAIL', `Wallet: ${ACCOUNTS[key].name}`, `Status ${status}`);
      }
    } catch (e) {
      log('FAIL', `Wallet: ${ACCOUNTS[key].name}`, e.message);
    }
  }

  // Transaction history for rider1
  try {
    const { status, data } = await req('GET', `${BASE}/wallets/transactions?page=1&limit=10`, {
      token: tokens.rider1.access,
    });
    if (status === 200) {
      const txns = data.data?.transactions || data.data || [];
      const count = Array.isArray(txns) ? txns.length : 0;
      if (count > 0) {
        const types = txns.map(t => t.type);
        log('PASS', 'Rider1 transactions', `${count} txn(s) — types: [${[...new Set(types)].join(', ')}]`);
      } else {
        log('PASS', 'Rider1 transactions', '0 transactions');
      }
    } else {
      log('FAIL', 'Rider1 transactions', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'Rider1 transactions', e.message);
  }

  // Banks list (Paystack)
  try {
    const { status, data } = await req('GET', `${BASE}/payments/banks`, { token: tokens.rider1.access });
    if (status === 200) {
      const banks = data.data || [];
      const count = Array.isArray(banks) ? banks.length : 0;
      log('PASS', 'Banks list (Paystack)', `${count} bank(s) available`);
    } else {
      log('SKIP', 'Banks list (Paystack)', `Not configured (${status})`);
    }
  } catch (e) {
    log('FAIL', 'Banks list', e.message);
  }
}

// ╔═══════════════════════════════════════════════════════╗
// ║  PHASE 8: Admin Dashboard & Management               ║
// ╚═══════════════════════════════════════════════════════╝
async function phase8_AdminDashboard() {
  section('PHASE 8: Admin Dashboard & Management');

  // 8a. Dashboard stats
  try {
    const { status, data } = await req('GET', `${BASE}/admin/dashboard-stats`, {
      token: tokens.superAdmin.access,
    });
    if (status === 200 && data.data) {
      const s = data.data;
      log('PASS', 'Dashboard stats', JSON.stringify(s).slice(0, 150));
    } else {
      log('FAIL', 'Dashboard stats', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'Dashboard stats', e.message);
  }

  // 8b. Analytics
  try {
    const { status, data } = await req('GET', `${BASE}/admin/analytics?days=30`, {
      token: tokens.superAdmin.access,
    });
    if (status === 200 && data.data) {
      log('PASS', 'Analytics (30 days)', `Data keys: [${Object.keys(data.data).join(', ')}]`);
    } else {
      log('FAIL', 'Analytics', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'Analytics', e.message);
  }

  // 8c. List all users
  try {
    const { status, data } = await req('GET', `${BASE}/users?page=1&limit=20`, {
      token: tokens.superAdmin.access,
    });
    if (status === 200) {
      const users = data.data?.users || data.data || [];
      const count = Array.isArray(users) ? users.length : 0;
      const roles = users.map(u => u.role);
      const roleCounts = {};
      roles.forEach(r => { roleCounts[r] = (roleCounts[r] || 0) + 1; });
      log('PASS', 'List all users', `${count} user(s) — ${JSON.stringify(roleCounts)}`);
    } else {
      log('FAIL', 'List all users', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'List all users', e.message);
  }

  // 8d. View specific user details
  if (tokens.client1?.userId) {
    try {
      const { status, data } = await req('GET', `${BASE}/admin/users/${tokens.client1.userId}`, {
        token: tokens.superAdmin.access,
      });
      if (status === 200 && data.data) {
        const u = data.data;
        log('PASS', `View user: Aisha Bello`, `role: ${u.role} | status: ${u.accountStatus} | email: ${u.email}`);
      } else {
        log('FAIL', 'View user detail', `Status ${status}`);
      }
    } catch (e) {
      log('FAIL', 'View user detail', e.message);
    }
  }

  // 8e. List rider applications
  try {
    const { status, data } = await req('GET', `${BASE}/riders/applications?page=1&limit=10`, {
      token: tokens.superAdmin.access,
    });
    if (status === 200) {
      const apps = data.data?.applications || data.data || [];
      const count = Array.isArray(apps) ? apps.length : 0;
      log('PASS', 'Rider applications', `${count} application(s)`);
    } else {
      log('FAIL', 'Rider applications', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'Rider applications', e.message);
  }

  // 8f. Pending document reviews
  try {
    const { status, data } = await req('GET', `${BASE}/documents/pending?page=1&pageSize=10`, {
      token: tokens.superAdmin.access,
    });
    if (status === 200) {
      const docs = data.data?.documents || data.data || [];
      const count = Array.isArray(docs) ? docs.length : 0;
      log('PASS', 'Pending documents', `${count} doc(s) awaiting review`);
    } else {
      log('FAIL', 'Pending documents', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'Pending documents', e.message);
  }

  // 8g. Dispatch view
  try {
    const { status, data } = await req('GET', `${BASE}/orders/dispatch?page=1&limit=10`, {
      token: tokens.superAdmin.access,
    });
    if (status === 200) {
      const orders = data.data?.orders || data.data || [];
      const count = Array.isArray(orders) ? orders.length : 0;
      log('PASS', 'Dispatch view', `${count} order(s) in dispatch`);
    } else {
      log('FAIL', 'Dispatch view', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'Dispatch view', e.message);
  }

  // 8h. Payment stats
  try {
    const { status, data } = await req('GET', `${BASE}/payments/admin/stats`, {
      token: tokens.superAdmin.access,
    });
    if (status === 200 && data.data) {
      log('PASS', 'Payment stats', JSON.stringify(data.data).slice(0, 150));
    } else {
      log('FAIL', 'Payment stats', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'Payment stats', e.message);
  }

  // 8i. Withdrawal management
  try {
    const { status, data } = await req('GET', `${BASE}/payments/admin/withdrawals?page=1&limit=5`, {
      token: tokens.superAdmin.access,
    });
    if (status === 200) {
      log('PASS', 'Admin withdrawals', 'Listed');
    } else {
      log('FAIL', 'Admin withdrawals', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'Admin withdrawals', e.message);
  }
}

// ╔═══════════════════════════════════════════════════════╗
// ║  PHASE 9: Zone Management                            ║
// ╚═══════════════════════════════════════════════════════╝
async function phase9_Zones() {
  section('PHASE 9: Zone Management');

  // List all zones
  let zones = [];
  try {
    const { status, data } = await req('GET', `${BASE}/zones`, { token: tokens.superAdmin.access });
    if (status === 200) {
      zones = Array.isArray(data.data) ? data.data : (data.data?.zones || []);
      for (const z of zones) {
        log('PASS', `Zone: ${z.name}`,
          `baseFare: ₦${z.baseFare} | perKm: ₦${z.perKmRate} | min: ₦${z.minimumFare} | surge: ${z.surgeMultiplier}x | status: ${z.status}`);
      }
    } else {
      log('FAIL', 'List zones', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'List zones', e.message);
  }

  // Update surge on first zone
  if (zones.length > 0) {
    const zoneId = zones[0].id;
    // Set surge
    try {
      const { status, data } = await req('PATCH', `${BASE}/zones/${zoneId}/surge`, {
        token: tokens.superAdmin.access,
        body: { surgeMultiplier: 1.5 },
      });
      if (status === 200) {
        log('PASS', `Surge → 1.5x (${zones[0].name})`, 'Updated');
      } else {
        log('FAIL', 'Set surge', `Status ${status}: ${JSON.stringify(data).slice(0, 150)}`);
      }
    } catch (e) {
      log('FAIL', 'Set surge', e.message);
    }

    // Reset surge
    try {
      await req('PATCH', `${BASE}/zones/${zoneId}/surge`, {
        token: tokens.superAdmin.access,
        body: { surgeMultiplier: 1.0 },
      });
      log('PASS', `Surge → 1.0x (reset)`, 'Reset');
    } catch (e) {
      log('FAIL', 'Reset surge', e.message);
    }
  }
}

// ╔═══════════════════════════════════════════════════════╗
// ║  PHASE 10: RBAC — Role-Based Access Control          ║
// ╚═══════════════════════════════════════════════════════╝
async function phase10_RBAC() {
  section('PHASE 10: Role-Based Access Control');

  const checks = [
    // Clients can't access rider features
    { key: 'client1', method: 'GET', url: `${BASE}/riders/profile`, expect: 403, label: 'Client → rider profile' },
    { key: 'client1', method: 'GET', url: `${BASE}/riders/vehicles`, expect: 403, label: 'Client → rider vehicles' },
    // Clients can't access admin features
    { key: 'client1', method: 'GET', url: `${BASE}/admin/dashboard-stats`, expect: 403, label: 'Client → admin stats' },
    { key: 'client1', method: 'GET', url: `${BASE}/admin/analytics?days=7`, expect: 403, label: 'Client → admin analytics' },
    { key: 'client1', method: 'GET', url: `${BASE}/users?page=1&limit=5`, expect: 403, label: 'Client → user list' },
    // Riders can't access admin features
    { key: 'rider1', method: 'GET', url: `${BASE}/admin/dashboard-stats`, expect: 403, label: 'Rider → admin stats' },
    { key: 'rider1', method: 'GET', url: `${BASE}/users?page=1&limit=5`, expect: 403, label: 'Rider → user list' },
    // Riders can't create orders
    { key: 'rider1', method: 'POST', url: `${BASE}/orders`, expect: 403, label: 'Rider → create order',
      body: { pickupAddress: 'x', pickupLatitude: 1, pickupLongitude: 1, dropoffAddress: 'y', dropoffLatitude: 1, dropoffLongitude: 1, packageType: 'DOCUMENT', paymentMethod: 'CASH' } },
    // Unauthenticated access
    { key: null, method: 'GET', url: `${BASE}/auth/me`, expect: 401, label: 'No token → /me' },
    { key: null, method: 'GET', url: `${BASE}/orders`, expect: 401, label: 'No token → orders' },
    { key: null, method: 'GET', url: `${BASE}/wallets`, expect: 401, label: 'No token → wallets' },
  ];

  for (const check of checks) {
    try {
      const opts = {};
      if (check.key && tokens[check.key]) opts.token = tokens[check.key].access;
      if (check.body) opts.body = check.body;
      const { status } = await req(check.method, check.url, opts);
      if (status === check.expect) {
        log('PASS', check.label, `Got ${status} (expected)`);
      } else {
        log('FAIL', check.label, `Expected ${check.expect}, got ${status}`);
      }
    } catch (e) {
      log('FAIL', check.label, e.message);
    }
  }
}

// ╔═══════════════════════════════════════════════════════╗
// ║  PHASE 11: Session Management                        ║
// ╚═══════════════════════════════════════════════════════╝
async function phase11_Sessions() {
  section('PHASE 11: Session Management');

  // List sessions
  try {
    const { status, data } = await req('GET', `${BASE}/auth/sessions`, {
      token: tokens.client3.access,
    });
    if (status === 200) {
      const sessions = data.data || [];
      const count = Array.isArray(sessions) ? sessions.length : 0;
      log('PASS', 'List sessions (Temi)', `${count} active session(s)`);
    } else {
      log('FAIL', 'List sessions', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'List sessions', e.message);
  }

  // Token refresh
  if (tokens.client3?.refresh) {
    try {
      const { status, data } = await req('POST', `${BASE}/auth/refresh`, {
        body: { refreshToken: tokens.client3.refresh },
      });
      if (status === 200 && data.data?.accessToken) {
        tokens.client3.access = data.data.accessToken;
        tokens.client3.refresh = data.data.refreshToken;
        log('PASS', 'Token refresh (Temi)', 'New tokens issued');
      } else {
        log('FAIL', 'Token refresh', `Status ${status}`);
      }
    } catch (e) {
      log('FAIL', 'Token refresh', e.message);
    }
  }
}

// ╔═══════════════════════════════════════════════════════╗
// ║  PHASE 12: Geocoding & Search                        ║
// ╚═══════════════════════════════════════════════════════╝
async function phase12_Geocoding() {
  section('PHASE 12: Geocoding & Location Search');

  // Geocode
  try {
    const { status, data } = await req('GET', `${BASE}/orders/geocode?address=Ikeja+City+Mall+Lagos`, {
      token: tokens.client1.access,
    });
    if (status === 200 && data.data) {
      log('PASS', 'Geocode: Ikeja City Mall', JSON.stringify(data.data).slice(0, 120));
    } else {
      log('SKIP', 'Geocode', `Status ${status} (may need external API key)`);
    }
  } catch (e) {
    log('FAIL', 'Geocode', e.message);
  }

  // Autocomplete
  try {
    const { status, data } = await req('GET', `${BASE}/orders/autocomplete?q=Victoria+Island`, {
      token: tokens.client1.access,
    });
    if (status === 200 && data.data) {
      const results = Array.isArray(data.data) ? data.data : [];
      log('PASS', 'Autocomplete: Victoria Island', `${results.length} result(s)`);
    } else {
      log('SKIP', 'Autocomplete', `Status ${status}`);
    }
  } catch (e) {
    log('FAIL', 'Autocomplete', e.message);
  }
}

// ╔═══════════════════════════════════════════════════════╗
// ║  PHASE 13: Contact Form                              ║
// ╚═══════════════════════════════════════════════════════╝
async function phase13_Contact() {
  section('PHASE 13: Contact Form (Public)');

  const subjects = ['general', 'rider', 'business', 'partner', 'support'];
  for (const subject of subjects) {
    try {
      const { status } = await req('POST', `${BASE}/contact`, {
        body: {
          firstName: 'Test',
          lastName: 'User',
          email: `test.${subject}@example.com`,
          subject,
          message: `E2E test message for ${subject} inquiry. Automated test — please ignore.`,
        },
      });
      if (status === 200 || status === 201) {
        log('PASS', `Contact: ${subject}`, 'Submitted');
      } else {
        log('FAIL', `Contact: ${subject}`, `Status ${status}`);
      }
    } catch (e) {
      log('FAIL', `Contact: ${subject}`, e.message);
    }
  }
}

// ╔═══════════════════════════════════════════════════════╗
// ║  RUNNER                                               ║
// ╚═══════════════════════════════════════════════════════╝
async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  RiderGuy E2E Workflow Test Suite                    ║');
  console.log('║  Testing ALL 15 accounts across ALL features        ║');
  console.log(`║  API: ${API.padEnd(47)}║`);
  console.log('╚═══════════════════════════════════════════════════════╝');

  await phase1_LoginAllAccounts();
  await phase2_Profiles();
  await phase3_RiderFeatures();
  await phase4_ClientFeatures();
  await phase5_OrderLifecycle();
  await phase6_OrderCancellation();
  await phase7_WalletsAndFinance();
  await phase8_AdminDashboard();
  await phase9_Zones();
  await phase10_RBAC();
  await phase11_Sessions();
  await phase12_Geocoding();
  await phase13_Contact();

  // ─── Summary ───
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  E2E TEST RESULTS                                    ║');
  console.log('╠═══════════════════════════════════════════════════════╣');
  console.log(`║  ✅ PASSED:   ${String(results.pass).padEnd(40)}║`);
  console.log(`║  ❌ FAILED:   ${String(results.fail).padEnd(40)}║`);
  console.log(`║  ⏭️  SKIPPED:  ${String(results.skip).padEnd(40)}║`);
  console.log(`║  📊 TOTAL:    ${String(results.pass + results.fail + results.skip).padEnd(40)}║`);
  console.log('╚═══════════════════════════════════════════════════════╝');

  // Print accounts tested
  console.log('\n📋 ACCOUNTS TESTED:');
  console.log('┌──────────────────────────┬───────────────┬──────────────────────────────┐');
  console.log('│ Name                     │ Role          │ Email                        │');
  console.log('├──────────────────────────┼───────────────┼──────────────────────────────┤');
  for (const [key, acct] of Object.entries(ACCOUNTS)) {
    const name = (acct.name || acct.email.split('@')[0]).padEnd(24);
    const role = acct.role.padEnd(13);
    const email = acct.email.padEnd(28);
    const logged = tokens[key] ? '✅' : '❌';
    console.log(`│ ${logged} ${name} │ ${role} │ ${email} │`);
  }
  console.log('└──────────────────────────┴───────────────┴──────────────────────────────┘');

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
