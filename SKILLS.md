# SKILLS.md — Framework capabilities reference

A quick reference for what this framework can do today, so writing a new test starts from existing building blocks rather than re-reading every file.

**Platform support:** Android (`OS=android`) and iOS (`OS=ios`) — both fully working, 10/10 tests passing on each platform. All page objects and locators are cross-platform; accessibility IDs (`~`) are shared between Android and iOS for the React Native app.

---

## The `driver` fixture (`fixtures/appiumFixture.js`)

Import from the fixture, never from `@playwright/test` directly:

```js
const { test, expect, credentials } = require('../fixtures/appiumFixture');
```

Per test, the fixture automatically:

- **Looks up the device** for the current Playwright worker via `.device-map.json` (written by `globalSetup`; maps `workerIndex → deviceSerial/UDID`), so parallel workers each talk to their own device
- **Starts an Appium session** with platform-appropriate capabilities:
  - Android: `UiAutomator2`, `appPackage`, `appActivity`, `noReset: false`
  - iOS: `XCUITest`, `bundleId`, `noReset: true` (app pre-installed by `globalSetup`)
- **iOS only:** terminates + reactivates the app and taps the Home tab to reset React Native navigation state before each test
- **Dismisses permission dialogs** (Android: "Allow" / "Allow only while using the app"; iOS: system alerts via `autoAcceptAlerts` + fallback button clicks)
- **Starts screen recording** (`timeLimit: 180s`)
- After the test: **captures a screenshot** (always attached to Allure), **saves video** (only on failure), closes the session

---

## Credentials (`credentials` export)

```js
const { test, expect, credentials } = require('../fixtures/appiumFixture');

// credentials.validUser.username / .password
// credentials.invalidUser.username / .password
```

Priority: `.env` vars (`UAT_VALID_USER`, `UAT_VALID_PASS`, etc.) → `environments/<env>.json → credentials`.

---

## `BasePage` — available on every page object (`pages/BasePage.js`)

All page objects extend `BasePage`. These methods are always available:

| Method | Signature | Description |
|--------|-----------|-------------|
| `waitForElement` | `(locator, timeout=15000)` | Waits for element to be displayed; returns the element |
| `tapElement` | `(locator)` | Wait + click |
| `typeText` | `(locator, text)` | Clear field then set value |
| `getText` | `(locator)` | Return element text |
| `isElementVisible` | `(locator, timeout=5000)` | Non-throwing boolean — safe for assertions |
| `pause` | `(ms=1000)` | `driver.pause` wrapper |
| `hideKeyboard` | `()` | Silent — no error if keyboard isn't shown |
| `scrollDown` | `()` | `mobile: scroll` down |

---

## `HomePage` skills (`pages/HomePage.js` + `locators/HomeLocators.js`) — tested in `tests/homeTest.js`

```js
const { HomePage } = require('../pages/HomePage');
const home = new HomePage(driver);
```

**Assertions**

| Method | Returns | Description |
|--------|---------|-------------|
| `waitForHomeScreen()` | — | Wait up to 20s for `~Home-screen` to appear |
| `isHomeScreenVisible()` | `bool` | Non-throwing; timeout 10s |
| `isAppTitleVisible()` | `bool` | Checks `WEBDRIVER` header text |
| `isTabVisible(locator)` | `bool` | Pass any `HomeLocators.tab*` value |

**Navigation**

| Method | Description |
|--------|-------------|
| `tapHomeTab()` | Bottom nav → Home |
| `tapWebviewTab()` | Bottom nav → Webview |
| `tapLoginTab()` | Bottom nav → Login |
| `tapFormsTab()` | Bottom nav → Forms |
| `tapSwipeTab()` | Bottom nav → Swipe |
| `tapDragTab()` | Bottom nav → Drag |
| `tapMenuTab()` | Bottom nav → Menu |

**Locators** (`locators/HomeLocators.js`)

```js
HomeLocators.tabHome      // '~Home'
HomeLocators.tabWebview   // '~Webview'
HomeLocators.tabLogin     // '~Login'
HomeLocators.tabForms     // '~Forms'
HomeLocators.tabSwipe     // '~Swipe'
HomeLocators.tabDrag      // '~Drag'
HomeLocators.tabMenu      // '~Menu'
HomeLocators.homeScreen   // '~Home-screen'
HomeLocators.appTitle     // iOS predicate / Android UiSelector — platform-auto-selected
```

---

## `LoginPage` skills (`pages/LoginPage.js` + `locators/LoginLocators.js`) — tested in `tests/loginTest.js`

```js
const { LoginPage } = require('../pages/LoginPage');
const login = new LoginPage(driver);
```

**Assertions**

