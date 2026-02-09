# Roadmap: VibeRipped

## Milestones

- ✅ **v1.0 MVP** - Phases 1-6 (shipped 2026-02-09)
- 🚧 **v1.1 Polish & Intelligence** - Phases 7-14 (in progress)

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

### 🚧 v1.1 Polish & Intelligence (In Progress)

**Milestone Goal:** Make VibeRipped distributable, fix detection accuracy, add exercise intelligence and interactive setup UX.

#### Phase 7: Distribution
**Goal**: Users can install VibeRipped globally via npm and access comprehensive documentation
**Depends on**: Phase 6 (v1.0 complete)
**Requirements**: DIST-01, DIST-02, DIST-03
**Success Criteria** (what must be TRUE):
  1. User can run `npm i -g viberipped` and immediately use `vibripped` command from any directory
  2. Repository includes README with installation guide, usage examples, CLI reference, and visual demo
  3. Repository includes proper npm packaging metadata (LICENSE, .gitignore, clean package.json)
  4. Bin script has correct shebang and executable permissions across platforms
**Plans**: 2 plans

Plans:
- [x] 07-01-PLAN.md -- Package metadata, LICENSE, .gitignore, and global install verification
- [x] 07-02-PLAN.md -- Comprehensive README with install guide, CLI reference, and usage docs

#### Phase 8: Data Model Extensions
**Goal**: Exercise pool and config schemas support category tagging, timed exercises, and environment filtering
**Depends on**: Phase 7
**Requirements**: Foundations for INTL-01, INTL-02, INTL-03
**Success Criteria** (what must be TRUE):
  1. pool.json schema supports optional `category` (push/pull/legs/core), `type` (reps/timed), and `environments` (home/office/coworking/anywhere) fields
  2. configuration.json schema supports optional `environment` field with default value
  3. state.json schema supports optional `recentCategories` array for rotation tracking
  4. v1.0 configs migrate automatically on first v1.1 launch with backup created
  5. Missing fields default gracefully without throwing errors
**Plans**: TBD

Plans:
- [ ] 08-01: TBD

#### Phase 9: Timed Exercises
**Goal**: Users see duration-based exercises displayed as time instructions alongside rep-based exercises
**Depends on**: Phase 8
**Requirements**: INTL-02
**Success Criteria** (what must be TRUE):
  1. User can add timed exercises to pool with `type: "timed"` and `duration: 30` format
  2. Statusline displays timed exercises as "Plank 30s" instead of "Plank x30"
  3. Timed exercise durations scale with latency factor (capped at 1.5x max)
  4. Rotation engine treats timed and rep-based exercises equivalently in sequential order
**Plans**: TBD

Plans:
- [ ] 09-01: TBD

#### Phase 10: Environment Profiles
**Goal**: Users can filter exercises by context appropriateness using environment profiles
**Depends on**: Phase 8
**Requirements**: INTL-03
**Success Criteria** (what must be TRUE):
  1. User can set active environment via `vibripped config set environment office`
  2. Pool automatically filters to exercises tagged with current environment (or "anywhere")
  3. User can define custom environments in config and tag exercises accordingly
  4. Statusline prompts only from filtered pool matching active environment
**Plans**: TBD

Plans:
- [ ] 10-01: TBD

#### Phase 11: Category-Aware Rotation
**Goal**: Rotation engine avoids consecutive same-muscle-group exercises using weighted category selection
**Depends on**: Phase 8
**Requirements**: INTL-01
**Success Criteria** (what must be TRUE):
  1. Rotation engine tracks last N categories (configurable, default 2) in state
  2. Next exercise selection weights categories proportional to pool size, deprioritizing recent categories
  3. User never sees consecutive exercises from same category (push/pull/legs/core) unless pool has only one category
  4. Rotation remains deterministic and predictable (same pool state always produces same next exercise)
  5. Edge cases handle gracefully (single category pool, empty pool after filtering)
**Plans**: TBD

Plans:
- [ ] 11-01: TBD

#### Phase 12: Interactive Setup Wizard
**Goal**: First-time users can run guided setup with checkbox equipment selection
**Depends on**: Phase 8, Phase 9, Phase 10, Phase 11
**Requirements**: INTR-01
**Success Criteria** (what must be TRUE):
  1. User can run `vibripped setup` to launch interactive wizard
  2. Wizard detects if run from TTY (fails gracefully if in statusline pipe mode)
  3. Wizard presents checkbox list of equipment options (kettlebell, dumbbells, pull-up bar, parallettes, bodyweight-only)
  4. Wizard suggests default exercises based on selected equipment
  5. Wizard creates configuration file and pool with sensible defaults
  6. Setup command respects existing configs (asks before overwriting)
**Plans**: TBD

Plans:
- [ ] 12-01: TBD

#### Phase 13: Batch & Checklist Management
**Goal**: Users can batch-add exercises and manage pool via interactive checklist
**Depends on**: Phase 12
**Requirements**: INTR-02, INTR-03
**Success Criteria** (what must be TRUE):
  1. User can run `vibripped pool add "Burpees 12, Mountain climbers 20"` to add multiple exercises at once
  2. Batch add parses comma-separated format and validates each exercise before adding
  3. User can run `vibripped pool manage` to launch interactive checklist view
  4. Checklist shows all pool exercises with toggle on/off for each
  5. Checklist respects TTY detection (fails gracefully in non-interactive mode)
**Plans**: TBD

Plans:
- [ ] 13-01: TBD

#### Phase 14: Detection Improvement
**Goal**: Statusline triggers exercise prompts only during actual API calls, not all statusline updates
**Depends on**: Phase 7 (independent of other v1.1 features)
**Requirements**: DTCT-01
**Success Criteria** (what must be TRUE):
  1. Detection heuristic analyzes Claude Code statusline JSON structure to identify active API processing
  2. False positives eliminated (no triggers on statusline updates without API activity)
  3. Detection threshold configurable via `config.detection.sensitivity` setting
  4. Live testing validates accuracy across typical multi-project Claude Code sessions
  5. Fallback to v1.0 heuristic if statusline structure changes unexpectedly
**Plans**: TBD

Plans:
- [ ] 14-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Core Rotation Engine | v1.0 | 2/2 | ✓ Complete | 2026-02-08 |
| 2. Exercise Pool Configuration | v1.0 | 2/2 | ✓ Complete | 2026-02-08 |
| 3. Statusline Provider | v1.0 | 2/2 | ✓ Complete | 2026-02-08 |
| 4. GSD Coexistence | v1.0 | 2/2 | ✓ Complete | 2026-02-09 |
| 5. CLI Tooling | v1.0 | 2/2 | ✓ Complete | 2026-02-09 |
| 6. Adaptive Difficulty | v1.0 | 2/2 | ✓ Complete | 2026-02-09 |
| 7. Distribution | v1.1 | 2/2 | ✓ Complete | 2026-02-09 |
| 8. Data Model Extensions | v1.1 | 0/? | Not started | - |
| 9. Timed Exercises | v1.1 | 0/? | Not started | - |
| 10. Environment Profiles | v1.1 | 0/? | Not started | - |
| 11. Category-Aware Rotation | v1.1 | 0/? | Not started | - |
| 12. Interactive Setup Wizard | v1.1 | 0/? | Not started | - |
| 13. Batch & Checklist Management | v1.1 | 0/? | Not started | - |
| 14. Detection Improvement | v1.1 | 0/? | Not started | - |

---
*Created: 2026-02-08 for v1.0 milestone*
*Updated: 2026-02-09 for v1.1 milestone*
