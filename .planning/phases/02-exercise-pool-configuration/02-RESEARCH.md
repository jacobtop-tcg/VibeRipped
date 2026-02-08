# Phase 2: Exercise Pool Configuration - Research

**Researched:** 2026-02-08
**Domain:** Configuration management, JSON storage, equipment-based filtering
**Confidence:** HIGH

## Summary

Phase 2 introduces user-configurable equipment selection with transparent JSON storage for both configuration and exercise pools. The technical domain centers on three core problems: (1) persisting user equipment choices as human-editable configuration, (2) dynamically assembling exercise pools from equipment categories, and (3) detecting pool changes to trigger rotation re-indexing.

The existing Phase 1 codebase already solves the hard problems: atomic writes via write-file-atomic, SHA256 pool hashing for change detection, XDG directory compliance, and fail-safe validation. Phase 2 extends these patterns rather than introducing new infrastructure.

**Primary recommendation:** Store configuration.json and pool.json as separate files with manual validation functions (no external dependencies). Use equipment tags on exercises to filter pool assembly. Preserve Phase 1's fail-safe philosophy: invalid configuration degrades to bodyweight-only defaults, never crashes.

## Standard Stack

### Core

Phase 2 requires zero new dependencies. All capabilities exist in Node.js built-ins plus Phase 1's existing write-file-atomic.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js fs module | Built-in | Synchronous JSON reading | Phase 1 already uses fs.readFileSync for state |
| write-file-atomic | 7.0.0 | Atomic configuration writes | Phase 1 dependency, prevents corruption on crash |
| Node.js crypto | Built-in | SHA256 pool hashing | Phase 1 uses for pool change detection |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| JSON5 / JSONC parsers | (avoided) | Comments in JSON | NOT RECOMMENDED: Phase 1 uses pure JSON, consistency matters |
| Ajv / jsonschema | (avoided) | Schema validation | NOT RECOMMENDED: Zero-dependency constraint, manual validation sufficient |
| chokidar | (avoided) | File watching | NOT RECOMMENDED: Phase 2 doesn't need hot reload, triggers read on engine start |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual validation | Ajv schema validator | Ajv adds dependency (50MB+ download tree), overkill for 2-3 field config |
| Pure JSON | JSON5 with comments | JSON5 requires parser dependency, breaks Phase 1's zero-external-dependencies principle |
| Synchronous reads | Async fs.promises | Phase 1 uses sync reads for state, consistency matters, startup-time only operation |
| Separate config/pool files | Single merged file | Separate files allow user to edit pool without touching config (clearer boundaries) |

**Installation:**

No new dependencies required.

## Architecture Patterns

### Recommended Project Structure

```
lib/
├── pool.js              # EXTEND: add equipment filtering, full exercise database
├── state.js             # EXTEND: add config loading with fail-safe defaults
├── rotation.js          # NO CHANGE
├── cooldown.js          # NO CHANGE
└── config.js            # NEW: configuration schema, validation, persistence

~/.config/viberipped/
├── state.json           # EXISTING: rotation state (Phase 1)
├── configuration.json   # NEW: user equipment choices
└── pool.json            # NEW: assembled exercise pool (generated from config)
```

### Pattern 1: Configuration with Fail-Safe Defaults

**What:** Load configuration with graceful degradation to defaults on missing/invalid files

**When to use:** Any user-editable configuration that could be corrupted or missing

**Example:**

