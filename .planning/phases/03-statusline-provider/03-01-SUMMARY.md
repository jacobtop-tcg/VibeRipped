---
phase: 03-statusline-provider
plan: 01
subsystem: statusline
tags: [tdd, node-test, ansi, json-parsing, process-detection]

# Dependency graph
requires:
  - phase: 02-exercise-pool-configuration
    provides: Config-driven engine with pool.json persistence
provides:
  - parseStdin function for safe JSON parsing from Claude Code stdin
  - isProcessing heuristic for process detection via token usage
  - formatExercise with cyan bold ANSI formatting
  - 19 unit tests covering all three statusline modules
affects: [03-02, statusline-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [TDD with Node.js built-in test runner, ANSI escape sequences for terminal formatting]

key-files:
  created:
    - lib/statusline/stdin.js
    - lib/statusline/detection.js
    - lib/statusline/format.js
    - test/statusline.test.js
  modified: []

key-decisions:
  - "Process detection uses MEDIUM confidence heuristic: positive tokens = processing"
  - "formatExercise decoupled from engine types by accepting primitives (name, reps)"
  - "Explicit null and undefined checks in detection (not just falsy)"
  - "Zero tokens means session started but no processing (returns false)"

patterns-established:
  - "TDD RED-GREEN cycle: tests first, implementation second, atomic commits per phase"
  - "Module decoupling: format.js takes primitives, not engine objects"
  - "Safe parsing pattern: return null on error, never throw"

# Metrics
duration: 1min
completed: 2026-02-08
---

# Phase 03 Plan 01: Statusline Library Modules Summary

**Three TDD-tested modules for JSON parsing, process detection via token heuristics, and ANSI exercise formatting**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-08T00:48:54Z
- **Completed:** 2026-02-08T00:50:33Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created parseStdin for safe JSON parsing with null-on-error contract
- Implemented isProcessing with MEDIUM confidence heuristic (positive token check)
- Built formatExercise with cyan bold ANSI escape sequences
- All 19 statusline unit tests pass, zero regression on 43 existing tests

## Task Commits

Each task was committed atomically:

1. **Task 1: RED - Write failing tests for statusline modules** - `1fd6876` (test)
2. **Task 2: GREEN - Implement statusline modules to pass all tests** - `4d9958d` (feat)

_Note: TDD tasks have multiple commits (test → feat)_

## Files Created/Modified
- `lib/statusline/stdin.js` - Safe JSON parsing with null-on-error contract
- `lib/statusline/detection.js` - Process detection heuristic via token usage checks
- `lib/statusline/format.js` - ANSI cyan bold formatting for exercise prompts
- `test/statusline.test.js` - 16 test cases covering all three modules (19 total with suites)

## Decisions Made

**1. Process detection heuristic confidence level: MEDIUM**
- Rationale: stdin JSON schema doesn't expose explicit "is processing" flag. Positive token counts indicate recent/active processing, but edge cases exist (cooldown period immediately after processing). Empirical validation needed in Plan 02.

**2. formatExercise accepts primitives (name, reps), not exercise object**
- Rationale: Decouples format module from engine internals. Caller extracts name/reps from engine response. Maintains single responsibility and testability.

**3. Explicit null AND undefined checks in detection (not just falsy)**
- Rationale: Zero tokens is semantically different from null current_usage. Zero = "session started but no processing yet" (return false). Null = "pre-first-API-call" (return false). Positive = "processing" (return true).

**4. Zero tokens means "not processing"**
- Rationale: Token counts update after API calls. Zero means session initialized but Claude hasn't processed anything yet. This is the MEDIUM confidence assumption that will be validated empirically.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TDD cycle executed smoothly. All tests passed on first GREEN implementation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Plan 02 (Statusline Integration):**
- All three modules tested and ready for integration
- Detection heuristic needs empirical validation with real Claude Code sessions
- ANSI formatting confirmed working via unit tests

**Blocker:**
- Process detection heuristic has MEDIUM confidence. Empirical validation required in 03-02 checkpoint to confirm token-based detection works reliably in production.

## Self-Check: PASSED

All files and commits verified:
- lib/statusline/stdin.js - FOUND
- lib/statusline/detection.js - FOUND
- lib/statusline/format.js - FOUND
- test/statusline.test.js - FOUND
- Commit 1fd6876 - FOUND
- Commit 4d9958d - FOUND

---
*Phase: 03-statusline-provider*
*Completed: 2026-02-08*
