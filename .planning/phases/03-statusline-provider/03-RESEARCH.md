# Phase 3: Statusline Provider - Research

**Researched:** 2026-02-08
**Domain:** Claude Code statusline provider integration, Node.js stdin/stdout scripting, ANSI terminal formatting
**Confidence:** MEDIUM

## Summary

Claude Code statusline providers are shell scripts that receive JSON session data via stdin and output formatted text to stdout. The statusline bar displays at the bottom of the terminal, updates after each assistant message with 300ms debouncing, and supports ANSI color codes for visual formatting. Scripts run in separate processes for each update, with in-flight executions cancelled if a new update triggers.

The primary challenge is process detection. Claude Code does not send an explicit "is processing" flag in the stdin JSON. Detection requires heuristic analysis of the `context_window.current_usage` object, which is `null` before the first API call and gets populated during active processing. The `cost.total_api_duration_ms` field tracks cumulative time spent waiting for API responses but does not indicate current processing state. Community implementations suggest monitoring field deltas between invocations, but since each script invocation runs in a fresh process, state must be persisted to disk for delta tracking.

For this project (zero external dependencies, Node.js built-in test runner, atomic state writes), the statusline script will use Node.js with raw ANSI escape codes and integrate with the existing `engine.js` trigger flow. Process detection will rely on `current_usage` null-vs-populated heuristics and may require empirical tuning based on real Claude Code session behavior.

**Primary recommendation:** Implement statusline provider as Node.js script using process.stdin data events, read JSON synchronously before end event, detect processing via `current_usage !== null` heuristic, trigger engine.js, and format output with raw ANSI escape codes (no dependencies).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in | N/A | stdin/JSON/stdout | Zero-dependency requirement, matches existing codebase |
| process.stdin | Node.js core | Read JSON from Claude Code | Standard input stream, official Claude Code integration point |
| ANSI escape sequences | Terminal standard | Color formatting | Native terminal support, no library needed, explicit in docs |
| write-file-atomic | ^7.0.0 | State persistence for delta tracking | Already in package.json (Phase 1/2), atomic write-rename pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jq | External CLI | JSON parsing in Bash | Only if Bash implementation chosen (not recommended for this project) |
| readline | Node.js core | Line-by-line stdin reading | Not needed - JSON arrives as complete document |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Node.js script | Bash script with jq | Bash simpler but requires external jq dependency, harder to integrate with engine.js |
| Raw ANSI codes | chalk/ansi-colors npm | Libraries add color readability but violate zero-dependency constraint |
| Process stdin buffering | get-stdin npm | Library simplifies code but adds dependency, trivial to implement with events |

**Installation:**
No new dependencies required. Existing dependencies:
```bash
npm install write-file-atomic  # Already present
```

## Architecture Patterns

### Recommended Project Structure
```
statusline.js           # Statusline provider entry point
lib/
├── statusline/         # Statusline-specific modules
│   ├── stdin.js        # JSON stdin reading
│   ├── detection.js    # Process detection heuristics
│   └── format.js       # ANSI formatting and output
├── engine.js           # Existing rotation engine (reused)
├── config.js           # Existing configuration (reused)
├── state.js            # Existing state persistence (reused)
└── pool.js             # Existing pool assembly (reused)
```

### Pattern 1: Stdin JSON Buffering
**What:** Accumulate stdin data chunks in buffer, parse JSON on 'end' event
**When to use:** Statusline scripts receiving complete JSON documents (not streaming)
**Example:**
```javascript
// Source: Official Claude Code docs + Node.js stdin patterns
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  const data = JSON.parse(input);
  // Process data and output to stdout
  console.log(formatOutput(data));
});
```

### Pattern 2: Raw ANSI Color Formatting
**What:** Direct ANSI escape sequence strings for terminal colors
**When to use:** Zero-dependency projects requiring color output
**Example:**
```javascript
// Source: https://gist.github.com/abritinthebay/d80eb99b2726c83feb0d97eab95206c4
const COLORS = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m'
};

function colorize(text, color) {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

console.log(colorize('Pushups x15', 'cyan'));
```

### Pattern 3: Process Detection via current_usage Heuristic
**What:** Detect active API processing by checking if `context_window.current_usage` is non-null
**When to use:** When no explicit processing flag exists in stdin data
**Example:**
```javascript
// Source: Official Claude Code statusline docs
function isProcessing(claudeData) {
  // current_usage is null before first API call, populated during/after processing
  const currentUsage = claudeData.context_window?.current_usage;
  return currentUsage !== null && currentUsage !== undefined;
}
```

### Pattern 4: Stateless Script with Disk Persistence for Deltas
**What:** Each statusline invocation runs in fresh process, persist state to disk for delta tracking
**When to use:** When detecting changes between invocations (token deltas, API duration changes)
**Example:**
```javascript
// Source: Community statusline caching patterns
const fs = require('fs');
const CACHE_FILE = '/tmp/viberipped-statusline-state.json';

function loadPreviousState() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function saveCurrentState(data) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify({
    timestamp: Date.now(),
    totalApiDuration: data.cost?.total_api_duration_ms || 0
  }));
}
```

