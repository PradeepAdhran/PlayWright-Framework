const { spawnSync } = require('child_process');

// ── Read flags ────────────────────────────────────────────────────────────────
const ENV      = (process.env.ENV     || 'uat').toLowerCase();
const HEADLESS = (process.env.HEADLESS || 'false').toLowerCase() === 'true';
const ALLURE   = (process.env.ALLURE  || 'false').toLowerCase() === 'true';
const WORKERS  = parseInt(process.env.WORKERS || process.env.WORKER || '1', 10);

const JAVA_HOME = '/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home';

console.log('\n╔══════════════════════════════════════════╗');
console.log(`║  ENV      : ${ENV.toUpperCase().padEnd(29)}║`);
console.log(`║  HEADLESS : ${String(HEADLESS).padEnd(29)}║`);
console.log(`║  WORKERS  : ${String(WORKERS).padEnd(29)}║`);
console.log(`║  ALLURE   : ${String(ALLURE).padEnd(29)}║`);
console.log('╚══════════════════════════════════════════╝\n');

const sharedEnv = { ...process.env, ENV, HEADLESS: String(HEADLESS), WORKERS: String(WORKERS), JAVA_HOME };

// ── Run Playwright tests ──────────────────────────────────────────────────────
const testResult = spawnSync('npx', ['playwright', 'test'], {
  stdio: 'inherit',
  env: sharedEnv,
});

// ── Open Allure report if requested (runs even if tests failed) ───────────────
if (ALLURE) {
  console.log('\n Generating Allure report...\n');

  const generate = spawnSync(
    'npx', ['allure', 'generate', './reports/allure-results', '--clean', '-o', './reports/allure-report'],
    { stdio: 'inherit', env: sharedEnv }
  );

  if (generate.status === 0) {
    spawnSync(
      'npx', ['allure', 'open', './reports/allure-report'],
      { stdio: 'inherit', env: sharedEnv }
    );
  } else {
    console.error('\n Allure report generation failed.');
    console.error(' Make sure "allure" is installed: brew install allure\n');
  }
}

process.exit(testResult.status ?? 0);
