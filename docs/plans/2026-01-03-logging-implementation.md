# Logging Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add file-based JSON logging for developer debugging and Claude Code access.

**Architecture:** Single `logger.ts` module using Node.js `fs.appendFileSync`. JSON lines format. Log level filtering via `LOG_LEVEL` env var. Instrument all key code paths.

**Tech Stack:** Node.js fs module, no external dependencies

---

## Phase 1: Logger Module

### Task 1: Create Logger with Tests

**Files:**
- Create: `src/logger.ts`
- Create: `src/logger.test.ts`

**Step 1: Write the failing test for log level filtering**

```typescript
// src/logger.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import { createLogger, LogLevel } from './logger.js';

vi.mock('fs');

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('log level filtering', () => {
    it('should log debug when level is debug', () => {
      const logger = createLogger({ level: 'debug', filePath: 'test.log' });
      logger.debug('test', 'message', { data: 1 });

      expect(fs.appendFileSync).toHaveBeenCalledTimes(1);
      const call = vi.mocked(fs.appendFileSync).mock.calls[0];
      const logged = JSON.parse(call[1] as string);
      expect(logged.level).toBe('debug');
      expect(logged.component).toBe('test');
      expect(logged.msg).toBe('message');
      expect(logged.data).toEqual({ data: 1 });
    });

    it('should not log debug when level is info', () => {
      const logger = createLogger({ level: 'info', filePath: 'test.log' });
      logger.debug('test', 'message', {});

      expect(fs.appendFileSync).not.toHaveBeenCalled();
    });

    it('should log error at all levels', () => {
      const logger = createLogger({ level: 'error', filePath: 'test.log' });
      logger.error('test', 'message', {});

      expect(fs.appendFileSync).toHaveBeenCalledTimes(1);
    });
  });

  describe('JSON format', () => {
    it('should include timestamp in ISO format', () => {
      const logger = createLogger({ level: 'debug', filePath: 'test.log' });
      logger.info('comp', 'msg', {});

      const call = vi.mocked(fs.appendFileSync).mock.calls[0];
      const logged = JSON.parse(call[1] as string);
      expect(logged.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should write to correct file path', () => {
      const logger = createLogger({ level: 'debug', filePath: '/tmp/mylog.log' });
      logger.info('comp', 'msg', {});

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        '/tmp/mylog.log',
        expect.any(String)
      );
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/logger.test.ts`
Expected: FAIL with "Cannot find module './logger.js'"

**Step 3: Write minimal implementation**

```typescript
// src/logger.ts

import * as fs from 'fs';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

interface LoggerConfig {
  level: LogLevel;
  filePath: string;
}

interface Logger {
  debug: (component: string, msg: string, data: Record<string, unknown>) => void;
  info: (component: string, msg: string, data: Record<string, unknown>) => void;
  warn: (component: string, msg: string, data: Record<string, unknown>) => void;
  error: (component: string, msg: string, data: Record<string, unknown>) => void;
}

export function createLogger(config: LoggerConfig): Logger {
  const shouldLog = (level: LogLevel): boolean => {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[config.level];
  };

  const log = (level: LogLevel, component: string, msg: string, data: Record<string, unknown>) => {
    if (!shouldLog(level)) return;

    const entry = {
      level,
      ts: new Date().toISOString(),
      component,
      msg,
      data,
    };

    fs.appendFileSync(config.filePath, JSON.stringify(entry) + '\n');
  };

  return {
    debug: (component, msg, data) => log('debug', component, msg, data),
    info: (component, msg, data) => log('info', component, msg, data),
    warn: (component, msg, data) => log('warn', component, msg, data),
    error: (component, msg, data) => log('error', component, msg, data),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/logger.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/logger.ts src/logger.test.ts
git commit -m "feat: add logger module with level filtering"
```

---

### Task 2: Add Default Logger Instance

**Files:**
- Modify: `src/logger.ts`
- Modify: `src/logger.test.ts`

**Step 1: Add test for default logger**

Add to `src/logger.test.ts`:

