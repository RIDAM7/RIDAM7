/**
 * Renders this profile: README.md and every image in assets/.
 *
 *     cd render && npm ci && node render.mjs
 *
 * Everything the README says comes from `data.json`, which is exported from
 * ridamagrawal.com's own data files (`npm run export:github` in the portfolio
 * repository). Nothing here is a second record of the work. The one input read
 * live is the contribution grid, which is why a workflow re-runs this daily:
 * GitHub draws the real calendar a few hundred pixels below the README, and a
 * hero that disagreed with it would be the first thing anyone noticed.
 *
 * Images are SVG from satori, which sets every glyph as a path. A README image
 * is served through GitHub's proxy and cannot load a web font, so text left as
 * text would fall back to whatever the viewer has installed.
 *
 * The palette is the site's: the hero block's GitHub-dark ground and green for
 * anything drawn on a panel, and the site's light theme for the section heads,
 * which sit on the page itself and so ship in a light and a dark variant.
 *
 * Plex Mono's latin subset has no arrows (U+2192) and satori has no fallback
 * font, so an arrow here renders as an empty box. Shapes are drawn instead.
 */
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import satori from 'satori';
import { getContributions } from './contributions.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const require = createRequire(import.meta.url);

const data = JSON.parse(await readFile(join(here, 'data.json'), 'utf8'));

/* ---------------------------------------------------------------- palette */

const BASE = '#0d1117';
const SURFACE = '#161b22';
const INK = '#e6edf3';
const MUTED = '#8b949e';
const FAINT = '#6e7681';
const HAIRLINE = '#30363d';
const ACCENT = '#39d353';
const STRING = '#79c0ff';
const LEVEL = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];

/* Section heads sit on the page, so they follow the viewer's theme. */
const THEMES = {
  dark: { ink: INK, muted: MUTED, accent: ACCENT, rule: HAIRLINE },
  light: { ink: '#1f2328', muted: '#59636e', accent: '#356460', rule: '#d1d9e0' },
};

const W = 1280;

/* ------------------------------------------------------------------ fonts */

const fontFile = (pkg, file) => readFile(join(dirname(require.resolve(`${pkg}/package.json`)), 'files', file));

const fonts = [
  { name: 'Archivo', weight: 400, file: ['@fontsource/archivo', 'archivo-latin-400-normal.woff'] },
  { name: 'Archivo', weight: 600, file: ['@fontsource/archivo', 'archivo-latin-600-normal.woff'] },
  { name: 'Archivo', weight: 800, file: ['@fontsource/archivo', 'archivo-latin-800-normal.woff'] },
  { name: 'Plex', weight: 400, file: ['@fontsource/ibm-plex-mono', 'ibm-plex-mono-latin-400-normal.woff'] },
  { name: 'Plex', weight: 500, file: ['@fontsource/ibm-plex-mono', 'ibm-plex-mono-latin-500-normal.woff'] },
];
for (const f of fonts) f.data = await fontFile(...f.file);
const satoriFonts = fonts.map(({ name, weight, data }) => ({ name, weight, data, style: 'normal' }));

/* ---------------------------------------------------------------- helpers */

const h = (type, props = {}, ...children) => ({
  type,
  props: { ...props, children: children.flat().filter((c) => c !== null && c !== undefined && c !== false) },
});

/** A flex box. satori requires display:flex on anything with more than one child. */
const box = (style, ...children) => h('div', { style: { display: 'flex', ...style } }, ...children);
const text = (style, value) => h('div', { style: { display: 'flex', ...style } }, value);

const mono = (size, color, extra = {}) => ({ fontFamily: 'Plex', fontSize: size, color, ...extra });
const label = (size, color, extra = {}) =>
  mono(size, color, { textTransform: 'uppercase', letterSpacing: '0.14em', ...extra });

/** `height` omitted lets satori size the image to its content. */
async function render(name, node, width, height) {
  const svg = await satori(node, { width, ...(height ? { height } : {}), fonts: satoriFonts });
  await writeFile(join(root, 'assets', name), svg);
  return name;
}

