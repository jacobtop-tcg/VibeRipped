/**
 * VibeRipped Rotation Engine
 *
 * Main entry point orchestrating rotation, cooldown, state, and output.
 * Transforms triggers into exercise prompts with zero friction.
 */

const fs = require('fs');
const path = require('path');
const writeFileAtomic = require('write-file-atomic');
const { DEFAULT_POOL, assemblePool, computePoolHash } = require('./lib/pool');
const { loadState, saveState, createDefaultState } = require('./lib/state');
const { getNextExercise } = require('./lib/rotation');
const { checkCooldown, formatRemaining, COOLDOWN_MS } = require('./lib/cooldown');
const { loadConfig, getConfigPath } = require('./lib/config');
const { scaleRepsForLatency } = require('./lib/difficulty');
const { migrateConfigIfNeeded, migratePoolIfNeeded, migrateStateIfNeeded } = require('./lib/migration');

/**
 * Formats exercise as crisp command prompt.
 *
 * Format: "{name} x{reps}" for reps, "{name} {reps}s" for timed
 * Examples: "Pushups x15", "Wall sit 30s"
 *
 * Zero motivational language, zero optionality, zero explanation.
 *
 * @param {{name: string, reps: number, type?: string}} exercise - Exercise object
 * @returns {string} Crisp command string
 */
function formatPrompt(exercise) {
  if (exercise.type === 'timed') {
    return `${exercise.name} ${exercise.reps}s`;
  }
  return `${exercise.name} x${exercise.reps}`;
}

/**
 * Triggers the rotation engine.
 *
 * Flow (config-driven mode when pool = null):
 * 1. Determine file paths (configPath, poolPath, statePath)
 * 2. Load configuration from configuration.json (fail-safe to bodyweight-only)
 * 3. Assemble pool from config equipment flags
 * 4. Check if pool.json needs regeneration (config changed)
 * 5. If config unchanged: load pool.json (preserves user edits)
 * 6. If config changed or pool.json missing: write new pool.json, reset rotation
 * 7. Load state, check cooldown
 * 8. Get next exercise, update state, save state
 * 9. Return exercise response
 *
 * Legacy mode (pool explicitly provided):
 * - Uses provided pool directly, no config/pool.json logic
 * - Maintains backward compatibility with Phase 1 tests
 *
 * @param {Array<{name: string, reps: number}>|null} [pool=null] - Exercise pool (null = config-driven)
 * @param {Object} [options={}] - Options
 * @param {string} [options.statePath] - Override state path for testing
 * @param {boolean} [options.bypassCooldown] - Bypass cooldown check (for testing rotation)
 * @param {boolean} [options.dryRun] - Preview mode: skip state persistence
 * @param {number} [options.latencyMs] - API latency in milliseconds (for difficulty scaling)
 * @returns {Object} Exercise response or cooldown response
 */
