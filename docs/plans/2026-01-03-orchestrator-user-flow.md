# Agent Orchestrator: User Flow & Requirements

## The One-Liner

A co-pilot that helps you apply context management best practices, with access to all the tools you have (toggling MCPs, starting chats, forking sessions).

---

## Key Assumptions

- **Projects are set up well** - AGENTS.md/CLAUDE.md exists, good folder structure, etc.
- **Agents do a good job** - We trust Claude Code/Amp to execute tasks competently
- **Infrastructure is in place** - User doesn't need to yap huge prompts; agents can figure things out

---

## Terminology

- **Orchestrator** - The meta-layer that manages agents
- **Agent** - A Claude Code/Amp instance spawned by the orchestrator

---

## Core Principles

### 1. Full Visibility, Full Editability, User in Control
- Orchestrator *suggests*, user *confirms*
- Shows cleaned prompt → user can edit → edits get re-cleaned if yappy
- Suggests "this should be a new thread" → user confirms
- Never sends without approval

### 2. Parallel Agents
- Can run multiple agents simultaneously
- User yaps "I have 3 tasks" (or just yaps and orchestrator infers 3 tasks)
- UI shows all active agents with previews
- User clicks into whichever needs attention
- Others run in background

### 3. Continuous Guidance
- Orchestrator watches as you interact with agents
- Suggests cleaned prompts on every input
- Notices "this should be a new chat" moments
- Suggests forks, doesn't force them

### 4. Same Tools as You
- Toggle MCPs + skills + plugins on/off per agent
- Start new chats/agents
- Fork sessions
- Kill agents
- Access context sources (Linear, GitHub, etc.)

### 5. Context Source Awareness (Modular)
- Orchestrator has access to context sources: Linear, GitHub issues/PRs, git history, local files, MCPs/plugins
- Can enrich prompts with relevant context automatically
- User can easily add new context sources (modular/pluggable)

### 6. Directory/Project Awareness
- Orchestrator knows WHERE to run each agent
- Resolves "X project" to a directory
- If ambiguous, asks for clarification
- Has enough context to resolve autonomously when possible

### 7. Configurable Notifications
- When focused on one agent, other agents can notify if they need input
- User controls notification criteria (errors only, all questions, etc.)

---

## User Flow

### Phase 1: User Yaps

```
┌────────────────────────────────────────────────────────────────┐
│  USER YAPS                                                      │
│  "ok so i need to fix that auth bug from yesterday and also    │
│   we should probably add rate limiting to the api and oh yeah  │
│   can you explain how the caching layer works"                 │
└────────────────────────────────────────────────────────────────┘
```

### Phase 2: Orchestrator Suggests Tasks

Orchestrator infers task boundaries (user doesn't explicitly say "3 tasks").
Orchestrator enriches with context sources if relevant.

```
┌────────────────────────────────────────────────────────────────┐
│  ORCHESTRATOR SUGGESTS TASKS                                    │
│                                                                 │
│  Looks like 3 separate tasks:                                   │
│                                                                 │
│  ┌─ Task 1 ────────────────────────────────────────────────┐   │
│  │ Fix the authentication bug from yesterday.              │   │
│  │ (Found: git commit abc123 "temp fix for auth")          │   │
│  │                                         [edit] [start]  │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─ Task 2 ────────────────────────────────────────────────┐   │
│  │ Add rate limiting to the API.                           │   │
│  │                                         [edit] [start]  │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─ Task 3 ────────────────────────────────────────────────┐   │
│  │ Explain how the caching layer works.                    │   │
│  │                                         [edit] [start]  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [Start all]                                                    │
│                                                                 │
│  ┌─ Talk to orchestrator ──────────────────────────────────┐   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

### Phase 3: Edit Flow

User clicks [edit] on a task, yaps more into it.
Orchestrator re-refines if yappy, shows updated version.
User confirms, task starts.

### Phase 4: Running Agents View

```
┌────────────────────────────────────────────────────────────────┐
│  RUNNING AGENTS                                                 │
│                                                                 │
│  ● Auth bug [working]                                          │
│    "Looking at src/auth/login.ts, found the issue in..."      │
│                                                                 │
│  ● Rate limiting [working]                                      │
│    "Adding middleware to api/routes.ts..."                     │
│                                                                 │
│  ⚠ Caching explainer [needs input]                              │
│    "Which caching layer? Redis or the in-memory LRU cache?"   │
│                                                                 │
│  [Click any to focus]                                          │
│                                                                 │
│  ┌─ Talk to orchestrator ──────────────────────────────────┐   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

**Running agents view features:**
- Small preview of what each agent is working on
- "Needs input" indicator when agent stops and last output was a question
- Click any agent to focus
- Text field to talk to orchestrator (yap more tasks, ask questions)
- Notifications pop up when other agents need input (configurable)

### Phase 5: Focused View

```
┌────────────────────────────────────────────────────────────────┐
│  FOCUSED: Auth bug                              [back to list] │
│                                                                 │
│  Agent: Looking at src/auth/login.ts...                        │
│         Found the issue - the token validation was checking... │
│         [streaming...]                                          │
│                                                                 │
│  ┌─ Your input (orchestrator refines before sending) ──────┐   │
│  │ "actually also check the refresh token logic"            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Orchestrator: This sounds like a separate task (refresh       │
│  token handling). Create new agent? [yes] [no, include here]  │
└────────────────────────────────────────────────────────────────┘
```

**Focused view features:**
- Full streaming transcript of agent work
- Input field where yapping gets refined before sending
- Orchestrator suggests forking when input sounds like a new task
- Can expand to see full transcript history
- Notifications from other agents appear here (configurable)

---

## Agent Portability

- Orchestrator is agent-agnostic (modular adapters)
- Primary: Claude Code
- Secondary: Amp
- Future: Codex, others
- Orchestrator code is separate from agent adapter code

---

## Tabled for Future (Out of Scope for v1)

### Worktrees / Isolated Environments
- Git worktrees for branch isolation
- Remote/sandboxed environments (sketch.dev style)
- "Don't run on your device" patterns
- Orchestrator could spin up isolated environments like a human would

**Architecture should not preclude this.**

---

## Unlimited Orchestrator Context (Nice-to-Have)

- Orchestrator itself should ideally never run out of context
- User can yap to orchestrator for unlimited time
- Requires orchestrator to manage its own context (summarize, externalize state)
- Design for this, but don't over-engineer in v1

