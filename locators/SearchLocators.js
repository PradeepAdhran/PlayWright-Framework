const pkg = 'org.fdroid.fdroid';

const SearchLocators = {
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
