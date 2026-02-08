# Requirements: VibeRipped

**Defined:** 2026-02-08
**Core Value:** Every "model is thinking" moment produces exactly one unambiguous physical action — no decisions, no coaching, no friction.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Rotation Engine

- [ ] **ROTN-01**: System rotates sequentially through a bounded exercise pool, advancing one position per trigger
- [ ] **ROTN-02**: User can declare available equipment (kettlebell, dumbbells, pull-up bar, parallettes) and pool assembles from bodyweight + matching equipment exercises
- [ ] **ROTN-03**: System enforces a minimum cooldown interval between exercise prompts to prevent over-triggering
- [ ] **ROTN-04**: Exercise prompt is a crisp command string ("Pushups x15") with zero motivational language, zero optionality
- [ ] **ROTN-05**: Rotation index persists across Claude Code sessions — restarting does not reset the position
- [ ] **ROTN-06**: Exercise pool is stored as transparent, human-editable JSON that the user can inspect and modify
- [ ] **ROTN-07**: System adjusts rep count based on expected latency duration — longer waits produce higher-rep prompts
- [ ] **ROTN-08**: User can set a global difficulty multiplier (e.g., 0.5x beginner, 1x default, 2x advanced) that scales all rep counts

### Statusline Integration

- [ ] **STAT-01**: System operates as a Claude Code statusline provider script (reads stdin JSON, writes formatted output to stdout)
- [ ] **STAT-02**: System detects when Claude Code is actively processing via heuristic analysis of stdin JSON data (context window usage deltas, API duration tracking)
- [ ] **STAT-03**: System operates silently — display only via statusline, no notifications, sounds, or popups
- [ ] **STAT-04**: Exercise prompt uses ANSI color formatting for visual distinction from other statusline content

### GSD Coexistence

- [ ] **COEX-01**: An orchestrator script calls both GSD statusline and VibeRipped modules, concatenating their outputs into a single composite statusline
- [ ] **COEX-02**: VibeRipped output has a stable visual identity (prefix, delimiter, or formatting) so it is distinguishable from GSD output without ambiguity

### Configuration

- [ ] **CONF-01**: User can declare available equipment via configuration that persists across sessions
- [ ] **CONF-02**: Exercise pool data is stored as transparent JSON files that can be directly edited
- [ ] **CONF-03**: CLI command exists for initial setup — declaring equipment and generating the pool (`vibripped config --kettlebell --dumbbells`)
- [ ] **CONF-04**: CLI commands exist for pool management — adding, removing, or listing exercises
- [ ] **CONF-05**: Dry-run mode allows testing exercise output without advancing rotation state or requiring Claude Code
- [ ] **CONF-06**: User can step difficulty up via command (`vibripped harder`) — increments the global multiplier by one notch and persists the change
- [ ] **CONF-07**: User can step difficulty down via command (`vibripped softer`) — decrements the global multiplier by one notch and persists the change

### State Management

- [ ] **STMG-01**: State file uses atomic write-rename pattern (write to temp, then mv) to prevent corruption on crash
- [ ] **STMG-02**: System recovers gracefully from missing or corrupt state file by resetting to defaults without data loss
- [ ] **STMG-03**: State includes pool hash to detect when exercise pool has changed, triggering re-indexing to prevent out-of-bounds rotation

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Profiles

- **PROF-01**: User can define multiple equipment profiles (e.g., "home office" vs "coworking") and switch between them
- **PROF-02**: Profile includes environment context (public-safe filtering for shared workspaces)

### Analytics

- **ANLY-01**: System logs exercise completions with timestamps for optional review
- **ANLY-02**: User can view aggregate movement volume over time

### Advanced Display

- **DISP-01**: Multi-line statusline support — exercise on one line, cooldown timer on another

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Workout programming / periodization | This is an execution primitive, not a training plan — scheduling and progression add identity/negotiation friction |
| Technique instruction / form coaching | System assumes user knows the movements — if it needs explanation, it doesn't belong in the pool |
| Motivational messaging / gamification / streaks | Guilt mechanics cause abandonment; boring systems get used |
| Automatic progressive overload | System never auto-escalates difficulty — user controls intensity manually via harder/softer commands |
| Hook-based trigger system | v1 is statusline-only; hooks add wiring complexity without proven benefit |
| Mobile / external device integration | Lives entirely inside the terminal |
| Random or AI-generated exercises | Pool is curated and bounded — creativity increases variance, variance increases avoidance |
| Sound or desktop notifications | Silent operation is a design invariant — the statusline is the only output surface |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ROTN-01 | Phase 1 | Pending |
| ROTN-02 | Phase 2 | Pending |
| ROTN-03 | Phase 1 | Pending |
| ROTN-04 | Phase 1 | Pending |
| ROTN-05 | Phase 1 | Pending |
| ROTN-06 | Phase 2 | Pending |
| ROTN-07 | Phase 6 | Pending |
| ROTN-08 | Phase 6 | Pending |
| STAT-01 | Phase 3 | Pending |
| STAT-02 | Phase 3 | Pending |
| STAT-03 | Phase 3 | Pending |
| STAT-04 | Phase 3 | Pending |
| COEX-01 | Phase 4 | Pending |
| COEX-02 | Phase 4 | Pending |
| CONF-01 | Phase 2 | Pending |
| CONF-02 | Phase 2 | Pending |
| CONF-03 | Phase 5 | Pending |
| CONF-04 | Phase 5 | Pending |
| CONF-05 | Phase 5 | Pending |
| CONF-06 | Phase 6 | Pending |
| CONF-07 | Phase 6 | Pending |
| STMG-01 | Phase 1 | Pending |
| STMG-02 | Phase 1 | Pending |
| STMG-03 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0

**Coverage: 100%** — All v1 requirements mapped to phases.

---
*Requirements defined: 2026-02-08*
*Last updated: 2026-02-08 after roadmap creation*
