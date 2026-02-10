---
phase: 12-interactive-setup-wizard
plan: 02
subsystem: cli-commands
tags: [setup-wizard, interactive-cli, equipment-selection, config-generation]
dependency_graph:
  requires:
    - phase: 12-01
      provides: [CheckboxPrompt, confirm, requireTTY]
  provides: [setup-command, first-time-wizard, equipment-config-flow]
  affects: [cli-ux, user-onboarding]
tech_stack:
  added: []
  patterns: [interactive-setup-flow, tty-guarded-commands, atomic-config-pool-write]
key_files:
  created:
    - lib/cli/commands/setup.js
    - test/cli/setup.test.js
  modified:
    - bin/viberipped.js
decisions:
  - "Setup command creates both configuration.json and pool.json atomically in single flow"
  - "Equipment selection drives config and pool generation via assemblePool integration"
  - "Overwrite protection uses confirm prompt before replacing existing config"
  - "TTY guard prevents setup from running in non-interactive contexts (statusline safety)"
metrics:
  duration_minutes: 3
  completed_date: 2026-02-10
---

# Phase 12 Plan 02: Interactive Setup Command Summary

Interactive first-time setup wizard with equipment selection checkbox, config/pool generation, and TTY-guarded execution.

## What Was Built

Implemented the `viberipped setup` command - an interactive wizard that guides users through first-time configuration:

1. **Setup Command Handler** (`lib/cli/commands/setup.js`)
   - TTY guard at entry (prevents pipe/non-TTY execution)
   - Overwrite protection with confirm prompt for existing configs
   - Welcome message with usage instructions
   - CheckboxPrompt equipment selection (kettlebell, dumbbells, pull-up bar, parallettes)
   - Config generation with selected equipment + defaults (multiplier: 1.0, environment: 'anywhere')
   - Pool generation via `assemblePool(config)` integration
   - Atomic writes for both config and pool files
   - Success summary with next steps (test, harder, softer commands)

2. **CLI Registration** (`bin/viberipped.js`)
   - Added setup command to Commander program
   - Async action handler for setup flow
   - Appears in `--help` output

3. **Integration Tests** (`test/cli/setup.test.js`)
   - Help text presence verification
   - Non-TTY detection with proper error messages
   - Module loading validation
   - All tests use spawn with isolated temp HOME directories

## Test Coverage

Created comprehensive integration tests:
- Setup command appears in help output
- Non-TTY mode fails gracefully with exit code 1
- Error message includes alternative commands (config, pool)
- Stdout non-TTY also detected and handled
- Setup module loads without errors

All tests pass: 273 tests total (6 new tests for setup command).

## Technical Implementation

**Flow architecture:**
1. TTY guard → early exit if non-interactive
2. Config check → overwrite prompt if exists
3. Welcome → instructions for checkbox navigation
4. Equipment selection → CheckboxPrompt with 4 options
5. Config build → equipment object + defaults
6. Config save → `saveConfig()` to `~/.config/viberipped/`
7. Pool generation → `assemblePool()` filters exercises by equipment
8. Pool save → atomic write to `~/.config/viberipped/pool.json`
9. Summary → show selected equipment, pool size, next steps

**Safety features:**
- TTY detection prevents breaking statusline pipe mode
- Atomic writes prevent corruption on crash/interrupt
- Overwrite confirmation prevents accidental data loss
- Ctrl+C and Escape cleanly exit (cleanup handled by CheckboxPrompt)

**Integration points:**
- Uses all three UI primitives from Plan 01 (requireTTY, confirm, CheckboxPrompt)
- Integrates with existing config.js (saveConfig, getConfigPath)
- Integrates with existing pool.js (assemblePool)
- Follows established CLI patterns from config/pool commands

## Manual Verification

User manually verified:
- Interactive wizard launches in TTY mode
- Checkbox navigation works (arrows, space toggle, enter submit)
- Equipment selection persists to configuration.json
- Pool generation creates pool.json with filtered exercises
- Overwrite prompt appears when re-running setup
- Terminal state properly restored on exit/cancel

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Renamed binary from vibripped to viberipped across codebase**
- **Found during:** Task 3 (Manual verification checkpoint)
- **Issue:** Binary name was inconsistent with project name "VibeRipped" - should be "viberipped" not "vibripped"
- **Fix:** Renamed bin/vibripped.js to bin/viberipped.js and updated 12 files with all references
- **Files modified:** README.md, bin/vibripped.js (renamed), lib/cli/commands/pool.js, lib/cli/commands/setup.js, lib/cli/ui/tty.js, package.json, and 6 test files
- **Verification:** All tests pass, help text correct, setup command works
- **Committed in:** a435dbf (fix: rename binary from vibripped to viberipped)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug: naming consistency)
**Impact on plan:** Essential for correct branding/naming. No scope creep.

## Task Commits

Each task was committed atomically:

1. **Task 1: Setup command handler and CLI registration** - `8b6efc8` (feat)
2. **Task 2: Integration tests for setup command** - `df7eba4` (test)
3. **Task 3: Manual verification checkpoint** - User approved (no commit - checkpoint gate)

**Auto-fix commit:** `a435dbf` (fix: binary rename)

## Files Created/Modified

Created:
- `lib/cli/commands/setup.js` - Interactive setup wizard command handler (130 lines)
- `test/cli/setup.test.js` - Integration tests for setup command (117 lines)

Modified:
- `bin/viberipped.js` - Added setup command registration (+9 lines)
- 11 additional files for binary rename fix

## Decisions Made

**1. Atomic config+pool generation in single flow**
- Setup creates both configuration.json and pool.json together
- Rationale: User expects complete setup, not partial state
- Alternative rejected: Separate config/pool steps (more friction, less intuitive)

**2. Equipment selection drives everything**
- Single checkbox selection determines both config and pool
- Rationale: Equipment is the primary constraint for exercise selection
- Alternative rejected: Multi-step wizard (unnecessarily complex for v1.1)

**3. TTY guard at entry**
- Hard fail if not TTY (exit 1 with error message)
- Rationale: Prevents breaking statusline pipe mode, critical safety requirement
- Alternative rejected: Soft warning (too risky for Claude Code integration)

## Next Phase Readiness

**Blockers:** None

**Enables:**
- Phase 13: Profile management can reuse interactive patterns
- Phase 14: Detection improvements can proceed with setup wizard available

**User onboarding improved:**
- First-time users have guided setup experience
- Equipment configuration now intuitive (vs manual config flags)
- Reduced friction for new installs

## Self-Check

Verifying all claimed artifacts exist:

- `lib/cli/commands/setup.js`: ✓ EXISTS
- `test/cli/setup.test.js`: ✓ EXISTS
- `bin/viberipped.js`: ✓ EXISTS (modified)

Verifying commits exist:

- `8b6efc8`: ✓ FOUND (feat(12-02): add setup command with TTY guard and equipment selection)
- `df7eba4`: ✓ FOUND (test(12-02): add integration tests for setup command)
- `a435dbf`: ✓ FOUND (fix: rename binary from vibripped to viberipped)

## Self-Check: PASSED

All files created, all commits present, all tests passing (273 total).

---
*Phase: 12-interactive-setup-wizard*
*Completed: 2026-02-10*
