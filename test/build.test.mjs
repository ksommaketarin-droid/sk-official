import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Builds into a temp directory and inspects every generated page.
let out;
let pages;

before(async () => {
  process.env.OUT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sk-build-'));
  const { build } = await import('../build/build.mjs');
  ({ out } = await build());
  pages = fs.readdirSync(out, { recursive: true })
    .filter((f) => f.endsWith('.html'))
    .map((f) => ({ file: f, html: fs.readFileSync(path.join(out, f), 'utf8') }))
    .filter((p) => !/^ep0\d\.html$/.test(p.file));
});

const all = (html, re) => [...html.matchAll(re)];

test('builds every page in all three languages', () => {
  const en = pages.filter((p) => !/^(th|hi)\//.test(p.file)).length;
  assert.ok(en >= 20, `only ${en} English pages`);
  assert.equal(pages.filter((p) => p.file.startsWith('th/')).length, en);
  assert.equal(pages.filter((p) => p.file.startsWith('hi/')).length, en);
});

test('each page declares its language, one h1, a title, description and canonical', () => {
  for (const { file, html } of pages) {
    const lang = file.startsWith('th/') ? 'th' : file.startsWith('hi/') ? 'hi' : 'en';
    assert.match(html, new RegExp(`<html lang="${lang}"`), `${file} lang`);
    assert.equal(all(html, /<h1[\s>]/g).length, 1, `${file} should have exactly one h1`);
    assert.match(html, /<title>[^<]{5,}<\/title>/, `${file} title`);
    assert.match(html, /<meta name="description" content="[^"]{20,}">/, `${file} description`);
    assert.match(html, /<link rel="canonical" href="https:\/\/[^"]+">/, `${file} canonical`);
    for (const l of ['en', 'th', 'hi', 'x-default']) assert.match(html, new RegExp(`hreflang="${l}"`), `${file} hreflang ${l}`);
  }
});

test('language switcher appears in header and footer and marks the current language', () => {
  for (const { file, html } of pages) {
    const header = html.slice(html.indexOf('<header class="site-header"'), html.indexOf('</header>'));
    const footer = html.slice(html.indexOf('<footer'), html.indexOf('</footer>'));
    for (const part of [header, footer]) {
      assert.equal(all(part, /<a [^>]*hreflang="(en|th|hi)"/g).length >= 3, true, `${file} switcher incomplete`);
      assert.match(part, /aria-current="true"/, `${file} switcher has no current language`);
    }
  }
});

test('markup is CSP-clean: no inline styles, handlers or unhashed scripts', () => {
  for (const { file, html } of pages) {
    assert.doesNotMatch(html, /\sstyle="/, `${file} has an inline style attribute`);
    assert.doesNotMatch(html, /\son[a-z]+="/, `${file} has an inline event handler`);
    assert.doesNotMatch(html, /javascript:/i, `${file} has a javascript: URL`);
    const scripts = all(html, /<script(?![^>]*\s(src=|type="application\/(ld\+)?json"))[^>]*>([\s\S]*?)<\/script>/g);
    assert.deepEqual(scripts.map((m) => m[3]), ["document.documentElement.classList.add('js')"], `${file} inline scripts`);
    assert.match(html, /<meta http-equiv="Content-Security-Policy" content="default-src 'none'/, `${file} CSP meta`);
  }
});

test('images have alt text and dimensions; ids are unique', () => {
  for (const { file, html } of pages) {
    for (const [tag] of all(html, /<img\b[^>]*>/g)) {
      assert.match(tag, /\salt="/, `${file}: ${tag.slice(0, 80)} has no alt`);
      assert.match(tag, /\swidth="\d+" height="\d+"/, `${file}: ${tag.slice(0, 80)} has no dimensions`);
    }
    const ids = all(html, /\sid="([^"]+)"/g).map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${file} has duplicate ids: ${ids.filter((x, i) => ids.indexOf(x) !== i)}`);
  }
});

test('every internal link and asset resolves; external links are WhatsApp, tel or UPI', () => {
  const missing = [];
  for (const { file, html } of pages) {
    for (const [, url] of all(html, /(?:href|src)="([^"]+)"/g)) {
      if (/^https:\/\/wa\.me\/\d+/.test(url) || /^tel:\+\d+$/.test(url) || url.startsWith('upi://') || url.startsWith('#')) continue;
      if (url.startsWith('https://houseofketty.store/')) continue; // canonical + hreflang
      if (/^[a-z]+:/i.test(url)) {
        missing.push(`${file} → unexpected external ${url}`);
        continue;
      }
      const clean = url.split(/[?#]/)[0];
      const target = path.join(out, clean.endsWith('/') ? `${clean}index.html` : clean);
      if (!fs.existsSync(target)) missing.push(`${file} → ${url}`);
    }
    for (const [tag] of all(html, /<a [^>]*href="https:\/\/wa\.me[^>]*>/g)) {
      assert.match(tag, /rel="noopener noreferrer"/, `${file} WhatsApp link without rel`);
    }
  }
  assert.deepEqual(missing, []);
});

test('server config sends the security headers and redirects old URLs', () => {
  const h = fs.readFileSync(path.join(out, '.htaccess'), 'utf8');
  for (const header of ['Content-Security-Policy', 'Strict-Transport-Security', 'X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy', 'Cross-Origin-Opener-Policy']) {
    assert.match(h, new RegExp(`Header always set ${header} `), `missing ${header}`);
  }
  assert.match(h, /frame-ancestors 'none'/);
  assert.match(h, /Options -Indexes/);
  assert.match(h, /RewriteRule \^ep01\\\.html\$ \/story\/ep01\/ \[L,R=301\]/);
  assert.ok(fs.existsSync(path.join(out, 'ep08.html')), 'fallback redirect stub for ep08.html');
  assert.ok(fs.existsSync(path.join(out, '.well-known/security.txt')));
});

test('sitemap lists every indexable page in every language', () => {
  const sitemap = fs.readFileSync(path.join(out, 'sitemap.xml'), 'utf8');
  const locs = all(sitemap, /<loc>([^<]+)<\/loc>/g).map((m) => m[1]);
  const indexable = pages.filter((p) => !p.html.includes('name="robots" content="noindex"'));
  assert.equal(locs.length, indexable.length);
  assert.ok(locs.every((l) => l.startsWith('https://')));
});

test('pages stay lean', () => {
  const css = fs.readdirSync(path.join(out, 'assets')).find((f) => f.endsWith('.css'));
  const js = fs.readdirSync(path.join(out, 'assets')).find((f) => f.endsWith('.js'));
  assert.ok(fs.statSync(path.join(out, 'assets', css)).size < 60_000, 'CSS over 60 KB');
  assert.ok(fs.statSync(path.join(out, 'assets', js)).size < 30_000, 'JS over 30 KB');
  for (const { file, html } of pages) assert.ok(html.length < 120_000, `${file} is ${html.length} bytes`);
});
