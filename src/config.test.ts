import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws when BRAVE_API_KEY is missing', () => {
    vi.stubEnv('BRAVE_API_KEY', '');
    expect(() => loadConfig()).toThrow('BRAVE_API_KEY is not set');
  });

  it('returns config when BRAVE_API_KEY is set', () => {
    vi.stubEnv('BRAVE_API_KEY', 'test-key');
    expect(loadConfig()).toEqual({ braveApiKey: 'test-key' });
  });
});
