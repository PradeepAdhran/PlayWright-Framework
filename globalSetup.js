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
  const OS      = (process.env.OS || 'android').toLowerCase();
  const WORKERS = parseInt(process.env.WORKERS || process.env.WORKER || '1', 10);
  const HEADLESS = process.env.HEADLESS === 'true';

  const envConfig = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `./environments/${ENV}.json`), 'utf-8')
  );

  const platformConfig = envConfig[OS];
  if (!platformConfig) {
    throw new Error(`No "${OS}" section found in environments/${ENV}.json`);
  }

  log.debug(`Platform: ${OS.toUpperCase()} | ENV: ${ENV} | WORKERS: ${WORKERS} | HEADLESS: ${HEADLESS}`);

  // Write Allure environment info
  fs.writeFileSync(
    './reports/allure-results/environment.properties',
    [
      `Environment=${ENV.toUpperCase()}`,
      `Platform=${OS.toUpperCase()}`,
      `Android.Version=${platformConfig.platformVersion || ''}`,
      `App.Package=${platformConfig.appPackage || platformConfig.bundleId || ''}`,
      `APK.File=${platformConfig.apkFile || platformConfig.appFile || ''}`,
      `Workers=${WORKERS}`,
    ].join('\n')
  );

  // ── Launch devices (one per worker) ───────────────────────────────
  if (OS === 'android') {
    await launchAndroidEmulators(platformConfig, WORKERS, HEADLESS, ENV);
  } else if (OS === 'ios') {
    await launchIOSSimulators(platformConfig, WORKERS, HEADLESS, ENV);
  } else {
    throw new Error(`Unsupported OS: "${OS}". Use OS=android or OS=ios.`);
  }

  // ── Start Appium server ────────────────────────────────────────────
  // Kill any stale process on 4723 before starting fresh
  const killStale = spawnSync('lsof', ['-ti', 'tcp:4723'], { encoding: 'utf-8' });
  const stalePids = (killStale.stdout || '').trim().split('\n').filter(Boolean);
  if (stalePids.length > 0) {
    log.warn(`Killing stale process(es) on port 4723: ${stalePids.join(', ')}`);
    for (const pid of stalePids) {
      try { process.kill(parseInt(pid), 'SIGKILL'); } catch { /* already gone */ }
    }
    await new Promise(r => setTimeout(r, 1000));
  }

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

// ── Android emulator management ────────────────────────────────────────────────

async function launchAndroidEmulators(platformConfig, workers, headless, env) {
  const avdPool = (platformConfig.avdNames || (platformConfig.avdName ? [platformConfig.avdName] : [])).filter(Boolean);

  if (avdPool.length === 0) {
    log.warn('No avdName/avdNames in android config — skipping emulator launch.');
    return;
  }

  if (workers > avdPool.length) {
    throw new Error(
      `WORKERS=${workers} but only ${avdPool.length} AVD(s) listed in environments/${env}.json → android.avdNames.\n` +
      `Add more AVD names or reduce WORKERS.`
    );
  }

  const ANDROID_HOME =
    process.env.ANDROID_HOME ||
    path.join(process.env.HOME || '', 'Library', 'Android', 'sdk');

  const adbBin      = path.join(ANDROID_HOME, 'platform-tools', 'adb');
  const emulatorBin = path.join(ANDROID_HOME, 'emulator', 'emulator');

  if (!fs.existsSync(emulatorBin)) {
    throw new Error(`emulator binary not found: ${emulatorBin} — set ANDROID_HOME correctly.`);
  }

  // Kill any running emulators so we start fresh with the right flags
  const running = listAndroidDevices(adbBin, true);
  if (running.length > 0) {
    log.info(`Stopping existing emulator(s): ${running.join(', ')}`);
    for (const id of running) {
      spawnSync(adbBin, ['-s', id, 'emu', 'kill'], { timeout: 5000 });
    }
    // Wait until fully deregistered from ADB before taking the "before" snapshot
    await waitUntilNoAndroidEmulators(adbBin, 20000);
  }

  const mode = headless ? 'headless (no window)' : 'windowed (visible)';
  const deviceMap = {};

  for (let i = 0; i < workers; i++) {
    const avdName = avdPool[i];
    // Snapshot taken AFTER old emulators are gone — so any new serial is truly new
    const before = listAllAndroidSerials(adbBin);

    log.info(`[${i + 1}/${workers}] Launching Android AVD "${avdName}" in ${mode} mode...`);

    const args = ['-avd', avdName];
    if (headless) args.push('-no-window', '-no-audio');

    spawn(emulatorBin, args, { detached: true, stdio: 'ignore' }).unref();

    const serial = await waitForNewAndroidEmulator(adbBin, before, 90000);
    log.info(`Emulator appeared as ${serial} → worker ${i}`);

    await waitForAndroidBoot(adbBin, serial, 180000);
    log.info(`${serial} fully booted — worker ${i} ready.`);

    deviceMap[i] = serial;
  }

  fs.writeFileSync('.device-map.json', JSON.stringify(deviceMap, null, 2));
  log.info(`Device map: ${JSON.stringify(deviceMap)}`);
}

