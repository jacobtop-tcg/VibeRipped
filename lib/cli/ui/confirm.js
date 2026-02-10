/**
 * Confirm Prompt
 *
 * Simple Y/N confirmation utility for CLI commands.
 */

const readline = require('readline/promises');

/**
 * Displays a yes/no confirmation prompt.
 * Default is No (pressing Enter returns false).
 *
 * @param {string} message - Question to ask user
 * @returns {Promise<boolean>} - true for yes, false for no
 */
async function confirm(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const answer = await rl.question(`${message} (y/N): `);
    const normalized = answer.trim().toLowerCase();
    return normalized === 'y' || normalized === 'yes';
  } finally {
    rl.close();
  }
}

module.exports = { confirm };
