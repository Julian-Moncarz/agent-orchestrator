// src/store.ts

import { AgentConfig, AgentStatus, AgentHandle } from './types.js';
import { logger } from './logger.js';

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
  logger.info('store', 'adding agent', { id: config.id, task: config.task });
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
    const oldState = agent.status.state;
    agent.status = { ...agent.status, ...status };
    logger.debug('store', 'status updated', { id, oldState, newState: agent.status.state });
  } else {
    logger.warn('store', 'update for unknown agent', { id });
  }
}

const MAX_OUTPUT_BUFFER_LENGTH = 2000;

const MAX_LAST_OUTPUT_LENGTH = 500;

export function appendAgentOutput(id: string, chunk: string): void {
  const agent = store.agents.get(id);
  if (agent) {
    agent.outputBuffer += chunk;
    if (agent.outputBuffer.length > MAX_OUTPUT_BUFFER_LENGTH) {
      agent.outputBuffer = agent.outputBuffer.slice(-MAX_OUTPUT_BUFFER_LENGTH);
    }
    // Update lastOutput with the most recent portion of the buffer
    // This ensures the UI can show real output immediately, not just LLM summaries
    agent.status.lastOutput = agent.outputBuffer.slice(-MAX_LAST_OUTPUT_LENGTH);
    logger.debug('store', 'output appended', { id, chunkLength: chunk.length, bufferLength: agent.outputBuffer.length });
  }
}

export function setFocusedAgent(id: string | null): void {
  logger.debug('store', 'focus changed', { from: store.focusedAgentId, to: id });
  store.focusedAgentId = id;
}

export function removeAgent(id: string): void {
  const agent = store.agents.get(id);
  if (agent) {
    logger.info('store', 'removing agent', { id });
    agent.handle.kill();
    store.agents.delete(id);
  }
}
