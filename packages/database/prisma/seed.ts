// ============================================================
// RiderGuy — Database Seed Script
//
// Creates realistic sample data for all models:
//   - Admin & Super Admin users
//   - Riders at various onboarding stages
//   - Clients with saved addresses
//   - Zones with polygon coordinates (Accra)
//   - Orders in various statuses
//   - Vehicles
//   - Wallets with transactions
//   - Notifications
//   - Audit log entries
//
// Run: npm run seed (from packages/database)
// ============================================================

import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

// ---- Password hash for seed users (valid bcrypt hash of "Password123!") ----
const SEED_PASSWORD_HASH =
  '$2a$10$YYb3zNUM9f3.BPL.LiH0h./m2UHbxgK2yZxJxGyMRWIln6tZedC5m';

// Generates a 25-char random ID for seed data (not a real CUID, seed-only shortcut)
function cuid(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 25);
}

function orderNumber(): string {
  const year = new Date().getFullYear();
  const random = crypto.randomBytes(4).toString('hex').substring(0, 6).toUpperCase();
  return `RG-${year}-${random}`;
}

// ---- Accra zone polygons (simplified) ----
const ACCRA_ZONES = [
  {
    name: 'East Legon',
    description: 'East Legon and surrounding areas',
    centerLatitude: 5.6350,
    centerLongitude: -0.1572,
    polygon: [[[-0.18, 5.62], [-0.13, 5.62], [-0.13, 5.66], [-0.18, 5.66], [-0.18, 5.62]]],
    baseFare: 10,
    perKmRate: 3,
    minimumFare: 15,
    commissionRate: 20,
  },
  {
    name: 'Osu',
    description: 'Osu, Oxford Street, Cantonments',
    centerLatitude: 5.5560,
    centerLongitude: -0.1870,
    polygon: [[[-0.20, 5.54], [-0.17, 5.54], [-0.17, 5.58], [-0.20, 5.58], [-0.20, 5.54]]],
    baseFare: 12,
    perKmRate: 3.5,
    minimumFare: 18,
    commissionRate: 20,
  },
  {
    name: 'Dansoman',
    description: 'Dansoman, Mamprobi, Korle Bu',
    centerLatitude: 5.5390,
    centerLongitude: -0.2580,
    polygon: [[[-0.28, 5.52], [-0.24, 5.52], [-0.24, 5.56], [-0.28, 5.56], [-0.28, 5.52]]],
    baseFare: 8,
    perKmRate: 2.5,
    minimumFare: 12,
    commissionRate: 20,
  },
  {
    name: 'Tema',
    description: 'Tema, Community 1-25, Tema New Town',
    centerLatitude: 5.6698,
    centerLongitude: -0.0166,
    polygon: [[[-0.04, 5.65], [0.01, 5.65], [0.01, 5.69], [-0.04, 5.69], [-0.04, 5.65]]],
    baseFare: 10,
    perKmRate: 3,
    minimumFare: 15,
    commissionRate: 20,
  },
  {
    name: 'Achimota',
    description: 'Achimota, Dome, Madina',
    centerLatitude: 5.6150,
    centerLongitude: -0.2310,
    polygon: [[[-0.25, 5.60], [-0.21, 5.60], [-0.21, 5.64], [-0.25, 5.64], [-0.25, 5.60]]],
    baseFare: 8,
    perKmRate: 2.5,
    minimumFare: 12,
    commissionRate: 20,
  },
];

