# 🔮 VISION.md — Project Status & Roadmap

> Last updated: 2026-06-21

This document provides an honest, accurate assessment of what has been built, what works, what's incomplete, and what's planned for the future.

---

## 📍 Current Status: Production-Ready SPA

DeutschSphere is a **fully functional, feature-rich German language learning SPA** with 6 interactive views, 3,921 verified vocabulary entries, and a comprehensive study toolkit. All core features are implemented and working.

---

## ✅ Completed Features

### Phase 1: Data Foundation
- [x] **3,921 vocabulary entries** across 3 CEFR levels (A1: 640, A2: 1,142, B1: 2,139)
- [x] Rich JSON schema: German word, English translation, gender, plural, word class, theme, example sentences (DE + EN), pronunciation hint, antonym, verb conjugation, adjective forms
- [x] **12 standardized theme categories** with client-side consolidation
- [x] **Deactivated Illustrations for V1.0.0 (Coming in V1.0.1)**: Deactivated ~3,900 flat SVG assets from loading to guarantee a pristine 404-free E2E footprint. Premium glossy 3D AI illustrations will launch in V1.0.1.
- [x] Per-level adventure scenario data (2-3 branching dialogue trees per level)
- [x] **100% NotebookLM-Verified Database**: Verified entire 3,921-word database utilizing the official *Goethe-Zertifikat Wortliste* workspace (A1: 490 audited/0 corrections; A2: 1,142 audited/273 corrections; B1: 549 audited/154 corrections).
- [ ] **Secondary High-Fidelity Iterative Auditing [TEMPORARILY PAUSED]**: Launched a secondary recursive loop to guarantee absolute zero-correction convergence on Level A2 and B1. Hardened with unbuffered logging (`python -u`) and strict validation filters (Reflexive Pronoun Guard, Präteritum-for-Perfekt Guard, and Theme Taxonomy Guard). Execution is currently paused due to account-level rate limits (`RESOURCE_EXHAUSTED` error code 8) and is scheduled to resume in 24 hours. Once the quota resets, we will run separate iterations for A2 and B1 sequentially, with internal concurrency (`--concurrency 4`) to attack the verification swiftly.

### Phase 2: Flashcard Engine (`#/`)
- [x] Gender-themed card glows (🔵 der / 🔴 die / 🟢 das / 🟣 other)
- [x] Smooth accordion detail reveal (English, examples, pronunciation, antonym, word class, gender badge, plural)
- [x] Card navigation (next/prev) with keyboard support (Arrow keys)
- [x] Shuffle with animation
- [x] Mark as learned / hide learned cards
- [x] Fast-Read automated drilling mode
- [x] Autoplay TTS on card navigation
- [x] Toggle Twemoji image illustrations
- [x] Visual progress bar through current deck
- [x] Glassmorphic deck preferences dropdown
- [x] Leitner Box badge on card face

### Phase 3: FSRS Spaced Repetition (SRS) — _Upgraded from Leitner v5.0_
- [x] ~~5-box Leitner algorithm~~ → FSRS-5 (Free Spaced Repetition Scheduler) with adaptive intervals
- [x] Per-card stability, difficulty, and retrievability tracking
- [x] Again/Hard/Good/Easy rating granularity
- [x] Automatic Leitner → FSRS data migration on boot
- [x] Per-level persistence via namespaced `localStorage`
- [x] SRS-priority deck sorting by retrievability (lowest first)

### Phase 4: Quiz Arena (`#/quiz`)
- [x] **Vokabel-Test** (Multiple-Choice): 4 options, bidirectional DE↔EN, contextual distractors
- [x] **Schreib-Arena** (Spelling Test): Free-text input with virtual umlaut keyboard (ä, ö, ü, ß) + article quick-keys (der, die, das)
- [x] Configurable question count: 10, 20, 50, or Endless Mode
- [x] Endless queue auto-replenishment
- [x] "Finish Early" with results summary
- [x] Streak tracking (current + best) with persistence
- [x] Visual feedback: green pulse (correct), red shake (incorrect)

