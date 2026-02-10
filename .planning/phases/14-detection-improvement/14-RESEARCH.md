# Phase 14: Detection Improvement - Research

**Researched:** 2026-02-10
**Domain:** Claude Code statusline provider, API processing detection
**Confidence:** MEDIUM

## Summary

Phase 14 aims to eliminate false positives in exercise triggering by improving the detection heuristic to distinguish actual API processing from routine statusline updates. The v1.0 implementation triggers on all statusline updates after the first API call because it checks token accumulation (`current_usage.input_tokens > 0`), which remains positive throughout the session.

Claude Code's statusline provider receives JSON via stdin on every update, but the structure provides limited signals for detecting "active API processing" versus "idle session refresh." The documented fields (`context_window`, `cost`, `current_usage`) are cumulative counters that don't directly indicate real-time API activity. The most promising detection signal is `cost.total_api_duration_ms`, which increments only during API calls.

**Primary recommendation:** Track `total_api_duration_ms` deltas between statusline invocations to detect API calls. Supplement with timestamp-based heuristics and configurable sensitivity thresholds to handle edge cases.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins | 18+ | JSON parsing, file I/O, process management | Zero external dependencies constraint, native performance |
| jq (optional) | 1.6+ | JSON field extraction in Bash examples | Community standard for shell-based statusline scripts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| process.stdin | Node.js core | Reading Claude Code JSON input | Required for all statusline providers |
| fs (atomic writes) | Node.js core | Persisting detection state between invocations | Tracking deltas across statusline updates |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Delta tracking | Timestamp thresholds | Simpler but less accurate (all updates within N seconds of API call trigger) |
| State file | In-memory cache | Faster but loses state across provider restarts (acceptable given provider lifecycle) |

**Installation:**
```bash
# No new dependencies required - uses Node.js built-ins only
```

## Architecture Patterns

### Recommended Project Structure
```
lib/statusline/
├── detection.js        # Detection logic (current heuristic)
├── stdin.js           # JSON parsing
├── format.js          # ANSI formatting
└── detection-state.js # NEW: Delta tracking for API duration
```

### Pattern 1: Delta Tracking with Atomic State
**What:** Track `total_api_duration_ms` between statusline invocations using an atomic state file
**When to use:** For detecting API calls without relying on token accumulation
**Example:**
```javascript
// Source: Research findings + atomic write pattern from engine.js
const fs = require('fs');
const path = require('path');

function getStatePath() {
  return path.join(os.homedir(), '.config', 'viberipped', 'detection-state.json');
}

function loadDetectionState() {
  try {
    const content = fs.readFileSync(getStatePath(), 'utf8');
    return JSON.parse(content);
  } catch {
    return { lastApiDuration: 0, lastUpdate: 0 };
  }
}

function detectApiCall(claudeData) {
  const currentApiDuration = claudeData.cost?.total_api_duration_ms || 0;
  const state = loadDetectionState();

  // API call detected if duration increased
  const apiCallActive = currentApiDuration > state.lastApiDuration;

  // Update state for next check
  const newState = {
    lastApiDuration: currentApiDuration,
    lastUpdate: Date.now()
  };
  fs.writeFileSync(getStatePath(), JSON.stringify(newState));

  return apiCallActive;
}
```

### Pattern 2: Fallback Heuristic
**What:** If statusline structure changes, fall back to v1.0 token-based detection
**When to use:** When new API call detection fails or `cost` field is unavailable
**Example:**
```javascript
// Source: Current lib/statusline/detection.js
function isProcessing(claudeData) {
  // Try new API duration delta detection
  try {
    if (claudeData.cost?.total_api_duration_ms !== undefined) {
      return detectApiCall(claudeData); // New detection
    }
  } catch (error) {
    console.error('Detection improvement failed, using fallback:', error.message);
  }

  // Fallback to v1.0 token-based heuristic
  const currentUsage = claudeData.context_window?.current_usage;
  if (currentUsage === null || currentUsage === undefined) return false;
  return (currentUsage.input_tokens > 0 || currentUsage.cache_read_input_tokens > 0);
}
```

