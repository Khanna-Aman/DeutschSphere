# 🔮 VISION.md — Project Status & Roadmap

> Last updated: June 2026

This document provides a highly objective, factually accurate assessment of what has been built, what has been systematically purged for scope control, and the clinical data-science path planned for the future.

---

## 📍 Current Status: Pure Cognitive Vocabulary Utility (V6.0)

DeutschSphere is a high-performance, distraction-free Single Page Application (SPA) optimized for German vocabulary acquisition. The application operates entirely client-side across **4 core semantic views** governed by hash routing (`#/`, `#/quiz`, `#/stats`, `#/immersion`)[cite: 1]. 

We have successfully executed the **Scope Realignment & De-gamification Pass**, entirely deprecating auxiliary grammar-parsing mock modules and stripping out secondary gamification mechanics (XP tracking, arcade audio chimes, particle animations, and flashing badges)[cite: 1]. The codebase is now a locked, ultra-premium implementation of the **FSRS-5 spaced repetition model**[cite: 1] linked directly to 3,921 ground-truth vocabulary entries[cite: 1] verified against the **`A1-B1verification`** workspace[cite: 1].

---

## 🛠️ Core Architectural Pillars & Feature Mapping

### 1. Data Foundation & The Zero-Inference Clause
* **3,921 Ground-Truth Entries:** Structured across three explicit CEFR tiers: A1 (640 words)[cite: 1], A2 (1,142 words)[cite: 1], and B1 (2,139 words)[cite: 1].
* **Strict NotebookLM Alignment:** All lexicon data matrices (gender, plural, word class, explicit example sentences) are verified directly against the **`A1-B1verification`** Goethe-Institut wordlists[cite: 1]. 
* **Zero-Inference Enforcement:** If conjugation variations, structural tenses, or contextual examples do not explicitly exist inside our verified data layouts, their schema properties are strictly assigned as `null`[cite: 1]. Speculative LLM generation or heuristic inference from pre-trained weights is strictly forbidden[cite: 1].
* **Premium Asset Staging:** Populated with clean, transparent 3D WebP graphical assets generated offline using high-fidelity modeling[cite: 1]. All graphical assets undergo manual checking using a programmatic WebP validation pass to guarantee zero artifact or text bleeding[cite: 1].

### 2. Spaced Repetition Engine (`#/` Flashcard View)
* **Pure FSRS-5 Implementation:** Powered by a zero-dependency, pure-JS module (`js/fsrs.js`) utilizing 19 structural stability parameters to model cognitive decay via memory stability ($S$), difficulty ($D$), and real-time retrievability ($R$)[cite: 1].
* **Deterministic Lighting Aesthetics:** Glassmorphic layout panels adapt dynamically using CSS glow profiles bounded exclusively by German noun genders[cite: 1]:
  * 🔵 `der` ➔ `.card-glow-der`[cite: 1]
  * 🔴 `die` ➔ `.card-glow-die`[cite: 1]
  * 🟢 `das` ➔ `.card-glow-das`[cite: 1]
  * 🟣 Neutral / Other ➔ Violet Card Glow[cite: 1]
* **Dual Input Control:** Navigated seamlessly via fluid mobile touch swiping (left/right for paging) or high-efficiency desktop hotkeys (`1-4` for FSRS quality grading, `Spacebar` to flip, `Enter` to submit)[cite: 1].
* **Unified Control Matrix:** Consolidated all deck sorting, filtration, and presentation configurations into a single high-contrast "Einstellungen" drop-panel[cite: 1].

### 3. Quiz Arena (`#/quiz`)
* **Vokabel-Test (Multiple Choice):** Generates bidirectional German ↔ English testing using deterministic contextual distractors pulled via reservoir sampling to eliminate compilation lag[cite: 1].
* **Schreib-Arena (Spelling/Active Recall):** Free-text structural string comparison featuring an integrated virtual umlaut tray (`ä`, `ö`, `ü`, `ß`) and direct article quick-inputs[cite: 1].
* **Clean Performance Feedback:** Replaced all arcade flashes with objective, layout-stable CSS micro-interactions: a muted green structural pulse for validated entries and a high-contrast red horizontal shake for failed matches[cite: 1].

