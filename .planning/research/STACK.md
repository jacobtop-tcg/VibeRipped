# Stack Research: v1.1 Features

**Domain:** CLI Exercise Rotation App - v1.1 Feature Additions
**Researched:** 2026-02-09
**Confidence:** HIGH

## Context

VibeRipped v1.0 ships with: Node.js runtime, Commander.js CLI, built-in test runner (node:test), ANSI escape codes, bash orchestrator, atomic write-rename state, SHA256 hashing, XDG Base Directory storage. Zero external deps besides Commander.js and write-file-atomic.

This research covers ONLY the stack additions needed for v1.1 features:
- npm packaging and distribution
- Interactive terminal prompts (checkboxes, multi-select)
- Category-aware exercise rotation (logic only)
- Timed exercise display
- Environment profiles

## Recommended Stack

### Core Technologies (No Changes)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 20.6.0+ | Runtime environment | v20.6.0+ adds native .env file support, eliminating dotenv dependency for environment profiles |
| Commander.js | ^14.0.3 | CLI argument parsing | Already in use (v1.0); handles option parsing, subcommands, help generation. No interactive prompt features built-in |
| write-file-atomic | ^7.0.0 | Atomic state writes | Already in use (v1.0); maintains existing transactional state update pattern |

### New Dependencies for v1.1

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-------------|
| prompts | ^2.4.2 | Interactive terminal prompts | Lightweight (187 kB), only 2 dependencies (kleur, sisteransi). Supports checkbox, multiselect, confirm, input. Battle-tested (4M+ downloads/week). Alternative: @inquirer/prompts (more features, more deps) |

### What Does NOT Need Dependencies

| Feature | Implementation | Why No Dependency |
|---------|----------------|-------------------|
| Timer display | Node.js built-ins: setInterval + process.stdout.write + ANSI escape codes | Already validated ANSI escape code patterns in v1.0. Timer is just cursor positioning + time formatting |
| Environment profiles | Node.js --env-file flag (v20.6.0+) or process.env | Native Node.js feature as of v20.6.0. No runtime dependency |
| Category-aware rotation | Pure algorithm logic | Extends existing deterministic rotation engine. State management only |
| npm packaging | package.json configuration | Native npm feature. Just configuration, no dependencies |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| npm pack | Preview package before publish | Generates tarball to verify files field includes correct artifacts |
| node:test | Test runner | Already in use (v1.0); no changes needed |
| prepublishOnly | Pre-publish validation | Run tests before npm publish only (not on install) |

## Installation

```bash
# New runtime dependency for interactive prompts
npm install prompts

# No other dependencies required
# Timer, env profiles, category rotation use built-ins
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| prompts | @inquirer/prompts | If you need more complex prompt types (editor, password with masking, expand). Inquirer v10+ is modern API but has more dependencies |
| prompts | Build with node:readline/promises + raw mode | If zero-dependency philosophy is absolute requirement. Requires ~200 LOC to replicate checkbox/multi-select UX (keypress handling, cursor positioning, ANSI rendering) |
| Node.js --env-file | dotenv package | Only if you need to support Node.js <20.6.0 in production. Not needed for v1.1 (require v20.6.0+) |
| Built-in timer | console-countdown npm | Only if you need Pomodoro-specific features or desktop notifications. Built-in approach sufficient for exercise timer display |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| inquirer (legacy v9.x) | Deprecated API, larger bundle size, more dependencies than needed | @inquirer/prompts (modern API) or prompts (lightweight) |
| dotenv | Node.js v20.6.0+ has native --env-file support | Node.js --env-file flag or process.env (already available) |
| chalk/kleur (standalone) | Adds dependency for ANSI colors you already handle with escape codes | Continue using ANSI escape codes directly (validated in v1.0) |
| readline-sync | Blocking/synchronous I/O, doesn't support modern async patterns | prompts or node:readline/promises |
| commander-interactive | Wrapper around Commander.js + Inquirer.js; adds unnecessary abstraction layer | Use Commander.js + prompts directly for explicit control |

## Stack Patterns by Feature

### Interactive Equipment Configuration

**Implementation:**
- Use prompts `checkbox` type for multi-select equipment flags
- Replace current `--kettlebell` boolean options with single interactive prompt
- Maintain Commander.js for non-interactive mode (CI/scripting)

**Code pattern:**
```javascript
// Add interactive fallback to existing config command
program
  .command('config')
  .option('--interactive', 'Interactive equipment selection')
  .option('--kettlebell', 'Enable kettlebell exercises')
  // ... existing options
  .action(async (options) => {
    if (options.interactive) {
      const prompts = require('prompts');
      const response = await prompts({
        type: 'multiselect',
        name: 'equipment',
        message: 'Select available equipment:',
        choices: [
          { title: 'Kettlebell', value: 'kettlebell' },
          { title: 'Dumbbells', value: 'dumbbells' },
          { title: 'Pull-up Bar', value: 'pullUpBar' },
          { title: 'Parallettes', value: 'parallettes' }
        ]
      });
      // Map to existing config handler
    }
    // Existing CLI path
  });
