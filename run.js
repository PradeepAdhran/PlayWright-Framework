require('dotenv').config(); // load .env before reading any process.env

const { spawnSync } = require('child_process');
const { createLogger } = require('./utils/logger');

const log = createLogger('runner');

// ── Read flags ────────────────────────────────────────────────────────────────
const ENV       = (process.env.ENV      || 'uat').toLowerCase();
const HEADLESS  = (process.env.HEADLESS || 'false').toLowerCase() === 'true';
const ALLURE    = (process.env.ALLURE   || 'false').toLowerCase() === 'true';
const WORKERS   = parseInt(process.env.WORKERS || process.env.WORKER || '1', 10);
const LOG_LEVEL = (process.env.LOG_LEVEL || 'INFO').toUpperCase();

const JAVA_HOME = '/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home';

console.log('\n╔══════════════════════════════════════════╗');
console.log(`║  ENV       : ${ENV.toUpperCase().padEnd(28)}║`);
console.log(`║  HEADLESS  : ${String(HEADLESS).padEnd(28)}║`);
console.log(`║  WORKERS   : ${String(WORKERS).padEnd(28)}║`);
console.log(`║  ALLURE    : ${String(ALLURE).padEnd(28)}║`);
console.log(`║  LOG_LEVEL : ${LOG_LEVEL.padEnd(28)}║`);
console.log('╚══════════════════════════════════════════╝\n');

const sharedEnv = {
  ...process.env,
  ENV,
  HEADLESS: String(HEADLESS),
  WORKERS:  String(WORKERS),
  LOG_LEVEL,
  JAVA_HOME,
};

// ── Run Playwright tests ──────────────────────────────────────────────────────
log.info(`Starting test run — ENV=${ENV.toUpperCase()} WORKERS=${WORKERS} HEADLESS=${HEADLESS}`);

const testResult = spawnSync('npx', ['playwright', 'test'], {
  stdio: 'inherit',
  env: sharedEnv,
});

if (testResult.status === 0) {
  log.info('All tests passed.');
} else {
  log.warn(`Test run finished with exit code ${testResult.status} — check report for failures.`);
}

// ── Open Allure report if requested ──────────────────────────────────────────
if (ALLURE) {
  log.info('Generating Allure report...');

  const generate = spawnSync(
    'npx', ['allure', 'generate', './reports/allure-results', '--clean', '-o', './reports/allure-report'],
    { stdio: 'inherit', env: sharedEnv }
  );

  if (generate.status === 0) {
    log.info('Allure report generated — opening in browser...');
    spawnSync('npx', ['allure', 'open', './reports/allure-report'], { stdio: 'inherit', env: sharedEnv });
  } else {
    log.error('Allure report generation failed. Make sure "allure" is installed: brew install allure');
  }
}

process.exit(testResult.status ?? 0);
