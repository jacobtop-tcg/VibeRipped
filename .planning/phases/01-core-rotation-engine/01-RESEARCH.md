# Phase 1: Core Rotation Engine - Research

**Researched:** 2026-02-08
**Domain:** Standalone CLI tool with persistent state management
**Confidence:** HIGH

## Summary

Phase 1 implements a standalone, deterministic exercise rotation engine as a Node.js CLI tool that accepts JSON via stdin and outputs structured data via stdout. The engine maintains persistent state across sessions using atomic file writes, enforces cooldown intervals to prevent over-triggering, and recovers gracefully from state corruption by resetting to defaults.

Node.js is the optimal choice for this phase due to its native JSON handling, excellent stdin/stdout performance with non-blocking I/O, mature ecosystem for atomic file operations, and seamless integration with Claude Code's statusline provider requirements (Phase 3). The implementation centers on three core concerns: deterministic sequential rotation through an exercise pool, crash-safe persistent state with atomic writes, and cooldown enforcement using wall-clock timestamps.

**Primary recommendation:** Use Node.js with `write-file-atomic` for state persistence, native `crypto` module for pool change detection, and simple modulo arithmetic for rotation logic. Keep the implementation minimal—no dependencies beyond atomic file writing—and design for Phase 3 stdin/stdout integration from the start.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Prompt format & tone:**
- Bare minimum detail: just the action (e.g., "20 pushups") — no form cues, no explanation
- Zero motivational language — crisp command format as specified in roadmap
- Tone guidance is sufficient from roadmap requirements; no additional style constraints

**Cooldown behavior:**
- Cooldown interval: Claude's discretion on default value
- Configurability: Claude decides whether to hardcode or make it configurable in Phase 1
- During cooldown trigger: Claude decides behavior (silent skip vs returning remaining time)
- Clock basis: Claude decides (wall-clock simplest for Phase 1 since process detection is Phase 3)

**State file & recovery:**
- On corruption or missing state: reset to beginning of rotation (exercise 0)
- No backup of corrupted files — just reset cleanly
- State format: Claude's discretion (JSON likely, consistent with Phase 2 pool files)
- State location: Claude's discretion (XDG-style ~/.config/viberipped/ likely)
- Write safety: Claude's discretion on atomic write-rename vs simple writes

**Rotation logic:**
- Sequential rotation as specified in roadmap — predictability builds trust
- Wrap-around behavior: Claude's discretion (simple loop vs shuffle on wrap)
- Default pool: Claude's discretion on composition (bodyweight-only is the safe bet pre-Phase 2)
- Stats tracking: Claude's discretion on whether to include basic counters

### Claude's Discretion

- Default cooldown interval duration
- Whether cooldown is configurable in Phase 1 or hardcoded
- Cooldown trigger behavior (silent skip vs remaining time response)
- Wall-clock vs processing-time cooldown (Phase 1 likely wall-clock)
- State file format and location
- Atomic write-rename vs simple writes
- Wrap-around behavior (loop vs shuffle)
- Default exercise pool composition
- Whether to track basic stats (total prompts emitted)
- Language/runtime choice
- Rep count approach (per-exercise defaults vs single default)
- Output data shape

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | v18+ LTS | Runtime and CLI foundation | Native JSON, excellent stdin/stdout I/O, mature fs APIs, built-in crypto for hashing |
| write-file-atomic | 5.0+ | Atomic state file writes | Industry standard from npm org, prevents corruption on crash, handles temp-rename pattern with configurable fsync |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ajv | 8.17+ | JSON schema validation | Optional—validate state file schema on read to detect corruption early, catches structural errors before logic errors |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Node.js | Python | Python has mature ecosystem but Node.js offers superior JSON/stdin/stdout performance for CLI tools, better fit for Phase 3 requirements |
| write-file-atomic | Manual fs.writeFile + rename | Could hand-roll but `write-file-atomic` handles edge cases (permissions, fsync, cross-platform atomicity, queueing concurrent writes) |
| Native crypto | External hash library | Native crypto.createHash is sufficient for SHA256 pool change detection, no external deps needed |

