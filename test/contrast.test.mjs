import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Reads the theme tokens straight from main.css and checks every pair the
// design actually uses against WCAG 2.2 AA.
const css = fs.readFileSync(path.resolve(import.meta.dirname, '../src/styles/main.css'), 'utf8');

function themes() {
  const out = {};
  for (const m of css.matchAll(/((?::root,\s*)?\[data-theme="(\w+)"\])\s*{([^}]+)}/g)) {
    const tokens = {};
    for (const t of m[3].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)) tokens[t[1]] = t[2];
    out[m[2]] = tokens;
  }
  return out;
}

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [foreground, background, minimum]
const TEXT = 4.5;
const UI = 3;
const PAIRS = [
  ['text', 'bg', TEXT], ['text', 'surface', TEXT], ['text', 'surface-2', TEXT],
  ['muted', 'bg', TEXT], ['muted', 'surface', TEXT], ['muted', 'surface-2', TEXT],
  ['accent', 'bg', TEXT], ['accent', 'surface', TEXT], ['accent', 'surface-2', TEXT],
  ['on-primary', 'primary', TEXT], ['on-primary', 'primary-hover', TEXT],
  ['on-secondary', 'secondary', TEXT], ['on-secondary', 'secondary-hover', TEXT],
  ['text', 'secondary', TEXT],
  ['control', 'bg', UI], ['control', 'surface', UI],
  ['focus', 'bg', UI], ['focus', 'surface', UI],
  ['primary', 'bg', UI], ['primary', 'surface', UI],
  // Gold is only used for large display numerals (3:1 for large text).
  ['gold', 'bg', UI], ['gold', 'surface', UI],
];

test('every theme defines the full token set', () => {
  const all = themes();
  assert.deepEqual(Object.keys(all).sort(), ['contact', 'footer', 'hero', 'home', 'light', 'shop', 'story']);
  for (const [name, t] of Object.entries(all)) {
    for (const [fg, bg] of PAIRS) {
      assert.ok(t[fg] && t[bg], `${name} is missing --${t[fg] ? bg : fg}`);
    }
  }
});

test('text and controls meet WCAG AA contrast in every theme', () => {
  const failures = [];
  for (const [name, t] of Object.entries(themes())) {
    for (const [fg, bg, min] of PAIRS) {
      const r = ratio(t[fg], t[bg]);
      if (r < min) failures.push(`${name}: --${fg} ${t[fg]} on --${bg} ${t[bg]} is ${r.toFixed(2)}:1, needs ${min}:1`);
    }
  }
  assert.deepEqual(failures, []);
});

test('fixed colours over photos and badges stay readable', () => {
  // Band and story-hero text sit on a cream overlay (at least 88% opaque)
  // over the photo; the worst case is that overlay over pure black.
  const blend = (fg, bg, a) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(fg.slice(i, i + 2), 16) * a + parseInt(bg.slice(i, i + 2), 16) * (1 - a)).toString(16).padStart(2, '0')).join('');
  const all = themes();
  for (const name of ['home', 'story']) {
    const worst = blend(all[name].bg, '#000000', 0.88);
    for (const fg of ['text', 'muted', 'accent']) {
      assert.ok(ratio(all[name][fg], worst) >= TEXT, `${name} band --${fg}: ${ratio(all[name][fg], worst).toFixed(2)}`);
    }
  }
  // Design-count badge: #8a1044 on white at 94% over a black photo.
  const badge = blend('#ffffff', '#000000', 0.94);
  assert.ok(ratio('#8a1044', badge) >= TEXT, `badge ${ratio('#8a1044', badge).toFixed(2)}`);
  // Toast and skip link: white on raspberry.
  assert.ok(ratio('#ffffff', '#c2185b') >= TEXT);
});
