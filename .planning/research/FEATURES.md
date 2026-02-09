# Feature Research: VibeRipped v1.1

**Domain:** CLI exercise app with npm distribution, interactive setup, category rotation, timed exercises, environment profiles
**Researched:** 2026-02-09
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **npm global install** | Users expect `npm install -g vibripped` then `vibripped` command works | LOW | Standard npm bin field, shebang `#!/usr/bin/env node`. Required for distribution. |
| **One-command setup** | Modern CLIs support `vibripped setup` or similar onboarding | MEDIUM | Interactive wizard using inquirer.js. Single command creates config from scratch. |
| **Equipment selection UI** | CLI setup should show checkboxes for equipment, not require manual JSON editing | MEDIUM | inquirer.js checkbox prompt. Standard pattern: `[x] Kettlebell [ ] Dumbbells [x] Pull-up bar`. |
| **README with install/usage** | npm packages must document install, setup, basic usage | LOW | Standard README.md with install instructions, GIF demo (optional), command list. |
| **Category-aware rotation** | Fitness apps avoid consecutive same-muscle-group exercises | MEDIUM | Tag exercises with categories (push/pull/legs/core), rotation skips same category. Prevents "pushups then dips then bench press". |
| **Timed exercise support** | Some exercises are duration-based (planks, wall sits) not rep-based | LOW | Exercise metadata: `{type: "timed", duration: 30}` vs `{type: "reps", count: 15}`. Display "Plank 30s" vs "Pushups x15". |
| **Environment-aware filtering** | Users need different exercises in different contexts (home office vs coworking) | MEDIUM | Profile system: exercises tagged `publicSafe: false` (e.g., floor exercises) filtered in public environments. |
| **Batch exercise management** | Adding multiple exercises one-by-one is tedious | LOW | `vibripped pool add "Squats,Lunges,Calf raises"` splits on comma, adds all. |
| **Visual equipment list** | Users forget what equipment they've configured | LOW | `vibripped config --show` displays current equipment selections with checkmark format. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Zero external dependencies for v1.0** | Entire v1.0 used only Node.js builtins — rare for modern npm packages | LOW | Continue this for core features. inquirer.js is first external dependency (setup only). |
| **First-run wizard with smart defaults** | Most CLIs require reading docs then manual config. Auto-detect common equipment, suggest defaults | MEDIUM | `vibripped setup` wizard: checkbox equipment → suggests exercises → creates config. "Most users take defaults" pattern. |
| **Category rotation with recovery awareness** | Beyond simple sequential rotation — ensure muscle groups get recovery time | HIGH | Track last-used category per major group (push/pull/legs/core). Skip if used recently. Research: 48-72hr recovery optimal. |
| **Public-safe exercise filtering** | Recognition that developers work in public spaces (coworking, coffee shops) where floor exercises aren't viable | MEDIUM | Boolean tag `publicSafe` on exercises. Profile system: `home`, `office`, `public`. Coworking filters out floor work, pull-up bar exercises. |
| **Timed exercise countdown integration** | Display "Plank 30s" and statusline shows countdown (if possible) or duration | LOW-MEDIUM | Display format clear. Countdown in statusline requires investigation (might be Phase 2). |
| **Interactive pool management** | Instead of remembering CLI syntax, show checklist of all exercises, toggle add/remove | MEDIUM | `vibripped pool manage` shows inquirer.js checkbox of all known exercises, current pool pre-selected. Save on exit. |
| **Migration path from v1.0** | v1.0 shipped without npm distribution. v1.1 must migrate existing users smoothly | LOW | Detect old config location, migrate automatically on first v1.1 run. Show "Migrated from v1.0" message. |
| **Detection accuracy improvement** | v1.0 triggers on all statusline updates after first API call. v1.1 should only trigger during actual API processing | HIGH | Requires deeper Claude Code statusline heuristics. Parse stdin JSON for API call signatures, not just token deltas. Research flag: complex. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Automatic category detection from exercise names** | "Why do I have to tag exercises with categories? Just parse 'Push-ups' → push" | Brittle NLP, fails on custom exercise names ("Ring work"), adds complexity without reliability | Manual category tagging during `pool add`. Clear, predictable, works with any name. |
| **Profile auto-switching by location/WiFi** | "Detect I'm at coworking and switch to public profile automatically" | Requires OS-level permissions, flaky WiFi detection, privacy concerns, platform-specific code | Manual profile switching: `vibripped config --profile public`. Fast, explicit, works everywhere. |
| **Exercise completion confirmation** | "How do I log when I've done the exercise?" | Adds interaction during flow, breaks "zero friction" philosophy. Tracking is scope creep. | Trust user autonomy. Display prompt, assume compliance. No logging. |
| **Cloud sync for multi-machine** | "I want my rotation state synced across work laptop and home desktop" | Adds backend infrastructure, authentication, sync conflicts, maintenance burden | State is local. Power users can symlink config directory to Dropbox/iCloud if needed. |
| **AI-generated exercise suggestions** | "AI could suggest new exercises based on my equipment and skill level" | Non-deterministic, adds API dependency, scope creep into fitness coaching | Curated exercise pool. User adds exercises manually. Predictable, offline, zero API costs. |
| **Video/GIF exercise demos** | "Show me how to do the exercise" | Massive scope increase (asset management, licensing, UI), assumes user incompetence | Assume user knows movements. If not, exercise doesn't belong in pool. External docs OK. |
| **Social features (sharing, leaderboards)** | "Let me share my setup or compete with friends" | Misaligned with "boring systems get used". Adds social pressure, comparison anxiety, backend infrastructure | Single-player experience. Your rotation, your equipment, your pace. |
| **Multiple rotation strategies (random, difficulty-based, etc)** | "Let me choose random rotation instead of sequential" | Feature creep. v1.0 validated sequential rotation works. Random = unpredictable = less habitual | Sequential with category awareness. Predictable, familiar, enables automaticity. |

