import { fill, inr, clampQty, clean, orderMessage, waLink, MAX_NAME, MAX_NOTE } from './shared.js';

// Progressive enhancement: every page works without this file. WhatsApp
// links carry a sensible default message; this script makes them precise.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const scrollBehavior = () => (reducedMotion.matches ? 'auto' : 'smooth');

let app;
try {
  app = JSON.parse($('#app-data').textContent);
} catch {
  app = null;
}

// ---------------------------------------------------------------- toast

const toastEl = $('[data-toast]');
let toastTimer;
function toast(message) {
  if (!toastEl) return;
  clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.classList.add('is-visible');
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('is-visible');
    setTimeout(() => { toastEl.textContent = ''; }, 300);
  }, 3200);
}

// ---------------------------------------------------------------- menu

function initMenu() {
  const toggle = $('[data-menu-toggle]');
  const nav = $('[data-nav]');
  if (!toggle || !nav) return;
  toggle.hidden = false;
  const set = (open, { focus = false } = {}) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? toggle.dataset.labelClose : toggle.dataset.labelOpen);
    nav.toggleAttribute('data-open', open);
    document.documentElement.style.overflow = open ? 'hidden' : '';
    if (open) $('a', nav)?.focus();
    else if (focus) toggle.focus();
  };
  toggle.addEventListener('click', () => set(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.hasAttribute('data-open')) set(false, { focus: true });
  });
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  matchMedia('(min-width: 900px)').addEventListener('change', (e) => { if (e.matches) set(false); });
}

// ---------------------------------------------------------------- language menu

function initLangMenu() {
  for (const menu of $$('[data-lang-menu]')) {
    document.addEventListener('click', (e) => { if (menu.open && !menu.contains(e.target)) menu.open = false; });
    menu.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.open) {
        menu.open = false;
        $('summary', menu).focus();
      }
    });
  }
}

// ---------------------------------------------------------------- bag storage
// Stored data is untrusted: anything that is not a known product id with a
// sane design and quantity is dropped on read.

const BAG_KEY = 'sk-official-bag-v1';

