import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { extractFiddleContent } from './extract-jsfiddle.ts';
import type { ExtractedFiddle } from './extract-jsfiddle.ts';

/* globals process -- for node */

interface DateMapping {
  [key: string]: string;
}

const JSFIDDLE_HOST = 'jsfiddle.net';
const FIDDLE_DOWNLOADS = 'fiddle_downloads';

if (process.argv.length < 5) {
  console.error(
    'Usage: npx ts-node commit-fiddles.ts <git-repo> <csv-file> <username>'
  );
  console.error('  <git-repo>   Path to git repository');
  console.error('  <csv-file>   Path to history.csv from safari-first-visit');
  console.error('  <username>   JSFiddle username (e.g., arian_)');
  process.exit(1);
}

const gitRepo = process.argv[2];
const csvFile = process.argv[3];
const username = process.argv[4];

function loadDateMap(csvPath: string): DateMapping {
  const csv = fs.readFileSync(csvPath, 'utf8');
  const lines = csv.split('\n').filter(line => line.trim());
  const map: DateMapping = {};

  for (const line of lines) {
    const [date, url] = line.split(',');
    if (date && url) {
      const trimmedUrl = url.trim().split(/[?#]/)[0];
      map[trimmedUrl] = date.trim();
    }
  }

  return map;
}

function getRevisionLookupUrl(
  id: string,
  revision: number
): string {
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

function hasChanges(repoPath: string, fiddleId: string): boolean {
  /*
  try {
    const diff = execSync(`git diff --quiet`, {
      cwd: repoPath
    });
    return false;
  } catch {
    return true;
  }
  */
  const status = execSync('git status', { cwd: repoPath });
  const decoder = new TextDecoder();
  const statusStr = decoder.decode(status);
  return !statusStr.includes('nothing to commit');
}

function findLastKnownDate(
  dateMap: DateMapping,
  fiddleId: string,
  upToRevision: number
): string | null {
  for (let rev = upToRevision - 1; rev >= 0; rev--) {
    const url = getRevisionLookupUrl(fiddleId, rev);
    if (dateMap[url]) {
      return dateMap[url];
    }
  }
  return null;
}

function createCommit(
  repoPath: string,
  fiddleId: string,
  revision: number,
  commitDate: string,
  extracted: ExtractedFiddle,
  missingDates: Array<{ id: string; revision: number }>
): void {
  const fiddleDir = path.join(repoPath, fiddleId);
  fs.mkdirSync(fiddleDir, { recursive: true });

  // Write JS if present.
  if (extracted.js) {
    const scriptPath = path.join(fiddleDir, 'script.js');
    fs.writeFileSync(scriptPath, extracted.js);
  }

  // Write CSS if present.
  if (extracted.css) {
    const stylePath = path.join(fiddleDir, 'style.css');
    fs.writeFileSync(stylePath, extracted.css);
  }

  // Write HTML if present.
  if (extracted.html) {
    const html = modifyHtml(
      extracted.html,
      extracted.js !== null,
      extracted.css !== null,
      extracted.isEsModule
    );
    const indexPath = path.join(fiddleDir, 'index.html');
    fs.writeFileSync(indexPath, html);
  }

  // Check for actual changes.
  if (!hasChanges(repoPath, fiddleId)) {
    console.log(`    ⊘ No changes, skipping commit`);
    return;
  }

  execSync(`git add ${fiddleId}`, { cwd: repoPath });

  // Commit with date.
  const env = {
    ...process.env,
    GIT_AUTHOR_DATE: commitDate,
    GIT_COMMITTER_DATE: commitDate
  };

  execSync(`git commit -m "Revision ${revision}"`, {
    cwd: repoPath,
    env
  });
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
  const missingDates: Array<{ id: string; revision: number }> = [];

  // Always start on main.
    execSync('git checkout main', { cwd: gitRepo, stdio: 'pipe' });

  const fiddles = fs
    .readdirSync(FIDDLE_DOWNLOADS)
    .filter(
      f =>
        fs.statSync(path.join(FIDDLE_DOWNLOADS, f)).isDirectory()
    );

  for (const fiddleId of fiddles) {
    const fiddleDir = path.join(FIDDLE_DOWNLOADS, fiddleId);
    const revisionFiles = fs
      .readdirSync(fiddleDir)
      .filter(f => f.endsWith('.html'))
      .sort(
        (a, b) =>
          Number.parseInt(a, 10) - Number.parseInt(b, 10)
      );

    console.log(`Processing ${fiddleId}...`);

    // Create/checkout branch for this fiddle.
    try {
      execSync(`git rev-parse --verify ${fiddleId}`, {
        cwd: gitRepo,
        stdio: 'pipe'
      });
      execSync(`git checkout ${fiddleId}`, { cwd: gitRepo });
    } catch {
      execSync(`git checkout -b ${fiddleId}`, { cwd: gitRepo });
    }

    // Clean out old content for fresh slate.
    const fiddleDirInRepo = path.join(gitRepo, fiddleId);
    if (fs.existsSync(fiddleDirInRepo)) {
      fs.rmSync(fiddleDirInRepo, { recursive: true });
    }

    for (let i = 0; i < revisionFiles.length; i++) {
      const revisionFile = revisionFiles[i];
      const revision = Number.parseInt(revisionFile.replace('.html', ''), 10);
      const revisionPath = path.join(fiddleDir, revisionFile);

      const htmlContent = fs.readFileSync(revisionPath, 'utf8');

      let extracted: ExtractedFiddle;
      try {
        extracted = extractFiddleContent(htmlContent);
      } catch (error) {
        console.error(
          `  ✗ Revision ${revision}: extraction failed:`,
          error
        );
        continue;
      }

      // Look up date.
      const revisionUrl = getRevisionLookupUrl(fiddleId, revision);
      let date = dateMap[revisionUrl];

      if (!date) {
        const lastKnown = findLastKnownDate(dateMap, fiddleId, revision);
        if (lastKnown) {
          console.warn(
            `  ✗ Revision ${revision}: no date found, using previous date`
          );
          const lastDate = new Date(lastKnown);
          lastDate.setSeconds(lastDate.getSeconds() - 1);
          date = lastDate.toISOString();
          missingDates.push({ id: fiddleId, revision });
        } else {
          console.error(
            `  ✗ Revision ${revision}: no date found and no previous dates`
          );
          continue;
        }
      }

      createCommit(
        gitRepo,
        fiddleId,
        revision,
        date,
        extracted,
        missingDates
      );

      console.log(`  ✓ Revision ${revision} committed`);
    }

    // Return to main after finishing branch.
      execSync('git checkout main', { cwd: gitRepo });
  }

  if (missingDates.length > 0) {
    console.warn('\nMissing dates (used next revision - 1s or current time):');
    for (const { id, revision } of missingDates) {
      console.warn(`  ${id}/${revision}`);
    }
  }

  console.log('Done!');
}

try {
  await run();
} catch (error) {
  console.error('Fatal error:', error);
  process.exit(1);
}
