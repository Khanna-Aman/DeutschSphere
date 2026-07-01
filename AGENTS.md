# AGENTS.md — Vision, Operating Manual & Engineering Directives

You are working on **DeutschSphere** — built to be **the best German A1–B1 flashcard tool in the world, and a free gift to learners.** Hyper-premium, state-of-the-art, offline-first, study-focused. No paywall, no ads, no tracking, ever.

This file is the authoritative charter for any AI agent (or human contributor) touching this repository. Read it before you write code or edit data. It has two jobs that pull in opposite directions, and both are sacred:

1. **Relentless excellence** — every detail held to a SOTA bar. "Best" is the standard, not a slogan.
2. **Ruthless restraint** — this is a *flashcard spaced-repetition tool*, not a grammar engine, not a chatbot, not a game. We get to "best" by perfecting a narrow thing, not by piling on features.

When those two collide, the answer is almost always: **make the core flawless, and say no to the new feature.** Best = flawless, not bigger.

---

## 1. The vision

A learner anywhere in the world — on a cheap phone, on a train with no signal, with no account and no money — can open DeutschSphere and get a **world-class, distraction-free** vocabulary-mastery experience grounded in the official Goethe A1–B1 curriculum. It is fast, calm, accessible, and honest. It respects their attention and their privacy. It is given freely.

That is the whole product. Everything below protects it.

**The "perfect the core" doctrine.** We do not chase feature parity with bloated apps. We win by executing the core — spaced repetition (FSRS-5), card UX, pronunciation, quizzes, offline delivery — better than anyone. Before adding anything, ask: *does this make the core more flawless, or just bigger?* If it's "bigger," decline and say so. A rejected feature that protects focus is a win, not a gap.

---

## 2. Identity & the hard scope boundary

DeutschSphere is a **flashcard-first** cognitive utility. Mastery comes from client-side spaced repetition (FSRS-5), pronunciation practice (Phonetik-Spiegel), active-recall quizzes, and a lightweight NLP immersion lab. Everything serves vocabulary retention.

**Do NOT build (out of scope — do not add, scaffold, or "improve toward" these):**

- **No grammar / conjugation engine.** No sentence-syntax parser, conjugation/declension tables, or case-drill generators. The deterministic suffix/gender *hints* in `js/nlp.js` (e.g. `-ung`/`-heit`/`-keit` → *die*) are the ceiling — never grow them into a grammar system.
- **No gamification — zero, by principle.** No XP, levels, streaks, leaderboards, badges, medals, star ratings, letter grades, confetti, particle bursts, sound chimes, or screen-shake. The only progress signal is **honest retention/stability visualization** (FSRS state, accuracy %, words due). The calm, clinical focus *is* the premium differentiator — protect it.
- **No chatbot / roleplay / open-ended translation playground.** This is not an LLM frontend.
- **No runtime AI or paid-API calls — ever.** Nothing in the shipped app calls an LLM, a cloud service, or any paid/metered API at runtime. (Model-based *verification* tooling is a dev-time, offline-capable script, never part of the client.) This keeps the tool free, private, and offline.
- **No invented linguistic facts.** See §6.

If a request would cross these lines, say so plainly and propose the in-scope version instead.

---

## 3. The free-forever pledge (permanent, non-negotiable)

These are promises to the people we built this for. They are not to be eroded, A/B-tested, or "revisited for monetization." Treat any change that weakens them as a bug:

1. **Forever free — no paywall, no paid tiers, no locked features.** The entire tool is free.
2. **No ads, ever.** No advertising, no embedded sponsorships, no affiliate hooks in the learning experience.
3. **No tracking.** No analytics, no third-party trackers, no cookies, no telemetry that leaves the device. (`js/telemetry.js` is local-only structured logging/error boundaries — keep it that way.)
4. **No account required; data is the user's.** No sign-up. All learning state lives on-device (IndexedDB + localStorage) and is fully portable via the Base64 Sync Key / JSON backup.
5. **Open by default.** Source code is MIT; content carries its own honest attribution (`NOTICE`). The project is a gift — keep it forkable and self-hostable.

---

## 4. SOTA quality bars (enforced standards, not aspirations)

