/**
 * Integration tests for pool command
 *
 * Tests the viberipped pool CLI commands end-to-end using child_process.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Runs CLI command in isolated temp directory.
 *
 * @param {Array<string>} args - Command arguments
 * @param {string} [tempHome] - Optional temp home directory (for multi-call tests)
 * @returns {Promise<{code: number, stdout: string, stderr: string, tempHome: string}>}
 */
function runCLI(args, tempHome) {
  return new Promise((resolve, reject) => {
    // Create isolated temp directory if not provided
    if (!tempHome) {
      tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      fs.mkdirSync(tempHome, { recursive: true });
    }

    const env = {
      ...process.env,
      HOME: tempHome,
      XDG_CONFIG_HOME: path.join(tempHome, '.config')
    };

    const binPath = path.join(__dirname, '../../bin/viberipped.js');
    const child = spawn('node', [binPath, ...args], { env });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ code, stdout, stderr, tempHome });
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Creates a minimal pool.json in the state directory.
 *
 * @param {string} tempHome - Temp home directory
 * @param {Array} pool - Pool exercises array
 */
function createPool(tempHome, pool) {
  const stateDir = path.join(tempHome, '.config', 'viberipped');
  fs.mkdirSync(stateDir, { recursive: true });
  const poolPath = path.join(stateDir, 'pool.json');
  fs.writeFileSync(poolPath, JSON.stringify(pool, null, 2));
}

/**
 * Creates a minimal state.json in the state directory.
 *
 * @param {string} tempHome - Temp home directory
 * @param {Object} state - State object
 */
function createState(tempHome, state) {
  const stateDir = path.join(tempHome, '.config', 'viberipped');
  fs.mkdirSync(stateDir, { recursive: true });
  const statePath = path.join(stateDir, 'state.json');
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

/**
 * Reads state.json from temp home directory.
 *
 * @param {string} tempHome - Temp home directory
 * @returns {Object} Parsed state object
 */
function readState(tempHome) {
  const statePath = path.join(tempHome, '.config', 'viberipped', 'state.json');
  const content = fs.readFileSync(statePath, 'utf8');
  return JSON.parse(content);
}

/**
 * Cleanup temp directory.
 *
 * @param {string} tempHome - Temp home directory
 */
function cleanup(tempHome) {
  try {
    fs.rmSync(tempHome, { recursive: true, force: true });
  } catch (e) {
    // Ignore cleanup errors
  }
}

describe('pool command', () => {
  test('lists exercises after config', async () => {
    const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempHome, { recursive: true });

    // Create pool manually
    const testPool = [
      { name: "Pushups", reps: 15, equipment: [] },
      { name: "Squats", reps: 20, equipment: [] },
      { name: "Kettlebell swings", reps: 15, equipment: ["kettlebell"] }
    ];
    createPool(tempHome, testPool);

    const { code, stdout } = await runCLI(['pool', 'list'], tempHome);

    assert.strictEqual(code, 0);
    assert.match(stdout, /Exercise pool \(3 exercises\)/);
    assert.match(stdout, /1\. Pushups x15 \[bodyweight\]/);
    assert.match(stdout, /2\. Squats x20 \[bodyweight\]/);
    assert.match(stdout, /3\. Kettlebell swings x15 \[kettlebell\]/);

    cleanup(tempHome);
  });

  test('pool list shows error when no pool exists', async () => {
    const { code, stderr } = await runCLI(['pool', 'list']);

    assert.strictEqual(code, 1);
    assert.match(stderr, /No pool found/);
  });

  test('adds exercise to pool', async () => {
    const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempHome, { recursive: true });

    // Create pool
    const testPool = [
      { name: "Pushups", reps: 15, equipment: [] },
      { name: "Squats", reps: 20, equipment: [] }
    ];
    createPool(tempHome, testPool);

    const { code, stdout } = await runCLI(['pool', 'add', 'Burpees', '10'], tempHome);

    assert.strictEqual(code, 0);
    assert.match(stdout, /Added "Burpees" x10 to pool/);
    assert.match(stdout, /Rotation index reset/);

    cleanup(tempHome);
  });

  test('rejects duplicate exercise', async () => {
    const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempHome, { recursive: true });

    // Create pool with Pushups
    const testPool = [
      { name: "Pushups", reps: 15, equipment: [] },
      { name: "Squats", reps: 20, equipment: [] }
    ];
    createPool(tempHome, testPool);

    const { code, stderr } = await runCLI(['pool', 'add', 'Pushups', '15'], tempHome);

    assert.strictEqual(code, 1);
    assert.match(stderr, /already exists/);

    cleanup(tempHome);
  });

  test('rejects invalid reps', async () => {
    const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempHome, { recursive: true });

    // Create pool
    const testPool = [
      { name: "Pushups", reps: 15, equipment: [] }
    ];
    createPool(tempHome, testPool);

    const { code, stderr } = await runCLI(['pool', 'add', 'Test', 'abc'], tempHome);

    assert.strictEqual(code, 1);
    assert.match(stderr, /Invalid reps/);

    cleanup(tempHome);
  });

  test('removes exercise from pool', async () => {
    const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempHome, { recursive: true });

    // Create pool
    const testPool = [
      { name: "Pushups", reps: 15, equipment: [] },
      { name: "Squats", reps: 20, equipment: [] },
      { name: "Burpees", reps: 10, equipment: [] }
    ];
    createPool(tempHome, testPool);

    const { code, stdout } = await runCLI(['pool', 'remove', 'Pushups'], tempHome);

    assert.strictEqual(code, 0);
    assert.match(stdout, /Removed "Pushups" from pool/);
    assert.match(stdout, /Rotation index reset/);

    cleanup(tempHome);
  });

  test('rejects removing non-existent exercise', async () => {
    const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempHome, { recursive: true });

    // Create pool
    const testPool = [
      { name: "Pushups", reps: 15, equipment: [] },
      { name: "Squats", reps: 20, equipment: [] }
    ];
    createPool(tempHome, testPool);

    const { code, stderr } = await runCLI(['pool', 'remove', 'Nonexistent'], tempHome);

    assert.strictEqual(code, 1);
    assert.match(stderr, /not found/);

    cleanup(tempHome);
  });

  test('resets state index after add', async () => {
    const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempHome, { recursive: true });

    // Create pool
    const testPool = [
      { name: "Pushups", reps: 15, equipment: [] },
      { name: "Squats", reps: 20, equipment: [] }
    ];
    createPool(tempHome, testPool);

    // Create state with currentIndex > 0
    createState(tempHome, {
      currentIndex: 1,
      lastTriggerTime: 0,
      poolHash: 'somehash',
      totalTriggered: 5
    });

    // Add exercise
    await runCLI(['pool', 'add', 'Burpees', '10'], tempHome);

    // Check state
    const state = readState(tempHome);
    assert.strictEqual(state.currentIndex, 0);

    cleanup(tempHome);
  });

  test('cannot remove last exercise', async () => {
    const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempHome, { recursive: true });

    // Create pool with one exercise
    const testPool = [
      { name: "Pushups", reps: 15, equipment: [] }
    ];
    createPool(tempHome, testPool);

    const { code, stderr } = await runCLI(['pool', 'remove', 'Pushups'], tempHome);

    assert.strictEqual(code, 1);
    assert.match(stderr, /Cannot remove last exercise/);

    cleanup(tempHome);
  });

  test('adds timed exercise with --type timed', async () => {
    const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempHome, { recursive: true });

    // Create pool
    const testPool = [
      { name: "Pushups", reps: 15, type: "reps", equipment: [] }
    ];
    createPool(tempHome, testPool);

    const { code, stdout } = await runCLI(['pool', 'add', 'Plank', '30', '--type', 'timed'], tempHome);

    assert.strictEqual(code, 0);
    assert.match(stdout, /Added "Plank" 30s to pool/);
    assert.ok(!stdout.includes('x30'), 'Should not contain x30 for timed exercise');

    // Verify pool.json contains type field
    const poolPath = path.join(tempHome, '.config', 'viberipped', 'pool.json');
    const pool = JSON.parse(fs.readFileSync(poolPath, 'utf8'));
    const plank = pool.find(ex => ex.name === 'Plank');
    assert.strictEqual(plank.type, 'timed');
    assert.strictEqual(plank.reps, 30);

    cleanup(tempHome);
  });

  test('adds timed exercise with --type timed --duration', async () => {
    const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempHome, { recursive: true });

    // Create pool
    const testPool = [
      { name: "Pushups", reps: 15, type: "reps", equipment: [] }
    ];
    createPool(tempHome, testPool);

    const { code, stdout } = await runCLI(['pool', 'add', 'Plank', '30', '--type', 'timed', '--duration', '45'], tempHome);

    assert.strictEqual(code, 0);
    assert.match(stdout, /Added "Plank" 45s to pool/);

    // Verify pool.json contains duration field
    const poolPath = path.join(tempHome, '.config', 'viberipped', 'pool.json');
    const pool = JSON.parse(fs.readFileSync(poolPath, 'utf8'));
    const plank = pool.find(ex => ex.name === 'Plank');
    assert.strictEqual(plank.type, 'timed');
    assert.strictEqual(plank.reps, 30);
    assert.strictEqual(plank.duration, 45);

    cleanup(tempHome);
  });

  test('adds rep exercise with default type', async () => {
    const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempHome, { recursive: true });

    // Create pool
    const testPool = [
      { name: "Pushups", reps: 15, type: "reps", equipment: [] }
    ];
    createPool(tempHome, testPool);

    const { code, stdout } = await runCLI(['pool', 'add', 'Squats', '20'], tempHome);

    assert.strictEqual(code, 0);
    assert.match(stdout, /Added "Squats" x20 to pool/);

    // Verify pool.json contains type field
    const poolPath = path.join(tempHome, '.config', 'viberipped', 'pool.json');
    const pool = JSON.parse(fs.readFileSync(poolPath, 'utf8'));
    const squats = pool.find(ex => ex.name === 'Squats');
    assert.strictEqual(squats.type, 'reps');
    assert.strictEqual(squats.reps, 20);

    cleanup(tempHome);
  });

  test('rejects invalid type', async () => {
    const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempHome, { recursive: true });

    // Create pool
    const testPool = [
      { name: "Pushups", reps: 15, equipment: [] }
    ];
    createPool(tempHome, testPool);

    const { code, stderr } = await runCLI(['pool', 'add', 'Test', '30', '--type', 'invalid'], tempHome);

    assert.strictEqual(code, 1);
    assert.match(stderr, /Invalid type/);

    cleanup(tempHome);
  });

  test('pool list shows timed exercises with "s" suffix', async () => {
    const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempHome, { recursive: true });

    // Create pool with mixed types
    const testPool = [
      { name: "Pushups", reps: 15, type: "reps", equipment: [] },
      { name: "Plank", reps: 30, type: "timed", duration: 30, equipment: [] },
      { name: "Wall sit", reps: 45, type: "timed", equipment: [] }
    ];
    createPool(tempHome, testPool);

    const { code, stdout } = await runCLI(['pool', 'list'], tempHome);

    assert.strictEqual(code, 0);
    assert.match(stdout, /1\. Pushups x15 \[bodyweight\]/);
    assert.match(stdout, /2\. Plank 30s \[bodyweight\]/);
    assert.match(stdout, /3\. Wall sit 45s \[bodyweight\]/);
    assert.ok(!stdout.includes('x30'), 'Should not contain x30 for timed exercises');
    assert.ok(!stdout.includes('x45'), 'Should not contain x45 for timed exercises');

    cleanup(tempHome);
  });

  test('pool add with --environments tags exercise correctly', async () => {
    const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempHome, { recursive: true });

    // Create pool
    const testPool = [
      { name: "Pushups", reps: 15, equipment: [], environments: ["anywhere"] }
    ];
    createPool(tempHome, testPool);

    const { code, stdout } = await runCLI(['pool', 'add', 'Desk stretches', '30', '--environments', 'home,office'], tempHome);

    assert.strictEqual(code, 0);
    assert.match(stdout, /Added "Desk stretches" x30 to pool/);

    // Load pool and verify environments field
    const poolPath = path.join(tempHome, '.config', 'viberipped', 'pool.json');
    const poolContent = fs.readFileSync(poolPath, 'utf8');
    const pool = JSON.parse(poolContent);

    const exercise = pool.find(ex => ex.name === 'Desk stretches');
    assert.ok(exercise, 'Exercise should exist in pool');
    assert.deepStrictEqual(exercise.environments, ['home', 'office']);

    cleanup(tempHome);
  });

  test('pool add without --environments defaults to anywhere', async () => {
    const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempHome, { recursive: true });

    // Create pool
    const testPool = [
      { name: "Pushups", reps: 15, equipment: [], environments: ["anywhere"] }
    ];
    createPool(tempHome, testPool);

    const { code, stdout } = await runCLI(['pool', 'add', 'Squats', '20'], tempHome);

    assert.strictEqual(code, 0);

    // Load pool and verify environments field
    const poolPath = path.join(tempHome, '.config', 'viberipped', 'pool.json');
    const poolContent = fs.readFileSync(poolPath, 'utf8');
    const pool = JSON.parse(poolContent);

    const exercise = pool.find(ex => ex.name === 'Squats');
    assert.ok(exercise, 'Exercise should exist in pool');
    assert.deepStrictEqual(exercise.environments, ['anywhere']);

    cleanup(tempHome);
  });

  test('pool list shows environment tags', async () => {
    const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempHome, { recursive: true });

    // Create pool with environment tags
    const testPool = [
      { name: "Pushups", reps: 15, equipment: [], environments: ["anywhere"] },
      { name: "Desk stretches", reps: 30, equipment: [], environments: ["home", "office"] },
      { name: "Outdoor sprints", reps: 10, equipment: [], environments: ["outdoor"] }
    ];
    createPool(tempHome, testPool);

    const { code, stdout } = await runCLI(['pool', 'list'], tempHome);

    assert.strictEqual(code, 0);
    assert.match(stdout, /1\. Pushups x15 \[bodyweight\] \(anywhere\)/);
    assert.match(stdout, /2\. Desk stretches x30 \[bodyweight\] \(home, office\)/);
    assert.match(stdout, /3\. Outdoor sprints x10 \[bodyweight\] \(outdoor\)/);

    cleanup(tempHome);
  });

  test('pool add with empty --environments fails', async () => {
    const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempHome, { recursive: true });

    // Create pool
    const testPool = [
      { name: "Pushups", reps: 15, equipment: [], environments: ["anywhere"] }
    ];
    createPool(tempHome, testPool);

    const { code, stderr } = await runCLI(['pool', 'add', 'Test', '10', '--environments', ''], tempHome);

    assert.strictEqual(code, 1);
    assert.match(stderr, /Invalid environments/);

    cleanup(tempHome);
  });

  describe('pool batch add', () => {
    test('batch adds multiple exercises from comma-separated input', async () => {
      const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      fs.mkdirSync(tempHome, { recursive: true });

      // Create pool with one exercise
      const testPool = [
        { name: "Pushups", reps: 15, equipment: [], environments: ["anywhere"] }
      ];
      createPool(tempHome, testPool);

      const { code, stdout } = await runCLI(['pool', 'add', 'Burpees 12, Mountain climbers 20, Jumping jacks 30'], tempHome);

      assert.strictEqual(code, 0);
      assert.match(stdout, /Added 3 exercises/);

      // Verify pool.json has 4 total exercises
      const poolPath = path.join(tempHome, '.config', 'viberipped', 'pool.json');
      const pool = JSON.parse(fs.readFileSync(poolPath, 'utf8'));
      assert.strictEqual(pool.length, 4);

      // Verify each new exercise
      const burpees = pool.find(ex => ex.name === 'Burpees');
      assert.ok(burpees, 'Burpees should exist');
      assert.strictEqual(burpees.reps, 12);

      const climbers = pool.find(ex => ex.name === 'Mountain climbers');
      assert.ok(climbers, 'Mountain climbers should exist');
      assert.strictEqual(climbers.reps, 20);

      const jacks = pool.find(ex => ex.name === 'Jumping jacks');
      assert.ok(jacks, 'Jumping jacks should exist');
      assert.strictEqual(jacks.reps, 30);

      cleanup(tempHome);
    });

    test('batch add rejects if any exercise has invalid format (missing reps)', async () => {
      const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      fs.mkdirSync(tempHome, { recursive: true });

      // Create pool with one exercise
      const testPool = [
        { name: "Pushups", reps: 15, equipment: [], environments: ["anywhere"] }
      ];
      createPool(tempHome, testPool);

      const { code, stderr } = await runCLI(['pool', 'add', 'Burpees 12, Invalid, Squats 20'], tempHome);

      assert.strictEqual(code, 1);
      assert.match(stderr, /Invalid format|missing reps/i);

      // Verify pool unchanged (atomic failure - Burpees NOT added)
      const poolPath = path.join(tempHome, '.config', 'viberipped', 'pool.json');
      const pool = JSON.parse(fs.readFileSync(poolPath, 'utf8'));
      assert.strictEqual(pool.length, 1);
      assert.strictEqual(pool[0].name, 'Pushups');

      cleanup(tempHome);
    });

    test('batch add rejects if reps are invalid', async () => {
      const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      fs.mkdirSync(tempHome, { recursive: true });

      // Create pool with one exercise
      const testPool = [
        { name: "Pushups", reps: 15, equipment: [], environments: ["anywhere"] }
      ];
      createPool(tempHome, testPool);

      const { code, stderr } = await runCLI(['pool', 'add', 'Burpees 12, Squats abc'], tempHome);

      assert.strictEqual(code, 1);
      assert.match(stderr, /Invalid reps/);

      // Verify pool unchanged
      const poolPath = path.join(tempHome, '.config', 'viberipped', 'pool.json');
      const pool = JSON.parse(fs.readFileSync(poolPath, 'utf8'));
      assert.strictEqual(pool.length, 1);

      cleanup(tempHome);
    });

    test('batch add rejects duplicate within batch', async () => {
      const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      fs.mkdirSync(tempHome, { recursive: true });

      // Create pool with one exercise
      const testPool = [
        { name: "Pushups", reps: 15, equipment: [], environments: ["anywhere"] }
      ];
      createPool(tempHome, testPool);

      const { code, stderr } = await runCLI(['pool', 'add', 'Burpees 12, Squats 20, Burpees 15'], tempHome);

      assert.strictEqual(code, 1);
      assert.match(stderr, /Duplicate exercise.*batch.*Burpees/i);

      // Verify pool unchanged
      const poolPath = path.join(tempHome, '.config', 'viberipped', 'pool.json');
      const pool = JSON.parse(fs.readFileSync(poolPath, 'utf8'));
      assert.strictEqual(pool.length, 1);

      cleanup(tempHome);
    });

    test('batch add rejects duplicate against existing pool', async () => {
      const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      fs.mkdirSync(tempHome, { recursive: true });

      // Create pool with Pushups
      const testPool = [
        { name: "Pushups", reps: 15, equipment: [], environments: ["anywhere"] }
      ];
      createPool(tempHome, testPool);

      const { code, stderr } = await runCLI(['pool', 'add', 'Burpees 12, Pushups 20'], tempHome);

      assert.strictEqual(code, 1);
      assert.match(stderr, /already exists/);

      // Verify pool unchanged
      const poolPath = path.join(tempHome, '.config', 'viberipped', 'pool.json');
      const pool = JSON.parse(fs.readFileSync(poolPath, 'utf8'));
      assert.strictEqual(pool.length, 1);

      cleanup(tempHome);
    });

    test('batch add handles multi-word exercise names', async () => {
      const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      fs.mkdirSync(tempHome, { recursive: true });

      // Create pool with one exercise
      const testPool = [
        { name: "Pushups", reps: 15, equipment: [], environments: ["anywhere"] }
      ];
      createPool(tempHome, testPool);

      const { code, stdout } = await runCLI(['pool', 'add', 'Jumping jacks 30, Mountain climbers 20, High knees 25'], tempHome);

      assert.strictEqual(code, 0);

      // Verify pool contains exercises with correct multi-word names
      const poolPath = path.join(tempHome, '.config', 'viberipped', 'pool.json');
      const pool = JSON.parse(fs.readFileSync(poolPath, 'utf8'));

      const jacks = pool.find(ex => ex.name === 'Jumping jacks');
      assert.ok(jacks, 'Jumping jacks should exist');
      assert.strictEqual(jacks.reps, 30);

      const climbers = pool.find(ex => ex.name === 'Mountain climbers');
      assert.ok(climbers, 'Mountain climbers should exist');
      assert.strictEqual(climbers.reps, 20);

      const knees = pool.find(ex => ex.name === 'High knees');
      assert.ok(knees, 'High knees should exist');
      assert.strictEqual(knees.reps, 25);

      cleanup(tempHome);
    });

    test('batch add handles extra whitespace', async () => {
      const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      fs.mkdirSync(tempHome, { recursive: true });

      // Create pool with one exercise
      const testPool = [
        { name: "Pushups", reps: 15, equipment: [], environments: ["anywhere"] }
      ];
      createPool(tempHome, testPool);

      const { code, stdout } = await runCLI(['pool', 'add', 'Burpees  12 ,  Squats   20'], tempHome);

      assert.strictEqual(code, 0);
      assert.match(stdout, /Added 2 exercises/);

      // Verify pool has correct names and reps
      const poolPath = path.join(tempHome, '.config', 'viberipped', 'pool.json');
      const pool = JSON.parse(fs.readFileSync(poolPath, 'utf8'));

      const burpees = pool.find(ex => ex.name === 'Burpees');
      assert.ok(burpees, 'Burpees should exist');
      assert.strictEqual(burpees.reps, 12);

      const squats = pool.find(ex => ex.name === 'Squats');
      assert.ok(squats, 'Squats should exist');
      assert.strictEqual(squats.reps, 20);

      cleanup(tempHome);
    });

    test('batch add resets state index', async () => {
      const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      fs.mkdirSync(tempHome, { recursive: true });

      // Create pool with one exercise
      const testPool = [
        { name: "Pushups", reps: 15, equipment: [], environments: ["anywhere"] }
      ];
      createPool(tempHome, testPool);

      // Create state with currentIndex > 0
      createState(tempHome, {
        currentIndex: 5,
        lastTriggerTime: 0,
        poolHash: 'somehash',
        totalTriggered: 10
      });

      // Run batch add
      const { code } = await runCLI(['pool', 'add', 'Burpees 12, Squats 20'], tempHome);

      assert.strictEqual(code, 0);

      // Verify state.json currentIndex is 0
      const state = readState(tempHome);
      assert.strictEqual(state.currentIndex, 0);

      cleanup(tempHome);
    });
  });

  describe('pool manage', () => {
    test('manage command fails gracefully in non-TTY context', async () => {
      const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      fs.mkdirSync(tempHome, { recursive: true });

      // Create pool with exercises
      const testPool = [
        { name: "Pushups", reps: 15, equipment: [], environments: ["anywhere"] },
        { name: "Squats", reps: 20, equipment: [], environments: ["anywhere"] }
      ];
      createPool(tempHome, testPool);

      const { code, stderr } = await runCLI(['pool', 'manage'], tempHome);

      assert.strictEqual(code, 1);
      assert.match(stderr, /requires an interactive terminal/);

      cleanup(tempHome);
    });

    test('manage command shows in help output', async () => {
      const { code, stdout } = await runCLI(['pool', '--help']);

      assert.strictEqual(code, 0);
      assert.match(stdout, /manage/);
      assert.match(stdout, /Interactive checklist/);
    });
  });
});
