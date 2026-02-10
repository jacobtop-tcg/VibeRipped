# Phase 13: Batch & Checklist Management - Research

**Researched:** 2026-02-10
**Domain:** Batch input parsing, interactive terminal checklists, TTY-aware UI design
**Confidence:** HIGH

## Summary

Phase 13 adds two user-facing enhancements to pool management: (1) batch-add exercises from comma-separated input for bulk import efficiency, and (2) interactive checklist for toggling exercises on/off within the pool. The technical domain centers on three problems: parsing and validating comma-separated exercise format ("Name reps, Name2 reps2"), building a toggle-based checkbox UI that works with existing CheckboxPrompt patterns, and ensuring graceful failure in non-TTY contexts.

The VibeRipped codebase already provides essential primitives: CheckboxPrompt widget (lib/cli/ui/checkbox.js) with space-to-toggle and enter-to-confirm, TTY guard (lib/cli/ui/tty.js) for non-interactive detection, validation helpers (lib/cli/validation.js) for exercise name/reps, and atomic pool operations (lib/cli/commands/pool.js) for add/remove/update. Phase 13 extends these: batch-add parses comma-separated format into array of {name, reps} pairs then validates each before adding, checklist mode presents existing pool as toggleable list then filters pool to keep only checked items.

Key architectural decision: batch-add validates ALL exercises before adding ANY (atomic validation) to prevent partial imports on format errors. Checklist uses CheckboxPrompt with existing pool as choices array, defaulting all to checked=true, allowing user to uncheck unwanted exercises. Both commands respect TTY guard and fail with clear error + non-interactive alternatives when run in pipes/scripts.

**Primary recommendation:** Extend pool add command to detect comma-separated input via string.includes(','), split on comma, parse each "name reps" pair with trim/split/validate pipeline, reject entire batch on any validation error. Add pool manage command using CheckboxPrompt initialized from current pool.json with all items checked, filter pool to keep only checked items after confirmation, save atomically with pool hash update. Both commands wrapped with requireTTY guard.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in readline | Built-in | Keypress events for CheckboxPrompt | Already used in lib/cli/ui/checkbox.js, zero deps |
| Node.js built-in fs | Built-in | Pool.json load for checklist population | Synchronous reads match existing pool.js patterns |
| write-file-atomic | 7.0.0 (existing) | Atomic pool updates after batch/checklist changes | Already project dependency, prevents corruption |
| commander | 14.x (existing) | Variadic arguments for batch input | Already used for CLI, supports optional variadic args |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | N/A | Comma parsing | String.split(',').map(trim) sufficient for "A, B, C" format |
| None | N/A | Checkbox widget | Existing CheckboxPrompt in lib/cli/ui/checkbox.js proven in setup command |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled parsing | csv-parse library | Library designed for CSV files with quotes/escaping; overkill for simple "Name reps, Name2 reps2" format with no quoting |
| Hand-rolled checklist | inquirer.js | Adds 20+ dependencies for same checkbox functionality; VibeRipped already has working CheckboxPrompt |
| Hand-rolled checklist | prompts library | 6 dependencies, ESM-only, would require import() migration; existing CheckboxPrompt works |

**Installation:**
No new dependencies required. Use existing Node.js built-ins and project modules.

## Architecture Patterns

### Recommended Project Structure
No new files required. Changes confined to existing modules:
```
lib/
├── cli/
│   ├── commands/
│   │   └── pool.js          # Extend add() for batch detection, add manage() function
│   ├── ui/
│   │   ├── checkbox.js      # (No changes - already supports checklist UX)
│   │   └── tty.js           # (No changes - already provides requireTTY)
│   └── validation.js        # (No changes - already validates name/reps)
│
bin/
└── viberipped.js            # Add pool manage subcommand

test/
└── cli/
    └── pool.test.js         # Add batch-add and manage integration tests
```

### Pattern 1: Batch Format Detection in Command Handler
**What:** Single add command handles both single and batch modes via comma detection
**When to use:** Extending existing command with backward-compatible batch mode
**Example:**
```javascript
// lib/cli/commands/pool.js - add() function
function add(name, repsStr, options = {}) {
  // Detect batch mode: if name contains comma, treat as batch input
  if (name.includes(',')) {
    return addBatch(name, options);  // Delegate to batch handler
  }

  // Single-add mode (existing behavior)
  const validatedName = validateExerciseName(name);
  const validatedReps = validateReps(repsStr);
  // ... existing single-add logic ...
}
```

