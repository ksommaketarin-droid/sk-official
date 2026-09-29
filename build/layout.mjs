import { html, raw, json } from './html.mjs';
import { icon } from './icons.mjs';
import { fill, waLink, formatPhone } from '../src/scripts/shared.js';

const NAV = [
  ['home', ''],
  ['shop', 'shop/'],
  ['story', 'story/'],
  ['contact', 'contact/'],
];

export function languageLinks(ctx, page, cls) {
  return html`<ul class="${cls}" role="list">${ctx.site.languages.map((l) => html`
    <li><a href="${ctx.href(page.path, l.code)}" lang="${l.code}" hreflang="${l.code}"
      ${l.code === ctx.lang ? raw('aria-current="true"') : ''}><span class="lang-name">${l.label}</span></a></li>`)}
  </ul>`;
}

function header(ctx, page) {
  const { t } = ctx;
  const current = ctx.site.languages.find((l) => l.code === ctx.lang);
  return html`
<a class="skip-link" href="#main">${t.nav.skip}</a>
<header class="site-header" data-theme="dark">
  <div class="wrap header-inner">
    <a class="brand" href="${ctx.href('')}">
      <picture><source type="image/avif" srcset="${ctx.brand['mark-96.avif']}"><img src="${ctx.brand['mark-96.png']}" width="48" height="48" alt=""></picture>
      <span class="brand-text"><span class="brand-name">SK Official</span><span class="brand-house">${ctx.site.house}</span></span>
    </a>
    <nav class="site-nav" id="site-nav" aria-label="${t.nav.main}" data-nav>
      <ul role="list">${NAV.map(([key, path]) => html`
        <li><a href="${ctx.href(path)}" ${page.nav === key ? raw('aria-current="page"') : ''}>${t.nav[key]}</a></li>`)}
      </ul>
    </nav>
    <div class="header-actions">
      <details class="lang-menu" data-lang-menu>
        <summary aria-label="${t.nav.language}: ${current.label}">
          ${icon('globe')}<span aria-hidden="true">${current.short}</span>${icon('chevron', 'icon icon-sm')}
        </summary>
        <div class="lang-panel">${languageLinks(ctx, page, 'lang-list')}</div>
      </details>
      <button class="icon-button bag-button" type="button" data-bag-open hidden
        aria-haspopup="dialog" aria-controls="bag" aria-label="${fill(t.nav.bagCount, { n: 0 })}">
        ${icon('bag')}<span class="bag-count" data-bag-count aria-hidden="true">0</span>
      </button>
      <button class="icon-button menu-toggle" type="button" data-menu-toggle hidden
        aria-expanded="false" aria-controls="site-nav" aria-label="${t.nav.menu}"
        data-label-open="${t.nav.menu}" data-label-close="${t.nav.closeMenu}">
        ${icon('menu', 'icon icon-open')}${icon('close', 'icon icon-close')}
      </button>
    </div>
  </div>
</header>`;
}

export function whatsappButtons(ctx, text, { primaryLabel, secondaryLabel, compact = false } = {}) {
  const { t, site } = ctx;
  const [a, b] = site.whatsapp;
  return html`
  <div class="button-row${compact ? ' button-row-compact' : ''}">
    <a class="btn btn-primary" href="${waLink(a.number, text)}" rel="noopener noreferrer" data-wa="line1">
      ${icon('chat')}<span>${primaryLabel ?? t.contact.chat}</span></a>
    <a class="btn btn-secondary" href="${waLink(b.number, text)}" rel="noopener noreferrer" data-wa="line2">
      ${icon('chat')}<span>${secondaryLabel ?? t.contact.line2}</span></a>
  </div>`;
}

