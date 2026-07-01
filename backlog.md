# Feature Backlog: DeutschSphere

This backlog tracks implemented features, their technical specifications, and outstanding tasks for the multi-level (A1, A2, B1) German vocabulary flashcard application.

> Last updated: 2026-06-30
>
> ⚠️ **Authoritative sources.** This backlog may lag the live state. For current status and the open-items roadmap, see the latest audit **`PRODUCTION_READINESS_AUDIT_2026-07-01.md`** (§ findings + remediation) and **`CHANGELOG.md`**; for policy/scope, see **`AGENTS.md`**. Key deltas since the 2026-06-29 snapshot below: **all example sentences are now original (0 verbatim — copyright resolved)**; fonts/icons **self-hosted** (no CDN); the per-level `wordlist.csv` was removed; the **test suite was rebuilt from scratch and wired into CI** (2026-07-01) — deterministic FSRS/NLP units (`node --test`) + a Playwright boot/smoke.
>
> ⚠️ **Scope note.** The project was re-scoped to a focused, **study-only** tool. Earlier planned/experimental features — the Deutsch-Abenteuer RPG, Grammatik-Weberei sentence builder, a Statistics Dashboard, an Achievements/streak engine, and all gamification (XP, particle bursts, star ratings) — are **out of scope and not in the codebase**. This document has been pruned to reflect what actually ships.

---

## 🛠️ 1. Core Architecture & Data Layer

### Dynamic Level Routing & Loading
- **Hash-Based SPA Routing**: The app uses `window.location.hash` for client-side routing across active views: `#/` (flashcards), `#/quiz`, `#/immersion`.
- **Relative Path Data Loading**: Vocabulary is fetched dynamically from `./${level}/wordlist.json` where `${level}` is `"a1"`, `"a2"`, or `"b1"`.
- **Default Level**: A2 (hardcoded in HTML `<select>`, overridden by `localStorage.current_level` on return visits).
- **ES6 Module Architecture**: Application logic split across 16 modules in `js/` directory, loaded via `<script type="module">`.

### Vocabulary Entry JSON Schema
Every word entry conforms to the following structure (actual field names from the codebase — there are no `verb_conjugation`/`adjective_forms` fields; per the Zero-Inference Clause, absent grammar is simply not stored):
```json
{
  "german": "der Abflug",
  "word_class": "Nomen",
  "gender": "der",
  "plural": "die Abflüge",
  "english": "departure (flight) / takeoff",
  "pronunciation": "ahp-flook",
  "theme": "Reise & Verkehr",
  "antonym": "die Ankunft",
  "example_de": "Wir warten am Flughafen auf den Abflug.",
  "example_en": "We are waiting at the airport for the departure.",
  "image": "images/card_2.webp",
  "id": 2
}
```

**Field details:**
- `german`: Capitalized nouns with article; lowercase verbs/adjectives
- `word_class`: Nomen, Verb, Adjektiv, Adverb, Andere, Ausdruck, etc.
- `gender`: `"der"` / `"die"` / `"das"` / `null` (non-nouns)
- `plural`: Absolute form with `"die"` prefix, or `null`
- `theme`: Raw category string, normalized client-side to 12 canonical categories
- `image`: Relative WebP path (e.g. `"images/card_2.webp"`) or `null` (single field; the former redundant `image_path` was collapsed into `image`)

### Data Tier Summary

| Level | Words | WebP Images |
|-------|-------|-------------|
| A1    | 684   | 637 (93%)    |
| A2    | 582   | 580 (99.7%)  |
| B1    | 1,394 | 371 (27%)    |
| **Total** | **2,660** | **1,588 (60%)** |

### 12 Canonical Theme Categories
Person & Familie, Wohnen & Haushalt, Gesundheit & Körper, Natur & Umwelt, Reise & Verkehr, Essen & Trinken, Einkaufen & Konsum, Dienstleistungen & Behörden, Ausbildung & Lernen, Arbeit & Beruf, Freizeit & Unterhaltung, Zeit, Maße & Basiswortschatz

