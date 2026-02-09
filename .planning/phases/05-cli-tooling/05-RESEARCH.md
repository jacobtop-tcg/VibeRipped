# Phase 5: CLI Tooling - Research

**Researched:** 2026-02-09
**Domain:** Node.js CLI development, command-line argument parsing, user-facing tooling, dry-run patterns
**Confidence:** HIGH

## Summary

Phase 5 transforms VibeRipped from a library-driven system into a user-facing CLI tool with commands for initial setup, pool management, and dry-run testing. The technical domain centers on three core problems: (1) creating an ergonomic command structure with validation, (2) providing pool management without requiring manual JSON editing, and (3) implementing dry-run mode that tests exercise output without mutating state.

The VibeRipped codebase already provides all necessary primitives: config loading/saving (lib/config.js), pool assembly (lib/pool.js), state management (lib/state.js), and exercise triggering (engine.js). Phase 5 wraps these operations with commander.js for argument parsing, adds validation with clear error messages, and ensures atomic updates to configuration.json and pool.json.

Commander.js is the industry standard for Node.js CLIs with subcommands, offering zero dependencies, Git-style command structure, automatic help generation, and built-in validation. It's lighter and more straightforward than yargs (16 dependencies), with 245M weekly downloads vs yargs' 127M. For VibeRipped's needs—simple subcommands with boolean flags and list operations—commander's declarative API is ideal.

**Primary recommendation:** Use commander 14.x with package.json bin field for `vibripped` command. Create subcommands: `vibripped config [--equipment]`, `vibripped pool [add|remove|list]`, `vibripped test`. Each command validates inputs, provides actionable error messages (exit code 1), and updates JSON files atomically via write-file-atomic (already a project dependency). Dry-run mode calls trigger() with bypassCooldown=true and no state persistence.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| commander | 14.0.3 | CLI argument parsing and subcommands | Zero dependencies, 245M weekly downloads, Git-style command structure, automatic help generation |
| Node.js built-in fs | Built-in | Reading pool.json for list/edit operations | Synchronous reads match existing state/config modules |
| write-file-atomic | 7.0.0 (existing) | Atomic config/pool updates | Already project dependency, prevents corruption on crash |
| Node.js built-in process | Built-in | Exit codes and error handling | Standard exit code conventions (0 = success, 1 = error) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| chalk | 5.x (avoided) | ANSI color output | NOT RECOMMENDED: VibeRipped avoids dependencies, statusline already handles color with raw ANSI codes |
| inquirer | (avoided) | Interactive prompts | NOT RECOMMENDED: Phase 5 uses declarative flags, not interactive mode |
| ora | (avoided) | Progress spinners | NOT RECOMMENDED: CLI operations are instant (JSON file I/O), no long-running tasks |
| joi/zod/ajv | (avoided) | Schema validation | NOT RECOMMENDED: Manual validation sufficient for 2-3 field config, zero-dependency philosophy |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| commander | yargs | Yargs adds 16 dependencies, more complex API, overkill for simple subcommands |
| commander | Node.js util.parseArgs | Built-in since v18.3 but manual subcommand routing, no auto-help generation |
| Manual validation | joi/zod | Schema validators add dependencies, manual validation matches existing config.js patterns |
| Color output | chalk | Chalk adds dependency, raw ANSI codes in statusline already proven |

**Installation:**
```bash
npm install commander@^14.0.0
```

## Architecture Patterns

### Recommended Project Structure
```
bin/
└── vibripped.js             # NEW: CLI entry point with shebang

lib/
├── cli/                      # NEW: CLI-specific modules
│   ├── commands/
│   │   ├── config.js         # config subcommand implementation
│   │   ├── pool.js           # pool subcommand implementation
│   │   └── test.js           # test/dry-run subcommand implementation
│   ├── validation.js         # Input validation helpers
│   └── output.js             # Formatted output helpers (success/error)
├── config.js                 # EXISTING: reused by CLI
├── pool.js                   # EXISTING: reused by CLI
├── state.js                  # EXISTING: reused for test command
└── engine.js                 # EXISTING: reused for test command

test/
├── cli/                      # NEW: CLI integration tests
│   ├── config.test.js
│   ├── pool.test.js
│   └── test.test.js
└── [existing tests]

package.json                  # MODIFIED: add bin field
```

