/**
 * One-time generator for Marketing demo asset library PNGs.
 * Run from src/: node lib/marketing-jobs/scripts/generate-demo-asset-library.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_ROOT = path.resolve(__dirname, '../../../public/demo-assets/thirsty-turtl/gentle-cleanser');

const ASSETS = [
  { folder: 'Preview Images', name: 'Instagram Carousel.png', w: 1080, h: 1350, text: 'Instagram+Carousel' },
  { folder: 'Preview Images', name: 'Facebook Post.png', w: 1200, h: 630, text: 'Facebook+Post' },
  { folder: 'Preview Images', name: 'Pinterest Pins.png', w: 1000, h: 1500, text: 'Pinterest+Pin' },
  { folder: 'Preview Images', name: 'Instagram Stories.png', w: 1080, h: 1920, text: 'Instagram+Story' },
  { folder: 'Preview Images', name: 'Newsletter Header.png', w: 600, h: 200, text: 'Newsletter+Header' },
  { folder: 'Assets', name: 'Instagram Carousel.png', w: 1080, h: 1350, text: 'Instagram+Carousel' },
  { folder: 'Assets', name: 'Facebook Post.png', w: 1200, h: 630, text: 'Facebook+Post' },
  { folder: 'Assets', name: 'Pinterest Pins.png', w: 1000, h: 1500, text: 'Pinterest+Pin' },
  { folder: 'Assets', name: 'Instagram Stories.png', w: 1080, h: 1920, text: 'Instagram+Story' },
  { folder: 'Assets', name: 'Newsletter Header.png', w: 600, h: 200, text: 'Newsletter+Header' },
];

async function main() {
  for (const asset of ASSETS) {
    const dir = path.join(OUTPUT_ROOT, asset.folder);
    await fs.mkdir(dir, { recursive: true });
    const url = `https://placehold.co/${asset.w}x${asset.h}/e8f4ea/1d6f42/png?text=${asset.text}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(path.join(dir, asset.name), buffer);
    console.log(`Wrote ${asset.folder}/${asset.name}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
