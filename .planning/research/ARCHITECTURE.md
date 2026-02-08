# Architecture Research: VibeRipped

**Domain:** Claude Code statusline provider / micro-exercise rotation system
**Researched:** 2026-02-08
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                      Claude Code Process                            │
│                                                                      │
│  Triggers statusline update (after assistant message, 300ms delay) │
└────────────────────────┬───────────────────────────────────────────┘
                         │ pipes JSON via stdin
                         ↓
┌────────────────────────────────────────────────────────────────────┐
│                    Statusline Script Entry Point                    │
│         (single executable: vibripped-statusline.js)                │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  1. Read JSON from stdin (session data, context window)     │  │
│  │  2. Detect if Claude is actively processing                 │  │
│  │  3. Load state (rotation index, cooldown timestamp)         │  │
│  │  4. Load config (equipment declared)                        │  │
│  │  5. Assemble exercise pool (bodyweight + equipment)         │  │
│  │  6. Rotate & emit instruction (if active + cooldown clear)  │  │
│  │  7. Save state (new index, cooldown timestamp)              │  │
│  │  8. Print to stdout                                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────┬───────────────────────────────────────────┘
                         │ prints formatted string
                         ↓
┌────────────────────────────────────────────────────────────────────┐
│             Claude Code Statusline Display Area                     │
│                                                                      │
│  ┌─────────────────────┐ ┌──────────────────────┐                  │
│  │ GSD Provider Output │ │ VibeRipped Provider  │                  │
│  │ (task, directory)   │ │ (exercise prompt)    │                  │
│  └─────────────────────┘ └──────────────────────┘                  │
└────────────────────────────────────────────────────────────────────┘
```

**Key Insight:** Claude Code statusline is NOT a composite surface requiring provider coordination. Only ONE script executes per statusline update. Multi-provider displays require a single orchestrator script that calls sub-scripts or internal modules.

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Statusline Entry Point** | Read stdin JSON, coordinate all logic, print output | Single executable script (Node.js recommended for GSD ecosystem consistency) |
| **Process Detector** | Determine if Claude is actively processing vs idle | Heuristic: check if stdin JSON contains recent API activity timestamp or context window changes |
| **State Manager** | Load/save rotation index and cooldown timestamp | JSON file in `~/.claude/cache/vibripped-state.json` |
| **Config Loader** | Read equipment declarations | JSON file in `~/.claude/vibripped-config.json` with project overrides |
| **Exercise Pool Assembler** | Build bounded pool from bodyweight + equipment exercises | In-memory array construction based on config |
| **Rotation Engine** | Sequential iteration, index wrapping, cooldown enforcement | Modulo arithmetic `(index + 1) % pool.length` |
| **Output Formatter** | Crisp, command-style instruction | String template with ANSI escape codes for color |

## Recommended Project Structure

```
vibripped/
├── statusline.js              # Entry point: orchestrates all components
├── lib/
│   ├── process-detector.js    # Active/idle detection logic
│   ├── state-manager.js       # Load/save rotation index + cooldown
│   ├── config-loader.js       # Read equipment declarations
│   ├── exercise-pool.js       # Assemble bodyweight + equipment exercises
│   ├── rotation-engine.js     # Sequential rotation with cooldown
│   └── formatter.js           # Output string generation
├── data/
│   ├── exercises-bodyweight.json   # Core exercises (always included)
│   ├── exercises-kettlebell.json   # Conditional (if user has kettlebell)
│   ├── exercises-dumbbells.json    # Conditional (if user has dumbbells)
│   ├── exercises-pullup.json       # Conditional (if user has pull-up bar)
│   └── exercises-parallettes.json  # Conditional (if user has parallettes)
├── config/
│   └── default-config.json    # Default equipment configuration
├── test/
│   ├── process-detector.test.js
│   ├── state-manager.test.js
│   ├── rotation-engine.test.js
│   └── integration.test.js
└── package.json
```

### Structure Rationale

- **statusline.js:** Single entry point matches Claude Code's execution model (one script per update)
- **lib/:** Modular separation enables isolated testing of each component
- **data/:** JSON exercise pools are declarative, easily extensible, and version-controllable
- **config/:** User equipment declarations live in `~/.claude/vibripped-config.json` (not in repo)
- **test/:** Essential for deterministic behavior verification (rotation order, cooldown logic)

## Architectural Patterns

### Pattern 1: Stdin JSON Parsing

**What:** Claude Code pipes session data via stdin as a JSON object on every statusline update.

**When to use:** Always. This is the only data interface Claude Code provides.

**Trade-offs:**
- Pro: Rich data (model, context window, cost, session ID, git info)
- Con: Parsing adds ~5-10ms latency (negligible for statusline)

**Example:**
```javascript
// statusline.js entry point
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  const data = JSON.parse(input);
  const isActive = detectActivity(data);
  if (isActive) {
    const instruction = getNextExercise();
    console.log(instruction); // stdout → statusline display
  }
});
```

### Pattern 2: File-Based State Persistence

**What:** Rotation index and cooldown timestamp stored in `~/.claude/cache/vibripped-state.json`.

**When to use:** When state must survive process restarts (statusline script runs once per update, dies immediately).

**Trade-offs:**
- Pro: Simple, no database overhead, survives Claude Code restarts
- Con: File I/O adds ~2-5ms latency (acceptable for statusline)
- Con: No atomic transactions (edge case: concurrent writes if multiple Claude sessions)

**Example:**
```javascript
// lib/state-manager.js
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(os.homedir(), '.claude', 'cache', 'vibripped-state.json');

