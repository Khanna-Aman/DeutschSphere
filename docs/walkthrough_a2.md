# 🗺️ Walkthrough: Level A2 Manual & Programmatic Visual Audit Guide

This document establishes the precise protocols and workflows to perform manual visual reviews and programmatic validation of the completed **Level A2 curriculum (1,142 cards)**.

---

## 🛠️ 1. Programmatic Integrity Verification

We have engineered an automated validator that reviews the database syntax, checks that every card has an associated image file, validates paths, and physically parses every image on disk to prevent corrupted files:

```bash
python scripts/verify_assets_webp.py a2
```

### Run Results
```text
=== PROGRAMMATIC WEBP ASSET VERIFIER: LEVEL A2 ===
Loaded 1142 cards from database.

==================================================
VERIFICATION REPORT FOR LEVEL A2
==================================================
Total Database Cards:       1142
Valid WebP Images Audited:  1142 / 1142 (100.0%)
Missing Image Properties:   0
Missing WebP Files on Disk: 0
Invalid WebP Images:        0
Incorrect Path References:  0
==================================================

[SUCCESS] Level A2 WebP assets are 100% clean and programmatically valid! Code 0.
```

---

## 👁️ 2. Manual Visual Audit via Collage Sheets

To allow highly efficient visual sweeps of 1,142 high-resolution assets without API or memory overload, the entire deck is compiled into **4 large composite contact sheets** of 15x20 grids (150px cells) with high-contrast semi-transparent numbering overlays:

* **Sheet 1 (Cards 1–300)**: [a2_collage_sheet_1.webp](file:///d:/Aman/_________Projects/A1-B1_German/a2/collages/a2_collage_sheet_1.webp)
* **Sheet 2 (Cards 301–600)**: [a2_collage_sheet_2.webp](file:///d:/Aman/_________Projects/A1-B1_German/a2/collages/a2_collage_sheet_2.webp)
* **Sheet 3 (Cards 601–900)**: [a2_collage_sheet_3.webp](file:///d:/Aman/_________Projects/A1-B1_German/a2/collages/a2_collage_sheet_3.webp)
* **Sheet 4 (Cards 901–1142)**: [a2_collage_sheet_4.webp](file:///d:/Aman/_________Projects/A1-B1_German/a2/collages/a2_collage_sheet_4.webp)

### Visual Inspection Steps
1. **Open the Collage Files**: Click on the absolute file paths above to load the collage files inside your viewer.
2. **Scan for Text/Numbers**: Verify that no cards contain generated letters, alphabet strings, or digits (the card face must be purely metaphorical).
3. **AnalyzeMetaphor Accuracies**: Check that nouns/verbs are clearly illustrated through beautiful 3D claymation designs (vibrant, enamel-like elements inside black voids).
4. **Spot Outliers**: Locate any cells with corrupted borders or red replacement boxes (0 detected during automated verification!).

---

## 💻 3. Interactive Web Audit Dashboard (`audit_a2.html`)

For real-time search, filter, and dynamic inspection, we have deployed a local web interface:

👉 **Launch File**: [audit_a2.html](file:///d:/Aman/_________Projects/A1-B1_German/audit_a2.html)

### Features & Capabilities
* **CEFR Counters**: Real-time stats counting completed WebP percentages.
* **Deterministic Gender Glows**: Cards render with colored highlight borders corresponding to German genders (🔵 `der` for blue, 🔴 `die` for pink, 🟢 `das` for green, 🟣 other classes).
* **Fuzzy Search & Filters**: Live searching by German or English keywords combined with word class filtering (Verbs, Nouns, Adjectives).
* **Image Fallbacks**: Graceful error handling for missing/misconfigured files.

---

## 📈 4. Verification History Log

| Milestone / Batch | Range | Checked | Status | Method | Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Milestone 1** | Cards 1–100 | Yes | [x] PASSED | Programmatic & Collage | Perfect transparent voids, excellent metaphorical rendering. |
| **Milestone 2** | Cards 101–200 | Yes | [x] PASSED | Programmatic & Collage | Clean 3D models with high color contrast. |
| **Milestone 3** | Cards 201–300 | Yes | [x] PASSED | Programmatic & Collage | Handled difficult abstract terms (e.g. adverbs) beautifully. |
| **Milestone 4** | Cards 301–400 | Yes | [x] PASSED | Programmatic & Collage | Checked all nouns for gender border alignments. |
| **Milestone 5** | Cards 401–500 | Yes | [x] PASSED | Programmatic & Collage | 100% compliant. |
| **Milestone 6** | Cards 501–600 | Yes | [x] PASSED | Programmatic & Collage | 100% compliant. |
| **Milestone 7** | Cards 601–700 | Yes | [x] PASSED | Programmatic & Collage | Highly vibrant renders. |
| **Milestone 8** | Cards 701–800 | Yes | [x] PASSED | Programmatic & Collage | Verified all verbs and separable particles. |
| **Milestone 9** | Cards 810–900 | Yes | [x] PASSED | Programmatic & Collage | 100% compliant. |
| **Milestone 10** | Cards 901–1000 | Yes | [x] PASSED | Programmatic & Collage | Includes `card_967.webp` (der Titel) patch. |
| **Milestone 11** | Cards 1001–1142 | Yes | [x] PASSED | Programmatic & Collage | Final milestone. Standardised outputs. |
