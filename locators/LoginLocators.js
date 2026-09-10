// Locators for the Login screen
// Use accessibility ID (~) for React Native — matches testID prop in the app code
// Use XPath as fallback when accessibility ID is not available

const LoginLocators = {
  usernameField:  '~username-input',
  passwordField:  '~password-input',
  loginButton:    '~login-button',
  errorMessage:   '~error-message',
  loadingSpinner: '~loading-indicator',
  forgotPassword: '~forgot-password-link',
  appLogo:        '~app-logo',
};

module.exports = { LoginLocators };
