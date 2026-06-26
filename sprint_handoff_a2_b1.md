# 🚀 Handoff Directive: DeutschSphere Level B1 Sprint Orchestration

Welcome, incoming AI Assistant! You are resuming the engineering sprint for the **DeutschSphere Project** (an ultra-premium, high-performance offline-first CEFR German language learning SPA). 

The **Level A1 curriculum (640 / 640 cards) and Level A2 curriculum (1,142 / 1,142 cards) are 100% complete and fully verified**, featuring pristine, bespoke SOTA 3D Claymation/Art Toy visual assets. **Level B1 is currently generating in the background** with a robust multi-threaded background process actively compiling the WebP image files.

Your objective under `/goal` (autonomous high-intensity mode) is to carry this momentum forward, monitor/wait for B1 completion, and systematically verify the remaining **Level B1 (2,139 cards)**.

---

## 💎 1. The Core Engineering & Design Philosophy
DeutschSphere operates on an uncompromising set of architectural and aesthetic pillars:
* **Zero Dependencies / Framework-Free**: The SPA is built entirely on client-side tech (`index.html`, `index.css`, `app.js` at root), vanilla CSS for layout controls, and Tailwind CSS via CDN for rapid grid structures. It runs locally without local servers or Node packages.
* **Offline-First Storage**: User progress is calculated using client-side **FSRS-5** metrics (located in `js/fsrs.js`) and persisted in IndexedDB via `js/idb-keyval.js` (managed by `js/state.js`).
* **The "Studio Void" Aesthetic**: Every visual asset must adhere to the **Universal 3D Claymation & Lottie Visual Strategy (V6.0)**:
  * Vibrant, ultra-glossy enamel colors with smooth, metallic, or ceramic materials.
  * Translucent, glowing glassmorphic layers that catch ambient lighting.
  * Rendered against a **pure black (#000000) studio void** to make the colors pop.
  * **Strictly Wordless and Numberless**: Absolutely no text, letters, or numbers are allowed on the cards. Visual representation of verbs, prepositions, and nouns must be purely metaphorical and intuitive.
  * **Chroma-Key Alpha Transparency**: The generation pipeline runs PIL-based post-processing to crop borders, scale the model output, and mask background pixels to guarantee smooth transparent edges for web overlays.

---

## 🛠️ 2. The Strict Step-by-Step Asset Generation Pipeline
To prevent rate-limits, maintain token-quota resilience, and enforce pristine aesthetic quality, all generation must be executed in **strict batches of 5 cards** according to the following cycle:

### 🔄 The Five-Step Batch Cycle
1. **Systematic Partition Selection**: Identify the next five cards in the level's checklist from `task.md`.
2. **Execute Generation Script**: Run the automated generation pipeline:
   ```bash
   python -u scripts/generate_assets.py --level <a2/b1> --start <card_start_id> --end <card_end_id>
   ```
   *Note: Using `-u` (unbuffered output) is mandatory to ensure real-time log updates.*
3. **Manual Visual Auditing**: 
   - Visual assets must be programmatically copied/written to the Gemini workspace brain/artifacts directory (`C:\Users\aman-\.gemini\antigravity\brain\<conversation-id>\`).
   - Use the native `view_file` tool to inspect each image directly.
   - Verify that there are zero alpha border cutouts, zero text artifacts, zero background leaks, and that the visual metaphor is highly intuitive and beautiful.
4. **Document Walkthrough Metrics**: Update `walkthrough_<level>.md` in the brain/artifacts directory. Document each card with its:
   - Card ID
   - Headword
   - English translation
   - Visual metaphor description
   - Audit/review rating (1-10) and notes
5. **Dual Atomic Commits**:
   - **Commit 1 (Assets & Core Code)**: Stage and commit the web assets, updated JSON database files, and script metaphors.
     - *Format*: `feat(assets): generate and audit <level> cards <start>-<end>`
   - **Commit 2 (Checklist)**: Update the level progress percentage and mark off the completed batch in `task.md`. Stage and commit separately.
     - *Format*: `docs(sprint): update task.md for Batch <number>`

*CRITICAL constraint: Never bundle the asset modifications and the checklist progress updates into a single massive commit. Keep them strictly separated.*

---

## 📦 3. Script Inventory & Diagnostic Commands
Before generating any batch or editing any logic, leverage these built-in python pipelines to verify database integrity:

| Script Name | Purpose | Usage Command |
| :--- | :--- | :--- |
| `run_unit_tests.py` | Performs headless E2E Playwright verification on all JS modules. | `python -u scripts/run_unit_tests.py` |
| `iterative_audit.py` | Anti-caching iterative curriculum verification suite. | `python -u scripts/iterative_audit.py` |
| `verify_assets.py` | Validates viewBox bounds, scaling parameters, and file path mappings. | `python -u scripts/verify_assets.py <level>` |

---

## 🪐 4. Vertex AI Rate Limit Absorption
The `google-genai` SDK is used in `scripts/generate_assets.py` for Imagen 3 generations. When running extensive batches, Vertex AI may raise `RESOURCE_EXHAUSTED` (Error Code 8) rate limit exceptions.
The pipeline script has been programmed with:
* Automated **3-attempt loops**.
* **60-second and 120-second exponential backoffs** directly inside the generation thread.
* **Unbuffered Execution**: Running python with `-u` allows instant disk-logging, preventing log corruption if a shell command is terminated or timed out.

---

## 🚦 5. Specific Directives for Levels A2 & B1
As you embark on Levels A2 and B1, ensure you review the specific parameters:

### 🔵 Level A2 Checklist Parameters
* **Target Word Count**: 1,142 cards
* **Wordlist File**: `a2/wordlist.json`
* **Custom Metaphors**: When processing A2 cards, update the dictionary `METAPHOR_MAP` inside `scripts/generate_assets.py` with bespoke conceptual descriptions for complex pronouns, prepositions, and verbs before running the generator.

### 🟣 Level B1 Checklist Parameters
* **Target Word Count**: 2,139 cards
* **Wordlist File**: `b1/wordlist.json`
* **Verb Guard Rules**:
  - Keep reflexive pronouns (`sich`) intact for reflexive verbs (e.g., `sich beeilen` must keep `sich` in all conjugation schemas).
  - Enforce the Präteritum-for-Perfekt guard (prevent blocking LLM-suggested perfect-tense verbs that lack auxiliary `hat`/`ist` or mistakenly use simple past `-te`/`-ten` endings).

---

## 📈 6. Quick Handoff Checklist
To ensure the transition is seamless, verify these steps as Level B1 background generation completes:
- [x] Run `python scripts/run_unit_tests.py` to verify current state is perfectly stable.
- [ ] Monitor background image generation in `b1/images/` and ensure all 2,139 files compile.
- [ ] Run programmatic validation: `python scripts/verify_assets_webp.py b1` to audit files on disk.
- [ ] Compile Level B1 composite collage sheets: `python scripts/generate_collages.py --level b1`.
- [ ] Perform a visual review of the compiled collages for textual or semantic outliers.

*Pace yourself. Take calculated actions. Focus on elite SOTA visual aesthetics, and maintain atomic commit discipline at all times!*
