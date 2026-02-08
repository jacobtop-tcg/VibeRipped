---
phase: 02-exercise-pool-configuration
plan: 01
subsystem: configuration, exercise-pool
tags: [tdd, equipment-configuration, pool-assembly, fail-safe]

dependency_graph:
  requires:
    - 01-01: Core rotation engine and state persistence
    - 01-02: Cooldown enforcement
  provides:
    - Equipment-aware configuration system with fail-safe defaults
    - Full exercise database with equipment tags (26 exercises)
    - Pool assembly logic with equipment filtering
  affects:
    - Future statusline provider will use assemblePool() instead of DEFAULT_POOL
    - Future CLI will use config.js for equipment management

tech_stack:
  added:
    - lib/config.js: Configuration validation, load/save with write-file-atomic
    - FULL_EXERCISE_DATABASE: 26 exercises across 5 equipment categories
  patterns:
    - TDD with Node.js built-in test runner (23 new test cases)
    - Fail-safe validation: invalid config degrades to bodyweight-only defaults
    - Equipment key constants shared between config schema and database
    - AND logic for multi-equipment exercises

key_files:
  created:
    - lib/config.js: EQUIPMENT_KEYS, DEFAULT_CONFIG, validateConfig, loadConfig, saveConfig, getConfigPath
    - test/config.test.js: 12 test cases for config validation and load/save
    - test/pool.test.js: 11 test cases for database structure and pool assembly
  modified:
    - lib/pool.js: Extended with FULL_EXERCISE_DATABASE (26 exercises) and assemblePool()

decisions:
  - Duplicated EQUIPMENT_KEYS in pool.js to avoid circular dependency (config.js imports state.js which imports pool.js)
  - Bodyweight exercises in FULL_EXERCISE_DATABASE identical to DEFAULT_POOL (backward compatibility)
  - Missing equipment keys in config treated as false (partial config support)
  - Pool assembly never returns empty pool (bodyweight always included, DEFAULT_POOL fallback)

metrics:
  duration_minutes: 3
  tests_added: 23
  tests_passing: 33
  commits: 2
  completed_date: 2026-02-08
---

# Phase 2 Plan 1: Equipment Configuration & Pool Assembly Summary

Configuration module with fail-safe defaults and equipment-aware pool assembly using TDD.

## Overview

Created the configuration module (lib/config.js) with equipment key constants, validation, and atomic load/save operations. Extended the exercise pool module (lib/pool.js) with a full 26-exercise database tagged by equipment type and an assemblePool() function that filters exercises based on available equipment. All logic developed via TDD with 23 new test cases.

## What Was Built

### Configuration Module (lib/config.js)

**Exports:**
- `EQUIPMENT_KEYS`: Constants for kettlebell, dumbbells, pullUpBar, parallettes
- `DEFAULT_CONFIG`: All equipment set to false (bodyweight-only)
- `validateConfig(config)`: Validates structure, accepts partial configs
- `loadConfig(configPath)`: Loads with fail-safe defaults (never throws)
- `saveConfig(configPath, config)`: Atomic write with secure permissions (0600)
- `getConfigPath()`: Returns standard path using XDG Base Directory spec

**Fail-safe behavior:**
- Missing file → DEFAULT_CONFIG
- Invalid JSON → DEFAULT_CONFIG
- Invalid structure → DEFAULT_CONFIG
- Partial config (missing keys) → Treated as false

### Extended Exercise Pool (lib/pool.js)

**New exports:**
- `FULL_EXERCISE_DATABASE`: 26 exercises with equipment tags
  - 10 bodyweight (equipment: [])
  - 4 kettlebell
  - 4 dumbbells
  - 4 pull-up bar
  - 4 parallettes
- `assemblePool(equipmentConfig)`: Filters database by available equipment
  - Bodyweight exercises always included
  - Equipment exercises require ALL listed equipment (AND logic)
  - Never returns empty pool (falls back to DEFAULT_POOL)

**Preserved exports:**
- `DEFAULT_POOL`: Unchanged from Phase 1 (backward compatibility)
- `computePoolHash`: Unchanged from Phase 1

### Tests

**test/config.test.js** (12 cases):
1. EQUIPMENT_KEYS structure and values
2. DEFAULT_CONFIG all-false equipment
3. validateConfig accepts valid/partial configs
4. validateConfig rejects null, undefined, missing equipment, non-boolean values
5. loadConfig returns defaults on missing file, invalid JSON, invalid structure
6. loadConfig returns valid config from file
7. saveConfig writes atomically with secure permissions

