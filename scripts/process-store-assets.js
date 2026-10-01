import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function processAssets() {
  const storeAssetsDir = path.resolve('store-assets');
  const rawDir = path.join(storeAssetsDir, 'raw');
  fs.mkdirSync(rawDir, { recursive: true });

  const publicDir = path.resolve('public');
  const img1Path = path.join(publicDir, 'image copy.png');
  const img2Path = path.join(publicDir, 'image.png');
  const promoPath = path.join(publicDir, 'promo-440x280.png');

  // Copy raw originals to store-assets/raw/ for permanent safekeeping
  if (fs.existsSync(img1Path)) {
    fs.copyFileSync(img1Path, path.join(rawDir, 'image-widescreen.png'));
  }
  if (fs.existsSync(img2Path)) {
    fs.copyFileSync(img2Path, path.join(rawDir, 'image-detail.png'));
  }
  if (fs.existsSync(promoPath)) {
    fs.copyFileSync(promoPath, path.join(storeAssetsDir, 'promo-440x280.png'));
  }

  // Generate 1280x800 Screenshot 1 (Widescreen Overview)
  if (fs.existsSync(img1Path)) {
    console.log('Processing screenshot 1 (1280x800)...');
    // Resize image to fit within 1220x740 leaving a 30px bezel
    const resizedImg1 = await sharp(img1Path)
      .resize({
        width: 1240,
        height: 760,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toBuffer();

    const resizedMeta = await sharp(resizedImg1).metadata();
    const left = Math.round((1280 - (resizedMeta.width || 1240)) / 2);
    const top = Math.round((800 - (resizedMeta.height || 760)) / 2);

    // Create 1280x800 base canvas
    const baseCanvas1 = await sharp({
      create: {
        width: 1280,
        height: 800,
        channels: 4,
        background: { r: 9, g: 9, b: 11, alpha: 1 },
      },
    })
      .composite([
        {
          input: resizedImg1,
          top,
          left,
        },
      ])
      .png({ quality: 100 })
      .toFile(path.join(storeAssetsDir, 'screenshot-1-1280x800.png'));

    console.log('Generated:', path.join(storeAssetsDir, 'screenshot-1-1280x800.png'));
  }

  // Generate 1280x800 Screenshot 2 (Detail View)
  if (fs.existsSync(img2Path)) {
    console.log('Processing screenshot 2 (1280x800)...');
    const resizedImg2 = await sharp(img2Path)
      .resize({
        width: 1200,
        height: 760,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toBuffer();

    const resizedMeta = await sharp(resizedImg2).metadata();
    const left = Math.round((1280 - (resizedMeta.width || 1200)) / 2);
    const top = Math.round((800 - (resizedMeta.height || 760)) / 2);

    const baseCanvas2 = await sharp({
      create: {
        width: 1280,
        height: 800,
        channels: 4,
        background: { r: 9, g: 9, b: 11, alpha: 1 },
      },
    })
      .composite([
        {
          input: resizedImg2,
          top,
          left,
        },
      ])
      .png({ quality: 100 })
      .toFile(path.join(storeAssetsDir, 'screenshot-2-1280x800.png'));

    console.log('Generated:', path.join(storeAssetsDir, 'screenshot-2-1280x800.png'));
  }

  // Now remove non-runtime promo images from public/ so extension package remains slim
  const toCleanFromPublic = [img1Path, img2Path, promoPath];
  for (const f of toCleanFromPublic) {
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
      console.log('Cleaned non-runtime asset from public/:', path.basename(f));
    }
  }

  console.log('Store assets successfully prepared in store-assets/');
}

processAssets().catch(console.error);
