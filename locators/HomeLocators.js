const OS = (process.env.OS || 'android').toLowerCase();

// Accessibility IDs are shared across platforms (React Native app).
// Android-specific resource-id selectors use android=new UiSelector().
const HomeLocators = {
  // ── Bottom navigation tabs (shared) ──────────────────────────────
  tabHome:    '~Home',
  tabWebview: '~Webview',
  tabLogin:   '~Login',
  tabForms:   '~Forms',
  tabSwipe:   '~Swipe',
  tabDrag:    '~Drag',
  tabMenu:    '~Menu',

  // ── Home screen container (shared) ───────────────────────────────
  homeScreen: '~Home-screen',

  // ── App header text (Android uses text matcher, iOS predicate) ───
  appTitle: OS === 'ios'
    ? '-ios predicate string:label == "WEBDRIVER"'
    : 'android=new UiSelector().text("WEBDRIVER")',

  appSubtitle: OS === 'ios'
    ? '-ios predicate string:label == "Demo app for the appium-boilerplate"'
    : 'android=new UiSelector().text("Demo app for the appium-boilerplate")',
};

module.exports = { HomeLocators };