```

### Timed Exercise Display

**Implementation:**
- Use setInterval(updateFn, 1000) for countdown logic
- Use process.stdout.write() + ANSI escape codes for cursor positioning (already validated)
- Format: `MM:SS` with padStart

**Code pattern:**
```javascript
// Extend existing ANSI escape code patterns from v1.0
const ANSI = {
  CURSOR_UP: '\x1b[1A',
  CURSOR_TO_START: '\r',
  CLEAR_LINE: '\x1b[2K',
  // ... existing codes
};

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function displayTimer(seconds) {
  const formatted = formatTime(seconds);
  process.stdout.write(ANSI.CURSOR_TO_START + ANSI.CLEAR_LINE + `Time: ${formatted}`);
}

// Usage
let remaining = 30; // 30 seconds
const timer = setInterval(() => {
  displayTimer(remaining);
  remaining--;
  if (remaining < 0) {
    clearInterval(timer);
    console.log('\nComplete!');
  }
}, 1000);
```

### Environment Profiles

**Implementation:**
- Store profiles as .env.home, .env.gym, .env.travel
- Use Node.js --env-file flag at invocation
- No runtime dependency required

**Usage:**
```bash
# No code changes needed; use at invocation
node --env-file=.env.gym bin/vibripped.js next
node --env-file=.env.home bin/vibripped.js next
```

**Profile format (.env.gym example):**
```bash
VIBERIPPED_KETTLEBELL=true
VIBERIPPED_DUMBBELLS=true
VIBERIPPED_PULL_UP_BAR=true
VIBERIPPED_PARALLETTES=false
```

**Code reads from process.env:**
```javascript
const hasKettlebell = process.env.VIBERIPPED_KETTLEBELL === 'true';
```

### Category-Aware Rotation

**Implementation:**
- Pure state management logic in existing rotation engine
- No new dependencies; extend existing deterministic rotation algorithm
- Add category field to exercise definitions
- Track last-used category in state file

**Code pattern:**
```javascript
// Extend existing rotation state
const state = {
  rotationIndex: 5,
  lastExerciseTimestamp: 1738972800,
  lastCategory: 'upper-body', // NEW
  categoryHistory: ['upper-body', 'lower-body'] // NEW (optional)
};

