#!/usr/bin/env node

/**
 * VibeRipped CLI
 *
 * Command-line interface for exercise rotation configuration and testing.
 */

const { Command } = require('commander');
const path = require('path');
const packageJson = require(path.join(__dirname, '../package.json'));

// Initialize program
const program = new Command();

program
  .name('viberipped')
  .description('VibeRipped CLI - Deterministic micro-exercise rotation')
  .version(packageJson.version);

// Config command - equipment configuration and environment management
const configCmd = program.command('config')
  .description('Show or manage configuration')
  .action((options) => {
    // No subcommand = show mode (existing behavior)
    const configHandler = require(path.join(__dirname, '../lib/cli/commands/config.js'));
    configHandler.show(options);
  });

// Keep existing equipment flags on the base config command for backward compat
configCmd
  .option('--kettlebell', 'Enable kettlebell exercises')
  .option('--no-kettlebell', 'Disable kettlebell exercises')
  .option('--dumbbells', 'Enable dumbbell exercises')
  .option('--no-dumbbells', 'Disable dumbbell exercises')
  .option('--pull-up-bar', 'Enable pull-up bar exercises')
  .option('--no-pull-up-bar', 'Disable pull-up bar exercises')
  .option('--parallettes', 'Enable parallettes exercises')
  .option('--no-parallettes', 'Disable parallettes exercises');

configCmd
  .command('set <key> <value>')
  .description('Set configuration value (e.g., environment)')
  .action((key, value) => {
    const configHandler = require(path.join(__dirname, '../lib/cli/commands/config.js'));
    configHandler.set(key, value);
  });

configCmd
  .command('get <key>')
  .description('Get configuration value')
  .action((key) => {
    const configHandler = require(path.join(__dirname, '../lib/cli/commands/config.js'));
    configHandler.get(key);
  });

// Pool command group - exercise pool management
const poolCmd = new Command('pool')
  .description('Manage exercise pool');

poolCmd
  .command('list')
  .alias('ls')
  .description('List exercises in current pool')
  .action(() => {
    const poolHandler = require(path.join(__dirname, '../lib/cli/commands/pool.js'));
    poolHandler.list();
  });

poolCmd
  .command('add <name> <reps>')
  .description('Add exercise to pool')
  .option('--type <type>', 'Exercise type: reps or timed', 'reps')
  .option('--duration <seconds>', 'Duration in seconds (for timed exercises)')
  .option('--environments <envs>', 'Comma-separated environments (e.g., "home,office")')
  .action((name, reps, options) => {
    const poolHandler = require(path.join(__dirname, '../lib/cli/commands/pool.js'));
    poolHandler.add(name, reps, options);
  });

poolCmd
  .command('remove <name>')
  .alias('rm')
  .description('Remove exercise from pool')
  .action((name) => {
    const poolHandler = require(path.join(__dirname, '../lib/cli/commands/pool.js'));
    poolHandler.remove(name);
  });

program.addCommand(poolCmd);

// Test command - dry-run preview
program
  .command('test')
  .description('Preview next exercise without advancing rotation')
  .action(() => {
    const testHandler = require(path.join(__dirname, '../lib/cli/commands/test.js'));
    testHandler();
  });

// Harder command - increase difficulty
program
  .command('harder')
  .description('Increase difficulty multiplier by one step')
  .action(() => {
    const harderHandler = require(path.join(__dirname, '../lib/cli/commands/harder.js'));
    harderHandler();
  });

// Softer command - decrease difficulty
program
  .command('softer')
  .description('Decrease difficulty multiplier by one step')
  .action(() => {
    const softerHandler = require(path.join(__dirname, '../lib/cli/commands/softer.js'));
    softerHandler();
  });

// Setup command - interactive first-time setup wizard
program
  .command('setup')
  .description('Launch interactive setup wizard for first-time configuration')
  .action(async () => {
    const setupHandler = require(path.join(__dirname, '../lib/cli/commands/setup.js'));
    await setupHandler();
  });

// Show help if no arguments
if (process.argv.length === 2) {
  program.outputHelp();
}

// Parse arguments
program.parse(process.argv);
