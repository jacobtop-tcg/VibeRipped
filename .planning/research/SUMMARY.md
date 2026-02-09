# Project Research Summary

**Project:** VibeRipped v1.1
**Domain:** CLI Exercise Rotation App - Feature Additions
**Researched:** 2026-02-09
**Confidence:** HIGH

## Executive Summary

VibeRipped v1.1 builds on a zero-dependency v1.0 foundation to add distribution, interactive UX, and intelligent exercise rotation. The research reveals a clear path: this is a Node.js CLI tool following 2026 best practices for npm packaging, interactive prompts, and config management. The recommended approach prioritizes pragmatic dependency additions (prompts for UX, Node.js 20.6.0+ for native .env support) while maintaining the core zero-dependency philosophy for business logic.

The key insight from research is that modern CLI tools balance minimal dependencies with professional UX. Adding `prompts` (187 kB, 2 dependencies) for interactive setup is justified—implementing checkbox/multiselect from scratch requires 200-300 LOC of terminal manipulation. The category-aware rotation feature requires careful algorithm design to avoid bias (weighted selection by pool size, not naive round-robin). Environment profiles enable context-aware filtering (home office vs coworking space).

Critical risks center on backward compatibility and integration points. v1.0 users must migrate smoothly (config schema extension with auto-detection), interactive prompts must not break statusline stdin pipe (check `process.stdin.isTTY`), and npm bin scripts need correct permissions/shebang. Detection improvement is highest risk (depends on undocumented Claude Code statusline JSON structure). Mitigation: comprehensive migration logic, explicit TTY checks, prepublish validation, and live testing for detection.

## Key Findings

### Recommended Stack

v1.1 maintains v1.0's zero-dependency core (Node.js built-ins, write-file-atomic) while pragmatically adding UX dependencies. Node.js 20.6.0+ becomes minimum version for native --env-file support (eliminates dotenv dependency). Commander.js continues handling CLI parsing. New: `prompts@2.4.2` for interactive terminal prompts (checkbox, multiselect).

**Core technologies:**
- Node.js 20.6.0+ — Native .env file support via --env-file flag, eliminates runtime dependency
- Commander.js ^14.0.3 — CLI argument parsing (already in v1.0), handles subcommands and option parsing
- write-file-atomic ^7.0.0 — Atomic state writes (already in v1.0), maintains transactional updates
- prompts ^2.4.2 — Interactive terminal prompts (NEW), lightweight (187 kB, 2 deps), supports checkbox/multiselect

**What does NOT need dependencies:**
- Timer display: Node.js setInterval + process.stdout.write + ANSI escape codes (already validated in v1.0)
- Environment profiles: Node.js --env-file flag or process.env (native as of v20.6.0)
- Category rotation: Pure algorithm logic extending existing rotation engine
- npm packaging: package.json configuration (native npm feature)

**Critical version requirement:** Node.js 20.6.0+ for --env-file support. Set `"engines": {"node": ">=20.6.0"}` in package.json.

### Expected Features

Research identifies clear MVP boundaries for v1.1 launch vs future versions.

**Must have (table stakes):**
- npm global install — Users expect `npm install -g vibripped` then `vibripped` command works
- Interactive setup wizard — Modern CLIs support `vibripped setup` onboarding with checkbox equipment selection
- Category-aware rotation — Fitness apps avoid consecutive same-muscle-group exercises (push/pull/legs/core)
- Timed exercise support — Duration-based exercises (planks, wall sits) need `type: "timed"` vs `type: "reps"`
- Environment profiles — Different exercises in different contexts (home office vs coworking)
- README documentation — npm packages must document install, setup, basic usage
- Migration from v1.0 — Smooth upgrade for existing users (auto-migrate config and state)

**Should have (differentiators):**
- Zero external dependencies for core features — v1.0 philosophy maintained (prompts is setup-only)
- First-run wizard with smart defaults — Checkbox equipment → suggest exercises → create config
- Public-safe exercise filtering — Recognition that developers work in coworking spaces where floor exercises aren't viable
- Detection accuracy improvement — v1.0 triggers on all statusline updates after first API call, v1.1 should only trigger during actual processing

**Defer to v2.0+:**
- Automatic category detection from names — Brittle NLP, fails on custom names, manual tagging is clear
- Profile auto-switching by WiFi — Requires OS permissions, flaky detection, privacy concerns
- Cloud sync for multi-machine — Adds backend infrastructure, auth, maintenance burden
- Exercise completion logging — Breaks "zero friction" philosophy, scope creep into tracking
- AI-generated exercise suggestions — Non-deterministic, adds API dependency, scope creep