### Anti-Patterns to Avoid
- **Assuming in-memory state persists:** Each statusline invocation is a fresh process. Use disk persistence for delta tracking.
- **Long-running operations:** Scripts block statusline updates. Keep execution fast (<100ms ideal).
- **Multiple output lines without intent:** Each `console.log()` creates a new statusline row. Multi-line output requires explicit design.
- **Ignoring null fields:** `current_usage`, `used_percentage` can be null early in session. Use fallbacks (e.g., `|| 0`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON stdin reading | Custom stream parser | process.stdin data events + buffer | Standard Node.js pattern, simple for complete documents |
| Atomic file writes | Manual write-then-rename | write-file-atomic (already in deps) | Handles edge cases, crash-safe, already project dependency |
| Terminal color codes | Custom color library | Raw ANSI escape sequences | Zero dependencies, explicit in Claude docs, universally supported |
| Process cooldown | Custom timer/state | Reuse lib/cooldown.js | Already battle-tested in Phase 1 |

**Key insight:** Claude Code statusline providers are simple stdin-to-stdout transformations. The complexity is in process detection heuristics, not the I/O mechanics. Reuse existing engine.js, state.js, and config.js modules rather than rebuilding rotation logic.

## Common Pitfalls

### Pitfall 1: Assuming process state persists across invocations
**What goes wrong:** Script tries to track deltas in memory, loses state on each invocation
**Why it happens:** Each statusline update runs script in fresh process (no shared memory)
**How to avoid:** Persist state to disk (e.g., `/tmp/viberipped-statusline.json`) for delta tracking
**Warning signs:** "Why does my delta always reset?" or "Previous values are always undefined"

### Pitfall 2: Blocking on slow operations (git status, external commands)
**What goes wrong:** Statusline freezes or shows stale data during slow script execution
**Why it happens:** Claude Code cancels in-flight executions if new update triggers, slow scripts cause lag
**How to avoid:** Cache expensive operations with TTL (5s typical), avoid git commands if possible
**Warning signs:** Statusline flickers, shows outdated data, or goes blank during rapid interactions

### Pitfall 3: Treating null fields as falsy in boolean checks
**What goes wrong:** `if (data.context_window.used_percentage)` treats 0% as false, hides statusline
**Why it happens:** JavaScript falsy behavior (0, null, undefined all falsy)
**How to avoid:** Explicit null checks: `if (value !== null && value !== undefined)` or `value ?? defaultValue`
**Warning signs:** Statusline disappears when context usage is 0% or fields are legitimately zero

### Pitfall 4: Assuming statusline updates indicate active processing
**What goes wrong:** Script triggers exercise on every update, spams user during non-processing events (vim mode toggle, permission changes)
**Why it happens:** Statusline updates on permission mode changes, vim mode toggles, not just API calls
**How to avoid:** Detect processing via `current_usage !== null` heuristic, not just "script ran"
**Warning signs:** Exercise prompts appear when switching vim modes or changing permissions, not during actual API calls

### Pitfall 5: Output format breaks with ANSI codes in testing
**What goes wrong:** Tests fail because output contains literal escape sequences like `\x1b[36m`
**Why it happens:** ANSI codes are invisible in terminal but literal in test assertions
**How to avoid:** Separate formatting logic, provide colorless mode for tests, or strip ANSI in test assertions
**Warning signs:** Test expects "Pushups x15" but gets "\x1b[36mPushups x15\x1b[0m"

### Pitfall 6: Detecting processing via total_api_duration_ms delta
**What goes wrong:** Low confidence heuristic - cumulative field doesn't reset, requires disk state for deltas, timing sensitive
**Why it happens:** `total_api_duration_ms` is cumulative across session, not current-call indicator
**How to avoid:** Prefer `current_usage !== null` heuristic (simpler, higher confidence)
**Warning signs:** Need complex disk-based delta tracking, false negatives during rapid interactions

## Code Examples

Verified patterns from official sources and existing codebase:

### Reading stdin JSON in Node.js
```javascript
// Source: Official Claude Code docs + Node.js stdin patterns
let input = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', chunk => {
  input += chunk;
});

process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const output = processClaudeData(data);
    console.log(output);
  } catch (e) {
    // Silent failure or error to stderr
    console.error(`Parse error: ${e.message}`);
    process.exit(1);
  }
});
```

### ANSI Color Formatting (Zero Dependencies)
```javascript
// Source: https://gist.github.com/abritinthebay/d80eb99b2726c83feb0d97eab95206c4
const ANSI = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  bold: '\x1b[1m'
};

function formatExercise(exerciseName, reps) {
  return `${ANSI.cyan}${ANSI.bold}${exerciseName} x${reps}${ANSI.reset}`;
}

// Output: "\x1b[36m\x1b[1mPushups x15\x1b[0m" (renders as bold cyan in terminal)
```

### Process Detection Heuristic
```javascript
// Source: Official Claude Code statusline docs
function isActivelyProcessing(claudeData) {
  // current_usage is null before first API call, populated during/after API processing
  const currentUsage = claudeData.context_window?.current_usage;

  // If current_usage exists and has non-zero input tokens, processing occurred/is occurring
  if (currentUsage && (currentUsage.input_tokens > 0 || currentUsage.cache_read_input_tokens > 0)) {
    return true;
  }

  return false;
}
```

### Integrating with Existing Engine
```javascript
// Source: Existing engine.js pattern (Phase 1/2)
const { trigger } = require('./engine');

function handleClaudeData(data) {
  if (!isActivelyProcessing(data)) {
    // No processing, show nothing (or empty string)
    return '';
  }

  // Trigger engine (respects cooldown internally)
  const result = trigger(null); // null = config-driven mode

  if (result.type === 'cooldown') {
    // Cooldown active - show nothing (exercise rotation doesn't advance)
    return '';
  }

  if (result.type === 'exercise') {
    // Format exercise with ANSI color
    return formatExercise(result.exercise.name, result.exercise.reps);
  }

  return '';
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bash + jq statuslines | Node.js/Python for complex logic | Community shift 2024-2025 | Better integration, native JSON, easier testing |
| Polling/interval refreshes | Event-driven updates (debounced 300ms) | Claude Code architecture | Efficient, responsive, no wasted CPU |
| Hook-based extensions | Statusline provider pattern | Claude Code design | Self-contained, polled by CLI, no hooks needed |
| Manual ANSI codes | Color libraries (chalk, ansi-colors) | Community preference | Readability vs dependencies tradeoff |

**Deprecated/outdated:**
- Hook-based statusline extensions: Claude Code uses provider pattern (stdin/stdout scripts), not hooks
- Interval-based statusline refresh: Not supported - updates only on events (message, permission change, vim toggle)

## Open Questions

1. **Process detection heuristic reliability**
   - What we know: `current_usage` is null before first API call, populated during/after processing
   - What's unclear: Does `current_usage` update mid-call or only after completion? Does it clear between calls or persist?
   - Recommendation: Implement `current_usage !== null` heuristic, add empirical validation during Phase 3 testing with real Claude Code sessions, tune threshold if needed

2. **Statusline visibility during API calls**
   - What we know: Statusline updates after assistant messages, debounced 300ms
   - What's unclear: Does statusline show during long-running API calls, or only after response completes?
   - Recommendation: Test with long-running prompts, may need to rely on post-call display (acceptable for "exercise appears when model finishes thinking")

3. **Multi-line output behavior with ANSI codes**
   - What we know: Each `console.log()` creates new statusline row, ANSI codes supported
   - What's unclear: How do multiple lines interact with Claude Code UI notifications (token warnings, MCP errors)?
   - Recommendation: Start with single-line output (just exercise prompt), test multi-line in Phase 4 if needed for GSD coexistence

4. **Cooldown interaction with statusline updates**
   - What we know: Engine enforces 5min cooldown, returns cooldown response when active
   - What's unclear: Should statusline show "Cooldown 3m 45s" or disappear completely during cooldown?
   - Recommendation: Disappear completely during cooldown (silent operation, per STAT-03 requirement), revisit in Phase 6 if adaptive difficulty needs cooldown visibility

## Sources

### Primary (HIGH confidence)
- [Official Claude Code Statusline Documentation](https://code.claude.com/docs/en/statusline) - Complete specification, JSON schema, update timing, ANSI support
- Official Claude Code docs JSON schema - Fields: `context_window.current_usage`, `cost.total_api_duration_ms`, update triggers, null handling
- Existing codebase (engine.js, lib/config.js, lib/state.js, lib/cooldown.js) - Patterns, module structure, atomic writes, zero dependencies

### Secondary (MEDIUM confidence)
- [Node.js ANSI Escape Codes Guide](https://dustinpfister.github.io/2019/09/19/nodejs-ansi-escape-codes/) - Raw ANSI sequences, color codes
- [ANSI Color Codes Gist](https://gist.github.com/abritinthebay/d80eb99b2726c83feb0d97eab95206c4) - Complete escape sequence reference
- [Node.js stdin reading patterns](https://blog.logrocket.com/using-stdout-stdin-stderr-node-js/) - Data events, buffering, JSON parsing
- Community statusline implementations (levz0r/claude-code-statusline, sirmalloc/ccstatusline) - Architecture patterns, caching strategies

### Tertiary (LOW confidence - needs empirical validation)
- Process detection via `current_usage` heuristic - Documented null-before-first-call, but mid-call behavior unverified
- Statusline visibility during API calls vs after completion - Update timing documented, but "during call" visibility unclear
- Delta tracking reliability with disk state - Community pattern, but race conditions with 300ms debouncing need testing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Node.js built-ins documented, ANSI codes explicit in official docs, existing dependencies known
- Architecture: MEDIUM - Stdin/stdout pattern verified, process detection heuristic needs empirical validation
- Pitfalls: MEDIUM - Null handling and stateless process documented, but edge cases (rapid updates, cooldown interaction) need testing

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (30 days - stable domain, Claude Code statusline spec unlikely to change)
