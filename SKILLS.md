# SKILLS.md — Framework capabilities reference

A quick reference for what this framework can already do, so a new test starts from what's here instead of re-reading every file. "Skill" below just means a reusable method already available on a fixture or page object.

This is meant to be a cross-platform (Android + iOS) framework, but everything below is currently Android-only in practice — the fixture's capabilities, the locators, and the one driver dependency (`appium-uiautomator2-driver`) are all Android-specific. Treat "add iOS" as its own piece of work, not something these skills already cover — see README's Known gaps.

## The `driver` fixture (`fixtures/appiumFixture.js`)

Every test that drives the app pulls in `{ test, expect }` from `../fixtures/appiumFixture` (not from `@playwright/test` directly) and takes `driver` as a fixture argument. Per test, it automatically:

- starts an Appium session using the capabilities in `environments/<ENV>.json` (device, platform version, APK, package/activity) — these capabilities are Android-shaped (`platformName: 'Android'`, `appium:automationName: 'UiAutomator2'`); an iOS environment file/capability set still needs to be added
- dismisses the common Android permission dialogs ("Allow", "Allow only while using the app") on launch
- starts a screen recording
- after the test: takes a screenshot (always saved + attached to the Allure report) and, only if the test failed, saves + attaches the video
- tears down the Appium session

None of this needs to be written per test — just destructure `driver` and start calling page-object methods.

## `BasePage` — available on every page object (`pages/BasePage.js`)

Every page object extends `BasePage`, so these are always available:

- `waitForElement(locator, timeout = 15000)` — waits for an element to be displayed and returns it
- `tapElement(locator)`
- `typeText(locator, text)` — clears the field first, then sets the value
- `getText(locator)`
- `isElementVisible(locator, timeout = 5000)` — non-throwing boolean check, safe to use for assertions
- `pause(ms = 1000)`
- `hideKeyboard()`
- `scrollDown()`

## `HomePage` skills (`pages/HomePage.js` + `locators/HomeLocators.js`)

- `waitForHomeScreen()` / `isHomeScreenVisible()`
- `tapLatestTab()` / `tapCategoriesTab()` / `tapNearbyTab()` / `tapUpdatesTab()` / `tapSettingsTab()`
- `tapSearchFab()`
- `isLatestPanelVisible()` / `isCategoriesPanelVisible()` / `isUpdatesPanelVisible()`

Covered by `tests/home.spec.js` (TC-001–TC-006).

## `LoginPage` skills (`pages/LoginPage.js` + `locators/LoginLocators.js`)

- `waitForLoginScreen()` / `isLoginScreenVisible()`
- `isLogoVisible()`
- `enterUsername(username)` / `enterPassword(password)` (also hides the keyboard after typing)
- `tapLogin()`
- `isErrorVisible()` / `getErrorMessage()`

Currently only exercised by `tests/login.spec.js.bak`, which is disabled — see README's Known gaps before relying on this.

## `SearchPage` skills (`pages/SearchPage.js` + `locators/SearchLocators.js`)

- `waitForSearchScreen()`
- `typeSearchQuery(query)`
- `clearSearch()` / `goBack()`
- `isResultListVisible()`
- `getFirstResultName()` / `getResultCount()`

## Locator conventions

- Prefer accessibility id (`~testID`) for React Native screens — it matches the app's `testID` prop directly (see `locators/LoginLocators.js`).
- Fall back to `android=new UiSelector()...` by `resourceId` or `text` for native Android chrome that has no `testID` (bottom navigation, system search widgets — see `locators/HomeLocators.js` and `locators/SearchLocators.js`).
- Each screen's locators live in their own `locators/<Screen>Locators.js` and are only ever referenced from that screen's page object — don't reach into another screen's locator file from a page object.

## Adding a new screen or flow

1. Add `locators/<Screen>Locators.js` with that screen's selectors only.
2. Add `pages/<Screen>Page.js` extending `BasePage`, exposing actions/assertions built from those locators (not raw locators) to tests.
3. Add `tests/<screen>.spec.js` importing `{ test, expect }` from `../fixtures/appiumFixture` and the new page object. Use `tests/home.spec.js` as the template for a working, enabled suite; `tests/login.spec.js.bak` shows the pattern for a login-style flow (finish its TODO before copying it verbatim).

## Environment switching

- `ENV=uat` (default) or `ENV=staging`, read by both `globalSetup.js` and `fixtures/appiumFixture.js` from `environments/<ENV>.json`.
- That file is the single source of truth for: device name/platform version, which APK to install, the app's package/activity, `apiBaseUrl`, and the `validUser`/`invalidUser` test credentials.

## Reporting skills

- Allure results are written automatically per test via the `allure-playwright` reporter configured in `playwright.config.js` — no manual attach calls needed beyond what the fixture already does.
- `npm run allure:report` builds and opens the HTML report (`allure:generate` + `allure:open` individually).
- `globalSetup.js` deletes `reports/` and `test-results/` at the start of every run, so copy anything out you want to keep before the next run.
