// src/types.ts

export interface AgentConfig {
  id: string;
  type: 'claude-code' | 'amp';
  workingDirectory: string;
  task: string;
  tools?: string[];          // e.g., ["Bash", "Read", "Edit"]
  systemPrompt?: string;
}

export interface AgentStatus {
  id: string;
  state: 'starting' | 'working' | 'needs_input' | 'done' | 'error';
  summary: string;           // LLM-generated summary of current work
  lastOutput: string;        // Last ~500 chars of output
}

export interface AgentHandle {
  id: string;
  config: AgentConfig;
  send: (message: string) => void;
  kill: () => void;
  onOutput: (callback: (chunk: string) => void) => void;
  onExit: (callback: (code: number) => void) => void;
}