```javascript
// lib/config.js
const fs = require('fs');
const path = require('path');
const writeFileAtomic = require('write-file-atomic');

const DEFAULT_CONFIG = {
  equipment: {
    kettlebell: false,
    dumbbells: false,
    pullUpBar: false,
    parallettes: false
  }
};

function validateConfig(config) {
  if (!config || typeof config !== 'object') return false;
  if (!config.equipment || typeof config.equipment !== 'object') return false;

  const validKeys = ['kettlebell', 'dumbbells', 'pullUpBar', 'parallettes'];
  for (const key of validKeys) {
    if (typeof config.equipment[key] !== 'boolean') return false;
  }

  return true;
}

function loadConfig(configPath) {
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(content);

    if (!validateConfig(config)) {
      console.error('Invalid config structure, using defaults');
      return DEFAULT_CONFIG;
    }

    return config;
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.error('No config file, using defaults');
    } else {
      console.error(`Config load error: ${e.message}, using defaults`);
    }
    return DEFAULT_CONFIG;
  }
}

function saveConfig(configPath, config) {
  try {
    const dir = path.dirname(configPath);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileAtomic.sync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
  } catch (e) {
    console.error(`Config save error: ${e.message}`);
  }
}

module.exports = { DEFAULT_CONFIG, loadConfig, saveConfig, validateConfig };
```

### Pattern 2: Equipment-Based Pool Assembly

**What:** Filter full exercise database by equipment availability and generate pool.json

**When to use:** Dynamic content assembly based on user configuration

**Example:**

```javascript
// lib/pool.js - EXTENDED from Phase 1

const FULL_EXERCISE_DATABASE = [
  // Bodyweight (always included)
  { name: "Pushups", reps: 15, equipment: [] },
  { name: "Bodyweight squats", reps: 20, equipment: [] },
  { name: "Plank", reps: 30, equipment: [] },

  // Kettlebell exercises
  { name: "Kettlebell swings", reps: 15, equipment: ["kettlebell"] },
  { name: "Goblet squats", reps: 12, equipment: ["kettlebell"] },

  // Dumbbell exercises
  { name: "Dumbbell rows", reps: 12, equipment: ["dumbbells"] },
  { name: "Overhead press", reps: 10, equipment: ["dumbbells"] },

  // Pull-up bar exercises
  { name: "Pull-ups", reps: 8, equipment: ["pullUpBar"] },
  { name: "Hanging knee raises", reps: 10, equipment: ["pullUpBar"] },

  // Parallettes exercises
  { name: "L-sit", reps: 20, equipment: ["parallettes"] },
  { name: "Parallette pushups", reps: 12, equipment: ["parallettes"] }
];

function assemblePool(equipmentConfig) {
  const availableEquipment = Object.keys(equipmentConfig)
    .filter(key => equipmentConfig[key] === true);

  return FULL_EXERCISE_DATABASE.filter(exercise => {
    // Include bodyweight exercises (empty equipment array)
    if (exercise.equipment.length === 0) return true;

    // Include exercises where ALL required equipment is available
    return exercise.equipment.every(required =>
      availableEquipment.includes(required)
    );
  });
}

module.exports = {
  FULL_EXERCISE_DATABASE,
  assemblePool,
  computePoolHash // Keep from Phase 1
};
```

### Pattern 3: Two-File Configuration Strategy

**What:** Separate configuration.json (user edits) from pool.json (system generates)

**When to use:** User-editable config drives system-generated derived data

**Boundaries:**

| File | Owner | Edit Policy | Regeneration |
|------|-------|-------------|--------------|
| `configuration.json` | User | Direct editing allowed | Never auto-regenerated |
| `pool.json` | System | User CAN edit (adds custom exercises) | Regenerated only when config changes |
| `state.json` | System | Never user-edited | Updated on every trigger |

**Regeneration logic:**

```javascript
// Engine startup checks:
// 1. Load configuration.json
// 2. Compute pool hash from assembled pool
// 3. Check if pool.json exists and matches hash
// 4. If mismatch: regenerate pool.json (user may have edited config)
// 5. Load pool.json for rotation
```

### Pattern 4: Manual Validation Without Libraries

**What:** Use typeof, Array.isArray, and structural checks instead of schema libraries

**When to use:** Simple configuration schemas where dependencies add more complexity than value

**Example:**

