# Mobile Apps Automation (Android & iOS) React Native

Cross-platform mobile automation framework for the **WDIO Demo App** (React Native / Expo), built on **Playwright Test** as the runner and **Appium 3** (via WebdriverIO) as the mobile driver. Supports Android and iOS with a shared Page Object Model, parallel workers, structured logging, and Allure HTML reports.

---

## Tech stack

| Layer | Tool |
|-------|------|
| Test runner | Playwright Test (`@playwright/test`) |
| Mobile driver | Appium 3 via WebdriverIO `remote()` |
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

pages/
  BasePage.js         shared helpers (wait, tap, type, scroll…)
  HomePage.js         home screen actions / assertions
  LoginPage.js        login screen actions / assertions

tests/
  homeTest.js         TC-001–TC-006: app launch, navigation tabs
  loginTest.js        TC-001–TC-004: login screen, valid/invalid credentials, empty form

utils/
  logger.js           tagged console + file logger (DEBUG/INFO/WARN/ERROR)

globalSetup.js        clean reports → boot emulator/simulator → pre-install app → start Appium
globalTeardown.js     stop Appium → kill emulator / shutdown simulator
playwright.config.js  Playwright configuration (workers, timeout, reporters)
run.js                CLI entry-point — reads flags, runs Playwright, opens Allure

test-data/            app binaries — not committed to git, place manually (see below)
  wdiodemoapp.apk     Android build
  wdiodemoapp.app     iOS simulator build

reports/              generated per run (wiped at start of each run)
  allure-results/
  allure-report/
  screenshots/
  videos/
  appium-android.log
  appium-ios.log
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

## Download app builds

App binaries are **not included in this repo** (too large for GitHub). Download them from the official WDIO Demo App releases page:

**https://github.com/webdriverio/native-demo-app/releases**

### Steps

1. Open the link above and click the **latest release**.

2. Scroll down to the **Assets** section and download both files:

   | File to download | Platform |
   |-----------------|----------|
   | `wdio-native-app-v<version>.apk` | Android |
   | `wdio-native-app-v<version>.app.zip` | iOS (zip — unzip after downloading) |

3. Create the `test-data/` folder in the project root if it does not exist:

   ```bash
   mkdir -p test-data
   ```

4. Move the downloaded files into `test-data/` and **rename them exactly** as shown:

   ```
   test-data/
     wdiodemoapp.apk          ← rename from: wdio-native-app-v<version>.apk
     wdiodemoapp.app          ← rename from: the unzipped .app folder
   ```

   > On macOS the `.app.zip` extracts to a folder named `wdio-native-app-v<version>.app` — rename that folder to `wdiodemoapp.app` and move it into `test-data/`.

5. Verify the final structure:

   ```bash
   ls test-data/
   # wdiodemoapp.apk
   # wdiodemoapp.app
   ```

> The filenames must match exactly what is set in `environments/uat.json` (`apkFile` for Android, `appFile` for iOS). The defaults are `wdiodemoapp.apk` and `wdiodemoapp.app`.

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

### npm scripts (recommended)

| Script | What it runs |
|--------|-------------|
| `npm run test:android` | Android only, UAT |
| `npm run test:ios` | iOS only, UAT |
| `npm run test:all` | **Android + iOS simultaneously**, combined Allure report |
| `npm run test:all:uat` | Android + iOS simultaneously, UAT |
| `npm run test:all:staging` | Android + iOS simultaneously, Staging |
| `npm run test:uat` | Android only (default OS), UAT |
| `npm run test:staging` | Android only (default OS), Staging |

### Environment flag reference

All tests run through `run.js`. Extra flags are passed as environment variables.