**test/pool.test.js** (11 cases):
1. FULL_EXERCISE_DATABASE has bodyweight exercises (at least 5)
2. FULL_EXERCISE_DATABASE has exercises for each equipment type
3. All exercises have required fields (name, reps, equipment)
4. All equipment tags match EQUIPMENT_KEYS values (no typos)
5. assemblePool with no equipment returns bodyweight-only
6. assemblePool with kettlebell includes bodyweight + kettlebell
7. assemblePool with all equipment returns full database
8. assemblePool never returns empty pool
9. assemblePool uses AND logic for multi-equipment exercises
10. DEFAULT_POOL preserved for backward compatibility
11. computePoolHash produces different hashes for different pools

## Verification Results

All success criteria met:

```bash
# All tests pass (23 new + 10 existing)
$ node --test
# tests 33
# pass 33
# fail 0

# Config module exports
$ node -e "const c = require('./lib/config'); console.log(Object.keys(c))"
[ 'EQUIPMENT_KEYS', 'DEFAULT_CONFIG', 'validateConfig',
  'loadConfig', 'saveConfig', 'getConfigPath' ]

# Database and pool sizes
$ node -e "const p = require('./lib/pool'); const c = require('./lib/config');
  console.log('DB:', p.FULL_EXERCISE_DATABASE.length,
  'Default:', p.DEFAULT_POOL.length,
  'BW:', p.assemblePool(c.DEFAULT_CONFIG).length)"
DB: 26 Default: 10 BW: 10

# All-equipment pool
$ node -e "const p = require('./lib/pool');
  console.log('All:', p.assemblePool({equipment:{kettlebell:true,dumbbells:true,
    pullUpBar:true,parallettes:true}}).length)"
All: 26
```

## Deviations from Plan

None - plan executed exactly as written. TDD flow followed (RED → GREEN), all test cases implemented as specified, all modules created with required exports, backward compatibility preserved.

## Implementation Details

### Equipment Key Consistency

Equipment keys are defined in lib/config.js as the canonical source. To avoid circular dependency (config.js imports state.js which imports pool.js), EQUIPMENT_KEYS is duplicated in pool.js. The pool.test.js validates that all equipment tags in the database match EQUIPMENT_KEYS values from config.js, ensuring consistency.

### Pool Assembly Logic

```javascript
// Pseudocode
availableEquipment = keys where config.equipment[key] === true
filtered = FULL_EXERCISE_DATABASE.filter(exercise => {
  if (exercise.equipment.length === 0) return true  // Bodyweight
  return exercise.equipment.every(eq => availableEquipment.includes(eq))  // AND logic
})
if (filtered.length === 0) return DEFAULT_POOL  // Fail-safe (should never happen)
return filtered
```

### Exercise Selection

All exercises chosen for:
- Quick execution (30-60 seconds max)
- Low sweat (preserve coding ability)
- Cognitive preservation (no exhaustion)
- Diverse muscle groups

Isometric holds (wall sit, plank, L-sit, dead hangs, tuck planche) use "reps" to represent seconds.

## Testing Strategy

**TDD Flow:**
1. **RED**: Created test files with 23 failing test cases (tests failed because modules didn't exist)
2. **GREEN**: Implemented config.js and extended pool.js until all tests passed
3. **Regression check**: Verified all 10 existing engine.test.js tests still pass

**Test coverage:**
- Equipment keys and constants
- Default configuration structure
- Validation (valid, invalid, partial configs)
- Load with fail-safe recovery (missing file, parse errors, validation failures)
- Save with atomic write and secure permissions
- Database structure (required fields, equipment tags)
- Pool assembly (bodyweight-only, single equipment, all equipment, empty config)
- AND logic for multi-equipment exercises
- Backward compatibility (DEFAULT_POOL preserved)
- Hash uniqueness for different pools

## Next Phase Readiness

**Blockers:** None

**Ready for:**
- Phase 2 Plan 2: Integration with rotation engine (use assemblePool() instead of DEFAULT_POOL)
- Phase 3: Statusline provider can use equipment-aware pools
- Phase 4: CLI configuration management

**Configuration path established:**
- XDG compliant: `~/.config/viberipped/configuration.json`
- Secure permissions: 0700 directory, 0600 file
- Atomic writes prevent corruption

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| 43fb8cc | test | Add failing tests for config validation and pool assembly (RED phase) |
| 27d9b5a | feat | Implement config module and extend pool with equipment database (GREEN phase) |

## Self-Check: PASSED

**Created files verified:**
```bash
$ ls -1 lib/config.js test/config.test.js test/pool.test.js
lib/config.js
test/config.test.js
test/pool.test.js
```

**Commits verified:**
```bash
$ git log --oneline | grep -E "(43fb8cc|27d9b5a)"
27d9b5a feat(02-01): implement config module and extend pool with equipment database
43fb8cc test(02-01): add failing tests for config validation and pool assembly
```

**All claims verified. Summary accurate.**
