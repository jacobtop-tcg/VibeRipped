# Phase 12: Interactive Setup Wizard - Research

**Researched:** 2026-02-10
**Domain:** Node.js interactive CLI with checkbox selection and TTY detection
**Confidence:** HIGH

## Summary

Phase 12 requires building an interactive setup wizard with checkbox-based equipment selection using only Node.js built-in modules (maintaining the zero-dependency constraint). The wizard must detect TTY mode and fail gracefully when run in non-interactive contexts like statusline pipe mode.

Node.js provides all necessary primitives through built-in modules: `readline` for input handling, `process.stdin.isTTY` for terminal detection, raw mode for keypress capture, and ANSI escape codes for terminal control. The challenge is building a checkbox UI from scratch without external dependencies like Inquirer.js.

**Primary recommendation:** Build custom checkbox UI using `readline.emitKeypressEvents()`, raw mode, ANSI escape codes for cursor control, and Unicode checkbox characters (☐/☑). Implement TTY detection guard at command entry point with clear error message suggesting alternative non-interactive configuration methods.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:readline | Node.js 18+ built-in | Input handling and terminal control | Standard Node.js module for CLI interaction, has promises API since v17.0.0 |
| node:readline/promises | Node.js 18+ built-in | Promise-based readline for async/await | Cleaner than callback API, matches project's async patterns |
| node:tty | Node.js 18+ built-in | TTY detection via process.stdin.isTTY | Standard method to detect interactive terminal |
| node:process | Node.js built-in | stdin/stdout/stderr access | Core Node.js API for terminal I/O |
| node:fs/promises | Node.js 18+ built-in | File existence checking | Modern async file operations |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ANSI escape codes | N/A | Terminal cursor control and colors | Custom checkbox rendering |
| Unicode characters | UTF-8 | Checkbox symbols (☐ U+2610, ☑ U+2611) | Visual checkbox indicators |
| write-file-atomic | 7.0.0 (already in project) | Atomic config/pool writes | Existing pattern for safe file writes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom checkbox UI | inquirer.js | Would violate zero-dependency constraint (external npm package) |
| Custom checkbox UI | prompts | Would violate zero-dependency constraint (external npm package) |
| Unicode checkboxes | ASCII [x]/[ ] | More terminal-compatible but less visually appealing, consider fallback |
| Raw mode keypresses | Line-buffered input | Cannot capture arrow keys, forces numbered menu instead of interactive selection |

**Installation:**
No additional packages needed - all built-in Node.js modules.

## Architecture Patterns

### Recommended Project Structure
```
lib/cli/
├── commands/
│   └── setup.js          # Setup command handler with TTY guard
└── ui/
    ├── checkbox.js       # Custom checkbox widget implementation
    └── prompt.js         # Reusable prompt utilities
```

### Pattern 1: TTY Detection Guard
**What:** Check for interactive terminal before showing interactive UI
**When to use:** Entry point of any command that uses interactive prompts
**Example:**
```javascript
// Source: Node.js TTY Documentation v25.6.0
// https://nodejs.org/api/tty.html

function setup() {
  // TTY detection - check both stdin and stdout
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error('Error: setup wizard requires interactive terminal (TTY)');
    console.error('Cannot run in pipe mode or non-interactive context.');
    console.error('');
    console.error('Alternative: Configure manually with:');
    console.error('  vibripped config --kettlebell --dumbbells');
    console.error('  vibripped pool add "Exercise name" 15');
    process.exitCode = 1;
    return;
  }

  // Proceed with interactive wizard
  runInteractiveWizard();
}
```

### Pattern 2: Raw Mode Keypress Handling
**What:** Capture individual keypresses (arrows, space, enter) without line buffering
**When to use:** Interactive menus, checkbox lists, any navigation UI
**Example:**
```javascript
// Source: Multiple community examples + Node.js readline docs
// https://nodejs.org/api/readline.html#readlineemitkeypresseventsstream-interface

const readline = require('readline');

function captureKeypress(callback) {
  // Enable keypress events
  readline.emitKeypressEvents(process.stdin);

  // Enter raw mode if TTY
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  // Resume stdin to start receiving input
  process.stdin.resume();

  // Listen for keypresses
  process.stdin.on('keypress', (str, key) => {
    callback(str, key);
  });

  // Cleanup function
  return () => {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
    process.stdin.removeAllListeners('keypress');
  };
}
```

