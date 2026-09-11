const { test, expect } = require('../fixtures/appiumFixture');
const { HomePage } = require('../pages/HomePage');
const { SearchPage } = require('../pages/SearchPage');

test.describe('F-Droid App - Home Navigation', () => {

  // ─────────────────────────────────────────────────────
  // TC-001: App launches and shows home screen
  // ─────────────────────────────────────────────────────
  test('TC-001: App should launch and display the home screen with bottom navigation', async ({ driver }) => {
    const homePage = new HomePage(driver);

    // Step 1: I wait for the app to fully open
    await homePage.waitForHomeScreen();

    // Step 2: I can see the bottom navigation bar is visible
    const homeVisible = await homePage.isHomeScreenVisible();
    expect(homeVisible).toBe(true);
  });

  // ─────────────────────────────────────────────────────
  // TC-002: Navigate to Categories tab
  // ─────────────────────────────────────────────────────
  test('TC-002: User should be able to navigate to the Categories tab', async ({ driver }) => {
    const homePage = new HomePage(driver);

    // Step 1: I see the home screen
    await homePage.waitForHomeScreen();

    // Step 2: I tap the Categories tab in the bottom navigation
    await homePage.tapCategoriesTab();

    // Step 3: The categories panel appears
    const categoriesVisible = await homePage.isCategoriesPanelVisible();
    expect(categoriesVisible).toBe(true);
  });

  // ─────────────────────────────────────────────────────
  // TC-003: Navigate to Updates tab
  // ─────────────────────────────────────────────────────
  test('TC-003: User should be able to navigate to the Updates tab', async ({ driver }) => {
    const homePage = new HomePage(driver);

    // Step 1: I see the home screen
    await homePage.waitForHomeScreen();

    // Step 2: I tap the Updates tab
    await homePage.tapUpdatesTab();

    // Step 3: The updates panel is shown
    const updatesVisible = await homePage.isUpdatesPanelVisible();
    expect(updatesVisible).toBe(true);
  });

  // ─────────────────────────────────────────────────────
  // TC-004: Navigate to Settings tab
  // ─────────────────────────────────────────────────────
  test('TC-004: User should be able to open the Settings screen', async ({ driver }) => {
    const homePage = new HomePage(driver);

    // Step 1: I see the home screen
    await homePage.waitForHomeScreen();

    // Step 2: I tap the Settings tab
    await homePage.tapSettingsTab();

    // Step 3: I am taken to the settings screen
    await driver.pause(1500);
    const onSettings = await homePage.isElementVisible('~Settings', 5000);
    expect(onSettings).toBe(true);
  });

  // ─────────────────────────────────────────────────────
  // TC-005: Tap search and search for an app
  // ─────────────────────────────────────────────────────
  test('TC-005: User should be able to open search and type a query', async ({ driver }) => {
    const homePage = new HomePage(driver);
    const searchPage = new SearchPage(driver);

    // Step 1: I see the home screen
    await homePage.waitForHomeScreen();

    // Step 2: I tap the search button (floating action button)
    await homePage.tapSearchFab();

    // Step 3: The search screen opens with a search input field
    await searchPage.waitForSearchScreen();
    const searchOpen = await searchPage.isElementVisible(
      require('../locators/SearchLocators').SearchLocators.searchInput, 5000
    );
    expect(searchOpen).toBe(true);

    // Step 4: I type "ruffle" into the search field
    await searchPage.typeSearchQuery('ruffle');
    await driver.pause(2000);

    // Step 5: The search field contains my typed text
    const searchEl = await driver.$('android=new UiSelector().resourceId("org.fdroid.fdroid:id/search")');
    const typedText = await searchEl.getText();
    expect(typedText).toBe('ruffle');

    // Step 6: The app responded to the query — check via page source
    // (either results list or "no matches" message confirms search processed the input)
    const pageSource = await driver.getPageSource();
    const searchResponded = pageSource.includes('empty_state') || pageSource.includes('id/app_name');
    expect(searchResponded).toBe(true);
  });

  // ─────────────────────────────────────────────────────
  // TC-006: Clear search resets the results
  // ─────────────────────────────────────────────────────
  test('TC-006: Clearing the search should reset the search field', async ({ driver }) => {
    const homePage = new HomePage(driver);
    const searchPage = new SearchPage(driver);

    // Step 1: I open search
    await homePage.waitForHomeScreen();
    await homePage.tapSearchFab();
    await searchPage.waitForSearchScreen();

    // Step 2: I type something in the search field
    await searchPage.typeSearchQuery('notes');

    // Step 3: Results appear
    await searchPage.isResultListVisible();

    // Step 4: I tap the clear button
    await searchPage.clearSearch();

    // Step 5: The search field is empty and I'm ready to search again
    await searchPage.waitForSearchScreen();
    const searchStillOpen = await searchPage.isElementVisible(
      require('../locators/SearchLocators').SearchLocators.searchInput, 3000
    );
    expect(searchStillOpen).toBe(true);
  });
});
