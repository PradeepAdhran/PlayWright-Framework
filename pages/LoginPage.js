const { BasePage } = require('./BasePage');
const { LoginLocators } = require('../locators/LoginLocators');

class LoginPage extends BasePage {

  async waitForLoginScreen() {
    await this.waitForElement(LoginLocators.usernameField, 20000);
  }

  async isLoginScreenVisible() {
    return await this.isElementVisible(LoginLocators.usernameField, 5000);
  }

  async isLogoVisible() {
    return await this.isElementVisible(LoginLocators.appLogo, 10000);
  }

  async enterUsername(username) {
    await this.typeText(LoginLocators.usernameField, username);
  }

  async enterPassword(password) {
    await this.typeText(LoginLocators.passwordField, password);
    await this.hideKeyboard();
  }

  async tapLogin() {
    await this.tapElement(LoginLocators.loginButton);
  }

  async isErrorVisible() {
    return await this.isElementVisible(LoginLocators.errorMessage, 5000);
  }

  async getErrorMessage() {
    return await this.getText(LoginLocators.errorMessage);
  }
}

module.exports = { LoginPage };
