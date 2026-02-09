# Pitfalls Research: v1.1 Feature Additions

**Domain:** NPM distribution, interactive UX, category rotation, timed exercises, environment profiles, detection improvements
**Researched:** 2026-02-09
**Confidence:** HIGH

This document focuses on pitfalls specific to **adding v1.1 features to the existing VibeRipped v1.0 system**. For core architecture pitfalls, see existing v1.0 research. This analysis covers: npm packaging, interactive CLI, category-aware rotation, exercise timers, environment profiles, detection tuning, and backward compatibility with existing user state.

---

## Critical Pitfalls

### Pitfall 1: NPM Bin Permissions Lost After Install

**What goes wrong:**
After `npm install -g viberipped`, the CLI binary is not executable. Users get "Permission denied" errors when running `vibripped` command. The shebang line is ignored, and the executable flag is missing on Unix systems, requiring manual `chmod +x` after installation.

**Why it happens:**
- Bin files lack executable permissions in the source repository (not tracked by git on Windows development machines)
- Missing shebang line (`#!/usr/bin/env node`) at top of bin file
- npm expects bin files to be executable pre-publish, but developers forget to chmod during development
- Cross-platform development: Windows doesn't use executable bit, so developers don't notice the issue
- Git on Windows doesn't preserve Unix executable permissions by default

**How to avoid:**
- **Add shebang as first line** of `/bin/vibripped.js`: `#!/usr/bin/env node`
- **Set executable before commit**: `chmod +x bin/vibripped.js` and verify with `ls -la bin/`
- **Configure git to preserve permissions**: `git update-index --chmod=+x bin/vibripped.js`
- **Test npm link locally** before publishing: `npm link && vibripped test` to verify bin works
- **Use prepublishOnly script** to validate: add script that checks `test -x bin/vibripped.js || exit 1`
- **Cross-platform CI testing**: test installation on Linux/macOS/Windows in CI pipeline

**Warning signs:**
- `vibripped: command not found` after global install
- `Permission denied` when running binary
- Shebang appears when file is `cat`'d but doesn't execute
- Works with `node bin/vibripped.js` but not `./bin/vibripped.js`
- Issue reports only from Unix/macOS users, not Windows users

**Phase to address:**
Phase 4 (NPM Distribution) - Verify before publishing; add to release checklist

**Recovery cost:** LOW - users can manually chmod, but terrible DX

---

### Pitfall 2: Interactive Prompts Break Statusline Stdin Pipe

**What goes wrong:**
Adding interactive prompts (Inquirer.js/Prompts) to commands breaks the statusline stdin pipe. When user runs an interactive command like `vibripped exercise --select`, the prompt hijacks stdin, statusline data can't be read, and exercise detection stops working. User gets "no exercise suggested" or CLI hangs waiting for input that never comes.

**Why it happens:**
- Statusline mode reads from stdin pipe: `echo '{"context_window": {...}}' | vibripped statusline`
- Interactive prompts **also** try to read from stdin for user input
- Only one consumer can read from stdin at a time
- Inquirer.js sets raw mode on stdin, breaking line-based reading
- Terminal state corruption: prompt library changes terminal to raw mode, statusline expects cooked mode
- Commander.js doesn't distinguish "piped stdin" from "interactive terminal" contexts

**How to avoid:**
- **Detect pipe vs terminal**: Use `process.stdin.isTTY` to determine if stdin is interactive
- **Separate command modes**: statusline commands should NEVER use interactive prompts
- **Explicit interactive flag**: `vibripped config --interactive` vs non-interactive defaults
- **Alternative input for statusline**: accept statusline JSON via `--json '{"context_window": {...}}'` flag OR stdin
- **Refuse interactive in pipe context**: If `!process.stdin.isTTY`, reject interactive commands with helpful error
- **Test both modes**: Integration test that pipes statusline data AND tests interactive commands separately

**Warning signs:**
- CLI hangs indefinitely when piped input is provided
- `vibripped statusline` works in v1.0 but breaks after adding Inquirer
- Error messages like "stdin is not a TTY" appear in production
- Works when run manually, fails when run from Claude Code statusline integration
- Interactive prompts show up in logs/automation contexts

**Phase to address:**
Phase 5 (Interactive UX) - Test interactive commands with stdin pipe before merging

**Recovery cost:** HIGH - requires architectural change to input handling

---

### Pitfall 3: Commander.js Action Handler `this` Context Lost with Interactive Prompts

