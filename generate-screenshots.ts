import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEST_REPO = path.join(__dirname, 'test-repo');
const SCREENSHOTS_DIR = path.join(TEST_REPO, 'screenshots');
const CONCURRENCY = 3;
const VIEWPORT = { width: 1280, height: 800 };
const EXTRA_DELAY_MS = 2500;

interface FiddleEntry {
  category: string;
  shortname: string;
}

function discoverFiddles(): FiddleEntry[] {
  const entries: FiddleEntry[] = [];
  const categories = fs.readdirSync(TEST_REPO).filter(d => {
    const full = path.join(TEST_REPO, d);
    return fs.statSync(full).isDirectory()
      && !d.startsWith('.')
      && !d.startsWith('DONOTINCLUDE');
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

function shouldSkip(entry: FiddleEntry): boolean {
  const screenshotPath = path.join(SCREENSHOTS_DIR, `${entry.shortname}.jpg`);
  if (!fs.existsSync(screenshotPath)) return false;

  const indexPath = path.join(TEST_REPO, entry.category, entry.shortname, 'index.html');
  if (!fs.existsSync(indexPath)) return true;

  const screenshotMtime = fs.statSync(screenshotPath).mtimeMs;
  const indexMtime = fs.statSync(indexPath).mtimeMs;
  return screenshotMtime > indexMtime;
}

async function screenshotFiddle(
  browser: puppeteer.Browser,
  entry: FiddleEntry
): Promise<void> {
  const indexPath = path.join(TEST_REPO, entry.category, entry.shortname, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.warn(`  ⚠ ${entry.shortname}: no index.html, skipping`);
    return;
  }

  const page = await browser.newPage();
  try {
    await page.setViewport(VIEWPORT);
    const fileUrl = `file://${indexPath}`;
    // Use load event; networkidle2 can hang on pages with persistent CDN connections.
    await page.goto(fileUrl, { waitUntil: 'load', timeout: 60_000 });
    // Scroll to bottom and back to trigger loading="lazy" images, then wait for them to load.
    await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); window.scrollTo(0, 0); });
    // Extra delay for heavy pages (three.js, external CDN scripts, ES module imports).
    await new Promise(r => setTimeout(r, EXTRA_DELAY_MS));

    const outputPath = path.join(SCREENSHOTS_DIR, `${entry.shortname}.jpg`);
    await page.screenshot({ path: outputPath, type: 'jpeg', quality: 95 });
    console.log(`  ✓ ${entry.shortname}`);
  } catch (error) {
    console.error(`  ✗ ${entry.shortname}: ${error instanceof Error ? error.message : error}`);
  } finally {
    await page.close();
  }
}

async function run(): Promise<void> {
  const fiddles = discoverFiddles();
  console.log(`Found ${fiddles.length} fiddles`);

  // Filter out already-up-to-date screenshots.
  const toProcess = fiddles.filter(f => !shouldSkip(f));
  console.log(`${toProcess.length} need screenshots (${fiddles.length - toProcess.length} skipped)`);

  if (toProcess.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const headless = !process.argv.includes('--no-headless');
  const browser = await puppeteer.launch({
    headless,
    // patch to make ES modules actually function in file://
    // because usually they do not. what the flip man!
    args: ['--disable-web-security', '--allow-file-access-from-files']
  });
  try {
    // Process in batches of CONCURRENCY.
    for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
      const batch = toProcess.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(entry => screenshotFiddle(browser, entry)));
    }
  } finally {
    await browser.close();
  }

  console.log('Done!');
}

run().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
