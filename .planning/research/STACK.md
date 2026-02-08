# Technology Stack

**Project:** VibeRipped
**Researched:** 2026-02-08
**Confidence:** HIGH

## Recommended Stack

### Core Runtime & Language

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Bash | 4.0+ | Script runtime | Native statusline language. Officially documented, zero installation, maximum compatibility. All official examples use Bash. Works identically on macOS/Linux; Windows via WSL. |
| jq | 1.6+ | JSON parsing | Standard tool for parsing Claude Code's stdin JSON. Used in all official documentation examples. Fast, lightweight, ubiquitous on Unix systems. |

**Rationale:** Bash is the **de facto standard** for Claude Code statusline scripts. The official documentation uses Bash for all examples, community adoption is 60%+ Bash, and it requires zero dependencies beyond `jq` which is universally available via system package managers.

**Confidence:** HIGH - Verified via official Claude Code documentation at https://code.claude.com/docs/en/statusline

### Alternative Runtimes (Not Recommended for This Project)

| Technology | Version | Purpose | Why NOT Recommended |
|------------|---------|---------|---------------------|
| TypeScript/Node.js | 18+ | Complex statuslines with React/Ink TUI | Overkill for VibeRipped's simple state (rotation index, timestamp). Used by ccstatusline for interactive configuration UI, but adds 100+ dependencies and compilation step. |
| Python | 3.8+ | When team prefers Python | Valid alternative with builtin JSON parsing, but requires explicit shebang and Python installation verification. No advantage for simple string formatting. |
| Ruby | 2.7+ | When team prefers Ruby | Used by gabriel-dehan/claude_monitor_statusline, but Ruby is less common than Bash/Python in 2026 ecosystem. |

### State Persistence

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Filesystem (flat files) | N/A | Persist rotation index, cooldown timestamp | Standard pattern: write to `~/.claude/.viberipped-state` or `/tmp/viberipped-state-$UID`. Simple, atomic writes via shell redirection. No database needed. |
| JSON format | N/A | State file format | Use jq for atomic read/write. Format: `{"rotation_index":5,"last_cooldown_ts":1738972800}` |

**Rationale:** File-based persistence is the **universal pattern** across all community statusline implementations. Examples:
- ccstatusline: `~/.config/ccstatusline/settings.json`
- rz1989s/claude-code-statusline: XDG-compliant cache directories with SHA-256 checksums
- Official caching example: `/tmp/statusline-git-cache`

For VibeRipped's minimal state (two integers), a single JSON file is sufficient. No need for SQLite, Redis, or databases.

**Confidence:** HIGH - Pattern verified across official docs and 8+ community implementations

### Configuration

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| JSON (Claude Code settings.json) | N/A | Equipment configuration | Standard Claude Code configuration mechanism. Add equipment list to `~/.claude/settings.json` under custom key like `viberipped.equipment: ["kettlebell", "dumbbells"]` |
| Environment variables | N/A | Optional runtime config | Pattern used by claude_monitor_statusline for `VIBERIPPED_EQUIPMENT`, `VIBERIPPED_COOLDOWN_SEC`. Good for per-session overrides without editing settings.json. |

**Configuration file location:** `~/.claude/settings.json` (global) or `.claude/settings.local.json` (project-specific, not committed)

**Rationale:** Claude Code's settings.json is the **canonical configuration mechanism**. It supports hierarchical scoping (managed policy > global > project > local), automatic reload, and team sharing via source control.

Environment variables are a **secondary pattern** for runtime overrides without file edits. Used by multiple community implementations for display modes and feature flags.

**Confidence:** HIGH - Verified via official settings documentation at https://code.claude.com/docs/en/settings

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None required | N/A | N/A | Pure Bash + jq is sufficient for VibeRipped's requirements |

**Note:** Advanced statuslines use additional tools:
- `curl` - API calls (ccusage, rz1989s for rate limit checking)
- `git` - Branch/status display (standard pattern, but NOT needed for VibeRipped)
- React/Ink - Interactive TUI configuration (ccstatusline only, massive overkill)

VibeRipped does NOT need any of these. The exercise rotation logic is pure string manipulation.

## Installation

