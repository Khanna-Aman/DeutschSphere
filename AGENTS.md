# AGENTS.md — Operating Manual & Engineering Directives

You are working on **DeutschSphere**, an open-source, study-focused, offline-first **German A1–B1 vocabulary PWA**. This file is the authoritative charter for any AI agent (or human contributor) touching this repository. Read it before you write code or edit data. Its single most important job is to **stop scope creep**: this is a *flashcard spaced-repetition tool*, not a grammar engine, not a chatbot, not a game.

When in doubt, do less. Honest, narrow, and correct beats broad and speculative.

---

## 1. Identity & the hard scope boundary

DeutschSphere is a **flashcard-first** cognitive utility: the user masters official Goethe A1–B1 vocabulary through distraction-free, client-side spaced repetition (FSRS-5), pronunciation practice, quizzes, and a lightweight NLP immersion lab. Everything serves vocabulary retention.

**Do NOT build (out of scope — do not add, scaffold, or "improve toward" these):**

- **No grammar / conjugation engine.** No sentence-syntax parser, conjugation tables, declension trees, or case-drill generators. Deterministic suffix/gender *hints* in `js/nlp.js` (e.g. `-ung`/`-heit`/`-keit` → *die*) are the ceiling — do not grow them into a grammar system.
- **No gamification.** No XP, levels, streaks, leaderboards, badges, medals, star ratings, letter grades, confetti, particle bursts, sound chimes, or screen-shake. Feedback stays calm and study-relevant (FSRS grade cues, accuracy %, plain correct/incorrect colour).
- **No chatbot / roleplay / open-ended translation playground.** This is not an LLM frontend.
- **No runtime AI calls.** Nothing in the shipped app calls an LLM or paid API at runtime. Verification tooling that uses models is a *dev-time, offline-capable script*, never part of the client.
- **No invented linguistic facts.** See §3.

If a request would push past these lines, say so and propose the in-scope version instead.

---

## 2. Architecture invariants (do not violate)

- **Zero runtime dependencies.** The deployed app is flat `index.html` + precompiled CSS + native ES6 modules under `js/`. No runtime framework, bundler, or npm package ships to the client. `node_modules` is dev-only and git-ignored.
- **Precompiled Tailwind, never the Play CDN.** Tailwind ships as a static, tree-shaken `tailwind.css`. After changing utility classes, regenerate and commit it:
  ```bash
  npx tailwindcss@3.4.17 -c tailwind.config.js -i tailwind.input.css -o tailwind.css --minify
  ```
  Do **not** reintroduce the Play CDN — it forces `unsafe-inline`/`unsafe-eval` back into the CSP.
- **Self-hosted fonts & icons.** Inter, Outfit, and Font Awesome are served from `./fonts` (no Google Fonts / Cloudflare / cdnjs calls). The app makes **zero third-party network requests** on load. Keep it that way; do not relink a CDN.
- **Strict CSP.** `index.html` ships a tight Content-Security-Policy (`default-src 'self'`, `script-src 'self'`, no `unsafe-eval`). Any change that would require loosening it needs an explicit, justified decision — default is don't.
- **Offline-first.** Data layers (`a1/wordlist.json`, `a2/`, `b1/`) are fetched at runtime and cached; the Service Worker pre-caches the app shell. The app must run fully in Airplane Mode after first load.
- **Client-only persistence.** Progress lives in IndexedDB (+ localStorage), via the debounced `js/idb-keyval.js` pipeline. No accounts, no servers, no analytics, no trackers, no cookies. The only optional outbound request is the user-triggered feedback form.

---

## 3. Data policy — the corrected Zero-Inference Clause

Two different rules apply to two different kinds of data. **Do not conflate them.**

### 3.1 Factual linguistic fields → zero-inference, null-if-unattested
Gender (`der/die/das`), plural, and verb-conjugation fields are **facts**. They are grounded in the official Goethe-Institut *Wortliste* PDFs in `.raw_resources/` (the ground truth). **Never guess, generate, or infer them from model weights.** If a value is not attested in the source, leave the field `null` — do not fabricate it. Honesty outranks completeness.

### 3.2 Example sentences → original authored content, gated
This is the deliberate exception, and it reverses the project's earlier "never write example sentences" rule. Earlier versions reproduced the copyrighted Goethe/Hueber example sentences verbatim — a legal blocker. **All 2,627 `example_de`/`example_en` pairs are now original content authored for this project.** When you add or edit an example sentence it must:

1. **Use the entry's headword** naturally and illustrate its meaning, at an appropriate CEFR level.
2. **Be original** — not copied from the source PDFs. Run `python scripts/check_example_originality.py`; **verbatim must stay 0** (it also reports incidental 6-word-shingle coincidences).
3. **Be grammatical** — run `python scripts/check_grammar_languagetool.py` (offline LanguageTool engine; A1/A2 currently pass with 0 defects).

A second, optional layer (`scripts/check_examples_llm_judge.py`) gives an independent meaning/level/headword check via an LLM judge when an API key is supplied.

### 3.3 Other generated fields
English translations and the pseudo-phonetic pronunciation hints are **original to this project** (not from the Goethe lists, which contain neither). State this accurately in docs; never imply they are sourced.

> Note on history: an earlier directive mandated routing all verification through a NotebookLM MCP notebook. The current, authoritative ground truth is the **PDFs in `.raw_resources/` plus the repo's own gates** (`validate_data.py`, `check_example_originality.py`, `check_grammar_languagetool.py`). NotebookLM may be used as an optional corroboration aid, but it is not required and is not the source of truth.

---

## 4. Data integrity & verification gates

