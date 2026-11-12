/**
 * Renders this profile: README.md and every image in assets/.
 *
 *     cd render && npm ci && node render.mjs
 *
 * Everything the README says comes from `data.json`, which is exported from
 * ridamagrawal.com's own data files (`npm run export:github` in the portfolio
 * repository), along with the project pictures in `work/` and the paper and
 * night-sky textures in `paper/`. Nothing here is a second record of the work.
 * The one input read live is the contribution grid, which is why a workflow
 * re-runs this daily.
 *
 * Since 2026-11-13 the profile is the site's newspaper, top to bottom:
 *
 *   front.svg          The Daily Grind's front page: masthead, the banner
 *                      headline the red pencil corrects, Breaking, Plate II
 *                      and the coffee desk.
 *   grind.svg          The colour supplement's cover and contents.
 *   work-<slug>.svg    One magazine spread per project, in its own colours.
 *   commits.svg        The commit band: a year on GitHub, in GitHub's dark.
 *   head-experience-*  The Experience head, light and dark (the roles under
 *                      it are Markdown, so they stay text).
 *   puzzle.svg         What I reach for: the editor's crossword, solved in
 *                      pencil, its clues filed under the five desks.
 *   writing.svg        The present-day Writing section front, on newsprint.
 *   footer.svg         The night sky the paper's last page tears into.
 *
 * Images are SVG from satori, which sets every glyph as a path. A README image
 * is served through GitHub's proxy and cannot load a web font, so text left as
 * text would fall back to whatever the viewer has installed. For the same
 * reason the textures and pictures travel inside each file as data URIs.
 *
 * The latin subsets these fonts ship have no arrows, stars or bullets, and
 * satori has no fallback font, so those are drawn as shapes.
 */
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import satori from 'satori';
import { getContributions } from './contributions.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const require = createRequire(import.meta.url);

const data = JSON.parse(await readFile(join(here, 'data.json'), 'utf8'));

/* ---------------------------------------------------------------- palette */

/* The paper, from global.css. */
const PAPER = '#ebe2ca';
const INK = '#1f1b16';
const INK_SOFT = '#4a4339';
const INK_FAINT = '#8a8070';
const RED = '#9b2a1c';
const PENCIL = '#38373d';
const SQUARE = '#fbf6e9';

/* The Writing section's present-day newsprint. */
const NEWSPRINT = '#f0eee8';
const NEWS_INK = '#141414';
const NEWS_SOFT = '#4d4a45';
const NEWS_RED = '#b0141c';
const NEWS_RULE = '#d3cfc4';

/* The magazine's desk and its cream, from Magazine.astro. */
const DESK = '#1f1c18';
const CREAM = data.issue.cream;
const SUN = data.issue.sun;
const MAG_INK = data.issue.ink;

/* The commit band: GitHub's own dark theme, as the site sets it. */
const GH_BASE = '#0d1117';
const GH_INK = '#e6edf3';
const GH_MUTED = '#8b949e';
const GH_LINE = '#30363d';
const GH_GREEN = '#39d353';
const LEVEL = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];

/* The night sky, from Footer.astro. */
const NIGHT = '#070912';
const STARLIGHT = '#e8ebf7';
const STAR_SOFT = '#a3a9c9';

const W = 1280;
const PAD = 64;

/* The month and year the magazine's folios carry and the footer's copyright.
   UTC, so the workflow and a local run agree; it changes once a month. */
const now = new Date();
const MONTH_YEAR = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const YEAR = now.getUTCFullYear();

/* ------------------------------------------------------------------ fonts */

const fontFile = (pkg, file) => readFile(join(dirname(require.resolve(`${pkg}/package.json`)), 'files', file));

const FONTS = [
  ['Archivo', 400, 'normal', '@fontsource/archivo', 'archivo-latin-400-normal.woff'],
  ['Archivo', 600, 'normal', '@fontsource/archivo', 'archivo-latin-600-normal.woff'],
  ['Archivo', 700, 'normal', '@fontsource/archivo', 'archivo-latin-700-normal.woff'],
  ['Plex', 400, 'normal', '@fontsource/ibm-plex-mono', 'ibm-plex-mono-latin-400-normal.woff'],
  ['Plex', 500, 'normal', '@fontsource/ibm-plex-mono', 'ibm-plex-mono-latin-500-normal.woff'],
  ['Gothic', 400, 'normal', '@fontsource/league-gothic', 'league-gothic-latin-400-normal.woff'],
  ['Old', 400, 'normal', '@fontsource/old-standard-tt', 'old-standard-tt-latin-400-normal.woff'],
  ['Old', 400, 'italic', '@fontsource/old-standard-tt', 'old-standard-tt-latin-400-italic.woff'],
  ['Old', 700, 'normal', '@fontsource/old-standard-tt', 'old-standard-tt-latin-700-normal.woff'],
  ['Black', 400, 'normal', '@fontsource/unifrakturmaguntia', 'unifrakturmaguntia-latin-400-normal.woff'],
  ['Pencil', 600, 'normal', '@fontsource/caveat', 'caveat-latin-600-normal.woff'],
  ['Fat', 400, 'normal', '@fontsource/abril-fatface', 'abril-fatface-latin-400-normal.woff'],
  ['News', 400, 'normal', '@fontsource/newsreader', 'newsreader-latin-400-normal.woff'],
  ['News', 400, 'italic', '@fontsource/newsreader', 'newsreader-latin-400-italic.woff'],
  ['News', 600, 'normal', '@fontsource/newsreader', 'newsreader-latin-600-normal.woff'],
];
const fonts = await Promise.all(
  FONTS.map(async ([name, weight, style, pkg, file]) => ({ name, weight, style, data: await fontFile(pkg, file) })),
);

/* --------------------------------------------------------------- textures */

const asset = async (file, type) => `data:${type};base64,${(await readFile(join(here, file))).toString('base64')}`;
const TEX = {
  laid: await asset('paper/laid.webp', 'image/webp'),
  foxing: await asset('paper/foxing.webp', 'image/webp'),
  newsprint: await asset('paper/newsprint.webp', 'image/webp'),
  stain: await asset('paper/stain.webp', 'image/webp'),
  starsA: await asset('paper/stars-a.webp', 'image/webp'),
  starsB: await asset('paper/stars-b.webp', 'image/webp'),
  dust: await asset('paper/dust.webp', 'image/webp'),
  dekho: await asset('paper/dekho-front.jpg', 'image/jpeg'),
  plate: await asset('paper/plate-i.webp', 'image/webp'),
};

/* The 1900s paper: laid rag paper, foxing, and a darker edge, as .paper on
   the site. The tiles are made at 2x, so they are drawn at half their size. */
const paperGround = () => ({
  backgroundColor: PAPER,
  backgroundImage: `radial-gradient(circle at 50% 38%, rgba(110, 80, 30, 0) 58%, rgba(110, 80, 30, 0.13) 100%), url(${TEX.foxing}), url(${TEX.laid})`,
  backgroundSize: '100% 100%, 560px 560px, 384px 384px',
  backgroundRepeat: 'no-repeat, repeat, repeat',
});

/* ---------------------------------------------------------------- helpers */

