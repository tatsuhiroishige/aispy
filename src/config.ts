import { config } from 'dotenv';

config();

export interface Config {
  searchBackend: 'brave' | 'serper' | 'tavily';
  braveApiKey?: string;
  serperApiKey?: string;
  tavilyApiKey?: string;
}

const VALID_BACKENDS = new Set(['brave', 'serper', 'tavily']);

export function loadConfig(): Config {
  const raw = process.env['SEARCH_BACKEND'] || 'brave';
  if (!VALID_BACKENDS.has(raw)) {
    throw new Error(
      `Invalid SEARCH_BACKEND: ${raw} (must be brave, serper, or tavily)`,
    );
  }
  const searchBackend = raw as Config['searchBackend'];

  const braveApiKey = process.env['BRAVE_API_KEY'] || undefined;
  const serperApiKey = process.env['SERPER_API_KEY'] || undefined;
  const tavilyApiKey = process.env['TAVILY_API_KEY'] || undefined;

  if (searchBackend === 'brave' && !braveApiKey) {
    throw new Error('BRAVE_API_KEY is not set');
  }
  if (searchBackend === 'serper' && !serperApiKey) {
    throw new Error('SERPER_API_KEY is not set');
  }
  if (searchBackend === 'tavily' && !tavilyApiKey) {
    throw new Error('TAVILY_API_KEY is not set');
  }

  return { searchBackend, braveApiKey, serperApiKey, tavilyApiKey };
}
