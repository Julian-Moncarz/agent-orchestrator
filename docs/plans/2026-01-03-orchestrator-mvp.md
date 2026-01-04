# Agent Orchestrator MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a terminal UI that manages multiple Claude Code/Amp agents in parallel, with input cleaning and status detection.

**Architecture:** Node.js/TypeScript CLI using Ink (React for terminals). Orchestrator uses Claude SDK (Haiku) to clean inputs and detect task boundaries. Spawns Claude Code/Amp as subprocesses via `claude -p` and `amp -x`. Status detection via LLM on recent output.

**Tech Stack:** Node.js 20+, TypeScript, Ink 4.x, execa, Claude SDK (@anthropic-ai/sdk)

---

## Phase 1: Project Setup

### Task 1: Initialize Node.js Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore` (update)
- Create: `src/index.ts`

**Step 1: Initialize package.json**

```bash
cd /Users/julianmoncarz/Projects/agent-orchestrator/.worktrees/feat-mvp
npm init -y
```

**Step 2: Install dependencies**

```bash
npm install ink react @anthropic-ai/sdk execa
npm install -D typescript @types/node @types/react tsx
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

**Step 4: Update .gitignore**

Add:
```
node_modules/
dist/
```

**Step 5: Create minimal src/index.ts**

```typescript
import { render, Text } from 'ink';
import React from 'react';

const App = () => <Text>Agent Orchestrator</Text>;

render(<App />);
```

**Step 6: Add scripts to package.json**

Update package.json scripts:
```json
{
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "type": "module"
}
```

**Step 7: Run to verify**

```bash
npm run dev
```

Expected: "Agent Orchestrator" prints in terminal

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: initialize project with Ink and TypeScript"
```

---

## Phase 2: Agent Adapter Layer

### Task 2: Define Agent Types

**Files:**
- Create: `src/types.ts`

**Step 1: Create type definitions**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add agent type definitions"
```

---

### Task 3: Implement Claude Code Adapter

**Files:**
- Create: `src/adapters/claude-code.ts`
- Create: `src/adapters/index.ts`

**Step 1: Create Claude Code adapter**

```typescript
// src/adapters/claude-code.ts

import { execa, ExecaChildProcess } from 'execa';
import { AgentConfig, AgentHandle } from '../types.js';

export function spawnClaudeCode(config: AgentConfig): AgentHandle {
  const args = [
    '-p',
    '--output-format', 'text',
  ];

  if (config.tools && config.tools.length > 0) {
    args.push('--tools', config.tools.join(','));
  }

  if (config.systemPrompt) {
    args.push('--system-prompt', config.systemPrompt);
  }

  const proc = execa('claude', args, {
    cwd: config.workingDirectory,
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  });

  // Send initial task
  proc.stdin?.write(config.task + '\n');

  const outputCallbacks: ((chunk: string) => void)[] = [];
  const exitCallbacks: ((code: number) => void)[] = [];

  proc.stdout?.on('data', (data: Buffer) => {
    const chunk = data.toString();
    outputCallbacks.forEach(cb => cb(chunk));
  });

  proc.stderr?.on('data', (data: Buffer) => {
    const chunk = data.toString();
    outputCallbacks.forEach(cb => cb(chunk));
  });

  proc.on('exit', (code) => {
    exitCallbacks.forEach(cb => cb(code ?? 0));
  });

  return {
    id: config.id,
    config,
    send: (message: string) => {
      proc.stdin?.write(message + '\n');
    },
    kill: () => {
      proc.kill();
    },
    onOutput: (callback) => {
      outputCallbacks.push(callback);
    },
    onExit: (callback) => {
      exitCallbacks.push(callback);
    },
  };
}
```

**Step 2: Create adapter index**

```typescript
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
```

**Step 3: Commit**

```bash
git add src/adapters/
git commit -m "feat: add Claude Code adapter for spawning agents"
```

---

### Task 4: Test Agent Spawning Manually

**Files:**
- Create: `src/test-spawn.ts` (temporary test file)

**Step 1: Create test script**

```typescript
// src/test-spawn.ts

import { spawnAgent } from './adapters/index.js';
import { AgentConfig } from './types.js';

const config: AgentConfig = {
  id: 'test-1',
  type: 'claude-code',
  workingDirectory: process.cwd(),
  task: 'What is 2 + 2? Reply with just the number.',
  tools: [],  // No tools for simple test
};

console.log('Spawning agent...');
const agent = spawnAgent(config);

