const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('./utils/logger');

const log = createLogger('teardown');

module.exports = async function globalTeardown() {
  // ── Stop Appium server ─────────────────────────────────────────────
  try {
    const pid = parseInt(fs.readFileSync('.appium.pid', 'utf-8'), 10);
    process.kill(pid, 'SIGTERM');
    fs.unlinkSync('.appium.pid');
    log.info(`Appium server stopped (PID: ${pid})`);
  } catch (err) {
    log.warn(`Could not stop Appium — already stopped or PID file missing. (${err.message})`);
  }

  // ── Stop emulators that were launched by globalSetup ──────────────
  if (fs.existsSync('.device-map.json')) {
    try {
      const deviceMap = JSON.parse(fs.readFileSync('.device-map.json', 'utf-8'));
      const serials = Object.values(deviceMap);

      if (serials.length > 0) {
        const ANDROID_HOME =
          process.env.ANDROID_HOME ||
          path.join(process.env.HOME || '', 'Library', 'Android', 'sdk');
        const adbBin = path.join(ANDROID_HOME, 'platform-tools', 'adb');

        log.info(`Stopping emulator(s): ${serials.join(', ')}`);
        for (const serial of serials) {
          const result = spawnSync(adbBin, ['-s', serial, 'emu', 'kill'], { timeout: 5000 });
          if (result.error) {
            log.warn(`Could not stop ${serial}: ${result.error.message}`);
          } else {
            log.debug(`${serial} kill signal sent.`);
          }
        }
      }

      fs.unlinkSync('.device-map.json');
      log.debug('Device map file removed.');
    } catch (err) {
      log.warn(`Error during emulator teardown: ${err.message}`);
    }
  }

  log.info('Run "npm run allure:report" to view results.');
};