function readBag() {
  let raw;
  try {
    raw = JSON.parse(localStorage.getItem(BAG_KEY) ?? '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw.slice(0, 50)) {
    const product = app.products[item?.id];
    if (!product) continue;
    const design = Number.isInteger(item.design) && item.design >= 1 && item.design <= product.designs ? item.design : null;
    out.push({ id: item.id, design, qty: clampQty(item.qty) });
  }
  return out;
}

// The bag lives in memory and is mirrored to localStorage when available.
let bag = [];

function writeBag(items) {
  bag = items;
  try {
    localStorage.setItem(BAG_KEY, JSON.stringify(items));
  } catch {
    // Storage full or blocked: the bag still works until the page closes.
  }
  renderBag();
}

function addToBag(id, design, qty) {
  const items = [...bag];
  const existing = items.find((i) => i.id === id && i.design === design);
  if (existing) existing.qty = clampQty(existing.qty + qty);
  else items.push({ id, design, qty: clampQty(qty) });
  writeBag(items);
}

const bagItems = () => bag;

// ---------------------------------------------------------------- bag drawer

const paymentLabel = (value) => (value === 'cash' ? app.t.product.cash : app.t.product.upi);

function messageItems(items) {
  return items.map((i) => {
    const p = app.products[i.id];
    return { name: p.name, qty: i.qty, design: i.design, amount: p.amount };
  });
}

function renderBag() {
  const items = bagItems();
  const count = items.reduce((n, i) => n + i.qty, 0);
  for (const badge of $$('[data-bag-count]')) {
    badge.textContent = String(count);
    badge.toggleAttribute('data-empty', count === 0);
  }
  for (const btn of $$('[data-bag-open]')) btn.setAttribute('aria-label', fill(app.t.nav.bagCount, { n: count }));

  const dialog = $('[data-bag]');
  if (!dialog) return;
  const list = $('[data-bag-items]', dialog);
  const form = $('[data-bag-form]', dialog);
  $('[data-bag-empty]', dialog).hidden = items.length > 0;
  form.hidden = items.length === 0;
  list.replaceChildren(...items.map((item, index) => bagRow(item, index, items)));

  let subtotal = 0;
  let unpriced = 0;
  for (const i of items) {
    const amount = app.products[i.id].amount;
    if (amount === null) unpriced += 1;
    else subtotal += amount * i.qty;
  }
  $('[data-bag-subtotal]', dialog).textContent = inr(subtotal);
  const note = $('[data-bag-unpriced]', dialog);
  note.hidden = unpriced === 0;
  note.textContent = unpriced ? fill(app.t.bag.plusConfirm, { n: unpriced }) : '';
  updateBagLinks();
}

function bagRow(item, index, items) {
  const p = app.products[item.id];
  const li = document.createElement('li');
  li.className = 'bag-item';

  const img = document.createElement('img');
  img.src = p.thumb;
  img.alt = '';
  img.width = 72;
  img.height = 88;
  img.loading = 'lazy';

  const info = document.createElement('div');
  const name = document.createElement('a');
  name.className = 'bag-item-name';
  name.href = p.url;
  name.textContent = p.name;
  const meta = document.createElement('div');
  meta.className = 'bag-item-meta';
  meta.textContent = item.design ? fill(app.t.product.designN, { n: item.design }) : '';
  const price = document.createElement('div');
  price.className = 'bag-item-price';
  price.textContent = p.amount === null ? app.t.msg.toConfirm : inr(p.amount * item.qty);

  const qty = document.createElement('div');
  qty.className = 'bag-item-qty';
  const minus = iconButton('−', `${app.t.product.decrease}: ${p.name}`, () => {
    if (item.qty <= 1) items.splice(index, 1);
    else item.qty -= 1;
    writeBag(items);
  });
  const value = document.createElement('span');
  value.textContent = String(item.qty);
  const plus = iconButton('+', `${app.t.product.increase}: ${p.name}`, () => {
    item.qty = clampQty(item.qty + 1);
    writeBag(items);
  });
  qty.append(minus, value, plus);
  info.append(name, meta, price, qty);

  const remove = iconButton('×', fill(app.t.bag.remove, { name: p.name }), () => {
    items.splice(index, 1);
    writeBag(items);
    $('[data-bag-close]')?.focus();
  });
  li.append(img, info, remove);
  return li;
}

function iconButton(text, label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'icon-button icon-button-sm';
  b.textContent = text;
  b.setAttribute('aria-label', label);
  b.addEventListener('click', onClick);
  return b;
}

function updateBagLinks() {
  const form = $('[data-bag-form]');
  if (!form) return;
  const items = bagItems();
  const text = orderMessage(messageItems(items), {
    payment: paymentLabel(form.elements.payment.value),
    name: form.elements.name.value,
    note: form.elements.note.value,
  }, app.t.msg);
  $$('[data-wa]', form).forEach((a) => {
    a.href = waLink(app.wa[a.dataset.wa === 'line2' ? 1 : 0], text);
  });
}

function initBag() {
  const dialog = $('[data-bag]');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const openers = $$('[data-bag-open]');
  openers.forEach((b) => {
    b.hidden = false;
    b.addEventListener('click', () => dialog.showModal());
  });
  $('[data-bag-close]', dialog).addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  const form = $('[data-bag-form]', dialog);
  form.elements.name.maxLength = MAX_NAME;
  form.elements.note.maxLength = MAX_NOTE;
  form.addEventListener('input', updateBagLinks);
  form.addEventListener('change', updateBagLinks);
  form.addEventListener('submit', (e) => e.preventDefault());
  $('[data-bag-clear]', dialog).addEventListener('click', () => {
    writeBag([]);
    toast(app.t.bag.cleared);
    $('[data-bag-close]', dialog).focus();
  });
  window.addEventListener('storage', (e) => {
    if (e.key === BAG_KEY) { bag = readBag(); renderBag(); }
  });
  bag = readBag();
  renderBag();
}

// ---------------------------------------------------------------- gallery

function initGallery() {
  const gallery = $('[data-gallery]');
  if (!gallery) return null;
  const track = $('[data-gallery-track]', gallery);
  const slides = $$('.slide', track);
  const thumbs = $$('[data-thumb]', gallery);
  const prev = $('[data-gallery-prev]', gallery);
  const next = $('[data-gallery-next]', gallery);
  let current = 0;
  const listeners = [];

  const mark = (i) => {
    current = i;
    thumbs.forEach((t, n) => (n === i ? t.setAttribute('aria-current', 'true') : t.removeAttribute('aria-current')));
    if (prev) prev.disabled = i === 0;
    if (next) next.disabled = i === slides.length - 1;
  };
  const go = (i) => {
    const target = Math.max(0, Math.min(slides.length - 1, i));
    track.scrollTo({ left: slides[target].offsetLeft - track.offsetLeft, behavior: scrollBehavior() });
    mark(target);
  };

  thumbs.forEach((t, i) => t.addEventListener('click', (e) => {
    e.preventDefault();
    go(i);
    listeners.forEach((fn) => fn(i));
  }));
  if (prev && next && slides.length > 1) {
    prev.hidden = false;
    next.hidden = false;
    prev.addEventListener('click', () => { go(current - 1); listeners.forEach((fn) => fn(current)); });
    next.addEventListener('click', () => { go(current + 1); listeners.forEach((fn) => fn(current)); });
  }

  // Swiping updates the thumbnails (and design) to match what is shown.
  let settle;
  track.addEventListener('scroll', () => {
    clearTimeout(settle);
    settle = setTimeout(() => {
      const i = Math.round(track.scrollLeft / track.clientWidth);
      if (i !== current && slides[i]) {
        mark(i);
        listeners.forEach((fn) => fn(i));
      }
    }, 120);
  }, { passive: true });

  mark(0);
  return { go, onChange: (fn) => listeners.push(fn) };
}

// ---------------------------------------------------------------- product order

function initOrder(gallery) {
  const form = $('[data-order]');
  if (!form) return;
  const id = form.dataset.order;
  const product = app.products[id];
  if (!product) return;
  const qtyInput = form.elements.qty;
  const totalEl = $('[data-total]', form);
  const upiPanel = $('[data-upi-panel]', form);
  const upiAppLink = $('[data-upi-link]', form);
  const designInputs = $$('input[name="design"]', form);

  const design = () => {
    const checked = designInputs.find((i) => i.checked);
    return checked ? Number(checked.value) : null;
  };

  const update = () => {
    const qty = clampQty(qtyInput.value);
    if (String(qty) !== qtyInput.value && document.activeElement !== qtyInput) qtyInput.value = String(qty);
    if (totalEl && product.amount !== null) totalEl.textContent = inr(product.amount * qty);
    const payment = form.elements.payment.value;
    if (upiPanel) upiPanel.hidden = payment !== 'upi';
    if (upiAppLink && product.amount !== null) {
      const url = new URL(upiAppLink.href);
      url.searchParams.set('am', (product.amount * qty).toFixed(2));
      upiAppLink.href = url.toString();
      upiAppLink.textContent = fill(app.t.pay.payApp, { amount: inr(product.amount * qty) });
    }
    const text = orderMessage([{ name: product.name, qty, design: design(), amount: product.amount }], { payment: paymentLabel(payment) }, app.t.msg);
    $$('[data-wa]', form).forEach((a) => {
      a.href = waLink(app.wa[a.dataset.wa === 'line2' ? 1 : 0], text);
    });
  };

  $$('[data-qty]', form).forEach((b) => b.addEventListener('click', () => {
    qtyInput.value = String(clampQty(Number(qtyInput.value) + Number(b.dataset.qty)));
    update();
  }));
  qtyInput.addEventListener('blur', () => { qtyInput.value = String(clampQty(qtyInput.value)); update(); });
  form.addEventListener('input', update);
  form.addEventListener('change', (e) => {
    if (e.target.name === 'design' && gallery) gallery.go(Number(e.target.value) - 1);
    update();
  });
  form.addEventListener('submit', (e) => e.preventDefault());

  if (gallery && designInputs.length) {
    gallery.onChange((i) => {
      if (designInputs[i] && !designInputs[i].checked) {
        designInputs[i].checked = true;
        update();
      }
    });
  }

  const add = $('[data-add]', form);
  if (add && $('[data-bag]')?.showModal) {
    add.hidden = false;
    add.addEventListener('click', () => {
      addToBag(id, design(), clampQty(qtyInput.value));
      toast(fill(app.t.product.added, { name: product.name }));
    });
  }
  update();
}

// ---------------------------------------------------------------- shop filters

function initShop() {
  const grid = $('[data-grid]');
  if (!grid) return;
  const cards = $$('.product-card', grid);
  cards.forEach((c, i) => { c.dataset.index = String(i); });
  const chips = $$('[data-filter]');
  const sort = $('[data-sort]');
  const count = $('[data-count]');
  const empty = $('[data-empty]');
  const valid = new Set(chips.map((c) => c.dataset.filter));
  let filter = new URLSearchParams(location.search).get('c');
  if (!valid.has(filter)) filter = 'all';

  const apply = ({ announce = true } = {}) => {
    let shown = 0;
    for (const card of cards) {
      const visible = filter === 'all' || card.dataset.category === filter;
      card.hidden = !visible;
      if (visible) shown += 1;
    }
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === filter)));
    // Items priced on request always sort last.
    const price = (card) => (card.dataset.price === '' ? null : Number(card.dataset.price));
    const order = [...cards].sort((a, b) => {
      if (sort.value === 'featured') return b.dataset.featured - a.dataset.featured || a.dataset.index - b.dataset.index;
      const pa = price(a);
      const pb = price(b);
      if (pa === null || pb === null) return (pa === null) - (pb === null);
      return sort.value === 'low' ? pa - pb : pb - pa;
    });
    grid.append(...order);
    empty.hidden = shown > 0;
    if (announce || count.textContent === '') {
      count.textContent = shown === 1 ? app.t.shop.countOne : fill(app.t.shop.count, { n: shown });
    }
    const url = new URL(location.href);
    if (filter === 'all') url.searchParams.delete('c');
    else url.searchParams.set('c', filter);
    history.replaceState(null, '', url);
  };

  chips.forEach((c) => c.addEventListener('click', () => { filter = c.dataset.filter; apply(); }));
  sort.addEventListener('change', () => apply());
  apply({ announce: false });
}

// ---------------------------------------------------------------- copy UPI

function initCopy() {
  $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(clean(b.dataset.copy, 256));
      toast(app.t.pay.copied);
    } catch {
      const code = b.closest('.upi-id')?.querySelector('code');
      if (code) getSelection().selectAllChildren(code);
    }
  }));
}

// ---------------------------------------------------------------- boot

if (app) {
  initMenu();
  initLangMenu();
  initBag();
  initShop();
  initOrder(initGallery());
  initCopy();
}
