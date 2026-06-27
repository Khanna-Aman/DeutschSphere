# 🇩🇪 DeutschSphere

[![Live Web App](https://img.shields.io/badge/Launch%20App-DeutschSphere-FF007F?style=for-the-badge&logo=google-translate&logoColor=white&labelColor=020617)](https://khanna-aman.github.io/DeutschSphere/)
[![Deploy Status](https://img.shields.io/badge/Deploy-GitHub%20Pages-00F0FF?style=for-the-badge&logo=github&logoColor=white&labelColor=020617)](https://khanna-aman.github.io/DeutschSphere/)

> **DeutschSphere** is a clinically rigorous, high-contrast, offline-first client-side German vocabulary mastery application. It features standard-setting spaced repetition modeling and advanced acoustic feedback designed entirely for high-efficiency cognitive focus. All user instructions, settings, and interactive modules are fully localized in professional English.

👉 **[CLICK HERE TO LAUNCH WEB APP](https://khanna-aman.github.io/DeutschSphere/)**


---

## ⚡ Core Pillars of v1.1.0

### 1. Spaced Repetition Engine (FSRS-5)
Powered by a zero-dependency, pure client-side port of the **Free Spaced Repetition Scheduler (FSRS-5)**. It tracks individual word stability ($S$), difficulty ($D$), and retrievability ($R$) curves across **3,921 words**, outperforming traditional SM-2 algorithms by 20–30%.
* Navigated via fluid mobile swiping or desktop hotkeys (`1-4` for review grading, `Space` to flip, `Enter` to submit).
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

### 6. Encrypted Profile Sync & Backup
Maintain complete data ownership without external server overhead.
* Back up or restore your entire IndexedDB progress state instantly using a compressed, Base64-encoded copy/paste Sync Key or raw JSON profile files.

### 7. Zero-Cost Developer Feedback System
Direct communication pipeline embedded in the client UI.
* Users can submit bug reports, feature requests, or general feedback directly to the developer's inbox via FormSubmit without external server costs or accounts.
* Supports anonymous submissions and instant client status feedback.

### 8. Adaptive Widescreen & Mobile Safe-Area Layouts
Optimized display architecture across all viewport dimensions.
* **Desktop Zero-Scroll Layout**: Automatically aligns German cards alongside revealed English meanings side-by-side on laptops/desktops so users never have to scroll.
* **Mobile Safe-Area Insets**: Accounts for Android navigation bars and OS gesture handles (`viewport-fit=cover` & `env(safe-area-inset-bottom)`) to prevent element cutoff.

---

## 📦 Vocabulary Schema & Coverage

We cover **3,921 ground-truth entries** verified against official Goethe-Institut curricula:

| Level | Entries | Classification | Verification Status & Asset Progress |
| :--- | :---: | :--- | :--- |
| **A1** | 640 | Beginner | ✅ 100% Verified | 🎨 640 / 640 Premium 3D WebP Assets Complete |
| **A2** | 1,142 | Elementary | ✅ 100% Verified | 🎨 1,142 / 1,142 Premium 3D WebP Assets Complete |
| **B1** | 2,139 | Intermediate | ✅ 100% Verified | 🚀 Complete Dataset Available |
| **Total** | **3,921** | Goethe-Institut A1-B1 | **100% Pure Client-Side Execution** |

> [!IMPORTANT]
> **The Zero-Inference Clause**: All vocabulary data is verified strictly against the Goethe-Institut wordlists via NotebookLM. If conjugation tables, plurals, or contextual examples are not present in our verified source sheets, they are assigned to `null`. We strictly forbid generating speculative linguistic parameters or synthesizing placeholder data using generic LLM weights.

---

## ⌨️ Desktop Hotkeys

| Key | Action | Key | Action |
| :---: | :--- | :---: | :--- |
| `Space` | Flip card / Open accordion | `V` | Play word TTS |
| `→` / `↓` | Next card | `A` | Toggle auto-play TTS |
| `←` / `↑` | Previous card | `B` | Toggle card visual assets |
| `1` - `4` | FSRS quality grades | `Esc` | Close panels / Exit quiz |
| `L` | Toggle learned status | `?` | Toggle keyboard shortcuts |

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
│   ├── stats.js            # Technical memory dashboard and technical charts renderer
│   ├── router.js           # Client-side hash router
│   ├── search.js           # Lexicon indexing and search sidebar categories
│   └── events.js           # Global keyboard and mouse event handlers
│
├── a1/ , a2/ , b1/         # Verified datasets (JSON files + WebP graphical assets)
└── scripts/                # QA verification and unit testing automation
```

---

## 📄 QA Verification & Test Suites

We enforce high-reliability client-side state execution via dual test pipelines:
* **Syntax Verification**: Run `python scripts/debug_syntax.py` to launch an automated browser session, verify module imports, and assert console clarity.
* **Unit Testing**: Run `python scripts/run_unit_tests.py` to execute core FSRS mathematical stability scheduling, Kölner Phonetik phonemic tests, and verb/noun lemmatization modules.