### Pattern 1: package.json bin Field Configuration
**What:** Declare CLI entry point via bin field for npm/npx execution
**When to use:** Making Node.js script executable as global command
**Example:**
```json
{
  "name": "viberipped",
  "version": "0.1.0",
  "bin": {
    "vibripped": "./bin/vibripped.js"
  }
}
```

After `npm install -g .` or `npm link`, users can run `vibripped config --kettlebell`.

### Pattern 2: Commander Subcommands with Action Handlers
**What:** Define Git-style subcommands with dedicated action handlers for each operation
**When to use:** CLI with multiple distinct operations (config, pool, test)
**Example:**
```javascript
#!/usr/bin/env node
// bin/vibripped.js
const { Command } = require('commander');
const program = new Command();

program
  .name('vibripped')
  .description('VibeRipped CLI for exercise rotation management')
  .version('0.1.0');

// Config subcommand
program
  .command('config')
  .description('Configure available equipment')
  .option('--kettlebell', 'Enable kettlebell exercises')
  .option('--dumbbells', 'Enable dumbbell exercises')
  .option('--pull-up-bar', 'Enable pull-up bar exercises')
  .option('--parallettes', 'Enable parallettes exercises')
  .action((options) => {
    require('./lib/cli/commands/config')(options);
  });

// Pool management subcommand
program
  .command('pool')
  .description('Manage exercise pool')
  .command('list')
  .description('List all exercises in current pool')
  .action(() => {
    require('./lib/cli/commands/pool').list();
  });

program.parse(process.argv);
```

### Pattern 3: Custom Validation with Actionable Error Messages
**What:** Validate user input and exit with code 1, providing clear guidance on how to fix
**When to use:** Any CLI operation with user-supplied data
**Example:**
```javascript
// lib/cli/validation.js
function validateExerciseName(name) {
  if (!name || typeof name !== 'string') {
    console.error('Error: Exercise name is required');
    console.error('Usage: vibripped pool add "Exercise name" <reps>');
    process.exit(1);
  }

  if (name.length > 50) {
    console.error('Error: Exercise name too long (max 50 characters)');
    process.exit(1);
  }

  return name.trim();
}

function validateReps(reps) {
  const parsed = parseInt(reps, 10);

  if (isNaN(parsed) || parsed < 1 || parsed > 999) {
    console.error('Error: Reps must be a number between 1 and 999');
    console.error('Usage: vibripped pool add "Exercise name" <reps>');
    process.exit(1);
  }

  return parsed;
}

module.exports = { validateExerciseName, validateReps };
```

### Pattern 4: Dry-Run Mode via Flag and Read-Only Operations
**What:** Execute command logic without persisting changes, showing what would happen
**When to use:** Testing or previewing operations before committing
**Example:**
```javascript
// lib/cli/commands/test.js
const { trigger } = require('../../engine');

function testCommand(options) {
  // Dry-run: bypass cooldown, don't save state
  const result = trigger(null, {
    bypassCooldown: true,
    dryRun: true  // Flag to skip state persistence
  });

  if (result.type === 'exercise') {
    console.log(`Next exercise: ${result.prompt}`);
    console.log(`Position: ${result.position.current + 1}/${result.position.total}`);
  }

  process.exit(0);
}

module.exports = testCommand;
```

For true read-only, engine.js would check `options.dryRun` and skip saveState() call.

