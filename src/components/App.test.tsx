// src/components/App.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
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
});
