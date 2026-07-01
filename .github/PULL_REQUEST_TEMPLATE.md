<!-- Thanks for contributing to DeutschSphere! Keep PRs focused and reviewable. -->

## What & why

<!-- What does this change and why? Link any related issue (#123). -->

## Scope check (DeutschSphere is a study-only, zero-dependency PWA)

- [ ] Stays within scope — **no** gamification (XP/streaks/badges), grammar engine,
      chatbot tutor, accounts, tracking, ads, paid tiers, or runtime/paid AI.
- [ ] **No new runtime dependencies** (app code stays vanilla ES6 modules).
- [ ] Factual data (gender/plural/conjugation) is sourced from the official Goethe
      lists or left `null` — never guessed. Example sentences are original.

## Verification

- [ ] `npm test` passes (deterministic FSRS + NLP units).
- [ ] `python scripts/validate_data.py` passes (data integrity + counts + headwords).
- [ ] `npm run check` passes (JS syntax); lint has no new errors.
- [ ] If content changed: `check_example_originality.py` = 0 verbatim and the grammar
      gate is clean.
- [ ] Docs updated (README / DEVELOPMENT / CHANGELOG / backlog) where relevant.

## Notes for reviewers

<!-- Anything reviewers should focus on, screenshots for UI changes, etc. -->
