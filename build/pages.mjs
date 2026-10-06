import { html, raw } from './html.mjs';
import { icon } from './icons.mjs';
import { whatsappButtons, paymentFieldset } from './layout.mjs';
import {
  fill, inr, waLink, cardPrice, discount, priceTiers, lowestAmount, priceAmounts, exactAmount, upiLink, isUpiId, formatPhone,
} from '../src/scripts/shared.js';

const CARD_SIZES = '(min-width: 1200px) 270px, (min-width: 900px) 30vw, (min-width: 560px) 45vw, 92vw';

const categoryName = (ctx, id) => ctx.data.categories.find((c) => c.id === id).name[ctx.lang];

// Struck-through MRP and the saving, for products sold below MRP.
function mrpNote(t, p) {
  const d = discount(p.price, p.mrp);
  return d ? html` <s class="mrp"><span class="sr-only">${t.shop.mrp} </span>${inr(d.mrp)}</s> <span class="off">${fill(t.shop.off, { n: d.pct })}</span>` : '';
}

async function productCard(ctx, p, { heading = 'h3' } = {}) {
  const { t, lang } = ctx;
  const img = p.images[0];
  const pic = await ctx.img.picture(img.src, { alt: img.alt[lang], sizes: CARD_SIZES, imgClass: 'card-img' });
  const designs = p.pickDesign && p.images.length > 1 ? fill(t.shop.designs, { n: p.images.length }) : null;
  const low = lowestAmount(p.price);
  return html`
  <li class="product-card" data-category="${p.category}" data-price="${low ?? ''}" data-featured="${p.featured ? 1 : 0}">
    <div class="card-media">${raw(pic)}${designs ? html`<span class="badge">${designs}</span>` : ''}</div>
    <div class="card-body">
      <p class="card-cat">${categoryName(ctx, p.category)}</p>
      ${raw(`<${heading} class="card-title">`)}<a href="${ctx.href(`shop/${p.id}/`)}">${p.name}</a>${raw(`</${heading}>`)}
      <p class="card-price">${cardPrice(p.price, t.shop)}${mrpNote(t, p)}</p>
    </div>
  </li>`;
}

function paymentCards(ctx, { withUpiDetails = true } = {}) {
  const { t } = ctx;
  return html`
  <ul class="pay-cards" role="list">
    <li class="pay-card">
      <span class="pay-icon">${icon('upi')}</span>
      <h3>UPI</h3>
      <p>${t.pay.upiText}</p>
      ${withUpiDetails ? upiDetails(ctx, null) : ''}
    </li>
    <li class="pay-card">
      <span class="pay-icon">${icon('cash')}</span>
      <h3>${t.product.cash}</h3>
      <p>${t.pay.cashText}</p>
    </li>
  </ul>`;
}

// UPI ID with copy button and QR. Falls back to "we share it on WhatsApp"
// until a real UPI ID is configured in src/data/site.json.
function upiDetails(ctx, amount) {
  const { t, site } = ctx;
  if (!isUpiId(site.upi.id)) return html`<p class="upi-pending">${t.pay.upiPending}</p>`;
  const link = upiLink({ id: site.upi.id, payee: site.upi.payee, amount });
  return html`
  <div class="upi-box">
    <div class="upi-qr" role="img" aria-label="${t.pay.scan}">${raw(ctx.upiQr)}</div>
    <div class="upi-meta">
      <p class="upi-label">${t.pay.upiId}</p>
      <p class="upi-id"><code data-upi-id>${site.upi.id}</code>
        <button class="icon-button icon-button-sm" type="button" data-copy="${site.upi.id}" aria-label="${t.pay.copy}">${icon('copy', 'icon icon-sm')}</button></p>
      <p class="upi-scan">${t.pay.scan}</p>
      ${amount ? html`<a class="btn btn-secondary btn-sm upi-app" href="${link}" data-upi-link>${fill(t.pay.payApp, { amount: inr(amount) })}</a>` : ''}
    </div>
  </div>`;
}

