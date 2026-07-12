# Changelog

All notable changes to DeutschSphere are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/); this project uses
date-stamped sections rather than strict SemVer releases (it ships continuously
to GitHub Pages). For full detail, see the git history.

## v1.2.1 — 2026-07-12 (UI copy fix)

### Fixed
- **Level selector**: removed the stale "— under development" tag from the B1 option. B1 has been
  100% complete (1,925/1,925 entries illustrated, full vocabulary backfill) since v1.2.0. Service
  worker bumped to `v7.7.1` so the precached `index.html` refreshes for returning users.

## v1.2.0 — 2026-07-03 to 2026-07-11 (100% B1 imagery + vocab backfill Phases 1–5 + performance + a11y/security hardening)

### Added
- **100% B1 illustration coverage — every B1 entry now illustrated (1,925/1,925).** The final 1,554
  B1 WebP illustrations were generated with **free FLUX.1-schnell** (Kaggle T4 GPU) from curated
  per-word metaphor prompts, then run through the anti-bleeding transparent-background
  post-processing. Total illustrated across A1–B1: **3,142 / 3,231 (97%)**.
- **Manual eyes-on review of all 3,142 illustrations** (262 contact-sheet montages, 12/sheet). Nine
  hard defects found and fixed: 2 mirrored-arrow errors (`link-` "left", `zurück` "back") corrected
  by a local horizontal flip; 7 B1 images regenerated — 3 blank + 2 near-blank that the black-background
  strip had wiped, plus `die Aprikose` (was rendering as goggles → real apricot) and `das Pech`
  (was a *good-luck* four-leaf clover, the opposite meaning → shattered mirror). `b1/curated_metaphors.json`
  gained 609 curated prompts. One borderline A2 image was also regenerated: `der Weg` (way/path) had
  rendered the adverb *weg* ("away") chair-and-star metaphor → now a clear winding stepping-stone path.

### Fixed
- **Custom-card "Add to Deck" was completely non-functional.** `addCustomCard` validated
  `german`/`english` (the wordlist field names) while every card and render/search sink uses
  `word`/`meaning`, so every user-added card was silently rejected. Validation now matches the card
  schema; custom cards add and render correctly (still `escapeHtml`-sanitised against injection).
- **Cross-platform `npm run check`** — replaced the bash-only `for f in …` loop (which failed on
  Windows cmd.exe) with `scripts/check_syntax.mjs`. CI unaffected.

### Changed
- **ESLint: 0 warnings** (was 39) — removed unused imports/vars and dead assignments; empty/unused
  catch bindings became optional-catch `catch { … }`. No behaviour change (node --test 22/22,
  smoke_e2e, and the UI walkthrough all still pass).
- **3 example sentences reworded** (a1 *Hausmann*, b1 *Turm*, b1 *Tierpark*) to drop the last
  multi-word overlaps with the Goethe example column — near-ngram overlaps 31 → 28 (all remaining are
  incidental common phrases; verbatim reproductions stay at 0).
- **LanguageTool grammar gate: 0 hard defects across all 3,231 examples** — allow-listed `Brötli`
  (+ Perron/Stiege/Bub/Kasten), legitimate Swiss/Austrian regional headwords the Standard-German
  dictionary mis-flagged as typos.

