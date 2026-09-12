const OS = (process.env.OS || 'android').toLowerCase();

const LoginLocators = {
  // ── Screen container ──────────────────────────────────────────────
  loginScreen: '~Login-screen',

  // ── Login / Sign-up tab toggle ────────────────────────────────────
  btnLoginTab:  '~button-login-container',
  btnSignupTab: '~button-sign-up-container',

  // ── Form fields (content-desc shared across platforms) ───────────
  inputEmail:    '~input-email',
  inputPassword: '~input-password',

  // ── Submit button ─────────────────────────────────────────────────
  btnLogin: '~button-LOGIN',

  // ── Alert dialog OK button ────────────────────────────────────────
  alertOk: OS === 'ios'
    ? '-ios predicate string:label == "OK" AND type == "XCUIElementTypeButton"'
    : 'android=new UiSelector().text("OK")',
};

module.exports = { LoginLocators };
