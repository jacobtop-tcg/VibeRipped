# VibeRipped

## What This Is

A Claude Code statusline provider that converts AI processing latency into deterministic micro-exercise prompts with adaptive difficulty scaling. When the model is actively computing, the statusline emits exactly one movement instruction from a rotating, equipment-aware exercise pool — with rep counts scaled by latency duration and user-controlled difficulty. Supports timed exercises, environment-aware filtering, category-balanced rotation, and interactive setup. Installable via npm.

## Core Value

Every "model is thinking" moment produces exactly one unambiguous physical action — no decisions, no coaching, no friction — so the user moves by default instead of browsing by default.

## Current State

Shipped v1.1 with 9,564 LOC JavaScript across 14 phases (28 plans). Zero external dependencies beyond Commander.js (CLI).

Tech stack: Node.js, built-in test runner (node:test), Commander.js (CLI), ANSI escape codes (formatting), bash (orchestrator).

Features delivered:
- Deterministic sequential rotation engine with atomic state persistence
- Equipment-configurable exercise pool (kettlebell, dumbbells, pull-up bar, parallettes + bodyweight)
- Claude Code statusline provider with delta-based API detection (v1.1 improvement)
- GSD coexistence via bash orchestrator with 💪 visual identity prefix
- Full CLI: `viberipped config show/set/get`, `viberipped test`, `viberipped pool list/add/remove/manage`, `viberipped harder/softer`, `viberipped setup`
- Adaptive difficulty: latency-based rep scaling (2-30s → 1.0-1.5x) with user multiplier (0.5-2.5x), bounds [5-60]
- Timed exercises ("Plank 30s") alongside rep-based exercises
- Environment profiles (home/office/coworking/anywhere) filtering exercises by context
- Category-aware rotation preventing consecutive same-muscle-group exercises
- Interactive setup wizard with checkbox equipment selection
- Batch add and interactive checklist management
- Configurable detection sensitivity (strict/normal/relaxed) with v1.0 fallback

Known limitations:
- Concurrent Claude Code sessions share state file — atomic write-rename mitigates but read-modify-write race remains

311 tests passing.

## Requirements

### Validated

- ✓ Statusline provider script that detects Claude Code processing state — v1.0
- ✓ Equipment-configurable exercise pool (user declares available gear, pool assembles from bodyweight + matching equipment exercises) — v1.0
- ✓ Deterministic rotation engine — sequential cycling through the pool, predictable next-up behavior — v1.0
- ✓ Compact, identifiable status segment that coexists with other statusline providers (GSD, etc.) without overwriting or conflicting — v1.0
- ✓ Minimal persistent state (rotation index, cooldown timestamp) stored in a state file — v1.0
- ✓ Cooldown mechanism to prevent over-triggering on rapid successive commands — v1.0
- ✓ Crisp, command-style output format — "Pushups x15" not "Try doing some push-ups to stay active!" — v1.0
- ✓ Configuration surface for exercise pool (add/remove equipment categories, customize exercises and rep counts) — v1.0
- ✓ Adaptive difficulty scaling based on API latency duration — v1.0
- ✓ User-controlled difficulty multiplier with harder/softer commands — v1.0
- ✓ npm package with global install and one-command setup — v1.1
- ✓ README with usage docs, install instructions, CLI reference — v1.1
- ✓ Smarter detection heuristic — only trigger during actual API calls — v1.1
- ✓ Category-aware rotation — avoid stacking same muscle group — v1.1
- ✓ Timed exercises support (planks, wall sits) alongside rep-based — v1.1
- ✓ Environment profiles (home office vs coworking — filter exercises by context) — v1.1
- ✓ Interactive terminal wizard for first-time setup (checkbox equipment selection) — v1.1
- ✓ Batch exercise add from comma-separated list — v1.1
- ✓ Interactive exercise checklist for add/remove management — v1.1

### Active

(None — planning next milestone)

### Out of Scope