```typescript
describe('default logger', () => {
  it('should use LOG_LEVEL env var', () => {
    vi.stubEnv('LOG_LEVEL', 'warn');

    // Re-import to pick up env var
    vi.resetModules();
    const { logger } = await import('./logger.js');

    logger.info('test', 'should not log', {});
    expect(fs.appendFileSync).not.toHaveBeenCalled();

    logger.warn('test', 'should log', {});
    expect(fs.appendFileSync).toHaveBeenCalled();

    vi.unstubAllEnvs();
  });

  it('should use ORCHESTRATOR_LOG_FILE env var', () => {
    vi.stubEnv('ORCHESTRATOR_LOG_FILE', '/custom/path.log');
    vi.stubEnv('LOG_LEVEL', 'debug');

    vi.resetModules();
    const { logger } = await import('./logger.js');

    logger.info('test', 'msg', {});

    expect(fs.appendFileSync).toHaveBeenCalledWith(
      '/custom/path.log',
      expect.any(String)
    );

    vi.unstubAllEnvs();
  });

  it('should default to debug level and orchestrator-debug.log', () => {
    vi.stubEnv('LOG_LEVEL', '');
    vi.stubEnv('ORCHESTRATOR_LOG_FILE', '');

    vi.resetModules();
    const { logger } = await import('./logger.js');

    logger.debug('test', 'msg', {});

    expect(fs.appendFileSync).toHaveBeenCalledWith(
      'orchestrator-debug.log',
      expect.any(String)
    );

    vi.unstubAllEnvs();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/logger.test.ts`
Expected: FAIL with "logger is not exported"

**Step 3: Add default logger export**

Add to end of `src/logger.ts`:

```typescript
// Default logger instance
const DEFAULT_LOG_FILE = 'orchestrator-debug.log';
const DEFAULT_LOG_LEVEL: LogLevel = 'debug';

function getLogLevel(): LogLevel {
  const level = process.env.LOG_LEVEL?.toLowerCase();
  if (level && ['debug', 'info', 'warn', 'error'].includes(level)) {
    return level as LogLevel;
  }
  return DEFAULT_LOG_LEVEL;
}

function getLogFile(): string {
  return process.env.ORCHESTRATOR_LOG_FILE || DEFAULT_LOG_FILE;
}

export const logger = createLogger({
  level: getLogLevel(),
  filePath: getLogFile(),
});
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/logger.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/logger.ts src/logger.test.ts
git commit -m "feat: add default logger instance with env var config"
```

---

## Phase 2: Instrument Codebase

### Task 3: Instrument input-cleaner.ts

**Files:**
- Modify: `src/input-cleaner.ts`

**Step 1: Add logging imports and calls**

```typescript
// src/input-cleaner.ts

import Anthropic from '@anthropic-ai/sdk';
import { logger } from './logger.js';

const client = new Anthropic();

export interface CleanedInput {
  tasks: {
    prompt: string;
    suggestedTools?: string[];
  }[];
  clarificationNeeded?: string;
}

export async function cleanInput(rawInput: string): Promise<CleanedInput> {
  logger.debug('cleanInput', 'received input', { raw: rawInput });

  // Handle empty input gracefully
  if (!rawInput.trim()) {
    logger.info('cleanInput', 'empty input', {});
    return {
      tasks: [],
      clarificationNeeded: 'Please provide a task description.',
    };
  }

  try {
    const requestBody = {
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      messages: [
        {
          role: 'user' as const,
          content: `Analyze this user input and clean it up into clear, actionable tasks.

INPUT:
${rawInput}

Respond with exactly this JSON format:
{
  "tasks": [
    { "prompt": "Clear, actionable task description", "suggestedTools": ["Tool1", "Tool2"] }
  ],
  "clarificationNeeded": "Question to ask user if input is ambiguous (optional)"
}

Available tools: Bash, Read, Edit, Write, Glob, Grep

Rules:
- Clean up informal language into clear prompts
- Identify distinct tasks if multiple exist
- Each task should be a clear, actionable instruction
- Suggest which tools each task might need (optional)
- If input is too vague or ambiguous to create tasks, return empty tasks array with clarificationNeeded`,
        },
      ],
    };

    logger.debug('cleanInput', 'calling anthropic', { model: requestBody.model });

    const response = await client.messages.create(requestBody);

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    logger.debug('cleanInput', 'received response', { text });

    const parsed = JSON.parse(text) as CleanedInput;

    logger.info('cleanInput', 'parsed result', {
      taskCount: parsed.tasks.length,
      clarificationNeeded: !!parsed.clarificationNeeded,
    });

    return parsed;
  } catch (error) {
    logger.error('cleanInput', 'failed', { error: String(error) });
    // Fallback if LLM fails - return the raw input as a single task
    return {
      tasks: [{ prompt: rawInput }],
    };
  }
}
```

