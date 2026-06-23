# 🇩🇪 DeutschSphere

A zero-dependency, offline-first, ultra-premium German language learning SPA covering **3,921 vocabulary words** across CEFR levels A1, A2, and B1 — verified against the official Goethe-Institut curriculum.

👉 **Live Web Application**: [https://khanna-aman.github.io/DeutschSphere/](https://khanna-aman.github.io/DeutschSphere/) — **Launch and learn instantly on desktop or mobile!**

> Built with HTML, Tailwind CSS (CDN), and vanilla ES6 JavaScript modules. No Node.js, no bundlers, no frameworks. Runs completely client-side.

---

## ✨ Features at a Glance

| Feature | Description |
|---------|-------------|
| 📇 **Flashcard Engine** | Rich cards with gender-themed glows (🔵 der / 🔴 die / 🟢 das), accordion reveal, example sentences, antonyms, pronunciation hints, Twemoji illustrations, and kinetic spring physics |
| 🧠 **FSRS-5 SRS** | Free Spaced Repetition Scheduler with per-card stability, difficulty, and retrievability tracking — 20-30% more efficient than SM-2. Unlimited offline scale via IndexedDB |
| 🔬 **Immersions-Labor** | Zero-dependency offline NLP engine. Paste German text to automatically lemmatize roots, predict noun genders, and match against your known FSRS vocabulary |
| 🎯 **Quiz Arena** | Multiple-choice (bidirectional DE↔EN) + spelling test with virtual umlaut keyboard (ä, ö, ü, ß) and article quick-keys |
| 🗣️ **Audio Trainer** | Continuous dual-voice TTS: German word → English translation → German example sentence with speed control |
| 🎙️ **Phonetik-Spiegel** | Speech recognition pronunciation coach with dual spectrograms and Levenshtein accuracy scoring |
| 🏰 **Deutsch-Abenteuer** | Conversational RPG with branching dialogues, sentence builder, grammar tips, and XP progression |
| 🧩 **Grammatik-Weberei** | Drag-and-drop sentence assembly with linguistically color-coded word chips and syntax verification |
| 📝 **Spickzettel** | Searchable grammar cheatcode reference (noun suffixes, verb prefixes, adjective patterns) |
| 📊 **Statistics Dashboard** | SVG progress rings, FSRS retention analytics, 7-day review forecast, parts-of-speech breakdown, streak tracking, and 12 unlockable achievements |
| 🎨 **5 Premium Themes** | Slate Mesh (default), Berlin Cyberpunk, Schwarzwald Dark, Oktoberfest Gold, Weimar Classic (light) |
| ⌨️ **Keyboard-First** | 10+ hotkeys for mouse-free navigation (Space, Arrows, L, S, V, F, H, A, B, Esc) |
| 📱 **Responsive** | Full mobile support with collapsible sidebar, touch-friendly targets, and compound word hyphenation |

---

## 📦 Vocabulary Coverage

| Level | Words | Description | Verification Status |
|-------|-------|-------------|---------------------|
| **A1** | 640 | Beginner (Anfänger) | ✅ 100% NotebookLM Verified & Active |
| **A2** | 1,142 | Elementary (Grundlagen) | ⏳ Disabled (NotebookLM Verification Pending) |
| **B1** | 2,139 | Intermediate (Fortgeschritten) | ⏳ Disabled (NotebookLM Verification Pending) |
| **Total** | **3,921** | Full Goethe-Institut A1–B1 curriculum | ⚙️ Level A1 Active (A2/B1 Coming Soon) |

Each word includes: German headword, English translation, gender, plural form, word class, theme category, example sentence (DE + EN), pronunciation hint, antonym, verb conjugation (for verbs), adjective forms (for adjectives), and optional premium visual aid.

> [!NOTE]
> All linguistic data is verified against the official Goethe-Institut wordlists via [NotebookLM](https://notebooklm.google.com/) as our exclusive translation and verification engine (using the curated *Goethe-Zertifikat Wortliste* workspace).
> 
> In **V1.0.0**, all illustration assets are deactivated to eliminate any network overhead and ensure a pristine 404-free E2E browser footprint. Curated SOTA 3D Glossy AI Illustrations will launch in **V1.0.1** (with in-app glassmorphic alerts guiding users).

---

## 🚀 Quick Start & Deployment

### Option 1: Instant Access (Recommended)
You do not need to install or compile anything! Run the application directly in your web browser:
👉 **[Launch DeutschSphere Web App](https://khanna-aman.github.io/DeutschSphere/)**

---

### Option 2: One-Click Self-Hosting (GitHub Pages)
You can deploy your own private copy of DeutschSphere for free in under 60 seconds:
1. **Fork** this repository to your GitHub account.
2. Go to your fork's **Settings** tab.
3. Click **Pages** in the left sidebar.
4. Under *Build and deployment*, set the Source to **Deploy from a branch**.
5. Select the **`main`** branch and the **`/ (root)`** folder, then click **Save**.
6. Refresh the page after 30 seconds to get your public live URL!

---

### Option 3: Local Developer Server (Python)
Because the app uses ES6 JavaScript modules, a local HTTP server is required to satisfy local browser security policies:
```bash
# Start a local HTTP server
python -m http.server 8080

# Open your browser and navigate to:
# http://localhost:8080
```

> **Note**: The app requires a modern web browser with ES6 module support (Chrome 61+, Firefox 60+, Safari 11+, Edge 16+) and IndexedDB for progress storage.

---

## 🏗️ Architecture

```
A1-B1_German/
│
├── index.html              # Core SPA layout
├── index.css               # Global styling, gender glows, CSS Grid accordion, containment
├── app.js                  # Main orchestrator: routing, themes, View Transitions, lifecycle
│
├── js/                     # ES6 modules
│   ├── state.js            # Central state, DOM cache, IndexedDB persistence safety layer
│   ├── idb-keyval.js       # Zero-dependency IndexedDB wrapper for massive payload storage
│   ├── fsrs.js             # FSRS-5 algorithm (pure client-side, zero deps)
│   ├── nlp.js              # Pure-JS Offline NLP Engine (Lemmatization, Gender Prediction)
│   ├── audio.js            # TTS, Web Audio singleton (shared AudioContext)
│   ├── flashcards.js       # Card rendering, SRS, phonetic mirror
│   ├── quiz.js             # Quiz arena (MC + spelling) with XSS-safe rendering
│   ├── adventure.js        # RPG conversational mode
│   ├── weaver.js           # Grammar Weaver sentence builder
│   ├── immersion.js        # NLP Lab view controller
│   ├── stats.js            # Statistics & achievements
│   ├── router.js           # SPA client-side routing, view transitions, and route guards
│   ├── events.js           # Keyboard shortcuts, click handlers, and global event listeners
│   ├── search.js           # Vocabulary search indexing and category filters
│   ├── pomodoro.js         # Pomodoro focus-booster timers, soundscapes, and multipliers
│   └── cheatcodes_db.js    # Grammar reference database + sanitizeGermanEncoding()
│
├── a1/                     # Level A1 (640 words + SVGs + adventure)
├── a2/                     # Level A2 (1,142 words + SVGs + adventure)
├── b1/                     # Level B1 (2,139 words + SVGs + adventure)
│
├── icons/                  # PWA application icons (192px, 512px)
├── sw.js                   # Service Worker (4-strategy offline caching)
├── manifest.json           # PWA manifest with app icons
├── scripts/                # Python automation & verification (32 scripts)
└── docs/                   # Feature backlog & plans
```

### Key Design Decisions

- **Zero dependencies**: Tailwind CSS via CDN, Google Fonts, FontAwesome. No `node_modules`, no bundling.
- **Offline-first**: All data is local JSON. TTS uses the browser's `SpeechSynthesis` API. Sound effects are synthesized via a shared `AudioContext` singleton. No network required after initial page load.
- **Hash-based routing**: 6 views — `#/` (flashcards), `#/quiz`, `#/adventure`, `#/weaver`, `#/cheatcodes`, `#/stats`.
- **Per-level persistence**: Learned cards, SRS state, quiz streaks, and XP are all namespaced by CEFR level. Backed by asynchronous **IndexedDB** to completely bypass mobile 5MB storage limits.
- **Event-driven architecture**: Module communication via `CustomEvent` dispatching (`srs:card-updated`, `srs:achievement`, `deck:filter-request`, `deck:render-active-card`, `audio:stop-trainer`) — eliminates tight coupling between all modules. Zero `window.*External` bridges.
- **Hardened storage**: Automatic background migration from `localStorage` to IndexedDB upon boot. Rapid writes are debounced asynchronously to prevent main-thread UI locking.
- **Kinesthetic Physics**: Eliminated rigid web-app easings. Swipes and animations use purely mathematical rigid-body spring physics via generated `linear()` functions for hyper-premium tactile feedback.

---

## 🎹 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Toggle card detail accordion |
| `→` / `↓` | Next card |
| `←` / `↑` | Previous card |
| `L` | Toggle learned |
| `S` | Shuffle deck |
| `V` | Speak word (TTS) |
| `F` | Fast-Read mode |
| `H` | Hide learned cards |
| `A` | Autoplay TTS |
| `B` | Toggle images |
| `?` | Keyboard shortcut overlay |
| `Esc` | Close sidebar / quit quiz |

---

## 🎨 Themes

| Theme | Description |
|-------|-------------|
| **Slate Mesh** | Default dark theme with indigo/pink mesh gradients |
| **Berlin Cyberpunk** 🌌 | Deep cosmic black with neon cyan and magenta accents |
| **Schwarzwald** 🌲 | Dark forest green with warm amber highlights |
| **Oktoberfest Gold** 🍺 | Warm chocolate surfaces with amber-gold accents |
| **Weimar Classic** 🏛️ | Light ivory mode with crisp dark-indigo borders |

---

## 🛠️ Scripts

The `scripts/` directory contains Python utilities for data generation and verification:

| Script | Purpose |
|--------|---------|
| `verify_via_notebooklm.py` | Batch-verify wordlists against NotebookLM notebook |
| `verify_curriculum_sync.py` | Cross-reference data against official Goethe PDFs |
| `generate_assets.py` | Generate Twemoji SVG illustrations |
| `e2e_comprehensive_tests.py` | Playwright-based E2E test suite |
| `consolidate_database_categories.py` | Normalize category names across levels |

---

## 📄 Data Verification

All 3,921 vocabulary entries are verified against the official Goethe-Institut A1, A2, and B1 wordlist PDFs using a strict pipeline:

1. **NotebookLM MCP**: Translations, genders, plurals, and example sentences are cross-referenced against the uploaded Goethe-Institut source documents via the `notebooklm` MCP server.
2. **Curriculum Sync**: The `verify_curriculum_sync.py` script parses the original PDFs and checks for parity.
3. **Automated Audits**: The `verify_via_notebooklm.py` script batch-queries NotebookLM to audit every entry for accuracy.

---

## 📝 License

This project is open-source and created for the language learning community.

---

## 🤝 Contributing

Contributions from the language learning community are welcome! Feel free to open pull requests, report issues, or suggest vocabulary additions. See [VISION.md](VISION.md) for the project roadmap and milestones.