function listAllAndroidSerials(adbBin) {
  const out = spawnSync(adbBin, ['devices'], { encoding: 'utf-8', timeout: 5000 }).stdout || '';
  return out.split('\n').filter(l => /^emulator-\d+/.test(l)).map(l => l.trim().split(/\s+/)[0]);
}

function listAndroidDevices(adbBin, emulatorsOnly = false) {
  const out = spawnSync(adbBin, ['devices'], { encoding: 'utf-8', timeout: 5000 }).stdout || '';
  return out.split('\n')
    .filter(l => emulatorsOnly ? /^emulator-\d+\s+device/.test(l) : /\s+device$/.test(l))
    .map(l => l.trim().split(/\s+/)[0]);
}

async function waitUntilNoAndroidEmulators(adbBin, maxMs) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (listAllAndroidSerials(adbBin).length === 0) {
      // Extra grace period so ADB fully releases the port
      await new Promise(r => setTimeout(r, 2000));
      return;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  log.warn('Timed out waiting for emulators to deregister — proceeding anyway.');
}

async function waitForNewAndroidEmulator(adbBin, beforeSerials, maxMs) {
  const seen = new Set(beforeSerials);
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 1000));
    const newOnes = listAllAndroidSerials(adbBin).filter(s => !seen.has(s));
    if (newOnes.length > 0) return newOnes[0];
  }
  throw new Error('New Android emulator did not appear in adb devices within 30 seconds.');
}

async function waitForAndroidBoot(adbBin, serial, maxMs, tickMs = 3000) {
  const deadline = Date.now() + maxMs;
  log.info(`Waiting for ${serial} to boot...`);
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, tickMs));
    const out = spawnSync(adbBin, ['devices'], { encoding: 'utf-8', timeout: 5000 }).stdout || '';
    const line = out.split('\n').find(l => l.trim().startsWith(serial));
    if (!line || line.trim().split(/\s+/)[1] !== 'device') { log.debug(`${serial} not ready yet...`); continue; }
    const result = spawnSync(adbBin, ['-s', serial, 'shell', 'getprop', 'sys.boot_completed'], { encoding: 'utf-8', timeout: 5000 });
    if ((result.stdout || '').trim() === '1') return;
    log.debug(`${serial} boot_completed=0, waiting...`);
  }
  throw new Error(`${serial} did not boot within 3 minutes.`);
}

// ── iOS simulator management ───────────────────────────────────────────────────

