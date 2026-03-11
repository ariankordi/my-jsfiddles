import { decode } from 'html-entities';

export interface ExtractedFiddle {
  html: string | null;
  css: string | null;
  js: string | null;
  isEsModule: boolean;
}

function extractTextareaContent(
  htmlContent: string,
  textareaId: string
): string | null {
  const pattern = new RegExp(
    String.raw`<textarea[^>]*id="${textareaId}"[^>]*>([\s\S]*?)</textarea>`
  );
  const match = htmlContent.match(pattern);

  if (!match) {
    return null;
  }

  return decode(match[1]);
}

function detectEsModule(jsCode: string): boolean {
  const importRegex = /^\s*import\s+/m;
  return importRegex.test(jsCode);
}

export function extractFiddleContent(
  htmlContent: string
): ExtractedFiddle {
  const html = extractTextareaContent(
    htmlContent,
    'textarea-code-html'
  );
  const css = extractTextareaContent(
    htmlContent,
    'textarea-code-css'
  );
  const js = extractTextareaContent(
    htmlContent,
    'textarea-code-js'
  );

  return {
    html: html?.length ? html : null,
    css: css?.length ? css : null,
    js: js?.length ? js : null,
    isEsModule: js ? detectEsModule(js) : false
  };
}
