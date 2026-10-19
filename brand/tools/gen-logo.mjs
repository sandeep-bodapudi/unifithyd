// Generates the Unifit.hyd SVG logo set from geometry traced off docs/Light.png
// and Poppins glyph outlines (wordmark + tagline converted to paths).
import fs from 'node:fs';
import path from 'node:path';
import opentype from 'opentype.js';

const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });

const C = { navy: '#12335F', green: '#4AA82A', slate: '#9FB4D3', bg: '#0B1F3F', white: '#FFFFFF' };
const fontDir = path.resolve(import.meta.dirname, '../../node_modules/@fontsource/poppins/files');
const load = (f) => { const b = fs.readFileSync(path.join(fontDir, f)); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const bold = load('poppins-latin-800-italic.woff');
const semi = load('poppins-latin-600-normal.woff');

// ---- Mark: traced from the 1760px artwork, origin at its top-left (723,318). 315 x 379.5
const MARK_W = 315, MARK_H = 379.5;
const markLeft = 'M0 104H105V222A52.5 52.5 0 0 0 157.5 274.5V379.5A157.5 157.5 0 0 1 0 222Z';
const markRight = 'M157.5 379.5V274.5A52.5 52.5 0 0 0 210 222V69L315 0V222A157.5 157.5 0 0 1 157.5 379.5Z';
const mark = (left, right, x = 0, y = 0, s = 1) =>
  `<g transform="translate(${r(x)} ${r(y)}) scale(${r(s, 5)})"><path fill="${left}" d="${markLeft}"/><path fill="${right}" d="${markRight}"/></g>`;

function toD(cmds) { const f = (n) => +n.toFixed(2); return cmds.map(c => c.type === 'M' || c.type === 'L' ? c.type + f(c.x) + ' ' + f(c.y) : c.type === 'Q' ? 'Q' + f(c.x1) + ' ' + f(c.y1) + ' ' + f(c.x) + ' ' + f(c.y) : c.type === 'C' ? 'C' + [c.x1, c.y1, c.x2, c.y2, c.x, c.y].map(f).join(' ') : 'Z').join(''); }
function r(n, d = 2) { return +n.toFixed(d); }

// ---- Text to paths, with per-run colours and tracking
function textRuns(font, runs, size, tracking) {
  let x = 0; const parts = []; let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const { text, fill } of runs) {
    let d = '';
    for (const ch of text) {
      const g = font.charToGlyph(ch);
      const p = g.getPath(x, 0, size);
      const bb = p.getBoundingBox();
      if (bb.x1 < bb.x2) { minX = Math.min(minX, bb.x1); minY = Math.min(minY, bb.y1); maxX = Math.max(maxX, bb.x2); maxY = Math.max(maxY, bb.y2); }
      d += toD(p.commands);
      x += font.getAdvanceWidth(ch, size) + tracking;
    }
    parts.push({ d, fill });
  }
  return { parts, bbox: { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY } };
}
function place(t, x, y, w) { // fit bbox width to w, top-left at (x,y)
  const s = w / t.bbox.w;
  return { svg: `<g transform="translate(${r(x - t.bbox.minX * s)} ${r(y - t.bbox.minY * s)}) scale(${r(s, 5)})">${t.parts.map(p => `<path fill="${p.fill}" d="${p.d}"/>`).join('')}</g>`, h: t.bbox.h * s };
}

