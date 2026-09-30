import { raw } from './html.mjs';

// Small inline SVG flags. Emoji flags are avoided because Windows renders
// them as two letters. No ids or clip-paths, so repeating one on a page is
// safe. Always decorative: the language name next to it is the label.
const FLAGS = {
  gb: '<svg viewBox="0 0 60 30"><rect width="60" height="30" fill="#012169"/><path d="M0 0l60 30M60 0L0 30" stroke="#fff" stroke-width="6"/><path d="M0 0l60 30M60 0L0 30" stroke="#C8102E" stroke-width="2"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#C8102E" stroke-width="6"/></svg>',
  th: '<svg viewBox="0 0 9 6"><rect width="9" height="6" fill="#A51931"/><rect y="1" width="9" height="4" fill="#F4F5F8"/><rect y="2" width="9" height="2" fill="#2D2A4A"/></svg>',
  in: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#fff"/><rect width="30" height="6.67" fill="#FF9933"/><rect y="13.33" width="30" height="6.67" fill="#138808"/><circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" stroke-width="0.6"/><circle cx="15" cy="10" r="0.6" fill="#000080"/></svg>',
};

export const flag = (code) =>
  raw(`<span class="flag" aria-hidden="true">${FLAGS[code].replace('<svg ', '<svg width="20" height="14" preserveAspectRatio="none" focusable="false" ')}</span>`);
