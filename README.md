# Mobile Apps Automation (Android & iOS) React Native

Cross-platform mobile automation framework for the **WDIO Demo App** (React Native / Expo), built on **Playwright Test** as the runner and **Appium 2** (via WebdriverIO) as the mobile driver. Supports Android and iOS with a shared Page Object Model, parallel workers, structured logging, and Allure HTML reports.

---

## Tech stack

| Layer | Tool |
|-------|------|
| Test runner | Playwright Test (`@playwright/test`) |
| Mobile driver | Appium 2 via WebdriverIO `remote()` |
| Android driver | `appium-uiautomator2-driver` |
| iOS driver | `appium-xcuitest-driver` |
| Reports | `allure-playwright` + `allure-commandline` |
| Logging | Custom tagged logger (`utils/logger.js`) |
| Config | `dotenv` — `.env` + `environments/<env>.json` |

---

## Project structure

```
environments/
  uat.json            device caps, app info, credentials for UAT
  staging.json        same for Staging

fixtures/
  appiumFixture.js    driver fixture: session lifecycle, screenshots, video, credentials

locators/
  HomeLocators.js     element selectors for the Home screen
  LoginLocators.js    element selectors for the Login screen
  SearchLocators.js   element selectors for the Search screen

pages/
  BasePage.js         shared helpers (wait, tap, type, scroll…)
  HomePage.js         home screen actions / assertions
  LoginPage.js        login screen actions / assertions
  SearchPage.js       search screen actions / assertions

tests/
  homeTest.js         TC-001–TC-006: app launch, navigation tabs
  loginTest.js        TC-001–TC-004: login screen, valid/invalid credentials, empty form

utils/
  logger.js           tagged console + file logger (DEBUG/INFO/WARN/ERROR)

globalSetup.js        clean reports → boot emulator/simulator → pre-install app → start Appium
globalTeardown.js     stop Appium → kill emulator / shutdown simulator
playwright.config.js  Playwright configuration (workers, timeout, reporters)
run.js                CLI entry-point — reads flags, runs Playwright, opens Allure

test-data/
  wdiodemoapp.apk     Android build
  wdiodemoapp.app     iOS build

reports/              generated per run (wiped at start of each run)
  allure-results/
  allure-report/
  screenshots/
  videos/
  appium.log
  run.log
```

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Node.js 18+ | |
| Android SDK | `ANDROID_HOME` set; `emulator` and `adb` on PATH |
| Android AVD | Create AVDs and list names in `environments/<env>.json → android.avdNames` |
| Xcode + Simulator | Required for iOS; simulators listed in `environments/<env>.json → ios.simulatorNames` |
| Java 17+ | Required by Allure CLI — `brew install --cask temurin` |

> **Emulators and simulators are managed automatically.** `globalSetup.js` kills any running emulator/simulator, boots the required ones, pre-installs the app, and starts Appium. You do not need to start anything manually.

> **JAVA_HOME is fixed automatically.** Both `run.js` and `npm run allure:report` resolve Java home via `/usr/libexec/java_home` at runtime, so a stale shell `JAVA_HOME` never breaks report generation.

---

## Setup

```bash
npm install

# Install Appium drivers (once per machine)
npm run appium:install          # installs both uiautomator2 (Android) + xcuitest (iOS)
npm run appium:install:android  # Android only
npm run appium:install:ios      # iOS only

# Copy credentials template and fill in real values
cp .env.example .env
```

Place app builds in `test-data/`:
- `test-data/wdiodemoapp.apk` — Android
- `test-data/wdiodemoapp.app` — iOS

---

## Configuration

### `.env` file

Credentials and run defaults. `.env` values override `environments/<env>.json`.

```bash
# Credentials
UAT_VALID_USER=alice@example.com
UAT_VALID_PASS=10203040
UAT_INVALID_USER=wrong@example.com
UAT_INVALID_PASS=badpassword

STAGING_VALID_USER=staging@example.com
STAGING_VALID_PASS=password123
STAGING_INVALID_USER=wrong@example.com
STAGING_INVALID_PASS=badpassword
```

### `environments/<env>.json`

Device pool, app identifiers, and fallback credentials per environment.

