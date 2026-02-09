/**
 * Integration tests for rotation engine
 *
 * Tests cover rotation, cooldown, corruption recovery, and output format.
 * Uses Node.js built-in test runner (node:test) with temporary state directories.
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Module under test
const { trigger } = require('../engine.js');
const { DEFAULT_POOL, assemblePool, FULL_EXERCISE_DATABASE, computePoolHash } = require('../lib/pool.js');
const { loadConfig, saveConfig, getConfigPath, DEFAULT_CONFIG } = require('../lib/config.js');

/**
 * Creates a temporary state directory for isolated test runs
 */
function createTempStateDir() {
  const tmpBase = os.tmpdir();
  const uniqueSuffix = crypto.randomBytes(8).toString('hex');
  const tmpDir = path.join(tmpBase, `viberipped-test-${uniqueSuffix}`);
  fs.mkdirSync(tmpDir, { recursive: true, mode: 0o700 });
  return tmpDir;
}

/**
 * Removes temporary state directory and contents
 */
function cleanupTempStateDir(tmpDir) {
  try {
    if (fs.existsSync(tmpDir)) {
      const files = fs.readdirSync(tmpDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tmpDir, file));
      }
      fs.rmdirSync(tmpDir);
    }
  } catch (e) {
    // Cleanup is best-effort
  }
}

describe('Rotation Engine - Sequential Rotation', () => {
  let tmpDir;
  let statePath;

  beforeEach(() => {
    tmpDir = createTempStateDir();
    statePath = path.join(tmpDir, 'state.json');
  });

  afterEach(() => {
    cleanupTempStateDir(tmpDir);
  });

  test('sequential rotation advances through pool', () => {
    // Trigger N times and verify exercises match pool order
    const results = [];
    for (let i = 0; i < DEFAULT_POOL.length; i++) {
      const result = trigger(DEFAULT_POOL, { statePath, bypassCooldown: true });
      assert.strictEqual(result.type, 'exercise');
      results.push(result.exercise);
    }

    // Verify order matches pool
    for (let i = 0; i < DEFAULT_POOL.length; i++) {
      assert.strictEqual(results[i].name, DEFAULT_POOL[i].name);
      assert.strictEqual(results[i].reps, DEFAULT_POOL[i].reps);
    }
  });

  test('rotation wraps around at end of pool', () => {
    // Trigger pool.length + 1 times
    for (let i = 0; i < DEFAULT_POOL.length; i++) {
      trigger(DEFAULT_POOL, { statePath, bypassCooldown: true });
    }

    // Next trigger should wrap to index 0
    const result = trigger(DEFAULT_POOL, { statePath, bypassCooldown: true });
    assert.strictEqual(result.type, 'exercise');
    assert.strictEqual(result.exercise.name, DEFAULT_POOL[0].name);
    assert.strictEqual(result.position.current, 0);
  });

  test('state persists across trigger calls', () => {
    // First trigger
    const first = trigger(DEFAULT_POOL, { statePath, bypassCooldown: true });
    assert.strictEqual(first.exercise.name, DEFAULT_POOL[0].name);

    // Second trigger (separate call, should load state from disk)
    // Bypass cooldown to test persistence, not cooldown enforcement
    const second = trigger(DEFAULT_POOL, { statePath, bypassCooldown: true });
    assert.strictEqual(second.exercise.name, DEFAULT_POOL[1].name);
    assert.strictEqual(second.position.current, 1);
  });
});

