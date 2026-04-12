export async function htmlToText(html: string, url?: string): Promise<string> {
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