### 4. Audio, Phonetics & NLP (`#/immersion`)
* **Hybrid Web Speech TTS:** Local offline-first speech synthesis supporting velocity adjustable pacing parameters controlled via user preferences[cite: 1].
* **Phonetik-Spiegel (Pronunciation Spiegel):** Captures microphone streams, maps character-level distance matrices, and applies a client-side **Kölner Phonetik** algorithm to evaluate matches strictly by sound architecture rather than flat spelling variants[cite: 1].
* **Immersions-Labor:** A lightweight (<10KB) client-side Natural Language Processing engine incorporating custom stop-word filtering, suffix-stripping lemmatization, and interactive click-to-explore triggers that analyze text blocks against active IndexedDB user tracking states[cite: 1].

---

## 🛑 Scope Containment & Deprecation Log

To maintain absolute system scalability, eliminate memory overhead, and enforce extreme technical focus, the following historical modules have been completely deprecated and stripped from the repository[cite: 1]:

* **`weaver.js` (Grammatik-Weberei):** **REMOVED**. Syntactic drag-and-drop chip components and algorithmic grammar slot validation are entirely out of scope[cite: 1]. The application does not parse structural syntax trees.
* **`adventure.js` (Deutsch-Abenteuer):** **REMOVED**. Branching dialogue trees, RPG dialogue states, and fictional text nodes have been excised to keep the data footprint locked strictly to functional lexicon mapping[cite: 1].
* **Gamification Frameworks:** **PURGED**. All instances of arbitrary dopamine metrics—including Experience Points (XP), leveling progress boundaries, graphic milestone achievement badges, decorative toast animations, and acoustic celebratory chimes—have been deleted[cite: 1]. User retention relies solely on the empirical tracking of future memory decay matrices and stability intervals[cite: 1].

---

## ⚠️ Known Production Anomalies & Technical Gaps

| Target Module | Functional Defect / Gap | Operational Severity | Mitigation Status |
| :--- | :--- | :--- | :--- |
| **HTML Shell Structure** | Root title block remains hardcoded to a legacy string value before runtime evaluation overrides it. | Low (Cosmetic) | Scheduled for synchronization in next core HTML cleanup pass. |
| **B1 Level Verification** | Script verification sweeps are locked; ultimate recursive verification sweep is pending rate resets. | Medium (Data Integrity) | Queued to run via sequential unbuffered loops once daily API quotas reload[cite: 1]. |
| **Interface Layout Defaults** | Dropdown level selections fallback to localized standard configurations before profile state hydration. | Low (UX Layout) | Pre-paint intercept handles structural validation prior to rendering tree initialization[cite: 1]. |

---

## 🚀 Future Roadmap

### 🔜 Short-Term Engineering Tasks (Next Sprint)
* **Complete Asset Populating (B1 Dataset):** Complete the deployment of the transparent WebP assets for the final 2,139 words of the B1 tier using the established multi-step verification protocol (ensuring zero text artifacts)[cite: 1].
* **Asynchronous IndexedDB Cache Profiling:** Further optimize the asynchronous profile commits inside `js/state.js` to ensure zero main-thread blockages during massive multi-word FSRS state updates[cite: 1].
* **WAI-ARIA Accessibility Validation:** Complete full structural audit of remaining interactive nodes, ensuring absolute WCAG 2.2 AA compliance across all touchpoints for screen readers and keyboard-only layouts[cite: 1].

### 🔮 Medium-Term Architectural Evolution
* **Premium GCP Voice Isolation & Chirp Integration:** 
  * Replace client-side browser synthesis with high-fidelity, native German pre-rendered audio matrices leveraging Google Cloud Text-to-Speech (Journey and Studio neural voice layers) managed cleanly under the monthly character free-tier[cite: 1].
  * Refine the *Phonetik-Spiegel* pronunciation analysis loop by linking verification paths to Google's Universal Speech Model (**Chirp v2**) via Speech-to-Text v2 API arrays for highly precise syllable-level phonetic coaching[cite: 1].
* **Client-Side Document Compilation:** Build an isolated utility to export current FSRS problem states (e.g., words with an active difficulty rating $D > 7$) into high-contrast, printable double-sided grid arrays using native browser print styles for offline reference[cite: 1].

---

## 📊 Technical Metrics Ledger

* **Lexicon Matrix Capacity:** 3,921 validated entries across three tiers[cite: 1].
* **Dependency Footprint:** 0 production Node modules (Tailwind utility engine, Google Fonts, FontAwesome icons served cleanly via static CDNs)[cite: 1].
* **Active Architecture Weight:** ~508KB cleanly modularized across 1 root orchestrator, 1 service worker shell, and 17 highly optimized feature modules[cite: 1].
* **State Engine:** Pure asynchronous IndexedDB persistence layer mediated by an internal `idb-keyval` wrapper[cite: 1].