agent.onOutput((chunk) => {
  process.stdout.write(chunk);
});

agent.onExit((code) => {
  console.log(`\nAgent exited with code ${code}`);
  process.exit(0);
});

// Kill after 30s if still running
setTimeout(() => {
  console.log('\nTimeout - killing agent');
  agent.kill();
}, 30000);
```

**Step 2: Run test**

```bash
npm run dev -- src/test-spawn.ts
```

Expected: Agent outputs "4" and exits

**Step 3: Remove test file, commit**

```bash
rm src/test-spawn.ts
git add -A
git commit -m "test: verify agent spawning works"
```

---

## Phase 3: Status Detection

### Task 5: Implement LLM-based Status Detection

**Files:**
- Create: `src/status-detector.ts`

**Step 1: Create status detector**

```typescript
// src/status-detector.ts

import Anthropic from '@anthropic-ai/sdk';
import { AgentStatus } from './types.js';

const client = new Anthropic();

interface DetectionResult {
  status: 'working' | 'needs_input' | 'done';
  summary: string;
}

export async function detectStatus(
  agentId: string,
  recentOutput: string
): Promise<AgentStatus> {
  // Truncate to last ~500 chars
  const truncated = recentOutput.slice(-500);

  try {
    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: `Analyze this agent output and respond with JSON only:

OUTPUT:
${truncated}

Respond with exactly this JSON format:
{"status": "working" | "needs_input" | "done", "summary": "1-2 sentence summary of what agent is doing"}

- "working" = agent is actively processing
- "needs_input" = agent asked a question or is waiting for user
- "done" = agent completed its task`
        }
      ]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const parsed = JSON.parse(text) as DetectionResult;

    return {
      id: agentId,
      state: parsed.status,
      summary: parsed.summary,
      lastOutput: truncated,
    };
  } catch (error) {
    // Fallback if LLM fails
    return {
      id: agentId,
      state: 'working',
      summary: 'Processing...',
      lastOutput: truncated,
    };
  }
}
```

**Step 2: Commit**

```bash
git add src/status-detector.ts
git commit -m "feat: add LLM-based status detection"
```

---

## Phase 4: Input Cleaning

### Task 6: Implement Input Cleaner

**Files:**
- Create: `src/input-cleaner.ts`

**Step 1: Create input cleaner**

```typescript
// src/input-cleaner.ts

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export interface CleanedInput {
  tasks: {
    prompt: string;
    suggestedTools?: string[];
  }[];
  clarificationNeeded?: string;
}

export async function cleanInput(rawInput: string): Promise<CleanedInput> {
  const response = await client.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `You are an orchestrator that cleans up user input for coding agents.

USER INPUT:
${rawInput}

Analyze this input and:
1. Identify distinct tasks (if multiple)
2. Clean up each task into a clear, structured prompt
3. Suggest which tools each task might need

Respond with JSON only:
{
  "tasks": [
    {"prompt": "cleaned task description", "suggestedTools": ["Bash", "Read", "Edit"]}
  ],
  "clarificationNeeded": "optional question if input is too ambiguous"
}

If input is clear, omit clarificationNeeded.
Keep prompts concise but complete.`
      }
    ]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  return JSON.parse(text) as CleanedInput;
}
```

**Step 2: Commit**

```bash
git add src/input-cleaner.ts
git commit -m "feat: add input cleaner for yappy prompts"
```

---

## Phase 5: Basic UI

### Task 7: Create Agent State Store

**Files:**
- Create: `src/store.ts`

**Step 1: Create simple state store**

```typescript
// src/store.ts

import { AgentConfig, AgentStatus, AgentHandle } from './types.js';

interface Agent {
  config: AgentConfig;
  handle: AgentHandle;
  status: AgentStatus;
  outputBuffer: string;
}

interface Store {
  agents: Map<string, Agent>;
  focusedAgentId: string | null;
  orchestratorInput: string;
}

const store: Store = {
  agents: new Map(),
  focusedAgentId: null,
  orchestratorInput: '',
};

export function getStore(): Store {
  return store;
}

export function addAgent(config: AgentConfig, handle: AgentHandle): void {
  store.agents.set(config.id, {
    config,
    handle,
    status: {
      id: config.id,
      state: 'starting',
      summary: 'Starting...',
      lastOutput: '',
    },
    outputBuffer: '',
  });
}

