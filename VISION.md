# 🔮 VISION.md — Project Roadmap & Technical Vision

This document details the active technical roadmap, scope boundaries, and development milestones for **DeutschSphere**.

---

## 🎯 The Core Mandate: Pure Cognitive Mastery

DeutschSphere is designed to maximize vocabulary acquisition through distraction-free, clinical spaced repetition. The application focuses on high-signal cognitive retention of **3,231 validated German vocabulary words** via mathematical memory modeling (an FSRS-inspired scheduler based on the FSRS-5 model — see `js/fsrs.js` for its documented simplifications).

### 🛑 Strict Scope Enforcements
* **Zero Gamification Bloat**: The interface excludes XP systems, progress metrics, artificial badges, and decorative animations. Cognitive engagement is driven purely by layout-stable feedback and objective retrievability projections.
* **No Structural Grammar Engines**: The application does not parse natural sentence syntax or conjugation trees. **The Zero-Inference Clause** governs *factual linguistic data only* — genders, plurals, and conjugations are taken from the official Goethe wordlists and left `null` where not attested, never guessed. Example sentences are a separate category: they are **original content authored for this project** (to avoid reproducing copyrighted source examples) and are gated for originality (0 verbatim vs. the source PDFs) and grammar (offline LanguageTool), not extracted from a source layer.
* **Decoupled Client-First Core**: No runtime framework, bundler, or external database — the deployed SPA is flat standard HTML, precompiled CSS, and modular JS with zero runtime npm dependencies. The build-time tools (Tailwind CLI, esbuild for `index.css`, `fonttools` for icon subsetting) run on demand to regenerate committed output; the repo and runtime stay build-free.


---

## 🛠️ Feature Matrix Status

| Component | Status | Description |
| :--- | :--- | :--- |
| **FSRS-inspired Spaced Repetition** | **Active** | Clinical scheduling with an FSRS-inspired stability/difficulty model (based on FSRS-5, with documented simplifications; see `js/fsrs.js`) to project cognitive decay. |
| **Phonetik-Spiegel** | **Active** | Web Speech `SpeechRecognition` (de-DE) transcription scored against the target by Levenshtein distance, with a live waveform vs. a native-synthesis reference and static mouth-position guides. |
| **Active Recall Quiz Arena** | **Active** | Bidirectional MC reservoir-sampled tests and text spelling with virtual keyboards. |
| **Immersions-Labor** | **Active** | Custom local NLP for copy-pasted text block lemmatization and instant flashcard generation. |
| **Sidebar Category Words** | **Active** | Collapsible sidebar panel for instant virtual-scroll quick-jumping across category words. |
| **Zero-Touch PWA Updates** | **Active** | Automated Service Worker update propagation with client `controllerchange` auto-reload. |
| **100% Offline PWA & Installation** | **Active** | In-app download button & native manifest for standalone home-screen installation with zero server dependency. |
| **Sync & Backup** | **Active** | Local IndexedDB profile backup/restore via a copy/paste Base64 Sync Key (a portable encoding, not encryption) or a raw JSON file. |
| **Developer Feedback Form** | **Active** | Zero-cost serverless FormSubmit integration sending user feedback direct to developer email. |
| **Adaptive Layout & Safe-Area** | **Active** | Responsive single-column card view on all screens with Android navigation bar safe-area insets. |
| **Card View Preferences** | **Active** | Persistent settings drawer toggles for Fast Read, Autoplay, Illustrations, and Example Sentences. |
| **Visual Assets** | **Active** | High-fidelity WebP visual aids (<10KB) completed for A1 (637/721, 88%) and A2 (580/582, ~100%). B1 in progress (371/1,925, 19%). |

---

## 🚀 Active Roadmap

### ✅ Pre-Launch Hardening (done)
Honesty/safety batch shipped before going public:
* **Privacy disclosure** — documented the optional cloud `SpeechRecognition` microphone data flow in `PRIVACY.md`.
* **Real CI copyright gate** — `check_example_originality.py` gained a committed, non-copyrighted fingerprint (salted hashes of the official 6-word shingles) so `validate-data.yml` blocks any verbatim Goethe sentence **in CI**, without redistributing the source PDFs. This also closed a per-level blind spot that had let **5 cross-level verbatim example sentences** slip through; those were re-authored to original, grammar-checked sentences.
* **XSS hardening** — custom/imported card fields are now HTML-escaped at every render sink.
* **UI fix** — restored the rating-key badge offsets missing from the purged `tailwind.css`.

### ✅ B1 Vocabulary Backfill + A1/A2 Gap-Fill (done, 2026-07-06)
B1 was completed to **~99% noun coverage** of the official (cumulative) Goethe B1 *Wortliste* (1,604/1,621 — real-headword-complete; the remainder are extraction fragments already present in full form). **Phases 1–5** (+568 entries, 2,660→3,228): the entire alphabetical section (nouns, verbs, adjectives), the thematic groups the list doesn't repeat (months, weekdays, seasons, times of day, animals, compass directions, loanwords, political terms), 58 feminine `-in` job-title doublets, 19 Austrian/Swiss regional variants (Brötli, Bub, Knödel, Marille, Perron, Stiege…) and abbreviations (PC, TV, WG, Kfz, Modul), and a final institutional tail — each source-grounded (gender/plural `null` where unattested) with an original LanguageTool-gated example, cross-checked via the OpusAudit NotebookLM notebook. A parallel signature-based audit of **A1 and A2 against their own official lists** (not just B1) found and filled 3 genuinely-missing basics: `das Jahr` (A1), `das Handtuch` and `das Schlafzimmer` (A2). **Total: 3,231 entries** (A1 722 / A2 584 / B1 1,925).

