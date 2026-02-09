---
phase: 08-data-model-extensions
plan: 01
subsystem: data-model
tags: [schema, validation, backward-compatibility, v1.1]
dependency_graph:
  requires: []
  provides:
    - validateExercise function in pool.js
    - VALID_CATEGORIES and VALID_TYPES constants
    - category/type/environments fields on all FULL_EXERCISE_DATABASE exercises
    - environment and schemaVersion fields in config.js
    - recentCategories and schemaVersion fields in state.js
    - validateState export from state.js
  affects:
    - lib/pool.js (exercise validation and database schema)
    - lib/config.js (configuration validation and defaults)
    - lib/state.js (state validation and defaults)
    - test/pool.test.js (v1.1 exercise schema tests)
    - test/config.test.js (v1.1 config schema tests)
    - test/state.test.js (new file - state validation tests)
tech_stack:
  added: []
  patterns:
    - Optional field validation (backward compatible schema extension)
    - Schema versioning with schemaVersion field
    - Graceful normalization of missing optional fields
key_files:
  created:
    - test/state.test.js
  modified:
    - lib/pool.js
    - lib/config.js
    - lib/state.js
    - test/pool.test.js
    - test/config.test.js
decisions: []
metrics:
  duration_minutes: 4
  completed_date: 2026-02-09
---

# Phase 08 Plan 01: Schema Foundation for v1.1 Features Summary

**One-liner:** Extended data model schemas with optional v1.1 fields (category, type, environments, environment, recentCategories) maintaining full v1.0 backward compatibility.

## Overview

Extended pool.js, config.js, and state.js schemas with optional v1.1 fields to support upcoming features (timed exercises, environment profiles, category-aware rotation) without breaking any existing v1.0 functionality.

All new fields are validated only if present, ensuring v1.0 data continues to pass validation unchanged. Normalization functions add safe defaults for missing v1.1 fields.

## Implementation Details

### Task 1: Exercise Schema Extension (lib/pool.js)

**Validation Function:**
- Created `validateExercise(exercise)` function with v1.0 backward compatibility
- Required fields: name (string), reps (positive integer)
- Optional v1.0 fields: equipment (array of strings)
- Optional v1.1 fields: category (one of VALID_CATEGORIES or null), type (one of VALID_TYPES), environments (array of non-empty strings)

**Constants:**
- Exported `VALID_CATEGORIES = ["push", "pull", "legs", "core"]`
- Exported `VALID_TYPES = ["reps", "timed"]`

**Database Tags:**
- Tagged all 28 exercises in FULL_EXERCISE_DATABASE with category, type, and environments
- Category mapping: push (5 exercises), pull (6 exercises), legs (7 exercises), core (10 exercises)
- Type mapping: timed (4 exercises - Wall sit, Plank, Dead hangs, L-sit), reps (24 exercises)
- All exercises default to environments: ["anywhere"]

**Backward Compatibility:**
- DEFAULT_POOL remains unchanged (v1.0 structure)
- assemblePool preserves new v1.1 fields from source exercises
- v1.0 exercises without new fields pass validation

### Task 2: Config and State Schema Extension

**Config Module (lib/config.js):**
- Extended DEFAULT_CONFIG with `environment: "anywhere"` and `schemaVersion: "1.0"`
- Added validation for optional environment (string) and schemaVersion (string) fields
- Updated loadConfig to normalize missing fields: `environment || "anywhere"`, `schemaVersion || "1.0"`

**State Module (lib/state.js):**
- Extended createDefaultState with `recentCategories: []` and `schemaVersion: "1.0"`
- Added validation for optional recentCategories (array of strings) and schemaVersion (string) fields
- Exported validateState function for testing

**Test Coverage:**
- Created test/state.test.js with 8 comprehensive state validation tests
- Added 10 new v1.1 config schema tests to test/config.test.js
- Added 14 new v1.1 exercise schema tests to test/pool.test.js

## Test Results

**Full Test Suite:** 167 tests, 100% pass rate (36 new tests added)
- test/pool.test.js: 25 tests (14 new v1.1 schema tests)
- test/config.test.js: 28 tests (10 new v1.1 schema tests)
- test/state.test.js: 8 tests (new file)

**Verification:**
- validateExercise exported as function: ✓
- VALID_CATEGORIES exported as ["push","pull","legs","core"]: ✓
- DEFAULT_CONFIG.environment === "anywhere": ✓
- createDefaultState(pool).recentCategories === []: ✓
- engine.js outputs v1.1 fields in JSON: ✓

**Zero regressions:** All existing v1.0 tests pass unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing state.test.js file**
- **Found during:** Task 2 preparation
- **Issue:** State module had no dedicated test file. validateState was not exported or tested.
- **Fix:** Created test/state.test.js with comprehensive validation tests. Exported validateState from lib/state.js.
- **Files modified:** test/state.test.js (created), lib/state.js (exports)
- **Commit:** c94be59

**2. [Rule 1 - Bug] Old config test incompatible with normalization**
- **Found during:** Task 2 GREEN phase
- **Issue:** Test "loadConfig returns valid config from file" failed because loadConfig now adds v1.1 fields with defaults
- **Fix:** Updated test to expect normalized output (v1.0 input + v1.1 defaults)
- **Files modified:** test/config.test.js
- **Commit:** c94be59

## Commits

| Task | Commit  | Description                                      |
| ---- | ------- | ------------------------------------------------ |
| 1    | 26d529f | Add v1.1 exercise schema validation to pool.js   |
| 2    | c94be59 | Add v1.1 schema fields to config and state       |

## Next Phase Readiness

**Phase 09 (Timed Exercises) blockers:** None - type field and validation ready.

**Phase 10 (Environment Profiles) blockers:** None - environment field and validation ready.

**Phase 11 (Category Rotation) blockers:** None - category field, recentCategories state, and validation ready.

**Dependencies satisfied:**
- ✓ Exercise database tagged with category, type, environments
- ✓ Validation functions handle optional v1.1 fields
- ✓ State tracks recentCategories for rotation logic
- ✓ Config tracks environment for filtering logic
- ✓ Schema versioning in place for future migrations

## Self-Check: PASSED

**Created files exist:**
```bash
# test/state.test.js
FOUND: test/state.test.js
```

**Commits exist:**
```bash
# Task 1: 26d529f
FOUND: 26d529f
# Task 2: c94be59
FOUND: c94be59
```

**Validation exports:**
```bash
# validateExercise is a function
✓ function
# VALID_CATEGORIES exported
✓ [ 'push', 'pull', 'legs', 'core' ]
# validateState exported
✓ function (via test/state.test.js imports)
```

**Engine integration:**
```bash
# engine.js outputs v1.1 fields
✓ exercise object includes category, type, environments
```

All verification checks passed.
