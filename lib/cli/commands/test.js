/**
 * Test Command Handler
 *
 * Previews next exercise without advancing rotation state.
 * Uses dryRun mode to prevent state persistence.
 */

const path = require('path');
const { trigger } = require(path.join(__dirname, '../../../engine'));
const { error, info } = require(path.join(__dirname, '../output'));

/**
 * Handles test command - dry-run preview of next exercise.
 */
function testHandler() {
  try {
    // Trigger with bypassCooldown (always show exercise) and dryRun (don't save state)
    const result = trigger(null, { bypassCooldown: true, dryRun: true });

    if (result.type === 'exercise') {
      // Success - display exercise preview
      info('Next exercise: ' + result.prompt);
      info('Position: ' + (result.position.current + 1) + ' of ' + result.position.total);
      info('Total triggered: ' + result.totalTriggered);
      info('');
      info('(dry-run: rotation state unchanged)');

      process.exitCode = 0;
    } else {
      // Unexpected result type
      error('Unexpected result type: ' + result.type);
      process.exitCode = 1;
    }
  } catch (e) {
    // Error during trigger
    error('Test failed: ' + e.message);
    process.exitCode = 1;
  }
}

module.exports = testHandler;