### Added (backfill + hardening, previously staged as v1.1.2 on `dev`)
- **Vocabulary backfill, Phases 1–5 + A1/A2 gap fill (2,660 → 3,231, +571 entries).** Every headword in
  the official Goethe B1 Wortliste's alphabetical section that was missing from the app:
  Phase 1 — 61 everyday entries (52 nouns incl. *Abend, Gefühl, Gefahr, Boden, Boot, Bär,
  Demokratie* + 9 verbs). Phase 2 — 333 more: 27 nouns (incl. *Magazin, Metall, Verlag*),
  ~255 verbs (incl. *ablehnen, annehmen, sich bewerben, entscheiden, sich erinnern, sich
  freuen, geschehen, verlassen, versprechen, überlegen*), and 51 adjectives/adverbs/particles
  (incl. *höflich, lecker, stolz, unterwegs, zuständig*). A position-independent completeness
  sweep (entry signatures, any column) closed the shifted-column extraction blind spot.
  Gender/plural are source-grounded (null where unattested — zero-inference); every example
  is original and LanguageTool-gated (0 defects); presence + facts double-checked against
  the official lists via the OpusAudit NotebookLM notebook (nlm CLI) — the originality gate
  even caught and fixed one accidentally-reproduced source sentence. `WORDLIST_CACHE_VERSION`
  → v1.0.8. Remaining phases: thematic groups (months/days/loanwords), `-in` doublets,
  regional (A/CH) variants. Phase 3 added the 87 thematic-section words the alphabetical
  list doesn't repeat — months, weekdays, seasons, times of day, animals, compass
  directions, loanwords (Smartphone, Akku, DVD…) and political terms (Staat, Regierung,
  Bundeskanzler…) — placed at their correct CEFR level (37 → A1, 50 → B1). B1 noun
  coverage vs the official list is now 94%. Phase 4 completed the long tail: 58 feminine
  `-in` job-title doublets (die Kellnerin, die Ärztin-style forms; regular `-innen` plural),
  19 Austrian/Swiss regional variants (Brötli, Bub, Knödel, Marille, Perron, Stiege, Pfanne,
  Kasten…) and common abbreviations (PC, TV, WG, Kfz, Modul, Spot). **B1 noun coverage vs the
  official list is now ~99% (1,597/1,621)** — only Swiss-only political terms (Ständerat,
  Regierungsrat) and a few multi-word entries (Europäische Union) remain. Phase 5 added the final tail — Struktur, Textaufbau, die Europäische Union, and Swiss/Austrian
  institutional terms (Stadtpräsident, Ständerat, Regierungsrat, Volksschule, Primarschule,
  Pädagogische Hochschule, AHS, BHS) — bringing **B1 noun coverage to 99% (1,604/1,621)**; the
  remainder are pure extraction fragments already present in full form. A parallel signature-based
  audit of A1/A2 against their own Wortlisten (same rigor) surfaced 3 genuinely-missing basic
  headwords — **das Jahr** (A1!), **das Handtuch** and **das Schlafzimmer** (A2) — now added and
  OpusAudit-confirmed. Two verification tools
  earned their keep: the originality gate caught 3 accidental source-sentence reproductions
  (re-authored), and the OpusAudit NotebookLM cross-check caught 3 non-headwords I'd wrongly added
  from example text (die Fahrt, der/die Mitschüler[in]) — removed after confirming at the source
  column level.
- **Tailwind build restored** — `npm run build:css` regenerates `tailwind.css`
  (tailwindcss@3.4.17); regenerated with 0 coverage regressions; hand-patch removed
  from `index.css`; DEVELOPMENT.md documents the silent-no-op failure mode.
