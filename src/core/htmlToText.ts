import TurndownService from 'turndown';

export function htmlToText(html: string): string {
  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });
  // Strip script/style: their content is code/CSS, not prose. Keeping them
  // leaks executable snippets into AI context and inflates token counts.
  service.remove(['script', 'style']);
  return service.turndown(html);
}