`wordlist.json` per level is the **single source of truth** (there is no CSV export — it was removed as an unused derived artifact). Before declaring any data change done:

- `python scripts/validate_data.py` — valid JSON, required keys, **unique ids**, every `image` ref exists on disk, no image shared by two entries, and the published total (**2,627** = A1 684 / A2 580 / B1 1,363) appears verbatim in the docs that quote it.
- `python scripts/check_example_originality.py` — **0 verbatim** vs. the source PDFs.
- `python scripts/check_grammar_languagetool.py` — grammar/spelling.

**Surgical data partitioning:** when bulk-editing a data layer, work in clean blocks (e.g. ~40–90 entries) and keep each patch a structurally valid JSON array. **Key every entry off the actual `id` field, never a line number** — the `id` columns have gaps, and mis-keying silently maps sentences to the wrong words.

---

## 5. Cache-version discipline (two independent layers)

- **`WORDLIST_CACHE_VERSION`** (`app.js`) owns **data** freshness. Bump it whenever any `a1`/`a2`/`b1` `wordlist.json` changes — it clears the normalized IndexedDB cache **and** is appended as `?v=` to the fetch so the SW's `DATA_CACHE` re-fetches.
- **`CACHE_VERSION`** (`sw.js`) owns **shell** freshness (HTML/CSS/JS/icons/fonts). Bump it whenever code or static assets change, and register any new JS module in `APP_SHELL`.
- They are independent: a data-only change bumps only `WORDLIST_CACHE_VERSION`; a code-only change bumps only `CACHE_VERSION`.

---

## 6. Execution & workflow rules

- **Deliberate pacing.** Work carefully and verify; don't flood concurrent tool calls or rush past edge cases. Quality over token-saving — never truncate analysis or emit `// rest unchanged…` placeholders. Rewrite files fully enough to paste cleanly.
- **Documentation sync.** If a change alters architecture, data policy, workflows, or styling constraints, update the relevant `.md` files (`README.md`, `VISION.md`, `CONTRIBUTING.md`, this file, `NOTICE`, `PRIVACY.md`) in the same change. No documentation rot.
- **Git.** Commit logically with `<type>(<scope>): <description>` messages (e.g. `content(b1): …`, `fix(scripts): …`). Don't end a turn with unrelated uncommitted churn. **Never `git push` unless the user explicitly asks** — stage and commit locally and wait.
- **Visual constraints.** Preserve the gender-glow classes — 🔵 `der` (`.card-glow-der`), 🩷 `die` (`.card-glow-die`), 🟢 `das` (`.card-glow-das`), 🟣 neutral/other. No layout-shifting effects.
- **Legal hygiene.** Keep `NOTICE` (content attribution + non-affiliation/trademark disclaimer) and `PRIVACY.md` accurate. "Goethe-Institut", "Goethe-Zertifikat", "telc", "Hueber", "ÖSD" are third-party marks — DeutschSphere is independent and unofficial; references are descriptive only.

---

## 7. Directory blueprint

```text
A1-B1_German/
├── index.html              # SPA shell (Flashcard, Quiz, Immersion views) + strict CSP
├── index.css               # Design tokens, gender glows, high-contrast layouts
├── tailwind.css            # Precompiled Tailwind (static, tree-shaken — no runtime CDN)
├── tailwind.config.js      # Build-time Tailwind config + regeneration command
├── app.js                  # Orchestrator: data load/normalize, hash routing, boot (WORDLIST_CACHE_VERSION)
├── sw.js                   # Service Worker: offline shell caching (CACHE_VERSION)
├── manifest.json           # PWA manifest
├── AGENTS.md               # You are here — operating manual & directives
├── README.md               # Public-facing documentation
├── VISION.md               # Status & roadmap
├── CONTRIBUTING.md         # Contributor rules
├── NOTICE / LICENSE / PRIVACY.md   # Attribution, MIT (code), privacy policy
├── PRODUCTION_READINESS_AUDIT_2026-06-30.md   # Audit + remediation log
│
├── fonts/                  # Self-hosted Inter, Outfit, Font Awesome (no CDN)
├── js/                     # ES6 modules: state, fsrs, nlp, audio, flashcards,
│                           #   phonetics, phoneme_guides, quiz, immersion, router,
│                           #   search, backup, telemetry, foic-preinit, events, idb-keyval
├── a1/ , a2/ , b1/         # Per-level datasets: wordlist.json + WebP assets
├── scripts/                # validate_data.py, check_example_originality.py,
│                           #   check_grammar_languagetool.py, check_examples_llm_judge.py,
│                           #   apply_examples.py, vendor_fonts.py, Playwright QA
└── .github/workflows/      # CI: data-integrity gate (validate-data.yml) + js-checks.yml
```

---

## 8. Current status (keep honest)

- **2,627 entries**: A1 684, A2 580, B1 1,363. Headword/gender/plural ≈ 99.6% fidelity to the official lists.
- **Example sentences: 100% original, 0 verbatim** across all three levels (was ~90%+ copied). P0 copyright blocker **resolved**.
- **Fonts self-hosted; privacy policy in place; licensing/attribution corrected.** All three original-audit P0 blockers are closed.
- **Honest coverage gaps (not blockers):** B1 is a curated subset (~57% of the ~2,400 official B1 units); B1 imagery 27% (371/1,363); thematic word groups (days, months, seasons, colours, numbers, countries) not yet included. Don't overstate these in docs.
- **Open owner-action items:** swap the personal feedback email in `js/events.js`; confirm Imagen 3 redistribution terms; image↔word mapping verification (in progress).