- **Dedicated maskable PWA icons** (192/512) with safe-zone padding; manifest + SW precache.
- **Performance: font/icon subsetting + minified CSS (2026-07-06).** Researched current
  (2026) best practice for a zero-runtime-dependency static PWA and applied the
  zero-infra-risk asset-level wins: Inter/Outfit switched from 5 static weights x 2
  Unicode subsets (10 files/family) to **one self-hosted variable-weight woff2 per
  family** (`fvar` wght 100–900), `latin`-subset only — German + all UI text fall
  inside `U+0000-00FF`/`U+2000-206F`, `latin-ext` is never rendered by this app.
  Font Awesome's solid/brands webfonts are now **glyph-subset to the ~90 icon
  codepoints actually referenced** in `index.html`/`js/*.js` via a new repeatable
  script (`scripts/subset_fontawesome.py`, `npm run build:icons`, needs `fonttools`);
  the unused `fa-regular-400`/`fa-v4compatibility` webfonts were dropped entirely
  (no `.fa-regular`/`far`/v4-style classes anywhere in this codebase). Combined
  self-hosted font payload: **~1.45MB → ~90KB**. `scripts/vendor_fonts.py` (the
  from-scratch re-vendoring script) was rewritten to produce this same optimized
  state directly, so re-running it can't silently regress the optimization —
  verified idempotent (re-run reproduces byte-identical output). `index.css` is now
  a generated, esbuild-minified build artifact (~61KB → ~41KB) from a new source
  file, `index.src.css` (same "readable source, minified committed output" pattern
  `tailwind.css` already used; `npm run build:css:index`). Font preload hints added
  for both variable fonts (LCP). The icon-usage scan **caught two real pre-existing
  bugs**: `fa-wifi-slash` (offline banner) and `fa-sparkles` (immersion "New Word"
  badge) aren't real Font Awesome Free 6 icons and were rendering as invisible
  glyphs in production — fixed to `fa-plug-circle-xmark` and `fa-wand-magic-sparkles`.
  Verified via Playwright (fonts resolve to Inter/Outfit, icon glyphs render
  correctly, zero console/JS errors) plus the full gate suite (`validate_data`,
  22/22 unit tests, lint, smoke e2e, Lighthouse). Local Lighthouse performance
  0.77 (informational only — CI's throttled/advisory number, see `lighthouserc.json`).
  Scope note: `js/*.js` stays unminified hand-authored source by design — minifying
  it would require an Actions-based build/deploy pipeline (a bigger infrastructure
  change, touching the live GitHub Pages source setting), intentionally left as a
  separate, explicitly-authorized decision rather than bundled into this pass.

### Fixed / hardened
- **CSP**: added `base-uri 'self'`, `object-src 'none'`, `form-action 'self'`.
- **Language semantics (WCAG 3.1.1/3.1.2)**: `<html lang="en">` (English UI) with `lang="de"`
  on all German content surfaces (card word, examples, quiz prompts/options/feedback —
  dynamic where direction flips —, immersion, badges); `card.plural` render sink escaped.
- **A11y**: aria-labels on the search/quiz/feedback inputs; quiz image alt (dynamic meaning).
- **Service worker**: removed the dead cross-origin CDN strategy; fixed the `/sw.js` cache
  guard for subpath deploys; offline round-trip verified.
- **Copy honesty**: pronunciation wording (browser transcription + Kölner-Phonetik
  comparison, no "native models"); "FSRS-5" → "FSRS-inspired" for current state in CI/VISION.
- **Lint**: cleared the 6 baseline eslint errors; the CI `lint` job is now blocking.
- **CI wasn't actually running on `dev` (2026-07-06).** All four workflows
  (`js-checks`, `quality`, `tests`, `validate-data`) push-triggered on `main`
  only — direct pushes to `dev` (the norm all session) triggered **no CI at
  all**; `gh run list` was silently showing stale runs from an old PR, so
  every "verified CI green after push" check this session had actually been
  re-confirming a run from days earlier, not gating the new commit. Added
  `dev` to each workflow's `push.branches`.

Honesty/safety batch before going public. No new features.

### Added
- **Real CI copyright gate.** `scripts/check_example_originality.py` gained `--build-fingerprint`
  and `--fingerprint` modes: a committed, non-copyrighted fingerprint (salted SHA-256 of the
  official Goethe 6-word shingles) lets `validate-data.yml` block any verbatim source sentence
  **in CI** without shipping the copyrighted PDFs. Wired as a blocking step in the data workflow.
- **Privacy — "Pronunciation & microphone" section** in `PRIVACY.md` disclosing that the optional
  pronunciation trainer's Web Speech API streams microphone audio to the browser vendor's cloud
  (the one path where data can leave the device). `SECURITY.md` now links to it.

### Fixed
- **5 verbatim Goethe example sentences** (a1 #542/#547, a2 #251/#364/#590) that reproduced
  copyrighted source sentences were re-authored to original, grammar-checked sentences. These had
  slipped past the originality gate, which only compared each level against **its own** PDF; the
  gate now checks the **cumulative** source across all levels (verbatim = a ≥7-word span; shorter
  generic phrases stay advisory).
- **XSS hardening** — custom/imported card fields (`word`, `meaning`, `wordClass`) are now
  HTML-escaped at their render sinks in `js/flashcards.js` (defense-in-depth beyond the CSP).
- **Rating-key badges** (Again/Hard/Good/Easy) no longer overlap their labels — restored the
  `top-1.5`/`left-1.5` offsets missing from the purged `tailwind.css` (patched in `index.css`).
- **Docs honesty** — `NOTICE` example count 2,627 → 2,660; README/VISION now state B1 is under
  active development at ~80–85% of the official B1 list (backfill ongoing).

## v1.1.0 — 2026-07-01 (test-suite rebuild + data-integrity fixes + public launch)

Independent re-verification pass **plus remediation**. No new P0 blockers; the three
original P0s remain closed. The maintainers' internal production-readiness audit rates
the release **GO (conditional), ≈85/100**.

### Added
- **Rebuilt, deterministic test suite** under `tests/`:
  - `tests/fsrs.test.mjs` + `tests/nlp.test.mjs` — scheduler + German NLP on Node's
    built-in runner (`node --test`), **zero dependencies, 22 tests**.
  - `tests/smoke_e2e.py` — Playwright boot/smoke: no uncaught errors, a real card
    renders, IndexedDB round-trip, scheduler advances in the shipped ESM runtime.
- **CI test gate:** `.github/workflows/tests.yml` — blocking `unit` job (`npm test`) +
  advisory `e2e` job. `package.json` gains `test` / `test:e2e` scripts.
- **Merged-headword regression guard** in `scripts/validate_data.py` (slash-headword allowlist).
- SOTA repo hygiene: `SECURITY.md`, `CODE_OF_CONDUCT.md`, `.gitattributes`, `.nojekyll`,
  issue/PR templates, and CI status badges.

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
- **Data cache propagation** — bumped `WORDLIST_CACHE_VERSION` (`v1.0.7`) so returning
  visitors re-fetch the corrected 2,660-entry dataset instead of serving stale cache.

### UI
- Recall buttons now show their **1/2/3/4 hotkey** as a color-matched keycap; tightened the
  gap between the word card and the meaning box; made the Phonetik spectrogram labels
  ("Reference / Your Spectrogram") readable (backing pill, no waveform strike-through).
  Shell cache bumped to `v7.5.1`.

### Public launch
- Repo made public with a clean root: **SVG hero banner**, CI status badges, `SECURITY.md`,
  `CODE_OF_CONDUCT.md`, issue/PR templates, `.gitattributes`, `.nojekyll`. Internal
  maintainer docs and the one-off generation pipeline are kept local (not published).
  Imagery cleared for redistribution (Google Cloud Vertex AI terms). Live on GitHub Pages.

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
