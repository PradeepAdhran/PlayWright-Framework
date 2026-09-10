const { spawn, spawnSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

module.exports = async function globalSetup() {
  // ── Clean all previous run artifacts ──────────────────────────────
  const cleanDirs = [
    './reports/allure-results',
    './reports/allure-report',
    './reports/screenshots',
    './reports/videos',
    './test-results',
  ];
  for (const dir of cleanDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
  console.log('\n[setup] Cleared previous run reports, screenshots and videos.');

  const ENV     = process.env.ENV || 'uat';
  const WORKERS = parseInt(process.env.WORKERS || process.env.WORKER || '1', 10);
  const HEADLESS = process.env.HEADLESS === 'true';

  const envConfig = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `./environments/${ENV}.json`), 'utf-8')
  );

  // Write Allure environment info
  fs.writeFileSync(
    './reports/allure-results/environment.properties',
    [
      `Environment=${ENV.toUpperCase()}`,
      `Android.Version=${envConfig.platformVersion}`,
      `App.Package=${envConfig.appPackage}`,
      `APK.File=${envConfig.apkFile}`,
      `Workers=${WORKERS}`,
    ].join('\n')
  );

  // ── Launch emulators (one per worker) ─────────────────────────────
  const avdPool = (envConfig.avdNames || (envConfig.avdName ? [envConfig.avdName] : [])).filter(Boolean);

  if (avdPool.length === 0) {
    console.warn('[setup] No avdName/avdNames in env config — skipping emulator launch.');
  } else {
    if (WORKERS > avdPool.length) {
      throw new Error(
        `WORKERS=${WORKERS} but only ${avdPool.length} AVD(s) are listed in environments/${ENV}.json → avdNames.\n` +
        `Add more AVD names or reduce WORKERS.`
      );
    }
    await launchEmulators(avdPool.slice(0, WORKERS), HEADLESS);
  }

  // ── Start Appium server ────────────────────────────────────────────
  const appiumBin = path.resolve('./node_modules/.bin/appium');
  const logStream = fs.openSync('./reports/appium.log', 'w');

  const appiumProcess = spawn(appiumBin, ['--relaxed-security'], {
    detached: true,
    stdio: ['ignore', logStream, logStream],
  });

  fs.writeFileSync('.appium.pid', String(appiumProcess.pid));
  appiumProcess.unref();

  console.log(`\n[setup] Appium server starting (PID: ${appiumProcess.pid})...`);
  await waitForAppium();
  console.log('[setup] Appium server is ready.\n');
};

// ── Multi-emulator launch ──────────────────────────────────────────────────────

async function launchEmulators(avdList, headless) {
  const ANDROID_HOME =
    process.env.ANDROID_HOME ||
    path.join(process.env.HOME || '', 'Library', 'Android', 'sdk');

  const adbBin      = path.join(ANDROID_HOME, 'platform-tools', 'adb');
  const emulatorBin = path.join(ANDROID_HOME, 'emulator', 'emulator');

  if (!fs.existsSync(emulatorBin)) {
    throw new Error(`emulator binary not found: ${emulatorBin}\nEnsure ANDROID_HOME is set.`);
  }

  // Kill any currently running emulators so we start fresh
  const running = listEmulators(adbBin);
  if (running.length > 0) {
    console.log(`[setup] Stopping existing emulator(s): ${running.join(', ')}...`);
    for (const id of running) {
      spawnSync(adbBin, ['-s', id, 'emu', 'kill'], { timeout: 5000 });
    }
    await waitUntilNoEmulators(adbBin, 12000);
  }

  const mode = headless ? 'headless (no window)' : 'windowed (visible)';
  const deviceMap = {};

  for (let i = 0; i < avdList.length; i++) {
    const avdName = avdList[i];
    const beforeSerials = listAllEmulatorSerials(adbBin);

    console.log(`[setup] [${i + 1}/${avdList.length}] Launching "${avdName}" in ${mode} mode...`);

    const args = ['-avd', avdName];
    if (headless) args.push('-no-window', '-no-audio');

    spawn(emulatorBin, args, { detached: true, stdio: 'ignore' }).unref();

    // Wait for this emulator process to register in adb devices
    const serial = await waitForNewEmulator(adbBin, beforeSerials, 30000);
    console.log(`[setup] Emulator appeared as ${serial} → assigned to worker ${i}`);

    await waitForEmulatorBoot(adbBin, serial, 180000);
    console.log(`[setup] ${serial} is fully booted.`);

    deviceMap[i] = serial;
  }

  // Persist mapping so each Playwright worker can read its assigned device
  fs.writeFileSync('.device-map.json', JSON.stringify(deviceMap, null, 2));
  console.log(`[setup] Device map: ${JSON.stringify(deviceMap)}`);
}

