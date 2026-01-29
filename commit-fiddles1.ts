import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { extractFiddleContent } from "./extract-jsfiddle";

interface DateMapping {
  [url: string]: string; // ISO 8601 date string.
}

/*
interface FiddleMetadata {
  id: string;
  latestVersion: number;
  createdDate: string;
}
*/

const FIDDLE_HOST = "jsfiddle.net";
const FIDDLE_DOWNLOADS = "fiddle_downloads";
const MISSING_DATES_LOG = "missing_dates.log";

function loadDatesCsv(csvPath: string): DateMapping {
  const content = fs.readFileSync(csvPath, "utf8");
  const lines = content.trim().split("\n");
  const mapping: DateMapping = {};

  for (const line of lines) {
    const [date, url] = line.split("|");
    if (date && url) {
      mapping[url.trim()] = date.trim();
    }
  }

  return mapping;
}

function getFiddleUrl(
  username: string,
  id: string,
  revision: number
): string {
  return `https://${FIDDLE_HOST}/${username}/${id}/${revision}/`;
}

function injectScriptAndStyle(
  html: string,
  hasScript: boolean,
  hasCss: boolean
): string {
  if (!hasScript && !hasCss) return html;

  // Find opening <head> tag.
  const headMatch = html.match(/<head\s*>/i);
  if (!headMatch) {
    // No <head> tag, inject at top before <body> or before first element.
    const bodyMatch = html.match(/<body\s*>/i);
    if (bodyMatch) {
      const insertPoint = bodyMatch.index! + bodyMatch[0].length;
      return (
        html.slice(0, insertPoint) +
        getInjectHtml(hasScript, hasCss) +
        html.slice(insertPoint)
      );
    } else {
      // No <body> either, inject at very top after doctype/html/etc.
      const htmlMatch = html.match(/<html[^>]*>/i);
      if (htmlMatch) {
        const insertPoint = htmlMatch.index! + htmlMatch[0].length;
        return (
          html.slice(0, insertPoint) +
          getInjectHtml(hasScript, hasCss) +
          html.slice(insertPoint)
        );
      } else {
        // Desperate: inject at top.
        return getInjectHtml(hasScript, hasCss) + html;
      }
    }
  }

  // Insert after <head> opening tag.
  const insertPoint = headMatch.index! + headMatch[0].length;
  return (
    html.slice(0, insertPoint) +
    getInjectHtml(hasScript, hasCss) +
    html.slice(insertPoint)
  );
}

function getInjectHtml(hasScript: boolean, hasCss: boolean): string {
  const lines: string[] = [];

  if (hasCss) {
    lines.push('  <link rel="stylesheet" href="style.css">');
  }

  if (hasScript) {
    lines.push('  <script src="script.js"></script>');
  }

  return lines.join("\n") + "\n";
}

function getScriptTag(
  jsContent: string,
  isEsModule: boolean
): string {
  const typeAttr = isEsModule ? ' type="module"' : "";
  return `<script${typeAttr}>\n${jsContent}\n</script>\n`;
}

function getStyleTag(cssContent: string): string {
  return `<style>\n${cssContent}\n</style>\n`;
}

function commitWithDate(
  repoPath: string,
  authorDate: string,
  message: string
): void {
  const env = {
    ...process.env,
    GIT_AUTHOR_DATE: authorDate,
    GIT_COMMITTER_DATE: authorDate,
  };

  execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
    cwd: repoPath,
    env,
  });
}