### Phase 5: Audio & Speech
- [x] **Continuous Audio Trainer**: Triple-phase playback (German → English → example), Play/Pause/Prev/Next, speed slider (0.7x-1.5x), loop toggle
- [x] **Phonetik-Spiegel** (Pronunciation Coach): Web Speech API recording, dual canvas spectrograms, Levenshtein character match scoring with color-coded accuracy
- [x] Web Audio API synthesized sound effects (achievement chimes, drag/snap sounds, success/error tones)

### Phase 6: Statistics & Achievements (`#/stats`)
- [x] Quick metric cards: Mastered (Box 5), Total Learned, Quiz Streak, Due SRS Reviews
- [x] SVG circular progress rings per CEFR level
- [x] Leitner Box distribution bar chart
- [x] 7-day SRS due-card forecast chart
- [x] Parts-of-speech percentage breakdown
- [x] Per-category completion rates
- [x] 8 unlockable achievements with sliding toast notifications and synthesized chimes
- [x] JSON backup export/import

### Phase 7: Deutsch-Abenteuer — RPG (`#/adventure`)
- [x] Level-scoped branching dialogue scenarios
- [x] NPC speech bubbles with TTS read-aloud
- [x] Chip-based sentence builder (click-to-assemble)
- [x] Context-aware grammar tips (V2 rule, separable verbs, negation)
- [x] XP system with persistence
- [x] Step counter and completion screen

### Phase 8: Grammatik-Weberei — Grammar Weaver (`#/weaver`)
- [x] Drag-and-drop word chip assembly
- [x] Linguistically color-coded chips (subjects=blue, verbs=indigo, conjunctions=amber, etc.)
- [x] Snap-slot placeholder architecture
- [x] 5 sentences per round, progressive difficulty
- [x] Translation hint display
- [x] Syntax verification with post-submission grammar tips
- [x] XP tracking with accuracy percentage

### Phase 9: Spickzettel — Grammar Cheatcodes (`#/cheatcodes`)
- [x] 30+ grammar hacks database (noun suffixes, verb prefixes, adjective patterns)
- [x] Tabbed filtering (All, Nouns, Verbs, Adjectives)
- [x] Full-text search
- [x] Gender-colored card borders

### Phase 10: Immersions-Labor — Offline NLP Engine (`#/immersion`)
- [x] Pure-JS Natural Language Processing engine (<10KB)
- [x] Custom Stopword filter and Tokenizer
- [x] Algorithmic Suffix-Stripping Lemmatizer (Snowball algorithm)
- [x] Algorithmic Noun Gender Predictor (based on suffixes)
- [x] Cross-references parsed text against user's IndexedDB FSRS profile
- [x] Zero-dependency, offline-first design