```json
{
  "android": {
    "avdNames": ["Automation_1200x900_API_34", "Automation_1280x950_API_34_1"],
    "apkFile": "wdiodemoapp.apk",
    "appPackage": "com.wdiodemoapp",
    "appActivity": "com.wdiodemoapp.MainActivity",
    "platformVersion": "14"
  },
  "ios": {
    "simulatorNames": ["iPhone 17", "iPhone 17 Pro"],
    "appFile": "wdiodemoapp.app",
    "bundleId": "org.wdiodemoapp",
    "platformVersion": "26.5"
  },
  "credentials": {
    "validUser":   { "username": "alice@example.com", "password": "10203040" },
    "invalidUser": { "username": "wrong@example.com", "password": "badpassword" }
  }
}
```

---

## Running tests

All tests run through `run.js` via `npm test`. Flags are passed as environment variables.

| Flag | Values | Default | Description |
|------|--------|---------|-------------|
| `ENV` | `uat` \| `staging` | `uat` | Which environment config to load |
| `OS` | `android` \| `ios` | `android` | Target platform |
| `HEADLESS` | `true` \| `false` | `false` | Hide device window (`true`) or show it (`false`) |
| `WORKERS` | `1`, `2`, `3`… | `1` | Parallel workers — each worker gets its own device from the pool |
| `ALLURE` | `true` \| `false` | `false` | Auto-generate and open Allure report after the run |
| `LOG_LEVEL` | `DEBUG` \| `INFO` \| `WARN` \| `ERROR` | `INFO` | Console + file log verbosity |

### Examples

```bash
# Android — visible emulator, UAT, 1 worker, open Allure after run
OS=android ENV=uat HEADLESS=false WORKERS=1 ALLURE=true npm test

# Android — headless, staging, 2 parallel workers (needs 2 AVDs in avdNames)
OS=android ENV=staging HEADLESS=true WORKERS=2 npm test

# iOS — visible simulator, UAT
OS=ios ENV=uat HEADLESS=false WORKERS=1 npm test

# iOS — headless, with Allure report
OS=ios ENV=uat HEADLESS=true WORKERS=1 ALLURE=true npm test

# Debug logging
OS=android ENV=uat LOG_LEVEL=DEBUG npm test

# Shorthand scripts (ENV only, other flags use defaults)
npm run test:uat
npm run test:staging
```

### Run a single test file

```bash
OS=android ENV=uat npx playwright test tests/homeTest.js
OS=ios ENV=uat npx playwright test tests/loginTest.js
```

### Parallel workers

Each worker gets its own dedicated device. The device pool comes from `avdNames` (Android) or `simulatorNames` (iOS) in the environment config. `WORKERS=N` requires at least N entries in the pool.

```bash
# 3 parallel Android workers — needs 3 AVDs in environments/uat.json → android.avdNames
OS=android WORKERS=3 npm test
```

---

## Reports

Reports are **wiped at the start of every run** — nothing stale accumulates.

```bash
# Auto-generate + open after tests (recommended)
ALLURE=true npm test

# Manually after a run
npm run allure:generate   # build HTML report from allure-results/
npm run allure:open       # open the last generated report in browser
npm run allure:report     # generate + open (combined)
```

### Report artifacts

| Path | Contents | When saved |
|------|----------|------------|
| `reports/allure-results/` | Raw JSON test data | Every run |
| `reports/allure-report/` | Generated HTML report | After `allure:generate` |
| `reports/screenshots/` | End-of-test screenshot (PNG) | Every test |
| `reports/videos/` | Screen recording (MP4) | Failed tests only |
| `reports/appium.log` | Appium server stdout | Every run |
| `reports/run.log` | Structured runner log | Every run |

---

## Test suite (current)

Both suites run on Android and iOS without modification — locators use shared React Native accessibility IDs (`~`).

### `tests/home.spec.js` — Home & Navigation

| Test | Description |
|------|-------------|
| TC-001 | App launches and displays the home screen |
| TC-002 | WEBDRIVER title is visible on the home screen |
| TC-003 | All 7 bottom navigation tabs are visible |
| TC-004 | Tapping Login tab opens the login screen |
| TC-005 | Tapping Forms tab opens the forms screen |
| TC-006 | Tapping Home tab from another tab returns to home |

### `tests/login.spec.js` — Login

| Test | Description |
|------|-------------|
| TC-001 | Login screen shows email field, password field, and LOGIN button |
| TC-002 | Valid credentials produce a success alert |
| TC-003 | Invalid credentials produce an error alert |
| TC-004 | Empty form taps LOGIN silently — stays on login screen |

---

## Author

Pradeep Kr. Rana
