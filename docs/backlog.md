# Feature Backlog: DeutschSphere

This backlog tracks implemented features, their technical specifications, and outstanding tasks for the multi-level (A1, A2, B1) German vocabulary flashcard application.

> Last updated: 2026-06-22

---

## 🛠️ 1. Core Architecture & Data Layer

### Dynamic Level Routing & Loading
- **Hash-Based SPA Routing**: The app uses `window.location.hash` for client-side routing across 7 views: `#/` (flashcards), `#/quiz`, `#/adventure`, `#/weaver`, `#/cheatcodes`, `#/stats`, `#/immersion`.
- **Relative Path Data Loading**: Vocabulary is fetched dynamically from `./${level}/wordlist.json` where `${level}` is `"a1"`, `"a2"`, or `"b1"`.
- **Default Level**: A2 (hardcoded in HTML `<select>`, overridden by `localStorage.current_level` on return visits).
- **ES6 Module Architecture**: Application logic split across 9 modules in `js/` directory, loaded via `<script type="module">`.

### Vocabulary Entry JSON Schema
Every word entry conforms to the following structure (actual field names from codebase):
```json
{
  "german": "der Abflug",
  "word_class": "Nomen",
  "gender": "der",
  "plural": "die Abflüge",
  "verb_conjugation": null,
  "adjective_forms": null,
  "english": "departure (flight) / takeoff",
  "pronunciation": "ahp-flook",
  "theme": "Reise & Verkehr",
  "antonym": "die Ankunft",
  "example_de": "Der Abflug ist um 11.20 Uhr.",
  "example_en": "The departure is at 11:20 AM.",
  "image": null,
  "id": 2
}
```

**Field details:**
- `german`: Capitalized nouns with article; lowercase verbs/adjectives
- `word_class`: Nomen, Verb, Adjektiv, Adverb, Andere, Ausdruck, etc.
- `gender`: `"der"` / `"die"` / `"das"` / `null` (non-nouns)
- `plural`: Absolute form with `"die"` prefix, or `null`
- `verb_conjugation`: `{ "present_3sg", "perfekt", "is_irregular" }` for verbs
- `adjective_forms`: `{ "comparative", "superlative" }` for adjectives
- `theme`: Raw category string, normalized client-side to 12 canonical categories
- `image`: SVG path or `null`

### Data Tier Summary

| Level | Words | File Size | SVG Images | Adventure Scenarios |
|-------|-------|-----------|------------|---------------------|
| A1    | 640   | 315KB     | 640        | 2                   |
| A2    | 1,142 | 626KB     | 1,142+     | 2                   |
| B1    | 2,139 | 1,139KB   | 2,000+     | 2                   |
| **Total** | **3,921** | **2.08MB** | **~3,900+** | **6**         |

### 12 Canonical Theme Categories
Person & Familie, Wohnen & Haushalt, Gesundheit & Körper, Natur & Umwelt, Reise & Verkehr, Essen & Trinken, Einkaufen & Konsum, Dienstleistungen & Behörden, Ausbildung & Lernen, Arbeit & Beruf, Freizeit & Unterhaltung, Zeit, Maße & Basiswortschatz

---

## 🎨 2. Design System & Interactive UI

### Theme Engine (5 Themes)
Persisted via `localStorage.current_theme`. Each theme fully overrides: body background, glass effects, sidebar, inputs, buttons, adventure chips, weaver chips, phonetic panel.

| Theme | CSS Class | Description |
|-------|-----------|-------------|
| Slate Mesh | (default) | Dark slate with indigo/pink mesh gradients |
| Berlin Cyberpunk | `theme-cyberpunk` | Deep cosmic black, neon cyan/magenta |
| Schwarzwald | `theme-schwarzwald` | Dark forest green, warm amber |
| Oktoberfest Gold | `theme-oktoberfest` | Chocolate surfaces, amber-gold accents |
| Weimar Classic | `theme-weimar` | Light ivory, crisp dark-indigo borders |