### Pattern 5: Atomic JSON Updates with Pre-Load Validation
**What:** Load existing JSON, validate, merge changes, write atomically
**When to use:** Updating configuration.json or pool.json without overwriting valid data
**Example:**
```javascript
// lib/cli/commands/config.js
const fs = require('fs');
const path = require('path');
const writeFileAtomic = require('write-file-atomic');
const { getConfigPath, loadConfig, validateConfig } = require('../../config');

function configCommand(options) {
  const configPath = getConfigPath();

  // Load existing config (fail-safe to defaults)
  const currentConfig = loadConfig(configPath);

  // Merge CLI options with existing config
  const newConfig = {
    equipment: {
      kettlebell: options.kettlebell ?? currentConfig.equipment.kettlebell,
      dumbbells: options.dumbbells ?? currentConfig.equipment.dumbbells,
      pullUpBar: options.pullUpBar ?? currentConfig.equipment.pullUpBar,
      parallettes: options.parallettes ?? currentConfig.equipment.parallettes
    }
  };

  // Validate before writing
  if (!validateConfig(newConfig)) {
    console.error('Error: Invalid configuration');
    process.exit(1);
  }

  // Atomic write
  const configDir = path.dirname(configPath);
  fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
  writeFileAtomic.sync(configPath, JSON.stringify(newConfig, null, 2), { mode: 0o600 });

  console.log('Configuration updated successfully');
  console.log(`Kettlebell: ${newConfig.equipment.kettlebell}`);
  console.log(`Dumbbells: ${newConfig.equipment.dumbbells}`);
  console.log(`Pull-up bar: ${newConfig.equipment.pullUpBar}`);
  console.log(`Parallettes: ${newConfig.equipment.parallettes}`);

  process.exit(0);
}

module.exports = configCommand;
```

### Pattern 6: CLI Integration Testing with child_process.spawn
**What:** Spawn CLI as subprocess, capture stdout/stderr, assert on output and exit codes
**When to use:** Integration tests that verify end-to-end CLI behavior
**Example:**
```javascript
// test/cli/config.test.js
const { describe, test } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('child_process');
const path = require('path');

function runCLI(args) {
  return new Promise((resolve, reject) => {
    const cli = spawn('node', [path.join(__dirname, '../../bin/vibripped.js'), ...args]);

    let stdout = '';
    let stderr = '';

    cli.stdout.on('data', (data) => { stdout += data.toString(); });
    cli.stderr.on('data', (data) => { stderr += data.toString(); });

    cli.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });

    cli.on('error', reject);
  });
}

describe('vibripped config', () => {
  test('sets equipment flags', async () => {
    const result = await runCLI(['config', '--kettlebell', '--dumbbells']);

    assert.strictEqual(result.code, 0);
    assert.match(result.stdout, /Kettlebell: true/);
    assert.match(result.stdout, /Dumbbells: true/);
  });

  test('shows error for invalid input', async () => {
    const result = await runCLI(['config', '--invalid-flag']);

    assert.strictEqual(result.code, 1);
    assert.match(result.stderr, /unknown option/i);
  });
});
```

### Anti-Patterns to Avoid
- **Interactive prompts without flag bypass:** Don't require interactive input for automation. Always support declarative flags (e.g., `--kettlebell` not prompt).
- **Silent failures:** Don't suppress errors. Exit with code 1 and print clear error messages to stderr.
- **Inconsistent exit codes:** Don't use arbitrary codes. Use 0 for success, 1 for user errors, never use process.exit() without setting exitCode first.
- **Manual argument parsing:** Don't parse process.argv manually. Use commander for consistent help, validation, and error handling.
- **Mutating state in dry-run mode:** Don't save state when testing. Add dryRun flag to skip persistence entirely.
- **Non-atomic writes:** Don't use fs.writeFileSync directly for config/pool. Use write-file-atomic to prevent corruption.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Argument parsing | Manual process.argv slicing | commander.js | Automatic help generation, validation, type coercion, subcommands, error handling |
| Validation library | Custom schema validator | Manual validation functions | Config has 4 boolean fields, manual validation matches existing lib/config.js patterns |
| Interactive prompts | Custom readline wrapper | None (use flags only) | Automation-friendly, scriptable, no TTY requirements |
| Progress indicators | Custom spinner | None (operations are instant) | JSON file I/O completes in <10ms, no need for visual feedback |
| Exit code handling | Scattered process.exit() | Set process.exitCode, throw errors | Allows cleanup, consistent error propagation |

