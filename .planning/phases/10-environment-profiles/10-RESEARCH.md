# Phase 10: Environment Profiles - Research

**Researched:** 2026-02-10
**Domain:** Configuration management, array filtering, CLI parameter handling
**Confidence:** HIGH

## Summary

Phase 10 adds environment-based exercise filtering to VibeRipped, allowing users to mark exercises as appropriate for specific contexts (office, home, coworking) and filter the rotation pool based on their current location. The foundation already exists through Phase 8's schema extensions (`environment` field in config.json, `environments` array in pool exercises).

The implementation requires three core components: (1) CLI commands for setting/getting the active environment, (2) pool filtering logic that applies environment constraints during assembly, and (3) handling the "anywhere" wildcard that makes exercises available in all contexts. This follows the existing equipment-based filtering pattern from Phase 2, with the critical difference that environment filtering happens after equipment filtering but before rotation.

**Primary recommendation:** Extend `assemblePool()` to accept environment parameter and chain filter operations (equipment → environment). Model CLI on git-config style "config set/get key value" pattern, extending existing config command handler. Use defensive "anywhere" defaulting throughout to prevent empty pool scenarios.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js Array.filter() | Built-in | Environment filtering | Zero-dependency, immutable operation, O(n) acceptable for small pools |
| Commander.js | 12.1.0 | CLI subcommand handling | Already in use, proven for config commands |
| Atomic writes | Built-in (existing) | Config persistence | Crash safety pattern established in Phase 1 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Array.includes() | Built-in | Tag matching | Check if exercise's environments array contains active environment |
| Object spread | ES2018+ | Config merging | Preserve unmodified fields during partial updates |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Chained filter | Single complex filter | Separate filters more readable, easier to test, minimal perf cost |
| "config set env X" | "env set X" top-level | Follows existing "config" grouping pattern for settings |
| Multi-env support | Single env only | Multi-env adds complexity, YAGNI for v1.1 scope |

**Installation:**
No new dependencies. Uses existing Commander.js and Node.js built-ins.

## Architecture Patterns

### Recommended Project Structure
Current structure already supports this phase:
```
lib/
├── config.js           # Add environment validation
├── pool.js             # Extend assemblePool() with environment filter
├── cli/commands/
│   └── config.js       # Extend for set/get pattern
└── migration.js        # Already migrated environment field in Phase 8
```

### Pattern 1: Chained Pool Filtering
**What:** Equipment filter → Environment filter → Rotation pool
**When to use:** Multiple orthogonal filter dimensions (equipment AND environment)
**Example:**
```javascript
// lib/pool.js
function assemblePool(equipmentConfig, environment = 'anywhere') {
  // Step 1: Equipment filtering (existing)
  const availableEquipment = extractAvailableEquipment(equipmentConfig);
  const equipmentFiltered = FULL_EXERCISE_DATABASE.filter(exercise => {
    return exercise.equipment.length === 0 ||
           exercise.equipment.every(req => availableEquipment.includes(req));
  });

  // Step 2: Environment filtering (new)
  const envFiltered = equipmentFiltered.filter(exercise => {
    // "anywhere" exercises always included
    if (!exercise.environments || exercise.environments.includes('anywhere')) {
      return true;
    }
    // Environment-specific exercises only if matching
    return exercise.environments.includes(environment);
  });

  // Fail-safe: empty pool should never happen
  if (envFiltered.length === 0) {
    console.error('Environment filter resulted in empty pool, using equipment-only filter');
    return equipmentFiltered;
  }

  return envFiltered;
}
```

### Pattern 2: Git-Config Style CLI
**What:** `config set <key> <value>` and `config get <key>` subcommands
**When to use:** User-facing config manipulation that mirrors familiar tools
**Example:**
```javascript
// bin/vibripped.js
const configCmd = program.command('config');

configCmd
  .command('set <key> <value>')
  .description('Set configuration value')
  .action((key, value) => {
    const handler = require('../lib/cli/commands/config-set.js');
    handler(key, value);
  });

configCmd
  .command('get <key>')
  .description('Get configuration value')
  .action((key) => {
    const handler = require('../lib/cli/commands/config-get.js');
    handler(key);
  });
```

