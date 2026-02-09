---
phase: 06-adaptive-difficulty
plan: 01
subsystem: difficulty-scaling
tags: [tdd, difficulty, scaling, config-extension, core-algorithm]

dependency_graph:
  requires: [lib/config.js, lib/state.js]
  provides: [lib/difficulty.js, difficulty.multiplier in config]
  affects: []

tech_stack:
  added: []
  patterns: [two-stage-scaling, discrete-difficulty-steps, linear-interpolation, absolute-bounds-clamping]

key_files:
  created:
    - lib/difficulty.js
    - test/difficulty.test.js
  modified:
    - lib/config.js
    - test/config.test.js

decisions:
  - id: D-06-01-01
    what: Two-stage scaling (latency factor -> user multiplier -> clamp)
    why: Separates concerns, allows independent tuning of latency mapping and user control, prevents multiplicative explosion
    alternatives: Single-stage multiplication (rejected - produces unbounded rep counts)
  - id: D-06-01-02
    what: Linear interpolation for latency mapping (2000-30000ms -> 1.0-1.5x)
    why: Predictable, simple, sufficient for narrow range; matches user mental model
    alternatives: Logarithmic scaling (rejected - adds complexity without clear benefit for this range)
  - id: D-06-01-03
    what: Discrete difficulty steps (0.5x to 2.5x in 0.25x increments)
    why: Prevents floating-point drift, clear progression for users, avoids ambiguous multiplier values
    alternatives: Continuous slider (rejected - harder to reason about, unclear what "harder" command does)
  - id: D-06-01-04
    what: Absolute rep bounds (5-60) applied AFTER all scaling
    why: Ensures work-environment safety regardless of input combinations, prevents impossible rep counts
    alternatives: No absolute bounds (rejected - can produce 100+ reps with max latency + max multiplier)
  - id: D-06-01-05
    what: Store multiplier in config.difficulty, not state
    why: Config persists across pool changes; state resets on pool hash changes; difficulty is user preference like equipment
    alternatives: Store in state (rejected - would reset when user edits pool.json)

metrics:
  duration: 154 seconds
  completed: 2026-02-09
---

# Phase 06 Plan 01: Difficulty Scaling Module Summary

**One-liner:** Two-stage rep scaling with linear latency interpolation (2000-30000ms -> 1.0-1.5x), discrete user multipliers (0.5-2.5x), and absolute bounds (5-60 reps) for work-environment safety.

## Objective Completed

Created the difficulty scaling module with TDD and extended configuration to store difficulty multiplier. Implemented core scaling algorithms (latency-to-factor lerp, user multiplier application, rep clamping) and discrete difficulty step logic for consumption by engine.js and CLI commands.

**Output delivered:**
- `lib/difficulty.js` with tested scaling functions
- `lib/config.js` extended with `difficulty.multiplier` field (default 1.0)
- Full test coverage for all scaling scenarios and edge cases

## Implementation Summary

### Files Created

**lib/difficulty.js (169 lines)**
- Two-stage scaling algorithm: `scaleRepsForLatency(baseReps, latencyMs, multiplier)`
- Linear interpolation: `latencyToScaleFactor(latencyMs)` maps 2000-30000ms to 1.0-1.5x
- Discrete step navigation: `incrementDifficulty()`, `decrementDifficulty()`
- Label formatting: `getDifficultyLabel(multiplier)` for human-readable output
- Constants: `DIFFICULTY_STEPS`, `MIN_REPS` (5), `MAX_REPS` (60)
- Helper functions: `lerp()`, `clamp()` for range mapping and bounds enforcement

**test/difficulty.test.js (153 lines)**
- 25 test cases covering all scaling scenarios
- Edge cases: negative latency, latency beyond max, rep counts below min/above max
- Boundary tests: min/max multiplier increments, invalid multiplier values
- Label formatting tests for all special cases

### Files Modified

**lib/config.js**
- Added `difficulty: { multiplier: 1.0 }` to `DEFAULT_CONFIG`
- Extended `validateConfig()` to accept optional difficulty field (object with numeric multiplier)
- Extended `loadConfig()` normalization to fill missing `difficulty.multiplier` with default 1.0

**test/config.test.js**
- Added 5 new test cases for difficulty field support
- Tests cover default value, normalization, validation, and persistence

## Test Results

