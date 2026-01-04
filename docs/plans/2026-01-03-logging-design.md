# Logging Design

## Purpose

Developer debugging + Claude Code access to logs for debugging issues.

## Core Architecture

**File:** `src/logger.ts`

A simple logger module that:
- Writes JSON lines to `./orchestrator-debug.log` (or `ORCHESTRATOR_LOG_FILE` env var)
- Respects `LOG_LEVEL` env var (debug/info/warn/error, default: debug)
- Each log entry is a single JSON line with: `level`, `ts`, `component`, `msg`, `data`

**Usage pattern:**
```typescript
import { logger } from './logger.js';

logger.debug('cleanInput', 'received input', { raw: value });
logger.info('agent', 'spawned', { id, task });
logger.error('api', 'anthropic call failed', { error });
```

**Output example:**
```json
{"level":"debug","ts":"2024-01-03T22:45:00.123Z","component":"cleanInput","msg":"received input","data":{"raw":"fix the auth bug"}}
{"level":"info","ts":"2024-01-03T22:45:00.456Z","component":"api","msg":"calling anthropic","data":{"model":"claude-3-5-haiku-20241022"}}
```

## Instrumentation Points

**input-cleaner.ts:**
- `debug`: raw input received
- `debug`: full API request being sent
- `debug`: full API response received
- `info`: parsed tasks summary (count, clarification needed?)
- `error`: API or parse failures

**adapters/claude-code.ts:**
- `info`: agent spawning with config
- `debug`: stdout/stderr chunks received
- `info`: agent exit with code

**status-detector.ts:**
- `debug`: status detection triggered
- `debug`: API request/response
- `info`: status change detected

**store.ts:**
- `debug`: agent added/removed
- `debug`: status updates
- `debug`: output buffer appends

**App.tsx:**
- `info`: user submitted input
- `debug`: state changes (processing, focused agent)
- `warn`: clarification needed but not shown to user

## Implementation Details

**Log file behavior:**
- Append mode (doesn't clear on restart)
- File created on first log write
- No rotation (keep simple for MVP)

**Log level filtering:**
- `error`: only errors
- `warn`: errors + warnings
- `info`: errors + warnings + key events
- `debug`: everything (default)

**Startup behavior:**
- Log `info` entry on startup: orchestrator version, log level, log file path
- Confirms logging is working and where to find the file

**No dependencies:**
- Pure Node.js `fs.appendFileSync`
- No external logging libraries needed