This pattern avoids breaking changes - existing `viberipped pool add "Name" 15` still works, new `viberipped pool add "Name 15, Name2 20"` triggers batch mode automatically.

### Pattern 2: Atomic Batch Validation
**What:** Validate ALL items before adding ANY to prevent partial imports
**When to use:** Batch operations where partial success is unacceptable
**Example:**
```javascript
function addBatch(batchInput, options = {}) {
  // Split on comma
  const items = batchInput.split(',').map(s => s.trim()).filter(s => s.length > 0);

  if (items.length === 0) {
    error('No exercises found in batch input');
    process.exit(1);
  }

  // Parse and validate ALL items first
  const parsed = [];
  for (const item of items) {
    // Parse "Name reps" format
    const parts = item.trim().split(/\s+/);
    if (parts.length < 2) {
      error(`Invalid format: "${item}" (expected "Name reps")`);
      process.exit(1);
    }

    const reps = parts[parts.length - 1];
    const name = parts.slice(0, -1).join(' ');

    // Validate
    const validatedName = validateExerciseName(name);
    const validatedReps = validateReps(reps);
    if (!validatedName || !validatedReps) {
      error(`Invalid exercise: "${item}"`);
      process.exit(1);
    }

    parsed.push({ name: validatedName, reps: validatedReps });
  }

  // Load pool
  const pool = loadPool();
  if (!pool) process.exit(1);

  // Check for duplicates
  for (const { name } of parsed) {
    if (pool.find(ex => ex.name.toLowerCase() === name.toLowerCase())) {
      error(`Exercise "${name}" already exists in pool`);
      process.exit(1);
    }
  }

  // All validated - now add ALL at once
  for (const { name, reps } of parsed) {
    pool.push({
      name,
      reps,
      equipment: [],
      type: 'reps',
      environments: ['anywhere']
    });
  }

  // Save pool + update hash
  savePool(pool);
  updateStateHash(computePoolHash(pool));

  success(`Added ${parsed.length} exercises to pool`);
  info('Rotation index reset to beginning.');
  process.exit(0);
}
```

### Pattern 3: Checklist from Existing Pool
**What:** Initialize CheckboxPrompt with current pool.json as choices, all checked by default
**When to use:** Interactive filtering of existing list (enable/disable exercises)
**Example:**
```javascript
// lib/cli/commands/pool.js - manage() function
async function manage() {
  // TTY guard
  if (!requireTTY('pool manage')) {
    return;
  }

  // Load current pool
  const pool = loadPool();
  if (!pool) {
    process.exit(1);
  }

  // Convert pool to checkbox choices (all checked by default)
  const choices = pool.map((exercise, index) => ({
    label: `${exercise.name} x${exercise.reps}`,
    value: index,  // Use index as identifier
    checked: true  // All enabled by default
  }));

  // Display checklist
  info('');
  info('Toggle exercises on/off using space bar.');
  info('Press Enter when done.');
  info('');

  const checkboxPrompt = new CheckboxPrompt(
    'Manage exercise pool (Space to toggle, Enter to confirm):',
    choices
  );

  let selected;
  try {
    selected = await checkboxPrompt.prompt();
  } catch (e) {
    // User cancelled with Escape
    info('Pool management cancelled.');
    process.exit(0);
    return;
  }

  // Filter pool to keep only selected indices
  const newPool = selected.map(index => pool[index]);

  // Validate: must keep at least one exercise
  if (newPool.length === 0) {
    error('Cannot empty pool completely (at least one exercise required)');
    process.exit(1);
    return;
  }

  // Save filtered pool
  savePool(newPool);
  updateStateHash(computePoolHash(newPool));

  success(`Pool updated: ${newPool.length} exercises enabled`);
  info('Rotation index reset to beginning.');
  process.exit(0);
}
```

### Pattern 4: TTY Guard for Interactive Commands
**What:** Require TTY for commands needing raw mode, suggest non-interactive alternatives
**When to use:** Any command using CheckboxPrompt or interactive input
**Example:**
```javascript
// pool manage command entry point
async function manage() {
  // TTY guard - exits with code 1 if not interactive
  if (!requireTTY('pool manage')) {
    // requireTTY prints error + non-interactive alternatives automatically
    return;
  }

  // Only reached if stdin/stdout are TTY
  // ... interactive checklist logic ...
}
```

