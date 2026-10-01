import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const svg440x280 = `
<svg width="440" height="280" viewBox="0 0 440 280" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Gradients -->
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#09090b" />
      <stop offset="50%" stop-color="#0d0e15" />
      <stop offset="100%" stop-color="#09090b" />
    </linearGradient>

    <!-- Center Glow -->
    <radialGradient id="center-glow" cx="50%" cy="38%" r="45%">
      <stop offset="0%" stop-color="#4f46e5" stop-opacity="0.32" />
      <stop offset="50%" stop-color="#38bdf8" stop-opacity="0.12" />
      <stop offset="100%" stop-color="#09090b" stop-opacity="0" />
    </radialGradient>

    <!-- Logo Gradients -->
    <linearGradient id="bg-logo" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#18181b" />
      <stop offset="100%" stop-color="#09090b" />
    </linearGradient>
    <linearGradient id="left-ribbon" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#818cf8" />
      <stop offset="100%" stop-color="#4f46e5" />
    </linearGradient>
    <linearGradient id="right-ribbon" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>
    <linearGradient id="diag-ribbon" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5" />
      <stop offset="100%" stop-color="#38bdf8" />
    </linearGradient>
    <linearGradient id="text-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#e2e8f0" />
    </linearGradient>
  </defs>

  <!-- Background Base -->
  <rect width="440" height="280" fill="url(#bg)" />

  <!-- Subtle Radial Glow Behind Logo -->
  <rect width="440" height="280" fill="url(#center-glow)" />

  <!-- Outer Border -->
  <rect width="438" height="278" x="1" y="1" fill="none" stroke="#27272a" stroke-width="1.5" />

  <!-- Logo Container Box (Centered, y = 38) -->
  <g transform="translate(186, 36)">
    <!-- Logo Shadow & Glow -->
    <rect width="68" height="68" rx="18" fill="#4f46e5" opacity="0.3" transform="translate(0, 4)" filter="blur(6px)" />
    <!-- Logo Base -->
    <rect width="68" height="68" rx="18" fill="url(#bg-logo)" stroke="#3f3f46" stroke-width="1.2" />
    <!-- Embedded Logo Ribbons scaled to 68x68 (original 128x128 -> scale ~0.531) -->
    <g transform="translate(0, 0) scale(0.531)">
      <polygon points="50,24 78,64 78,84 50,44" fill="url(#diag-ribbon)" />
      <path d="M 28 24 L 50 24 L 50 104 L 39 93 L 28 104 Z" fill="url(#left-ribbon)" />
      <path d="M 78 24 L 89 35 L 100 24 L 100 104 L 78 104 Z" fill="url(#right-ribbon)" />
    </g>
  </g>

  <!-- Title: NTab -->
  <text x="220" y="146" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif" font-size="30" font-weight="800" letter-spacing="-0.5" fill="url(#text-gradient)">NTab</text>

  <!-- Tagline -->
  <text x="220" y="174" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="#94a3b8" letter-spacing="0.2">Modern &amp; Minimalist New Tab Page</text>

  <!-- Feature Pills / Badges (y = 210) -->
  <!-- Pill 1: Smart Columns -->
  <g transform="translate(42, 206)">
    <rect width="108" height="26" rx="13" fill="#18181b" stroke="#27272a" stroke-width="1" />
    <text x="54" y="17" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10.5" font-weight="600" fill="#818cf8">✦ Smart Columns</text>
  </g>

  <!-- Pill 2: 100% Privacy -->
  <g transform="translate(162, 206)">
    <rect width="116" height="26" rx="13" fill="#18181b" stroke="#27272a" stroke-width="1" />
    <text x="58" y="17" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10.5" font-weight="600" fill="#38bdf8">✦ 100% Private</text>
  </g>

  <!-- Pill 3: Fast & Offline -->
  <g transform="translate(290, 206)">
    <rect width="108" height="26" rx="13" fill="#18181b" stroke="#27272a" stroke-width="1" />
    <text x="54" y="17" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10.5" font-weight="600" fill="#34d399">✦ Instant &amp; Clean</text>
  </g>

  <!-- Subtle bottom accent line -->
  <line x1="160" y1="258" x2="280" y2="258" stroke="#312e81" stroke-width="2" stroke-linecap="round" />
</svg>
`;

async function main() {
  const outputDir = path.resolve('public');
  const promo440Path = path.join(outputDir, 'promo-440x280.png');

  console.log('Generating 440x280 promo tile...');
  await sharp(Buffer.from(svg440x280))
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(promo440Path);

  console.log('Successfully generated:', promo440Path);
}

main().catch(console.error);