**Installation:**
```bash
npm install write-file-atomic
# Optional for state validation:
npm install ajv
```

## Architecture Patterns

### Recommended Project Structure

```
viberipped-engine/
├── engine.js              # Main entry point with shebang
├── lib/
│   ├── rotation.js        # Sequential rotation logic with modulo wrap
│   ├── state.js           # State persistence with atomic writes
│   ├── cooldown.js        # Timestamp-based cooldown enforcement
│   └── pool.js            # Exercise pool definition and hashing
├── package.json           # Minimal deps: write-file-atomic
└── README.md
```

### Pattern 1: Atomic State Persistence

**What:** Write to temporary file, sync to disk, then atomically rename to target path. Prevents partial writes from crashes.

**When to use:** Any persistent state that must survive process crashes without corruption.

**Example:**
```javascript
// Source: https://www.npmjs.com/package/write-file-atomic
// Source: https://github.com/npm/write-file-atomic
const writeFileAtomic = require('write-file-atomic');

async function saveState(state) {
  const statePath = path.join(os.homedir(), '.config', 'viberipped', 'state.json');
  const stateJson = JSON.stringify(state, null, 2);

  // Atomic write: tmp file → fsync → rename
  // If crash occurs before rename, temp is cleaned up; target is untouched
  await writeFileAtomic(statePath, stateJson, { mode: 0o600 });
}
```

**Key insight:** The atomic rename operation ensures the state file is either fully written or not modified at all—no partial corruption.

### Pattern 2: Graceful State Recovery with Try-Catch

**What:** Attempt to read and parse state; on any error (missing file, corrupt JSON, invalid schema), reset to defaults.

**When to use:** Loading persistent state at startup when corruption is possible.

**Example:**
```javascript
// Source: https://www.geeksforgeeks.org/javascript/how-to-catch-json-parse-error-in-javascript/
// Source: https://thecodersblog.com/JSON-error/
function loadState() {
  const statePath = path.join(os.homedir(), '.config', 'viberipped', 'state.json');

  try {
    const content = fs.readFileSync(statePath, 'utf8');
    const state = JSON.parse(content);

    // Optional: validate against schema with Ajv
    if (!validateStateSchema(state)) {
      console.error('State schema invalid, resetting');
      return getDefaultState();
    }

    return state;
  } catch (err) {
    // ENOENT (file missing), SyntaxError (JSON parse), or validation error
    if (err.code === 'ENOENT') {
      console.log('No state file found, initializing');
    } else {
      console.error('State corrupted, resetting:', err.message);
    }
    return getDefaultState();
  }
}

function getDefaultState() {
  return {
    currentIndex: 0,
    lastTriggerTime: 0,
    poolHash: computePoolHash(exercisePool),
    totalTriggered: 0
  };
}
```

**Key insight:** Never crash on corrupt state—always have a safe fallback. User constraint requires clean reset on corruption.

### Pattern 3: Sequential Rotation with Modulo Wrap-Around

**What:** Use modulo arithmetic to cycle through array indices deterministically. Index advances linearly, wraps at array boundary.

**When to use:** Deterministic sequential cycling through a bounded collection.

**Example:**
```javascript
// Source: https://blog.logrocket.com/mastering-modulo-operator-javascript/
// Source: http://heatheryou.com/using_the_modulo_operator_to_rotate_arrays
function getNextExercise(state, pool) {
  const exercise = pool[state.currentIndex];

  // Advance index with modulo wrap-around
  // (currentIndex + 1) % pool.length ensures: 0, 1, 2, ..., N-1, 0, 1, ...
  state.currentIndex = (state.currentIndex + 1) % pool.length;

  return exercise;
}
```

**Key insight:** Modulo operator provides elegant wrap-around without conditionals. Always reduce rotation by pool length to handle edge cases.

### Pattern 4: Timestamp-Based Cooldown