describe('Rotation Engine - Cooldown Enforcement', () => {
  let tmpDir;
  let statePath;

  beforeEach(() => {
    tmpDir = createTempStateDir();
    statePath = path.join(tmpDir, 'state.json');
  });

  afterEach(() => {
    cleanupTempStateDir(tmpDir);
  });

  test('first trigger always allowed (sentinel 0)', () => {
    // Fresh state has lastTriggerTime = 0 (sentinel)
    const result = trigger(DEFAULT_POOL, { statePath });
    assert.strictEqual(result.type, 'exercise');
    assert.strictEqual(result.totalTriggered, 1);
  });

  test('cooldown blocks trigger within interval', () => {
    // First trigger
    const first = trigger(DEFAULT_POOL, { statePath });
    assert.strictEqual(first.type, 'exercise');

    // Immediate second trigger (within cooldown window)
    const second = trigger(DEFAULT_POOL, { statePath });
    assert.strictEqual(second.type, 'cooldown');
    assert.ok(second.remainingMs > 0);
    assert.ok(second.remainingMs <= 300000); // 5 minutes in ms
    assert.ok(second.remainingHuman.match(/\d+m \d+s|\d+s/));
  });

  test('cooldown allows trigger after interval', () => {
    // First trigger
    const first = trigger(DEFAULT_POOL, { statePath });
    assert.strictEqual(first.type, 'exercise');

    // Manually manipulate state to simulate time passage
    const stateContent = fs.readFileSync(statePath, 'utf8');
    const state = JSON.parse(stateContent);
    state.lastTriggerTime = Date.now() - 301000; // 5 minutes + 1 second ago
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

    // Second trigger should be allowed
    const second = trigger(DEFAULT_POOL, { statePath });
    assert.strictEqual(second.type, 'exercise');
    assert.strictEqual(second.exercise.name, DEFAULT_POOL[1].name);
  });
});

describe('Rotation Engine - Output Format', () => {
  let tmpDir;
  let statePath;

  beforeEach(() => {
    tmpDir = createTempStateDir();
    statePath = path.join(tmpDir, 'state.json');
  });

  afterEach(() => {
    cleanupTempStateDir(tmpDir);
  });

  test('prompt format is crisp command', () => {
    const result = trigger(DEFAULT_POOL, { statePath });
    assert.strictEqual(result.type, 'exercise');

    // Format: "{name} x{reps}"
    assert.ok(result.prompt.match(/^.+ x\d+$/), `Expected crisp format, got: ${result.prompt}`);

    // Should match exercise name and reps
    const expected = `${result.exercise.name} x${result.exercise.reps}`;
    assert.strictEqual(result.prompt, expected);
  });

  test('prompt has zero motivational language', () => {
    const result = trigger(DEFAULT_POOL, { statePath });
    assert.strictEqual(result.type, 'exercise');

    // Banned words/phrases
    const banned = ['try', 'great', 'nice', 'keep', 'good', "let's", '!'];
    const lowerPrompt = result.prompt.toLowerCase();

    for (const word of banned) {
      assert.ok(!lowerPrompt.includes(word), `Prompt contains banned word "${word}": ${result.prompt}`);
    }
  });
});

describe('Rotation Engine - Corruption Recovery', () => {
  let tmpDir;
  let statePath;

  beforeEach(() => {
    tmpDir = createTempStateDir();
    statePath = path.join(tmpDir, 'state.json');
  });

  afterEach(() => {
    cleanupTempStateDir(tmpDir);
  });

  test('corrupt state recovers and still returns exercise', () => {
    // Write garbage to state file
    fs.writeFileSync(statePath, 'GARBAGE{not valid json}', 'utf8');

    // Trigger should recover gracefully
    const result = trigger(DEFAULT_POOL, { statePath });
    assert.strictEqual(result.type, 'exercise');
    assert.strictEqual(result.exercise.name, DEFAULT_POOL[0].name);
    assert.strictEqual(result.totalTriggered, 1);
  });

  test('pool change resets index', () => {
    // Trigger 3 times with default pool
    trigger(DEFAULT_POOL, { statePath, bypassCooldown: true });
    trigger(DEFAULT_POOL, { statePath, bypassCooldown: true });
    const third = trigger(DEFAULT_POOL, { statePath, bypassCooldown: true });
    assert.strictEqual(third.exercise.name, DEFAULT_POOL[2].name);

    // Create a different pool
    const newPool = [
      { name: "Jumping jacks", reps: 20 },
      { name: "Mountain climbers", reps: 15 }
    ];

    // Trigger with new pool - should reset to index 0
    const afterChange = trigger(newPool, { statePath, bypassCooldown: true });
    assert.strictEqual(afterChange.type, 'exercise');
    assert.strictEqual(afterChange.exercise.name, newPool[0].name);
    assert.strictEqual(afterChange.position.current, 0);
  });
});

