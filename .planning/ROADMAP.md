# Roadmap: VibeRipped

## Milestones

- ✅ **v1.0 MVP** - Phases 1-6 (shipped 2026-02-09)
- ✅ **v1.1 Polish & Intelligence** - Phases 7-14 (shipped 2026-02-10)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-6) - SHIPPED 2026-02-09</summary>

**Milestone Goal:** Claude Code statusline provider that converts AI processing latency into deterministic micro-exercise prompts with adaptive difficulty scaling.

Delivered features:
- Deterministic rotation engine with atomic state persistence
- Equipment-configurable exercise pool (kettlebell, dumbbells, pull-up bar, parallettes + bodyweight)
- Claude Code statusline provider with processing detection heuristic
- GSD coexistence via bash orchestrator with 💪 visual identity prefix
- Full CLI: config, test, pool list/add/remove, harder, softer
- Adaptive difficulty: latency-based rep scaling with user multiplier, bounds [5-60]

4,481 LOC JavaScript, 135 tests passing, zero external dependencies.

- [x] Phase 1: Core Rotation Engine (2/2 plans) - completed 2026-02-08
- [x] Phase 2: Exercise Pool Configuration (2/2 plans) - completed 2026-02-08
- [x] Phase 3: Statusline Provider (2/2 plans) - completed 2026-02-08
- [x] Phase 4: GSD Coexistence (2/2 plans) - completed 2026-02-09
- [x] Phase 5: CLI Tooling (2/2 plans) - completed 2026-02-09
- [x] Phase 6: Adaptive Difficulty (2/2 plans) - completed 2026-02-09

Archives: `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.0-REQUIREMENTS.md`

</details>

<details>
<summary>✅ v1.1 Polish & Intelligence (Phases 7-14) - SHIPPED 2026-02-10</summary>

**Milestone Goal:** Make VibeRipped distributable, fix detection accuracy, add exercise intelligence and interactive setup UX.

Delivered features:
- npm distribution with global install, README, LICENSE, package metadata
- Extended data model with category, type, environment fields + auto-migration from v1.0
- Timed exercises with duration-based display and latency scaling
- Environment profiles filtering exercises by context (home/office/coworking/anywhere)
- Category-aware rotation preventing consecutive same-muscle-group exercises
- Interactive setup wizard with checkbox equipment selection
- Batch add and interactive checklist management
- Delta-based API detection eliminating false positives

9,564 LOC JavaScript, 311 tests passing.

- [x] Phase 7: Distribution (2/2 plans) - completed 2026-02-09
- [x] Phase 8: Data Model Extensions (2/2 plans) - completed 2026-02-09
- [x] Phase 9: Timed Exercises (2/2 plans) - completed 2026-02-10
- [x] Phase 10: Environment Profiles (2/2 plans) - completed 2026-02-10
- [x] Phase 11: Category-Aware Rotation (2/2 plans) - completed 2026-02-10
- [x] Phase 12: Interactive Setup Wizard (2/2 plans) - completed 2026-02-10
- [x] Phase 13: Batch & Checklist Management (2/2 plans) - completed 2026-02-10
- [x] Phase 14: Detection Improvement (2/2 plans) - completed 2026-02-10

Archives: `.planning/milestones/v1.1-ROADMAP.md`, `.planning/milestones/v1.1-REQUIREMENTS.md`

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Core Rotation Engine | v1.0 | 2/2 | ✓ Complete | 2026-02-08 |
| 2. Exercise Pool Configuration | v1.0 | 2/2 | ✓ Complete | 2026-02-08 |
| 3. Statusline Provider | v1.0 | 2/2 | ✓ Complete | 2026-02-08 |
| 4. GSD Coexistence | v1.0 | 2/2 | ✓ Complete | 2026-02-09 |
| 5. CLI Tooling | v1.0 | 2/2 | ✓ Complete | 2026-02-09 |
| 6. Adaptive Difficulty | v1.0 | 2/2 | ✓ Complete | 2026-02-09 |
| 7. Distribution | v1.1 | 2/2 | ✓ Complete | 2026-02-09 |
| 8. Data Model Extensions | v1.1 | 2/2 | ✓ Complete | 2026-02-09 |
| 9. Timed Exercises | v1.1 | 2/2 | ✓ Complete | 2026-02-10 |
| 10. Environment Profiles | v1.1 | 2/2 | ✓ Complete | 2026-02-10 |
| 11. Category-Aware Rotation | v1.1 | 2/2 | ✓ Complete | 2026-02-10 |
| 12. Interactive Setup Wizard | v1.1 | 2/2 | ✓ Complete | 2026-02-10 |
| 13. Batch & Checklist Management | v1.1 | 2/2 | ✓ Complete | 2026-02-10 |
| 14. Detection Improvement | v1.1 | 2/2 | ✓ Complete | 2026-02-10 |

---
*Created: 2026-02-08 for v1.0 milestone*
*Updated: 2026-02-10 — v1.1 milestone archived*
