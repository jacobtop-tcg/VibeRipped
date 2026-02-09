---
phase: 06-adaptive-difficulty
plan: 02
subsystem: difficulty-integration
tags: [engine-integration, cli-commands, difficulty-scaling, end-to-end]

dependency_graph:
  requires: [lib/difficulty.js, engine.js, statusline.js, lib/config.js]
  provides: [harder CLI command, softer CLI command, latency-scaled exercise reps]
  affects: [engine.js, statusline.js, bin/vibripped.js]

tech_stack:
  added: []
  patterns: [latency-pass-through, config-driven-multiplier, exercise-cloning, boundary-handling]

key_files:
  created:
    - lib/cli/commands/harder.js
    - lib/cli/commands/softer.js
    - test/cli/difficulty.test.js
  modified:
    - engine.js
    - statusline.js
    - bin/vibripped.js
    - test/engine.test.js

decisions:
  - id: D-06-02-01
    what: Clone exercise before scaling to avoid pool mutation
    why: Pool array is shared state; mutating it would affect subsequent rotations with incorrect base reps
    alternatives: Deep copy entire pool (rejected - performance overhead), track original reps separately (rejected - added complexity)
  - id: D-06-02-02
    what: Apply scaling to cooldown lastExercise for display consistency
    why: Users see lastExercise during cooldown period; should match what was shown when originally triggered
    alternatives: Show unscaled reps (rejected - confusing to see different rep counts for same exercise)
  - id: D-06-02-03
    what: Load config fresh in both cooldown and exercise paths
    why: Legacy mode (explicit pool) needs default multiplier 1.0; config-driven mode needs actual config multiplier
    alternatives: Load config once at top (rejected - doesn't work for legacy mode with explicit pool)

metrics:
  duration: 227 seconds
  completed: 2026-02-09
---

# Phase 06 Plan 02: Difficulty Integration Summary

**One-liner:** Wired two-stage difficulty scaling into engine (latency * multiplier), statusline latency extraction, and CLI commands (harder/softer) for user-controlled difficulty adjustment.

## Objective Completed

Integrated the difficulty scaling module (from Plan 01) into the production pipeline. Engine now applies difficulty scaling to all exercise reps based on API latency and user-controlled multiplier. Statusline extracts latency from stdin JSON and passes to engine. CLI commands (harder/softer) allow users to adjust difficulty multiplier with discrete steps.

**Output delivered:**
- Engine applies two-stage scaling (latency factor * user multiplier) to exercise reps
- Statusline extracts `cost.total_api_duration_ms` and passes as `latencyMs` to engine
- `vibripped harder` and `vibripped softer` commands work with discrete steps
- Difficulty multiplier persists in `configuration.json` across sessions
- Full test suite passes with zero regressions (135 tests)

## Implementation Summary

### Task 1: Engine and Statusline Integration

**engine.js (9 lines added, 3 lines modified):**
- Added `scaleRepsForLatency` import from `lib/difficulty`
- Added `latencyMs` option parameter to `trigger()` function
- Clone exercise before scaling: `const exercise = { ...rawExercise }`
- Load config to get difficulty multiplier (default 1.0)
- Apply scaling: `exercise.reps = scaleRepsForLatency(exercise.reps, latencyMs, multiplier)`
- Apply scaling to cooldown `lastExercise` for display consistency
- Handle both config-driven mode (load config) and legacy mode (default multiplier 1.0)

**statusline.js (2 lines added):**
- Extract latency: `const latencyMs = data?.cost?.total_api_duration_ms || 0`
- Pass to trigger: `trigger(null, { bypassCooldown, latencyMs })`

**test/engine.test.js (70 lines added):**
- 6 new tests for difficulty scaling functionality
- Test scaled reps with high latency (15000ms)
- Test base reps with zero latency
- Test bounds clamping with extreme inputs (30000ms latency + 2.5x multiplier → 60 max reps)
- Test config multiplier application in config-driven mode
- Test pool array immutability (no mutation)
- Test cooldown lastExercise shows scaled reps

### Task 2: Harder and Softer CLI Commands

**lib/cli/commands/harder.js (42 lines):**
- Load current config, get current multiplier (default 1.0)
- Call `incrementDifficulty(currentMultiplier)` to get next step
- Check if already at max (2.5x), output info message and return
- Update config.difficulty.multiplier with new value
- Save config to disk
- Output success message with current and new multiplier labels

**lib/cli/commands/softer.js (42 lines):**
- Same structure as harder.js but uses `decrementDifficulty()`
- Check if already at min (0.5x), output info message and return
- Output success message with current and new multiplier labels

**bin/vibripped.js (14 lines added):**
- Register `harder` command with description
- Register `softer` command with description
- Commands appear in `--help` output

**test/cli/difficulty.test.js (210 lines):**
- 6 CLI integration tests using isolated HOME directories
- Test harder from default (1.0x → 1.25x)
- Test harder progression (1.0x → 1.25x → 1.5x)
- Test harder at max (2.5x) outputs "already at maximum"
- Test softer from default (1.0x → 0.75x)
- Test softer at min (0.5x) outputs "already at minimum"
- Test harder then softer returns to original (round-trip)

## Test Results

**Task 1 verification:**
- All 26 existing engine tests pass
- All 6 new difficulty scaling tests pass
- All 26 statusline tests pass (no regressions)

**Task 2 verification:**
- All 6 CLI difficulty tests pass
- Manual verification: `vibripped harder` increases difficulty
- Manual verification: `vibripped softer` decreases difficulty
- Manual verification: Commands appear in `--help` output
- Manual verification: `configuration.json` persists difficulty multiplier

**Full test suite:**
- 135 tests total (6 new engine tests, 6 new CLI tests, 123 existing)
- 135 pass, 0 fail
- Zero regressions across all modules

## Key Decisions

### Exercise Cloning to Prevent Pool Mutation
Clone exercise before scaling (`{ ...rawExercise }`) to avoid mutating shared pool array. Pool is used across multiple rotations; mutating it would corrupt base reps for subsequent triggers. Deep copy entire pool would add performance overhead. Tracking original reps separately would add complexity.

### Scaling Applied to Cooldown lastExercise
When cooldown blocks a trigger, return `lastExercise` with scaled reps matching what user saw when exercise was originally triggered. Without this, user would see different rep counts for same exercise (confusing). Scaling applied consistently in both exercise and cooldown paths.

### Config Loading in Both Execution Paths
Load config fresh in both cooldown path and exercise path. Legacy mode (explicit pool parameter) needs default multiplier 1.0. Config-driven mode (pool=null) needs actual config multiplier. Loading config once at top doesn't work for legacy mode tests.

## Deviations from Plan

None - plan executed exactly as written. All must-have truths verified. All artifacts created with specified structure. All key-links verified (statusline → engine latencyMs, engine → difficulty scaleRepsForLatency, CLI → difficulty increment/decrement).

## Integration Points

**Engine → Difficulty Module:**
- `scaleRepsForLatency(baseReps, latencyMs, multiplier)` called on every exercise return
- Multiplier loaded from `config.difficulty.multiplier` (default 1.0)
- Scaling applied after rotation selection, before formatPrompt

**Statusline → Engine:**
- `data.cost.total_api_duration_ms` extracted from stdin JSON
- Passed as `latencyMs` option to `trigger()`
- Zero latency (0ms) maps to 1.0x factor (no scaling beyond multiplier)

**CLI Commands → Config:**
- `harder` and `softer` commands call `incrementDifficulty()` and `decrementDifficulty()`
- Updated multiplier persisted to `configuration.json`
- Config changes take effect on next engine trigger (no restart needed)

## Verification Results

**Plan verification criteria:**
1. ✓ `node --test` - full test suite passes (135 tests, 0 failures)
2. ✓ `node bin/vibripped.js harder` - increases difficulty from 1.0x to 1.25x
3. ✓ `node bin/vibripped.js softer` - decreases back to 1.0x
4. ✓ `node bin/vibripped.js test` - shows exercise with current difficulty applied
5. ✓ `configuration.json` contains `difficulty.multiplier` after harder/softer commands
6. ✓ Engine with `latencyMs=15000` produces higher reps than `latencyMs=0` (verified in tests)

**Success criteria:**
- ✓ Engine applies two-stage scaling (latency factor * user multiplier) to all exercise reps
- ✓ Statusline extracts `cost.total_api_duration_ms` and passes as `latencyMs` to engine
- ✓ `vibripped harder` and `vibripped softer` commands work with discrete steps [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5]
- ✓ Difficulty multiplier persists in `configuration.json` across sessions
- ✓ Boundary conditions handled: max/min step clamping, rep bounds [5, 60], null/0 latency
- ✓ Full test suite passes with zero regressions

## Self-Check: PASSED

**Created files verified:**
```bash
FOUND: lib/cli/commands/harder.js
FOUND: lib/cli/commands/softer.js
FOUND: test/cli/difficulty.test.js
```

**Modified files verified:**
```bash
FOUND: engine.js (contains scaleRepsForLatency import and latencyMs option)
FOUND: statusline.js (contains latencyMs extraction from stdin JSON)
FOUND: bin/vibripped.js (contains harder and softer command registration)
FOUND: test/engine.test.js (contains 6 new difficulty scaling tests)
```

**Commits verified:**
```bash
FOUND: 9d7548e (feat(06-02): integrate difficulty scaling into engine and statusline)
FOUND: b88556c (feat(06-02): add harder and softer CLI commands for difficulty control)
```

**Exports verified:**
```javascript
// harder.js and softer.js export handler functions
const harderHandler = require('./lib/cli/commands/harder.js');
const softerHandler = require('./lib/cli/commands/softer.js');

// engine.js accepts latencyMs option
trigger(pool, { latencyMs: 15000 });

// statusline.js extracts and passes latency
const latencyMs = data?.cost?.total_api_duration_ms || 0;
trigger(null, { bypassCooldown, latencyMs });
```

All files exist, all commits present, all functionality working, all tests pass.

## Next Phase Readiness

**Phase 06 (Adaptive Difficulty) complete:**
- Plan 01: Difficulty scaling module implemented and tested
- Plan 02: Engine integration, CLI commands, end-to-end functionality verified
- No remaining plans in phase
- All must-have truths satisfied
- All artifacts delivered
- No blockers

**Project completion:**
- Phase 06 was final phase in roadmap
- All 6 phases complete (12 plans total)
- VibeRipped is production-ready

**Recommended next steps:**
1. Production deployment: validate with real Claude Code sessions
2. Monitor latency extraction accuracy with real statusline data
3. Gather user feedback on difficulty scaling feel (too aggressive/gentle?)
4. Consider future enhancements: custom latency thresholds, exercise-specific multipliers

---

**Plan completed:** 2026-02-09
**Duration:** 3 minutes (227 seconds)
**Executor:** Claude Sonnet 4.5