**Anti-features (commonly requested, problematic):**
- Automatic category detection from exercise names — Use manual category tagging instead
- Profile auto-switching by location/WiFi — Use explicit profile switching with `--profile` flag
- Exercise completion confirmation — Trust user autonomy, no logging
- Cloud sync — Local-first is core value, power users can symlink to Dropbox/iCloud
- Social features (sharing, leaderboards) — Misaligned with "boring systems get used"

### Architecture Approach

v1.1 integrates cleanly via new modules in existing directories with minimal modification to core engine. The architecture maintains v1.0's pattern: pure libraries (rotation, difficulty, cooldown) + stateful orchestrators (engine.js, CLI commands). Most features extend data models via optional fields (backward compatible).

**Major components:**

1. **npm Packaging (metadata-only)** — package.json additions (bin, files, engines), README.md, no code changes
2. **Interactive UX (CLI layer)** — New `lib/cli/commands/setup.js` using prompts, existing commands add `--interactive` flag
3. **Category Rotation (core engine)** — Extends pool schema with `category` field, replaces `lib/rotation.js` with weighted selection algorithm
4. **Timed Exercises (display logic)** — Extends pool schema with `type: "reps"|"timed"`, modifies `engine.js` formatPrompt
5. **Environment Profiles (config extension)** — Extends config schema with `environment` field, filters pool by context
6. **Detection Improvement (heuristic replacement)** — Replaces `lib/statusline/detection.js` logic to check `cost.total_api_duration_ms`

**Data model extensions (backward compatible):**
- pool.json: Add optional `category`, `type`, `environments` fields (defaults if missing)
- configuration.json: Add optional `environment` field (defaults to "home")
- state.json: Add optional `recentCategories` array (initializes to empty)

**Integration patterns:**
- Schema extension with defaults — Treat missing fields as defaults, no migration required
- Pure library + stateful orchestrator — Keep modules testable, isolate I/O in engine/CLI
- Fail-safe defaults — Fall back to safe behavior instead of throwing errors

**Critical integration point:** Interactive prompts must check `process.stdin.isTTY` before running. Statusline mode uses stdin pipe, prompts would break it.

### Critical Pitfalls

**1. NPM Bin Permissions Lost After Install**
Bin files lack executable permissions or shebang. Users get "Permission denied" errors. Solution: Add `#!/usr/bin/env node` shebang, `chmod +x bin/vibripped.js`, use `git update-index --chmod=+x`, test with `npm link` before publishing.

**2. Interactive Prompts Break Statusline Stdin Pipe**
Prompts hijack stdin, breaking statusline data flow. Detect pipe vs terminal with `process.stdin.isTTY`. Statusline commands should NEVER use interactive prompts. Add `--interactive` flag for explicit mode switching.

**3. Category Rotation Bias - Bodyweight Exercises Starved**
Naive round-robin gives small equipment categories equal turns (5 kettlebell exercises get 50% of suggestions vs 40 bodyweight exercises). Use weighted category selection proportional to pool size instead of equal turns.

**4. Config Migration Breaks v1.0 Users**
v1.1 config schema changes lose v1.0 settings. Add config version field, detect v1.0 format, auto-migrate to v1.1, backup old file. Test migration with real v1.0 configs before release.

**5. Detection Heuristic Tuning Causes Thrashing**
Hardcoded threshold doesn't match all usage patterns. Make threshold configurable (`config.detection.sensitivity`), add dry-run mode, track telemetry (opt-in), test with recorded statusline data.

**Additional critical pitfalls:**
- Commander.js action handler `this` context lost with async prompts (use parameters, not `this.opts()`)
- Timed exercise state race (persist `lastTriggerTime` before showing prompt, not after)
- npm lifecycle script confusion (use `prepublishOnly` for publish tasks, not `prepare`)
- XDG_CONFIG_HOME not respected on macOS (detect and migrate from `~/.config` to `$XDG_CONFIG_HOME`)

## Implications for Roadmap

Based on research, suggested phase structure follows dependency order and risk profile.

### Phase 1: Foundation & Distribution
**Rationale:** Zero dependencies on other v1.1 features, can ship independently. Establishes distribution channel.
**Delivers:** npm package, global install, README documentation
**Addresses:** Table stakes (npm distribution, documentation)
**Avoids:** Pitfall #1 (bin permissions), Pitfall #8 (lifecycle scripts)
**Research flag:** No research needed (standard npm workflow, well-documented)

