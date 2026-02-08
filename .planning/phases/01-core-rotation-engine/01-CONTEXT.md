# Phase 1: Core Rotation Engine - Context

**Gathered:** 2026-02-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Standalone deterministic exercise rotation engine with persistent state across sessions. Cycles through a hardcoded exercise pool, enforces cooldown between prompts, and recovers gracefully from state corruption. This phase has no UI, no statusline integration, and no user configuration — it's a pure engine that downstream phases consume.

</domain>

<decisions>
## Implementation Decisions

### Prompt format & tone
- Bare minimum detail: just the action (e.g., "20 pushups") — no form cues, no explanation
- Zero motivational language — crisp command format as specified in roadmap
- Tone guidance is sufficient from roadmap requirements; no additional style constraints

### Rep counts (Claude's Discretion)
- Include fixed default rep counts per exercise in Phase 1 (Phase 6 makes them adaptive)
- Claude decides whether to hardcode reps per exercise or use a simple default

### Output format (Claude's Discretion)
- Claude decides the data shape returned by the engine (plain string vs structured object)
- Phase 3 will format for statusline display; Phase 1 just returns exercise data

### Cooldown behavior
- Cooldown interval: Claude's discretion on default value
- Configurability: Claude decides whether to hardcode or make it configurable in Phase 1
- During cooldown trigger: Claude decides behavior (silent skip vs returning remaining time)
- Clock basis: Claude decides (wall-clock simplest for Phase 1 since process detection is Phase 3)

### State file & recovery
- On corruption or missing state: reset to beginning of rotation (exercise 0)
- No backup of corrupted files — just reset cleanly
- State format: Claude's discretion (JSON likely, consistent with Phase 2 pool files)
- State location: Claude's discretion (XDG-style ~/.config/viberipped/ likely)
- Write safety: Claude's discretion on atomic write-rename vs simple writes

### Rotation logic
- Sequential rotation as specified in roadmap — predictability builds trust
- Wrap-around behavior: Claude's discretion (simple loop vs shuffle on wrap)
- Default pool: Claude's discretion on composition (bodyweight-only is the safe bet pre-Phase 2)
- Stats tracking: Claude's discretion on whether to include basic counters

### Language/runtime (Claude's Discretion)
- Claude picks the language/runtime based on Phase 3 requirements (stdin JSON, stdout) and ecosystem fit

### Claude's Discretion
- Default cooldown interval duration
- Whether cooldown is configurable in Phase 1 or hardcoded
- Cooldown trigger behavior (silent skip vs remaining time response)
- Wall-clock vs processing-time cooldown (Phase 1 likely wall-clock)
- State file format and location
- Atomic write-rename vs simple writes
- Wrap-around behavior (loop vs shuffle)
- Default exercise pool composition
- Whether to track basic stats (total prompts emitted)
- Language/runtime choice
- Rep count approach (per-exercise defaults vs single default)
- Output data shape

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User wants bare minimum prompt detail and clean reset on corruption. Everything else is open for Claude to decide based on technical merit.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-core-rotation-engine*
*Context gathered: 2026-02-08*
