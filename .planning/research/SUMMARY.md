# Project Research Summary

**Project:** VibeRipped
**Domain:** Claude Code statusline provider / latency-coupled micro-exercise rotation system
**Researched:** 2026-02-08
**Confidence:** MEDIUM-HIGH

## Executive Summary

VibeRipped is a Claude Code statusline provider that converts API latency into movement prompts. This is a fundamentally novel primitive: instead of arbitrary timers (Pomodoro) or generic reminders, it couples exercise prompts to actual workflow wait times. Research validates the core insight that developers experience 3-30+ second latencies during Claude API calls—long enough for micro-exercises (5-20 reps) but too short to context-switch. The statusline is the perfect interface: passive display during latency, automatic disappearance when processing completes, zero interruption to flow state.

The recommended implementation is Bash + jq for the statusline script (Claude Code's de facto standard), with file-based state persistence for rotation tracking and JSON configuration for equipment. Research across 15+ community statuslines, official documentation, and domain studies (exercise reminders, developer productivity, habit formation) converges on a clear pattern: boring systems get used. This means zero gamification, zero guilt mechanics, command-style prompts only ("Pushups x15" not coaching language), and aggressive cooldown (15-30 minutes minimum) to prevent notification fatigue.

Critical risks center on three areas: (1) statusline race conditions with existing GSD provider requiring orchestrator coordination, (2) process detection heuristics since Claude Code doesn't expose "is processing" flag, and (3) over-triggering leading to user disablement. All three are addressable in Phase 1 with atomic operations, stdin JSON delta tracking, and persistent cooldown enforcement. The architecture is deliberately simple: single entry point, 6 modular components, ~100 lines of core logic.

## Key Findings

### Recommended Stack

**Core Runtime:** Bash 4.0+ with jq 1.6+ for JSON parsing. This is the official Claude Code statusline standard—60%+ community adoption, zero installation overhead beyond jq (universally available via package managers), and fastest startup time (<5ms vs. 20-50ms for Python, 50-200ms for Node.js). All official documentation examples use Bash.

**Core technologies:**
- **Bash 4.0+**: Script runtime — Native statusline language, officially documented, zero dependencies, maximum compatibility
- **jq 1.6+**: JSON parsing — Standard tool for Claude Code's stdin JSON, fast, lightweight, ubiquitous
- **Filesystem (flat files)**: State persistence — Universal pattern across community implementations; `~/.claude/cache/vibripped-state.json` stores rotation index + cooldown timestamp (~50 bytes)
- **JSON (settings.json)**: Configuration — Claude Code's canonical config mechanism; equipment declarations live in `~/.claude/settings.json` under custom key

**Critical constraint:** Claude Code statusline API does NOT expose "is processing" flag. Workarounds require heuristic detection via `context_window.current_usage` changes or `cost.total_api_duration_ms` deltas. This is a LOW confidence area requiring empirical validation.

### Expected Features

**Must have (table stakes):**
- **Deterministic exercise rotation** — Sequential rotation prevents repetition, ensures variety without decision-making
- **Equipment configuration** — Users have different gear (kettlebell, dumbbells, pull-up bar, parallettes, bodyweight only)
- **Cooldown prevention** — Minimum 15-30 minute interval between prompts; prevents spam during rapid API calls
- **Crisp command-style output** — "10 push-ups" not "Great job! Let's do 10 amazing push-ups!" (cognitive friction research validates this)
- **Latency-triggered display** — Core differentiator: exercises only during Claude API calls, not arbitrary timers
- **Statusline integration** — Must coexist with GSD provider without crosstalk/flicker
- **Silent operation** — Passive display only, zero notifications/sounds outside statusline

**Should have (competitive differentiators):**
- **Rotation state persistence** — Resume rotation across sessions without repeating recent exercises (prevents "always push-ups on restart")
- **Exercise pool transparency** — Users can inspect/modify exercise list (text file or JSON)
- **Duration-aware prompts** — Longer latency = longer exercise (30s+ wait gets "20 squats" vs. quick call gets "5 push-ups")
- **Rep count calibration** — Adjust difficulty to fitness level (global multiplier: beginner 0.5x, advanced 2x)

**Defer (v2+):**
- **Multi-equipment profiles** — Switch contexts ("home office" vs. "coworking") adds config complexity; validate demand first
- **Exercise history/analytics** — Scope creep into fitness tracker; VibeRipped is a prompt primitive, not a logger

### Architecture Approach

**Single entry point pattern:** Claude Code executes ONE statusline script per update (not a composite surface). Multi-provider displays require orchestrator script that calls GSD + VibeRipped modules and concatenates outputs. File-based state survives process restarts (statusline script is ephemeral). Modular separation enables isolated testing and future extensibility.

**Major components:**
1. **Statusline Entry Point** — Read stdin JSON, coordinate all logic, print output (single executable script)
2. **Process Detector** — Heuristic to determine if Claude is actively processing (check `context_window.current_usage` non-null + delta thresholds)
3. **State Manager** — Load/save rotation index + cooldown timestamp (atomic write-rename pattern prevents corruption)
4. **Config Loader** — Read equipment declarations from `~/.claude/settings.json`
5. **Exercise Pool Assembler** — Build bounded array from bodyweight + equipment-conditional exercises (dynamic based on user config)
6. **Rotation Engine** — Sequential iteration with modulo wrapping `(index + 1) % pool.length`, cooldown enforcement via timestamp comparison
7. **Output Formatter** — Crisp command string with optional ANSI colors

**Data flow:** Stdin JSON → Activity detection → Load state → Load config → Assemble pool → Check cooldown → Rotate → Save state → Format output → Stdout → Display → Process exits.

**Critical pattern:** Atomic write-rename for state file (write to `.tmp`, then `mv` to `.json`) prevents corruption on crash. Exercise pool is static JSON files (baked into script), NOT fetched from remote API (avoids latency).

### Critical Pitfalls

1. **Statusline race condition / Last Write Wins crosstalk** — Multiple providers overwrite each other's outputs causing flicker and data loss. PREVENTION: Instance-specific session markers, atomic operations, coordinate with GSD via shared orchestrator script. Test with two Claude Code sessions simultaneously.

2. **Over-triggering leading to user disablement** — Prompts every 30-60 seconds during active work create notification fatigue (research shows 43% lower opt-out with user control, but 2-3/week limit needed). PREVENTION: Aggressive cooldown (15-30 minutes minimum), track last prompt timestamp across restarts, priority-based delivery (only trigger on API calls >X seconds), user-configurable tolerance.

3. **State file corruption on concurrent access** — Half-writes when process crashes after truncation but before finishing JSON write. PREVENTION: Atomic write-rename pattern, forensic-safe recovery (return default state without overwriting corrupt file), version state format for migration, regular backups (`.bak` on successful writes).

4. **Process detection false positives/negatives** — Triggers on non-AI events (file saves, git operations) or misses actual AI calls. PREVENTION: Hook into `cost.total_api_duration_ms` delta tracking, ignore updates where `context_window.current_usage` is null, configurable/adaptive threshold.

5. **Cognitive friction from verbose/clever prompts** — Motivational language adds parsing overhead making users hesitate or skip. PREVENTION: Command-style output ("Pushups x15"), no emojis/exclamation points, configuration happens once (prompts assume user knows exercises), test: can user execute without re-reading?

6. **Intensity creep making users resist commands** — Pool contains exercises appropriate for gym but not work environment (diamond pushups, burpees at standing desk). PREVENTION: Configuration wizard asks "during work hours?", equipment tags for filtering, `/viberipped skip` escape hatch, pool design guidance ("if you wouldn't do this in front of coworker, don't add it").

7. **Loss of determinism eroding trust** — Same exercise appears twice in a row, rotation doesn't loop cleanly. PREVENTION: State includes `pool_hash` to detect pool changes, increment index AFTER successful prompt (not before), `last_exercise` sanity check, determinism test in test suite.

8. **Embarrassment/impracticality in public settings** — Suggests burpees during video call, floor exercises in open office. PREVENTION: Pool tagging (`public-safe: true/false`), default pool conservative (desk-friendly only), avoid floor/noise/sweat exercises, prioritize standing stretches/isometrics.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Core Rotation (No Claude Integration)
**Rationale:** Validate rotation logic independently before statusline complexity. Exercise pool + state management + rotation engine are orthogonal to Claude Code integration. Build testable CLI tool first.

**Delivers:** Standalone CLI that emits exercises on demand: `node vibripped-cli.js` → "Squats x15"

**Addresses:**
- Deterministic rotation (table stakes)
- Equipment configuration (table stakes)
- Cooldown prevention (critical pitfall #2)
- Exercise pool transparency (should-have)

**Avoids:**
- State file corruption (critical pitfall #3) via atomic write-rename
- Loss of determinism (critical pitfall #7) via modulo wrapping and pool hash tracking
- Intensity creep (critical pitfall #6) via equipment tags and pool validation

**Components built:**
- Exercise pool data files (JSON format)
- State manager (load/save with atomic writes)
- Rotation engine (sequential iteration + cooldown)
- Config loader (equipment flags)
- Pool assembler (bodyweight + equipment matches)

**Verification:** Unit tests for rotation determinism, cooldown enforcement, pool size changes, state corruption recovery.

### Phase 2: Statusline Integration
**Rationale:** Now that rotation works standalone, integrate into Claude Code's statusline API. This phase addresses the statusline-specific pitfalls (race conditions, process detection, output formatting).

**Delivers:** Functional statusline script installable as `statusLine.command` in `~/.claude/settings.json`

**Addresses:**
- Latency-triggered display (table stakes, core differentiator)
- Statusline integration (table stakes)
- Silent operation (table stakes)
- Crisp command-style output (critical pitfall #5)

**Avoids:**
- Process detection false positives (critical pitfall #4) via stdin JSON delta tracking
- Cognitive friction (critical pitfall #5) via command-style formatter
- Embarrassment (critical pitfall #8) via default desk-friendly pool

**Components built:**
- Process detector (heuristic for active state)
- Statusline entry point (stdin JSON → stdout)
- Formatter (ANSI colors, command-style)

**Verification:** Test with rapid successive API calls (verify cooldown), test with non-AI commands (verify no false triggers), test prompt length fits 80-char terminal.

**Research flag:** Process detection heuristic LOW confidence—requires empirical validation with real Claude Code sessions to tune threshold.

### Phase 3: GSD Coexistence
**Rationale:** VibeRipped must display alongside existing GSD statusline without crosstalk. This requires orchestrator pattern since Claude Code only runs ONE statusline script.

**Delivers:** Unified statusline showing both GSD output (task, directory) and VibeRipped output (exercise prompt) separated by `│` delimiter.

**Addresses:**
- Statusline integration (coexistence requirement)

**Avoids:**
- Statusline race condition (critical pitfall #1) via orchestrator coordination

**Components built:**
- Modularize GSD statusline (extract logic to module)
- Modularize VibeRipped statusline (export `generate(data)` function)
- Orchestrator script (call both, concatenate outputs)
- Update settings.json to use orchestrator

**Verification:** Run two Claude Code instances simultaneously, verify no crosstalk/flicker.

### Phase 4: Configuration & Polish
**Rationale:** Production-ready installation experience. Users need tooling to set up equipment, validate pool, handle errors gracefully.

**Delivers:** CLI commands for setup and management: `vibripped config --kettlebell --dumbbells`, `vibripped pool add "Squats x20"`, `vibripped status`

**Addresses:**
- Rotation state persistence (should-have)
- Rep count calibration (should-have)

**Components built:**
- CLI for equipment setup
- Pool editing commands
- Validation (missing equipment declarations prompt setup)
- Error handling (missing state file, corrupt JSON)
- Dry-run mode for testing without state changes

**Verification:** Delete state file mid-session (verify recovery), provide invalid JSON config (verify error message), run `--dry-run` (verify no state changes).

### Phase Ordering Rationale

- **Phase 1 before Phase 2:** Rotation logic must work standalone before adding statusline complexity. Testing is easier with CLI tool.
- **Phase 2 before Phase 3:** VibeRipped statusline must work solo before attempting GSD integration.
- **Phase 3 before Phase 4:** Coexistence is blocking for adoption (users already have GSD), but polish can ship incrementally.
- **Phase 4 can run parallel to Phase 3:** Config tooling is independent of GSD integration.

**Grouping logic:** Phase 1 = "core logic," Phase 2 = "Claude integration," Phase 3 = "ecosystem integration," Phase 4 = "user experience."

**Pitfall avoidance:** Critical pitfalls addressed in Phases 1-2 (state corruption, over-triggering, process detection). Moderate pitfalls in Phase 4 (configuration UX). This front-loads risk mitigation.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 2 (Statusline Integration):** Process detection heuristic LOW confidence—stdin JSON schema doesn't expose "is processing" flag. Need to experiment with `context_window.current_usage` deltas and `cost.total_api_duration_ms` thresholds to find reliable trigger pattern. Allocate time for empirical testing with real Claude sessions.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Core Rotation):** Well-documented patterns for file-based state, sequential rotation, JSON config. No novel ground.
- **Phase 3 (GSD Coexistence):** Orchestrator pattern is standard (verified via existing GSD statusline code). Straightforward module extraction + concatenation.
- **Phase 4 (Configuration & Polish):** CLI tooling patterns well-established (arg parsing, validation, error messages).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Bash + jq verified via official Claude Code docs and 60%+ community adoption. File-based state is universal pattern. |
| Features | MEDIUM-HIGH | Feature prioritization based on exercise reminder research, developer productivity studies, and habit formation literature. MVP scope validated against competitor analysis. |
| Architecture | HIGH | Single entry point pattern verified via official docs and direct examination of existing GSD statusline. Component boundaries follow standard modularity practices. |
| Pitfalls | MEDIUM-HIGH | Critical pitfalls validated via official issue tracker (race condition), notification fatigue research, and community statusline postmortems. Process detection is LOW confidence area. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

**Process detection heuristic (LOW confidence):** Claude Code's stdin JSON schema doesn't include explicit "is processing" flag. Heuristic options exist (`context_window.current_usage` non-null, `cost.total_api_duration_ms` delta), but optimal threshold is unknown. **Mitigation:** Allocate Phase 2 time for empirical testing; start with simple strategy (usage non-null), tune based on user feedback; consider making threshold configurable as escape hatch.

**Multi-instance state conflicts (MEDIUM confidence):** File-based state may race if user runs multiple Claude Code sessions simultaneously. Research suggests atomic write-rename mitigates, but concurrent read-modify-write remains edge case. **Mitigation:** Implement optimistic locking (timestamp check before write) or accept race as low-probability (statusline updates debounced 300ms, unlikely to overlap). Document limitation if unresolved.

**Duration-aware prompts (DEFERRED):** Feature requires latency duration measurement, but stdin JSON doesn't expose call duration directly (only cumulative `total_api_duration_ms`). Tracking deltas is feasible but adds complexity. **Mitigation:** Defer to v1.x; validate core concept first (static prompts), add duration-awareness once proven useful.

**Exercise pool size validation (MINOR):** What's the minimum pool size for determinism to feel good? 5 exercises? 10? 20? Research doesn't answer this—depends on rotation frequency and user tolerance for repetition. **Mitigation:** Default pool starts at 10 exercises, documentation suggests 8-15 range, users can customize via transparent JSON files.

## Sources

### Primary (HIGH confidence)
- [Claude Code Statusline Documentation](https://code.claude.com/docs/en/statusline) — Official specification: stdin JSON schema, execution model, update triggers, output formatting, debouncing (300ms), cancellation policy
- [Claude Code Settings Documentation](https://code.claude.com/docs/en/settings) — Configuration hierarchy, settings.json structure, file locations, scoping rules
- Direct examination of `~/.claude/hooks/gsd-statusline.js` — Real-world statusline implementation pattern, entry point structure, stdin handling
- [GitHub Issue #15226: Status Bar Crosstalk](https://github.com/anthropics/claude-code/issues/15226) — Official confirmation of Last Write Wins race condition between providers

### Secondary (MEDIUM confidence)
- [ccstatusline](https://github.com/sirmalloc/ccstatusline) — TypeScript + React/Ink reference implementation, XDG config pattern, 100+ dependencies (validates "complex statusline" stack)
- [rz1989s/claude-code-statusline](https://github.com/rz1989s/claude-code-statusline) — Bash implementation, 18-component modular architecture, SHA-256 caching pattern
- [How to Reduce Notification Fatigue](https://www.courier.com/blog/how-to-reduce-notification-fatigue-7-proven-product-strategies-for-saas) — SaaS research: 43% lower opt-out with user controls, 2-3/week threshold for non-opted-in notifications
- [Understanding Gamification Fatigue](https://www.sciencedirect.com/science/article/abs/pii/S1567422324000140) — Academic research: badge complexity → burnout → app abandonment
- [Motivational Message Framing Effects](https://pmc.ncbi.nlm.nih.gov/articles/PMC10163402/) — Fitness messaging research: motivational language generates short-term interest but fails sustained action; command-style prompts reduce cognitive load
- [Why Exercise at Work: OEBD Scale](https://pmc.ncbi.nlm.nih.gov/articles/PMC7967457/) — Academic research: intrinsic motivation + social environment factors; peer observation anxiety; gradual progress emphasis

### Tertiary (LOW confidence)
- [Build Times and Developer Productivity](https://www.linkedin.com/pulse/build-times-developer-productivity-abi-noda) — Anecdotal: developers context-switch around 45-second threshold (supports latency-coupling hypothesis but not rigorously validated)
- [Claude Chill: Fix Flickering](https://news.ycombinator.com/item?id=46699072) — HN discussion: DEC mode 2026 synchronized output eliminates flicker (future mitigation for race condition)

---
*Research completed: 2026-02-08*
*Ready for roadmap: yes*
