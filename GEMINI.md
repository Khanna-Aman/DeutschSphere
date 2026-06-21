# 🤖 GEMINI.md — AI Orchestration & Engineering Directives

Welcome, AI Assistant. You are reading the core structural manifesto for the **A1-B1 German Vocabulary Master Project**. This file governs your behavior, coding guidelines, and response parameters while contributing to this repository.

---

## 🌟 1. Project Philosophy & Core Identity

This project is an open-source, ultra-premium, high-performance language learning utility created for the community. 

* **Zero Dependencies:** Client-side only. Standard web tech (`index.html`, `index.css`, `app.js`). Built with Tailwind CSS via CDN, Google Fonts, and FontAwesome. No Node modules, no bundling pipelines, no framework overhead.
* **Offline-First Reality:** The app must run entirely out of a local directory or flat GitHub Pages architecture. The data layers (`.json` databases per CEFR tier) are fetched dynamically at runtime. Levels (`a1`, `a2`, `b1`) are selected via a sidebar dropdown, while views are navigated via hash routing (`#/`, `#/quiz`, `#/adventure`, `#/weaver`, `#/cheatcodes`, `#/stats`, `#/immersion`).
* **Power Navigation:** Highly optimized for keyboard-driven layouts (Spacebar, Arrows, Hotkeys) aiming for consistent 60–120fps UI state transitions.

---

## 💎 2. Hyper-Premium V6.0 Design & Interaction Pillars

All modifications, additions, and updates inside this repository must conform perfectly to these 10 architectural and pedagogical pillars established in our June 2026 alignment:

1. **Balanced Fusion Philosophy**: A seamless marriage of clinically rigorous FSRS-5 metrics, stability curves, and retention rate charts with toggleable, sensory-rich gamification (XP, achievements, audio chimes).
2. **Hybrid TTS & Local Cache Audio**: Speed-adjustable Web Speech API synthesis for sentences, but high-quality native-speaker audio buffers for core vocabulary pre-cached offline via the Service Worker.
3. **NotebookLM Curated Database Expansion**: Branching scenarios (5 per level) and Grammar Weaver sentences (50 per level) are hand-curated and verified targeting the `a1a2b1` source in NotebookLM, deprecating runtime extraction.
4. **Dual Input & Interaction Excellence**: Support both fluid touch gestures (swipe left/right to rate flashcards) and advanced desktop hotkeys (`1-9` keys for selecting chips, `Enter` to submit) for 100% accessibility.
5. **Ambient Sound & Physics Customization**: Full volume sliders, tone style toggles (synthesized vs. acoustic), and screen-effects preferences (screen shake, particle bursts on/off) under "Einstellungen".
6. **Fully Interactive Immersions-Labor**: Enable clicking words in the NLP-parsed text grid to reveal their CEFR status, active FSRS state, TTS audio, and an instant-add button to insert them as custom cards.
7. **Inter-Module Suffix Contextualization**: An active suffix parser dynamically detects grammatical noun endings (e.g., `-ung`, `-heit`, `-keit`) across all views, rendering inline helper drawers matching suffixes to gender rules.
8. **NotebookLM Verification Status Tracking**: A `verified: true` property in the JSON schema triggers a premium "NotebookLM Verified" badge on the flashcard face. Backup files belong in `/scripts/backups/` (Git-ignored).
9. **Encrypted Sync Key & Local File Backups**: Standard file imports paired with a Base64-encrypted copy/paste Sync Key containing the entire compressed IndexedDB FSRS progress profile.
10. **Phonetik-Spiegel (Kölner Phonetik)**: Pure-JS **Kölner Phonetik** algorithm matches spoken input by phonetic sound. Actionable mouth-positioning guides appear when difficult German phonemes (`ö`, `ü`, `ä`, `ch`, `sch`, `r`) fail.

---

## 🚀 3. Strict AI Execution Rules (Paced Excellence Mode)

When editing files, adding features, or synthesizing datasets inside this project, you must abide by these non-negotiable operational rules:

