// Re-encodes photos in src/images/ without metadata (EXIF, GPS), applying
// camera rotation and capping the long edge at 2400px. Safe to re-run.
// Usage: npm run clean-photos [-- path/to/photo.jpg ...]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const dir = path.resolve(import.meta.dirname, '../src/images');
const args = process.argv.slice(2);
const files = args.length
  ? args.map((f) => path.resolve(f))
  : fs.readdirSync(dir, { recursive: true }).filter((f) => /\.(jpe?g|png|heic|webp)$/i.test(f)).map((f) => path.join(dir, f));

for (const file of files) {
  if (file.endsWith('brand/logo-badge.png')) continue;
  const meta = await sharp(file).metadata();
  if (!meta.exif && /\.jpe?g$/i.test(file) && Math.max(meta.width, meta.height) <= 2400) continue;
  const out = file.replace(/\.(png|heic|webp|jpeg)$/i, '.jpg');
  const buf = await sharp(file).rotate()
    .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  fs.writeFileSync(out, buf);
  if (out !== file) fs.rmSync(file);
  console.log(`cleaned ${path.relative(process.cwd(), out)}`);
}
