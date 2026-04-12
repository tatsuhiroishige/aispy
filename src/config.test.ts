import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults searchBackend to brave', () => {
    vi.stubEnv('BRAVE_API_KEY', 'test-key');
    vi.stubEnv('SEARCH_BACKEND', '');
    const config = loadConfig();
    expect(config.searchBackend).toBe('brave');
  });

  it('throws when BRAVE_API_KEY is missing and backend is brave', () => {
    vi.stubEnv('BRAVE_API_KEY', '');
    expect(() => loadConfig()).toThrow('BRAVE_API_KEY is not set');
  });

  it('returns config when BRAVE_API_KEY is set', () => {
    vi.stubEnv('BRAVE_API_KEY', 'test-key');
    const config = loadConfig();
    expect(config).toMatchObject({
      searchBackend: 'brave',
      braveApiKey: 'test-key',
    });
  });

  it('throws for invalid SEARCH_BACKEND', () => {
    vi.stubEnv('SEARCH_BACKEND', 'bing');
    vi.stubEnv('BRAVE_API_KEY', 'test-key');
    expect(() => loadConfig()).toThrow('Invalid SEARCH_BACKEND: bing');
  });

  it('throws when SERPER_API_KEY is missing and backend is serper', () => {
    vi.stubEnv('SEARCH_BACKEND', 'serper');
    vi.stubEnv('SERPER_API_KEY', '');
    expect(() => loadConfig()).toThrow('SERPER_API_KEY is not set');
  });

  it('throws when TAVILY_API_KEY is missing and backend is tavily', () => {
    vi.stubEnv('SEARCH_BACKEND', 'tavily');
    vi.stubEnv('TAVILY_API_KEY', '');
    expect(() => loadConfig()).toThrow('TAVILY_API_KEY is not set');
  });

  it('returns serper config when backend is serper', () => {
    vi.stubEnv('SEARCH_BACKEND', 'serper');
    vi.stubEnv('SERPER_API_KEY', 'serper-key');
    const config = loadConfig();
    expect(config).toMatchObject({
      searchBackend: 'serper',
      serperApiKey: 'serper-key',
    });
  });

  it('returns tavily config when backend is tavily', () => {
    vi.stubEnv('SEARCH_BACKEND', 'tavily');
    vi.stubEnv('TAVILY_API_KEY', 'tavily-key');
    const config = loadConfig();
    expect(config).toMatchObject({
      searchBackend: 'tavily',
      tavilyApiKey: 'tavily-key',
    });
  });
});
