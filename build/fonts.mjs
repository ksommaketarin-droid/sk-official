import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

// Self-hosted variable fonts: only the subsets the site needs. unicode-range
// means a page downloads the Thai or Devanagari file only when it shows
// those scripts in that font.
const FONTS = [
  { pkg: 'cormorant-garamond', css: 'wght.css', family: 'Cormorant', blocks: ['cormorant-garamond-latin-wght-normal'] },
  { pkg: 'cormorant-garamond', css: 'wght-italic.css', family: 'Cormorant', blocks: ['cormorant-garamond-latin-wght-italic'] },
  { pkg: 'dm-sans', css: 'wght.css', family: 'DM Sans', blocks: ['dm-sans-latin-wght-normal'] },
  { pkg: 'noto-sans-thai', css: 'wght.css', family: 'Noto Sans Thai', blocks: ['noto-sans-thai-thai-wght-normal'] },
  { pkg: 'noto-sans-devanagari', css: 'wght.css', family: 'Noto Sans Devanagari', blocks: ['noto-sans-devanagari-devanagari-wght-normal'] },
];

// Fonts worth preloading per page language: the ones above the fold.
const PRELOAD = {
  en: ['cormorant-garamond-latin-wght-normal', 'dm-sans-latin-wght-normal'],
  th: ['cormorant-garamond-latin-wght-normal', 'dm-sans-latin-wght-normal', 'noto-sans-thai-thai-wght-normal'],
  hi: ['cormorant-garamond-latin-wght-normal', 'dm-sans-latin-wght-normal', 'noto-sans-devanagari-devanagari-wght-normal'],
};

export async function buildFonts({ root, outDir, publicPath }) {
  const urls = {};
  let css = '';
  for (const f of FONTS) {
    const dir = path.join(root, 'node_modules/@fontsource-variable', f.pkg);
    const source = await fs.readFile(path.join(dir, f.css), 'utf8');
    for (const name of f.blocks) {
      const match = source.match(new RegExp(`/\\* ${name} \\*/\\s*(@font-face\\s*{[^}]+})`));
      if (!match) throw new Error(`Font block ${name} not found in ${f.pkg}/${f.css}`);
      const buf = await fs.readFile(path.join(dir, 'files', `${name}.woff2`));
      const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);
      const file = `${name}.${hash}.woff2`;
      await fs.writeFile(path.join(outDir, file), buf);
      urls[name] = publicPath + file;
      css += match[1]
        .replace(/font-family:[^;]+;/, `font-family: '${f.family}';`)
        .replace(/url\([^)]+\)/, `url(${publicPath}${file})`) + '\n';
    }
  }
  const preload = Object.fromEntries(Object.entries(PRELOAD).map(([lang, names]) => [lang, names.map((n) => urls[n])]));
  return { css, preload };
}