**What:** Store last trigger time as Unix timestamp (milliseconds). On trigger, check if `Date.now() - lastTriggerTime >= cooldownMs`.

**When to use:** Rate limiting triggers based on wall-clock time.

**Example:**
```javascript
// Source: https://zread.ai/Mirrowel/LLM-API-Key-Proxy/19-cooldown-management-for-rate-limiting
// Source: https://oneuptime.com/blog/post/2026-01-30-sliding-window-rate-limiting/view
function checkCooldown(state, cooldownMs) {
  const now = Date.now();
  const elapsed = now - state.lastTriggerTime;

  if (elapsed < cooldownMs) {
    const remaining = cooldownMs - elapsed;
    return { allowed: false, remainingMs: remaining };
  }

  return { allowed: true, remainingMs: 0 };
}

function triggerExercise(state, pool, cooldownMs) {
  const cooldown = checkCooldown(state, cooldownMs);

  if (!cooldown.allowed) {
    // Decision point: silent skip vs return remaining time
    return { skipped: true, remainingMs: cooldown.remainingMs };
  }

  const exercise = getNextExercise(state, pool);
  state.lastTriggerTime = Date.now();
  state.totalTriggered++;

  return { skipped: false, exercise };
}
```

**Key insight:** Wall-clock cooldown is simplest for Phase 1. Store timestamps in milliseconds (JavaScript Date.now() standard). Phase 3 will add processing-time detection.

### Pattern 5: Pool Change Detection with SHA256

**What:** Compute SHA256 hash of serialized pool. Store hash in state. On load, compare current pool hash to stored hash. If mismatch, reset index to 0.

**When to use:** Detecting when data structure has changed between sessions (STMG-03 requirement).

**Example:**
```javascript
// Source: https://medium.com/@suyotechsolutions/how-to-create-sha-256-in-nodejs-6e40403af500
// Source: https://futurestud.io/tutorials/node-js-calculate-a-sha256-hash
const crypto = require('crypto');

function computePoolHash(pool) {
  const poolJson = JSON.stringify(pool);
  return crypto.createHash('sha256')
    .update(poolJson, 'utf8')
    .digest('hex');
}

function detectPoolChange(state, pool) {
  const currentHash = computePoolHash(pool);

  if (state.poolHash !== currentHash) {
    console.log('Exercise pool changed, resetting rotation');
    state.currentIndex = 0;
    state.poolHash = currentHash;
    return true;
  }

  return false;
}
```

**Key insight:** SHA256 provides collision-resistant change detection. Native Node.js crypto is sufficient—no external deps needed.

### Pattern 6: Stdin JSON Parsing (Line-Buffered)

**What:** Read single-line JSON from stdin, parse it, execute command, output JSON to stdout. Matches Phase 3 statusline provider protocol.

**When to use:** CLI tools that communicate via JSON stdin/stdout with parent process.

**Example:**
```javascript
// Source: https://dev.to/sudiip__17/understanding-stdinstdout-building-cli-tools-like-a-pro-2njk
// Source: https://kellyjonbrazil.github.io/jc/
const readline = require('readline');

function startEngine() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on('line', async (line) => {
    try {
      const input = JSON.parse(line);
      const result = await handleCommand(input);

      // Output to stdout for parent process
      console.log(JSON.stringify(result));
    } catch (err) {
      // Errors to stderr, data to stdout
      console.error('Error:', err.message);
      console.log(JSON.stringify({ error: err.message }));
    }
  });
}
```

**Key insight:** Separate data (stdout) from diagnostics (stderr). Line-buffered JSON is standard for stdin/stdout communication. Phase 3 will consume this protocol.

### Pattern 7: XDG Base Directory for Config

**What:** Store config/state in `$XDG_CONFIG_HOME/viberipped/` (defaults to `~/.config/viberipped/`). Follow XDG Base Directory spec for portability.

**When to use:** Any user-specific application state on Unix-like systems.