**TDD Execution:**
- RED phase: 153-line test suite written first (module didn't exist, tests failed as expected)
- GREEN phase: 169-line implementation created, all 25 tests pass
- REFACTOR phase: No refactoring needed (clean implementation on first pass)

**Full Test Suite:**
- 123 tests total (25 new difficulty tests, 5 new config tests, 93 existing)
- All tests pass, zero regressions
- Test coverage: 100% of difficulty module functions and config extensions

## Key Decisions

### Two-Stage Scaling Architecture
Applied latency scaling THEN user multiplier THEN absolute clamp. This prevents multiplicative explosion (e.g., 50 reps * 1.5 latency * 2.5 multiplier = 187 reps -> clamped to 60). Single-stage multiplication would produce unbounded rep counts.

### Linear Interpolation for Latency
Maps latency duration proportionally to scale factor. 2000ms (2 sec) = 1.0x (no bonus), 30000ms (30 sec) = 1.5x (50% increase). Linear is predictable for users and sufficient for this narrow range. Logarithmic scaling adds complexity without clear benefit.

### Discrete Difficulty Steps
9 fixed multiplier values (0.5x, 0.75x, 1.0x, 1.25x, 1.5x, 1.75x, 2.0x, 2.25x, 2.5x). Prevents floating-point drift, provides clear progression ("harder" moves up one step), matches user mental model. Continuous values (e.g., 1.37942x) are harder to reason about.

### Absolute Rep Bounds (5-60)
Final clamp ensures work-environment safety regardless of inputs. With max latency (1.5x) and max multiplier (2.5x), even high base reps (50) clamp to 60. Without bounds, extreme combinations produce 100+ reps (impossible during work).

### Config Storage for Multiplier
Store multiplier in `configuration.json` alongside equipment, NOT in `state.json`. State resets on pool hash changes (user edits pool.json), but difficulty is persistent user preference like equipment availability. Config persists across pool changes.

## Deviations from Plan

None - plan executed exactly as written. TDD protocol followed precisely (RED -> GREEN -> REFACTOR). All must-have truths verified in tests. All artifacts created with specified exports and structure.

## Integration Points

**Prepared for Phase 06-02 (Engine Integration):**
- `lib/difficulty.js` exports all required functions for engine.js consumption
- `scaleRepsForLatency()` ready to receive `latencyMs` from statusline stdin parsing
- `config.difficulty.multiplier` ready for engine.js to load and apply
- `incrementDifficulty()` and `decrementDifficulty()` ready for CLI command integration

**Prepared for Phase 06-02 (CLI Commands):**
- `getDifficultyLabel()` ready for user-facing output in `harder`/`softer` commands
- `DIFFICULTY_STEPS` array available for displaying current position in difficulty progression
- Config validation ensures CLI can safely save updated multiplier values

## Verification Results

**Test Commands:**
```bash
node --test test/difficulty.test.js  # All 25 tests pass
node --test test/config.test.js      # All 18 tests pass (5 new)
node --test                          # All 123 tests pass (full suite)
```

**Success Criteria:**
- ✓ lib/difficulty.js exports scaleRepsForLatency, incrementDifficulty, decrementDifficulty, getDifficultyLabel, DIFFICULTY_STEPS, MIN_REPS, MAX_REPS
- ✓ All test cases from plan behavior section pass
- ✓ Config loads with difficulty.multiplier defaulting to 1.0
- ✓ Existing config tests still pass (no regressions)
- ✓ Rep counts always within [5, 60] for any combination of inputs (verified via extreme value tests)

## Self-Check: PASSED

**Created files verified:**
```bash
FOUND: lib/difficulty.js
FOUND: test/difficulty.test.js
```

**Modified files verified:**
```bash
FOUND: lib/config.js (contains difficulty field in DEFAULT_CONFIG)
FOUND: test/config.test.js (contains difficulty validation tests)
```

**Commits verified:**
```bash
FOUND: 9921ab7 (test(06-01): add failing tests for difficulty module)
FOUND: dc551d0 (feat(06-01): implement difficulty module with scaling algorithms)
FOUND: 63a021b (feat(06-01): extend config module to support difficulty multiplier)
```

**Exports verified:**
```javascript
// lib/difficulty.js exports all required symbols
const {
  DIFFICULTY_STEPS,      // ✓ Array of 9 discrete multiplier values
  MIN_REPS,              // ✓ Constant 5
  MAX_REPS,              // ✓ Constant 60
  scaleRepsForLatency,   // ✓ Function with correct signature
  incrementDifficulty,   // ✓ Function with correct signature
  decrementDifficulty,   // ✓ Function with correct signature
  getDifficultyLabel     // ✓ Function with correct signature
} = require('./lib/difficulty.js');
```

All files exist, all commits present, all exports available, all tests pass.

## Next Phase Readiness

**Phase 06-02 dependencies satisfied:**
- Difficulty module implemented and tested
- Config extended to persist multiplier
- Scaling algorithm ready for engine.js integration
- Step functions ready for CLI command integration
- No blockers for next phase

**Recommended next steps:**
1. Integrate `scaleRepsForLatency()` into engine.js trigger flow
2. Parse `latencyMs` from statusline stdin (data.cost.total_api_duration_ms)
3. Create `vibripped harder` and `vibripped softer` CLI commands
4. Test end-to-end with real Claude Code statusline data

---

**Plan completed:** 2026-02-09
**Duration:** 2 minutes (154 seconds)
**Executor:** Claude Sonnet 4.5
