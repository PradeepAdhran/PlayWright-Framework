const OS  = (process.env.OS || 'android').toLowerCase();
const pkg = 'org.fdroid.fdroid';

const SearchLocators = OS === 'ios' ? {
  // ── iOS (XCUITest) ────────────────────────────────────────────────
  searchCard:  '-ios class chain:**/XCUIElementTypeSearchField',
  searchInput: '-ios predicate string:type == "XCUIElementTypeSearchField"',
  clearButton: '~Clear text',
  backButton:  '~Back',
  sortButton:  '~Sort',
  appList:     '-ios class chain:**/XCUIElementTypeTable',
  appName:     '-ios predicate string:type == "XCUIElementTypeStaticText" AND value BEGINSWITH[c] ""',
  installBtn:  '~Install',
} : {
  // ── Android (UiAutomator2) ────────────────────────────────────────
  searchCard:   `android=new UiSelector().resourceId("${pkg}:id/search_card")`,
  searchInput:  `android=new UiSelector().resourceId("${pkg}:id/search")`,
  clearButton:  '~Clear search',
  backButton:   '~Back',
  sortButton:   '~Sort search',
  appList:      `android=new UiSelector().resourceId("${pkg}:id/app_list")`,
  appName:      `android=new UiSelector().resourceId("${pkg}:id/app_name")`,
  installBtn:   '~Install',
};

module.exports = { SearchLocators };
