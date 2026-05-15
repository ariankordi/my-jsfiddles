#!/usr/bin/env node
// One-time script: rewrites commit messages matching "shortname: revision N"
// to add Fiddle-Id and Fiddle-Revision trailers.
// Used with: git filter-branch --msg-filter 'node /path/to/this/script.js'
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const CSV_PATH = path.join(__dirname, 'fiddle-names.csv');
// When running from /tmp (e.g. via filter-branch), fall back to absolute path.
const ABSOLUTE_CSV_PATH = '/Volumes/working_ssd/2026-03-jsfiddle-repo/_archiving/fiddle-names.csv';

/** @returns {Record<string, string>} shortname -> fiddleId */
function buildReverseMap() {
  const resolvedPath = fs.existsSync(CSV_PATH) ? CSV_PATH : ABSOLUTE_CSV_PATH;
  const csv = fs.readFileSync(resolvedPath, 'utf8');
  /** @type {Record<string, string>} */
  const map = {};
  for (const line of csv.split('\n')) {
    const commaIdx = line.indexOf(',');
    if (commaIdx === -1) continue;
    const id = line.slice(0, commaIdx).trim();
    const shortname = line.slice(commaIdx + 1).trim();
    if (!id || !shortname || id === 'id') continue;
    map[shortname] = id;
  }
  return map;
}

const reverseMap = buildReverseMap();

// Permanent lookup entries for old shortnames that were renamed after commits
// were made. These supplement the CSV without needing an alias system.
const LEGACY_SHORTNAMES = /** @type {Record<string, string>} */ ({
  'mii-db-ffl-cfl-parser': 'tpdu640x',
});
for (const [shortname, id] of Object.entries(LEGACY_SHORTNAMES)) {
  if (!reverseMap[shortname]) reverseMap[shortname] = id;
}

let msg = '';
process.stdin.on('data', chunk => { msg += chunk; });
process.stdin.on('end', () => {
  const trimmed = msg.trim();
  const match = trimmed.match(/^(.+): revision (\d+)$/);
  if (!match) {
    process.stdout.write(msg);
    return;
  }

  const shortname = match[1];
  const revision = match[2];
  const fiddleId = reverseMap[shortname];

  if (!fiddleId) {
    process.stderr.write(`WARNING: no fiddleId found for shortname "${shortname}" — leaving commit unchanged\n`);
    process.stdout.write(msg);
    return;
  }

  process.stdout.write(`${trimmed}\n\nFiddle-Id: ${fiddleId}\nFiddle-Revision: ${revision}\n`);
});