---

## 🎨 2. Design System & Interactive UI

### Theme Engine (5 Themes)
Persisted via `localStorage.current_theme`. Each theme fully overrides: body background, glass effects, sidebar, inputs, buttons, and the phonetic panel.

| Theme | CSS Class | Description |
|-------|-----------|-------------|
| Slate Mesh | (default) | Dark slate with indigo/pink mesh gradients |
| Berlin Cyberpunk | `theme-cyberpunk` | Deep cosmic black, neon cyan/magenta |
| Schwarzwald | `theme-schwarzwald` | Dark forest green, warm amber |
| Oktoberfest Gold | `theme-oktoberfest` | Chocolate surfaces, amber-gold accents |
| Weimar Classic | `theme-weimar` | Light ivory, crisp dark-indigo borders |

### Gender-Themed Card Glows
- 🔵 `der` → `.card-glow-der` (Blue neon border)
- 🩷 `die` → `.card-glow-die` (Pink/rose neon border)
- 🟢 `das` → `.card-glow-das` (Emerald neon border)
- 🟣 Neutral/Other → `.card-glow-neutral` (Violet border)

### CSS Architecture
- **Glassmorphism**: `.glass` class with `backdrop-blur`
- **Custom animations**: shuffle, slideInRight/Left, phonetic-pulse-ring (no shake/confetti — distraction-free)
- **Accordion transitions**: CSS Grid `grid-template-rows: 0fr→1fr` with `opacity` for fluid auto-height animation
- **Custom scrollbar**: 5px thin scrollbar with rounded thumb
- **Auto-hyphens**: For long German compound words
- **Fonts**: Inter (body), Outfit (display/headings) — **self-hosted under `./fonts`** (no Google Fonts CDN)
- **Icons**: FontAwesome 6.4.0 — **self-hosted** (no cdnjs)

---

## 🧭 3. Component Architecture

### A. Sidebar Navigation Panel
- **Level Selector**: Dropdown with A1/A2/B1 options, triggers full data reload
- **Theme Selector**: 5-option dropdown, instant CSS class swap
- **Search Bar**: Real-time filter by German word or English meaning
- **Navigation Links**: bilingual labels and FontAwesome icons for the active views (`#/` flashcards, `#/quiz`, `#/immersion`) plus feedback/help actions
- **Category List**: Dynamically rendered from loaded data with learned/total counts
- **Overall Progress Bar**: Gradient bar showing learned percentage across entire level
- **Keyboard Shortcuts Guide**: Collapsible panel, scrollable

### B. Main Flashcard Area (`#/`)
- **Card Display**: Large German word with gender glow, FSRS SRS badge, optional WebP illustration (A1/A2)
- **Accordion Panel**: English meaning, word class tag, gender/plural badges, example sentences (DE bold, EN muted), pronunciation hint, antonym, TTS speaker button
- **Deck Controls**: Unified "Einstellungen" dropdown (Shuffle, Hide Learned, Fast Read, Autoplay, Images, Reset — all with keyboard shortcut badges)
- **Audio Trainer Panel**: Play/Pause, Prev/Next, Speed slider, Loop toggle, status indicator
- **Phonetik-Spiegel**: Dual-spectrogram pronunciation coach with recording toggle
- **Navigation Buttons**: Vorherige (Prev), Nächste (Next), Aufklappen (Toggle)

---

## 🚀 4. Feature Status