function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    return { rotationIndex: 0, lastEmitTimestamp: 0 };
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
```

### Pattern 3: Bounded Sequential Rotation with Cooldown

**What:** Iterate through fixed-size exercise pool, wrap at end, enforce minimum time between emissions.

**When to use:** For deterministic, predictable rotation that prevents spamming users with instructions.

**Trade-offs:**
- Pro: Predictable, testable, no duplicates until pool exhausted
- Con: Fixed order may feel repetitive (acceptable for micro-exercises)

**Example:**
```javascript
// lib/rotation-engine.js
function getNextExercise(pool, state, cooldownMs = 30000) {
  const now = Date.now();
  if (now - state.lastEmitTimestamp < cooldownMs) {
    return null; // Cooldown not elapsed
  }

  const exercise = pool[state.rotationIndex];
  const newIndex = (state.rotationIndex + 1) % pool.length;

  saveState({
    rotationIndex: newIndex,
    lastEmitTimestamp: now
  });

  return exercise;
}
```

### Pattern 4: Equipment-Conditional Pool Assembly

**What:** Build exercise pool dynamically based on user's declared equipment.

**When to use:** When features depend on user-specific configuration that varies per installation.

**Trade-offs:**
- Pro: Personalized experience, no irrelevant exercises
- Con: Pool size varies per user (affects rotation frequency)

**Example:**
```javascript
// lib/exercise-pool.js
const bodyweight = require('../data/exercises-bodyweight.json');
const kettlebell = require('../data/exercises-kettlebell.json');
const dumbbells = require('../data/exercises-dumbbells.json');

function assemblePool(config) {
  let pool = [...bodyweight]; // Always include bodyweight

  if (config.equipment.kettlebell) pool.push(...kettlebell);
  if (config.equipment.dumbbells) pool.push(...dumbbells);
  if (config.equipment.pullupBar) pool.push(...pullup);
  if (config.equipment.parallettes) pool.push(...parallettes);

  return pool;
}
```

### Pattern 5: Heuristic Process Detection

**What:** Infer whether Claude is actively processing by analyzing stdin JSON fields.

**When to use:** When direct process state is unavailable (Claude Code doesn't expose "is AI thinking" flag).

**Trade-offs:**
- Pro: No external dependencies, works within statusline script
- Con: Heuristic may misfire (emit during idle, or miss active processing)

**Example:**
```javascript
// lib/process-detector.js
function detectActivity(data) {
  // Strategy 1: Check if context window changed recently
  const usage = data.context_window?.current_usage;
  if (!usage || usage === null) return false; // No API call yet

  // Strategy 2: Check if API duration increased (signal of recent processing)
  const apiDuration = data.cost?.total_api_duration_ms || 0;
  if (apiDuration > 1000) return true; // Active if >1s API time accumulated

  // Strategy 3: Fallback - always active if session has context usage
  const pct = data.context_window?.used_percentage || 0;
  return pct > 0;
}
```

**Confidence Note:** Process detection is LOW confidence. Official docs don't specify an "is active" field. Recommend experimentation with test sessions to validate heuristic.

## Data Flow

### Request Flow

```
Claude Code Assistant Message
    ↓
