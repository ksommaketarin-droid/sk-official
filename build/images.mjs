import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const WIDTHS = [320, 480, 720, 960, 1280, 1600];
const FORMATS = {
  avif: (s) => s.avif({ quality: 52, effort: 4 }),
  jpg: (s) => s.jpeg({ quality: 78, mozjpeg: true, progressive: true }),
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Responsive images: every source becomes AVIF + JPEG at the widths it can
// fill, content-hashed so they can be cached forever. Encodes are cached in
// .cache/ by source hash, so a rebuild only encodes what changed.
export function createImages({ srcDir, outDir, publicPath, cacheDir }) {
  const memo = new Map();

  async function encode(file, name, hash, width, fmt) {
    const out = `${name}-${width}.${hash}.${fmt}`;
    const cached = path.join(cacheDir, out);
    try {
      await fs.access(cached);
    } catch {
      const buf = await FORMATS[fmt](sharp(file).resize({ width, withoutEnlargement: true })).toBuffer();
      await fs.writeFile(cached, buf);
    }
    await fs.copyFile(cached, path.join(outDir, out));
    return { w: width, url: publicPath + out };
  }

  function variants(src) {
    if (!memo.has(src)) {
      memo.set(src, (async () => {
        const file = path.join(srcDir, src);
        const buf = await fs.readFile(file);
        const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);
        const { width, height } = await sharp(buf).metadata();
        const name = src.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-');
        let widths = WIDTHS.filter((w) => w <= width);
        if (!widths.length || widths.at(-1) < Math.min(width, 1600)) widths.push(Math.min(width, 1600));
        const out = {};
        for (const fmt of Object.keys(FORMATS)) {
          out[fmt] = await Promise.all(widths.map((w) => encode(file, name, hash, w, fmt)));
        }
        return { width, height, ...out };
      })());
    }
    return memo.get(src);
  }

  // Returns a <picture>. `sizes` must describe the rendered width so the
  // browser picks the smallest adequate file.
  async function picture(src, { alt, sizes, className = '', loading = 'lazy', priority = false, imgClass = '' }) {
    if (typeof alt !== 'string') throw new Error(`Missing alt text for ${src}`);
    const v = await variants(src);
    const set = (list) => list.map((x) => `${x.url} ${x.w}w`).join(', ');
    const fallback = v.jpg.find((x) => x.w >= 960) ?? v.jpg.at(-1);
    return `<picture${className ? ` class="${className}"` : ''}>` +
      `<source type="image/avif" srcset="${set(v.avif)}" sizes="${esc(sizes)}">` +
      `<img src="${fallback.url}" srcset="${set(v.jpg)}" sizes="${esc(sizes)}" width="${v.width}" height="${v.height}" alt="${esc(alt)}"` +
      `${imgClass ? ` class="${imgClass}"` : ''} decoding="async"` +
      (priority ? ' fetchpriority="high"' : ` loading="${loading}"`) + '></picture>';
  }

  async function src(file, width) {
    const v = await variants(file);
    return (v.jpg.find((x) => x.w >= width) ?? v.jpg.at(-1)).url;
  }

  return { picture, variants, src };
}

// Logo mark, favicons, app icons and the social share card.
export async function brandAssets({ srcDir, outDir, rootDir, publicPath }) {
  const badge = path.join(srcDir, 'brand/logo-badge.png');
  const mark = await sharp(badge).extract({ left: 282, top: 86, width: 690, height: 690 }).toBuffer();
  const circle = Buffer.from('<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="50"/></svg>');
  const round = await sharp(mark)
    .composite([{ input: await sharp(circle).resize(690, 690).png().toBuffer(), blend: 'dest-in' }])
    .png().toBuffer();

  const files = {};
  const write = async (name, buf) => {
    const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);
    const out = name.replace(/(\.\w+)$/, `.${hash}$1`);
    await fs.writeFile(path.join(outDir, out), buf);
    files[name] = publicPath + out;
  };
  const plain = async (name, buf) => {
    await fs.writeFile(path.join(rootDir, name), buf);
  };

  await write('mark-96.png', await sharp(round).resize(96).png({ compressionLevel: 9 }).toBuffer());
  await write('mark-96.avif', await sharp(round).resize(96).avif({ quality: 60 }).toBuffer());
  await write('mark-240.png', await sharp(round).resize(240).png({ compressionLevel: 9 }).toBuffer());
  await write('icon-192.png', await sharp(mark).resize(192).png().toBuffer());
  await write('icon-512.png', await sharp(mark).resize(512).png().toBuffer());
  await write('og.jpg', await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#000000' } })
    .composite([{ input: await sharp(badge).resize(630, 630).toBuffer(), gravity: 'center' }])
    .jpeg({ quality: 82, mozjpeg: true }).toBuffer());
  // Fixed names: browsers and crawlers request these without reading HTML.
  await plain('favicon.png', await sharp(round).resize(48).png().toBuffer());
  await plain('apple-touch-icon.png', await sharp(mark).resize(180).png().toBuffer());
  return files;
}
