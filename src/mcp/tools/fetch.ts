import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import { z } from 'zod';
import type { FetchCache } from '../../core/fetchCache.js';
import { htmlToMarkdown, htmlToTerminalStream } from '../../core/htmlToText.js';
import { extractSections, findSection, sectionSummary } from '../../core/sections.js';
import type { IpcClient } from '../../ipc/client.js';

export const fetchInputSchema = z.object({
  url: z.string().url(),
  prompt: z.string().optional(),
  section: z.string().optional(),
  list_sections: z.boolean().optional(),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).optional(),
});

export type FetchInput = z.infer<typeof fetchInputSchema>;

export const fetchTool: Tool = {
  name: 'fetch',
  description:
    'Fetch a web page and return its text content. For large pages, use list_sections to see the TOC, then pass section="Heading" to retrieve just that portion. Or use offset/limit for char-based slicing.',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to fetch' },
      prompt: {
        type: 'string',
        description: 'What to extract from the page',
      },
      section: {
        type: 'string',
        description: 'Return only content under this heading (case-insensitive, substring match).',
      },
      list_sections: {
        type: 'boolean',
        description: 'Return a TOC of headings instead of the body (cheap overview of big pages).',
      },
      offset: {
        type: 'number',
        description: 'Character offset into the full markdown for slicing.',
      },
      limit: {
        type: 'number',
        description: 'Max characters to return (paired with offset).',
      },
    },
    required: ['url'],
  },
};

const REQUEST_TIMEOUT_MS = 15_000;
const JINA_TIMEOUT_MS = 30_000;
const SPA_MIN_CONTENT_LENGTH = 200;
const PREVIEW_CHARS = 200;
// Claude Code (and most MCP clients) cap tool results around 25k tokens.
// Stay well under so JSON wrapping + multi-byte expansion doesn't overflow.
const AI_MAX_TOKENS = 20_000;
const TRUNCATION_MARKER =
  '\n\n[Content truncated to fit AI token limit — full content shown in TUI]';

function estimateTokens(text: string): number {
  let total = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x3000) total += 1.5; // CJK / fullwidth: ~1.5 tokens/char
    else if (cp >= 0x0080) total += 0.5; // other non-ASCII
    else total += 0.25; // ASCII: ~0.25 tokens/char
  }
  return Math.ceil(total);
}

function applyAiTruncation(content: string): string {
  const tokens = estimateTokens(content);
  if (tokens <= AI_MAX_TOKENS) return content;
  // Binary-search a char length that lands under the token cap.
  let lo = 0;
  let hi = content.length;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const slice = content.slice(0, mid);
    if (estimateTokens(slice) + estimateTokens(TRUNCATION_MARKER) <= AI_MAX_TOKENS) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return content.slice(0, best) + TRUNCATION_MARKER;
}

function applySectionFilter(
  markdown: string,
  args: FetchInput,
): { body: string; note: string } {
  if (args.list_sections) {
    const sections = extractSections(markdown);
    return {
      body: `# Sections of ${args.url}\n\n${sectionSummary(sections)}\n\nTotal: ${sections.length} headings, ${markdown.length} chars. Fetch with section="<heading>" or offset+limit to read.`,
      note: 'list_sections',
    };
  }
  if (args.section) {
    const sections = extractSections(markdown);
    const match = findSection(sections, args.section);
    if (!match) {
      const avail = sectionSummary(sections).split('\n').slice(0, 20).join('\n');
      return {
        body: `No section matching "${args.section}".\n\nAvailable sections:\n${avail}`,
        note: 'section-not-found',
      };
    }
    return {
      body: `[Section "${match.heading}" from ${args.url}]\n\n${match.content}`,
      note: `section:${match.heading}`,
    };
  }
  if (args.offset !== undefined || args.limit !== undefined) {
    const start = args.offset ?? 0;
    const end = args.limit !== undefined ? start + args.limit : undefined;
    const sliced = markdown.slice(start, end);
    const remaining = markdown.length - (end ?? markdown.length);
    const header = `[Slice ${start}..${end ?? markdown.length} of ${markdown.length} chars — ${remaining} remaining]\n\n`;
    return { body: header + sliced, note: `slice:${start}..${end ?? 'end'}` };
  }
  return { body: markdown, note: 'full' };
}

export const _internal = {
  estimateTokens,
  applyAiTruncation,
  applySectionFilter,
  AI_MAX_TOKENS,
};

// Trust our renderer when it produces this much markdown — most "SPA marker"
// strings (window.__, createElement) appear as inline analytics on perfectly
// readable static pages, so we treat them as low-confidence signals.
const TRUST_RENDERED_THRESHOLD = 1500;

