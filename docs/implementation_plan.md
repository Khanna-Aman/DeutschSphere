# Implementation Plan — Comprehensive E2E Testing Suite (Playwright)

This plan outlines a highly thorough, complete End-to-End (E2E) testing and visual validation engine for the Weimar German Vocabulary SPA. It is designed to act as an automated, continuous, and absolute quality assurance system that exhaustively tests every interactive button, modal transition, client hash route, and educational interface across all CEFR tiers without needing physical testers.

---

## User Review Required

All test executions are local and client-side, using standard Python 3 and Playwright (Chromium). No external testing infrastructure or cloud subscriptions are required.

> [!IMPORTANT]
> **E2E Testing Objectives & Coverage Matrices:**
> - **Comprehensive Interactive Click Coverage**: The script will programmatically actuate *every single actionable button, dropdown, and tab* in the application.
> - **Multi-Level Diagnostic Tests**: Checks loading and caching boundaries of `/a1`, `/a2`, and `/b1` CEFR tiers.
> - **Continuous UI & Theme Auditing**: Cycles through all 5 themes (**Default**, **Berlin Cyberpunk**, **Schwarzwald**, **Oktoberfest**, and **Weimar Classic**) in both mobile (375x812) and desktop (1440x900) views, making sure elements are visible and have proper contrast.
> - **Interactive Game and Quiz Loops**: Complete automated runs of:
>   - **Leitner SRS Scheduler**: Moves cards forward/back and toggles learned states.
>   - **Multiple-Choice & Spelling Quiz Arena**: Spawns smart distractors, enters answers, clicks virtual umlauts, and verifies feedback/score summary views.
>   - **RPG Deutsch-Abenteuer**: Cycles scenarios, selects dialogue responses, and triggers NPC voice lines.
>   - **Grammatik-Weberei**: Snaps scrambled word chips, runs resets, and validates syntax checking.
> - **Console Exception Monitoring**: Actively listens to and records any browser `console.error` or uncaught JavaScript exceptions during execution. If any warning or error is logged, the script will output the stack trace and fail the run immediately.

---

## Proposed Changes

We will create a new comprehensive E2E python script inside `scripts/`. Here is the proposed testing layout:

### 1. Structure of the New E2E Suite

#### [NEW] [e2e_comprehensive_tests.py](file:///d:/Aman/_________Projects/A1-B1_German/scripts/e2e_comprehensive_tests.py)
- **Automatic Port Allocation**: Scans and binds a dynamic TCP port to run a background local HTTP server instance.
- **Console Log Interceptor**: Binds event listeners to Playwright's `console` event to capture, log, and assert zero uncaught Javascript exceptions.
- **Modular Test Steps**:
  - **Test Step 1: Base Application & Offline Load**: Loads root, asserts loader hides, and checks that Level and Theme dropdowns populate.
  - **Test Step 2: Sidebar Categories & Level Selection**: Clicks Level dropdowns, selects levels, filters vocabulary, and clicks multiple category side-tabs.
  - **Test Step 3: Flashcard Interactions & Preferences Menu**: 
    - Clicks the card to expand details.
    - Clicks TTS pronunciation button and tests the Phonetik-Spiegel microphone toggle interface.
    - Moves next/prev. Toggles card "Gelernt" state (Leitner SRS Box updates).
    - Opens the glassmorphic Settings Popover, toggles fast read, autoplay, images, and verifies dropdown auto-closes when clicking outside.
  - **Test Step 4: Multiple-Choice & Spelling Quiz Arena**:
    - Switches path to `#/quiz`.
    - Cycles MC Quiz mode: clicks options, verifies feedback screen, advances question.
    - Cycles Spelling Quiz mode: types characters, clicks virtual umlaut buttons, submits answer, and verifies results summary.
  - **Test Step 5: RPG Deutsch-Abenteuer (Adventure)**:
    - Switches path to `#/adventure`.
    - Initiates first scenario, triggers speech synthesis, selects choice nodes, and walks through dialog nodes.
  - **Test Step 6: Grammatik-Weberei (Weaver)**:
    - Switches path to `#/weaver`.
    - Enters Weaver board. Clicks first available scrambled chip, asserts it snaps into the active sentence placeholder, tests the Reset button, and verifies syntax verification.
  - **Test Step 7: Stats Analysis & Achievements**:
    - Switches path to `#/stats`.
    - Verifies progress radial rings render. Clicks Export Backup button.
  - **Test Step 8: Multi-Theme Contrast & Viewport Audits**:
    - Cycles all 5 themes under Mobile (375px wide) and Desktop viewports.
    - Captures exhaustive screenshot runs saved directly to the App Data Directory.
- **Fail-Safe Cleanup**: Assures Python server is shut down and browser contexts are closed on both success and fail outcomes.

---

## Verification Plan

### Automated Execution
We will run the newly built E2E test script to test itself and the entire SPA:
```powershell
python scripts/e2e_comprehensive_tests.py
```
We will check the output and verify that it reports:
- `All 8 test steps passed successfully with zero browser console exceptions!`
- Generates updated E2E high-fidelity visual screenshot files inside your App Data Directory.

### Manual Review of Screen Assets
We will review any discrepancies highlighted by the E2E script and immediately write hotfixes to `index.css`, `index.html` or the respective JS files.
