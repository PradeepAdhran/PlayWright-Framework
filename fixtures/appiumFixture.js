require('dotenv').config();

const { test: base } = require('allure-playwright');
const { remote } = require('webdriverio');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('../utils/logger');

const log = createLogger('driver');

const ENV = process.env.ENV || 'uat';
const OS  = (process.env.OS || 'android').toLowerCase();

const envConfig = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, `../environments/${ENV}.json`), 'utf-8')
);

const platformConfig = envConfig[OS] || {};

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
    // Each Playwright worker gets its own device via the device map written by globalSetup
    const deviceMapPath = path.resolve(__dirname, '../.device-map.json');
    const deviceMap = fs.existsSync(deviceMapPath)
      ? JSON.parse(fs.readFileSync(deviceMapPath, 'utf-8'))
      : { 0: platformConfig.deviceName || platformConfig.simulatorName };

    const workerIndex  = testInfo.workerIndex;
    const deviceId     = deviceMap[String(workerIndex)] || deviceMap['0'];

    log.info(`[worker:${workerIndex}] [${OS.toUpperCase()}] Starting session on ${deviceId} — "${testInfo.title}"`);

    const capabilities = OS === 'ios'
      ? buildIOSCapabilities(deviceId)
      : buildAndroidCapabilities(deviceId);

    log.debug(`[worker:${workerIndex}] Capabilities: ${JSON.stringify(capabilities)}`);

    const driver = await remote({
      protocol: 'http',
      hostname: '127.0.0.1',
      port: 4723,
      path: '/',
      logLevel: 'warn',
      capabilities,
    });

    log.debug(`[worker:${workerIndex}] Session created — dismissing permission dialogs`);
    await dismissPermissionDialogs(driver, OS, workerIndex);

    // iOS with noReset:true persists React Native navigation state between launches.
    // Force terminate + reactivate to get a clean app launch, then navigate to Home.
    if (OS === 'ios') {
      try {
        await driver.terminateApp(platformConfig.bundleId);
        await driver.pause(1000);
        await driver.activateApp(platformConfig.bundleId);
        await driver.pause(2000);
      } catch (err) {
        log.warn(`[worker:${workerIndex}] App terminate/reactivate failed: ${err.message}`);
      }
      // Dismiss keyboard if still present from previous session
      try { await driver.hideKeyboard(); } catch { /* no keyboard */ }
      // Navigate to Home tab to ensure known start state
      try {
        const homeTab = await driver.$('~Home');
        await homeTab.waitForDisplayed({ timeout: 15000 });
        await homeTab.click();
        await driver.pause(1000);
        log.debug(`[worker:${workerIndex}] Navigated to Home tab to reset nav state.`);
      } catch (err) {
        log.warn(`[worker:${workerIndex}] Could not tap Home tab on launch: ${err.message}`);
      }
    }

    log.debug(`[worker:${workerIndex}] Starting screen recording`);
    await driver.startRecordingScreen({ timeLimit: 180 }).catch(err => {
      log.warn(`[worker:${workerIndex}] Screen recording could not start: ${err.message}`);
    });

    await use(driver); // hand driver to the test

    // ── Post-test: screenshot + video ──────────────────────────────
    const safeName = testInfo.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = Date.now();
    const failed    = testInfo.status !== testInfo.expectedStatus;

    log.info(`[worker:${workerIndex}] Test "${testInfo.title}" — status: ${testInfo.status}`);

    // Screenshot — always capture
    try {
      const screenshotB64 = await driver.takeScreenshot();
      const screenshotBuf = Buffer.from(screenshotB64, 'base64');
      const screenshotPath = path.resolve(`./reports/screenshots/${safeName}_${timestamp}.png`);
      fs.writeFileSync(screenshotPath, screenshotBuf);
      await testInfo.attach('screenshot', { body: screenshotBuf, contentType: 'image/png' });
      log.debug(`[worker:${workerIndex}] Screenshot saved.`);
    } catch (err) {
      log.warn(`[worker:${workerIndex}] Screenshot failed: ${err.message}`);
    }

    // Video — record always, save only on failure
    try {
      const videoB64 = await driver.stopRecordingScreen();
      if (failed) {
        const videoBuf = Buffer.from(videoB64, 'base64');
        const videoPath = path.resolve(`./reports/videos/${safeName}_${timestamp}.mp4`);
        fs.writeFileSync(videoPath, videoBuf);
        await testInfo.attach('video', { body: videoBuf, contentType: 'video/mp4' });
        log.info(`[worker:${workerIndex}] Failure video saved.`);
      }
    } catch (err) {
      log.warn(`[worker:${workerIndex}] Video stop failed: ${err.message}`);
    }

    await driver.deleteSession();
    log.info(`[worker:${workerIndex}] Session closed.`);
  },
});

// ── Capability builders ────────────────────────────────────────────────────────

function buildAndroidCapabilities(deviceSerial) {
  return {
    platformName: 'Android',
    'appium:deviceName':       deviceSerial,
    'appium:platformVersion':  platformConfig.platformVersion,
    'appium:app':              path.resolve(__dirname, `../test-data/${platformConfig.apkFile}`),
    'appium:automationName':   'UiAutomator2',
    'appium:appPackage':       platformConfig.appPackage,
    'appium:appActivity':      platformConfig.appActivity,
    'appium:noReset':          false,
    'appium:fullReset':        false,
    'appium:newCommandTimeout': 90000,
    'appium:autoGrantPermissions': true,
  };
}

function buildIOSCapabilities(udid) {
  return {
    platformName: 'iOS',
    'appium:deviceName':       platformConfig.simulatorName,
    'appium:udid':             udid,
    'appium:platformVersion':  platformConfig.platformVersion,
    'appium:bundleId':         platformConfig.bundleId,
    'appium:automationName':   'XCUITest',
    // App pre-installed by globalSetup; noReset skips per-session reinstall for speed
    'appium:noReset':          true,
    'appium:newCommandTimeout': 90000,
    'appium:autoAcceptAlerts': true,
  };
}

// ── Permission dialog dismissal ────────────────────────────────────────────────

async function dismissPermissionDialogs(driver, os, workerIndex, maxDialogs = 3) {
  for (let i = 0; i < maxDialogs; i++) {
    let dismissed = false;

    if (os === 'ios') {
      // iOS: system alerts are auto-accepted via appium:autoAcceptAlerts capability,
      // but handle any that slip through
      for (const label of ['Allow', 'Allow While Using App', 'OK', 'Continue']) {
        try {
          const btn = await driver.$(`-ios predicate string:label == "${label}" AND type == "XCUIElementTypeButton"`);
          if (await btn.isDisplayed()) {
            log.info(`[worker:${workerIndex}] Dismissing iOS alert: "${label}"`);
            await btn.click();
            await driver.pause(500);
            dismissed = true;
            break;
          }
        } catch { /* not present */ }
      }
    } else {
      // Android
      for (const text of ['Allow', 'Allow only while using the app']) {
        try {
          const btn = await driver.$(`android=new UiSelector().text("${text}")`);
          if (await btn.isDisplayed()) {
            log.info(`[worker:${workerIndex}] Dismissing Android permission: "${text}"`);
            await btn.click();
            await driver.pause(500);
            dismissed = true;
            break;
          }
        } catch { /* not present */ }
      }
    }

    if (!dismissed) break;
  }
}

const { expect } = base;

module.exports = { test, expect, credentials };