**What goes wrong:**
After adding interactive prompts to Commander.js action handlers, `this.opts()` or `this.parent` throws "Cannot read property of undefined." The `this` context inside async action handlers loses binding when using Inquirer prompts, causing crashes when trying to access Commander command context, options, or parent commands.

**Why it happens:**
- Inquirer.js async prompts lose `this` binding in action handler callbacks
- Arrow functions in action handlers don't have their own `this`, inherit from wrong scope
- Nested async/await causes `this` to be undefined inside promise chains
- Commander.js `this` binding is fragile with async operations

**How to avoid:**
- **Use parameters, not `this`**: Action handlers receive `options` and `command` as parameters
  ```javascript
  // BAD
  .action(async function() {
    const opts = this.opts(); // `this` is undefined
  });

  // GOOD
  .action(async (options, command) => {
    const opts = command.opts();
  });
  ```
- **Destructure options**: `action(async (options) => { const { interactive } = options; })`
- **Avoid `function` keyword**: Use arrow functions for action handlers to avoid `this` confusion
- **Store command reference early**: `const cmd = this; await prompt(); cmd.opts();` if you must use `this`

**Warning signs:**
- TypeError: Cannot read property 'opts' of undefined
- Errors only appear after adding Inquirer/prompts integration
- Works in synchronous action handlers, fails in async handlers
- this.parent works in nested commands but not after interactive prompts

**Phase to address:**
Phase 5 (Interactive UX) - Refactor action handlers before adding prompts

**Recovery cost:** MEDIUM - requires refactoring action handlers, but straightforward fix

---

### Pitfall 4: Category Rotation Bias - Bodyweight Exercises Starved

**What goes wrong:**
After implementing category-aware rotation, users with limited equipment notice bodyweight exercises are never suggested. With 40 bodyweight exercises and 5 kettlebell exercises in pool, the naive category rotation gives each category equal turns, meaning kettlebell gets 50% of suggestions despite being 11% of pool. Bodyweight exercises are "starved" by over-representation of small equipment categories.

**Why it happens:**
- Category rotation implemented as simple round-robin: [bodyweight, kettlebell, dumbbells, pullup, parallettes]
- Equal category weighting ignores pool size differences
- Users enable one piece of equipment (e.g., kettlebell), dramatically shrinking that category but rotation still gives it 1/5 of turns
- Sequential rotation within categories exhausts small categories quickly, repeating same 3-5 exercises while large categories are underused

**How to avoid:**
- **Weighted category selection**: Probability proportional to category size
  ```javascript
  // If bodyweight=40, kettlebell=5, probability = [40/45, 5/45] = [89%, 11%]
  const categoryWeights = categories.map(c => c.exercises.length / totalExercises);
  const selectedCategory = weightedRandom(categories, categoryWeights);
  ```
- **Hybrid approach**: Alternate between "fair category rotation" and "weighted selection" (50/50 mix)
- **Minimum category interval**: Track last selection per category, enforce minimum gap before repeat
- **User preference override**: Allow explicit category weighting in config: `{"categories": {"bodyweight": 0.6, "kettlebell": 0.4}}`
- **Test with extreme distributions**: 1 kettlebell exercise + 50 bodyweight exercises should still feel balanced

**Warning signs:**
- User complaints: "I only get kettlebell exercises"
- Analytics show category distribution doesn't match pool size
- Same 3 exercises repeat while pool has 40 unused exercises
- Disabling one piece of equipment changes distribution dramatically (90% bodyweight → 50% bodyweight)

**Phase to address:**
Phase 6 (Category Rotation) - Design weighted selection before implementing simple round-robin

**Recovery cost:** MEDIUM - Can fix with config migration, but users lose rotation state

---

### Pitfall 5: Timed Exercise State Race - Cooldown Bypassed by Restart

**What goes wrong:**
Adding timed exercise mode allows users to bypass cooldown by restarting CLI. User does an exercise at 10:00am, cooldown is 30min. User closes terminal, reopens at 10:05am, runs `vibripped statusline` again, and gets new exercise immediately because `lastTriggerTime` is stored in memory, not persisted to state file.

**Why it happens:**
- Exercise timer/cooldown state stored in process memory only
- `state.json` has `lastTriggerTime` field but new code doesn't update it for timed exercises
- Developer assumes "timed mode" is separate from "statusline mode," forgets they share cooldown logic
- State file only written on statusline trigger, not during interactive timed exercises