Existing tty.js already implements this pattern and prints helpful alternatives:
```
Error: pool manage requires an interactive terminal

This command cannot run in piped or non-interactive contexts.

To configure non-interactively, use:
  viberipped pool add "Exercise name" 15
  viberipped pool remove "Exercise name"
```

### Pattern 5: Split-Trim-Filter Pipeline for Parsing
**What:** Standard JavaScript pattern for parsing human input with noise
**When to use:** Parsing comma/space-separated lists with variable whitespace
**Example:**
```javascript
// Parsing comma-separated batch input
const items = batchInput
  .split(',')                    // Split on comma
  .map(s => s.trim())            // Remove leading/trailing whitespace
  .filter(s => s.length > 0);    // Remove empty strings

// Parsing "Name reps" within each item
for (const item of items) {
  const parts = item.trim().split(/\s+/);  // Split on any whitespace
  const reps = parts[parts.length - 1];    // Last part is reps
  const name = parts.slice(0, -1).join(' '); // Everything else is name
}
```

This handles:
- "Burpees 12, Mountain climbers 20" (clean input)
- "Burpees 12,Mountain climbers 20" (no space after comma)
- "Burpees  12 ,  Mountain climbers   20" (extra whitespace)
- "Burpees 12,  ,Mountain climbers 20" (empty items filtered out)

### Anti-Patterns to Avoid
- **Partial batch import on error:** Don't add some exercises then fail - validate ALL first
- **Silent duplicate skipping:** Don't skip duplicates silently in batch mode - fail explicitly so user knows
- **Index-based removal in checklist:** Don't use numeric indices in UI - show exercise names for clarity
- **No empty pool guard:** Don't allow user to uncheck all exercises - require at least one
- **CSV library for simple parsing:** Don't add csv-parse dependency for "Name reps, Name2 reps2" format

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Checkbox widget | Custom keypress handler with ANSI rendering | Existing CheckboxPrompt (lib/cli/ui/checkbox.js) | Already proven in setup command, handles arrow keys, space toggle, enter confirm, escape cancel, SIGINT cleanup |
| TTY detection | Manual process.stdin.isTTY checks | Existing requireTTY (lib/cli/ui/tty.js) | Already provides helpful error messages with non-interactive alternatives |
| Exercise validation | New batch-specific validators | Existing validateExerciseName/validateReps | Ensures consistency with single-add validation rules |
| CSV parsing | Custom quoted string parser | String.split(',').map(trim) | No quoting/escaping needed for "Name reps, Name2 reps2" format |

**Key insight:** Phase 13 is pure composition of existing primitives. CheckboxPrompt provides interactive UI, validation helpers ensure consistency, atomic pool operations prevent corruption. New code is minimal - batch parsing logic and checklist filtering logic only.

## Common Pitfalls

### Pitfall 1: Ambiguous Batch Format Parsing
**What goes wrong:** "Burpees 12, 15" interpreted as two exercises "Burpees" and "12, 15" instead of error
**Why it happens:** Split-on-comma first creates "Burpees 12" and "15", second item has no name
**How to avoid:** Validate each comma-separated item has at least two parts (name + reps)
**Warning signs:** Tests with malformed input don't fail as expected
**Implementation:**
```javascript
const parts = item.trim().split(/\s+/);
if (parts.length < 2) {
  error(`Invalid format: "${item}" (expected "Name reps")`);
  process.exit(1);
}
```

### Pitfall 2: Partial Batch Import on Validation Error
**What goes wrong:** First 3 exercises added successfully, 4th fails validation, pool now inconsistent
**Why it happens:** Adding exercises inside validation loop instead of after ALL validated
**How to avoid:** Parse and validate ALL items into array, then add ALL at once
**Warning signs:** Pool corruption on batch errors, tests find exercises added despite error exit
**Verification:** Add exercises after validation loop, not during:
```javascript
// BAD: add during validation
for (const item of items) {
  const {name, reps} = parseItem(item);
  validateExercise(name, reps);
  pool.push({name, reps}); // <-- WRONG: adds before all validated
}

// GOOD: validate all, then add all
const parsed = [];
for (const item of items) {
  const {name, reps} = parseItem(item);
  validateExercise(name, reps);
  parsed.push({name, reps}); // <-- RIGHT: collect first
}
for (const ex of parsed) {
  pool.push(ex); // <-- Add after all validated
}
```

