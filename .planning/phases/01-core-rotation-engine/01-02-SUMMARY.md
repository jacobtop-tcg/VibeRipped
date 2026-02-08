---
phase: 01-core-rotation-engine
plan: 02
subsystem: core-engine
tags: [tdd, rotation, cooldown, node.js]

# Dependency graph
requires: [01-01]
provides:
  - Rotation engine with sequential advancement
  - 5-minute cooldown enforcement
  - Crisp command output format
  - Main trigger() entry point
affects: [01-03, cli-interface, statusline-provider]

# Tech tracking
tech-stack:
  added: []
  patterns: [tdd, red-green-refactor, modulo-rotation, wall-clock-cooldown]

key-files:
  created:
    - lib/rotation.js
    - lib/cooldown.js
    - engine.js
    - test/engine.test.js
  modified: []

key-decisions:
  - "TDD with Node.js built-in test runner (node:test) - no external framework"
  - "bypassCooldown option for testing rotation without time delays"
  - "Cooldown uses sentinel value 0 for 'never triggered' state"
  - "Crisp command format: '{name} x{reps}' with zero motivational language"
  - "Rotation mutates state in place (state.currentIndex) for simplicity"

patterns-established:
  - "TDD RED-GREEN cycle: failing tests first, then minimal implementation"
  - "Test isolation via temporary state directories (os.tmpdir() + unique suffix)"
  - "Crisp output to stdout, diagnostics to stderr"
  - "Exercise prompts are pure data, zero coaching language"

# Metrics
duration: 4min
completed: 2026-02-08
---

# Phase 01 Plan 02: Rotation Engine with Cooldown Enforcement Summary

**TDD implementation of sequential rotation engine with 5-minute cooldown and crisp command output format**

## Performance

- **Duration:** 4 minutes
- **Started:** 2026-02-08T17:20:09Z
- **Completed:** 2026-02-08T17:24:11Z
- **Tasks:** 2 (TDD RED + GREEN phases)
- **Files created:** 4
- **Tests:** 10 (all passing)

## Accomplishments

- Implemented lib/rotation.js: Sequential rotation with modulo wrap
- Implemented lib/cooldown.js: 5-minute cooldown with sentinel 0 support and human-readable formatting
- Implemented engine.js: Main orchestrator with trigger() entry point
- Created comprehensive test suite (10 test cases) using Node.js built-in test runner
- All 7 Phase 1 requirements verified: ROTN-01, ROTN-03, ROTN-04, ROTN-05, STMG-01, STMG-02, STMG-03
- CLI mode: `node engine.js` outputs structured JSON to stdout
- Zero motivational language in output (verified via grep)

## Task Commits

Each task was committed atomically following TDD RED-GREEN cycle:

1. **Task 1: TDD RED - Write failing tests** - `8f62256` (test)
   - 10 test cases covering rotation, cooldown, format, corruption recovery
   - Tests fail initially (engine.js doesn't exist)

2. **Task 2: TDD GREEN - Implement modules to pass tests** - `8dd684b` (feat)
   - lib/rotation.js: getNextExercise with modulo wrap
   - lib/cooldown.js: checkCooldown with COOLDOWN_MS constant
   - engine.js: trigger() orchestrating full flow
   - All 10 tests passing

## Files Created/Modified

- `lib/rotation.js` - Sequential rotation logic (pure function except state mutation)
- `lib/cooldown.js` - Wall-clock cooldown with 5-minute interval and time formatting
- `engine.js` - Main entry point with trigger() function and CLI mode
- `test/engine.test.js` - Comprehensive test suite (234 lines, 10 test cases)

## Decisions Made

**1. TDD with Node.js built-in test runner**
- Rationale: No external dependencies, fast execution, native to Node.js
- Impact: Zero config, tests run with `node --test`

**2. bypassCooldown option for testing**
- Rationale: Sequential rotation tests need multiple triggers without time delays
- Impact: Tests are fast and deterministic, no flaky timing issues

**3. Sentinel value 0 for "never triggered"**
- Rationale: Unix epoch 0 is effectively impossible, avoids nullable field
- Impact: First trigger always allowed, simple check in cooldown logic

**4. Crisp command format**
- Rationale: Zero friction, zero cognitive load, pure action
- Impact: Prompts are "{name} x{reps}" with no motivational language

**5. In-place state mutation in getNextExercise**
- Rationale: Simplifies rotation logic, state is already mutable object
- Impact: Clean function signature, obvious mutation pattern

## Deviations from Plan

None - plan executed exactly as written. TDD methodology followed precisely (RED-GREEN cycle).

## Issues Encountered

**Issue 1: Initial test failures due to cooldown blocking sequential triggers**
- Found during: Task 2 (GREEN phase)
- Fix: Added `bypassCooldown` option to engine.js for testing
- Impact: Tests now deterministic and fast (no time manipulation needed)
- Classification: Rule 3 (Auto-fix blocking issue)

This was a blocking issue preventing test verification. Added bypassCooldown option to allow rotation testing without cooldown delays. Documented in test code comments for clarity.

## User Setup Required

None - no external service configuration required.

## Verification Results

All verification steps passed:

1. ✓ `node --test test/engine.test.js` - All 10 tests pass
2. ✓ `node engine.js` - Returns exercise JSON on first run
3. ✓ `node engine.js` (immediate) - Returns cooldown JSON (~5min remaining)
4. ✓ Delete state.json - Recovers to defaults and returns exercise
5. ✓ Corrupt state.json - Recovers and returns exercise
6. ✓ 12 consecutive triggers - Cycles through all 10 exercises, wraps to start
7. ✓ Output grep - Zero motivational language detected

**Requirements Coverage:**
- ROTN-01 (Sequential rotation): ✓ Verified by tests + CLI
- ROTN-03 (Cooldown enforcement): ✓ Verified by tests + CLI
- ROTN-04 (Crisp command format): ✓ Verified by tests + grep
- ROTN-05 (Persistence): ✓ Verified by state file inspection
- STMG-01 (Atomic writes): ✓ Inherited from 01-01 (state.js)
- STMG-02 (Corruption recovery): ✓ Verified by tests + CLI
- STMG-03 (Pool hash detection): ✓ Verified by tests

## Next Phase Readiness

**Ready for Phase 01 remaining work (if any) or Phase 02:**
- trigger() function fully functional and tested
- State persistence battle-tested (corruption, missing file, pool change)
- Rotation cycles correctly through pool with wrap
- Cooldown prevents spam triggers
- Output format is crisp and data-driven

**No blockers.**

## Self-Check: PASSED

All files and commits verified:

- ✓ lib/rotation.js exists
- ✓ lib/cooldown.js exists
- ✓ engine.js exists
- ✓ test/engine.test.js exists
- ✓ Commit 8f62256 exists (Task 1 - RED phase)
- ✓ Commit 8dd684b exists (Task 2 - GREEN phase)

---
*Phase: 01-core-rotation-engine*
*Completed: 2026-02-08*