function footer(ctx, page) {
  const { t, site, data } = ctx;
  return html`
<footer class="site-footer" data-theme="dark">
  <div class="footer-glow" aria-hidden="true"></div>
  <div class="wrap footer-grid">
    <div class="footer-brand">
      <a class="brand brand-lg" href="${ctx.href('')}">
        <img src="${ctx.brand['mark-240.png']}" width="72" height="72" alt="" loading="lazy">
        <span class="brand-text"><span class="brand-name">SK Official</span><span class="brand-house">${site.house}</span></span>
      </a>
      <p>${t.footer.about}</p>
      <p class="footer-tagline">${t.tagline}</p>
    </div>
    <nav aria-labelledby="f-explore">
      <h2 class="footer-heading" id="f-explore">${t.footer.explore}</h2>
      <ul role="list">${NAV.map(([key, path]) => html`<li><a href="${ctx.href(path)}">${t.nav[key]}</a></li>`)}</ul>
    </nav>
    <nav aria-labelledby="f-shop">
      <h2 class="footer-heading" id="f-shop">${t.footer.shopBy}</h2>
      <ul role="list">${data.categories.map((c) => html`<li><a href="${ctx.href('shop/')}?c=${c.id}">${c.name[ctx.lang]}</a></li>`)}</ul>
    </nav>
    <div>
      <h2 class="footer-heading">${t.footer.reach}</h2>
      <ul role="list" class="footer-contact">${site.whatsapp.map((w, i) => html`
        <li><a href="${waLink(w.number)}" rel="noopener noreferrer">${icon('chat', 'icon icon-sm')}<span>${formatPhone(w.number)}</span></a>
          <span class="footer-note">${i === 0 ? t.contact.line1 : t.contact.line2}</span></li>`)}
      </ul>
      <h2 class="footer-heading">${t.footer.payments}</h2>
      <ul role="list" class="pay-badges">
        <li>${icon('upi', 'icon icon-sm')} UPI</li>
        <li>${icon('cash', 'icon icon-sm')} ${t.product.cash}</li>
      </ul>
    </div>
  </div>
  <div class="wrap footer-bottom">
    <p>${fill(t.footer.rights, { year: site.year })}</p>
    <nav class="footer-langs" aria-label="${t.nav.language}">
      ${icon('globe', 'icon icon-sm')}${languageLinks(ctx, page, 'lang-inline')}
    </nav>
    <a class="to-top" href="#top">${icon('up', 'icon icon-sm')}<span>${t.footer.top}</span></a>
  </div>
</footer>`;
}

function bagDialog(ctx) {
  const { t } = ctx;
  return html`
<dialog class="bag" id="bag" aria-labelledby="bag-title" data-bag>
  <div class="bag-inner" data-theme="light">
    <div class="bag-head">
      <h2 id="bag-title">${t.bag.title}</h2>
      <button class="icon-button" type="button" data-bag-close aria-label="${t.bag.close}">${icon('close')}</button>
    </div>
    <div class="bag-empty" data-bag-empty>
      <p>${t.bag.empty}</p>
      <a class="btn btn-secondary" href="${ctx.href('shop/')}">${t.bag.browse}</a>
    </div>
    <ul class="bag-items" role="list" data-bag-items></ul>
    <form class="bag-form" data-bag-form hidden>
      <div class="bag-total">
        <span>${t.bag.subtotal}</span><output data-bag-subtotal aria-live="polite">₹0</output>
      </div>
      <p class="bag-unpriced" data-bag-unpriced hidden></p>
      ${paymentFieldset(ctx, 'bag')}
      <div class="field">
        <label for="bag-name">${t.bag.name}</label>
        <input id="bag-name" name="name" type="text" autocomplete="name" maxlength="60">
      </div>
      <div class="field">
        <label for="bag-note">${t.bag.note}</label>
        <textarea id="bag-note" name="note" rows="2" maxlength="300"></textarea>
      </div>
      ${whatsappButtons(ctx, '', { primaryLabel: t.bag.send, secondaryLabel: t.product.orderAlt })}
      <button class="link-button" type="button" data-bag-clear>${t.bag.clear}</button>
    </form>
  </div>
</dialog>`;
}