### ✅ Fully Implemented
- [x] Multi-level vocabulary loading (A1/A2/B1)
- [x] Flashcard engine with gender glows and accordion reveal
- [x] FSRS-5 SRS (Free Spaced Repetition Scheduler — 19-parameter model, migrated from Leitner)
- [x] Quiz Arena (Multiple-Choice + Spelling, endless mode)
- [x] Continuous Audio Trainer (dual-voice DE/EN TTS)
- [x] Phonetik-Spiegel (Web Speech `SpeechRecognition` + Levenshtein scoring, waveforms, phoneme guides)
- [x] Immersions-Labor (offline NLP: lemmatize, gender/POS, instant add-to-deck)
- [x] 5 premium themes (Slate, Cyberpunk, Schwarzwald, Oktoberfest, Weimar)
- [x] Keyboard shortcuts + mobile swipe-to-grade gestures
- [x] Responsive design (mobile sidebar, safe-area insets, touch targets)
- [x] English-first bilingual UI
- [x] Profile backup: JSON file + Base64 Sync Key export/import
- [x] Precompiled Tailwind + hardened CSP (no `unsafe-inline`/`unsafe-eval`/CDN)
- [x] Data-integrity CI gate (`scripts/validate_data.py` via GitHub Actions)
- [x] **Original example sentences** — all 2,660 hand-authored, **0 verbatim** vs. the official PDFs; gated by `scripts/check_example_originality.py` + `scripts/check_grammar_languagetool.py`
- [x] **Test suite rebuilt from scratch (2026-07-01)** — deterministic FSRS/NLP units on Node's built-in runner (`tests/fsrs.test.mjs` + `tests/nlp.test.mjs`, 22 tests, zero deps) + a Playwright boot/smoke (`tests/smoke_e2e.py`); wired into CI as a hard gate (`.github/workflows/tests.yml`, `npm test`). The old `scripts/run_unit_tests.py` + `scripts/e2e_comprehensive_tests.py` were deleted. (Note: the "rotted" label was **stale** — `run_unit_tests.py` actually passed clean; rebuilt anyway for a cleaner CI gate. See `PRODUCTION_READINESS_AUDIT_2026-07-01.md` §12.)

### ⚠️ Known Gaps / Outstanding
- [ ] B1 illustrations: 371 / 1,394 WebP assets (27%) — rollout in progress (A1/A2 complete)
- [ ] Thematic word groups (days/months/seasons/colours/numbers/countries) not yet ingested
- [ ] Split-second follow-ups: further module decomposition if files grow again
- [x] Service Worker offline caching — implemented (`sw.js`, 4-strategy caching, versioned)

---

## 🎹 5. Keyboard Controls

| Hotkey | Action | Context |
|--------|--------|---------|
| `Space` | Toggle accordion reveal | Flashcards |
| `→` / `↓` | Next card | Flashcards |
| `←` / `↑` | Previous card | Flashcards |
| `L` | Toggle learned | Flashcards |
| `S` | Shuffle cards | Flashcards |
| `V` | Speak word (TTS) | Flashcards |
| `F` | Fast-Read toggle | Flashcards |
| `H` | Hide learned toggle | Flashcards |
| `A` | Autoplay TTS toggle | Flashcards |
| `B` | Toggle images | Flashcards |
| `Esc` | Close sidebar / clear | Global |
| `?` | Keyboard shortcut overlay | Global |
| `1-4` / `A-D` | Select MC option | Quiz |
| `Enter` | Submit answer | Quiz (Spelling) |

---

## 🔮 6. Future Backlog