function pageHead(ctx, { kicker, title, lead, extra = '' }) {
  return html`
  <section class="page-head">
    <div class="page-head-bg" aria-hidden="true"></div>
    <div class="wrap">
      ${kicker ? html`<p class="eyebrow">${kicker}</p>` : ''}
      <h1>${title}</h1>
      ${lead ? html`<p class="lead">${lead}</p>` : ''}
      ${extra}
    </div>
  </section>`;
}

function breadcrumbs(ctx, items) {
  return html`
  <nav class="breadcrumbs" aria-label="Breadcrumb">
    <ol role="list">${items.map(([label, path], i) => html`<li>${i < items.length - 1
      ? html`<a href="${ctx.href(path)}">${label}</a>` : html`<span aria-current="page">${label}</span>`}</li>`)}</ol>
  </nav>`;
}

const crumbLd = (ctx, items) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: ctx.abs(path) })),
});

// ---------------------------------------------------------------- home

export async function home(ctx) {
  const { t, lang, data } = ctx;
  const featured = data.products;
  const art = await Promise.all([
    ctx.img.picture('products/charcoal.jpg', { alt: '', sizes: '(min-width: 900px) 24vw, 46vw', priority: true }),
    ctx.img.picture('products/watches-4.jpg', { alt: '', sizes: '(min-width: 900px) 16vw, 32vw', loading: 'eager' }),
    ctx.img.picture('products/shoes-7.jpg', { alt: '', sizes: '(min-width: 900px) 16vw, 32vw', loading: 'eager' }),
  ]);
  const mountain = await ctx.img.picture('story/mountain.jpg', { alt: t.story.mountainAlt, sizes: '100vw', imgClass: 'band-img' });
  const cards = await Promise.all(featured.map((p) => productCard(ctx, p)));

  const body = html`
  <section class="hero" data-theme="hero" aria-labelledby="hero-title">
    <div class="hero-bg" aria-hidden="true"><span class="hero-ring"></span><span class="hero-ring hero-ring-2"></span></div>
    <div class="wrap hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">${icon('sparkle', 'icon icon-sm')} ${t.house}</p>
        <h1 id="hero-title">${t.home.heroTitle}</h1>
        <p class="lead">${t.home.heroLead}</p>
        <div class="button-row">
          <a class="btn btn-primary btn-lg" href="${ctx.href('shop/')}">${t.home.ctaShop}${icon('arrowRight')}</a>
          <a class="btn btn-ghost btn-lg" href="${ctx.href('story/')}">${t.home.ctaStory}</a>
        </div>
        <ul class="hero-pay" role="list">
          <li>${icon('chat', 'icon icon-sm')} WhatsApp</li>
          <li>${icon('upi', 'icon icon-sm')} UPI</li>
          <li>${icon('cash', 'icon icon-sm')} ${t.product.cash}</li>
        </ul>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="arch arch-main" data-depth="1">${raw(art[0])}</div>
        <div class="arch arch-side arch-a" data-depth="2">${raw(art[1])}</div>
        <div class="arch arch-side arch-b" data-depth="3">${raw(art[2])}</div>
        <span class="hero-monogram">K</span>
      </div>
    </div>
  </section>

  <section class="section" aria-labelledby="featured-title">
    <div class="wrap">
      <div class="section-head">
        <div>
          <p class="eyebrow">${t.nav.shop}</p>
          <h2 id="featured-title">${t.home.featuredTitle}</h2>
          <p class="section-lead">${t.home.featuredLead}</p>
        </div>
        <a class="btn btn-secondary" href="${ctx.href('shop/')}">${t.home.viewAll}${icon('arrowRight')}</a>
      </div>
      <ul class="product-grid" role="list">${cards}</ul>
    </div>
  </section>

  <section class="band" aria-labelledby="band-title">
    <div class="band-media">${raw(mountain)}</div>
    <div class="wrap band-content reveal">
      <p class="eyebrow">${t.story.kicker}</p>
      <h2 id="band-title">${t.home.storyTitle}</h2>
      ${t.home.storyLead.map((p) => html`<p>${p}</p>`)}
      <div class="button-row">
        <a class="btn btn-primary" href="${ctx.href('story/ep01/')}">${t.home.storyCta}${icon('arrowRight')}</a>
        <a class="btn btn-ghost" href="${ctx.href('story/')}">${t.story.all}</a>
      </div>
    </div>
  </section>

  <section class="section" aria-labelledby="how-title">
    <div class="wrap">
      <div class="section-head section-head-center">
        <div>
          <h2 id="how-title">${t.home.howTitle}</h2>
          <p class="section-lead">${t.home.howLead}</p>
        </div>
      </div>
      <ol class="steps" role="list">${t.home.steps.map((s, i) => html`
        <li class="step reveal"><span class="step-num" aria-hidden="true">0${i + 1}</span><h3>${s.title}</h3><p>${s.text}</p></li>`)}
      </ol>
      <h3 class="subhead" id="pay-title">${t.pay.title}</h3>
      ${paymentCards(ctx)}
    </div>
  </section>

  <section class="section section-tint" aria-labelledby="pillars-title">
    <div class="wrap">
      <h2 id="pillars-title" class="center">${t.home.pillarsTitle}</h2>
      <ul class="pillars" role="list">${t.home.pillars.map((p, i) => html`
        <li class="pillar reveal"><span class="pillar-num" aria-hidden="true">${['I', 'II', 'III'][i]}</span><h3>${p.title}</h3><p>${p.text}</p></li>`)}
      </ul>
    </div>
  </section>

  ${contactBand(ctx)}`;

  return {
    path: '', nav: 'home', theme: 'home', title: t.home.title, description: t.home.description, body,
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'WebSite', name: ctx.site.name, url: ctx.abs(''), inLanguage: lang },
      orgLd(ctx),
    ],
  };
}