**Example:**
```javascript
// Source: https://wiki.archlinux.org/title/XDG_Base_Directory
// Source: https://specifications.freedesktop.org/basedir/latest/
const os = require('os');
const path = require('path');
const fs = require('fs');

function getStateDir() {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME ||
                        path.join(os.homedir(), '.config');
  const stateDir = path.join(xdgConfigHome, 'viberipped');

  // Create directory if it doesn't exist (recursive: true for nested paths)
  fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });

  return stateDir;
}

function getStatePath() {
  return path.join(getStateDir(), 'state.json');
}
```

**Key insight:** XDG_CONFIG_HOME defaults to `~/.config`. Use `{ recursive: true }` to create parent directories. Set mode 0o700 for user-only access.

### Pattern 8: Process Exit Codes

**What:** Exit with code 0 for success, non-zero for errors. Follow POSIX conventions for CLI tools.

**When to use:** All CLI tools that need to signal success/failure to parent process.

**Example:**
```javascript
// Source: https://nodejs.org/api/process.html
// Source: https://www.geeksforgeeks.org/node-js/node-js-exit-codes/
// Exit code 0: success
process.exitCode = 0;

// Exit code 1: general error
if (errorOccurred) {
  console.error('Error:', errorMessage);
  process.exitCode = 1;
}

// Exit code 2: misuse (invalid args)
if (invalidUsage) {
  console.error('Usage: engine.js');
  process.exitCode = 2;
}

// Let process exit naturally - avoid process.exit() which skips cleanup
```

**Key insight:** Set `process.exitCode` rather than calling `process.exit()` directly. Allows async operations to complete gracefully.

### Anti-Patterns to Avoid

- **Checking file existence before read:** Use try-catch around `fs.readFileSync` instead of `fs.existsSync` followed by read—eliminates race condition and simplifies code (TOCTOU vulnerability).
- **Simple `fs.writeFileSync` for state:** No crash safety. Use atomic write-rename pattern to prevent corruption.
- **Global variables for state:** Pass state explicitly to functions. Makes testing easier and prevents hidden dependencies.
- **Hardcoded paths:** Use XDG Base Directory spec with environment variable fallbacks for portability.
- **Calling `process.exit()` directly:** Skips async cleanup. Set `process.exitCode` and let process exit naturally.
- **Seconds vs milliseconds confusion:** JavaScript Date.now() returns milliseconds. Be consistent—store milliseconds, convert to seconds only when needed for display.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file writes | Custom write-to-temp + rename logic | `write-file-atomic` | Handles edge cases: fsync ordering, permission preservation, cross-platform atomicity, concurrent write queueing, cleanup on failure |
| JSON schema validation | Manual property checking | `ajv` | Industry-standard validator, handles nested schemas, provides detailed error messages, compiled validators are fast |
| SHA256 hashing | External crypto library | Node.js native `crypto` module | Built-in, no deps, sufficient for pool change detection, well-tested |
| Directory creation | Manual recursive mkdir | `fs.mkdirSync` with `{ recursive: true }` | Native solution since Node.js v10.12, handles nested paths, idempotent |

**Key insight:** Don't reinvent atomic writes—write-file-atomic handles platform differences (Windows vs POSIX), fsync ordering for durability, and concurrent write queueing. For Phase 1, avoid over-engineering: native Node.js APIs cover most needs.

## Common Pitfalls

### Pitfall 1: State Corruption from Non-Atomic Writes

**What goes wrong:** Using `fs.writeFileSync()` directly leaves state file partially written if process crashes mid-write. Next load attempts to parse corrupt JSON and fails ungracefully.

**Why it happens:** Filesystem writes are not atomic—OS may buffer writes and flush later. Crash during flush leaves partial data on disk.

**How to avoid:** Use `write-file-atomic` which writes to temp file first, syncs to disk, then atomically renames. If crash occurs before rename, temp file is cleaned up and target is untouched.

**Warning signs:** Intermittent JSON parse errors after process crashes, especially under load or on slow storage.

### Pitfall 2: ENOENT Race Condition (TOCTOU)