### Pattern 3: Defensive "Anywhere" Defaulting
**What:** Always fall back to "anywhere" for missing/invalid environment values
**When to use:** Preventing empty pool disasters from misconfiguration
**Example:**
```javascript
// lib/config.js - loadConfig normalization
const normalized = {
  equipment: { /* ... */ },
  difficulty: { /* ... */ },
  environment: config.environment || 'anywhere',  // Default
  schemaVersion: config.schemaVersion || '1.0'
};

// lib/pool.js - exercise normalization
const exercise = {
  name: raw.name,
  reps: raw.reps,
  environments: raw.environments || ['anywhere']  // Default
};
```

### Anti-Patterns to Avoid
- **Replacing equipment filtering:** Environment filtering augments, not replaces equipment logic
- **Mutating config directly:** Always use loadConfig → modify → saveConfig flow with atomic writes
- **Hard-coding environment names:** Let users define custom environments freely (user.environments could be ["home-office", "garage"])
- **OR logic for multi-environment:** Don't support "home OR office" – keep single active environment for clarity

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLI subcommand parsing | Custom argv parsing | Commander.js .command() | Already integrated, handles --help, validation, nested commands |
| Array filtering with conditions | for-loops with push | Array.filter() | Immutable, readable, O(n) acceptable for pools of <100 exercises |
| Config validation | Try-catch everywhere | validateConfig() pattern | Centralized validation already established in config.js |
| Atomic file writes | fs.writeFileSync directly | write-file-atomic | Crash safety already in use, prevents corruption |

**Key insight:** VibeRipped already has robust config infrastructure from Phases 1-2. This phase extends existing patterns rather than introducing new paradigms.

## Common Pitfalls

### Pitfall 1: Empty Pool After Environment Filtering
**What goes wrong:** User sets environment to "office", but no exercises are tagged with "office" → pool becomes empty → rotation breaks
**Why it happens:** Not all exercises have environment tags, or user hasn't tagged any exercises for their active environment
**How to avoid:**
- Default all exercises to `environments: ["anywhere"]` in migration (already done in Phase 8)
- Fall back to equipment-filtered pool if environment filtering produces empty result
- Include fail-safe logging: "No exercises match environment 'office', using all available"
**Warning signs:** Empty pool.json after environment change, rotation returning undefined

### Pitfall 2: Stale Pool After Config Change
**What goes wrong:** User runs `config set environment office`, but engine.js still uses old pool.json with all exercises
**Why it happens:** pool.json only regenerates when configPoolHash changes (equipment change), not when environment changes
**How to avoid:**
- DON'T hash environment into configPoolHash (it's a filter, not pool composition change)
- Pass environment to assemblePool() at runtime in engine.js trigger()
- Filter pool dynamically on each trigger, not during pool.json generation
**Warning signs:** Changing environment has no effect on prompted exercises

### Pitfall 3: "Anywhere" Tag Not Working as Wildcard
**What goes wrong:** Exercise tagged `["anywhere"]` only shows when environment is literally set to "anywhere", not in "office" mode
**Why it happens:** Using strict equality check instead of inclusive check
**How to avoid:**
```javascript
// WRONG: Exclusive check
return exercise.environments.includes(environment);

// RIGHT: Inclusive check for "anywhere" wildcard
return exercise.environments.includes('anywhere') ||
       exercise.environments.includes(environment);
```
**Warning signs:** Bodyweight exercises disappear when switching from "anywhere" to "office"

### Pitfall 4: Config Validation Not Updated
**What goes wrong:** User sets `environment: 123` (number instead of string), config validates successfully, breaks later
**Why it happens:** validateConfig() already checks for string type (added in Phase 8), but error handling might not be clear
**How to avoid:**
- Validate in CLI handler before saving: reject non-string values immediately
- Provide clear error message: "Environment must be a string (e.g., 'office', 'home')"
- Type-check in loadConfig() normalization layer
**Warning signs:** Cryptic errors on trigger, config file with numeric environment values

