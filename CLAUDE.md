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

## E2E Testing with tmux

Use tmux to write automated end-to-end tests that verify actual TUI behavior. This tests the real app, not mocked components.

### When to Write E2E Tests

- Any user-facing feature that affects the TUI
- Bug fixes that involve screen output or user interaction
- Changes to input handling, agent display, or status updates

### TDD Approach for E2E Tests

**Write a failing E2E test FIRST, then implement until it passes.**

1. Write a tmux-based test script that exercises the expected behavior
2. Run it - verify it fails (feature doesn't exist yet or bug is present)
3. Implement the fix/feature
4. Run the test again - verify it passes
5. Commit both test and implementation

### Core tmux Commands

```bash
# Start app in detached tmux session
tmux new-session -d -s test -x 120 -y 30 'npm run dev'

# Wait for app to initialize
sleep 2

# Send input to the app
tmux send-keys -t test "task text" Enter

# Capture current screen output
tmux capture-pane -t test -p

# Read structured logs for state verification
tail -50 orchestrator-debug.log

# Send special keys
tmux send-keys -t test Escape      # Exit or cancel
tmux send-keys -t test Up          # Navigate
tmux send-keys -t test Down

# Clean up
tmux kill-session -t test
```

### E2E Test Script Pattern

```bash
#!/bin/bash
# test-feature-name.sh

set -e

# Clean up any existing session
tmux kill-session -t test 2>/dev/null || true

# Start app
tmux new-session -d -s test -x 120 -y 30 'ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY npm run dev'
sleep 3  # Wait for startup

# Execute test actions
tmux send-keys -t test "create two agents for testing" Enter
sleep 2

# Capture output
OUTPUT=$(tmux capture-pane -t test -p)

# Verify expected behavior
if echo "$OUTPUT" | grep -q "Agent 1"; then
  echo "PASS: Agent 1 visible"
else
  echo "FAIL: Agent 1 not found in output"
  tmux kill-session -t test
  exit 1
fi

# Check logs for state transitions
if grep -q '"state":"starting"' orchestrator-debug.log; then
  echo "PASS: Agent state logged correctly"
else
  echo "FAIL: Expected state not in logs"
  tmux kill-session -t test
  exit 1
fi

# Clean up
tmux kill-session -t test
echo "All tests passed!"
```

### Verifying Screen Output

Use `tmux capture-pane` and grep/assertions:

```bash
OUTPUT=$(tmux capture-pane -t test -p)

# Check for expected text
echo "$OUTPUT" | grep -q "Expected Text" || exit 1

# Check for absence of error messages
! echo "$OUTPUT" | grep -q "Error:" || exit 1

# Count occurrences
AGENT_COUNT=$(echo "$OUTPUT" | grep -c "Agent" || true)
[ "$AGENT_COUNT" -eq 2 ] || exit 1
```

### Verifying Log Content

Use the structured JSON logs for precise state verification:

```bash
# Check for specific log entries
grep '"event":"agent_spawned"' orchestrator-debug.log || exit 1

# Verify state transitions
grep '"state":"working"' orchestrator-debug.log || exit 1

# Check for errors
! grep '"level":"error"' orchestrator-debug.log || exit 1
```

### Integration with TDD Workflow

**For E2E bugs:**
1. Write tmux test that reproduces the bug
2. Run test - confirm it fails
3. Fix the bug
4. Run test - confirm it passes
5. Commit: test + fix together

**For new features:**
1. Write tmux test for expected behavior
2. Run test - confirm it fails (feature doesn't exist)
3. Implement the feature
4. Run test - confirm it passes
5. Commit: test + implementation together

## Manual Verification with tmux

**After implementing changes, always manually verify with tmux** - this is in ADDITION to automated tests, not a replacement.

### Manual Testing Process

```bash
# Start app in detached session
tmux new-session -d -s test -x 120 -y 30 'npm run dev'

# Interact with the app
tmux send-keys -t test "your test input" Enter

# Check screen output
tmux capture-pane -t test -p

# Read logs for detailed state
tail -50 orchestrator-debug.log

# Clean up when done
tmux kill-session -t test
```

### What to Verify Manually

1. **Visual rendering** - Does the TUI look correct?
2. **Responsiveness** - Does input register immediately?
3. **State transitions** - Do agents progress through states?
4. **Error handling** - Are errors displayed properly?
5. **Edge cases** - Empty input, special characters, rapid input

### Live Session for User

If the user wants to watch the session live:
```bash
tmux attach -t test
```

This allows the user to see exactly what the agent is testing in real-time.

## Constraints

- Output buffer: 2000 chars per agent
- Status polling: every 3 seconds
- No command-line argument parsing - pure env vars
