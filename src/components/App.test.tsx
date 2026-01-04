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

// Mock the logger module
vi.mock('../logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the agent-name module
vi.mock('../agent-name.js', () => ({
  generateAgentName: vi.fn((prompt: string) => `mock-${prompt.split(' ')[0].toLowerCase()}`),
  resetUsedNames: vi.fn(),
}));

import { getStore, updateAgentStatus, setFocusedAgent } from '../store.js';
import { detectStatus } from '../status-detector.js';
import { cleanInput } from '../input-cleaner.js';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  describe('Status detection with empty buffers', () => {
    it('should NOT call detectStatus when agent has empty output buffer', async () => {
      // Mock an agent with empty outputBuffer (simulating a just-spawned agent)
      const mockAgentEmpty = {
        config: { id: 'agent-empty', type: 'claude-code', workingDirectory: '/tmp', task: 'test' },
        handle: { id: 'agent-empty', config: {}, send: vi.fn(), kill: vi.fn(), onOutput: vi.fn(), onExit: vi.fn() },
        status: { id: 'agent-empty', state: 'starting' as const, summary: '', lastOutput: '' },
        outputBuffer: '', // Empty buffer - this is the key condition
      };

      vi.mocked(getStore).mockReturnValue({
        agents: new Map([['agent-empty', mockAgentEmpty]]),
        focusedAgentId: null,
        orchestratorInput: '',
      });

      await act(async () => {
        render(<App />);
      });

      // Advance past the 3-second status refresh interval
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3500);
      });

      // detectStatus should NOT have been called because outputBuffer is empty
      expect(detectStatus).not.toHaveBeenCalled();
    });

    it('should call detectStatus when agent has non-empty output buffer', async () => {
      // Mock an agent with non-empty outputBuffer
      const mockAgentWithOutput = {
        config: { id: 'agent-output', type: 'claude-code', workingDirectory: '/tmp', task: 'test' },
        handle: { id: 'agent-output', config: {}, send: vi.fn(), kill: vi.fn(), onOutput: vi.fn(), onExit: vi.fn() },
        status: { id: 'agent-output', state: 'working' as const, summary: '', lastOutput: '' },
        outputBuffer: 'Some actual output from the agent', // Non-empty buffer
      };

      vi.mocked(getStore).mockReturnValue({
        agents: new Map([['agent-output', mockAgentWithOutput]]),
        focusedAgentId: null,
        orchestratorInput: '',
      });

      await act(async () => {
        render(<App />);
      });

      // Advance past the 3-second status refresh interval
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3500);
      });

      // detectStatus SHOULD have been called because outputBuffer has content
      expect(detectStatus).toHaveBeenCalledWith('agent-output', 'Some actual output from the agent');
    });

    it('should skip agents with empty buffers but process agents with output', async () => {
      // Mock two agents: one with empty buffer, one with output
      const mockAgentEmpty = {
        config: { id: 'agent-empty', type: 'claude-code', workingDirectory: '/tmp', task: 'test1' },
        handle: { id: 'agent-empty', config: {}, send: vi.fn(), kill: vi.fn(), onOutput: vi.fn(), onExit: vi.fn() },
        status: { id: 'agent-empty', state: 'starting' as const, summary: '', lastOutput: '' },
        outputBuffer: '', // Empty
      };

      const mockAgentWithOutput = {
        config: { id: 'agent-output', type: 'claude-code', workingDirectory: '/tmp', task: 'test2' },
        handle: { id: 'agent-output', config: {}, send: vi.fn(), kill: vi.fn(), onOutput: vi.fn(), onExit: vi.fn() },
        status: { id: 'agent-output', state: 'working' as const, summary: '', lastOutput: '' },
        outputBuffer: 'Has output', // Non-empty
      };

      vi.mocked(getStore).mockReturnValue({
        agents: new Map([
          ['agent-empty', mockAgentEmpty],
          ['agent-output', mockAgentWithOutput],
        ]),
        focusedAgentId: null,
        orchestratorInput: '',
      });

      await act(async () => {
        render(<App />);
      });

      // Advance past the 3-second status refresh interval
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3500);
      });

      // detectStatus should only have been called once - for the agent with output
      expect(detectStatus).toHaveBeenCalledTimes(1);
      expect(detectStatus).toHaveBeenCalledWith('agent-output', 'Has output');
      // And NOT called with agent-empty
      expect(detectStatus).not.toHaveBeenCalledWith('agent-empty', expect.anything());
    });
  });

  describe('Clarification display', () => {
    beforeEach(() => {
      // Reset getStore to return empty agents map for clarification tests
      vi.mocked(getStore).mockReturnValue({
        agents: new Map(),
        focusedAgentId: null,
        orchestratorInput: '',
      });
    });

    it('should display clarification message when cleanInput returns clarificationNeeded', async () => {
      vi.mocked(cleanInput).mockResolvedValueOnce({
        tasks: [],
        clarificationNeeded: 'Which file do you want me to update?',
      });

      let lastFrame: () => string | undefined;
      let stdin: { write: (input: string) => void };

      await act(async () => {
        const result = render(<App />);
        lastFrame = result.lastFrame;
        stdin = result.stdin;
      });

      // Simulate user input and submission
      await act(async () => {
        stdin.write('update it');
        stdin.write('\r'); // Enter key
      });

      // Wait for async processing
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      const output = lastFrame!() ?? '';

      // Should display the clarification message
      expect(output).toContain('Which file do you want me to update?');
    });

    it('should style clarification differently from error (yellow/warning style)', async () => {
      vi.mocked(cleanInput).mockResolvedValueOnce({
        tasks: [],
        clarificationNeeded: 'Please specify which module.',
      });

      let lastFrame: () => string | undefined;
      let stdin: { write: (input: string) => void };

      await act(async () => {
        const result = render(<App />);
        lastFrame = result.lastFrame;
        stdin = result.stdin;
      });

      await act(async () => {
        stdin.write('fix it');
        stdin.write('\r');
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      const output = lastFrame!() ?? '';

      // Should contain clarification prefix/indicator
      expect(output).toContain('Clarification');
      expect(output).toContain('Please specify which module.');
    });

    it('should clear clarification when user submits new input', async () => {
      // First submission returns clarification
      vi.mocked(cleanInput)
        .mockResolvedValueOnce({
          tasks: [],
          clarificationNeeded: 'Which file?',
        })
        // Second submission returns a real task
        .mockResolvedValueOnce({
          tasks: [{ prompt: 'Fix the auth bug' }],
        });

      let lastFrame: () => string | undefined;
      let stdin: { write: (input: string) => void };

      await act(async () => {
        const result = render(<App />);
        lastFrame = result.lastFrame;
        stdin = result.stdin;
      });

      // First input triggers clarification
      await act(async () => {
        stdin.write('fix it');
        stdin.write('\r');
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      let output = lastFrame!() ?? '';
      expect(output).toContain('Which file?');

      // Second input should clear clarification
      await act(async () => {
        stdin.write('fix the auth bug in login.ts');
        stdin.write('\r');
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      output = lastFrame!() ?? '';
      // Clarification should be cleared
      expect(output).not.toContain('Which file?');
    });

    it('should not show clarification when cleanInput returns tasks', async () => {
      vi.mocked(cleanInput).mockResolvedValueOnce({
        tasks: [{ prompt: 'Create a hello world function' }],
      });

      let lastFrame: () => string | undefined;
      let stdin: { write: (input: string) => void };

      await act(async () => {
        const result = render(<App />);
        lastFrame = result.lastFrame;
        stdin = result.stdin;
      });

      await act(async () => {
        stdin.write('create hello world');
        stdin.write('\r');
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      const output = lastFrame!() ?? '';

      // Should NOT contain clarification indicator
      expect(output).not.toContain('Clarification');
    });
  });

  describe('Keyboard agent selection (number keys)', () => {
    it('should show number key hint in UI', () => {
      const { lastFrame } = render(<App />);

      const output = lastFrame() ?? '';
      // Should show the number key shortcut hint
      expect(output).toContain('1-9 to focus agent');
    });

    it('should focus agent when pressing corresponding number key', async () => {
      // Mock store with multiple agents
      const mockAgent1 = {
        config: { id: 'agent-1', type: 'claude-code', workingDirectory: '/tmp', task: 'task1' },
        handle: { id: 'agent-1', config: {}, send: vi.fn(), kill: vi.fn(), onOutput: vi.fn(), onExit: vi.fn() },
        status: { id: 'agent-1', state: 'working' as const, summary: 'Working...', lastOutput: '' },
        outputBuffer: 'Output 1',
      };
      const mockAgent2 = {
        config: { id: 'agent-2', type: 'claude-code', workingDirectory: '/tmp', task: 'task2' },
        handle: { id: 'agent-2', config: {}, send: vi.fn(), kill: vi.fn(), onOutput: vi.fn(), onExit: vi.fn() },
        status: { id: 'agent-2', state: 'working' as const, summary: 'Working...', lastOutput: '' },
        outputBuffer: 'Output 2',
      };

      vi.mocked(getStore).mockReturnValue({
        agents: new Map([
          ['agent-1', mockAgent1],
          ['agent-2', mockAgent2],
        ]),
        focusedAgentId: null,
        orchestratorInput: '',
      });

      let stdin: { write: (input: string) => void };

      await act(async () => {
        const result = render(<App />);
        stdin = result.stdin;
      });

      // Press '1' to focus first agent
      await act(async () => {
        stdin.write('1');
      });

      // setFocusedAgent should have been called with the first agent's ID
      expect(setFocusedAgent).toHaveBeenCalledWith('agent-1');
    });

    it('should focus second agent when pressing 2', async () => {
      const mockAgent1 = {
        config: { id: 'agent-1', type: 'claude-code', workingDirectory: '/tmp', task: 'task1' },
        handle: { id: 'agent-1', config: {}, send: vi.fn(), kill: vi.fn(), onOutput: vi.fn(), onExit: vi.fn() },
        status: { id: 'agent-1', state: 'working' as const, summary: 'Working...', lastOutput: '' },
        outputBuffer: 'Output 1',
      };
      const mockAgent2 = {
        config: { id: 'agent-2', type: 'claude-code', workingDirectory: '/tmp', task: 'task2' },
        handle: { id: 'agent-2', config: {}, send: vi.fn(), kill: vi.fn(), onOutput: vi.fn(), onExit: vi.fn() },
        status: { id: 'agent-2', state: 'working' as const, summary: 'Working...', lastOutput: '' },
        outputBuffer: 'Output 2',
      };

      vi.mocked(getStore).mockReturnValue({
        agents: new Map([
          ['agent-1', mockAgent1],
          ['agent-2', mockAgent2],
        ]),
        focusedAgentId: null,
        orchestratorInput: '',
      });

      let stdin: { write: (input: string) => void };

      await act(async () => {
        const result = render(<App />);
        stdin = result.stdin;
      });

      // Press '2' to focus second agent
      await act(async () => {
        stdin.write('2');
      });

      // setFocusedAgent should have been called with the second agent's ID
      expect(setFocusedAgent).toHaveBeenCalledWith('agent-2');
    });

    it('should NOT focus agent when pressing number higher than agent count', async () => {
      // Only one agent exists
      const mockAgent1 = {
        config: { id: 'agent-1', type: 'claude-code', workingDirectory: '/tmp', task: 'task1' },
        handle: { id: 'agent-1', config: {}, send: vi.fn(), kill: vi.fn(), onOutput: vi.fn(), onExit: vi.fn() },
        status: { id: 'agent-1', state: 'working' as const, summary: 'Working...', lastOutput: '' },
        outputBuffer: 'Output 1',
      };

      vi.mocked(getStore).mockReturnValue({
        agents: new Map([['agent-1', mockAgent1]]),
        focusedAgentId: null,
        orchestratorInput: '',
      });

      let stdin: { write: (input: string) => void };

      await act(async () => {
        const result = render(<App />);
        stdin = result.stdin;
      });

      // Press '5' when only 1 agent exists - should be no-op
      await act(async () => {
        stdin.write('5');
      });

      // setFocusedAgent should NOT have been called
      expect(setFocusedAgent).not.toHaveBeenCalled();
    });

    it('should NOT respond to number keys when already in focused view', async () => {
      // Agent already focused
      const mockAgent1 = {
        config: { id: 'agent-1', type: 'claude-code', workingDirectory: '/tmp', task: 'task1' },
        handle: { id: 'agent-1', config: {}, send: vi.fn(), kill: vi.fn(), onOutput: vi.fn(), onExit: vi.fn() },
        status: { id: 'agent-1', state: 'working' as const, summary: 'Working...', lastOutput: '' },
        outputBuffer: 'Output 1',
      };
      const mockAgent2 = {
        config: { id: 'agent-2', type: 'claude-code', workingDirectory: '/tmp', task: 'task2' },
        handle: { id: 'agent-2', config: {}, send: vi.fn(), kill: vi.fn(), onOutput: vi.fn(), onExit: vi.fn() },
        status: { id: 'agent-2', state: 'working' as const, summary: 'Working...', lastOutput: '' },
        outputBuffer: 'Output 2',
      };

      vi.mocked(getStore).mockReturnValue({
        agents: new Map([
          ['agent-1', mockAgent1],
          ['agent-2', mockAgent2],
        ]),
        focusedAgentId: 'agent-1', // Already focused on agent-1
        orchestratorInput: '',
      });

      let stdin: { write: (input: string) => void };

      await act(async () => {
        const result = render(<App />);
        stdin = result.stdin;
      });

      // Clear mock calls from initial render
      vi.mocked(setFocusedAgent).mockClear();

      // Press '2' while already focused - should be ignored
      await act(async () => {
        stdin.write('2');
      });

      // setFocusedAgent should NOT have been called (already in focused view)
      expect(setFocusedAgent).not.toHaveBeenCalled();
    });

    it('should NOT respond to number keys when no agents exist', async () => {
      vi.mocked(getStore).mockReturnValue({
        agents: new Map(),
        focusedAgentId: null,
        orchestratorInput: '',
      });

      let stdin: { write: (input: string) => void };

      await act(async () => {
        const result = render(<App />);
        stdin = result.stdin;
      });

      // Press '1' when no agents exist - should be no-op
      await act(async () => {
        stdin.write('1');
      });

      // setFocusedAgent should NOT have been called
      expect(setFocusedAgent).not.toHaveBeenCalled();
    });
  });
});
