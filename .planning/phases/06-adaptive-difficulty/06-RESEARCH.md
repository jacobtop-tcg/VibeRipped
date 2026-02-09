# Phase 6: Adaptive Difficulty - Research

**Researched:** 2026-02-09
**Domain:** Adaptive difficulty systems, rep count scaling algorithms, latency-based adjustment, user-controlled difficulty multipliers
**Confidence:** MEDIUM

## Summary

Phase 6 introduces two adaptive difficulty mechanisms: latency-based rep scaling and user-controlled difficulty multipliers. The latency input comes from `cost.total_api_duration_ms` in the Claude Code statusline stdin JSON, which tracks cumulative time spent waiting for API responses. This provides a proxy for "how long you've been waiting" that correlates with cognitive task duration. Rep scaling uses linear interpolation (lerp) to map latency duration to a rep count range, then applies a discrete difficulty multiplier that users control via `vibripped harder` and `vibripped softer` commands.

The core challenge is balancing three constraints: (1) latency duration varies dramatically (2-30+ seconds), (2) difficulty multipliers should produce noticeable but not extreme differences, and (3) final rep counts must remain within practical work-environment bounds regardless of input combinations. Research suggests a two-stage scaling approach: map latency to base reps via linear interpolation with defined min/max bounds, then apply difficulty multiplier (0.5x-2.5x range with 0.25x steps), then clamp to absolute practical limits (5-60 reps).

Existing codebase already has all necessary infrastructure: config persistence via `lib/config.js`, state tracking via `lib/state.js`, CLI command pattern via `bin/vibripped.js` with Commander, and statusline latency data via stdin. The implementation extends these patterns with a new difficulty module, adds multiplier to config, modifies engine.js to apply scaling, and adds harder/softer commands to CLI.

**Primary recommendation:** Implement two-stage scaling (latency→base reps→multiplier→clamp) with linear interpolation for latency mapping, discrete 0.25x steps for multiplier (stored in config, default 1.0x), and absolute bounds (5-60 reps) to ensure work-environment safety.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Math.min/Math.max | Node.js built-in | Clamp/bounds checking | Zero-dependency, ubiquitous pattern in JS |
| Linear interpolation | Pure function | Map latency duration to rep range | Standard technique for range mapping, no library needed |
| Existing config.js | Current | Store difficulty multiplier | Already handles equipment, extend with multiplier field |
| Existing engine.js | Current | Apply scaling to exercise reps | Central orchestration point, already formats exercises |
| Commander.js | 12.1.0 | CLI commands for harder/softer | Already in package.json, consistent with Phase 5 patterns |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| write-file-atomic | 7.0.0 | Persist difficulty changes | Already in package.json, used for config saves |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Linear interpolation | Logarithmic scaling | Log scaling provides diminishing returns but adds complexity; linear is predictable and sufficient |
| Discrete steps (0.25x) | Continuous slider (any value) | Continuous allows finer control but harder to reason about; discrete steps provide clear progression |
| Latency-based scaling | Fixed rep counts | Fixed reps simpler but ignores context of waiting duration; latency-based provides natural adaptation |
| Config-stored multiplier | State-stored multiplier | State changes on pool edits; config is more stable for persistent user preferences |

**Installation:**
No new dependencies required. All functionality uses existing libraries:
```bash
# Already installed in Phase 1-5
npm install write-file-atomic commander
```

## Architecture Patterns

### Recommended Project Structure
```
lib/
├── difficulty.js         # NEW: Scaling algorithms, bounds, multiplier logic
├── config.js            # EXTEND: Add difficulty.multiplier field
├── state.js             # No changes needed
├── pool.js              # No changes needed
├── cli/
│   ├── commands/
│   │   ├── harder.js    # NEW: Increment multiplier command
│   │   └── softer.js    # NEW: Decrement multiplier command
engine.js                # MODIFY: Apply difficulty scaling to exercise reps
statusline.js            # MODIFY: Pass latency data to engine
```

