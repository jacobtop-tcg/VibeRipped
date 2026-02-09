# Phase 4: GSD Coexistence - Research

**Researched:** 2026-02-09
**Domain:** Multi-provider statusline orchestration, shell script composition, stdin forwarding, visual identity patterns
**Confidence:** MEDIUM

## Summary

Phase 4 integrates VibeRipped's statusline provider with GSD (Get-Shit-Done) system outputs using an orchestrator pattern. The core challenge is enabling two independent statusline providers to coexist without crosstalk, with distinguishable visual identities, and reliable output concatenation.

GSD does not currently ship a dedicated statusline provider in its bin/gsd-tools.js utility (as of Feb 2026). However, the GSD ecosystem has an enhanced statusline feature (issue #212) using hook-based architecture that displays project metrics like phase progress, costs, and timing. The hook system is separate from the CLI tools and may operate differently than stdin/stdout statusline providers.

The orchestrator pattern for multi-provider statuslines is straightforward: a wrapper shell script receives Claude Code's JSON on stdin, duplicates it to multiple provider scripts using process substitution or command sequencing, collects their outputs, and concatenates them with visual separators. The key technical requirements are: (1) stdin forwarding without blocking, (2) graceful handling of provider failures (one failing shouldn't break the statusline), (3) clear visual separation between provider outputs, and (4) consistent single-line output format.

Visual identity strategies from community implementations include: Unicode separators (│, ║, •), color-coded sections, prefixes (text labels or emoji), powerline-style directional glyphs, and ANSI background colors. VibeRipped currently uses cyan bold text for exercise prompts. Adding a prefix like "💪 " or "MOVE: " and a separator like " │ " ensures instant recognition when combined with other providers.

**Primary recommendation:** Create a bash wrapper script (e.g., `statusline-orchestrator.sh`) that receives stdin JSON, uses process substitution `<()` to forward stdin to both GSD and VibeRipped providers simultaneously, captures outputs via command substitution, concatenates with a clear separator (e.g., " │ "), handles empty outputs gracefully, and outputs a single line. Add a visual prefix to VibeRipped output to establish stable identity.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Bash | 3.2+ (macOS default) | Orchestrator script language | Universal availability, process substitution support, zero dependencies |
| Process substitution `<()` | Bash built-in | Stdin duplication to multiple commands | Standard pattern for feeding stdin to multiple processes simultaneously |
| Command substitution `$()` | Bash built-in | Capture script outputs | Standard Bash pattern for collecting command output into variables |
| Node.js | Already in use | VibeRipped provider execution | Existing project dependency, proven in Phase 3 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tee` | Coreutils | Stdin duplication to files/pipes | Alternative to process substitution for older shells or debugging |
| Named pipes (FIFO) | Unix built-in | Portable stdin duplication | When process substitution unavailable (POSIX sh) |
| `test` / `[ ]` | Bash built-in | Output validation and empty checks | Conditional concatenation when providers return nothing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bash orchestrator | Node.js orchestrator | Node.js adds flexibility but requires npm dependencies (e.g., child_process.spawn) and makes Claude Code config more complex |
| Process substitution | Named pipes (mkfifo) | Named pipes more portable (POSIX sh) but require cleanup and temp file management |
| Inline concatenation | Structured JSON output | JSON allows flexible parsing but Claude Code expects plain text statusline |
| Unicode separators | ASCII-only separators | ASCII (pipe, dash) more compatible but less visually distinctive |

**Installation:**
No new dependencies required. All tools are built-in to Bash/Unix.

## Architecture Patterns

### Recommended Project Structure
```
statusline-orchestrator.sh   # New: Multi-provider wrapper
statusline.js                  # Existing: VibeRipped provider
lib/
├── statusline/
│   ├── stdin.js
│   ├── detection.js
│   └── format.js             # Modified: Add prefix option
├── engine.js
├── config.js
├── state.js
└── pool.js
```

### Pattern 1: Stdin Duplication via Process Substitution
**What:** Use Bash process substitution to feed stdin to multiple commands simultaneously
**When to use:** Multi-provider orchestration where each provider needs the same stdin data
**Example:**
```bash
#!/usr/bin/env bash
# Source: Process substitution pattern for stdin forwarding

