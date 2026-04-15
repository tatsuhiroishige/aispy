import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { UrlBar } from './UrlBar.js';

describe('UrlBar', () => {
  it('shows placeholder when no tab', () => {
    const { lastFrame } = render(<UrlBar url={null} />);
    expect(lastFrame()).toContain('press g to enter URL');
  });

  it('shows url when provided', () => {
    const { lastFrame } = render(<UrlBar url="https://example.com" />);
    expect(lastFrame()).toContain('https://example.com');
  });

  it('shows loading indicator', () => {
    const { lastFrame } = render(<UrlBar url="https://a.com" loading />);
    expect(lastFrame()).toContain('loading');
  });

  it('shows error when loadError set', () => {
    const { lastFrame } = render(<UrlBar url="https://a.com" loadError="404" />);
    expect(lastFrame()).toContain('404');
  });

  it('reflects back/forward availability', () => {
    const off = render(<UrlBar url="u" />).lastFrame();
    const on = render(<UrlBar url="u" canBack canForward />).lastFrame();
    expect(off).toContain('·');
    expect(on).toContain('◀');
    expect(on).toContain('▶');
  });

  it('shows editing state with draft', () => {
    const { lastFrame } = render(<UrlBar url="u" editing draft="example" />);
    expect(lastFrame()).toContain('URL');
    expect(lastFrame()).toContain('example');
  });
});