**How to avoid:**
- **Persist timer state immediately**: Update `state.json` with `lastTriggerTime` and `lastExercise` after EVERY exercise completion
- **Unified cooldown logic**: Both statusline and interactive exercise use same `checkCooldown(state)` function
- **Atomic state updates**: Even if user Ctrl+C during exercise, last trigger time should be written BEFORE exercise starts, not after
- **Cooldown validation on startup**: Load state, check cooldown, refuse to suggest exercise if too soon
- **Test with process restart**: Run exercise, kill process, restart immediately, verify cooldown enforced

**Warning signs:**
- Users report "cooldown doesn't work"
- Rapid-fire exercises when terminal is reopened
- State file's `lastTriggerTime` is outdated compared to actual usage
- Works fine in long-running session, breaks across restarts

**Phase to address:**
Phase 7 (Timed Exercises) - Persist state before showing exercise prompt

**Recovery cost:** LOW - Config migration needed, but data structure unchanged

---

### Pitfall 6: Environment Profile Config Migration Breaks v1.0 Users

**What goes wrong:**
After adding environment profiles (home gym, office, travel), v1.0 users upgrade to v1.1 and their equipment configuration is lost. Previously `config.json` had `{"equipment": {"kettlebell": true}}`, now v1.1 expects `{"profiles": {"default": {"equipment": {...}}}}`. On first run, CLI resets to default (all equipment disabled), user's kettlebell exercises disappear.

**Why it happens:**
- Config schema changed from flat `equipment` object to nested `profiles.{name}.equipment`
- v1.1 validation rejects v1.0 config format as "invalid," returns DEFAULT_CONFIG
- No migration logic in `loadConfig()` to detect and upgrade v1.0 format
- Atomic write on config save overwrites v1.0 file without backup
- User loses 6 months of pool customization and equipment configuration

**How to avoid:**
- **Add config version field**: `{"version": 1, "equipment": {...}}` in v1.0, bump to `{"version": 2, "profiles": {...}}` in v1.1
- **Detect and migrate**: If `config.version === undefined || config.version === 1`, migrate to v2:
  ```javascript
  if (!config.version && config.equipment) {
    config = {
      version: 2,
      profiles: {
        default: {
          equipment: config.equipment,
          difficulty: config.difficulty || DEFAULT_CONFIG.difficulty
        }
      },
      activeProfile: "default"
    };
  }
  ```
- **Backup before migration**: `cp configuration.json configuration.json.v1.bak` before writing v2 format
- **Show migration notice**: Log "Migrated config from v1.0 to v1.1, backup saved to configuration.json.v1.bak"
- **Test with v1.0 state**: CI test that loads v1.0 config files and verifies migration works
- **Semver major bump**: v1.0 → v2.0 if breaking config changes, OR keep v1.1 and add migration

**Warning signs:**
- GitHub issues: "My equipment settings disappeared after upgrade"
- Users report needing to reconfigure everything
- Backup files are missing (no recovery path for users)
- Config validation logs show "invalid config" on first v1.1 run

**Phase to address:**
Phase 8 (Environment Profiles) - Write migration logic BEFORE changing config schema

**Recovery cost:** HIGH - Users lose configuration if no backup, requires manual re-setup

---

### Pitfall 7: Detection Heuristic Tuning Causes Thrashing

**What goes wrong:**
After improving detection to reduce false positives (trigger on "real" Claude usage, not statusline updates), the heuristic is tuned too aggressively. Detection now requires 5+ seconds of processing time, but quick questions ("what's the syntax for X?") take 2-3 seconds. User does 20 quick questions in a session, never triggers exercise. Heuristic is then loosened to 1 second, but now statusline polling triggers exercises every update. Continuous tuning causes "thrashing" where detection is always wrong.

**Why it happens:**
- Detection threshold is hardcoded: `if (processingTime > THRESHOLD_SECONDS)`
- Threshold is guessed based on developer's usage, doesn't match real-world usage patterns
- No telemetry to understand actual trigger rates in production
- Each "fix" overcorrects in opposite direction
- Threshold interacts with cooldown, creating complex emergent behavior
- Detection logic in v1.0 is `isProcessing()` (token usage > 0), v1.1 adds time threshold, interaction not tested

