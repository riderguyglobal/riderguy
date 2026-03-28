#!/usr/bin/env node
/**
 * Generate PWA icons, favicon, and apple-touch-icon for all apps
 * using the single official logo (Official Logo 1.png — square, green bg).
 *
 * Usage: node scripts/generate-icons.js
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Icon sizes needed for PWA + notifications
const SIZES = [32, 180, 192, 512];

async function generateIcons(appDir, logoBuffer, appName) {
  const iconsDir = path.join(appDir, 'public', 'icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  for (const size of SIZES) {
    const output = await sharp(logoBuffer)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toBuffer();

    if (size === 32) {
      const faviconPath = path.join(appDir, 'public', 'favicon.ico');
      fs.writeFileSync(faviconPath, output);
      console.log(`[${appName}] Created favicon.ico (${size}x${size})`);
    }

    if (size === 180) {
      const applePath = path.join(appDir, 'public', 'apple-touch-icon.png');
      fs.writeFileSync(applePath, output);
      console.log(`[${appName}] Created apple-touch-icon.png (${size}x${size})`);
    }

    const iconPath = path.join(iconsDir, `icon-${size}.png`);
    fs.writeFileSync(iconPath, output);
    console.log(`[${appName}] Created icons/icon-${size}.png`);
  }
}

async function main() {
  const root = path.resolve(__dirname, '..');

  // Single official logo for all apps
  const logoPath = path.join(root, 'Official Logo 1.png');

  if (!fs.existsSync(logoPath)) {
    console.error('Official Logo 1.png not found at project root:', logoPath);
    process.exit(1);
  }

  const logoBuffer = fs.readFileSync(logoPath);
  const logoMeta = await sharp(logoBuffer).metadata();
  console.log(`Source: Official Logo 1.png (${logoMeta.width}x${logoMeta.height})\n`);

  const clientDir = path.join(root, 'apps', 'client');
  const riderDir = path.join(root, 'apps', 'rider');
  const adminDir = path.join(root, 'apps', 'admin');

  await generateIcons(clientDir, logoBuffer, 'client');
  await generateIcons(riderDir, logoBuffer, 'rider');
  await generateIcons(adminDir, logoBuffer, 'admin');

  console.log('\n✅ All icons generated successfully!');
}

main().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