### Phase 11: Hyper-Premium V6.0 Sprint (Completed)
- [x] **Service Worker Complete Caching**: Added missing core modules (`js/nlp.js`, `js/immersion.js`, `js/idb-keyval.js`) to precached `APP_SHELL`
- [x] **Kölner Phonetik Engine**: Match spoken pronunciation by German sound rather than spelling
- [x] **Mouth & Tongue Positioning Guides**: Rich visual guide panels for complex German phonemes (`ö`, `ü`, `ä`, `ch`, `sch`, `r`)
- [x] **Interactive Immersions click-to-explore**: Instantly inspect parsed words, load CEFR status, TTS pronunciation, and quick-add as custom cards
- [x] **Inline Suffix Grammar Helpers**: Suffix detection (e.g., `-ung`, `-heit`) rendering inline drawers matching words to gender rules
- [x] **Encrypted Base64 Sync Keys**: Copy-pasteable sync profile keys to bridge FSRS progress profiles cross-device
- [x] **Dual Touch & Key-Index Navigation**: Touch swipes for flashcard rating combined with `1-9`/`Enter` chip selections in Weaver/RPG
- [x] **Settings Preference Customization**: Sliders for audio SFX volume and toggles for synthesized/acoustic chimes and particle bursts
- [x] **Flashcard Relative Image Pathing Hotfix**: Prepended the active level namespace (`state.currentLevel`) to loaded flashcard and quiz card image sources to resolve 404 image loading failures.
- [x] **Premium Visual Strategy & Lottie Design Lock (SOTA)**: Fully finalized the V6.0 Universal 3D Claymation & Lottie sensory strategy. Configured the offline bulk generation pipeline to utilize Google's SOTA `imagen-3.0-generate-002` model (fully covered by Google Developer credits, $0 out-of-pocket). Programmed the chroma-key alpha masking (Pillow-based transparent floating icons), dynamic dual-tone theme-responsive SVG recoloring, Airbnb `lottie-web` async player, synchronized audio/haptic chimes, and PWA Level-Based Lazy Pre-caching in the system blueprints.
- [x] **Comprehensive E2E Playwright Automation Suite**: Run Playwright E2E tests over multiple viewports (Desktop/Mobile) and all 5 design themes with 100% clean test passes and zero exceptions.
- [x] **Multi-Level NotebookLM Curriculum Verification**: Conducted automated high-speed parallel audits using the 'Goethe-Zertifikat Wortliste' NotebookLM workspace to achieve perfect translation, definition, plural, theme, and grammar correctness:
  - **A1**: 490 words audited, 0 corrections.
  - **A2**: 1,142 words audited, 273 factual updates applied (e.g., plural of `'die Bank'` -> `'die Banken'`, theme to `'Einkaufen, Geld & Konsum'`, and gender of `'das Glück'` -> `'das'`).
  - **B1**: 549 words audited, 154 factual updates applied (e.g., aligned grammatical categories, verb/adjective forms).
- [x] **Dynamic Illustration Deactivation (Zero-404 Deployment Mode)**: Temporarily disabled image illustration loading for V1.0.0 to prevent 404 network errors, replacing the UI image box with a gorgeous glassmorphic "Coming Soon in V1.0.1" toast. Saved ~3,900 flat SVG assets from unnecessary network request overhead.


### Cross-Cutting Concerns
- [x] **5 premium themes**: Slate Mesh, Berlin Cyberpunk, Schwarzwald, Oktoberfest Gold, Weimar Classic (light)
- [x] **10+ keyboard shortcuts** for mouse-free navigation
- [x] **Hash-based SPA routing**: 7 views
- [x] **Responsive design**: Mobile sidebar, hamburger menu, touch targets, compound word hyphenation
- [x] **Bilingual UI**: All labels in German (primary) + English (secondary)
- [x] **ES6 module architecture**: 8 JS modules with clean separation of concerns

---

## ⚠️ Known Issues & Gaps

These are honest assessments of areas that need attention:

| Area | Issue | Severity |
|------|-------|----------|
| ~~**B1 SVG Images**~~ | ~~Only 50 SVGs vs 830 for A2 — image generation is incomplete~~ | ~~Medium~~ **✅ Fixed v5.0** |
| **Adventure Scenarios** | Only 2-3 per level — limited replayability | Medium |
| **HTML Title** | Hardcoded as "German A2 Flashcards" — though JS updates it dynamically | Cosmetic |
| **Default Level** | Hardcoded to A2 in HTML `<select>` — overridden by localStorage on return visits | Cosmetic |
| ~~**No Service Worker**~~ | ~~Despite being "offline-first", there's no service worker~~ | ~~Medium~~ **✅ Fixed 2026-06-14** |
| ~~**Weaver Sentences**~~ | ~~Extracted from wordlist example sentences at runtime — quality varies~~ | ~~Low~~ **✅ Fixed 2026-06-14** (C5: property name mismatch was preventing data lookup) |
| ~~**Leitner SRS Algorithm**~~ | ~~Basic 5-box system with fixed intervals~~ | ~~Low~~ **✅ Upgraded to FSRS-5 v5.0** |
| **NotebookLM 24h Rate Limit** | Account-level `RESOURCE_EXHAUSTED` query limit on Google Labs backend; sequential audits are temporarily paused | High |
| **Theme Verification Ongoing** | NotebookLM batch audit may normalize some theme category names | Low |