# Read stdin once into variable
STDIN_DATA=$(cat)

# Forward to both providers via process substitution
GSD_OUTPUT=$(echo "$STDIN_DATA" | /path/to/gsd-statusline.sh 2>/dev/null || echo "")
VR_OUTPUT=$(echo "$STDIN_DATA" | /path/to/viberipped/statusline.js 2>/dev/null || echo "")

# Concatenate with separator, handling empty outputs
if [ -n "$GSD_OUTPUT" ] && [ -n "$VR_OUTPUT" ]; then
  echo "$GSD_OUTPUT │ $VR_OUTPUT"
elif [ -n "$GSD_OUTPUT" ]; then
  echo "$GSD_OUTPUT"
elif [ -n "$VR_OUTPUT" ]; then
  echo "$VR_OUTPUT"
fi
```

### Pattern 2: Graceful Failure Handling
**What:** Ensure one provider failing doesn't break the entire statusline
**When to use:** Any multi-provider orchestration with external dependencies
**Example:**
```bash
#!/usr/bin/env bash
# Source: Defensive shell scripting patterns

# Redirect stderr to /dev/null, use || to provide fallback
GSD_OUTPUT=$(gsd-statusline 2>/dev/null || echo "")
VR_OUTPUT=$(node statusline.js 2>/dev/null || echo "")

# Alternative: Explicit exit code checking
if gsd-statusline 2>/dev/null; then
  GSD_OUTPUT=$(gsd-statusline)
else
  GSD_OUTPUT=""  # Silent failure
fi
```

### Pattern 3: Visual Identity via Prefix and Color
**What:** Add consistent prefix and color scheme to each provider's output
**When to use:** Multi-provider scenarios requiring instant visual recognition
**Example:**
```javascript
// Source: Enhanced format.js with prefix support
const ANSI = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function formatExercise(name, reps, options = {}) {
  const prefix = options.prefix || '💪 ';
  if (!name) return '';

  const repText = reps !== undefined && reps !== null ? ` x${reps}` : '';
  return `${ANSI.cyan}${ANSI.bold}${prefix}${name}${repText}${ANSI.reset}`;
}

// Output: "💪 Pushups x15" (cyan bold)
```

### Pattern 4: Separator Selection
**What:** Choose separator that visually partitions provider outputs without clashing with content
**When to use:** Concatenating multiple statusline segments
**Example:**
```bash
# Unicode separators (requires UTF-8 terminal)
SEPARATOR=" │ "   # Box-drawing vertical line
SEPARATOR=" • "   # Bullet point
SEPARATOR=" ║ "   # Double vertical line

# ASCII fallbacks (universal compatibility)
SEPARATOR=" | "   # Pipe character
SEPARATOR=" - "   # Hyphen/dash
SEPARATOR="  "    # Double space
```

### Pattern 5: Conditional Concatenation
**What:** Only add separators when both sides have content
**When to use:** Preventing trailing/leading separators when one provider is silent
**Example:**
```bash
#!/usr/bin/env bash
# Source: Conditional output assembly pattern

LEFT="$1"
RIGHT="$2"
SEP=" │ "

if [ -n "$LEFT" ] && [ -n "$RIGHT" ]; then
  echo "${LEFT}${SEP}${RIGHT}"
elif [ -n "$LEFT" ]; then
  echo "$LEFT"
elif [ -n "$RIGHT" ]; then
  echo "$RIGHT"
else
  echo ""  # Both empty - show nothing
