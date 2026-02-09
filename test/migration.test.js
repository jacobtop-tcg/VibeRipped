/**
 * Migration Module Tests
 *
 * Tests for v1.0 to v1.1 schema migration with backup creation.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { migrateConfigIfNeeded, migratePoolIfNeeded, migrateStateIfNeeded } = require('../lib/migration');

/**
 * Helper: Create isolated temp directory with unique name
 */
function createTempDir() {
  const tmpBase = os.tmpdir();
  const uniqueSuffix = `viberipped-migration-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const tmpDir = path.join(tmpBase, uniqueSuffix);
  fs.mkdirSync(tmpDir, { recursive: true });
  return tmpDir;
}

/**
 * Helper: Clean up temp directory
 */
function cleanupTempDir(tmpDir) {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (e) {
    // Ignore cleanup errors
  }
}

describe('Config migration', () => {
  test('migrateConfigIfNeeded on v1.0 config creates .v1.0.backup file', () => {
    const tmpDir = createTempDir();
    const configPath = path.join(tmpDir, 'configuration.json');

    // Write v1.0 config (no schemaVersion)
    const v1Config = {
      equipment: { kettlebell: false, dumbbells: false, pullUpBar: false, parallettes: false },
      difficulty: { multiplier: 1.0 }
    };
    fs.writeFileSync(configPath, JSON.stringify(v1Config, null, 2));

    // Run migration
    migrateConfigIfNeeded(configPath);

    // Assert backup exists
    const backupPath = configPath + '.v1.0.backup';
    assert.ok(fs.existsSync(backupPath), 'Backup file should exist');

    // Assert backup content matches original
    const backupContent = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    assert.deepStrictEqual(backupContent, v1Config, 'Backup should match original v1.0 config');

    cleanupTempDir(tmpDir);
  });

  test('migrateConfigIfNeeded on v1.0 config adds environment and schemaVersion', () => {
    const tmpDir = createTempDir();
    const configPath = path.join(tmpDir, 'configuration.json');

    // Write v1.0 config
    const v1Config = {
      equipment: { kettlebell: true, dumbbells: false, pullUpBar: false, parallettes: false },
      difficulty: { multiplier: 1.5 }
    };
    fs.writeFileSync(configPath, JSON.stringify(v1Config, null, 2));

    // Run migration
    const result = migrateConfigIfNeeded(configPath);

    // Assert v1.1 fields added
    assert.strictEqual(result.environment, 'anywhere', 'Should add environment field');
    assert.strictEqual(result.schemaVersion, '1.1', 'Should add schemaVersion field');

    // Verify file was updated
    const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.strictEqual(savedConfig.environment, 'anywhere', 'Saved config should have environment');
    assert.strictEqual(savedConfig.schemaVersion, '1.1', 'Saved config should have schemaVersion');

    cleanupTempDir(tmpDir);
  });

  test('migrateConfigIfNeeded on v1.0 config preserves existing equipment and difficulty', () => {
    const tmpDir = createTempDir();
    const configPath = path.join(tmpDir, 'configuration.json');

    // Write v1.0 config with specific values
    const v1Config = {
      equipment: { kettlebell: true, dumbbells: true, pullUpBar: false, parallettes: false },
      difficulty: { multiplier: 2.0 }
    };
    fs.writeFileSync(configPath, JSON.stringify(v1Config, null, 2));

    // Run migration
    const result = migrateConfigIfNeeded(configPath);

    // Assert existing fields preserved
    assert.deepStrictEqual(result.equipment, v1Config.equipment, 'Equipment should be preserved');
    assert.strictEqual(result.difficulty.multiplier, 2.0, 'Difficulty multiplier should be preserved');

    cleanupTempDir(tmpDir);
  });

  test('migrateConfigIfNeeded on v1.1 config does NOT create backup', () => {
    const tmpDir = createTempDir();
    const configPath = path.join(tmpDir, 'configuration.json');

    // Write v1.1 config (already has schemaVersion)
    const v11Config = {
      equipment: { kettlebell: false, dumbbells: false, pullUpBar: false, parallettes: false },
      difficulty: { multiplier: 1.0 },
      environment: 'anywhere',
      schemaVersion: '1.1'
    };
    fs.writeFileSync(configPath, JSON.stringify(v11Config, null, 2));

    // Run migration
    migrateConfigIfNeeded(configPath);

    // Assert backup does NOT exist
    const backupPath = configPath + '.v1.0.backup';
    assert.ok(!fs.existsSync(backupPath), 'Backup should NOT exist for v1.1 config');

    cleanupTempDir(tmpDir);
  });

  test('migrateConfigIfNeeded on v1.1 config returns config unchanged', () => {
    const tmpDir = createTempDir();
    const configPath = path.join(tmpDir, 'configuration.json');

    // Write v1.1 config
    const v11Config = {
      equipment: { kettlebell: true, dumbbells: false, pullUpBar: false, parallettes: false },
      difficulty: { multiplier: 1.5 },
      environment: 'anywhere',
      schemaVersion: '1.1'
    };
    fs.writeFileSync(configPath, JSON.stringify(v11Config, null, 2));

    // Run migration
    const result = migrateConfigIfNeeded(configPath);

    // Assert config unchanged
    assert.deepStrictEqual(result, v11Config, 'v1.1 config should be returned unchanged');

    cleanupTempDir(tmpDir);
  });

  test('migrateConfigIfNeeded called twice only creates one backup', () => {
    const tmpDir = createTempDir();
    const configPath = path.join(tmpDir, 'configuration.json');

    // Write v1.0 config
    const v1Config = {
      equipment: { kettlebell: false, dumbbells: false, pullUpBar: false, parallettes: false },
      difficulty: { multiplier: 1.0 }
    };
    fs.writeFileSync(configPath, JSON.stringify(v1Config, null, 2));

    // Run migration first time
    migrateConfigIfNeeded(configPath);

    // Get backup mtime
    const backupPath = configPath + '.v1.0.backup';
    const firstMtime = fs.statSync(backupPath).mtime.getTime();

    // Wait a bit to ensure mtime would change if file was rewritten
    const waitMs = 10;
    const start = Date.now();
    while (Date.now() - start < waitMs) {
      // Busy wait
    }

    // Run migration second time (config is now v1.1)
    migrateConfigIfNeeded(configPath);

    // Assert backup was not modified
    const secondMtime = fs.statSync(backupPath).mtime.getTime();
    assert.strictEqual(secondMtime, firstMtime, 'Backup should not be recreated on second migration');

    cleanupTempDir(tmpDir);
  });

  test('migrateConfigIfNeeded on missing config file returns null', () => {
    const tmpDir = createTempDir();
    const configPath = path.join(tmpDir, 'nonexistent.json');

    // Run migration on missing file
    const result = migrateConfigIfNeeded(configPath);

    // Assert returns null
    assert.strictEqual(result, null, 'Should return null for missing config file');

    cleanupTempDir(tmpDir);
  });
});

describe('Pool migration', () => {
  test('migratePoolIfNeeded on v1.0 pool creates .v1.0.backup', () => {
    const tmpDir = createTempDir();
    const poolPath = path.join(tmpDir, 'pool.json');

    // Write v1.0 pool (exercises without category/type)
    const v1Pool = [
      { name: 'Pushups', reps: 15 },
      { name: 'Squats', reps: 20 }
    ];
    fs.writeFileSync(poolPath, JSON.stringify(v1Pool, null, 2));

    // Run migration
    migratePoolIfNeeded(poolPath);

    // Assert backup exists
    const backupPath = poolPath + '.v1.0.backup';
    assert.ok(fs.existsSync(backupPath), 'Backup file should exist');

    // Assert backup content matches original
    const backupContent = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    assert.deepStrictEqual(backupContent, v1Pool, 'Backup should match original v1.0 pool');

    cleanupTempDir(tmpDir);
  });

  test('migratePoolIfNeeded adds type: "reps" and environments to exercises', () => {
    const tmpDir = createTempDir();
    const poolPath = path.join(tmpDir, 'pool.json');

    // Write v1.0 pool
    const v1Pool = [
      { name: 'Pushups', reps: 15, equipment: [] },
      { name: 'Squats', reps: 20, equipment: [] }
    ];
    fs.writeFileSync(poolPath, JSON.stringify(v1Pool, null, 2));

    // Run migration
    const result = migratePoolIfNeeded(poolPath);

    // Assert type and environments added
    assert.strictEqual(result[0].type, 'reps', 'First exercise should have type: "reps"');
    assert.deepStrictEqual(result[0].environments, ['anywhere'], 'First exercise should have environments: ["anywhere"]');
    assert.strictEqual(result[1].type, 'reps', 'Second exercise should have type: "reps"');
    assert.deepStrictEqual(result[1].environments, ['anywhere'], 'Second exercise should have environments: ["anywhere"]');

    cleanupTempDir(tmpDir);
  });

  test('migratePoolIfNeeded does NOT add category to exercises', () => {
    const tmpDir = createTempDir();
    const poolPath = path.join(tmpDir, 'pool.json');

    // Write v1.0 pool
    const v1Pool = [
      { name: 'Pushups', reps: 15 },
      { name: 'Squats', reps: 20 }
    ];
    fs.writeFileSync(poolPath, JSON.stringify(v1Pool, null, 2));

    // Run migration
    const result = migratePoolIfNeeded(poolPath);

    // Assert category NOT added
    assert.strictEqual(result[0].category, undefined, 'Should NOT add category field');
    assert.strictEqual(result[1].category, undefined, 'Should NOT add category field');

    cleanupTempDir(tmpDir);
  });

  test('migratePoolIfNeeded on v1.1 pool does NOT create backup', () => {
    const tmpDir = createTempDir();
    const poolPath = path.join(tmpDir, 'pool.json');

    // Write v1.1 pool (exercises already have type field)
    const v11Pool = [
      { name: 'Pushups', reps: 15, type: 'reps', environments: ['anywhere'] },
      { name: 'Wall sit', reps: 30, type: 'timed', environments: ['anywhere'] }
    ];
    fs.writeFileSync(poolPath, JSON.stringify(v11Pool, null, 2));

    // Run migration
    migratePoolIfNeeded(poolPath);

    // Assert backup does NOT exist
    const backupPath = poolPath + '.v1.0.backup';
    assert.ok(!fs.existsSync(backupPath), 'Backup should NOT exist for v1.1 pool');

    cleanupTempDir(tmpDir);
  });

  test('migratePoolIfNeeded preserves user-added custom exercises', () => {
    const tmpDir = createTempDir();
    const poolPath = path.join(tmpDir, 'pool.json');

    // Write v1.0 pool with custom exercise
    const v1Pool = [
      { name: 'Custom jumping jacks', reps: 50 },
      { name: 'Custom burpees', reps: 10 }
    ];
    fs.writeFileSync(poolPath, JSON.stringify(v1Pool, null, 2));

    // Run migration
    const result = migratePoolIfNeeded(poolPath);

    // Assert name and reps preserved
    assert.strictEqual(result[0].name, 'Custom jumping jacks', 'Custom exercise name should be preserved');
    assert.strictEqual(result[0].reps, 50, 'Custom exercise reps should be preserved');
    assert.strictEqual(result[1].name, 'Custom burpees', 'Custom exercise name should be preserved');
    assert.strictEqual(result[1].reps, 10, 'Custom exercise reps should be preserved');

    cleanupTempDir(tmpDir);
  });

  test('migratePoolIfNeeded on missing pool file returns null', () => {
    const tmpDir = createTempDir();
    const poolPath = path.join(tmpDir, 'nonexistent.json');

    // Run migration on missing file
    const result = migratePoolIfNeeded(poolPath);

    // Assert returns null
    assert.strictEqual(result, null, 'Should return null for missing pool file');

    cleanupTempDir(tmpDir);
  });
});

describe('State migration', () => {
  test('migrateStateIfNeeded on v1.0 state creates .v1.0.backup', () => {
    const tmpDir = createTempDir();
    const statePath = path.join(tmpDir, 'state.json');

    // Write v1.0 state (no recentCategories)
    const v1State = {
      currentIndex: 3,
      lastTriggerTime: 1234567890,
      poolHash: 'abc123',
      totalTriggered: 10
    };
    fs.writeFileSync(statePath, JSON.stringify(v1State, null, 2));

    // Run migration
    migrateStateIfNeeded(statePath);

    // Assert backup exists
    const backupPath = statePath + '.v1.0.backup';
    assert.ok(fs.existsSync(backupPath), 'Backup file should exist');

    // Assert backup content matches original
    const backupContent = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    assert.deepStrictEqual(backupContent, v1State, 'Backup should match original v1.0 state');

    cleanupTempDir(tmpDir);
  });

  test('migrateStateIfNeeded adds recentCategories and schemaVersion', () => {
    const tmpDir = createTempDir();
    const statePath = path.join(tmpDir, 'state.json');

    // Write v1.0 state
    const v1State = {
      currentIndex: 5,
      lastTriggerTime: 9876543210,
      poolHash: 'xyz789',
      totalTriggered: 25
    };
    fs.writeFileSync(statePath, JSON.stringify(v1State, null, 2));

    // Run migration
    const result = migrateStateIfNeeded(statePath);

    // Assert v1.1 fields added
    assert.deepStrictEqual(result.recentCategories, [], 'Should add recentCategories: []');
    assert.strictEqual(result.schemaVersion, '1.1', 'Should add schemaVersion: "1.1"');

    cleanupTempDir(tmpDir);
  });

  test('migrateStateIfNeeded preserves currentIndex, lastTriggerTime, poolHash, totalTriggered', () => {
    const tmpDir = createTempDir();
    const statePath = path.join(tmpDir, 'state.json');

    // Write v1.0 state with specific values
    const v1State = {
      currentIndex: 7,
      lastTriggerTime: 1111111111,
      poolHash: 'def456',
      totalTriggered: 42
    };
    fs.writeFileSync(statePath, JSON.stringify(v1State, null, 2));

    // Run migration
    const result = migrateStateIfNeeded(statePath);

    // Assert existing fields preserved
    assert.strictEqual(result.currentIndex, 7, 'currentIndex should be preserved');
    assert.strictEqual(result.lastTriggerTime, 1111111111, 'lastTriggerTime should be preserved');
    assert.strictEqual(result.poolHash, 'def456', 'poolHash should be preserved');
    assert.strictEqual(result.totalTriggered, 42, 'totalTriggered should be preserved');

    cleanupTempDir(tmpDir);
  });

  test('migrateStateIfNeeded on v1.1 state does NOT create backup', () => {
    const tmpDir = createTempDir();
    const statePath = path.join(tmpDir, 'state.json');

    // Write v1.1 state (already has schemaVersion)
    const v11State = {
      currentIndex: 0,
      lastTriggerTime: 0,
      poolHash: 'ghi789',
      totalTriggered: 0,
      recentCategories: [],
      schemaVersion: '1.1'
    };
    fs.writeFileSync(statePath, JSON.stringify(v11State, null, 2));

    // Run migration
    migrateStateIfNeeded(statePath);

    // Assert backup does NOT exist
    const backupPath = statePath + '.v1.0.backup';
    assert.ok(!fs.existsSync(backupPath), 'Backup should NOT exist for v1.1 state');

    cleanupTempDir(tmpDir);
  });

  test('migrateStateIfNeeded on missing state file returns null', () => {
    const tmpDir = createTempDir();
    const statePath = path.join(tmpDir, 'nonexistent.json');

    // Run migration on missing file
    const result = migrateStateIfNeeded(statePath);

    // Assert returns null
    assert.strictEqual(result, null, 'Should return null for missing state file');

    cleanupTempDir(tmpDir);
  });
});