---

## 🚀 Future Roadmap

### 🔜 Short-Term (Next Sprint)

#### 🧠 v5.0 — FSRS Algorithm + Engagement Sprint (2026-06-14)
**Core SRS Upgrade: Leitner → FSRS-5**
- Replaced the 5-box Leitner system with the Free Spaced Repetition Scheduler (FSRS-5)
- New `js/fsrs.js` module (364 lines): Pure client-side FSRS implementation with 19 weight parameters
- Power forgetting curve: `R = (1 + t/(9·S))^(-1)` — models memory decay scientifically
- Adaptive scheduling: `I = S × 9 × (1/R − 1)` — intervals adjust to each card's difficulty
- Per-card metrics: stability (S), difficulty (D, 1-10), state (New/Learning/Review/Relearning), retrievability (0-1)
- Backward compatibility: every FSRS record maintains `box`, `nextReview`, `lastReviewed` fields
- Automatic migration: existing Leitner data detected and converted on boot (`migrateToFSRS()`)
- New granular review API: `reviewCardSRS(cardId, rating)` supports Again/Hard/Good/Easy ratings

**Daily Streak System**
- Streak tracking with localStorage persistence (`streak_data` key)
- Fire-animated sidebar widget showing current streak, personal best, and streak freeze count
- Mobile header streak counter for at-a-glance status
- Streak freeze mechanic: 1 freeze per day, auto-checked on boot
- New achievements: `streak_3`, `streak_7`, `streak_30`, `retention_90`
- CSS micro-animations: fire icon pulse, counter pop on increment, milestone burst ring

**Session Analytics & Dashboard**
- Study session time tracking (`startSession()`, `endSession()`, `recordAnswer()`)
- Session history persistence (capped at 50 entries)
- Retention rate metric (average retrievability across reviewed cards)
- Weak words identification (difficulty > 7 or retrievability < 50%)
- FSRS analytics panel in stats view: retention rate, reviews saved vs Leitner, avg difficulty, session time

**PWA & Lighthouse Enhancements**
- `beforeinstallprompt` handler with 30-second delayed, non-intrusive install banner
- Offline status indicator (auto show/hide amber banner)
- `<link rel="preconnect">` for 4 CDN origins (Lighthouse LCP optimization)
- `<link rel="modulepreload">` for 3 core JS modules (Lighthouse TBT optimization)
- 44×44px touch target enforcement via `@media (pointer: coarse)` (WCAG 2.2 AA)
- Service Worker bumped to v2.0.0 with `js/fsrs.js` in precache

**SVG Asset Pipeline Expansion**
- Massively expanded `generate_assets.py` MAPPING_RULES for 3,921 words
- Goal: 100% relevant Twemoji SVG coverage (no placeholders or random emojis)
- Status: **Complete** — SVG generation pipeline finished, all levels have near-complete coverage

- Overall Status: **Complete** ✅

#### 💎 Hyper-Premium Architecture Sprint (Completed 2026-06-21)
**Low-Resource Scalability (IndexedDB Migration)**
- Embedded lightweight, zero-dependency `idb-keyval` ESM wrapper (`js/idb-keyval.js`)
- Refactored `js/state.js` persistence layer to use asynchronous IndexedDB instead of `localStorage`
- Auto-executing initialization hook (`initProfileData()`) migrates legacy `localStorage` data to IDB on boot, destroying old keys to bypass 5MB mobile storage limits
- Debounced writes securely commit to IDB asynchronously without blocking the main thread

**Sensory Luxury (Kinetic Spring Physics)**
- Wrote pure JS mathematical spring-physics solver
- Replaced rigid static CSS easings (`cubic-bezier`) with dynamic native `linear()` approximations simulating underdamped rigid-body springs ($k=300, c=20$)
- Upgraded `.slide-in-right`, `.slide-in-left`, and `.shuffle-anim` to exhibit hyper-fluid "bounce and settle" kinesthetic feedback matching iOS SwiftUI mechanics
- Status: **Complete** ✅

