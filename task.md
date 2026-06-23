# Tasks Checklist: DeutschSphere Premium V6.0 Glitch Fixes & SOTA Testing

- [x] **Phase 1: Settings UI & Keybind Bugfixes**
  - [x] Fix `js/flashcards.js` - `updateReadModeUI()`
  - [x] Fix `js/flashcards.js` - `updateAutoplayUI()`
  - [x] Fix `js/events.js` - `updateSoundStyleUI()`
  - [x] Fix `js/events.js` - `updateParticlesUI()`
- [x] **Phase 2: Height-Based Viewport Responsiveness**
  - [x] Add `@media (max-height: 850px)` styling block to `index.css`
  - [x] Add `@media (max-height: 720px)` styling block to `index.css`
  - [x] Verify vertical scrollbar behavior on home screen study deck
- [x] **Phase 3: Brand New Comprehensive E2E Test Suite**
  - [x] Write highly robust `scripts/e2e_comprehensive_tests.py` testing every view, action, settings toggle, and hotkey
  - [x] Run the test suite and monitor console error outputs
  - [x] Verify generated high-resolution screenshots
- [x] **Phase 4: Final Audits & Clean Semantic Commits**
  - [x] Commit all changes staged neatly with descriptive semantic prefixes
  - [x] Write a detailed walkthrough of the changes