### Pattern 3: Configurable Sensitivity
**What:** Allow users to tune detection sensitivity via configuration
**When to use:** For handling edge cases like rapid API calls or slow statusline updates
**Example:**
```javascript
// Source: Existing lib/config.js pattern
// In configuration.json:
{
  "detection": {
    "sensitivity": "normal", // "strict" | "normal" | "relaxed"
    "durationThreshold": 100 // min ms increase to count as API call
  }
}

// In detection logic:
function getThreshold(config) {
  const sensitivity = config.detection?.sensitivity || 'normal';
  const customThreshold = config.detection?.durationThreshold;

  if (customThreshold) return customThreshold;

  switch (sensitivity) {
    case 'strict': return 50;   // Any 50ms+ increase triggers
    case 'relaxed': return 500; // Only 500ms+ increases trigger
    default: return 100;        // Normal: 100ms+ triggers
  }
}
```

### Anti-Patterns to Avoid
- **Relying solely on `current_usage` tokens:** These accumulate across the session, causing false positives on every update after the first API call
- **Assuming statusline timing:** Statusline updates are throttled at 300ms but may arrive at irregular intervals
- **Global state without atomic writes:** Race conditions across concurrent sessions can corrupt detection state
- **Hardcoded thresholds without config:** Different projects/workflows may need different sensitivity levels

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON parsing | Custom parser | `JSON.parse()` with error handling (existing `parseStdin()`) | Built-in parsing handles edge cases (trailing commas, Unicode) |
| State persistence | Manual file writes | Atomic write-rename pattern (existing in `engine.js`) | Prevents corruption on crash/interrupt |
| Timestamp tracking | `Date.now()` comparisons everywhere | Delta tracking abstraction | Easier to test, handles clock skew |
| Configuration merging | Custom config logic | Existing `loadConfig()` from `lib/config.js` | Already handles defaults, schema evolution |

**Key insight:** Statusline providers run as separate process invocations on every update, so state must be persisted to disk. Use existing atomic write patterns to avoid corruption.

## Common Pitfalls

### Pitfall 1: Assuming `current_usage` Indicates Active Processing
**What goes wrong:** `current_usage` contains token counts from the most recent API call, but it persists after the call completes. Checking `current_usage.input_tokens > 0` triggers on every statusline update after the first API call, causing false positives.
**Why it happens:** The field name suggests "current" state, but it's actually "latest API call" state that persists across updates.
**How to avoid:** Track deltas in `cost.total_api_duration_ms` instead of checking absolute token values.
**Warning signs:** Exercise prompts appearing on every statusline refresh, not just during API calls.

### Pitfall 2: Race Conditions in Detection State
**What goes wrong:** Multiple Claude Code sessions or concurrent statusline invocations can corrupt the detection state file, leading to missed API calls or false positives.
**Why it happens:** Standard `fs.writeFileSync()` is not atomic - partial writes can occur during concurrent access.
**How to avoid:** Use atomic write-rename pattern from `engine.js` (write to temp file, rename to target).
**Warning signs:** Sporadic detection failures, corrupt JSON in state file.

### Pitfall 3: Statusline Structure Changes Breaking Detection
**What goes wrong:** If Claude Code changes the statusline JSON schema (renames/removes `cost` field), the new detection logic fails silently.
**Why it happens:** Undocumented API structure can change without notice in Claude Code updates.
**How to avoid:** Implement fallback to v1.0 token-based heuristic when new detection fails. Log structure changes to stderr for debugging.
**Warning signs:** No exercise prompts after Claude Code update, detection state never changes.

### Pitfall 4: False Negatives on Rapid API Calls
**What goes wrong:** If statusline updates are throttled (300ms debounce documented) and multiple API calls occur rapidly, intermediate calls may not be detected.
**Why it happens:** Delta tracking only sees the cumulative duration change between updates, missing individual calls within the throttle window.
**How to avoid:** Accept this as acceptable behavior - rapid consecutive API calls are typically part of a single "work session" anyway. Document the limitation.
**Warning signs:** Missing exercises during rapid tool usage (e.g., multiple file writes in quick succession).

### Pitfall 5: Session Restart State Confusion
**What goes wrong:** After Claude Code restart or `/clear`, detection state persists but session state resets, causing incorrect delta calculations.
**Why it happens:** Detection state file doesn't know about session boundaries.
**How to avoid:** Include `session_id` in detection state, reset deltas when session changes.
**Warning signs:** First API call after restart triggers no exercise (or triggers incorrectly).