function orgLd(ctx) {
  return {
    '@context': 'https://schema.org', '@type': 'OnlineStore', name: ctx.site.name,
    url: ctx.abs('', 'en'), logo: ctx.abs(ctx.brand['icon-512.png'], null), currenciesAccepted: 'INR', paymentAccepted: 'UPI, Cash',
    contactPoint: ctx.site.whatsapp.map((w) => ({ '@type': 'ContactPoint', telephone: formatPhone(w.number), contactType: 'customer service', availableLanguage: ['English', 'Thai', 'Hindi'] })),
  };
}

function contactBand(ctx) {
  const { t } = ctx;
  return html`
  <section class="cta-band" data-theme="contact" aria-labelledby="cta-title">
    <div class="wrap cta-inner reveal">
      <div>
        <h2 id="cta-title">${t.contact.title}</h2>
        <p>${t.contact.lead}</p>
      </div>
      ${whatsappButtons(ctx, t.msg.hello, { primaryLabel: t.contact.line1 })}
    </div>
  </section>`;
}

// ---------------------------------------------------------------- shop

export async function shop(ctx) {
  const { t, data } = ctx;
  const cards = await Promise.all(data.products.map((p) => productCard(ctx, p, { heading: 'h2' })));
  const body = html`
  ${pageHead(ctx, { kicker: t.house, title: t.shop.title, lead: t.shop.lead })}
  <section class="section section-tight" aria-label="${t.shop.title}">
    <div class="wrap">
      <div class="toolbar" data-shop-toolbar>
        <div class="filters" role="group" aria-label="${t.shop.filterLabel}">
          <button type="button" class="chip" aria-pressed="true" data-filter="all">${t.shop.all}</button>
          ${data.categories.map((c) => html`<button type="button" class="chip" aria-pressed="false" data-filter="${c.id}">${c.name[ctx.lang]}</button>`)}
        </div>
        <div class="sort">
          <label for="sort">${t.shop.sortLabel}</label>
          <select id="sort" data-sort>
            <option value="featured">${t.shop.sortFeatured}</option>
            <option value="low">${t.shop.sortLow}</option>
            <option value="high">${t.shop.sortHigh}</option>
          </select>
        </div>
      </div>
      <p class="result-count" data-count aria-live="polite">${fill(t.shop.count, { n: data.products.length })}</p>
      <ul class="product-grid product-grid-wide" role="list" data-grid>${cards}</ul>
      <p class="empty-note" data-empty hidden>${t.shop.none}</p>
    </div>
  </section>
  <section class="section section-tint" aria-labelledby="pay-title">
    <div class="wrap">
      <h2 id="pay-title">${t.pay.title}</h2>
      <p class="section-lead">${t.pay.lead}</p>
      ${paymentCards(ctx)}
    </div>
  </section>`;
  return {
    path: 'shop/', nav: 'shop', theme: 'shop', title: t.shop.metaTitle, description: t.shop.description, body,
    jsonld: [{
      '@context': 'https://schema.org', '@type': 'ItemList',
      itemListElement: data.products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: ctx.abs(`shop/${p.id}/`), name: p.name })),
    }],
  };
}

