# feat: Agent Orchestrator Layer

Build an orchestrator layer that sits between users and coding agents (like Claude Code) to automatically manage context windows, threads, and MCP servers - removing the friction of manual chat/thread management.

## Overview

**Problem**: Users of coding agents waste significant effort manually managing:
- Context windows that grow too large
- Multiple chat threads for different tasks
- Toggling MCPs on/off based on task needs
- Losing context when switching between conversations

**Solution**: An intelligent orchestrator that:
1. Minimizes tokens in model context through observation masking and summarization
2. Automatically creates/forks threads when appropriate
3. Dynamically enables/disables MCPs based on task requirements
4. Provides all the tools users typically need without manual configuration

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                            │
│                    (CLI / API / Chat Interface)                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ORCHESTRATOR CORE                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Context   │  │   Thread    │  │     MCP     │             │
│  │   Manager   │  │   Manager   │  │  Controller │             │
│  │             │  │             │  │             │             │
│  │ • Token     │  │ • Create    │  │ • Discovery │             │
│  │   counting  │  │ • Fork      │  │ • Toggle    │             │
│  │ • Masking   │  │ • Switch    │  │ • Health    │             │
│  │ • Summarize │  │ • Tree nav  │  │ • Routing   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐                               │
│  │    State    │  │    Error    │                               │
│  │   Manager   │  │   Handler   │                               │
│  │             │  │             │                               │
│  │ • Checkpoint│  │ • Retry     │                               │
│  │ • Persist   │  │ • Recovery  │                               │
│  │ • Restore   │  │ • Fallback  │                               │
│  └─────────────┘  └─────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       AGENT RUNTIME                              │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐   │
│  │  Thread 1 │  │  Thread 2 │  │  Thread 3 │  │  Thread N │   │
│  │  (main)   │  │  (fork)   │  │  (fork)   │  │   ...     │   │
│  │           │  │           │  │           │  │           │   │
│  │  Agent ◄──┼──┼── MCP ────┼──┼── Pool ───┼──┼─►         │   │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. Context Manager
- **Token counting**: Real-time tracking using tiktoken
- **Observation masking**: Replace old tool outputs with semantic placeholders
- **LLM summarization**: Trigger at critical thresholds (>60% of context limit)
- **Just-in-time retrieval**: Keep lightweight identifiers, load data when needed

#### 2. Thread Manager
- **Tree structure**: Git-like branching model for conversations
- **Fork operations**: Create branches at any conversation point
- **Thread switching**: Navigate between active threads
- **Lifecycle management**: Archive, restore, delete threads

#### 3. MCP Controller
- **Dynamic discovery**: Read from `.mcp.json` configuration
- **Runtime toggling**: Enable/disable servers based on task needs
- **Health monitoring**: Auto-recovery from MCP failures
- **Tool routing**: Direct tool calls to appropriate MCP server

#### 4. State Manager
- **Checkpointing**: Save state after each significant step
- **Persistence**: SQLite for local, PostgreSQL for production
- **Recovery**: Restore from checkpoint on failure

#### 5. Error Handler
- **Retry logic**: Exponential backoff with jitter
- **Circuit breaker**: Isolate failing components
- **Graceful degradation**: Continue with reduced functionality

### Implementation Phases

#### Phase 1: Foundation
- [ ] Set up project structure (TypeScript/Python)
- [ ] Implement basic CLI interface
- [ ] Create Context Manager with token counting
- [ ] Implement observation masking algorithm

#### Phase 2: Core Orchestration
- [ ] Build Thread Manager with create/fork/switch operations
- [ ] Implement MCP Controller with dynamic toggling
- [ ] Create State Manager with SQLite checkpointing
- [ ] Wire up orchestrator core to Claude Code SDK

#### Phase 3: Intelligence
- [ ] Add LLM-based summarization for critical context overflow
- [ ] Implement automatic fork detection heuristics
- [ ] Build task-to-MCP mapping logic
- [ ] Add progress reporting and streaming

#### Phase 4: Polish
- [ ] Comprehensive error handling and recovery
- [ ] Performance optimization (connection pooling, caching)
- [ ] User experience refinements
- [ ] Documentation and examples

## Proposed Solution

### Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Language | TypeScript | Best SDK support, async-first |
| Agent SDK | claude-code-sdk | Official Anthropic SDK |
| MCP Client | @modelcontextprotocol/sdk | Official MCP SDK |
| State Storage | SQLite (dev) / PostgreSQL (prod) | Simple → scalable path |
| Token Counting | tiktoken | Fast, accurate approximation |
| CLI Framework | Commander.js | Mature, well-documented |

### Key Design Decisions

1. **Observation masking over summarization by default**
   - JetBrains research shows masking is cheaper and often more effective
   - Format: `[Masked: {tool_name} returned {line_count} lines, {token_count} tokens]`

2. **User-initiated forking first, auto-detection later**
   - Simpler to implement and debug
   - User command: `orchestrator fork "trying alternative approach"`

3. **Thread IDs with human-readable prefixes**
   - Format: `{auto-slug}-{short-hash}` e.g., `auth-feature-a3f2`
   - Users can override with custom names

4. **Checkpoint after every agent response, not every tool call**
   - Balances recovery granularity with storage costs
   - Each checkpoint ~10-50KB depending on context size