### Pitfall 6: Configurable Sensitivity Breaking Defaults
**What goes wrong:** Users set `detection.sensitivity` to "strict" and get overwhelmed with exercise prompts on every minor statusline update.
**Why it happens:** Threshold too low captures non-API updates where `total_api_duration_ms` fluctuates slightly.
**How to avoid:** Document sensitivity settings clearly, default to "normal" (100ms threshold), warn in config comments.
**Warning signs:** User reports constant exercise prompts even when Claude is idle.

## Code Examples

Verified patterns from existing codebase and research:

### Delta-Based API Detection
```javascript
// Source: Research findings + existing patterns from detection.js
const fs = require('fs');
const path = require('path');
const os = require('os');

function getDetectionStatePath() {
  return path.join(os.homedir(), '.config', 'viberipped', 'detection-state.json');
}

function loadDetectionState() {
  try {
    const content = fs.readFileSync(getDetectionStatePath(), 'utf8');
    return JSON.parse(content);
  } catch {
    // First run or corrupt state - return empty state
    return {
      sessionId: null,
      lastApiDuration: 0,
      lastUpdate: Date.now()
    };
  }
}

function saveDetectionState(state) {
  const statePath = getDetectionStatePath();
  const stateDir = path.dirname(statePath);

  // Ensure directory exists
  fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });

  // Atomic write (write-rename pattern from engine.js)
  const tmpPath = `${statePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(tmpPath, statePath);
}

function isProcessingImproved(claudeData, config = {}) {
  const currentApiDuration = claudeData.cost?.total_api_duration_ms || 0;
  const sessionId = claudeData.session_id;

  // Load previous state
  const state = loadDetectionState();

  // Detect session restart - reset deltas
  if (state.sessionId !== sessionId) {
    const newState = {
      sessionId: sessionId,
      lastApiDuration: currentApiDuration,
      lastUpdate: Date.now()
    };
    saveDetectionState(newState);
    return false; // First statusline update of new session, no API call yet
  }

  // Get configurable threshold
  const threshold = config.detection?.durationThreshold || 100;

  // Calculate delta
  const durationDelta = currentApiDuration - state.lastApiDuration;
  const apiCallDetected = durationDelta >= threshold;

  // Update state for next check
  const newState = {
    sessionId: sessionId,
    lastApiDuration: currentApiDuration,
    lastUpdate: Date.now()
  };
  saveDetectionState(newState);

  return apiCallDetected;
}
```

### Fallback to v1.0 Heuristic
```javascript
// Source: Existing lib/statusline/detection.js + fallback pattern
function isProcessing(claudeData, config = {}) {
  // Try improved detection first
  try {
    if (claudeData.cost?.total_api_duration_ms !== undefined) {
      return isProcessingImproved(claudeData, config);
    }
  } catch (error) {
    // Log to stderr for debugging (won't pollute stdout)
    console.error('VibeRipped detection improvement error:', error.message);
    console.error('Falling back to v1.0 token-based heuristic');
  }

  // Fallback: v1.0 token-based heuristic
  const currentUsage = claudeData.context_window?.current_usage;
  if (currentUsage === null || currentUsage === undefined) return false;
  return (currentUsage.input_tokens > 0 || currentUsage.cache_read_input_tokens > 0);
}

module.exports = { isProcessing };
```

### Configuration Schema
```javascript
// Source: Existing lib/config.js pattern
// In configuration.json:
{
  "equipment": { /* existing */ },
  "difficulty": { /* existing */ },
  "environment": "anywhere",
  "detection": {
    "sensitivity": "normal",        // "strict" | "normal" | "relaxed"
    "durationThreshold": 100,       // custom threshold in milliseconds
    "fallbackOnError": true         // use v1.0 heuristic if detection fails
  }
}

