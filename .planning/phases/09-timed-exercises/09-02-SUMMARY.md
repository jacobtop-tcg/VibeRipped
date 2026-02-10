---
phase: 09-timed-exercises
plan: 02
subsystem: cli-statusline-integration
tags: [cli, statusline, type-awareness, integration]
dependency_graph:
  requires: [09-01]
  provides: [timed-exercise-cli, timed-exercise-display]
  affects: [statusline, pool-commands]
tech_stack:
  added: []
  patterns: [type-aware-display, option-validation]
key_files:
  created: []
  modified:
    - statusline.js
    - bin/vibripped.js
    - lib/cli/commands/pool.js
    - test/statusline.test.js
    - test/cli/pool.test.js
decisions: []
metrics:
  duration_minutes: 5
  completed_date: 2026-02-10
  tests_added: 8
  tests_total: 212
---

# Phase 09 Plan 02: CLI & Statusline Integration for Timed Exercises Summary

Complete timed exercise support end-to-end: CLI add/list commands with type-aware formatting, statusline displays "Plank 30s" during processing.

## Implementation Overview

Wired exercise type through statusline provider and extended CLI pool commands to support adding and displaying timed exercises. All integration points now properly handle both timed and rep-based exercises with correct formatting.

### Key Changes

**statusline.js:**
- Extract type-aware display value: `exercise.type === 'timed' ? (exercise.duration ?? exercise.reps) : exercise.reps`
- Pass exercise type to formatExercise in both exercise and cooldown code paths
- Default to 'reps' type when exercise.type is missing (backward compatibility)

**bin/vibripped.js:**
- Added `--type <type>` option to pool add command (default: 'reps')
- Added `--duration <seconds>` option to pool add command (optional)

**lib/cli/commands/pool.js:**
- Updated add() signature to accept options parameter
- Validate type option (must be 'reps' or 'timed')
- Validate duration option (must be integer 1-999 if provided)
- Build exercise object with type field and optional duration field
- Type-aware success message: "Plank 30s" for timed, "Pushups x15" for reps
- Updated list() to display timed exercises with "s" suffix instead of "x" prefix

**test/statusline.test.js:**
- Added integration test verifying timed exercise displays as "30s" in statusline output
- Added integration test verifying rep exercise displays as "x15" in statusline output
- Tests use proper state setup with configPoolHash to prevent pool regeneration

**test/cli/pool.test.js:**
- Test `pool add "Plank" 30 --type timed` creates exercise with type: "timed"
- Test `pool add "Plank" 30 --type timed --duration 45` creates exercise with duration: 45
- Test `pool add "Pushups" 15` defaults to type: "reps"
- Test `pool add "Test" 30 --type invalid` rejects with error
- Test pool list shows timed exercises as "30s" not "x30"
- Test pool list shows mixed pool with correct formatting for each type

### Testing

All tests pass (212 total, 8 added):
- Statusline integration tests: timed and rep exercise display verification
- CLI integration tests: add timed exercises, list with type-aware formatting
- Validation tests: invalid type rejection, duration validation
- Backward compatibility: default behavior unchanged for existing commands

### Backward Compatibility

**statusline.js:**
- Exercises without type field default to 'reps' format
- Duration field is optional (fallback to reps field)

**CLI:**
- `vibripped pool add "Exercise" 15` still works unchanged (defaults to type: "reps")
- pool list displays exercises without type field as "x15" (treats as reps)

### Manual Verification

```bash
# Add timed exercise
node bin/vibripped.js pool add "Plank" 30 --type timed
# ✓ Added "Plank" 30s to pool

# List pool
node bin/vibripped.js pool list
# 1. Pushups x15 [bodyweight]
# 2. Plank 30s [bodyweight]

# Test statusline (with processing JSON input)
echo '{"context_window":{"current_usage":{"input_tokens":500}}}' | node statusline.js
# 💪 Plank 30s (ANSI-formatted)
```

## Deviations from Plan

None - plan executed exactly as written. All implementation details matched the plan specification.

## Verification

Full test suite passes:
```bash
node --test
# 212 tests pass, 0 failures
```

Verification checklist:
- [x] Statusline displays "Plank 30s" for timed exercises
- [x] Statusline displays "Pushups x15" for rep exercises
- [x] CLI supports `--type timed` flag on pool add
- [x] CLI supports `--duration` option for timed exercises
- [x] Pool list differentiates timed (30s) from rep (x15) exercises
- [x] Timed exercises scale via existing scaleRepsForLatency (no engine changes needed)
- [x] Zero test regressions

## Next Phase Readiness

Phase 9 complete. All timed exercise functionality is now fully integrated:
- Core formatting functions (Plan 01)
- CLI commands and statusline display (Plan 02)

Phase 10 (Enhanced Bodyweight Pool) can proceed immediately.

## Self-Check: PASSED

**Created files:** None (all modifications)

**Modified files:**
- statusline.js: FOUND
- bin/vibripped.js: FOUND
- lib/cli/commands/pool.js: FOUND
- test/statusline.test.js: FOUND
- test/cli/pool.test.js: FOUND

**Commits:**
- cb5ac91: FOUND (feat(09-02): wire exercise type through statusline provider)
- 9f3462c: FOUND (feat(09-02): extend CLI pool commands for timed exercises)