export function paymentFieldset(ctx, id) {
  const { t } = ctx;
  return html`
  <fieldset class="choice-group pay-choice">
    <legend>${t.product.payment}</legend>
    <label class="choice">
      <input type="radio" name="payment" value="upi" checked>
      <span class="choice-body">${icon('upi')}<span><strong>${t.product.upi}</strong><small>${t.product.upiHint}</small></span></span>
    </label>
    <label class="choice">
      <input type="radio" name="payment" value="cash">
      <span class="choice-body">${icon('cash')}<span><strong>${t.product.cash}</strong><small>${t.product.cashHint}</small></span></span>
    </label>
  </fieldset>`;
}

// Strings and catalogue the client script needs, embedded as inert JSON.
function clientData(ctx) {
  const { t, lang, data, site } = ctx;
  return {
    lang,
    wa: site.whatsapp.map((w) => w.number),
    upi: site.upi,
    t: { msg: t.msg, bag: t.bag, nav: t.nav, pay: t.pay, product: { added: t.product.added, upi: t.product.upi, cash: t.product.cash, designN: t.product.designN, decrease: t.product.decrease, increase: t.product.increase }, shop: { count: t.shop.count, countOne: t.shop.countOne } },
    products: Object.fromEntries(data.products.map((p) => [p.id, {
      name: p.name, amount: typeof p.price?.amount === 'number' ? p.price.amount : null,
      url: ctx.href(`shop/${p.id}/`), thumb: ctx.thumbs[p.id], designs: p.pickDesign ? p.images.length : 0,
    }])),
  };
}

export function layout(ctx, page) {
  const { t, site, lang } = ctx;
  const canonical = ctx.abs(page.path);
  const og = page.ogImage ?? ctx.abs(ctx.brand['og.jpg'], null);
  const fonts = ctx.fonts.preload[lang] ?? [];
  return '<!doctype html>\n' + html`<html lang="${lang}" dir="ltr" data-theme="${page.theme}" id="top">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${raw(ctx.csp.meta)}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${page.title}</title>
<meta name="description" content="${page.description}">
<link rel="canonical" href="${canonical}">
${site.languages.map((l) => html`<link rel="alternate" hreflang="${l.code}" href="${ctx.abs(page.path, l.code)}">\n`)}<link rel="alternate" hreflang="x-default" href="${ctx.abs(page.path, 'en')}">
<meta name="theme-color" content="#15100e">
<meta property="og:type" content="${page.ogType ?? 'website'}">
<meta property="og:site_name" content="SK Official">
<meta property="og:title" content="${page.title}">
<meta property="og:description" content="${page.description}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${og}">
<meta property="og:locale" content="${{ en: 'en_IN', th: 'th_TH', hi: 'hi_IN' }[lang]}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${ctx.root}favicon.png" type="image/png">
<link rel="apple-touch-icon" href="${ctx.root}apple-touch-icon.png">
<link rel="manifest" href="${ctx.root}manifest.webmanifest">
${fonts.map((f) => html`<link rel="preload" href="${f}" as="font" type="font/woff2" crossorigin>\n`)}<link rel="stylesheet" href="${ctx.assets.css}">
<script>${raw(ctx.csp.inline)}</script>
<script type="module" src="${ctx.assets.js}"></script>
${(page.jsonld ?? []).map((d) => html`<script type="application/ld+json">${json(d)}</script>\n`)}</head>
<body class="page-${page.nav ?? 'other'}">
${header(ctx, page)}
<main id="main" tabindex="-1">
${page.body}
</main>
${footer(ctx, page)}
${bagDialog(ctx)}
<div class="toast" role="status" aria-live="polite" data-toast></div>
<script type="application/json" id="app-data">${json(clientData(ctx))}</script>
</body>
</html>
`;
}
