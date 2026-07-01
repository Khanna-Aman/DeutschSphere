# Development & Architecture

Technical guide for anyone building, running, or auditing DeutschSphere. If you're
here to **use** the app, the [README](README.md) is the place to start. If you're
here to **contribute**, read [CONTRIBUTING.md](CONTRIBUTING.md) as well. The
authoritative engineering charter (vision, scope boundaries, quality bars) is
[AGENTS.md](AGENTS.md).

## Tech stack & principles

- **Vanilla ES6 modules — no bundler, no framework, no runtime dependencies.** The
  app runs the source you see; there is no build step for the JavaScript.
- **Offline-first PWA.** A Service Worker precaches the app shell and caches
  vocabulary on first load; after that the app works fully in airplane mode.
- **Everything self-hosted.** Fonts, icons, and CSS are served from the origin — no
  third-party CDNs — which keeps a strict CSP (`default-src 'self'`, no
  `unsafe-eval`) and means zero third-party requests on load.
- **Client-side only.** Progress lives in the browser (IndexedDB + `localStorage`).
  There is no backend, no account system, and no analytics.

## Local development

Because the app uses native ES6 modules, it must be served over HTTP (opening
`index.html` from disk triggers CORS restrictions):

```bash
python -m http.server 8080
# then open http://localhost:8080
```

## Project structure

```text
A1-B1_German/
├── index.html              # Core SPA HTML shell + strict CSP
├── index.css               # Design tokens, high-contrast layouts, gender card glows
├── tailwind.css            # Precompiled Tailwind build (static, tree-shaken — no runtime CDN)
├── tailwind.config.js      # Build-time Tailwind config + regeneration command
├── app.js                  # Orchestrator: boots the PWA, hash routing, view transitions
├── sw.js                   # Service Worker (precaches the self-hosted shell for offline use)
├── manifest.json           # PWA manifest
│
├── js/                     # ES6 module controllers
│   ├── state.js            # App state, DOM selector maps, IndexedDB debouncing
│   ├── idb-keyval.js       # Async key-value IndexedDB driver
│   ├── fsrs.js             # FSRS-5 scheduling engine
│   ├── nlp.js              # Lemmatizer, suffix analyzer, Kölner Phonetik, gender rules
│   ├── audio.js            # Dual-voice (DE/EN) TTS + Web Audio oscillators
│   ├── flashcards.js       # Card rendering, deck navigation, preference toggles
│   ├── phonetics.js        # Phonetik-Spiegel: speech recognition, waveforms, scoring
│   ├── phoneme_guides.js   # Static mouth-position guides for tricky phonemes
│   ├── quiz.js             # Multiple-choice & spelling test controllers
│   ├── immersion.js        # Immersion-lab text analyzer view controller
│   ├── router.js           # Client-side hash router & view transitions
│   ├── search.js           # Lexicon indexing & sidebar category words
│   ├── backup.js           # Profile export/import & Base64 Sync Key restore
│   ├── telemetry.js        # In-memory structured logging & error boundaries (no network)
│   ├── foic-preinit.js     # Pre-paint level detection (blocking, runs before modules)
│   └── events.js           # Hotkeys, swipe gestures, settings, modal wiring
│
├── a1/ , a2/ , b1/         # Per-level datasets: wordlist.json + WebP assets
├── fonts/                  # Self-hosted Inter, Outfit, Font Awesome
├── scripts/                # Data validator, originality/grammar/image gates, legacy QA
└── .github/workflows/      # CI (see below)
```

## Data model

Each level's `wordlist.json` is the **source of truth**. Every entry follows a fixed
schema (`german`, `word_class`, `gender`, `plural`, `english`, `pronunciation`,
`theme`, `antonym`, `example_de`, `example_en`, `image`, `id`). Factual grammar
fields are left `null` where the official lists don't attest them (zero-inference);
example sentences are original-authored and copyright-gated. See
[AGENTS.md](AGENTS.md) §6 and [backlog.md](backlog.md) §1 for the full schema and
data policy.