const ACCRA_ADDRESSES = [
  { address: '12 Nii Nortei Nyanchi St, East Legon, Accra', lat: 5.6350, lng: -0.1572 },
  { address: '5 Oxford Street, Osu, Accra', lat: 5.5560, lng: -0.1870 },
  { address: '7 Farrar Avenue, Adabraka, Accra', lat: 5.5580, lng: -0.2120 },
  { address: '23 Liberation Road, Airport Residential, Accra', lat: 5.6050, lng: -0.1700 },
  { address: '14 Cantonments Road, Cantonments, Accra', lat: 5.5720, lng: -0.1770 },
  { address: '9 Labone Crescent, Labone, Accra', lat: 5.5630, lng: -0.1830 },
  { address: '3 High Street, James Town, Accra', lat: 5.5440, lng: -0.2070 },
  { address: '18 Spintex Road, Spintex, Accra', lat: 5.6340, lng: -0.1120 },
  { address: '8 Baatsonaa Road, East Legon, Accra', lat: 5.6398, lng: -0.1430 },
  { address: '22 Boundary Road, East Legon, Accra', lat: 5.6280, lng: -0.1650 },
  { address: '6 Community 25, Tema, Greater Accra', lat: 5.6698, lng: -0.0166 },
  { address: '11 Ring Road Central, Asylum Down, Accra', lat: 5.5670, lng: -0.2130 },
];

