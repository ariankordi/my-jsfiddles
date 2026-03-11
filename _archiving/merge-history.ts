import fs from 'node:fs';
import path from 'node:path';
/* globals process */

interface HistoryEntry {
  date: string;
  url: string;
}

function parseCSV(filePath: string): HistoryEntry[] {
  const content = fs.readFileSync(filePath, 'utf8');
  return content
    .trim()
    .split('\n')
    .slice(1) // skip header
    .map((line) => {
      const [date, ...urlParts] = line.split(',');
      return {
        date,
        url: urlParts.join(',') // handle URLs with commas
      };
    });
}

function normalizeUrl(url: string): string {
  let clean = url.split(/[?#]/)[0];
  if (!clean.endsWith('/')) clean += '/';
  return clean;
}

function mergeAndDedup(entries: HistoryEntry[]): HistoryEntry[] {
  const urlMap = new Map<string, string>();

  for (const entry of entries) {
    const key = normalizeUrl(entry.url);
    const existing = urlMap.get(key);
    if (!existing || entry.date < existing) {
      urlMap.set(key, entry.date);
    }
  }

  return Array.from(urlMap.entries())
    .map(([url, date]) => ({ date, url }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function writeCSV(filePath: string, entries: HistoryEntry[]): void {
  const header = 'date,url\n';
  const rows = entries.map(e => `${e.date},${e.url}`).join('\n');
  fs.writeFileSync(filePath, header + rows);
}

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error('Usage: npx tsx merge-history.ts <csv1> [csv2 ...] <output>');
    process.exit(1);
  }

  const inputs = args.slice(0, -1);
  const output = args[args.length - 1];

  const allEntries: HistoryEntry[] = [];
  for (const input of inputs) {
    console.log(`Reading ${input}...`);
    allEntries.push(...parseCSV(input));
  }

  console.log(`Merging and deduplicating...`);
  const merged = mergeAndDedup(allEntries);

  console.log(`Writing ${output}...`);
  writeCSV(output, merged);

  console.log(`Done! Merged ${merged.length} unique URLs.`);
}

run().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
