/**
 * The GitHub contribution grid, read the way the profile page draws it.
 *
 * A copy of `scripts/lib/contributions.mjs` in the portfolio repository, which
 * is private, so this repo cannot import it. Keep the two in step: the parse is
 * against GitHub's rendered profile fragment, which is HTML nobody promised us,
 * and if one copy breaks because that markup moved, so does the other.
 */

const USER = 'RIDAM7';

/**
 * @returns {Promise<{days: {date: string, level: number, row: number, col: number}[],
 *                    cols: number, total: number, activeDays: number}>}
 */
export async function getContributions() {
  const res = await fetch(`https://github.com/users/${USER}/contributions`, {
    headers: {
      // GitHub serves the fragment to a browser UA; a bare fetch UA gets a
      // different response.
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      accept: 'text/html',
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`GitHub returned ${res.status}`);

  const html = await res.text();

  // Attribute order is not guaranteed, so both orderings are tried.
  let days = [...html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})"[^>]*?data-level="(\d)"/g)].map((m) => ({
    date: m[1],
    level: Number(m[2]),
  }));
  if (days.length === 0) {
    days = [...html.matchAll(/data-level="(\d)"[^>]*?data-date="(\d{4}-\d{2}-\d{2})"/g)].map((m) => ({
      date: m[2],
      level: Number(m[1]),
    }));
  }
  if (days.length === 0) throw new Error('no contribution cells found in the fetched fragment');

  const totalMatch = html.match(/([\d,]+)\s*\n?\s*contributions/);
  const total = totalMatch ? Number(totalMatch[1].replace(/,/g, '')) : 0;
  const activeDays = days.filter((d) => d.level > 0).length;

  // Position comes from each cell's date, not its order in the document:
  // GitHub emits the grid column-major.
  const times = days.map((d) => Date.parse(`${d.date}T00:00:00Z`));
  const first = Math.min(...times);
  const originSunday = first - new Date(first).getUTCDay() * 86_400_000;
  const WEEK = 7 * 86_400_000;

  const placed = days.map((d) => {
    const ms = Date.parse(`${d.date}T00:00:00Z`);
    return { ...d, row: new Date(ms).getUTCDay(), col: Math.floor((ms - originSunday) / WEEK) };
  });

  const cols = Math.max(...placed.map((d) => d.col)) + 1;

  return { days: placed, cols, total, activeDays };
}
