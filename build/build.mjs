import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { createImages, brandAssets } from './images.mjs';
import { buildFonts } from './fonts.mjs';
import { layout } from './layout.mjs';
import * as pages from './pages.mjs';
import { csp, htaccess, securityTxt } from './security.mjs';
import { isUpiId, upiLink } from '../src/scripts/shared.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.resolve(ROOT, process.env.OUT_DIR ?? 'dist');
const CACHE = path.join(ROOT, '.cache/img');

const readJson = async (p) => JSON.parse(await fs.readFile(path.join(SRC, p), 'utf8'));
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 10);

// BASE_PATH lets the same build serve from a sub-path (GitHub Pages preview).
const base = ('/' + (process.env.BASE_PATH ?? '/').replace(/^\/+|\/+$/g, '') + '/').replace('//', '/');

export async function build() {
  const started = Date.now();
  const site = await readJson('data/site.json');
  if (process.env.SITE_URL) site.url = process.env.SITE_URL;
  site.url = site.url.replace(/\/$/, '');
  if (process.env.UPI_ID) site.upi.id = process.env.UPI_ID;
  const { categories, products } = await readJson('data/products.json');
  const episodes = await readJson('data/episodes.json');
  const dict = Object.fromEntries(await Promise.all(site.languages.map(async (l) => [l.code, await readJson(`i18n/${l.code}.json`)])));

  const texts = {};
  for (const l of site.languages) {
    for (const ep of episodes) {
      const raw = await fs.readFile(path.join(SRC, 'content/story', l.code, `${ep.id}.txt`), 'utf8');
      texts[`${l.code}/${ep.id}`] = raw.trim().split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
    }
  }

  await fs.rm(OUT, { recursive: true, force: true });
  const dirs = { img: path.join(OUT, 'assets/img'), fonts: path.join(OUT, 'assets/fonts'), assets: path.join(OUT, 'assets') };
  for (const d of [...Object.values(dirs), CACHE]) await fs.mkdir(d, { recursive: true });

  const img = createImages({ srcDir: path.join(SRC, 'images'), outDir: dirs.img, publicPath: `${base}assets/img/`, cacheDir: CACHE });
  const [brand, fonts] = await Promise.all([
    brandAssets({ srcDir: path.join(SRC, 'images'), outDir: dirs.img, rootDir: OUT, publicPath: `${base}assets/img/` }),
    buildFonts({ root: ROOT, outDir: dirs.fonts, publicPath: `${base}assets/fonts/` }),
  ]);

  // CSS: fonts first, then the stylesheet. Light minification only.
  const styles = fonts.css + await fs.readFile(path.join(SRC, 'styles/main.css'), 'utf8');
  const css = styles.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n\s*\n+/g, '\n').replace(/^\s+/gm, '');
  const cssFile = `site.${hash(css)}.css`;
  await fs.writeFile(path.join(dirs.assets, cssFile), css);

  // JS: shared helpers + main, as one module with no network waterfall.
  const shared = await fs.readFile(path.join(SRC, 'scripts/shared.js'), 'utf8');
  const main = await fs.readFile(path.join(SRC, 'scripts/main.js'), 'utf8');
  const js = shared.replace(/^export /gm, '') + '\n' + main.replace(/^import [^;]+;\n/gm, '');
  const jsFile = `site.${hash(js)}.js`;
  await fs.writeFile(path.join(dirs.assets, jsFile), js);

  const policy = csp();
  const thumbs = Object.fromEntries(await Promise.all(products.map(async (p) => [p.id, await img.src(p.images[0].src, 320)])));
  const upiQr = isUpiId(site.upi.id)
    ? await QRCode.toString(upiLink({ id: site.upi.id, payee: site.upi.payee }), { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#2b1620', light: '#ffffff' } })
    : '';

  const langPrefix = (code) => site.languages.find((l) => l.code === code).prefix;
  const outputs = [];

  for (const l of site.languages) {
    const ctx = {
      lang: l.code, t: dict[l.code], dict, site, root: base, brand, fonts, img, thumbs, upiQr, csp: policy,
      assets: { css: `${base}assets/${cssFile}`, js: `${base}assets/${jsFile}` },
      data: { categories, products, episodes },
      href: (p, lang = l.code) => base + (langPrefix(lang) ? `${langPrefix(lang)}/` : '') + p,
      abs: (p, lang = l.code) => lang === null
        ? site.url + '/' + p.slice(base.length)
        : `${site.url}/${langPrefix(lang) ? `${langPrefix(lang)}/` : ''}${p}`,
      episodeText: (id, lang) => texts[`${lang}/${id}`],
      readingTime: (id) => {
        const words = texts[`${l.code}/${id}`].join(' ');
        // Thai has no spaces between words; estimate by characters.
        const minutes = l.code === 'th' ? words.length / 900 : words.split(/\s+/).length / 200;
        return Math.max(1, Math.round(minutes));
      },
    };

    const list = [
      await pages.home(ctx),
      await pages.shop(ctx),
      ...(await Promise.all(products.map((p) => pages.product(ctx, p)))),
      await pages.story(ctx),
      ...(await Promise.all(episodes.map((ep, i) => pages.episode(ctx, ep, i)))),
      await pages.contact(ctx),
      await pages.notFound(ctx),
    ];
    for (const page of list) {
      const rel = (l.prefix ? `${l.prefix}/` : '') + (page.path.endsWith('.html') ? page.path : `${page.path}index.html`);
      let doc = layout(ctx, page);
      if (page.noindex) doc = doc.replace('<meta name="description"', '<meta name="robots" content="noindex">\n<meta name="description"');
      await fs.mkdir(path.dirname(path.join(OUT, rel)), { recursive: true });
      await fs.writeFile(path.join(OUT, rel), doc);
      outputs.push({ rel, page, lang: l.code });
    }
  }

  // Old flat URLs (ep01.html …) keep working: 301 on Apache, stub elsewhere.
  const redirects = episodes.map((ep) => [`${ep.id}.html`, `${base}story/${ep.id}/`]);
  for (const [from, to] of redirects) {
    await fs.writeFile(path.join(OUT, from), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${dict.en.redirect}</title><meta name="robots" content="noindex"><link rel="canonical" href="${site.url}${to.slice(base.length - 1)}"><meta http-equiv="refresh" content="0; url=${to}"></head><body><p><a href="${to}">${dict.en.redirect}</a></p></body></html>\n`);
  }

  const sitemapPages = outputs.filter((o) => !o.page.noindex && o.lang === 'en');
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemapPages.map(({ page }) => site.languages.map((l) => `  <url>
    <loc>${site.url}/${l.prefix ? `${l.prefix}/` : ''}${page.path}</loc>
${site.languages.map((a) => `    <xhtml:link rel="alternate" hreflang="${a.code}" href="${site.url}/${a.prefix ? `${a.prefix}/` : ''}${page.path}"/>`).join('\n')}
  </url>`).join('\n')).join('\n')}
</urlset>
`;
  const expires = new Date(Date.now() + 364 * 864e5).toISOString().replace(/\.\d+Z$/, 'Z');
  await fs.mkdir(path.join(OUT, '.well-known'), { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(OUT, 'sitemap.xml'), sitemap),
    fs.writeFile(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`),
    fs.writeFile(path.join(OUT, '.htaccess'), htaccess({ policy: policy.header, redirects, base })),
    fs.writeFile(path.join(OUT, '.well-known/security.txt'), securityTxt({ site, expires })),
    fs.writeFile(path.join(OUT, '.nojekyll'), ''),
    fs.writeFile(path.join(OUT, 'manifest.webmanifest'), JSON.stringify({
      name: 'SK Official · House of Ketty', short_name: 'SK Official', start_url: base, scope: base, display: 'standalone',
      background_color: '#fffaf8', theme_color: '#fff1f4',
      icons: [{ src: brand['icon-192.png'], sizes: '192x192', type: 'image/png' }, { src: brand['icon-512.png'], sizes: '512x512', type: 'image/png' }],
    }, null, 2)),
  ]);

  const count = outputs.length;
  console.log(`Built ${count} pages in ${((Date.now() - started) / 1000).toFixed(1)}s → ${path.relative(ROOT, OUT)}/ (base ${base})`);
  return { out: OUT, outputs, base };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  build().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