Every change is held to these. They are the operational meaning of "hyper-premium." Where a bar is not yet fully met, it is a **prioritized gap to close**, not an excuse to lower the bar (see §11 for honest current status).

- **Accessibility — WCAG 2.2 AA.** Full keyboard operability, screen-reader semantics (ARIA, `lang`), visible focus management across view transitions/accordions, sufficient contrast on the dark theme, `prefers-reduced-motion` honored. The tool must be usable by everyone.
- **Performance budget.** Fast first paint and interaction; capped/optimized asset weight (WebP < 10 KB each; lazy + precached); 60 fps, jank-free interactions and animations even on low-end Android. No layout shift (CLS ≈ 0). Measure before/after on weighty changes.
- **Offline integrity.** Full functionality in airplane mode after first load — verified, with **zero runtime network dependency** (self-hosted fonts/icons, precached shell, cached data). A change that adds an external request fails this bar.
- **Correctness — core-engine tests in CI.** FSRS-5 scheduling math and the NLP lemmatizer/phonetik logic must have automated tests wired into CI as real gates (alongside the data-integrity gate). Scheduling changes require matching FSRS-5 spec tests.
- **Cross-device & cross-browser correctness.** Verified on Android, iOS (incl. safe-area insets), and desktop, on current Chrome/Firefox/Safari. Graceful degradation where a Web API (e.g. SpeechRecognition) is unavailable — never a broken view.
- **Data durability — never lose a learner's progress.** IndexedDB writes are debounced and resilient; backup/restore round-trips losslessly; schema/version migrations are non-destructive. Treat user progress as sacred.
- **Security.** Strict CSP (no `unsafe-eval`); all dynamic content rendered through XSS-safe escaping (`escapeHtml`), never raw `innerHTML` of untrusted input; no secrets in the repo; no `eval`.
- **PWA robustness.** Installable; Service Worker updates propagate cleanly (cache-version discipline, §8); offline fallback; no stale-asset traps after deploy.
- **Honest UX — no dark patterns.** No manipulative nudges, fake urgency, guilt mechanics, or attention traps. Feedback is layout-stable and calm. Respect the learner's time and agency.
- **Linguistic & content accuracy.** Vocabulary fidelity to the official Goethe lists; example sentences original, idiomatic, level-appropriate, and gated (§6–§7).
- **Documentation honesty.** Docs never overstate coverage, offline behavior, or grounding. If reality changes, docs change in the same commit. No marketing fiction.

> "any other SOTA bar": if you spot a dimension of excellence not listed here that a best-in-class tool should meet, raise it and, once agreed, add it to this section. This list is meant to grow toward perfection, never to be trimmed for convenience.

---

## 5. Architecture invariants (do not violate)

- **Zero runtime dependencies.** The deployed app is flat `index.html` + precompiled CSS + native ES6 modules under `js/`. No runtime framework, bundler, or npm package ships to the client. `node_modules` is dev-only and git-ignored.
- **Precompiled Tailwind, never the Play CDN.** Tailwind ships as a static, tree-shaken `tailwind.css`. After changing utility classes, regenerate and commit it:
  ```bash
  npx tailwindcss@3.4.17 -c tailwind.config.js -i tailwind.input.css -o tailwind.css --minify
  ```
  Do **not** reintroduce the Play CDN — it forces `unsafe-inline`/`unsafe-eval` back into the CSP.
- **Self-hosted fonts & icons.** Inter, Outfit, and Font Awesome are served from `./fonts` (no Google Fonts / Cloudflare / cdnjs). The app makes **zero third-party requests** on load. Keep it that way.
- **Strict CSP & client-only persistence.** Tight `Content-Security-Policy` in `index.html`; progress in IndexedDB via the debounced `js/idb-keyval.js` pipeline; the only optional outbound request is the user-triggered feedback form.

---

## 6. Data policy — the corrected Zero-Inference Clause

Two rules for two kinds of data. **Do not conflate them.**

### 6.1 Factual linguistic fields → zero-inference, null-if-unattested
Gender (`der/die/das`), plural, and conjugation are **facts**, grounded in the official Goethe-Institut *Wortliste* PDFs in `.raw_resources/` (the ground truth). **Never guess or generate them.** If a value is not attested in the source, leave the field `null`. Honesty outranks completeness. Do not use model weights to invent grammar profiles.

