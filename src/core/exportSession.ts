import type { AispyEvent } from '../types.js';
import type { SessionStats } from './store.js';

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function formatIso(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function exportToJson(events: readonly AispyEvent[], stats: SessionStats): string {
  const payload = {
    exportedAt: formatIso(new Date()),
    stats: {
      searchCount: stats.searchCount,
      fetchCount: stats.fetchCount,
      totalTokens: stats.totalTokens,
    },
    events: [...events],
  };
  return JSON.stringify(payload, null, 2);
}

export function exportToMarkdown(events: readonly AispyEvent[], stats: SessionStats): string {
  const now = new Date();
  const exported = now.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');

  const lines: string[] = [
    '# aispy Session Export',
    `Exported: ${exported}`,
    `Searches: ${stats.searchCount} | Pages: ${stats.fetchCount} | Tokens: ${formatNumber(stats.totalTokens)}`,
    '',
    '## Activity Log',
  ];

  for (const event of events) {
    if (event.type === 'search') {
      lines.push('');
      lines.push(`### [${formatTime(event.timestamp)}] Search: "${event.query}"`);
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i]!;
        lines.push(`- Result ${i + 1}: ${r.title} (${r.url})`);
      }
    } else if (event.type === 'fetch') {
      lines.push('');
      lines.push(`### [${formatTime(event.timestamp)}] Fetch: ${event.url}`);
      lines.push(`Tokens: ${formatNumber(event.tokens)} | Duration: ${(event.durationMs / 1000).toFixed(1)}s`);
    }
  }

  lines.push('');
  return lines.join('\n');
}
