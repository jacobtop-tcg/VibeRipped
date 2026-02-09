# Phase 8: Data Model Extensions - Research

**Researched:** 2026-02-09
**Domain:** JSON schema evolution, config migration, backward compatibility
**Confidence:** HIGH

## Summary

Phase 8 extends VibeRipped's data model (pool.json, configuration.json, state.json) to support category tagging, timed exercises, and environment filtering. These schema additions lay the foundation for Phases 9-11 (Timed Exercises, Environment Profiles, Category-Aware Rotation).

The core challenge is **schema migration with backward compatibility**: v1.0 users must upgrade to v1.1 seamlessly without manual intervention or data loss. The project's "zero external dependencies" philosophy (only Commander.js + write-file-atomic) constrains implementation options.

Research confirms the standard approach: **expand with optional fields + default values + automatic migration on first launch**. This aligns with VibeRipped's existing graceful-recovery patterns (config.js and state.js already handle missing/corrupt files).

**Primary recommendation:** Extend existing validation functions with additive-only schema changes, implement automatic migration logic in engine.js trigger flow, create backup before first migration, and maintain v1.0 fallback paths for corruption recovery.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `fs` | 18+ | File I/O for configs | Already used, zero deps |
| `write-file-atomic` | ^7.0.0 | Atomic writes | Already used, prevents corruption |
| Node.js built-in `crypto` | 18+ | Hash generation | Already used for poolHash |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | N/A | JSON schema validation | Hand-rolled validation faster for simple schemas |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled validation | [Ajv](https://ajv.js.org/) | Ajv is the fastest JSON validator for Node.js and supports JSON Schema drafts 04-2020-12. However, it adds 200KB+ dependency for simple 5-field schemas. Not worth it for VibeRipped's minimalist philosophy. |
| Hand-rolled validation | [jsonschema](https://www.npmjs.com/package/jsonschema) | Lighter than Ajv but still adds dependency. VibeRipped already validates configs in 30 LOC. |
| Hand-rolled migration | [config-migrate](https://www.npmjs.com/package/config-migrate) | Tracks migration history with migration-run-log.txt. Overkill for single v1.0→v1.1 migration. |

**Installation:**
No new dependencies required. Use existing Node.js built-ins.

## Architecture Patterns

### Recommended Schema Extension Structure
```
~/.config/viberipped/
├── configuration.json      # Add: environment, schemaVersion
├── pool.json              # Add: category, type, environments per exercise
├── state.json             # Add: recentCategories, schemaVersion
├── configuration.json.v1.0.backup  # Created on first v1.1 launch
├── pool.json.v1.0.backup
└── state.json.v1.0.backup
```

### Pattern 1: Additive-Only Schema Changes (Backward Compatibility)
**What:** Extend schemas with optional fields, never remove or rename existing fields
**When to use:** Schema evolution where old and new versions must coexist during transition
**Example:**
```javascript
// v1.0 exercise
{ name: "Pushups", reps: 15 }

// v1.1 exercise (backward compatible - v1.0 code can still read it)
{
  name: "Pushups",
  reps: 15,
  category: "push",        // NEW (optional)
  type: "reps",            // NEW (optional, default)
  environments: ["anywhere"] // NEW (optional)
}

// v1.1 timed exercise
{
  name: "Plank",
  reps: 30,                // KEEP for v1.0 compat (v1.0 shows "Plank x30")
  category: "core",
  type: "timed",           // NEW - signals duration interpretation
  environments: ["anywhere"]
}
```

### Pattern 2: Default Value Injection During Load
**What:** Fill in missing optional fields with sensible defaults during config/pool/state loading
**When to use:** Graceful handling of partial or legacy data structures
**Example:**
```javascript
// Existing pattern in lib/config.js:125-136 (normalize missing equipment)
const normalized = {
  equipment: {
    kettlebell: config.equipment.kettlebell || false,
    dumbbells: config.equipment.dumbbells || false,
    pullUpBar: config.equipment.pullUpBar || false,
    parallettes: config.equipment.parallettes || false
  },
  difficulty: {
    multiplier: config.difficulty?.multiplier ?? 1.0
  }
};

// Extend pattern for v1.1
const normalized = {
  equipment: { /* existing */ },
  difficulty: { /* existing */ },
  environment: config.environment || "anywhere",  // NEW default
  schemaVersion: config.schemaVersion || "1.0"    // NEW version tracking
};
```

### Pattern 3: Backup-Before-Migrate
**What:** Create timestamped backups of v1.0 configs before applying any schema changes
**When to use:** First-time v1.1 launch migration to enable rollback
**Example:**
```javascript
function migrateIfNeeded(configPath) {
  const config = loadConfig(configPath);

  // Check if already migrated
  if (config.schemaVersion === "1.1") {
    return config;
  }

  // First v1.1 launch - create backup
  const backupPath = `${configPath}.v1.0.backup`;
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(configPath, backupPath);
  }

  // Add new fields with defaults
  config.environment = config.environment || "anywhere";
  config.schemaVersion = "1.1";

  // Save migrated config
  saveConfig(configPath, config);
  return config;
}
```

### Pattern 4: Schema Validation with Optional Field Support
**What:** Validate that provided optional fields have correct types, but don't require them
**When to use:** Extending existing validateConfig/validateState functions
**Example:**
```javascript
// Current pattern in lib/config.js:56-89
function validateConfig(config) {
  // Required fields (strict)
  if (!config.equipment || typeof config.equipment !== 'object') {
    return false;
  }

  // Optional fields (validate type IF present)
  if (config.difficulty !== undefined) {
    if (typeof config.difficulty !== 'object' || config.difficulty === null) {
      return false;
    }
    if (config.difficulty.multiplier !== undefined &&
        typeof config.difficulty.multiplier !== 'number') {
      return false;
    }
  }

  // EXTEND for v1.1 optional fields
  if (config.environment !== undefined &&
      typeof config.environment !== 'string') {
    return false;
  }

  return true;
}
```

### Anti-Patterns to Avoid
- **Breaking Changes:** Never remove or rename existing fields (breaks v1.0 rollback)
- **Required New Fields:** Never make new fields required (breaks loading v1.0 configs)
- **Eager Migration:** Don't migrate files until user actually launches v1.1 (don't modify files on npm install)
- **Silent Data Loss:** Always create backups before schema changes
- **Complex Migration Versioning:** Don't build multi-version migration chains for single v1.0→v1.1 upgrade

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON schema validation for complex schemas | Custom validation logic | [Ajv](https://ajv.js.org/) | Ajv compiles JSON schemas into optimized JavaScript validation functions, handles edge cases (anyOf, oneOf, $ref), and supports all JSON Schema drafts. For 100+ field schemas, hand-rolled validation becomes error-prone. |
| Persistent migration history tracking | Custom migration log | [config-migrate](https://www.npmjs.com/package/config-migrate) | Tracks which migrations have run via migration-run-log.txt, prevents double-application, supports rollback. Valuable for 5+ migration versions. |
| Atomic file operations | Custom write-rename logic | [write-file-atomic](https://www.npmjs.com/package/write-file-atomic) | Already in use. Handles temp file creation, permissions, cross-platform rename atomicity. Edge cases: disk full, SIGKILL during write. |

**Key insight:** VibeRipped's schemas are simple (5-10 fields each). The complexity/benefit ratio of external validators doesn't justify adding dependencies. Hand-rolled validation is 30 LOC, fully transparent, and easier to debug. External validators become valuable at 50+ fields or when sharing schemas across microservices.

## Common Pitfalls

### Pitfall 1: Assuming Global Config Means No Scoping
**What goes wrong:** Implementing environment field without considering pool filtering might break if pool is empty after filter
**Why it happens:** Not thinking through edge cases where environment filter removes all exercises
**How to avoid:**
- Validate that filtered pool has at least 1 exercise before saving environment
- Default to "anywhere" if filtering would empty pool
- Test with single-exercise pools tagged to non-matching environments
**Warning signs:** User sets environment but sees no exercises, rotation crashes with "pool empty"

### Pitfall 2: Migration Runs on Every Launch
**What goes wrong:** Creating backup files repeatedly, polluting config directory with configuration.json.v1.0.backup.1, .2, .3...
**Why it happens:** Not checking schemaVersion before running migration logic
**How to avoid:**
- Check config.schemaVersion === "1.1" as first step in migration function
- Only create backup if it doesn't already exist (fs.existsSync check)
- Use boolean flag in state to mark "migration completed" for idempotency
**Warning signs:** Multiple backup files, slow startup times, migration logs on every run

### Pitfall 3: Type Confusion Between "reps" and "timed"
**What goes wrong:** Timed exercises displayed as "Plank x30" instead of "Plank 30s" because type field missing
**Why it happens:** Forgetting to add type field when creating timed exercises, or validation doesn't enforce it
**How to avoid:**
- Default type to "reps" if missing (backward compat with v1.0)
- Validate that type is one of ["reps", "timed"] if provided
- CLI validation prompts user to specify type when adding exercises
**Warning signs:** All exercises show "x" notation, duration scaling doesn't apply

### Pitfall 4: Category Tracking Array Grows Unbounded
**What goes wrong:** state.recentCategories array grows to thousands of entries, slowing JSON parse/stringify
**Why it happens:** Appending to array on every rotation without bounding size
**How to avoid:**
- Implement ring buffer pattern: recentCategories.push(cat); if (arr.length > 10) arr.shift()
- Document max size in comments (recommendation: 2-5 entries for duplicate prevention)
- Alternative: Use fixed-size array with index pointer (more complex but O(1))
**Warning signs:** state.json file size grows continuously, parsing slows after days of use

### Pitfall 5: Backup Files Not Excluded from npm Package
**What goes wrong:** Publishing *.backup files to npm registry, bloating package size
**Why it happens:** Forgetting to update .gitignore and package.json "files" whitelist
**How to avoid:**
- Add `*.backup` to .gitignore
- Keep package.json "files" array as strict whitelist (already done)
- Test with `npm pack --dry-run` to verify package contents
**Warning signs:** Large package size, backup files visible in npmjs.com package explorer

## Code Examples

Verified patterns from existing codebase and best practices:

### Example 1: Extending validateConfig for Optional Fields
```javascript
// File: lib/config.js
// Pattern: Validate optional fields only if present

function validateConfig(config) {
  // Required fields (v1.0 contract)
  if (!config || typeof config !== 'object') return false;
  if (!config.equipment || typeof config.equipment !== 'object') return false;

  // Check equipment values are booleans
  const validKeys = Object.values(EQUIPMENT_KEYS);
  for (const key of validKeys) {
    const value = config.equipment[key];
    if (value !== undefined && typeof value !== 'boolean') {
      return false;
    }
  }

  // Optional: difficulty (v1.0)
  if (config.difficulty !== undefined) {
    if (typeof config.difficulty !== 'object' || config.difficulty === null) {
      return false;
    }
    if (config.difficulty.multiplier !== undefined &&
        typeof config.difficulty.multiplier !== 'number') {
      return false;
    }
  }

  // NEW: Optional environment field (v1.1)
  if (config.environment !== undefined) {
    if (typeof config.environment !== 'string') {
      return false;
    }
    // Validate against known environments or allow custom
    // Could enforce enum: ["home", "office", "coworking", "anywhere"]
    // Or allow any string for custom environments
  }

  // NEW: Optional schemaVersion field (v1.1)
  if (config.schemaVersion !== undefined) {
    if (typeof config.schemaVersion !== 'string') {
      return false;
    }
  }

  return true;
}
```

### Example 2: Exercise Schema with Optional Category/Type/Environments
```javascript
// File: lib/pool.js
// Pattern: Validate exercise objects with optional v1.1 fields

function validateExercise(exercise) {
  // Required fields (v1.0 contract)
  if (!exercise || typeof exercise !== 'object') return false;
  if (typeof exercise.name !== 'string' || exercise.name.length === 0) {
    return false;
  }
  if (typeof exercise.reps !== 'number' || exercise.reps < 1) {
    return false;
  }

  // Optional: equipment (v1.0 - for FULL_EXERCISE_DATABASE)
  if (exercise.equipment !== undefined) {
    if (!Array.isArray(exercise.equipment)) {
      return false;
    }
  }

  // NEW: Optional category field (v1.1)
  if (exercise.category !== undefined) {
    const validCategories = ["push", "pull", "legs", "core"];
    if (!validCategories.includes(exercise.category)) {
      return false;
    }
  }

  // NEW: Optional type field (v1.1)
  if (exercise.type !== undefined) {
    const validTypes = ["reps", "timed"];
    if (!validTypes.includes(exercise.type)) {
      return false;
    }
  }

  // NEW: Optional environments field (v1.1)
  if (exercise.environments !== undefined) {
    if (!Array.isArray(exercise.environments)) {
      return false;
    }
    // Could validate each environment string, or allow any
    for (const env of exercise.environments) {
      if (typeof env !== 'string' || env.length === 0) {
        return false;
      }
    }
  }

  return true;
}
```

### Example 3: State Migration with Backup
```javascript
// File: engine.js or new lib/migration.js
// Pattern: Idempotent migration with backup creation

function migrateStateIfNeeded(statePath, state) {
  // Already migrated - skip
  if (state.schemaVersion === "1.1") {
    return state;
  }

  // First v1.1 launch - create backup
  const backupPath = `${statePath}.v1.0.backup`;
  if (!fs.existsSync(backupPath)) {
    try {
      fs.copyFileSync(statePath, backupPath);
      console.error('Created state backup at', backupPath);
    } catch (e) {
      console.error('Backup creation failed:', e.message);
      // Continue with migration anyway - better than failing completely
    }
  }

  // Add new v1.1 fields with defaults
  const migratedState = {
    ...state,
    recentCategories: state.recentCategories || [],
    schemaVersion: "1.1"
  };

  return migratedState;
}

// Usage in engine.js trigger():
const state = loadState(pool);
const migratedState = migrateStateIfNeeded(statePath, state);
```

### Example 4: Default Value Injection During Load
```javascript
// File: lib/config.js
// Pattern: Normalize config with v1.1 defaults

function loadConfig(configPath) {
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    let config;
    try {
      config = JSON.parse(content);
    } catch (e) {
      console.error(`Config parse error: ${e.message}, using defaults`);
      return DEFAULT_CONFIG;
    }

    if (!validateConfig(config)) {
      console.error('Config invalid, using defaults');
      return DEFAULT_CONFIG;
    }

    // Normalize with v1.0 and v1.1 defaults
    const normalized = {
      equipment: {
        kettlebell: config.equipment.kettlebell || false,
        dumbbells: config.equipment.dumbbells || false,
        pullUpBar: config.equipment.pullUpBar || false,
        parallettes: config.equipment.parallettes || false
      },
      difficulty: {
        multiplier: config.difficulty?.multiplier ?? 1.0
      },
      // NEW: v1.1 defaults
      environment: config.environment || "anywhere",
      schemaVersion: config.schemaVersion || "1.0"
    };

    return normalized;

  } catch (e) {
    // File not found or read error
    console.error('Config load error, using defaults');
    return DEFAULT_CONFIG;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSON Schema validators required external libs | Hand-rolled validation for simple schemas | 2023+ | Simple configs (5-10 fields) use lightweight validation. Complex configs (50+ fields) still use Ajv/jsonschema. |
| Migration tools required for all schema changes | Additive-only changes + default values = no migration tool | 2024+ | Single-version migrations use built-in logic. Multi-version migrations (5+ versions) still benefit from config-migrate. |
| Eager migration on install | Lazy migration on first launch | 2024+ | Avoids modifying user files during npm install. Migration only runs when user actually uses new version. |
| Breaking schema changes | Backward-compatible extensions only | 2024+ | New versions can read old data, old versions can read new data (ignore unknown fields). Enables gradual rollout. |

**Deprecated/outdated:**
- **Global migration runners:** Tools like `db-migrate`, `migrate` are overkill for config file changes. Originally designed for SQL schema migrations with up/down transactions. Config files don't need transactional rollback - backups are sufficient.
- **JSON Schema $ref resolution:** Complex inter-schema references add dependency on schema registries. Flat schemas with inline validation are simpler for small projects.

## Open Questions

1. **Should pool filtering by environment happen at load time or rotation time?**
   - What we know: Load-time filtering is faster (filter once vs every rotation), but rotation-time filtering allows dynamic environment changes without pool reload
   - What's unclear: Performance impact for typical 10-30 exercise pools (likely negligible)
   - Recommendation: Start with load-time filtering in assemblePool() for consistency with equipment filtering pattern. If Phase 10 requires dynamic environment switching, refactor to rotation-time.

2. **What happens if user manually edits v1.0 backup to add v1.1 fields?**
   - What we know: Backup files are meant to be read-only restore points
   - What's unclear: Should backup restoration validate schemaVersion and block v1.1→v1.0 downgrade?
   - Recommendation: Backups are for emergency recovery only. Don't build restoration tooling in Phase 8. Document "backups are not for manual editing" in comments.

3. **Should schemaVersion be in all three files or just configuration.json?**
   - What we know: State and pool are derived from config, so config is source of truth
   - What's unclear: If state has recentCategories but config.schemaVersion="1.0", is that inconsistent?
   - Recommendation: Add schemaVersion to all three files for independent validation. Each file can be corrupted/restored independently.

4. **How to handle user-added exercises without category/type/environments?**
   - What we know: CLI `vibripped pool add "Burpees 15"` currently creates minimal exercise objects
   - What's unclear: Should CLI prompt for category/type/environments, or default gracefully?
   - Recommendation: Phase 8 just extends schema. Phase 9-11 update CLI to prompt for new fields. Default type="reps", category=null, environments=["anywhere"] for backward compat.

## Sources

### Primary (HIGH confidence)
- **VibeRipped codebase**: lib/config.js, lib/pool.js, lib/state.js, engine.js - existing validation and normalization patterns
- [Ajv JSON schema validator](https://ajv.js.org/) - fastest JSON validator for Node.js, supports drafts 04-2020-12
- [JSON Schema official docs](https://json-schema.org/blog/posts/get-started-with-json-schema-in-node-js) - getting started with JSON Schema in Node.js

### Secondary (MEDIUM confidence)
- [Schema evolution best practices](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html) - backward compatibility patterns from Confluent
- [Backward compatible database changes](https://planetscale.com/blog/backward-compatible-databases-changes) - expand/migrate/contract pattern
- [config-migrate npm package](https://www.npmjs.com/package/config-migrate) - tracks migration history for JSON configs
- [free-exercise-db](https://github.com/yuhonas/free-exercise-db) - open exercise dataset with category/equipment/muscle fields

### Tertiary (LOW confidence)
- [Comparing Schema Validation Libraries](https://www.bitovi.com/blog/comparing-schema-validation-libraries-ajv-joi-yup-and-zod) - 2024 comparison of Ajv/Joi/Yup/Zod (date unclear, may be pre-2026)
- [Fitness app data model](https://www.dittofi.com/learn/how-to-design-a-data-model-for-a-workout-tracking-app) - general patterns (not Node.js specific)

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** - VibeRipped already uses Node.js built-ins + write-file-atomic. No new dependencies needed. Hand-rolled validation is proven pattern in existing codebase.
- Architecture: **HIGH** - Additive-only schema changes with optional fields is industry standard (Confluent, PlanetScale). Backup-before-migrate is proven safe pattern. Existing config.js/state.js provide clear extension points.
- Pitfalls: **MEDIUM** - Common pitfalls derived from general schema migration experience and VibeRipped's specific constraints. Unbounded array growth and migration idempotency are well-known issues. Type confusion and empty-pool-after-filter are Phase 8-specific risks requiring testing.

**Research date:** 2026-02-09
**Valid until:** ~60 days (JSON schema standards are stable, VibeRipped architecture is locked for v1.1)
