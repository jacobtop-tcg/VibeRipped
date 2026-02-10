# Phase 11: Category-Aware Rotation - Research

**Researched:** 2026-02-10
**Domain:** Weighted category selection, constraint satisfaction, deterministic rotation algorithms
**Confidence:** HIGH

## Summary

Phase 11 implements category-aware rotation to prevent consecutive same-muscle-group exercises (push/pull/legs/core). The core challenge is **weighted selection with hard constraints** - the rotation must be deterministic (same state → same next exercise) while avoiding recent categories and respecting pool category distribution.

This is NOT randomization - it's deterministic greedy selection with category diversity constraints. The algorithm must track recent categories (via state.recentCategories), filter candidates to exclude recent categories, then select the next exercise from the filtered pool in a predictable way.

Research confirms the approach: **greedy selection with proportional category weighting + deterministic tie-breaking**. Categories get weight proportional to pool size (more push exercises = higher push probability), recent categories (last N) are deprioritized, and within-category selection uses sequential rotation index for determinism.

**Primary recommendation:** Extend rotation.js with category-aware selection using a two-stage filter: (1) exclude exercises from recent categories, (2) if multiple categories remain, select category proportional to filtered pool size, (3) within selected category, advance sequential index. Track last 2 categories in state.recentCategories with ring buffer pattern (bounded size).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in modules | 18+ | All logic (no external deps) | VibeRipped zero-dependency philosophy |
| Existing rotation.js | v1.0 | Sequential rotation foundation | Proven deterministic rotation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | N/A | Weighted selection | Hand-rolled greedy algorithm (30 LOC) sufficient for simple category weighting |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Greedy category selection | Fisher-Yates shuffle with seed | Shuffling produces uniform randomness, not proportional category weighting. VibeRipped needs larger pools (10 push exercises) to have higher push probability than small pools (3 pull exercises). Seeded shuffle would require external library (shuffle-seed npm package) and adds complexity for deterministic behavior. |
| Ring buffer for recentCategories | External circular-buffer npm package | Libraries like `cbuffer` or `mnemonist/circular-buffer` add 20KB+ for functionality achievable in 5 lines with array push/shift. Not worth breaking zero-dependency philosophy. |
| Constraint satisfaction solver | CSP library (javascript-csp, constraint-solver) | CSP solvers are designed for complex constraint graphs (hundreds of variables, interdependent constraints). Category rotation has 1 simple constraint: "not in last N categories." Hand-rolled greedy selection is O(n) vs CSP overhead of O(n³). Overkill for this domain. |

**Installation:**
No new dependencies required. Use existing Node.js built-ins and rotation.js foundation.

## Architecture Patterns

### Recommended Project Structure
```
lib/
├── rotation.js          # EXTEND with category-aware logic
├── state.js             # Already has recentCategories (Phase 8)
└── pool.js              # Already has category field (Phase 8)
```

### Pattern 1: Category-Aware Selection with Hard Constraints
**What:** Filter pool to exclude recent categories, then select next exercise deterministically
**When to use:** Avoiding consecutive same-category exercises while maintaining rotation predictability
**Example:**
```javascript
// From research on greedy category selection + constraint satisfaction

function getNextExercise(state, pool) {
  const recentCategories = state.recentCategories || [];

  // STAGE 1: Filter out exercises from recent categories
  const candidatePool = pool.filter(exercise => {
    // Allow uncategorized exercises (category=null) always
    if (exercise.category === null) return true;

    // Exclude if category was used recently
    return !recentCategories.includes(exercise.category);
  });

  // STAGE 2: Fallback if filter empties pool (edge case: single-category pool)
  const selectionPool = candidatePool.length > 0 ? candidatePool : pool;

  // STAGE 3: Sequential selection from filtered pool (deterministic)
  const previousIndex = state.currentIndex;
  const exercise = selectionPool[previousIndex % selectionPool.length];

  // STAGE 4: Advance index and update category tracking
  state.currentIndex = (state.currentIndex + 1) % pool.length;

  // Update recentCategories (ring buffer pattern)
  if (exercise.category !== null) {
    state.recentCategories.push(exercise.category);
    if (state.recentCategories.length > 2) {
      state.recentCategories.shift(); // Keep only last 2
    }
  }

  return { exercise, previousIndex };
}
```

