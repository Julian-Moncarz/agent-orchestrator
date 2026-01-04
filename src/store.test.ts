// src/store.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getStore, resetStore, addAgent, updateAgentStatus, appendAgentOutput, setFocusedAgent, removeAgent } from './store.js';
import { AgentConfig, AgentHandle } from './types.js';

describe('store', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('getStore', () => {
    it('returns store with empty agents map', () => {
      const store = getStore();

      expect(store.agents).toBeInstanceOf(Map);
      expect(store.agents.size).toBe(0);
      expect(store.focusedAgentId).toBeNull();
      expect(store.orchestratorInput).toBe('');
    });
  });

  describe('addAgent', () => {
    it('adds agent with starting status', () => {
      const config: AgentConfig = {
        id: 'agent-1',
        type: 'claude-code',
        workingDirectory: '/test',
        task: 'test task',
      };
      const handle: AgentHandle = {
        id: 'agent-1',
        config,
        send: vi.fn(),
        kill: vi.fn(),
        onOutput: vi.fn(),
        onExit: vi.fn(),
      };

      addAgent(config, handle);

      const store = getStore();
      expect(store.agents.size).toBe(1);

      const agent = store.agents.get('agent-1');
      expect(agent).toBeDefined();
      expect(agent!.config).toBe(config);
      expect(agent!.handle).toBe(handle);
      expect(agent!.status.state).toBe('starting');
      expect(agent!.status.id).toBe('agent-1');
      expect(agent!.outputBuffer).toBe('');
    });
  });

  describe('updateAgentStatus', () => {
    it('updates agent status with partial update', () => {
      const config: AgentConfig = {
        id: 'agent-1',
        type: 'claude-code',
        workingDirectory: '/test',
        task: 'test task',
      };
      const handle: AgentHandle = {
        id: 'agent-1',
        config,
        send: vi.fn(),
        kill: vi.fn(),
        onOutput: vi.fn(),
        onExit: vi.fn(),
      };

      addAgent(config, handle);
      updateAgentStatus('agent-1', { state: 'working', summary: 'Processing...' });

      const agent = getStore().agents.get('agent-1');
      expect(agent!.status.state).toBe('working');
      expect(agent!.status.summary).toBe('Processing...');
      expect(agent!.status.id).toBe('agent-1'); // unchanged
    });
  });

  describe('appendAgentOutput', () => {
    it('appends output to agent outputBuffer', () => {
      const config: AgentConfig = {
        id: 'agent-1',
        type: 'claude-code',
        workingDirectory: '/test',
        task: 'test task',
      };
      const handle: AgentHandle = {
        id: 'agent-1',
        config,
        send: vi.fn(),
        kill: vi.fn(),
        onOutput: vi.fn(),
        onExit: vi.fn(),
      };

      addAgent(config, handle);
      appendAgentOutput('agent-1', 'Hello');
      appendAgentOutput('agent-1', ' World');

      const agent = getStore().agents.get('agent-1');
      expect(agent!.outputBuffer).toBe('Hello World');
    });

    it('caps outputBuffer at 2000 chars', () => {
      const config: AgentConfig = {
        id: 'agent-1',
        type: 'claude-code',
        workingDirectory: '/test',
        task: 'test task',
      };
      const handle: AgentHandle = {
        id: 'agent-1',
        config,
        send: vi.fn(),
        kill: vi.fn(),
        onOutput: vi.fn(),
        onExit: vi.fn(),
      };

      addAgent(config, handle);

      // Add 1500 'A' chars, then 1000 'B' chars = 2500 total
      appendAgentOutput('agent-1', 'A'.repeat(1500));
      appendAgentOutput('agent-1', 'B'.repeat(1000));

      const agent = getStore().agents.get('agent-1');
      expect(agent!.outputBuffer.length).toBe(2000);
      // Should keep last 2000 chars: 1000 A's + 1000 B's
      expect(agent!.outputBuffer).toBe('A'.repeat(1000) + 'B'.repeat(1000));
    });
  });

  describe('setFocusedAgent', () => {
    it('sets focused agent id', () => {
      setFocusedAgent('agent-1');

      const store = getStore();
      expect(store.focusedAgentId).toBe('agent-1');
    });

    it('sets focused agent id to null', () => {
      setFocusedAgent('agent-1');
      setFocusedAgent(null);

      const store = getStore();
      expect(store.focusedAgentId).toBeNull();
    });
  });

  describe('removeAgent', () => {
    it('removes agent from store and calls kill', () => {
      const config: AgentConfig = {
        id: 'agent-1',
        type: 'claude-code',
        workingDirectory: '/test',
        task: 'test task',
      };
      const killMock = vi.fn();
      const handle: AgentHandle = {
        id: 'agent-1',
        config,
        send: vi.fn(),
        kill: killMock,
        onOutput: vi.fn(),
        onExit: vi.fn(),
      };

      addAgent(config, handle);
      expect(getStore().agents.size).toBe(1);

      removeAgent('agent-1');

      expect(getStore().agents.size).toBe(0);
      expect(getStore().agents.get('agent-1')).toBeUndefined();
      expect(killMock).toHaveBeenCalledTimes(1);
    });

    it('does nothing if agent does not exist', () => {
      // Should not throw
      removeAgent('non-existent');

      expect(getStore().agents.size).toBe(0);
    });
  });
});
