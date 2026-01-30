import { decode } from 'html-entities';

export interface ExtractedFiddle {
  html: string | null;
  css: string | null;
  js: string | null;
  isEsModule: boolean;
}

function extractValue(htmlContent: string, key: string): string | null {
  // Match: key: "value" or key: 'value'
  // Handles escaped quotes and newlines within the value.
  const pattern = new RegExp(String.raw`${key}:\s*["']([\s\S]*?)["'](?=\s*[,}])`);
  const match = htmlContent.match(pattern);

  if (!match) {
    return null;
  }

  return unescapeEditorValue(match[1]);
}

function unescapeEditorValue(text: string): string {
  // Unescape HTML entities and literal escape sequences.
  const unescaped = decode(text);

  return unescaped.replaceAll(String.raw`\"`, '"')
    .replaceAll(String.raw`\'`, '\'')
    .replaceAll(String.raw`\n`, '\n')
    .replaceAll(String.raw`\r`, '\r')
    .replaceAll(String.raw`\t`, '\t')
    .replaceAll(String.raw`\/`, '/')
    .replaceAll(String.raw`\$`, '$')
    .replaceAll('\\`', '`');
}

function detectEsModule(jsCode: string): boolean {
  const importRegex = /^\s*import\s+/m;
  return importRegex.test(jsCode);
}

export function extractFiddleContent(
  htmlContent: string
): ExtractedFiddle {
  if (!htmlContent.includes('EditorConfig')) {
    throw new Error('No EditorConfig found');
  }

  const html = extractValue(htmlContent, 'html');
  const css = extractValue(htmlContent, 'css');
  const js = extractValue(htmlContent, 'js');

  return {
    html: html?.length ? html : null,
    css: css?.length ? css : null,
    js: js?.length ? js : null,
    isEsModule: js ? detectEsModule(js) : false
  };
}
