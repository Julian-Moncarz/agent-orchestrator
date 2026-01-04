// src/components/AgentList.test.tsx

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { AgentList, getStateColor, getDisplaySummary } from './AgentList.js';

describe('AgentList', () => {
  it('renders "No agents running" when agents array is empty', () => {
    const { lastFrame } = render(
      <AgentList agents={[]} focusedId={null} onSelectAgent={() => {}} />
    );

    expect(lastFrame()).toContain('No agents running');
  });

  it('renders agent cards for each agent', () => {
    const agents = [
      { id: 'agent-1', state: 'working' as const, summary: 'Working on task 1', lastOutput: '' },
      { id: 'agent-2', state: 'done' as const, summary: 'Finished task 2', lastOutput: '' },
    ];

    const { lastFrame } = render(
      <AgentList agents={agents} focusedId={null} onSelectAgent={() => {}} />
    );

    const output = lastFrame() ?? '';
    expect(output).toContain('agent-1');
    expect(output).toContain('agent-2');
    expect(output).toContain('Working on task 1');
    expect(output).toContain('Finished task 2');
  });

  it('shows correct status indicator for working and needs_input states', () => {
    const agents = [
      { id: 'agent-1', state: 'working' as const, summary: 'Working', lastOutput: '' },
      { id: 'agent-2', state: 'needs_input' as const, summary: 'Waiting', lastOutput: '' },
    ];

    const { lastFrame } = render(
      <AgentList agents={agents} focusedId={null} onSelectAgent={() => {}} />
    );

    const output = lastFrame() ?? '';
    // Working state should show filled circle
    expect(output).toMatch(/agent-1/);
    // We verify the indicators appear in the output (working = bullet, needs_input = warning)
    const lines = output.split('\n');
    const agent1Line = lines.find((l) => l.includes('agent-1'));
    const agent2Line = lines.find((l) => l.includes('agent-2'));

    // Check that status indicators exist
    expect(agent1Line).toContain('\u25CF'); // filled circle for working
    expect(agent2Line).toContain('\u26A0'); // warning for needs_input
  });

  it('truncates long summaries to 60 chars with ellipsis', () => {
    const longSummary = 'A'.repeat(80); // 80 characters
    const agents = [
      { id: 'agent-1', state: 'working' as const, summary: longSummary, lastOutput: '' },
    ];

    const { lastFrame } = render(
      <AgentList agents={agents} focusedId={null} onSelectAgent={() => {}} />
    );

    const output = lastFrame() ?? '';
    // Should not contain the full 80-char string
    expect(output).not.toContain(longSummary);
    // Should contain truncated version (57 chars + '...')
    expect(output).toContain('A'.repeat(57) + '...');
  });

  it('applies double border to focused agent', () => {
    const agents = [
      { id: 'agent-1', state: 'working' as const, summary: 'Task 1', lastOutput: '' },
      { id: 'agent-2', state: 'done' as const, summary: 'Task 2', lastOutput: '' },
    ];

    const { lastFrame } = render(
      <AgentList agents={agents} focusedId="agent-1" onSelectAgent={() => {}} />
    );

    const output = lastFrame() ?? '';
    // Double border uses double-line box characters like ═ ║
    // Check for double border character around focused agent
    expect(output).toContain('\u2551'); // double vertical line
  });

  describe('getStateColor', () => {
    it('returns yellow for starting state', () => {
      expect(getStateColor('starting')).toBe('yellow');
    });

    it('returns green for working state', () => {
      expect(getStateColor('working')).toBe('green');
    });

    it('returns red for needs_input state', () => {
      expect(getStateColor('needs_input')).toBe('red');
    });

    it('returns blue for done state', () => {
      expect(getStateColor('done')).toBe('blue');
    });

    it('returns gray for error state', () => {
      expect(getStateColor('error')).toBe('gray');
    });
  });

  describe('getDisplaySummary', () => {
    it('returns last line of lastOutput when available', () => {
      const agent = {
        id: 'agent-1',
        state: 'working' as const,
        summary: 'LLM summary here',
        lastOutput: 'First line\nSecond line\nThird line',
      };

      expect(getDisplaySummary(agent)).toBe('Third line');
    });

    it('skips empty lines when getting last line from lastOutput', () => {
      const agent = {
        id: 'agent-1',
        state: 'working' as const,
        summary: 'LLM summary here',
        lastOutput: 'First line\nSecond line\n\n   \n',
      };

      expect(getDisplaySummary(agent)).toBe('Second line');
    });

    it('falls back to summary when lastOutput is empty', () => {
      const agent = {
        id: 'agent-1',
        state: 'working' as const,
        summary: 'LLM generated summary',
        lastOutput: '',
      };

      expect(getDisplaySummary(agent)).toBe('LLM generated summary');
    });

    it('falls back to summary when lastOutput is only whitespace', () => {
      const agent = {
        id: 'agent-1',
        state: 'working' as const,
        summary: 'LLM generated summary',
        lastOutput: '   \n\n   ',
      };

      expect(getDisplaySummary(agent)).toBe('LLM generated summary');
    });

    it('returns "Starting..." when both lastOutput and summary are empty', () => {
      const agent = {
        id: 'agent-1',
        state: 'starting' as const,
        summary: '',
        lastOutput: '',
      };

      expect(getDisplaySummary(agent)).toBe('Starting...');
    });

    it('truncates long lastOutput lines to 60 chars with ellipsis', () => {
      const longLine = 'A'.repeat(80);
      const agent = {
        id: 'agent-1',
        state: 'working' as const,
        summary: 'summary',
        lastOutput: longLine,
      };

      const result = getDisplaySummary(agent);
      expect(result.length).toBe(60);
      expect(result).toBe('A'.repeat(57) + '...');
    });

    it('truncates long summary to 60 chars with ellipsis', () => {
      const longSummary = 'B'.repeat(80);
      const agent = {
        id: 'agent-1',
        state: 'working' as const,
        summary: longSummary,
        lastOutput: '',
      };

      const result = getDisplaySummary(agent);
      expect(result.length).toBe(60);
      expect(result).toBe('B'.repeat(57) + '...');
    });

    it('prioritizes lastOutput over summary', () => {
      const agent = {
        id: 'agent-1',
        state: 'working' as const,
        summary: 'This is the LLM summary',
        lastOutput: 'This is actual output',
      };

      expect(getDisplaySummary(agent)).toBe('This is actual output');
    });
  });
});
