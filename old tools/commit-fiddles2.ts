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
  console.error('  <username>   jsFiddle username (e.g., arian_)');
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

// function parseRevisionFromUrl(url: string): number {
//   const match = url.match(/\/(\d+)\/?$/);
//   return match ? Number.parseInt(match[1], 10) : 0;
// }

function getRevisionLookupUrl(
  id: string,
  revision: number
): string {
  return `https://${JSFIDDLE_HOST}/${username}/${id}/${
    revision > 0 ? revision + '/' : ''
  }`;
}

function createCommit(
  repoPath: string,
  fiddleId: string,
  revision: number,
  date: string,
  extracted: ExtractedFiddle,
  missingDates: Array<{ id: string; revision: number }>,
  nextDate: string | null
): void {
  const fiddleDir = path.join(repoPath, fiddleId);
  fs.mkdirSync(fiddleDir, { recursive: true });

  // Determine commit date. If missing, use next revision's date - 1 second.
  let commitDate = date;
  if (!date && nextDate) {
    const nextDateObj = new Date(nextDate);
    nextDateObj.setSeconds(nextDateObj.getSeconds() - 1);
    commitDate = nextDateObj.toISOString();
    missingDates.push({ id: fiddleId, revision });
  } else if (!date) {
    console.warn(
      `    ⚠ No date found for ${fiddleId}/${revision}, using current time`
    );
    commitDate = new Date().toISOString();
    missingDates.push({ id: fiddleId, revision });
  }

  // Write files.
  if (extracted.js) {
    const scriptPath = path.join(fiddleDir, 'script.js');
    fs.writeFileSync(scriptPath, extracted.js);
  }

  if (extracted.css) {
    const stylePath = path.join(fiddleDir, 'style.css');
    fs.writeFileSync(stylePath, extracted.css);
  }

  if (extracted.html) {
    const modifiedHtml = injectScriptAndStyle(
      extracted.html,
      extracted.css !== null,
      extracted.isEsModule
    );
    const indexPath = path.join(fiddleDir, 'index.html');
    fs.writeFileSync(indexPath, modifiedHtml);
  }

  // Stage files.
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

function injectScriptAndStyle(
  html: string,
  hasCss: boolean,
  isEsModule: boolean
): string {
  const headMatch = html.match(/<head[^>]*>/i);

  let injected = '';

  // Add CSS link if present.
  if (hasCss) {
    injected += '<link rel="stylesheet" href="style.css">\n';
  }

  // Add script tag with appropriate type.
  injected += isEsModule
    ? '<script type="module" src="script.js"></script>\n'
    : '<script src="script.js"></script>\n';

  if (headMatch) {
    // Inject after the opening <head> tag.
    const headEnd = headMatch.index! + headMatch[0].length;
    return html.slice(0, headEnd) + '\n' + injected + html.slice(headEnd);
  } else {
    // No <head>, prepend to document.
    return injected + html;
  }
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
      const revisionLookupUrl = getRevisionLookupUrl(fiddleId, revision);
      let date = dateMap[revisionLookupUrl];

      if (!date) {
        // Use next revision's date - 1 second.
        let nextDate: string | null = null;
        if (i + 1 < revisionFiles.length) {
          const nextRevision = Number.parseInt(
            revisionFiles[i + 1].replace('.html', ''),
            10
          );
          const nextUrl = getRevisionLookupUrl(fiddleId, nextRevision);
          nextDate = dateMap[nextUrl] || null;
        }
        date = nextDate || '';
      }

      const nextDate = i + 1 < revisionFiles.length
        ? dateMap[
          getRevisionLookupUrl(
            fiddleId,
            Number.parseInt(revisionFiles[i + 1].replace('.html', ''), 10)
          )
          ] || null
        : null;

      try {
        createCommit(
          gitRepo,
          fiddleId,
          revision,
          date,
          extracted,
          missingDates,
          nextDate
        );
      } catch (e) {
        if (e instanceof Error && 'output' in e && Array.isArray(e.output)) {
          const b = e.output[1] as Uint8Array;
          const decoder = new TextDecoder('utf-8');
          console.warn('text from command:\n', decoder.decode(b), '\n');
        }
        console.error(e);
      }

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