// Returns serials of emulators in ANY state (device, offline, unauthorized)
function listAllEmulatorSerials(adbBin) {
  const out = spawnSync(adbBin, ['devices'], { encoding: 'utf-8', timeout: 5000 }).stdout || '';
  return out.split('\n')
    .filter(l => /^emulator-\d+/.test(l))
    .map(l => l.trim().split(/\s+/)[0]);
}

// Returns serials of emulators currently in `device` (online) state
function listEmulators(adbBin) {
  const out = spawnSync(adbBin, ['devices'], { encoding: 'utf-8', timeout: 5000 }).stdout || '';
  return out.split('\n')
    .filter(l => /^emulator-\d+\s+device/.test(l))
    .map(l => l.trim().split(/\s+/)[0]);
}

async function waitUntilNoEmulators(adbBin, maxMs = 12000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (listAllEmulatorSerials(adbBin).length === 0) return;
    await new Promise(r => setTimeout(r, 1000));
  }
}

// Polls until a new serial appears that was not in beforeSerials
async function waitForNewEmulator(adbBin, beforeSerials, maxMs = 30000) {
  const seen = new Set(beforeSerials);
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 1000));
    const newOnes = listAllEmulatorSerials(adbBin).filter(s => !seen.has(s));
    if (newOnes.length > 0) return newOnes[0];
  }
  throw new Error(
    'New emulator did not appear in adb devices within 30 seconds.\n' +
    'Check that the emulator binary and ANDROID_HOME are correct.'
  );
}

// Polls until the specific serial is in `device` state and sys.boot_completed=1
async function waitForEmulatorBoot(adbBin, serial, maxMs = 180000, tickMs = 3000) {
  const deadline = Date.now() + maxMs;
  process.stdout.write(`[setup] Waiting for ${serial} boot `);

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, tickMs));

    const out = spawnSync(adbBin, ['devices'], { encoding: 'utf-8', timeout: 5000 }).stdout || '';
    const line = out.split('\n').find(l => l.trim().startsWith(serial));
    if (!line) { process.stdout.write('.'); continue; }

    const state = line.trim().split(/\s+/)[1];
    if (state !== 'device') { process.stdout.write('.'); continue; }

    const result = spawnSync(
      adbBin,
      ['-s', serial, 'shell', 'getprop', 'sys.boot_completed'],
      { encoding: 'utf-8', timeout: 5000 }
    );

    if ((result.stdout || '').trim() === '1') {
      process.stdout.write(' done\n');
      return;
    }

    process.stdout.write('.');
  }

  process.stdout.write('\n');
  throw new Error(`${serial} did not complete boot within 3 minutes.`);
}

// ── Appium health-check ────────────────────────────────────────────────────────

async function waitForAppium(maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await checkAppium()) return;
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Appium server did not start within 20 seconds. Check reports/appium.log');
}

function checkAppium() {
  return new Promise(resolve => {
    const req = http.get('http://127.0.0.1:4723/status', res => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });
}