[300ms debounce, cancellation of in-flight scripts]
    ↓
statusline.js executes (new process)
    ↓
Read stdin JSON → Parse session data
    ↓
Detect Activity? → YES: continue, NO: exit early (no output)
    ↓
Load State (rotation index, cooldown) ← ~/.claude/cache/vibripped-state.json
    ↓
Load Config (equipment) ← ~/.claude/vibripped-config.json
    ↓
Assemble Exercise Pool (bodyweight + equipment matches)
    ↓
Check Cooldown? → NOT ELAPSED: exit early, ELAPSED: continue
    ↓
Rotate (index + 1) % pool.length → Get current exercise
    ↓
Save State (new index, timestamp) → ~/.claude/cache/vibripped-state.json
    ↓
Format Output (ANSI colors, crisp command)
    ↓
Print to stdout
    ↓
Claude Code renders statusline
    ↓
Process exits
```

### State Management

```
vibripped-state.json (persistent)
    ↓ (read)
State Manager → { rotationIndex: N, lastEmitTimestamp: T }
    ↓ (pass to)
Rotation Engine → Calculate next index, check cooldown
    ↓ (updated state)
State Manager → Write new { rotationIndex: N+1, lastEmitTimestamp: Now }
    ↓ (persist)
vibripped-state.json (updated)
```

### Key Data Flows

1. **Session → Activity Detection:** `context_window.current_usage` signals API call completion. Null = no processing yet. Non-null = Claude actively thinking or just finished.
2. **Config → Pool Assembly:** Equipment flags (`config.equipment.kettlebell: true`) gate inclusion of equipment-specific exercises in pool.
3. **State → Rotation:** Previous `rotationIndex` determines next exercise. Cooldown `lastEmitTimestamp` gates emission timing.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Single user | File-based state (`~/.claude/cache/`) is sufficient. JSON config works well. |
| Multiple Claude sessions (same user) | File-based state may race. Mitigation: Atomic writes with temp file + rename. Low risk: statusline updates debounced 300ms, unlikely to overlap. |
| Shared team config | Not applicable (statusline is local per-user). If desired: Symlink `~/.claude/vibripped-config.json` to shared repo. |

### Scaling Priorities

1. **First bottleneck:** File I/O latency if state file grows large. Mitigation: Keep state minimal (2 fields: rotationIndex, lastEmitTimestamp). Expected size: ~100 bytes.
2. **Second bottleneck:** Exercise pool assembly if data files become enormous. Mitigation: Keep pools bounded (10-15 exercises per equipment type). Load time: <5ms.

**Reality check:** This is a local CLI tool for a single user. Over-engineering for scale is anti-pattern. File-based state is appropriate.

## Anti-Patterns

### Anti-Pattern 1: Multi-Script Provider Coordination

**What people might do:** Create separate `vibripped-statusline.js` and `gsd-statusline.js`, configure Claude Code to run both, expect outputs to combine.

**Why it's wrong:** Claude Code executes ONE statusline script. Only one `statusLine.command` in settings.json. Multi-provider display requires orchestrator.

**Do this instead:**
- **Option A (Recommended):** Single orchestrator script calls both GSD and VibeRipped logic, concatenates outputs:
  ```javascript
  // orchestrator-statusline.js
  const gsdOutput = require('./gsd-statusline-module.js')(data);
  const vrOutput = require('./vibripped-statusline-module.js')(data);
  console.log(`${gsdOutput} | ${vrOutput}`);
  ```
- **Option B:** Modify GSD statusline to conditionally append VibeRipped output. Tighter coupling but simpler deployment.

### Anti-Pattern 2: Complex State Schema

**What people might do:** Store entire exercise history, timestamps per exercise, user performance metrics in state file.

**Why it's wrong:** Statusline script runs on every update (frequent). Large state file = I/O latency. Scope creep beyond "deterministic rotation."

**Do this instead:** Minimal state: `{ rotationIndex: number, lastEmitTimestamp: number }`. ~50 bytes. Load/save <1ms.

### Anti-Pattern 3: Synchronous API Calls in Statusline Script

**What people might do:** Fetch exercise pool from remote API, check for updates to exercise library on every statusline render.

**Why it's wrong:** Statusline updates are frequent (after every assistant message). Network latency blocks rendering. User sees stale statusline during fetch.

**Do this instead:** Bake exercise pools into script as JSON files. If remote sync desired, background process updates files periodically (e.g., daily cron job).

### Anti-Pattern 4: Regex Parsing of stdin Instead of JSON.parse()

**What people might do:** `const model = input.match(/"model":\s*"([^"]+)"/)[1]`

