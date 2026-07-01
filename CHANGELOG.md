# Changelog

All notable changes to DeutschSphere are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/); this project uses
date-stamped sections rather than strict SemVer releases (it ships continuously
to GitHub Pages). For full detail, see the git history.

## [Unreleased] — 2026-07-01 (test-suite rebuild + data-integrity fixes + re-audit)

Independent re-verification pass **plus remediation**. No new P0 blockers; the three
original P0s remain closed. Full report: `PRODUCTION_READINESS_AUDIT_2026-07-01.md`
(GO conditional; ≈85/100).

### Added
- **Rebuilt, deterministic test suite** under `tests/`:
  - `tests/fsrs.test.mjs` + `tests/nlp.test.mjs` — scheduler + German NLP on Node's
    built-in runner (`node --test`), **zero dependencies, 22 tests**.
  - `tests/smoke_e2e.py` — Playwright boot/smoke: no uncaught errors, a real card
    renders, IndexedDB round-trip, scheduler advances in the shipped ESM runtime.
- **CI test gate:** `.github/workflows/tests.yml` — blocking `unit` job (`npm test`) +
  advisory `e2e` job. `package.json` gains `test` / `test:e2e` scripts.
- **Merged-headword regression guard** in `scripts/validate_data.py` (slash-headword allowlist).
- **`PRODUCTION_READINESS_AUDIT_2026-07-01.md`** — 14-dimension scorecard, GO/NO-GO,
  confirm/refute of the prior audit, findings with `file:line` evidence.

### Fixed
- **Systemic data corruption split (2,627 → 2,660 entries).** 33 B1/A2 rows that merged two
  *unrelated* lemmas into one headword (e.g. `bevor / bewegen`, `singen / sinken`,
  `link- / die Lippe`, `nass / national / die Natur`) were split into correct separate
  entries — facts source-grounded from the Goethe Wortlisten, one original grammar-gated
  example authored per new lemma, `word_class`/gender/plural corrected. Also fixed a doubled
  `das Hähnchen` headword. All counts synced to **2,660** (A1 684 / A2 582 / B1 1,394).
- **Scheduler relabeled "FSRS-inspired (FSRS-5-based)"** in `js/fsrs.js` + docs, with the
  three deliberate simplifications from reference FSRS-5 documented in the module header
  (honesty fix — no behavior change; `w17/w18` marked reserved).

### Changed
- Docs synced (README/VISION/AGENTS/backlog/CONTRIBUTING) to the new counts, the FSRS
  relabel, and the rebuilt test architecture; corrected a **stale** backlog claim of a
  passing "Comprehensive E2E Playwright suite."

### Removed
- Old test harness (`scripts/run_unit_tests.py`, `scripts/e2e_comprehensive_tests.py`)
  and reviewed one-off cruft (`debug_syntax.py`, `test_network.py`, two `scratch/test_*.py`).

### Audit notes
- **Refuted** the carried-forward "test suite is rotted" claim — `run_unit_tests.py` passed
  clean; rebuilt anyway for a cleaner gate.
- **Self-corrected** the audit's own first pass: B1 ids 81/82 (`der Ausdruck`) are NOT a
  duplicate but two legitimate senses (plurals *Ausdrücke* vs *Ausdrucke*).

## 2026-06-30 (production-readiness remediation)

Closed all three P0 release blockers identified in the prior production-readiness
audit (since superseded by `PRODUCTION_READINESS_AUDIT_2026-07-01.md`).

### Changed
- **All 2,627 example sentences (A1/A2/B1) rewritten as original content**,
  replacing text that reproduced the copyrighted Goethe/Hueber source examples.
  Verified **0 verbatim** against the official PDFs; independently
  grammar-checked (0 genuine defects).
- **Fonts & icons self-hosted** under `./fonts` (Inter, Outfit, Font Awesome);
  removed all Google Fonts / Cloudflare / cdnjs runtime calls. The app now makes
  **zero third-party requests on load** — genuinely 100% offline after first load.