| Flag | Values | Default | Description |
|------|--------|---------|-------------|
| `ENV` | `uat` \| `staging` | `uat` | Which environment config to load |
| `OS` | `android` \| `ios` | `android` | Target platform |
| `HEADLESS` | `true` \| `false` | `false` | Hide device window |
| `WORKERS` | `1`, `2`, `3`… | `1` | Parallel workers — one device per worker |
| `ALLURE` | `true` \| `false` | `false` | Auto-open Allure report after run |
| `LOG_LEVEL` | `DEBUG` \| `INFO` \| `WARN` \| `ERROR` | `INFO` | Log verbosity |

### Single platform examples

```bash
# Android — visible emulator, UAT, open Allure after run
OS=android ENV=uat HEADLESS=false WORKERS=1 ALLURE=true npm test

# Android — headless, staging, 2 parallel workers
OS=android ENV=staging HEADLESS=true WORKERS=2 npm test

# iOS — visible simulator, UAT
OS=ios ENV=uat HEADLESS=false WORKERS=1 npm test

# iOS — headless, with Allure report
OS=ios ENV=uat HEADLESS=true WORKERS=1 ALLURE=true npm test

# Debug logging
OS=android ENV=uat LOG_LEVEL=DEBUG npm test
```

### Android + iOS simultaneously

Both platforms run in true parallel — Android uses Appium port `4723`, iOS uses port `4724`. Each has its own device map and PID file so they never interfere.

```bash
# Easiest — single command, opens combined Allure report when both finish
npm run test:all

# With explicit environment
npm run test:all:uat
npm run test:all:staging

# Manual equivalent (same as test:all:uat)
OS=android ENV=uat node run.js & OS=ios ENV=uat node run.js & wait && npm run allure:report
```

The combined Allure report shows all 20 tests (10 Android + 10 iOS) in one view.

### Run a single test file

```bash
OS=android ENV=uat npx playwright test tests/homeTest.js
OS=ios     ENV=uat npx playwright test tests/loginTest.js
```

### Parallel workers (multiple devices per platform)

```bash
# 2 parallel Android workers — needs 2 AVDs in environments/uat.json → android.avdNames
OS=android WORKERS=2 npm test
```

---

## Reports

```bash
# Auto-open after tests
ALLURE=true npm test

# Manually after a run
npm run allure:generate   # build HTML report from allure-results/
npm run allure:open       # open in browser
npm run allure:report     # generate + open (combined)
```

### Report artifacts

| Path | Contents | When saved |
|------|----------|------------|
| `reports/allure-results/` | Raw JSON test data | Every run |
| `reports/allure-report/` | Generated HTML report | After `allure:generate` |
| `reports/screenshots/` | End-of-test screenshot (PNG) | Every test |
| `reports/videos/` | Screen recording (MP4) | Failed tests only |
| `reports/appium-android.log` | Android Appium server stdout | Android runs |
| `reports/appium-ios.log` | iOS Appium server stdout | iOS runs |
| `reports/run.log` | Structured runner log | Every run |

> When running Android and iOS simultaneously, both platforms write to the same `allure-results/` folder. The second platform to start skips the clean step automatically so neither overwrites the other's results.

---

## Test suite (current)

Both suites run on Android and iOS without modification — locators use shared React Native accessibility IDs (`~`).

### `tests/homeTest.js` — Home & Navigation

| Test | Description |
|------|-------------|
| TC-001 | App launches and displays the home screen |
| TC-002 | WEBDRIVER title is visible on the home screen |
| TC-003 | All 7 bottom navigation tabs are visible |
| TC-004 | Tapping Login tab opens the login screen |
| TC-005 | Tapping Forms tab opens the forms screen |
| TC-006 | Tapping Home tab from another tab returns to home |

### `tests/loginTest.js` — Login

| Test | Description |
|------|-------------|
| TC-001 | Login screen shows email field, password field, and LOGIN button |
| TC-002 | Valid credentials produce a success alert |
| TC-003 | Invalid credentials produce an error alert |
| TC-004 | Empty form taps LOGIN silently — stays on login screen |

---

## Author

Pradeep Kr. Rana