### Gender-Themed Card Glows
- 🔵 `der` → `.card-glow-der` (Blue neon border)
- 🔴 `die` → `.card-glow-die` (Pink/rose neon border)
- 🟢 `das` → `.card-glow-das` (Emerald neon border)
- 🟣 Neutral/Other → `.card-glow-neutral` (Violet border)

### CSS Architecture
- **Glassmorphism**: `.glass` class with `backdrop-blur`
- **Custom animations**: shuffle, slideInRight/Left, shake, pulseGlowSuccess/Error, phonetic-pulse-ring, slide-in-right
- **Accordion transitions**: CSS Grid `grid-template-rows: 0fr→1fr` with `opacity` for fluid auto-height animation
- **Custom scrollbar**: 5px thin scrollbar with rounded thumb
- **Auto-hyphens**: For long German compound words
- **Fonts**: Inter (body), Outfit (display/headings)
- **Icons**: FontAwesome 6.4.0

---

## 🧭 3. Component Architecture

### A. Sidebar Navigation Panel
- **Level Selector**: Dropdown with A1/A2/B1 options, triggers full data reload
- **Theme Selector**: 5-option dropdown, instant CSS class swap
- **Search Bar**: Real-time filter by German word or English meaning
- **Navigation Links**: 7 routes with bilingual labels and FontAwesome icons
- **Category List**: Dynamically rendered from loaded data with learned/total counts
- **Overall Progress Bar**: Gradient bar showing learned percentage across entire level
- **Keyboard Shortcuts Guide**: Collapsible panel, scrollable

### B. Main Flashcard Area (`#/`)
- **Card Display**: Large German word with gender glow, FSRS SRS badge, optional SVG illustration
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
- [x] Quiz Arena (MC + Spelling, Endless Mode)
- [x] Continuous Audio Trainer (dual-voice TTS)
- [x] Phonetik-Spiegel (pronunciation coach)
- [x] Deutsch-Abenteuer RPG (branching scenarios)
- [x] Grammatik-Weberei (drag-and-drop sentence builder)
- [x] Spickzettel (grammar cheatcodes)
- [x] Immersions-Labor (offline NLP engine)
- [x] Statistics Dashboard (rings, charts, forecasts)
- [x] Achievements Engine (12 badges + toast + Web Audio chimes)
- [x] 5 Premium Themes
- [x] 13 Keyboard Shortcuts
- [x] Responsive Design (mobile sidebar, touch targets)
- [x] Bilingual UI (German + English)
- [x] JSON Backup Export/Import
- [x] E2E Test Suite (Playwright) — fully implemented via `scripts/e2e_comprehensive_tests.py`

### ⚠️ Known Gaps
- [x] B1 SVG images — **Complete (pipeline run, ~2,000+ SVGs generated)**
- [ ] Adventure scenarios limited (2-3 per level)
- [x] UTF-8 double-encoding in cheatcodes_db.js — **Fixed (56 sequences, 2026-06-14)**
- [x] Service Worker for offline caching — **Implemented (sw.js v1.5.0, 4-strategy caching)**
- [ ] Weaver sentences extracted at runtime from wordlist (quality varies)

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
  - [x] Establishment of V6.0 Core Directives & Rules (`GEMINI.md`)
  - [x] Service Worker module precaching of ESM modules (`sw.js` precaches `js/nlp.js`, `js/immersion.js`, `idb-keyval.js`)
  - [x] Kölner Phonetik algorithms & inline suffix parser rules (`js/nlp.js`)
  - [x] Custom settings toggles in "Einstellungen" dropdown (SFX volume slider, Synthesized vs. Acoustic chimes, Toggle particle bursts)
  - [x] Lightweight, non-blocking CSS/JS-driven full-screen particle burst engine
  - [x] Interactive click-to-explore Immersions-Labor grid (inspect parsed lemmas, load CEFR level, FSRS state, TTS voice, quick-add cards)
  - [x] Inline suffix lightbulb grammar guides on flashcards and quiz views
  - [x] Spaced Repetition deck rating hotkeys (`1-4`) and mobile-responsive kinetic swipe-to-rate gestures
  - [x] Scrambled word-chip hotkeys (`1-9` + `Enter`) for Grammar Weaver and Deutsch-Abenteuer RPG views
  - [x] Copy-pasteable Base64 compressed IndexedDB progress backup sync keys
  - [x] Flashcard relative image pathing hotfix inside `js/flashcards.js` and `js/quiz.js` prepending `state.currentLevel` to prevent 404 image load errors
  - [x] **Premium Visual Strategy & Lottie Design Lock (SOTA)**: Fully finalized the V6.0 Universal 3D Claymation & Lottie sensory strategy. Configured the offline bulk generation pipeline to utilize Google's SOTA `imagen-3.0-generate-002` model (fully covered by Google Developer credits, $0 out-of-pocket). Programmed the chroma-key alpha masking (Pillow-based transparent floating icons), dynamic dual-tone theme-responsive SVG recoloring, Airbnb `lottie-web` async player, synchronized audio/haptic chimes, and PWA Level-Based Lazy Pre-caching in the system blueprints.



