# SOTA Universal 3D Glossy Tactile Visuals & Level Transition Plan (V6.0 Sprint)

This document defines our definitive visual audit and execution roadmap for generating the remaining German Vocabulary SPA assets across A1, A2, and B1. It is designed to run under a persistent `/goal` loop with strict pacing, manual visual review, and a zero-tolerance policy for text/spelling defects.

---

## 💎 Design System & Visual Style Verification

### 1. Pivot from Muddy "Clay" to SOTA Glossy Tactile 3D Art
The visual aesthetic has been upgraded to a cutting-edge **SOTA Glossy & Tactile 3D Digital Art** style. This completely deprecates raw matte "claymation" in favor of:
* **Vibrant Glossy Enamel**: High-gloss, shiny surfaces with vivid colors.
* **Translucent Glowing Glassmorphism**: Internal refractive glass layers with glowing edges.
* **Metallic Chrome Accents**: Polished silver and gold chrome reflections.
* **Soft-Touch Matte Resin**: Tactile, premium resin bases.

### 2. Essence Extraction Constraints (Front and Center)
To ensure the card's concept is immediately recognizable, every prompt forces the subject to be **huge and front-and-center, occupying 85%+ of the canvas**, with zero distracting background clutter. 

### 3. Absolute Wordless and Text-Free Enforcement
To support language immersion and avoid weird AI-generated gibberish/typos, all cards must be **completely wordless (zero letters, zero numbers, zero text)**. Any card generating letters (e.g. "FAME" on a star or "OCCUPIEID" on a sign) is immediately rejected and regenerated with a non-text visual metaphor.

---

## 🚀 Step-by-Step V6.0 Execution Roadmap

### Phase 1: Force Regenerate and Fix Audited Cards (A1)
We will immediately regenerate the following cards to correct text and prompt-mismatch defects:
1. **Card 67 (`bekannt` - famous)**: Remove the text "FAME" from the star plaque; replace it with a glowing golden Hollywood-style star spotlight, completely wordless.
2. **Card 71 (`besetzt` - busy/occupied)**: Remove the typo "OCCUPIEID" from the bathroom indicator; replace it with a purely graphic red circular locked padlock icon, completely wordless.
3. **Card 74 (`best-` - the best)**: Resolve adjective form mapping so `"best-"` correctly matches the hand-curated metaphor of a spectacular golden trophy cup with a sparkling blue diamond.
4. **Card 75 (`bestellen` - to order)**: Remove the "ORDER" text from the button; replace it with a giant golden finger tapping a shopping cart checkout icon, completely wordless.

### Phase 2: Systematic Batch Generation Loop (Level A1: Cards 76 to 640)
We will run the pipeline in paced batches (10 to 15 cards per run) using a strict loop:
1. **Generate**: Run `scripts/generate_assets.py` to generate the WebPs.
2. **Manual Audit**: Use the browser agent or `view_file` to review every generated card.
3. **Regenerate Imperfect Cards**: If any card contains text, has an off-center subject, or fails to capture the word's essence, refine its metaphor mapping in `generate_assets.py` and re-run with `--force`.
4. **Commit**: Cleanly stage and commit verified batches in atomic segments of 10-20 images with a precise semantic commit message (e.g. `feat(database): integrate cards 76 to 90 SOTA 3D WebP assets`).

### Phase 3: Automatic Level Transition (A2 and B1)
Once Level A1 is 100% complete:
1. Transition automatically to `--level a2` and run its batch-generation and audit loop.
2. Once A2 is complete, transition automatically to `--level b1`.
3. Complete the entire database with over 3,900 verified premium cards.

---

## 🛠️ Verification & QA Checklist

### Automated Script Validation
- [x] Confirm `generate_assets.py` handles `.rstrip('-')` for adjectives.
- [ ] Ensure the connected black chroma-key floodfill and dynamic shadow-wiper successfully clean backgrounds.

### Visual Quality Audit
- [ ] Review every card WebP using `view_file` to verify:
  - 100% wordless (no text/letters).
  - Subject is huge, filling 85% of the frame.
  - SOTA glossy tactile materials render perfectly.
  - Transparent backdrop is clean with no floating black artifacts or disconnected shadows.

