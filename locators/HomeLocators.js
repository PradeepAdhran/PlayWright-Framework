const pkg = 'org.fdroid.fdroid';

const HomeLocators = {
  // Bottom navigation tabs (by content-desc)
  tabLatest:     '~Latest',
  tabCategories: '~Categories',
  tabNearby:     '~Nearby',
  tabUpdates:    '~Updates',
  tabSettings:   '~Settings',

  // Main content areas (by resource-id)
  viewPager:       `android=new UiSelector().resourceId("${pkg}:id/main_view_pager")`,
  bottomNav:       `android=new UiSelector().resourceId("${pkg}:id/bottom_navigation")`,
  swipeRefresh:    `android=new UiSelector().resourceId("${pkg}:id/swipe_to_refresh")`,
  fabSearch:       `android=new UiSelector().resourceId("${pkg}:id/fab_search")`,
  emptyState:      `android=new UiSelector().resourceId("${pkg}:id/empty_state")`,

  // Tab content panels
  panelLatest:     `android=new UiSelector().resourceId("${pkg}:id/latest")`,
  panelCategories: `android=new UiSelector().resourceId("${pkg}:id/categories")`,
  panelNearby:     `android=new UiSelector().resourceId("${pkg}:id/nearby")`,
  panelUpdates:    `android=new UiSelector().resourceId("${pkg}:id/updates")`,
  panelSettings:   `android=new UiSelector().resourceId("${pkg}:id/settings")`,
};

module.exports = { HomeLocators };