export function updateAgentStatus(id: string, status: Partial<AgentStatus>): void {
  const agent = store.agents.get(id);
  if (agent) {
    agent.status = { ...agent.status, ...status };
  }
}

export function appendAgentOutput(id: string, chunk: string): void {
  const agent = store.agents.get(id);
  if (agent) {
    agent.outputBuffer += chunk;
    // Keep last 2000 chars
    if (agent.outputBuffer.length > 2000) {
      agent.outputBuffer = agent.outputBuffer.slice(-2000);
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
```

**Step 2: Commit**

```bash
git add src/store.ts
git commit -m "feat: add simple state store for agents"
```

---

### Task 8: Create Agent List Component

**Files:**
- Create: `src/components/AgentList.tsx`

**Step 1: Create component**

```tsx
// src/components/AgentList.tsx

import React from 'react';
import { Box, Text, useFocus } from 'ink';
import { AgentStatus } from '../types.js';

interface AgentCardProps {
  status: AgentStatus;
  isFocused: boolean;
  onSelect: () => void;
}

const AgentCard: React.FC<AgentCardProps> = ({ status, isFocused }) => {
  const stateColors: Record<string, string> = {
    starting: 'yellow',
    working: 'green',
    needs_input: 'red',
    done: 'blue',
    error: 'red',
  };

  return (
    <Box
      borderStyle={isFocused ? 'double' : 'single'}
      paddingX={1}
      flexDirection="column"
    >
      <Box>
        <Text color={stateColors[status.state] || 'white'}>
          {status.state === 'needs_input' ? '⚠' : '●'} {status.id}
        </Text>
        <Text dimColor> [{status.state}]</Text>
      </Box>
      <Text dimColor wrap="truncate-end">
        {status.summary.slice(0, 60)}
      </Text>
    </Box>
  );
};

interface AgentListProps {
  agents: AgentStatus[];
  focusedId: string | null;
  onSelectAgent: (id: string) => void;
}

export const AgentList: React.FC<AgentListProps> = ({
  agents,
  focusedId,
  onSelectAgent
}) => {
  if (agents.length === 0) {
    return (
      <Box borderStyle="single" paddingX={1}>
        <Text dimColor>No agents running. Type a task below.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Running Agents:</Text>
      {agents.map((agent) => (
        <AgentCard
          key={agent.id}
          status={agent}
          isFocused={agent.id === focusedId}
          onSelect={() => onSelectAgent(agent.id)}
        />
      ))}
    </Box>
  );
};
```

**Step 2: Commit**

```bash
git add src/components/
git commit -m "feat: add AgentList UI component"
```

---

### Task 9: Create Main App Component

**Files:**
- Modify: `src/index.ts` → `src/index.tsx`
- Create: `src/components/App.tsx`

**Step 1: Create App component**

```tsx
// src/components/App.tsx

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { AgentList } from './AgentList.js';
import { getStore, addAgent, appendAgentOutput, updateAgentStatus } from '../store.js';
import { spawnAgent } from '../adapters/index.js';
import { cleanInput } from '../input-cleaner.js';
import { detectStatus } from '../status-detector.js';
import { AgentStatus } from '../types.js';

export const App: React.FC = () => {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Refresh agent list periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const store = getStore();
      setAgents(Array.from(store.agents.values()).map(a => a.status));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Handle keyboard input
  useInput((input, key) => {
    if (key.escape) {
      if (focusedId) {
        setFocusedId(null);
      } else {
        exit();
      }
    }
  });

  const handleSubmit = async (value: string) => {
    if (!value.trim() || isProcessing) return;

    setIsProcessing(true);
    setInput('');

    try {
      const cleaned = await cleanInput(value);

      if (cleaned.clarificationNeeded) {
        // TODO: Handle clarification
        console.log('Clarification needed:', cleaned.clarificationNeeded);
        setIsProcessing(false);
        return;
      }

      for (const task of cleaned.tasks) {
        const id = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

        const config = {
          id,
          type: 'claude-code' as const,
          workingDirectory: process.cwd(),
          task: task.prompt,
          tools: task.suggestedTools,
        };

        const handle = spawnAgent(config);
        addAgent(config, handle);

        handle.onOutput(async (chunk) => {
          appendAgentOutput(id, chunk);

          // Detect status periodically (debounced in real impl)
          const store = getStore();
          const agent = store.agents.get(id);
          if (agent) {
            const status = await detectStatus(id, agent.outputBuffer);
            updateAgentStatus(id, status);
          }
        });

        handle.onExit((code) => {
          updateAgentStatus(id, {
            state: code === 0 ? 'done' : 'error'
          });
        });
      }
    } catch (error) {
      console.error('Error processing input:', error);
    }

    setIsProcessing(false);
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Agent Orchestrator</Text>
      <Box marginY={1}>
        <AgentList
          agents={agents}
          focusedId={focusedId}
          onSelectAgent={setFocusedId}
        />
      </Box>
      <Box borderStyle="single" paddingX={1}>
        <Text dimColor>{isProcessing ? 'Processing...' : '> '}</Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="Type a task..."
        />
      </Box>
      <Text dimColor>ESC to exit | Enter to submit</Text>
    </Box>
  );
};
```

**Step 2: Install ink-text-input**

```bash
npm install ink-text-input
```

**Step 3: Update index.tsx**

```tsx
// src/index.tsx

import { render } from 'ink';
import React from 'react';
import { App } from './components/App.js';

render(<App />);
```

**Step 4: Rename file and update**

```bash
mv src/index.ts src/index.tsx
```

**Step 5: Run to verify**

```bash
npm run dev
```

Expected: UI shows with input field and empty agent list

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add main App with input and agent list"
```

---

## Phase 6: Integration Test

### Task 10: End-to-End Test

**Step 1: Run the app**

```bash
npm run dev
```

**Step 2: Test with simple input**

Type: "What is the capital of France?"

Expected:
- Input gets cleaned
- Agent spawns
- Status updates to "working"
- Agent responds
- Status updates to "done"

**Step 3: Test with multi-task input**

Type: "Tell me a joke and also what is 5 + 5"

Expected:
- Input cleaner detects 2 tasks
- 2 agents spawn
- Both run in parallel

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration test fixes"
```

---

## Phase 7: Polish

### Task 11: Add Focused View

**Files:**
- Create: `src/components/FocusedAgent.tsx`
- Modify: `src/components/App.tsx`

**Step 1: Create FocusedAgent component**

```tsx
// src/components/FocusedAgent.tsx

import React from 'react';
import { Box, Text, Static } from 'ink';

interface FocusedAgentProps {
  id: string;
  output: string;
  status: string;
  onBack: () => void;
}

export const FocusedAgent: React.FC<FocusedAgentProps> = ({
  id,
  output,
  status,
  onBack
}) => {
  const lines = output.split('\n').slice(-30); // Last 30 lines

  return (
    <Box flexDirection="column" padding={1}>
      <Box justifyContent="space-between">
        <Text bold color="cyan">Agent: {id}</Text>
        <Text dimColor>[{status}] Press ESC to go back</Text>
      </Box>
      <Box
        flexDirection="column"
        borderStyle="single"
        padding={1}
        height={20}
      >
        <Static items={lines}>
          {(line, i) => <Text key={i}>{line}</Text>}
        </Static>
      </Box>
    </Box>
  );
};
```

**Step 2: Update App.tsx to use FocusedAgent**

Add to App.tsx:
```tsx
// Add import
import { FocusedAgent } from './FocusedAgent.js';

// In the component, before the return:
if (focusedId) {
  const store = getStore();
  const agent = store.agents.get(focusedId);
  if (agent) {
    return (
      <FocusedAgent
        id={focusedId}
        output={agent.outputBuffer}
        status={agent.status.state}
        onBack={() => setFocusedId(null)}
      />
    );
  }
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add focused agent view"
```

---

### Task 12: Final Cleanup and Push

**Step 1: Ensure all tests pass**

```bash
npm run dev
# Manual testing
```

**Step 2: Push branch**

```bash
git push -u origin feat/mvp
```

**Step 3: Create PR**

```bash
gh pr create --title "feat: MVP agent orchestrator" --body "Initial implementation of agent orchestrator with:
- Claude Code adapter
- LLM-based input cleaning
- LLM-based status detection
- Ink terminal UI
- Parallel agent management"
```

---

## Summary

Total tasks: 12
Estimated time: 2-3 hours

Key files created:
- `src/types.ts` - Type definitions
- `src/adapters/claude-code.ts` - Claude Code subprocess adapter
- `src/status-detector.ts` - LLM status detection
- `src/input-cleaner.ts` - LLM input cleaning
- `src/store.ts` - Simple state management
- `src/components/AgentList.tsx` - Agent list UI
- `src/components/FocusedAgent.tsx` - Focused view UI
- `src/components/App.tsx` - Main app
