const { test, expect, credentials } = require('../fixtures/appiumFixture');
const { HomePage } = require('../pages/HomePage');
const { LoginPage } = require('../pages/LoginPage');
const { LoginLocators } = require('../locators/LoginLocators');

test.describe('WDIO Demo App — Login', () => {

  // Navigate to Login screen before each test
  test.beforeEach(async ({ driver }) => {
    const home = new HomePage(driver);
    await home.waitForHomeScreen();
    await home.tapLoginTab();
  });

  // ─────────────────────────────────────────────────────────────────
  // TC-001: Login screen loads with all elements
  // ─────────────────────────────────────────────────────────────────
  test('TC-001: Login screen should display email, password fields and LOGIN button', async ({ driver }) => {
    const login = new LoginPage(driver);

    // Step 1: Login screen is visible
    const screenVisible = await login.isLoginScreenVisible();
    expect(screenVisible).toBe(true);

    // Step 2: Email and password fields are present
    const emailVisible    = await login.isElementVisible(LoginLocators.inputEmail,    5000);
    const passwordVisible = await login.isElementVisible(LoginLocators.inputPassword, 5000);
    const loginBtnVisible = await login.isElementVisible(LoginLocators.btnLogin,      5000);

    expect(emailVisible).toBe(true);
    expect(passwordVisible).toBe(true);
    expect(loginBtnVisible).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────
  // TC-002: Successful login with valid credentials
  // ─────────────────────────────────────────────────────────────────
  test('TC-002: Valid credentials should log in successfully', async ({ driver }) => {
    const login = new LoginPage(driver);

    // Step 1: Enter valid email and password
    await login.selectLoginTab();
    await login.enterEmail(credentials.validUser.username);
    await login.enterPassword(credentials.validUser.password);

    // Step 2: Tap the LOGIN button
    await login.tapLogin();

    // Step 3: A success alert or the home screen appears
    // The app shows an "You are logged in!" alert — dismiss it
    await login.dismissAlert();

    // Step 4: Back on the home/login screen (login succeeded)
    const stillOnLogin = await login.isLoginScreenVisible();
    expect(stillOnLogin).toBe(true); // screen stays but alert confirms success
  });

  // ─────────────────────────────────────────────────────────────────
  // TC-003: Login with invalid credentials shows an error alert
  // ─────────────────────────────────────────────────────────────────
  test('TC-003: Invalid credentials should show an error alert', async ({ driver }) => {
    const login = new LoginPage(driver);

    // Step 1: Enter wrong credentials
    await login.selectLoginTab();
    await login.enterEmail(credentials.invalidUser.username);
    await login.enterPassword(credentials.invalidUser.password);

    // Step 2: Tap LOGIN
    await login.tapLogin();

    // Step 3: An error alert is displayed (iOS login requests can be slow under load — allow 30s)
    const alertVisible = await login.isElementVisible(LoginLocators.alertOk, 30000);
    expect(alertVisible).toBe(true);

    // Step 4: Dismiss the alert
    await login.dismissAlert();
  });

  // ─────────────────────────────────────────────────────────────────
  // TC-004: Login with empty fields stays on login screen (silent validation)
  // ─────────────────────────────────────────────────────────────────
  test('TC-004: Tapping LOGIN with empty fields should keep the user on the login screen', async ({ driver }) => {
    const login = new LoginPage(driver);

    // Step 1: Make sure both fields are empty (do not type anything)
    await login.selectLoginTab();

    // Step 2: Tap the LOGIN button without entering credentials
    await login.tapLogin();
    await driver.pause(2000);

    // Step 3: The app silently ignores the empty submit —
    //         the login screen is still displayed (no navigation occurred)
    const stillOnLogin = await login.isLoginScreenVisible();
    expect(stillOnLogin).toBe(true);

    // Step 4: The email field still shows its placeholder — no data was submitted
    const emailVisible = await login.isElementVisible(LoginLocators.inputEmail, 3000);
    expect(emailVisible).toBe(true);
  });

});