### Pitfall 3: Empty Pool After Checklist Unchecks All
**What goes wrong:** User unchecks all exercises in manage, rotation breaks with empty pool
**Why it happens:** No validation that at least one exercise remains checked
**How to avoid:** Check selected.length > 0 before saving filtered pool
**Warning signs:** Empty pool.json after manage command, trigger fails with "no exercises"
**Implementation:**
```javascript
const selected = await checkboxPrompt.prompt();
const newPool = selected.map(index => pool[index]);

if (newPool.length === 0) {
  error('Cannot empty pool completely (at least one exercise required)');
  process.exit(1);
  return;
}
```

### Pitfall 4: Batch Duplicate Detection Misses Cross-Batch Conflicts
**What goes wrong:** Batch "Burpees 12, Burpees 15" adds both, creating duplicate names
**Why it happens:** Only checking against existing pool, not checking within batch itself
**How to avoid:** Check both existing pool AND parsed array for duplicates
**Warning signs:** Tests with duplicate names in batch input don't fail
**Implementation:**
```javascript
// Check against existing pool
for (const { name } of parsed) {
  if (pool.find(ex => ex.name.toLowerCase() === name.toLowerCase())) {
    error(`Exercise "${name}" already exists in pool`);
    process.exit(1);
  }
}

// Check within batch itself
const seenNames = new Set();
for (const { name } of parsed) {
  const lower = name.toLowerCase();
  if (seenNames.has(lower)) {
    error(`Duplicate exercise in batch: "${name}"`);
    process.exit(1);
  }
  seenNames.add(lower);
}
```

### Pitfall 5: Checklist Index Mismatch After Filter
**What goes wrong:** CheckboxPrompt returns indices [0, 2, 4], filtering by pool[index] works initially but breaks if pool ordering changes
**Why it happens:** Using array indices as stable identifiers when they're not
**How to avoid:** For Phase 13, indices are safe because pool is loaded, filtered, and saved atomically. For future phases with concurrent edits, use stable IDs (exercise names).
**Warning signs:** Checklist removes wrong exercises if pool changes between load and save
**Mitigation:** Current design is safe (atomic load-filter-save), but document assumption

### Pitfall 6: Batch Input with Embedded Commas in Exercise Names
**What goes wrong:** User tries "Jumping jacks, high intensity 20" meaning one exercise, parsed as two
**Why it happens:** Split-on-comma treats comma as delimiter, not part of name
**How to avoid:** Document format as "Name reps, Name2 reps2" with no commas in names. Validation will catch this (missing reps).
**Warning signs:** Users report batch-add failures with descriptive exercise names
**Resolution:** Format limitation - exercise names cannot contain commas. Error message should clarify: "Use pool add for exercises with commas in name"

### Pitfall 7: TTY Guard Not Applied to Manage Command
**What goes wrong:** pool manage runs in CI/CD pipeline, hangs waiting for keypress that never comes
**Why it happens:** Forgetting requireTTY guard at function start
**How to avoid:** Call requireTTY('pool manage') as first line of manage function
**Warning signs:** Command hangs in non-interactive contexts, no error message printed
**Verification:** Integration test with non-TTY stdin should exit with code 1 and error message

### Pitfall 8: Checklist Checkbox Labels Without Type Information
**What goes wrong:** Timed exercises show "Plank x30" instead of "Plank 30s" in checklist
**Why it happens:** Not using formatExercise or type-aware display in checkbox labels
**How to avoid:** Build checkbox labels same way as pool list command (check exercise.type)
**Warning signs:** Inconsistent display format between pool list and pool manage
**Implementation:**
```javascript
const choices = pool.map((exercise, index) => {
  // Type-aware label (matches pool list display)
  const display = exercise.type === 'timed'
    ? `${exercise.name} ${exercise.duration ?? exercise.reps}s`
    : `${exercise.name} x${exercise.reps}`;

  return {
    label: display,
    value: index,
    checked: true
  };
});
```

## Code Examples

Verified patterns from existing codebase and standard practices:

### Batch Add Command Implementation
```javascript
// lib/cli/commands/pool.js - extend add() function
// Source: Existing add() pattern + split-trim-filter parsing

function add(name, repsStr, options = {}) {
  // Detect batch mode: if name parameter contains comma, treat as batch input
  if (name.includes(',')) {
    return addBatch(name, options);
  }

  // Single-add mode (existing implementation unchanged)
  const validatedName = validateExerciseName(name);
  if (validatedName === null) {
    error('Invalid exercise name (must be 1-50 characters)', 'viberipped pool add "Exercise name" <reps>');
    process.exit(1);
  }

  const validatedReps = validateReps(repsStr);
  if (validatedReps === null) {
    error('Invalid reps (must be integer 1-999)', 'viberipped pool add "Exercise name" <reps>');
    process.exit(1);
  }

  // ... rest of existing add logic ...
}

function addBatch(batchInput, options = {}) {
  // Parse comma-separated input
  const items = batchInput
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (items.length === 0) {
    error('No exercises found in batch input', 'viberipped pool add "Name1 reps1, Name2 reps2"');
    process.exit(1);
  }

  // Parse and validate ALL items before adding ANY
  const parsed = [];
  for (const item of items) {
    // Parse "Name reps" format: split on whitespace, last part is reps, rest is name
    const parts = item.trim().split(/\s+/);

    if (parts.length < 2) {
      error(`Invalid format: "${item}"`, 'Expected format: "Exercise name reps" (e.g., "Burpees 12")');
      process.exit(1);
    }

    const reps = parts[parts.length - 1];
    const name = parts.slice(0, -1).join(' ');

    // Validate using existing validators
    const validatedName = validateExerciseName(name);
    if (validatedName === null) {
      error(`Invalid exercise name in "${item}" (must be 1-50 characters)`);
      process.exit(1);
    }

    const validatedReps = validateReps(reps);
    if (validatedReps === null) {
      error(`Invalid reps in "${item}" (must be integer 1-999)`);
      process.exit(1);
    }

    parsed.push({ name: validatedName, reps: validatedReps });
  }

  // Load pool
  const pool = loadPool();
  if (!pool) {
    process.exit(1);
  }

  // Check for duplicates in existing pool
  for (const { name } of parsed) {
    const nameLower = name.toLowerCase();
    if (pool.find(ex => ex.name.toLowerCase() === nameLower)) {
      error(`Exercise "${name}" already exists in pool`);
      process.exit(1);
    }
  }

  // Check for duplicates within batch itself
  const seenNames = new Set();
  for (const { name } of parsed) {
    const lower = name.toLowerCase();
    if (seenNames.has(lower)) {
      error(`Duplicate exercise in batch: "${name}"`);
      process.exit(1);
    }
    seenNames.add(lower);
  }

  // All validated - add ALL at once
  for (const { name, reps } of parsed) {
    pool.push({
      name,
      reps,
      equipment: [],
      type: 'reps',
      environments: ['anywhere']
    });
  }

  // Compute new hash
  const newPoolHash = computePoolHash(pool);

  // Save pool
  if (!savePool(pool)) {
    process.exit(1);
  }

  // Update state hash and reset index
  updateStateHash(newPoolHash);

  success(`Added ${parsed.length} exercises to pool`);
  parsed.forEach(ex => info(`  - ${ex.name} x${ex.reps}`));
  info('Rotation index reset to beginning.');

  process.exit(0);
}
```

