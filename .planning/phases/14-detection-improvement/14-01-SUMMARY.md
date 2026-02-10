---
phase: 14-detection-improvement
plan: 01
subsystem: statusline-detection
tags:
  - detection
  - api-tracking
  - delta-based
  - configurable-sensitivity
  - state-persistence
dependency_graph:
  requires:
    - lib/config.js (schema validation)
    - lib/statusline/detection.js (v1.0 baseline)
  provides:
    - delta-based API detection with duration tracking
    - configurable sensitivity presets (strict/normal/relaxed)
    - session-aware state management
    - atomic detection state persistence
  affects:
    - statusline.js (improved detection accuracy)
    - engine.js (reduced false positive triggers)
tech_stack:
  added:
    - detection-state.json (atomic state persistence)
  patterns:
    - write-rename atomic state updates
    - sensitivity threshold mapping
    - graceful fallback to v1.0 heuristic
key_files:
  created:
    - test/detection.test.js (23 tests, comprehensive coverage)
  modified:
    - lib/statusline/detection.js (delta tracking implementation)
    - lib/config.js (detection field validation and defaults)
    - test/config.test.js (updated for detection field)
decisions:
  - sensitivity_thresholds: "strict=50ms, normal=100ms, relaxed=500ms based on research findings"
  - custom_override: "durationThreshold config overrides sensitivity preset for fine-tuning"
  - session_tracking: "sessionId comparison detects restarts, prevents false positives"
  - state_location: "~/.config/viberipped/detection-state.json alongside other state files"
  - fallback_behavior: "v1.0 token heuristic when cost field unavailable (resilience)"
  - atomic_writes: "write-rename pattern prevents state corruption (matches engine.js)"
metrics:
  duration: "3 min"
  completed: "2026-02-10T13:33:15Z"
---

# Phase 14 Plan 01: Delta-Based API Detection Summary

**One-liner:** Delta-based API detection using cost.total_api_duration_ms tracking with configurable sensitivity (strict/normal/relaxed) and graceful v1.0 fallback, eliminating false positives on routine statusline updates.

## What Was Built

Implemented delta-based API detection that replaces v1.0 token accumulation heuristic with duration tracking. The new detection monitors changes in `cost.total_api_duration_ms` between statusline invocations, returning true only when duration increases by a configurable threshold. This eliminates the v1.0 false positive issue where every statusline update after the first API call triggered an exercise prompt.

### Core Functionality

1. **Delta Detection Logic**
   - Tracks `cost.total_api_duration_ms` changes between invocations
   - Configurable threshold: strict (50ms), normal (100ms), relaxed (500ms)
   - Custom `durationThreshold` override for fine-tuning
   - Returns true only when duration increases by >= threshold

2. **Session Management**
   - Monitors `session_id` changes to detect Claude Code restarts
   - Resets delta tracking on session change (no false positive on first call)
   - Handles missing `session_id` gracefully (treats as same session)

3. **State Persistence**
   - Atomic write-rename pattern (matches engine.js pattern)
   - State file: `~/.config/viberipped/detection-state.json`
   - Stores: sessionId, lastApiDuration, lastUpdate timestamp
   - Gracefully handles corrupt or missing state files

4. **Fallback Mechanism**
   - Falls back to v1.0 token-based heuristic when:
     - `cost` field is missing
     - `total_api_duration_ms` is undefined
     - Detection logic throws error
   - Configurable via `detection.fallbackOnError` (default: true)

5. **Configuration Integration**
   - New `detection` field in configuration.json:
     ```json
     {
       "detection": {
         "sensitivity": "normal",
         "durationThreshold": null,
         "fallbackOnError": true
       }
     }
     ```
   - Validated by `lib/config.js`
   - Normalized with defaults in `loadConfig()`

### Testing

Created comprehensive test suite (`test/detection.test.js`) with 23 tests covering:

- **Delta detection:** threshold enforcement, unchanged duration, sub-threshold increase
- **Session tracking:** session restart detection, missing session_id handling
- **Configurable sensitivity:** strict/normal/relaxed presets, custom threshold override
- **Fallback behavior:** missing cost field, undefined duration, token heuristic
- **State persistence:** file creation, state loading, corrupt state handling
- **Edge cases:** null/undefined claudeData, empty object

All 306 tests pass project-wide (no regressions).

## Key Technical Decisions

### 1. Sensitivity Threshold Values

**Decision:** strict=50ms, normal=100ms, relaxed=500ms

**Rationale:** Based on Phase 14 research findings:
- 50ms: Captures most API calls but may trigger on non-API updates
- 100ms: Balanced default - typical API call duration floor
- 500ms: Conservative - only long API calls trigger

**Trade-offs:**
- Lower threshold = more sensitive but more false positives
- Higher threshold = fewer false positives but may miss quick API calls
- Custom override allows users to fine-tune for their workflow

### 2. Session Tracking via session_id

**Decision:** Compare `claudeData.session_id` to detect restarts

