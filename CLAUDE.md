# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A terminal-based co-pilot that manages multiple Claude Code agents in parallel. Uses Ink (React for terminals) for UI, execa for subprocess management, and Claude Haiku for input parsing and status detection.

## Commands

```bash
# Development
ANTHROPIC_API_KEY=... npm run dev    # Run with live TS compilation

# Testing
npm run test                          # Run tests once
npm run test:watch                    # Watch mode

# Build
npm run build                         # Compile to dist/
npm start                             # Run compiled version
```

## Environment Variables

- `ANTHROPIC_API_KEY` - Required, validated at startup
- `LOG_LEVEL` - Optional: debug|info|warn|error (default: debug)
- `ORCHESTRATOR_LOG_FILE` - Optional (default: orchestrator-debug.log)

## Architecture

```
index.tsx (entry, env validation)
└── App.tsx (orchestrator)
    ├── components/
    │   ├── AgentList.tsx    (all agents view)
    │   └── FocusedAgent.tsx (single agent detail)
    ├── store.ts             (global state: agents map, focused ID)
    ├── input-cleaner.ts     (LLM: parse user input → tasks)
    ├── status-detector.ts   (LLM: detect agent state from output)
    ├── adapters/
    │   └── claude-code.ts   (spawn Claude Code subprocess)
    └── logger.ts            (file-based JSON logging)
```

### Data Flow

1. User input → `input-cleaner` parses via Haiku → structured tasks
2. Each task → `spawnAgent()` creates AgentHandle via adapter
3. Handle added to store with 'starting' state
4. Claude Code spawned, output streamed to store buffer
5. `status-detector` polls every 3s, updates agent state
6. UI renders from store state

### Key Patterns

**Global State (store.ts):** Pure functional mutations on a singleton store. No Redux.

**LLM JSON Extraction:** Both LLM utilities use regex to extract JSON from responses, handling model drift:
```typescript
const jsonMatch = text.match(/\{[\s\S]*\}/);
```

**Graceful Degradation:** LLM failures return sensible defaults rather than crashing:
```typescript
catch (error) {
  return { state: 'working', summary: 'Processing...' };
}
```

**Callback Pattern (adapters):** Output handlers registered via `handle.onOutput(cb)`.

## Testing

Tests colocated with source using `.test.ts(x)` suffix. Vitest with globals enabled.

- Mock external dependencies (Anthropic SDK, fs, adapters) using `vi.mock()`
- Reset mocks/state in `beforeEach()`
- Use `vi.hoisted()` for mocks needed before imports

## Debugging

Check `orchestrator-debug.log` for state transitions, API calls, and errors. Adjust `LOG_LEVEL=debug` for maximum verbosity.

## Autonomous Testing with tmux

You can test the TUI autonomously using tmux instead of asking the user to manually test:

```bash
# Start the app in a detached tmux session
tmux new-session -d -s test -x 120 -y 30 'npm run dev'

# Type into the app
tmux send-keys -t test "fix the auth bug" Enter

# See what's on screen (captures the TUI output)
tmux capture-pane -t test -p

# Read detailed logs for debugging
tail -50 orchestrator-debug.log

# Press ESC to exit, or kill the session
tmux send-keys -t test Escape
tmux kill-session -t test
```

This allows you to:
1. Run the real app (not mocked unit tests)
2. Send keystrokes and submit tasks
3. Read screen output via `capture-pane`
4. Read structured logs for detailed state transitions
5. Find bugs without requiring user to manually test and report back

## Constraints

- Output buffer: 2000 chars per agent
- Status polling: every 3 seconds
- No command-line argument parsing - pure env vars
