/**
 * CheckboxPrompt - Interactive multi-select widget
 *
 * Provides arrow-key navigation, space-bar toggle, and enter to submit.
 * Handles terminal cleanup on all exit paths.
 */

const readline = require('readline');

// ANSI escape codes for terminal control
const CLEAR_LINE = '\x1b[2K';
const CURSOR_TO_START = '\x1b[G';
const CURSOR_UP = (n) => `\x1b[${n}A`;
const COLOR_CYAN = '\x1b[36m';
const COLOR_RESET = '\x1b[0m';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';

// Unicode checkbox characters
const UNCHECKED = '\u2610';
const CHECKED = '\u2611';

/**
 * Interactive checkbox multi-select prompt.
 */
class CheckboxPrompt {
  /**
   * Creates a new checkbox prompt.
   *
   * @param {string} message - Message displayed above choices
   * @param {Array<{label: string, value: any, checked: boolean}>} choices - Items to select from
   */
  constructor(message, choices) {
    this.message = message;
    this.choices = choices;
    this.selectedIndex = 0;
    this.rendered = false;
  }

  /**
   * Renders the prompt to stdout.
   * On subsequent renders, moves cursor up to redraw in place.
   */
  render() {
    // If previously rendered, move cursor back up
    if (this.rendered) {
      process.stdout.write(CURSOR_UP(this.choices.length + 1));
    }

    // Clear and write message line
    process.stdout.write(CLEAR_LINE + CURSOR_TO_START);
    process.stdout.write(this.message + '\n');

    // Render each choice
    this.choices.forEach((choice, index) => {
      process.stdout.write(CLEAR_LINE + CURSOR_TO_START);

      const pointer = index === this.selectedIndex ? '>' : ' ';
      const checkbox = choice.checked ? CHECKED : UNCHECKED;
      const label = choice.label;

      // Highlight current selection in cyan
      if (index === this.selectedIndex) {
        process.stdout.write(`${COLOR_CYAN}${pointer} ${checkbox} ${label}${COLOR_RESET}\n`);
      } else {
        process.stdout.write(`${pointer} ${checkbox} ${label}\n`);
      }
    });

    this.rendered = true;
  }

  /**
   * Displays the prompt and waits for user interaction.
   *
   * @returns {Promise<Array>} - Array of selected values
   */
  prompt() {
    return new Promise((resolve, reject) => {
      let keypressListener;
      let sigintListener;

      // Cleanup function - MUST be called on all exit paths
      const cleanup = () => {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        if (keypressListener) {
          process.stdin.removeListener('keypress', keypressListener);
        }
        if (sigintListener) {
          process.removeListener('SIGINT', sigintListener);
        }
        process.stdout.write(SHOW_CURSOR);
      };

      // Setup keypress handling
      readline.emitKeypressEvents(process.stdin);
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdout.write(HIDE_CURSOR);

      // SIGINT handler (Ctrl+C)
      sigintListener = () => {
        cleanup();
        process.stdout.write('\n');
        process.exit(0);
      };
      process.on('SIGINT', sigintListener);

      // Initial render
      this.render();

      // Keypress handler
      keypressListener = (str, key) => {
        if (!key) return;

        if (key.name === 'up') {
          this.selectedIndex = Math.max(0, this.selectedIndex - 1);
          this.render();
        } else if (key.name === 'down') {
          this.selectedIndex = Math.min(this.choices.length - 1, this.selectedIndex + 1);
          this.render();
        } else if (key.name === 'space') {
          this.choices[this.selectedIndex].checked = !this.choices[this.selectedIndex].checked;
          this.render();
        } else if (key.name === 'return' || key.name === 'enter') {
          cleanup();
          const selected = this.choices.filter(c => c.checked).map(c => c.value);
          resolve(selected);
        } else if (key.name === 'escape') {
          cleanup();
          reject(new Error('Cancelled'));
        } else if (key.ctrl && key.name === 'c') {
          // Handled by SIGINT listener
          return;
        }
      };

      process.stdin.on('keypress', keypressListener);
    });
  }
}

module.exports = { CheckboxPrompt };