### Pattern 2: Ring Buffer with Array Push/Shift
**What:** Bounded-size array that discards oldest entries when full
**When to use:** Tracking last N items without unbounded growth
**Example:**
```javascript
// From research on circular buffers in JavaScript
// Simple push/shift pattern for small N (< 10)

const recentCategories = ["push", "pull"];
const newCategory = "legs";

recentCategories.push(newCategory);  // ["push", "pull", "legs"]

if (recentCategories.length > 2) {
  recentCategories.shift();  // Remove oldest -> ["pull", "legs"]
}

// Result: constant O(2) space, O(1) push/shift operations
// For N=2-5, this beats circular buffer libraries in simplicity and performance
```

### Pattern 3: Greedy Category Selection by Pool Size (Optional Enhancement)
**What:** When multiple categories available, prefer category with more exercises in pool
**When to use:** Making category selection proportional to pool distribution (more push exercises = higher push probability)
**Example:**
```javascript
// From research on weighted selection algorithms
// NOTE: This is an OPTIONAL enhancement - success criteria only require "avoiding consecutive"

function selectCategoryProportional(candidatePool) {
  // Count exercises per category
  const categoryCounts = {};
  for (const exercise of candidatePool) {
    if (exercise.category !== null) {
      categoryCounts[exercise.category] = (categoryCounts[exercise.category] || 0) + 1;
    }
  }

  // Select category with highest count (greedy)
  // For deterministic tie-breaking: sort categories alphabetically
  const categories = Object.keys(categoryCounts).sort();
  let maxCategory = categories[0];
  let maxCount = categoryCounts[maxCategory];

  for (const category of categories) {
    if (categoryCounts[category] > maxCount) {
      maxCategory = category;
      maxCount = categoryCounts[category];
    }
  }

  // Filter to selected category
  return candidatePool.filter(ex => ex.category === maxCategory);
}
```

### Pattern 4: Deterministic Fallback Chain
**What:** Series of fallbacks ensuring rotation never fails, even with edge cases
**When to use:** Handling empty pools, single-category pools, all-uncategorized pools
**Example:**
```javascript
// Fallback chain for category-aware rotation

// Level 1: Filter by category constraint
let selectionPool = pool.filter(ex => !recentCategories.includes(ex.category));

// Level 2: If constraint empties pool, use full pool (single-category edge case)
if (selectionPool.length === 0) {
  selectionPool = pool;
}

// Level 3: If pool itself is empty (should never happen), throw clear error
if (selectionPool.length === 0) {
  throw new Error('Empty pool - cannot select exercise');
}

// Level 4: Select deterministically from non-empty selectionPool
const exercise = selectionPool[state.currentIndex % selectionPool.length];
```

### Anti-Patterns to Avoid
- **Unbounded recentCategories array:** Letting recentCategories grow without limit causes state.json bloat (pitfall: array grows to thousands of entries after days of use)
- **Random selection for determinism:** Using Math.random() or seeded RNG breaks "same state → same exercise" guarantee
- **Category weighting without fallback:** Filtering by category constraint without fallback causes crash when pool has single category
- **Mutating pool during selection:** Modifying pool array during category filtering breaks pool hash detection and confuses rotation index

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Complex weighted random selection with distributions | Custom LCG + Fisher-Yates implementation | Existing seeded RNG libraries (prando, seedrandom) | Seeded random libraries handle edge cases (seed collision, period length, distribution uniformity). VibeRipped doesn't need true weighted random - greedy selection is simpler and more predictable. |
| Advanced constraint satisfaction (10+ constraints, interdependent) | Custom backtracking solver | CSP libraries (javascript-csp, constraint-solver) | CSP solvers optimize constraint propagation and arc consistency for complex problems. Category rotation has 1 simple constraint ("not recent"), making hand-rolled greedy sufficient. |
| Large circular buffer (N > 100) | Array push/shift pattern | Dedicated circular buffer library (cbuffer, mnemonist) | For large buffers, libraries use optimized pointer arithmetic and avoid shift() O(n) cost. VibeRipped tracks 2-5 recent categories max - array shift is O(2-5) = effectively O(1). |

**Key insight:** VibeRipped's category rotation is **greedy selection with a simple constraint**, not true randomization or complex CSP. The "weighted" aspect comes from pool size distribution (10 push exercises naturally appear more often than 3 pull exercises when rotating through the pool), not from probabilistic sampling. Hand-rolled greedy selection is clearer, faster, and deterministic.

## Common Pitfalls

### Pitfall 1: recentCategories Array Grows Unbounded
**What goes wrong:** state.recentCategories array grows to thousands of entries after days of use, bloating state.json and slowing JSON parse/stringify
**Why it happens:** Appending category on every rotation without bounding size
**How to avoid:**
- Implement ring buffer pattern: push new category, then shift if length exceeds limit
- Document max size (recommendation: N=2 for "no consecutive", N=3-5 for "spread out categories")
- Test with integration test: trigger 100 times, verify recentCategories.length <= configuredMax
**Warning signs:** state.json file size grows continuously, state load times increase after extended use