// Filter exercises by category for rotation
function selectNextExercise(exercises, state) {
  const availableCategories = [...new Set(exercises.map(e => e.category))];
  const nextCategory = availableCategories.find(c => c !== state.lastCategory);
  const categoryExercises = exercises.filter(e => e.category === nextCategory);
  // ... existing rotation logic
}
```

## npm Publishing Configuration

### package.json additions for v1.1:

```json
{
  "name": "viberipped",
  "version": "1.1.0",
  "files": [
    "bin/",
    "lib/",
    "engine.js",
    "README.md",
    "LICENSE"
  ],
  "engines": {
    "node": ">=20.6.0"
  },
  "scripts": {
    "test": "node --test",
    "prepublishOnly": "npm test",
    "prepack": "npm test"
  }
}
```

**Rationale:**
- `files` field: Explicit whitelist prevents accidental inclusion of .planning/, test fixtures, .env files
- `engines`: Enforces Node.js 20.6.0+ for --env-file support
- `prepublishOnly`: Ensures tests pass before publish (doesn't run on install)
- `prepack`: Safety net for local testing with `npm pack`

**Why files field over .npmignore:**
- files field is a whitelist (explicit, safer)
- .npmignore is a blacklist (easy to miss sensitive files)
- files field has precedence over .npmignore
- Recommended by npm best practices 2026

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| prompts@2.4.2 | Node.js 14+ | Requires Node.js 14 or higher; v1.0 already uses Node.js built-ins that require 16+ |
| Commander.js@14.0.3 | prompts@2.4.2 | No conflicts; Commander.js handles argv parsing, prompts handles interactive fallback |
| Node.js 20.6.0+ --env-file | All dependencies | Native flag, no package compatibility concerns |

## Zero-Dependency Philosophy Analysis

### Where we're maintaining it:
- Timer display: Built-in setInterval + process.stdout.write + ANSI
- Environment profiles: Built-in --env-file flag (Node.js 20.6.0+)
- Category rotation: Pure algorithm logic
- State management: Existing write-file-atomic (already a dependency)

### Where we're pragmatically breaking it:
- Interactive prompts: prompts package (187 kB, 2 dependencies)

### Rationale for prompts dependency:

Implementing checkbox/multi-select from scratch requires:
- Raw mode stdin handling (process.stdin.setRawMode)
- Keypress event parsing (arrow keys, space, enter, ctrl sequences)
- ANSI cursor positioning and line management
- Selection state tracking and visual rendering
- Edge case handling (terminal resize, interrupted input)

This is ~200-300 LOC of non-trivial terminal manipulation code. The prompts package:
- Provides battle-tested UX (used by 4M+ downloads/week)
- Only 2 dependencies (kleur for colors, sisteransi for ANSI)
- Total size 187 kB (negligible for CLI app)
- Actively maintained
- Provides consistent UX across platforms

**Trade-off:** Adding 1 dependency with 2 transitive dependencies for professional-grade interactive UX is justified given the LOC and complexity savings.

**Alternative if zero-dependency is ABSOLUTE:**
Use node:readline/promises + raw mode + manual keypress parsing. Estimated 200-300 LOC. Example complexity:
```javascript
const readline = require('readline');
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}
process.stdin.on('keypress', (str, key) => {
  if (key.name === 'up') { /* move cursor up */ }
  if (key.name === 'down') { /* move cursor down */ }
  if (key.name === 'space') { /* toggle selection */ }
  if (key.name === 'return') { /* submit */ }
  // ... ANSI rendering logic
});
```

Not recommended unless there's a strong philosophical requirement.

## Integration Points with Existing v1.0 Stack

### Commander.js Integration
- Add `--interactive` flag to existing `config` command
- Prompts only runs when flag present
- Existing boolean flags (`--kettlebell`, `--no-kettlebell`) continue to work
- Non-interactive mode preserved for CI/scripting

### ANSI Escape Code Reuse
- v1.0 already validates ANSI escape codes for statusline output
- Timer display reuses same cursor positioning patterns
- No new validation needed

### State File Extension
- v1.0 uses write-file-atomic for transactional writes
- v1.1 adds category fields to existing state structure
- No breaking changes to file format (add optional fields)

### XDG Base Directory
- v1.0 already uses XDG Base Directory spec
- Environment profile files live in same directory structure
- No new directory conventions needed

## Sources

**Official Documentation (HIGH confidence):**
- [Node.js Readline Documentation](https://nodejs.org/api/readline.html) — Verified promises API, raw mode, keypress events
- [Node.js Timers Documentation](https://nodejs.org/api/timers.html) — Verified setInterval API
- [npm scripts lifecycle documentation](https://docs.npmjs.com/cli/v8/using-npm/scripts/) — Verified prepublishOnly vs prepare behavior
- [npm files field best practices](https://github.com/npm/cli/wiki/Files-&-Ignores) — Verified files field precedence over .npmignore

**Library Documentation (HIGH confidence):**
- [prompts GitHub Repository](https://github.com/terkelg/prompts) — Verified v2.4.2 features, dependencies, checkbox/multiselect support
- [Commander.js GitHub](https://github.com/tj/commander.js) — Verified v14.0.3 current, no interactive prompts

**Community Resources (MEDIUM-HIGH confidence):**
- [@inquirer/prompts npm](https://www.npmjs.com/package/@inquirer/prompts) — Compared alternatives, verified modern API rewrite
- [npm trends: prompts vs inquirer](https://npmtrends.com/enquirer-vs-inquirer-vs-prompt-vs-prompts) — Usage statistics, comparison
- [Node.js --env-file Support](https://infisical.com/blog/stop-using-dotenv-in-nodejs-v20.6.0+) — Verified native .env support in v20.6.0+
- [Best practices for publishing your npm package](https://mikbry.com/blog/javascript/npm/best-practices-npm-package) — npm publishing patterns

---
*Stack research for: VibeRipped v1.1 features (npm packaging, interactive prompts, category rotation, timed exercises, environment profiles)*
*Researched: 2026-02-09*
*Confidence: HIGH*
