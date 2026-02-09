---
phase: 08-data-model-extensions
plan: 02
subsystem: data-model
tags: [migration, backward-compatibility, v1.0-to-v1.1, backup, idempotency]
dependency_graph:
  requires:
    - "08-01 (schema foundation - validateExercise, config/state schema extensions)"
  provides:
    - migrateConfigIfNeeded function in migration.js
    - migratePoolIfNeeded function in migration.js
    - migrateStateIfNeeded function in migration.js
    - Automatic v1.0-to-v1.1 schema upgrade on first launch
    - .v1.0.backup files for rollback safety
  affects:
    - lib/migration.js (created)
    - engine.js (migration integration in config-driven mode)
    - test/migration.test.js (created)
    - test/engine.test.js (migration integration tests)
tech_stack:
  added:
    - fs.copyFileSync for exact backup creation
    - writeFileAtomic for crash-safe migration writes
  patterns:
    - Idempotent migration (check schemaVersion before migrating)
    - Backup-then-modify for rollback safety
    - Fire-and-forget integration (migration errors handled by existing recovery)
    - Migration detection via schemaVersion and type field presence
key_files:
  created:
    - lib/migration.js
    - test/migration.test.js
  modified:
    - engine.js
    - test/engine.test.js
decisions: []
metrics:
  duration_minutes: 4
  completed_date: 2026-02-09
---

# Phase 08 Plan 02: Automatic v1.0-to-v1.1 Migration with Backup Summary

**One-liner:** Automatic schema migration from v1.0 to v1.1 with .v1.0.backup creation, integrated into engine trigger flow for seamless upgrade path.

## Overview

Created migration module that automatically upgrades v1.0 config/pool/state files to v1.1 schema on first launch. All migrations create backup files before modifying originals, ensuring rollback safety. Migration is idempotent and integrated into the engine trigger flow for zero-friction upgrades.

Existing v1.0 users will see their files automatically upgraded on first v1.1 launch with no manual intervention required. Backup files (.v1.0.backup) provide rollback path if needed.

## Implementation Details

### Task 1: Migration Module (lib/migration.js)

**Migration Functions:**

Created three migration functions following TDD pattern:
- `migrateConfigIfNeeded(configPath)` - Adds environment: "anywhere" and schemaVersion: "1.1"
- `migratePoolIfNeeded(poolPath)` - Adds type: "reps" and environments: ["anywhere"] to exercises
- `migrateStateIfNeeded(statePath)` - Adds recentCategories: [] and schemaVersion: "1.1"

**Backup Creation:**

All migrations use `createBackup()` helper that:
- Creates .v1.0.backup file using `fs.copyFileSync` (exact content preservation)
- Only creates backup if it doesn't already exist (idempotent)
- Backup created BEFORE modification for rollback safety

**Migration Detection:**

- Config/State: Check `schemaVersion === "1.1"` - if true, already migrated
- Pool: Check first exercise has `type` field - if true, already migrated
- Missing/corrupt files return null without crashing (existing recovery paths handle it)

**Schema Changes:**

Config v1.0 -> v1.1:
- Add `environment: "anywhere"` (default)
- Add `schemaVersion: "1.1"`
- Preserve all existing equipment and difficulty fields

Pool v1.0 -> v1.1:
- Add `type: "reps"` to exercises (default for rep-based exercises)
- Add `environments: ["anywhere"]` to exercises (default environment)
- Do NOT add category (category assignment is Phase 11 concern)
- Preserve all existing name, reps, equipment fields

State v1.0 -> v1.1:
- Add `recentCategories: []` (default empty array)
- Add `schemaVersion: "1.1"`
- Preserve all existing currentIndex, lastTriggerTime, poolHash, totalTriggered fields

**Test Coverage:**

Created test/migration.test.js with 18 comprehensive tests:
- Config migration: 7 tests (backup creation, field addition, preservation, idempotency, missing file)
- Pool migration: 6 tests (backup creation, field addition, no category, v1.1 detection, custom exercises, missing file)
- State migration: 5 tests (backup creation, field addition, preservation, v1.1 detection, missing file)

All tests use isolated temp directories and verify:
- Backup files created with exact original content
- v1.1 fields added correctly
- Existing fields preserved
- Already-v1.1 files not re-migrated
- Multiple runs don't create duplicate backups

