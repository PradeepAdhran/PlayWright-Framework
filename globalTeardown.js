const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('./utils/logger');

const log = createLogger('teardown');

module.exports = async function globalTeardown() {
  const OS = (process.env.OS || 'android').toLowerCase();

  // ── Stop Appium server ─────────────────────────────────────────────
  const pidFile = `.appium-${OS}.pid`;
  try {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf-8'), 10);
    process.kill(pid, 'SIGKILL');
    fs.unlinkSync(pidFile);
    log.info(`Appium server stopped (PID: ${pid})`);
  } catch (err) {
    log.warn(`Could not stop Appium — already stopped or PID file missing. (${err.message})`);
  }

  // ── Stop devices launched by globalSetup ──────────────────────────
  const deviceMapFile = `.device-map-${OS}.json`;
  if (!fs.existsSync(deviceMapFile)) {
    log.info('No device map found — skipping device teardown.');
  } else {
    const deviceMap = JSON.parse(fs.readFileSync(deviceMapFile, 'utf-8'));
    const ids = Object.values(deviceMap);

    if (ids.length > 0) {
      if (OS === 'android') {
        await stopAndroidEmulators(ids);
      } else if (OS === 'ios') {
        await stopIOSSimulators(ids);
      }
    }

    try { fs.unlinkSync(deviceMapFile); } catch { /* already gone */ }
    log.debug('Device map file removed.');
  }

  log.info('Run "npm run allure:report" to view results.');
};

async function stopAndroidEmulators(serials) {
  const ANDROID_HOME =
    process.env.ANDROID_HOME ||
    path.join(process.env.HOME || '', 'Library', 'Android', 'sdk');
  const adbBin = path.join(ANDROID_HOME, 'platform-tools', 'adb');

  log.info(`Stopping Android emulator(s): ${serials.join(', ')}`);
  for (const serial of serials) {
    const result = spawnSync(adbBin, ['-s', serial, 'emu', 'kill'], { timeout: 5000 });
    if (result.error) {
      log.warn(`Could not stop ${serial}: ${result.error.message}`);
    } else {
      log.debug(`Kill signal sent to ${serial}`);
    }
  }
}

async function stopIOSSimulators(udids) {
  log.info(`Shutting down iOS simulator(s): ${udids.map(u => u.slice(0, 8)).join(', ')}...`);
  for (const udid of udids) {
    const result = spawnSync('xcrun', ['simctl', 'shutdown', udid], { timeout: 10000, encoding: 'utf-8' });
    if (result.error) {
      log.warn(`Could not shutdown simulator ${udid.slice(0, 8)}: ${result.error.message}`);
    } else {
      log.debug(`Simulator ${udid.slice(0, 8)} shutdown.`);
    }
  }
}
