import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { extractFiddleContent } from './extract-jsfiddle.ts';
import type { ExtractedFiddle } from './extract-jsfiddle.ts';

/* globals process -- for node */

interface DateMapping {
  [key: string]: string;
}

interface NameMapping {
  [fiddleId: string]: string;
}

interface RevisionEntry {
  fiddleId: string;
  shortname: string;
  revision: number;
  date: string;
  revisionPath: string;
}

const JSFIDDLE_HOST = 'jsfiddle.net';
const FIDDLE_DOWNLOADS = 'fiddle_downloads';

if (process.argv.length < 5) {
  console.error(
    'Usage: npx ts-node commit-fiddles3.ts <git-repo> <csv-file> <username> [names-csv]'
  );
  console.error('  <git-repo>   Path to git repository');
  console.error('  <csv-file>   Path to merged history CSV');
  console.error('  <username>   JSFiddle username (e.g., arian_)');
  console.error('  [names-csv]  Path to "fiddle names.csv" (id,shortname)');
  process.exit(1);
}

const gitRepo = process.argv[2];
const csvFile = process.argv[3];
const username = process.argv[4];
const namesCsvFile = process.argv[5] ?? null;

function loadDateMap(csvPath: string): DateMapping {
  const csv = fs.readFileSync(csvPath, 'utf8');
  const lines = csv.split('\n').filter(line => line.trim());
  const map: DateMapping = {};

  for (const line of lines) {
    const commaIdx = line.indexOf(',');
    if (commaIdx === -1) continue;
    const date = line.slice(0, commaIdx).trim();
    const url = line.slice(commaIdx + 1).trim();
    if (!date || !url) continue;

    // Strip query params and hash, normalize trailing slash.
    let cleanUrl = url.split(/[?#]/)[0];
    if (!cleanUrl.endsWith('/')) cleanUrl += '/';

    // Keep earliest date for a given URL.
    if (!map[cleanUrl] || date < map[cleanUrl]) {
      map[cleanUrl] = date;
    }
  }

  return map;
}

function loadNameMap(csvPath: string): NameMapping {
  const csv = fs.readFileSync(csvPath, 'utf8');
  const lines = csv.split('\n').filter(line => line.trim());
  const map: NameMapping = {};

  for (const line of lines) {
    const [id, shortname] = line.split(',');
    if (id && shortname && id !== 'id') {
      map[id.trim()] = shortname.trim();
    }
  }

  return map;
}

function getRevisionLookupUrl(id: string, revision: number): string {
  return `https://${JSFIDDLE_HOST}/${username}/${id}/${
    revision > 0 ? revision + '/' : ''
  }`;
}

function injectScriptTag(html: string): string {
  const bodyEndMatch = html.match(/<\/body\s*>/i);
  const htmlEndMatch = html.match(/<\/html\s*>/i);

  const scriptTag = '<script src="script.js"></script>\n';

  if (bodyEndMatch) {
    const pos = bodyEndMatch.index!;
    return html.slice(0, pos) + scriptTag + html.slice(pos);
  }

  if (htmlEndMatch) {
    const pos = htmlEndMatch.index!;
    return html.slice(0, pos) + scriptTag + html.slice(pos);
  }

  return html + scriptTag;
}

function injectCssLink(html: string): string {
  const headEndMatch = html.match(/<\/head\s*>/i);

  const cssLink = '<link rel="stylesheet" href="style.css">\n';

  if (headEndMatch) {
    const pos = headEndMatch.index!;
    return html.slice(0, pos) + cssLink + html.slice(pos);
  }

  return cssLink + html;
}

function modifyHtml(
  html: string,
  hasJs: boolean,
  hasCss: boolean,
  isEsModule: boolean
): string {
  let result = html;

  if (hasJs) {
    result = injectScriptTag(result);
  }

  if (hasCss) {
    result = injectCssLink(result);
  }

  if (isEsModule) {
    const scriptMatch = result.match(/<script\s+src="script\.js">/i);
    if (scriptMatch) {
      result =
        result.slice(0, scriptMatch.index!) +
        '<script type="module" src="script.js">' +
        result.slice(scriptMatch.index! + scriptMatch[0].length);
    }
  }

  return result;
}

function hasChanges(repoPath: string): boolean {
  const status = execSync('git status', { cwd: repoPath });
  const decoder = new TextDecoder();
  const statusStr = decoder.decode(status);
  return !statusStr.includes('nothing to commit');
}

function createCommit(
  repoPath: string,
  entry: RevisionEntry,
  extracted: ExtractedFiddle
): void {
  const dirName = entry.shortname;
  const fiddleDir = path.join(repoPath, dirName);
  fs.mkdirSync(fiddleDir, { recursive: true });

  // Write JS if present.
  if (extracted.js) {
    fs.writeFileSync(path.join(fiddleDir, 'script.js'), extracted.js);
  }

  // Write CSS if present.
  if (extracted.css) {
    fs.writeFileSync(path.join(fiddleDir, 'style.css'), extracted.css);
  }

  // Write HTML if present.
  if (extracted.html) {
    const html = modifyHtml(
      extracted.html,
      extracted.js !== null,
      extracted.css !== null,
      extracted.isEsModule
    );
    fs.writeFileSync(path.join(fiddleDir, 'index.html'), html);
  }

  // Check for actual changes.
  if (!hasChanges(repoPath)) {
    console.log(`    ⊘ No changes, skipping commit`);
    return;
  }

  execSync(`git add "${dirName}"`, { cwd: repoPath });

  // Commit with date.
  const env = {
    ...process.env,
    GIT_AUTHOR_DATE: entry.date,
    GIT_COMMITTER_DATE: entry.date
  };

  execSync(
    `git commit -m "${dirName}: revision ${entry.revision}"`,
    { cwd: repoPath, env }
  );
}

function resolveDate(
  fiddleId: string,
  revision: number,
  dateMap: DateMapping,
  missingDates: Array<{ id: string; revision: number }>
): string | null {
  const url = getRevisionLookupUrl(fiddleId, revision);
  const date = dateMap[url];
  if (date) return date;

  // Fall back to previous revision's date minus 1s.
  for (let rev = revision - 1; rev >= 0; rev--) {
    const prevUrl = getRevisionLookupUrl(fiddleId, rev);
    const prevDate = dateMap[prevUrl];
    if (prevDate) {
      console.warn(
        `  ✗ ${fiddleId} rev ${revision}: no date, using previous rev ${rev} date`
      );
      missingDates.push({ id: fiddleId, revision });
      const d = new Date(prevDate);
      d.setSeconds(d.getSeconds() - 1);
      return d.toISOString();
    }
  }

  console.error(`  ✗ ${fiddleId} rev ${revision}: no date found at all, skipping`);
  return null;
}

async function run(): Promise<void> {
  if (!fs.existsSync(gitRepo)) {
    console.error(`Git repo not found: ${gitRepo}`);
    process.exit(1);
  }

  if (!fs.existsSync(csvFile)) {
    console.error(`CSV file not found: ${csvFile}`);
    process.exit(1);
  }

  const dateMap = loadDateMap(csvFile);
  const nameMap: NameMapping = namesCsvFile ? loadNameMap(namesCsvFile) : {};
  const missingDates: Array<{ id: string; revision: number }> = [];

  // Collect all revisions across all fiddles with resolved dates.
  const allRevisions: RevisionEntry[] = [];

  const fiddles = fs
    .readdirSync(FIDDLE_DOWNLOADS)
    .filter(f => fs.statSync(path.join(FIDDLE_DOWNLOADS, f)).isDirectory());

  for (const fiddleId of fiddles) {
    const fiddleDir = path.join(FIDDLE_DOWNLOADS, fiddleId);
    const shortname = nameMap[fiddleId] ?? fiddleId;

    const revisionFiles = fs
      .readdirSync(fiddleDir)
      .filter(f => f.endsWith('.html'))
      .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));

    for (const revisionFile of revisionFiles) {
      const revision = Number.parseInt(revisionFile.replace('.html', ''), 10);
      const revisionPath = path.join(fiddleDir, revisionFile);

      const date = resolveDate(fiddleId, revision, dateMap, missingDates);
      if (!date) continue;

      allRevisions.push({ fiddleId, shortname, revision, date, revisionPath });
    }
  }

  // Sort all revisions globally by date.
  allRevisions.sort((a, b) => a.date.localeCompare(b.date));

  console.log(`Processing ${allRevisions.length} revisions across ${fiddles.length} fiddles...`);

  // Ensure we're on main.
  // execSync('git checkout main', { cwd: gitRepo, stdio: 'pipe' });

  for (const entry of allRevisions) {
    const htmlContent = fs.readFileSync(entry.revisionPath, 'utf8');

    let extracted: ExtractedFiddle;
    try {
      extracted = extractFiddleContent(htmlContent);
    } catch (error) {
      console.error(
        `  ✗ ${entry.shortname} rev ${entry.revision}: extraction failed:`,
        error
      );
      continue;
    }

    createCommit(gitRepo, entry, extracted);
    console.log(`  ✓ ${entry.shortname} rev ${entry.revision} @ ${entry.date}`);
  }

  if (missingDates.length > 0) {
    console.warn('\nRevisions with estimated dates (no history entry found):');
    for (const { id, revision } of missingDates) {
      console.warn(`  ${id}/${revision}`);
    }
  }

  console.log('Done!');
}

run().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