fi
```

### Anti-Patterns to Avoid
- **Sequential stdin reading:** Don't pipe stdin to first provider, then to second. Stdin is consumed once; use variable capture or process substitution.
- **Ignoring provider failures:** Don't let one provider's error crash the orchestrator. Use `2>/dev/null || echo ""` pattern.
- **Hardcoded paths:** Don't assume provider locations. Use relative paths from orchestrator or environment variables.
- **No visual separation:** Don't concatenate outputs without separators. Users need instant recognition of source.
- **Assuming single-line output:** Don't assume providers output exactly one line. Validate and sanitize.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stdin duplication | Custom file descriptors or temp files | Process substitution `<()` or `tee` | Bash built-in, handles buffering, no cleanup needed |
| JSON parsing in Bash | `sed`/`awk`/`grep` JSON extraction | Forward raw JSON to Node.js providers | JSON is complex, providers already have parsers |
| Concurrent execution | Background jobs with `&` and wait | Command substitution with sequential calls | Statusline must be fast; complexity not worth parallelism |
| ANSI color stripping | Regex pattern matching | Leave colors as-is or use existing tools like `ansi-strip` | Edge cases (bold, bright, background) are complex |

**Key insight:** Orchestrator script should be thin and defensive. Its only job is stdin forwarding, output concatenation, and error isolation. All complexity (JSON parsing, process detection, formatting) stays in provider scripts.

## Common Pitfalls

### Pitfall 1: Stdin Consumed by First Provider
**What goes wrong:** Pipe stdin to first provider, then second provider gets empty stdin
**Why it happens:** Pipes are one-way; once stdin is read, it's gone
**How to avoid:** Capture stdin into variable first: `STDIN=$(cat)`, then echo it to each provider
**Warning signs:** Second provider always returns empty output or "parse error"

### Pitfall 2: Provider Errors Breaking Orchestrator
**What goes wrong:** One provider throws error, orchestrator exits, entire statusline disappears
**Why it happens:** Bash's default error handling propagates failures up
**How to avoid:** Use `2>/dev/null || echo ""` pattern for each provider call
**Warning signs:** Statusline goes blank when one provider fails

### Pitfall 3: Separator Always Present
**What goes wrong:** Output shows " │ " even when one or both providers are silent
**Why it happens:** Unconditional concatenation: `echo "$A $SEP $B"`
**How to avoid:** Check if outputs are non-empty before adding separator (see Pattern 5)
**Warning signs:** Lone separator appearing in statusline during cooldown or idle state

### Pitfall 4: Hardcoded Absolute Paths
**What goes wrong:** Orchestrator breaks when VibeRipped moves or runs from different directory
**Why it happens:** Hardcoding paths like `/Users/jacob/Documents/apps/VibeRipped/statusline.js`
**How to avoid:** Use paths relative to orchestrator location: `"$(dirname "$0")/statusline.js"`
**Warning signs:** Orchestrator works in development but fails in production or CI

### Pitfall 5: No Visual Distinction Between Providers
**What goes wrong:** Users can't tell which segment is GSD and which is VibeRipped
**Why it happens:** Both providers use similar colors or no prefixes
**How to avoid:** Establish visual identity with prefix (emoji or text label) and distinct color scheme
**Warning signs:** User feedback: "I can't tell what's what in the statusline"

### Pitfall 6: Unicode Separator Encoding Issues
**What goes wrong:** Separators render as "?" or broken characters in some terminals
**Why it happens:** Terminal doesn't support UTF-8 or locale is misconfigured
**How to avoid:** Test on multiple terminals, provide ASCII fallback option via environment variable
**Warning signs:** Visual glitches on Linux servers or older macOS Terminal.app

### Pitfall 7: GSD Statusline Assumption
**What goes wrong:** Orchestrator assumes GSD has a statusline provider that doesn't exist yet
**Why it happens:** Research found GSD issue #212 (enhanced statusline) but not implemented in bin/gsd-tools.js
**How to avoid:** Verify GSD statusline exists and is callable before integration; provide graceful fallback
**Warning signs:** GSD output always empty, orchestrator logs "command not found"

### Pitfall 8: Race Conditions with Concurrent Execution
**What goes wrong:** Using background jobs (`&`) causes output interleaving or truncation
**Why it happens:** Bash background jobs can write to stdout simultaneously, causing garbled output
**How to avoid:** Use sequential execution with command substitution (fast enough for statuslines)
**Warning signs:** Statusline flickers, shows partial outputs, or characters mixed between providers

## Code Examples

Verified patterns from official sources and existing codebase:

### Orchestrator Shell Script (Complete Example)
```bash
#!/usr/bin/env bash
# statusline-orchestrator.sh
# Multi-provider statusline for Claude Code: GSD + VibeRipped
# Source: Bash stdin forwarding + conditional concatenation patterns

