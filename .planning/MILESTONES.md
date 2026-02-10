# Milestones

## v1.0 MVP (Shipped: 2026-02-09)

**Phases completed:** 6 phases, 12 plans
**Lines of code:** 4,481 JavaScript
**Tests:** 135 passing
**Timeline:** 2 days (2026-02-08 → 2026-02-09)

**Delivered:** Claude Code statusline provider that converts AI processing latency into deterministic micro-exercise prompts with adaptive difficulty scaling.

**Key accomplishments:**
- Deterministic rotation engine with atomic state persistence and 5-minute cooldown enforcement
- Equipment-configurable exercise pool with transparent JSON storage and user editing
- Claude Code statusline provider with processing detection heuristic and ANSI formatting
- GSD coexistence via bash orchestrator with 💪 visual identity prefix
- Full CLI tooling: config, test, pool list/add/remove commands
- Adaptive difficulty: latency-based rep scaling (1.0-1.5x) with user multiplier (0.5-2.5x), bounds [5-60]

**Archives:**
- `.planning/milestones/v1.0-ROADMAP.md`
- `.planning/milestones/v1.0-REQUIREMENTS.md`

---


## v1.1 Polish & Intelligence (Shipped: 2026-02-10)

**Phases completed:** 8 phases (7-14), 16 plans
**Lines of code:** 9,564 JavaScript (up from 4,481)
**Tests:** 311 passing (up from 135)
**Timeline:** 1 day (2026-02-09 → 2026-02-10)

**Delivered:** Distribution, exercise intelligence (categories, timed exercises, environment profiles), interactive UX (setup wizard, batch add, checklist management), and precise delta-based API detection.

**Key accomplishments:**
- npm distribution with global install, README with CLI reference, LICENSE and package metadata
- Extended data model with category/type/environment fields and automatic v1.0 migration
- Timed exercise support with duration-based display ("Plank 30s") and latency scaling
- Environment profiles filtering exercises by context (home/office/coworking/anywhere)
- Category-aware rotation preventing consecutive same-muscle-group exercises via ring buffer
- Interactive setup wizard with checkbox equipment selection and TTY guard
- Batch add and interactive checklist management for pool exercises
- Delta-based API detection eliminating false positives from v1.0 token heuristic

**Archives:**
- `.planning/milestones/v1.1-ROADMAP.md`
- `.planning/milestones/v1.1-REQUIREMENTS.md`

---

