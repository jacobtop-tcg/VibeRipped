# VibeRipped

## What This Is

A Claude Code statusline provider that converts AI processing latency into deterministic micro-exercise prompts. When the model is actively computing, the statusline emits exactly one movement instruction from a rotating, equipment-aware exercise pool. The user moves during the wait, returns when output arrives. It targets multi-project vibe coders who repeatedly dispatch non-trivial Claude Code commands and currently fill the resulting gaps with distraction.

## Core Value

Every "model is thinking" moment produces exactly one unambiguous physical action — no decisions, no coaching, no friction — so the user moves by default instead of browsing by default.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Statusline provider script that detects Claude Code processing state
- [ ] Equipment-configurable exercise pool (user declares available gear, pool assembles from bodyweight + matching equipment exercises)
- [ ] Deterministic rotation engine — sequential cycling through the pool, predictable next-up behavior
- [ ] Compact, identifiable status segment that coexists with other statusline providers (GSD, etc.) without overwriting or conflicting
- [ ] Minimal persistent state (rotation index, optional cooldown timestamp) stored in a state file
- [ ] Cooldown mechanism to prevent over-triggering on rapid successive commands
- [ ] Crisp, command-style output format — "10 push-ups" not "Try doing some push-ups to stay active!"
- [ ] Configuration surface for exercise pool (add/remove equipment categories, customize exercises and rep counts)

### Out of Scope

- Workout programming or periodization — this is not a training plan
- Technique instruction or form coaching — assumes user knows the movements
- Motivational messaging, gamification, or streaks — the system is an execution primitive, not a companion
- Adaptive intensity or progressive overload — movements stay conservative and activating
- Hook-based trigger system — v1 is statusline-only, no hooks
- Mobile or external device integration — lives entirely inside the terminal

## Context

- The user runs multiple concurrent Claude Code projects, dispatching frequent non-trivial commands (refactors, multi-file edits, planning prompts, test runs, builds)
- The existing Claude Code environment includes the GSD plugin, which already writes to the statusline — VibeRipped must be a good citizen in that shared surface
- Available equipment includes: kettlebell, dumbbells, pull-up bar, parallettes (plus bodyweight movements)
- The statusline is a composite surface — each provider owns its segment and must not destroy others
- Claude Code statusline providers are scripts that get polled and return text to display
- The system must detect active model processing (waiting state) to know when to display exercises vs. stay quiet

## Constraints

- **UI coexistence**: Must not overwrite, clear, or monopolize the shared statusline surface — emit only a self-contained segment with a stable identity/prefix
- **Cognitive load**: Output must be a single imperative instruction, never a choice or suggestion — zero decision overhead
- **Intensity ceiling**: Movements must be finishable quickly, avoid sweat/recovery debt, and preserve ability to re-engage cognitively with code
- **Determinism**: User must be able to predict "next time, it picks the next item in the rotation" — simple state machine, no surprise adaptations
- **Compliance through simplicity**: If it ever becomes a barrier to returning to the keyboard, it has failed — optimize for compliance, not stimulus

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Statusline provider (not hook) | Self-contained, no hook wiring, polled naturally by Claude Code | — Pending |
| Process detection for waiting state | Statusline checks if Claude Code is actively processing rather than requiring a flag file or always-on display | — Pending |
| Equipment-configurable pool | User declares gear once, pool assembles automatically — avoids manual exercise list management while keeping the pool bounded | — Pending |
| Sequential rotation (not random) | Predictability builds trust and automaticity — user knows what's coming, reduces cognitive overhead | — Pending |

---
*Last updated: 2026-02-08 after initialization*
