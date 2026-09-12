const { BasePage } = require('./BasePage');
const { LoginLocators } = require('../locators/LoginLocators');

class LoginPage extends BasePage {

  async waitForLoginScreen() {
    await this.waitForElement(LoginLocators.loginScreen, 20000);
  }

  async isLoginScreenVisible() {
    return await this.isElementVisible(LoginLocators.loginScreen, 5000);
  }

  async selectLoginTab() {
    await this.tapElement(LoginLocators.btnLoginTab);
  }

  async enterEmail(email) {
    await this.typeText(LoginLocators.inputEmail, email);
  }

  async enterPassword(password) {
    await this.typeText(LoginLocators.inputPassword, password);
    await this.hideKeyboard();
  }

  async tapLogin() {
    await this.tapElement(LoginLocators.btnLogin);
  }

  async dismissAlert() {
    try {
      await this.tapElement(LoginLocators.alertOk);
    } catch { /* no alert shown */ }
  }

  async login(email, password) {
    await this.waitForLoginScreen();
    await this.selectLoginTab();
    await this.enterEmail(email);
    await this.enterPassword(password);
    await this.tapLogin();
  }
}

module.exports = { LoginPage };
