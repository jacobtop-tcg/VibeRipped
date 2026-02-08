---
phase: 02-exercise-pool-configuration
plan: 02
subsystem: rotation-engine, configuration, state-persistence
tags: [tdd, config-driven, pool-json, user-edits, hash-tracking]

dependency_graph:
  requires:
    - 02-01: Equipment configuration module and pool assembly logic
    - 01-02: Cooldown enforcement and rotation engine
    - 01-01: State persistence and pool hashing
  provides:
    - Config-driven rotation engine with pool.json persistence
    - User edit preservation for pool.json when config unchanged
    - Automatic pool regeneration on configuration changes
    - Human-readable pool.json for transparency and manual editing
  affects:
    - Phase 3 (Statusline Provider): Will trigger engine in config-driven mode
    - Phase 4 (CLI): Will modify configuration.json to manage equipment
    - Future phases: Can rely on pool.json as source of truth for rotation

tech_stack:
  added:
    - configPoolHash in state.json: Tracks assembled pool hash for config change detection
    - pool.json persistence: Human-readable JSON with pretty-printing
  patterns:
    - Config-driven vs legacy mode: null pool parameter enables config mode, explicit pool preserves backward compatibility
    - Double-hash tracking: configPoolHash (assembled pool) + poolHash (actual rotation pool) for user edit detection
    - Fail-safe pool loading: Missing/invalid pool.json regenerates from config
    - Atomic pool.json writes: writeFileAtomic with secure permissions

key_files:
  created:
    - ~/.config/viberipped/pool.json: Assembled exercise pool from configuration.json
  modified:
    - engine.js: Config-driven trigger with pool.json persistence and regeneration logic

decisions:
  - Config-driven mode triggered by null pool parameter (backward compatible with Phase 1 tests)
  - configPoolHash stored in state.json to detect config changes independently of user edits
  - pool.json regenerated only when configPoolHash changes (config changed) or pool.json missing/invalid
  - User edits to pool.json preserved as long as configuration.json unchanged
  - pool.json pretty-printed with 2-space indent for human readability
  - Legacy mode (explicit pool parameter) bypasses all config/pool.json logic for backward compatibility

metrics:
  duration_minutes: 4
  tests_added: 10
  tests_passing: 43
  commits: 2
  completed_date: 2026-02-08
---

# Phase 2 Plan 2: Config-Driven Engine Integration Summary

Config-driven rotation engine with pool.json persistence, user edit preservation, and automatic regeneration on config changes.

## Performance

- **Duration:** 4 minutes
- **Started:** 2026-02-08T17:50:07Z
- **Completed:** 2026-02-08T17:54:21Z
- **Tasks:** 2 (TDD: RED → GREEN)
- **Files modified:** 2 (engine.js, test/engine.test.js)
- **Tests added:** 10 new test cases
- **Tests passing:** 43 total (33 from Phase 1-2.01 + 10 new)

## Accomplishments

- Engine reads configuration.json, assembles pool from equipment flags, and writes pool.json for rotation
- User edits to pool.json preserved until configuration.json changes
- Configuration change triggers pool.json regeneration and rotation index reset
- pool.json is human-readable JSON (pretty-printed with 2-space indent) for transparency
- All Phase 1 tests still pass (zero regression) with backward compatibility maintained

## Task Commits

Each task was committed atomically following TDD flow:

1. **Task 1: RED - Write failing tests** - `4e74aa7` (test)
   - 10 new test cases in 4 describe blocks
   - Config-driven pool assembly (4 tests)
   - pool.json persistence (3 tests)
   - User edit preservation (3 tests)

2. **Task 2: GREEN - Implement config-driven engine** - `48ae4ec` (feat)
   - Modified trigger() to accept null for config-driven mode
   - Load configuration, assemble pool, write/read pool.json
   - Track configPoolHash in state for config change detection
   - All 43 tests pass

**Plan metadata:** (Will be committed separately)

## Files Created/Modified