const h = (type, props = {}, ...children) => ({
  type,
  props: { ...props, children: children.flat().filter((c) => c !== null && c !== undefined && c !== false) },
});

/** A flex box. satori requires display:flex on anything with more than one child. */
const box = (style, ...children) => h('div', { style: { display: 'flex', ...style } }, ...children);
const text = (style, value) => h('div', { style: { display: 'flex', ...style } }, value);

const gothic = (size, color, extra = {}) => ({ fontFamily: 'Gothic', fontSize: size, color, textTransform: 'uppercase', lineHeight: 1, ...extra });
const old = (size, color, italic = false, extra = {}) => ({ fontFamily: 'Old', fontSize: size, color, fontStyle: italic ? 'italic' : 'normal', ...extra });
const mono = (size, color, extra = {}) => ({ fontFamily: 'Plex', fontSize: size, color, ...extra });
const caps = (size, color, extra = {}) => mono(size, color, { textTransform: 'uppercase', letterSpacing: '0.14em', ...extra });

const svg = (width, height, viewBox, style, ...children) => h('svg', { width, height, viewBox, style }, ...children);

/** The ✦ the paper sets between items: four points, drawn. */
const star = (size, color, style = {}) =>
  svg(size, size, '0 0 10 10', style, h('path', { d: 'M5 0 L6.1 3.9 L10 5 L6.1 6.1 L5 10 L3.9 6.1 L0 5 L3.9 3.9 Z', fill: color }));

