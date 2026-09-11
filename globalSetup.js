const { spawn, spawnSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('./utils/logger');

const log = createLogger('setup');

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
  log.info('Cleared previous run reports, screenshots and videos.');

  const ENV     = process.env.ENV || 'uat';
  const WORKERS = parseInt(process.env.WORKERS || process.env.WORKER || '1', 10);
  const HEADLESS = process.env.HEADLESS === 'true';

  const envConfig = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `./environments/${ENV}.json`), 'utf-8')
  );

  log.debug(`Loaded env config: ${JSON.stringify({ ENV, WORKERS, HEADLESS, avdName: envConfig.avdName })}`);

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
    log.warn('No avdName/avdNames in env config — skipping emulator launch.');
  } else {
    if (WORKERS > avdPool.length) {
      const msg =
        `WORKERS=${WORKERS} but only ${avdPool.length} AVD(s) are listed in environments/${ENV}.json → avdNames.\n` +
        `Add more AVD names or reduce WORKERS.`;
      log.error(msg);
      throw new Error(msg);
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

  log.info(`Appium server starting (PID: ${appiumProcess.pid})...`);
  await waitForAppium();
  log.info('Appium server is ready.');
};

// ── Multi-emulator launch ──────────────────────────────────────────────────────

async function launchEmulators(avdList, headless) {
  const ANDROID_HOME =
    process.env.ANDROID_HOME ||
    path.join(process.env.HOME || '', 'Library', 'Android', 'sdk');

  const adbBin      = path.join(ANDROID_HOME, 'platform-tools', 'adb');
  const emulatorBin = path.join(ANDROID_HOME, 'emulator', 'emulator');

  if (!fs.existsSync(emulatorBin)) {
    const msg = `emulator binary not found: ${emulatorBin} — ensure ANDROID_HOME is set.`;
    log.error(msg);
    throw new Error(msg);
  }

  log.debug(`Using adb: ${adbBin}`);
  log.debug(`Using emulator: ${emulatorBin}`);

  // Kill any currently running emulators so we start fresh
  const running = listEmulators(adbBin);
  if (running.length > 0) {
    log.info(`Stopping existing emulator(s): ${running.join(', ')}`);
    for (const id of running) {
      spawnSync(adbBin, ['-s', id, 'emu', 'kill'], { timeout: 5000 });
    }
    await waitUntilNoEmulators(adbBin, 12000);
    log.debug('All existing emulators stopped.');
  }

  const mode = headless ? 'headless (no window)' : 'windowed (visible)';
  const deviceMap = {};

  for (let i = 0; i < avdList.length; i++) {
    const avdName = avdList[i];
    const beforeSerials = listAllEmulatorSerials(adbBin);

    log.info(`[${i + 1}/${avdList.length}] Launching "${avdName}" in ${mode} mode...`);

    const args = ['-avd', avdName];
    if (headless) args.push('-no-window', '-no-audio');

    log.debug(`emulator args: ${args.join(' ')}`);
    spawn(emulatorBin, args, { detached: true, stdio: 'ignore' }).unref();

    const serial = await waitForNewEmulator(adbBin, beforeSerials, 30000);
    log.info(`Emulator appeared as ${serial} → assigned to worker ${i}`);

    await waitForEmulatorBoot(adbBin, serial, 180000);
    log.info(`${serial} fully booted — worker ${i} ready.`);

    deviceMap[i] = serial;
  }

  fs.writeFileSync('.device-map.json', JSON.stringify(deviceMap, null, 2));
  log.info(`Device map written: ${JSON.stringify(deviceMap)}`);
}

function listAllEmulatorSerials(adbBin) {
  const out = spawnSync(adbBin, ['devices'], { encoding: 'utf-8', timeout: 5000 }).stdout || '';
  return out.split('\n')
    .filter(l => /^emulator-\d+/.test(l))
    .map(l => l.trim().split(/\s+/)[0]);
}

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

async function waitForNewEmulator(adbBin, beforeSerials, maxMs = 30000) {
  const seen = new Set(beforeSerials);
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 1000));
    const newOnes = listAllEmulatorSerials(adbBin).filter(s => !seen.has(s));
    if (newOnes.length > 0) return newOnes[0];
  }
  const msg = 'New emulator did not appear in adb devices within 30 seconds after launch.';
  log.error(msg);
  throw new Error(msg);
}

async function waitForEmulatorBoot(adbBin, serial, maxMs = 180000, tickMs = 3000) {
  const deadline = Date.now() + maxMs;
  log.info(`Waiting for ${serial} to complete boot...`);

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, tickMs));

    const out = spawnSync(adbBin, ['devices'], { encoding: 'utf-8', timeout: 5000 }).stdout || '';
    const line = out.split('\n').find(l => l.trim().startsWith(serial));

    if (!line) {
      log.debug(`${serial} not yet visible in adb devices`);
      continue;
    }

    const state = line.trim().split(/\s+/)[1];
    if (state !== 'device') {
      log.debug(`${serial} state: ${state}`);
      continue;
    }

    const result = spawnSync(
      adbBin,
      ['-s', serial, 'shell', 'getprop', 'sys.boot_completed'],
      { encoding: 'utf-8', timeout: 5000 }
    );

    const booted = (result.stdout || '').trim();
    log.debug(`${serial} sys.boot_completed=${booted}`);

    if (booted === '1') return;
  }

  const msg = `${serial} did not complete boot within 3 minutes.`;
  log.error(msg);
  throw new Error(msg);
}

// ── Appium health-check ────────────────────────────────────────────────────────

async function waitForAppium(maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await checkAppium()) return;
    log.debug(`Appium not ready yet (attempt ${i + 1}/${maxAttempts})`);
    await new Promise(r => setTimeout(r, 1000));
  }
  const msg = 'Appium server did not start within 20 seconds. Check reports/appium.log';
  log.error(msg);
  throw new Error(msg);
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