### Phase 2: Data Model Extensions
**Rationale:** All features need schema extensions, batch them together to minimize migration complexity.
**Delivers:** Extended pool schema (category, type, environments), extended config schema (environment), extended state schema (recentCategories)
**Addresses:** Groundwork for timed exercises, category rotation, environment profiles
**Avoids:** Pitfall #6 (config migration) via unified migration logic
**Research flag:** No research needed (schema extension with backward compat is standard pattern)

### Phase 3: Timed Exercise Support
**Rationale:** Simplest feature using extended schema, validates data model before complex rotation.
**Delivers:** Type-aware exercise display ("Plank 30s" vs "Pushups x15"), duration-based exercises
**Addresses:** Table stakes (timed exercise support)
**Avoids:** Pitfall #5 (timer state race) via immediate persistence
**Research flag:** No research needed (straightforward display logic)

### Phase 4: Environment Profiles
**Rationale:** Uses extended config schema, independent of rotation changes.
**Delivers:** Context-aware filtering (home/office/coworking/anywhere), profile switching
**Addresses:** Table stakes (environment profiles)
**Avoids:** Pitfall #9 (XDG path migration), Pitfall #10 (option conflicts)
**Research flag:** No research needed (extends existing config pattern)

### Phase 5: Category-Aware Rotation
**Rationale:** Complex algorithm change, depends on pool schema having category field.
**Delivers:** Weighted category selection, muscle group recovery awareness
**Addresses:** Table stakes (category rotation), differentiator (recovery awareness)
**Avoids:** Pitfall #4 (category bias) via weighted selection
**Research flag:** Phase research needed (rotation algorithm complexity, edge cases with small pools)

### Phase 6: Interactive Setup Wizard
**Rationale:** Depends on finalized config/pool schemas, orchestrates existing logic.
**Delivers:** `vibripped setup` command, checkbox equipment selection, smart defaults
**Addresses:** Table stakes (interactive setup)
**Avoids:** Pitfall #2 (stdin pipe), Pitfall #3 (Commander.js context)
**Research flag:** No research needed (prompts library well-documented)

### Phase 7: Detection Improvement
**Rationale:** Highest risk (undocumented stdin structure), can ship independently of other features.
**Delivers:** Improved statusline trigger heuristic, reduced false positives
**Addresses:** Differentiator (detection accuracy)
**Avoids:** Pitfall #7 (heuristic thrashing) via configurable threshold
**Research flag:** Phase research needed (Claude Code statusline JSON structure, live testing required)

### Phase Ordering Rationale

- **Foundation first:** npm distribution blocks nothing, establishes release channel
- **Schema batch:** All data model changes in Phase 2 minimizes migration points
- **Simple to complex:** Timed exercises (simple) validates schema before category rotation (complex)
- **Independent features parallel:** Environment profiles and category rotation can develop in parallel after Phase 2
- **Interactive last:** Setup wizard depends on stable schemas, can ship after other features
- **Detection separate:** Highest risk, doesn't block other features, can iterate independently

**Alternative approach:** Phases 3 and 4 can be swapped (timed exercises vs environment profiles) without dependency issues.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 5 (Category Rotation):** Weighted selection algorithm edge cases, test with extreme pool distributions (1 vs 50 exercises), determinism verification
- **Phase 7 (Detection Improvement):** Claude Code statusline JSON structure investigation, live testing with real sessions, threshold calibration

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Distribution):** Standard npm packaging workflow
- **Phase 2 (Data Models):** Schema extension with backward compatibility is established pattern
- **Phase 3 (Timed Exercises):** Straightforward display logic, type discrimination
- **Phase 4 (Environment Profiles):** Extends existing config pattern
- **Phase 6 (Interactive UX):** prompts library well-documented, checkbox examples abundant

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official Node.js docs verified --env-file support, prompts library verified (4M+ downloads/week), Commander.js existing |
| Features | HIGH | Multiple sources confirm table stakes (npm install, setup wizard, category rotation), anti-features validated against fitness app patterns |
| Architecture | HIGH | Integration patterns match v1.0 established structure, backward compatibility approach verified with migration examples |
| Pitfalls | HIGH | npm bin permissions, stdin pipe conflicts, config migration all verified with official docs and community sources |

**Overall confidence:** HIGH

### Gaps to Address

**Detection heuristic structure (MEDIUM risk):**
- Gap: Claude Code statusline JSON structure is undocumented
- How to handle: Phase 7 research-phase to investigate stdin JSON schema, live testing in real Claude Code session
- Fallback: If no clear signal exists, keep v1.0 heuristic and defer to v1.2