**Key insight:** CLI tooling should be thin wrappers around existing library functions (lib/config.js, lib/pool.js, lib/engine.js). Commander handles argument parsing and routing; validation follows existing patterns; file operations reuse write-file-atomic. The CLI's job is ergonomics and error messages, not reimplementing logic.

## Common Pitfalls

### Pitfall 1: Forgetting Shebang Line in bin Script
**What goes wrong:** CLI script runs as text file, not executable Node.js script
**Why it happens:** package.json bin field requires executable script, shebang tells OS which interpreter to use
**How to avoid:** Add `#!/usr/bin/env node` as first line of bin/vibripped.js
**Warning signs:** Error "command not found" after npm link, or "permission denied"

### Pitfall 2: Commander Options Not Mapping to Boolean Flags
**What goes wrong:** `.option('--kettlebell')` doesn't set value to true/false, returns undefined
**Why it happens:** Commander requires explicit flag behavior for boolean options
**How to avoid:** Use `.option('--kettlebell', 'description')` for boolean flags (presence = true, absence = false)
**Warning signs:** options.kettlebell is undefined instead of true/false

### Pitfall 3: Exit Codes Not Set Before Process Termination
**What goes wrong:** CLI returns exit code 0 even when errors occur, breaking automation
**Why it happens:** Forgetting to call process.exit(1) or set process.exitCode = 1
**How to avoid:** Always set process.exitCode or call process.exit() explicitly in error handlers
**Warning signs:** CI pipelines don't detect failures, shell scripts continue after errors

### Pitfall 4: Pool.json Re-Index Not Triggered After Manual Edit
**What goes wrong:** User adds exercise to pool.json, rotation doesn't include it until manual intervention
**Why it happens:** State's poolHash doesn't update when pool.json changes, only when config changes
**How to avoid:** Engine already handles this via pool hash comparison in loadState() — hash mismatch resets index
**Warning signs:** Newly added exercises never appear in rotation

### Pitfall 5: Dry-Run Mode Still Mutates State
**What goes wrong:** Test command advances rotation state, disrupting user's exercise sequence
**Why it happens:** Forgetting to skip saveState() call when dryRun flag is set
**How to avoid:** Pass dryRun option to trigger(), check it before saveState() call
**Warning signs:** Running `vibripped test` multiple times changes which exercise comes next

### Pitfall 6: Error Messages Without Context
**What goes wrong:** User sees "Invalid input" but doesn't know what's invalid or how to fix it
**Why it happens:** Generic error messages without examples or expected format
**How to avoid:** Print error + usage example: "Error: X is invalid\nUsage: vibripped pool add \"name\" <reps>"
**Warning signs:** User confusion, support requests asking "what's wrong?"

### Pitfall 7: Commander Validation Fires Before Custom Validation
**What goes wrong:** Commander's automatic validation shows generic "option required" instead of custom message
**Why it happens:** Commander validates arguments before .action() handler runs
**How to avoid:** Don't use `.requiredOption()` if you need custom error messages. Validate inside action handler.
**Warning signs:** Generic commander errors instead of custom validation messages

### Pitfall 8: Pool Add/Remove Doesn't Regenerate Pool Hash
**What goes wrong:** User adds exercise via CLI, but state isn't re-indexed because poolHash matches old value
**Why it happens:** Adding to pool.json doesn't automatically recompute hash and reset rotation
**How to avoid:** When writing pool.json, compute new hash and update state.json's poolHash + reset currentIndex
**Warning signs:** Exercises added via CLI don't appear until configuration changes

