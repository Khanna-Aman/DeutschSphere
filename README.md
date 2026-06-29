# 🇩🇪 DeutschSphere

[![Live Web App](https://img.shields.io/badge/Launch%20App-DeutschSphere-FF007F?style=for-the-badge&logo=google-translate&logoColor=white&labelColor=020617)](https://khanna-aman.github.io/DeutschSphere/)
[![Deploy Status](https://img.shields.io/badge/Deploy-GitHub%20Pages-00F0FF?style=for-the-badge&logo=github&logoColor=white&labelColor=020617)](https://khanna-aman.github.io/DeutschSphere/)

> **DeutschSphere** is a clinically rigorous, high-contrast, offline-first client-side German vocabulary mastery application. It features standard-setting spaced repetition modeling and advanced acoustic feedback designed entirely for high-efficiency cognitive focus. All user instructions, settings, and interactive modules are fully localized in professional English.

👉 **[CLICK HERE TO LAUNCH WEB APP](https://khanna-aman.github.io/DeutschSphere/)**


---

## ⚡ Core Pillars of v1.1.0

### 1. Spaced Repetition Engine (FSRS-5)
Powered by a zero-dependency, pure client-side port of the **Free Spaced Repetition Scheduler (FSRS-5)**. It tracks individual word stability ($S$), difficulty ($D$), and retrievability ($R$) curves across **2,627 words**, outperforming traditional SM-2 algorithms by 20–30%.
* Navigated via pure card navigation swiping (swipe left for next card, swipe right for previous card) or desktop hotkeys (`1-4` for review grading, `Space` to flip, `Enter` to submit).
* Dynamic glassmorphic panels adapt with deterministic noun-gender glows: 🔵 `der` (masculine), 🔴 `die` (feminine), 🟢 `das` (neuter), and 🟣 neutral/other.

### 2. Phonetik-Spiegel (Pronunciation Trainer)
An interactive speech coach that captures microphone streams and evaluates pronunciation accuracy.
* Uses a pure-JS **Kölner Phonetik** matching algorithm to assert spoken matches by sound characteristics rather than flat orthography.
* Compares audio waveforms against native synthesis models and displays high-fidelity static mouth positioning guides for challenging German phonemes (`ä`, `ö`, `ü`, `ch`, `sch`, `r`).

### 3. Active Recall Quiz Arena
A dedicated testing interface designed to challenge active vocabulary retention.
* **Vokabel-Test (Multiple Choice)**: Generates DE ↔ EN challenges utilizing lightning-fast reservoir sampling to compile contextual distractors with zero runtime lag.
* **Schreib-Arena (Active Spelling)**: Free-text spelling tests with an integrated virtual umlaut tray (`ä`, `ö`, `ü`, `ß`) and rapid-input shortcuts. Includes layout-stable feedback (muted green pulse on success, clean horizontal shake on error).

### 4. Audio Trainer (Dual-Voice System)
Continuous speed-adjustable synthesis designed to anchor listening comprehension.
* Loops through vocabulary words, English meanings, and verified example sentences at pacing ranges from `0.7x` to `1.5x`.
* Operates entirely offline-first, leveraging browser Web Speech API.

### 5. Immersions-Labor (NLP Lab)
A lightweight client-side Natural Language Processing lab under `#/immersion`.
* Paste custom German text blocks to instantly lemmatize verbs, identify parts of speech, and extract noun genders via deterministic client-side regex rules.
* Highlights matching vocabulary already tracked in your FSRS progress database and lets you instantly convert unlearned terms to active flashcards.

### 6. Portable Profile Sync & Backup
Maintain complete data ownership without external server overhead.
* Back up or restore your entire IndexedDB progress state instantly using a compressed, Base64-encoded copy/paste Sync Key or raw JSON profile files.

### 7. Zero-Cost Developer Feedback System
Direct communication pipeline embedded in the client UI.
* Users can submit bug reports, feature requests, or general feedback directly to the developer's inbox via FormSubmit without external server costs or accounts.
* Supports anonymous submissions and instant client status feedback.

### 8. Adaptive Widescreen & Mobile Safe-Area Layouts
Optimized display architecture across all viewport dimensions.
* **Desktop Zero-Scroll Layout**: Automatically aligns German cards alongside revealed English meanings side-by-side on laptops/desktops so users never have to scroll.
* **Mobile Safe-Area Insets**: Accounts for Android navigation bars and OS gesture handles (`viewport-fit=cover` & `env(safe-area-inset-bottom)`) to prevent element cutoff. Includes persistent preference toggles for Fast Read, Autoplay, Illustrations, and Example Sentences.

### 9. 100% Offline PWA & Instant Installation
Full standalone application installation support across Android, iOS, and Desktop.
* **Instant App Download**: Users can install DeutschSphere directly onto their mobile home screen via the in-app `📥 Install App (PWA)` button or browser menu.
* **100% Offline Independence**: Pre-caches all 2,627 Goethe-verified vocabulary entries, Service Worker assets, and offline Web Speech API drivers so users experience complete functionality in Airplane Mode with zero network dependencies.

---

## 📦 Vocabulary Schema & Coverage

We cover **2,627 ground-truth entries** verified against official Goethe-Institut curricula:

| Level | Entries | Classification | Verification Status & Asset Progress |
| :--- | :---: | :--- | :--- |
| **A1** | 684 | Beginner | ✅ 100% Verified | 🎨 637 / 684 Premium 3D WebP Assets Complete (93%) |
| **A2** | 580 | Elementary | ✅ 100% Verified | 🎨 580 / 580 Premium 3D WebP Assets Complete (100%) |
| **B1** | 1,363 | Intermediate | ✅ 100% Verified | 🚧 371 / 1,363 WebP Assets In Progress (27%) |
| **Total** | **2,627** | Goethe-Institut A1-B1 | **100% Pure Client-Side Execution** |

> [!IMPORTANT]
> **The Zero-Inference Clause & Grounding**: All vocabulary data is verified strictly against official Goethe-Institut curricula using **Google NotebookLM** to ensure absolute linguistic truth. If conjugation tables, plurals, or contextual examples are not present in our source data sheets, they are assigned to `null`. We strictly forbid generating speculative translations or synthesizing placeholder grammar using generic LLM weights.
>
> **Curated Visual Assets**: The premium 3D illustrations for the active vocabulary lists were generated using Google Vertex AI's **Imagen 3** model, compressed to under 10KB each to maintain zero-latency offline loading.

---

## ⌨️ Desktop Hotkeys

| Key | Action | Key | Action |
| :---: | :--- | :---: | :--- |
| `Space` | Flip card / Open accordion | `V` | Play word TTS |
| `→` / `↓` | Next card | `A` | Toggle auto-play TTS |
| `←` / `↑` | Previous card | `B` | Toggle card visual assets |
| `1` - `4` | FSRS quality grades | `E` | Toggle example sentences |
| `L` | Toggle learned status | `Esc` | Close panels / Exit quiz |
| `S` | Toggle card shuffle | `?` | Toggle keyboard shortcuts |

---

## 🛠️ Architecture & Setup

### Local Development Server
Because DeutschSphere relies entirely on native ES6 modules, a local HTTP server is required to bypass local file-access CORS restrictions:
```bash
# Spin up local server in project directory
python -m http.server 8080

# Navigate to: http://localhost:8080
```

### File Hierarchy
```text
A1-B1_German/
├── index.html              # Core SPA HTML shell
├── index.css               # Premium design tokens, high-contrast layouts, gender card glows
├── tailwind.css            # Precompiled Tailwind build (static, tree-shaken — no runtime CDN)
├── tailwind.config.js      # Build-time Tailwind config + regeneration command
├── app.js                  # Main orchestrator: boots PWA, handles hash routing & View Transitions
├── sw.js                   # Service Worker (pre-caches static shell & CDN files for offline use)
├── manifest.json           # Progressive Web App configuration manifest
│
├── js/                     # ES6 Modular controllers
│   ├── state.js            # Unified app state, DOM selector maps, and IndexedDB debouncing
│   ├── idb-keyval.js       # Asynchronous key-value IndexedDB driver for heavy client profiles
│   ├── fsrs.js             # FSRS-5 mathematical modeling engine
│   ├── nlp.js              # Lemmatizer, suffix analyzer, and regex noun gender matches
│   ├── audio.js            # TTS speaker and Web Audio oscillators
│   ├── flashcards.js       # Spaced repetition card renderer & swipe haptics
│   ├── quiz.js             # Multiple-choice & text spelling test controllers
│   ├── immersion.js        # Immersion lab text analyzer view controller
│   ├── router.js           # Client-side hash router
│   ├── search.js           # Lexicon indexing and search sidebar categories
│   ├── telemetry.js        # Structured logging, observability hooks, and error boundaries
│   └── events.js           # Global keyboard and mouse event handlers
│
├── a1/ , a2/ , b1/         # Verified datasets (JSON files + WebP graphical assets)
└── scripts/                # QA verification and unit testing automation
```

---

## 🎨 Styling (precompiled Tailwind)

Tailwind is **precompiled to a static `tailwind.css`** rather than loaded from the Play CDN — this keeps the runtime build-free while letting the CSP drop `unsafe-inline`/`unsafe-eval` and removing a third-party script dependency. After changing class usage in the HTML or JS, regenerate it:

```bash
npx tailwindcss@3.4.17 -c tailwind.config.js -i tailwind.input.css -o tailwind.css --minify
```

Then commit the updated `tailwind.css` (it is served statically by GitHub Pages and pre-cached by the Service Worker).

---

## 📄 QA & Continuous Integration

**Automated (CI):** Every push or pull request that touches a wordlist or a doc that quotes counts runs [`scripts/validate_data.py`](scripts/validate_data.py) through GitHub Actions ([`.github/workflows/validate-data.yml`](.github/workflows/validate-data.yml)). Treating each `wordlist.json` as the source of truth, the build fails on invalid JSON, duplicate ids, broken or duplicated image references, CSV row-count drift, or any published word count that no longer matches the data.

**Local (manual):** A set of [Playwright](https://playwright.dev/)-driven scripts run the app in a real browser. They require a one-time `pip install playwright && playwright install chromium`:
* **Syntax smoke test** — `python scripts/debug_syntax.py` serves the app, loads it headless, and asserts every module imports with a clean console.
* **Unit tests** — `python scripts/run_unit_tests.py` exercises the FSRS-5 stability/difficulty scheduling math, the Kölner Phonetik similarity algorithm, and German noun/verb lemmatization in-browser.
* **End-to-end** — `python scripts/e2e_comprehensive_tests.py` walks the core user flows against a live local server.

> The browser scripts are run on demand and are not yet wired into CI; today the automated gate is data integrity.
