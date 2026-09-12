# Mobile Apps Automation (Android & iOS) React Native

App Mobile Automation Framework — cross-platform (Android + iOS) UI automation for the React Native app, built on Playwright Test as the runner and Appium (via WebdriverIO) as the mobile driver.

## What this is

A Playwright + Appium test framework meant to drive the apps on both Android and iOS, using a Page Object Model shared across platforms. Today, only the Android side is actually wired up in code (Appium's `uiautomator2` driver, Android capabilities, `android=` locators); it currently exercises the home/navigation/search flows of a placeholder app (F-Droid, `org.fdroid.fdroid`) while the login flow, real app wiring, and iOS support are being finished — see **Known gaps** below.

## Tech stack

- **Playwright Test** — test runner, reporting, lifecycle hooks (`globalSetup`/`globalTeardown`)
- **Appium 2** — drives the app; today only `appium-uiautomator2-driver` (Android) is installed — an iOS driver (e.g. `appium-xcuitest-driver`) still needs to be added for the iOS side
- **WebdriverIO** (`remote()`) — the client used inside the custom `driver` fixture to talk to Appium
- **Allure** (`allure-playwright`, `allure-commandline`) — HTML test reports

## Project structure

```
environments/     staging.json / uat.json — device capabilities, APK, app package/activity, API base URL, test credentials
fixtures/         appiumFixture.js — the `driver` fixture: starts an Appium session, dismisses permission
                  dialogs, records the screen, saves screenshots (always) and video (on failure), tears
                  down the session after each test
locators/         one file per screen — element selectors only
pages/            one Page Object per screen (BasePage + HomePage, LoginPage, SearchPage) — screen actions,
                  built on top of the locators
tests/            *.spec.js test files
globalSetup.js    clears old reports/test-results, starts the Appium server, writes environment info into
                  the Allure report
globalTeardown.js stops the Appium server
playwright.config.js  single worker, no parallelism (mobile tests run one device/session at a time)
reports/          allure-results, allure-report, screenshots, videos, appium.log (all regenerated per run)
test-data/        APK(s) used by the tests
```

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Node.js | v18+ recommended |
| Android SDK | `ANDROID_HOME` must be set; `emulator` and `adb` must be on PATH |
| Android Virtual Device | Create an AVD and set its name in `environments/<env>.json → avdName` |
| Java 17+ | Required by Allure CLI — `brew install --cask temurin` if not installed |
| Allure CLI | `brew install allure` — needed for report generation |
| Appium uiautomator2 | Installed via `npm run appium:install` (once per machine) |

> **Emulator managed automatically** — `globalSetup.js` kills any running emulator at the start of each run, then launches a fresh one using the `avdName` from the environment config. `HEADLESS=false` opens it with a visible window; `HEADLESS=true` starts it with `-no-window`. You do not need to start the emulator manually.

## Setup

```bash
npm install
npm run appium:install        # installs uiautomator2 driver into local Appium
```

Place your `.apk` file inside `test-data/`, then update `environments/uat.json` (and `staging.json`) with the correct `appPackage`, `appActivity`, `apkFile`, and `avdName` values.

## Configuration

Tests read `environments/<ENV>.json`, selected via the `ENV` environment variable (defaults to `uat`). Each file defines the emulator/device name, Android version, the APK to install, the app's package/activity, the API base URL, and test credentials.

## Running tests

All tests are executed through `run.js` which accepts three environment flags:

| Flag | Values | Default | Description |
|------|--------|---------|-------------|
| `ENV` | `uat` \| `staging` | `uat` | Loads `environments/<ENV>.json` — device, APK, credentials |
| `HEADLESS` | `true` \| `false` | `false` | `true` hides the emulator window, `false` shows it |
| `WORKERS` | `1`, `2`, `3`... | `1` | Number of parallel Playwright workers (keep at `1` per connected device) |
| `ALLURE` | `true` \| `false` | `false` | `true` auto-generates and opens the Allure report after the run |

### Examples

```bash
# Visible emulator, UAT env, 1 worker, open report automatically
HEADLESS=false ENV=uat WORKERS=1 ALLURE=true npm test

# Headless, staging, 2 workers (use when 2 devices/emulators are connected)
HEADLESS=true ENV=staging WORKERS=2 npm test

# Headless UAT with auto report
HEADLESS=true ENV=uat WORKERS=1 ALLURE=true npm test

# Shorthand scripts (HEADLESS=false, WORKERS=1, ALLURE=false by default)
npm run test:uat
npm run test:staging
```

### Run a specific test file

```bash
ENV=uat npx playwright test tests/home.spec.js
```

## Reports

Reports, screenshots, and videos are **wiped at the start of every run** by `globalSetup.js` — nothing stale ever accumulates.

```bash
# Auto-generate + open after tests (recommended)
ALLURE=true npm test

# Or manually after a run
npm run allure:generate   # build HTML report from allure-results/
npm run allure:open       # open the last generated report in browser
npm run allure:report     # generate + open (combined)
```

> **Note:** `allure` CLI requires Java. If `npm run allure:report` fails with a `JAVA_HOME` error, fix it once:
> ```bash
> echo 'export JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home' >> ~/.zshrc
> source ~/.zshrc
> ```
> When using `ALLURE=true npm test`, `JAVA_HOME` is set automatically inside `run.js`.
> Note: if required you can add/update your local JAVA_HOME path here

### Report artifacts

| Path | Contents | When saved |
|------|----------|------------|
| `reports/allure-results/` | Raw JSON test results | Every run |
| `reports/allure-report/` | Generated HTML report | After `allure:generate` |
| `reports/screenshots/` | End-of-test screenshot (PNG) | Every test |
| `reports/videos/` | Screen recording (MP4) | Failed tests only |
| `reports/appium.log` | Appium server output | Every run |

## Known gaps / TODO

- **iOS is not implemented yet** — despite the framework's cross-platform intent, there's no `appium-xcuitest-driver` dependency, no iOS capabilities in `environments/*.json` (`platformName`, device/UDID, `.app`/`.ipa` path), and no iOS-specific locators. `locators/*.js` are all `android=new UiSelector()`/accessibility-id selectors tied to the Android build; a real iOS pass will likely need per-platform locator variants (or an abstraction in the page objects) since XCUITest selectors don't share syntax with UiAutomator2.
- **Login tests are disabled** — `tests/login.spec.js.bak` is a complete `LoginPage` test suite (TC-001–TC-004) but is not picked up by Playwright while it keeps the `.bak` extension. It also has an open `TODO` to replace a fixed `pause()` with a real `HomePage` assertion after a successful login. Rename it back to `login.spec.js` and update the locators for the real apps to bring it back into the suite.
- **Target app is a placeholder** — `environments/*.json` currently point at F-Droid (`org.fdroid.fdroid`) and `test-data/calculator.apk`, not the real app. Swap in the app's APK, package name and activity, and update `locators/` accordingly before treating this as a real regression suite.
- **`tests/example.spec.js`** is the default Playwright starter test (a browser test against google.com) — it doesn't use the Appium fixture at all and isn't representative of this suite; safe to delete once the framework is trusted.
- **Credentials are plaintext** in `environments/staging.json` and `environments/uat.json` — worth moving to environment variables or a secrets store before this repo is shared more widely.
- **Single worker only** — `playwright.config.js` sets `fullyParallel: false, workers: 1` because only one Appium session/device can run at a time; this is expected, not a bug, but it means test suite runtime scales linearly with test count.

## Author

Pradeep Kr. Rana