### Pattern 1: Two-Stage Scaling (Latency → Base → Multiplier)
**What:** Separate concerns: first map latency to base reps, then apply user multiplier, then clamp
**When to use:** Complex scaling with multiple inputs and absolute safety bounds
**Example:**
```javascript
// lib/difficulty.js
function scaleRepsForLatency(baseReps, latencyMs, multiplier) {
  // Stage 1: Map latency to base scaling factor (1.0 = baseline, 1.5 = max)
  const latencyFactor = latencyToScaleFactor(latencyMs);

  // Stage 2: Apply latency scaling to base reps
  const latencyScaledReps = Math.round(baseReps * latencyFactor);

  // Stage 3: Apply user difficulty multiplier
  const multipliedReps = Math.round(latencyScaledReps * multiplier);

  // Stage 4: Clamp to absolute practical bounds
  return clamp(multipliedReps, 5, 60);
}

function latencyToScaleFactor(latencyMs) {
  const MIN_LATENCY = 2000;   // 2 seconds
  const MAX_LATENCY = 30000;  // 30 seconds
  const MIN_FACTOR = 1.0;     // No scaling for short waits
  const MAX_FACTOR = 1.5;     // 50% increase for long waits

  // Linear interpolation (lerp)
  return lerp(MIN_FACTOR, MAX_FACTOR,
    (clamp(latencyMs, MIN_LATENCY, MAX_LATENCY) - MIN_LATENCY) /
    (MAX_LATENCY - MIN_LATENCY)
  );
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
```

### Pattern 2: Discrete Difficulty Steps
**What:** Fixed multiplier increments (0.5x, 0.75x, 1.0x, 1.25x, 1.5x, 1.75x, 2.0x, 2.25x, 2.5x)
**When to use:** User-controlled difficulty that should feel predictable and clearly progressive
**Example:**
```javascript
// lib/difficulty.js
const DIFFICULTY_STEPS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5];
const DEFAULT_STEP_INDEX = 2; // 1.0x

function incrementDifficulty(currentMultiplier) {
  const currentIndex = DIFFICULTY_STEPS.indexOf(currentMultiplier);
  if (currentIndex === -1) return 1.0; // Reset to default if invalid
  const nextIndex = Math.min(currentIndex + 1, DIFFICULTY_STEPS.length - 1);
  return DIFFICULTY_STEPS[nextIndex];
}

function decrementDifficulty(currentMultiplier) {
  const currentIndex = DIFFICULTY_STEPS.indexOf(currentMultiplier);
  if (currentIndex === -1) return 1.0; // Reset to default if invalid
  const prevIndex = Math.max(currentIndex - 1, 0);
  return DIFFICULTY_STEPS[prevIndex];
}
```

### Pattern 3: Config Extension for Difficulty
**What:** Add difficulty field to configuration alongside equipment
**When to use:** Persistent user preferences that survive across sessions
**Example:**
```javascript
// lib/config.js - extend DEFAULT_CONFIG
const DEFAULT_CONFIG = {
  equipment: {
    kettlebell: false,
    dumbbells: false,
    pullUpBar: false,
    parallettes: false
  },
  difficulty: {
    multiplier: 1.0  // NEW: Default 1.0x difficulty
  }
};

// Validation update
function validateConfig(config) {
  // ... existing equipment validation ...

  // Validate difficulty field
  if (config.difficulty && typeof config.difficulty !== 'object') {
    return false;
  }
  if (config.difficulty?.multiplier !== undefined &&
      typeof config.difficulty.multiplier !== 'number') {
    return false;
  }

  return true;
}
```

### Pattern 4: Engine Integration - Latency from Statusline
**What:** Pass latency data from statusline stdin to engine, apply scaling before formatting
**When to use:** Statusline provider has access to latency, engine needs it for scaling
**Example:**
```javascript
// statusline.js - extract and pass latency
const data = parseStdin(stdinBuffer);
const latencyMs = data?.cost?.total_api_duration_ms || 0;

// Trigger engine with latency
const result = trigger(null, { bypassCooldown, latencyMs });

// engine.js - apply scaling
const { scaleRepsForLatency } = require('./lib/difficulty');
const config = loadConfig(configPath);
const multiplier = config.difficulty?.multiplier || 1.0;

// Before formatting exercise
exercise.reps = scaleRepsForLatency(exercise.reps, options.latencyMs || 0, multiplier);
```

