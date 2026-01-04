// src/components/FocusedAgent.test.tsx

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { FocusedAgent } from './FocusedAgent.js';

describe('FocusedAgent', () => {
  const defaultProps = {
    id: 'agent-123',
    output: 'Line 1\nLine 2\nLine 3',
    status: 'working',
    onBack: vi.fn(),
  };

  it('renders agent ID in header', () => {
    const { lastFrame } = render(<FocusedAgent {...defaultProps} />);

    const output = lastFrame() ?? '';
    expect(output).toContain('agent-123');
  });

  it('shows status in header', () => {
    const { lastFrame } = render(<FocusedAgent {...defaultProps} status="done" />);

    const output = lastFrame() ?? '';
    expect(output).toContain('done');
  });

  it('displays "Press ESC to go back" hint', () => {
    const { lastFrame } = render(<FocusedAgent {...defaultProps} />);

    const output = lastFrame() ?? '';
    expect(output).toContain('Press ESC to go back');
  });

  it('shows output lines (last 30)', () => {
    // Create 40 lines of output
    const lines = Array.from({ length: 40 }, (_, i) => `Line ${i + 1}`);
    const output40Lines = lines.join('\n');

    const { lastFrame } = render(
      <FocusedAgent {...defaultProps} output={output40Lines} />
    );

    const output = lastFrame() ?? '';
    // Should contain the last 30 lines (11-40), not the first 10
    expect(output).toContain('Line 40');
    expect(output).toContain('Line 11');
    // Should NOT contain line 10 (outside last 30)
    expect(output).not.toContain('Line 10\n');
  });

  it('has bordered output area', () => {
    const { lastFrame } = render(<FocusedAgent {...defaultProps} />);

    const output = lastFrame() ?? '';
    // Check for border characters (single border uses box-drawing characters)
    // Common border chars: │ ─ ┌ ┐ └ ┘
    expect(output).toMatch(/[│┌┐└┘─]/);
  });
});