// ---------------------------------------------------------------- product

export async function product(ctx, p) {
  const { t, lang, data, site } = ctx;
  const n = p.images.length;
  const slides = await Promise.all(p.images.map((im, i) => ctx.img.picture(im.src, {
    alt: im.alt[lang], sizes: '(min-width: 1000px) 560px, 94vw', imgClass: 'slide-img', priority: i === 0, loading: i === 0 ? 'eager' : 'lazy',
  })));
  const thumbs = n > 1 ? await Promise.all(p.images.map((im) => ctx.img.picture(im.src, { alt: '', sizes: '88px' }))) : [];
  const related = data.products.filter((x) => x.id !== p.id && x.category === p.category)
    .concat(data.products.filter((x) => x.id !== p.id && x.category !== p.category && x.featured)).slice(0, 3);
  const relatedCards = await Promise.all(related.map((x) => productCard(ctx, x)));
  const exact = exactAmount(p.price);
  const tiers = priceTiers(p.price, lang, t.shop);
  const crumbs = [[t.nav.home, ''], [t.nav.shop, 'shop/'], [p.name, `shop/${p.id}/`]];
  const interest = fill(t.msg.interest, { name: p.name });

  const body = html`
  <div class="wrap">${breadcrumbs(ctx, crumbs)}</div>
  <section class="product" aria-labelledby="product-title">
    <div class="wrap product-grid-layout">
      <div class="gallery" data-gallery>
        <div class="gallery-viewport" role="region" aria-roledescription="carousel" aria-label="${fill(t.product.gallery, { name: p.name })}" tabindex="0" data-gallery-track>
          ${slides.map((s, i) => html`<figure class="slide" id="photo-${i + 1}" role="group" aria-roledescription="slide" aria-label="${fill(t.product.photo, { n: i + 1, m: n })}">${raw(s)}</figure>`)}
        </div>
        ${n > 1 ? html`
        <div class="gallery-nav">
          <button class="icon-button" type="button" data-gallery-prev aria-label="${t.product.prevPhoto}" hidden>${icon('arrowLeft')}</button>
          <ul class="thumbs" role="list">${thumbs.map((th, i) => html`
            <li><a class="thumb" href="#photo-${i + 1}" data-thumb="${i}" aria-label="${fill(t.product.showPhoto, { n: i + 1 })}" ${i === 0 ? raw('aria-current="true"') : ''}>${raw(th)}</a></li>`)}
          </ul>
          <button class="icon-button" type="button" data-gallery-next aria-label="${t.product.nextPhoto}" hidden>${icon('arrowRight')}</button>
        </div>` : ''}
      </div>

      <div class="product-info">
        <p class="eyebrow"><a href="${ctx.href('shop/')}?c=${p.category}">${categoryName(ctx, p.category)}</a></p>
        <h1 id="product-title">${p.name}</h1>
        <dl class="price-list">${tiers.map((tier) => html`
          <div class="price-row">${tier.label ? html`<dt>${tier.label}</dt>` : html`<dt class="sr-only">${t.product.total}</dt>`}<dd>${tier.value}${exact !== null ? mrpNote(t, p) : ''}</dd></div>`)}
        </dl>
        <p class="product-summary">${p.summary[lang]}</p>

        <form class="order" data-order="${p.id}" data-amount="${exact ?? ''}" novalidate>
          ${p.pickDesign && n > 1 ? html`
          <fieldset class="choice-group design-choice">
            <legend>${t.product.design}</legend>
            <p class="hint" id="design-hint">${t.product.designHint}</p>
            <div class="design-options">${thumbs.map((th, i) => html`
              <label class="design">
                <input type="radio" name="design" value="${i + 1}" ${i === 0 ? raw('checked') : ''} aria-describedby="design-hint">
                <span class="design-body">${raw(th)}<span>${fill(t.product.designN, { n: i + 1 })}</span></span>
              </label>`)}
            </div>
          </fieldset>` : ''}

          <div class="qty">
            <label for="qty">${t.product.quantity}</label>
            <div class="qty-control">
              <button class="icon-button icon-button-sm" type="button" data-qty="-1" aria-label="${t.product.decrease}" aria-controls="qty">${icon('minus', 'icon icon-sm')}</button>
              <input id="qty" name="qty" type="number" inputmode="numeric" min="1" max="20" value="1">
              <button class="icon-button icon-button-sm" type="button" data-qty="1" aria-label="${t.product.increase}" aria-controls="qty">${icon('plus', 'icon icon-sm')}</button>
            </div>
          </div>

          ${paymentFieldset(ctx, 'product')}
          <div class="upi-panel" data-upi-panel>${upiDetails(ctx, exact)}</div>

          <div class="order-total">
            ${exact !== null
              ? html`<span>${t.product.total}</span><output data-total aria-live="polite">${inr(exact)}</output>`
              : html`<p class="hint">${t.product.priceConfirm}</p>`}
          </div>

          <div class="order-actions">
            <a class="btn btn-primary btn-lg btn-block" href="${waLink(site.whatsapp[0].number, interest)}" rel="noopener noreferrer" data-wa="line1">${icon('chat')}<span>${t.product.order}</span></a>
            <button class="btn btn-secondary btn-lg btn-block" type="button" data-add hidden>${icon('bag')}<span>${t.product.addToBag}</span></button>
            <a class="text-link" href="${waLink(site.whatsapp[1].number, interest)}" rel="noopener noreferrer" data-wa="line2">${t.product.orderAlt} · ${formatPhone(site.whatsapp[1].number)}</a>
          </div>
        </form>

        <div class="details">
          <h2>${t.product.details}</h2>
          <ul role="list">${t.product.detailsList.map((d) => html`<li>${d}</li>`)}</ul>
        </div>
      </div>
    </div>
  </section>

  ${related.length ? html`
  <section class="section section-tint" aria-labelledby="related-title">
    <div class="wrap">
      <h2 id="related-title">${t.product.related}</h2>
      <ul class="product-grid" role="list">${relatedCards}</ul>
      <p><a class="text-link" href="${ctx.href('shop/')}">${icon('arrowLeft', 'icon icon-sm')} ${t.product.back}</a></p>
    </div>
  </section>` : ''}`;

  const all = priceAmounts(p.price);
  const offers = exact !== null
    ? { '@type': 'Offer', price: exact, priceCurrency: 'INR', availability: 'https://schema.org/InStock', url: ctx.abs(`shop/${p.id}/`) }
    : all.length
      ? { '@type': 'AggregateOffer', lowPrice: all[0], highPrice: all.at(-1), priceCurrency: 'INR', availability: 'https://schema.org/InStock' }
      : undefined;
  return {
    path: `shop/${p.id}/`, nav: 'shop', theme: 'shop', ogType: 'product',
    title: fill(t.product.metaTitle, { name: p.name }),
    description: `${p.summary[lang]} ${cardPrice(p.price, t.shop)}.`,
    ogImage: ctx.abs(await ctx.img.src(p.images[0].src, 1200), null),
    body,
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: p.summary[lang], category: categoryName(ctx, p.category),
        brand: { '@type': 'Brand', name: ctx.site.name }, image: await Promise.all(p.images.map(async (im) => ctx.abs(await ctx.img.src(im.src, 1200), null))),
        ...(offers ? { offers } : {}) },
      crumbLd(ctx, crumbs),
    ],
  };
}