### Short-Term
- [x] **B1 SVG Asset Generation**: Complete SVG illustration coverage for B1 level — **Done (pipeline run)**
- [x] **Cheatcodes Encoding Fix**: Fixed 56 double-encoded UTF-8 sequences + added `sanitizeGermanEncoding()` safety net
- [ ] **More Adventure Scenarios**: Add 3-5 additional branching dialogues per level
- [x] **Enhanced FSRS Timeline**: FSRS-5 retention analytics, 7-day review forecast in stats view
- [x] **v6.0 Hyper-Premium Upgrades**: Active development sprint for premium student suite:
  - [x] Establishment of V6.0 Core Directives & Rules (AI Orchestration Directives)
  - [x] Service Worker module precaching of ESM modules (`sw.js` precaches `js/nlp.js`, `js/immersion.js`, `idb-keyval.js`)
  - [x] Kölner Phonetik algorithms & inline suffix parser rules (`js/nlp.js`)
  - [x] Custom settings toggles in "Einstellungen" dropdown (SFX volume slider, Synthesized vs. Acoustic sound style)
  - [~] Particle burst engine — built then **removed** in the gamification cleanup (see scope note at top)
  - [x] Interactive click-to-explore Immersions-Labor grid (inspect parsed lemmas, load CEFR level, FSRS state, TTS voice, quick-add cards)
  - [x] Inline suffix lightbulb grammar guides on flashcards and quiz views
  - [x] Spaced Repetition deck rating hotkeys (`1-4`) and mobile-responsive kinetic swipe-to-rate gestures
  - [x] Scrambled word-chip hotkeys (`1-9` + `Enter`) for Grammar Weaver and Deutsch-Abenteuer RPG views
  - [x] Copy-pasteable Base64-encoded IndexedDB progress backup sync keys (portable encoding, not compressed/encrypted)
  - [x] Flashcard relative image pathing hotfix inside `js/flashcards.js` and `js/quiz.js` prepending `state.currentLevel` to prevent 404 image load errors
  - [x] **Premium Visual Strategy & Lottie Design Lock (SOTA)**: Fully finalized the V6.0 Universal 3D Claymation & Lottie sensory strategy. Configured the offline bulk generation pipeline to utilize Google's SOTA `imagen-3.0-generate-002` model (fully covered by Google Developer credits, $0 out-of-pocket). Programmed the chroma-key alpha masking (Pillow-based transparent floating icons), dynamic dual-tone theme-responsive SVG recoloring, Airbnb `lottie-web` async player, synchronized audio/haptic chimes, and PWA Level-Based Lazy Pre-caching in the system blueprints.
  - [x] ~~**Comprehensive E2E Playwright Automation Suite**: automated Playwright testing across viewports/themes.~~ **Superseded 2026-07-01** — that suite (`scripts/e2e_comprehensive_tests.py`) was deleted and replaced by the rebuilt `tests/` suite (deterministic FSRS/NLP units + `tests/smoke_e2e.py`) wired into CI. See `PRODUCTION_READINESS_AUDIT_2026-07-01.md` §12.
  - [x] **Multi-Level NotebookLM Curriculum Verification**: Conducted automated high-speed parallel audits using the active 'Goethe-Zertifikat Wortliste' NotebookLM workspace to synchronize definitions, plurals, themes, and grammar rules with perfect fidelity *(counts reflect pre-overhaul dataset size — current counts are A1 684, A2 580, B1 1,363)*:
    - **A1**: 640 words audited, 0 corrections.
    - **A2**: 1,142 words audited, 273 factual updates applied (e.g., correcting `'die Bank'` plural to `'die Banken'` and theme to `'Einkaufen, Geld & Konsum'`, and gender of `'das Glück'` to `'das'`).
    - **B1**: 2,139 words audited, 154 factual updates applied (e.g., aligned grammatical categories and verb/adjective forms).
  - [x] **Dynamic Illustration Deactivation (Zero-404 Deployment Mode)**: Temporarily disabled image illustration loading for V1.0.0. Added interactive glassmorphic toast notification triggers in the Settings panel informing learners of premium curated AI illustrations coming in V1.0.1. Saved ~3,900 flat SVG assets from unnecessary network request overhead.



### Medium-Term
- [ ] **PDF Flashcard Export**: Client-side PDF generation for printable flashcard sheets
- [x] **Service Worker**: Implemented `sw.js` v1.5.0 with 4-strategy caching (cache-first, stale-while-revalidate, network-first, CDN cache)
- [x] **Study Session Analytics**: Implemented in v5.0 — `startSession()`, `endSession()`, `recordAnswer()` in state.js
- [ ] **Curated Weaver Sentences**: Replace runtime extraction with hand-curated sentence database

