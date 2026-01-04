# Agent Orchestrator: Architecture

How we're building what's defined in `2026-01-03-orchestrator-user-flow.md`.

---

## Decided

### Runtime & Language: Node.js + TypeScript
- Native async streaming for subprocess management
- Same ecosystem as Claude Code
- Ink (React for CLI) is battle-tested - Claude Code and Gemini CLI use it

### UI Framework: Ink (React for terminals)
- TUI first, web companion later if needed for transcript viewing
- `useFocus` for agent switching
- `<Static>` for completed output

### Agent CLIs: Fully controllable
**Claude Code:**
- `-p` / `--print` for non-interactive mode
- `--output-format stream-json --verbose` for structured streaming
- `--tools "Bash,Read,Edit"` to restrict tools per instance
- `--mcp-config` for per-invocation MCP setup
- `--system-prompt` for custom agent personas

**Amp:**
- `-x` / `--execute` for non-interactive mode
- `--stream-json` for structured output
- `--dangerously-allow-all` to skip permission prompts
- `--mcp-config` for per-invocation setup

### Orchestrator: Claude SDK with tools
- Use Claude SDK directly (not Claude Code as orchestrator)
- Tools: `spawn_agent`, `kill_agent`, `send_to_agent`, etc.
- Keep orchestrator context small: agent summaries, not full transcripts

### Detecting "Needs Input": LLM-based
- Pass last ~500 tokens of agent output to a small/cheap LLM (Haiku or smaller)
- LLM outputs: `{ summary: string, status: "working" | "done" | "needs_input" }`
- LLM calls in hot path are fine if cheap enough
- Optimize for cost, not avoiding LLM calls

### Context Sources: MVP set, future TODO
- MVP: Local files, Git history, GitHub (via `gh` CLI)
- Config via env vars
- Pluggable system is premature optimization - skip for v1
- Agent itself can find context if needed (it has tools)

---

## Uncertain / To Decide

### Single LLM vs Multiple for Orchestrator
**Option A: Single LLM (Sonnet/Haiku) with tools**
- One API call does cleaning + routing + management
- Simpler, fewer moving parts

**Option B: Multiple specialized LLMs**
- Haiku for cleaning (fast, cheap)
- Sonnet/Haiku for routing decisions
- More latency but potentially cheaper

**Leaning toward:** Try Haiku first (latency matters). Single LLM to start, split if needed.

### Clarifying Questions: Orchestrator or Agent?
- Orchestrator asks upfront if it can't route confidently?
- Or spawn agent and let it ask?
- **Leaning toward:** Let agents ask. Orchestrator's job is routing, not deep understanding.

---

## Stack Summary

```
Runtime:        Node.js 20+ with TypeScript
UI:             Ink 4.x (React for terminals)
Subprocess:     execa (cleaner than child_process)
Orchestrator:   Claude SDK (Haiku to start, can swap to Sonnet)
Agents:         Claude Code via `claude -p`, Amp via `amp -x`
State:          Zustand or simple React state
Detection:      LLM-based (Haiku) for status + summary
Context:        Simple adapters (files, git, github) - MVP only
```

---

## Tabled for Future

### Show agent results as they complete
When running parallel research agents, results should stream back as each finishes rather than waiting for all to complete. User can review outputs incrementally.

### Worktrees / Isolated Environments
Git worktrees, remote sandboxes, sketch.dev-style isolation. Architecture should not preclude this.

### Unlimited Orchestrator Context
Orchestrator manages its own context via summarization/externalization. Nice-to-have for v1.

### Rich Context Source Pluggability
Full plugin system for context sources. Premature for MVP.

---

## Research Notes

Full research from sub-agents available in conversation history. Key sources:
- Claude Code CLI: `claude --help`, supports full programmatic control
- Amp CLI: `amp --help`, equivalent capabilities
- Ink: Used by Claude Code, Gemini CLI - proven for this use case