## Feature Dependencies

```
npm distribution
    └──requires──> package.json bin field
    └──requires──> Shebang (#!/usr/bin/env node)
    └──requires──> README.md

Interactive setup wizard
    └──requires──> inquirer.js dependency
    └──requires──> Equipment selection UI
    └──enhances──> First-run experience

Category-aware rotation
    └──requires──> Exercise metadata (category tags)
    └──requires──> Category tracking in state
    └──enhances──> Sequential rotation engine (v1.0)
    └──requires──> Migration path for v1.0 exercises (add category tags)

Timed exercise support
    └──requires──> Exercise metadata (type: timed/reps)
    └──requires──> Display format changes ("Plank 30s" vs "Pushups x15")
    └──conflicts──> Latency-based rep scaling (timed exercises have fixed duration)

Environment profiles
    └──requires──> Profile configuration (home/office/public)
    └──requires──> Exercise metadata (publicSafe boolean)
    └──requires──> Profile switching command
    └──enhances──> Category-aware rotation (filter by profile then rotate)

Batch exercise management
    └──requires──> CSV parsing (split on comma)
    └──enhances──> `pool add` command (v1.0)

Interactive pool management
    └──requires──> inquirer.js checkbox prompt
    └──requires──> Full exercise database (all known exercises)
    └──enhances──> `pool add/remove` commands (v1.0)

Detection accuracy improvement
    └──requires──> Deeper Claude Code statusline parsing
    └──requires──> API call signature detection
    └──enhances──> Statusline provider (v1.0)
    └──research──> Phase-specific investigation needed (complexity unknown)
```

### Dependency Notes

- **Category-aware rotation requires migration**: v1.0 exercises have no category metadata. Migration script must tag existing exercises or prompt user.
- **Timed exercises conflict with latency-based scaling**: Duration-based exercises (plank 30s) can't scale with latency like rep-based. Decision: timed exercises use fixed duration, ignore latency scaling.
- **Environment profiles enhance category rotation**: Filter exercises by profile first (public-safe check), then apply category rotation logic.
- **Interactive wizard requires first external dependency**: inquirer.js adds ~50KB. Trade-off: better UX vs dependency addition. Verdict: worth it for setup quality.
- **Detection improvement needs research flag**: v1.0 heuristic is known limitation. v1.1 improvement requires investigation into Claude Code stdin JSON structure. Might be Phase 2 if too complex.