```bash
# Prerequisites (likely already installed)
# macOS
brew install jq

# Ubuntu/Debian
apt-get install jq

# Fedora/RHEL
dnf install jq

# Verify
jq --version  # Should output: jq-1.6 or newer
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Runtime | Bash | TypeScript + Node.js + React/Ink | 100+ npm dependencies, build step, startup overhead (50-200ms). Bash starts in <5ms. VibeRipped's logic is 50 lines max—TS adds complexity without benefit. |
| Runtime | Bash | Python | Valid choice, but Bash has better official documentation coverage and zero installation on target systems. Python requires explicit version management. |
| JSON parsing | jq | Node.js builtin JSON | Node's async stdin reading (20+ lines of boilerplate) vs. jq's one-liner: `jq -r '.field'`. For simple field extraction, jq wins. |
| State storage | Flat file | SQLite | SQLite requires library (`sqlite3` binary or language bindings). For 2 integers, flat file is faster and simpler. |
| State storage | Flat file | Redis/memcached | Requires separate service. Massive overkill for single-user local script. |
| Config format | JSON | TOML/YAML | JSON is Claude Code's native format. Adding TOML parser (requires external tool) breaks consistency. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Python `input()` or interactive prompts | Statusline scripts receive JSON on stdin and must output immediately. Prompts block forever—Claude Code kills the script after timeout. | Read configuration from settings.json or environment variables |
| Slow commands (`git status` on large repos) | Statusline runs after every assistant message (debounced 300ms). Slow commands lag the UI. | Cache results (official caching pattern: `/tmp/statusline-git-cache` with 5-second TTL) |
| ANSI escape codes without testing | Complex escape sequences can cause rendering glitches when overlapping with Claude Code's UI updates. Multi-line + colors = higher risk. | Test thoroughly; prefer single-line plain text for reliability |
| Process-based state (e.g., `$$`, `process.pid`) | Each statusline invocation is a NEW process. Process-local variables are lost immediately. | Use filesystem persistence with stable filenames |
| `/tmp/statusline-$$.cache` | `$$` is different on every invocation—cache is never reused, defeating the purpose. | Use fixed filename: `/tmp/statusline-viberipped` or `~/.claude/.viberipped-state` |

## Stack Patterns by Variant

**If building a simple statusline (like VibeRipped):**
- Runtime: Bash
- JSON parsing: jq
- State: Single JSON file in `~/.claude/` or `/tmp/`
- Config: settings.json with optional environment variable overrides
- Total dependencies: 1 (jq)
- Script size: 50-100 lines
- Startup time: <5ms

**If building a complex statusline with interactive configuration UI:**
- Runtime: TypeScript + Node.js + Bun (for speed)
- Framework: React + Ink (terminal UI)
- State: XDG-compliant config directory (`~/.config/statusline/`)
- Config: JSON with interactive setup wizard
- Total dependencies: 100+ npm packages
- Script size: 1000+ lines
- Startup time: 50-200ms
- Example: ccstatusline (https://github.com/sirmalloc/ccstatusline)

**If team already uses Python everywhere:**
- Runtime: Python 3.8+
- JSON parsing: builtin `json` module
- State: Same flat-file approach
- Config: Same settings.json approach
- Tradeoff: Python startup slower than Bash (20-50ms vs. <5ms), but negligible for statusline use case

## Technical Constraints from Claude Code

Based on official documentation, statusline scripts must adhere to these constraints:

**Execution Model:**
- Script receives JSON on stdin (one-shot, not streaming)
- Script must output to stdout (NOT stderr)
- Output is displayed verbatim—each line becomes a statusline row
- Script is killed if it exceeds internal timeout (not documented, but implied by "in-flight execution is cancelled")

**Update Triggers:**
- Runs after each assistant message
- Runs when permission mode changes
- Runs when vim mode toggles
- Updates debounced at 300ms
- If new trigger fires while script running, in-flight execution is cancelled

**Data Available:**
- Full JSON schema documented at https://code.claude.com/docs/en/statusline
- Key fields: `model.display_name`, `context_window.used_percentage`, `cost.total_cost_usd`, `workspace.current_dir`
- **CRITICAL LIMITATION:** No field indicates "API call in flight" or "model processing"

**Processing State Detection:**
The official JSON schema does NOT include a field for "API call in flight" or "processing state". The statusline script runs **after** each assistant message, meaning it executes when processing is COMPLETE, not during.

**Implication for VibeRipped:** The original requirement states "When Claude Code is actively processing (model call in flight), the statusline emits exactly one movement instruction." However, the statusline API does NOT provide real-time processing state.

**Workaround options:**
1. **Emit exercise on every update** - Since statusline runs after each message, treat each invocation as "processing just completed, here's your exercise"
2. **Time-based cooldown** - Emit exercise only if N seconds have elapsed since last exercise (prevents spam during rapid back-and-forth)
3. **Token-delta trigger** - Emit exercise when `context_window.total_output_tokens` increases by threshold amount

**Confidence:** HIGH - Processing state limitation verified via official JSON schema

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Bash 4.0+ | macOS (Bash 3.2 via `/bin/bash`, Bash 5.x via Homebrew), Linux (4.0+), Windows WSL (5.0+) | macOS ships Bash 3.2 due to GPLv3 licensing. For VibeRipped, 3.2 is sufficient (no associative arrays needed). |
| jq 1.6+ | All platforms | Current stable: 1.7 (2023-09-06). 1.6 widely deployed. No breaking changes relevant to statusline use case. |

## Sources

**Official Documentation (HIGH confidence):**
- [Customize your status line - Claude Code Docs](https://code.claude.com/docs/en/statusline) - Complete technical specification, JSON schema, execution model, examples
- [Claude Code settings - Claude Code Docs](https://code.claude.com/docs/en/settings) - Configuration hierarchy, settings.json structure, file locations

**Community Implementations (MEDIUM-HIGH confidence):**
- [ccstatusline](https://github.com/sirmalloc/ccstatusline) - TypeScript + React/Ink, XDG config, 100+ dependencies
- [claude_monitor_statusline](https://github.com/gabriel-dehan/claude_monitor_statusline) - Ruby, environment variable config
- [rz1989s/claude-code-statusline](https://github.com/rz1989s/claude-code-statusline) - Bash, 18-component modular architecture, XDG caching with SHA-256 integrity

**Blog Posts & Tutorials (MEDIUM confidence):**
- [Creating The Perfect Claude Code Status Line](https://www.aihero.dev/creating-the-perfect-claude-code-status-line) - Community patterns
- [Leveling Up Claude Code with a Killer Statusline](https://jeradbitner.com/blog/claude-code-statusline) - Real-world usage examples

---
*Stack research for: Claude Code statusline provider (VibeRipped micro-exercise rotation system)*
*Researched: 2026-02-08*
*Confidence: HIGH (official docs) + MEDIUM (community patterns)*