### Anti-Patterns to Avoid
- **Multiplicative explosion:** Don't multiply latency factor AND user multiplier without bounds — can produce 100+ rep counts that are impossible in work environments
- **Continuous multiplier values:** Don't allow arbitrary decimal multipliers (e.g., 1.37942x) — users can't reason about what they set, and harder/softer commands become unpredictable
- **Ignoring latency=0:** Don't scale when latency is unavailable — statusline stdin before first API call has null/0 latency, apply 1.0x factor as default
- **Per-exercise multipliers:** Don't store multiplier per exercise — global multiplier is simpler and matches user mental model of "overall difficulty"

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Linear interpolation | Custom range mapping logic | Standard lerp formula: `start + (end - start) * t` | Edge cases (reversed ranges, out-of-bounds), well-understood formula |
| Number clamping | Custom if/else bounds checking | `Math.min(Math.max(val, min), max)` | One-liner, handles all cases, ubiquitous pattern |
| Latency extraction | Custom JSON path traversal | Optional chaining: `data?.cost?.total_api_duration_ms` | Safe null handling, concise, prevents crashes |
| Difficulty persistence | Custom file format | Extend existing config.js structure | Already atomic, validated, integrated with CLI |

**Key insight:** Scaling algorithms are simple but error-prone (off-by-one, reversed ranges, overflow). Use standard formulas and clamp aggressively. The complexity is in choosing GOOD bounds, not implementing the math.

## Common Pitfalls

### Pitfall 1: Unbound Scaling Produces Impossible Rep Counts
**What goes wrong:** Multiplying latency factor (1.5x) by user multiplier (2.5x) by base reps (20) produces 75 reps — impossible in 60 seconds during work
**Why it happens:** Each scaling layer seems reasonable in isolation, but they compound
**How to avoid:** Always apply absolute clamp AFTER all scaling (e.g., 5-60 reps). Test extreme combinations: max latency + max multiplier + highest base rep exercise
**Warning signs:** Testing produces rep counts > 60 or < 5, users report exercises taking too long

### Pitfall 2: Latency-Only Scaling Ignores Base Rep Differences
**What goes wrong:** Applying same latency factor to all exercises makes push-ups scale from 15→23 but plank scales from 30→45 seconds, creating huge duration variance
**Why it happens:** Exercises have different base reps for duration reasons — scaling uniformly breaks pacing
**How to avoid:** Two-stage scaling respects base reps as anchor. Latency provides EXTRA reps, not replacement value. Test that min and max duration exercises both stay within 30-60 second execution window after scaling
**Warning signs:** Some exercises become multi-minute commitments, others stay trivial

### Pitfall 3: Continuous Multiplier Values Create Ambiguous Progression
**What goes wrong:** User runs `harder` multiple times, multiplier becomes 1.7342x, user has no idea what value they're at or how many steps to default
**Why it happens:** Allowing arbitrary increments (e.g., += 0.1) without bounds leads to floating point drift and loss of reference points
**How to avoid:** Discrete steps array with explicit values. Commands move index up/down, not arithmetic. Clamp to array bounds
**Warning signs:** Multiplier values don't round to clean decimals, users can't predict what "harder" will do

### Pitfall 4: Negative Latency Values or Null Handling
**What goes wrong:** `latencyMs` is null on first statusline call before API response, causing NaN in scaling math
**Why it happens:** Claude Code stdin JSON has `cost.total_api_duration_ms` as `null` before first API call
**How to avoid:** Default to 0 when extracting: `latencyMs = data?.cost?.total_api_duration_ms || 0`. Scale function treats 0 as "no latency bonus" (factor 1.0)
**Warning signs:** First exercise after Claude Code startup has NaN reps, crashes with type errors

### Pitfall 5: Storing Multiplier in State Instead of Config
**What goes wrong:** User sets difficulty to 2.0x, then edits pool.json, rotation resets and multiplier reverts to 1.0x
**Why it happens:** State resets on pool changes (double-hash detection), config persists across pool changes
**How to avoid:** Store multiplier in `configuration.json` alongside equipment, NOT in `state.json`. Treat difficulty as environment configuration like equipment availability
**Warning signs:** Multiplier resets after pool edits, user reports "difficulty keeps resetting"