### Pattern 3: Checkbox List Rendering with ANSI Codes
**What:** Render interactive checkbox list with cursor highlighting
**When to use:** Equipment selection, multi-select prompts
**Example:**
```javascript
// Source: Community patterns from dev.to and GitHub examples
// https://dev.to/kilu/how-to-build-your-own-node-js-select-options-from-scratch-49gm

const CHECKBOX_UNCHECKED = '\u2610'; // ☐
const CHECKBOX_CHECKED = '\u2611';   // ☑
const CURSOR_UP = '\u001B[A';
const CURSOR_DOWN = '\u001B[B';
const CLEAR_LINE = '\u001B[2K';
const CURSOR_TO_START = '\u001B[G';
const COLOR_HIGHLIGHT = '\x1b[36m'; // Cyan
const COLOR_RESET = '\x1b[0m';

function renderCheckboxList(items, selectedIndex, checkedItems) {
  // Clear previous render
  process.stdout.write(CURSOR_TO_START);

  items.forEach((item, index) => {
    const isSelected = index === selectedIndex;
    const isChecked = checkedItems.has(index);

    // Clear line and move cursor to start
    process.stdout.write(CLEAR_LINE + CURSOR_TO_START);

    // Render checkbox and label
    const checkbox = isChecked ? CHECKBOX_CHECKED : CHECKBOX_UNCHECKED;
    const prefix = isSelected ? '> ' : '  ';
    const color = isSelected ? COLOR_HIGHLIGHT : '';
    const reset = isSelected ? COLOR_RESET : '';

    process.stdout.write(`${color}${prefix}${checkbox} ${item.label}${reset}\n`);
  });

  // Move cursor back to top
  process.stdout.write(`\u001B[${items.length}A`);
}
```

### Pattern 4: Graceful Cleanup on Exit
**What:** Restore terminal state when exiting (Ctrl+C, errors, completion)
**When to use:** Any code using raw mode or modified terminal state
**Example:**
```javascript
// Source: Node.js readline documentation + community best practices
// https://nodejs.org/api/readline.html

function setupCleanup(cleanup) {
  // Handle Ctrl+C
  process.on('SIGINT', () => {
    cleanup();
    process.stdout.write('\n');
    process.exit(0);
  });

  // Handle other termination signals
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });

  // Handle uncaught errors
  process.on('uncaughtException', (err) => {
    cleanup();
    console.error('Unexpected error:', err);
    process.exit(1);
  });
}
```

### Pattern 5: File Existence Check Before Overwrite
**What:** Prompt user before overwriting existing configuration
**When to use:** Setup wizards, init commands, any operation that might lose user data
**Example:**
```javascript
// Source: Node.js fs/promises documentation + community best practices
// https://nodejs.org/api/fs.html

const fs = require('fs/promises');

async function checkExistingConfig(configPath) {
  try {
    await fs.access(configPath, fs.constants.F_OK);
    // File exists
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') {
      // File doesn't exist
      return false;
    }
    // Other error (permissions, etc)
    throw err;
  }
}

async function promptOverwrite() {
  const readline = require('readline/promises');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await rl.question('Configuration exists. Overwrite? (y/N): ');
  rl.close();

  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}
```

### Anti-Patterns to Avoid
- **Checking file existence with fs.existsSync before writing**: Creates race condition - use atomic write-rename instead (project already uses write-file-atomic)
- **Not cleaning up terminal state**: Leaves terminal in raw mode if process exits unexpectedly
- **Assuming TTY without checking**: Causes hangs in pipe mode or CI environments
- **Using npm dependencies for UI**: Violates zero-dependency constraint (Commander.js is allowed exception, but only for argument parsing)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file writes | Custom write-rename logic | write-file-atomic (already in project) | Handles crash safety, temp file cleanup, cross-platform edge cases |
| Argument parsing | Custom argv parser | Commander.js (already in project) | Mature, tested, handles --help, subcommands, flags |
| Config validation | Ad-hoc checks | Existing config.validateConfig() | Project already has validation logic |
| Pool assembly | Manual filtering | Existing pool.assemblePool() | Project already has equipment filtering logic |

**Key insight:** The zero-dependency constraint means we MUST build checkbox UI from scratch, but leverage existing project modules for everything else (config, pool, state management). Don't reinvent atomic writes or validation - those are already solved.

## Common Pitfalls

### Pitfall 1: Terminal State Corruption on Unexpected Exit
**What goes wrong:** Raw mode left enabled, terminal doesn't echo keystrokes after crash
**Why it happens:** Cleanup code doesn't run on uncaught exceptions or kill signals
**How to avoid:** Set up signal handlers (SIGINT, SIGTERM) and uncaughtException handler BEFORE entering raw mode
**Warning signs:** After testing interactive code, terminal requires `reset` command to work normally

### Pitfall 2: Checkbox Rendering Flicker
**What goes wrong:** Screen flickers or shows duplicate lines during updates
**Why it happens:** Incorrect ANSI cursor positioning, not clearing previous render
**How to avoid:** Calculate exact cursor movements, clear each line before redrawing, move cursor back to start position after full render
**Warning signs:** Visible "trail" of previous menu states, cursor jumping

### Pitfall 3: Unicode Rendering Issues
**What goes wrong:** Checkboxes display as � or ?? in some terminals
**Why it happens:** Terminal doesn't support UTF-8 or specific Unicode characters
**How to avoid:** Consider ASCII fallback ([x]/[ ]) if Unicode detection fails, or document UTF-8 terminal requirement
**Warning signs:** Bug reports from users with specific terminal emulators (older Windows terminals, minimal TTYs)

### Pitfall 4: Keypress Event Interpretation Errors
**What goes wrong:** Arrow keys not working, Ctrl+C not exiting, wrong key detected
**Why it happens:** Key codes vary by platform, especially arrow keys which send multi-byte escape sequences
**How to avoid:** Use `key.name` property from readline (normalized), not raw `str` value. Test on Linux, macOS, and Windows.
**Warning signs:** Works on macOS but broken on Linux, or vice versa

### Pitfall 5: Race Condition Between TTY Check and Interactive Input
**What goes wrong:** TTY check passes, but stdin/stdout get redirected before interactive code runs
**Why it happens:** Edge case in process pipelines or terminal multiplexers
**How to avoid:** Low risk in practice, but can add redundant checks before raw mode operations
**Warning signs:** Rare hangs in CI/automated environments despite TTY check

### Pitfall 6: Overwriting User Data Without Confirmation
**What goes wrong:** Setup wizard silently overwrites existing custom configuration or exercise pool
**Why it happens:** Skipping file existence check or assuming first-run context
**How to avoid:** Always check for existing config/pool files, prompt for confirmation before overwrite
**Warning signs:** User complaints about lost custom exercises after running setup

### Pitfall 7: Poor Error Messages for Non-TTY Context
**What goes wrong:** Command hangs or shows cryptic error when run in pipe mode
**Why it happens:** Generic "not a TTY" error without guidance
**How to avoid:** Provide clear error explaining why it failed AND alternative commands to achieve the goal
**Warning signs:** GitHub issues asking "how do I configure this?" after failed setup attempt

## Code Examples

Verified patterns from official sources:

### TTY Detection with Detailed Error
```javascript
// Source: Node.js TTY Documentation + community error messaging best practices
// https://nodejs.org/api/tty.html

function requireTTY(commandName) {
  const hasInputTTY = Boolean(process.stdin.isTTY);
  const hasOutputTTY = Boolean(process.stdout.isTTY);

  if (!hasInputTTY || !hasOutputTTY) {
    console.error(`Error: ${commandName} requires an interactive terminal`);
    console.error('');
    console.error('Current environment:');
    console.error(`  stdin is TTY:  ${hasInputTTY}`);
    console.error(`  stdout is TTY: ${hasOutputTTY}`);
    console.error('');
    console.error('This command cannot run in:');
    console.error('  - Piped contexts (e.g., echo "data" | vibripped setup)');
    console.error('  - Non-interactive shells (e.g., CI/CD environments)');
    console.error('  - Redirected output (e.g., vibripped setup > log.txt)');
    console.error('');
    console.error('To configure non-interactively, use:');
    console.error('  vibripped config --kettlebell --dumbbells');
    console.error('  vibripped pool add "Push-ups" 15');
    console.error('  vibripped config set environment home');
    return false;
  }

  return true;
}
```

### Complete Checkbox Widget Implementation
```javascript
// Source: Synthesized from multiple community examples
// https://dev.to/kilu/how-to-build-your-own-node-js-select-options-from-scratch-49gm
// https://github.com/ddosnotification/interactive-cli-menu

const readline = require('readline');

const KEYS = {
  UP: 'up',
  DOWN: 'down',
  SPACE: 'space',
  RETURN: 'return',
  ESCAPE: 'escape',
};

const ANSI = {
  CLEAR_LINE: '\x1b[2K',
  CURSOR_TO_START: '\x1b[G',
  CURSOR_UP: (n) => `\x1b[${n}A`,
  CURSOR_DOWN: (n) => `\x1b[${n}B`,
  COLOR_CYAN: '\x1b[36m',
  COLOR_RESET: '\x1b[0m',
  HIDE_CURSOR: '\x1b[?25l',
  SHOW_CURSOR: '\x1b[?25h',
};

const CHECKBOX = {
  UNCHECKED: '\u2610', // ☐
  CHECKED: '\u2611',   // ☑
};

class CheckboxPrompt {
  constructor(message, choices) {
    this.message = message;
    this.choices = choices; // Array of { label: string, value: any, checked: boolean }
    this.selectedIndex = 0;
    this.cleanup = null;
  }

  render() {
    // Clear previous render (move cursor up and clear)
    if (this.rendered) {
      const linesToClear = this.choices.length + 1; // +1 for message
      process.stdout.write(ANSI.CURSOR_UP(linesToClear));
    }

    // Render message
    process.stdout.write(ANSI.CLEAR_LINE + ANSI.CURSOR_TO_START);
    process.stdout.write(this.message + '\n');

    // Render choices
    this.choices.forEach((choice, index) => {
      const isSelected = index === this.selectedIndex;
      const checkbox = choice.checked ? CHECKBOX.CHECKED : CHECKBOX.UNCHECKED;
      const pointer = isSelected ? '❯' : ' ';
      const color = isSelected ? ANSI.COLOR_CYAN : '';
      const reset = isSelected ? ANSI.COLOR_RESET : '';

      process.stdout.write(ANSI.CLEAR_LINE + ANSI.CURSOR_TO_START);
      process.stdout.write(`${color}${pointer} ${checkbox} ${choice.label}${reset}\n`);
    });

    this.rendered = true;
  }

  setupInput() {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    // Hide cursor for cleaner UI
    process.stdout.write(ANSI.HIDE_CURSOR);
  }

  cleanupInput() {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
    process.stdin.removeAllListeners('keypress');

    // Show cursor again
    process.stdout.write(ANSI.SHOW_CURSOR);
  }

  handleKeypress(str, key) {
    if (!key) return;

    // Handle Ctrl+C
    if (key.ctrl && key.name === 'c') {
      this.cleanupInput();
      process.stdout.write('\n');
      process.exit(0);
    }

    // Navigation
    if (key.name === KEYS.UP) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.render();
    } else if (key.name === KEYS.DOWN) {
      this.selectedIndex = Math.min(this.choices.length - 1, this.selectedIndex + 1);
      this.render();
    }

    // Toggle selection
    else if (key.name === KEYS.SPACE) {
      this.choices[this.selectedIndex].checked = !this.choices[this.selectedIndex].checked;
      this.render();
    }

    // Submit
    else if (key.name === KEYS.RETURN) {
      return 'submit';
    }

    // Cancel
    else if (key.name === KEYS.ESCAPE) {
      return 'cancel';
    }
  }

  async prompt() {
    return new Promise((resolve, reject) => {
      this.setupInput();

      // Setup cleanup handlers
      const cleanup = () => this.cleanupInput();
      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);

      // Initial render
      this.render();

      // Handle keypresses
      const onKeypress = (str, key) => {
        const action = this.handleKeypress(str, key);

        if (action === 'submit') {
          cleanup();
          process.removeListener('SIGINT', cleanup);
          process.removeListener('SIGTERM', cleanup);

          // Return checked items
          const selected = this.choices
            .filter(choice => choice.checked)
            .map(choice => choice.value);

          process.stdout.write('\n');
          resolve(selected);
        } else if (action === 'cancel') {
          cleanup();
          process.removeListener('SIGINT', cleanup);
          process.removeListener('SIGTERM', cleanup);
          process.stdout.write('\n');
          reject(new Error('Cancelled'));
        }
      };

      process.stdin.on('keypress', onKeypress);
    });
  }
}

// Usage example:
async function askEquipment() {
  const choices = [
    { label: 'Kettlebell', value: 'kettlebell', checked: false },
    { label: 'Dumbbells', value: 'dumbbells', checked: false },
    { label: 'Pull-up bar', value: 'pullUpBar', checked: false },
    { label: 'Parallettes', value: 'parallettes', checked: false },
  ];

  const prompt = new CheckboxPrompt(
    'Select your available equipment (Space to toggle, Enter to confirm):',
    choices
  );

  const selected = await prompt.prompt();
  return selected; // Array of values: ['kettlebell', 'dumbbells', ...]
}
```

### Testing Interactive Prompts
```javascript
// Source: Project test patterns + community mocking strategies
// https://medium.com/@zorrodg/integration-tests-on-node-js-cli-part-2-testing-interaction-user-input-6f345d4b713a

const { describe, test } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

describe('setup command', () => {
  test('detects non-TTY and shows error', async () => {
    const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}`);
    fs.mkdirSync(tempHome, { recursive: true });

    const env = {
      ...process.env,
      HOME: tempHome,
      XDG_CONFIG_HOME: path.join(tempHome, '.config')
    };

    const binPath = path.join(__dirname, '../../bin/vibripped.js');

    // Spawn without TTY (stdin not connected)
    const child = spawn('node', [binPath, 'setup'], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'] // stdin ignored = not a TTY
    });

    let stderr = '';
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    await new Promise((resolve) => {
      child.on('close', (code) => {
        assert.strictEqual(code, 1);
        assert.match(stderr, /requires interactive terminal/);
        assert.match(stderr, /vibripped config/); // Suggests alternative

        fs.rmSync(tempHome, { recursive: true, force: true });
        resolve();
      });
    });
  });

  // Note: Full interactive testing requires mock-stdin or pty-based testing
  // For now, non-TTY detection is the critical test for statusline safety
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Callback-based readline | readline/promises with async/await | Node.js v17.0.0 (2021) | Cleaner code, better error handling |
| fs.existsSync before writes | Direct write + atomic operations | Ongoing best practice | Eliminates race conditions |
| External prompt libraries (inquirer) | Custom raw mode + readline for zero-dep CLI | Project constraint | Must build checkbox UI from scratch |
| Manual ANSI code strings | Organized constants/helpers | Community evolution | More maintainable |

