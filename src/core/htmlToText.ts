interface HtmlToTextOptions {
  renderer?: 'turndown' | 'terminal';
  width?: number;
}

export interface TerminalContent {
  body: string;
  prologue: string;
}

async function renderTurndown(html: string, url: string | undefined): Promise<string> {
  const { JSDOM } = await import('jsdom');
  const { Readability } = await import('@mozilla/readability');
  const TurndownService = (await import('turndown')).default;
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  const source = article?.content ?? html;
  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });
  // Strip script/style: their content is code/CSS, not prose. Keeping them
  // leaks executable snippets into AI context and inflates token counts.
  service.remove(['script', 'style']);
  return service.turndown(source);
}

async function buildTargetDoc(
  html: string,
  url: string | undefined,
): Promise<Document> {
  const { JSDOM } = await import('jsdom');
  const { Readability } = await import('@mozilla/readability');
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document.cloneNode(true) as Document);
  const article = reader.parse();
  return article?.content
    ? new JSDOM(article.content, { url }).window.document
    : dom.window.document;
}

async function renderTerminalParts(
  html: string,
  url: string | undefined,
  width: number | undefined,
): Promise<TerminalContent> {
  const { renderHtmlToTerminalParts } = await import('./htmlRenderer.js');
  const targetDoc = await buildTargetDoc(html, url);
  return await renderHtmlToTerminalParts(targetDoc, width);
}

export interface TerminalContentUpdate extends TerminalContent {
  phase: 'text' | 'final';
}

export async function* htmlToTerminalStream(
  html: string,
  url?: string,
  width?: number,
): AsyncGenerator<TerminalContentUpdate, void, void> {
  const { renderHtmlToTerminalStream } = await import('./htmlRenderer.js');
  const targetDoc = await buildTargetDoc(html, url);
  for await (const update of renderHtmlToTerminalStream(targetDoc, width)) {
    yield update;
  }
}

export async function htmlToText(
  html: string,
  url?: string,
  options?: HtmlToTextOptions,
): Promise<string> {
  if (options?.renderer === 'terminal') {
    const { body, prologue } = await renderTerminalParts(html, url, options.width);
    return prologue + body;
  }
  return renderTurndown(html, url);
}

export async function htmlToTerminal(
  html: string,
  url?: string,
  width?: number,
): Promise<TerminalContent> {
  return renderTerminalParts(html, url, width);
}

export async function htmlToMarkdown(html: string, url?: string): Promise<string> {
  return renderTurndown(html, url);
}