5. **MCP configuration via extended `.mcp.json`**
   - Add `taskPatterns` field for task-to-MCP mapping
   - Example: `"taskPatterns": ["test", "spec", "coverage"]` for testing MCP

### Context Management Strategy

```
Token Thresholds (for 200K context window):
┌────────────────────────────────────────────────────────────┐
│  0%                                                   100% │
│  ├────────┼────────┼────────┼────────┼────────┼─────────┤ │
│  │        │ MASK   │        │ SUMM   │        │ PANIC   │ │
│  │ Normal │ Start  │ Masked │ Start  │ Summ'd │ Mode    │ │
│  │        │ (30%)  │        │ (60%)  │        │ (90%)   │ │
│  └────────┴────────┴────────┴────────┴────────┴─────────┘ │
│                                                            │
│  30% (60K): Start masking old tool outputs                 │
│  60% (120K): Trigger LLM summarization of masked content   │
│  90% (180K): Emergency summarization, warn user            │
│  95%+: Force thread fork or fail with clear error          │
└────────────────────────────────────────────────────────────┘
```

### Thread Tree Example

```
main (auth feature)
├── a3f2: Initial implementation
│   ├── b7c1: [FORK] Try JWT approach
│   │   └── d4e5: Added refresh tokens ✓
│   └── c8d3: [FORK] Try session approach
│       └── e5f6: Session storage issues ✗
└── f9g0: [CURRENT] Merged JWT approach
```

### Handoff Protocol

```typescript
interface HandoffPayload {
  taskId: string;
  threadId: string;
  description: string;
  contextSummary: string;  // Compressed context
  enabledMcps: string[];   // Active MCP servers
  checkpointId: string;    // For recovery
  metadata: {
    parentThreadId?: string;
    forkPoint?: number;
    tokenBudget: number;
  };
}
```

## Acceptance Criteria

### Functional Requirements
- [ ] User can submit tasks via CLI and receive streaming responses
- [ ] Context stays under 60% of limit during normal operation
- [ ] User can fork conversations with `orchestrator fork`
- [ ] User can switch threads with `orchestrator switch <thread-id>`
- [ ] User can list threads with `orchestrator threads`
- [ ] MCPs toggle automatically based on task content
- [ ] Failed tasks can be resumed from last checkpoint

### Non-Functional Requirements
- [ ] Orchestrator overhead < 100ms per request
- [ ] Checkpoint operations < 50ms
- [ ] Support for 100+ concurrent threads
- [ ] Memory usage < 500MB for orchestrator process

### Quality Gates
- [ ] Unit tests for each manager component
- [ ] Integration tests for full task flows
- [ ] E2E tests for common user scenarios
- [ ] Documentation for all CLI commands

## Success Metrics

1. **Token efficiency**: 50%+ reduction in average context size vs. raw Claude Code
2. **User friction**: No manual context/thread management needed for 90% of tasks
3. **Reliability**: 99% of tasks complete or recover from checkpoint
4. **Performance**: P95 latency overhead < 200ms

## Dependencies & Prerequisites

### Required
- Claude Code SDK access (Python or JS)
- MCP SDK (@modelcontextprotocol/sdk)
- Node.js 20+ or Python 3.11+

### External Services
- Anthropic API (for Claude models)
- Optional: PostgreSQL for production state storage

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Token counting inaccuracy | Medium | Medium | Validate against API response, add safety margin |
| MCP toggle latency | Medium | Low | Connection pooling, lazy initialization |
| Checkpoint storage growth | High | Medium | Retention policy, compression, cleanup job |
| Context loss during summarization | Medium | High | Preserve key facts, validate summaries, allow user override |
| Thread tree complexity | Low | Medium | Limit fork depth, provide visualization |

## Future Considerations

1. **Multi-user support**: Thread isolation, shared threads, permissions
2. **Web UI**: Visual thread tree, context gauge, MCP status dashboard
3. **Learning/optimization**: Track successful patterns, optimize MCP selection
4. **Export/import**: Portable thread archives for sharing
5. **Plugins**: Custom masking rules, summarization strategies

## References

### Internal References
- README.md:1 - Original concept and motivation

### External References
- [Anthropic Context Engineering Guide](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [JetBrains Context Management Research](https://blog.jetbrains.com/research/2025/12/efficient-context-management/)
- [MCP Specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- [Claude Code SDK](https://github.com/anthropics/claude-code-sdk-python)
- [LangGraph Multi-Agent Patterns](https://langchain.com/docs/langgraph)

### Related Projects
- [claude-flow](https://github.com/ruvnet/claude-flow) - Enterprise orchestration with swarm intelligence
- [agents](https://github.com/wshobson/agents) - 99 specialized agents, optimized for minimal token usage

## Open Questions

Before implementation, clarify:

1. **Primary interface**: CLI-first with API, or API-first with CLI wrapper?
2. **Language choice**: TypeScript (better SDK support) or Python (better ML tooling)?
3. **Scope of V1**: All features, or just context management + basic threading?
4. **Target users**: Personal tool, team tool, or both?

---

**MVP Recommendation**: Start with Phase 1 + basic Phase 2:
- CLI interface
- Context Manager (token counting + observation masking)
- Single-thread operation (no forking yet)
- Manual MCP configuration (no auto-toggle yet)
- File-based checkpoints (no database yet)

This delivers the core value proposition (context efficiency) quickly while establishing patterns for the full system.