### Pitfall 9: Relative Paths in bin Script
**What goes wrong:** CLI fails when executed from directories other than project root
**Why it happens:** require('./lib/...') resolves relative to cwd, not script location
**How to avoid:** Use `require(path.join(__dirname, '../lib/...'))` or rely on Node.js module resolution
**Warning signs:** CLI works from project root but fails from subdirectories

### Pitfall 10: Missing npm link During Development
**What goes wrong:** Can't test CLI command `vibripped` during development, only via `node bin/vibripped.js`
**Why it happens:** bin/vibripped.js not symlinked to global bin directory
**How to avoid:** Run `npm link` in project directory to create global symlink for testing
**Warning signs:** Having to use full path to test CLI instead of command name

## Code Examples

Verified patterns from official sources and existing codebase:

### CLI Entry Point with Commander
```javascript
#!/usr/bin/env node
// bin/vibripped.js
// Source: Commander.js subcommand pattern + VibeRipped project structure

const { Command } = require('commander');
const path = require('path');

const program = new Command();

program
  .name('vibripped')
  .description('VibeRipped CLI - Deterministic micro-exercise rotation management')
  .version('0.1.0');

// Config subcommand
program
  .command('config')
  .description('Configure available equipment')
  .option('--kettlebell', 'Enable kettlebell exercises')
  .option('--dumbbells', 'Enable dumbbell exercises')
  .option('--pull-up-bar', 'Enable pull-up bar exercises')
  .option('--parallettes', 'Enable parallettes exercises')
  .action((options) => {
    const configCmd = require(path.join(__dirname, '../lib/cli/commands/config'));
    configCmd(options);
  });

// Pool list subcommand
program
  .command('pool list')
  .alias('pool ls')
  .description('List all exercises in current pool')
  .action(() => {
    const poolCmd = require(path.join(__dirname, '../lib/cli/commands/pool'));
    poolCmd.list();
  });

// Pool add subcommand
program
  .command('pool add <name> <reps>')
  .description('Add exercise to pool')
  .action((name, reps) => {
    const poolCmd = require(path.join(__dirname, '../lib/cli/commands/pool'));
    poolCmd.add(name, reps);
  });

// Pool remove subcommand
program
  .command('pool remove <name>')
  .alias('pool rm')
  .description('Remove exercise from pool')
  .action((name) => {
    const poolCmd = require(path.join(__dirname, '../lib/cli/commands/pool'));
    poolCmd.remove(name);
  });

// Test/dry-run subcommand
program
  .command('test')
  .description('Test exercise output without advancing rotation state')
  .action(() => {
    const testCmd = require(path.join(__dirname, '../lib/cli/commands/test'));
    testCmd();
  });

// Parse arguments
program.parse(process.argv);

// If no arguments, show help
if (process.argv.length === 2) {
  program.outputHelp();
}
```