### Checklist Management Command Implementation
```javascript
// lib/cli/commands/pool.js - new manage() function
// Source: Existing setup.js CheckboxPrompt pattern + pool operations

async function manage() {
  // TTY guard
  if (!requireTTY('pool manage')) {
    return;
  }

  // Load current pool
  const pool = loadPool();
  if (!pool) {
    process.exit(1);
  }

  // Convert pool to checkbox choices (all checked by default)
  const choices = pool.map((exercise, index) => {
    // Type-aware display (matches pool list format)
    let display;
    if (exercise.type === 'timed') {
      const displayValue = exercise.duration ?? exercise.reps;
      display = `${exercise.name} ${displayValue}s`;
    } else {
      display = `${exercise.name} x${exercise.reps}`;
    }

    // Environment display
    const envs = exercise.environments
      ? exercise.environments.join(', ')
      : 'anywhere';

    // Equipment display
    let equipment = 'bodyweight';
    if (exercise.equipment && Array.isArray(exercise.equipment) && exercise.equipment.length > 0) {
      equipment = exercise.equipment.join(', ');
    }

    return {
      label: `${display} [${equipment}] (${envs})`,
      value: index,
      checked: true  // All enabled by default
    };
  });

  // Display instructions
  info('');
  info('Manage exercise pool:');
  info('  - Use arrow keys to navigate');
  info('  - Press Space to toggle exercise on/off');
  info('  - Press Enter to save changes');
  info('  - Press Escape to cancel');
  info('');

  // Show checklist
  const checkboxPrompt = new CheckboxPrompt(
    'Toggle exercises (Space to toggle, Enter to confirm):',
    choices
  );

  let selected;
  try {
    selected = await checkboxPrompt.prompt();
  } catch (e) {
    // User cancelled with Escape
    info('Pool management cancelled.');
    process.exitCode = 0;
    return;
  }

  // Filter pool to keep only selected indices
  const newPool = selected.map(index => pool[index]);

  // Validate: must keep at least one exercise
  if (newPool.length === 0) {
    error('Cannot empty pool completely (at least one exercise required)');
    process.exitCode = 1;
    return;
  }

  // Check if anything changed
  if (newPool.length === pool.length) {
    info('No changes made to pool.');
    process.exitCode = 0;
    return;
  }

  // Compute new hash
  const newPoolHash = computePoolHash(newPool);

  // Save filtered pool
  if (!savePool(newPool)) {
    process.exitCode = 1;
    return;
  }

  // Update state hash and reset index
  updateStateHash(newPoolHash);

  success(`Pool updated: ${newPool.length} of ${pool.length} exercises enabled`);
  const removed = pool.length - newPool.length;
  if (removed > 0) {
    info(`Removed ${removed} exercise${removed === 1 ? '' : 's'} from rotation.`);
  }
  info('Rotation index reset to beginning.');

  process.exitCode = 0;
}

// Export with existing functions
module.exports = {
  list,
  add,
  remove,
  manage  // New export
};
```

### CLI Entry Point Extension
```javascript
// bin/viberipped.js - add manage subcommand
// Source: Existing poolCmd command group pattern

// Existing pool command group
const poolCmd = new Command('pool')
  .description('Manage exercise pool');

poolCmd
  .command('list')
  .alias('ls')
  .description('List exercises in current pool')
  .action(() => {
    const poolHandler = require(path.join(__dirname, '../lib/cli/commands/pool.js'));
    poolHandler.list();
  });

poolCmd
  .command('add <name> <reps>')
  .description('Add exercise to pool (or batch-add with "Name1 reps1, Name2 reps2")')
  .option('--type <type>', 'Exercise type: reps or timed', 'reps')
  .option('--duration <seconds>', 'Duration in seconds (for timed exercises)')
  .option('--environments <envs>', 'Comma-separated environments (e.g., "home,office")')
  .action((name, reps, options) => {
    const poolHandler = require(path.join(__dirname, '../lib/cli/commands/pool.js'));
    poolHandler.add(name, reps, options);
  });

poolCmd
  .command('remove <name>')
  .alias('rm')
  .description('Remove exercise from pool')
  .action((name) => {
    const poolHandler = require(path.join(__dirname, '../lib/cli/commands/pool.js'));
    poolHandler.remove(name);
  });

// NEW: Manage subcommand
poolCmd
  .command('manage')
  .description('Launch interactive checklist to toggle exercises on/off')
  .action(async () => {
    const poolHandler = require(path.join(__dirname, '../lib/cli/commands/pool.js'));
    await poolHandler.manage();
  });

program.addCommand(poolCmd);
```