**Step 2: Run existing tests to verify no regression**

Run: `npm test -- src/input-cleaner.test.ts`
Expected: PASS (logging shouldn't affect existing tests)

**Step 3: Commit**

```bash
git add src/input-cleaner.ts
git commit -m "feat: add logging to input-cleaner"
```

---

### Task 4: Instrument adapters/claude-code.ts

**Files:**
- Modify: `src/adapters/claude-code.ts`

**Step 1: Add logging**

```typescript
// src/adapters/claude-code.ts

import { execa, ExecaChildProcess } from 'execa';
import { AgentConfig, AgentHandle } from '../types.js';
import { logger } from '../logger.js';

export function spawnClaudeCode(config: AgentConfig): AgentHandle {
  logger.info('claude-code', 'spawning agent', {
    id: config.id,
    task: config.task,
    tools: config.tools,
    cwd: config.workingDirectory,
  });

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

  logger.debug('claude-code', 'exec args', { args });

  const proc = execa('claude', args, {
    cwd: config.workingDirectory,
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  });

  // Send initial task and close stdin (for -p/print mode)
  proc.stdin?.write(config.task + '\n');
  proc.stdin?.end();

  const outputCallbacks: ((chunk: string) => void)[] = [];
  const exitCallbacks: ((code: number) => void)[] = [];

  proc.stdout?.on('data', (data: Buffer) => {
    const chunk = data.toString();
    logger.debug('claude-code', 'stdout', { id: config.id, chunk });
    outputCallbacks.forEach(cb => cb(chunk));
  });

  proc.stderr?.on('data', (data: Buffer) => {
    const chunk = data.toString();
    logger.debug('claude-code', 'stderr', { id: config.id, chunk });
    outputCallbacks.forEach(cb => cb(chunk));
  });

  proc.on('exit', (code) => {
    logger.info('claude-code', 'agent exited', { id: config.id, code });
    exitCallbacks.forEach(cb => cb(code ?? 0));
  });

  return {
    id: config.id,
    config,
    // Note: In print mode (-p), stdin is closed after the initial task.
    // This send method is a no-op for this adapter. Interactive mode
    // would require a different implementation.
    send: (message: string) => {
      proc.stdin?.write(message + '\n');
    },
    kill: () => {
      logger.info('claude-code', 'killing agent', { id: config.id });
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

**Step 2: Verify no regression**

Run: `npm test`
Expected: PASS

**Step 3: Commit**

```bash
git add src/adapters/claude-code.ts
git commit -m "feat: add logging to claude-code adapter"
```

---

### Task 5: Instrument status-detector.ts

**Files:**
- Modify: `src/status-detector.ts`

**Step 1: Add logging**

```typescript
// src/status-detector.ts

import Anthropic from '@anthropic-ai/sdk';
import { AgentStatus } from './types.js';
import { logger } from './logger.js';

const client = new Anthropic();

interface DetectionResult {
  status: 'working' | 'needs_input' | 'done';
  summary: string;
}

export async function detectStatus(
  agentId: string,
  recentOutput: string
): Promise<Partial<AgentStatus>> {
  // Truncate to last ~500 chars
  const truncated = recentOutput.slice(-500);

  logger.debug('status-detector', 'detecting status', { agentId, outputLength: truncated.length });

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
- "done" = agent completed its task`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    logger.debug('status-detector', 'received response', { agentId, text });

    const parsed = JSON.parse(text) as DetectionResult;

    logger.info('status-detector', 'status detected', {
      agentId,
      status: parsed.status,
      summary: parsed.summary,
    });

    return {
      state: parsed.status,
      summary: parsed.summary,
      lastOutput: truncated,
    };
  } catch (error) {
    logger.error('status-detector', 'detection failed', { agentId, error: String(error) });
    // Fallback if LLM fails
    return {
      state: 'working',
      summary: 'Processing...',
      lastOutput: truncated,
    };
  }
}
```

**Step 2: Verify no regression**

Run: `npm test -- src/status-detector.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/status-detector.ts
git commit -m "feat: add logging to status-detector"
```

---

### Task 6: Instrument store.ts

**Files:**
- Modify: `src/store.ts`

**Step 1: Add logging**

```typescript
// src/store.ts

import { AgentConfig, AgentStatus, AgentHandle } from './types.js';
import { logger } from './logger.js';

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
  logger.info('store', 'adding agent', { id: config.id, task: config.task });
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
    const oldState = agent.status.state;
    agent.status = { ...agent.status, ...status };
    logger.debug('store', 'status updated', { id, oldState, newState: agent.status.state });
  } else {
    logger.warn('store', 'update for unknown agent', { id });
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
```

**Step 2: Verify no regression**

Run: `npm test -- src/store.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/store.ts
git commit -m "feat: add logging to store"
```

---

### Task 7: Instrument App.tsx

**Files:**
- Modify: `src/components/App.tsx`

**Step 1: Add logging to App component**

Add import at top:
```typescript
import { logger } from '../logger.js';
```

Update `handleSubmit` function:

```typescript
  // Handle input submission
  const handleSubmit = useCallback(async (value: string) => {
    logger.info('app', 'input submitted', { value });

    if (!value.trim() || isProcessing) {
      logger.debug('app', 'ignoring submit', { empty: !value.trim(), isProcessing });
      return;
    }

    setIsProcessing(true);
    setInputValue('');

    try {
      const cleaned = await cleanInput(value);

      if (cleaned.clarificationNeeded) {
        logger.warn('app', 'clarification needed but not shown to user', {
          clarification: cleaned.clarificationNeeded,
        });
        // For MVP, just log clarification needed
        // In a full implementation, we'd show this to the user
        return;
      }

      logger.info('app', 'spawning agents', { taskCount: cleaned.tasks.length });

      // Spawn an agent for each task
      for (const task of cleaned.tasks) {
        const agentId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const config = {
          id: agentId,
          type: 'claude-code' as const,
          workingDirectory: process.cwd(),
          task: task.prompt,
          tools: task.suggestedTools,
        };

        logger.debug('app', 'spawning agent', { agentId, task: task.prompt });

        const handle = spawnAgent(config);
        addAgent(config, handle);

        // Set up output handling
        handle.onOutput((chunk) => {
          appendAgentOutput(agentId, chunk);
        });

        handle.onExit(() => {
          updateAgentStatus(agentId, { state: 'done' });
          syncAgents();
        });
      }

      syncAgents();
    } catch (error) {
      logger.error('app', 'handleSubmit failed', { error: String(error) });
    } finally {
      setIsProcessing(false);
      logger.debug('app', 'processing complete');
    }
  }, [isProcessing, syncAgents]);
```

**Step 2: Verify no regression**

Run: `npm test -- src/components/App.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/App.tsx
git commit -m "feat: add logging to App component"
```

---

### Task 8: Add Startup Log

**Files:**
- Modify: `src/index.tsx`

**Step 1: Add startup logging**

```typescript
// src/index.tsx

import { render } from 'ink';
import React from 'react';
import { App } from './components/App.js';
import { logger } from './logger.js';

logger.info('startup', 'orchestrator starting', {
  logLevel: process.env.LOG_LEVEL || 'debug',
  logFile: process.env.ORCHESTRATOR_LOG_FILE || 'orchestrator-debug.log',
  cwd: process.cwd(),
});

render(<App />);
```

**Step 2: Run dev to verify startup log appears**

Run: `npm run dev` (then Ctrl+C to exit)
Run: `cat orchestrator-debug.log`
Expected: See startup log entry

**Step 3: Commit**

```bash
git add src/index.tsx
git commit -m "feat: add startup logging"
```

---

## Phase 3: Verify

### Task 9: Manual Integration Test

**Step 1: Clear old log file**

Run: `rm -f orchestrator-debug.log`

**Step 2: Run the app and test**

Run: `npm run dev`
- Type a task and press Enter
- Wait for it to process
- Press ESC to exit

**Step 3: Review logs**

Run: `cat orchestrator-debug.log`
Expected: Should see full trace of what happened - input received, API calls, task parsing, agent spawn (or clarification warning)

**Step 4: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix: logging integration fixes"
```

---

## Summary

**Total tasks:** 9
**Files created:** 2 (logger.ts, logger.test.ts)
**Files modified:** 7 (input-cleaner.ts, claude-code.ts, status-detector.ts, store.ts, App.tsx, index.tsx)

After implementation, run `npm run dev`, reproduce the bug, then read `orchestrator-debug.log` to see exactly what code path was taken.