/** A filled chip with one to three mono letters, as the site draws them. */
function chip(c, size = 22) {
  return box(
    {
      width: size,
      height: size,
      borderRadius: Math.round(size / 4.5),
      background: c.fill,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    text(mono(Math.round(size * (c.abbr.length > 2 ? 0.38 : 0.46)), c.letter, { fontWeight: 500 }), c.abbr),
  );
}

/** The green status dot, with its ring. */
const dot = (size = 10) =>
  box(
    {
      width: size + 10,
      height: size + 10,
      borderRadius: 999,
      background: 'rgba(57, 211, 83, 0.18)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    box({ width: size, height: size, borderRadius: 999, background: ACCENT }),
  );

/** The boot banner's triangle, drawn, since the font has no U+25B2. */
const triangle = (color) =>
  h(
    'svg',
    { width: 12, height: 11, viewBox: '0 0 12 11', style: { marginRight: 10 } },
    h('path', { d: 'M6 0 L12 11 L0 11 Z', fill: color }),
  );

const fmt = (n) => n.toLocaleString('en-US');

/* --------------------------------------------------------------- the hero */

async function hero({ days, cols, total, activeDays }) {
  const height = 600;
  const pad = 64;
  const cell = 22;
  const gap = 6;
  const pitch = cell + gap;
  const gridW = cols * pitch - gap;
  const gridTop = 112;

  const grid = Array.from({ length: 7 }, () => Array(cols).fill(0));
  for (const d of days) grid[d.row][d.col] = d.level;

  return render(
    'hero.svg',
    box(
      {
        width: W,
        height,
        position: 'relative',
        flexDirection: 'column',
        background: BASE,
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 20,
        overflow: 'hidden',
        padding: `52px ${pad}px 48px`,
        fontFamily: 'Archivo',
      },

      // The calendar, right-aligned so this week is always at the right edge,
      // and cropped on the left where the fade takes it.
      box(
        {
          position: 'absolute',
          top: gridTop,
          left: W - pad - gridW,
          flexDirection: 'column',
          gap,
        },
        grid.map((row) =>
          box(
            { gap },
            row.map((level) => box({ width: cell, height: cell, borderRadius: 4, background: LEVEL[level] })),
          ),
        ),
      ),

      // The fade the site draws with a mask, done as an overlay.
      box({
        position: 'absolute',
        top: 0,
        left: 0,
        width: W,
        height,
        backgroundImage:
          'linear-gradient(90deg, rgba(13,17,23,1) 0%, rgba(13,17,23,0.96) 22%, rgba(13,17,23,0.55) 48%, rgba(13,17,23,0) 72%)',
      }),

      box(
        {
          position: 'absolute',
          top: gridTop + 7 * pitch + 10,
          right: pad,
          alignItems: 'baseline',
          ...label(17, MUTED),
        },
        text({ color: ACCENT, fontWeight: 500, marginRight: 14 }, fmt(total)),
        text({}, `contributions · ${activeDays} active days`),
      ),

      box(
        { justifyContent: 'space-between', alignItems: 'center' },
        box({ alignItems: 'center' }, dot(), text(label(17, INK), `${data.location} — open to work`)),
        text(mono(17, MUTED), data.site.replace('https://', '')),
      ),

      box(
        {
          flexDirection: 'column',
          marginTop: 44,
          fontWeight: 800,
          fontSize: 116,
          lineHeight: 1,
          letterSpacing: '-0.045em',
        },
        text({ color: INK }, 'Backend & AI'),
        text({ color: ACCENT, marginTop: 4 }, 'engineer.'),
      ),

      box({ flexGrow: 1 }),

      box(
        { borderTop: `1px solid ${HAIRLINE}`, paddingTop: 26, justifyContent: 'space-between' },
        data.headlineStats.map((s) =>
          box(
            { flexDirection: 'column', width: 250 },
            text({ fontWeight: 800, fontSize: 46, letterSpacing: '-0.03em', color: INK }, s.value),
            text(label(14, MUTED, { letterSpacing: '0.08em', marginTop: 8, lineHeight: 1.4 }), s.label),
          ),
        ),
      ),
    ),
    W,
    height,
  );
}

/* ---------------------------------------------------------- section heads */

async function sectionHead(id, kicker, title, meta) {
  for (const [mode, t] of Object.entries(THEMES)) {
    await render(
      `head-${id}-${mode}.svg`,
      box(
        {
          width: W,
          height: 150,
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          paddingBottom: 22,
          borderBottom: `1px solid ${t.rule}`,
          fontFamily: 'Archivo',
        },
        box(
          { flexDirection: 'column' },
          text(label(17, t.accent, { letterSpacing: '0.18em' }), kicker),
          text({ fontWeight: 800, fontSize: 58, letterSpacing: '-0.035em', color: t.ink, marginTop: 10, lineHeight: 1.05 }, title),
        ),
        text(label(16, t.muted, { letterSpacing: '0.12em', marginBottom: 6 }), meta),
      ),
      W,
      150,
    );
  }
  return id;
}

/* ---------------------------------------------------------- project cards */

/*
 * The project's image, embedded as a data URI. A README image is fetched
 * through GitHub's proxy and an SVG loaded as an image cannot fetch anything
 * itself, so the picture has to travel inside the file. The JPEG is written by
 * the portfolio's export at exactly the size drawn here (400px, at 2x).
 */
async function cardImage(p) {
  if (!p.image) return null;
  const jpg = await readFile(join(here, p.image));
  return `data:image/jpeg;base64,${jpg.toString('base64')}`;
}

async function projectCard(p) {
  const height = 450;
  const image = await cardImage(p);
  const asideW = 400;
  return render(
    `work-${p.slug}.svg`,
    box(
      {
        width: W,
        height,
        background: BASE,
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 16,
        padding: '34px 44px 32px',
        fontFamily: 'Archivo',
      },

      box(
        { flexDirection: 'column', flexGrow: 1, flexBasis: 0, paddingRight: 44 },

        box(
          { ...mono(18, MUTED), alignItems: 'baseline' },
          text({ color: ACCENT }, '~/work'),
          text({ marginLeft: 10, marginRight: 12 }, '$'),
          text({ color: INK }, `cat ${p.file}`),
          p.status ? text({ marginLeft: 12 }, '--status') : null,
          p.status ? text({ marginLeft: 10, color: STRING }, `"${p.status.toLowerCase()}"`) : null,
        ),

        text({ fontWeight: 800, fontSize: 46, letterSpacing: '-0.035em', color: INK, marginTop: 20, lineHeight: 1.05 }, p.title.split(' — ')[0]),
        text({ fontSize: 22, lineHeight: 1.5, color: MUTED, marginTop: 14 }, p.line),

        box({ flexGrow: 1 }),

        p.stats.length
          ? box(
              { gap: 52 },
              p.stats.map((s) =>
                box(
                  { flexDirection: 'column' },
                  text({ fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em', color: INK }, s.value),
                  text(label(14, FAINT, { letterSpacing: '0.08em', marginTop: 4 }), s.label),
                ),
              ),
            )
          : null,

        p.href
          ? box(
              { ...mono(16, MUTED), alignItems: 'center', marginTop: p.stats.length ? 20 : 0 },
              triangle(ACCENT),
              text({ color: INK }, `${p.framework.name} ${p.framework.version}`),
              text({ marginLeft: 22, marginRight: 10 }, `${p.hrefLabel}:`),
              text({ color: STRING }, p.href.replace(/^https?:\/\/(www\.)?/, '')),
            )
          : null,
      ),

      // The site's aside: the project's image, then the stack. The list wraps
      // into pills here rather than running as a column, because nine rows
      // under a 209px image would not fit the card.
      box(
        { flexDirection: 'column', width: asideW + 34, borderLeft: `1px solid ${HAIRLINE}`, paddingLeft: 34 },
        image
          ? box(
              {
                width: asideW,
                height: Math.round(asideW / (800 / 419)),
                border: `1px solid ${HAIRLINE}`,
                borderRadius: 10,
                overflow: 'hidden',
                marginBottom: 20,
              },
              h('img', { src: image, width: asideW, height: Math.round(asideW / (800 / 419)), style: { objectFit: 'cover' } }),
            )
          : null,
        box(
          { flexWrap: 'wrap', gap: 8 },
          p.stack.map((t) =>
            box(
              {
                alignItems: 'center',
                border: `1px solid ${HAIRLINE}`,
                borderRadius: 7,
                padding: '4px 10px 4px 5px',
              },
              chip(t, 20),
              text(mono(15, INK, { marginLeft: 8 }), t.label),
            ),
          ),
        ),
      ),
    ),
    W,
    height,
  );
}

/* --------------------------------------------------------------- the stack */

async function stackPanel() {
  const order = ['Languages', 'Backend', 'Frontend', 'Databases', 'AI & ML', 'Cloud & tooling'];
  const groups = order.map((n) => data.stack.find((g) => g.name === n));
  if (groups.some((g) => !g)) throw new Error('render: stack group missing from data.json');

  const pad = 36;
  const colGap = 20;
  const cardW = (W - pad * 2 - colGap * 2) / 3;

  const item = (i) =>
    i.capability
      ? box(
          {
            alignItems: 'center',
            border: `1px dashed ${FAINT}`,
            borderRadius: 7,
            padding: '6px 11px',
            ...mono(15, INK),
          },
          i.label,
        )
      : box(
          {
            alignItems: 'center',
            border: `1px solid ${HAIRLINE}`,
            background: BASE,
            borderRadius: 7,
            padding: '5px 11px 5px 6px',
          },
          i.abbr ? chip(i, 20) : null,
          text(mono(15, INK, { marginLeft: i.abbr ? 9 : 4 }), i.label),
        );

  const card = (g) =>
    box(
      {
        flexDirection: 'column',
        width: cardW,
        background: SURFACE,
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 12,
        padding: '22px 22px 20px',
      },
      box(
        { alignItems: 'center' },
        chip(g.mark, 34),
        box(
          { flexDirection: 'column', marginLeft: 14 },
          text({ fontWeight: 600, fontSize: 22, color: INK, letterSpacing: '-0.01em' }, g.name),
          text(mono(14, MUTED, { marginTop: 3 }), g.role),
        ),
      ),
      box({ flexWrap: 'wrap', gap: 8, marginTop: 20 }, g.items.map(item)),
      box({ flexGrow: 1 }),
      g.volume
        ? box(
            { alignItems: 'center', marginTop: 18, paddingTop: 14, borderTop: `1px solid ${HAIRLINE}`, ...mono(14, MUTED) },
            box({ width: 7, height: 7, background: ACCENT, borderRadius: 2, marginRight: 10 }),
            g.volume,
          )
        : null,
    );

  return render(
    'stack.svg',
    box(
      {
        width: W,
        flexDirection: 'column',
        background: BASE,
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 16,
        padding: pad,
        fontFamily: 'Archivo',
      },
      box({ gap: colGap }, groups.slice(0, 3).map(card)),
      box({ gap: colGap, marginTop: colGap }, groups.slice(3).map(card)),
      box(
        { flexDirection: 'column', marginTop: 26 },
        text(label(14, FAINT, { marginBottom: 10 }), 'Shared variables · true of every card here'),
        box(
          { flexWrap: 'wrap', gap: 22, ...mono(16, '#caacff') },
          data.concepts.map((c) => text({}, c.toUpperCase().replace(/[\s-]+/g, '_'))),
        ),
      ),
    ),
    W,
  );
}

/* ------------------------------------------------------------- the contact */

async function contact({ days, cols }) {
  const height = 300;
  const weeks = 18;
  const cell = 16;
  const gap = 5;
  const recent = Array.from({ length: 7 }, () => Array(weeks).fill(0));
  for (const d of days) if (d.col >= cols - weeks) recent[d.row][d.col - (cols - weeks)] = d.level;

  return render(
    'contact.svg',
    box(
      {
        width: W,
        height,
        background: BASE,
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 20,
        padding: '52px 64px',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontFamily: 'Archivo',
      },
      box(
        { flexDirection: 'column' },
        box({ alignItems: 'center' }, dot(), text(label(17, ACCENT), 'Open to work')),
        box(
          { flexDirection: 'column', marginTop: 22, fontWeight: 800, fontSize: 54, letterSpacing: '-0.04em', lineHeight: 1.08, color: INK },
          text({}, 'Full-stack, backend and'),
          text({}, 'software engineer roles.'),
        ),
        box(
          { marginTop: 24, ...mono(19, MUTED), alignItems: 'center' },
          text({ color: INK }, data.email),
          text({ marginLeft: 16, marginRight: 16, color: FAINT }, '·'),
          text({}, data.location),
        ),
      ),
      box(
        { flexDirection: 'column', gap },
        recent.map((row) =>
          box({ gap }, row.map((level) => box({ width: cell, height: cell, borderRadius: 3, background: LEVEL[level] }))),
        ),
      ),
    ),
    W,
    height,
  );
}

/* ------------------------------------------------------------- the README */

/*
 * Every image URL carries a hash of the file it points at.
 *
 * GitHub serves repository files with a five-minute cache, at its CDN and in
 * the browser, and the filenames here never change. Without this, a push is
 * followed by up to five minutes of the old images on the profile, and the
 * daily grid refresh could sit behind a stale copy. The query string changes
 * exactly when the bytes do, so an unchanged image keeps its cached copy and a
 * changed one is fetched fresh.
 */
const versions = new Map();
const asset = (name) => `assets/${name}?v=${versions.get(name)}`;

const picture = (id, alt) =>
  [
    '<picture>',
    `  <source media="(prefers-color-scheme: dark)" srcset="${asset(`head-${id}-dark.svg`)}">`,
    `  <img src="${asset(`head-${id}-light.svg`)}" width="100%" alt="${alt}">`,
    '</picture>',
  ].join('\n');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const dateLabel = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

function readme(c) {
  const stats = data.headlineStats.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(', ');
  const heroAlt = `${data.name}. Backend and AI engineer, ${data.location}, open to work. ${stats}. ${fmt(c.total)} contributions and ${c.activeDays} active days in the last 12 months.`;

  const links = [
    `<b><a href="${data.site}">${data.site.replace('https://', '')}</a></b>`,
    ...data.profiles.map((p) => `<a href="${p.url}">${p.name}</a>`),
    `<a href="mailto:${data.email}">Email</a>`,
    `<a href="${data.resume}">Résumé</a>`,
  ].join('&nbsp;&nbsp;·&nbsp;&nbsp;');

  const cards = data.projects
    .map((p) => {
      const alt = esc(`${p.title}. ${p.line} Stack: ${p.stack.map((t) => t.label).join(', ')}.`);
      return `<a href="${p.link}"><img src="${asset(`work-${p.slug}.svg`)}" width="100%" alt="${alt}"></a>`;
    })
    .join('\n\n');

  const roles = data.roles
    .map((r) =>
      [
        `**${r.title}** · ${r.org}<br>`,
        `<sub>${[r.period, r.place, r.kind].join(' · ').toUpperCase()}</sub>`,
        '',
        ...r.points.slice(0, 3).map((pt) => `- ${pt}`),
      ].join('\n'),
    )
    .join('\n\n');

  const stackAlt = esc(
    data.stack.map((g) => `${g.name}: ${g.items.map((i) => i.label).join(', ')}`).join('. ') + '.',
  );

  const writing = data.writing
    .map((w) =>
      [
        `**[${w.title}](${w.url})**<br>`,
        `${w.description}<br>`,
        `<sub>${[dateLabel(w.date), w.topic, `${w.minutes} min read`].join(' · ').toUpperCase()}</sub>`,
      ].join('\n'),
    )
    .join('\n\n');

  return `<!--
  Generated by render/render.mjs from render/data.json. Do not edit by hand.

  data.json is exported from ridamagrawal.com's own data files, so this page
  and the site cannot disagree. The contribution grid is fetched live, and a
  workflow re-renders it daily.
-->

<a href="${data.site}"><img src="${asset('hero.svg')}" width="100%" alt="${esc(heroAlt)}"></a>

<p align="center">${esc(data.long)}</p>

<p align="center">${links}</p>

<br>

${picture('work', `Selected work. Things I built alone. ${data.projects.length} projects.`)}

${cards}

<br>

${picture('experience', 'Experience. Where it was built.')}

${roles}

<br>

${picture('stack', 'Stack. What I reach for.')}

<img src="${asset('stack.svg')}" width="100%" alt="${stackAlt}">

<br>

${picture('writing', 'Writing. Things that broke, and why.')}

${writing}

<p align="right"><sub><a href="${data.site}/writing">ALL WRITING ON RIDAMAGRAWAL.COM</a></sub></p>

<br>

<a href="mailto:${data.email}"><img src="${asset('contact.svg')}" width="100%" alt="Open to work. Full-stack, backend and software engineer roles. ${data.email}, ${data.location}."></a>
`;
}

/* ------------------------------------------------------------------- run */

await mkdir(join(root, 'assets'), { recursive: true });
const contributions = await getContributions();

const written = [
  await hero(contributions),
  await sectionHead('work', 'Selected work', 'Things I built alone', `${String(data.projects.length).padStart(2, '0')} projects`),
  await sectionHead('experience', 'Experience', 'Where it was built', `${data.roles.length} roles`),
  await sectionHead('stack', 'Stack', 'What I reach for', `${data.stack.length} groups`),
  await sectionHead('writing', 'Writing', 'Things that broke, and why', `${data.writing.length} articles`),
  ...(await Promise.all(data.projects.map(projectCard))),
  await stackPanel(),
  await contact(contributions),
];

for (const name of (await readdir(join(root, 'assets'))).filter((f) => f.endsWith('.svg'))) {
  const bytes = await readFile(join(root, 'assets', name));
  versions.set(name, createHash('sha256').update(bytes).digest('hex').slice(0, 10));
}

await writeFile(join(root, 'README.md'), readme(contributions));
console.log(`Rendered README.md and ${written.length} image sets. ${fmt(contributions.total)} contributions, ${contributions.activeDays} active days.`);
