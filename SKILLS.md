# SKILLS.md — Framework capabilities reference

A quick reference for what this framework can already do, so a new test starts from what's here instead of re-reading every file. "Skill" below just means a reusable method already available on a fixture or page object.

This is meant to be a cross-platform (Android + iOS) framework, but everything below is currently Android-only in practice — the fixture's capabilities, the locators, and the one driver dependency (`appium-uiautomator2-driver`) are all Android-specific. Treat "add iOS" as its own piece of work, not something these skills already cover — see README's Known gaps.

## The `driver` fixture (`fixtures/appiumFixture.js`)