set -euo pipefail

# Configuration: Paths relative to orchestrator location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GSD_STATUSLINE="${GSD_STATUSLINE:-gsd-statusline}"  # Env var or default command
VR_STATUSLINE="${SCRIPT_DIR}/statusline.js"
SEPARATOR="${VR_SEPARATOR:- │ }"  # Configurable separator

# Read stdin once (Claude Code's JSON)
STDIN_DATA=$(cat)

# Call providers, capture outputs, suppress errors
GSD_OUTPUT=$(echo "$STDIN_DATA" | $GSD_STATUSLINE 2>/dev/null || echo "")
VR_OUTPUT=$(echo "$STDIN_DATA" | node "$VR_STATUSLINE" 2>/dev/null || echo "")

# Conditional concatenation
if [ -n "$GSD_OUTPUT" ] && [ -n "$VR_OUTPUT" ]; then
  echo "${GSD_OUTPUT}${SEPARATOR}${VR_OUTPUT}"
elif [ -n "$GSD_OUTPUT" ]; then
  echo "$GSD_OUTPUT"
elif [ -n "$VR_OUTPUT" ]; then
  echo "$VR_OUTPUT"
fi

exit 0
```

### Enhanced VibeRipped Formatter with Prefix
```javascript
// lib/statusline/format.js (modified)
// Source: Visual identity enhancement pattern

const ANSI = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function formatExercise(name, reps, options = {}) {
  if (!name) return '';

  const prefix = options.prefix || '';  // Empty default, configurable
  const repText = reps !== undefined && reps !== null ? ` x${reps}` : '';

  return `${ANSI.cyan}${ANSI.bold}${prefix}${name}${repText}${ANSI.reset}`;
}

module.exports = { formatExercise, ANSI };
```

### Statusline Entry Point with Prefix
```javascript
// statusline.js (modified section)
// Source: Integration of prefix into output

const { formatExercise } = require('./lib/statusline/format');

// ... stdin reading and processing ...

if (result.type === 'exercise') {
  const formatted = formatExercise(
    result.exercise.name,
    result.exercise.reps,
    { prefix: '💪 ' }  // Visual identity prefix
  );
  process.stdout.write(formatted);
  process.exit(0);
}
```

### Testing Orchestrator Locally
```bash
# Test with mock stdin JSON
echo '{"context_window":{"current_usage":{"input_tokens":100}}}' | ./statusline-orchestrator.sh

# Test with only VibeRipped (GSD disabled)
export GSD_STATUSLINE="false"  # Command that fails immediately
echo '{"context_window":{"current_usage":{"input_tokens":100}}}' | ./statusline-orchestrator.sh

# Test with bypass cooldown (force exercise output)
export VIBERIPPED_BYPASS_COOLDOWN=1
echo '{"context_window":{"current_usage":{"input_tokens":100}}}' | ./statusline-orchestrator.sh
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single monolithic statusline | Multi-provider composition | Community shift 2025 | Modular, each tool focuses on one concern |
| Named pipes for stdin duplication | Process substitution `<()` | Bash 3.0+ adoption | Simpler code, no cleanup, no temp files |
| Hook-based statusline extensions | Stdin/stdout provider pattern | Claude Code architecture | Self-contained, polled by CLI |
| Hardcoded separators | Configurable via environment variables | 2025+ implementations | User customization without code changes |