### Pitfall 5: Breaking Existing v1.0 Configs
**What goes wrong:** v1.0 configs without `environment` field fail to load after Phase 10 changes
**Why it happens:** Not respecting backward compatibility of optional field
**How to avoid:**
- Phase 8 migration already added `environment: "anywhere"` default
- loadConfig() normalizes missing field to "anywhere"
- assemblePool() defaults parameter to "anywhere"
- Never assume environment field exists on raw config objects
**Warning signs:** v1.0 users get empty exercise pools after upgrade

## Code Examples

Verified patterns from codebase and established practices:

### Environment-Aware Pool Assembly
```javascript
// lib/pool.js
// Source: Extending existing assemblePool pattern from Phase 2

/**
 * Assembles exercise pool based on equipment and environment.
 *
 * @param {Object} equipmentConfig - Equipment configuration
 * @param {string} environment - Active environment filter (default: "anywhere")
 * @returns {Array} Filtered exercise pool
 */
function assemblePool(equipmentConfig, environment = 'anywhere') {
  // Phase 1: Equipment filtering (existing logic)
  const availableEquipment = [];
  if (equipmentConfig && equipmentConfig.equipment) {
    for (const [key, value] of Object.entries(equipmentConfig.equipment)) {
      if (value === true) availableEquipment.push(key);
    }
  }

  const equipmentFiltered = FULL_EXERCISE_DATABASE.filter(exercise => {
    if (exercise.equipment.length === 0) return true;
    return exercise.equipment.every(req => availableEquipment.includes(req));
  });

  // Phase 2: Environment filtering (new)
  const envFiltered = equipmentFiltered.filter(exercise => {
    const exerciseEnvs = exercise.environments || ['anywhere'];
    // Include if tagged "anywhere" OR matches active environment
    return exerciseEnvs.includes('anywhere') || exerciseEnvs.includes(environment);
  });

  // Fail-safe: prevent empty pool
  if (envFiltered.length === 0) {
    console.error(
      `No exercises match environment '${environment}', using equipment-only filter`
    );
    return equipmentFiltered;
  }

  return envFiltered;
}
```

### Config Set/Get CLI Handler
```javascript
// lib/cli/commands/config-set.js
// Source: Adapted from existing config.js equipment pattern

const { loadConfig, saveConfig, getConfigPath, validateConfig } = require('../../config');
const { error, success } = require('../output');

function configSetHandler(key, value) {
  const configPath = getConfigPath();
  const currentConfig = loadConfig(configPath);

  // Handle environment setting
  if (key === 'environment') {
    if (typeof value !== 'string' || value.length === 0) {
      error('Environment must be a non-empty string (e.g., "office", "home")');
      process.exitCode = 1;
      return;
    }

    const newConfig = {
      ...currentConfig,
      environment: value
    };

    saveConfig(configPath, newConfig);
    success(`Environment set to: ${value}`);
    process.exitCode = 0;
    return;
  }

  // Handle other config keys (equipment, difficulty, etc.)
  error(`Unknown config key: ${key}`);
  process.exitCode = 1;
}

module.exports = configSetHandler;
```