```javascript
function validateConfig(config) {
  // Structure check
  if (!config || typeof config !== 'object') return false;
  if (!config.equipment || typeof config.equipment !== 'object') return false;

  // Field validation
  const validKeys = ['kettlebell', 'dumbbells', 'pullUpBar', 'parallettes'];
  const configKeys = Object.keys(config.equipment);

  // Reject unknown keys
  for (const key of configKeys) {
    if (!validKeys.includes(key)) return false;
  }

  // Validate value types
  for (const key of validKeys) {
    if (key in config.equipment && typeof config.equipment[key] !== 'boolean') {
      return false;
    }
  }

  return true;
}

function validatePool(pool) {
  if (!Array.isArray(pool)) return false;
  if (pool.length === 0) return false;

  for (const exercise of pool) {
    if (!exercise || typeof exercise !== 'object') return false;
    if (typeof exercise.name !== 'string' || exercise.name.length === 0) return false;
    if (!Number.isInteger(exercise.reps) || exercise.reps <= 0) return false;
    if (!Array.isArray(exercise.equipment)) return false;
  }

  return true;
}
```

### Anti-Patterns to Avoid

- **Hardcoding exercises in engine.js:** Exercise database belongs in lib/pool.js for testability and maintainability
- **Mixing configuration and pool in one file:** Separate concerns — config is user intent, pool is derived state
- **Auto-regenerating pool on every load:** Only regenerate when configuration.json changes (detected via hash comparison)
- **Throwing on invalid config:** Phase 1 principle: never crash, always degrade to safe defaults
- **Using async fs operations:** Phase 1 uses sync reads for simplicity, Phase 2 should match (startup-time only)
- **Comments in JSON files:** Breaks native JSON.parse, requires extra dependencies, adds complexity for marginal benefit

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file writes | Custom write-temp-rename | write-file-atomic (Phase 1 dep) | Handles edge cases: partial writes, permissions, cross-device renames |
| SHA256 hashing | Manual crypto wrappers | crypto.createHash (built-in) | Phase 1 pattern, collision-resistant, deterministic |
| XDG directory paths | Custom env detection | Phase 1's getStateDir pattern | Already tested, handles XDG_CONFIG_HOME fallback |
| Deep object validation | Recursive validators | Simple typeof + structural checks | Config schema is flat (2 levels), custom recursion overkill |
| Configuration watching | fs.watch / chokidar | Load-on-startup only | Phase 2 doesn't need hot reload, engine restarts frequently anyway |

**Key insight:** Phase 1 already solved persistence, validation, and change detection. Phase 2 extends these patterns to configuration and pool files. The only new logic is equipment filtering, which is a simple array filter operation.

## Common Pitfalls

### Pitfall 1: Configuration Corruption Breaking Engine

**What goes wrong:** User edits configuration.json with syntax error, engine fails to start

**Why it happens:** JSON.parse throws on invalid JSON, uncaught exceptions crash Node.js

**How to avoid:** Wrap JSON.parse in try-catch, validate structure after parse, fall back to defaults on any error

**Warning signs:**
- Engine fails to start after user edits config
- Error messages mention "Unexpected token" or "JSON"
- State file exists but configuration missing

**Prevention code:**

```javascript
try {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (!validateConfig(config)) throw new Error('Invalid structure');
  return config;
} catch (e) {
  console.error(`Config invalid (${e.message}), using defaults`);
  return DEFAULT_CONFIG;
}
```

### Pitfall 2: Pool Regeneration Destroying User Edits

**What goes wrong:** User manually adds custom exercise to pool.json, next engine run deletes it

**Why it happens:** Engine regenerates pool from configuration without preserving manual additions

**How to avoid:** Phase 2 does NOT support manual pool edits in v1 (ROTN-06 requires transparency, not preservation). Document clearly that pool.json is regenerated when configuration changes.

**Warning signs:**
- User complains about "lost exercises"
- pool.json timestamp updates unexpectedly
- Custom exercises disappear after config change

**Phase 2 decision:** Regenerate pool.json ONLY when configuration.json changes (detected via reading config and comparing assembled pool hash to pool.json hash). If user edits pool.json directly, preserve edits UNTIL configuration changes.

**Implementation:**

