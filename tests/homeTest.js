const { test, expect } = require('../fixtures/appiumFixture');
const { HomePage } = require('../pages/HomePage');
const { HomeLocators } = require('../locators/HomeLocators');

test.describe('WDIO Demo App — Home & Navigation', () => {

  // ─────────────────────────────────────────────────────────────────
  // TC-001: App launches and shows the home screen
  // ─────────────────────────────────────────────────────────────────
  test('TC-001: App should launch and display the home screen', async ({ driver }) => {
    const home = new HomePage(driver);

    // Step 1: Wait for the home screen to fully appear
    await home.waitForHomeScreen();

    // Step 2: The home screen container is visible
    const visible = await home.isHomeScreenVisible();
    expect(visible).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────
  // TC-002: App title and subtitle are displayed
  // ─────────────────────────────────────────────────────────────────
  test('TC-002: App should display the WEBDRIVER title on the home screen', async ({ driver }) => {
    const home = new HomePage(driver);

    // Step 1: Home screen loads
    await home.waitForHomeScreen();

    // Step 2: The app title "WEBDRIVER" is visible
    const titleVisible = await home.isAppTitleVisible();
    expect(titleVisible).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────
  // TC-003: All bottom navigation tabs are present
  // ─────────────────────────────────────────────────────────────────
  test('TC-003: All seven bottom navigation tabs should be visible', async ({ driver }) => {
    const home = new HomePage(driver);

    // Step 1: Home screen loads
    await home.waitForHomeScreen();

    // Step 2: Each tab is visible in the bottom navigation bar
    for (const [name, locator] of [
      ['Home',    HomeLocators.tabHome],
      ['Webview', HomeLocators.tabWebview],
      ['Login',   HomeLocators.tabLogin],
      ['Forms',   HomeLocators.tabForms],
      ['Swipe',   HomeLocators.tabSwipe],
      ['Drag',    HomeLocators.tabDrag],
      ['Menu',    HomeLocators.tabMenu],
    ]) {
      const visible = await home.isTabVisible(locator);
      expect(visible, `${name} tab should be visible`).toBe(true);
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // TC-004: Navigate to the Login tab
  // ─────────────────────────────────────────────────────────────────
  test('TC-004: Tapping Login tab should open the login screen', async ({ driver }) => {
    const home = new HomePage(driver);
    const { LoginPage } = require('../pages/LoginPage');
    const login = new LoginPage(driver);

    // Step 1: Home screen loads
    await home.waitForHomeScreen();

    // Step 2: Tap the Login tab in the bottom navigation
    await home.tapLoginTab();

    // Step 3: The login screen appears
    const loginVisible = await login.isLoginScreenVisible();
    expect(loginVisible).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────
  // TC-005: Navigate to the Forms tab
  // ─────────────────────────────────────────────────────────────────
  test('TC-005: Tapping Forms tab should open the forms screen', async ({ driver }) => {
    const home = new HomePage(driver);

    // Step 1: Home screen loads
    await home.waitForHomeScreen();

    // Step 2: Tap the Forms tab
    await home.tapFormsTab();

    // Step 3: We are on the Forms screen (tab remains selected)
    const formsTabVisible = await home.isTabVisible(HomeLocators.tabForms);
    expect(formsTabVisible).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────
  // TC-006: Navigate back to Home from another tab
  // ─────────────────────────────────────────────────────────────────
  test('TC-006: Tapping Home tab from another tab should return to the home screen', async ({ driver }) => {
    const home = new HomePage(driver);

    // Step 1: Home screen loads
    await home.waitForHomeScreen();

    // Step 2: Navigate away to Swipe tab
    await home.tapSwipeTab();
    await driver.pause(1000);

    // Step 3: Tap Home tab to return
    await home.tapHomeTab();

    // Step 4: Home screen is visible again
    const homeVisible = await home.isHomeScreenVisible();
    expect(homeVisible).toBe(true);
  });

});
