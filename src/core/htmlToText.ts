interface HtmlToTextOptions {
  renderer?: 'turndown' | 'terminal';
  width?: number;
}

export async function htmlToText(
  html: string,
  url?: string,
  options?: HtmlToTextOptions,
): Promise<string> {
  const { JSDOM } = await import('jsdom');
  const { Readability } = await import('@mozilla/readability');

  if (options?.renderer === 'terminal') {
    const { renderHtmlToTerminal } = await import('./htmlRenderer.js');
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document.cloneNode(true) as Document);
    const article = reader.parse();
    const targetDoc = article?.content
      ? new JSDOM(article.content, { url }).window.document
      : dom.window.document;
    return renderHtmlToTerminal(targetDoc, options.width);
  }

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