### 🛑 3.1 Uncompromising Quality, Pacing & Anti-Rate-Limiting Guardrails
* **Deliberate Pacing (Anti-429 Loop):** Take your time. Execute with extreme care and calculated intent. **Avoiding rate limits does not mean lowering quality.** Slower, structured processing is a hallmark of elite systems architecture. Do not spam concurrent tool calls or flood the API window. 
* **Zero Optimization for Financial Cost:** Do not compress your output quality, skip edge cases, or truncate analysis to save tokens. Spend your token real estate on technical perfection and rigorous reasoning.
* **No Code Placeholders:** For logic scripts (`app.js`, `index.html`, `index.css`), never output partial fragments containing lazy comments like `// Rest of code remains unchanged...`. Rewrite those files completely to ensure paste integrity.
* **Surgical Data Partitioning:** For massive data layers (`/a1`, `/a2`, `/b1` JSON sets), do not attempt to print entire multi-thousand-word dictionaries in a single execution turn, as this causes catastrophic Token-Per-Minute (TPM) exhaustion. Instead, partition database updates systematically (e.g., alphabetically by letters A–C, or in clean functional blocks of 40–50 words). Every single partition must be a structurally sound, valid JSON array segment.
* **Tailwind CDN Strictness:** Do not use PostCSS or Tailwind-specific directives like `@apply` in `index.css`. Keep standard CSS separate from utility classes.

### 📝 3.2 Continuous Documentation Sync
* **Zero Documentation Rot:** You must actively maintain and update all repository documentation markdown files (`.md`) across every execution. If any codebase modification alters architecture, state management, workflows, or styling constraints, immediately synchronize those changes across all relevant `.md` files (including this `GEMINI.md` and everything inside `/docs/`). Documentation must remain a live, accurate reflection of the current system state.

### 📚 3.3 Official Curriculum Accuracy
* **Official Curriculum Accuracy:** All linguistic data must pass strict factual verification against the official Goethe-Institut A1-B1 wordlists. Never hallucinate genders, plural suffixes, or arbitrary example sentences that fall outside the active CEFR level's standard grammatical bounds. 

### 🧬 3.4 NotebookLM Translation Isolation (Strict MCP Enforcement)
* **Exclusive Translation Engine:** You are strictly forbidden from utilizing generic LLM internal knowledge, translation APIs, or Python translation libraries (e.g., `deep_translate`, `googletrans`) to process wordlists. You must explicitly route all translation, semantic context, and dictionary verification queries through the active `notebooklm` MCP server.
* **Source Targeting:** You must explicitly search within the source notebook titled exactly **`a1a2b1`**.
* **Audit and Purge Protocol:** Before performing structural script processing or dictionary expansions on the data tiers, you must audit all current local data stores (`/a1`, `/a2`, `/b1`). If an item or translation string is detected that was parsed or generated using generic LLM inference or an unapproved external script rather than NotebookLM source documentation, you must **immediately delete that translation value**, preserve the German headword, and re-fetch the absolute ground-truth string via the `notebooklm` tool call.

### 🎨 3.5 Visual & UI Constraints
* **Gender-Themed Aesthetics:** The flashcard engine operates on deterministic lighting aesthetics based on German noun genders. Never break or pollute the CSS classes defining these glow architectures:
  * 🔵 `der` ➔ Blue Card Glow (`.card-glow-der`)
  * 🔴 `die` ➔ Pink Card Glow (`.card-glow-die`)
  * 🟢 `das` ➔ Green Card Glow (`.card-glow-das`)
  * 🟣 Neutral / Other ➔ Violet Card Glow
* **Layout Preservations:** Accordion transitions use CSS Grid (`grid-template-rows: 0fr→1fr`) with `opacity` for fluid auto-height animation without layout-shift jankiness. Do not revert to the `max-height` magic number pattern.

### 📸 3.5.1 Antigravity 2.0 Browser Automation & Visual Audits
* **Active Browser Actuation:** Use the native Antigravity 2.0 Browser Subagent to launch and interact with the local `index.html` profile. Do not rely solely on static code analysis.
* **UI Stress Testing:** Programmatically cycle through the client-side routing hashes (`#/a1`, `#/a2`, `#/b1`) and trigger the keyboard-driven navigation states to verify consistent 60–120fps fluid transitions.
* **Visual Bug Auditing:** Actively capture automated screenshots of the interface. Analyze them to ensure the deterministic gender glow layers (`.card-glow-der`, `.card-glow-die`, `.card-glow-das`) render perfectly without asset clipping or layout-shift jankiness, applying immediate hotfixes directly to `index.css` and `app.js`.

### 📂 3.6 Workspace Integrity & Reorganization
* **Enforce Directory Structure:** Before executing large script or data generations, ensure the workspace adheres to the strict decoupling of the root SPA from the individual data tiers.
* **Architectural Boundaries:** Always keep the workspace separated along clean lines:
  * Do not merge the Dynamic Application Layer (`index.html`, `index.css`, `app.js` at root) with individual Data Tiers (`/a1`, `/a2`, `/b1`).
  * Automation tools belong in `/scripts/`. Heavy PDF or media references go in `.raw_resources/` and must be actively ignored by Git.

