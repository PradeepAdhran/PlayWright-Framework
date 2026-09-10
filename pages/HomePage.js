const { BasePage } = require('./BasePage');
const { HomeLocators } = require('../locators/HomeLocators');

class HomePage extends BasePage {

  async waitForHomeScreen() {
    await this.waitForElement(HomeLocators.bottomNav, 20000);
  }

  async isHomeScreenVisible() {
    return await this.isElementVisible(HomeLocators.bottomNav, 10000);
  }

  async tapLatestTab() {
    await this.tapElement(HomeLocators.tabLatest);
  }

  async tapCategoriesTab() {
    await this.tapElement(HomeLocators.tabCategories);
  }

  async tapNearbyTab() {
    await this.tapElement(HomeLocators.tabNearby);
  }

  async tapUpdatesTab() {
    await this.tapElement(HomeLocators.tabUpdates);
  }

  async tapSettingsTab() {
    await this.tapElement(HomeLocators.tabSettings);
  }

  async tapSearchFab() {
    await this.tapElement(HomeLocators.fabSearch);
  }

  async isLatestPanelVisible() {
    return await this.isElementVisible(HomeLocators.panelLatest, 5000);
  }

  async isCategoriesPanelVisible() {
    return await this.isElementVisible(HomeLocators.panelCategories, 5000);
  }

  async isUpdatesPanelVisible() {
    return await this.isElementVisible(HomeLocators.panelUpdates, 5000);
  }
}

module.exports = { HomePage };