// ---------------------------------------------------------------- story

export async function story(ctx) {
  const { t, data } = ctx;
  const mountain = await ctx.img.picture('story/mountain.jpg', { alt: t.story.mountainAlt, sizes: '100vw', imgClass: 'band-img', priority: true });
  const portrait = await ctx.img.picture('story/portrait.jpg', { alt: t.story.portraitAlt, sizes: '(min-width: 900px) 380px, 80vw' });
  const body = html`
  <section class="story-hero" aria-labelledby="story-title">
    <div class="band-media">${raw(mountain)}</div>
    <div class="wrap story-hero-content">
      <p class="eyebrow">${t.story.kicker}</p>
      <h1 id="story-title">${t.story.title}</h1>
      <p class="lead">${t.story.lead[0]}</p>
    </div>
  </section>
  <section class="section">
    <div class="wrap story-intro">
      <figure class="portrait reveal">${raw(portrait)}</figure>
      <div class="story-intro-text">
        ${t.story.lead.slice(1).map((p) => html`<p class="big-quote">${p}</p>`)}
        <a class="btn btn-primary" href="${ctx.href('story/ep01/')}">${t.home.storyCta}${icon('arrowRight')}</a>
      </div>
    </div>
  </section>
  <section class="section section-tint" aria-labelledby="episodes-title">
    <div class="wrap">
      <h2 id="episodes-title">${t.story.episodes}</h2>
      <ol class="timeline" role="list">${data.episodes.map((ep, i) => html`
        <li class="timeline-item reveal">
          <span class="timeline-num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
          <div class="timeline-body">
            <p class="card-cat">${fill(t.story.episode, { n: i + 1 })} · ${fill(t.story.minutes, { n: ctx.readingTime(ep.id) })}</p>
            <h3><a href="${ctx.href(`story/${ep.id}/`)}">${ep.title[ctx.lang]}</a></h3>
            <p>${ep.teaser[ctx.lang]}</p>
          </div>
          ${icon('arrowRight', 'icon timeline-arrow')}
        </li>`)}
      </ol>
    </div>
  </section>`;
  return { path: 'story/', nav: 'story', theme: 'story', title: t.story.metaTitle, description: t.story.description, body };
}