## MVP Definition for v1.1

### Launch With (v1.1)

Minimum feature set to make v1.1 valuable as successor to v1.0.

- [x] **npm global install** — Core distribution requirement. Users expect `npm i -g vibripped` workflow.
- [x] **Interactive setup wizard** — First-run experience improvement. Equipment checkbox selection.
- [x] **Category-aware rotation** — Intelligence upgrade. Avoids consecutive same-muscle-group exercises.
- [x] **Timed exercise support** — Completes exercise type coverage. Planks, wall sits, hollow holds.
- [x] **Environment profiles** — Context-aware filtering. Home office vs coworking equipment/exercise availability.
- [x] **README with install/usage** — Documentation requirement for npm distribution.
- [x] **Migration path from v1.0** — Smooth upgrade for existing users. Auto-migrate config and state.

**Why this set:** Addresses all v1.1 milestone goals (distribution, intelligence, UX). Each feature is table stakes or differentiator. No nice-to-haves.

### Add After Validation (v1.2)

Features to add once v1.1 is stable and users provide feedback.

- [ ] **Detection accuracy improvement** — Trigger: Users report exercises during non-API statusline updates. Complex, needs research.
- [ ] **Batch exercise management** — Trigger: Users request easier multi-exercise addition. Low complexity, quality-of-life.
- [ ] **Interactive pool management** — Trigger: Users forget `pool add/remove` syntax. Medium complexity, UX refinement.
- [ ] **Visual equipment list** — Trigger: Users ask "what equipment did I configure?". Low complexity, info display.
- [ ] **Timed exercise countdown** — Trigger: Users want to see countdown for duration-based exercises. Medium complexity, requires statusline investigation.

### Defer to Future (v2.0+)

Features that add complexity without validating v1.1 improvements.

- [ ] **Profile auto-switching** — Why defer: Requires OS-level permissions, platform-specific code. Manual switching sufficient.
- [ ] **Cloud sync** — Why defer: Massive scope (backend, auth, sync). Local-first is core value. Power users can use filesystem sync.
- [ ] **Multiple rotation strategies** — Why defer: Sequential validated in v1.0. Random/alternative strategies unproven need.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| npm global install | HIGH | LOW | P1 |
| Interactive setup wizard | HIGH | MEDIUM | P1 |
| Category-aware rotation | HIGH | MEDIUM | P1 |
| Timed exercise support | HIGH | LOW | P1 |
| Environment profiles | HIGH | MEDIUM | P1 |
| README with install/usage | HIGH | LOW | P1 |
| Migration path from v1.0 | HIGH | LOW | P1 |
| Detection accuracy improvement | MEDIUM | HIGH | P2 |
| Batch exercise management | MEDIUM | LOW | P2 |
| Interactive pool management | MEDIUM | MEDIUM | P2 |
| Visual equipment list | LOW | LOW | P2 |
| Timed exercise countdown | MEDIUM | MEDIUM | P2 |

**Priority key:**
- **P1**: Must have for v1.1 launch (validates milestone goals)
- **P2**: Should have, add when possible (quality-of-life after v1.1)
- **P3**: Nice to have, future consideration (deferred to v2.0+)

## Domain-Specific Feature Insights

### Interactive Terminal Setup Wizards (2026 Patterns)

**Standard libraries:** Commander.js (argument parsing), Inquirer.js (interactive prompts), Chalk (color formatting). Commander.js has 25M+ weekly downloads, powers Vue CLI, Create React App.

**Best practices:**
- Support both interactive and non-interactive modes (wizard vs flags)
- Use inquirer.js checkbox prompts for multi-select (equipment selection)
- Provide smart defaults — "most users take defaults"
- Show preview/dry-run before committing changes
- Single-command onboarding: `npx @statsig/wizard@latest` pattern
- Fuzzy matching for user input (typo tolerance)
- Configstore or similar for persistent config (vibripped uses JSON files)

**VibeRipped application:** `vibripped setup` interactive wizard. Checkbox equipment selection (kettlebell, dumbbells, pull-up bar, parallettes). Show exercise count per category. Confirm and create config. Falls back to `vibripped config --kettlebell --dumbbells` flag-based setup for non-interactive.