### Integration Tests for Batch Add
```javascript
// test/cli/pool.test.js - batch-add tests
// Source: Existing pool.test.js patterns

test('batch adds multiple exercises from comma-separated input', async () => {
  const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(tempHome, { recursive: true });

  // Create initial pool
  const testPool = [
    { name: "Pushups", reps: 15, type: "reps", equipment: [], environments: ["anywhere"] }
  ];
  createPool(tempHome, testPool);

  // Batch add
  const { code, stdout } = await runCLI(
    ['pool', 'add', 'Burpees 12, Mountain climbers 20, Jumping jacks 30'],
    tempHome
  );

  assert.strictEqual(code, 0);
  assert.match(stdout, /Added 3 exercises to pool/);
  assert.match(stdout, /Burpees x12/);
  assert.match(stdout, /Mountain climbers x20/);
  assert.match(stdout, /Jumping jacks x30/);

  // Verify pool.json contains all exercises
  const poolPath = path.join(tempHome, '.config', 'viberipped', 'pool.json');
  const pool = JSON.parse(fs.readFileSync(poolPath, 'utf8'));
  assert.strictEqual(pool.length, 4);
  assert.ok(pool.find(ex => ex.name === 'Burpees' && ex.reps === 12));
  assert.ok(pool.find(ex => ex.name === 'Mountain climbers' && ex.reps === 20));
  assert.ok(pool.find(ex => ex.name === 'Jumping jacks' && ex.reps === 30));

  cleanup(tempHome);
});

test('batch add rejects if any exercise is invalid', async () => {
  const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(tempHome, { recursive: true });

  // Create pool
  const testPool = [
    { name: "Pushups", reps: 15, type: "reps", equipment: [], environments: ["anywhere"] }
  ];
  createPool(tempHome, testPool);

  // Batch with one invalid entry (missing reps)
  const { code, stderr } = await runCLI(
    ['pool', 'add', 'Burpees 12, Invalid, Squats 20'],
    tempHome
  );

  assert.strictEqual(code, 1);
  assert.match(stderr, /Invalid format.*"Invalid"/);

  // Verify pool unchanged (atomic failure)
  const poolPath = path.join(tempHome, '.config', 'viberipped', 'pool.json');
  const pool = JSON.parse(fs.readFileSync(poolPath, 'utf8'));
  assert.strictEqual(pool.length, 1); // Only original Pushups
  assert.ok(!pool.find(ex => ex.name === 'Burpees')); // Burpees NOT added

  cleanup(tempHome);
});

test('batch add rejects duplicate within batch', async () => {
  const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(tempHome, { recursive: true });

  // Create pool
  const testPool = [
    { name: "Pushups", reps: 15, type: "reps", equipment: [], environments: ["anywhere"] }
  ];
  createPool(tempHome, testPool);

  // Batch with duplicate name
  const { code, stderr } = await runCLI(
    ['pool', 'add', 'Burpees 12, Squats 20, Burpees 15'],
    tempHome
  );

  assert.strictEqual(code, 1);
  assert.match(stderr, /Duplicate exercise.*Burpees/);

  cleanup(tempHome);
});

test('batch add handles multi-word exercise names', async () => {
  const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(tempHome, { recursive: true });

  // Create pool
  const testPool = [
    { name: "Pushups", reps: 15, type: "reps", equipment: [], environments: ["anywhere"] }
  ];
  createPool(tempHome, testPool);

  // Batch with multi-word names
  const { code, stdout } = await runCLI(
    ['pool', 'add', 'Jumping jacks 30, Mountain climbers 20, High knees 25'],
    tempHome
  );

  assert.strictEqual(code, 0);
  assert.match(stdout, /Added 3 exercises/);

  // Verify names preserved correctly
  const poolPath = path.join(tempHome, '.config', 'viberipped', 'pool.json');
  const pool = JSON.parse(fs.readFileSync(poolPath, 'utf8'));
  assert.ok(pool.find(ex => ex.name === 'Jumping jacks'));
  assert.ok(pool.find(ex => ex.name === 'Mountain climbers'));
  assert.ok(pool.find(ex => ex.name === 'High knees'));

  cleanup(tempHome);
});
```

Note: Integration tests for pool manage command would require mocking stdin keypress events or using a test harness that can simulate interactive input. For Phase 13, testing the underlying logic (loadPool, filter, savePool) in unit tests is more practical than full E2E interactive tests.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Add exercises one at a time via CLI | Batch-add from comma-separated format | Phase 13 (2026-02-10) | Faster bulk import, reduced typing for new users |
| Manual JSON editing to remove exercises | Interactive checklist toggle UI | Phase 13 (2026-02-10) | Non-technical users can manage pool without JSON knowledge |
| External libraries for checkboxes (inquirer.js) | Built-in CheckboxPrompt widget | Phase 12 (2026-02-09) | Zero-dependency interactive UI, proven in setup command |
| CSV libraries for parsing | String.split(',').map(trim).filter() | Always standard | Simple format doesn't need CSV complexity |