export async function episode(ctx, ep, index) {
  const { t, lang, data } = ctx;
  const n = index + 1;
  const prev = data.episodes[index - 1];
  const next = data.episodes[index + 1];
  const paragraphs = ctx.episodeText(ep.id, lang);
  const title = `EP.${String(n).padStart(2, '0')} · ${ep.title[lang]}`;
  const translated = ep.original !== lang;
  const crumbs = [[t.nav.home, ''], [t.nav.story, 'story/'], [ep.title[lang], `story/${ep.id}/`]];

  const body = html`
  <div class="progress" aria-hidden="true"></div>
  <article class="episode" aria-labelledby="ep-title">
    <header class="episode-head">
      <div class="wrap wrap-narrow">
        ${breadcrumbs(ctx, crumbs)}
        <p class="eyebrow">${fill(t.story.episode, { n })} · ${fill(t.story.minutes, { n: ctx.readingTime(ep.id) })}</p>
        <h1 id="ep-title">${ep.title[lang]}</h1>
        <p class="lead">${ep.teaser[lang]}</p>
        ${translated ? html`<p class="translation-note">${fill(t.story.translated, { lang: t.langName[ep.original] })}
          <a href="${ctx.href(`story/${ep.id}/`, ep.original)}" lang="${ep.original}" hreflang="${ep.original}">${ctx.dict[ep.original].story.readOriginal}</a></p>` : ''}
      </div>
    </header>
    <div class="wrap wrap-narrow prose">
      ${paragraphs.map((p) => html`<p>${p}</p>`)}
      ${next ? '' : html`<p class="prose-end">${t.story.end}</p>`}
    </div>
    <nav class="wrap wrap-narrow episode-nav" aria-label="${t.story.episodes}">
      ${prev ? html`<a class="episode-link" href="${ctx.href(`story/${prev.id}/`)}" rel="prev">
        <span class="episode-dir">${icon('arrowLeft', 'icon icon-sm')} ${t.story.prev}</span><span class="episode-name">${prev.title[lang]}</span></a>` : html`<span></span>`}
      ${next ? html`<a class="episode-link episode-link-next" href="${ctx.href(`story/${next.id}/`)}" rel="next">
        <span class="episode-dir">${t.story.next} ${icon('arrowRight', 'icon icon-sm')}</span><span class="episode-name">${next.title[lang]}</span></a>`
        : html`<a class="episode-link episode-link-next" href="${ctx.href('shop/')}"><span class="episode-dir">${t.nav.shop} ${icon('arrowRight', 'icon icon-sm')}</span><span class="episode-name">${t.home.ctaShop}</span></a>`}
    </nav>
    <p class="wrap wrap-narrow center"><a class="text-link" href="${ctx.href('story/')}">${t.story.all}</a></p>
  </article>`;
  return {
    path: `story/${ep.id}/`, nav: 'story', theme: 'story', ogType: 'article',
    title: `${title} · ${ctx.site.name}`, description: ep.teaser[lang], body,
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'Article', headline: ep.title[lang], description: ep.teaser[lang], inLanguage: lang,
        isPartOf: { '@type': 'CreativeWorkSeries', name: t.story.title }, position: n,
        author: { '@type': 'Organization', name: ctx.site.name }, publisher: { '@type': 'Organization', name: ctx.site.name },
        ...(translated ? { translationOfWork: { '@type': 'Article', url: ctx.abs(`story/${ep.id}/`, ep.original), inLanguage: ep.original } } : {}) },
      crumbLd(ctx, crumbs),
    ],
  };
}