**Why it's wrong:** Fragile. Breaks on JSON formatting changes. Misses null values. Unnecessary complexity.

**Do this instead:** `const data = JSON.parse(input); const model = data.model?.display_name;` Robust, handles edge cases, standard library.

### Anti-Pattern 5: Global Mutable State

**What people might do:** Store rotation index in global variable, rely on process persistence.

**Why it's wrong:** Statusline script is ephemeral (dies after stdout). Global state resets on every invocation. Index resets to 0.

**Do this instead:** File-based persistence. See Pattern 2.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Claude Code | stdin JSON → stdout string | Only interface. No API, no sockets, no HTTP. |
| File System | Synchronous fs.readFileSync / fs.writeFileSync | Acceptable latency (<5ms). Async unnecessary for <1KB files. |
| (Future) Exercise Library API | Background sync process (cron) → update JSON files | NOT in statusline script. Decouple fetch from render. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Statusline Entry ↔ Process Detector | Function call, pass stdin JSON data | Pure function: `isActive = detectActivity(data)` |
| Statusline Entry ↔ State Manager | Function call, return/accept objects | `state = loadState(); saveState(newState);` |
| Statusline Entry ↔ Config Loader | Function call, return config object | Cached in memory if called multiple times (optimization) |
| Statusline Entry ↔ Exercise Pool | Function call, pass config, return array | Pure function: `pool = assemblePool(config)` |
| Statusline Entry ↔ Rotation Engine | Function call, pass pool + state, return exercise | Side effect: writes state file internally |
| Statusline Entry ↔ Formatter | Function call, pass exercise, return string | Pure function: `output = format(exercise)` |
| **GSD Statusline ↔ VibeRipped Statusline** | **Orchestrator imports both as modules** | **Key integration point: shared entry script or separate scripts concatenated** |

## Multi-Provider Coexistence Strategy

**Problem:** GSD statusline and VibeRipped statusline both need to display simultaneously.

**Solution:** Single orchestrator entry point. Modularize GSD and VibeRipped logic, import both, concatenate outputs.

### Approach A: Orchestrator Script (Recommended)

```javascript
// ~/.claude/hooks/composite-statusline.js
const gsd = require('./gsd-statusline-module.js');
const vibripped = require('./vibripped-statusline-module.js');

let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  const data = JSON.parse(input);

  const gsdOutput = gsd.generate(data);
  const vrOutput = vibripped.generate(data);

  // Concatenate with separator
  if (vrOutput) {
    console.log(`${gsdOutput} │ ${vrOutput}`);
  } else {
    console.log(gsdOutput); // Only GSD if no exercise emitted
  }
});
```

**Update settings.json:**
```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"/Users/jacob/.claude/hooks/composite-statusline.js\""
  }
}
```

### Approach B: GSD Modification (Simpler Deployment)

Modify existing `gsd-statusline.js` to conditionally append VibeRipped output.