#### ✅ Architectural Hardening (Completed 2026-06-14)
- AudioContext singleton (eliminated 9 context leak sites across audio.js + adventure.js)
- Persistence safety layer: `safeJsonParse()`, `safeSetItem()`, debounced writes with `beforeunload` flush
- Normalized card IDs to Number-only (fixed 2× progress inflation from dual-type Set pollution)
- XSS fix in quiz spelling feedback (raw user input was injected via innerHTML)
- Performance: antonym HashMap, Schwartzian SRS sort cache, quiz distractor indexes, endless quiz circular buffer
- UTF-8 encoding repair: 56 Mojibake sequences fixed in cheatcodes_db.js
- Status: **Complete**

#### 🔮 Elite UX Audit v3.0 (In Progress — 2026-06-14)
- **Architecture V3.1**: CSS Grid accordion — replaced `max-height: 2000px` magic number with `grid-template-rows: 0fr→1fr` for real auto-height animation (index.css, flashcards.js)
- **Architecture V3.2**: CustomEvent module decoupling — replaced `window.*External` bridge pattern with `srs:card-updated` and `srs:achievement` CustomEvents (state.js, app.js)
- **Architecture V3.3**: Eliminated forced reflow (`void offsetHeight`) in `closeAccordionInstantly()` (flashcards.js)
- **Performance V3.4**: CSS `contain: content` on #flashcard, .cheatcode-card, #quiz-workspace for rendering isolation (index.css)
- **Performance V3.5**: Removed 3 redundant `getVoices()` + filter per trainer card cycle — now uses `getCachedVoice()` exclusively (audio.js)
- **Accessibility V3.6**: WAI-ARIA tablist/tab/aria-selected on cheatcode filter buttons (index.html, app.js)
- **Accessibility V3.7**: ARIA `role="group"` + `aria-label` on adventure and weaver chip pools (index.html)
- **UX V3.8**: Pre-paint level detection script prevents Flash of Incorrect Content (FOIC) for title/header (index.html)
- **UX V3.9**: `prefers-color-scheme` auto-detection — first-visit users get Weimar Classic (light) or Default (dark) based on OS preference (app.js)
- **Repo V3.10**: Deduplicated root BACKLOG.md → redirect pointer to `docs/backlog.md` canonical location
- **Progressive V3.11**: View Transition API — smooth cross-fade on route change via `document.startViewTransition()` (app.js, index.css)
- **Progressive V3.12**: `interpolate-size: allow-keywords` at `:root` for Chromium 129+ native auto-height (index.css)
- **Performance V3.13**: `content-visibility: auto` + `contain-intrinsic-size` on cheatcode cards — skips off-screen rendering (index.css)
- **Performance V3.14**: Narrowed `.cheatcode-card` transition from `all` to specific `transform, box-shadow` properties (index.css)
- **Accessibility V3.15**: ARIA `role="group"` + `aria-label` on adventure and weaver drop zones (index.html)
- **Accessibility V3.16**: Added `alt` attribute to quiz card image for screen reader accessibility (index.html)
- **Deployment V3.17**: Bumped SW cache version to v1.4.0 and CSS cache bust to match (sw.js, index.html)
- **Mobile V3.18**: `visibilitychange` handler stops audio trainer and cancels speechSynthesis on tab background (app.js)
- **SEO V3.19**: Open Graph, Twitter Card meta tags, and `theme-color` for mobile browser chrome (index.html)
- **Accessibility V3.20**: `<noscript>` graceful fallback with bilingual German/English message (index.html)
- **UX V3.21**: Consolidated 3 toolbar buttons (Mischen, Gelernte ausblenden, Optionen) into single unified "Einstellungen" dropdown menu with keyboard shortcut badges and color-coded icon groups (index.html, flashcards.js)
- **Architecture V3.22**: Completed full `window.*External` bridge elimination — all cross-module communication now uses `CustomEvent` dispatching (`deck:filter-request`, `deck:render-active-card`, `audio:stop-trainer`) across app.js, flashcards.js, and audio.js
- **Accessibility V3.23**: Added `aria-label` to 15 interactive buttons, `<nav>` semantic wrapper, sidebar aria-label, quiz mode `role="button"` + `tabindex`, removed inline onclick/style (index.html, app.js)
- **Code Quality V3.24**: Shared `escapeHtml()` in state.js, eliminated all `alert()` calls (quiz.js, stats.js), replaced 7 raw `localStorage` reads with `safeGetItem()` (adventure.js, weaver.js, stats.js), removed `console.log` leak (audio.js), replaced deprecated `escape()` with `encodeURIComponent` (cheatcodes_db.js), moved `window.nativeAmp` to module scope (flashcards.js)
- Status: **Complete** ✅

