const { test: base } = require('allure-playwright');
const { remote } = require('webdriverio');
const path = require('path');
const fs = require('fs');

const ENV = process.env.ENV || 'uat';
const envConfig = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, `../environments/${ENV}.json`), 'utf-8')
);

// Extend Playwright's test with a `driver` fixture (Appium session)
const test = base.extend({
  driver: async ({}, use, testInfo) => {
    const driver = await remote({
      protocol: 'http',
      hostname: '127.0.0.1',
      port: 4723,
      path: '/',
      logLevel: 'warn',
      capabilities: {
        platformName: 'Android',
        'appium:deviceName': envConfig.deviceName,
        'appium:platformVersion': envConfig.platformVersion,
        'appium:app': path.resolve(__dirname, `../test-data/${envConfig.apkFile}`),
        'appium:automationName': 'UiAutomator2',
        'appium:appPackage': envConfig.appPackage,
        'appium:appActivity': envConfig.appActivity,
        'appium:noReset': false,
        'appium:fullReset': false,
        'appium:newCommandTimeout': 90000,
        'appium:autoGrantPermissions': true,
      },
    });

    await dismissPermissionDialogs(driver);

    // Start screen recording for every test
    await driver.startRecordingScreen({ timeLimit: 180 }).catch(() => {});

    await use(driver); // hand driver to the test

    // ── Post-test: screenshot + video ──────────────────────────────
    const safeName = testInfo.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = Date.now();
    const failed = testInfo.status !== testInfo.expectedStatus;

    // Screenshot — always capture, attach to report
    try {
      const screenshotB64 = await driver.takeScreenshot();
      const screenshotBuf = Buffer.from(screenshotB64, 'base64');
      const screenshotPath = path.resolve(`./reports/screenshots/${safeName}_${timestamp}.png`);
      fs.writeFileSync(screenshotPath, screenshotBuf);
      await testInfo.attach('screenshot', { body: screenshotBuf, contentType: 'image/png' });
    } catch { /* emulator may have closed */ }

    // Video — always record, save + attach on failure only
    try {
      const videoB64 = await driver.stopRecordingScreen();
      if (failed) {
        const videoBuf = Buffer.from(videoB64, 'base64');
        const videoPath = path.resolve(`./reports/videos/${safeName}_${timestamp}.mp4`);
        fs.writeFileSync(videoPath, videoBuf);
        await testInfo.attach('video', { body: videoBuf, contentType: 'video/mp4' });
      }
    } catch { /* recording may not have started */ }

    await driver.deleteSession();
  },
});

// Dismiss any system permission dialogs (notifications, location, etc.)
async function dismissPermissionDialogs(driver, maxDialogs = 3) {
  for (let i = 0; i < maxDialogs; i++) {
    try {
      const allowBtn = await driver.$('android=new UiSelector().text("Allow")');
      if (await allowBtn.isDisplayed()) { await allowBtn.click(); await driver.pause(500); continue; }
    } catch { /* no Allow button */ }

    try {
      const allowOnlyBtn = await driver.$('android=new UiSelector().text("Allow only while using the app")');
      if (await allowOnlyBtn.isDisplayed()) { await allowOnlyBtn.click(); await driver.pause(500); continue; }
    } catch { /* no dialog */ }

    break;
  }
}

const { expect } = base;

module.exports = { test, expect };
