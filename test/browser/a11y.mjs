// Real-browser checks against dist/: axe-core (WCAG 2.2 AA) on every page,
// zero console errors or CSP violations, and the main flows driven by
// mouse and keyboard. Run `npm run build` first.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const root = path.resolve(import.meta.dirname, '../..');
const dist = path.join(root, 'dist');
if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/ is missing. Run npm run build first.');
  process.exit(1);
}

const PORT = 4400 + Math.floor(Math.random() * 400);
const server = spawn(process.execPath, [path.join(root, 'build/dev.mjs'), '--no-build', '--no-watch'], {
  env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'],
});
process.on('exit', () => server.kill());
process.on('uncaughtException', (err) => { console.error(err); process.exit(1); });
process.on('unhandledRejection', (err) => { console.error(err); process.exit(1); });
await new Promise((resolve) => server.stdout.once('data', resolve));
const BASE = `http://localhost:${PORT}`;

const pages = fs.readdirSync(dist, { recursive: true })
  .filter((f) => f.endsWith('index.html') || f.endsWith('404.html'))
  .map((f) => '/' + f.replace(/index\.html$/, ''))
  .sort();

const failures = [];
const fail = (msg) => { failures.push(msg); console.log(`  ✗ ${msg}`); };

const browser = await chromium.launch();

async function open(url, { viewport = { width: 1280, height: 900 }, reducedMotion = 'reduce' } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion });
  const page = await context.newPage();
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`));
  });
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  return { page, context, problems };
}

console.log(`axe on ${pages.length} pages`);
for (const url of pages) {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 800 }]) {
    if (viewport.width < 1000 && !/^\/((th|hi)\/)?(|shop\/|shop\/watches\/|story\/ep01\/|contact\/)$/.test(url)) continue;
    const { page, context, problems } = await open(url, { viewport });
    // Expanded states matter too: scan with the bag open on one page.
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    for (const v of result.violations) {
      fail(`${url} @${viewport.width}: ${v.id} (${v.impact}) ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
    }
    const scrollX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (scrollX > 0) fail(`${url} @${viewport.width}: page scrolls sideways by ${scrollX}px`);
    for (const p of problems) fail(`${url} @${viewport.width}: ${p}`);
    await context.close();
  }
}

console.log('flows');

// Product page: design, quantity and payment all reach the WhatsApp message.
{
  const { page, context, problems } = await open('/shop/mens-shirt/');
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await page.locator('form.order').getByRole('radio', { name: /^Cash/ }).check();
  const href = decodeURIComponent(await page.getByRole('link', { name: 'Order on WhatsApp' }).getAttribute('href'));
  if (!href.includes('2 × Men\'s Shirt: ₹1,158')) fail(`order message missing line: ${href}`);
  if (!href.includes('Payment: Cash')) fail('order message missing payment');
  if ((await page.locator('[data-total]').textContent()) !== '₹1,158') fail('total not updated');
  for (const p of problems) fail(`product flow: ${p}`);
  await context.close();
}

{
  const { page, context, problems } = await open('/shop/watches/');
  await page.locator('form.order').getByRole('radio', { name: 'Design 3' }).check();
  const href = decodeURIComponent(await page.getByRole('link', { name: 'Order on WhatsApp' }).getAttribute('href'));
  if (!href.includes('Fashion Watches (design 3)')) fail(`design not in message: ${href}`);
  const current = await page.locator('[data-thumb][aria-current]').getAttribute('data-thumb');
  if (current !== '2') fail(`gallery did not follow design (thumb ${current})`);

  // Bag: add, open, message, Escape returns focus.
  await page.getByRole('button', { name: 'Add to bag' }).click();
  const bagButton = page.locator('[data-bag-open]');
  if ((await bagButton.getAttribute('aria-label')) !== 'Bag, 1 items') fail('bag count label not updated');
  await bagButton.click();
  const dialog = page.getByRole('dialog', { name: 'Your bag' });
  if (!(await dialog.isVisible())) fail('bag did not open');
  const bagAxe = await new AxeBuilder({ page }).include('#bag').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  for (const v of bagAxe.violations) fail(`bag dialog: ${v.id} ${v.help}`);
  await page.getByLabel('Your name (optional)').fill('Asha‮');
  const bagHref = decodeURIComponent(await dialog.getByRole('link', { name: 'Send order on WhatsApp' }).getAttribute('href'));
  if (!bagHref.includes('1 × Fashion Watches (design 3): price to confirm') || !bagHref.includes('Name: Asha\n') && !bagHref.endsWith('Name: Asha')) fail(`bag message wrong: ${bagHref}`);
  await page.keyboard.press('Escape');
  if (await dialog.isVisible()) fail('Escape did not close the bag');
  if (!(await bagButton.evaluate((el) => el === document.activeElement))) fail('focus did not return to the bag button');

  // Tampered storage is ignored rather than rendered.
  await page.evaluate(() => localStorage.setItem('house-of-ketty-bag-v1', JSON.stringify([{ id: '<img src=x onerror=alert(1)>', qty: 5 }, { id: 'black', qty: 999, design: 'x' }])));
  await page.reload({ waitUntil: 'networkidle' });
  if ((await bagButton.getAttribute('aria-label')) !== 'Bag, 20 items') fail(`tampered bag not sanitised: ${await bagButton.getAttribute('aria-label')}`);
  for (const p of problems) fail(`bag flow: ${p}`);
  await context.close();
}

