// Pure helpers shared by the build (Node) and the browser. No DOM, no I/O.

export const MAX_QTY = 20;
export const MAX_NAME = 60;
export const MAX_NOTE = 300;

export const fill = (template, vars = {}) =>
  template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));

export const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');

// Every number a price mentions, lowest first. Drives sorting and "From ₹x".
export function priceAmounts(price) {
  if (!price) return [];
  if (typeof price.amount === 'number') return [price.amount];
  const out = [];
  for (const tier of price.tiers ?? []) {
    if (typeof tier.from === 'number') out.push(tier.from);
    if (typeof tier.min === 'number') out.push(tier.min);
    if (typeof tier.max === 'number') out.push(tier.max);
    for (const a of tier.amounts ?? []) out.push(a);
  }
  return out.sort((a, b) => a - b);
}

// The one amount a customer can actually pay without asking first, or null.
export const exactAmount = (price) => (price && typeof price.amount === 'number' ? price.amount : null);

export const lowestAmount = (price) => priceAmounts(price)[0] ?? null;

// Short label for cards: "₹599", "From ₹399", or "Price on request".
export function cardPrice(price, t) {
  const exact = exactAmount(price);
  if (exact !== null) return inr(exact);
  const low = lowestAmount(price);
  return low === null ? t.priceOnRequest : fill(t.from, { p: inr(low) });
}

// The MRP and percentage off when a product is sold below its MRP, or null.
export function discount(price, mrp) {
  const exact = exactAmount(price);
  if (exact === null || typeof mrp?.amount !== 'number' || mrp.amount <= exact) return null;
  return { mrp: mrp.amount, pct: Math.round(((mrp.amount - exact) / mrp.amount) * 100) };
}

// Each tier as { label, value }, for the full breakdown on a product page.
export function priceTiers(price, lang, t) {
  const exact = exactAmount(price);
  if (exact !== null) return [{ label: null, value: inr(exact) }];
  if (!price?.tiers) return [{ label: null, value: t.priceOnRequest }];
  return price.tiers.map((tier) => {
    let value;
    if (typeof tier.from === 'number') value = fill(t.from, { p: inr(tier.from) });
    else if (typeof tier.min === 'number') value = `${inr(tier.min)} – ${inr(tier.max)}`;
    else value = tier.amounts.map(inr).join(' / ');
    return { label: tier.label?.[lang] ?? null, value };
  });
}

// Strip control characters and invisible direction overrides, collapse
// whitespace, cap length. Used on anything a visitor types.
export function clean(value, max) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

export const clampQty = (n) => {
  const q = Math.floor(Number(n));
  return Number.isFinite(q) ? Math.min(MAX_QTY, Math.max(1, q)) : 1;
};

export const waLink = (number, text) =>
  `https://wa.me/${String(number).replace(/\D/g, '')}` + (text ? `?text=${encodeURIComponent(text)}` : '');

// items: [{ name, qty, design (1-based or null), amount (number or null) }]
// opts:  { payment: label or null, name, note }
export function orderMessage(items, opts, m) {
  const lines = [m.order, ''];
  let total = 0;
  let unpriced = 0;
  for (const item of items) {
    const qty = clampQty(item.qty);
    const design = item.design ? ` (${fill(m.design, { n: item.design })})` : '';
    const price = item.amount === null ? m.toConfirm : inr(item.amount * qty);
    if (item.amount === null) unpriced++;
    else total += item.amount * qty;
    lines.push(`• ${qty} × ${item.name}${design}: ${price}`);
  }
  if (total > 0) lines.push('', `${m.total}: ${inr(total)}${unpriced ? ` + ${m.toConfirm}` : ''}`);
  if (opts.payment) lines.push(`${m.payment}: ${opts.payment}`);
  const name = clean(opts.name, MAX_NAME);
  const note = clean(opts.note, MAX_NOTE);
  if (name) lines.push(`${m.name}: ${name}`);
  if (note) lines.push(`${m.note}: ${note}`);
  return lines.join('\n');
}

// NPCI UPI deep link. Only valid with a real VPA like name@bank.
export const isUpiId = (id) => /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,64}$/.test(id ?? '');

export function upiLink({ id, payee, amount, note }) {
  if (!isUpiId(id)) return null;
  const params = new URLSearchParams({ pa: id, pn: payee, cu: 'INR' });
  if (typeof amount === 'number' && amount > 0) params.set('am', amount.toFixed(2));
  if (note) params.set('tn', note.slice(0, 50));
  return `upi://pay?${params.toString()}`;
}

export const formatPhone = (n) => {
  const d = String(n).replace(/\D/g, '');
  return d.length === 12 && d.startsWith('91') ? `+91 ${d.slice(2, 7)} ${d.slice(7)}` : `+${d}`;
};
