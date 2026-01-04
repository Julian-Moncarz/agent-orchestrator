// src/store.ts

import { AgentConfig, AgentStatus, AgentHandle } from './types.js';

export interface Agent {
  config: AgentConfig;
  handle: AgentHandle;
  status: AgentStatus;
  outputBuffer: string;
}

export interface Store {
  agents: Map<string, Agent>;
  focusedAgentId: string | null;
  orchestratorInput: string;
}

let store: Store = createEmptyStore();

function createEmptyStore(): Store {
  return {
    agents: new Map(),
    focusedAgentId: null,
    orchestratorInput: '',
  };
}

export function getStore(): Store {
  return store;
}

export function resetStore(): void {
  store = createEmptyStore();
}

export function addAgent(config: AgentConfig, handle: AgentHandle): void {
  const agent: Agent = {
    config,
    handle,
    status: {
      id: config.id,
      state: 'starting',
      summary: '',
      lastOutput: '',
    },
    outputBuffer: '',
  };
  store.agents.set(config.id, agent);
}

export function updateAgentStatus(id: string, status: Partial<AgentStatus>): void {
  const agent = store.agents.get(id);
  if (agent) {
    agent.status = { ...agent.status, ...status };
  }
}

const MAX_OUTPUT_BUFFER_LENGTH = 2000;

export function appendAgentOutput(id: string, chunk: string): void {
  const agent = store.agents.get(id);
  if (agent) {
    agent.outputBuffer += chunk;
    if (agent.outputBuffer.length > MAX_OUTPUT_BUFFER_LENGTH) {
      agent.outputBuffer = agent.outputBuffer.slice(-MAX_OUTPUT_BUFFER_LENGTH);
    }
  }
}

export function setFocusedAgent(id: string | null): void {
  store.focusedAgentId = id;
}

export function removeAgent(id: string): void {
  const agent = store.agents.get(id);
  if (agent) {
    agent.handle.kill();
    store.agents.delete(id);
  }
}