// Shop filter updates the grid, the count and the URL.
{
  const { page, context, problems } = await open('/shop/');
  await page.getByRole('button', { name: 'Watches' }).click();
  const visible = await page.locator('.product-card:visible').count();
  if (visible !== 1) fail(`watches filter shows ${visible} cards`);
  if (!page.url().endsWith('?c=watches')) fail(`filter not in URL: ${page.url()}`);
  if ((await page.locator('[data-count]').textContent()) !== '1 product') fail('count not announced');
  await page.selectOption('#sort', 'high');
  const first = await page.locator('.product-card:visible .card-title').first().textContent();
  if (first.trim() !== 'Fashion Watches') fail(`sort broke filter: ${first}`);
  await page.goto(`${BASE}/shop/?c=home`, { waitUntil: 'networkidle' });
  if ((await page.getByRole('button', { name: 'Home' }).getAttribute('aria-pressed')) !== 'true') fail('?c= not restored');
  for (const p of problems) fail(`shop flow: ${p}`);
  await context.close();
}

// Mobile menu and keyboard basics.
{
  const { page, context, problems } = await open('/th/', { viewport: { width: 375, height: 800 } });
  await page.keyboard.press('Tab');
  if ((await page.evaluate(() => document.activeElement.className)) !== 'skip-link') fail('first Tab is not the skip link');
  const toggle = page.locator('[data-menu-toggle]');
  await toggle.click();
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') fail('menu did not open');
  if (!(await page.getByRole('link', { name: 'ร้านค้า' }).first().isVisible())) fail('menu links not visible');
  await page.keyboard.press('Escape');
  if ((await toggle.getAttribute('aria-expanded')) !== 'false') fail('Escape did not close menu');
  await page.locator('[data-lang-menu] summary').click();
  const hindi = page.locator('[data-lang-menu] a[hreflang="hi"]');
  if ((await hindi.getAttribute('href')) !== '/hi/') fail('language switch link wrong');
  await hindi.click();
  await page.waitForURL(`${BASE}/hi/`);
  if ((await page.getAttribute('html', 'lang')) !== 'hi') fail('Hindi page lang wrong');
  for (const p of problems) fail(`mobile flow: ${p}`);
  await context.close();
}

// Motion on: the page must still render with animations enabled, and the
// butterfly follows the mouse without ever getting in the way.
{
  const { page, context, problems } = await open('/', { reducedMotion: 'no-preference' });
  for (let i = 0; i < 20; i++) await page.mouse.move(300 + i * 10, 400);
  const bf = page.locator('.butterfly-follow');
  if ((await bf.count()) !== 1) fail('butterfly did not appear on desktop');
  else {
    const info = await bf.evaluate((el) => ({ pe: getComputedStyle(el).pointerEvents, hidden: el.getAttribute('aria-hidden') }));
    if (info.pe !== 'none' || info.hidden !== 'true') fail(`butterfly is not inert: ${JSON.stringify(info)}`);
  }
  const box = await page.getByRole('link', { name: /Shop the collection/ }).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForURL(`${BASE}/shop/`).catch(() => fail('butterfly blocked a click on the hero button'));
  await page.mouse.wheel(0, 1600);
  await page.waitForTimeout(400);
  for (const p of problems) fail(`motion: ${p}`);
  await context.close();
}
{
  const { page, context } = await open('/');
  await page.mouse.move(400, 400);
  if (await page.locator('.butterfly').count()) fail('butterfly shown despite reduced motion');
  await context.close();
}
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.touchscreen.tap(340, 160);
  if ((await page.locator('.butterfly-tap').count()) !== 1) fail('tap did not release a butterfly');
  await page.waitForTimeout(1700);
  if (await page.locator('.butterfly-tap').count()) fail('tap butterfly was not cleaned up');
  await context.close();
}

await browser.close();
server.kill();

if (failures.length) {
  console.log(`\n${failures.length} problem(s).`);
  process.exit(1);
}
console.log('All browser checks passed.');