| Method | Returns | Description |
|--------|---------|-------------|
| `waitForLoginScreen()` | — | Wait up to 20s for `~Login-screen` |
| `isLoginScreenVisible()` | `bool` | Non-throwing; timeout 5s |
| `isElementVisible(locator, timeout)` | `bool` | From `BasePage` — used for field/button checks |

**Actions**

| Method | Description |
|--------|-------------|
| `selectLoginTab()` | Tap `~button-login-container` to switch to Login form |
| `enterEmail(email)` | Type into `~input-email` |
| `enterPassword(password)` | Type into `~input-password` + hide keyboard |
| `tapLogin()` | Tap `~button-LOGIN` |
| `dismissAlert()` | Tap OK on the success/error alert (silent if no alert) |
| `login(email, password)` | Composite: `waitForLoginScreen` → `selectLoginTab` → `enterEmail` → `enterPassword` → `tapLogin` |

**Locators** (`locators/LoginLocators.js`)

```js
LoginLocators.loginScreen    // '~Login-screen'
LoginLocators.btnLoginTab    // '~button-login-container'
LoginLocators.btnSignupTab   // '~button-sign-up-container'
LoginLocators.inputEmail     // '~input-email'
LoginLocators.inputPassword  // '~input-password'
LoginLocators.btnLogin       // '~button-LOGIN'
LoginLocators.alertOk        // iOS predicate / Android UiSelector — platform-auto-selected
```

---

## Locator conventions

- **Prefer accessibility ID** (`~testID`) — works on both Android and iOS without platform guards; matches the React Native `testID` / `accessibilityLabel` prop directly
- **Platform-conditional selectors** — when a locator must differ by OS, use the pattern already in `HomeLocators.js`/`LoginLocators.js`:
  ```js
  const OS = (process.env.OS || 'android').toLowerCase();
  myLocator: OS === 'ios'
    ? '-ios predicate string:label == "X"'
    : 'android=new UiSelector().text("X")',
  ```
- **Keep locators out of page objects and tests** — selectors belong in `locators/`, actions in `pages/`, assertions in `tests/`

---

## Adding a new screen or flow

1. **`locators/<Screen>Locators.js`** — selectors only; export a plain object
2. **`pages/<Screen>Page.js`** — extend `BasePage`; expose semantic methods (not raw locators) to tests
3. **`tests/<Screen>Test.js`** — import `{ test, expect }` from `../fixtures/appiumFixture`; use `homeTest.js` as the template

```js
// tests/myScreenTest.js
const { test, expect } = require('../fixtures/appiumFixture');
const { MyPage } = require('../pages/MyPage');

test.describe('My Screen', () => {
  test('TC-001: ...', async ({ driver }) => {
    const page = new MyPage(driver);
    await page.waitForMyScreen();
    expect(await page.isSomethingVisible()).toBe(true);
  });
});
```

---

## Environment / device switching

- `ENV=uat` (default) or `ENV=staging` → loads `environments/<ENV>.json`
- `OS=android` (default) or `OS=ios` → selects the `android` or `ios` section of that file
- That section is the single source of truth for: device/simulator pool, app file, package/bundle ID, platform version

---

## Parallel workers

- `WORKERS=N` → N Playwright workers, one device per worker
- `globalSetup.js` boots N devices and writes `.device-map.json` mapping `workerIndex → deviceSerial/UDID`
- The fixture reads `testInfo.workerIndex` to look up its device — no manual wiring needed
- Device pool must have ≥ N entries in `avdNames` (Android) or `simulatorNames` (iOS)

---

## Logging

```js
const { createLogger } = require('../utils/logger');
const log = createLogger('mytag');

log.debug('...'); log.info('...'); log.warn('...'); log.error('...');
```

`LOG_LEVEL=DEBUG|INFO|WARN|ERROR` (default `INFO`). Output goes to console (colour-coded) and `reports/run.log`.

---

## Reporting

- Allure results are written automatically per test by the `allure-playwright` reporter
- `ALLURE=true npm test` — auto-generate + open report after run
- `npm run allure:report` — manually build + open after a run
- `JAVA_HOME` is resolved automatically via `/usr/libexec/java_home`; no shell fix needed

---

## iOS-specific notes

- **App pre-install:** `globalSetup.js` runs `xcrun simctl install <udid> <app>` after the simulator boots, so Appium sessions skip the slow first-install step (`noReset: true` in capabilities)
- **Navigation state reset:** React Native persists navigation state between app launches; the fixture does `terminateApp` → `activateApp` → tap Home tab at the start of every session
- **First session in a run:** ~40–50s (WDA server startup — happens once per run); subsequent sessions ~10–15s
