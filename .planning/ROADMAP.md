# Roadmap: VibeRipped

## Overview

This roadmap delivers a Claude Code statusline provider that converts AI processing latency into deterministic micro-exercise prompts. The journey progresses from a standalone rotation engine with persistent state, through statusline integration and Claude Code process detection, to GSD coexistence via orchestrator pattern, and finally production-ready CLI tooling with adaptive difficulty scaling. Each phase delivers a verifiable capability that builds toward the core value: every "model is thinking" moment produces exactly one unambiguous physical action.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Core Rotation Engine** - Deterministic exercise rotation with persistent state and cooldown enforcement
- [x] **Phase 2: Exercise Pool Configuration** - Equipment-aware pool assembly with human-editable JSON storage
- [x] **Phase 3: Statusline Provider** - Claude Code integration with process detection and formatted output
- [x] **Phase 4: GSD Coexistence** - Multi-provider orchestration via concatenating statusline script
- [ ] **Phase 5: CLI Tooling** - Setup, management, and dry-run commands for user-facing operations
- [ ] **Phase 6: Adaptive Difficulty** - Rep scaling based on latency duration and user-controlled difficulty multiplier

## Phase Details

### Phase 1: Core Rotation Engine
**Goal**: Standalone rotation system that cycles through exercises deterministically with persistent state across sessions

**Depends on**: Nothing (first phase)

**Requirements**: ROTN-01, ROTN-03, ROTN-04, ROTN-05, STMG-01, STMG-02, STMG-03

**Success Criteria** (what must be TRUE):
  1. System advances to the next exercise in the pool each time it is triggered
  2. Rotation position persists across process restarts without resetting
  3. System enforces minimum cooldown interval and refuses to emit prompts during cooldown
  4. Exercise prompts use crisp command format with zero motivational language
  5. State file survives process crashes without corruption and recovers gracefully from corruption

**Plans:** 2 plans

Plans:
- [x] 01-01-PLAN.md — Project scaffold, exercise pool module, state persistence module
- [x] 01-02-PLAN.md — Rotation engine with cooldown enforcement (TDD)

### Phase 2: Exercise Pool Configuration
**Goal**: Users can declare available equipment and system assembles a bounded, transparent exercise pool from bodyweight plus matching equipment exercises

**Depends on**: Phase 1

**Requirements**: ROTN-02, ROTN-06, CONF-01, CONF-02

**Success Criteria** (what must be TRUE):
  1. User can declare available equipment and configuration persists across sessions
  2. Exercise pool is stored as JSON files that the user can directly read and edit
  3. Pool dynamically includes only exercises matching declared equipment plus bodyweight movements
  4. User can manually add or remove exercises from pool files and system adapts rotation accordingly

**Plans:** 2 plans

Plans:
- [x] 02-01-PLAN.md — Config module and exercise database with equipment-based pool assembly (TDD)
- [x] 02-02-PLAN.md — Engine integration with pool.json persistence and user edit preservation (TDD)

### Phase 3: Statusline Provider
**Goal**: System operates as a Claude Code statusline provider that detects active processing and displays formatted exercise prompts

**Depends on**: Phase 2

**Requirements**: STAT-01, STAT-02, STAT-03, STAT-04

**Success Criteria** (what must be TRUE):
  1. System reads stdin JSON from Claude Code and writes formatted output to stdout
  2. System detects when Claude Code is actively processing via heuristic analysis of stdin data
  3. Exercise prompts display in the statusline with ANSI color formatting for visual distinction
  4. System operates silently with zero notifications, sounds, or popups outside the statusline
  5. Statusline updates only during Claude API calls and disappears when processing completes

**Plans:** 2 plans

Plans:
- [x] 03-01-PLAN.md — Statusline library modules: stdin parsing, process detection, ANSI formatting (TDD)
- [x] 03-02-PLAN.md — Statusline entry point integration and real Claude Code validation

### Phase 4: GSD Coexistence
**Goal**: VibeRipped and GSD statusline outputs display side-by-side in a single composite statusline without crosstalk

**Depends on**: Phase 3

**Requirements**: COEX-01, COEX-02

**Success Criteria** (what must be TRUE):
  1. Orchestrator script calls both GSD and VibeRipped modules and concatenates their outputs
  2. VibeRipped output has a stable visual identity that distinguishes it from GSD output
  3. Multiple concurrent Claude Code sessions display both providers without flicker or overwrites
  4. User can identify which segment of the statusline is GSD and which is VibeRipped at a glance

**Plans:** 2 plans

Plans:
- [x] 04-01-PLAN.md — Prefix support for visual identity and orchestrator shell script with tests
- [x] 04-02-PLAN.md — Configure Claude Code and verify composite statusline in live session

### Phase 5: CLI Tooling
**Goal**: User-facing commands for setup, pool management, and testing without requiring direct file editing

**Depends on**: Phase 4

**Requirements**: CONF-03, CONF-04, CONF-05

**Success Criteria** (what must be TRUE):
  1. User can run initial setup command to declare equipment and generate pool
  2. User can add, remove, and list exercises via CLI commands
  3. User can test exercise output in dry-run mode without advancing rotation state
  4. CLI commands validate input and provide clear error messages for invalid operations
  5. Pool management commands update JSON files and trigger state re-indexing automatically

**Plans:** 2 plans

Plans:
- [ ] 05-01-PLAN.md — Commander scaffold, config command, test command with dryRun engine support
- [ ] 05-02-PLAN.md — Pool management commands (list/add/remove) and CLI integration tests

### Phase 6: Adaptive Difficulty
**Goal**: System scales rep counts based on expected latency duration and user-controlled difficulty multiplier

**Depends on**: Phase 5

**Requirements**: ROTN-07, ROTN-08, CONF-06, CONF-07

**Success Criteria** (what must be TRUE):
  1. System adjusts rep count based on detected latency duration with longer waits producing higher reps
  2. User can set a global difficulty multiplier that scales all rep counts proportionally
  3. User can increment difficulty via command and change persists across sessions
  4. User can decrement difficulty via command and change persists across sessions
  5. Rep scaling remains within practical bounds for work environment regardless of multiplier or duration

**Plans**: TBD

Plans:
- [ ] 06-01: TBD during plan-phase

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Rotation Engine | 2/2 | ✓ Complete | 2026-02-08 |
| 2. Exercise Pool Configuration | 2/2 | ✓ Complete | 2026-02-08 |
| 3. Statusline Provider | 2/2 | ✓ Complete | 2026-02-08 |
| 4. GSD Coexistence | 2/2 | ✓ Complete | 2026-02-09 |
| 5. CLI Tooling | 0/2 | Planning complete | - |
| 6. Adaptive Difficulty | 0/? | Not started | - |

---
*Roadmap created: 2026-02-08*
*Last updated: 2026-02-09 after Phase 5 planning complete*