**How to avoid:**
- **Adaptive threshold**: Track trigger rate over 1 week, auto-adjust threshold to maintain target rate (e.g., 2-3 triggers/hour)
- **Multi-factor detection**: Combine multiple signals (token usage, time, statusline update frequency) rather than single threshold
- **User-configurable sensitivity**: `vibripped config set detection.sensitivity [low|medium|high]` maps to threshold ranges
- **Telemetry with consent**: Opt-in anonymous usage tracking: "Sends trigger rate stats to improve detection"
- **Dry-run mode**: `vibripped statusline --dry-run` shows what would trigger without actually triggering
- **Test with recorded statusline data**: Record 100 real statusline updates, replay through detection logic, measure false positive/negative rate
- **Threshold as config**: `{"detection": {"minimumProcessingTime": 5.0}}` in config, not hardcoded constant

**Warning signs:**
- Detection changes in every minor version release
- User complaints oscillate between "too frequent" and "never triggers"
- GitHub issues show wildly different experiences: some users love it, others hate it
- Maintainer spends more time tuning threshold than adding features
- No data to support threshold decisions, just guesses

**Phase to address:**
Phase 9 (Detection Improvements) - Add telemetry before tuning thresholds

**Recovery cost:** MEDIUM - Can add config override, but broken trust with users

---

### Pitfall 8: NPM Lifecycle Script Confusion - Build Runs on User Install

**What goes wrong:**
After publishing to npm, users report "installation hangs" or "permission denied during install." The package.json has `"prepare": "npm run build"` which was meant to run before publish, but also runs on user's `npm install -g viberipped`. If build requires dev dependencies (which aren't installed in production), install fails with "webpack: command not found."

**Why it happens:**
- `prepare` script runs on BOTH `npm publish` AND `npm install` (by design, for git installs)
- Developer intended to compile/bundle before publish, but used wrong lifecycle hook
- Production users don't have devDependencies installed, build fails
- `prepublishOnly` is the correct hook for publish-time tasks, but less known
- `postinstall` is deprecated/risky, but some developers use it for builds

**How to avoid:**
- **Use `prepublishOnly` for publish tasks**: Runs only on `npm publish`, not user installs
  ```json
  {
    "scripts": {
      "prepublishOnly": "npm run test && npm run build"
    }
  }
  ```
- **Don't build on user install**: Ship pre-built artifacts, not source requiring compilation
- **If build needed, use `prepare` carefully**: Ensure build works without devDependencies, or publish pre-built
- **Test user install flow**: `npm pack`, `npm install -g viberipped-1.1.0.tgz` in clean environment
- **Document publish process**: Runbook for "how to release" that includes `prepublishOnly` check

**Warning signs:**
- User install errors mentioning build tools (webpack, rollup, typescript)
- Install hangs on "running prepare script"
- Works when installed from local directory, fails from npm registry
- CI publish succeeds, but user reports installation broken

**Phase to address:**
Phase 4 (NPM Distribution) - Fix before first publish

**Recovery cost:** MEDIUM - Publish new version with fix, but users already hit bad version

---

### Pitfall 9: XDG_CONFIG_HOME Not Respected on macOS - User Confusion

**What goes wrong:**
v1.0 stores config at `~/.config/viberipped/` on all platforms. User on macOS has `XDG_CONFIG_HOME=/Users/alice/Library/Preferences` set for compliance with macOS conventions. After upgrading to v1.1 (which adds XDG support), config path changes to `$XDG_CONFIG_HOME/viberipped/`, but old config is at `~/.config/viberipped/`. User's settings disappear, CLI reverts to defaults.

**Why it happens:**
- v1.0 hardcodes `~/.config`, v1.1 respects `XDG_CONFIG_HOME` environment variable
- macOS users may have XDG vars set for other tools (e.g., Neovim), expecting VibeRipped to follow
- No automatic migration from old path to new path when XDG var is detected
- Path change is silent, no warning that config was reset
- Cross-platform testing missed macOS with custom XDG paths

**How to avoid:**
- **Fallback path check**: If `$XDG_CONFIG_HOME` is set but `$XDG_CONFIG_HOME/viberipped/` doesn't exist, check `~/.config/viberipped/`
- **Auto-migrate on detection**: If old path exists and new path doesn't, copy config to new location:
  ```javascript
  const oldPath = path.join(os.homedir(), '.config', 'viberipped');
  const newPath = getConfigPath(); // respects XDG_CONFIG_HOME
  if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
    console.log(`Migrating config from ${oldPath} to ${newPath}`);
    fs.cpSync(oldPath, newPath, { recursive: true });
  }
  ```
