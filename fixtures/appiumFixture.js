require('dotenv').config();

const { test: base } = require('allure-playwright');
const { remote } = require('webdriverio');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('../utils/logger');

const log = createLogger('driver');

const ENV = process.env.ENV || 'uat';
const envConfig = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, `../environments/${ENV}.json`), 'utf-8')
);

// Credentials: .env vars take priority over environments/*.json
const envPrefix = ENV.toUpperCase();
const credentials = {
  validUser: {
    username: process.env[`${envPrefix}_VALID_USER`]   || envConfig.credentials?.validUser?.username,
    password: process.env[`${envPrefix}_VALID_PASS`]   || envConfig.credentials?.validUser?.password,
  },
  invalidUser: {
    username: process.env[`${envPrefix}_INVALID_USER`] || envConfig.credentials?.invalidUser?.username,
    password: process.env[`${envPrefix}_INVALID_PASS`] || envConfig.credentials?.invalidUser?.password,
  },
};

// Extend Playwright's test with a `driver` fixture (Appium session)
const test = base.extend({
  driver: async ({}, use, testInfo) => {
    // Each Playwright worker gets its own emulator via the device map written by globalSetup
    const deviceMapPath = path.resolve(__dirname, '../.device-map.json');
    const deviceMap = fs.existsSync(deviceMapPath)
      ? JSON.parse(fs.readFileSync(deviceMapPath, 'utf-8'))
      : { 0: envConfig.deviceName };

    const workerIndex = testInfo.workerIndex;
    const deviceSerial = deviceMap[String(workerIndex)] || deviceMap['0'] || envConfig.deviceName;

    log.info(`[worker:${workerIndex}] Starting Appium session on ${deviceSerial} for test: "${testInfo.title}"`);
    log.debug(`[worker:${workerIndex}] APK: ${envConfig.apkFile} | Package: ${envConfig.appPackage}`);

    const driver = await remote({
      protocol: 'http',
      hostname: '127.0.0.1',
      port: 4723,
      path: '/',
      logLevel: 'warn',
      capabilities: {
        platformName: 'Android',
        'appium:deviceName': deviceSerial,
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

    log.debug(`[worker:${workerIndex}] Appium session created — dismissing permission dialogs`);
    await dismissPermissionDialogs(driver, workerIndex);

    log.debug(`[worker:${workerIndex}] Starting screen recording`);
    await driver.startRecordingScreen({ timeLimit: 180 }).catch(err => {
      log.warn(`[worker:${workerIndex}] Screen recording could not start: ${err.message}`);
    });

    await use(driver); // hand driver to the test

    // ── Post-test: screenshot + video ──────────────────────────────
    const safeName = testInfo.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = Date.now();
    const failed = testInfo.status !== testInfo.expectedStatus;

    log.info(`[worker:${workerIndex}] Test "${testInfo.title}" finished — status: ${testInfo.status}`);

    // Screenshot — always capture, attach to report
    try {
      log.debug(`[worker:${workerIndex}] Capturing screenshot`);
      const screenshotB64 = await driver.takeScreenshot();
      const screenshotBuf = Buffer.from(screenshotB64, 'base64');
      const screenshotPath = path.resolve(`./reports/screenshots/${safeName}_${timestamp}.png`);
      fs.writeFileSync(screenshotPath, screenshotBuf);
      await testInfo.attach('screenshot', { body: screenshotBuf, contentType: 'image/png' });
      log.debug(`[worker:${workerIndex}] Screenshot saved: ${screenshotPath}`);
    } catch (err) {
      log.warn(`[worker:${workerIndex}] Screenshot failed: ${err.message}`);
    }

    // Video — always record, save + attach on failure only
    try {
      const videoB64 = await driver.stopRecordingScreen();
      if (failed) {
        log.info(`[worker:${workerIndex}] Test failed — saving video`);
        const videoBuf = Buffer.from(videoB64, 'base64');
        const videoPath = path.resolve(`./reports/videos/${safeName}_${timestamp}.mp4`);
        fs.writeFileSync(videoPath, videoBuf);
        await testInfo.attach('video', { body: videoBuf, contentType: 'video/mp4' });
        log.debug(`[worker:${workerIndex}] Video saved: ${videoPath}`);
      } else {
        log.debug(`[worker:${workerIndex}] Test passed — discarding video recording`);
      }
    } catch (err) {
      log.warn(`[worker:${workerIndex}] Video recording stop failed: ${err.message}`);
    }

    log.debug(`[worker:${workerIndex}] Deleting Appium session`);
    await driver.deleteSession();
    log.info(`[worker:${workerIndex}] Session closed for "${testInfo.title}"`);
  },
});

// Dismiss system permission dialogs (notifications, location, etc.)
async function dismissPermissionDialogs(driver, workerIndex, maxDialogs = 3) {
  for (let i = 0; i < maxDialogs; i++) {
    try {
      const allowBtn = await driver.$('android=new UiSelector().text("Allow")');
      if (await allowBtn.isDisplayed()) {
        log.info(`[worker:${workerIndex}] Dismissing "Allow" permission dialog`);
        await allowBtn.click();
        await driver.pause(500);
        continue;
      }
    } catch { /* no Allow button */ }

    try {
      const allowOnlyBtn = await driver.$('android=new UiSelector().text("Allow only while using the app")');
      if (await allowOnlyBtn.isDisplayed()) {
        log.info(`[worker:${workerIndex}] Dismissing "Allow only while using the app" dialog`);
        await allowOnlyBtn.click();
        await driver.pause(500);
        continue;
      }
    } catch { /* no dialog */ }

    break;
  }
}

const { expect } = base;

module.exports = { test, expect, credentials };
