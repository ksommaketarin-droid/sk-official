import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fill, inr, cardPrice, discount, priceTiers, priceAmounts, exactAmount, clean, clampQty, waLink, orderMessage, upiLink, isUpiId, formatPhone,
} from '../src/scripts/shared.js';

const shopT = { from: 'From {p}', priceOnRequest: 'Price on request' };
const msg = { order: 'Order:', design: 'design {n}', toConfirm: 'price to confirm', total: 'Total', payment: 'Payment', name: 'Name', note: 'Note' };

test('fill replaces known keys and leaves unknown ones visible', () => {
  assert.equal(fill('{n} of {m}', { n: 1, m: 3 }), '1 of 3');
  assert.equal(fill('{n} of {m}', { n: 1 }), '1 of {m}');
});

test('inr uses Indian digit grouping', () => {
  assert.equal(inr(599), '₹599');
  assert.equal(inr(120000), '₹1,20,000');
});

test('card prices cover every price shape', () => {
  assert.equal(cardPrice({ amount: 599 }, shopT), '₹599');
  assert.equal(cardPrice({ tiers: [{ from: 599 }, { from: 399 }] }, shopT), 'From ₹399');
  assert.equal(cardPrice({ tiers: [{ min: 499, max: 699 }] }, shopT), 'From ₹499');
  assert.equal(cardPrice({ tiers: [{ amounts: [299, 399] }] }, shopT), 'From ₹299');
  assert.equal(cardPrice(null, shopT), 'Price on request');
});

test('discount needs an exact price below the MRP', () => {
  assert.deepEqual(discount({ amount: 449 }, { amount: 649 }), { mrp: 649, pct: 31 });
  assert.equal(discount({ amount: 449 }, undefined), null);
  assert.equal(discount({ amount: 449 }, { amount: 449 }), null);
  assert.equal(discount({ tiers: [{ amounts: [199, 299] }] }, { amount: 499 }), null);
});

test('price tiers keep labels per language', () => {
  const price = { tiers: [{ label: { en: 'Single', th: 'เส้นเดี่ยว' }, amounts: [199, 299] }, { min: 499, max: 699 }] };
  assert.deepEqual(priceTiers(price, 'th', shopT), [
    { label: 'เส้นเดี่ยว', value: '₹199 / ₹299' },
    { label: null, value: '₹499 – ₹699' },
  ]);
  assert.deepEqual(priceAmounts(price), [199, 299, 499, 699]);
  assert.equal(exactAmount(price), null);
});

test('clean strips control and bidi-override characters and caps length', () => {
  assert.equal(clean('  Ketty‮\u0000 ', 60), 'Ketty');
  assert.equal(clean('a'.repeat(100), 10), 'a'.repeat(10));
  assert.equal(clean('line1\n\n\n\nline2', 60), 'line1\n\nline2');
  assert.equal(clean(undefined, 10), '');
});

test('quantities are clamped to 1–20', () => {
  assert.equal(clampQty('3'), 3);
  assert.equal(clampQty(0), 1);
  assert.equal(clampQty(-5), 1);
  assert.equal(clampQty(999), 20);
  assert.equal(clampQty('abc'), 1);
  assert.equal(clampQty(2.9), 2);
});

test('WhatsApp links are encoded and only ever point at wa.me digits', () => {
  assert.equal(waLink('91 93155-59736', 'Hi & bye?'), 'https://wa.me/919315559736?text=Hi%20%26%20bye%3F');
  assert.equal(waLink('919315559736'), 'https://wa.me/919315559736');
  assert.equal(waLink('javascript:alert(1)//919', 'x'), 'https://wa.me/1919?text=x');
});

test('order message lists items, totals priced ones and flags the rest', () => {
  const text = orderMessage([
    { name: 'Charcoal Round Sunglasses', qty: 2, design: null, amount: 599 },
    { name: 'Fashion Watches', qty: 1, design: 3, amount: null },
  ], { payment: 'UPI', name: ' Asha ', note: '' }, msg);
  assert.equal(text, [
    'Order:', '',
    '• 2 × Charcoal Round Sunglasses: ₹1,198',
    '• 1 × Fashion Watches (design 3): price to confirm',
    '', 'Total: ₹1,198 + price to confirm',
    'Payment: UPI',
    'Name: Asha',
  ].join('\n'));
});

test('order message cleans visitor input', () => {
  const text = orderMessage([{ name: 'X', qty: 1, design: null, amount: 100 }], { payment: null, name: 'A‮b', note: 'n'.repeat(400) }, msg);
  assert.match(text, /Name: Ab$/m);
  assert.equal(text.split('Note: ')[1].length, 300);
});

test('UPI links need a real VPA and carry the amount', () => {
  assert.equal(isUpiId(''), false);
  assert.equal(isUpiId('not an id'), false);
  assert.equal(isUpiId('shop@okaxis'), true);
  assert.equal(upiLink({ id: '', payee: 'House of Ketty' }), null);
  assert.equal(upiLink({ id: 'hok@upi', payee: 'House of Ketty', amount: 599 }), 'upi://pay?pa=hok%40upi&pn=House+of+Ketty&cu=INR&am=599.00');
});

test('phone numbers are shown in Indian format', () => {
  assert.equal(formatPhone('919315559736'), '+91 93155 59736');
});