describe('Rotation Engine - Config-Driven Pool Assembly', () => {
  let tmpDir;
  let statePath;
  let configPath;

  beforeEach(() => {
    tmpDir = createTempStateDir();
    statePath = path.join(tmpDir, 'state.json');
    configPath = path.join(tmpDir, 'configuration.json');
  });

  afterEach(() => {
    cleanupTempStateDir(tmpDir);
  });

  test('engine uses bodyweight-only pool when no configuration.json exists', () => {
    // No config file created - should use bodyweight-only pool
    const result = trigger(null, { statePath, bypassCooldown: true });
    assert.strictEqual(result.type, 'exercise');

    // Exercise should be from DEFAULT_POOL (bodyweight exercises)
    const isBodyweightExercise = DEFAULT_POOL.some(ex =>
      ex.name === result.exercise.name && ex.reps === result.exercise.reps
    );
    assert.ok(isBodyweightExercise, `Exercise ${result.exercise.name} not in DEFAULT_POOL`);
  });

  test('engine includes kettlebell exercises when config enables kettlebell', () => {
    // Write config with kettlebell enabled
    const config = {
      equipment: { kettlebell: true, dumbbells: false, pullUpBar: false, parallettes: false }
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Trigger multiple times to see various exercises
    const exercisesSeen = new Set();
    for (let i = 0; i < 20; i++) {
      const result = trigger(null, { statePath, bypassCooldown: true });
      exercisesSeen.add(result.exercise.name);
    }

    // Should see at least one kettlebell exercise
    const kettlebellExercises = ['Kettlebell swings', 'Goblet squats', 'Kettlebell deadlifts', 'Turkish get-up'];
    const hasKettlebellExercise = kettlebellExercises.some(name => exercisesSeen.has(name));
    assert.ok(hasKettlebellExercise, `No kettlebell exercises seen. Saw: ${Array.from(exercisesSeen).join(', ')}`);
  });

  test('engine includes all equipment exercises when all enabled', () => {
    // Write config with all equipment enabled
    const config = {
      equipment: { kettlebell: true, dumbbells: true, pullUpBar: true, parallettes: true }
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Trigger through entire pool
    const poolSize = FULL_EXERCISE_DATABASE.length;
    const exercisesSeen = new Set();

    for (let i = 0; i < poolSize; i++) {
      const result = trigger(null, { statePath, bypassCooldown: true });
      exercisesSeen.add(result.exercise.name);
    }

    // Should have seen exercises from different equipment categories
    const kettlebellExercises = ['Kettlebell swings', 'Goblet squats'];
    const dumbbellExercises = ['Dumbbell rows', 'Overhead press'];
    const pullUpBarExercises = ['Pull-ups', 'Chin-ups'];
    const parallettesExercises = ['L-sit', 'Parallette pushups'];

    const hasKettlebell = kettlebellExercises.some(name => exercisesSeen.has(name));
    const hasDumbbell = dumbbellExercises.some(name => exercisesSeen.has(name));
    const hasPullUpBar = pullUpBarExercises.some(name => exercisesSeen.has(name));
    const hasParallettes = parallettesExercises.some(name => exercisesSeen.has(name));

    assert.ok(hasKettlebell || hasDumbbell || hasPullUpBar || hasParallettes,
      `Expected equipment exercises. Saw: ${Array.from(exercisesSeen).join(', ')}`);
  });

  test('engine falls back to bodyweight pool on invalid configuration.json', () => {
    // Write invalid JSON to config file
    fs.writeFileSync(configPath, 'INVALID{json here', 'utf8');

    const result = trigger(null, { statePath, bypassCooldown: true });
    assert.strictEqual(result.type, 'exercise');

    // Should be bodyweight exercise
    const isBodyweightExercise = DEFAULT_POOL.some(ex =>
      ex.name === result.exercise.name && ex.reps === result.exercise.reps
    );
    assert.ok(isBodyweightExercise, `Exercise ${result.exercise.name} not in DEFAULT_POOL after invalid config`);
  });
});

describe('Rotation Engine - Pool.json Persistence', () => {
  let tmpDir;
  let statePath;
  let poolPath;

  beforeEach(() => {
    tmpDir = createTempStateDir();
    statePath = path.join(tmpDir, 'state.json');
    poolPath = path.join(tmpDir, 'pool.json');
  });

  afterEach(() => {
    cleanupTempStateDir(tmpDir);
  });

  test('engine creates pool.json in state directory on first trigger', () => {
    // Verify pool.json doesn't exist yet
    assert.ok(!fs.existsSync(poolPath), 'pool.json should not exist before first trigger');

    // Trigger once
    trigger(null, { statePath, bypassCooldown: true });

    // Verify pool.json was created
    assert.ok(fs.existsSync(poolPath), 'pool.json should exist after first trigger');
  });

  test('pool.json contains valid JSON array of exercises', () => {
    // Trigger once to create pool.json
    trigger(null, { statePath, bypassCooldown: true });

    // Read and parse pool.json
    const poolContent = fs.readFileSync(poolPath, 'utf8');
    const pool = JSON.parse(poolContent);

    // Should be an array
    assert.ok(Array.isArray(pool), 'pool.json should contain an array');
    assert.ok(pool.length > 0, 'pool.json should not be empty');

    // Every entry should have name, reps, equipment
    for (const exercise of pool) {
      assert.strictEqual(typeof exercise.name, 'string', 'Exercise name should be string');
      assert.strictEqual(typeof exercise.reps, 'number', 'Exercise reps should be number');
      assert.ok(Array.isArray(exercise.equipment), 'Exercise equipment should be array');
    }
  });

  test('pool.json is human-readable (pretty-printed with 2-space indent)', () => {
    // Trigger once to create pool.json
    trigger(null, { statePath, bypassCooldown: true });

    // Read raw content
    const poolContent = fs.readFileSync(poolPath, 'utf8');

    // Should contain newlines (not minified)
    assert.ok(poolContent.includes('\n'), 'pool.json should contain newlines (pretty-printed)');

    // Should have indentation
    assert.ok(poolContent.includes('  '), 'pool.json should have indentation');

    // Should not be single-line JSON
    const lines = poolContent.split('\n');
    assert.ok(lines.length > 3, 'pool.json should be multi-line');
  });
});

describe('Rotation Engine - Pool.json User Edit Preservation', () => {
  let tmpDir;
  let statePath;
  let configPath;
  let poolPath;

  beforeEach(() => {
    tmpDir = createTempStateDir();
    statePath = path.join(tmpDir, 'state.json');
    configPath = path.join(tmpDir, 'configuration.json');
    poolPath = path.join(tmpDir, 'pool.json');
  });

  afterEach(() => {
    cleanupTempStateDir(tmpDir);
  });

  test('user-edited pool.json is used for rotation when config unchanged', () => {
    // Trigger once to create pool.json
    trigger(null, { statePath, bypassCooldown: true });

    // Manually edit pool.json to add a custom exercise at the end
    const pool = JSON.parse(fs.readFileSync(poolPath, 'utf8'));
    const customExercise = { name: "Custom jumping jacks", reps: 50, equipment: [] };
    pool.push(customExercise);
    fs.writeFileSync(poolPath, JSON.stringify(pool, null, 2));

    // Trigger until we see the custom exercise (or exhaust the pool)
    let foundCustom = false;
    for (let i = 0; i < pool.length; i++) {
      const result = trigger(null, { statePath, bypassCooldown: true });
      if (result.exercise.name === customExercise.name) {
        foundCustom = true;
        assert.strictEqual(result.exercise.reps, customExercise.reps);
        break;
      }
    }

    assert.ok(foundCustom, 'Custom exercise should appear in rotation');
  });

  test('configuration change triggers pool.json regeneration', () => {
    // Create initial config with kettlebell only
    const initialConfig = {
      equipment: { kettlebell: true, dumbbells: false, pullUpBar: false, parallettes: false }
    };
    fs.writeFileSync(configPath, JSON.stringify(initialConfig, null, 2));

    // Trigger to create pool.json
    trigger(null, { statePath, bypassCooldown: true });

    // Read initial pool
    const initialPool = JSON.parse(fs.readFileSync(poolPath, 'utf8'));

    // Change config to add dumbbells
    const newConfig = {
      equipment: { kettlebell: true, dumbbells: true, pullUpBar: false, parallettes: false }
    };
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));

    // Trigger again
    trigger(null, { statePath, bypassCooldown: true });

    // Read new pool
    const newPool = JSON.parse(fs.readFileSync(poolPath, 'utf8'));

    // Pool should be different (should now include dumbbell exercises)
    assert.notStrictEqual(newPool.length, initialPool.length, 'Pool size should change after config change');

    // New pool should include dumbbell exercises
    const hasDumbbellExercise = newPool.some(ex =>
      ex.equipment && ex.equipment.includes('dumbbells')
    );
    assert.ok(hasDumbbellExercise, 'New pool should include dumbbell exercises');
  });

  test('pool.json regeneration resets rotation index to 0', () => {
    // Create config
    const config = {
      equipment: { kettlebell: true, dumbbells: false, pullUpBar: false, parallettes: false }
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Trigger several times to advance index
    for (let i = 0; i < 5; i++) {
      trigger(null, { statePath, bypassCooldown: true });
    }

    // Get current position
    const beforeChange = trigger(null, { statePath, bypassCooldown: true });
    assert.ok(beforeChange.position.current >= 5, 'Index should have advanced');

    // Change config
    const newConfig = {
      equipment: { kettlebell: false, dumbbells: true, pullUpBar: false, parallettes: false }
    };
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));

    // Trigger after config change
    const afterChange = trigger(null, { statePath, bypassCooldown: true });

    // Index should be reset to 0
    assert.strictEqual(afterChange.position.current, 0, 'Index should reset to 0 after config change');
  });
});