### Config Command Implementation
```javascript
// lib/cli/commands/config.js
// Source: Existing lib/config.js patterns + commander action handler

const fs = require('fs');
const path = require('path');
const writeFileAtomic = require('write-file-atomic');
const { getConfigPath, loadConfig, validateConfig } = require('../../config');
const { getStateDir } = require('../../state');

function configCommand(options) {
  const configPath = getConfigPath();

  // If no options provided, show current config
  if (!options.kettlebell && !options.dumbbells && !options.pullUpBar && !options.parallettes) {
    const current = loadConfig(configPath);
    console.log('Current equipment configuration:');
    console.log(`  Kettlebell: ${current.equipment.kettlebell}`);
    console.log(`  Dumbbells: ${current.equipment.dumbbells}`);
    console.log(`  Pull-up bar: ${current.equipment.pullUpBar}`);
    console.log(`  Parallettes: ${current.equipment.parallettes}`);
    process.exit(0);
    return;
  }

  // Load existing config (fail-safe to defaults)
  const currentConfig = loadConfig(configPath);

  // Merge CLI options with existing config
  const newConfig = {
    equipment: {
      kettlebell: options.kettlebell ?? currentConfig.equipment.kettlebell,
      dumbbells: options.dumbbells ?? currentConfig.equipment.dumbbells,
      pullUpBar: options.pullUpBar ?? currentConfig.equipment.pullUpBar,
      parallettes: options.parallettes ?? currentConfig.equipment.parallettes
    }
  };

  // Validate before writing
  if (!validateConfig(newConfig)) {
    console.error('Error: Invalid configuration');
    process.exit(1);
    return;
  }

  // Atomic write
  try {
    const configDir = path.dirname(configPath);
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
    writeFileAtomic.sync(configPath, JSON.stringify(newConfig, null, 2), { mode: 0o600 });
  } catch (e) {
    console.error(`Error: Failed to write configuration: ${e.message}`);
    process.exit(1);
    return;
  }

  console.log('✓ Configuration updated successfully');
  console.log(`  Kettlebell: ${newConfig.equipment.kettlebell}`);
  console.log(`  Dumbbells: ${newConfig.equipment.dumbbells}`);
  console.log(`  Pull-up bar: ${newConfig.equipment.pullUpBar}`);
  console.log(`  Parallettes: ${newConfig.equipment.parallettes}`);
  console.log('');
  console.log('Pool will regenerate on next trigger.');

  process.exit(0);
}

module.exports = configCommand;
```

### Pool List Command Implementation
```javascript
// lib/cli/commands/pool.js (list function)
// Source: Existing lib/pool.js + fs.readFileSync patterns

const fs = require('fs');
const path = require('path');
const { getStateDir } = require('../../state');

function listPool() {
  const poolPath = path.join(getStateDir(), 'pool.json');

  // Try to load pool.json
  let pool;
  try {
    const content = fs.readFileSync(poolPath, 'utf8');
    pool = JSON.parse(content);
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.error('Error: No pool found. Run initial setup first:');
      console.error('  vibripped config --kettlebell --dumbbells');
      process.exit(1);
      return;
    }
    console.error(`Error: Failed to read pool: ${e.message}`);
    process.exit(1);
    return;
  }

  // Validate pool structure
  if (!Array.isArray(pool) || pool.length === 0) {
    console.error('Error: Pool is empty or invalid');
    process.exit(1);
    return;
  }

  // Display pool
  console.log(`Exercise pool (${pool.length} exercises):\n`);
  pool.forEach((exercise, index) => {
    const equipment = exercise.equipment && exercise.equipment.length > 0
      ? ` [${exercise.equipment.join(', ')}]`
      : ' [bodyweight]';
    console.log(`  ${index + 1}. ${exercise.name} x${exercise.reps}${equipment}`);
  });

  process.exit(0);
}

module.exports = { list: listPool };
```

### Test Command Implementation (Dry-Run)
```javascript
// lib/cli/commands/test.js
// Source: Existing engine.js trigger() + bypassCooldown pattern

const { trigger } = require('../../engine');

function testCommand() {
  console.log('Testing next exercise (dry-run mode)...\n');

  try {
    // Bypass cooldown for testing
    const result = trigger(null, { bypassCooldown: true });

    if (result.type === 'exercise') {
      console.log(`Next exercise: ${result.prompt}`);
      console.log(`Position: ${result.position.current + 1} of ${result.position.total}`);
      console.log(`Total triggered: ${result.totalTriggered}`);
      console.log('');
      console.log('(State not advanced - rotation position unchanged)');
    } else {
      console.error('Unexpected result type');
      process.exit(1);
    }
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }

  process.exit(0);
}

module.exports = testCommand;
```

