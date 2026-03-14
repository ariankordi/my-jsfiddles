import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEST_REPO = path.join(__dirname, 'test-repo');
const CSV_PATH = path.join(__dirname, 'gallery-metadata.csv');
const CATEGORIES_PATH = path.join(__dirname, 'gallery-categories.json');
const OUTPUT_PATH = path.join(TEST_REPO, 'index.html');
const SCREENSHOTS_PREFIX = '_screenshots';

// ── Types ────────────────────────────────────────────────────────────────────

interface Category {
  id: string;
  label: string;
  description: string;
  obsolete: boolean;
}

interface CsvRow {
  shortname: string;
  category: string;
  title: string;
  description: string;
  created: string;
}

interface FiddleInfo {
  shortname: string;
  category: string;
  title: string;
  description: string;
  created: string;
  hasScreenshot: boolean;
}

// ── Parsing ──────────────────────────────────────────────────────────────────

function parseCsv(csvPath: string): CsvRow[] {
  if (!fs.existsSync(csvPath)) return [];
  const lines = fs.readFileSync(csvPath, 'utf8').trim().split('\n');
  if (lines.length < 2) return [];

  const rows: CsvRow[] = [];
  // Simple CSV parser that handles quoted fields.
  for (let i = 1; i < lines.length; i++) {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    const line = lines[i];

    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (inQuotes) {
        if (ch === '"' && line[j + 1] === '"') {
          current += '"';
          j++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current);

    if (!fields[0]) continue;
    rows.push({
      shortname: fields[0],
      category: fields[1] || '',
      title: fields[2] || '',
      description: fields[3] || '',
      created: fields[4] || ''
    });
  }
  return rows;
}

function discoverFiddles(): string[] {
  return fs.readdirSync(TEST_REPO).filter(d => {
    const full = path.join(TEST_REPO, d);
    return fs.statSync(full).isDirectory()
      && !d.startsWith('.')
      && !d.startsWith('_')
      && d !== 'screenshots';
  });
}

function buildFiddleList(): FiddleInfo[] {
  const csvMap = new Map<string, CsvRow>();
  for (const row of parseCsv(CSV_PATH)) {
    csvMap.set(row.shortname, row);
  }

  const screenshotsDir = path.join(TEST_REPO, SCREENSHOTS_PREFIX);
  const fiddles: FiddleInfo[] = [];

  for (const shortname of discoverFiddles()) {
    const csv = csvMap.get(shortname);
    fiddles.push({
      shortname,
      category: csv?.category || 'uncategorized',
      title: csv?.title || '',
      description: csv?.description || '',
      created: csv?.created || '',
      hasScreenshot: fs.existsSync(path.join(screenshotsDir, `${shortname}.jpg`))
    });
  }

  return fiddles;
}

// ── HTML generation ──────────────────────────────────────────────────────────

function h(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? dateStr
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function renderCard(fiddle: FiddleInfo): string {
  const title = fiddle.title || fiddle.shortname;
  const desc = fiddle.description.length > 150
    ? fiddle.description.slice(0, 147) + '...'
    : fiddle.description;
  const href = `${fiddle.shortname}/index.html`;
  const dateStr = formatDate(fiddle.created);

  return `        <a class="card" href="${h(href)}" data-created="${h(fiddle.created)}">
          <div class="thumb">${
    fiddle.hasScreenshot
      ? `<img src="${SCREENSHOTS_PREFIX}/${h(fiddle.shortname)}.jpg" alt="${h(title)}" loading="lazy">`
      : `<div class="no-thumb">${h(fiddle.shortname.slice(0, 2).toUpperCase())}</div>`
  }</div>
          <div class="info">
            <strong>${h(title)}</strong>${desc ? `\n            <p>${h(desc)}</p>` : ''}${dateStr ? `\n            <time>${h(dateStr)}</time>` : ''}
          </div>
        </a>`;
}

function renderSection(cat: Category, fiddles: FiddleInfo[]): string {
  return `
  <section data-category="${h(cat.id)}">
    <h2>${h(cat.label)}</h2>${cat.description ? `\n    <p class="cat-desc">${h(cat.description)}</p>` : ''}
    <div class="grid">
${fiddles.map(f => renderCard(f)).join('\n')}
    </div>
  </section>`;
}

function generateHtml(categories: Category[], fiddles: FiddleInfo[]): string {
  // Group by category.
  const grouped = new Map<string, FiddleInfo[]>();
  for (const f of fiddles) {
    const list = grouped.get(f.category) || [];
    list.push(f);
    grouped.set(f.category, list);
  }

  // Default sort: newest first within each section.
  for (const list of grouped.values()) {
    list.sort((a, b) => b.created.localeCompare(a.created));
  }

  let seenObsoleteHeader = false;
  let sectionsHtml = '';
  for (const cat of categories) {
    const list = grouped.get(cat.id);
    if (!list || list.length === 0) continue;

    if (cat.obsolete && !seenObsoleteHeader) {
      sectionsHtml += '\n  <hr class="obsolete-divider">\n  <p class="obsolete-header">Older / archived</p>';
      seenObsoleteHeader = true;
    }

    sectionsHtml += renderSection(cat, list);
  }

  // Any categories on disk not in the JSON go at the end.
  for (const [catId, list] of grouped) {
    if (categories.some(c => c.id === catId)) continue;
    const fallback: Category = { id: catId, label: catId, description: '', obsolete: false };
    sectionsHtml += renderSection(fallback, list);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>arian_'s JSFiddle archive</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:      #f2f2f7;
      --surface: #ffffff;
      --text:    #1c1c1e;
      --muted:   #6c6c70;
      --border:  #d1d1d6;
      --accent:  #007aff;
      --radius:  10px;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg:      #000000;
        --surface: #1c1c1e;
        --text:    #f2f2f7;
        --muted:   #8e8e93;
        --border:  #38383a;
        --accent:  #0a84ff;
      }
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 32px 24px;
      line-height: 1.5;
    }

    header {
      max-width: 1100px;
      margin: 0 auto 32px;
    }

    header h1 {
      font-size: 1.75rem;
      font-weight: 700;
    }

    .controls {
      max-width: 1100px;
      margin: 0 auto 28px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.9rem;
      color: var(--muted);
    }

    .controls select {
      padding: 5px 8px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--surface);
      color: var(--text);
      font-size: 0.9rem;
    }

    section {
      max-width: 1100px;
      margin: 0 auto 40px;
    }

    section > h2 {
      font-size: 1.2rem;
      font-weight: 600;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }

    .cat-desc {
      font-size: 0.85rem;
      color: var(--muted);
      margin: 6px 0 0;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
      margin-top: 14px;
    }

    .card {
      display: flex;
      flex-direction: column;
      background: var(--surface);
      border-radius: var(--radius);
      overflow: hidden;
      text-decoration: none;
      color: inherit;
      border: 1px solid var(--border);
      transition: border-color 0.15s;
    }

    .card:hover {
      border-color: var(--accent);
    }

    .thumb {
      aspect-ratio: 16 / 10;
      background: var(--border);
      overflow: hidden;
    }

    .thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .no-thumb {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--muted);
    }

    .info {
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .info strong {
      font-size: 0.95rem;
      line-height: 1.3;
    }

    .info p {
      font-size: 0.82rem;
      color: var(--muted);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .info time {
      font-size: 0.78rem;
      color: var(--muted);
    }

    hr.obsolete-divider {
      max-width: 1100px;
      margin: 0 auto 24px;
      border: none;
      border-top: 2px dashed var(--border);
    }

    p.obsolete-header {
      max-width: 1100px;
      margin: 0 auto 24px;
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    @media (max-width: 600px) {
      body { padding: 20px 16px; }
      header h1 { font-size: 1.4rem; }
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header>
    <h1>arian_'s JSFiddle archive</h1>
    <div>Originally hosted at jsfiddle.net: <a target="_blank" href="https://jsfiddle.net/u/arian_/fiddles/">https://jsfiddle.net/u/arian_/fiddles/</a></div>
    <div>Also see on GitHub: <a target="_blank" href="https://github.com/ariankordi/my-jsfiddles">https://github.com/ariankordi/my-jsfiddles</a></div>
  </header>

  <div class="controls">
    <label for="sort">Sort by:</label>
    <select id="sort">
      <option value="newest" selected>Newest first</option>
      <option value="oldest">Oldest first</option>
      <option value="name">Name</option>
    </select>
  </div>
${sectionsHtml}

  <script>
    document.getElementById('sort').addEventListener('change', function() {
      const mode = this.value;
      document.querySelectorAll('.grid').forEach(grid => {
        const cards = [...grid.querySelectorAll('.card')];
        cards.sort((a, b) => {
          if (mode === 'name') {
            return a.querySelector('strong').textContent
              .localeCompare(b.querySelector('strong').textContent);
          }
          const da = a.dataset.created || '';
          const db = b.dataset.created || '';
          return mode === 'newest' ? db.localeCompare(da) : da.localeCompare(db);
        });
        for (const card of cards) grid.appendChild(card);
      });
    });
  </script>
</body>
</html>`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

function run(): void {
  const categories: Category[] = JSON.parse(fs.readFileSync(CATEGORIES_PATH, 'utf8'));
  const fiddles = buildFiddleList();

  console.log(`${fiddles.length} fiddles across ${new Set(fiddles.map(f => f.category)).size} categories`);

  const html = generateHtml(categories, fiddles);
  fs.writeFileSync(OUTPUT_PATH, html);
  console.log(`Wrote ${OUTPUT_PATH}`);
}

run();
