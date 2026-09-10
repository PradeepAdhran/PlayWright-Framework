class BasePage {
  constructor(driver) {
    this.driver = driver;
  }

  async waitForElement(locator, timeout = 15000) {
    const el = await this.driver.$(locator);
    await el.waitForDisplayed({ timeout });
    return el;
  }

  async tapElement(locator) {
    const el = await this.waitForElement(locator);
    await el.click();
  }

  async typeText(locator, text) {
    const el = await this.waitForElement(locator);
    await el.clearValue();
    await el.setValue(text);
  }

  async getText(locator) {
    const el = await this.waitForElement(locator);
    return await el.getText();
  }

  async isElementVisible(locator, timeout = 5000) {
    try {
      const el = await this.driver.$(locator);
      await el.waitForDisplayed({ timeout });
      return true;
    } catch {
      return false;
    }
  }

  async pause(ms = 1000) {
    await this.driver.pause(ms);
  }

  async hideKeyboard() {
    try {
      await this.driver.hideKeyboard();
    } catch {
      // keyboard may already be hidden
    }
  }

  async scrollDown() {
    await this.driver.execute('mobile: scroll', { direction: 'down' });
  }
}

module.exports = { BasePage };