### 🧠 3.7 NLP Engine Zero-Dependency Constraint
* **No Heavy WASM or Server Runtimes:** For all Natural Language Processing (NLP), lemmatization, and gender extraction, you must build **pure client-side JavaScript algorithms**. Do not use heavy WebAssembly Python binaries (like Pyodide/spaCy-WASM) which balloon the page load size.
* **Algorithmic Suffix-Stripping:** Use deterministic regex and Suffix-Stripping (Snowball algorithms) directly in ES6. Accuracy is highly prioritized, but not at the expense of a 20MB payload. The NLP engine must remain under 10KB.

---

## 🛠️ 4. Current Architecture Blueprint

```text
A1-B1_German/
│
├── index.html              # Core SPA layout (1,770 lines)
├── index.css               # Global styling, gender glows, Grid accordion, containment
├── app.js                  # Main orchestrator: routing, themes, events, View Transitions
├── GEMINI.md               # You are here (AI Directives & MCP Orchestration)
├── README.md               # Public-facing project documentation
├── VISION.md               # Current status & future roadmap
├── sw.js                   # Service Worker (offline GitHub Pages caching)
├── cookies.txt             # NotebookLM authentication cookies
├── .gitignore              # Prevents junk artifact check-ins
│
├── js/                     # ES6 modules (modular architecture)
│   ├── state.js            # Central state, DOM cache, persistence safety layer
│   │                       #   Exports: safeJsonParse, safeSetItem, schedulePersist,
│   │                       #   flushAllPending, getSRSInfo, saveSRSState, sortDeckBySRS,
│   │                       #   reviewCardSRS, migrateToFSRS, updateStreak, getStreakInfo,
│   │                       #   startSession, endSession, recordAnswer, generateSyncKey, restoreFromSyncKey
│   │                       #   V6: FSRS-backed SRS, settings states (sfxVolume, audioTone, particleBursts), Base64 Sync Key, daily streak, session analytics
│   │                       #   Emits: 'srs:card-updated', 'srs:achievement', 'streak:updated'
│   ├── idb-keyval.js       # Lightweight IndexedDB key-value utility for high-capacity offline storage
│   ├── fsrs.js             # FSRS-5 algorithm (pure client-side, zero deps)
│   │                       #   Exports: FSRS class, fsrs singleton, State enum, Rating enum
│   │                       #   Core: reviewCard(), getRetrievability(), migrateLeitnerCard()
│   ├── nlp.js              # Pure-JS Offline NLP Engine (Lemmatization, Gender Prediction)
│   ├── audio.js            # TTS, Web Audio singleton, speech recognition
│   │                       #   Exports: getSharedAudioContext, getSharedAudioContextAsync
│   ├── flashcards.js       # Card rendering, SRS, accordion, phonetic mirror
│   ├── quiz.js             # Quiz arena (MC + spelling)
│   ├── adventure.js        # RPG conversational mode
│   ├── weaver.js           # Grammar Weaver (sentence builder)
│   ├── immersion.js        # NLP Lab view controller
│   ├── stats.js            # Statistics dashboard, FSRS analytics, achievements
│   │                       #   V5: Retention rate, weak words, session history, streak display
│   └── cheatcodes_db.js    # Grammar cheatcode database
│
├── a1/                     # Level A1 data (640 words + SVGs + adventure)
├── a2/                     # Level A2 data (1,142 words + SVGs + adventure)
├── b1/                     # Level B1 data (2,139 words + SVGs + adventure)
│
├── twemoji_cache/          # Cached Twemoji vector SVGs
├── scripts/                # Python automation & verification pipelines
└── docs/                   # Backlog & implementation blueprints
```

---

## 🏗️ 5. Active V6.0 Engineering Sprint Log (June 2026)

This section acts as our live implementation and audit ledger for the premium V6.0 upgrades:

- **[x] Volume Scaling**: Integrated dynamic multiplicative volume scaling across all modules (`weaver.js`, `adventure.js`, `audio.js`) based on `state.sfxVolume`.
- **[x] Sensory & Visual Integration**: Bound success/error audio chimes and particle bursts inside `js/quiz.js` and achievement unlocking in `js/stats.js` using `window.triggerParticleBurst`.
- **[x] Keyboard Navigation**: Bind keys `1-9` to select scrambled word-chips, `Enter` to submit, and `Backspace` to undo across both Weaver (`#/weaver`) and Adventure (`#/adventure`) paths in `app.js`.
- **[ ] Suffix Grammar & Interactive Overlays**: Add inline suffix lightbulb drawers on flashcards and click-to-explore overlays inside `js/immersion.js`.
- **[ ] Base64 Sync & Mobile Swipes**: Implement swipe actions on flashcards and IndexedDB Base64 backup serialization inside `js/state.js` and `js/stats.js`.