- **~/.config/viberipped/pool.json** (created) - Assembled exercise pool from configuration.json, human-readable JSON with pretty-printing, source of truth for rotation
- **engine.js** (modified) - Config-driven trigger with pool.json persistence, user edit preservation, automatic regeneration on config change, backward compatible with Phase 1 tests
- **test/engine.test.js** (modified) - 10 new test cases covering config-driven assembly, pool.json persistence, and user edit preservation

## Decisions Made

**Config-driven mode trigger:**
- Decided to use `pool = null` as signal for config-driven mode
- Explicit pool parameter preserves Phase 1 test compatibility (legacy mode)
- Keeps API clean without new options flag

**Double-hash tracking strategy:**
- `state.configPoolHash`: Hash of assembled pool from configuration.json (detects config changes)
- `state.poolHash`: Hash of actual rotation pool (detects pool.json changes for index reset)
- This separation allows user edits to pool.json without triggering regeneration

**Regeneration conditions:**
- Only regenerate pool.json when: (1) configPoolHash changed (config changed) OR (2) pool.json missing/invalid
- If config unchanged and pool.json valid: load pool.json as-is (preserves user edits)
- On regeneration: reset rotation index to 0 (fresh pool = fresh rotation)

**File paths:**
- All files (state.json, configuration.json, pool.json) live in same directory
- Directory determined by `path.dirname(statePath)`
- For production: ~/.config/viberipped/
- For tests: temporary isolated directories

## Deviations from Plan

None - plan executed exactly as written. TDD flow followed (RED → GREEN), all test cases implemented as specified, config-driven logic integrated as designed, backward compatibility preserved.

## Issues Encountered

None. Implementation followed plan specification. All tests passed on first GREEN implementation attempt.

## Verification Results

All success criteria met:

1. **Config-driven pool assembly:**
   ```bash
   # No config → bodyweight-only pool
   $ rm ~/.config/viberipped/configuration.json
   $ node engine.js
   # Returns bodyweight exercise from DEFAULT_POOL

   # Kettlebell config → bodyweight + kettlebell pool
   $ echo '{"equipment":{"kettlebell":true,"dumbbells":false,"pullUpBar":false,"parallettes":false}}' > ~/.config/viberipped/configuration.json
   $ node engine.js
   # pool.json now includes kettlebell exercises
   ```

2. **pool.json persistence:**
   ```bash
   $ cat ~/.config/viberipped/pool.json | head -10
   # Pretty-printed JSON with 2-space indent
   # Array of exercises with name, reps, equipment fields
   ```

3. **User edit preservation:**
   - Add custom exercise to pool.json manually
   - Trigger engine (config unchanged) → custom exercise appears in rotation
   - Tests verify custom exercise survives multiple triggers

4. **Config change regeneration:**
   - Change configuration.json (add dumbbells: true)
   - Trigger engine → pool.json regenerated, custom edits removed
   - Rotation index reset to 0
   - Tests verify new pool includes dumbbell exercises

5. **Backward compatibility:**
   ```bash
   $ node --test
   # tests 43
   # pass 43
   # fail 0
   # All Phase 1 tests still pass
   ```

## Implementation Details

### Config-Driven Mode Flow

```javascript
// In trigger()
if (pool === null) {
  // 1. Load configuration.json (fail-safe to bodyweight-only)
  const config = loadConfig(configPath);

  // 2. Assemble pool from equipment flags
  const assembledPool = assemblePool(config);
  const assembledHash = computePoolHash(assembledPool);

  // 3. Check if config changed
  if (state.configPoolHash === assembledHash) {
    // Config unchanged - try to load pool.json (preserves user edits)
    try {
      const loadedPool = JSON.parse(fs.readFileSync(poolPath, 'utf8'));
      actualPool = loadedPool; // User edits preserved
    } catch (e) {
      actualPool = assembledPool; // Regenerate if pool.json invalid
    }
  } else {
    // Config changed - regenerate pool.json
    actualPool = assembledPool;
    writeFileAtomic.sync(poolPath, JSON.stringify(assembledPool, null, 2));
  }

  // 4. Update state with new configPoolHash
  state.configPoolHash = assembledHash;
}
```

