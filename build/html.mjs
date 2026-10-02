// Tiny escaping template tag. Interpolated strings are escaped; values made
// with raw() (and nested html`` results) are inserted as-is.
class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}

export const raw = (s) => new Raw(String(s));

export const escape = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const value = (v) => {
  if (v === null || v === undefined || v === false) return '';
  if (Array.isArray(v)) return v.map(value).join('');
  if (v instanceof Raw) return v.s;
  return escape(v);
};

export const html = (strings, ...values) =>
  raw(strings.reduce((out, s, i) => out + s + (i < values.length ? value(values[i]) : ''), ''));

// JSON for <script type="application/ld+json"> and data blocks: escape "<" so
// no string can close the script element.
export const json = (data) => raw(JSON.stringify(data).replace(/</g, '\\u003c'));