- **CSP tightened** to self-only (`default-src 'self'`; no `unsafe-eval`).
- **Documentation honesty pass** — README/VISION/CONTRIBUTING/NOTICE corrected
  (examples are original; offline is now accurate; coverage stated honestly).
- Bumped `WORDLIST_CACHE_VERSION` (`app.js`) so existing clients re-fetch the
  rewritten data.

### Added
- **`AGENTS.md`** — authoritative operating charter (vision, free-forever pledge,
  enforced SOTA quality bars, scope boundaries, data policy).
- **`PRIVACY.md`** and a corrected **`NOTICE`** (content attribution +
  non-affiliation/trademark disclaimer; `LICENSE` scoped to source code).
- **`CHANGELOG.md`** (this file).
- **`COMPETITIVE_ANALYSIS_2026-06-30.md`** — KPI benchmark against Anki, Duolingo,
  Memrise, Babbel, and Seedlang (DeutschSphere figures verified from the repo;
  competitor figures are informed estimates), plus an **in-scope roadmap** to
  category leadership that adds no gamification, grammar engine, accounts, or
  tracking.
- Verification gates in `scripts/`: `check_example_originality.py` (0-verbatim
  copyright gate), `check_grammar_languagetool.py` (offline LanguageTool),
  `check_examples_llm_judge.py` (optional LLM second opinion),
  `check_image_word_clip.py` (free local CLIP + perceptual-hash image↔word
  verification), and `apply_examples.py` / `vendor_fonts.py`.
- CI: `js-checks.yml` (`node --check` + advisory ESLint).
- **Accessibility / quality CI gate** — `.github/workflows/quality.yml` +
  `lighthouserc.json` run Lighthouse (axe-core) on every push/PR. Accessibility,
  best-practices, and SEO are hard gates (100/95/100); performance is advisory.
  Local run: `npm run audit:lighthouse`.

### Removed
- Per-level `wordlist.csv` files and the JSON→CSV converter — an unused derived
  artifact (the app loads `wordlist.json` only).
- `CODEBASE_AUDIT.md` (2026-06-29) — folded into and superseded by the 06-30
  audit (re-verification recorded in its §5).

### Fixed
- **P0: example-sentence copyright** — now original, 0 verbatim.
- **P0: licensing scope** — code (MIT) separated from third-party content.
- **P0: privacy** — third-party CDN data flows removed; privacy policy added;
  `formsubmit.co` feedback flow disclosed.
- Internal: a B1 example-sentence id mis-keying bug (line-number vs `id` column)
  caught before it reached the data; LanguageTool gate attribute/version fixes.
- **Accessibility → verified Lighthouse 100** (from 86): accessible name for the
  help-modal close button, a label for the trainer speed slider, resolved a
  visible-text/name mismatch on the loop toggle, re-modelled the deck-preferences
  popover from an invalid `role="menu"` to a labelled `role="group"` disclosure,
  and fixed heading order.
- **Best-Practices → 100**: repaired an invalid `manifest.json` (trailing comma)
  that browsers logged as a console error and that could break PWA parsing/install.

### Known follow-ups (see audit §6)
- Owner actions: swap the personal feedback email (`js/events.js`); confirm
  Imagen 3 redistribution terms.
- Coverage: add thematic word groups (days/months/seasons/colours/numbers/
  countries); B1 is a curated subset (~57% of canon); B1 imagery 27%.
- Quality bars: rebuild the test suite from scratch and wire FSRS/NLP tests into
  CI; formal **manual** WCAG 2.2 AA sign-off (the automated axe/Lighthouse pass is
  now CI-gated at a11y 100); production performance budget.
- Image↔word: human spot-check of the review sheet + 3 near-duplicate pairs.

## [1.1.0] and earlier

Baseline prior to the 2026-06-30 remediation: the offline-first PWA with FSRS-5
spaced repetition, pronunciation trainer, quiz arena, immersion lab, and the
2,627-entry A1–B1 dataset. See git history for details.