**Category rotation weighting formula (LOW risk):**
- Gap: Optimal weighting balance between "fair" and "proportional"
- How to handle: Phase 5 research-phase to test extreme distributions (1 vs 50 exercises), simulation testing
- Fallback: Start with proportional (category.length / total), add user override in config if needed

**Timed exercise scaling bounds (LOW risk):**
- Gap: How much to scale duration-based exercises (latency factor)
- How to handle: Cap timed exercise multiplier at 1.5x max during Phase 3 implementation
- Fallback: Use same latency scaling as reps, users can override in pool if excessive

**Cross-platform bin permissions (LOW risk):**
- Gap: Windows doesn't preserve executable bit in git
- How to handle: Use `git update-index --chmod=+x`, add CI test for Unix install
- Fallback: Document manual chmod for users who hit issue

## Sources

### Primary (HIGH confidence)

**Official Documentation:**
- [Node.js Readline Documentation](https://nodejs.org/api/readline.html) — Verified promises API, raw mode, keypress events
- [Node.js Timers Documentation](https://nodejs.org/api/timers.html) — Verified setInterval API
- [npm scripts lifecycle documentation](https://docs.npmjs.com/cli/v8/using-npm/scripts/) — Verified prepublishOnly vs prepare behavior
- [npm files field best practices](https://github.com/npm/cli/wiki/Files-&-Ignores) — Verified files field precedence
- [package.json bin field documentation](https://docs.npmjs.com/cli/v8/configuring-npm/package-json/) — Verified bin script configuration
- [Commander.js GitHub](https://github.com/tj/commander.js) — Verified v14.0.3 API
- [prompts GitHub Repository](https://github.com/terkelg/prompts) — Verified v2.4.2 features, dependencies
- [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir/latest/) — Verified XDG_CONFIG_HOME conventions

**Stack Research:**
- Node.js --env-file support (v20.6.0+) eliminates dotenv dependency
- prompts vs @inquirer/prompts comparison (prompts chosen for lightweight)
- Zero-dependency philosophy analysis (pragmatic break for interactive UX justified)

**Features Research:**
- Interactive terminal wizard patterns (Commander + Inquirer standard)
- Category rotation patterns (Push/Pull/Legs split, 48-72hr recovery)
- Timed vs rep-based exercises (isometric holds vs dynamic movements)
- Environment profiles (XDG Base Directory, file-based config patterns)
- npm distribution patterns (trusted publishing, bin scripts, SemVer)

**Architecture Research:**
- npm packaging integration (metadata-only, zero code changes)
- Interactive prompts integration (CLI layer isolation, TTY detection)
- Category rotation integration (weighted selection, state extension)
- Timed exercises integration (type discrimination, display logic)
- Environment profiles integration (config extension, pool filtering)
- Detection improvement integration (heuristic replacement, cost.total_api_duration_ms)

**Pitfalls Research:**
- NPM bin permissions (shebang, chmod +x, git update-index)
- Interactive prompts breaking stdin pipe (process.stdin.isTTY detection)
- Commander.js action handler context (use parameters, not this.opts())
- Category rotation bias (weighted selection by pool size)
- Config migration (version field, auto-detect, backup)
- Detection heuristic thrashing (configurable threshold, dry-run mode)
- npm lifecycle script confusion (prepublishOnly for publish, not prepare)
- XDG path migration (detect old path, auto-migrate, backup)

### Secondary (MEDIUM confidence)

- [Muscle group rotation importance](https://lipsticklifters.com/articles/the-importance-of-muscle-group-rotation/) — Category rotation patterns
- [DigitalOcean interactive CLI tutorial](https://www.digitalocean.com/community/tutorials/nodejs-interactive-command-line-prompts) — Inquirer.js integration
- [Best practices for publishing npm package](https://mikbry.com/blog/javascript/npm/best-practices-npm-package) — npm publishing workflow
- [Databricks CLI profiles](https://docs.databricks.com/aws/en/dev-tools/cli/profiles) — Profile configuration patterns

### Tertiary (LOW confidence)

- Fitness app UX patterns (Fitbod, Hevy, Samsung Health) — Category rotation and timer UX
- Workout detection patterns (Motra, Apple Watch) — Detection heuristic insights
- CLI tool examples (Statsig wizard, Temporal CLI) — Interactive onboarding patterns

---
*Research completed: 2026-02-09*
*Ready for roadmap: yes*