- **Log path on startup**: `vibripped config show` displays config path, helps user debug
- **Document path behavior**: README explains XDG compliance and fallback logic

**Warning signs:**
- macOS users report lost settings after upgrade
- GitHub issues: "Where did my config go?"
- No migration logic in release notes or upgrade guide
- Works on Linux, broken on macOS with XDG vars set

**Phase to address:**
Phase 8 (Environment Profiles) - Handle XDG migration when adding multi-profile support

**Recovery cost:** MEDIUM - Auto-migration possible, but users already lost settings once

---

### Pitfall 10: Subcommand Option Conflicts - `--profile` Collides Globally

**What goes wrong:**
After adding environment profiles, every command gets a `--profile <name>` global option. But `vibripped config --profile default` is ambiguous: does it mean "show config for profile default" or "run config command using profile default"? User runs `vibripped pool add "pushups" --profile home` expecting to add exercise to home profile, but CLI interprets `--profile` as global flag, changes active profile, then adds to that profile's pool, creating confusion.

**Why it happens:**
- Commander.js global options apply to ALL subcommands
- Profile selection is global concern, but subcommands have profile-specific flags
- Option name collision: global `--profile` conflicts with command-specific `--profile`
- Order matters: `--profile home pool add` vs `pool add --profile home` parsed differently
- No explicit documentation on which `--profile` takes precedence

**How to avoid:**
- **Different names**: Global option `--use-profile`, command-specific `--profile` (or vice versa)
- **Position-sensitive parsing**: Document that global flags must come before subcommand
- **Explicit precedence**: Command-specific flags override global flags, log warning if both provided
- **Alternative approach**: No global flag, require explicit `--profile` on each command that needs it
- **Test conflicts**: Integration test with `program.command().option('--profile')` and `program.option('--profile')` to verify parsing

**Warning signs:**
- User confusion: "I specified --profile but it used the wrong one"
- GitHub issues about unexpected profile usage
- Tests pass but manual testing shows wrong behavior
- Documentation has contradictory examples

**Phase to address:**
Phase 8 (Environment Profiles) - Design flag naming before implementation

