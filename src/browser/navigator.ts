import axios from 'axios';
import type { HistoryEntry } from './history.js';
import { extractLinks } from './linkHints.js';
import { extractForms, type FormSpec } from './forms.js';
import { htmlToTerminal, htmlToTerminalStream } from '../core/htmlToText.js';

const REQUEST_TIMEOUT_MS = 15_000;

export interface NavigateOptions {
  width?: number;
  timeoutMs?: number;
}

export interface NavigationResult {
  ok: boolean;
  entry?: HistoryEntry;
  error?: string;
}

export type NavigationPhase = 'text' | 'partial' | 'final';

export interface NavigationUpdate {
  ok: boolean;
  entry?: HistoryEntry;
  error?: string;
  phase: NavigationPhase;
  decoded?: number;
  total?: number;
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^localhost(:\d+)?(\/|$)/i.test(trimmed)) return `http://${trimmed}`;
  return `https://${trimmed}`;
}

function extractTitle(html: string, fallback: string): string {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (m && m[1]) return m[1].trim().replace(/\s+/g, ' ').slice(0, 120);
  return fallback;
}

export async function navigate(
  input: string,
  options: NavigateOptions = {},
): Promise<NavigationResult> {
  const url = normalizeUrl(input);
  if (!url) return { ok: false, error: 'empty url' };

  try {
    const response = await axios.get<string>(url, {
      responseType: 'text',
      timeout: options.timeoutMs ?? REQUEST_TIMEOUT_MS,
      headers: {
        'User-Agent': 'aispy/0.1.0 (+https://github.com/tatsuhiroishige/aispy)',
        Accept: 'text/html,application/xhtml+xml,*/*',
      },
    });

    const { body, prologue } = await htmlToTerminal(
      response.data,
      url,
      options.width ?? 100,
    );
    const title = extractTitle(response.data, url);
    const [links, forms] = await Promise.all([
      extractLinks(response.data, url),
      extractForms(response.data, url),
    ]);
    return {
      ok: true,
      entry: { url, title, content: body, imagePrologue: prologue, links, forms },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export async function* navigateStream(
  input: string,
  options: NavigateOptions = {},
): AsyncGenerator<NavigationUpdate, void, void> {
  const url = normalizeUrl(input);
  if (!url) {
    yield { ok: false, error: 'empty url', phase: 'final' };
    return;
  }

  let response;
  try {
    response = await axios.get<string>(url, {
      responseType: 'text',
      timeout: options.timeoutMs ?? REQUEST_TIMEOUT_MS,
      headers: {
        'User-Agent': 'aispy/0.1.0 (+https://github.com/tatsuhiroishige/aispy)',
        Accept: 'text/html,application/xhtml+xml,*/*',
      },
    });
  } catch (err) {
    yield {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      phase: 'final',
    };
    return;
  }

  const title = extractTitle(response.data, url);
  const [links, forms] = await Promise.all([
    extractLinks(response.data, url),
    extractForms(response.data, url),
  ]);

  for await (const update of htmlToTerminalStream(
    response.data,
    url,
    options.width ?? 100,
  )) {
    yield {
      ok: true,
      phase: update.phase,
      decoded: update.decoded,
      total: update.total,
      entry: {
        url,
        title,
        content: update.body,
        imagePrologue: update.prologue,
        links,
        forms,
      },
    };
  }
}

export async function submitForm(
  form: FormSpec,
  values: Record<string, string>,
  options: NavigateOptions = {},
): Promise<NavigationResult> {
  const merged: FormSpec = {
    ...form,
    fields: form.fields.map((f) =>
      values[f.name] !== undefined ? { ...f, value: values[f.name]! } : f,
    ),
  };

  if (merged.method === 'get') {
    const { buildSubmitUrl } = await import('./forms.js');
    return navigate(buildSubmitUrl(merged), options);
  }

  const { encodeFormData } = await import('./forms.js');
  try {
    const body = encodeFormData(merged.fields);
    const response = await axios.post<string>(merged.action, body, {
      responseType: 'text',
      timeout: options.timeoutMs ?? REQUEST_TIMEOUT_MS,
      headers: {
        'User-Agent': 'aispy/0.1.0 (+https://github.com/tatsuhiroishige/aispy)',
        Accept: 'text/html,application/xhtml+xml,*/*',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      maxRedirects: 5,
    });
    const finalUrl =
      (response.request?.res?.responseUrl as string | undefined) ?? merged.action;
    const { body: rbody, prologue } = await htmlToTerminal(
      response.data,
      finalUrl,
      options.width ?? 100,
    );
    const title = extractTitle(response.data, finalUrl);
    const [links, forms] = await Promise.all([
      extractLinks(response.data, finalUrl),
      extractForms(response.data, finalUrl),
    ]);
    return {
      ok: true,
      entry: {
        url: finalUrl,
        title,
        content: rbody,
        imagePrologue: prologue,
        links,
        forms,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const _internal = { normalizeUrl, extractTitle };
