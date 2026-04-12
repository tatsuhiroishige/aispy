import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { PageViewer } from './PageViewer.js';

describe('PageViewer', () => {
  it('shows placeholder when viewer is null', () => {
    const { lastFrame } = render(<PageViewer viewer={null} focused={false} height={10} />);
    const frame = lastFrame()!;

    expect(frame).toContain('No page selected');
    expect(frame).toContain('Press Enter');
  });

  it('shows content when viewer is set', () => {
    const viewer = {
      url: 'https://example.com/page',
      content: 'Hello world\nSecond line\nThird line',
      scrollOffset: 0,
    };
    const { lastFrame } = render(<PageViewer viewer={viewer} focused={true} height={10} />);
    const frame = lastFrame()!;

    expect(frame).toContain('https://example.com/page');
    expect(frame).toContain('Hello world');
    expect(frame).toContain('Second line');
  });

  it('renders markdown with headings and links', () => {
    const viewer = {
      url: 'https://example.com/md',
      content: '# Heading\n\nSome text\n\n[link](url)',
      scrollOffset: 0,
    };
    const { lastFrame } = render(<PageViewer viewer={viewer} focused={false} height={10} />);
    const frame = lastFrame()!;

    expect(frame).toContain('Heading');
    expect(frame).toContain('link');
    expect(frame).toContain('Some text');
  });
});