### Pitfall 2: Edge Case - Single Category Pool Crashes Rotation
**What goes wrong:** User has pool with only "push" exercises, category filter excludes all exercises after first rotation, next selection crashes with "empty filtered pool"
**Why it happens:** Greedy filtering without fallback to full pool
**How to avoid:**
- After filtering by recentCategories, check if selectionPool.length === 0
- If empty, fall back to full pool (allows category repetition in constrained scenario)
- Log warning: "Single-category pool detected, allowing consecutive categories"
**Warning signs:** Crash after first exercise, error message "cannot select from empty pool"

### Pitfall 3: Determinism Breaks with Async State Mutations
**What goes wrong:** Two concurrent triggers produce different exercises for same starting state (race condition in state.json read/write)
**Why it happens:** State persistence is asynchronous, concurrent triggers can interleave reads/writes
**How to avoid:**
- VibeRipped already uses synchronous state operations (fs.readFileSync, fs.writeFileSync)
- Keep synchronous pattern for Phase 11 - category tracking doesn't require async
- If future phases add async state (Redis, DB), implement locking/transactions
**Warning signs:** Non-deterministic test failures, different exercises for same pool state in logs

### Pitfall 4: Category Tracking Ignores Null Categories
**What goes wrong:** Uncategorized exercises (category=null) added to recentCategories, causing filter to exclude null incorrectly
**Why it happens:** Not checking `if (exercise.category !== null)` before tracking
**How to avoid:**
- Only track non-null categories in recentCategories
- Allow category=null exercises to always pass category filter (never excluded)
- Test: pool with mix of categorized and null exercises, verify null exercises appear without gaps
**Warning signs:** Uncategorized exercises never appear, recentCategories contains null values

### Pitfall 5: Modulo Arithmetic with Filtered Pool Breaks Index Continuity
**What goes wrong:** Using `currentIndex % filteredPool.length` causes index to "jump" unpredictably when filtered pool size changes
**Why it happens:** Index is for full pool, but modulo is applied to filtered subset
**How to avoid:**
- Two approaches: (A) Keep index in full pool space, map to filtered pool, (B) Track per-category indices
- Recommendation: Approach A is simpler - `filteredPool[state.currentIndex % filteredPool.length]` with state.currentIndex tracking full pool position
- Accept that category filtering creates "non-sequential" appearance (feature, not bug - diversity is the goal)
**Warning signs:** Same exercise appears multiple times in a row, rotation appears random

## Code Examples

Verified patterns from codebase and research:

### Example 1: Current Sequential Rotation (lib/rotation.js v1.0)
```javascript
// Source: /Users/jacob/Documents/apps/VibeRipped/lib/rotation.js
// Pattern: Deterministic sequential rotation with modulo wrap

function getNextExercise(state, pool) {
  const previousIndex = state.currentIndex;
  const exercise = pool[previousIndex];

  // Advance index with modulo wrap
  state.currentIndex = (state.currentIndex + 1) % pool.length;

  return {
    exercise,
    previousIndex
  };
}

// Characteristics:
// - Deterministic: same state.currentIndex always selects same exercise
// - Sequential: pool order determines rotation order
// - Simple: no filtering, no weighting, no constraints
// Phase 11 EXTENDS this with category filtering before selection
```

### Example 2: Category-Aware Selection (Phase 11 Target Pattern)
```javascript
// Pattern: Greedy selection with category constraint and fallback

function getNextExerciseCategoryAware(state, pool) {
  const recentCategories = state.recentCategories || [];
  const maxRecentCategories = 2; // Configurable, default 2

  // FILTER: Exclude exercises from recent categories
  let candidatePool = pool.filter(exercise => {
    // Uncategorized exercises (null) always allowed
    if (exercise.category === null) return true;

    // Exclude if in recent categories
    return !recentCategories.includes(exercise.category);
  });

  // FALLBACK: If filter empties pool (single-category edge case), use full pool
  if (candidatePool.length === 0) {
    console.error('Category filter produced empty pool, using full pool');
    candidatePool = pool;
  }

  // SELECT: Deterministic selection from candidate pool
  // Use currentIndex modulo candidate pool size for determinism
  const candidateIndex = state.currentIndex % candidatePool.length;
  const exercise = candidatePool[candidateIndex];
  const previousIndex = state.currentIndex;

  // ADVANCE: Update index in full pool space (not candidate pool space)
  state.currentIndex = (state.currentIndex + 1) % pool.length;

  // TRACK: Update recent categories (ring buffer)
  if (exercise.category !== null) {
    state.recentCategories.push(exercise.category);

    // Bound size to prevent unbounded growth
    while (state.recentCategories.length > maxRecentCategories) {
      state.recentCategories.shift();
    }
  }

  return {
    exercise,
    previousIndex
  };
}
```