### Runtime Environment Filtering in Engine
```javascript
// engine.js - trigger() function modification
// Source: Existing config-driven pool assembly pattern

function trigger(pool = null, options = {}) {
  const statePath = options.statePath || require('./lib/state').getStatePath();
  const configDir = path.dirname(statePath);
  const configPath = path.join(configDir, 'configuration.json');

  let actualPool;

  if (pool === null) {
    // Config-driven mode
    const config = loadConfig(configPath);
    const environment = config.environment || 'anywhere';  // Defensive default

    // Assemble pool with BOTH equipment and environment filtering
    actualPool = assemblePool(config, environment);

    // Note: Don't regenerate pool.json here - environment is runtime filter
  } else {
    // Legacy mode: explicit pool
    actualPool = pool;
  }

  // ... rest of trigger logic (rotation, cooldown, state) unchanged
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Equipment-only filtering | Equipment + Environment filtering | Phase 10 (v1.1) | Users can now context-filter exercises |
| pool.json regenerated on config change | pool.json stores full DB, filtering at runtime | Phase 10 (v1.1) | Faster environment switching, no rotation reset |
| Config command with --flags | Config set/get subcommands | Phase 10 (v1.1) | More scalable for multi-value config keys |
| Hardcoded "anywhere" default | User-definable custom environments | Phase 10 (v1.1) | Flexible for any location (e.g., "garage", "coworking") |

**Deprecated/outdated:**
- N/A - This is a new feature, no deprecated patterns

## Open Questions

1. **Should environment changes reset rotation index?**
   - What we know: Equipment changes reset rotation (different pool hash). Environment changes don't alter pool.json, just filter it.
   - What's unclear: If user has 10 exercises, filters to 5 for "office", should they continue from their current index (might be out of bounds) or reset to 0?
   - Recommendation: Reset currentIndex to 0 when effective pool size changes. Check if currentIndex >= filteredPool.length, reset if true. Prevents out-of-bounds errors without complex state tracking.

2. **How to display current environment in statusline?**
   - What we know: Statusline currently shows "Pushups x15 (3/10)". Users might want to know active environment.
   - What's unclear: Should environment be visible in statusline text, or only via CLI `config get environment`?
   - Recommendation: Start with CLI-only visibility. If user feedback requests it, add as Phase 14 enhancement (statusline improvements).

3. **Should "config set environment X" validate X against known environments?**
   - What we know: Users can define custom environments freely (no predefined enum).
   - What's unclear: Should CLI warn if setting environment to value not present in any exercise's environments array?
   - Recommendation: No validation – allow setting "office" even if no exercises tagged "office" yet. This supports workflow: set environment first, tag exercises later. Rely on empty-pool fail-safe to handle gracefully.

4. **Pool.json format with environment filtering**
   - What we know: pool.json currently stores assembled pool after equipment filtering (Phase 2 behavior).
   - What's unclear: Should pool.json now store FULL equipment-filtered pool, with environment filtering applied only in trigger()?
   - Recommendation: YES – Change pool.json generation to ignore environment (store equipment-filtered only). Apply environment filter in trigger() at runtime. This prevents pool.json regeneration on every environment change and aligns with "filter, not compose" semantics.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `/Users/jacob/Documents/apps/VibeRipped/lib/config.js` - Environment field validation pattern
- Existing codebase: `/Users/jacob/Documents/apps/VibeRipped/lib/pool.js` - Equipment filtering pattern (assemblePool)
- Existing codebase: `/Users/jacob/Documents/apps/VibeRipped/lib/migration.js` - Phase 8 environment field migration
- Existing codebase: `/Users/jacob/Documents/apps/VibeRipped/engine.js` - Config-driven pool assembly flow

### Secondary (MEDIUM confidence)
- [Array.prototype.filter() - MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter) - JavaScript filter method documentation
- [Commander.js Documentation](https://www.npmjs.com/package/commander) - CLI subcommand patterns
- [Backward Compatibility in Schema Evolution Guide](https://www.dataexpert.io/blog/backward-compatibility-schema-evolution-guide) - Optional field migration patterns
- [Git Config Documentation](https://git-scm.com/docs/git-config) - Set/get configuration pattern inspiration

### Tertiary (LOW confidence)
- [JavaScript Filter Best Practices](https://www.penligent.ai/hackinglabs/javascript-filter-explained-how-the-filter-method-works-and-best-practices) - General filtering guidance
- [Common Filter Mistakes](https://blog.logrocket.com/array-filter-method-javascript/) - Edge case awareness

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All patterns already in codebase, zero new dependencies
- Architecture: HIGH - Direct extension of Phase 2 equipment filtering with runtime application
- Pitfalls: HIGH - Identified from codebase patterns (pool regeneration, fail-safes, backward compat)
- CLI patterns: MEDIUM - Git-config style not yet in codebase, but Commander.js subcommands established

**Research date:** 2026-02-10
**Valid until:** ~2026-03-10 (30 days - stable domain, established patterns)