**Deprecated/outdated:**
- `readline.createInterface()` callback-style `.question()` - use `readline/promises` instead for new code
- Checking `fs.existsSync()` then writing - creates race condition, use atomic write or access-then-write pattern
- `process.on('uncaughtException')` for normal cleanup - use proper async/await error handling, uncaughtException only for last-resort cleanup

## Open Questions

1. **Unicode checkbox fallback strategy**
   - What we know: Unicode ☐/☑ works on modern terminals, but may fail on older Windows terminals or minimal TTYs
   - What's unclear: Should we detect Unicode support and fall back to ASCII [x]/[ ]?
   - Recommendation: Start with Unicode (simpler), add ASCII fallback only if users report issues. Document UTF-8 terminal requirement.

2. **Testing strategy for interactive code**
   - What we know: Project uses child_process.spawn with isolated HOME dirs for CLI tests
   - What's unclear: How to test arrow key navigation and space bar toggles without external pty library
   - Recommendation: Test TTY detection (critical for statusline safety), test non-interactive flow (existing config/pool commands), skip full interactive widget testing in automated tests. Manual testing for checkbox UI behavior.

3. **Default exercise suggestions**
   - What we know: Project has FULL_EXERCISE_DATABASE in pool.js with exercises tagged by equipment
   - What's unclear: Should wizard pre-check exercises based on equipment, or start with all unchecked?
   - Recommendation: Show equipment-filtered exercises with sensible defaults (10-15 exercises pre-checked for balanced workout). User can toggle to customize.