describe('Rotation Engine - Difficulty Scaling', () => {
  let tmpDir;
  let statePath;
  let configPath;

  beforeEach(() => {
    tmpDir = createTempStateDir();
    statePath = path.join(tmpDir, 'state.json');
    configPath = path.join(tmpDir, 'configuration.json');
  });

  afterEach(() => {
    cleanupTempStateDir(tmpDir);
  });

  test('trigger with latencyMs option produces scaled reps', () => {
    // Use explicit pool for predictable base reps
    const testPool = [{ name: 'Pushups', reps: 20 }];

    // Trigger with high latency (should increase reps)
    const result = trigger(testPool, { statePath, bypassCooldown: true, latencyMs: 15000 });

    assert.strictEqual(result.type, 'exercise');
    assert.strictEqual(result.exercise.name, 'Pushups');
    // With 15000ms latency (midpoint between 2000-30000), factor is ~1.23x
    // 20 * 1.23 * 1.0 (default multiplier) ≈ 25
    assert.ok(result.exercise.reps > 20, `Expected reps > 20, got ${result.exercise.reps}`);
    assert.ok(result.exercise.reps <= 30, `Expected reps <= 30, got ${result.exercise.reps}`);
  });

  test('trigger with latencyMs=0 produces base reps (no scaling)', () => {
    // Use explicit pool for predictable base reps
    const testPool = [{ name: 'Squats', reps: 15 }];

    // Trigger with zero latency (no scaling)
    const result = trigger(testPool, { statePath, bypassCooldown: true, latencyMs: 0 });

    assert.strictEqual(result.type, 'exercise');
    assert.strictEqual(result.exercise.name, 'Squats');
    // latencyMs=0 is below MIN_LATENCY (2000), so factor is 1.0x
    // 15 * 1.0 * 1.0 = 15
    assert.strictEqual(result.exercise.reps, 15);
  });

  test('reps are clamped to bounds with extreme latency and high multiplier', () => {
    // Create config with maximum difficulty multiplier (2.5x)
    const config = {
      equipment: { kettlebell: false, dumbbells: false, pullUpBar: false, parallettes: false },
      difficulty: { multiplier: 2.5 }
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Use config-driven mode with high base reps
    const testPool = [{ name: 'Pushups', reps: 50 }];

    // Trigger with max latency (30000ms → 1.5x) and 2.5x multiplier
    // 50 * 1.5 * 2.5 = 187.5 → clamped to MAX_REPS (60)
    const result = trigger(testPool, { statePath, bypassCooldown: true, latencyMs: 30000 });

    assert.strictEqual(result.type, 'exercise');
    assert.ok(result.exercise.reps <= 60, `Expected reps <= 60, got ${result.exercise.reps}`);
    assert.ok(result.exercise.reps >= 5, `Expected reps >= 5, got ${result.exercise.reps}`);
  });

  test('difficulty multiplier from config is applied in config-driven mode', () => {
    // Create config with 1.5x difficulty multiplier
    const config = {
      equipment: { kettlebell: false, dumbbells: false, pullUpBar: false, parallettes: false },
      difficulty: { multiplier: 1.5 }
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Trigger with zero latency (only multiplier applies)
    // Use config-driven mode (pool=null)
    const result = trigger(null, { statePath, bypassCooldown: true, latencyMs: 0 });

    assert.strictEqual(result.type, 'exercise');

    // Find the base exercise in DEFAULT_POOL
    const baseExercise = DEFAULT_POOL.find(ex => ex.name === result.exercise.name);
    const expectedReps = Math.round(baseExercise.reps * 1.5);

    assert.strictEqual(result.exercise.reps, expectedReps,
      `Expected ${expectedReps} reps (${baseExercise.reps} * 1.5), got ${result.exercise.reps}`);
  });

  test('pool array is not mutated by difficulty scaling', () => {
    // Use explicit pool
    const testPool = [{ name: 'Pushups', reps: 20 }];
    const originalReps = testPool[0].reps;

    // Trigger with scaling
    trigger(testPool, { statePath, bypassCooldown: true, latencyMs: 15000 });

    // Original pool should be unchanged
    assert.strictEqual(testPool[0].reps, originalReps, 'Pool should not be mutated');
  });

  test('cooldown response includes scaled lastExercise reps', () => {
    // Create config with 2.0x difficulty multiplier
    const config = {
      equipment: { kettlebell: false, dumbbells: false, pullUpBar: false, parallettes: false },
      difficulty: { multiplier: 2.0 }
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    // First trigger (allowed)
    const first = trigger(null, { statePath, latencyMs: 10000 });
    assert.strictEqual(first.type, 'exercise');
    const firstReps = first.exercise.reps;

    // Second trigger (blocked by cooldown)
    const second = trigger(null, { statePath, latencyMs: 10000 });
    assert.strictEqual(second.type, 'cooldown');

    // lastExercise should have same scaled reps as first trigger
    assert.ok(second.lastExercise, 'Cooldown should include lastExercise');
    assert.strictEqual(second.lastExercise.reps, firstReps,
      'lastExercise reps should match first trigger scaled reps');
  });
});
