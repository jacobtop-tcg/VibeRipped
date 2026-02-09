# Architecture Integration Research: v1.1 Features

**Project:** VibeRipped v1.1
**Domain:** Exercise rotation CLI integration patterns
**Researched:** 2026-02-09
**Confidence:** HIGH

## Executive Summary

v1.1 adds distribution, interactive UX, exercise intelligence, and detection improvements to existing v1.0 architecture. Analysis reveals most features integrate cleanly via new modules in existing directories, with minimal modification to core engine. Category-aware rotation requires data model extension and rotation algorithm change. Timed exercises need type discrimination in pool. Detection improvement replaces heuristic logic in existing module. Interactive prompts add dependency (@inquirer/prompts) but remain isolated in CLI layer. Environment profiles extend config schema but follow established config pattern.

**Key integration points:**
- npm packaging: package.json metadata, no code changes
- Interactive UX: new CLI command handlers using @inquirer/prompts
- Category rotation: extends pool data model + replaces lib/rotation.js logic
- Timed exercises: extends pool schema + engine display logic
- Environment profiles: extends config schema + pool assembly filtering
- Detection improvement: replaces lib/statusline/detection.js heuristic

**Architecture impact:** LOW. Existing layering preserved. No breaking changes to module contracts.

## Current v1.0 Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Entry Points                             │
├─────────────────────────────────────────────────────────────┤
│  statusline.js         bin/vibripped.js                      │
│  (Claude Code)         (CLI commands)                        │
└────────┬───────────────────────┬──────────────────────────────┘
         │                       │
         ↓                       ↓
