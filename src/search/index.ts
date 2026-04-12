import type { Config } from '../config.js';
import { createBraveBackend } from './brave.js';
import { createSerperBackend } from './serper.js';
import { createTavilyBackend } from './tavily.js';
import type { SearchBackend } from './types.js';

export function createSearchBackend(config: Config): SearchBackend {
  switch (config.searchBackend) {
    case 'brave':
      if (!config.braveApiKey) {
        throw new Error('BRAVE_API_KEY is required when searchBackend is brave');
      }
      return createBraveBackend(config.braveApiKey);
    case 'serper':
      if (!config.serperApiKey) {
        throw new Error('SERPER_API_KEY is required when searchBackend is serper');
      }
      return createSerperBackend(config.serperApiKey);
    case 'tavily':
      if (!config.tavilyApiKey) {
        throw new Error('TAVILY_API_KEY is required when searchBackend is tavily');
      }
      return createTavilyBackend(config.tavilyApiKey);
    default:
      throw new Error(`Unknown search backend: ${String(config.searchBackend)}`);
  }
}