### 6.2 Example sentences → original authored content, gated
The deliberate exception (this reverses the project's earlier "never write example sentences" rule, which existed because the data once copied copyrighted Goethe/Hueber examples verbatim — a legal blocker). **All 2,627 `example_de`/`example_en` pairs are now original content authored for this project.** New/edited example sentences must:

1. **Use the entry's headword** naturally and illustrate its meaning, at the right CEFR level.
2. **Be original** — `python scripts/check_example_originality.py`; **verbatim must stay 0**.
3. **Be grammatical** — `python scripts/check_grammar_languagetool.py` (offline LanguageTool).

Optional second opinion: `scripts/check_examples_llm_judge.py` (meaning/level/headword via an LLM judge, when an API key is supplied — dev-time only).

### 6.3 Other generated fields
English translations and the pseudo-phonetic pronunciation hints are **original to this project** (the Goethe lists contain neither). State this accurately; never imply they are sourced.

> Ground truth is the **PDFs in `.raw_resources/` + the repo's own gates** (`validate_data.py`, `check_example_originality.py`, `check_grammar_languagetool.py`). NotebookLM may corroborate but is not required and is not the source of truth.

---

## 7. Data integrity & verification gates

`wordlist.json` per level is the **single source of truth** (no CSV export exists — it was removed as an unused derived artifact). Before declaring a data change done:

- `python scripts/validate_data.py` — valid JSON, required keys, **unique ids**, every `image` ref exists, no image shared by two entries, and the published total (**2,627** = A1 684 / A2 580 / B1 1,363) appears verbatim in the docs that quote it.
- `python scripts/check_example_originality.py` — **0 verbatim** vs. the source PDFs.
- `python scripts/check_grammar_languagetool.py` — grammar/spelling.

**Surgical data partitioning:** bulk-edit in clean blocks (~40–90 entries), each a valid JSON array. **Key every entry off the actual `id` field, never a line number** — id columns have gaps, and mis-keying silently maps sentences to the wrong words.

---

## 8. Cache-version discipline (two independent layers)

- **`WORDLIST_CACHE_VERSION`** (`app.js`) owns **data** freshness — bump on any `a1`/`a2`/`b1` `wordlist.json` change (clears the IndexedDB cache and `?v=`-busts the fetch).
- **`CACHE_VERSION`** (`sw.js`) owns **shell** freshness (HTML/CSS/JS/icons/fonts) — bump on any code/asset change, and register new JS modules in `APP_SHELL`.
- Independent: data-only change bumps only the former; code-only change bumps only the latter.

---

## 9. Execution & workflow rules

- **Deliberate pacing.** Work carefully and verify; don't rush past edge cases or flood concurrent tool calls. Quality over token-saving — no `// rest unchanged…` placeholders; rewrite enough to paste cleanly.
- **Definition of done.** A task is not finished until three things are true: the change works and is verified; **every affected document is updated** so no doc lags the code; and the work is **committed to git**. Make a documentation sweep the last step of each task, then commit — never leave the repo with docs out of sync or the change uncommitted (unless the user is still mid-review).
- **Documentation sync & audience.** Any change to architecture, data policy, scope, or quality bars updates the relevant docs in the same commit — no rot, no overclaiming. Respect each doc's audience:
  - **`README.md` is user-first** — written for learners and visitors (what the app is, how to use it, honest coverage, privacy/trust). Keep build, architecture, CI, and internal-checklist detail **out** of it.
  - Developer/build/CI/architecture detail → **`DEVELOPMENT.md`**; contribution workflow → **`CONTRIBUTING.md`**; vision/roadmap → **`VISION.md`**; attribution/law → **`NOTICE`**/**`PRIVACY.md`**; internal status & history → the audit, **`CHANGELOG.md`**, **`backlog.md`**; charter/scope → this file.
- **Git.** Commit logically with `<type>(<scope>): <description>` messages, and commit at the end of every task so work is never lost. Don't end a turn with unrelated uncommitted churn. **Never `git push` unless the user explicitly asks.**
- **Visual constraints.** Preserve the gender-glow classes — 🔵 `der` (`.card-glow-der`), 🩷 `die` (`.card-glow-die`), 🟢 `das` (`.card-glow-das`), 🟣 neutral/other. No layout-shifting effects.
- **Legal hygiene.** Keep `NOTICE` and `PRIVACY.md` accurate. "Goethe-Institut", "Goethe-Zertifikat", "telc", "Hueber", "ÖSD" are third-party marks — DeutschSphere is independent and unofficial; references are descriptive only.

---

## 10. Directory blueprint

```text
A1-B1_German/
├── index.html              # SPA shell (Flashcard, Quiz, Immersion views) + strict CSP
├── index.css               # Design tokens, gender glows, high-contrast layouts
├── tailwind.css            # Precompiled Tailwind (static, tree-shaken — no runtime CDN)
├── tailwind.config.js      # Build-time Tailwind config + regeneration command
├── app.js                  # Orchestrator: data load/normalize, hash routing, boot (WORDLIST_CACHE_VERSION)
├── sw.js                   # Service Worker: offline shell caching (CACHE_VERSION)
├── manifest.json           # PWA manifest
├── AGENTS.md               # You are here — vision, operating manual & directives
├── README.md               # User-first guide (learners/visitors) — no dev/CI detail
├── VISION.md               # Status & roadmap
├── CONTRIBUTING.md         # Contribution workflow
├── DEVELOPMENT.md          # Build, run, architecture & CI (developer guide)
├── NOTICE / LICENSE / PRIVACY.md   # Attribution, MIT (code), privacy policy
├── CHANGELOG.md             # Notable changes
├── backlog.md               # Feature/spec log (lags; audit + CHANGELOG are authoritative)
├── PRODUCTION_READINESS_AUDIT_2026-06-30.md   # Audit + remediation log
├── COMPETITIVE_ANALYSIS_2026-06-30.md         # Competitor KPI benchmark + in-bounds roadmap
│
├── fonts/                  # Self-hosted Inter, Outfit, Font Awesome (no CDN)
├── js/                     # ES6 modules: state, fsrs, nlp, audio, flashcards,
│                           #   phonetics, phoneme_guides, quiz, immersion, router,
│                           #   search, backup, telemetry, foic-preinit, events, idb-keyval
├── a1/ , a2/ , b1/         # Per-level datasets: wordlist.json + WebP assets
├── scripts/                # validate_data.py, check_example_originality.py,
│                           #   check_grammar_languagetool.py, check_examples_llm_judge.py,
│                           #   apply_examples.py, vendor_fonts.py, Playwright QA
└── .github/workflows/      # CI: validate-data.yml (data) + js-checks.yml (JS) + quality.yml (Lighthouse a11y/SEO)
```

---

## 11. Current status (keep honest)

- **2,627 entries**: A1 684, A2 580, B1 1,363. Headword/gender/plural ≈ 99.6% fidelity to the official lists.
- **Example sentences: 100% original, 0 verbatim** across all three levels (was ~90%+ copied). P0 copyright blocker **resolved**.
- **Fonts self-hosted; privacy policy in place; licensing/attribution corrected.** All three original-audit P0 blockers closed; the free-forever pledge (§3) already holds today.
- **Accessibility: verified Lighthouse 100** (a11y), 100 (best-practices), 100 (SEO), enforced by a CI gate (`quality.yml` + `lighthouserc.json`, axe-core under the hood). A full manual WCAG 2.2 AA sign-off (criteria automation can't cover) is still outstanding.
- **Quality-bar gaps to close (honest):** production performance budget not yet formalized/measured (CI perf is advisory — dev assets are unminified); **core-engine tests exist (Playwright) but are not yet wired into CI**.
- **Image↔word verification:** first automated pass done (`scripts/check_image_word_clip.py`, free local CLIP + perceptual hash). No systematic mismapping found — 415 concrete cards confirmed, abstract words aren't auto-verifiable, 3 near-duplicate pairs + a review sheet (`scripts/image_check_review.html`) await a human spot-check. Optional refinement (concreteness gate / local VLM) noted in the audit §4.2.
- **Coverage gaps (not blockers, don't overstate):** B1 is a curated subset (~57% of the ~2,400 official B1 units); B1 imagery 27% (371/1,363); thematic word groups (days, months, seasons, colours, numbers, countries) not yet included.
- **Open owner-action items:** swap the personal feedback email in `js/events.js`; confirm Imagen 3 redistribution terms.
