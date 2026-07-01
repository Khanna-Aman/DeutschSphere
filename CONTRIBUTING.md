# Contributing to DeutschSphere

Thank you for your interest in contributing to DeutschSphere! We enforce a clean, zero-dependency, high-signal workspace.

## Core Rules

1. **Zero Runtime Dependencies**: No runtime framework, bundler, or npm package ships to the client — app code stays vanilla ES6 modules. The single build-time tool is the Tailwind CLI, run on demand to regenerate the committed `tailwind.css` (see [DEVELOPMENT.md → Styling](DEVELOPMENT.md#styling-precompiled-tailwind)). Do not add a runtime build step or commit `node_modules`.
2. **The Zero-Inference Clause** (factual fields only): Never guess, generate, or infer **factual linguistic data** — verb conjugations, plurals, genders. If they are not attested in the official Goethe wordlists, leave the schema field `null`. **Example sentences are different**: they are deliberately **original content** authored to replace the copyrighted source examples. New/edited example sentences must (a) use the entry's headword, (b) be original — run [`scripts/check_example_originality.py`](scripts/check_example_originality.py) and keep verbatim at **0** — and (c) pass the grammar gate [`scripts/check_grammar_languagetool.py`](scripts/check_grammar_languagetool.py).
3. **No Gamification**: This is a study tool, not a game. Do not introduce XP, streaks, leaderboards, medals/badges, star ratings, letter grades, particle bursts, confetti, chimes, or screen shakes. Feedback stays calm and study-relevant (FSRS grade cues, accuracy %, plain correct/incorrect coloring).
4. **FSRS Scheduling**: The scheduler is **FSRS-inspired** (based on the FSRS-5 model, with documented simplifications — see the `js/fsrs.js` header). Any change to the scheduling logic must keep `tests/fsrs.test.mjs` green (`npm test`); if you change the math, update the oracle values there and note the deviation.

## Development

Full build, run, and architecture details are in **[DEVELOPMENT.md](DEVELOPMENT.md)**. In short, serve the folder over HTTP (native ES6 modules require it):
```bash
python -m http.server 8080   # then open http://localhost:8080
```

## Testing

Data integrity, JS syntax/lint, deterministic unit tests, and accessibility are all enforced automatically in CI (`validate-data.yml`, `js-checks.yml`, `tests.yml`, `quality.yml`). Before submitting a Pull Request, run them locally:

```bash
# Deterministic FSRS + NLP unit tests (Node built-in runner, no deps) — CI hard gate
npm test

# Data integrity — counts, image refs, doc consistency (no deps)
python scripts/validate_data.py

# JS syntax check + lint
npm run check && npm run lint

# Accessibility / best-practices / SEO (Lighthouse, axe-core) — must stay 100 / 95 / 100
npm run audit:lighthouse
```

The browser-driven boot/smoke test (`tests/smoke_e2e.py`) needs a one-time
`pip install playwright && playwright install chromium`, then `npm run test:e2e`.