```javascript
// On engine startup:
const config = loadConfig(configPath);
const assembledPool = assemblePool(config.equipment);
const assembledHash = computePoolHash(assembledPool);

// Check if pool.json exists and matches
let pool;
try {
  pool = JSON.parse(fs.readFileSync(poolPath, 'utf8'));
  const poolHash = computePoolHash(pool);

  if (poolHash !== assembledHash) {
    console.error('Configuration changed, regenerating pool');
    pool = assembledPool;
    savePool(poolPath, pool);
  }
} catch (e) {
  console.error('Pool file missing or invalid, generating from config');
  pool = assembledPool;
  savePool(poolPath, pool);
}
```

### Pitfall 3: Empty Equipment Selection Producing Empty Pool

**What goes wrong:** User sets all equipment flags to false, pool assembles with zero exercises

**Why it happens:** Filter excludes all equipment exercises, but logic forgets to ensure bodyweight exercises included

**How to avoid:** FULL_EXERCISE_DATABASE must include bodyweight exercises with empty equipment array `[]`, filter logic includes these unconditionally

**Warning signs:**
- Pool has 0 length after assembly
- Engine crashes with "pool.length is 0" or array index errors
- User reports "no exercises available"

**Prevention code:**

```javascript
// Bodyweight exercises have equipment: [] (empty array)
// Filter includes exercises where equipment.every() succeeds
// For empty arrays, every() returns true (vacuous truth)

const bodyweightExercises = FULL_EXERCISE_DATABASE.filter(ex => ex.equipment.length === 0);
if (bodyweightExercises.length === 0) {
  throw new Error('FULL_EXERCISE_DATABASE missing bodyweight exercises');
}

// This should never happen in tests
const pool = assemblePool(config.equipment);
if (pool.length === 0) {
  console.error('Pool assembly produced zero exercises, falling back to bodyweight defaults');
  return DEFAULT_POOL; // Phase 1's hard-coded bodyweight pool
}
```

### Pitfall 4: Equipment Key Naming Inconsistency

**What goes wrong:** Configuration uses camelCase (`pullUpBar`) but exercise database uses kebab-case (`pull-up-bar`), filtering fails

**Why it happens:** No single source of truth for equipment key names

**How to avoid:** Define equipment keys as constants, use in both config schema and exercise database

**Warning signs:**
- User enables equipment but exercises don't appear
- Equipment flag shows true but filter excludes exercises
- Tests pass but manual testing fails

**Prevention code:**

```javascript
// lib/config.js
const EQUIPMENT_KEYS = {
  KETTLEBELL: 'kettlebell',
  DUMBBELLS: 'dumbbells',
  PULL_UP_BAR: 'pullUpBar',
  PARALLETTES: 'parallettes'
};

const DEFAULT_CONFIG = {
  equipment: {
    [EQUIPMENT_KEYS.KETTLEBELL]: false,
    [EQUIPMENT_KEYS.DUMBBELLS]: false,
    [EQUIPMENT_KEYS.PULL_UP_BAR]: false,
    [EQUIPMENT_KEYS.PARALLETTES]: false
  }
};

// Use same constants in exercise database:
{ name: "Pull-ups", reps: 8, equipment: [EQUIPMENT_KEYS.PULL_UP_BAR] }
```

### Pitfall 5: Forgetting to Update Pool Hash in State

**What goes wrong:** Pool changes but state.json still has old hash, engine thinks pool unchanged

**Why it happens:** Regenerating pool.json without triggering state re-indexing

**How to avoid:** Phase 1's loadState already handles this — it detects hash mismatch and resets index. No additional logic needed.

**Warning signs:**
- Index out of bounds errors after pool change
- Rotation skips to wrong exercise
- State hash doesn't match pool hash

**Verification:** Phase 1's test suite already covers this in "pool change resets index" test. Extend test to cover config-driven pool changes.

### Pitfall 6: Race Conditions in Multi-File Configuration

**What goes wrong:** User edits configuration.json while engine is running, reads partial write