async function launchIOSSimulators(platformConfig, workers, headless, env) {
  const simPool = (platformConfig.simulatorNames || (platformConfig.simulatorName ? [platformConfig.simulatorName] : [])).filter(Boolean);

  if (simPool.length === 0) {
    log.warn('No simulatorName/simulatorNames in ios config — skipping simulator launch.');
    return;
  }

  if (workers > simPool.length) {
    throw new Error(
      `WORKERS=${workers} but only ${simPool.length} simulator(s) listed in environments/${env}.json → ios.simulatorNames.\n` +
      `Add more simulator names or reduce WORKERS.`
    );
  }

  // Shutdown all currently booted simulators
  const booted = getBootedSimulatorUdids();
  if (booted.length > 0) {
    log.info(`Shutting down booted simulator(s): ${booted.join(', ')}`);
    for (const udid of booted) {
      spawnSync('xcrun', ['simctl', 'shutdown', udid], { timeout: 10000 });
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  const mode = headless ? 'headless (background)' : 'visible (Simulator.app)';
  const deviceMap = {};

  for (let i = 0; i < workers; i++) {
    const simName = simPool[i];
    const sim = findSimulatorByName(simName);

    if (!sim) {
      throw new Error(
        `iOS simulator "${simName}" not found or not available.\n` +
        `Run: xcrun simctl list devices to see available simulators.`
      );
    }

    log.info(`[${i + 1}/${workers}] Booting iOS simulator "${simName}" (${sim.udid}) in ${mode} mode...`);

    spawnSync('xcrun', ['simctl', 'boot', sim.udid], { timeout: 30000, encoding: 'utf-8' });

    await waitForSimulatorBoot(sim.udid, 60000);
    log.info(`${simName} (${sim.udid.slice(0, 8)}) booted — worker ${i} ready.`);

    // Pre-install app so Appium sessions skip the slow cold-install step
    const appPath = path.resolve(__dirname, `./test-data/${platformConfig.appFile}`);
    if (fs.existsSync(appPath)) {
      log.info(`Pre-installing ${platformConfig.appFile} on ${simName}...`);
      const install = spawnSync('xcrun', ['simctl', 'install', sim.udid, appPath], {
        timeout: 120000,
        encoding: 'utf-8',
      });
      if (install.error) {
        log.warn(`App pre-install failed: ${install.error.message}`);
      } else {
        log.info(`App pre-installed on ${simName}.`);
      }
    } else {
      log.warn(`App file not found at ${appPath} — skipping pre-install.`);
    }

    deviceMap[i] = sim.udid;
  }

  // Open Simulator.app window after all simulators are booted (visible mode only)
  if (!headless) {
    log.info('Opening Simulator.app window...');
    spawnSync('open', ['-a', 'Simulator'], { timeout: 5000 });
  }

  fs.writeFileSync('.device-map.json', JSON.stringify(deviceMap, null, 2));
  log.info(`Device map: ${JSON.stringify(deviceMap)}`);
}

function getBootedSimulatorUdids() {
  try {
    const result = spawnSync('xcrun', ['simctl', 'list', 'devices', 'booted', '--json'], { encoding: 'utf-8', timeout: 5000 });
    const data = JSON.parse(result.stdout || '{}');
    const udids = [];
    for (const devices of Object.values(data.devices || {})) {
      for (const d of devices) {
        if (d.state === 'Booted') udids.push(d.udid);
      }
    }
    return udids;
  } catch {
    return [];
  }
}

function findSimulatorByName(name) {
  try {
    const result = spawnSync('xcrun', ['simctl', 'list', 'devices', '--json'], { encoding: 'utf-8', timeout: 5000 });
    const data = JSON.parse(result.stdout || '{}');
    for (const devices of Object.values(data.devices || {})) {
      const found = devices.find(d => d.name === name && d.isAvailable);
      if (found) return found;
    }
  } catch { /* xcrun not available */ }
  return null;
}

async function waitForSimulatorBoot(udid, maxMs = 60000, tickMs = 2000) {
  const deadline = Date.now() + maxMs;
  log.info(`Waiting for simulator ${udid.slice(0, 8)} to boot...`);
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, tickMs));
    try {
      const result = spawnSync('xcrun', ['simctl', 'list', 'devices', '--json'], { encoding: 'utf-8', timeout: 5000 });
      const data = JSON.parse(result.stdout || '{}');
      for (const devices of Object.values(data.devices || {})) {
        const sim = devices.find(d => d.udid === udid);
        if (sim?.state === 'Booted') return;
        if (sim) log.debug(`Simulator state: ${sim.state}`);
      }
    } catch (err) {
      log.warn(`simctl check error: ${err.message}`);
    }
  }
  throw new Error(`Simulator ${udid} did not boot within ${maxMs / 1000} seconds.`);
}

// ── Appium health-check ────────────────────────────────────────────────────────

async function waitForAppium(maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await checkAppium()) return;
    log.debug(`Appium not ready yet (attempt ${i + 1}/${maxAttempts})`);
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Appium server did not start within 20 seconds. Check reports/appium.log');
}

function checkAppium() {
  return new Promise(resolve => {
    const req = http.get('http://127.0.0.1:4723/status', res => resolve(res.statusCode === 200));
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });
}