### ✅ Performance: font/icon subsetting + minified CSS (done, v1.1.2)
* **Variable fonts, latin-only**: Inter and Outfit switched from 5 static weights x 2 Unicode subsets (10 files/family) to **one self-hosted variable-weight woff2 per family** (`fvar` wght axis 100–900), keeping only the `latin` subset — German umlauts/ß and all UI text fall inside `U+0000-00FF`/`U+2000-206F`; `latin-ext` (Central-European/Vietnamese/Baltic) is never rendered by this app. Font payload: **~1.19MB → ~80KB** (Inter+Outfit combined).
* **Font Awesome, glyph-subset to used icons only**: the two icon styles actually used (solid, brands) are subset via `fonttools`/`pyftsubset` to just the ~90 glyph codepoints referenced in `index.html`/`js/*.js`, down from the full ~13,000-glyph webfonts. `fa-solid-900`: 150KB → 9KB. `fa-brands-400` (only `fa-android`/`fa-apple` used): 108KB → 0.8KB. The unused `fa-regular-400` (24.9KB) and `fa-v4compatibility` (4.6KB) webfonts were dropped entirely — nothing in this codebase uses the regular style or v4-compat icon names. Repeatable via `npm run build:icons` (`scripts/subset_fontawesome.py`), which **fails loudly** on any `fa-*` class that doesn't exist in Font Awesome Free — it caught two real pre-existing bugs this way (`fa-wifi-slash`, `fa-sparkles` aren't real FA6 Free icons and were rendering as invisible glyphs in production; fixed to `fa-plug-circle-xmark` and `fa-wand-magic-sparkles`).
* **Minified hand-authored CSS**: `index.css` is now a generated, esbuild-minified build artifact (~61KB → ~41KB) from a new hand-edited source, `index.src.css` — the same "readable source, minified committed output" pattern `tailwind.css`/`tailwind.input.css` already used. `npm run build:css:index` regenerates it.
* **Font preload hints**: both variable fonts are preloaded in `<head>` (`rel=preload as=font`) since body/heading text renders above the fold on first paint.
* **Scope note**: `js/*.js` remains hand-authored, unminified source by design (see "Decoupled Client-First Core" above) — minifying it would require a build-step deploy pipeline (e.g. GitHub Actions building to a separate Pages artifact instead of deploying `main`'s root directly), which is a bigger infrastructure change than asset-level optimization and is intentionally left as a separate, explicitly-authorized decision rather than bundled into this pass.

### 🔜 Short-Term Milestones (v1.1.x — post-launch rollout)
* **B1 Asset Rollout**: Complete the final integration of audited 3D glassmorphic WebP assets for the remaining B1 entries (371/1,925 done, 1,554 outstanding) following strict anti-bleeding checks.
* **IndexedDB Thread Tuning**: Debounce and stream asynchronous profile writes in `js/state.js` to eliminate micro-stutters during massive bulk updates (e.g. after a large quiz session).
* **WCAG 2.2 AA Accessibility**: ✅ Automated pass complete — Lighthouse/axe **accessibility 100** (best-practices 100, SEO 100), enforced by the `quality.yml` CI gate. Remaining: the full *manual* AA sign-off (keyboard-only and screen-reader walkthrough of every view transition and accordion) that automation cannot cover.

### 🔮 Medium-Term Evolutions (v1.2.0)
* **Customizable FSRS-5 Parameters & Timing Weights**: Advanced power-user configuration console under Settings allowing users to customize FSRS-5 matrix weights, target request retention rates (e.g., 85%–95%), custom interval caps, and timing multipliers.
* **Native-Speaker Audio**: Replace browser speech synthesis with **free, redistributable, offline** audio — real native recordings from Lingua Libre (CC-BY-SA) where available, filled by Piper TTS + the CC0 Thorsten voice — bundled and Service-Worker-precached (no runtime cloud call, preserving the offline pledge).
* **On-Device Pronunciation Analytics**: Move pronunciation scoring fully on-device with an offline recognizer (Vosk, Apache-2.0, or whisper.cpp) — removing the cloud `SpeechRecognition` dependency and keeping the privacy pledge intact.
* **Double-Sided Printable Flashcard Sheets**: Render a clean printable table of highly critical vocabulary ($D > 7$ under FSRS-5) with native CSS printing rules for physical spaced repetition review.

---

## 📊 Technical Metrics Ledger
* **Active Vocabulary Capacity**: 3,231 entries across CEFR A1 (722), A2 (584), and B1 (1,925). B1 noun coverage vs the official (cumulative) Goethe B1 *Wortliste* is now **~99%** (1,604/1,621) — Phases 1–5 completed the alphabetical section, thematic groups, feminine `-in` doublets, regional (A/CH) variants, abbreviations, and a final institutional tail. The last ~1% are extraction fragments already present in full form. A1/A2 were separately audited against their own official lists (not just B1's), closing 3 real gaps.
* **Production Dependencies**: 0 runtime npm modules. Tailwind is precompiled to a static, tree-shaken stylesheet (no runtime CDN); `index.css` is likewise precompiled (esbuild-minified from `index.src.css`). The Inter/Outfit web fonts (self-hosted variable fonts, latin-only) and Font Awesome icons (self-hosted, glyph-subset to used icons) are served under `./fonts` — no third-party CDN calls, zero external requests on load, and ~90KB combined font payload (down from ~1.45MB pre-v1.1.2).
* **Codebase Weight**: ~450KB modular ES6 files, 1 HTML shell, and 1 global stylesheet.
* **State Engine**: Client-side IndexedDB persistence managed via an asynchronous debounced `idb-keyval` pipeline.