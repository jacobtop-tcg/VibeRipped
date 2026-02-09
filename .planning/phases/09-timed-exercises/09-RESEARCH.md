# Phase 9: Timed Exercises - Research

**Researched:** 2026-02-09
**Domain:** Exercise type differentiation, duration display formatting, backward compatibility
**Confidence:** HIGH

## Summary

Phase 9 implements duration-based exercise display for exercises where time is the measure (planks, wall sits, dead hangs) rather than rep counts. The core challenge is distinguishing display formatting ("Plank 30s") from internal representation while maintaining v1.0 backward compatibility.

Phase 8 already established the foundation: exercises have `type: "timed"` vs `type: "reps"` fields, and timed exercises store duration in the `reps` field for v1.0 backward compatibility. Phase 9 extends this by adding an optional `duration` field and updating display logic to detect exercise type and format appropriately.

The implementation is straightforward: add optional `duration` field to schema, update formatExercise to accept exercise type, and propagate type information through the display pipeline. No external dependencies needed - pure data flow change.

**Primary recommendation:** Add optional `duration` field (Phase 9 can coexist with `reps`-only exercises), update formatExercise signature to accept type parameter, propagate exercise type through engine → statusline → format pipeline, scale duration with same latency factor as reps (capped at 1.5x).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `fs` | 18+ | Config/state I/O | Already used, zero deps |
| `write-file-atomic` | ^7.0.0 | Atomic writes | Already used, prevents corruption |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | N/A | Type-based formatting | Conditional logic simpler than library |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled formatting | [humanize-duration](https://www.npmjs.com/package/humanize-duration) | Adds 50KB+ dependency for simple "30s" formatting. Overkill for seconds-only display. |
| Hand-rolled formatting | [pretty-ms](https://www.npmjs.com/package/pretty-ms) | ESM-only module, would require `import()` or migration to ESM. Not worth it for single-character suffix. |

**Installation:**
No new dependencies required. Use existing Node.js built-ins.

## Architecture Patterns

### Recommended Project Structure
No new files required. Changes confined to existing modules:
```
lib/
├── pool.js              # Add duration field to validateExercise
├── statusline/
│   └── format.js        # Update formatExercise for type-based display
├── difficulty.js        # (No changes - scales duration same as reps)
└── engine.js            # (No changes - already passes exercise object)

statusline.js            # Update to pass exercise type to formatExercise
```

### Pattern 1: Optional Duration Field (Backward Compatibility)
**What:** Add `duration` field as optional, preserve `reps` field for v1.0 compatibility
**When to use:** Schema evolution where old and new versions must coexist
**Example:**
```javascript
// v1.1 timed exercise (current state)
{
  name: "Plank",
  reps: 30,                // v1.0 compat - still works as duration
  category: "core",
  type: "timed",
  environments: ["anywhere"]
}

// v1.2 timed exercise (Phase 9 target)
{
  name: "Plank",
  reps: 30,                // KEEP for v1.0/v1.1 compat
  duration: 30,            // NEW - explicit duration field (optional)
  category: "core",
  type: "timed",
  environments: ["anywhere"]
}

// Reading logic priority (Phase 9)
const value = exercise.type === 'timed'
  ? (exercise.duration ?? exercise.reps)  // Use duration if present, fall back to reps
  : exercise.reps;
```

### Pattern 2: Type-Based Display Formatting
**What:** Conditional formatting based on exercise.type field
**When to use:** Single function needs different output formats based on data property
**Example:**
```javascript
// Current signature (Phase 8)
function formatExercise(name, reps, options = {}) {
  return `${prefix}${name} x${reps}`;  // Always "x" prefix
}

// Phase 9 signature (type-aware)
function formatExercise(name, value, type, options = {}) {
  const suffix = type === 'timed' ? 's' : `x${value}`;
  return `${prefix}${name} ${value}${suffix}`;
}

// Usage
formatExercise('Pushups', 15, 'reps')  // "Pushups x15"
formatExercise('Plank', 30, 'timed')   // "Plank 30s"
```

### Pattern 3: Exercise Object Propagation
**What:** Pass entire exercise object through pipeline instead of primitives
**When to use:** Multiple properties needed downstream, simpler than expanding parameter lists
**Example:**
```javascript
// engine.js already returns full exercise object
return {
  type: 'exercise',
  exercise: { name, reps, type, duration, category, ... },
  // ...
};

// statusline.js can extract all needed properties
const { name, reps, duration, type } = result.exercise;
const value = type === 'timed' ? (duration ?? reps) : reps;
formatExercise(name, value, type);
```

### Anti-Patterns to Avoid
- **String suffix detection:** Don't parse `"Plank 30s"` string to determine type - store type in data
- **Global type registry:** Don't maintain map of exercise names to types - each exercise carries its own type
- **Breaking reps field:** Don't remove reps from timed exercises - v1.0/v1.1 still need it

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Duration parsing | Custom "30s" → 30 parser | Store as number | No need for string parsing if storage is numeric |
| Complex time formatting | "30s", "2m 30s", "1h 30m" logic | Keep seconds-only | All VibeRipped exercises are <60s, complexity unneeded |
| Type inference from name | Map "plank" → timed | Exercise type field | Name-based inference brittle (what about "Plank jacks"?) |

**Key insight:** Seconds-only display is simple enough that custom formatting libraries add complexity without benefit.

## Common Pitfalls

### Pitfall 1: Mutating Scaled Values Back Into Pool
**What goes wrong:** Difficulty scaling mutates exercise.reps, corrupting pool for next rotation
**Why it happens:** JavaScript passes objects by reference - modifying exercise modifies pool entry
**How to avoid:** Clone exercise before scaling (already implemented in engine.js line 210)
**Warning signs:** Tests show escalating rep counts, pool.json values increase after triggers
**Verification:**
```javascript
// engine.js line 210 - ALREADY CORRECT
const exercise = { ...rawExercise };  // Clone before scaling
exercise.reps = scaleRepsForLatency(...);  // Safe - mutates clone, not pool
```

### Pitfall 2: Inconsistent Duration Scaling
**What goes wrong:** Reps scale with latency (1.0-1.5x) but durations don't, creating UX inconsistency
**Why it happens:** Forgetting that "30 seconds" is a rep count, just with different units
**How to avoid:** Treat duration as reps in difficulty.js - same scaling logic applies
**Warning signs:** User reports "pushups increase with latency but planks stay the same"
**Implementation:**
```javascript
// difficulty.js - NO CHANGES NEEDED
// scaleRepsForLatency already handles timed exercises correctly
// Duration stored in reps field, so scaling just works

// engine.js - ALREADY CORRECT (line 216)
exercise.reps = scaleRepsForLatency(exercise.reps, latencyMs, multiplier);
// This scales duration for timed exercises since duration === reps
```

### Pitfall 3: Breaking v1.0 Pool.json Compatibility
**What goes wrong:** v1.0 users with hand-edited pool.json files lose exercises on v1.2 upgrade
**Why it happens:** Validation rejects exercises without duration field
**How to avoid:** Make duration optional, fall back to reps when missing
**Warning signs:** Validation errors on previously valid pool.json files
**Implementation:**
```javascript
// validateExercise in pool.js
// Optional: duration (positive integer, only for timed exercises)
if (exercise.duration !== undefined) {
  if (!Number.isInteger(exercise.duration) || exercise.duration <= 0) {
    return false;
  }
}
// Still accepts exercises without duration field
```

### Pitfall 4: Type Information Loss in Display Pipeline
**What goes wrong:** formatExercise receives `(name, reps)` but can't determine if it's timed
**Why it happens:** Passing primitives instead of exercise object loses type metadata
**How to avoid:** Pass exercise type as third parameter to formatExercise
**Warning signs:** All exercises show "x" prefix regardless of type
**Implementation:**
```javascript
// statusline.js (line 67, 75)
// BEFORE: formatExercise(result.exercise.name, result.exercise.reps)
// AFTER:  formatExercise(result.exercise.name, value, result.exercise.type)

// Where value = type === 'timed' ? (duration ?? reps) : reps
```

## Code Examples

Verified patterns from existing codebase:

### Exercise Cloning Before Mutation
```javascript
// Source: engine.js:210
// Context: Prevents pool corruption from difficulty scaling
const { exercise: rawExercise, previousIndex } = getNextExercise(state, actualPool);

// Clone exercise before scaling to avoid mutating pool
const exercise = { ...rawExercise };

// Apply difficulty scaling (safe - mutates clone only)
const multiplier = config.difficulty?.multiplier || 1.0;
const latencyMs = options.latencyMs || 0;
exercise.reps = scaleRepsForLatency(exercise.reps, latencyMs, multiplier);
```

### Type-Based Value Extraction
```javascript
// Recommended pattern for Phase 9
function getExerciseValue(exercise) {
  if (exercise.type === 'timed') {
    // Prefer explicit duration, fall back to reps for v1.0/v1.1 compat
    return exercise.duration ?? exercise.reps;
  }
  // Rep-based exercises always use reps
  return exercise.reps;
}

// Usage in statusline.js
const value = getExerciseValue(result.exercise);
const formatted = formatExercise(
  result.exercise.name,
  value,
  result.exercise.type
);
```

### Duration Validation (Optional Field)
```javascript
// Source: Extend lib/pool.js validateExercise (lines 176-231)
function validateExercise(exercise) {
  // ... existing validation ...

  // Optional: duration (positive integer, only validated if present)
  if (exercise.duration !== undefined) {
    if (!Number.isInteger(exercise.duration) || exercise.duration <= 0) {
      return false;
    }
  }

  return true;
}
```

### Type-Aware Formatting
```javascript
// Source: Extend lib/statusline/format.js (lines 14-24)
function formatExercise(name, value, type = 'reps', options = {}) {
  if (!name) return '';

  const prefix = options.prefix || '';

  // No value provided - name only
  if (value === undefined || value === null) {
    return `${ANSI.cyan}${ANSI.bold}${prefix}${name}${ANSI.reset}`;
  }

  // Type-based suffix
  const suffix = type === 'timed' ? 's' : `x${value}`;

  return `${ANSI.cyan}${ANSI.bold}${prefix}${name} ${value}${suffix}${ANSI.reset}`;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Comments in pool explaining "reps = seconds" | Explicit type field | Phase 8 (v1.1) | Type is machine-readable metadata, enables conditional formatting |
| Single display format "x{value}" | Type-aware "x{reps}" vs "{duration}s" | Phase 9 (v1.2) | Clearer UX for duration exercises |
| Hand-rolled validation | validateExercise function | Phase 8 (v1.1) | Centralized validation, easier to extend |

**Deprecated/outdated:**
- None - Phase 8 (2026-02-09) established current patterns, still fresh

## Open Questions

1. **Should duration field auto-populate from reps on pool load?**
   - What we know: Current FULL_EXERCISE_DATABASE stores duration in reps field only
   - What's unclear: Should migration auto-create duration field for type=timed exercises?
   - Recommendation: No auto-population. Let duration remain optional. Reading logic falls back to reps if duration missing. Simpler, less migration risk.

2. **Should duration and reps diverge for timed exercises?**
   - What we know: reps field preserved for v1.0 compatibility
   - What's unclear: Is it valid for exercise to have duration=30 but reps=15 (different values)?
   - Recommendation: No - duration and reps should stay in sync for timed exercises. Pick one source of truth based on precedence (duration ?? reps). User editing pool.json should update both for consistency.

3. **Do timed exercises scale duration with latency factor capped at 1.5x?**
   - What we know: Phase 6 implemented latency scaling (1.0-1.5x) for engagement during long waits
   - What's unclear: Should 30s plank become 45s plank at max latency, or stay fixed at 30s?
   - Recommendation: YES - scale duration same as reps. Consistency matters. Long wait = more workout makes sense. Use same scaleRepsForLatency function, same [5-60] bounds.

## Sources

### Primary (HIGH confidence)
- VibeRipped codebase - lib/pool.js (exercise schema, validateExercise pattern)
- VibeRipped codebase - lib/difficulty.js (scaling logic, rep bounds)
- VibeRipped codebase - lib/statusline/format.js (display formatting)
- VibeRipped codebase - engine.js (exercise cloning pattern line 210)
- Phase 8 RESEARCH.md - Schema extension patterns (additive-only, optional fields)
- Phase 8 SUMMARY.md - Current v1.1 schema state (type field, VALID_TYPES)

### Secondary (MEDIUM confidence)
- None required - domain is project-specific data formatting

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No external dependencies, pure data flow changes
- Architecture: HIGH - Extends Phase 8 patterns (additive schema, optional fields)
- Pitfalls: HIGH - Identified from existing codebase patterns (cloning, validation)

**Research date:** 2026-02-09
**Valid until:** 2026-03-11 (30 days - stable domain, no external dependencies)
