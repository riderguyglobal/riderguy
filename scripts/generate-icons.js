#!/usr/bin/env node
/**
 * Generate PWA icons and favicon for rider and client apps
 * Uses the existing branding logos as source.
 *
 * Usage: node scripts/generate-icons.js
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const BRAND_COLOR = '#0ea5e9'; // sky-500

// Icon sizes needed
const SIZES = [32, 192, 512];

async function generateIcons(appDir, logoPath, appName) {
  const iconsDir = path.join(appDir, 'public', 'icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  const logoBuffer = fs.readFileSync(logoPath);
  const logoMeta = await sharp(logoBuffer).metadata();
  console.log(`[${appName}] Source logo: ${logoMeta.width}x${logoMeta.height}`);

  for (const size of SIZES) {
    // For smaller sizes, use more padding
    const padding = size <= 32 ? Math.round(size * 0.1) : Math.round(size * 0.15);
    const logoSize = size - padding * 2;

    const icon = await sharp(logoBuffer)
      .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    // Create icon with brand-colored background and centered logo
    const output = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: BRAND_COLOR,
      },
    })
      .composite([
        {
          input: icon,
          gravity: 'centre',
        },
      ])
      .png()
      .toBuffer();

    if (size === 32) {
      // Save as favicon
      const faviconPath = path.join(appDir, 'public', 'favicon.ico');
      // Just save as PNG — browsers handle PNG favicons fine
      fs.writeFileSync(faviconPath, output);
      console.log(`[${appName}] Created favicon.ico (${size}x${size})`);
    }

    const iconPath = path.join(iconsDir, `icon-${size}.png`);
    fs.writeFileSync(iconPath, output);
    console.log(`[${appName}] Created icons/icon-${size}.png`);
  }
}

async function main() {
  const root = path.resolve(__dirname, '..');

  // Rider app — use logo-white.png (white logo on brand background)
  const riderDir = path.join(root, 'apps', 'rider');
  const riderLogo = path.join(riderDir, 'public', 'images', 'branding', 'logo-white.png');

  // Client app — use logo-white.png
  const clientDir = path.join(root, 'apps', 'client');
  const clientLogo = path.join(clientDir, 'public', 'images', 'branding', 'logo-white.png');

  await generateIcons(riderDir, riderLogo, 'rider');
  await generateIcons(clientDir, clientLogo, 'client');

  console.log('\n✅ All icons generated successfully!');
}

main().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