**What goes wrong:** Checking `fs.existsSync()` before `fs.readFileSync()` introduces race condition—file could be deleted between check and read.

**Why it happens:** Time-of-check-time-of-use (TOCTOU) vulnerability. Two separate syscalls with time gap between them.

**How to avoid:** Skip existence check. Use try-catch around `fs.readFileSync()` and handle `ENOENT` error directly. Simpler code, eliminates race condition.

**Warning signs:** Rare, non-reproducible errors when file system is under concurrent access.

**Example:**
```javascript
// WRONG: TOCTOU vulnerability
if (fs.existsSync(statePath)) {
  const data = fs.readFileSync(statePath, 'utf8'); // File could be deleted here
}

// CORRECT: Just try to read, handle error
try {
  const data = fs.readFileSync(statePath, 'utf8');
} catch (err) {
  if (err.code === 'ENOENT') {
    // Handle missing file
  }
}
```

### Pitfall 3: Seconds vs Milliseconds Timestamp Confusion

**What goes wrong:** Mixing seconds and milliseconds timestamps causes dates to appear decades off or cooldowns to trigger immediately.

**Why it happens:** JavaScript Date.now() returns milliseconds, but Unix timestamps are often seconds. Easy to mix formats.

**How to avoid:** Be consistent—store milliseconds throughout (JavaScript standard), convert to seconds only when displaying or interacting with external APIs that require seconds. Use clear variable names (`lastTriggerMs`, not `lastTrigger`).

**Warning signs:** Cooldowns never expire, or expire immediately. Dates in year 1970 or 50000+.

**Example:**
```javascript
// WRONG: Mixing formats
const cooldownSeconds = 60;
const lastTriggerMs = Date.now();
if (Date.now() - lastTriggerMs >= cooldownSeconds) { // Comparing ms to seconds!
  // Will always be true
}

// CORRECT: Consistent milliseconds
const cooldownMs = 60 * 1000;
const lastTriggerMs = Date.now();
if (Date.now() - lastTriggerMs >= cooldownMs) {
  // Correct comparison
}
```

### Pitfall 4: Not Creating Parent Directories

**What goes wrong:** `fs.writeFileSync()` fails with `ENOENT` if parent directory doesn't exist, even for state file writes.

**Why it happens:** Filesystem APIs don't auto-create parent directories. First run on fresh system has no config directory.

**How to avoid:** Use `fs.mkdirSync(dir, { recursive: true })` before writing state. The `recursive: true` option creates nested directories like `mkdir -p`.

**Warning signs:** "ENOENT: no such file or directory" on first run, works on subsequent runs.

### Pitfall 5: Pool Hash Not Updated After Pool Change

**What goes wrong:** State file stores old pool hash. When pool changes, hash mismatch is detected but state.poolHash is never updated with new hash. Next load detects change again, resetting index every time.

**Why it happens:** Forgot to update `state.poolHash` after detecting change.

**How to avoid:** After detecting pool change and resetting index, immediately update `state.poolHash` with new hash and save state.

**Warning signs:** Rotation resets to exercise 0 on every trigger, never advances through pool.

### Pitfall 6: Modulo with Negative Numbers

**What goes wrong:** In JavaScript, `(-1) % 5` returns `-1`, not `4`. If index somehow goes negative, modulo doesn't wrap correctly.