## Code Examples

Verified patterns from research and existing codebase:

### Linear Interpolation (Lerp)
```javascript
// Source: https://www.trysmudford.com/blog/linear-interpolation-functions/
// Maps value from one range to another proportionally
function lerp(start, end, t) {
  return start + (end - start) * t;
}

// Example: Map latency (2000-30000ms) to scale factor (1.0-1.5)
const latencyMs = 15000; // 15 seconds
const t = (latencyMs - 2000) / (30000 - 2000); // Normalize to 0-1
const factor = lerp(1.0, 1.5, t); // 1.23 approx
```

### Number Clamping
```javascript
// Source: https://www.js-craft.io/blog/clamp-numbers-in-javascript/
// Restricts value to min-max range
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Example: Ensure rep count stays within practical bounds
const reps = clamp(scaledReps, 5, 60); // Never < 5 or > 60
```

### Latency Extraction from Statusline Stdin
```javascript
// Source: Existing statusline.js pattern + official Claude Code docs
// Safe extraction with fallback for null values
const data = parseStdin(stdinBuffer);
const latencyMs = data?.cost?.total_api_duration_ms || 0;

// latencyMs will be:
// - 0 if data is null or cost is null or field is null (before first API call)
// - Positive number (milliseconds) after API calls complete
```

### Difficulty Multiplier Commands
```javascript
// Source: Existing lib/cli/commands/config.js pattern
// harder.js
const { loadConfig, saveConfig, getConfigPath } = require('../../config');
const { DIFFICULTY_STEPS, incrementDifficulty } = require('../../difficulty');

function harderCommand() {
  const configPath = getConfigPath();
  const config = loadConfig(configPath);

  const currentMultiplier = config.difficulty?.multiplier || 1.0;
  const newMultiplier = incrementDifficulty(currentMultiplier);

  if (!config.difficulty) config.difficulty = {};
  config.difficulty.multiplier = newMultiplier;

  saveConfig(configPath, config);

  console.log(`Difficulty increased to ${newMultiplier}x`);
}

module.exports = { harderCommand };
```

