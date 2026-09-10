// @ts-check
const { defineConfig } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 90000,

  fullyParallel: false,
  workers: process.env.WORKERS ? parseInt(process.env.WORKERS, 10) : 1,

  forbidOnly: !!process.env.CI,
  retries: 0,

  // Appium server is started before all tests and stopped after
  globalSetup: require.resolve('./globalSetup'),
  globalTeardown: require.resolve('./globalTeardown'),

  reporter: [
    ['list'],
    ['allure-playwright', {
      detail: true,
      resultsDir: path.resolve(__dirname, 'reports/allure-results'),
      suiteTitle: true,
    }],
  ],

  use: {
    trace: 'off',
  },
});