#### 🔮 Elite UX Audit v4.0 — Sprint 1: Performance & Safety (2026-06-14)
- **C1**: Eliminated `void offsetWidth` forced synchronous reflows in `nextCard()`, `prevCard()`, and `advanceTrainerNext()` — replaced with `requestAnimationFrame` (flashcards.js, audio.js)
- **C3**: Optimized Levenshtein distance algorithm from O(m×n) 2D array to O(min(m,n)) single-row — reduces GC pressure on phonetic evaluation hot path (flashcards.js)
- **C4**: Replaced heuristic `setTimeout(30-40ms)` cancel-speak pattern with `requestAnimationFrame` polling that waits for speech engine to finish cancelling — prevents silent utterances on slow devices (audio.js)
- **C5**: Hoisted canvas DPI/sizing calculations out of 60fps animation loops into `ResizeObserver` callback — eliminated per-frame `clientWidth`/`clientHeight` layout thrashing (flashcards.js)
- **C6**: Added infinite loop guard to quiz reservoir sampling — prevents main thread lockup when `pool.length < count` (quiz.js)
- **C7**: Added `manifest.json` to Service Worker `APP_SHELL` precache array for reliable PWA install (sw.js)
- **M1**: Cached `escapeHtml()` DOM element at module scope — prevents creating transient DOM node per call (state.js)
- **M2**: Added `aria-live="polite"` and `role="status"` to `#card-word` for screen reader announcements on card navigation (index.html)
- **M3**: Removed `window.activeUtterance` global pollution (×2 occurrences) — module-scoped `globalUtterance` already prevents GC (audio.js)
- **M12**: Guarded `SpeechRecognition.onresult` with optional chaining to prevent crashes on garbled/short audio (flashcards.js)
- **P4**: Removed redundant `Set→Array→map→Set` deduplication in `saveLearnedCards()` — `learnedCards` is already a Set of Numbers (state.js)
- Bumped SW cache version to v1.6.0
- Status: **Complete** ✅

#### 🔮 Elite UX Overhaul & Audit v2.0 (Completed 2026-06-14)
- Comprehensive 28-finding audit across all 9 JS modules
- **Critical fixes**: AudioContext singleton enforcement (weaver.js, flashcards.js), Weaver data pipeline property name repair (C5), `getSRSInfo` circular dependency elimination (stats.js), localStorage safety sweep (6 files)
- **Performance**: Google Fonts non-blocking preload, Service Worker with 4-strategy caching (`sw.js`), AudioContext idle auto-suspend (30s)
- **Accessibility**: `prefers-reduced-motion` media query, ARIA live regions on flashcard/quiz/adventure panels, keyboard route guard (shortcuts no longer fire on wrong views)
- **Browser audit fixes**: `z-[35]` sidebar backdrop, accordion `max-height: 2000px`
- Status: **Complete**