**Pros:**
- No new orchestrator file
- Single settings.json entry (already configured)

**Cons:**
- Tighter coupling (GSD now depends on VibeRipped)
- Less modular (harder to disable VibeRipped independently)

**Recommendation:** Use Approach A if VibeRipped is distributed as standalone npm package. Use Approach B if VibeRipped is GSD plugin.

## Process Detection Strategies (Exploration Needed)

**Challenge:** Claude Code stdin JSON does not explicitly indicate "AI is actively processing."

**Heuristic Options:**

1. **Context Window Change Detection:**
   - Track previous `context_window.used_percentage` in state file
   - If current > previous → Active processing just occurred
   - **Risk:** False negatives if context window unchanged (cached responses)

2. **API Duration Threshold:**
   - Check `cost.total_api_duration_ms`
   - If increased since last check → Active
   - **Risk:** Requires tracking previous duration in state

3. **Current Usage Non-Null:**
   - `context_window.current_usage !== null` signals at least one API call
   - **Risk:** Remains non-null after processing ends (always active once session starts)

4. **Session Timestamp Freshness:**
   - Compare `data.cost.total_duration_ms` with last known value
   - If increased by <5 seconds → Likely active
   - **Risk:** Complex state tracking

**Recommendation:** Start with Strategy 3 (simplest). Tune based on user feedback. Flag as research gap: "Active detection heuristic needs validation with real usage."

## Build Order Implications

**Suggested Implementation Sequence:**

### Phase 1: Core Rotation (No Claude Integration)
- Exercise pool data files (JSON)
- State manager (load/save rotation index)
- Rotation engine (sequential iteration + cooldown)
- Config loader (equipment flags)
- Pool assembler (bodyweight + equipment)
- **Output:** Standalone CLI tool: `node vibripped-cli.js` → emits exercise

### Phase 2: Statusline Integration
- Process detector (heuristic for active state)
- Statusline entry point (stdin JSON → stdout)
- Formatter (ANSI colors, command-style output)
- **Output:** Functional statusline script, installable independently

### Phase 3: GSD Coexistence
- Modularize GSD statusline (extract logic from script to module)
- Orchestrator script (call GSD + VibeRipped, concatenate)
- Update settings.json to use orchestrator
- **Output:** Unified statusline showing both GSD and VibeRipped

### Phase 4: Configuration & Polish
- CLI for equipment setup: `vibripped config --kettlebell --dumbbells`
- Validation (detect missing equipment declarations, prompt setup)
- Error handling (missing state file, corrupt JSON)
- **Output:** Production-ready installation experience

**Dependencies:**
- Phase 2 depends on Phase 1 (core rotation must work standalone)
- Phase 3 depends on Phase 2 (statusline integration must work solo first)
- Phase 4 can run parallel to Phase 3 (config tooling independent of GSD)

## Sources

**HIGH Confidence (Official Documentation & Direct Examination):**
- [Claude Code Statusline Documentation](https://code.claude.com/docs/en/statusline) - Official docs on stdin JSON schema, execution model, update triggers, output formatting
- Direct examination of `~/.claude/hooks/gsd-statusline.js` - Real-world statusline implementation pattern
- Direct examination of `~/.claude/settings.json` - Statusline configuration structure

**MEDIUM Confidence (Community Implementations):**
- [ccstatus-go GitHub](https://github.com/Mirage20/ccstatus-go) - Provider-component architecture pattern (Go implementation, principles transferable to Node.js)
- [ESMC Lite GitHub](https://github.com/alyfe-how/esmc-lite) - File-based state persistence pattern for CLI tools
- [Agent Factory: Persisting State in Files](https://agentfactory.panaversity.org/docs/General-Agents-Foundations/seven-principles/persisting-state-in-files) - General pattern for agent state persistence

**LOW Confidence (Needs Validation):**
- Process detection heuristics - No official documentation on "is active" field in stdin JSON. Heuristics require empirical testing.

---
*Architecture research for: VibeRipped - Claude Code Statusline Exercise Rotation System*
*Researched: 2026-02-08*