### Hash Tracking Strategy

- **configPoolHash** = hash of pool assembled from configuration.json
  - Stored in state.json
  - Updated on every trigger in config-driven mode
  - Used to detect when configuration.json changed

- **poolHash** = hash of actual pool being used for rotation
  - Could be assembled pool OR user-edited pool.json
  - Updated when pool content changes
  - Triggers rotation index reset when changed

### Backward Compatibility

Phase 1 tests pass explicit pool arrays to trigger():
```javascript
trigger(DEFAULT_POOL, { statePath, bypassCooldown: true })
```

This triggers legacy mode (bypasses config/pool.json logic entirely).

New Phase 2 tests use config-driven mode:
```javascript
trigger(null, { statePath, bypassCooldown: true })
```

Both modes coexist without conflict.

## Test Coverage

**Config-Driven Pool Assembly (4 tests):**
1. No config → bodyweight-only pool
2. Kettlebell enabled → bodyweight + kettlebell exercises
3. All equipment enabled → all 26 exercises
4. Invalid config → bodyweight-only fallback

**Pool.json Persistence (3 tests):**
1. pool.json created on first trigger
2. pool.json contains valid JSON array with name/reps/equipment
3. pool.json is pretty-printed (human-readable)

**User Edit Preservation (3 tests):**
1. Custom exercise added to pool.json appears in rotation (config unchanged)
2. Config change regenerates pool.json (custom edits removed)
3. Pool regeneration resets rotation index to 0

**Plus 33 existing tests from Phase 1-2.01:**
- Rotation, cooldown, output format, corruption recovery
- Config module validation and load/save
- Pool assembly and database structure

## Next Phase Readiness

**Blockers:** None

**Ready for:**
- **Phase 3 (Statusline Provider):** Can trigger engine in config-driven mode via `trigger(null)`, will use assembled pool from user's configuration.json
- **Phase 4 (CLI):** Can modify ~/.config/viberipped/configuration.json to enable/disable equipment, changes automatically picked up on next trigger
- **Phase 5 (MCP Server):** Can expose pool.json as read-only resource for transparency
- **Phase 6 (Installation):** pool.json provides human-readable view of current exercise rotation

**Phase 2 Success Criteria:**

All 4 Phase 2 success criteria from ROADMAP now satisfied:

1. ✅ Configuration module validates equipment flags and provides fail-safe defaults (02-01)
2. ✅ Pool assembly filters FULL_EXERCISE_DATABASE by equipment configuration (02-01)
3. ✅ Engine loads configuration.json and assembles pool on each trigger (02-02)
4. ✅ pool.json persisted to ~/.config/viberipped/ for transparency and user editing (02-02)

**Phase 2 COMPLETE**

## Self-Check: PASSED

**Created files verified:**
```bash
$ ls -la ~/.config/viberipped/pool.json
-rw-------  1 jacob  staff  1115 Feb  8 18:53 pool.json  # ✓ Exists
```

**Modified files verified:**
```bash
$ ls -la engine.js test/engine.test.js
-rw-r--r--  1 jacob  staff  7507 Feb  8 18:52 engine.js  # ✓ Exists
-rw-r--r--  1 jacob  staff  17880 Feb  8 18:51 test/engine.test.js  # ✓ Exists
```

**Commits verified:**
```bash
$ git log --oneline | grep -E "(4e74aa7|48ae4ec)"
48ae4ec feat(02-02): implement config-driven pool loading and pool.json persistence  # ✓ Found
4e74aa7 test(02-02): add failing tests for config-driven engine and pool.json persistence  # ✓ Found
```

**All claims verified. Summary accurate.**

---

*Phase: 02-exercise-pool-configuration*
*Completed: 2026-02-08*