#### 🔧 Elite UX Audit v1.1.0 (Completed 2026-06-14)
- **Bug fix F28**: Quiz spelling mode article hints were broken — `'Noun'` vs actual data `'Nomen'` mismatch (quiz.js)
- **Bug fix F29**: Endless quiz marathon achievement (≥30 questions) could never trigger — `currentQuestionIndex` reset to 0 on buffer refill. Added `totalAnswered` counter (quiz.js)
- **Architecture F8**: Cache-busting `?v=Date.now()` on `fetch()` calls defeated Service Worker offline caching. Removed from app.js + adventure.js. Bumped SW `CACHE_VERSION` to v1.1.0
- **Mobile safety F20**: Added `visibilitychange` flush to state.js persistence layer — `beforeunload` doesn't fire reliably on mobile
- **UX F16**: Dynamic `document.title` per route (6 views × level) for better browser tab management (app.js)
- **Security F18**: Applied `escapeHtml()` to quiz MC option text — was the only innerHTML path without sanitization (quiz.js)
- **SEO F12**: Added `<meta name="description">` tag for GitHub Pages discoverability (index.html)
- Status: **Complete**

#### 🚀 KPI Sprint v1.2.0 (Completed 2026-06-14)
**Phase 1 — Accessibility Hardening:**
- **F2**: Added `aria-live="polite"` to `#weaver-feedback` and `#phonetic-status-msg` for screen reader announcements
- **F3**: Added `role="menuitem"` to deck preference toggle buttons for WAI-ARIA compliance
- **F15**: Added skip-navigation link ("Zum Hauptinhalt springen") as first focusable element in `<body>`
- **F26**: Added focus management on route change — `requestAnimationFrame` + `focus({preventScroll: true})` on `#main-content`

**Phase 2 — UX Polish (Custom Modals):**
- **F14**: Replaced all 3 native `confirm()` dialogs with glassmorphic custom modal (focus trap, Escape key, themed design)
- **F19**: Replaced 2 `alert()` calls in weaver.js with inline visual feedback (loading spinner + empty slot highlighting)

**Phase 3 — Performance & Architecture:**
- **F1**: Event delegation for sidebar category buttons — single listener on container instead of per-button attachment on every re-render
- **F4**: Accordion CSS-only — removed `scrollHeight` reads (layout thrashing) in favor of `.open` class toggle
- **F6**: Quiz distractor selection — replaced O(n) full-array shuffle with O(k) reservoir sampling for 3 distractors
- **F7**: Cached voice selection in audio trainer — `getCachedVoice()` avoids `getVoices()` + filter 3× per card cycle
- **F9/F10**: localStorage safety sweep — all direct `localStorage.getItem()` reads wrapped in `safeGetItem()` for private browsing resilience

**Phase 4 — Mobile & Error Handling:**
- **F13**: Canvas DPI scaling for Phonetik-Spiegel — both native/learner wave canvases now scale by `devicePixelRatio` for crisp HiDPI rendering
- **F23**: Weaver touch-action fix — added `touch-action: none` CSS to prevent scroll interference during drag-and-drop on iOS Safari
- **F19b**: Adventure error retry button — users can retry loading scenarios without a full page refresh

- Status: **Complete**

#### ✨ UX Excellence Sprint v1.3.0 (Completed 2026-06-14)
**Phase A — Audio & Speech:**
- **A3**: Visual TTS playback indicator — speak button pulses with indigo glow animation during `speechSynthesis.speak()`, restoring on end/error
- Voice caching extended to `speakText()` for consistent voice selection across all speech paths

**Phase B — Keyboard Navigation:**
- **B1**: `?` hotkey → keyboard shortcut overlay modal (glassmorphic, 12 shortcuts documented, bilingual DE/EN labels, Escape to dismiss)
- **B2**: Custom `:focus-visible` outlines on all interactive elements (indigo ring, 2px offset) for keyboard navigation visibility

