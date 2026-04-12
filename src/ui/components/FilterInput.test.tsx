import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { FilterInput } from './FilterInput.js';

describe('FilterInput', () => {
  it('renders the filter text', () => {
    const { lastFrame } = render(<FilterInput value="lambda" onChange={() => {}} />);
    const frame = lastFrame()!;

    expect(frame).toContain('/');
    expect(frame).toContain('lambda');
  });

  it('renders empty filter with cursor', () => {
    const { lastFrame } = render(<FilterInput value="" onChange={() => {}} />);
    const frame = lastFrame()!;

    expect(frame).toContain('/');
    expect(frame).toContain('_');
  });
});
