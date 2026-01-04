// src/components/App.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { act } from 'react';
import { App } from './App.js';

// Mock the store module
vi.mock('../store.js', () => ({
  getStore: vi.fn(() => ({
    agents: new Map(),
    focusedAgentId: null,
    orchestratorInput: '',
  })),
  addAgent: vi.fn(),
  updateAgentStatus: vi.fn(),
  appendAgentOutput: vi.fn(),
  setFocusedAgent: vi.fn(),
  resetStore: vi.fn(),
}));

// Mock the input-cleaner module
vi.mock('../input-cleaner.js', () => ({
  cleanInput: vi.fn().mockResolvedValue({ tasks: [] }),
}));

// Mock the status-detector module
vi.mock('../status-detector.js', () => ({
  detectStatus: vi.fn().mockResolvedValue({
    id: 'test',
    state: 'working',
    summary: 'Working...',
    lastOutput: '',
  }),
}));

// Mock the adapters module
vi.mock('../adapters/index.js', () => ({
  spawnAgent: vi.fn(() => ({
    id: 'test-agent',
    config: { id: 'test-agent', type: 'claude-code', workingDirectory: '/tmp', task: 'test' },
    send: vi.fn(),
    kill: vi.fn(),
    onOutput: vi.fn(),
    onExit: vi.fn(),
  })),
}));

import { getStore } from '../store.js';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { lastFrame } = render(<App />);

    // Should render something (not null/undefined)
    expect(lastFrame()).toBeDefined();
  });

  it('shows input field prompt', () => {
    const { lastFrame } = render(<App />);

    const output = lastFrame() ?? '';
    // Should show an input prompt indicator
    expect(output).toContain('>');
  });

  it('shows AgentList component', () => {
    const { lastFrame } = render(<App />);

    const output = lastFrame() ?? '';
    // AgentList shows "No agents running" when empty
    expect(output).toContain('No agents running');
  });

  it('shows title/header', () => {
    const { lastFrame } = render(<App />);

    const output = lastFrame() ?? '';
    // Should show app title
    expect(output).toContain('Agent Orchestrator');
  });

  describe('FocusedAgent integration', () => {
    it('renders FocusedAgent when focusedId is set', async () => {
      // Mock store to return a focused agent
      const mockAgent = {
        config: { id: 'focused-agent', type: 'claude-code', workingDirectory: '/tmp', task: 'test' },
        handle: { id: 'focused-agent', config: {}, send: vi.fn(), kill: vi.fn(), onOutput: vi.fn(), onExit: vi.fn() },
        status: { id: 'focused-agent', state: 'working', summary: 'Working...', lastOutput: '' },
        outputBuffer: 'Output line 1\nOutput line 2',
      };

      vi.mocked(getStore).mockReturnValue({
        agents: new Map([['focused-agent', mockAgent]]),
        focusedAgentId: 'focused-agent',
        orchestratorInput: '',
      });

      let lastFrame: () => string | undefined;

      await act(async () => {
        const result = render(<App />);
        lastFrame = result.lastFrame;
      });

      const output = lastFrame!() ?? '';

      // Should show FocusedAgent component with agent ID and ESC hint
      expect(output).toContain('focused-agent');
      expect(output).toContain('Press ESC to go back');
    });

    it('shows agent output in FocusedAgent view', async () => {
      const mockAgent = {
        config: { id: 'focused-agent', type: 'claude-code', workingDirectory: '/tmp', task: 'test' },
        handle: { id: 'focused-agent', config: {}, send: vi.fn(), kill: vi.fn(), onOutput: vi.fn(), onExit: vi.fn() },
        status: { id: 'focused-agent', state: 'done', summary: 'Done', lastOutput: '' },
        outputBuffer: 'Test output content',
      };

      vi.mocked(getStore).mockReturnValue({
        agents: new Map([['focused-agent', mockAgent]]),
        focusedAgentId: 'focused-agent',
        orchestratorInput: '',
      });

      let lastFrame: () => string | undefined;

      await act(async () => {
        const result = render(<App />);
        lastFrame = result.lastFrame;
      });

      const output = lastFrame!() ?? '';

      // Should show the output buffer content
      expect(output).toContain('Test output content');
    });

    it('does not show AgentList when focusedId is set', async () => {
      const mockAgent = {
        config: { id: 'focused-agent', type: 'claude-code', workingDirectory: '/tmp', task: 'test' },
        handle: { id: 'focused-agent', config: {}, send: vi.fn(), kill: vi.fn(), onOutput: vi.fn(), onExit: vi.fn() },
        status: { id: 'focused-agent', state: 'working', summary: 'Working...', lastOutput: '' },
        outputBuffer: 'Output',
      };

      vi.mocked(getStore).mockReturnValue({
        agents: new Map([['focused-agent', mockAgent]]),
        focusedAgentId: 'focused-agent',
        orchestratorInput: '',
      });

      let lastFrame: () => string | undefined;

      await act(async () => {
        const result = render(<App />);
        lastFrame = result.lastFrame;
      });

      const output = lastFrame!() ?? '';

      // Should NOT show main orchestrator title when in focused view
      expect(output).not.toContain('Agent Orchestrator');
      // Should NOT show input prompt
      expect(output).not.toContain('Enter task...');
    });
  });
});