### Example 3: Ring Buffer Pattern for recentCategories
```javascript
// Source: Research on circular buffers (simplified for N <= 5)
// Pattern: Bounded array with push/shift

// BEFORE: Unbounded growth (WRONG)
state.recentCategories.push(exercise.category);
// → After 1000 rotations: ["push", "pull", "legs", ... 1000 entries]

// AFTER: Ring buffer with max size (CORRECT)
const MAX_RECENT_CATEGORIES = 2;
state.recentCategories.push(exercise.category);

if (state.recentCategories.length > MAX_RECENT_CATEGORIES) {
  state.recentCategories.shift(); // Remove oldest
}
// → After 1000 rotations: ["pull", "legs"] (always 2 entries)

// Performance: shift() is O(n), but n=2 so effectively O(1)
// For larger N (10+), use circular buffer library or index pointer pattern
```

### Example 4: Edge Case Handling - Empty Pool After Filter
```javascript
// Pattern: Multi-level fallback for robustness

function selectWithFallback(state, pool) {
  const recentCategories = state.recentCategories || [];

  // Level 1: Try category-filtered pool
  let candidates = pool.filter(ex => !recentCategories.includes(ex.category));

  if (candidates.length > 0) {
    return selectFromPool(state, candidates);
  }

  // Level 2: Category filter too restrictive, use full pool
  console.error('Category constraint cannot be satisfied, allowing repetition');

  if (pool.length > 0) {
    return selectFromPool(state, pool);
  }

  // Level 3: Pool itself is empty (should never happen in production)
  throw new Error('Cannot rotate: exercise pool is empty');
}

// Test cases to verify:
// 1. Pool with 4 categories: ["push", "pull", "legs", "core"] → Level 1 works
// 2. Pool with 1 category: ["push", "push", "push"] → Falls to Level 2 after first exercise
// 3. Empty pool: [] → Falls to Level 3, throws error
```