### Pool Add Command with Validation
```javascript
// lib/cli/commands/pool.js (add function)
// Source: Validation patterns + atomic write from existing modules

const fs = require('fs');
const path = require('path');
const writeFileAtomic = require('write-file-atomic');
const { getStateDir } = require('../../state');
const { computePoolHash } = require('../../pool');

function addExercise(name, repsStr) {
  const poolPath = path.join(getStateDir(), 'pool.json');
  const statePath = path.join(getStateDir(), 'state.json');

  // Validate name
  if (!name || name.trim().length === 0) {
    console.error('Error: Exercise name cannot be empty');
    console.error('Usage: vibripped pool add "<name>" <reps>');
    process.exit(1);
    return;
  }

  if (name.length > 50) {
    console.error('Error: Exercise name too long (max 50 characters)');
    process.exit(1);
    return;
  }

  // Validate reps
  const reps = parseInt(repsStr, 10);
  if (isNaN(reps) || reps < 1 || reps > 999) {
    console.error('Error: Reps must be a number between 1 and 999');
    console.error('Usage: vibripped pool add "<name>" <reps>');
    process.exit(1);
    return;
  }

  // Load existing pool
  let pool;
  try {
    const content = fs.readFileSync(poolPath, 'utf8');
    pool = JSON.parse(content);
  } catch (e) {
    console.error('Error: Failed to read pool.json');
    console.error('Run initial setup first: vibripped config --kettlebell');
    process.exit(1);
    return;
  }

  // Check for duplicate
  if (pool.some(ex => ex.name.toLowerCase() === name.toLowerCase())) {
    console.error(`Error: Exercise "${name}" already exists in pool`);
    process.exit(1);
    return;
  }

  // Add exercise (custom exercises have empty equipment array)
  pool.push({ name: name.trim(), reps, equipment: [] });

  // Compute new hash
  const newHash = computePoolHash(pool);

  // Write pool atomically
  try {
    writeFileAtomic.sync(poolPath, JSON.stringify(pool, null, 2), { mode: 0o600 });
  } catch (e) {
    console.error(`Error: Failed to write pool: ${e.message}`);
    process.exit(1);
    return;
  }

  // Update state.json to reflect pool change
  try {
    const stateContent = fs.readFileSync(statePath, 'utf8');
    const state = JSON.parse(stateContent);
    state.poolHash = newHash;
    state.currentIndex = 0; // Reset rotation
    writeFileAtomic.sync(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
  } catch (e) {
    console.error('Warning: Failed to update state.json, rotation may need manual reset');
  }

  console.log(`✓ Added "${name}" x${reps} to pool`);
  console.log('Rotation index reset to beginning.');

  process.exit(0);
}

module.exports = { list: listPool, add: addExercise };
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual process.argv parsing | Commander.js declarative API | Established 2011+ | Automatic help, validation, subcommands, reduced boilerplate |
| Mixed sync/async fs operations | Node.js native util.parseArgs | Node.js 18.3 (2022) | Built-in alternative to commander, but manual subcommand routing |
| Interactive prompts by default | Flag-first design with optional interactive | 2020s shift | Automation-friendly, CI/CD compatible, AI agent compatible |
| Schema validators (joi/zod) for simple configs | Manual validation for small schemas | Ongoing | Zero dependencies for simple cases (4 boolean fields) |
| Multiple executables in bin/ | Single executable with subcommands | Git CLI pattern (2000s) | Unified help, consistent UX, easier to discover commands |

**Deprecated/outdated:**
- yargs for new projects: Commander lighter (0 deps vs 16), simpler API for common cases
- Interactive-only CLIs: Automation and AI agents require flag-based interfaces
- Custom validation libraries for trivial schemas: Manual validation sufficient for <10 fields

## Open Questions

1. **Should pool commands support equipment tagging for custom exercises?**
   - What we know: Default exercises have equipment tags (kettlebell, dumbbells, etc.)
   - What's unclear: When user adds custom exercise via CLI, should they specify equipment?
   - Recommendation: Start with no equipment tags for custom exercises (equipment: []). Phase 6 can add `--equipment kettlebell` flag if needed.

2. **Should test command show multiple upcoming exercises or just next one?**
   - What we know: Current rotation state has single currentIndex
   - What's unclear: Is "next exercise" enough, or should users preview next 3-5?
   - Recommendation: Start with single next exercise. If users request preview, add `--preview 5` flag in future.

3. **Should config command support clearing all equipment (reset to bodyweight-only)?**
   - What we know: `vibripped config --kettlebell` sets kettlebell=true, but how to set false?
   - What's unclear: Negation syntax (--no-kettlebell) or separate reset command?
   - Recommendation: Support `--no-kettlebell` via commander's negatable options: `.option('--kettlebell', 'enable').option('--no-kettlebell', 'disable')`

4. **Should CLI commands operate on pool.json directly or always regenerate from config?**
   - What we know: Engine preserves pool.json edits when config unchanged
   - What's unclear: Should pool add/remove edit pool.json directly (preserves manual edits) or regenerate from database?
   - Recommendation: Edit pool.json directly. User edits are first-class, not overwritten unless config changes.

5. **Should dry-run mode show actual state or hypothetical state?**
   - What we know: Test command bypasses cooldown to show next exercise
   - What's unclear: Should it show "you'd see this now" (respecting cooldown) or "next exercise in queue"?
   - Recommendation: Show next exercise in queue (bypass cooldown). Purpose is testing rotation, not simulating statusline.

## Sources

### Primary (HIGH confidence)
- [commander - npm](https://www.npmjs.com/package/commander) - Current version 14.0.3, zero dependencies, API documentation
- [GitHub - tj/commander.js](https://github.com/tj/commander.js) - Official repository, examples, subcommand patterns
- [The Definitive Guide to Commander.js | Better Stack Community](https://betterstack.com/community/guides/scaling-nodejs/commander-explained/) - Comprehensive tutorial, validation examples
- Existing VibeRipped codebase (lib/config.js, lib/pool.js, lib/state.js, engine.js) - Proven patterns for file operations, validation, fail-safe defaults
- [Node.js Exit Codes - GeeksforGeeks](https://www.geeksforgeeks.org/node-js/node-js-exit-codes/) - Standard exit code conventions

### Secondary (MEDIUM confidence)
- [commander vs yargs | npm-compare](https://npm-compare.com/commander,yargs) - Download statistics (245M vs 127M weekly), dependency count comparison
- [Building CLI Applications Made Easy with These NodeJS Frameworks | Medium](https://ibrahim-haouari.medium.com/building-cli-applications-made-easy-with-these-nodejs-frameworks-2c06d1ff7a51) - Framework comparison, use case recommendations
- [A guide to creating a NodeJS command-line package | Medium](https://medium.com/netscape/a-guide-to-create-a-nodejs-command-line-package-c2166ad0452e) - package.json bin field, shebang usage, npm link workflow
- [In Praise of --dry-run | Henrik Warne's blog](https://henrikwarne.com/2026/01/31/in-praise-of-dry-run/) - Dry-run mode patterns, preview vs execution
- [Integration tests on Node.js CLI: Part 1 | Medium](https://medium.com/@zorrodg/integration-tests-on-node-js-cli-part-1-why-and-how-fa5b1ba552fe) - child_process.spawn testing patterns, stdout/stderr capture

### Tertiary (LOW confidence - needs validation)
- [Parsing command line arguments with util.parseArgs() in Node.js | 2ality](https://2ality.com/2022/08/node-util-parseargs.html) - Built-in alternative to commander, but lacks subcommand routing (experimental until Node.js 20)
- chalk/ora package usage - Community uses for color/spinners, but VibeRipped's zero-dependency philosophy and instant operations make them unnecessary

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Commander 14.x proven, zero new dependencies beyond commander itself
- Architecture: HIGH - Subcommand patterns match Git CLI conventions, existing modules provide all primitives
- Pitfalls: MEDIUM - Common CLI mistakes documented, but VibeRipped-specific edge cases (pool hash re-indexing) need validation during implementation

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (30 days - CLI domain stable, commander 14.x mature, Node.js built-ins unchanging)
