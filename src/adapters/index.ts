// src/adapters/index.ts

import { AgentConfig, AgentHandle } from '../types.js';
import { spawnClaudeCode } from './claude-code.js';

export function spawnAgent(config: AgentConfig): AgentHandle {
  switch (config.type) {
    case 'claude-code':
      return spawnClaudeCode(config);
    case 'amp':
      throw new Error('Amp adapter not yet implemented');
    default:
      throw new Error(`Unknown agent type: ${config.type}`);
  }
}

export { spawnClaudeCode } from './claude-code.js';
