const { BasePage } = require('./BasePage');
const { SearchLocators } = require('../locators/SearchLocators');

class SearchPage extends BasePage {

  async waitForSearchScreen() {
    await this.waitForElement(SearchLocators.searchInput, 10000);
  }

  async typeSearchQuery(query) {
    await this.typeText(SearchLocators.searchInput, query);
  }

  async clearSearch() {
    await this.tapElement(SearchLocators.clearButton);
  }

  async goBack() {
    await this.tapElement(SearchLocators.backButton);
  }

  async isResultListVisible() {
    return await this.isElementVisible(SearchLocators.appList, 10000);
  }

  async getFirstResultName() {
    const firstApp = await this.driver.$$(SearchLocators.appName);
    if (firstApp.length > 0) {
      return await firstApp[0].getText();
    }
    return null;
  }

  async getResultCount() {
    const results = await this.driver.$$(SearchLocators.appName);
    return results.length;
  }
}

module.exports = { SearchPage };