## Styling (precompiled Tailwind)

Tailwind is **precompiled to a static `tailwind.css`** rather than loaded from the
Play CDN — this keeps the runtime build-free while letting the CSP drop
`unsafe-inline`/`unsafe-eval`. After changing class usage in the HTML or JS,
regenerate it and commit the result (it is served statically and precached by the
Service Worker):

```bash
npx tailwindcss@3.4.17 -c tailwind.config.js -i tailwind.input.css -o tailwind.css --minify
```

## Quality gates & CI

Four GitHub Actions workflows gate every push and pull request:

| Workflow | What it checks |
| :--- | :--- |
| `validate-data.yml` | `validate_data.py` — treats each `wordlist.json` as source of truth; fails on invalid JSON, duplicate ids, broken/duplicated image refs, merged/unrelated-lemma headwords, or any published word count that drifts from the data. |
| `js-checks.yml` | `node --check` syntax on all `js/**` + advisory ESLint. |
| `tests.yml` | **Hard gate:** deterministic FSRS + NLP unit tests (`node --test`, `tests/*.test.mjs`). Plus an advisory Playwright boot/smoke (`tests/smoke_e2e.py`). |
| `quality.yml` | Lighthouse (axe-core under the hood). **Hard gate**: accessibility / best-practices / SEO must stay at the verified **100 / 95 / 100** bars. Performance is advisory (CI throttles unminified dev assets). |

Run the same checks locally:

```bash
npm test                             # deterministic FSRS + NLP unit tests (no deps)
python scripts/validate_data.py     # data integrity
npm run check && npm run lint        # JS syntax + lint
npm run audit:lighthouse             # accessibility / best-practices / SEO
```

**Content gates** (run at authoring time, not in CI): `check_example_originality.py`
(0-verbatim copyright gate), `check_grammar_languagetool.py` (offline LanguageTool),
and `check_image_word_clip.py` (free local CLIP + perceptual-hash image↔word check).

**Tests.** Deterministic units live in `tests/` and run on Node's built-in runner
(`npm test`, zero deps). A browser-driven boot/smoke (`tests/smoke_e2e.py`) needs a
one-time `pip install playwright && playwright install chromium`, then `npm run test:e2e`.

## Deploying to GitHub Pages

The app is a static site with **no build step** — GitHub Pages serves the repo as-is.

1. Push your branch and merge to **`main`** (Pages deploys from `main`).
2. Repo **Settings → Pages → Build and deployment → Source: "Deploy from a branch"**,
   branch **`main`**, folder **`/ (root)`**. Save.
3. Wait ~1 minute; the site goes live at
   **`https://<user>.github.io/<repo>/`** (for this repo: `https://khanna-aman.github.io/DeutschSphere/`).

Notes:
- A committed **`.nojekyll`** disables Jekyll so every file/folder is published verbatim.
- All asset paths are **relative** and the service-worker scope is `./`, so the app works
  correctly under the `/<repo>/` subpath — no config needed.
- If you fork/rename, update the canonical + Open Graph URLs in `index.html` and the
  badges in `README.md` to your `https://<user>.github.io/<repo>/`.
- The Goethe source PDFs/MP3s in `.raw_resources/` are **git-ignored** and never
  published; only the original, gated app content ships.

## Further reading

- [AGENTS.md](AGENTS.md) — vision, scope boundaries, and engineering directives (read first).
- [PRODUCTION_READINESS_AUDIT_2026-07-01.md](PRODUCTION_READINESS_AUDIT_2026-07-01.md) — full audit + remediation log.
- [COMPETITIVE_ANALYSIS_2026-06-30.md](COMPETITIVE_ANALYSIS_2026-06-30.md) — KPI benchmark + in-bounds roadmap.
- [CHANGELOG.md](CHANGELOG.md) · [backlog.md](backlog.md) — history and feature/spec log.