**Recovery cost:** LOW - Can rename flags, but breaking change for early users

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoded detection threshold | Fast to implement, "good enough" for MVP | Users with different usage patterns unhappy, constant tuning requests | Acceptable for v1.0, must add config in v1.1 |
| No config migration on schema change | Avoid complex migration logic | Users lose settings on upgrade, angry GitHub issues | Never acceptable - always migrate or bump major version |
| Skip prepublishOnly, use prepare | Single script for dev and publish | User installs fail if build needs devDeps | Never acceptable - use prepublishOnly for publish tasks |
| Interactive prompts in statusline commands | Rich UX for manual use | Breaks pipe integration, statusline mode fails | Never acceptable - keep statusline non-interactive |
| Naive category round-robin | Simple to implement, "fair" rotation | Small categories over-represented, user complaints | Acceptable for Phase 6 MVP, must add weighting in Phase 6.5 |
| Store timer state in memory only | No file I/O complexity | Cooldown bypassed by restart, poor UX | Never acceptable - persist timer state immediately |
| No XDG path migration | Avoid cross-platform edge cases | macOS users lose config on upgrade | Never acceptable - detect and migrate old paths |
| Global --profile option | Convenient for multi-profile users | Conflicts with command-specific flags | Acceptable if documented and tested, better to use different names |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Commander.js + Inquirer.js | Using `this.opts()` in async action handlers | Pass `options` and `command` as parameters to action handler |
| npm bin + Unix permissions | Forgetting `chmod +x` on bin file before commit | Use `git update-index --chmod=+x bin/vibripped.js` and verify with `ls -la` |
| Statusline stdin + Interactive prompts | Both try to read from stdin simultaneously | Check `process.stdin.isTTY`, refuse interactive if piped input |
| XDG_CONFIG_HOME on macOS | Assuming `~/.config` is always correct path | Use `process.env.XDG_CONFIG_HOME \|\| path.join(os.homedir(), '.config')` with migration |
| npm lifecycle scripts | Using `prepare` for publish-only tasks | Use `prepublishOnly` to avoid running on user install |
| Category rotation + Equipment config | Equal category weighting ignores pool size | Weight category selection by `category.exercises.length / total` |
| Timer state + Process restart | Storing `lastTriggerTime` in memory only | Persist to `state.json` before showing exercise prompt |
| Config schema v1 → v2 | Rejecting old format, returning defaults | Detect old format, migrate to new format, backup old file |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Inquirer prompt in tight loop | CLI feels sluggish, hangs on rapid commands | Cache prompt state, debounce rapid calls | Loops with <100ms iteration |
| Synchronous atomic writes on every statusline update | Statusline processing slows down Claude Code | Debounce state writes, only save on actual state change | >10 statusline updates/sec |
| Loading full pool on every detection check | Latency spikes when pool has 500+ exercises | Lazy-load pool, cache in memory for session | Pool >200 exercises |
| JSON.stringify pretty-print on every state write | Unnecessary formatting overhead | Pretty-print in dev, compact in production | Doesn't break, just wastes cycles |
| Recursive config directory creation | `mkdirSync` called on every write | Create once, check existence before mkdir | Doesn't break, just wastes cycles |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| World-readable config files | Exposes user preferences, potential pool customizations | `fs.mkdirSync(dir, {mode: 0o700})`, `fs.writeFileSync(file, data, {mode: 0o600})` |
| Executable state files | Malicious user could replace state.json with executable script | Validate file is regular file, check permissions on read |
| Command injection in exercise names | User adds exercise with name containing shell metacharacters | Escape or reject exercise names with shell metacharacters: `; & \| $ ( )` |
| Insecure atomic write tmp file | Temp file `/tmp/vibripped-state.tmp` predictable, race condition | Use secure temp file: `${stateFile}.${process.pid}.tmp` in state directory |
| No input validation on config CLI | User sets negative cooldown, invalid equipment names | Validate all CLI inputs before persisting to config |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No feedback after profile switch | User runs `vibripped profile use home`, no confirmation | Echo "Switched to profile 'home'" and show profile summary |
| Exercise timer shows no progress | User does exercise, no idea how much time remains | Show progress bar or countdown during timed exercises |
| Migration changes config path silently | User's settings disappear, no explanation | Log migration message with old/new paths on first run |
| Cooldown bypass with restart not mentioned | User discovers by accident, feels like bug | Document cooldown persistence, show "X minutes until next exercise" |
| Interactive prompt has no cancel option | User stuck in prompt, must Ctrl+C and restart | Inquirer prompts should have "Cancel" option or document ESC/Ctrl+C |
| Detection sensitivity too cryptic | User doesn't understand "low/medium/high" sensitivity | Explain in help text: "Low = 2-3/hour, Medium = 4-5/hour, High = 6-8/hour" |
| Category rotation bias not visible | User doesn't realize bodyweight is starved | `vibripped stats` shows category distribution over last 30 days |
| Profile management requires memorizing names | User forgets profile names, typos common | `vibripped profile list` shows all profiles, autocomplete in shell |

---

## "Looks Done But Isn't" Checklist

