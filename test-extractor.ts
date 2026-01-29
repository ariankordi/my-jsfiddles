import fs from "node:fs";
import { extractFiddleContent } from "./extract-jsfiddle";

const testFile = process.argv[2] || "fiddle_downloads/za32o6dc/0.html";
const html = fs.readFileSync(testFile, "utf8");

try {
  const result = extractFiddleContent(html);
  console.log("✓ Extraction successful");
  console.log(`  HTML: ${result.html?.length} chars`);
  console.log(`  CSS: ${result.css ? result.css.length : "null"} chars`);
  console.log(`  JS: ${result.js?.length} chars`);
  console.log(`  ES Module: ${result.isEsModule}`);

  console.debug('>>> html', result.html);
  console.debug('>>> js', result.js);
} catch (error) {
  console.error("✗ Extraction failed:", error);
}