// Default configuration structure:
const DEFAULT_DETECTION_CONFIG = {
  sensitivity: 'normal',
  durationThreshold: 100,
  fallbackOnError: true
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Check `current_usage` tokens | Track `total_api_duration_ms` deltas | Phase 14 (v1.1) | Eliminates false positives on routine statusline updates |
| Single detection mode | Configurable sensitivity levels | Phase 14 (v1.1) | Users can tune detection for their workflow |
| No fallback on failure | Graceful degradation to v1.0 heuristic | Phase 14 (v1.1) | Resilient to Claude Code statusline structure changes |

**Deprecated/outdated:**
- **Token accumulation check:** `current_usage.input_tokens > 0` is the v1.0 approach that causes false positives. Keep as fallback only.
- **Assuming `current_usage` indicates "current" state:** Despite the name, this field persists after API calls complete.

## Open Questions

1. **Does `total_api_duration_ms` always increment monotonically?**
   - What we know: Field exists in statusline JSON (confirmed by official docs and community examples)
   - What's unclear: Can it ever decrease (e.g., session reset)? Does it increment on every API call or only successful completions?
   - Recommendation: Implement session ID tracking to detect resets, test empirically during live sessions

2. **What is the actual statusline update frequency during API calls?**
   - What we know: Documented 300ms throttle, updates fire on message changes
   - What's unclear: Does statusline update continuously during long API calls, or only before/after?
   - Recommendation: Log timestamps in detection state to measure real-world update intervals, adjust thresholds accordingly

3. **Are there API calls that don't increment `total_api_duration_ms`?**
   - What we know: Field tracks "time spent waiting for API responses"
   - What's unclear: Do certain cached responses or error cases skip duration tracking?
   - Recommendation: Monitor detection-state.json logs during Phase 14 testing, add fallback if API calls are missed

4. **How should detection behave during context compaction?**
   - What we know: Compaction involves an API call to summarize context
   - What's unclear: Should compaction trigger an exercise prompt?
   - Recommendation: Treat compaction as a special case (session state reset), possibly suppress exercise prompt

5. **Should rapid consecutive API calls (< 1 second apart) trigger multiple exercises?**
   - What we know: Throttled statusline updates may batch multiple API calls into one delta
   - What's unclear: Is batching desirable (reduce prompt spam) or undesirable (miss activity)?
   - Recommendation: Default to batching (simpler, less disruptive), document as known behavior

## Sources

### Primary (HIGH confidence)
- [Customize your status line - Claude Code Docs](https://code.claude.com/docs/en/statusline) - Official statusline JSON schema, field descriptions
- [Hooks reference - Claude Code Docs](https://code.claude.com/docs/en/hooks) - Hook lifecycle, statusline update timing
- Existing codebase: `/Users/jacob/Documents/apps/VibeRipped/lib/statusline/detection.js` - v1.0 token-based heuristic
- Existing codebase: `/Users/jacob/Documents/apps/VibeRipped/engine.js` - Atomic write-rename pattern, state management
- Existing codebase: `/Users/jacob/Documents/apps/VibeRipped/test/statusline.test.js` - Current test fixtures showing statusline JSON structure

### Secondary (MEDIUM confidence)
- [Claude Code Status Line Setup Guide](https://claudefa.st/blog/tools/statusline-guide) - Community examples with `total_api_duration_ms` usage
- [ccusage | Claude Code Usage Analysis](https://ccusage.com/guide/statusline) - Confirmed `cost` field structure
- [@wyattjoh/claude-status-line - JSR](https://jsr.io/@wyattjoh/claude-status-line) - TypeScript types for statusline JSON
- [GitHub Issue #8861: Add token usage details](https://github.com/anthropics/claude-code/issues/8861) - Community discussion on statusline data availability

### Tertiary (LOW confidence)
- [A Better Claude Code CLI: Custom Statusline Script](https://jeremyronking.medium.com/a-better-claude-code-cli-custom-statusline-script-jeremy-ron-king-59b09d165b90) - Community implementation patterns (Jan 2026)
- [Creating The Perfect Claude Code Status Line](https://www.aihero.dev/creating-the-perfect-claude-code-status-line) - General statusline provider concepts

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses only Node.js built-ins (confirmed by existing codebase)
- Architecture: MEDIUM - Delta tracking is inferred best practice (not officially documented)
- Pitfalls: MEDIUM - False positive issue confirmed by MEMORY.md, but specific edge cases require empirical testing

**Research date:** 2026-02-10
**Valid until:** 60 days (Claude Code statusline structure is relatively stable per docs)

**Key uncertainties requiring live testing:**
1. Exact behavior of `total_api_duration_ms` during rapid API calls
2. Statusline update timing relative to API call start/end
3. Edge cases: compaction, session restart, error responses
4. Optimal sensitivity thresholds for different workflows