### Long-Term
- [x] **PWA Packaging**: manifest.json, Service Worker, beforeinstallprompt install banner — needs maskable icons
- [x] **Offline NLP Ingestion Engine**: Immersions-Labor implemented to let users paste raw German text and cross-reference against their learned FSRS profile.
- [ ] **Multi-Language Support**: Architecture supports additional language pairs
- [x] **Original example sentences** (2026-06-30): all 2,627 example sentences hand-authored as original content (replacing the earlier copyrighted Goethe text), verified 0 verbatim + grammar-checked. *(Superseded the earlier "AI Sentence Generation via NotebookLM" idea — examples are original-authored and copyright-clean, not sourced.)*

---

## 📝 7. localStorage Keys

| Key | Type | Description |
|-----|------|-------------|
| `current_level` | string | Active CEFR level (`"a1"`, `"a2"`, `"b1"`) |
| `current_theme` | string | Active theme name |
| `learned_cards_{level}` | JSON array | Set of learned card IDs |
| `srs_state_{level}` | JSON object | FSRS-5 SRS data per card (stability, difficulty, retrievability) |
| `show_images` | boolean | Image visibility preference |
| `visited_levels` | JSON array | Set of visited CEFR levels |
| `session_history` | JSON array | Study session log (capped at 50 entries) |

> Note: most progress now lives in IndexedDB (via `idb-keyval`); `localStorage` holds lightweight preferences and is mirrored/migrated on load. Quiz "streak" keys were removed with the gamification cleanup.

## 🛡️ 8. Persistence Safety Layer (Added 2026-06-14)

All localStorage operations now go through a safety abstraction in `state.js`:

| Function | Purpose | Export |
|----------|---------|--------|
| `safeJsonParse(key, fallback)` | Guards against corrupted JSON crashing the SPA on boot | ✅ |
| `safeSetItem(key, value)` | Catches `QuotaExceededError` for graceful degradation | ✅ |
| `schedulePersist(key, dataFn, delayMs)` | Debounced write coalescer (300ms default) | ✅ |
| `flushAllPending()` | Immediate flush of all pending writes (registered on `beforeunload`) | ✅ |

### AudioContext Singleton

`getSharedAudioContext()` in `audio.js` provides a single lazily-initialized `AudioContext` shared across audio functions in `audio.js`. Handles browser autoplay policy by auto-resuming suspended contexts.

### ID Normalization

All card IDs in the `learnedCards` Set are now stored as `Number` only. The previous dual-type pattern (`add(Number(id))` + `add(String(id))`) caused the Set's `.size` to report 2× the actual count, inflating progress statistics.

---

## 🎯 9. Competitive Quality Roadmap (2026-06-30)

Derived from `COMPETITIVE_ANALYSIS_2026-06-30.md` §6 — moves that beat competitors
**within our scope pledges** (no gamification, no grammar engine, no accounts, no
tracking, no paid/runtime AI). Everything below uses **free, local, redistributable**
tooling only.

### ✅ Done this pass — Accessibility & quality gate
- **Accessibility raised to a verified Lighthouse 100** (from 86). Fixed: missing
  accessible name on `#help-modal-close`; unlabeled `#trainer-speed-slider`;
  label/name mismatch on `#trainer-loop-btn`; the deck-preferences popover
  re-modelled from a faux `role="menu"` (which failed `aria-required-children`)
  to a labelled `role="group"` disclosure with `aria-controls`; demoted a
  stray `<h4>` micro-label to fix heading order.
- **Best-Practices raised to 100** — fixed an **invalid `manifest.json`** (trailing
  comma before `]`) that browsers logged as a console error and that could break
  PWA install/parse. SEO already 100.
- **New CI gate:** `.github/workflows/quality.yml` + `lighthouserc.json` run
  Lighthouse (axe-core under the hood) on every push/PR. a11y / best-practices /
  SEO are **hard gates** (≥100/95/100); performance is **advisory** (CI throttles
  unminified dev assets — not representative of the Pages build). Local run:
  `npm run audit:lighthouse`.