4. **Setup command behavior when config exists**
   - What we know: Should prompt before overwriting (requirement states "asks before overwriting")
   - What's unclear: Prompt before launching wizard, or show wizard with current values pre-filled?
   - Recommendation: Prompt first ("Config exists, do you want to reconfigure?"), then launch wizard with existing values pre-loaded if user confirms. Simpler UX than exiting immediately.

## Sources

### Primary (HIGH confidence)
- [Node.js TTY Documentation v25.6.0](https://nodejs.org/api/tty.html) - TTY detection, isTTY behavior
- [Node.js Readline Documentation v25.6.0](https://nodejs.org/api/readline.html) - emitKeypressEvents, raw mode, promises API
- [Node.js Readline v18.20.8](https://nodejs.org/docs/latest-v18.x/api/readline.html) - Compatibility verification for Node 18+ requirement
- [Node.js Readline v20.19.6](https://nodejs.org/docs/latest-v20.x/api/readline.html) - LTS feature verification
- Project source code: bin/vibripped.js, lib/config.js, lib/pool.js, test/cli/config.test.js - Existing patterns

### Secondary (MEDIUM confidence)
- [How to build your own Node.js select-options from scratch - DEV Community](https://dev.to/kilu/how-to-build-your-own-node-js-select-options-from-scratch-49gm) - Checkbox implementation pattern
- [Interactive CLI menu with no dependencies - GitHub](https://github.com/ddosnotification/interactive-cli-menu) - Raw mode navigation example
- [Making Interactive Node.js Console Apps - thisDaveJ](https://thisdavej.com/making-interactive-node-js-console-apps-that-listen-for-keypress-events/) - Keypress event handling
- [Using ANSI escape codes in Node.js - Dustin Pfister](https://dustinpfister.github.io/2019/09/19/nodejs-ansi-escape-codes/) - ANSI codes reference
- [ANSI Colors in Node.js - GitHub Gist](https://gist.github.com/pinksynth/209937bd424edb2bd21f7c8bf756befd) - Color codes
- [ANSI Escape Codes - GitHub Gist](https://gist.github.com/fnky/458719343aabd01cfb17a3a4f7296797) - Comprehensive ANSI reference
- [Unicode Checkbox Symbols - Itexus](https://itexus.com/unicode-checkbox-symbols-adding-checkboxes-to-your-text/) - Unicode characters
- [U+2610 Ballot Box - Unicode Compart](https://www.compart.com/en/unicode/U+2610) - Unchecked checkbox
- [U+2611 Ballot Box with Check - Unicode Compart](https://www.compart.com/en/unicode/U+2611) - Checked checkbox

### Tertiary (LOW confidence - flagged for validation)
- [Integration tests on Node.js CLI: Part 2 - Medium](https://medium.com/@zorrodg/integration-tests-on-node-js-cli-part-2-testing-interaction-user-input-6f345d4b713a) - Testing interactive prompts (may be outdated)
- [mock-stdin - npm](https://www.npmjs.com/package/mock-stdin) - External testing library (violates zero-dep if used in production, but acceptable in devDependencies)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Node.js built-in modules verified across multiple versions (18, 20, 22, 25)
- Architecture: HIGH - Patterns verified in official docs and synthesized from multiple consistent community examples
- Pitfalls: MEDIUM-HIGH - Based on community experience and common terminal programming issues, not exhaustive testing

**Research date:** 2026-02-10
**Valid until:** ~2026-03-12 (30 days) - Node.js built-in APIs are stable, terminal programming patterns are mature, low risk of changes
