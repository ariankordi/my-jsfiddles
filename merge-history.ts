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

function mergeAndDedup(entries: HistoryEntry[]): HistoryEntry[] {
  const urlMap = new Map<string, string>();

  for (const entry of entries) {
    const existing = urlMap.get(entry.url);
    if (!existing || entry.date < existing) {
      urlMap.set(entry.url, entry.date);
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
    console.error('Usage: npx ts-node merge-history.ts <csv1> <csv2> <output>');
    process.exit(1);
  }

  const [csv1, csv2, output] = args;

  console.log(`Reading ${csv1}...`);
  const entries1 = parseCSV(csv1);

  console.log(`Reading ${csv2}...`);
  const entries2 = parseCSV(csv2);

  console.log(`Merging and deduplicating...`);
  const merged = mergeAndDedup([...entries1, ...entries2]);

  console.log(`Writing ${output}...`);
  writeCSV(output, merged);

  console.log(`Done! Merged ${merged.length} unique URLs.`);
}

await run();