### Medium-Term
- [ ] **PDF Flashcard Export**: Client-side PDF generation for printable flashcard sheets
- [x] **Service Worker**: Implemented `sw.js` v1.5.0 with 4-strategy caching (cache-first, stale-while-revalidate, network-first, CDN cache)
- [x] **Study Session Analytics**: Implemented in v5.0 — `startSession()`, `endSession()`, `recordAnswer()` in state.js
- [ ] **Curated Weaver Sentences**: Replace runtime extraction with hand-curated sentence database

### Long-Term
- [x] **PWA Packaging**: manifest.json, Service Worker, beforeinstallprompt install banner — needs maskable icons
- [x] **Offline NLP Ingestion Engine**: Immersions-Labor implemented to let users paste raw German text and cross-reference against their learned FSRS profile.
- [ ] **Multi-Language Support**: Architecture supports additional language pairs
- [ ] **AI Sentence Generation**: Level-appropriate custom example sentences via NotebookLM

---

## 📝 7. localStorage Keys

| Key | Type | Description |
|-----|------|-------------|
| `current_level` | string | Active CEFR level (`"a1"`, `"a2"`, `"b1"`) |
| `current_theme` | string | Active theme name |
| `learned_cards_{level}` | JSON array | Set of learned card IDs |
| `srs_state_{level}` | JSON object | FSRS-5 SRS data per card (stability, difficulty, retrievability) |
| `quiz_streak` | number | Current quiz streak |
| `quiz_best_streak` | number | Best quiz streak ever |
| `adventure_xp` | number | Total adventure XP |
| `adventure_completed_scenarios` | JSON array | Completed scenario IDs |
| `show_images` | boolean | Image visibility preference |
| `achievements_unlocked` | JSON array | Unlocked achievement IDs |
| `visited_levels` | JSON array | Set of visited CEFR levels |
| `streak_data` | JSON object | Daily streak: current, longest, lastStudyDate, freezesAvailable |
| `session_history` | JSON array | Study session log (capped at 50 entries) |
| `weaver_xp` | number | Total Grammar Weaver XP earned |

## 🛡️ 8. Persistence Safety Layer (Added 2026-06-14)

All localStorage operations now go through a safety abstraction in `state.js`:

| Function | Purpose | Export |
|----------|---------|--------|
| `safeJsonParse(key, fallback)` | Guards against corrupted JSON crashing the SPA on boot | ✅ |
| `safeSetItem(key, value)` | Catches `QuotaExceededError` for graceful degradation | ✅ |
| `schedulePersist(key, dataFn, delayMs)` | Debounced write coalescer (300ms default) | ✅ |
| `flushAllPending()` | Immediate flush of all pending writes (registered on `beforeunload`) | ✅ |

### AudioContext Singleton

`getSharedAudioContext()` in `audio.js` provides a single lazily-initialized `AudioContext` shared across all SFX functions in `audio.js` and `adventure.js`. Handles browser autoplay policy by auto-resuming suspended contexts.

### ID Normalization

All card IDs in the `learnedCards` Set are now stored as `Number` only. The previous dual-type pattern (`add(Number(id))` + `add(String(id))`) caused the Set's `.size` to report 2× the actual count, inflating progress statistics.