async function processFiddle(
  username: string,
  id: string,
  latestVersion: number,
  createdDate: string,
  repoPath: string,
  datesMapping: DateMapping,
  missingDatesLog: fs.WriteStream
): Promise<void> {
  const fiddleDir = path.join(FIDDLE_DOWNLOADS, id);
  const repoDirForFiddle = path.join(repoPath, id);

  fs.mkdirSync(repoDirForFiddle, { recursive: true });

  // Ensure we're on the correct branch (create if needed).
  try
  {
    execSync(`git checkout -b ${id}`, {
      cwd: repoPath,
      stdio: "pipe",
    });
  }
  catch (e) {
    execSync(`git checkout ${id}`, { cwd: repoPath });
  }

  for (let rev = 0; rev <= latestVersion; rev++) {
    const htmlPath = path.join(fiddleDir, `${rev}.html`);

    if (!fs.existsSync(htmlPath)) {
      console.warn(`  Revision ${rev}: HTML file not found, skipping`);
      continue;
    }

    const htmlContent = fs.readFileSync(htmlPath, "utf8");
    let extracted;

    try {
      extracted = extractFiddleContent(htmlContent);
    } catch (error) {
      console.error(`  Revision ${rev}: Extraction failed:`, error);
      continue;
    }

    // Determine commit date.
    const fiddleUrl = getFiddleUrl(username, id, rev);
    let commitDate = datesMapping[fiddleUrl];

    if (!commitDate) {
      // Try to use next revision's date, minus 1 second.
      if (rev < latestVersion) {
        const nextUrl = getFiddleUrl(username, id, rev + 1);
        const nextDate = datesMapping[nextUrl];
        if (nextDate) {
          const date = new Date(nextDate);
          date.setSeconds(date.getSeconds() - 1);
          commitDate = date.toISOString();
        }
      }

      if (!commitDate) {
        // Fall back to created date.
        commitDate = createdDate;
        missingDatesLog.write(
          `${id} revision ${rev}: using created date\n`
        );
      }
    }

    // Build file content.
    let modifiedHtml = injectScriptAndStyle(
      extracted.html,
      true,
      extracted.css !== null
    );

    // Write files.
    const indexPath = path.join(repoDirForFiddle, "index.html");
    fs.writeFileSync(indexPath, modifiedHtml);

    const scriptPath = path.join(repoDirForFiddle, "script.js");
    fs.writeFileSync(scriptPath, extracted.js);

    if (extracted.css) {
      const stylePath = path.join(repoDirForFiddle, "style.css");
      fs.writeFileSync(stylePath, extracted.css);
    }

    // Stage files.
    execSync("git add .", { cwd: repoDirForFiddle });

    // Commit.
    const message = `Revision ${rev}`;
    commitWithDate(repoPath, commitDate, message);

    console.log(
      `  Revision ${rev}: committed (${commitDate.split("T")[0]})`
    );
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 4) {
    console.error(
      "Usage: npx ts-node commit-fiddles.ts " +
        "<repo-path> <username> <dates-csv> <fiddle-list-json>"
    );
    console.error("  <repo-path>         Git repository path");
    console.error("  <username>          jsFiddle username");
    console.error("  <dates-csv>         CSV from safari-first-visit-to-csv");
    console.error("  <fiddle-list-json>  JSON from jsFiddle API");
    process.exit(1);
  }

  const [repoPath, username, datesCsv, fiddleListJson] = args;

  if (!fs.existsSync(repoPath)) {
    console.error(`Repository not found: ${repoPath}`);
    process.exit(1);
  }

  const datesMapping = loadDatesCsv(datesCsv);
  const fiddleList = JSON.parse(fs.readFileSync(fiddleListJson, "utf8"));

  const missingDatesLog = fs.createWriteStream(MISSING_DATES_LOG);

  for (const fiddle of fiddleList) {
    const url = fiddle.url.replace("//", "https://");
    const idMatch = url.match(/\/([a-z0-9]+)\//);
    if (!idMatch) {
      console.warn(`Cannot extract ID from ${url}, skipping`);
      continue;
    }

    const id = idMatch[1];
    console.log(`Processing ${id}...`);

    try {
      await processFiddle(
        username,
        id,
        fiddle.latest_version,
        fiddle.created,
        repoPath,
        datesMapping,
        missingDatesLog
      );
    } catch (error) {
      console.error(`Failed to process ${id}:`, error);
    }
  }

  missingDatesLog.end();
  console.log(`\nDone. Check ${MISSING_DATES_LOG} for missing dates.`);
}

main();