function trigger(pool = null, options = {}) {
  // Determine state path
  const statePath = options.statePath || require('./lib/state').getStatePath();
  const configDir = path.dirname(statePath);
  const configPath = path.join(configDir, 'configuration.json');
  const poolPath = path.join(configDir, 'pool.json');

  // Determine pool to use
  let actualPool;
  let configPoolHash = null;

  if (pool === null) {
    // Config-driven mode: load config, assemble pool, handle pool.json persistence

    // Migrate v1.0 files to v1.1 schema on first launch
    migrateConfigIfNeeded(configPath);
    migratePoolIfNeeded(poolPath);
    migrateStateIfNeeded(statePath);

    const config = loadConfig(configPath);
    // Assemble pool with equipment filtering ONLY (no environment filter for pool.json)
    const assembledPool = assemblePool(config);
    const assembledHash = computePoolHash(assembledPool);
    configPoolHash = assembledHash;

    // Try to load existing pool.json and check if config changed
    let shouldRegeneratePool = true;
    let existingState = null;

    try {
      const stateContent = fs.readFileSync(statePath, 'utf8');
      existingState = JSON.parse(stateContent);

      // If state has configPoolHash and it matches current assembled hash, config unchanged
      if (existingState.configPoolHash === assembledHash) {
        // Config unchanged - try to load pool.json (preserves user edits)
        try {
          const poolContent = fs.readFileSync(poolPath, 'utf8');
          const loadedPool = JSON.parse(poolContent);

          // Validate pool is an array
          if (Array.isArray(loadedPool) && loadedPool.length > 0) {
            actualPool = loadedPool;
            shouldRegeneratePool = false;
          }
        } catch (e) {
          // pool.json missing or invalid - will regenerate
          console.error(`Pool.json load error: ${e.message}, regenerating`);
        }
      }
    } catch (e) {
      // State doesn't exist or is corrupt - will regenerate pool
    }

    if (shouldRegeneratePool) {
      // Config changed or pool.json missing - regenerate pool.json
      actualPool = assembledPool;

      try {
        // Create directory if needed
        fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });

        // Write pool.json with pretty-printing for human readability
        writeFileAtomic.sync(poolPath, JSON.stringify(assembledPool, null, 2), { mode: 0o600 });
      } catch (e) {
        console.error(`Pool.json write error: ${e.message}`);
      }
    }
  } else {
    // Legacy mode: explicit pool provided (Phase 1 backward compatibility)
    actualPool = pool;
  }

  // Apply runtime environment filtering (config-driven mode only)
  if (pool === null) {
    const config = loadConfig(configPath);
    const environment = config.environment || 'anywhere';

    // Filter actualPool by environment
    const envFiltered = actualPool.filter(exercise => {
      const exerciseEnvs = exercise.environments || ['anywhere'];
      return exerciseEnvs.includes('anywhere') || exerciseEnvs.includes(environment);
    });

    // Use filtered pool (or fall back to full pool if filter empties it)
    if (envFiltered.length > 0) {
      actualPool = envFiltered;
    } else {
      console.error(`Environment filter '${environment}' produced empty pool, using full pool`);
    }
  }

  // Load state with custom path
  let state;
  const currentPoolHash = computePoolHash(actualPool);

  try {
    const content = fs.readFileSync(statePath, 'utf8');
    state = JSON.parse(content);

    // Detect pool change (rotation pool changed, not config)
    if (state.poolHash !== currentPoolHash) {
      console.error('Pool changed, resetting index');
      state.currentIndex = 0;
      state.poolHash = currentPoolHash;
    }

    // Update configPoolHash if in config-driven mode
    if (configPoolHash !== null) {
      state.configPoolHash = configPoolHash;
    }

    // Bounds check
    if (state.currentIndex >= actualPool.length) {
      console.error('Index out of bounds, resetting');
      state.currentIndex = 0;
    }

    // Validate state structure
    if (typeof state.currentIndex !== 'number' ||
        typeof state.lastTriggerTime !== 'number' ||
        typeof state.poolHash !== 'string' ||
        typeof state.totalTriggered !== 'number') {
      console.error('State invalid, resetting');
      state = createDefaultState(actualPool);
      if (configPoolHash !== null) {
        state.configPoolHash = configPoolHash;
      }
    }
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.error('No state file, initializing');
    } else {
      console.error('State corrupted, resetting');
    }
    state = createDefaultState(actualPool);
    if (configPoolHash !== null) {
      state.configPoolHash = configPoolHash;
    }
  }

  // Check cooldown (unless bypassed for testing)
  if (!options.bypassCooldown) {
    const cooldownStatus = checkCooldown(state.lastTriggerTime, COOLDOWN_MS);

    if (!cooldownStatus.allowed) {
      // Cooldown active - return remaining time (do NOT advance rotation)
      // Include last exercise for statusline display (currentIndex already advanced past it)
      const lastIndex = (state.currentIndex - 1 + actualPool.length) % actualPool.length;
      const lastExercise = { ...actualPool[lastIndex] };

      // Apply difficulty scaling to lastExercise for display consistency
      const config = pool === null ? loadConfig(configPath) : { difficulty: { multiplier: 1.0 } };
      const multiplier = config.difficulty?.multiplier || 1.0;
      const latencyMs = options.latencyMs || 0;
      lastExercise.reps = scaleRepsForLatency(lastExercise.reps, latencyMs, multiplier);

      return {
        type: 'cooldown',
        remainingMs: cooldownStatus.remainingMs,
        remainingHuman: formatRemaining(cooldownStatus.remainingMs),
        lastExercise
      };
    }
  }

  // Get next exercise (mutates state.currentIndex)
  const { exercise: rawExercise, previousIndex } = getNextExercise(state, actualPool);

  // Clone exercise before scaling to avoid mutating pool
  const exercise = { ...rawExercise };

  // Apply difficulty scaling
  const config = pool === null ? loadConfig(configPath) : { difficulty: { multiplier: 1.0 } };
  const multiplier = config.difficulty?.multiplier || 1.0;
  const latencyMs = options.latencyMs || 0;
  exercise.reps = scaleRepsForLatency(exercise.reps, latencyMs, multiplier);

  // Update state
  state.lastTriggerTime = Date.now();
  state.totalTriggered++;

  // Save state (skip if dryRun)
  if (!options.dryRun) {
    try {
      fs.mkdirSync(path.dirname(statePath), { recursive: true, mode: 0o700 });
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
    } catch (e) {
      console.error(`State save error: ${e.message}`);
    }
  }

  // Return exercise response
  return {
    type: 'exercise',
    prompt: formatPrompt(exercise),
    exercise,
    position: {
      current: previousIndex,
      total: actualPool.length
    },
    totalTriggered: state.totalTriggered
  };
}

// CLI mode: if running directly, trigger and output JSON
// Uses config-driven mode (pool = null) for production usage
if (require.main === module) {
  const result = trigger(null);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = 0;
}

module.exports = {
  trigger,
  formatPrompt
};
