import { decode } from "html-entities";

export interface ExtractedFiddle {
  html: string;
  css: string | null;
  js: string | null;
  isEsModule: boolean;
}

function extractJsonLd(htmlContent: string): Record<string, any> {
  const match = htmlContent.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/
  );
  if (!match) {
    throw new Error("No JSON-LD script tag found");
  }

  let jsonStr = match[1];

  // Replace literal newlines inside quoted strings with escaped newlines.
  // This handles multiline string values in the JSON.
  jsonStr = jsonStr.replace(
    /"([^"\\]|\\.)*"/g,
    (match) => {
      return match.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
    }
  );

  // Remove trailing commas before closing braces/brackets.
  jsonStr = jsonStr.replace(/,(\s*[}\]])/g, "$1");

  // console.debug(jsonStr)

  return JSON.parse(jsonStr);
}

function unescapeHtml(text: string): string {
  return decode(text);
}

function detectEsModule(jsCode: string): boolean {
  // Check for top-level import statements.
  const importRegex = /^\s*import\s+/m;
  return importRegex.test(jsCode);
}

export function extractFiddleContent(
  htmlContent: string
): ExtractedFiddle {
  const jsonLd = extractJsonLd(htmlContent);

  if (!jsonLd.codeSampleType || !Array.isArray(jsonLd.codeSampleType)) {
    throw new Error("No codeSampleType array found in JSON-LD");
  }

  let html: string | null = null;
  let css: string | null = null;
  let js: string | null = null;

  for (const sample of jsonLd.codeSampleType) {
    const language = sample.programmingLanguage?.toLowerCase();
    const text = sample.text;

    if (!text) continue;

    const unescaped = unescapeHtml(text);

    if (language === "html") {
      html = unescaped;
    } else if (language === "css") {
      css = unescaped;
    } else if (language === "javascript") {
      js = unescaped;
    }
  }

  if (!html) {
    throw new Error("Missing required HTML in fiddle");
  }

  return {
    html,
    css,
    js,
    isEsModule: (js && detectEsModule(js)) || false,
  };
}
