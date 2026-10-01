import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const svg1400x560 = `
<svg width="1400" height="560" viewBox="0 0 1400 560" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Base -->
    <linearGradient id="bg-1400" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#09090b" />
      <stop offset="50%" stop-color="#0c0d14" />
      <stop offset="100%" stop-color="#09090b" />
    </linearGradient>

    <!-- Center Ambient Glow -->
    <radialGradient id="ambient-glow" cx="50%" cy="40%" r="55%">
      <stop offset="0%" stop-color="#4f46e5" stop-opacity="0.30" />
      <stop offset="45%" stop-color="#38bdf8" stop-opacity="0.10" />
      <stop offset="100%" stop-color="#09090b" stop-opacity="0" />
    </radialGradient>

    <!-- Logo Gradients -->
    <linearGradient id="m-bg-logo" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#18181b" />
      <stop offset="100%" stop-color="#09090b" />
    </linearGradient>
    <linearGradient id="m-left-ribbon" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#818cf8" />
      <stop offset="100%" stop-color="#4f46e5" />
    </linearGradient>
    <linearGradient id="m-right-ribbon" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>
    <linearGradient id="m-diag-ribbon" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5" />
      <stop offset="100%" stop-color="#38bdf8" />
    </linearGradient>
    <linearGradient id="m-text" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#e2e8f0" />
    </linearGradient>
  </defs>

  <!-- Opaque background (No alpha) -->
  <rect width="1400" height="560" fill="url(#bg-1400)" />
  <rect width="1400" height="560" fill="url(#ambient-glow)" />

  <!-- Outer subtle border -->
  <rect width="1398" height="558" x="1" y="1" fill="none" stroke="#27272a" stroke-width="1.5" />

  <!-- Center Logo (x = 700 - 54 = 646, y = 70) -->
  <g transform="translate(646, 70)">
    <rect width="108" height="108" rx="26" fill="#4f46e5" opacity="0.35" transform="translate(0, 6)" filter="blur(10px)" />
    <rect width="108" height="108" rx="26" fill="url(#m-bg-logo)" stroke="#3f3f46" stroke-width="1.5" />
    <g transform="translate(0, 0) scale(0.84375)">
      <polygon points="50,24 78,64 78,84 50,44" fill="url(#m-diag-ribbon)" />
      <path d="M 28 24 L 50 24 L 50 104 L 39 93 L 28 104 Z" fill="url(#m-left-ribbon)" />
      <path d="M 78 24 L 89 35 L 100 24 L 100 104 L 78 104 Z" fill="url(#m-right-ribbon)" />
    </g>
  </g>

  <!-- Title: NTab -->
  <text x="700" y="246" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif" font-size="52" font-weight="800" letter-spacing="-1" fill="url(#m-text)">NTab</text>

  <!-- Subtitle -->
  <text x="700" y="295" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="500" fill="#94a3b8" letter-spacing="0.3">Modern &amp; Minimalist New Tab Page</text>

  <!-- Descriptive Tagline -->
  <text x="700" y="338" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="400" fill="#64748b">Hyper-efficient multi-column bookmark manager · Zero telemetry · 100% offline-first</text>

  <!-- Feature Pills Group (y = 385) -->
  <!-- Pill 1: Smart Columns -->
  <g transform="translate(290, 385)">
    <rect width="180" height="42" rx="21" fill="#18181b" stroke="#27272a" stroke-width="1.2" />
    <text x="90" y="26" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13.5" font-weight="600" fill="#818cf8">✦ Smart Columns</text>
  </g>

  <!-- Pill 2: 100% Private -->
  <g transform="translate(490, 385)">
    <rect width="190" height="42" rx="21" fill="#18181b" stroke="#27272a" stroke-width="1.2" />
    <text x="95" y="26" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13.5" font-weight="600" fill="#38bdf8">✦ 100% Private &amp; Offline</text>
  </g>

  <!-- Pill 3: 7-Day Trash Bin -->
  <g transform="translate(700, 385)">
    <rect width="185" height="42" rx="21" fill="#18181b" stroke="#27272a" stroke-width="1.2" />
    <text x="92" y="26" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13.5" font-weight="600" fill="#a78bfa">✦ 7-Day Safety Trash</text>
  </g>

  <!-- Pill 4: Dead Link Checker -->
  <g transform="translate(905, 385)">
    <rect width="205" height="42" rx="21" fill="#18181b" stroke="#27272a" stroke-width="1.2" />
    <text x="102" y="26" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13.5" font-weight="600" fill="#34d399">✦ Dead Link Health Check</text>
  </g>

  <!-- Bottom Accent line -->
  <line x1="560" y1="480" x2="840" y2="480" stroke="#312e81" stroke-width="3" stroke-linecap="round" />
</svg>
`;

async function main() {
  const outputPath = path.resolve('store-assets/promo-1400x560.png');
  console.log('Generating 1400x560 Marquee Promo Tile...');
  await sharp(Buffer.from(svg1400x560))
    .removeAlpha() // Ensure 24-bit RGB without alpha per store requirement
    .png({ quality: 100 })
    .toFile(outputPath);
  console.log('Successfully generated:', outputPath);
}

main().catch(console.error);
