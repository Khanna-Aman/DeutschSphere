# 🔮 VISION.md — Project Roadmap & Technical Vision

This document details the active technical roadmap, scope boundaries, and development milestones for **DeutschSphere**.

---

## 🎯 The Core Mandate: Pure Cognitive Mastery

DeutschSphere is designed to maximize vocabulary acquisition through distraction-free, clinical spaced repetition. The application focuses on high-signal cognitive retention of **3,921 validated German vocabulary words** via mathematical memory modeling (FSRS-5).

### 🛑 Strict Scope Enforcements
* **Zero Gamification Bloat**: The interface excludes XP systems, progress metrics, artificial badges, and decorative animations. Cognitive engagement is driven purely by layout-stable feedback and objective retrievability projections.
* **No Structural Grammar Engines**: The application does not parse natural sentence syntax or conjugation trees. If conjugation tables, plurals, or contextual examples are not present in our ground-truth source layers, they are not inferred or generated (*The Zero-Inference Clause*).
* **Decoupled Client-First Core**: No Node modules, bundling pipelines, or external databases. The SPA remains flat standard HTML, CSS, and modular JS.


---

## 🛠️ Feature Matrix Status

| Component | Status | Description |
| :--- | :--- | :--- |
| **FSRS-5 Spaced Repetition** | **Active** | Clinical scheduling using 19 stability parameters to model cognitive decay. |
| **Phonetik-Spiegel** | **Active** | Speech recording and audio waveform analysis against native models using Kölner Phonetik. |
| **Active Recall Quiz Arena** | **Active** | Bidirectional MC reservoir-sampled tests and text spelling with virtual keyboards. |
| **Immersions-Labor** | **Active** | Custom local NLP for copy-pasted text block lemmatization and instant flashcard generation. |
| **Sync & Backup Sync** | **Active** | Base64-encrypted local IndexedDB profile copy/paste backup and restore. |
| **Visual Assets** | **Active** | High-fidelity WebP visual aids (<10KB) completed for A1 (640/640) and A2 (1,142/1,142) entries. |

---

## 🚀 Active Roadmap

### 🔜 Short-Term Milestones (v1.1.x)
* **B1 Asset Rollout**: Complete the final integration of audited 3D glassmorphic WebP assets for the remaining B1 (2,139 words) vocabulary entries following strict anti-bleeding checks.
* **IndexedDB Thread Tuning**: Debounce and stream asynchronous profile writes in `js/state.js` to eliminate micro-stutters during massive bulk updates (e.g. after a large quiz session).
* **WCAG 2.2 AA Accessibility**: Audit and refine WAI-ARIA roles, ensuring keyboard-only and screen-reader accessibility across all view transitions and accordions.

### 🔮 Medium-Term Evolutions (v1.2.0)
* **High-Fidelity TTS Voices**: Transition from browser-specific speech synthesis to pre-rendered neural voice grids using Google Cloud Text-to-Speech (Studio voice layers) managed within free character tiers.
* **Advanced Pronunciation Analytics**: Refine speech analysis by mapping local microphone recordings against Google's USM (Universal Speech Model - Chirp v2) for syllable-level coaching.
* **Double-Sided Printable Flashcard Sheets**: Render a clean printable table of highly critical vocabulary ($D > 7$ under FSRS-5) with native CSS printing rules for physical spaced repetition review.

---

## 📊 Technical Metrics Ledger
* **Active Vocabulary Capacity**: 3,921 entries across CEFR A1, A2, and B1 levels.
* **Production Dependencies**: 0 npm modules (Tailwind utility engine, FontAwesome, and Google Fonts served via static CDN).
* **Codebase Weight**: ~450KB modular ES6 files, 1 HTML shell, and 1 global stylesheet.
* **State Engine**: Client-side IndexedDB persistence managed via an asynchronous debounced `idb-keyval` pipeline.