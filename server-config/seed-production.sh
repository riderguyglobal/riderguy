#!/bin/bash
# Seed admin + test accounts on production server
# Run as deploy user with .env sourced
set -e
cd /var/www/riderguy/source

node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Test1234', 12);

  // ADMIN account
  const existing = await prisma.user.findFirst({ where: { email: 'admin@myriderguy.com' } });
  if (existing) {
    console.log('Admin already exists: ' + existing.id);
  } else {
    const admin = await prisma.user.create({
      data: {
        phone: '+233200000000',
        email: 'admin@myriderguy.com',
        firstName: 'RiderGuy',
        lastName: 'Admin',
        passwordHash,
        role: 'SUPER_ADMIN',
        phoneVerified: true,
        emailVerified: true,
        status: 'ACTIVE',
      },
    });
    console.log('Admin created: ' + admin.id);
  }

  // RIDER test account
  const existingRider = await prisma.user.findFirst({ where: { email: 'rider@test.com' } });
  if (existingRider) {
    console.log('Rider already exists: ' + existingRider.id);
  } else {
    const rider = await prisma.user.create({
      data: {
        phone: '+233200000001',
        email: 'rider@test.com',
        firstName: 'Test',
        lastName: 'Rider',
        passwordHash,
        role: 'RIDER',
        phoneVerified: true,
        emailVerified: true,
        status: 'ACTIVE',
      },
    });
    await prisma.riderProfile.create({ data: { userId: rider.id, onboardingStatus: 'ACTIVATED' } });
    await prisma.wallet.create({ data: { userId: rider.id } });
    console.log('Rider created: ' + rider.id);
  }

  // CLIENT test account
  const existingClient = await prisma.user.findFirst({ where: { email: 'client@test.com' } });
  if (existingClient) {
    console.log('Client already exists: ' + existingClient.id);
  } else {
    const client = await prisma.user.create({
      data: {
        phone: '+233200000002',
        email: 'client@test.com',
        firstName: 'Test',
        lastName: 'Client',
        passwordHash,
        role: 'CLIENT',
        phoneVerified: true,
        emailVerified: true,
        status: 'ACTIVE',
      },
    });
    await prisma.clientProfile.create({ data: { userId: client.id } });
    await prisma.wallet.create({ data: { userId: client.id } });
    console.log('Client created: ' + client.id);
  }

  console.log('');
  console.log('=== ACCOUNTS ===');
  console.log('ADMIN:  admin@myriderguy.com / Test1234  (admin.myriderguy.com)');
  console.log('RIDER:  rider@test.com / Test1234  (rider.myriderguy.com)');
  console.log('CLIENT: client@test.com / Test1234  (app.myriderguy.com)');
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.\$disconnect());
"