**Rationale:**
- Claude Code provides `session_id` in statusline JSON
- Session change indicates restart (state should reset)
- Prevents false positive on first call after restart

**Implementation:**
- State stores previous `sessionId`
- Mismatch triggers state reset + return false
- Missing `session_id` treated as same session (graceful degradation)

### 3. Atomic Write-Rename Pattern

**Decision:** Use `fs.writeFileSync(tmpPath) + fs.renameSync(tmpPath, statePath)`

**Rationale:**
- Matches existing pattern from `engine.js`
- Prevents corruption on crash/interrupt
- Atomic rename operation on Unix filesystems

**Alternative considered:** write-file-atomic library
**Rejected because:** Zero external dependencies constraint

### 4. Fallback to v1.0 Heuristic

**Decision:** Fall back to token-based detection when cost field unavailable

**Rationale:**
- Resilience against Claude Code statusline structure changes
- Ensures exercise triggering continues even if detection fails
- Configurable via `fallbackOnError` (can be disabled for debugging)

**Implementation:**
- Try delta detection first (if `cost.total_api_duration_ms` exists)
- Catch errors, log to stderr, fall through to v1.0
- v1.0: `currentUsage.input_tokens > 0 || currentUsage.cache_read_input_tokens > 0`

### 5. State File Location

**Decision:** `~/.config/viberipped/detection-state.json`

**Rationale:**
- Co-located with other VibeRipped state files
- XDG Base Directory specification
- User-only permissions (mode 0o600)

**Structure:**
```json
{
  "sessionId": "session-abc123",
  "lastApiDuration": 1500,
  "lastUpdate": 1770730211000
}
```

## Deviations from Plan

None - plan executed exactly as written. All tasks completed as specified, tests pass, verification criteria met.

## Implementation Notes

### Detection Flow

1. **Entry:** `isProcessing(claudeData, options)`
2. **Check:** `claudeData.cost?.total_api_duration_ms !== undefined`
3. **Load state:** Read detection-state.json (or create empty state)
4. **Session check:** Compare `claudeData.session_id` with `state.sessionId`
   - **Mismatch:** Reset state, save, return false
   - **Match:** Continue to delta calculation
5. **Delta calculation:** `currentDuration - state.lastApiDuration`
6. **Threshold check:** `delta >= getThreshold(config)`
7. **Save state:** Atomic write-rename with new duration
8. **Return:** True if delta >= threshold, false otherwise
9. **Fallback:** If cost field missing, use v1.0 token heuristic

### Testing Pattern

Tests use isolated temp directories to avoid state file conflicts:

```javascript
const tmpDir = createTmpDir();
const statePath = path.join(tmpDir, 'detection-state.json');
isProcessing(data, { statePath, config });
cleanupTmpDir(tmpDir);
```

This pattern ensures tests are independent and can run in parallel.

### Config Validation

Added detection field validation to `lib/config.js`:

- `detection` must be object (if present)
- `sensitivity` must be string (if present)
- `durationThreshold` must be number or null (if present)
- `fallbackOnError` must be boolean (if present)

Normalization in `loadConfig()`:
- Missing fields filled with defaults
- `sensitivity` defaults to "normal"
- `durationThreshold` defaults to null (uses sensitivity mapping)
- `fallbackOnError` defaults to true

## Testing Results

```
test/detection.test.js:
  23 tests, 23 pass, 0 fail

test/config.test.js:
  28 tests, 28 pass, 0 fail

Project-wide:
  306 tests, 306 pass, 0 fail
  Duration: 4.1 seconds
```

## Next Steps

**Plan 14-02:** Integration with statusline.js - update statusline provider to use new detection options (pass statePath and config), add live testing scenarios, update integration tests.

**Live testing required:** Phase 14 research identified uncertainties requiring empirical validation:
- Exact behavior of `total_api_duration_ms` during rapid API calls
- Statusline update timing relative to API call start/end
- Edge cases: context compaction, error responses, session restart timing
- Optimal sensitivity thresholds for different workflows

## Self-Check: PASSED

**Created files verified:**
```bash
[ -f "test/detection.test.js" ] && echo "FOUND: test/detection.test.js"
```
FOUND: test/detection.test.js

**Modified files verified:**
```bash
[ -f "lib/statusline/detection.js" ] && echo "FOUND: lib/statusline/detection.js"
[ -f "lib/config.js" ] && echo "FOUND: lib/config.js"
[ -f "test/config.test.js" ] && echo "FOUND: test/config.test.js"
```
FOUND: lib/statusline/detection.js
FOUND: lib/config.js
FOUND: test/config.test.js

**Commits verified:**
```bash
git log --oneline --all | grep -q "a57c808" && echo "FOUND: a57c808"
```
FOUND: a57c808

**Atomic write pattern verified:**
```bash
grep -q "renameSync" lib/statusline/detection.js && echo "FOUND: renameSync pattern"
```
FOUND: renameSync pattern

**All verification checks passed.**