┌─────────────────────┐  ┌──────────────────────────────────┐
│   engine.js         │  │  lib/cli/commands/*.js           │
│   (rotation core)   │  │  (config, pool, test, harder)    │
└──────────┬──────────┘  └────────────┬─────────────────────┘
           │                          │
           ↓                          ↓
┌─────────────────────────────────────────────────────────────┐
│                      Core Libraries                          │
├─────────────────────────────────────────────────────────────┤
│  lib/rotation.js    lib/cooldown.js    lib/difficulty.js    │
│  lib/pool.js        lib/config.js      lib/state.js         │
│  lib/statusline/    lib/cli/                                 │
│    stdin.js           output.js                              │
│    detection.js       validation.js                          │
│    format.js                                                 │
└─────────────────────────────────────────────────────────────┘
           │
           ↓
┌─────────────────────────────────────────────────────────────┐
│                   State Persistence                          │
├─────────────────────────────────────────────────────────────┤
│  ~/.config/viberipped/                                       │
│    state.json         (rotation index, cooldown timestamp)   │
│    configuration.json (equipment flags, difficulty)          │
│    pool.json         (user-editable exercise list)           │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow (Current)

```
Statusline Trigger Flow:
  Claude Code statusline poll
    → statusline.js reads stdin JSON
    → lib/statusline/detection.js checks if processing
    → engine.js trigger(null, {latencyMs})
      → lib/config.js loads configuration.json
      → lib/pool.js assembles pool from config
      → lib/state.js loads state.json
      → lib/cooldown.js checks cooldown
      → lib/rotation.js getNextExercise (sequential)
      → lib/difficulty.js scales reps (latency + multiplier)
      → lib/state.js saves state.json
    → lib/statusline/format.js ANSI format
    → stdout write

CLI Command Flow:
  vibripped config --kettlebell
    → bin/vibripped.js (Commander routing)
    → lib/cli/commands/config.js
      → lib/config.js saveConfig
      → lib/pool.js assemblePool
      → writes pool.json + updates state.json
    → lib/cli/output.js success message
```

### Module Responsibilities

| Module | Responsibility | Pure/Stateful |
|--------|----------------|---------------|
| engine.js | Orchestrates rotation, cooldown, state, output | Stateful (reads/writes files) |
| lib/rotation.js | Sequential index advancement with modulo wrap | Pure (mutates state param) |
| lib/cooldown.js | Timestamp comparison, remaining time formatting | Pure |
| lib/difficulty.js | Rep scaling (latency factor × user multiplier) | Pure |
| lib/pool.js | Exercise database, equipment filtering, hashing | Pure |
| lib/config.js | Load/save equipment flags and difficulty | Stateful (reads/writes files) |
| lib/state.js | Load/save rotation state with corruption recovery | Stateful (reads/writes files) |
| lib/statusline/detection.js | Claude Code processing detection heuristic | Pure |
| lib/statusline/format.js | ANSI color formatting for statusline | Pure |
| lib/statusline/stdin.js | JSON parsing with safe error handling | Pure |
| lib/cli/commands/*.js | CLI command handlers (config, pool, test, harder, softer) | Stateful (orchestrates) |
| lib/cli/output.js | Colored CLI output helpers (success, error, info) | Pure |
| lib/cli/validation.js | Input validation for CLI commands | Pure |

## v1.1 Feature Integration Analysis

### 1. npm Packaging & Distribution

**Integration Type:** Metadata only — zero code changes

**What changes:**
- package.json: Add `repository`, `author`, `homepage`, `bugs` fields
- Add README.md in project root
- Add .gitignore (already exists, may need extension)
- Add .npmignore if needed (exclude .planning/, test/)

**What stays the same:**
- All source code unchanged
- `bin` field already configured correctly (`"vibripped": "./bin/vibripped.js"`)
- Shebang already present in bin/vibripped.js (`#!/usr/bin/env node`)

**New files:**
```
├── README.md          (usage docs, install instructions, GIF demo)
├── .gitignore        (node_modules, .planning, test coverage)
├── .npmignore        (optional: exclude .planning, test)
```

**Install flow (after publish):**
```bash
npm install -g viberipped
# npm creates symlink: /usr/local/bin/vibripped -> ~/.npm/lib/node_modules/viberipped/bin/vibripped.js
vibripped config --kettlebell
```

**Confidence:** HIGH (standard npm workflow, zero custom build required)

**Sources:**
- [package.json bin field documentation](https://docs.npmjs.com/cli/v8/configuring-npm/package-json/)
- [Installing and running Node.js bin scripts](https://2ality.com/2022/08/installing-nodejs-bin-scripts.html)

---

### 2. Interactive Terminal Prompts

**Integration Type:** New CLI commands, new dependency

**Dependency:** `@inquirer/prompts` (modern Inquirer v9+ rewrite, smaller footprint than legacy inquirer)

**What changes:**
- package.json: Add `"@inquirer/prompts": "^8.0.0"` to dependencies
- New file: `lib/cli/commands/setup.js` (interactive wizard for first-time equipment selection)
- Modify: `bin/vibripped.js` to register `setup` command
- Optional: Extend `lib/cli/commands/pool.js` for interactive checklist add/remove

**Data flow (new):**
```
vibripped setup
  → bin/vibripped.js routes to lib/cli/commands/setup.js
  → @inquirer/prompts checkbox prompt (equipment selection)
  → user selects via arrow keys + spacebar
  → lib/config.js saveConfig (same as non-interactive config)
  → lib/pool.js assemblePool + write pool.json
  → lib/cli/output.js success message
```

**Implementation pattern:**
```javascript
// lib/cli/commands/setup.js
const { checkbox, confirm } = require('@inquirer/prompts');
const { saveConfig } = require('../../config');
const { assemblePool } = require('../../pool');

async function setupHandler() {
  const equipment = await checkbox({
    message: 'Select available equipment',
    choices: [
      { name: 'Kettlebell', value: 'kettlebell' },
      { name: 'Dumbbells', value: 'dumbbells' },
      { name: 'Pull-up bar', value: 'pullUpBar' },
      { name: 'Parallettes', value: 'parallettes' }
    ]
  });

  // Convert array to config object
  const config = {
    equipment: {
      kettlebell: equipment.includes('kettlebell'),
      dumbbells: equipment.includes('dumbbells'),
      pullUpBar: equipment.includes('pullUpBar'),
      parallettes: equipment.includes('parallettes')
    },
    difficulty: { multiplier: 1.0 }
  };

  // Reuse existing config + pool logic
  saveConfig(getConfigPath(), config);
  const pool = assemblePool(config);
  // ... write pool.json (same as config command)
}
```

**Why @inquirer/prompts over legacy inquirer:**
- Smaller bundle size (ESM-first, tree-shakeable)
- Simpler API (direct imports: `import { checkbox } from '@inquirer/prompts'`)
- Better TypeScript support (not relevant for VibeRipped but future-proof)
- Active development (legacy inquirer in maintenance mode)

**Isolation:** Interactive logic stays in CLI layer. Engine and core libraries unchanged.

**Confidence:** HIGH (@inquirer/prompts is standard for Node CLI interactivity, well-documented)

**Sources:**
- [@inquirer/prompts npm package](https://www.npmjs.com/package/@inquirer/prompts)
- [Inquirer.js GitHub](https://github.com/SBoudrias/Inquirer.js)
- [DigitalOcean tutorial on interactive prompts](https://www.digitalocean.com/community/tutorials/nodejs-interactive-command-line-prompts)

---

### 3. Category-Aware Rotation

**Integration Type:** Data model extension + rotation algorithm replacement

**Problem:** Current rotation is purely sequential (index % pool.length). No awareness of muscle groups. Consecutive exercises can stack same muscle group (e.g., Pushups → Desk pushups → Parallette pushups).

**Solution:** Tag exercises with categories, modify rotation to skip recently-used categories.

**What changes:**
- Extend pool schema: Add `category` field to each exercise
- Replace `lib/rotation.js` logic: Track recent category history, filter candidates
- Extend state schema: Add `recentCategories: []` queue (size 3-5)
- Modify `lib/pool.js`: Add category tags to FULL_EXERCISE_DATABASE

**Data model extension:**
```javascript
// lib/pool.js - Extended exercise schema
const FULL_EXERCISE_DATABASE = [
  {
    name: "Pushups",
    reps: 15,
    equipment: [],
    category: "push"  // NEW FIELD
  },
  {
    name: "Bodyweight squats",
    reps: 20,
    equipment: [],
    category: "legs"
  },
  {
    name: "Pull-ups",
    reps: 8,
    equipment: [EQUIPMENT_KEYS.PULL_UP_BAR],
    category: "pull"
  },
  // ...
];

// Proposed categories (based on muscle group research):
// - "push"   (pushups, dips, overhead press, parallette pushups)
// - "pull"   (pull-ups, chin-ups, rows)
// - "legs"   (squats, lunges, calf raises, deadlifts)
// - "core"   (plank, L-sit, hanging knee raises, glute bridges)
// - "cardio" (high knees, kettlebell swings)
```

**State extension:**
```javascript
// state.json - Add recent category queue
{
  "currentIndex": 5,
  "lastTriggerTime": 1707519283000,
  "poolHash": "abc123...",
  "totalTriggered": 42,
  "configPoolHash": "def456...",
  "recentCategories": ["push", "legs", "core"]  // NEW FIELD (queue)
}
```

**Rotation algorithm replacement:**
```javascript
// lib/rotation.js - NEW LOGIC
function getNextExercise(state, pool) {
  // Initialize recent categories if missing (backward compat)
  if (!state.recentCategories) {
    state.recentCategories = [];
  }

  const CATEGORY_HISTORY_SIZE = 3; // Avoid repeating within last 3

  // Filter pool to exclude recent categories
  const candidates = pool.filter(ex =>
    !state.recentCategories.includes(ex.category)
  );

  // Fallback: If all categories recently used, allow repeats (pool exhausted)
  const availablePool = candidates.length > 0 ? candidates : pool;

  // Pick next exercise from available pool (sequential within available)
  // Find first match starting from currentIndex in original pool order
  let selectedExercise = null;
  let selectedIndex = -1;

  for (let i = 0; i < pool.length; i++) {
    const checkIndex = (state.currentIndex + i) % pool.length;
    const exercise = pool[checkIndex];

    if (availablePool.includes(exercise)) {
      selectedExercise = exercise;
      selectedIndex = checkIndex;
      break;
    }
  }

  // Update recent categories queue
  state.recentCategories.push(selectedExercise.category);
  if (state.recentCategories.length > CATEGORY_HISTORY_SIZE) {
    state.recentCategories.shift(); // Remove oldest
  }

  // Advance index for next time
  state.currentIndex = (selectedIndex + 1) % pool.length;

  return {
    exercise: selectedExercise,
    previousIndex: selectedIndex
  };
}
```

**Backward compatibility:**
- Old pool.json files (missing `category` field): Treat as `category: "unknown"`, no filtering applied
- Old state.json files (missing `recentCategories`): Initialize to empty array

**Why this approach:**
- Preserves determinism: Same state + pool = same exercise
- Minimal state growth: Queue size bounded (3-5 items)
- Graceful degradation: If all categories exhausted, falls back to sequential
- No random selection: Predictable behavior

**Confidence:** HIGH (standard rotation pattern with exclusion filtering, well-understood algorithm)

**Sources:**
- [Muscle group rotation importance](https://lipsticklifters.com/articles/the-importance-of-muscle-group-rotation/)
- [Why lifters rotate muscle groups](https://fitmixonline.com/why_lifters_rotate_muscle_groups)
- [Should you alternate muscle groups during workout](https://gym-mikolo.com/blogs/home-gym/should-you-alternate-muscle-groups-during-your-workout)

---

### 4. Timed Exercises Support

**Integration Type:** Data model extension + display logic change

**Problem:** Current schema treats all exercises as rep-based. Isometric holds (plank, wall sit) abuse "reps" field to mean seconds. No type safety or clear intent.

**Solution:** Add `type` field to distinguish `"reps"` vs `"timed"` exercises. Engine formats differently based on type.

**What changes:**
- Extend pool schema: Add `type: "reps" | "timed"` field
- Modify `engine.js` formatPrompt: Check exercise type, format accordingly
- Modify `lib/statusline/format.js`: Support `formatExercise(name, value, {type})` parameter
- Update `lib/pool.js`: Add type tags to FULL_EXERCISE_DATABASE

**Data model extension:**
```javascript
// lib/pool.js - Extended exercise schema
const FULL_EXERCISE_DATABASE = [
  {
    name: "Pushups",
    reps: 15,
    equipment: [],
    category: "push",
    type: "reps"  // NEW FIELD
  },
  {
    name: "Plank",
    reps: 30,     // Now clearly means "30 seconds"
    equipment: [],
    category: "core",
    type: "timed" // NEW FIELD
  },
  {
    name: "Wall sit",
    reps: 30,
    equipment: [],
    category: "legs",
    type: "timed"
  },
  // ...
];
```

**Display logic changes:**
```javascript
// engine.js - formatPrompt (MODIFIED)
function formatPrompt(exercise) {
  if (exercise.type === 'timed') {
    return `${exercise.name} ${exercise.reps}s`;  // "Plank 30s"
  } else {
    return `${exercise.name} x${exercise.reps}`;  // "Pushups x15"
  }
}

// lib/statusline/format.js - formatExercise (EXTENDED)
function formatExercise(name, value, options = {}) {
  const prefix = options.prefix || '';
  const type = options.type || 'reps';

  const suffix = type === 'timed' ? `${value}s` : `x${value}`;
  const formatted = `${name} ${suffix}`;

  // ANSI color codes...
  return `${prefix}${CYAN}${formatted}${RESET}`;
}
```

**Difficulty scaling consideration:**
- Timed exercises scale differently than rep-based
- Scaling 30s plank → 45s plank (1.5x latency) is reasonable
- But 30s wall sit → 60s wall sit (2.5x difficulty multiplier) may be excessive
- **Recommendation:** Apply latency scaling but cap timed exercise multiplier at 1.5x max

**Backward compatibility:**
- Old pool.json (missing `type`): Default to `"reps"` (current behavior)
- Exercises with `type: "timed"` format as `"Plank 30s"` instead of `"Plank x30"`

**Confidence:** MEDIUM (straightforward data model change, but need to decide timed exercise scaling bounds)

**Sources:**
- [Isometric holds vs full reps muscle growth](https://www.menshealth.com/uk/building-muscle/train-smarter/a66034671/isometric-vs-full-reps-muscle-growth-study/)
- [Isometric training models](https://www.sportsmith.co/articles/programming-isometrics-in-different-training-models/)

---

### 5. Environment Profiles

**Integration Type:** Config schema extension + pool assembly filtering

**Problem:** Some exercises inappropriate for certain environments (e.g., kettlebell swings in coworking space, pull-ups in coffee shop).

**Solution:** Add `environment` field to config, tag exercises with allowed environments, filter pool during assembly.

**What changes:**
- Extend config schema: Add `environment: "home" | "office" | "coworking" | "anywhere"`
- Extend exercise schema: Add `environments: []` array (empty = allowed anywhere)
- Modify `lib/pool.js assemblePool`: Filter by equipment AND environment
- Modify `lib/cli/commands/config.js`: Support `--environment <value>` flag
- Modify `lib/cli/commands/setup.js`: Add environment prompt

**Config schema extension:**
```javascript
// configuration.json - Extended schema
{
  "equipment": {
    "kettlebell": true,
    "dumbbells": false,
    "pullUpBar": true,
    "parallettes": false
  },
  "difficulty": {
    "multiplier": 1.0
  },
  "environment": "home"  // NEW FIELD (default: "home")
}
```

**Exercise schema extension:**
```javascript
// lib/pool.js - Extended exercise schema
const FULL_EXERCISE_DATABASE = [
  {
    name: "Pushups",
    reps: 15,
    equipment: [],
    category: "push",
    type: "reps",
    environments: []  // Empty = allowed anywhere
  },
  {
    name: "Kettlebell swings",
    reps: 15,
    equipment: [EQUIPMENT_KEYS.KETTLEBELL],
    category: "cardio",
    type: "reps",
    environments: ["home"]  // Only home office
  },
  {
    name: "Desk pushups",
    reps: 15,
    equipment: [],
    category: "push",
    type: "reps",
    environments: ["office", "coworking"]  // Quiet environments only
  },
  // ...
];
```

**Pool assembly filtering (modified):**
```javascript
// lib/pool.js - assemblePool (EXTENDED)
function assemblePool(config) {
  const availableEquipment = Object.entries(config.equipment)
    .filter(([key, enabled]) => enabled)
    .map(([key]) => key);

  const currentEnvironment = config.environment || "home";

  const pool = FULL_EXERCISE_DATABASE.filter(exercise => {
    // Equipment filter (existing logic)
    const hasEquipment = exercise.equipment.length === 0 ||
      exercise.equipment.every(eq => availableEquipment.includes(eq));

    // Environment filter (NEW)
    const allowedInEnvironment = exercise.environments.length === 0 ||
      exercise.environments.includes(currentEnvironment);

    return hasEquipment && allowedInEnvironment;
  });

  // Fail-safe (existing logic)
  if (pool.length === 0) {
    console.error('Pool assembly resulted in empty pool, falling back to DEFAULT_POOL');
    return DEFAULT_POOL;
  }

  return pool;
}
```

**CLI integration:**
```javascript
// bin/vibripped.js - Add environment option to config command
program
  .command('config')
  .option('--environment <env>', 'Set environment (home, office, coworking, anywhere)')
  .option('--kettlebell')
  // ... existing options
```

**Environment definitions:**
- `"home"`: Home office — all exercises allowed (default)
- `"office"`: Workplace office — exclude loud/disruptive exercises (kettlebell swings, high knees)
- `"coworking"`: Shared workspace — exclude equipment-intensive and loud exercises
- `"anywhere"`: Minimal set — only bodyweight, quiet exercises (pushups, squats, plank)

**Backward compatibility:**
- Old config.json (missing `environment`): Default to `"home"` (all exercises allowed)
- Old pool.json (missing `environments`): Treat as `environments: []` (allowed anywhere)

**Confidence:** HIGH (extends existing config + pool assembly pattern, well-isolated change)

---

### 6. Improved Detection Heuristic

**Integration Type:** Replace existing module logic

**Problem:** Current detection triggers on any statusline update after first API call (checks if `current_usage.input_tokens > 0`). This includes post-response updates where processing is complete.

**Solution:** Detect actual API call in progress by checking `cost.total_api_duration_ms` field existence and recency.

**What changes:**
- Replace `lib/statusline/detection.js` logic
- No schema changes, no new files

**Current heuristic (v1.0):**
```javascript
// lib/statusline/detection.js - CURRENT
function isProcessing(claudeData) {
  if (!claudeData) return false;

  const currentUsage = claudeData.context_window?.current_usage;

  if (currentUsage === null || currentUsage === undefined) return false;

  // Problem: Returns true for ALL updates after first API call
  return (currentUsage.input_tokens > 0 || currentUsage.cache_read_input_tokens > 0);
}
```

**Improved heuristic (v1.1):**
```javascript
// lib/statusline/detection.js - IMPROVED
function isProcessing(claudeData) {
  if (!claudeData) return false;

  // Check if cost data exists (indicates API call completed or in progress)
  const cost = claudeData.cost;
  if (!cost) return false;

  // Check if total_api_duration_ms exists and is non-zero
  // This field only appears during/after actual API calls
  const apiDuration = cost.total_api_duration_ms;
  if (!apiDuration || apiDuration === 0) return false;

  // Additional check: Is this a recent API call?
  // If latency > 30s (MAX_LATENCY), likely stale update
  const MAX_STALE_MS = 35000; // Slightly above MAX_LATENCY
  if (apiDuration > MAX_STALE_MS) return false;

  return true;
}
```

**Alternative approach (if cost field unreliable):**
Check for streaming state or request_id changes between updates. Requires stdin buffering and comparison across invocations.

**Why this is better:**
- `cost.total_api_duration_ms` only present during actual API calls
- Reduces false positives on post-response statusline updates
- Aligns with existing latency scaling logic (engine already uses this field)

**Risk:** If Claude Code statusline JSON structure changes, detection breaks. Mitigation: Fail-safe to current behavior if new fields missing.

**Confidence:** MEDIUM (depends on undocumented Claude Code statusline JSON structure, needs live testing)

---

## Integration Summary

### New Modules Required

| Module | Purpose | Dependencies |
|--------|---------|--------------|
| lib/cli/commands/setup.js | Interactive equipment selection wizard | @inquirer/prompts |
| (none others) | All other features extend existing modules | - |

### Modified Modules

| Module | Change Type | Breaking? |
|--------|-------------|-----------|
| lib/pool.js | Extend schema: category, type, environments | No (backward compat) |
| lib/rotation.js | Replace logic: category-aware filtering | No (graceful degradation) |
| lib/config.js | Extend schema: environment field | No (defaults to "home") |
| lib/state.js | Extend schema: recentCategories field | No (initializes if missing) |
| lib/statusline/detection.js | Replace heuristic logic | No (fail-safe to current) |
| engine.js | Extend formatPrompt: type-aware formatting | No (defaults to "reps") |
| lib/statusline/format.js | Add type parameter | No (optional parameter) |
| bin/vibripped.js | Add setup command registration | No (new command) |
| package.json | Add @inquirer/prompts dependency | No |

### Data Model Changes

**pool.json schema (extended):**
```javascript
[
  {
    "name": "Pushups",
    "reps": 15,
    "equipment": [],           // Existing
    "category": "push",        // NEW (v1.1)
    "type": "reps",           // NEW (v1.1)
    "environments": []         // NEW (v1.1)
  }
]
```

**configuration.json schema (extended):**
```javascript
{
  "equipment": {              // Existing
    "kettlebell": false,
    "dumbbells": false,
    "pullUpBar": false,
    "parallettes": false
  },
  "difficulty": {             // Existing
    "multiplier": 1.0
  },
  "environment": "home"       // NEW (v1.1)
}
```

**state.json schema (extended):**
```javascript
{
  "currentIndex": 0,          // Existing
  "lastTriggerTime": 0,       // Existing
  "poolHash": "...",          // Existing
  "totalTriggered": 0,        // Existing
  "configPoolHash": "...",    // Existing
  "recentCategories": []      // NEW (v1.1)
}
```

---

## Build Order Recommendation

Dependencies between features dictate implementation order:

### Phase A: Foundation (No Dependencies)
1. **npm packaging** — Metadata changes, no code dependencies
2. **Detection improvement** — Isolated module replacement

### Phase B: Data Model Extensions (Depends on A)
3. **Timed exercises** — Extends pool schema + display logic (simplest)
4. **Environment profiles** — Extends config + pool assembly (builds on config pattern)

### Phase C: Advanced Rotation (Depends on B)
5. **Category-aware rotation** — Requires pool schema changes from Phase B

### Phase D: Interactive UX (Depends on B, C)
6. **Interactive prompts** — Uses extended config/pool schemas, orchestrates existing logic

**Rationale:**
- npm packaging + detection are isolated — can ship independently
- Timed exercises and environment profiles both extend schemas but don't interact — parallel-safe
- Category rotation depends on pool schema being extended (needs category field)
- Interactive prompts depend on final config/pool schemas — must come last

**Alternative approach:** Batch all schema extensions in one phase, then implement features. Trade-off: Larger initial change, but fewer migration steps.

---

## Architectural Patterns Used

### Pattern 1: Schema Extension with Backward Compatibility

**What:** Add optional fields to existing JSON schemas, treat missing fields as defaults.

**When to use:** Extending data models without breaking existing state files.

**Example:**
```javascript
// Loading extended config
function loadConfig(configPath) {
  const config = JSON.parse(fs.readFileSync(configPath));

  // Normalize with defaults for new fields
  return {
    equipment: config.equipment || DEFAULT_CONFIG.equipment,
    difficulty: config.difficulty || DEFAULT_CONFIG.difficulty,
    environment: config.environment || "home"  // NEW FIELD, defaults if missing
  };
}
```

**Trade-offs:**
- Pro: Zero migration cost, state files survive upgrades
- Con: Code must handle both old and new schemas indefinitely

---

### Pattern 2: Pure Library + Stateful Orchestrator

**What:** Keep library modules pure (input → output), isolate file I/O in orchestrator layers (engine.js, CLI commands).

**When to use:** Maintaining testability and composability.

**Example:**
```javascript
// Pure library (lib/rotation.js)
function getNextExercise(state, pool) {
  // Pure logic, no I/O
  return { exercise, previousIndex };
}

// Stateful orchestrator (engine.js)
function trigger(pool, options) {
  const state = loadState(); // I/O
  const result = getNextExercise(state, pool); // Pure
  saveState(state); // I/O
  return result;
}
```

**Trade-offs:**
- Pro: Easy to test (pure functions), easy to compose
- Con: More indirection, orchestrator gets complex

---

### Pattern 3: Fail-Safe Defaults

**What:** When validation fails or data is missing, fall back to safe defaults instead of throwing.

**When to use:** User-facing tools where crashes are worse than degraded behavior.

**Example:**
```javascript
// lib/config.js - loadConfig
function loadConfig(configPath) {
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(content);
    if (!validateConfig(config)) {
      console.error('Config invalid, using defaults');
      return DEFAULT_CONFIG; // FAIL-SAFE
    }
    return config;
  } catch (e) {
    console.error('Config load error, using defaults');
    return DEFAULT_CONFIG; // FAIL-SAFE
  }
}
```

**Trade-offs:**
- Pro: Graceful degradation, zero crashes
- Con: Silent failures can hide real problems

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Mixing Category Rotation with Randomness

**What people might do:** Use category filtering + random selection from candidates.

**Why it's wrong:** Violates determinism constraint (user should predict next exercise).

**Do this instead:** Category filtering + sequential selection from filtered pool (as shown in rotation algorithm).

---

### Anti-Pattern 2: Adding Environment as Equipment Flag

**What people might do:** Treat environments like equipment (`config.equipment.coworking = true`).

**Why it's wrong:** Environment is mutually exclusive (can only be in ONE place), equipment is additive (can have MULTIPLE items). Mixing the two creates confusing UX.

**Do this instead:** Separate `config.environment` field with single-value validation.

---

### Anti-Pattern 3: Over-Engineering Timed Exercise Scaling

**What people might do:** Complex formula for timed vs rep-based scaling (different latency curves, separate multipliers).

**Why it's wrong:** Adds complexity without proven benefit. Users won't notice the difference between 30s plank scaled to 45s (simple) vs 42s (complex formula).

**Do this instead:** Use same scaling logic, just cap timed exercise multiplier at reasonable bound (1.5x max).

---

## Integration Risk Assessment

| Feature | Integration Risk | Mitigation |
|---------|------------------|------------|
| npm packaging | LOW | Standard workflow, no code changes |
| Interactive prompts | LOW | Isolated in CLI layer, existing patterns |
| Timed exercises | LOW | Schema extension, simple display logic |
| Environment profiles | MEDIUM | Schema + filter logic, test edge cases (empty pool) |
| Category rotation | MEDIUM | Algorithm replacement, test determinism preserved |
| Detection improvement | HIGH | Depends on undocumented stdin structure, needs live testing |

**Recommended testing priorities:**
1. Detection improvement — live Claude Code session testing (high risk)
2. Category rotation — determinism verification (preserves predictability?)
3. Environment profiles — edge cases (pool becomes empty in restrictive environment)
4. Timed exercises, interactive prompts, npm packaging — standard regression testing

---

## Sources

**npm Packaging:**
- [package.json documentation](https://docs.npmjs.com/cli/v8/configuring-npm/package-json/)
- [Installing Node.js bin scripts](https://2ality.com/2022/08/installing-nodejs-bin-scripts.html)
- [Global vs local npm packages](https://oneuptime.com/blog/post/2026-01-22-nodejs-global-vs-local-packages/view)

**Interactive Prompts:**
- [@inquirer/prompts npm](https://www.npmjs.com/package/@inquirer/prompts)
- [Inquirer.js GitHub](https://github.com/SBoudrias/Inquirer.js)
- [DigitalOcean interactive CLI tutorial](https://www.digitalocean.com/community/tutorials/nodejs-interactive-command-line-prompts)

**Category Rotation:**
- [Muscle group rotation importance](https://lipsticklifters.com/articles/the-importance-of-muscle-group-rotation/)
- [Why lifters rotate muscle groups](https://fitmixonline.com/why_lifters_rotate_muscle_groups)
- [Muscle groups to work out together](https://www.healthline.com/health/exercise-fitness/muscle-groups-to-workout-together)

**Timed Exercises:**
- [Isometric holds vs full reps muscle growth](https://www.menshealth.com/uk/building-muscle/train-smarter/a66034671/isometric-vs-full-reps-muscle-growth-study/)
- [Programming isometrics](https://www.sportsmith.co/articles/programming-isometrics-in-different-training-models/)

---

*Architecture integration research for VibeRipped v1.1*
*Researched: 2026-02-09*
*Confidence: HIGH (integration patterns), MEDIUM (detection heuristic)*