### Engine Integration - Apply Scaling
```javascript
// Source: Existing engine.js trigger() function pattern
// engine.js - within trigger() after getNextExercise()

const { scaleRepsForLatency } = require('./lib/difficulty');
const config = loadConfig(configPath);
const multiplier = config.difficulty?.multiplier || 1.0;
const latencyMs = options.latencyMs || 0;

// Get exercise from rotation
const { exercise, previousIndex } = getNextExercise(state, actualPool);

// Apply difficulty scaling to reps
exercise.reps = scaleRepsForLatency(exercise.reps, latencyMs, multiplier);

// Continue with state update and formatting...
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed rep counts per exercise | Dynamic scaling based on context | Emerging in fitness apps 2024-2026 | Adapts workload to available time/intensity |
| Global difficulty slider (easy/medium/hard) | Discrete steps with clear progression | Game design pattern (established) | Users understand current level and steps to goal |
| Logarithmic scaling for smooth curves | Linear interpolation for predictability | Depends on domain | Linear is more predictable for users, sufficient for narrow ranges |
| Per-API-call latency tracking | Cumulative API duration (Claude Code statusline) | Claude Code statusline feature | Provides stable metric that grows throughout session |

**Deprecated/outdated:**
- **Random rep variations:** Old approach to "variety" — creates unpredictability, users can't build habits
- **Percentage-based scaling without bounds:** Multiplying by percentages without absolute clamps leads to extreme values
- **UI sliders for continuous values:** Gaming research shows discrete levels (Easy/Normal/Hard) are clearer than continuous sliders

## Open Questions

1. **Optimal latency-to-factor curve shape**
   - What we know: Linear interpolation is predictable and simple
   - What's unclear: Does logarithmic provide better "feel" for long waits? Does 30 seconds deserve 1.5x or 2.0x?
   - Recommendation: Start with linear 1.0x-1.5x, collect empirical data during use, adjust if users report "long waits still feel too easy"

2. **Multiplier step granularity**
   - What we know: Discrete steps (0.5x, 0.75x, 1.0x, 1.25x, 1.5x...) prevent floating point drift
   - What's unclear: Are 0.25x steps noticeable enough? Should it be 0.5x steps (bigger jumps)?
   - Recommendation: Start with 0.25x steps (9 total levels), users can provide feedback on whether jumps feel meaningful

3. **Absolute bounds selection**
   - What we know: 5-60 reps keeps exercises under ~60 seconds, work-environment safe
   - What's unclear: Should lower bound be 3 or 5? Should upper bound be 50 or 60?
   - Recommendation: Start with 5-60, conservative bounds. User feedback will reveal if lower bound feels "too easy" or upper bound "too hard"

4. **Latency reset behavior**
   - What we know: `cost.total_api_duration_ms` is cumulative across session
   - What's unclear: Should latency reset between exercises? Or continue accumulating throughout session?
   - Recommendation: Use cumulative value as-is (matches Claude Code API). If session gets very long (60+ minutes), latency will plateau and scaling stabilizes naturally

5. **Engine invocation in non-statusline contexts**
   - What we know: `vibripped test` (dry-run) doesn't have latency data
   - What's unclear: Should test command simulate latency? Use 0? Use average?
   - Recommendation: Pass `latencyMs: 0` in non-statusline contexts (test, direct CLI). Scaling function treats 0 as "minimum factor" (1.0x), so difficulty multiplier still applies

## Sources

### Primary (HIGH confidence)
- [Customize your status line - Claude Code Docs](https://code.claude.com/docs/en/statusline) - Official statusline API, JSON fields including cost.total_api_duration_ms
- Existing VibeRipped codebase (lib/config.js, lib/state.js, engine.js, statusline.js) - Established patterns for config persistence, state management, engine integration

### Secondary (MEDIUM confidence)
- [Linear Interpolation Functions - Trys Mudford](https://www.trysmudford.com/blog/linear-interpolation-functions/) - Standard lerp formula and range mapping
- [Introduction to Linear Interpolation and Linear Mapping](https://dobrian.github.io/cmp/topics/linear-mapping-and-interpolation/1.IntroductionToLinearInterpolation&LinearMapping.html) - Mathematical foundation for range mapping
- [Clamp numbers in JavaScript - JS Craft](https://www.js-craft.io/blog/clamp-numbers-in-javascript/) - Standard clamping pattern with Math.min/max
- [Design Guidelines for Input Steppers - Nielsen Norman Group](https://www.nngroup.com/articles/input-steppers/) - UX patterns for increment/decrement controls
- [Rep Ranges Based on Training Goals - Effective Fitness](https://www.effective.fitness/blog/repranges) - Practical rep count bounds for different goals
- [Understanding Rep Ranges in Your Workouts - PT Accelerate](https://ptaccelerate.com/understanding-rep-ranges-in-your-workouts/) - 5-60 rep range covers strength through endurance

### Tertiary (LOW confidence - general context)
- [Dynamic Game Difficulty Balancing - Wikipedia](https://en.wikipedia.org/wiki/Dynamic_game_difficulty_balancing) - General DDA concepts, not specific implementation
- [Difficulty Curves - Supersonic](https://supersonic.com/learn/blog/difficulty-curves/) - Game design principles for difficulty progression
- WebSearch results on adaptive difficulty algorithms - General gaming concepts, not fitness-specific
- WebSearch results on progressive overload - Fitness theory, but not specific to interrupt-driven micro-exercises

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses existing Node.js built-ins, no new dependencies, extends proven patterns from Phases 1-5
- Architecture: MEDIUM - Two-stage scaling pattern is sound, but optimal bounds/curves require empirical tuning
- Pitfalls: HIGH - Identified from code review (null handling, state vs config), math fundamentals (overflow, clamping), and gaming patterns (discrete steps)
- Latency data availability: HIGH - Claude Code official docs confirm `cost.total_api_duration_ms` field in statusline stdin
- Scaling formulas: HIGH - Linear interpolation and clamping are standard, well-documented techniques
- Rep bounds (5-60): MEDIUM - Based on fitness research but not validated for this specific interrupt-driven context

**Research date:** 2026-02-09
**Valid until:** ~30 days (stable domain — scaling math and Claude Code API unlikely to change rapidly)