function isSpaLikely(renderedText: string, rawHtml: string): boolean {
  if (renderedText.length < SPA_MIN_CONTENT_LENGTH) return true;
  if (renderedText.length >= TRUST_RENDERED_THRESHOLD) return false;
  // Marginal case: little but non-empty rendered text. Strong frameworks
  // are a good signal the page genuinely needs JS.
  return (
    rawHtml.includes('__NEXT_DATA__') ||
    rawHtml.includes('__NUXT__') ||
    /<div\s+id="(?:root|app|__next|__nuxt)"[^>]*>\s*<\/div>/i.test(rawHtml)
  );
}

export async function handleFetch(
  args: FetchInput,
  client?: IpcClient,
  cache?: FetchCache,
): Promise<CallToolResult> {
  try {
    const cached = cache?.get(args.url);
    if (cached) {
      // Apply section/offset/limit/list_sections fresh on every hit; cache
      // stores the full markdown so parameter changes take effect.
      const { body: freshAi } = applySectionFilter(cached.fullMarkdown, args);
      const truncatedAi = applyAiTruncation(freshAi);
      const tokens = estimateTokens(truncatedAi);
      client?.send({
        type: 'fetch',
        timestamp: Date.now(),
        url: args.url,
        content: cached.content,
        imagePrologue: cached.imagePrologue,
        tokens,
        durationMs: 0,
      });
      process.stderr.write(`[fetch] cache hit: ${args.url}\n`);
      return { content: [{ type: 'text', text: truncatedAi }] };
    }

    const startTime = Date.now();

    client?.send({
      type: 'fetch-start',
      timestamp: Date.now(),
      url: args.url,
    });

    const response = await axios.get<string>(args.url, {
      responseType: 'text',
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        'User-Agent': 'aispy/0.1.0 (https://github.com/tatsuhiroishige/aispy)',
        'Accept': 'text/html,application/xhtml+xml,*/*',
      },
    });

    // AI side: prefer our markdown extraction; fall back to Jina if SPA-like.
    let aiSource = await htmlToMarkdown(response.data, args.url);
    let usedJina = false;
    if (isSpaLikely(aiSource, response.data)) {
      try {
        const jinaResponse = await axios.get<string>(
          `https://r.jina.ai/${args.url}`,
          {
            responseType: 'text',
            timeout: JINA_TIMEOUT_MS,
            headers: { 'Accept': 'text/markdown' },
          },
        );
        aiSource = jinaResponse.data;
        usedJina = true;
        process.stderr.write(`[fetch] SPA detected, used Jina Reader for ${args.url}\n`);
      } catch {
        // Jina failed, keep our markdown as AI content
      }
    }
    const { body: aiContent } = applySectionFilter(aiSource, args);

    // TUI side: always stream terminal-rendered body so images / layout
    // survive even when the AI side falls back to Jina markdown.
    let firstYield = true;
    let body = '';
    let prologue = '';
    for await (const update of htmlToTerminalStream(response.data, args.url, 100)) {
      body = update.body;
      prologue = update.prologue;
      if (firstYield) {
        client?.send({
          type: 'fetch',
          timestamp: Date.now(),
          url: args.url,
          content: body,
          imagePrologue: prologue,
          tokens: 0,
          durationMs: Date.now() - startTime,
        });
        firstYield = false;
      } else {
        client?.send({
          type: 'fetch-update',
          timestamp: Date.now(),
          url: args.url,
          content: body,
          imagePrologue: prologue,
          decoded: update.decoded,
          total: update.total,
          phase: update.phase === 'final' ? 'final' : 'partial',
        });
      }
    }

    // TUI always gets terminal-rendered output, never raw markdown.
    // If the renderer produced essentially nothing (true SPA), the user can
    // press `o` to open in an external browser — established safety valve.
    void usedJina;

    const truncatedAi = applyAiTruncation(aiContent);
    const tokens = estimateTokens(truncatedAi);
    const preview = aiContent.slice(0, PREVIEW_CHARS);

    let log = `[fetch] url: ${args.url}\n`;
    log += `[fetch]   tokens: ${tokens}\n`;
    log += `[fetch]   preview: ${preview}\n`;
    process.stderr.write(log);

    cache?.set(args.url, body, aiSource, prologue);

    return {
      content: [
        {
          type: 'text',
          text: truncatedAi,
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[fetch] error: ${message}\n`);
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `fetch failed: ${message}`,
        },
      ],
    };
  }
}