/** A right arrow, drawn: the fonts have none. */
const arrow = (width, color, stroke = 2.4, style = {}) =>
  svg(width, Math.round(width * 0.5), '0 0 24 12', style,
    h('path', { d: 'M1 6 L22 6 M16 1 L22 6 L16 11', fill: 'none', stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' }));

/** A torn edge, as src/lib/tear.ts draws it: seeded, so it tears the same way every run. */
function tearPath(seed, from = 'bottom', points = 72) {
  let s = seed;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pts = [];
  for (let i = 0; i <= points; i++) pts.push(`${((i / points) * 1000).toFixed(1)},${(1 + rand() * 10).toFixed(1)}`);
  const edge = from === 'bottom' ? 12 : 0;
  return `M0,${edge} L${pts.join(' L')} L1000,${edge} Z`;
}

const fmt = (n) => n.toLocaleString('en-US');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const longDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/*
 * The text stays text. satori lays every word out with these fonts and, with
 * `embedFont: false`, writes it as a positioned <text> rather than as glyph
 * outlines; each face the image uses then travels inside it once, as a data
 * URI. An SVG shown as an image may not fetch anything, but a data URI is not
 * a fetch, so the faces load. Set as outlines, the crossword alone was 2.4 MB.
 */
const faceCss = fonts.map((f) => ({
  family: f.name.toLowerCase(),
  css: `@font-face{font-family:${f.name};font-weight:${f.weight};font-style:${f.style};src:url(data:font/woff;base64,${f.data.toString('base64')}) format('woff')}`,
}));
function withFonts(raw) {
  const css = faceCss.filter((f) => raw.includes(`font-family="${f.family}"`)).map((f) => f.css).join('');
  // Word positions are satori's, so the browser must not kern across them.
  return raw.replace(/^(<svg[^>]*>)/, `$1<defs><style>${css}text{font-kerning:none;text-rendering:geometricPrecision}</style></defs>`);
}

const written = new Set();
/** `height` omitted lets satori size the image to its content. */
async function render(name, node, width = W, height) {
  const raw = await satori(node, { width, ...(height ? { height } : {}), fonts, embedFont: false });
  await writeFile(join(root, 'assets', name), withFonts(raw));
  written.add(name);
  return name;
}

/* --------------------------------------------------------- the front page */

async function front() {
  const F = data.front;
  const P = data.paper;
  const head = (size) => gothic(size, INK, { lineHeight: 0.9 });

  const masthead = box(
    { alignItems: 'center', marginTop: 30 },
    box(
      { flexDirection: 'column', width: 118, marginRight: 34, alignItems: 'flex-end' },
      ...F.earLeft.map((l) => text({ ...old(17, INK_SOFT, true), lineHeight: 1.3, textAlign: 'right' }, l)),
    ),
    text({ fontFamily: 'Black', fontSize: 116, color: INK, lineHeight: 1.05 }, P.masthead),
    box(
      { flexDirection: 'column', marginLeft: 34, transform: 'rotate(-4deg)' },
      text(gothic(34, RED, { letterSpacing: '0.02em' }), F.earRight.edition),
      text({ ...old(17, INK_SOFT, true), marginTop: 4 }, F.earRight.note),
    ),
  );

  /* The second line of the banner, with the pencil's ring round the word and
     its note underneath, as the site draws them (index.astro). */
  const ringed = box(
    { position: 'relative', marginLeft: 26, marginRight: 26 },
    text({}, F.headline.ringed),
    svg(150, 122, '0 0 120 110', { position: 'absolute', left: -32, top: -12 },
      h('path', { d: 'M 22 70 C 6 36, 54 6, 96 16 C 122 24, 120 78, 84 98 C 52 112, 10 96, 12 60 C 14 40, 40 22, 70 20', fill: 'none', stroke: RED, strokeWidth: 3.2, strokeLinecap: 'round' })),
    box(
      { position: 'absolute', left: 18, top: 104, alignItems: 'flex-start', width: 320 },
      svg(48, 32, '0 0 60 40', { marginTop: -10 },
        h('path', { d: 'M 56 36 C 40 36, 22 28, 8 8 M 8 8 L 9 20 M 8 8 L 19 11', fill: 'none', stroke: RED, strokeWidth: 2.4, strokeLinecap: 'round' })),
      text({ fontFamily: 'Pencil', fontWeight: 600, fontSize: 30, color: RED, marginLeft: 8, marginTop: 4, transform: 'rotate(-4deg)', textTransform: 'none' }, P.pencilNote),
    ),
  );

  const lead = box(
    { flexDirection: 'column', width: 430, paddingRight: 36 },
    text({ ...old(27, INK, true), lineHeight: 1.36 }, F.deck),
    box({ width: 320, height: 1, background: INK_FAINT, marginTop: 30, marginBottom: 24 }),
    box(
      { alignItems: 'baseline' },
      text(old(20, INK_SOFT), 'By'),
      text({ ...old(20, INK), fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginLeft: 8 }, `${data.name},`),
    ),
    // The struck role, with the new one pencilled in above it.
    box(
      { flexDirection: 'column', marginTop: 54 },
      box(
        { position: 'relative', alignSelf: 'flex-start' },
        text(old(20, INK_FAINT), F.struckRole),
        box({ position: 'absolute', left: -3, right: -3, top: 14, height: 2, background: RED }),
        text({ position: 'absolute', left: 30, top: -50, fontFamily: 'Pencil', fontWeight: 600, fontSize: 29, color: RED, transform: 'rotate(-5deg)' }, P.pencilRole),
      ),
      text({ ...old(20, INK_SOFT, true), marginTop: 6 }, `— ${F.post}`),
    ),
    // Plate II: Dekho's front page, printed in the paper's ink.
    box(
      { flexDirection: 'column', marginTop: 38 },
      box(
        { border: `1px solid ${INK}`, padding: 5, background: '#f4ecd8', alignSelf: 'flex-start' },
        h('img', { src: TEX.dekho, width: 382, height: Math.round(382 * (860 / 1440)) }),
      ),
      box(
        { alignItems: 'baseline', marginTop: 12 },
        text({ ...gothic(18, RED, { letterSpacing: '0.06em' }), marginRight: 9, flexShrink: 0 }, F.plate2.mark),
        text({ ...old(17, INK_SOFT, true), flexShrink: 0 }, F.plate2.caption),
        text({ ...old(17, INK, true), marginLeft: 7, textDecoration: 'underline', flexShrink: 0 }, F.plate2.url),
      ),
    ),
  );

  const breaking = box(
    { flexDirection: 'column', width: 388, paddingLeft: 34, paddingRight: 34, borderLeft: `1px solid ${INK_FAINT}` },
    text(gothic(52, RED, { letterSpacing: '0.01em' }), 'Breaking'),
    ...F.breaking.flatMap((b, i) => [
      i ? box({ justifyContent: 'flex-start', marginTop: 20, marginBottom: 18, paddingLeft: 4 }, star(11, INK_FAINT)) : box({ height: 16 }),
      text({ ...gothic(36, INK), lineHeight: 0.98 }, b.head),
      text({ ...old(18, INK_SOFT), lineHeight: 1.45, marginTop: 10 }, b.body),
    ]),
  );

  // Plate I and the coffee desk: the right-hand column. The plate is the
  // site's own, captured once finished (paper/plate-i.webp): the painted hand
  // and the dotted arm, whose fingertip has warmed to the pencil's red.
  const sideW = 320;
  const side = box(
    { flexDirection: 'column', width: sideW, marginLeft: 22, marginTop: -170 },
    h('img', { src: TEX.plate, width: sideW, height: Math.round(sideW * (270 / 646)) }),
    box(
      { alignItems: 'flex-start', marginTop: 12 },
      text({ ...gothic(18, RED, { letterSpacing: '0.06em' }), marginRight: 9, marginTop: 3, flexShrink: 0 }, F.plate1.mark),
      text({ ...old(16, INK_SOFT, true), lineHeight: 1.45, flexGrow: 1, flexBasis: 0 }, F.plate1.caption),
    ),
    box({ height: 1, background: INK_FAINT, marginTop: 34, marginBottom: 30 }),
    box(
      { alignItems: 'flex-start', justifyContent: 'space-between' },
      box(
        { flexDirection: 'column', width: 210 },
        text(gothic(19, RED, { letterSpacing: '0.08em' }), F.coffee.kicker),
        text({ ...old(29, INK, true), lineHeight: 1.12, marginTop: 10 }, F.coffee.head),
      ),
      cup(100),
    ),
    box(
      { flexDirection: 'column', marginTop: 22, alignSelf: 'flex-start' },
      box({ alignItems: 'center' }, text(gothic(32, RED), F.coffee.cta), arrow(34, RED, 2.4, { marginLeft: 12 })),
      box({ width: 110, height: 3, background: RED, marginTop: 4, borderRadius: 2, transform: 'rotate(-1deg)' }),
    ),
  );

  return render(
    'front.svg',
    box(
      { width: W, flexDirection: 'column', position: 'relative', padding: `26px ${PAD}px 60px`, ...paperGround() },
      // A coffee ring, where a cup was set down on the paper.
      h('img', { src: TEX.stain, width: 260, height: 220, style: { position: 'absolute', right: 300, bottom: 30, opacity: 0.5 } }),

      // The top strip: the name, the price, the address.
      box(
        { alignItems: 'center', justifyContent: 'space-between' },
        box(
          { alignItems: 'center' },
          text({ fontFamily: 'Black', fontSize: 31, color: INK }, data.name),
          box(
            { alignItems: 'center', marginLeft: 38, ...old(17, INK_SOFT, true) },
            text({}, data.location.split(',')[0]),
            star(10, INK_SOFT, { marginLeft: 12, marginRight: 12 }),
            text({}, 'Price: one coffee'),
          ),
        ),
        text(gothic(27, RED, { letterSpacing: '0.04em' }), data.site.replace('https://', '')),
      ),
      box({ height: 3, background: INK, marginTop: 12 }),

      masthead,
      box({ flexDirection: 'column', marginTop: 14, marginLeft: 40 }, box({ height: 3, background: INK }), box({ height: 1, background: INK, marginTop: 3 })),
      text({ ...old(17, INK_SOFT, true), alignSelf: 'flex-end', marginTop: 9, marginRight: 70 }, F.motto),

      text({ ...gothic(22, RED, { letterSpacing: '0.1em' }), marginTop: 26 }, `${F.kicker[0]}   ·   ${F.kicker[1]}`),
      text({ ...head(176), marginTop: 14 }, F.headline.top),
      box(
        { ...head(112), alignItems: 'flex-end', marginLeft: 250, marginTop: 8 },
        text({}, F.headline.before),
        ringed,
        text({}, F.headline.after),
      ),

      box({ marginTop: 92, alignItems: 'flex-start' }, lead, breaking, side),
    ),
  );
}

/** The coffee desk's engraving: an espresso cup in ink line and hatching. */
function cup(size) {
  const ink = { fill: 'none', stroke: INK, strokeWidth: 1.6, strokeLinecap: 'round' };
  const hatch = [];
  for (let x = 34; x <= 84; x += 4.2) {
    const t = (x - 28) / 60;
    const top = 44;
    const bottom = 40 + 44 * Math.sin(Math.PI * Math.min(1, Math.max(0, t))) * 0.98;
    hatch.push(h('path', { d: `M ${x.toFixed(1)} ${top} L ${(x - 2).toFixed(1)} ${bottom.toFixed(1)}`, ...ink, strokeWidth: 0.9 }));
  }
  return svg(size, Math.round(size * 110 / 120), '0 0 120 110', {},
    h('path', { d: 'M 47 31 C 42 24 52 20 47 11', ...ink, strokeWidth: 1.2 }),
    h('path', { d: 'M 59 30 C 54 22 64 17 59 6', ...ink, strokeWidth: 1.2 }),
    h('path', { d: 'M 71 31 C 66 24 76 20 71 13', ...ink, strokeWidth: 1.2 }),
    h('ellipse', { cx: 58, cy: 92, rx: 50, ry: 10, ...ink }),
    h('ellipse', { cx: 58, cy: 90, rx: 31, ry: 5, ...ink }),
    ...hatch,
    h('path', { d: 'M 28 40 C 28 62 38 84 58 86 C 78 84 88 62 88 40', ...ink }),
    h('ellipse', { cx: 58, cy: 40, rx: 30, ry: 6, ...ink }),
    h('ellipse', { cx: 58, cy: 41, rx: 26, ry: 4.2, fill: '#4a3424', stroke: 'none' }),
    h('path', { d: 'M 87 50 C 105 47 107 71 84 73', ...ink }),
    h('path', { d: 'M 86 56 C 97 55 98 67 83 67', ...ink }),
  );
}

/* ------------------------------------------------------------ the magazine */

/** The cover's coffee: a cup in thick ink on the sun. */
const coverCup = (size) =>
  svg(size, size, '0 0 200 200', {},
    ...[[78, 20, 92, 44], [100, 14, 112, 40], [122, 22, 132, 46]].map(([x1, y1, x2, y2]) =>
      h('path', { d: `M ${x1} ${y1 + 30} C ${x1 - 10} ${y1 + 18}, ${x2 + 6} ${y2 - 8}, ${x2 - 4} ${y2 - 30}`, fill: 'none', stroke: MAG_INK, strokeWidth: 4, strokeLinecap: 'round' })),
    h('ellipse', { cx: 104, cy: 168, rx: 92, ry: 18, fill: 'none', stroke: MAG_INK, strokeWidth: 5 }),
    h('ellipse', { cx: 104, cy: 166, rx: 58, ry: 9, fill: 'none', stroke: MAG_INK, strokeWidth: 3 }),
    h('path', { d: 'M 46 86 C 46 126 66 158 104 160 C 142 158 162 126 162 86 Z', fill: CREAM, stroke: MAG_INK, strokeWidth: 5, strokeLinejoin: 'round' }),
    ...Array.from({ length: 9 }, (_, i) => {
      const x = 92 + i * 7;
      return h('path', { d: `M ${x} 92 L ${x - 6} 152`, stroke: MAG_INK, strokeWidth: 2.4, strokeLinecap: 'round' });
    }),
    h('ellipse', { cx: 104, cy: 86, rx: 58, ry: 12, fill: '#3b2a1c', stroke: MAG_INK, strokeWidth: 5 }),
    h('path', { d: 'M 160 98 C 196 92 196 140 154 142', fill: 'none', stroke: MAG_INK, strokeWidth: 5, strokeLinecap: 'round' }),
  );

/** The cover's price-sticker starburst. */
function starburst(size, fill) {
  const pts = [];
  for (let i = 0; i < 28; i++) {
    const r = i % 2 ? 40 : 50;
    const a = (i / 28) * Math.PI * 2;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return svg(size, size, '0 0 100 100', { position: 'absolute', left: 0, top: 0 }, h('path', { d: `M${pts.join(' L')} Z`, fill }));
}

async function grind() {
  const I = data.issue;
  const coverW = 470;
  const coverH = 640;
  const cover = box(
    { width: coverW, height: coverH, position: 'relative', flexDirection: 'column', background: '#b5311d', padding: '26px 30px', overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.45)', transform: 'rotate(1.2deg)' },
    box({ position: 'absolute', right: -90, bottom: 70, width: 360, height: 360, borderRadius: 999, background: SUN }),
    box({ position: 'absolute', right: -14, bottom: 120 }, coverCup(300)),
    box(
      { justifyContent: 'space-between', ...caps(12, CREAM, { letterSpacing: '0.08em' }) },
      text({}, I.strap),
      text({}, MONTH_YEAR),
    ),
    box({ height: 1, background: CREAM, marginTop: 9 }),
    text({ fontFamily: 'Fat', fontSize: 152, color: CREAM, lineHeight: 0.95, marginTop: -2, letterSpacing: '-0.02em' }, I.masthead),
    box(
      { position: 'absolute', left: 266, top: 200, width: 128, height: 128, alignItems: 'center', justifyContent: 'center', transform: 'rotate(-10deg)' },
      starburst(128, CREAM),
      box(
        { flexDirection: 'column', alignItems: 'center' },
        text({ fontFamily: 'Fat', fontSize: 46, color: '#b5311d', lineHeight: 1 }, I.sticker[0]),
        text(gothic(15, MAG_INK, { letterSpacing: '0.06em' }), `${I.sticker[1]} ${I.sticker[2]}`),
      ),
    ),
    box(
      { flexDirection: 'column', marginTop: 64, width: 186 },
      ...I.coverLines.map((l) =>
        box(
          { flexDirection: 'column', marginBottom: 18 },
          text(mono(13, SUN, { fontWeight: 500 }), `p.${l.page}`),
          text({ fontFamily: 'Archivo', fontWeight: 700, fontSize: 19, color: CREAM, lineHeight: 1.15, marginTop: 3 }, l.text),
        ),
      ),
    ),
    box({ flexGrow: 1 }),
    text({ fontFamily: 'Fat', fontSize: 58, color: CREAM, lineHeight: 0.95, width: 380 }, I.headline),
  );

  const contents = box(
    { flexDirection: 'column', marginTop: 40 },
    text(gothic(22, SUN, { letterSpacing: '0.1em' }), 'Contents'),
    box({ height: 1, background: 'rgba(247, 238, 219, 0.35)', marginTop: 12, marginBottom: 6 }),
    ...data.features.map((f) =>
      box(
        { alignItems: 'baseline', paddingTop: 11, paddingBottom: 11, borderBottom: '1px solid rgba(247, 238, 219, 0.14)' },
        text(mono(16, SUN, { fontWeight: 500, width: 44 }), String(f.pages[0])),
        text({ fontFamily: 'Archivo', fontWeight: 700, fontSize: 19, color: CREAM, width: 170 }, f.name),
        text({ ...old(19, 'rgba(247, 238, 219, 0.78)', true) }, f.headline),
      ),
    ),
  );

  return render(
    'grind.svg',
    box(
      { width: W, background: DESK, padding: `70px ${PAD}px 80px`, alignItems: 'flex-start', justifyContent: 'space-between' },
      box(
        { flexDirection: 'column', width: 590 },
        text(gothic(22, SUN, { letterSpacing: '0.1em' }), 'Selected work   ·   Inside this edition'),
        text({ ...gothic(136, CREAM, { lineHeight: 0.88 }), marginTop: 16 }, 'Things I built alone'),
        text({ ...old(21, 'rgba(247, 238, 219, 0.78)', true), lineHeight: 1.5, marginTop: 30 }, I.letter),
        contents,
      ),
      box({ marginTop: 26, marginRight: 14 }, cover),
    ),
  );
}

/* The headline face each feature is set in, as Magazine.astro sets it. */
const HEAD_FACE = {
  masterchef: { fontFamily: 'Fat', fontSize: 70, lineHeight: 1.0 },
  keysignals: { fontFamily: 'Gothic', fontSize: 94, lineHeight: 0.9, textTransform: 'uppercase' },
  phasedesk: { fontFamily: 'Old', fontStyle: 'italic', fontSize: 64, lineHeight: 1.05 },
  'elivate-seo-audit': { fontFamily: 'Gothic', fontSize: 94, lineHeight: 0.9, textTransform: 'uppercase' },
  'easinvy-retail': { fontFamily: 'Fat', fontSize: 70, lineHeight: 1.0 },
  'serp-reader': { fontFamily: 'Gothic', fontSize: 94, lineHeight: 0.9, textTransform: 'uppercase' },
};
/* How each screenshot is printed, from `frame` in magazine.ts. */
const FRAME = {
  masterchef: 'bleed',
  keysignals: 'bleed',
  phasedesk: 'taped',
  'elivate-seo-audit': 'bleed',
  'easinvy-retail': 'framed',
  'serp-reader': 'browser',
};

async function spread(f) {
  const T = f.theme;
  const pageW = W / 2;
  const height = 780;
  const image = f.image ? await asset(f.image, 'image/jpeg') : null;
  const frame = FRAME[f.slug] ?? 'framed';
  const imgW = frame === 'bleed' ? pageW : pageW - 2 * 52;
  // A bled photo is cropped shorter, to leave the headline room.
  const imgH = frame === 'bleed' ? 300 : Math.round(imgW * (545 / 1040));
  const folio = (n, align) =>
    text({ ...mono(13, align === 'left' ? T.fg : MAG_INK, { letterSpacing: '0.06em' }), position: 'absolute', bottom: 26, [align]: 48 }, `${n}   ·   Grind   ·   ${MONTH_YEAR}`);

  let picture = null;
  if (image) {
    const img = h('img', { src: image, width: imgW, height: imgH, style: { objectFit: 'cover' } });
    if (frame === 'bleed') picture = box({ width: imgW, height: imgH }, img);
    if (frame === 'taped')
      picture = box(
        { position: 'relative', marginTop: 50, marginLeft: 52, padding: 9, background: '#fffdf6', boxShadow: '0 10px 24px rgba(0,0,0,0.18)', transform: 'rotate(-1.5deg)', alignSelf: 'flex-start' },
        h('img', { src: image, width: imgW - 18, height: imgH - 10, style: { objectFit: 'cover' } }),
        box({ position: 'absolute', left: -18, top: -12, width: 96, height: 28, background: 'rgba(250, 244, 220, 0.72)', transform: 'rotate(-14deg)' }),
        box({ position: 'absolute', right: -18, top: -10, width: 96, height: 28, background: 'rgba(250, 244, 220, 0.72)', transform: 'rotate(12deg)' }),
      );
    if (frame === 'framed')
      picture = box(
        { marginTop: 50, marginLeft: 52, border: `3px solid ${MAG_INK}`, boxShadow: `12px 12px 0 ${MAG_INK}`, alignSelf: 'flex-start' },
        h('img', { src: image, width: imgW - 6, height: imgH - 6, style: { objectFit: 'cover' } }),
      );
    if (frame === 'browser')
      picture = box(
        { flexDirection: 'column', marginTop: 50, marginLeft: 52, border: `2px solid ${MAG_INK}`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 14px 30px rgba(0,0,0,0.22)', alignSelf: 'flex-start', background: '#fffdf6' },
        box(
          { height: 34, alignItems: 'center', paddingLeft: 14, borderBottom: `2px solid ${MAG_INK}` },
          ...['#e0563f', '#f2b134', '#3fae6b'].map((c) => box({ width: 11, height: 11, borderRadius: 99, background: c, marginRight: 7 })),
          text({ ...mono(13, MAG_INK), marginLeft: 14, padding: '3px 12px', border: `1px solid ${MAG_INK}`, borderRadius: 99 }, f.address),
        ),
        h('img', { src: image, width: imgW - 4, height: imgH - 38, style: { objectFit: 'cover', objectPosition: 'top' } }),
      );
  }

  const label = `${f.section}   ·   ${f.name}`;
  const opener = box(
    { width: pageW, height, flexDirection: 'column', position: 'relative', background: T.bg, overflow: 'hidden' },
    picture,
    box(
      { flexDirection: 'column', padding: frame === 'bleed' ? '0 52px' : '34px 52px 0' },
      frame === 'bleed'
        ? text({ ...caps(14, MAG_INK, { letterSpacing: '0.1em' }), background: SUN, padding: '7px 13px', alignSelf: 'flex-start', marginTop: -18 }, label)
        : text(caps(14, T.accent, { letterSpacing: '0.12em' }), label),
      text({ ...HEAD_FACE[f.slug], color: T.fg, marginTop: frame === 'bleed' ? 26 : 16, width: pageW - 104 }, f.headline),
      text({ ...old(23, T.fg, true), lineHeight: 1.36, marginTop: 20, width: pageW - 120, opacity: 0.94 }, f.standfirst),
    ),
    folio(f.pages[0], 'left'),
  );

  const [first, ...rest] = f.story;
  const story = box(
    { width: pageW, height, flexDirection: 'column', position: 'relative', background: T.tint, padding: '40px 46px 0' },
    box({ position: 'absolute', left: 0, top: 0, width: 54, height, backgroundImage: 'linear-gradient(90deg, rgba(0,0,0,0.16), rgba(0,0,0,0))' }),
    box(
      { justifyContent: 'space-between', ...caps(14, T.deep, { letterSpacing: '0.12em' }) },
      text({}, f.name),
      text({}, f.section),
    ),
    box({ height: 1, background: T.deep, marginTop: 11, marginBottom: 20 }),
    box(
      { alignItems: 'flex-start' },
      text({ fontFamily: 'Fat', fontSize: 82, color: T.deep, lineHeight: 0.82, marginRight: 12, marginTop: 4 }, first[0]),
      text({ fontFamily: 'Archivo', fontSize: 18, color: MAG_INK, lineHeight: 1.5, flexGrow: 1, flexBasis: 0 }, first.slice(1)),
    ),
    ...rest.map((p) => text({ fontFamily: 'Archivo', fontSize: 18, color: MAG_INK, lineHeight: 1.5, marginTop: 12 }, p)),
    f.pull
      ? box(
          { borderTop: `1px solid ${MAG_INK}`, borderBottom: `1px solid ${MAG_INK}`, padding: '14px 0', marginTop: 20 },
          text({ ...old(25, T.deep, true), lineHeight: 1.28 }, f.pull),
        )
      : null,
    f.figures.length
      ? box(
          { flexDirection: 'column', marginTop: 20 },
          text(gothic(21, MAG_INK, { letterSpacing: '0.05em' }), 'By the numbers'),
          box(
            { marginTop: 10, gap: 18 },
            ...f.figures.slice(0, 4).map((s) =>
              box(
                { flexDirection: 'column', flexGrow: 1, flexBasis: 0, borderTop: `1px solid ${MAG_INK}`, paddingTop: 6 },
                text({ fontFamily: 'Fat', fontSize: 50, color: T.deep, lineHeight: 1.05 }, s.value),
                text(caps(12, MAG_INK, { letterSpacing: '0.06em', marginTop: 4, lineHeight: 1.3 }), s.label),
              ),
            ),
          ),
        )
      : null,
    box({ flexGrow: 1 }),
    box(
      { alignItems: 'baseline' },
      text(gothic(25, T.deep, { letterSpacing: '0.03em' }), f.cta),
      text({ ...old(21, MAG_INK, true), marginLeft: 12, textDecoration: 'underline' }, f.address),
    ),
    f.seeAlso
      ? box({ alignItems: 'center', marginTop: 8 }, text(mono(14, T.deep), f.seeAlso.text), arrow(20, T.deep, 2.4, { marginLeft: 8 }))
      : null,
    box({ height: 1, background: MAG_INK, marginTop: 14 }),
    text({ ...mono(13, MAG_INK), marginTop: 9, marginBottom: 62 }, f.credits),
    folio(f.pages[1], 'right'),
  );

  return render(`work-${f.slug}.svg`, box({ width: W, height }, opener, story), W, height);
}

/* -------------------------------------------------------- the commit band */

async function commits({ days, cols, total, activeDays }) {
  const height = 330;
  const cell = 22;
  const gap = 6;
  const pitch = cell + gap;
  const gridW = cols * pitch - gap;
  const gridTop = 46;
  const grid = Array.from({ length: 7 }, () => Array(cols).fill(0));
  for (const d of days) grid[d.row][d.col] = d.level;

  return render(
    'commits.svg',
    box(
      { width: W, height, position: 'relative', background: GH_BASE, overflow: 'hidden', fontFamily: 'Archivo' },
      box(
        { position: 'absolute', top: gridTop, left: W - PAD - gridW, flexDirection: 'column', gap },
        grid.map((row) => box({ gap }, row.map((level) => box({ width: cell, height: cell, borderRadius: 4, background: LEVEL[level] })))),
      ),
      box({
        position: 'absolute', top: 0, left: 0, width: W, height,
        backgroundImage: 'linear-gradient(90deg, rgba(13,17,23,0.9) 0%, rgba(13,17,23,0.55) 26%, rgba(13,17,23,0.1) 60%, rgba(13,17,23,0) 80%)',
      }),
      box(
        { position: 'absolute', top: 30, left: PAD, alignItems: 'center', padding: '12px 18px', border: `1px solid ${GH_LINE}`, borderRadius: 9, background: GH_BASE },
        svg(20, 20, '0 0 16 16', { marginRight: 12 },
          h('path', { fill: GH_INK, d: 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z' })),
        text(mono(18, GH_INK, { fontWeight: 500 }), 'github.com/RIDAM7'),
      ),
      box(
        { position: 'absolute', right: PAD, bottom: 26, alignItems: 'baseline', ...caps(16, GH_MUTED, { letterSpacing: '0.12em' }) },
        text({ color: GH_GREEN, fontWeight: 500, marginRight: 12, fontSize: 20 }, fmt(total)),
        text({}, `contributions · ${activeDays} active days · last 12 months`),
      ),
    ),
    W,
    height,
  );
}

/* -------------------------------------------------------- section heads */

/* A head that sits on the README's own page, so it follows the viewer's
   theme: newspaper ink on light, the paper's own colour on dark. */
const HEAD_THEMES = {
  light: { ink: INK, soft: INK_SOFT, red: RED },
  dark: { ink: PAPER, soft: '#b8ae9b', red: '#e0806c' },
};

async function sectionHead(id, kicker, title, aside) {
  for (const [mode, t] of Object.entries(HEAD_THEMES)) {
    await render(
      `head-${id}-${mode}.svg`,
      box(
        { width: W, height: 170, flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 8 },
        text(gothic(23, t.red, { letterSpacing: '0.12em' }), kicker),
        box(
          { alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8 },
          text(gothic(92, t.ink, { lineHeight: 0.9 }), title),
          text({ ...old(22, t.soft, true), marginBottom: 8 }, aside),
        ),
        box({ height: 3, background: t.ink, marginTop: 14 }),
        box({ height: 1, background: t.ink, marginTop: 3 }),
      ),
      W,
      170,
    );
  }
  return id;
}

/* ------------------------------------------------------------- the puzzle */

/*
 * The crossword, solved in pencil, numbered as ReachFor.astro numbers it:
 * every square that starts an answer across or down takes the next number,
 * reading left to right and top to bottom.
 */
function numberGrid() {
  const L = data.puzzle.layout;
  const tools = new Map(data.puzzle.desks.flatMap((d) => d.tools.map((t) => [t.id, { ...t, desk: d.id }])));
  const cells = new Map();
  const starts = new Set();
  for (const w of L.words) {
    const t = tools.get(w.id);
    if (!t) throw new Error(`render: crossword answer "${w.id}" is not in data.json's desks; re-export the profile`);
    const [dr, dc] = w.dir === 'A' ? [0, 1] : [1, 0];
    starts.add(`${w.r},${w.c}`);
    for (let k = 0; k < t.answer.length; k++) {
      const key = `${w.r + dr * k},${w.c + dc * k}`;
      const prev = cells.get(key);
      if (prev && prev.ch !== t.answer[k]) throw new Error(`render: crossword clash at ${key}`);
      cells.set(key, { r: w.r + dr * k, c: w.c + dc * k, ch: t.answer[k] });
    }
  }
  const order = [...starts].map((k) => k.split(',').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const num = new Map(order.map(([r, c], i) => [`${r},${c}`, i + 1]));
  const clues = L.words.map((w) => ({ ...tools.get(w.id), dir: w.dir, num: num.get(`${w.r},${w.c}`) }));
  return { cols: L.cols, rows: L.rows, cells: [...cells.values()], num, clues };
}

async function puzzle() {
  const g = numberGrid();
  const s = 25;
  const desk = (id) => data.puzzle.desks.find((d) => d.id === id);
  const cluesOf = (id) =>
    g.clues.filter((c) => c.desk === id).sort((a, b) => (a.dir === b.dir ? a.num - b.num : a.dir === 'A' ? -1 : 1));

  const deskBlock = (id, width) => {
    const d = desk(id);
    return box(
      { flexDirection: 'column', width },
      text(gothic(42, INK, { letterSpacing: '0.01em' }), d.name),
      box({ height: 2, background: INK, marginTop: 8 }),
      text({ ...old(18, INK_SOFT, true), lineHeight: 1.4, marginTop: 10 }, d.line),
      ...cluesOf(id).map((c) =>
        box(
          { marginTop: 10, alignItems: 'flex-start' },
          text(mono(12, INK, { fontWeight: 500, width: 78, flexShrink: 0, marginTop: 5, letterSpacing: '0.02em' }), `${c.num} ${c.dir === 'A' ? 'Across' : 'Down'}`),
          text({ ...old(18, INK), lineHeight: 1.38, flexGrow: 1, flexBasis: 0 }, `${c.clue} (${c.enumeration})`),
        ),
      ),
    );
  };

  // The squares are one drawing rather than a bordered box each: 230 boxes
  // would each carry their own clip path.
  const gridBox = box(
    { position: 'relative', width: g.cols * s + 2, height: g.rows * s + 2 },
    svg(g.cols * s + 2, g.rows * s + 2, `0 0 ${g.cols * s + 2} ${g.rows * s + 2}`, { position: 'absolute', left: 0, top: 0 },
      ...g.cells.map((c) => h('rect', { x: c.c * s + 1, y: c.r * s + 1, width: s, height: s, fill: SQUARE, stroke: INK, strokeWidth: 1.2 }))),
    ...g.cells.map((c) => {
      const n = g.num.get(`${c.r},${c.c}`);
      return box(
        { position: 'absolute', left: c.c * s + 1, top: c.r * s + 1, width: s, height: s, alignItems: 'center', justifyContent: 'center' },
        n ? text({ ...mono(8, INK), position: 'absolute', left: 2, top: 1, lineHeight: 1 }, String(n)) : null,
        text({ fontFamily: 'Pencil', fontWeight: 600, fontSize: Math.round(s * 0.82), color: PENCIL, lineHeight: 1, marginTop: 4 }, c.ch),
      );
    }),
  );

  const total = g.clues.length;
  const half = (g.cols * s - 34) / 2;
  return render(
    'puzzle.svg',
    box(
      { width: W, flexDirection: 'column', padding: `52px ${PAD}px 64px`, ...paperGround() },
      box(
        { justifyContent: 'space-between', ...caps(15, INK, { letterSpacing: '0.2em' }) },
        text({}, 'Puzzles & pastimes'),
        text({}, `The editor’s crossword · ${total} answers · solved in pencil`),
      ),
      box({ height: 3, background: INK, marginTop: 14 }),
      box({ height: 1, background: INK, marginTop: 3 }),
      box(
        { alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 34 },
        text(gothic(118, INK, { lineHeight: 0.9 }), 'What I reach for'),
        text({ ...old(21, INK_SOFT, true), lineHeight: 1.45, width: 420, marginBottom: 6 }, 'Every answer is something I build with, and every clue comes from the work.'),
      ),
      // The grid with two short desks under it, the longest desk beside it,
      // and the other two across the foot of the page.
      box(
        { marginTop: 46, justifyContent: 'space-between', alignItems: 'flex-start' },
        box(
          { flexDirection: 'column' },
          gridBox,
          box({ marginTop: 46, justifyContent: 'space-between', width: g.cols * s }, deskBlock('design', half), deskBlock('marketing', half)),
        ),
        deskBlock('backend', 1152 - g.cols * s - 54),
      ),
      box(
        { marginTop: 48, justifyContent: 'space-between', alignItems: 'flex-start' },
        deskBlock('ai', 552),
        deskBlock('devops', 552),
      ),
    ),
  );
}

/* ------------------------------------------------------------- the writing */

async function writing() {
  const [lead, ...others] = data.writing;
  const meta = (w, byline) =>
    box(
      { alignItems: 'center', marginTop: 20, fontFamily: 'Archivo', fontSize: 15, color: NEWS_SOFT },
      byline ? text({}, 'By') : null,
      byline ? text({ fontWeight: 700, color: NEWS_INK, marginLeft: 6 }, data.name) : null,
      byline ? text({ marginLeft: 8, marginRight: 8 }, '·') : null,
      text({}, longDate(w.date)),
      text({ marginLeft: 8, marginRight: 8 }, '·'),
      text({}, `${w.minutes} min read`),
    );
  const kicker = (label, dot) =>
    box(
      { alignItems: 'center', fontFamily: 'Archivo', fontWeight: 700, fontSize: 14, color: NEWS_RED, letterSpacing: '0.1em', textTransform: 'uppercase' },
      dot ? box({ width: 9, height: 9, borderRadius: 99, background: NEWS_RED, marginRight: 9 }) : null,
      text({}, label),
    );

  return render(
    'writing.svg',
    box(
      {
        width: W, flexDirection: 'column', padding: `56px ${PAD}px 70px`,
        backgroundColor: NEWSPRINT, backgroundImage: `url(${TEX.newsprint})`, backgroundSize: '256px 256px', backgroundRepeat: 'repeat',
      },
      text({ fontFamily: 'News', fontWeight: 600, fontSize: 118, color: NEWS_INK, lineHeight: 1, letterSpacing: '-0.02em' }, 'Writing'),
      box({ height: 1, background: NEWS_INK, marginTop: 16 }),
      text({ fontFamily: 'News', fontStyle: 'italic', fontSize: 26, color: NEWS_SOFT, marginTop: 18 }, 'Things that broke, and why.'),
      box(
        { marginTop: 44, alignItems: 'stretch' },
        box(
          { flexDirection: 'column', width: 570, paddingRight: 50, borderRight: `1px solid ${NEWS_RULE}` },
          kicker(`Latest · ${lead.topic}`, true),
          text({ fontFamily: 'News', fontWeight: 600, fontSize: 54, color: NEWS_INK, lineHeight: 1.08, marginTop: 16 }, lead.title),
          text({ fontFamily: 'News', fontSize: 22, color: NEWS_SOFT, lineHeight: 1.5, marginTop: 22 }, lead.standfirst),
          meta(lead, true),
        ),
        ...others.slice(0, 1).map((w) =>
          box(
            { flexDirection: 'column', width: 330, padding: '0 32px', borderRight: `1px solid ${NEWS_RULE}` },
            kicker(w.topic, false),
            text({ fontFamily: 'News', fontWeight: 600, fontSize: 30, color: NEWS_INK, lineHeight: 1.15, marginTop: 14 }, w.title),
            text({ fontFamily: 'News', fontSize: 18, color: NEWS_SOFT, lineHeight: 1.5, marginTop: 14 }, w.standfirst),
            meta(w, false),
          ),
        ),
        box(
          { flexDirection: 'column', flexGrow: 1, flexBasis: 0, paddingLeft: 32 },
          text({ fontFamily: 'Archivo', fontWeight: 700, fontSize: 14, color: NEWS_INK, letterSpacing: '0.1em', textTransform: 'uppercase' }, 'About this section'),
          text({ fontFamily: 'Archivo', fontSize: 17, color: NEWS_SOFT, lineHeight: 1.5, marginTop: 12 }, 'Write-ups from production: what broke, how it was found, and what fixed it.'),
          box({ height: 1, background: NEWS_RULE, marginTop: 22, marginBottom: 20 }),
          text({ fontFamily: 'News', fontWeight: 600, fontSize: 24, color: NEWS_INK }, `${data.writing.length} ${data.writing.length === 1 ? 'piece' : 'pieces'} so far`),
          box(
            { alignItems: 'center', marginTop: 14 },
            text({ fontFamily: 'Archivo', fontWeight: 700, fontSize: 17, color: NEWS_INK, textDecoration: 'underline' }, 'Every piece'),
            arrow(20, NEWS_INK, 2.4, { marginLeft: 8 }),
          ),
        ),
      ),
    ),
  );
}

/* -------------------------------------------------------------- the footer */

/** A four-point star with its glow, as the footer's links light them. */
const sparkle = (size, x, y, glow = true) =>
  box(
    { position: 'absolute', left: x - size, top: y - size, width: size * 2, height: size * 2, alignItems: 'center', justifyContent: 'center' },
    glow ? box({ position: 'absolute', left: 0, top: 0, width: size * 2, height: size * 2, borderRadius: 999, backgroundImage: 'radial-gradient(circle, rgba(232,235,247,0.35) 0%, rgba(232,235,247,0) 65%)' }) : null,
    svg(size, size, '0 0 10 10', {}, h('path', { d: 'M5 0 L5.6 4.4 L10 5 L5.6 5.6 L5 10 L4.4 5.6 L0 5 L4.4 4.4 Z', fill: STARLIGHT })),
  );

async function footer() {
  const height = 520;
  const linkCol = (label, items) =>
    box(
      { flexDirection: 'column', width: 300 },
      text(caps(13, STAR_SOFT, { letterSpacing: '0.2em' }), label),
      ...items.map(([t, soft]) => text({ fontFamily: 'Archivo', fontWeight: 600, fontSize: 19, color: soft ? STAR_SOFT : STARLIGHT, marginTop: 16 }, t)),
    );
  return render(
    'footer.svg',
    box(
      {
        width: W, height, position: 'relative', flexDirection: 'column', padding: `92px ${PAD}px 36px`,
        backgroundColor: NIGHT,
        backgroundImage: `url(${TEX.starsA}), url(${TEX.starsB}), radial-gradient(ellipse at 74% 38%, rgba(42, 56, 120, 0.32), rgba(42, 56, 120, 0) 60%), radial-gradient(ellipse at 6% 100%, rgba(72, 42, 118, 0.3), rgba(72, 42, 118, 0) 60%)`,
        backgroundSize: '512px 512px, 700px 700px, 100% 100%, 100% 100%',
        backgroundRepeat: 'repeat, repeat, no-repeat, no-repeat',
      },
      // The torn end of the newsprint above, hanging into the sky.
      svg(W, 16, '0 0 1000 12', { position: 'absolute', left: 0, top: 0 }, h('path', { d: tearPath(7, 'top'), fill: NEWSPRINT })),
      sparkle(18, 92, 150),
      sparkle(14, 870, 70),
      sparkle(10, 1180, 210, false),
      text(caps(14, STAR_SOFT, { letterSpacing: '0.2em' }), 'Contact'),
      box(
        { alignItems: 'center', marginTop: 14 },
        text(gothic(96, STARLIGHT, { lineHeight: 0.92 }), data.front.coffee.cta),
        arrow(70, STARLIGHT, 2, { marginLeft: 22 }),
      ),
      box({ height: 1, background: 'rgba(232, 235, 247, 0.16)', marginTop: 40, marginBottom: 30 }),
      box(
        {},
        linkCol('Elsewhere', [['GitHub'], ...data.profiles.map((p) => [p.name])]),
        linkCol('Contact', [[data.email], [data.location, true]]),
        linkCol('Site', [[data.site.replace('https://', '')], ['Résumé (PDF)']]),
      ),
      box({ flexGrow: 1 }),
      box(
        { justifyContent: 'space-between', ...caps(13, STAR_SOFT, { letterSpacing: '0.16em' }) },
        text({}, `© ${YEAR} ${data.name}`),
        text({}, 'The Daily Grind · printed from ridamagrawal.com'),
      ),
    ),
    W,
    height,
  );
}

/* ------------------------------------------------------------- the README */

const picture = (id, alt) =>
  [
    '<picture>',
    `  <source media="(prefers-color-scheme: dark)" srcset="assets/head-${id}-dark.svg">`,
    `  <img src="assets/head-${id}-light.svg" width="100%" alt="${alt}">`,
    '</picture>',
  ].join('\n');

function readme(c) {
  const F = data.front;
  const frontAlt = `The Daily Grind, ${data.name}’s paper of record. Front page: ${F.headline.top} ${F.headline.before} ${F.headline.ringed} ${F.headline.after}. ${F.deck} By ${data.name}, founding engineer, ${F.post}. Breaking: ${F.breaking.map((b) => b.head).join('; ')}. ${F.plate2.caption} ${F.plate2.url}.`;

  const links = [
    `<b><a href="${data.site}">${data.site.replace('https://', '')}</a></b>`,
    ...data.profiles.map((p) => `<a href="${p.url}">${p.name}</a>`),
    `<a href="mailto:${data.email}">Email</a>`,
    `<a href="${data.resume}">Résumé</a>`,
  ].join('&nbsp;&nbsp;·&nbsp;&nbsp;');

  const grindAlt = `Selected work: things I built alone. Grind, The Daily Grind’s colour supplement. ${data.issue.headline}. Contents: ${data.features.map((f) => `page ${f.pages[0]}, ${f.name}: ${f.headline}`).join('; ')}.`;

  const spreads = data.features
    .map((f) => {
      const alt = esc(`${f.name}, ${f.section}. ${f.headline}. ${f.standfirst} ${f.story.join(' ')} ${f.figures.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(', ')}. ${f.cta} ${f.address}. ${f.credits}.`);
      return `<a href="${f.href}"><img src="assets/work-${f.slug}.svg" width="100%" alt="${alt}"></a>`;
    })
    .join('\n');

  // Three points show; the rest fold under "more", as LinkedIn does.
  const roles = data.roles
    .map((r) => {
      const rest = r.points.slice(3);
      return [
        `**${r.title}** · ${r.org}<br>`,
        `<sub>${[r.period, r.place, r.kind].join(' · ').toUpperCase()}</sub>`,
        '',
        ...r.points.slice(0, 3).map((pt) => `- ${pt}`),
        ...(rest.length ? ['', '<details>', `<summary>${rest.length} more</summary>`, '', ...rest.map((pt) => `- ${pt}`), '', '</details>'] : []),
      ].join('\n');
    })
    .join('\n\n');

  const g = numberGrid();
  const puzzleAlt = esc(
    `What I reach for: the editor’s crossword, ${g.clues.length} answers, solved in pencil. ` +
      data.puzzle.desks.map((d) => `${d.name}: ${d.tools.map((t) => t.name).join(', ')}`).join('. ') + '.',
  );

  const writingAlt = esc(`Writing. Things that broke, and why. ${data.writing.map((w) => `${w.title}: ${w.standfirst}`).join(' ')}`);
  const articles = data.writing.map((w) => `<a href="${w.url}">${w.title}</a>`).join('&nbsp;&nbsp;·&nbsp;&nbsp;');

  return `<!--
  Generated by render/render.mjs from render/data.json. Do not edit by hand.

  data.json is exported from ridamagrawal.com's own data files, so this page
  and the site cannot disagree. The contribution grid is fetched live, and a
  workflow re-renders it daily.
-->

<a href="${data.site}"><img src="assets/front.svg" width="100%" alt="${esc(frontAlt)}"></a>

<p align="center">${esc(data.long)}</p>

<p align="center">${links}</p>

<a href="${data.site}/#work"><img src="assets/grind.svg" width="100%" alt="${esc(grindAlt)}"></a>
${spreads}

<img src="assets/commits.svg" width="100%" alt="A year on GitHub: ${fmt(c.total)} contributions and ${c.activeDays} active days in the last 12 months.">

${picture('experience', 'Experience. The record.')}

${roles}

<br>

<a href="${data.site}/#reach"><img src="assets/puzzle.svg" width="100%" alt="${puzzleAlt}"></a>

<a href="${data.site}/writing"><img src="assets/writing.svg" width="100%" alt="${writingAlt}"></a>
<p align="center"><sub>READ</sub>&nbsp;&nbsp;${articles}</p>

<a href="mailto:${data.email}"><img src="assets/footer.svg" width="100%" alt="Discuss it over coffee: ${data.email}, ${data.location}."></a>
`;
}

/* ------------------------------------------------------------------- run */

await mkdir(join(root, 'assets'), { recursive: true });
const contributions = await getContributions();

await front();
await grind();
for (const f of data.features) await spread(f);
await commits(contributions);
await sectionHead('experience', 'The record', 'Experience', 'Where it was built');
await puzzle();
await writing();
await footer();

/* assets/ holds only what this run drew: a section the README no longer has
   leaves no orphan image behind. */
for (const file of await readdir(join(root, 'assets'))) {
  if (!written.has(file)) await unlink(join(root, 'assets', file));
}

await writeFile(join(root, 'README.md'), readme(contributions));
console.log(`Rendered README.md and ${written.size} images. ${fmt(contributions.total)} contributions, ${contributions.activeDays} active days.`);
