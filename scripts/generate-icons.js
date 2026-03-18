#!/usr/bin/env node
/**
 * Generate PWA icons and favicon for rider and client apps
 * Creates a rounded-rect white icon with the riderguy logo centered.
 *
 * Usage: node scripts/generate-icons.js
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Icon sizes needed
const SIZES = [32, 192, 512];

/**
 * Build an SVG rounded-rect mask for the given size.
 * cornerRadius is ~22% of size (matching iOS app icon radius).
 */
function roundedRectSvg(size) {
  const r = Math.round(size * 0.22);
  return Buffer.from(
    `<svg width="${size}" height="${size}"><rect x="0" y="0" width="${size}" height="${size}" rx="${r}" ry="${r}" fill="white"/></svg>`
  );
}

async function generateIcons(appDir, logoPath, appName) {
  const iconsDir = path.join(appDir, 'public', 'icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  const logoBuffer = fs.readFileSync(logoPath);
  const logoMeta = await sharp(logoBuffer).metadata();
  console.log(`[${appName}] Source logo: ${logoMeta.width}x${logoMeta.height}`);

  for (const size of SIZES) {
    // Logo takes up ~92% of the icon width, centered on white
    const logoWidth = Math.round(size * 0.92);

    const resizedLogo = await sharp(logoBuffer)
      .resize(logoWidth, null, { fit: 'inside', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .toBuffer();

    // White square with logo centered
    const composited = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 255 },
      },
    })
      .composite([{ input: resizedLogo, gravity: 'centre' }])
      .png()
      .toBuffer();

    // Apply rounded-rect mask (clip corners)
    const mask = roundedRectSvg(size);
    const output = await sharp(composited)
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer();

    if (size === 32) {
      const faviconPath = path.join(appDir, 'public', 'favicon.ico');
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
  const brandingDir = path.resolve(root, '..', 'branding');

  // Source: the "black on white" logo (black text, green accent, white bg)
  const sourceLogo = path.join(brandingDir, 'Logo Riderguy black on white.png');

  if (!fs.existsSync(sourceLogo)) {
    console.error('Source logo not found:', sourceLogo);
    process.exit(1);
  }

  const clientDir = path.join(root, 'apps', 'client');
  const riderDir = path.join(root, 'apps', 'rider');

  await generateIcons(clientDir, sourceLogo, 'client');
  await generateIcons(riderDir, sourceLogo, 'rider');

  console.log('\n✅ All icons generated successfully!');
}

main().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