### Task 2: Engine Integration

**Integration Point:**

Added migration calls in engine.js config-driven mode block (after path determination, before loadConfig):

```javascript
// Migrate v1.0 files to v1.1 schema on first launch
migrateConfigIfNeeded(configPath);
migratePoolIfNeeded(poolPath);
migrateStateIfNeeded(statePath);

const config = loadConfig(configPath);
```

**Fire-and-Forget Pattern:**

Migration return values are intentionally ignored. If migration fails (file missing, corrupt, etc.), the existing `loadConfig`/`loadState` recovery paths handle it gracefully. This keeps integration minimal and non-breaking.

**Config-Driven Mode Only:**

Migration only runs when `pool === null` (config-driven mode). Legacy mode with explicit pool (used by tests) bypasses migration. This is correct because legacy mode provides its own pool.

**Test Coverage:**

Added 6 new integration tests to test/engine.test.js:
- Verify .v1.0.backup files created for config, state, and pool
- Verify engine returns valid exercise response after migration
- Verify already-v1.1 files don't trigger backup creation
- Verify idempotency (calling trigger twice only creates one backup)

All tests use isolated temp directories with v1.0-format files.

## Test Results

**Full Test Suite:** 191 tests, 100% pass rate (24 new tests added)
- test/migration.test.js: 18 tests (new file)
- test/engine.test.js: 6 new integration tests (32 total)

**Verification:**

Manual verification performed:
1. Full test suite passes (191 tests, 0 failures)
2. Created temp v1.0 config, ran engine, verified .v1.0.backup files created
3. Ran engine again, verified no duplicate backups (idempotent)
4. `node engine.js` produces valid exercise JSON with v1.1 fields
5. Checked backup content matches original v1.0 file exactly

**Zero regressions:** All existing v1.0 tests pass unchanged. Engine output format preserved.

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Task | Commit  | Description                                      |
| ---- | ------- | ------------------------------------------------ |
| 1    | 7983f5e | Add migration module with backup and v1.0-to-v1.1 schema upgrade |
| 2    | 66b1264 | Integrate migration into engine trigger flow     |

## Next Phase Readiness

**Phase 09 (Timed Exercises) blockers:** None - migration ensures v1.0 pools get type field added.

**Phase 10 (Environment Profiles) blockers:** None - migration ensures v1.0 configs get environment field added.

**Phase 11 (Category Rotation) blockers:** None - migration ensures v1.0 state gets recentCategories field added.

**User upgrade path verified:**
- v1.0 users see automatic upgrade on first v1.1 launch
- Backup files created for rollback safety
- No manual intervention required
- No data loss or corruption
- Engine continues to work transparently

**Dependencies satisfied:**
- ✓ Config migration adds environment and schemaVersion fields
- ✓ Pool migration adds type and environments fields to exercises
- ✓ State migration adds recentCategories and schemaVersion fields
- ✓ Backup files created for rollback safety
- ✓ Migration is idempotent (safe to run multiple times)
- ✓ Engine integration transparent to users

## Self-Check: PASSED

**Created files exist:**
```bash
# lib/migration.js
FOUND: lib/migration.js
# test/migration.test.js
FOUND: test/migration.test.js
```

**Commits exist:**
```bash
# Task 1: 7983f5e
FOUND: 7983f5e
# Task 2: 66b1264
FOUND: 66b1264
```

**Migration functions exported:**
```bash
# migrateConfigIfNeeded is a function
✓ typeof migrateConfigIfNeeded === 'function'
# migratePoolIfNeeded is a function
✓ typeof migratePoolIfNeeded === 'function'
# migrateStateIfNeeded is a function
✓ typeof migrateStateIfNeeded === 'function'
```

**Engine integration:**
```bash
# engine.js requires migration module
✓ grep "require.*migration" engine.js
# engine.js calls migration functions
✓ grep "migrateConfigIfNeeded\\|migratePoolIfNeeded\\|migrateStateIfNeeded" engine.js
```

**Backup files created in production:**
```bash
# v1.0 backup files exist in ~/.config/viberipped/
✓ configuration.json.v1.0.backup (163 bytes)
✓ state.json.v1.0.backup (253 bytes)
```

**Idempotency verified:**
```bash
# Second engine run did not modify backup files
✓ Backup mtime unchanged after second trigger
```

All verification checks passed.