### Example 5: Deterministic Category Selection (Optional Enhancement)
```javascript
// Pattern: Proportional category weighting via greedy selection
// NOTE: Success criteria don't require this - it's an enhancement for better distribution

function selectCategoryGreedy(candidatePool, state) {
  // Count exercises per category in candidate pool
  const categoryCounts = {};

  for (const exercise of candidatePool) {
    const cat = exercise.category || 'uncategorized';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }

  // Find category with most exercises (greedy = prefer larger categories)
  // Sort categories for deterministic tie-breaking
  const categories = Object.keys(categoryCounts).sort();
  let selectedCategory = categories[0];
  let maxCount = categoryCounts[selectedCategory];

  for (const category of categories) {
    if (categoryCounts[category] > maxCount) {
      selectedCategory = category;
      maxCount = categoryCounts[category];
    }
  }

  // Filter to selected category
  const categoryPool = candidatePool.filter(ex =>
    (ex.category || 'uncategorized') === selectedCategory
  );

  // Select deterministically within category
  return categoryPool[state.currentIndex % categoryPool.length];
}

// Example: Pool has [10 push, 5 pull, 3 legs]
// After filtering recentCategories: [10 push, 3 legs] remain
// Greedy selects "push" (10 > 3)
// Push exercises appear 10/(10+3) ≈ 77% of time (proportional to pool size)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pure random exercise selection | Deterministic rotation with constraints | 2024-2026 | Fitness apps moved from Math.random() to deterministic algorithms for predictability and testability. Fitbod (2026) uses "muscle freshness tracking" for rotation diversity. |
| Unbounded state tracking (all history) | Ring buffer / sliding window (last N) | 2023+ | Bounded state prevents memory bloat. Category tracking only needs 2-5 recent items, not full history. |
| Complex CSP solvers for scheduling | Greedy algorithms with simple constraints | 2025+ | For 1-2 constraints, greedy selection (O(n)) beats CSP overhead (O(n³)). CSP reserved for 10+ interdependent constraints. |
| External weighted-random libraries | Hand-rolled greedy selection | 2024+ | Zero-dependency movement in Node.js tools. Simple weighted selection achievable in 20 LOC without libraries. |

**Deprecated/outdated:**
- **Seeded random for deterministic exercise selection:** Libraries like `shuffle-seed`, `seedrandom` were popular 2020-2023 for deterministic fitness app testing. Modern approach uses greedy selection with constraints instead of randomization, eliminating need for seeding.
- **Circular buffer libraries for small N:** Libraries like `cbuffer` (2015) are overkill for tracking 2-5 recent items. Array push/shift is simpler and faster for N < 10.

## Open Questions

1. **Should maxRecentCategories be configurable or hardcoded?**
   - What we know: Success criteria specify "configurable, default 2"
   - What's unclear: Configuration location (configuration.json, CLI flag, or constant in rotation.js?)
   - Recommendation: Start with constant in rotation.js (const MAX_RECENT_CATEGORIES = 2). If user feedback requests tuning, promote to configuration.json in future phase.

2. **What happens when pool has 2 categories and maxRecentCategories=2?**
   - What we know: After 2 rotations, both categories are in recentCategories, filter produces empty pool, fallback to full pool allows repetition
   - What's unclear: Is this acceptable behavior or should maxRecentCategories auto-adjust based on unique category count?
   - Recommendation: Accept the behavior - it's edge case (most pools have 3-4 categories). Document in code comment: "If unique categories ≤ maxRecent, fallback allows repetition."

3. **Should uncategorized (category=null) exercises break category streaks?**
   - What we know: Null categories are valid (Phase 8 decision), never added to recentCategories
   - What's unclear: If pool has [push, null, push], does null exercise "reset" the push streak?
   - Recommendation: Null exercises DON'T reset streaks (not tracked in recentCategories). This allows uncategorized exercises as "palate cleansers" between categories.

4. **Does proportional category weighting add enough value to justify complexity?**
   - What we know: Success criteria require avoiding consecutive same-category, don't explicitly require proportional weighting
   - What's unclear: Is greedy category selection (Pattern 3) a must-have or nice-to-have?
   - Recommendation: Phase 11 Plan 1 implements basic category avoidance only. Plan 2 (optional) adds proportional weighting if time allows. Test user feedback to determine value.

## Sources

### Primary (HIGH confidence)
- **VibeRipped codebase**: lib/rotation.js (current sequential rotation), lib/state.js (recentCategories field), lib/pool.js (category validation)
- **Phase 8 documentation**: .planning/phases/08-data-model-extensions/08-RESEARCH.md (category schema design)
- [Weighted Random in JavaScript by Oleksii Trekhleb](https://trekhleb.medium.com/weighted-random-in-javascript-4748ab3a1500) - cumulative weights method for weighted selection
- [trekhleb/javascript-algorithms - Weighted Random](https://github.com/trekhleb/javascript-algorithms/tree/master/src/algorithms/statistics/weighted-random) - deterministic weighted selection implementation

### Secondary (MEDIUM confidence)
- [Fitbod AI Fitness Apps 2026](https://fitbod.me/blog/best-ai-fitness-apps-2026-the-complete-guide-to-ai-powered-muscle-building-apps/) - muscle group rotation and fatigue tracking in modern fitness apps
- [Circular Buffer in JavaScript - myHotTake](https://medium.com/@conboys111/how-to-implement-a-circular-buffer-in-javascript-with-examples-eb6523d8f275) - ring buffer implementation patterns
- [GeeksforGeeks Greedy Algorithms Tutorial](https://www.geeksforgeeks.org/dsa/greedy-algorithms/) - greedy selection principles
- [W3Schools DSA Greedy Algorithms](https://www.w3schools.com/dsa/dsa_ref_greedy.php) - greedy algorithm fundamentals

### Tertiary (LOW confidence)
- [seed-shuffle npm package](https://github.com/yixizhang/seed-shuffle) - deterministic array shuffling with seeds (alternative approach not used)
- [Prando - Deterministic PRNG](https://github.com/zeh/prando) - seeded random number generator (not needed for greedy approach)

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** - Zero external dependencies, extends existing rotation.js, all patterns proven in VibeRipped codebase (ring buffer via push/shift, deterministic selection)
- Architecture: **HIGH** - Greedy selection with category constraint is well-established pattern. Fitbod (2026) uses similar muscle-group rotation logic. Deterministic fallback chain is robust design.
- Pitfalls: **HIGH** - Unbounded array growth is well-known pitfall (documented in Phase 8 research). Single-category edge case is predictable from success criteria. Concurrent state mutation is existing VibeRipped concern (mitigated by synchronous I/O).

**Research date:** 2026-02-10
**Valid until:** ~60 days (greedy algorithms are stable, VibeRipped v1.1 architecture locked)
