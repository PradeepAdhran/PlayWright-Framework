const fs = require('fs');
const path = require('path');

const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };

const C = {
  DEBUG: '\x1b[90m',   // gray
  INFO:  '\x1b[36m',   // cyan
  WARN:  '\x1b[33m',   // yellow
  ERROR: '\x1b[31m',   // red
  BOLD:  '\x1b[1m',
  RESET: '\x1b[0m',
};

const LOG_FILE = path.resolve('./reports/run.log');

const minLevel = LEVELS[(process.env.LOG_LEVEL || 'INFO').toUpperCase()] ?? LEVELS.INFO;

function createLogger(tag) {
  function write(level, ...args) {
    if (LEVELS[level] < minLevel) return;

    const ts = new Date().toISOString();
    const msg = args.join(' ');
    const lvl = level.padEnd(5);
    const plain   = `[${ts}] [${lvl}] [${tag}] ${msg}`;
    const colored = `${C[level]}[${ts}] [${C.BOLD}${lvl}${C.RESET}${C[level]}] [${tag}]${C.RESET} ${msg}`;

    if (level === 'ERROR') {
      process.stderr.write(colored + '\n');
    } else {
      process.stdout.write(colored + '\n');
    }

    // Append plain text to the run log file (best-effort)
    try {
      fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
      fs.appendFileSync(LOG_FILE, plain + '\n');
    } catch { /* ignore if reports dir not yet created */ }
  }

  return {
    debug: (...a) => write('DEBUG', ...a),
    info:  (...a) => write('INFO',  ...a),
    warn:  (...a) => write('WARN',  ...a),
    error: (...a) => write('ERROR', ...a),
  };
}

module.exports = { createLogger };
