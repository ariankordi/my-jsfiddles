import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEST_REPO = path.join(__dirname, 'test-repo');
const CSV_PATH = path.join(__dirname, 'gallery-metadata.csv');
const JSFIDDLE_JSON_PATH = path.join(__dirname, 'jsfiddle-arian_-list.json');
const OUTPUT_PATH = path.join(TEST_REPO, 'index.html');

const CATEGORY_LABELS: Record<string, string> = {
  'mii-useful': 'Mii Tools',
  'mii-useless': 'Mii Experiments',
  'misc-useful': 'Miscellaneous Tools',
  'misc-useless': 'Miscellaneous',
};

// Display order for categories.
const CATEGORY_ORDER = ['mii-useful', 'misc-useful', 'mii-useless', 'misc-useless'];

interface FiddleInfo {
  shortname: string;
  category: string;
  title: string;
  description: string;
  created: string;
  hasScreenshot: boolean;
}

interface CsvRow {
  shortname: string;
  category: string;
  title: string;
  description: string;
  created: string;
}

function parseCsv(csvPath: string): CsvRow[] {
  if (!fs.existsSync(csvPath)) return [];
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.trim().split('\n');
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

    rows.push({
      shortname: fields[0] || '',
      category: fields[1] || '',
      title: fields[2] || '',
      description: fields[3] || '',
      created: fields[4] || '',
    });
  }
  return rows;
}

interface JsFiddleEntry {
  title: string;
  description: string;
  url: string;
  created: string;
}

function loadJsFiddleJson(jsonPath: string): Map<string, JsFiddleEntry> {
  if (!fs.existsSync(jsonPath)) return new Map();
  const data: JsFiddleEntry[] = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const map = new Map<string, JsFiddleEntry>();
  for (const item of data) {
    // Extract ID from URL like "//jsfiddle.net/arian_/h31tdg7r/"
    const match = item.url.match(/\/([^/]+)\/$/);
    if (match) map.set(match[1], item);
  }
  return map;
}

function discoverFiddles(): Array<{ category: string; shortname: string }> {
  const entries: Array<{ category: string; shortname: string }> = [];
  const categories = fs.readdirSync(TEST_REPO).filter(d => {
    const full = path.join(TEST_REPO, d);
    return fs.statSync(full).isDirectory()
      && !d.startsWith('.')
      && !d.startsWith('DONOTINCLUDE')
      && d !== 'screenshots';
  });

  for (const category of categories) {
    const catPath = path.join(TEST_REPO, category);
    const fiddles = fs.readdirSync(catPath).filter(d =>
      fs.statSync(path.join(catPath, d)).isDirectory()
    );
    for (const shortname of fiddles) {
      entries.push({ category, shortname });
    }
  }
  return entries;
}