**Deprecated/outdated:**
- None - Phase 13 builds on Phase 12's interactive patterns (CheckboxPrompt, TTY guard, validation helpers) which are current as of 2026-02-09

## Open Questions

1. **Should batch-add support options like --type and --environments?**
   - What we know: Single-add supports --type timed and --environments "home,office"
   - What's unclear: How to apply options to batch input (all exercises get same options, or per-exercise syntax?)
   - Recommendation: Phase 13 keeps batch simple (all exercises default to type=reps, environments=anywhere). Future phase can add per-exercise syntax like "Plank 30s timed, Burpees 12 reps".

2. **Should manage command support bulk operations beyond toggle (e.g., edit reps)?**
   - What we know: CheckboxPrompt supports space-to-toggle and enter-to-confirm
   - What's unclear: Should user be able to edit exercise properties in checklist view?
   - Recommendation: Phase 13 keeps manage as toggle-only (enable/disable). Editing reps/type/environments still requires pool remove + pool add. Future phase could add pool edit command.

3. **Should batch-add deduplicate automatically or error on duplicates?**
   - What we know: Single-add errors on duplicate name (case-insensitive)
   - What's unclear: Should batch-add skip duplicates silently or error?
   - Recommendation: Error on duplicates (both against pool and within batch). Explicit errors prevent accidental typos from being silently ignored.

4. **Should manage command allow multi-step edits (remove, then re-add)?**
   - What we know: Current design is single checklist interaction, then save
   - What's unclear: If user unchecks 5 exercises, should they see immediate save or have chance to re-check?
   - Recommendation: Single-shot interaction matches CheckboxPrompt UX (space toggles until enter confirms). User can press Escape to cancel if they change their mind.

5. **Should checklist show exercises in pool order or sorted alphabetically?**
   - What we know: Pool order determines rotation sequence
   - What's unclear: Is alphabetical sorting more user-friendly for finding exercises?
   - Recommendation: Show in pool order (index 0 to N). This makes it clear which exercise is "next" in rotation. Future phase could add --sort flag if users request it.

## Sources

### Primary (HIGH confidence)
- VibeRipped codebase - lib/cli/ui/checkbox.js (CheckboxPrompt widget proven in setup)
- VibeRipped codebase - lib/cli/ui/tty.js (requireTTY guard pattern)
- VibeRipped codebase - lib/cli/validation.js (validateExerciseName/validateReps helpers)
- VibeRipped codebase - lib/cli/commands/pool.js (atomic pool operations, existing add/remove patterns)
- VibeRipped codebase - lib/cli/commands/setup.js (CheckboxPrompt usage example, lines 64-77)
- [Node.js Readline Documentation](https://nodejs.org/api/readline.html) - emitKeypressEvents, raw mode, keypress events
- [MDN: String.prototype.split()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/split) - Comma-separated parsing standard method

### Secondary (MEDIUM confidence)
- [Using .split() and .trim() for data cleaning in JavaScript | Medium](https://medium.com/@davidmedina0907/using-split-and-trim-for-data-cleaning-in-javascript-1167ceb1d4d6) - Split-trim-filter pipeline pattern for parsing human input
- [Split a String removing any Empty Elements in JavaScript | bobbyhadz](https://bobbyhadz.com/blog/javascript-split-remove-empty-elements) - filter(s => s.length > 0) pattern for cleaning
- [GitHub - tj/commander.js](https://github.com/tj/commander.js) - Variadic arguments for optional batch input
- [How To Create Interactive Command-line Prompts with Inquirer.js | DigitalOcean](https://www.digitalocean.com/community/tutorials/nodejs-interactive-command-line-prompts) - Checkbox prompt patterns (not used due to existing CheckboxPrompt)

### Tertiary (LOW confidence)
- csv-parse library - Considered but overkill for simple "Name reps, Name2 reps2" format without quoting/escaping
- inquirer.js library - Considered but VibeRipped already has working CheckboxPrompt with zero deps

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, existing primitives cover all needs
- Architecture: HIGH - Extends proven patterns from Phase 12 (CheckboxPrompt, TTY guard) and Phase 5 (pool operations)
- Pitfalls: HIGH - Identified from existing validation patterns and common parsing mistakes (partial imports, duplicate detection)

**Research date:** 2026-02-10
**Valid until:** 2026-03-12 (30 days - stable domain, project-specific patterns, no external dependencies)
