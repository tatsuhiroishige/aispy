import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import { z } from 'zod';
import type { FetchCache } from '../../core/fetchCache.js';
import { htmlToMarkdown, htmlToTerminal } from '../../core/htmlToText.js';
import type { IpcClient } from '../../ipc/client.js';

export const fetchInputSchema = z.object({
  url: z.string().url(),
  prompt: z.string().optional(),
});

export type FetchInput = z.infer<typeof fetchInputSchema>;

export const fetchTool: Tool = {
  name: 'fetch',
  description: 'Fetch a web page and return its text content',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to fetch' },
      prompt: {
        type: 'string',
        description: 'What to extract from the page',
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

export const _internal = { estimateTokens, applyAiTruncation, AI_MAX_TOKENS };

function isSpaLikely(renderedText: string, rawHtml: string): boolean {
  if (renderedText.length < SPA_MIN_CONTENT_LENGTH) return true;
  const head = rawHtml.slice(0, 5000);
  return (
    rawHtml.includes('__NEXT_DATA__') ||
    rawHtml.includes('window.__') ||
    rawHtml.includes('createElement') ||
    rawHtml.includes('ReactDOM') ||
    /\{[\s\S]*\.map\(/.test(head)
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
      client?.send({
        type: 'fetch',
        timestamp: Date.now(),
        url: args.url,
        content: cached.content,
        imagePrologue: cached.imagePrologue,
        tokens: cached.tokens,
        durationMs: 0,
      });
      process.stderr.write(`[fetch] cache hit: ${args.url}\n`);
      return { content: [{ type: 'text', text: cached.aiContent }] };
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

    let aiContent = await htmlToMarkdown(response.data, args.url);
    let { body, prologue } = await htmlToTerminal(response.data, args.url, 100);

    if (isSpaLikely(aiContent, response.data)) {
      try {
        const jinaResponse = await axios.get<string>(
          `https://r.jina.ai/${args.url}`,
          {
            responseType: 'text',
            timeout: JINA_TIMEOUT_MS,
            headers: { 'Accept': 'text/markdown' },
          },
        );
        aiContent = jinaResponse.data;
        body = jinaResponse.data;
        prologue = '';
        process.stderr.write(`[fetch] SPA detected, used Jina Reader for ${args.url}\n`);
      } catch {
        // Jina failed, keep original content
      }
    }

    const truncatedAi = applyAiTruncation(aiContent);
    const tokens = estimateTokens(truncatedAi);
    const preview = aiContent.slice(0, PREVIEW_CHARS);

    let log = `[fetch] url: ${args.url}\n`;
    log += `[fetch]   tokens: ${tokens}\n`;
    log += `[fetch]   preview: ${preview}\n`;
    process.stderr.write(log);

    client?.send({
      type: 'fetch',
      timestamp: Date.now(),
      url: args.url,
      content: body,
      imagePrologue: prologue,
      tokens,
      durationMs: Date.now() - startTime,
    });

    cache?.set(args.url, body, truncatedAi, tokens, prologue);

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