function buildFiddleList(): FiddleInfo[] {
  // Load the id→shortname mapping to connect jsfiddle JSON to directory names.
  const idCsvPath = path.join(__dirname, '! fiddle names.csv');
  const idCsv = fs.readFileSync(idCsvPath, 'utf8').trim().split('\n').slice(1);
  const shortnameToId = new Map<string, string>();
  for (const line of idCsv) {
    const [id, shortname] = line.split(',');
    shortnameToId.set(shortname, id);
  }

  // Also build a dirname→id map for mismatched names.
  // Known mismatches: amiibo-mii-decoder↔mii-amiibo-decoder, effsd-poc-0↔mii-effsd-poc-0, etc.
  const dirnameToId = new Map<string, string>();
  for (const [shortname, id] of shortnameToId) {
    dirnameToId.set(shortname, id);
    // Strip common prefixes for fuzzy matching.
    const stripped = shortname.replace(/^mii-/, '').replace(/^misc-/, '');
    if (!dirnameToId.has(stripped)) {
      dirnameToId.set(stripped, id);
    }
  }

  const csvRows = parseCsv(CSV_PATH);
  const csvMap = new Map<string, CsvRow>();
  for (const row of csvRows) {
    csvMap.set(row.shortname, row);
  }

  const jsMap = loadJsFiddleJson(JSFIDDLE_JSON_PATH);
  const discovered = discoverFiddles();
  const screenshotsDir = path.join(TEST_REPO, 'screenshots');

  const fiddles: FiddleInfo[] = [];
  for (const { category, shortname } of discovered) {
    const csv = csvMap.get(shortname);
    const fiddleId = dirnameToId.get(shortname);
    const js = fiddleId ? jsMap.get(fiddleId) : undefined;

    const title = csv?.title || js?.title || '';
    const description = csv?.description || js?.description || '';
    const created = csv?.created || (js?.created ? js.created.split(' ')[0] : '');

    const screenshotPath = path.join(screenshotsDir, `${shortname}.jpg`);
    const hasScreenshot = fs.existsSync(screenshotPath);

    fiddles.push({
      shortname,
      category,
      title,
      description,
      created,
      hasScreenshot,
    });
  }

  return fiddles;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function generateCard(fiddle: FiddleInfo): string {
  const displayTitle = escapeHtml(fiddle.title || fiddle.shortname);
  const displayDesc = fiddle.description
    ? escapeHtml(fiddle.description.length > 150
        ? fiddle.description.slice(0, 147) + '...'
        : fiddle.description)
    : '';
  const href = `${fiddle.category}/${fiddle.shortname}/index.html`;
  const screenshotSrc = fiddle.hasScreenshot
    ? `screenshots/${fiddle.shortname}.jpg`
    : '';
  const dateStr = formatDate(fiddle.created);

  return `      <a class="card" href="${escapeHtml(href)}" data-created="${escapeHtml(fiddle.created)}">
        <div class="card-img">${
          screenshotSrc
            ? `<img src="${escapeHtml(screenshotSrc)}" alt="${displayTitle}" loading="lazy">`
            : `<div class="placeholder">${escapeHtml(fiddle.shortname.slice(0, 2).toUpperCase())}</div>`
        }</div>
        <div class="card-body">
          <h3>${displayTitle}</h3>${
            displayDesc ? `\n          <p>${displayDesc}</p>` : ''
          }${
            dateStr ? `\n          <time>${escapeHtml(dateStr)}</time>` : ''
          }
        </div>
      </a>`;
}

function generateHtml(fiddles: FiddleInfo[]): string {
  // Group by category.
  const grouped = new Map<string, FiddleInfo[]>();
  for (const f of fiddles) {
    const list = grouped.get(f.category) || [];
    list.push(f);
    grouped.set(f.category, list);
  }

  // Sort within each category by title/shortname.
  for (const list of grouped.values()) {
    list.sort((a, b) => (a.title || a.shortname).localeCompare(b.title || b.shortname));
  }

  let sectionsHtml = '';
  for (const cat of CATEGORY_ORDER) {
    const list = grouped.get(cat);
    if (!list || list.length === 0) continue;
    const label = CATEGORY_LABELS[cat] || cat;
    sectionsHtml += `
    <section class="category" data-category="${escapeHtml(cat)}">
      <h2>${escapeHtml(label)}</h2>
      <div class="grid">
${list.map(f => generateCard(f)).join('\n')}
      </div>
    </section>`;
  }

  // Also include any categories not in CATEGORY_ORDER.
  for (const [cat, list] of grouped) {
    if (CATEGORY_ORDER.includes(cat)) continue;
    const label = CATEGORY_LABELS[cat] || cat;
    sectionsHtml += `
    <section class="category" data-category="${escapeHtml(cat)}">
      <h2>${escapeHtml(label)}</h2>
      <div class="grid">
${list.map(f => generateCard(f)).join('\n')}
      </div>
    </section>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>JSFiddle Archive</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }

    :root {
      --bg: #f5f5f7;
      --surface: #fff;
      --text: #1d1d1f;
      --text-secondary: #6e6e73;
      --border: #d2d2d7;
      --accent: #0066cc;
      --shadow: rgba(0, 0, 0, 0.08);
      --radius: 12px;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #1c1c1e;
        --surface: #2c2c2e;
        --text: #f5f5f7;
        --text-secondary: #98989d;
        --border: #38383a;
        --accent: #409cff;
        --shadow: rgba(0, 0, 0, 0.3);
      }
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 24px;
      line-height: 1.5;
    }

    header {
      max-width: 1200px;
      margin: 0 auto 32px;
    }

    header h1 {
      font-size: 2rem;
      font-weight: 700;
      margin: 0 0 8px;
    }

    header p {
      color: var(--text-secondary);
      margin: 0;
      font-size: 1.05rem;
    }

    .controls {
      max-width: 1200px;
      margin: 0 auto 24px;
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: center;
    }

    .controls label {
      color: var(--text-secondary);
      font-size: 0.9rem;
    }

    .controls select {
      padding: 6px 10px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      color: var(--text);
      font-size: 0.9rem;
    }

    .category {
      max-width: 1200px;
      margin: 0 auto 40px;
    }

    .category h2 {
      font-size: 1.4rem;
      font-weight: 600;
      margin: 0 0 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }

    .card {
      display: block;
      background: var(--surface);
      border-radius: var(--radius);
      overflow: hidden;
      text-decoration: none;
      color: inherit;
      box-shadow: 0 1px 3px var(--shadow);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px var(--shadow);
    }

    .card-img {
      aspect-ratio: 16 / 10;
      overflow: hidden;
      background: var(--border);
    }

    .card-img img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .card-img .placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      font-weight: 700;
      color: var(--text-secondary);
      background: var(--border);
    }

    .card-body {
      padding: 14px 16px;
    }

    .card-body h3 {
      font-size: 1rem;
      font-weight: 600;
      margin: 0 0 4px;
      line-height: 1.3;
    }

    .card-body p {
      font-size: 0.85rem;
      color: var(--text-secondary);
      margin: 0 0 8px;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .card-body time {
      font-size: 0.8rem;
      color: var(--text-secondary);
    }

    @media (max-width: 600px) {
      body { padding: 16px; }
      header h1 { font-size: 1.5rem; }
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header>
    <h1>JSFiddle Archive</h1>
    <p>A collection of tools and experiments, originally hosted on JSFiddle.</p>
  </header>

  <div class="controls">
    <label for="sort-select">Sort by:</label>
    <select id="sort-select">
      <option value="name">Name</option>
      <option value="newest">Newest first</option>
      <option value="oldest">Oldest first</option>
    </select>
  </div>
${sectionsHtml}

  <script>
    const sortSelect = document.getElementById('sort-select');
    sortSelect.addEventListener('change', () => {
      const mode = sortSelect.value;
      document.querySelectorAll('.grid').forEach(grid => {
        const cards = Array.from(grid.querySelectorAll('.card'));
        cards.sort((a, b) => {
          if (mode === 'name') {
            return a.querySelector('h3').textContent.localeCompare(b.querySelector('h3').textContent);
          }
          const dateA = a.dataset.created || '';
          const dateB = b.dataset.created || '';
          if (mode === 'newest') return dateB.localeCompare(dateA);
          return dateA.localeCompare(dateB);
        });
        for (const card of cards) grid.appendChild(card);
      });
    });
  </script>
</body>
</html>`;
}

function run(): void {
  const fiddles = buildFiddleList();
  console.log(`Found ${fiddles.length} fiddles across ${new Set(fiddles.map(f => f.category)).size} categories`);

  const html = generateHtml(fiddles);
  fs.writeFileSync(OUTPUT_PATH, html);
  console.log(`Wrote ${OUTPUT_PATH}`);
}

run();