async function main() {
  console.log('🌱 Seeding database...\n');

  // ── Clean existing data (order matters for FK constraints) ──
  console.log('  Cleaning existing data...');
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.pushToken.deleteMany();
  await prisma.orderMessage.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.withdrawal.deleteMany();
  await prisma.order.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.favoriteRider.deleteMany();
  await prisma.savedAddress.deleteMany();
  await prisma.document.deleteMany();
  // Gamification tables
  await prisma.rewardRedemption.deleteMany();
  await prisma.challengeParticipant.deleteMany();
  await prisma.challenge.deleteMany();
  await prisma.rewardStoreItem.deleteMany();
  await prisma.bonusXpEvent.deleteMany();
  await prisma.riderBadge.deleteMany();
  await prisma.badge.deleteMany();
  await prisma.xpEvent.deleteMany();
  await prisma.riderStreak.deleteMany();
  // Partner & profiles
  await prisma.partnerRecruitment.deleteMany();
  await prisma.partnerProfile.deleteMany();
  await prisma.riderProfile.deleteMany();
  await prisma.clientProfile.deleteMany();
  await prisma.businessAccount.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.session.deleteMany();
  await prisma.otp.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.user.deleteMany();

  // ══════════════════════════════════════════════════════════════
  // 1. ZONES
  // ══════════════════════════════════════════════════════════════
  console.log('  Creating zones...');
  const zones = await Promise.all(
    ACCRA_ZONES.map((z) =>
      prisma.zone.create({
        data: {
          name: z.name,
          description: z.description,
          status: 'ACTIVE',
          polygon: z.polygon,
          centerLatitude: z.centerLatitude,
          centerLongitude: z.centerLongitude,
          baseFare: z.baseFare,
          perKmRate: z.perKmRate,
          minimumFare: z.minimumFare,
          surgeMultiplier: 1.0,
          commissionRate: z.commissionRate,
          currency: 'GHS',
        },
      }),
    ),
  );
  console.log(`  ✓ ${zones.length} zones created`);

  // ══════════════════════════════════════════════════════════════
  // 2. ADMIN USERS
  // ══════════════════════════════════════════════════════════════
  console.log('  Creating admin users...');
  const superAdmin = await prisma.user.create({
    data: {
      phone: '+233200000001',
      email: 'superadmin@riderguy.com',
      phoneVerified: true,
      emailVerified: true,
      passwordHash: SEED_PASSWORD_HASH,
      firstName: 'System',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });

  const admin = await prisma.user.create({
    data: {
      phone: '+233200000002',
      email: 'admin@riderguy.com',
      phoneVerified: true,
      emailVerified: true,
      passwordHash: SEED_PASSWORD_HASH,
      firstName: 'Kwame',
      lastName: 'Mensah',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log('  ✓ 2 admin users created');

  // ══════════════════════════════════════════════════════════════
  // 3. RIDERS (various onboarding stages)
  // ══════════════════════════════════════════════════════════════
  console.log('  Creating riders...');

  const riderData = [
    { phone: '+233240000001', first: 'Kofi', last: 'Asante', email: 'kofi@email.com', status: 'ACTIVATED' as const, availability: 'ONLINE' as const, zone: 0, deliveries: 147, rating: 4.8, xp: 2400 },
    { phone: '+233240000002', first: 'Kwesi', last: 'Boateng', email: 'kwesi@email.com', status: 'ACTIVATED' as const, availability: 'ONLINE' as const, zone: 1, deliveries: 89, rating: 4.6, xp: 1500 },
    { phone: '+233240000003', first: 'Yaw', last: 'Darko', email: 'yaw@email.com', status: 'ACTIVATED' as const, availability: 'OFFLINE' as const, zone: 2, deliveries: 234, rating: 4.9, xp: 3800 },
    { phone: '+233240000004', first: 'Ibrahim', last: 'Issahaku', email: 'ibrahim@email.com', status: 'ACTIVATED' as const, availability: 'ON_DELIVERY' as const, zone: 0, deliveries: 56, rating: 4.5, xp: 900 },
    { phone: '+233240000005', first: 'Kwabena', last: 'Adu', email: 'kwabena@email.com', status: 'DOCUMENTS_SUBMITTED' as const, availability: 'OFFLINE' as const, zone: null, deliveries: 0, rating: 0, xp: 0 },
    { phone: '+233240000006', first: 'Prince', last: 'Ofori', email: 'prince@email.com', status: 'DOCUMENTS_UNDER_REVIEW' as const, availability: 'OFFLINE' as const, zone: null, deliveries: 0, rating: 0, xp: 0 },
    { phone: '+233240000007', first: 'Abdul', last: 'Rahman', email: 'abdul@email.com', status: 'DOCUMENTS_REJECTED' as const, availability: 'OFFLINE' as const, zone: null, deliveries: 0, rating: 0, xp: 0 },
    { phone: '+233240000008', first: 'Nana', last: 'Osei', email: 'nana@email.com', status: 'REGISTERED' as const, availability: 'OFFLINE' as const, zone: null, deliveries: 0, rating: 0, xp: 0 },
  ];

  const riders: Array<{ userId: string; profileId: string; zoneIdx: number | null }> = [];

  for (const r of riderData) {
    const user = await prisma.user.create({
      data: {
        phone: r.phone,
        email: r.email,
        phoneVerified: true,
        emailVerified: true,
        passwordHash: SEED_PASSWORD_HASH,
        firstName: r.first,
        lastName: r.last,
        role: 'RIDER',
        status: r.status === 'ACTIVATED' ? 'ACTIVE' : 'PENDING_VERIFICATION',
      },
    });

    const profile = await prisma.riderProfile.create({
      data: {
        userId: user.id,
        onboardingStatus: r.status,
        availability: r.availability,
        currentLevel: Math.min(7, Math.floor(r.xp / 500) + 1),
        totalXp: r.xp,
        totalDeliveries: r.deliveries,
        averageRating: r.rating,
        totalRatings: r.deliveries > 0 ? Math.floor(r.deliveries * 0.7) : 0,
        completionRate: r.deliveries > 0 ? 0.95 : 0,
        onTimeRate: r.deliveries > 0 ? 0.88 : 0,
        currentZoneId: r.zone !== null ? zones[r.zone].id : null,
        preferredVehicleType: 'MOTORCYCLE',
        isVerified: r.status === 'ACTIVATED',
        activatedAt: r.status === 'ACTIVATED' ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) : null,
        currentLatitude: r.zone !== null ? ACCRA_ZONES[r.zone].centerLatitude + (Math.random() - 0.5) * 0.02 : null,
        currentLongitude: r.zone !== null ? ACCRA_ZONES[r.zone].centerLongitude + (Math.random() - 0.5) * 0.02 : null,
        lastLocationUpdate: r.availability !== 'OFFLINE' ? new Date() : null,
      },
    });

    riders.push({ userId: user.id, profileId: profile.id, zoneIdx: r.zone });
  }
  console.log(`  ✓ ${riders.length} riders created`);

  // ── Vehicles for activated riders ──
  console.log('  Creating vehicles...');
  let vehicleCount = 0;
  for (let i = 0; i < 4; i++) {
    await prisma.vehicle.create({
      data: {
        riderId: riders[i].profileId,
        type: 'MOTORCYCLE',
        make: ['Honda', 'Suzuki', 'Bajaj', 'TVS'][i],
        model: ['CB125', 'GN125', 'Boxer', 'Apache'][i],
        year: 2020 + (i % 4),
        color: ['Red', 'Black', 'Blue', 'Silver'][i],
        plateNumber: `GR-${1000 + i}-${String.fromCharCode(65 + i)}${String.fromCharCode(65 + i + 1)}`,
        isPrimary: true,
        isApproved: true,
      },
    });
    vehicleCount++;
  }
  console.log(`  ✓ ${vehicleCount} vehicles created`);

  // ── Wallets for activated riders ──
  console.log('  Creating rider wallets...');
  for (let i = 0; i < 4; i++) {
    const earnings = riderData[i].deliveries * 850;
    const withdrawn = Math.floor(earnings * 0.6);
    const wallet = await prisma.wallet.create({
      data: {
        userId: riders[i].userId,
        balance: earnings - withdrawn,
        currency: 'GHS',
        totalEarned: earnings,
        totalWithdrawn: withdrawn,
        totalTips: Math.floor(riderData[i].deliveries * 100),
      },
    });

    // Sample transactions
    const txTypes = [
      { type: 'DELIVERY_EARNING' as const, amount: 1200, desc: 'Delivery earnings — Order #RG-ABC1' },
      { type: 'TIP' as const, amount: 300, desc: 'Tip from client' },
      { type: 'COMMISSION_DEDUCTION' as const, amount: -240, desc: 'Platform commission (20%)' },
      { type: 'WITHDRAWAL' as const, amount: -5000, desc: 'Bank withdrawal' },
      { type: 'BONUS' as const, amount: 500, desc: 'Completion bonus' },
    ];

    let runningBalance = wallet.balance;
    for (const tx of txTypes) {
      runningBalance += tx.amount;
      await prisma.transaction.create({
        data: {
          walletId: wallet.id,
          type: tx.type,
          amount: Math.abs(tx.amount),
          balanceAfter: Math.max(0, runningBalance),
          description: tx.desc,
          currency: 'GHS',
        },
      });
    }
  }
  console.log('  ✓ Rider wallets + transactions created');

  // ══════════════════════════════════════════════════════════════
  // 4. CLIENT USERS
  // ══════════════════════════════════════════════════════════════
  console.log('  Creating clients...');

  const clientData = [
    { phone: '+233250000001', first: 'Ama', last: 'Serwaa', email: 'ama@email.com', orders: 12, spent: 185 },
    { phone: '+233250000002', first: 'Akosua', last: 'Frimpong', email: 'akosua@email.com', orders: 5, spent: 78 },
    { phone: '+233250000003', first: 'Abena', last: 'Owusu', email: 'abena@email.com', orders: 28, spent: 420 },
    { phone: '+233250000004', first: 'Kweku', last: 'Annan', email: 'kweku@email.com', orders: 3, spent: 45 },
    { phone: '+233250000005', first: 'Efua', last: 'Mensah', email: 'efua@email.com', orders: 0, spent: 0 },
  ];

  const clients: Array<{ userId: string; profileId: string }> = [];

  for (const c of clientData) {
    const user = await prisma.user.create({
      data: {
        phone: c.phone,
        email: c.email,
        phoneVerified: true,
        emailVerified: true,
        passwordHash: SEED_PASSWORD_HASH,
        firstName: c.first,
        lastName: c.last,
        role: 'CLIENT',
        status: 'ACTIVE',
      },
    });

    const profile = await prisma.clientProfile.create({
      data: {
        userId: user.id,
        totalOrders: c.orders,
        totalSpent: c.spent,
        averageRating: c.orders > 0 ? 4.5 + Math.random() * 0.5 : 0,
      },
    });

    clients.push({ userId: user.id, profileId: profile.id });

    // Saved addresses for first 3 clients
    if (clients.length <= 3) {
      const addrIdx = (clients.length - 1) * 2;
      await prisma.savedAddress.createMany({
        data: [
          {
            clientId: profile.id,
            label: 'Home',
            address: ACCRA_ADDRESSES[addrIdx].address,
            latitude: ACCRA_ADDRESSES[addrIdx].lat,
            longitude: ACCRA_ADDRESSES[addrIdx].lng,
            isDefault: true,
          },
          {
            clientId: profile.id,
            label: 'Office',
            address: ACCRA_ADDRESSES[addrIdx + 1].address,
            latitude: ACCRA_ADDRESSES[addrIdx + 1].lat,
            longitude: ACCRA_ADDRESSES[addrIdx + 1].lng,
          },
        ],
      });
    }

    // Client wallets
    await prisma.wallet.create({
      data: {
        userId: user.id,
        balance: Math.floor(Math.random() * 5000),
        currency: 'GHS',
      },
    });
  }
  console.log(`  ✓ ${clients.length} clients created`);

  // ══════════════════════════════════════════════════════════════
  // 5. ORDERS (various statuses)
  // ══════════════════════════════════════════════════════════════
  console.log('  Creating orders...');

  const orderStatuses: Array<{
    status: string;
    clientIdx: number;
    riderIdx: number | null;
    zoneIdx: number;
  }> = [
    { status: 'DELIVERED', clientIdx: 0, riderIdx: 0, zoneIdx: 0 },
    { status: 'DELIVERED', clientIdx: 0, riderIdx: 1, zoneIdx: 1 },
    { status: 'DELIVERED', clientIdx: 2, riderIdx: 2, zoneIdx: 2 },
    { status: 'IN_TRANSIT', clientIdx: 2, riderIdx: 3, zoneIdx: 0 },
    { status: 'PICKUP_EN_ROUTE', clientIdx: 1, riderIdx: 0, zoneIdx: 0 },
    { status: 'ASSIGNED', clientIdx: 2, riderIdx: 1, zoneIdx: 1 },
    { status: 'PENDING', clientIdx: 3, riderIdx: null, zoneIdx: 3 },
    { status: 'SEARCHING_RIDER', clientIdx: 0, riderIdx: null, zoneIdx: 2 },
    { status: 'CANCELLED_BY_CLIENT', clientIdx: 1, riderIdx: null, zoneIdx: 1 },
    { status: 'FAILED', clientIdx: 2, riderIdx: 2, zoneIdx: 2 },
  ];

  const packageTypes = ['DOCUMENT', 'SMALL_PARCEL', 'MEDIUM_PARCEL', 'FOOD', 'FRAGILE', 'LARGE_PARCEL'] as const;

  let orderCount = 0;
  for (const o of orderStatuses) {
    const pickupAddr = ACCRA_ADDRESSES[orderCount % ACCRA_ADDRESSES.length];
    const dropoffAddr = ACCRA_ADDRESSES[(orderCount + 3) % ACCRA_ADDRESSES.length];
    const distance = 2 + Math.random() * 15;
    const zone = ACCRA_ZONES[o.zoneIdx];
    const baseFare = zone.baseFare;
    const distanceCharge = distance * zone.perKmRate;
    const totalPrice = Math.max(zone.minimumFare, baseFare + distanceCharge);
    const serviceFee = totalPrice * (zone.commissionRate / 100);
    const riderEarnings = totalPrice - serviceFee;

    const order = await prisma.order.create({
      data: {
        orderNumber: orderNumber(),
        clientId: clients[o.clientIdx].userId,
        riderId: o.riderIdx !== null ? riders[o.riderIdx].profileId : null,
        zoneId: zones[o.zoneIdx].id,
        pickupAddress: pickupAddr.address,
        pickupLatitude: pickupAddr.lat,
        pickupLongitude: pickupAddr.lng,
        pickupContactName: clientData[o.clientIdx].first,
        pickupContactPhone: clientData[o.clientIdx].phone,
        dropoffAddress: dropoffAddr.address,
        dropoffLatitude: dropoffAddr.lat,
        dropoffLongitude: dropoffAddr.lng,
        dropoffContactName: 'Recipient',
        dropoffContactPhone: '+233200000000',
        packageType: packageTypes[orderCount % packageTypes.length],
        packageDescription: `Sample package ${orderCount + 1}`,
        distanceKm: Math.round(distance * 10) / 10,
        estimatedDurationMinutes: Math.round(distance * 3 + 10),
        baseFare,
        distanceCharge: Math.round(distanceCharge),
        surgeMultiplier: 1.0,
        serviceFee: Math.round(serviceFee),
        totalPrice: Math.round(totalPrice),
        currency: 'GHS',
        paymentMethod: ['CARD', 'WALLET', 'CASH'][orderCount % 3] as 'CARD' | 'WALLET' | 'CASH',
        paymentStatus: o.status === 'DELIVERED' ? 'COMPLETED' : o.status === 'CANCELLED_BY_CLIENT' ? 'REFUNDED' : 'PENDING',
        status: o.status as any,
        riderEarnings: o.riderIdx !== null ? Math.round(riderEarnings) : null,
        platformCommission: o.riderIdx !== null ? Math.round(serviceFee) : null,
        tipAmount: o.status === 'DELIVERED' ? Math.floor(Math.random() * 500) : 0,
        deliveredAt: o.status === 'DELIVERED' ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) : null,
        assignedAt: o.riderIdx !== null ? new Date(Date.now() - Math.random() * 8 * 24 * 60 * 60 * 1000) : null,
        cancelledAt: o.status.startsWith('CANCELLED') ? new Date() : null,
        failureReason: o.status === 'FAILED' ? 'Recipient not available at delivery address' : null,
        createdAt: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000),
      },
    });

    // Status history
    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: 'PENDING',
        actor: 'system',
        note: 'Order created',
      },
    });

    if (['ASSIGNED', 'PICKUP_EN_ROUTE', 'IN_TRANSIT', 'DELIVERED'].includes(o.status)) {
      await prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: 'ASSIGNED',
          actor: 'system',
          note: 'Rider assigned',
        },
      });
    }

    if (o.status === 'DELIVERED') {
      await prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: 'DELIVERED',
          actor: o.riderIdx !== null ? riders[o.riderIdx].userId : 'system',
          note: 'Package delivered successfully',
        },
      });
    }

    orderCount++;
  }
  console.log(`  ✓ ${orderCount} orders created`);

  // ══════════════════════════════════════════════════════════════
  // 6. DOCUMENTS (for riders)
  // ══════════════════════════════════════════════════════════════
  console.log('  Creating documents...');
  let docCount = 0;
  const docTypes = ['NATIONAL_ID', 'DRIVERS_LICENSE', 'VEHICLE_REGISTRATION', 'SELFIE'] as const;
  const docStatuses: Record<string, string> = {
    ACTIVATED: 'APPROVED',
    DOCUMENTS_SUBMITTED: 'PENDING',
    DOCUMENTS_UNDER_REVIEW: 'UNDER_REVIEW',
    DOCUMENTS_REJECTED: 'REJECTED',
  };

  for (let i = 0; i < riderData.length; i++) {
    const rd = riderData[i];
    if (rd.status === 'REGISTERED') continue;

    for (const docType of docTypes) {
      const docStatus = docStatuses[rd.status] ?? 'PENDING';
      await prisma.document.create({
        data: {
          userId: riders[i].userId,
          type: docType,
          fileUrl: `/uploads/documents/seed-${docType.toLowerCase()}-${i}.jpg`,
          fileName: `${docType.toLowerCase()}_${rd.first.toLowerCase()}.jpg`,
          fileSizeBytes: 500000 + Math.floor(Math.random() * 500000),
          mimeType: 'image/jpeg',
          status: docStatus as any,
          rejectionReason: docStatus === 'REJECTED' ? 'Document is blurry, please re-upload a clearer image' : null,
          reviewedBy: docStatus === 'APPROVED' || docStatus === 'REJECTED' ? admin.id : null,
          reviewedAt: docStatus === 'APPROVED' || docStatus === 'REJECTED' ? new Date() : null,
        },
      });
      docCount++;
    }
  }
  console.log(`  ✓ ${docCount} documents created`);

  // ══════════════════════════════════════════════════════════════
  // 7. NOTIFICATIONS
  // ══════════════════════════════════════════════════════════════
  console.log('  Creating notifications...');
  const notificationTemplates = [
    { title: 'Welcome to RiderGuy!', body: 'Your account has been created. Complete your profile to get started.', type: 'system' },
    { title: 'New Delivery Available', body: 'A new delivery request is waiting near you. Open the job feed to accept.', type: 'order' },
    { title: 'Document Approved', body: 'Your national ID has been verified successfully.', type: 'document_review' },
    { title: 'Delivery Complete', body: 'Your package has been delivered. Rate your experience!', type: 'order' },
    { title: 'Payout Processed', body: 'Your withdrawal of GH₵50 has been sent to your bank account.', type: 'payment' },
  ];

  let notifCount = 0;
  // Notifications for riders
  for (let i = 0; i < 4; i++) {
    for (const tmpl of notificationTemplates) {
      await prisma.notification.create({
        data: {
          userId: riders[i].userId,
          title: tmpl.title,
          body: tmpl.body,
          type: tmpl.type,
          isRead: Math.random() > 0.5,
          readAt: Math.random() > 0.5 ? new Date() : null,
          createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        },
      });
      notifCount++;
    }
  }
  // Notifications for clients
  for (let i = 0; i < 3; i++) {
    await prisma.notification.create({
      data: {
        userId: clients[i].userId,
        title: 'Order Delivered',
        body: 'Your delivery has been completed. Thank you for using RiderGuy!',
        type: 'order',
        isRead: false,
        createdAt: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000),
      },
    });
    notifCount++;
  }
  // Admin notifications
  await prisma.notification.create({
    data: {
      userId: superAdmin.id,
      title: 'New Rider Application',
      body: 'Kwabena Adu has submitted documents for review.',
      type: 'rider_application',
      isRead: false,
    },
  });
  notifCount++;
  console.log(`  ✓ ${notifCount} notifications created`);

  // ══════════════════════════════════════════════════════════════
  // 8. AUDIT LOG ENTRIES
  // ══════════════════════════════════════════════════════════════
  console.log('  Creating audit logs...');
  const auditEntries = [
    { userId: superAdmin.id, action: 'user.create', entityType: 'User', entityId: admin.id },
    { userId: admin.id, action: 'rider.approve', entityType: 'RiderProfile', entityId: riders[0].profileId },
    { userId: admin.id, action: 'rider.approve', entityType: 'RiderProfile', entityId: riders[1].profileId },
    { userId: admin.id, action: 'rider.approve', entityType: 'RiderProfile', entityId: riders[2].profileId },
    { userId: admin.id, action: 'document.approve', entityType: 'Document', entityId: cuid() },
    { userId: admin.id, action: 'rider.reject', entityType: 'RiderProfile', entityId: riders[6].profileId },
    { userId: null, action: 'order.create', entityType: 'Order', entityId: cuid() },
    { userId: null, action: 'payment.webhook', entityType: 'Payment', entityId: cuid() },
  ];

  for (const entry of auditEntries) {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        createdAt: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000),
      },
    });
  }
  console.log(`  ✓ ${auditEntries.length} audit log entries created`);

  // ══════════════════════════════════════════════════════════════
  // Summary
  // ══════════════════════════════════════════════════════════════
  console.log('\n✅ Seed complete!\n');
  console.log('  Accounts:');
  console.log('  ─────────────────────────────────────────');
  console.log('  Super Admin: +233200000001 (superadmin@riderguy.com)');
  console.log('  Admin:       +233200000002 (admin@riderguy.com)');
  console.log('  Rider 1:     +233240000001 (kofi@email.com) — ACTIVATED, ONLINE');
  console.log('  Rider 2:     +233240000002 (kwesi@email.com)   — ACTIVATED, ONLINE');
  console.log('  Rider 3:     +233240000003 (yaw@email.com)   — ACTIVATED, OFFLINE');
  console.log('  Client 1:    +233250000001 (ama@email.com)');
  console.log('  Client 2:    +233250000002 (akosua@email.com)');
  console.log('  Client 3:    +233250000003 (abena@email.com)');
  console.log('  ─────────────────────────────────────────');
  console.log('  Password for all accounts: Password123!');
  console.log('');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error('❌ Seed failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