**Why it happens:** User doesn't use atomic editor writes (direct file overwrite mid-edit)

**How to avoid:** Document that config edits should use atomic editors (vim, nano, VS Code all use temp-file-rename). Engine loads config on startup only, not continuously.

**Warning signs:**
- Config loads with missing fields
- Validation fails unpredictably
- JSON.parse errors during engine startup

**Mitigation:** Engine's fail-safe validation catches partial writes and falls back to defaults. No additional code needed.

### Pitfall 7: File Permissions After Configuration Creation

**What goes wrong:** Configuration file created with wrong permissions, readable by other users

**Why it happens:** Forgot to set mode: 0o600 in writeFileAtomic options

**How to avoid:** Match Phase 1's pattern: mode: 0o600 for files, mode: 0o700 for directories

**Warning signs:**
- `ls -la ~/.config/viberipped/` shows group/other read permissions
- Security audit tools flag world-readable config

**Prevention code:**

```javascript
// Phase 1 pattern (from state.js):
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
writeFileAtomic.sync(path, JSON.stringify(data, null, 2), { mode: 0o600 });
```

## Code Examples

Verified patterns from Phase 1 and adapted for Phase 2:

### Loading Configuration with Fail-Safe Defaults

```javascript
// Source: Phase 1 lib/state.js pattern, adapted for configuration
const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  equipment: {
    kettlebell: false,
    dumbbells: false,
    pullUpBar: false,
    parallettes: false
  }
};

function loadConfig(configPath) {
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(content);

    if (!validateConfig(config)) {
      console.error('Config structure invalid, using defaults');
      return DEFAULT_CONFIG;
    }

    return config;

  } catch (e) {
    if (e.code === 'ENOENT') {
      console.error('No config file, using defaults');
    } else {
      console.error(`Config load error: ${e.message}, using defaults`);
    }
    return DEFAULT_CONFIG;
  }
}

function validateConfig(config) {
  if (!config || typeof config !== 'object') return false;
  if (!config.equipment || typeof config.equipment !== 'object') return false;

  const validKeys = ['kettlebell', 'dumbbells', 'pullUpBar', 'parallettes'];
  for (const key of validKeys) {
    if (key in config.equipment && typeof config.equipment[key] !== 'boolean') {
      return false;
    }
  }

  return true;
}
```

### Equipment-Based Pool Assembly

```javascript
// Source: New pattern for Phase 2
function assemblePool(equipmentConfig) {
  const availableEquipment = Object.keys(equipmentConfig)
    .filter(key => equipmentConfig[key] === true);

  const pool = FULL_EXERCISE_DATABASE.filter(exercise => {
    // Bodyweight exercises (equipment: []) are always included
    if (exercise.equipment.length === 0) return true;

    // Equipment exercises included only if ALL required equipment available
    return exercise.equipment.every(required =>
      availableEquipment.includes(required)
    );
  });

  // Fail-safe: if assembly produces empty pool, fall back to bodyweight defaults
  if (pool.length === 0) {
    console.error('Pool assembly failed, using bodyweight defaults');
    return DEFAULT_POOL; // Phase 1's hard-coded bodyweight exercises
  }

  return pool;
}
```

### Detecting Configuration Changes and Regenerating Pool

```javascript
// Source: Phase 1 pool hash pattern, extended for config-driven regeneration
const crypto = require('crypto');

function computePoolHash(pool) {
  const poolJson = JSON.stringify(pool);
  return crypto.createHash('sha256').update(poolJson, 'utf8').digest('hex');
}

function shouldRegeneratePool(configPath, poolPath) {
  try {
    // Load current config and assemble what pool SHOULD be
    const config = loadConfig(configPath);
    const assembledPool = assemblePool(config.equipment);
    const assembledHash = computePoolHash(assembledPool);

    // Load existing pool and check hash
    const existingPool = JSON.parse(fs.readFileSync(poolPath, 'utf8'));
    const existingHash = computePoolHash(existingPool);

    return assembledHash !== existingHash;

  } catch (e) {
    // Pool file missing or invalid — needs regeneration
    return true;
  }
}

function regeneratePoolIfNeeded(configPath, poolPath) {
  if (shouldRegeneratePool(configPath, poolPath)) {
    const config = loadConfig(configPath);
    const pool = assemblePool(config.equipment);

    console.error('Configuration changed, regenerating pool');

    const dir = path.dirname(poolPath);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileAtomic.sync(poolPath, JSON.stringify(pool, null, 2), { mode: 0o600 });
  }
}
```