### Category-Aware Exercise Rotation Patterns

**Standard categories in fitness apps:**
- **Push-Pull-Legs (PPL):** Push (chest, shoulders, triceps), Pull (back, biceps, rear delts), Legs (quads, hamstrings, glutes, calves)
- **Upper-Lower:** Upper body vs Lower body split
- **Core:** Dedicated core/abs category

**Rotation principles:**
- Muscle groups need 48-72 hours recovery before re-targeting
- Consecutive same-category exercises lead to fatigue and poor form
- Successful apps track last-used category and skip if used recently
- Fitbod uses visual muscle map showing fresh vs fatigued areas
- Push/Pull/Legs split is most efficient because related muscle groups trained together

**VibeRipped application:** Tag exercises with category (push/pull/legs/core). Sequential rotation with category skip logic: if next exercise in pool matches recently-used category, advance to next different category. Track last N categories in state (N=2 sufficient). Simple heuristic: "don't repeat category twice in a row."

### Timed Exercises vs Rep-Based Exercises

**When to use timed:**
- Isometric holds: planks, wall sits, hollow holds
- Endurance-focused movements
- Exercises where rep quality varies widely (stretches)

**When to use rep-based:**
- Dynamic movements: pushups, squats, kettlebell swings
- Countable repetitions with clear start/end
- Strength-focused exercises

**Implementation patterns:**
- Apps support both: timers with rep counters, pacing guidance
- Timed exercises show countdown (visual progress bar or seconds remaining)
- Rep-based shows count and optional timer for pacing
- Modern apps (2026): extra visuals like timers, rep counters rated highly for form and confidence

**VibeRipped application:** Exercise metadata includes `type: "timed"` or `type: "reps"`. Display format: "Plank 30s" (timed) vs "Pushups x15" (reps). Timed exercises ignore latency-based scaling (fixed duration). Rep-based exercises use existing v1.0 latency scaling. Both participate in category rotation equally.

### Environment Profiles Configuration Patterns

**Standard CLI profile patterns:**
- **File-based:** Config files in user home (`~/.toolrc`, `~/.config/tool/config`)
- **Profile management:** Named profiles (dev, staging, prod) with `--profile` flag
- **Environment variable precedence:** `TOOL_PROFILE=prod` overrides config file
- **Merge strategy:** Base config + profile overrides
- **XDG Base Directory:** `~/.config/tool/` for user config (v1.0 already uses this)

**Tools with profile patterns:** Databricks CLI, AWS CLI, Atmos, Temporal. Consistent pattern: profiles activated via `--profile` flag or env var, merged on top of base config.

**VibeRipped application:** Profiles defined in `~/.config/vibripped/profiles.json`. Default profile in main config. Profile structure: `{ name: "home", equipment: ["kettlebell", "dumbbells", "pull-up-bar"], publicSafe: true }`. Switch with `vibripped config --profile public`. Exercises filtered by profile's equipment AND publicSafe setting. Statusline reads current profile from state.

### npm Package Distribution Patterns (2026)

**Security:** Trusted publishing via OIDC (OpenID Connect) from CI/CD replaces long-lived tokens. npm CLI 11.5.1+ required. Classic tokens deprecated after supply chain attacks (Shai-Hulud 2.0 worm).

**Bin scripts:**
- `package.json` bin field maps command names to scripts: `{"bin": {"vibripped": "./bin/vibripped.js"}}`
- Shebang required: `#!/usr/bin/env node` at top of bin script
- npm symlinks to `prefix/bin` (global) or `./node_modules/.bin/` (local)
- Works on Windows (npm shimmer handles shebang)

**Module formats:** ESM (module) + CJS (main) for broad compatibility. Modern packages support both.

**Pre-publish checks:** `npx pack --dry-run` shows included files, prevents leaking secrets or missing source.

**Versioning:** SemVer2 conventions. Avoid custom distribution tags (alpha/beta) — they're server-side and can change without notice.

**Best practices:**
- Scoped packages (`@org/package`) for namespace security
- Granular access tokens (not classic tokens)
- Security checks in CI/CD
- README with install, usage, examples
- Test framework and lint in CI

