const fs = require('fs');

module.exports = async function globalTeardown() {
  try {
    const pid = parseInt(fs.readFileSync('.appium.pid', 'utf-8'), 10);
    process.kill(pid, 'SIGTERM');
    fs.unlinkSync('.appium.pid');
    console.log(`\n[teardown] Appium server stopped (PID: ${pid})`);
    console.log('[teardown] Run: npm run allure:report to view results.\n');
  } catch {
    // already stopped or pid file missing
  }
};
