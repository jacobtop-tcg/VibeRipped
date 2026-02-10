---
phase: 12-interactive-setup-wizard
plan: 01
subsystem: cli-ui
tags: [interactive, ui-primitives, tty-detection, terminal-control]
dependency_graph:
  requires: []
  provides: [CheckboxPrompt, confirm, requireTTY]
  affects: [cli-commands]
tech_stack:
  added: [readline/promises, ANSI-escape-codes, raw-mode-terminal]
  patterns: [event-driven-keypress, cleanup-handlers, spawn-testing]
key_files:
  created:
    - lib/cli/ui/checkbox.js
    - lib/cli/ui/confirm.js
    - lib/cli/ui/tty.js
    - test/cli/ui.test.js
  modified: []
decisions: []
metrics:
  duration_minutes: 2
  completed_date: 2026-02-10
---

# Phase 12 Plan 01: Interactive UI Primitives Summary

Reusable TTY guard, confirm prompt, and checkbox multi-select widget for interactive CLI commands.

## What Was Built

Built three foundational UI primitives in `lib/cli/ui/`:

1. **TTY Detection Guard** (`tty.js`)
   - Checks `process.stdin.isTTY` and `process.stdout.isTTY`
   - Prints helpful error with non-interactive alternatives on failure
   - Prevents interactive commands from running in pipes/non-TTY contexts

2. **Confirm Prompt** (`confirm.js`)
   - Simple Y/N question utility using `readline/promises`
   - Default is No (capital N in prompt)
   - Returns boolean, always closes readline in finally block

3. **CheckboxPrompt Widget** (`checkbox.js`)
   - Interactive multi-select with arrow navigation, space toggle, enter submit
   - ANSI escape codes for in-place rendering (cursor control, color highlighting)
   - Raw mode terminal handling with proper cleanup on all exit paths
   - Handles arrow keys, space, enter, escape, and Ctrl+C/SIGINT
   - Unicode checkbox characters (☐ unchecked, ☑ checked)

## Test Coverage

Created comprehensive test suite in `test/cli/ui.test.js`:

- **TTY guard**: Non-TTY detection with error message verification (spawn with `stdio: ['ignore', 'pipe', 'pipe']`)
- **Confirm prompt**: All input variants (y, yes, n, empty/default)
- **CheckboxPrompt**: Module loading and instantiation (full interactive tests deferred to Plan 02 manual checkpoint)

All tests use spawn with isolated temp HOME directories per existing project patterns. Full suite passes: 267 tests.

## Technical Implementation

**Terminal control patterns:**
- ANSI escape codes: `\x1b[2K` (clear line), `\x1b[G` (cursor to start), `\x1b[${n}A` (cursor up)
- Color: `\x1b[36m` (cyan highlight), `\x1b[0m` (reset)
- Cursor visibility: `\x1b[?25l` (hide), `\x1b[?25h` (show)

**Cleanup handling:**
- CheckboxPrompt cleanup function called before all promise resolution/rejection paths
- Ensures raw mode disabled, stdin paused, listeners removed, cursor restored
- SIGINT handler cleans up and exits gracefully

**Testing approach:**
- spawn child processes with stdin/stdout pipes for automation
- Isolated temp HOME dirs prevent cross-test pollution
- Write input to stdin, read output from stdout, verify behavior

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Blockers:** None

**Enables:**
- Plan 02: Setup wizard can use these primitives for equipment/exercise selection
- Phase 13: Profile management commands can use confirm prompts

**Dependencies satisfied:** None (foundational primitives)

## Self-Check

Verifying all claimed artifacts exist:

- `lib/cli/ui/checkbox.js`: ✓ EXISTS
- `lib/cli/ui/confirm.js`: ✓ EXISTS
- `lib/cli/ui/tty.js`: ✓ EXISTS
- `test/cli/ui.test.js`: ✓ EXISTS

Verifying commits exist:

- `1fe48fb`: ✓ FOUND (feat(12-01): add TTY guard and confirm prompt utilities)
- `683d14e`: ✓ FOUND (feat(12-01): add CheckboxPrompt interactive multi-select widget)
- `e822415`: ✓ FOUND (test(12-01): add unit tests for UI primitives)

## Self-Check: PASSED

All files created, all commits present, all tests passing.
