/**
 * Tests for Configuration Module
 *
 * Tests cover config validation, load/save with graceful recovery, and equipment keys.
 * Uses Node.js built-in test runner with temporary directories.
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Module under test
const {
  EQUIPMENT_KEYS,
  DEFAULT_CONFIG,
  validateConfig,
  loadConfig,
  saveConfig,
  getConfigPath
} = require('../lib/config.js');

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

describe('Config Module - Equipment Keys', () => {
  test('EQUIPMENT_KEYS contains all four equipment types', () => {
    assert.ok(EQUIPMENT_KEYS, 'EQUIPMENT_KEYS should be defined');
    assert.strictEqual(typeof EQUIPMENT_KEYS.KETTLEBELL, 'string');
    assert.strictEqual(typeof EQUIPMENT_KEYS.DUMBBELLS, 'string');
    assert.strictEqual(typeof EQUIPMENT_KEYS.PULL_UP_BAR, 'string');
    assert.strictEqual(typeof EQUIPMENT_KEYS.PARALLETTES, 'string');
    assert.strictEqual(EQUIPMENT_KEYS.KETTLEBELL, 'kettlebell');
    assert.strictEqual(EQUIPMENT_KEYS.DUMBBELLS, 'dumbbells');
    assert.strictEqual(EQUIPMENT_KEYS.PULL_UP_BAR, 'pullUpBar');
    assert.strictEqual(EQUIPMENT_KEYS.PARALLETTES, 'parallettes');
  });
});

describe('Config Module - Default Configuration', () => {
  test('DEFAULT_CONFIG has all equipment set to false', () => {
    assert.ok(DEFAULT_CONFIG, 'DEFAULT_CONFIG should be defined');
    assert.ok(DEFAULT_CONFIG.equipment, 'equipment field should exist');
    assert.strictEqual(DEFAULT_CONFIG.equipment.kettlebell, false);
    assert.strictEqual(DEFAULT_CONFIG.equipment.dumbbells, false);
    assert.strictEqual(DEFAULT_CONFIG.equipment.pullUpBar, false);
    assert.strictEqual(DEFAULT_CONFIG.equipment.parallettes, false);
  });

  test('DEFAULT_CONFIG has difficulty.multiplier set to 1.0', () => {
    assert.ok(DEFAULT_CONFIG.difficulty, 'difficulty field should exist');
    assert.strictEqual(DEFAULT_CONFIG.difficulty.multiplier, 1.0);
  });
});

describe('Config Module - Validation', () => {
  test('validateConfig accepts valid config', () => {
    const result = validateConfig(DEFAULT_CONFIG);
    assert.strictEqual(result, true);
  });

  test('validateConfig rejects null/undefined', () => {
    assert.strictEqual(validateConfig(null), false);
    assert.strictEqual(validateConfig(undefined), false);
  });

  test('validateConfig rejects missing equipment field', () => {
    const result = validateConfig({});
    assert.strictEqual(result, false);
  });

  test('validateConfig rejects non-boolean equipment values', () => {
    const invalidConfig = {
      equipment: {
        kettlebell: "yes"
      }
    };
    assert.strictEqual(validateConfig(invalidConfig), false);
  });

  test('validateConfig accepts partial equipment (missing keys treated as false)', () => {
    const partialConfig = {
      equipment: {
        kettlebell: true
      }
    };
    assert.strictEqual(validateConfig(partialConfig), true);
  });

  test('validateConfig accepts config with difficulty field', () => {
    const configWithDifficulty = {
      equipment: {
        kettlebell: false,
        dumbbells: false,
        pullUpBar: false,
        parallettes: false
      },
      difficulty: {
        multiplier: 1.5
      }
    };
    assert.strictEqual(validateConfig(configWithDifficulty), true);
  });

  test('validateConfig rejects non-object difficulty field', () => {
    const invalidDifficulty = {
      equipment: {
        kettlebell: false,
        dumbbells: false,
        pullUpBar: false,
        parallettes: false
      },
      difficulty: "hard"
    };
    assert.strictEqual(validateConfig(invalidDifficulty), false);
  });

  test('validateConfig rejects non-numeric difficulty multiplier', () => {
    const invalidMultiplier = {
      equipment: {
        kettlebell: false,
        dumbbells: false,
        pullUpBar: false,
        parallettes: false
      },
      difficulty: {
        multiplier: "1.5"
      }
    };
    assert.strictEqual(validateConfig(invalidMultiplier), false);
  });
});

describe('Config Module - Load/Save', () => {
  let tmpDir;
  let tmpConfigPath;

  beforeEach(() => {
    tmpDir = createTempStateDir();
    tmpConfigPath = path.join(tmpDir, 'configuration.json');
  });

  afterEach(() => {
    cleanupTempStateDir(tmpDir);
  });

  test('loadConfig returns defaults when file missing', () => {
    const result = loadConfig(tmpConfigPath);
    assert.deepStrictEqual(result, DEFAULT_CONFIG);
  });

  test('loadConfig returns defaults when file contains invalid JSON', () => {
    fs.writeFileSync(tmpConfigPath, 'GARBAGE{not valid json}', 'utf8');
    const result = loadConfig(tmpConfigPath);
    assert.deepStrictEqual(result, DEFAULT_CONFIG);
  });

  test('loadConfig returns defaults when config structure invalid', () => {
    const invalidJson = JSON.stringify({ wrong: 'structure' });
    fs.writeFileSync(tmpConfigPath, invalidJson, 'utf8');
    const result = loadConfig(tmpConfigPath);
    assert.deepStrictEqual(result, DEFAULT_CONFIG);
  });

  test('loadConfig returns valid config from file', () => {
    const validConfig = {
      equipment: {
        kettlebell: true,
        dumbbells: false,
        pullUpBar: false,
        parallettes: false
      },
      difficulty: {
        multiplier: 1.0
      }
    };
    fs.writeFileSync(tmpConfigPath, JSON.stringify(validConfig), 'utf8');
    const result = loadConfig(tmpConfigPath);

    // loadConfig normalizes by adding v1.1 fields with defaults
    const expected = {
      ...validConfig,
      environment: "anywhere",
      schemaVersion: "1.0"
    };
    assert.deepStrictEqual(result, expected);
  });

  test('loadConfig normalizes missing difficulty field', () => {
    const configWithoutDifficulty = {
      equipment: {
        kettlebell: true,
        dumbbells: false,
        pullUpBar: false,
        parallettes: false
      }
    };
    fs.writeFileSync(tmpConfigPath, JSON.stringify(configWithoutDifficulty), 'utf8');
    const result = loadConfig(tmpConfigPath);

    // Should add difficulty with default multiplier
    assert.ok(result.difficulty, 'difficulty field should be added');
    assert.strictEqual(result.difficulty.multiplier, 1.0);
  });

  test('loadConfig preserves custom difficulty multiplier', () => {
    const configWithCustomDifficulty = {
      equipment: {
        kettlebell: false,
        dumbbells: false,
        pullUpBar: false,
        parallettes: false
      },
      difficulty: {
        multiplier: 2.0
      }
    };
    fs.writeFileSync(tmpConfigPath, JSON.stringify(configWithCustomDifficulty), 'utf8');
    const result = loadConfig(tmpConfigPath);

    assert.strictEqual(result.difficulty.multiplier, 2.0);
  });

  test('saveConfig writes config atomically with secure permissions', () => {
    const testConfig = {
      equipment: {
        kettlebell: true,
        dumbbells: true,
        pullUpBar: false,
        parallettes: false
      }
    };

    // Save config
    saveConfig(tmpConfigPath, testConfig);

    // Verify file exists
    assert.ok(fs.existsSync(tmpConfigPath), 'Config file should exist');

    // Read back and verify content
    const content = fs.readFileSync(tmpConfigPath, 'utf8');
    const loaded = JSON.parse(content);
    assert.deepStrictEqual(loaded, testConfig);

    // Verify file permissions (Unix only)
    if (process.platform !== 'win32') {
      const stats = fs.statSync(tmpConfigPath);
      const mode = stats.mode & 0o777;
      assert.strictEqual(mode, 0o600, 'Config file should have 0600 permissions');
    }
  });
});

describe('Config Module - v1.1 config schema', () => {
  let tmpDir;
  let tmpConfigPath;

  beforeEach(() => {
    tmpDir = createTempStateDir();
    tmpConfigPath = path.join(tmpDir, 'configuration.json');
  });

  afterEach(() => {
    cleanupTempStateDir(tmpDir);
  });

  test('v1.0 config without environment field passes validateConfig', () => {
    const v10Config = {
      equipment: {
        kettlebell: false,
        dumbbells: false,
        pullUpBar: false,
        parallettes: false
      }
    };
    assert.strictEqual(validateConfig(v10Config), true);
  });

  test('v1.1 config with environment: "office" passes validateConfig', () => {
    const v11Config = {
      equipment: {
        kettlebell: false,
        dumbbells: false,
        pullUpBar: false,
        parallettes: false
      },
      environment: "office"
    };
    assert.strictEqual(validateConfig(v11Config), true);
  });

  test('v1.1 config with environment: "anywhere" passes validateConfig', () => {
    const v11Config = {
      equipment: {
        kettlebell: false,
        dumbbells: false,
        pullUpBar: false,
        parallettes: false
      },
      environment: "anywhere"
    };
    assert.strictEqual(validateConfig(v11Config), true);
  });

  test('non-string environment rejected', () => {
    const invalidEnv = {
      equipment: {
        kettlebell: false,
        dumbbells: false,
        pullUpBar: false,
        parallettes: false
      },
      environment: 123
    };
    assert.strictEqual(validateConfig(invalidEnv), false);
  });

  test('v1.1 config with schemaVersion: "1.1" passes validateConfig', () => {
    const v11Config = {
      equipment: {
        kettlebell: false,
        dumbbells: false,
        pullUpBar: false,
        parallettes: false
      },
      schemaVersion: "1.1"
    };
    assert.strictEqual(validateConfig(v11Config), true);
  });

  test('non-string schemaVersion rejected', () => {
    const invalidSchema = {
      equipment: {
        kettlebell: false,
        dumbbells: false,
        pullUpBar: false,
        parallettes: false
      },
      schemaVersion: 1.1
    };
    assert.strictEqual(validateConfig(invalidSchema), false);
  });

  test('loadConfig normalizes missing environment to "anywhere"', () => {
    const configWithoutEnvironment = {
      equipment: {
        kettlebell: false,
        dumbbells: false,
        pullUpBar: false,
        parallettes: false
      }
    };
    fs.writeFileSync(tmpConfigPath, JSON.stringify(configWithoutEnvironment), 'utf8');
    const result = loadConfig(tmpConfigPath);

    assert.strictEqual(result.environment, "anywhere");
  });

  test('loadConfig normalizes missing schemaVersion to "1.0"', () => {
    const configWithoutSchema = {
      equipment: {
        kettlebell: false,
        dumbbells: false,
        pullUpBar: false,
        parallettes: false
      }
    };
    fs.writeFileSync(tmpConfigPath, JSON.stringify(configWithoutSchema), 'utf8');
    const result = loadConfig(tmpConfigPath);

    assert.strictEqual(result.schemaVersion, "1.0");
  });

  test('loadConfig preserves explicit environment value', () => {
    const configWithEnvironment = {
      equipment: {
        kettlebell: false,
        dumbbells: false,
        pullUpBar: false,
        parallettes: false
      },
      environment: "office"
    };
    fs.writeFileSync(tmpConfigPath, JSON.stringify(configWithEnvironment), 'utf8');
    const result = loadConfig(tmpConfigPath);

    assert.strictEqual(result.environment, "office");
  });

  test('DEFAULT_CONFIG includes environment and schemaVersion fields', () => {
    assert.ok(DEFAULT_CONFIG.environment, 'DEFAULT_CONFIG should have environment field');
    assert.strictEqual(DEFAULT_CONFIG.environment, "anywhere");
    assert.ok(DEFAULT_CONFIG.schemaVersion, 'DEFAULT_CONFIG should have schemaVersion field');
    assert.strictEqual(DEFAULT_CONFIG.schemaVersion, "1.0");
  });
});