// ---------------------------------------------------------------- contact

export async function contact(ctx) {
  const { t, site } = ctx;
  const body = html`
  ${pageHead(ctx, { kicker: t.house, title: t.contact.title, lead: t.contact.lead })}
  <section class="section section-tight" aria-label="WhatsApp">
    <div class="wrap">
      <ul class="contact-cards" role="list">${site.whatsapp.map((w, i) => html`
        <li class="contact-card reveal">
          <span class="pay-icon">${icon('chat')}</span>
          <h2>${i === 0 ? t.contact.line1 : t.contact.line2}</h2>
          <p class="contact-number">${formatPhone(w.number)}</p>
          <div class="button-row button-row-compact">
            <a class="btn ${i === 0 ? 'btn-primary' : 'btn-secondary'}" href="${waLink(w.number, t.msg.hello)}" rel="noopener noreferrer">${icon('chat')}<span>${t.contact.chat}</span></a>
            <a class="btn btn-ghost" href="tel:+${w.number}">${icon('phone')}<span>${fill(t.contact.call, { number: formatPhone(w.number) })}</span></a>
          </div>
        </li>`)}
      </ul>
    </div>
  </section>
  <section class="section section-tint" aria-labelledby="pay-title">
    <div class="wrap">
      <h2 id="pay-title">${t.pay.title}</h2>
      <p class="section-lead">${t.pay.lead}</p>
      ${paymentCards(ctx)}
    </div>
  </section>
  <section class="section" aria-labelledby="faq-title">
    <div class="wrap wrap-narrow">
      <h2 id="faq-title">${t.contact.faqTitle}</h2>
      <div class="faq">${t.contact.faq.map((f) => html`
        <details class="faq-item"><summary><h3>${f.q}</h3>${icon('plus', 'icon faq-icon')}</summary><p>${f.a}</p></details>`)}
      </div>
    </div>
  </section>`;
  return {
    path: 'contact/', nav: 'contact', theme: 'contact', title: t.contact.metaTitle, description: t.contact.description, body,
    jsonld: [
      orgLd(ctx),
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: t.contact.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    ],
  };
}

// ---------------------------------------------------------------- 404

export async function notFound(ctx) {
  const { t } = ctx;
  const body = html`
  ${pageHead(ctx, { kicker: '404', title: t.notFound.title, lead: t.notFound.lead,
    extra: html`<div class="button-row"><a class="btn btn-primary" href="${ctx.href('')}">${t.notFound.home}</a><a class="btn btn-secondary" href="${ctx.href('shop/')}">${t.nav.shop}</a></div>` })}`;
  return { path: '404.html', nav: null, theme: 'contact', title: `${t.notFound.title} · ${ctx.site.name}`, description: t.notFound.lead, body, noindex: true };
}