**Why it happens:** JavaScript modulo preserves sign of dividend (different from Python's modulo).

**How to avoid:** Ensure index never goes negative (simple increment only). If decrement is needed, use `((index - 1) % length + length) % length` to handle negatives correctly.

**Warning signs:** Array index out of bounds errors, NaN indices.

### Pitfall 7: Not Handling Corrupted State Schema

**What goes wrong:** State file exists and parses as valid JSON, but has wrong structure (missing fields, wrong types). Code crashes accessing undefined properties.

**Why it happens:** State schema evolved, old state file has outdated structure. Or external tool modified state file.

**How to avoid:** After parsing JSON, validate structure. Either use Ajv schema validation or manual field checks. On validation failure, reset to default state.

**Warning signs:** TypeError: Cannot read property 'X' of undefined, but only with existing state files, not on fresh start.

### Pitfall 8: Blocking stdout in Parent Process

**What goes wrong:** Engine writes to stdout, but parent process (Phase 3 statusline) doesn't read stdout buffer. Buffer fills up, engine blocks on write, appears frozen.

**Why it happens:** Stdout is buffered. If consumer doesn't read, buffer fills and writer blocks.

**How to avoid:** Keep stdout messages small (single-line JSON). Phase 3 must read stdin promptly. Consider stdout.write() with error handling for backpressure.

**Warning signs:** Engine stops responding, CPU usage drops to zero, no errors logged.

## Code Examples

Verified patterns from official sources:

### Basic Ajv Validation (Optional for State Schema)

```javascript
// Source: https://github.com/ajv-validator/ajv/blob/master/README.md
const Ajv = require("ajv");
const ajv = new Ajv();

const stateSchema = {
  type: "object",
  properties: {
    currentIndex: { type: "integer", minimum: 0 },
    lastTriggerTime: { type: "integer", minimum: 0 },
    poolHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
    totalTriggered: { type: "integer", minimum: 0 }
  },
  required: ["currentIndex", "lastTriggerTime", "poolHash"],
  additionalProperties: false
};

const validateState = ajv.compile(stateSchema);

function isValidState(state) {
  const valid = validateState(state);
  if (!valid) {
    console.error('State validation errors:', validateState.errors);
  }
  return valid;
}
```

### Complete Atomic Write Flow

```javascript
// Source: https://www.npmjs.com/package/write-file-atomic
const writeFileAtomic = require('write-file-atomic');
const fs = require('fs');
const path = require('path');

async function persistState(state) {
  const statePath = getStatePath();
  const stateJson = JSON.stringify(state, null, 2);

  try {
    // Atomic write with fsync for durability
    // Mode 0o600 = user read/write only
    await writeFileAtomic(statePath, stateJson, {
      mode: 0o600,
      fsync: true  // Ensures data is flushed to disk
    });
  } catch (err) {
    console.error('Failed to save state:', err.message);
    throw err;
  }
}

// Synchronous version for simple use cases
function persistStateSync(state) {
  const statePath = getStatePath();
  const stateJson = JSON.stringify(state, null, 2);

  const writeFileAtomicSync = require('write-file-atomic').sync;
  writeFileAtomicSync(statePath, stateJson, { mode: 0o600 });
}
```

### Complete State Load with Graceful Recovery

```javascript
function loadStateWithRecovery(pool) {
  const statePath = getStatePath();

  try {
    const content = fs.readFileSync(statePath, 'utf8');
    const state = JSON.parse(content);

    // Validate schema (optional but recommended)
    if (!isValidState(state)) {
      console.error('State schema invalid, resetting to defaults');
      return createDefaultState(pool);
    }

    // Detect pool changes (STMG-03 requirement)
    const currentHash = computePoolHash(pool);
    if (state.poolHash !== currentHash) {
      console.log('Exercise pool changed, resetting rotation index');
      state.currentIndex = 0;
      state.poolHash = currentHash;
    }

    // Bounds check index
    if (state.currentIndex >= pool.length) {
      console.log('Index out of bounds (pool shrunk?), resetting to 0');
      state.currentIndex = 0;
    }

    return state;
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('No state file found, initializing fresh state');
    } else if (err instanceof SyntaxError) {
      console.error('State file corrupted (invalid JSON), resetting');
    } else {
      console.error('Error loading state:', err.message);
    }

    return createDefaultState(pool);
  }
}

function createDefaultState(pool) {
  return {
    currentIndex: 0,
    lastTriggerTime: 0,
    poolHash: computePoolHash(pool),
    totalTriggered: 0
  };
}
```

### CLI Tool Shebang and Executable Setup

```javascript
#!/usr/bin/env node
// Source: https://alexewerlof.medium.com/node-shebang-e1d4b02f731d
// Source: https://medium.com/@alihassanm381/whats-shebang-line-in-nodejs-cli-development-3d8ee121031d

// Must be the very first line
// Tells OS to use Node.js to execute this script
// Make executable: chmod +x engine.js

'use strict';

const state = loadState();
const result = processCommand(state);
console.log(JSON.stringify(result));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual write-temp-rename | `write-file-atomic` npm package | 2014+ | Standardized atomic writes, handles edge cases, cross-platform compatibility |
| Custom directory creation loops | `fs.mkdirSync` with `recursive: true` | Node.js v10.12.0 (2018) | Eliminated need for mkdirp package in most cases |
| Callback-based fs APIs | Promises (`fs.promises`) and async/await | Node.js v10+ (2018) | Cleaner async code, better error handling |
| External JSON validation libraries | Ajv with JSON Schema | Ongoing | Ajv is current standard, extremely fast compiled validators |
| Seconds-based timestamps | Milliseconds (Date.now()) | JavaScript standard | JavaScript native, higher precision, consistent across ecosystem |

**Deprecated/outdated:**
- **mkdirp package:** Native `fs.mkdirSync` with `recursive: true` is now sufficient (Node.js v10.12+)
- **Callback-style fs APIs:** Prefer `fs.promises` or synchronous APIs for CLI tools where simplicity matters
- **Rolling your own atomic writes:** Use battle-tested `write-file-atomic` to avoid platform-specific edge cases

## Open Questions

1. **Cooldown interval default value**
   - What we know: User expects cooldown to prevent over-triggering, no specific duration mandated
   - What's unclear: Optimal default—too short allows spam, too long frustrates legitimate triggers
   - Recommendation: Start with 300000ms (5 minutes) as conservative default, document for Phase 2 configurability. 5 minutes balances preventing accidental re-triggers while allowing intentional rapid exercise changes during active workout sessions.

2. **Output data shape for Phase 3**
   - What we know: Phase 3 consumes stdout as JSON, formats for statusline display
   - What's unclear: Should engine return structured object `{exercise, reps, cooldownRemaining}` or simple string `"Pushups x20"`?
   - Recommendation: Return structured object—gives Phase 3 flexibility to format. Example: `{type: "exercise", name: "Pushups", reps: 20, cooldownRemaining: 0}` or `{type: "cooldown", remainingMs: 120000}`.

3. **Handling pool shrinkage**
   - What we know: Pool hash detects changes, index resets to 0 on hash mismatch
   - What's unclear: If pool shrinks and index is now out of bounds, how to handle?
   - Recommendation: Bounds check on load—if `currentIndex >= pool.length`, reset to 0. Pool hash mismatch already resets to 0, but explicit bounds check provides defense-in-depth.

4. **Stats tracking scope**
   - What we know: User left stats tracking to Claude's discretion
   - What's unclear: Just total triggers? Or per-exercise counts, skip counts, etc.?
   - Recommendation: Start minimal—just `totalTriggered` counter. Phase 5 (analytics) will expand stats significantly. Avoid premature complexity.

5. **Error output during cooldown**
   - What we know: During cooldown, engine should not emit exercise prompt
   - What's unclear: Silent skip (no output) vs. JSON with remaining time?
   - Recommendation: Return JSON with cooldown info—Phase 3 can decide whether to display. Example: `{type: "cooldown", remainingMs: 120000, remainingHuman: "2m 0s"}`. Provides feedback, prevents confusion about whether engine is working.

## Sources

### Primary (HIGH confidence)

- [Ajv JSON Schema Validator (Context7)](/ajv-validator/ajv) - Schema validation patterns, basic usage, TypeScript integration
- [write-file-atomic npm package](https://www.npmjs.com/package/write-file-atomic) - Atomic file write API, options, usage examples
- [write-file-atomic GitHub](https://github.com/npm/write-file-atomic) - Implementation details, edge case handling
- [Node.js fs Module Documentation](https://nodejs.org/api/fs.html) - File system APIs, mkdirSync recursive option
- [Node.js crypto Module Documentation](https://nodejs.org/api/crypto.html) - createHash API, SHA256 usage
- [Node.js Process Documentation](https://nodejs.org/api/process.html) - Exit codes, process.exitCode
- [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir/latest/) - Official spec for config directory locations

### Secondary (MEDIUM confidence)

- [Understanding stdin/stdout: Building CLI Tools](https://dev.to/sudiip__17/understanding-stdinstdout-building-cli-tools-like-a-pro-2njk) - CLI design patterns, stream separation
- [Node.js vs Python 2026 Comparison](https://solguruz.com/blog/nodejs-vs-python/) - Performance analysis for I/O-heavy CLI tools
- [How to Build Sliding Window Rate Limiting](https://oneuptime.com/blog/post/2026-01-30-sliding-window-rate-limiting/view) - Recent (Jan 2026) rate limiting patterns
- [Cooldown Management for Rate Limiting](https://zread.ai/Mirrowel/LLM-API-Key-Proxy/19-cooldown-management-for-rate-limiting) - Timestamp-based cooldown patterns
- [Mastering the Modulo Operator in JavaScript](https://blog.logrocket.com/mastering-modulo-operator-javascript/) - Circular array indexing patterns
- [Using the Modulo Operator to Rotate Arrays](http://heatheryou.com/using_the_modulo_operator_to_rotate_arrays) - Wrap-around rotation examples
- [Complete Guide to Unix Timestamps](https://devtoolspro.org/articles/complete-guide-to-unix-timestamps-conversion-and-best-practices/) - Milliseconds vs seconds best practices
- [Node.js Shebang Guide](https://alexewerlof.medium.com/node-shebang-e1d4b02f731d) - Shebang usage for executable scripts
- [How to Create SHA-256 in Node.js](https://medium.com/@suyotechsolutions/how-to-create-sha-256-in-nodejs-6e40403af500) - Native crypto module patterns
- [Node.js fs.mkdirSync Method](https://www.geeksforgeeks.org/node-js/node-js-fs-mkdirsync-method/) - Recursive directory creation
- [How to Catch JSON Parse Error in JavaScript](https://www.geeksforgeeks.org/javascript/how-to-catch-json-parse-error-in-javascript/) - Error handling patterns
- [Node.js Exit Codes](https://www.geeksforgeeks.org/node-js/node-js-exit-codes/) - Exit code conventions

### Tertiary (LOW confidence - general context only)

- [XDG Base Directory - ArchWiki](https://wiki.archlinux.org/title/XDG_Base_Directory) - Community documentation, practical examples
- [State Machine Design Patterns](https://www.researchgate.net/publication/301109706_Design_Patterns_for_State_Machines) - General state machine theory
- [Circular Buffer Wikipedia](https://en.wikipedia.org/wiki/Circular_buffer) - FIFO logic concepts

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Node.js and write-file-atomic are industry standard, well-documented, stable
- Architecture: HIGH - Patterns verified against official docs and Context7, examples from authoritative sources
- Pitfalls: MEDIUM-HIGH - Based on common Node.js issues documented across multiple sources, though specific edge cases may vary by environment

**Research date:** 2026-02-08

**Valid until:** Approximately 90 days (stable ecosystem, Node.js LTS releases are predictable)

**Phase requirements coverage:**
- ROTN-01 (sequential rotation): Covered by modulo wrap-around pattern
- ROTN-03 (cooldown enforcement): Covered by timestamp-based cooldown pattern
- ROTN-04 (crisp command format): Covered by output format recommendations
- ROTN-05 (persistence across sessions): Covered by atomic write patterns
- STMG-01 (atomic writes): Covered by write-file-atomic pattern
- STMG-02 (graceful recovery): Covered by try-catch state loading pattern
- STMG-03 (pool hash detection): Covered by SHA256 pool hashing pattern
