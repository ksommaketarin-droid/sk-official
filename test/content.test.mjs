import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const site = read('src/data/site.json');
const langs = site.languages.map((l) => l.code);
const { categories, products } = read('src/data/products.json');
const episodes = read('src/data/episodes.json');
const dicts = Object.fromEntries(langs.map((l) => [l, read(`src/i18n/${l}.json`)]));

// Flatten to "a.b.0.c" -> value, so languages can be compared key by key.
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

test('every language has exactly the same UI strings', () => {
  const base = flatten(dicts.en);
  for (const lang of langs) {
    const other = flatten(dicts[lang]);
    assert.deepEqual(Object.keys(other).sort(), Object.keys(base).sort(), `${lang} keys differ from en`);
    for (const [key, value] of Object.entries(base)) {
      const tokens = (s) => String(s).match(/\{\w+\}/g)?.sort() ?? [];
      assert.deepEqual(tokens(other[key]), tokens(value), `${lang}.${key} placeholders differ`);
      assert.ok(String(other[key]).trim(), `${lang}.${key} is empty`);
    }
  }
});

test('products are complete in every language and their photos exist', () => {
  const ids = new Set();
  const cats = new Set(categories.map((c) => c.id));
  for (const p of products) {
    assert.match(p.id, /^[a-z0-9-]+$/, `${p.id} is not URL-safe`);
    assert.ok(!ids.has(p.id), `duplicate product ${p.id}`);
    ids.add(p.id);
    assert.ok(cats.has(p.category), `${p.id} has unknown category ${p.category}`);
    for (const lang of langs) assert.ok(p.summary[lang], `${p.id} missing ${lang} summary`);
    assert.ok(p.images.length > 0, `${p.id} has no images`);
    for (const img of p.images) {
      assert.ok(fs.existsSync(path.join(root, 'src/images', img.src)), `${img.src} missing`);
      for (const lang of langs) assert.ok(img.alt[lang]?.length > 8, `${img.src} missing ${lang} alt text`);
    }
    if (p.price) {
      if ('amount' in p.price) assert.ok(Number.isInteger(p.price.amount) && p.price.amount > 0, `${p.id} bad amount`);
      for (const tier of p.price.tiers ?? []) {
        const nums = [tier.from, tier.min, tier.max, ...(tier.amounts ?? [])].filter((x) => x !== undefined);
        assert.ok(nums.length && nums.every((n) => Number.isInteger(n) && n > 0), `${p.id} bad tier`);
        if (tier.label) for (const lang of langs) assert.ok(tier.label[lang], `${p.id} tier missing ${lang} label`);
      }
    }
  }
  for (const c of categories) for (const lang of langs) assert.ok(c.name[lang], `${c.id} missing ${lang} name`);
});

test('every episode exists in every language with matching paragraphs', () => {
  for (const ep of episodes) {
    const counts = {};
    for (const lang of langs) {
      assert.ok(ep.title[lang] && ep.teaser[lang], `${ep.id} missing ${lang} title/teaser`);
      const file = path.join(root, 'src/content/story', lang, `${ep.id}.txt`);
      assert.ok(fs.existsSync(file), `${lang}/${ep.id}.txt missing`);
      const text = fs.readFileSync(file, 'utf8');
      assert.ok(!text.includes('�'), `${lang}/${ep.id}.txt has a broken character`);
      counts[lang] = text.trim().split(/\n\s*\n/).length;
    }
    const expected = counts[ep.original];
    for (const lang of langs) assert.equal(counts[lang], expected, `${lang}/${ep.id} has ${counts[lang]} paragraphs, original has ${expected}`);
  }
});

test('source photos carry no location metadata', async () => {
  const sharp = (await import('sharp')).default;
  const dir = path.join(root, 'src/images');
  const files = fs.readdirSync(dir, { recursive: true }).filter((f) => /\.(jpe?g|png)$/i.test(f));
  for (const f of files) {
    const meta = await sharp(path.join(dir, f)).metadata();
    assert.ok(!meta.exif, `${f} still has EXIF data (may include GPS). Re-encode it without metadata.`);
  }
});