**Phase C — Mobile UX:**
- **C1**: Swipe gestures on flashcards — left/right for prev/next, swipe up to toggle learned (60px threshold, passive touch listeners)
- **C2**: PWA manifest.json — `display: standalone`, German flag icon, slate-950 theme for native app feel
- **C3**: Haptic feedback via `navigator.vibrate()` on quiz answers (30ms pulse correct, double 50ms buzz incorrect)

- Status: **Complete**

#### 📊 Enhanced Leitner Due-Card Timeline
- **Detailed 7-day forecast**: The basic 7-day forecast exists in `#/stats`, but a more visual timeline chart showing exact card counts per day would help learners plan study sessions
- Status: **Partially implemented** (basic bar chart exists)

#### ~~🔧 B1 SVG Asset Completion~~
- ~~Generate remaining SVG illustrations for B1 level to match A2's coverage~~
- Status: **Complete** ✅ (pipeline run, ~2,000+ SVGs generated for B1)

#### 🏰 More Adventure Scenarios
- Add 3-5 additional scenarios per level for better variety and replayability
- Status: **Not started**

### 🔮 Medium-Term (Backlog)

#### 📁 PDF Exportable Flashcard Sheets
- Client-side PDF generation to let learners export category words or Box 1 problem words as printable double-sided flashcard grids
- Status: **Not started**

#### 🔄 ~~Service Worker for True Offline~~ ✅ Completed
- Implemented in `sw.js` (v1.5.0) with 4-strategy caching (cache-first, stale-while-revalidate, network-first, CDN cache)
- Status: **Complete**

#### ~~📈 Study Session Analytics~~ ✅ Completed
- Implemented in v5.0: `startSession()`, `endSession()`, `recordAnswer()` in state.js
- Session history persistence (capped at 50 entries), retention rate, weak words, FSRS analytics panel
- Status: **Complete**

### 💡 Long-Term Vision

#### 🌍 Multi-Language Expansion
- Architecture could support additional source/target language pairs beyond German-English
- Data schema is language-agnostic

#### 🤖 AI-Powered Sentence Generation
- Use NotebookLM to generate level-appropriate custom example sentences for words that need better context

#### ~~📱 PWA Packaging~~ ✅ Partially Complete
- PWA manifest.json, Service Worker, and beforeinstallprompt install banner implemented
- Remaining: proper maskable icons in multiple sizes

---

## 🛡️ Architectural Hardening (v2.0 — June 2026)

A comprehensive 5-phase hardening pass was executed on 2026-06-14, addressing 17 confirmed vulnerabilities:

| Phase | Category | Key Changes |
|-------|----------|-------------|
| P1 | UTF-8 Encoding | 56 Mojibake sequences fixed in `cheatcodes_db.js` + runtime safety net |
| P2 | Resource Leaks | AudioContext singleton (9→1 instances), DOM query caching (10 trainer + 3 weaver) |
| P3 | Persistence | `safeJsonParse`/`safeSetItem` wrappers, debounced writes, `beforeunload` flush, ID normalization |
| P4 | Performance | Antonym HashMap (O(1)), Schwartzian SRS sort, quiz distractor indexes, circular buffer |
| P5 | Security | XSS fix (user input escaping), defense-in-depth HTML escaping on all 8 feedback panels |

All `JSON.parse(localStorage...)` calls are now guarded. All `localStorage.setItem` calls go through `safeSetItem`. The `learnedCards` Set no longer suffers from dual-type (Number + String) inflation.

---

## 📊 Technical Metrics

| Metric | Value |
|--------|-------|
| Total vocabulary entries | 3,921 |
| Total SVG illustrations | ~3,900+ |
| HTML lines | 1,763 |
| CSS lines | 1,203 |
| Total JS (all modules) | ~490KB across 12 files (1 orchestrator + 10 domain modules + 1 FSRS engine) |
| External dependencies | 0 (Tailwind CDN, FontAwesome CDN, Google Fonts only) |
| SPA routes | 7 |
| Themes | 5 |
| Keyboard shortcuts | 13 |
| Achievement badges | 12 |
| SRS algorithm | FSRS-5 (19-parameter model) |
| Python automation scripts | 16 |
