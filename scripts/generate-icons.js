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

// SVG arrow overlay for rider app (forward-pointing arrow under the logo text)
// Designed for 1563x1563 source, scales proportionally when resized
const RIDER_ARROW_SVG = `<svg width="1563" height="1563" xmlns="http://www.w3.org/2000/svg">
  <line x1="430" y1="1100" x2="1090" y2="1100"
    stroke="black" stroke-width="34" stroke-linecap="round"/>
  <path d="M1050,1055 L1140,1100 L1050,1145"
    fill="none" stroke="black" stroke-width="34"
    stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

async function createRiderLogo(logoBuffer) {
  const arrowBuffer = Buffer.from(RIDER_ARROW_SVG);
  return sharp(logoBuffer)
    .composite([{ input: arrowBuffer, top: 0, left: 0 }])
    .png()
    .toBuffer();
}

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

  // Rider gets a modified logo with a forward arrow under the text
  const riderLogoBuffer = await createRiderLogo(logoBuffer);
  console.log('Created rider logo variant with forward arrow\n');

  await generateIcons(clientDir, logoBuffer, 'client');
  await generateIcons(riderDir, riderLogoBuffer, 'rider');
  await generateIcons(adminDir, logoBuffer, 'admin');

  console.log('\n✅ All icons generated successfully!');
}

main().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