**Deprecated/outdated:**
- Named pipes (FIFO) for stdin duplication: Process substitution is simpler and cleaner
- Hook-based statusline (GSD issue #212 approach): Claude Code uses provider pattern, not lifecycle hooks
- Powerline fonts as requirement: Modern Unicode box-drawing characters work in all terminals

## Open Questions

1. **GSD statusline provider availability**
   - What we know: GSD issue #212 describes enhanced statusline with hooks, but bin/gsd-tools.js doesn't expose statusline command as of Feb 2026
   - What's unclear: Does GSD ship a separate statusline provider script? Is the hook-based statusline compatible with stdin/stdout pattern?
   - Recommendation: Verify GSD statusline exists and is callable. If not, orchestrator should gracefully handle GSD absence (VibeRipped-only mode). User may need to implement GSD statusline wrapper or wait for official release.

2. **Claude Code multi-provider support**
   - What we know: Claude Code's `statusLine` setting accepts one script path
   - What's unclear: Does Claude Code officially support multiple statusline providers, or is orchestrator pattern a community workaround?
   - Recommendation: Orchestrator pattern is the standard community approach. Claude Code sees orchestrator as single provider; internal composition is transparent.

3. **Performance impact of sequential execution**
   - What we know: Each provider call adds latency; Claude Code debounces statusline updates to 300ms
   - What's unclear: Is sequential execution fast enough, or do we need concurrent execution with background jobs?
   - Recommendation: Start with sequential (simpler, safer). Profile with `time` command. Only parallelize if latency exceeds 100ms.

4. **Visual identity best practices**
   - What we know: Community uses emoji prefixes (💪, 🚀, 📊), Unicode separators (│, ║), and color coding
   - What's unclear: What's the most effective visual distinction without clutter?
   - Recommendation: Test with users. Start with emoji prefix + separator. If clutter is an issue, switch to color-only distinction (cyan for VibeRipped, yellow for GSD).

5. **Error visibility**
   - What we know: Orchestrator suppresses stderr with `2>/dev/null` for silent failures
   - What's unclear: How should users debug when a provider fails?
   - Recommendation: Add optional debug mode via environment variable: `VR_DEBUG=1` logs errors to `/tmp/vr-orchestrator.log` without breaking statusline.

## Sources

### Primary (HIGH confidence)
- [Official Claude Code Statusline Documentation](https://code.claude.com/docs/en/statusline) - Stdin JSON structure, output expectations, ANSI color support
- Existing VibeRipped codebase (statusline.js, lib/statusline/format.js) - Current implementation, ANSI codes, visual identity
- [Bash Process Substitution Documentation](https://tldp.org/LDP/abs/html/process-sub.html) - Process substitution syntax, stdin duplication patterns
- GSD bin/gsd-tools.js source inspection - No statusline command found (Feb 2026)

### Secondary (MEDIUM confidence)
- [GSD Enhanced Statusline (Issue #212)](https://github.com/glittercowboy/get-shit-done/issues/212) - Hook-based statusline architecture, display levels, metrics tracked
- [Send stdout to Multiple Commands | Baeldung on Linux](https://www.baeldung.com/linux/stdout-to-multiple-commands) - Tee command, process substitution, named pipes
- [Bash Process Substitution | Linux Handbook](https://linuxhandbook.com/bash-process-substitution/) - Syntax, use cases, multiple command patterns
- [Claude Code Statusline Guide](https://claudefa.st/blog/tools/statusline-guide) - Community patterns, JSON parsing, testing
- [Box-drawing characters | Wikipedia](https://en.wikipedia.org/wiki/Box-drawing_character) - Unicode separator reference, terminal compatibility

### Tertiary (LOW confidence - needs validation)
- GSD statusline provider existence - Issue #212 describes hook-based statusline, but no stdin/stdout provider confirmed in current release
- Concurrent execution benefits - No benchmarks found comparing sequential vs parallel provider execution
- Powerline separator rendering issues - [Issue #6635](https://github.com/anthropics/claude-code/issues/6635) mentions ANSI/Unicode problems, but unclear if resolved

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Bash process substitution documented, no new dependencies, proven patterns
- Architecture: MEDIUM - Orchestrator pattern verified in community, but GSD statusline availability unconfirmed
- Pitfalls: MEDIUM - Stdin consumption and error handling well-documented, but multi-provider edge cases need empirical testing

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (30 days - stable domain, bash patterns unlikely to change, but GSD statusline may be released)