- Workout programming or periodization — this is not a training plan
- Technique instruction or form coaching — assumes user knows the movements
- Motivational messaging, gamification, or streaks — the system is an execution primitive, not a companion
- Hook-based trigger system — statusline-only, no hooks
- Mobile or external device integration — lives entirely inside the terminal
- Random or AI-generated exercises — pool is curated and bounded
- Sound or desktop notifications — silent operation is a design invariant
- Exercise completion logging/analytics — tracking adds friction without proven benefit (deferred to v2)
- Auto-progressive overload — user controls intensity manually via harder/softer commands

## Context

- The user runs multiple concurrent Claude Code projects, dispatching frequent non-trivial commands
- The existing Claude Code environment includes the GSD plugin — VibeRipped coexists via bash orchestrator
- Available equipment includes: kettlebell, dumbbells, pull-up bar, parallettes (plus bodyweight movements)
- The statusline is a composite surface — each provider owns its segment
- State stored at ~/.config/viberipped/ following XDG Base Directory convention

## Constraints

- **UI coexistence**: Must not overwrite, clear, or monopolize the shared statusline surface — emit only a self-contained segment with a stable identity/prefix
- **Cognitive load**: Output must be a single imperative instruction, never a choice or suggestion — zero decision overhead
- **Intensity ceiling**: Movements must be finishable quickly, avoid sweat/recovery debt, and preserve ability to re-engage cognitively with code
- **Determinism**: User must be able to predict "next time, it picks the next item in the rotation" — simple state machine, no surprise adaptations
- **Compliance through simplicity**: If it ever becomes a barrier to returning to the keyboard, it has failed — optimize for compliance, not stimulus
- **Rep bounds**: All rep counts clamped to [5, 60] regardless of latency or difficulty settings — work-environment safety

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Statusline provider (not hook) | Self-contained, no hook wiring, polled naturally by Claude Code | ✓ Good — clean integration, zero setup beyond config |
| Process detection via heuristics | Statusline checks if Claude Code is actively processing via token delta tracking | ✓ Good — v1.1 improved to duration-based delta |
| Equipment-configurable pool | User declares gear once, pool assembles automatically | ✓ Good — transparent JSON, user-editable |
| Sequential rotation (not random) | Predictability builds trust and automaticity | ✓ Good — user always knows what's coming |
| Atomic write-rename for state | Prevents corruption from crashes via temp+rename pattern | ✓ Good — zero corruption incidents |
| TDD with built-in test runner | Zero external dependencies, fast execution | ✓ Good — 311 tests, node:test sufficient |
| 💪 emoji as visual identity | Unambiguous distinction from GSD output in composite statusline | ✓ Good — instant recognition |
| Bash orchestrator for coexistence | Simple, portable, provider failures isolated | ✓ Good — no runtime dependencies |
| Two-stage difficulty scaling | Latency factor then user multiplier with absolute bounds | ✓ Good — predictable, bounded, safe |
| Discrete difficulty steps | 0.5-2.5x in 0.25 increments prevents floating-point drift | ✓ Good — clear progression, no surprises |
| XDG Base Directory compliance | State at ~/.config/viberipped/ with secure permissions | ✓ Good — follows platform convention |
| Commander.js for CLI | Negatable options, command routing, help generation | ✓ Good — minimal weight, good ergonomics |
| Additive-only v1.1 schema | Optional fields with defaults for backward compatibility | ✓ Good — v1.0 configs auto-migrate |
| Runtime environment filtering | Pool.json stores full pool, environment filter at trigger time | ✓ Good — no data loss, flexible switching |
| Category ring buffer (N=2) | Simple push/shift pattern, hardcoded until user feedback | ✓ Good — prevents same-group stacking |
| Delta-based API detection | Track total_api_duration_ms changes instead of token accumulation | ✓ Good — eliminates false positives |
| TTY guard for interactive commands | Prevents wizard/checklist from running in statusline pipe mode | ✓ Good — safety for non-interactive contexts |
| Sensitivity presets (strict/normal/relaxed) | Maps to 50/100/500ms thresholds with custom override | ✓ Good — configurable without complexity |

---
*Last updated: 2026-02-10 after v1.1 milestone*
