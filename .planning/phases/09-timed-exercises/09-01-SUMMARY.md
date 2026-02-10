---
phase: 09-timed-exercises
plan: 01
subsystem: core-formatting
tags: [tdd, display, validation, type-awareness]
dependency_graph:
  requires: [08-02]
  provides: [type-aware-formatting, duration-validation]
  affects: [statusline, engine, pool]
tech_stack:
  added: []
  patterns: [backward-compatible-signatures]
key_files:
  created: []
  modified:
    - lib/statusline/format.js
    - lib/pool.js
    - engine.js
    - test/statusline.test.js
    - test/pool.test.js
    - test/engine.test.js
decisions: []
metrics:
  duration_minutes: 2
  completed_date: 2026-02-10
  tests_added: 15
  tests_total: 205
---

# Phase 09 Plan 01: Type-Aware Display Formatting Summary

Type-aware formatExercise renders "Plank 30s" for timed vs "Pushups x15" for reps, with duration field validation and backward-compatible signatures.

## Implementation Overview

Added type parameter to formatExercise, validateExercise duration field validation, and type-aware formatPrompt in engine.js. All changes maintain backward compatibility with existing code.

### Key Changes

**lib/statusline/format.js:**
- Updated formatExercise signature from `(name, value, options)` to `(name, value, typeOrOptions, options)`
- Backward compatibility: third arg can be string (type) or object (options)
- Type-aware formatting: `type === 'timed'` renders "30s", default "reps" renders "x30"
- Handles null/undefined values gracefully (no suffix)

**lib/pool.js:**
- Added duration field validation in validateExercise
- Duration must be positive integer if present (optional field)
- Rejects negative, zero, non-integer, and string values

**engine.js:**
- Updated formatPrompt to render "Plank 30s" for timed exercises
- Exported formatPrompt for testing
- Default to "reps" format when type field missing

### Testing

All changes developed using TDD methodology:
- RED phase: 15 failing tests across 3 test files
- GREEN phase: Minimal implementation to pass all tests
- REFACTOR phase: No refactoring needed (implementation was clean)
- Final: 205 tests pass, zero regressions

Test coverage:
- formatExercise: type="timed", type="reps", default (no type), with prefix, null value
- validateExercise: valid duration, missing duration (compat), negative, zero, non-integer, string
- formatPrompt: type="timed", type="reps", default (no type)

### Backward Compatibility

**formatExercise signature evolution:**
```javascript
// v1.0 (still works)
formatExercise('Pushups', 15, { prefix: '💪 ' })

// v1.1 (new)
formatExercise('Plank', 30, 'timed')
formatExercise('Pushups', 15, 'reps', { prefix: '💪 ' })
```

Detection logic: if third argument is object, treat as options (old signature).

**validateExercise:**
- Duration field is optional
- Exercises without duration field pass validation (v1.0 compat)

**formatPrompt:**
- Exercises without type field default to "reps" format (v1.0 compat)

## Deviations from Plan

None - plan executed exactly as written. TDD flow completed without issues.

## Verification

Manual verification:
```bash
node --test test/statusline.test.js test/pool.test.js test/engine.test.js
# All 97 new + existing tests pass

node --test
# All 205 tests pass (zero regressions)
```

Example outputs:
```javascript
formatExercise('Plank', 30, 'timed')
// → "\x1b[36m\x1b[1mPlank 30s\x1b[0m"

formatExercise('Pushups', 15, 'reps')
// → "\x1b[36m\x1b[1mPushups x15\x1b[0m"

formatPrompt({ name: "Plank", reps: 30, type: "timed" })
// → "Plank 30s"
```

## Next Phase Readiness

Phase 09 Plan 02 can proceed immediately. Core functions now support type-aware display, enabling propagation of type information through the rotation pipeline.

## Self-Check: PASSED

**Created files:** None (all modifications)

**Modified files:**
- lib/statusline/format.js: FOUND
- lib/pool.js: FOUND
- engine.js: FOUND
- test/statusline.test.js: FOUND
- test/pool.test.js: FOUND
- test/engine.test.js: FOUND

**Commits:**
- cbf45ec: FOUND (feat(09-01): add type-aware display formatting and duration validation)