- Baseline scores captured: **a11y 100 · best-practices 100 · SEO 100 · perf ~57 (dev)**.

### ✅ Done this pass — Test suite rebuild + CI gate (2026-07-01)
- **Deleted** the old harness (`scripts/run_unit_tests.py`, `scripts/e2e_comprehensive_tests.py`)
  and reviewed one-off cruft (`debug_syntax.py`, `test_network.py`, two `scratch/test_*.py`).
- **Rebuilt** under `tests/`: `fsrs.test.mjs` + `nlp.test.mjs` (deterministic FSRS-5 + NLP,
  Node built-in runner, **zero deps, 22 tests green**) and `smoke_e2e.py` (Playwright boot/smoke:
  zero uncaught errors, real card renders, IndexedDB round-trip, scheduler advances in-browser).
- **CI:** `.github/workflows/tests.yml` — `unit` job (`npm test`) is a **hard blocking gate**;
  `e2e` job advisory until stable. `package.json` gains `test` + `test:e2e`.
- **Audit note:** the carried-forward "rotted" label was **stale** (`run_unit_tests.py` passed clean);
  rebuilt anyway. Full re-audit: `PRODUCTION_READINESS_AUDIT_2026-07-01.md`. New P1 items surfaced:
  relabel/repair the "FSRS-5" scheduler (spec deviations), fix B1 data defects (ids 81/82 dup, 682
  malformed), finish manual WCAG 2.2 AA + a real perf budget.

### ⏭️ Queued — content moves (free tooling; some need one owner setup step)

**Native-speaker audio** (attacks our weakest KPI — Audio; beats Seedlang/Memrise/Babbel):
- **Lingua Libre** (Wikimedia) — real native-speaker word recordings, **CC-BY-SA**
  (redistributable with attribution + share-alike). Bulk dataset download, matched
  to headwords.
- **Piper TTS + Thorsten voice** — **CC0**, offline neural TTS (~15M ONNX, runs on
  CPU) to fill gaps + example sentences. Fully autonomous.
- Bundle as compressed audio, precache in the service worker → offline pledge intact.
  `NOTICE`/`PRIVACY.md` to gain a CC-BY-SA attribution block (CC0 needs none).

**On-device pronunciation** (turns our one privacy caveat into a flex):
- Replace cloud `SpeechRecognition` with **Vosk** (German model, Apache-2.0) or
  whisper.cpp (MIT) — bundled, offline scoring.

**B1 imagery — honest scope.** The "992 missing" is misleading: it's 664 nouns,
118 adjectives, 105 other, 100 verbs, 5 adverbs. Per our CLIP analysis, abstract
words should **not** be force-imaged (dual-coding helps concrete concepts only).
Real target = the **concrete-noun subset (~300–450)**, not 992.
- Generator: **FLUX.1 [schnell]** — **Apache-2.0**, generated images are freely
  redistributable (unlike Imagen 3, whose redistribution terms are still an open
  owner action). Run locally (needs a GPU) **or** via **Cloudflare Workers AI free
  tier** (10k neurons/day ≈ dozens of images/day, no GPU — fits the "slow &
  thorough" cadence). *Owner setup:* a free Cloudflare token, or confirm local GPU.
- QA every generated image through the existing `scripts/check_image_word_clip.py`
  (CLIP + pHash) before committing. Lock one style prompt for batch consistency;
  do **not** regenerate the 1,588 existing images.

**Formal WCAG 2.2 AA sign-off & performance budget** (already scaffolded above):
- Extend the Lighthouse gate with a production-build performance budget once a
  minify step exists; keep axe/pa11y coverage for manual AA criteria.

> Autonomy note: audio (Piper/Lingua Libre), Vosk STT, and the a11y/CI work are
> fully autonomous. Image generation needs **one** owner input (Cloudflare token
> **or** GPU confirmation) before it can run.