**VibeRipped application:** Unscoped package `vibripped` (no org). Bin script with shebang. README with install, setup, command reference. npx support for one-off commands if useful. No CI/CD initially (manual publish). v1.0 uses built-ins only; v1.1 adds inquirer.js (first dependency).

### Detection Heuristic Improvement Patterns

**v1.0 limitation:** Triggers on all statusline updates after first API call. Desired: trigger only during actual API processing.

**Workout app detection patterns:**
- Apple Watch: accelerometer patterns + HRV + motion detection
- Samsung Health: heart rate variability + accelerometer + user biometrics
- Motra: Neural Kinetic Profiling from smartwatch motion (470+ exercises)
- Google Fit: automatic activity detection based on rhythm, force, cadence

**CLI detection patterns for Claude Code:**
- Parse stdin JSON structure for API call signatures (not just token counts)
- Look for specific fields indicating active processing: `processing: true`, `api_call_in_flight: true`, `latency_ms: >0`
- Track state transitions: idle → processing → complete
- Cooldown still applies (don't re-trigger on subsequent updates within 5min)

**VibeRipped v1.1 approach:** Investigate stdin JSON schema from Claude Code statusline provider. Add detection logic beyond token delta. Look for explicit "API call active" signals. If no clear signal exists, flag for Phase 2 (might require Claude Code updates or deeper heuristics). Worst case: v1.0 heuristic acceptable, defer to v1.2.

## Feature Implementation Complexity

| Feature | Lines of Code Estimate | Files Affected | Risk Level |
|---------|----------------------|----------------|------------|
| npm distribution | ~50 LOC | package.json, bin/vibripped.js, README.md | LOW |
| Interactive setup wizard | ~150 LOC | lib/setup.js, lib/config.js | MEDIUM |
| Category-aware rotation | ~200 LOC | lib/rotation.js, lib/state.js, data/exercises.json | MEDIUM |
| Timed exercise support | ~100 LOC | lib/rotation.js, lib/display.js, data/exercises.json | LOW |
| Environment profiles | ~250 LOC | lib/config.js, lib/profiles.js, lib/rotation.js | MEDIUM |
| Migration from v1.0 | ~100 LOC | lib/migration.js, lib/config.js | LOW |
| README documentation | ~300 lines | README.md, CHANGELOG.md | LOW |

**Total v1.1 estimate:** ~1,150 LOC + documentation. Manageable scope for single milestone.

**Risk areas:**
- **Category rotation logic:** Edge cases (pool too small, all exercises same category). Mitigation: fall back to sequential if category skip exhausts pool.
- **Profile filtering:** Empty pool after filtering (public profile + limited equipment). Mitigation: validate profile has >5 exercises, warn user.
- **Migration complexity:** v1.0 state format changes. Mitigation: detect v1.0 schema, migrate or reset gracefully, preserve user pool additions.

## Sources

### Interactive Terminal Wizards
- [How to Create a CLI Tool with Node.js](https://oneuptime.com/blog/post/2026-01-22-nodejs-create-cli-tool/view)
- [What are the best libraries for using Node.js with a command-line interface? | Reintech media](https://reintech.io/blog/best-libraries-for-using-node-js-with-a-command-line-interface)
- [How To Develop An Interactive Command Line Application Using Node.js — Smashing Magazine](https://www.smashingmagazine.com/2017/03/interactive-command-line-application-node-js/)
- [Introducing prompt-library CLI: Making AI Assistants More Accessible](https://www.shawnewallace.com/2026-01-12-introducing-prompt-library-cli/)
- [17 Best Onboarding Flow Examples for New Users (2026)](https://whatfix.com/blog/user-onboarding-examples/)

### Exercise Category Rotation
- [The 2026 digital fitness ecosystem report | Feed.fm](https://www.feed.fm/2026-digital-fitness-ecosystem-report)
- [The Push/Pull/Legs Routine for Muscle Gains | Aston University](https://www.aston.ac.uk/sport/news/tips/fitness-exercise/push-pull-legs)
- [Push / Pull / Legs - 3, 4, 5 & 6-Day Splits (+13 Exercises to Do)](https://www.hevyapp.com/push-pull-legs-ultimate-guide/)
- [Best Fitness Apps in 2026 – Top Picks by Category | Gymscore](https://www.gymscore.ai/best-fitness-apps-2026)
- [Mastering Muscle Group Rotation: How to Build an Effective Rotating Workout Schedule](https://gym-mikolo.com/blogs/home-gym/mastering-muscle-group-rotation-how-to-build-an-effective-rotating-workout-schedule)

### Timed vs Rep-Based Exercises
- [Timed-based Workout VS. Rep-based Workouts: Which workout should you do?](https://sworkit.com/fitness-goals/rep-vs-timed-sets)
- [Timed Sets VS Rep Based Sets: Which Works Better For Growth](https://theathleticbuild.com/timed-sets-vs-rep-based-sets/)
- [The Benefits of Utilizing a Timed Interval Training Program](https://www.nestacertified.com/the-benefits-of-utilizing-a-timed-interval-training-program/)
- [10 Best Workout Tracker Apps in 2026: Complete Comparison Guide | Jefit](https://www.jefit.com/wp/general-fitness/10-best-workout-tracker-apps-in-2026-complete-comparison-guide/)

### Environment Profiles & Configuration
- [Configuration profiles for the Databricks CLI | Databricks on AWS](https://docs.databricks.com/aws/en/dev-tools/cli/profiles)
- [Configuring environment variables for the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html)
- [CLI Configuration | atmos](https://atmos.tools/cli/configuration/)
- [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir/latest/)
- [Breaking Change: macOS Now Uses ~/.config for XDG Paths | atmos](https://atmos.tools/changelog/macos-xdg-cli-conventions)

### npm Distribution
- [Best Practices for Creating a Modern npm Package with Security in Mind | Snyk](https://snyk.io/blog/best-practices-create-modern-npm-package/)
- [Things you need to do for npm trusted publishing to work](https://philna.sh/blog/2026/01/28/trusted-publishing-npm/)
- [Best practices for publishing your npm package](https://mikbry.com/blog/javascript/npm/best-practices-npm-package)
- [Installing and running Node.js bin scripts](https://2ality.com/2022/08/installing-nodejs-bin-scripts.html)
- [What "Bin" does in package.json?. Have a binary to execute in your node… | by Saravanan M | Nerd For Tech | Medium](https://medium.com/nerd-for-tech/what-bin-does-in-package-json-931d691b1e33)

### Workout Detection Patterns
- [Motra - Automatic Exercise Tracking](https://trainfitness.ai/)
- [RingConn App V3.11.0 is Here: Introducing Automatic Workout Detection!](https://ringconn.com/blogs/news/automatic-workout-detection-smart-ring)
- [How to Enable and Disable Automatic Workout Detection in watchOS 5 - MacRumors](https://www.macrumors.com/how-to/use-automatic-workout-detection-watchos-5/)
- [Use automatic workout detection on your Samsung smart watch](https://www.samsung.com/us/support/answer/ANS10003306/)

### Fitness Timer Patterns
- [5 Best Countdown Timer Apps for Interval Training and Workouts](https://www.makeuseof.com/best-countdown-timer-apps-interval-training-workouts/)
- [Rest Timer – Fitbod's Help Center](https://fitbod.zendesk.com/hc/en-us/articles/360006340194-Rest-Timer)
- [Learn How to Use the Automatic Workout Rest Timer - Hevy App](https://www.hevyapp.com/features/workout-rest-timer/)

### Inquirer.js Interactive Prompts
- [GitHub - SBoudrias/Inquirer.js: A collection of common interactive command line user interfaces.](https://github.com/SBoudrias/Inquirer.js)
- [How To Create Interactive Command-line Prompts with Inquirer.js | DigitalOcean](https://www.digitalocean.com/community/tutorials/nodejs-interactive-command-line-prompts)
- [Inquirer.js/packages/checkbox at main · SBoudrias/Inquirer.js](https://github.com/SBoudrias/Inquirer.js/tree/main/packages/checkbox)

---
*Feature research for: VibeRipped v1.1 — npm distribution, interactive setup, category rotation, timed exercises, environment profiles*
*Researched: 2026-02-09*
*Confidence: HIGH (verified across official docs + multiple WebSearch sources)*