const word = (base, accent, tail) => textRuns(bold, [{ text: 'uni', fill: base }, { text: 'fit', fill: accent }, { text: '.hyd', fill: tail }], 200, -6);
function tagline(fill) {
  // "TRAIN • TRANSFORM • THRIVE" with wide tracking; bullets drawn as circles
  const t = textRuns(semi, [{ text: 'TRAIN   TRANSFORM   THRIVE', fill }], 100, 38);
  return t;
}
const doc = (w, h, body, title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r(w)} ${r(h)}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>\n`;
const write = (name, s) => fs.writeFileSync(path.join(OUT, name), s);

const themes = {
  light: { left: C.navy, right: C.green, base: C.navy, accent: C.green, tail: C.navy, tag: C.navy },
  dark: { left: C.white, right: C.green, base: C.white, accent: C.green, tail: C.slate, tag: C.slate },
};

for (const [name, t] of Object.entries(themes)) {
  // Mark only
  write(`unifit-mark-${name}.svg`, doc(MARK_W, MARK_H, mark(t.left, t.right), 'Unifit.hyd'));

  // Wordmark only (1068 wide like the artwork)
  const wm = place(word(t.base, t.accent, t.tail), 0, 0, 1068);
  write(`unifit-wordmark-${name}.svg`, doc(1068, wm.h, wm.svg, 'unifit.hyd'));

  // Stacked full logo: mark, wordmark, tagline (proportions from the artwork)
  const W = 1068, pad = 0;
  const mk = mark(t.left, t.right, (W - MARK_W) / 2, 0);
  const wm2 = place(word(t.base, t.accent, t.tail), 0, MARK_H + 66, W);
  const tg = tagline(t.tag);
  const tgW = 930, tgX = (W - tgW) / 2, tgY = MARK_H + 66 + wm2.h + 52;
  const tgPlaced = place(tg, tgX, tgY, tgW);
  // bullets: centred in the em-space gaps
  const s = tgW / tg.bbox.w; const capH = tgPlaced.h;
  const em = 3 * semi.getAdvanceWidth(' ', 100) + 2 * 38;
  const before = (txt) => [...txt].reduce((a, ch) => a + semi.getAdvanceWidth(ch, 100) + 38, 0);
  const mid = (a, b) => (before(a) - 38 + before(b)) / 2; const b1 = mid('TRAIN', 'TRAIN   '), b2 = mid('TRAIN   TRANSFORM', 'TRAIN   TRANSFORM   ');
  const bx = (v) => tgX + (v - tg.bbox.minX) * s;
  const bullets = [b1, b2].map(v => `<circle cx="${r(bx(v))}" cy="${r(tgY + capH / 2)}" r="${r(capH * 0.17)}" fill="${t.tag}"/>`).join('');
  const H = tgY + capH + 6;
  write(`unifit-logo-stacked-${name}.svg`, doc(W, H, mk + wm2.svg + tgPlaced.svg + bullets, 'Unifit.hyd - Train, Transform, Thrive'));

  // Horizontal lockup for headers: mark left, wordmark right, vertically centred
  const markH = 200, ms = markH / MARK_H, gap = 48;
  const wm3 = word(t.base, t.accent, t.tail); const wmW = 640; const wmH = wm3.bbox.h * wmW / wm3.bbox.w;
  const hW = MARK_W * ms + gap + wmW;
  const wm3p = place(wm3, MARK_W * ms + gap, (markH - wmH) / 2 + 12, wmW);
  write(`unifit-logo-horizontal-${name}.svg`, doc(hW, markH, mark(t.left, t.right, 0, 0, ms) + wm3p.svg, 'Unifit.hyd'));
}

// Single colour mark (inherits CSS color) for icons, watermarks, stamps
write('unifit-mark-mono.svg', doc(MARK_W, MARK_H, mark('currentColor', 'currentColor'), 'Unifit.hyd'));

// App icons: rounded square tile, U at ~55% like the artwork
const tile = (bg, l, rgt, radius, k = 0.48) => { const S = 512, ms = (S * k) / MARK_H; const mw = MARK_W * ms;
  return doc(S, S, `<rect width="${S}" height="${S}" rx="${radius}" fill="${bg}"/>` + mark(l, rgt, (S - mw) / 2 + 6, (S - MARK_H * ms) / 2, ms), 'Unifit.hyd'); };
write('unifit-icon-dark.svg', tile(C.navy, C.white, C.green, 112));
write('unifit-icon-light.svg', tile(C.white, C.navy, C.green, 112));
// Maskable: full bleed, mark inside the 80% safe zone (smaller)
{ const S = 512, ms = (S * 0.4) / MARK_H, mw = MARK_W * ms;
  write('unifit-icon-maskable.svg', doc(S, S, `<rect width="${S}" height="${S}" fill="${C.navy}"/>` + mark(C.white, C.green, (S - mw) / 2 + 5, (S - MARK_H * ms) / 2, ms), 'Unifit.hyd')); }
// Favicon: tighter crop for 16-32px legibility
write('favicon.svg', tile(C.navy, C.white, C.green, 120, 0.62));
console.log('done', fs.readdirSync(OUT));

// PNG icons for the PWA manifest and iOS (written into the web app's public folder)
const sharp = (await import('sharp')).default;
const pub = path.resolve(import.meta.dirname, '../../apps/web/public');
fs.mkdirSync(path.join(pub, 'brand'), { recursive: true });
for (const f of fs.readdirSync(OUT).filter((f) => f.endsWith('.svg'))) fs.copyFileSync(path.join(OUT, f), path.join(pub, 'brand', f));
fs.copyFileSync(path.join(OUT, 'favicon.svg'), path.join(pub, 'favicon.svg'));
const png = (src, size, out) => sharp(path.join(OUT, src), { density: 300 }).resize(size, size).png().toFile(path.join(pub, out));
await png('unifit-icon-dark.svg', 192, 'pwa-192.png');
await png('unifit-icon-dark.svg', 512, 'pwa-512.png');
await png('unifit-icon-maskable.svg', 512, 'pwa-maskable-512.png');
await png('unifit-icon-maskable.svg', 180, 'apple-touch-icon.png');
console.log('icons written to', pub);