- [ ] **NPM Distribution:** Verified bin file has `#!/usr/bin/env node` shebang and executable permissions (`chmod +x`)
- [ ] **NPM Distribution:** Tested `npm pack && npm install -g <tarball>` in clean Docker container (no dev dependencies)
- [ ] **NPM Distribution:** Used `prepublishOnly` for publish tasks, not `prepare` (which runs on user install)
- [ ] **Interactive UX:** Checked `process.stdin.isTTY` before showing interactive prompts, graceful fallback if piped
- [ ] **Interactive UX:** Commander action handlers use `(options, command)` parameters, not `this.opts()`
- [ ] **Category Rotation:** Weighted category selection by pool size, not naive round-robin
- [ ] **Category Rotation:** Tested with extreme distributions (1 exercise vs 50 exercises in categories)
- [ ] **Timed Exercises:** Persisted `lastTriggerTime` to `state.json` BEFORE showing exercise prompt
- [ ] **Timed Exercises:** Verified cooldown enforced across process restarts (test with kill + restart)
- [ ] **Environment Profiles:** Wrote config migration from v1.0 flat format to v1.1 nested profiles
- [ ] **Environment Profiles:** Tested migration with real v1.0 config files from 10+ users (if available)
- [ ] **Environment Profiles:** Backed up old config before overwriting with new format
- [ ] **XDG Support:** Detected and migrated from `~/.config/viberipped/` to `$XDG_CONFIG_HOME/viberipped/`
- [ ] **Detection Improvements:** Made threshold configurable, not hardcoded constant
- [ ] **Detection Improvements:** Added dry-run mode to preview detection behavior without triggering
- [ ] **Commander Options:** Resolved global vs command-specific flag conflicts (e.g., `--profile`)
- [ ] **State Persistence:** Validated state format on read, graceful recovery if corrupted (don't overwrite)
- [ ] **Config Validation:** Rejected invalid inputs (negative cooldown, unknown equipment) with helpful error messages
- [ ] **File Permissions:** Set `0o700` on directories, `0o600` on config/state files for security

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| NPM Bin Permissions Lost | LOW | 1. Publish patch with `chmod +x` and shebang. 2. Users reinstall: `npm update -g viberipped` |
| Interactive Prompts Break Stdin | HIGH | 1. Refactor to check `isTTY`. 2. Add non-interactive fallbacks. 3. Publish major version (breaking change) |
| Commander.js `this` Context Lost | MEDIUM | 1. Refactor action handlers to use parameters. 2. Test all commands. 3. Publish minor version |
| Category Rotation Bias | MEDIUM | 1. Implement weighted selection. 2. Publish minor version. 3. Users see improved distribution immediately |
| Timer State Lost on Restart | LOW | 1. Persist state before prompt. 2. Publish patch. 3. Existing users see cooldown enforced next restart |
| Config Migration Breaks Users | HIGH | 1. Publish hotfix with migration. 2. Send announcement with recovery steps. 3. Restore from backup if available |
| Detection Heuristic Thrashing | MEDIUM | 1. Add config override. 2. Collect telemetry (opt-in). 3. Publish minor version with adaptive threshold |
| NPM Lifecycle Script Confusion | MEDIUM | 1. Change `prepare` → `prepublishOnly`. 2. Publish new version. 3. Notify users to reinstall |
| XDG Path Not Migrated | MEDIUM | 1. Add path detection + auto-migration. 2. Publish patch. 3. Users run once, config migrated automatically |
| Subcommand Option Conflicts | LOW | 1. Rename conflicting flags. 2. Publish major version if breaking, minor if new flags added. 3. Update docs |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| NPM Bin Permissions Lost | Phase 4 (NPM Distribution) | CI test: Install from tarball, run binary without `node` prefix |
| Interactive Prompts Break Stdin | Phase 5 (Interactive UX) | Integration test: Pipe statusline JSON, verify no hang; run interactive command in TTY |
| Commander.js `this` Context Lost | Phase 5 (Interactive UX) | Unit test: Async action handler with Inquirer, verify options accessible |
| Category Rotation Bias | Phase 6 (Category Rotation) | Simulation test: Run 1000 iterations, verify distribution within 10% of expected |
| Timer State Lost on Restart | Phase 7 (Timed Exercises) | Integration test: Do exercise, kill process, restart, verify cooldown enforced |
| Config Migration Breaks Users | Phase 8 (Environment Profiles) | Migration test: Load v1.0 config, verify converted to v1.1, backup created |
| Detection Heuristic Thrashing | Phase 9 (Detection Improvements) | Dry-run test: Process 100 recorded statusline updates, compare false positive rate |
| NPM Lifecycle Script Confusion | Phase 4 (NPM Distribution) | CI test: Install in clean container (no devDeps), verify no build errors |
| XDG Path Not Migrated | Phase 8 (Environment Profiles) | Migration test: Set XDG_CONFIG_HOME, create old config, verify auto-migration |
| Subcommand Option Conflicts | Phase 8 (Environment Profiles) | Unit test: Parse `--profile` at global and command level, verify correct precedence |

---

## Sources

**NPM Packaging & Publishing:**
- [bin vs scripts in package.json - DEV Community](https://dev.to/rameshpvr/bin-vs-scripts-in-packagejson-1pnp)
- [npm-scripts | npm Documentation](https://docs.npmjs.com/misc/scripts)
- [npm bin script confusion: Abusing 'bin' to hijack 'node' commands](https://socket.dev/blog/npm-bin-script-confusion)
- [Making Your NPM Package Executable - DEV Community](https://dev.to/orkhanhuseyn/making-your-npm-package-executable-1j0b)
- [Creating cross-platform shell scripts • Shell scripting with Node.js](https://exploringjs.com/nodejs-shell-scripting/ch_creating-shell-scripts.html)
- [npm prepare and prepublishOnly ordering - GitHub Issue](https://github.com/npm/npm/issues/17522)
- [npm 4 is splitting the "prepublish" script into "prepublishOnly" and "prepare"](https://iamakulov.com/notes/npm-4-prepublish/)

**Interactive CLI & stdin/stdout:**
- [Inquirer.js - GitHub](https://github.com/SBoudrias/Inquirer.js)
- [@inquirer/prompts - npm](https://www.npmjs.com/package/@inquirer/prompts)
- [enquirer - npm](https://www.npmjs.com/package/enquirer)
- [Commander.js - GitHub](https://github.com/tj/commander.js)
- [stdin detection fails to detect pipes vs. redirected stdin - GitHub Issue](https://github.com/OJ/gobuster/issues/84)
- [Understanding stdin/stdout: Building CLI Tools Like a Pro - DEV Community](https://dev.to/sudiip__17/understanding-stdinstdout-building-cli-tools-like-a-pro-2njk)
- [Determine If Shell Input is Coming From the Terminal or From a Pipe | Linux Journal](https://www.linuxjournal.com/content/determine-if-shell-input-coming-terminal-or-pipe)

**Commander.js Subcommands & Options:**
- [Problem with nested commands · Issue #386 · tj/commander.js](https://github.com/tj/commander.js/issues/386)
- [commander@14.0.3 - jsDocs.io](https://www.jsdocs.io/package/commander)
- [Deeply nested subcommands in Node CLIs with Commander.js](https://maxschmitt.me/posts/nested-subcommands-commander-node-js)
- [Commander options hands-on – advanced CLI's with NodeJS](https://tsmx.net/commander-options/)

**Config Migration & Backward Compatibility:**
- [Backward Compatibility in Schema Evolution: Guide](https://www.dataexpert.io/blog/backward-compatibility-schema-evolution-guide)
- [Understanding JSON Schema Compatibility](https://yokota.blog/2021/03/29/understanding-json-schema-compatibility/)
- [json-schema-diff-validator - npm](https://www.npmjs.com/package/json-schema-diff-validator)
- [About semantic versioning | npm Docs](https://docs.npmjs.com/about-semantic-versioning/)
- [Mastering Modern Node.js in 2026](https://medium.com/@raveenpanditha/mastering-modern-node-js-in-2026-99d3f6199c33)

**XDG Base Directory & Cross-Platform:**
- [xdg-basedir - npm](https://www.npmjs.com/package/xdg-basedir)
- [@folder/xdg - npm](https://www.npmjs.com/package/@folder/xdg)
- [GitHub - sindresorhus/xdg-basedir: Get XDG Base Directory paths](https://github.com/sindresorhus/xdg-basedir)
- [cross-platform-node-guide/docs/4_terminal/environment_variables.md - GitHub](https://github.com/ehmicky/cross-platform-node-guide/blob/main/docs/4_terminal/environment_variables.md)
- [Support XDG conventions · Issue #59334 · nodejs/node](https://github.com/nodejs/node/issues/59334)

**Detection Heuristics & Threshold Tuning:**
- [False Positives in AI Detection: Complete Guide 2026](https://proofademic.ai/blog/false-positives-ai-detection-guide/)
- [Adaptive Thresholding Heuristic for KPI Anomaly Detection](https://arxiv.org/pdf/2308.10504)
- [Master AI Detection Thresholds Tuning Guide](https://hastewire.com/blog/master-ai-detection-thresholds-tuning-guide)
- [Key to Reducing IDS False positives | Fidelis Security](https://fidelissecurity.com/cybersecurity-101/network-security/reducing-false-positives-in-intrusion-detection-systems/)

**NPM Development Workflow:**
- [NPM Link: Developing and Testing Local NPM Packages](https://medium.com/@ruben.alapont/npm-link-developing-and-testing-local-npm-packages-b50a32b50c4a)
- [npm-link | npm Docs](https://docs.npmjs.com/cli/v9/commands/npm-link/)
- [Test global npm packages in a quick and easy way - DEV Community](https://dev.to/khenhey/test-global-npm-packages-in-a-quick-and-easy-way-4nld)
- [How to Test npm Packages Locally](https://blog.alyssaholland.me/npm-yarn-link)

---

*Pitfalls research for: VibeRipped v1.1 feature additions*
*Researched: 2026-02-09*
*Confidence: HIGH (directly informed by project codebase analysis and official documentation)*
