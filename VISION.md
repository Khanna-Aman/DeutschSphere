# 🔮 VISION.md — Project Roadmap & Technical Vision

This document details the active technical roadmap, scope boundaries, and development milestones for **DeutschSphere**.

---

## 🎯 The Core Mandate: Pure Cognitive Mastery

DeutschSphere is designed to maximize vocabulary acquisition through distraction-free, clinical spaced repetition. The application focuses on high-signal cognitive retention of **2,627 validated German vocabulary words** via mathematical memory modeling (FSRS-5).

### 🛑 Strict Scope Enforcements
* **Zero Gamification Bloat**: The interface excludes XP systems, progress metrics, artificial badges, and decorative animations. Cognitive engagement is driven purely by layout-stable feedback and objective retrievability projections.
* **No Structural Grammar Engines**: The application does not parse natural sentence syntax or conjugation trees. If conjugation tables, plurals, or contextual examples are not present in our ground-truth source layers, they are not inferred or generated (*The Zero-Inference Clause*).
* **Decoupled Client-First Core**: No runtime framework, bundler, or external database — the deployed SPA is flat standard HTML, precompiled CSS, and modular JS with zero runtime npm dependencies. The single build-time tool is the Tailwind CLI, run on demand to regenerate the committed `tailwind.css`; the repo and runtime stay build-free.


---

## 🛠️ Feature Matrix Status

| Component | Status | Description |
| :--- | :--- | :--- |
| **FSRS-5 Spaced Repetition** | **Active** | Clinical scheduling using 19 stability parameters to model cognitive decay. |
| **Phonetik-Spiegel** | **Active** | Speech recording and audio waveform analysis against native models using Kölner Phonetik. |
| **Active Recall Quiz Arena** | **Active** | Bidirectional MC reservoir-sampled tests and text spelling with virtual keyboards. |
| **Immersions-Labor** | **Active** | Custom local NLP for copy-pasted text block lemmatization and instant flashcard generation. |
| **Sidebar Category Words** | **Active** | Collapsible sidebar panel for instant virtual-scroll quick-jumping across category words. |
| **Zero-Touch PWA Updates** | **Active** | Automated Service Worker update propagation with client `controllerchange` auto-reload. |
| **100% Offline PWA & Installation** | **Active** | In-app download button & native manifest for standalone home-screen installation with zero server dependency. |
| **Sync & Backup Sync** | **Active** | Base64-compressed local IndexedDB profile copy/paste backup and restore. |
| **Developer Feedback Form** | **Active** | Zero-cost serverless FormSubmit integration sending user feedback direct to developer email. |
| **Adaptive Layout & Safe-Area** | **Active** | Responsive single-column card view on all screens with Android navigation bar safe-area insets. |
| **Card View Preferences** | **Active** | Persistent settings drawer toggles for Fast Read, Autoplay, Illustrations, and Example Sentences. |
| **Visual Assets** | **Active** | High-fidelity WebP visual aids (<10KB) completed for A1 (637/684, 93%) and A2 (580/580, 100%). B1 in progress (371/1,363, 27%). |

---

## 🚀 Active Roadmap

### 🔜 Short-Term Milestones (v1.1.x)
* **B1 Asset Rollout**: Complete the final integration of audited 3D glassmorphic WebP assets for the remaining B1 entries (371/1,363 done, 992 outstanding) following strict anti-bleeding checks.
* **IndexedDB Thread Tuning**: Debounce and stream asynchronous profile writes in `js/state.js` to eliminate micro-stutters during massive bulk updates (e.g. after a large quiz session).
* **WCAG 2.2 AA Accessibility**: Audit and refine WAI-ARIA roles, ensuring keyboard-only and screen-reader accessibility across all view transitions and accordions.

### 🔮 Medium-Term Evolutions (v1.2.0)
* **Customizable FSRS-5 Parameters & Timing Weights**: Advanced power-user configuration console under Settings allowing users to customize FSRS-5 matrix weights, target request retention rates (e.g., 85%–95%), custom interval caps, and timing multipliers.
* **High-Fidelity TTS Voices**: Transition from browser-specific speech synthesis to pre-rendered neural voice grids using Google Cloud Text-to-Speech (Studio voice layers) managed within free character tiers.
* **Advanced Pronunciation Analytics**: Refine speech analysis by mapping local microphone recordings against Google's USM (Universal Speech Model - Chirp v2) for syllable-level coaching.
* **Double-Sided Printable Flashcard Sheets**: Render a clean printable table of highly critical vocabulary ($D > 7$ under FSRS-5) with native CSS printing rules for physical spaced repetition review.

---

## 📊 Technical Metrics Ledger
* **Active Vocabulary Capacity**: 2,627 entries across CEFR A1 (684), A2 (580), and B1 (1,363).
* **Production Dependencies**: 0 runtime npm modules. Tailwind is precompiled to a static, tree-shaken stylesheet (no runtime CDN); FontAwesome and Google Fonts are served via static CDN (with Subresource Integrity where the endpoint supports it).
* **Codebase Weight**: ~450KB modular ES6 files, 1 HTML shell, and 1 global stylesheet.
* **State Engine**: Client-side IndexedDB persistence managed via an asynchronous debounced `idb-keyval` pipeline.