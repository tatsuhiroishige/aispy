import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { LinkHintsModal } from './LinkHintsModal.js';
import type { LinkHint } from '../../browser/linkHints.js';

const hints: LinkHint[] = [
  { label: 'a', text: 'Home', url: 'https://a.com' },
  { label: 'as', text: 'About', url: 'https://a.com/about' },
  { label: 'd', text: 'Docs', url: 'https://a.com/docs' },
];

describe('LinkHintsModal', () => {
  it('shows count and all hints when prefix empty', () => {
    const { lastFrame } = render(<LinkHintsModal hints={hints} prefix="" height={20} />);
    expect(lastFrame()).toContain('3/3');
    expect(lastFrame()).toContain('Home');
    expect(lastFrame()).toContain('About');
    expect(lastFrame()).toContain('Docs');
  });

  it('filters by prefix', () => {
    const { lastFrame } = render(<LinkHintsModal hints={hints} prefix="a" height={20} />);
    expect(lastFrame()).toContain('2/3');
    expect(lastFrame()).toContain('Home');
    expect(lastFrame()).toContain('About');
    expect(lastFrame()).not.toContain('Docs');
  });

  it('shows empty state', () => {
    const { lastFrame } = render(<LinkHintsModal hints={[]} prefix="" height={10} />);
    expect(lastFrame()).toContain('no links');
  });
});
