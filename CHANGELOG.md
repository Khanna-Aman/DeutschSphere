# Changelog

All notable changes to DeutschSphere are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/); this project uses
date-stamped sections rather than strict SemVer releases (it ships continuously
to GitHub Pages). For full detail, see the git history.

## [Unreleased] — 2026-06-30 (production-readiness remediation)

Closed all three P0 release blockers identified in
`PRODUCTION_READINESS_AUDIT_2026-06-30.md`.

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
- Verification gates in `scripts/`: `check_example_originality.py` (0-verbatim
  copyright gate), `check_grammar_languagetool.py` (offline LanguageTool),
  `check_examples_llm_judge.py` (optional LLM second opinion),
  `check_image_word_clip.py` (free local CLIP + perceptual-hash image↔word
  verification), and `apply_examples.py` / `vendor_fonts.py`.
- CI: `js-checks.yml` (`node --check` + advisory ESLint).

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

### Known follow-ups (see audit §6)
- Owner actions: swap the personal feedback email (`js/events.js`); confirm
  Imagen 3 redistribution terms.
- Coverage: add thematic word groups (days/months/seasons/colours/numbers/
  countries); B1 is a curated subset (~57% of canon); B1 imagery 27%.
- Quality bars: rebuild the test suite from scratch and wire FSRS/NLP tests into
  CI; formal WCAG 2.2 AA audit; performance budget.
- Image↔word: human spot-check of the review sheet + 3 near-duplicate pairs.

## [1.1.0] and earlier

Baseline prior to the 2026-06-30 remediation: the offline-first PWA with FSRS-5
spaced repetition, pronunciation trainer, quiz arena, immersion lab, and the
2,627-entry A1–B1 dataset. See git history for details.
