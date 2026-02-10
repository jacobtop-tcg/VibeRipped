/**
 * Setup Command Handler
 *
 * Interactive first-time setup wizard for VibeRipped configuration.
 * Guides user through equipment selection and generates config + pool files.
 */

const fs = require('fs');
const path = require('path');
const writeFileAtomic = require('write-file-atomic');
const { requireTTY } = require(path.join(__dirname, '../ui/tty.js'));
const { CheckboxPrompt } = require(path.join(__dirname, '../ui/checkbox.js'));
const { confirm } = require(path.join(__dirname, '../ui/confirm.js'));
const { loadConfig, saveConfig, getConfigPath } = require(path.join(__dirname, '../../config.js'));
const { assemblePool, computePoolHash } = require(path.join(__dirname, '../../pool.js'));
const { getStateDir } = require(path.join(__dirname, '../../state.js'));
const { success, error, info } = require(path.join(__dirname, '../output.js'));

/**
 * Setup wizard command handler.
 *
 * Flow:
 * 1. TTY guard - exit if not interactive terminal
 * 2. Check existing config - confirm overwrite if present
 * 3. Welcome message
 * 4. Equipment selection via checkbox
 * 5. Build config object
 * 6. Save config
 * 7. Generate pool
 * 8. Print summary with next steps
 */
async function setup() {
  // 1. TTY guard
  if (!requireTTY('setup')) {
    return;
  }

  // 2. Check existing config
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    const shouldOverwrite = await confirm('Existing configuration found. Overwrite?');
    if (!shouldOverwrite) {
      info('Setup cancelled. Existing configuration preserved.');
      process.exitCode = 0;
      return;
    }
  }

  // 3. Welcome message
  info('');
  info('Welcome to VibeRipped setup!');
  info('Select your available equipment using arrow keys and space bar.');
  info('Press Enter when done.');
  info('');

  // 4. Equipment selection
  const choices = [
    { label: 'Kettlebell', value: 'kettlebell', checked: false },
    { label: 'Dumbbells', value: 'dumbbells', checked: false },
    { label: 'Pull-up bar', value: 'pullUpBar', checked: false },
    { label: 'Parallettes', value: 'parallettes', checked: false },
  ];

  const checkboxPrompt = new CheckboxPrompt(
    'Select equipment (Space to toggle, Enter to confirm):',
    choices
  );

  let selected;
  try {
    selected = await checkboxPrompt.prompt();
  } catch (e) {
    // User cancelled with Escape
    info('Setup cancelled.');
    process.exitCode = 0;
    return;
  }

  // 5. Build config
  const config = {
    equipment: {
      kettlebell: selected.includes('kettlebell'),
      dumbbells: selected.includes('dumbbells'),
      pullUpBar: selected.includes('pullUpBar'),
      parallettes: selected.includes('parallettes'),
    },
    difficulty: { multiplier: 1.0 },
    environment: 'anywhere',
    schemaVersion: '1.0'
  };

  // 6. Save config
  saveConfig(configPath, config);

  // 7. Generate pool
  const pool = assemblePool(config);
  const stateDir = getStateDir();
  fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });

  const poolPath = path.join(stateDir, 'pool.json');
  writeFileAtomic.sync(poolPath, JSON.stringify(pool, null, 2), { mode: 0o600 });

  // 8. Print summary
  success('Setup complete!');
  info('');

  // List enabled equipment
  const enabledEquipment = [];
  if (config.equipment.kettlebell) enabledEquipment.push('kettlebell');
  if (config.equipment.dumbbells) enabledEquipment.push('dumbbells');
  if (config.equipment.pullUpBar) enabledEquipment.push('pull-up bar');
  if (config.equipment.parallettes) enabledEquipment.push('parallettes');

  if (enabledEquipment.length > 0) {
    info('Equipment enabled: ' + enabledEquipment.join(', '));
  } else {
    info('Equipment: bodyweight only');
  }

  info('Pool generated with ' + pool.length + ' exercises.');
  info('');
  info('Next steps:');
  info('  viberipped test     Preview your first exercise');
  info('  viberipped harder   Increase difficulty');
  info('  viberipped softer   Decrease difficulty');

  process.exitCode = 0;
}

module.exports = setup;
