const { BasePage } = require('./BasePage');
const { HomeLocators } = require('../locators/HomeLocators');

class HomePage extends BasePage {

  async waitForHomeScreen() {
    await this.waitForElement(HomeLocators.homeScreen, 90000);
  }

  async isHomeScreenVisible() {
    return await this.isElementVisible(HomeLocators.homeScreen, 20000);
  }

  async isAppTitleVisible() {
    return await this.isElementVisible(HomeLocators.appTitle, 5000);
  }

  // ── Bottom nav tab actions ──────────────────────────────────────────

  async tapHomeTab()    { await this.tapElement(HomeLocators.tabHome); }
  async tapWebviewTab() { await this.tapElement(HomeLocators.tabWebview); }
  async tapLoginTab()   { await this.tapElement(HomeLocators.tabLogin); }
  async tapFormsTab()   { await this.tapElement(HomeLocators.tabForms); }
  async tapSwipeTab()   { await this.tapElement(HomeLocators.tabSwipe); }
  async tapDragTab()    { await this.tapElement(HomeLocators.tabDrag); }
  async tapMenuTab()    { await this.tapElement(HomeLocators.tabMenu); }

  // ── Tab visibility checks ───────────────────────────────────────────

  async isTabVisible(tabLocator) {
    return await this.isElementVisible(tabLocator, 5000);
  }
}

module.exports = { HomePage };

