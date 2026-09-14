// @ts-check
require('dotenv').config(); // load .env before anything reads process.env

const { defineConfig } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: ['**/*Test.js', '**/*.spec.js'],
  timeout: 180000,

  fullyParallel: false,
  workers: parseInt(process.env.WORKERS || process.env.WORKER || '1', 10),

  forbidOnly: !!process.env.CI,
  retries: 0,

  globalSetup: require.resolve('./globalSetup'),
  globalTeardown: require.resolve('./globalTeardown'),

  reporter: [
    ['list'],
    ['allure-playwright', {
      detail: true,
      resultsDir: path.resolve(__dirname, 'reports/allure/results'),
      suiteTitle: true,
    }],
  ],

  use: {
    trace: 'off',
  },
});