### Manual Validation Without External Libraries

```javascript
// Source: Phase 1 validateState pattern, adapted for configuration
function validateConfig(config) {
  // Null/undefined check
  if (!config || typeof config !== 'object') {
    return false;
  }

  // Structure check
  if (!config.equipment || typeof config.equipment !== 'object') {
    return false;
  }

  // Field presence and type check
  const validKeys = ['kettlebell', 'dumbbells', 'pullUpBar', 'parallettes'];
  for (const key of validKeys) {
    if (key in config.equipment) {
      if (typeof config.equipment[key] !== 'boolean') {
        return false;
      }
    }
  }

  return true;
}

function validatePool(pool) {
  if (!Array.isArray(pool)) return false;
  if (pool.length === 0) return false;

  for (const exercise of pool) {
    // Object structure
    if (!exercise || typeof exercise !== 'object') return false;

    // Required fields
    if (typeof exercise.name !== 'string' || exercise.name.length === 0) return false;
    if (!Number.isInteger(exercise.reps) || exercise.reps <= 0) return false;

    // Equipment field (may be missing for backward compat)
    if ('equipment' in exercise && !Array.isArray(exercise.equipment)) return false;
  }

  return true;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global config packages (dotenv, config) | Zero-dependency manual validation | Phase 1 decision | Keeps project dependency-free, validates at load time |
| JSON with comments (JSON5/JSONC) | Pure JSON | 2024+ simplicity trend | Reduces parser complexity, works with native JSON.parse |
| Async configuration loading | Synchronous fs.readFileSync | Phase 1 pattern | Simpler error handling, acceptable for startup-time operations |
| Schema validation libraries (Ajv) | Manual typeof + structural checks | 2025+ zero-dep trend | Eliminates 50MB+ dependency tree for 10 lines of validation |
| Hot-reloading configuration | Load-once on startup | Phase 1 design | Engine runs briefly per trigger, reload unnecessary |

**Deprecated/outdated:**
- JSON5 for configuration: Adds parser dependency, breaks native JSON.parse compatibility
- Async configuration loading: Complicates error handling for no performance benefit (startup-time only)
- File watching (chokidar): Unnecessary overhead for trigger-based execution model

## Open Questions

### 1. Should pool.json preserve user manual edits?

**What we know:**
- ROTN-06 requires "human-editable JSON" but doesn't specify edit preservation
- Phase 2 success criteria: "User can manually add or remove exercises from pool files and system adapts rotation accordingly"

**What's unclear:**
- Does "adapts rotation" mean edits persist indefinitely, or just until next config change?
- Should manual edits merge with config-assembled pool, or replace it?

**Recommendation:**
- Phase 2 v1: Preserve manual edits UNTIL configuration.json changes
- Regeneration strategy: Only regenerate when assembled pool hash differs from pool.json hash
- User experience: Manual edits persist across engine runs, reset only when equipment config changes
- Documentation: Clearly state that config changes regenerate pool, discarding manual edits

### 2. How to handle exercises requiring multiple equipment items?

**What we know:**
- Some exercises could require multiple items (e.g., "Dumbbell swings" = dumbbells OR kettlebell)
- Filter logic uses `.every()` for AND logic (all required equipment must be available)

**What's unclear:**
- Should database support OR logic (alternative equipment)?
- Example: "Goblet squat" works with kettlebell OR single dumbbell

**Recommendation:**
- Phase 2 v1: Use AND logic only (exercise.equipment array = all items required)
- Alternative equipment: Add separate database entries (e.g., "Goblet squat (kettlebell)" and "Goblet squat (dumbbell)")
- Rationale: Simpler filtering logic, explicit exercise definitions, no ambiguity in equipment requirements
- Future: Phase 6+ could add equipment alternatives as array of arrays: `equipment: [["kettlebell"], ["dumbbells"]]`

### 3. Should configuration support custom exercise database paths?

**What we know:**
- Phase 2 requirements don't mention custom exercise databases
- Success criteria allows manual pool.json editing (implicit custom exercise support)

**What's unclear:**
- Should advanced users be able to replace FULL_EXERCISE_DATABASE with custom file?
- Would this add configuration complexity for marginal benefit?

**Recommendation:**
- Phase 2 v1: Hard-code FULL_EXERCISE_DATABASE in lib/pool.js
- Customization path: Users edit pool.json directly after initial generation
- Rationale: Simpler configuration schema, fewer failure modes, sufficient flexibility via pool.json editing
- Future: Phase 5 CLI could add `viberipped import-exercises <path>` command

## Sources

### Primary (HIGH confidence)

- Phase 1 codebase (lib/state.js, lib/pool.js, engine.js, test/engine.test.js) — Existing patterns for validation, persistence, and fail-safe defaults
- Node.js fs documentation (built-in) — Synchronous file operations, mkdirSync, readFileSync
- Node.js crypto documentation (built-in) — SHA256 hashing for change detection
- write-file-atomic documentation — Atomic write operations (Phase 1 dependency)

### Secondary (MEDIUM confidence)

- [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir/latest/) — Configuration file location standards
- [Best Practices for Bootstrapping a Node.js Application Configuration — Liran Tal](https://lirantal.com/blog/best-practices-for-bootstrapping-a-node-js-application-configuration) — Configuration validation patterns
- [Environment variables and configuration anti patterns in Node.js applications — Liran Tal](https://lirantal.com/blog/environment-variables-configuration-anti-patterns-node-js-applications) — Common configuration mistakes
- [How to Read JSON Files in Node.js](https://oneuptime.com/blog/post/2026-01-22-nodejs-read-json-files/view) — JSON parsing best practices 2026
- [write-file-atomic - npm](https://www.npmjs.com/package/write-file-atomic) — Atomic write documentation and edge cases
- [Mastering Node.js Configurations: Avoiding Common Mistakes](https://infinitejs.com/posts/mastering-nodejs-configs-avoiding-mistakes/) — Configuration pitfalls and solutions
- [Failing with Dignity: A Deep Dive into Graceful Degradation](https://www.codereliant.io/p/failing-with-dignity) — Fail-safe design principles

### Tertiary (LOW confidence, marked for validation)

- [chokidar - npm](https://www.npmjs.com/package/chokidar) — File watching library comparison (NOT recommended for Phase 2)
- [Ajv JSON schema validator](https://ajv.js.org/) — Schema validation alternative (NOT used, context only)
- [How to Add Comments in JSON: JSONC, JSON5](https://t-salad.com/en/how-to-add-comments-in-json-jsonc-json5-and-4-practical-workarounds/) — JSON format alternatives (NOT recommended for Phase 2)
- [Calisteniapp](https://calisteniapp.com/) — Exercise filtering examples (inspiration only, not technical source)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Phase 1 already uses all required tools (fs, crypto, write-file-atomic)
- Architecture: HIGH — Extends Phase 1 patterns (fail-safe validation, atomic writes, XDG paths)
- Pitfalls: HIGH — Verified against Phase 1 test suite and common configuration anti-patterns
- Equipment filtering: MEDIUM — Pattern is straightforward (array filter), but exercise database content needs design
- User edit preservation: MEDIUM — Requirements are clear, but implementation strategy has tradeoffs

**Research date:** 2026-02-08
**Valid until:** 2026-03-10 (30 days) — Stable domain, Node.js built-ins change slowly, Phase 1 patterns established
