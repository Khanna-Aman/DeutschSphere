// tests/fsrs.test.mjs — deterministic unit tests for the FSRS-5 scheduler.
// Runs on Node's built-in runner: `node --test tests/`. Zero dependencies:
// imports js/fsrs.js directly (the module is pure ESM, no DOM).
//
// These are regression + invariant tests. They assert the scheduler's ACTUAL,
// currently-shipping behaviour (oracle values probed from the module), plus
// spec-level invariants (monotonic decay, bounded difficulty, immutability).
// Known deviations from the canonical FSRS-5 spec are documented in the
// 2026-07-01 audit (§ correctness), not silently encoded as "correct" here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FSRS, State, Rating } from '../js/fsrs.js';

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1000; // fixed epoch so every test is deterministic
const near = (a, b, eps = 1e-3) => Math.abs(a - b) <= eps;

test('createCard yields a blank New card', () => {
  const srs = new FSRS();
  const c = srs.createCard(T0);
  assert.equal(c.state, State.New);
  assert.equal(c.stability, 0);
  assert.equal(c.difficulty, 0);
  assert.equal(c.reps, 0);
  assert.equal(c.lapses, 0);
  assert.equal(c.box, 1);
  assert.equal(c.due, T0);
});

test('first Good review: New -> Learning, stability = w2 (3.1262), 3-day interval', () => {
  const srs = new FSRS({ requestRetention: 0.9 });
  const c = srs.reviewCard(srs.createCard(T0), Rating.Good, T0);
  assert.equal(c.state, State.Learning);
  assert.ok(near(c.stability, 3.1262), `stability ${c.stability}`);
  assert.ok(near(c.difficulty, 5.3146, 1e-3), `difficulty ${c.difficulty}`);
  assert.equal(c.reps, 1);
  // interval = round(S * 9 * (1/R - 1)) = round(3.1262 * 9 * 0.1111) = 3 days
  assert.equal(Math.round((c.due - T0) / DAY), 3);
});

test('first Again review: New -> Learning, lapse counted, stability = w0 (0.4072)', () => {
  const srs = new FSRS();
  const c = srs.reviewCard(srs.createCard(T0), Rating.Again, T0);
  assert.equal(c.state, State.Learning);
  assert.equal(c.lapses, 1);
  assert.ok(near(c.stability, 0.4072), `stability ${c.stability}`);
});

test('first Easy review graduates straight to Review', () => {
  const srs = new FSRS();
  const c = srs.reviewCard(srs.createCard(T0), Rating.Easy, T0);
  assert.equal(c.state, State.Review);
  assert.ok(near(c.stability, 15.4722), `stability ${c.stability}`);
});

test('initial stability ordering Again < Hard < Good < Easy', () => {
  const srs = new FSRS();
  const s = (rating) => srs.reviewCard(srs.createCard(T0), rating, T0).stability;
  const again = s(Rating.Again), hard = s(Rating.Hard), good = s(Rating.Good), easy = s(Rating.Easy);
  assert.ok(again < hard && hard < good && good < easy,
    `expected monotone, got ${again} ${hard} ${good} ${easy}`);
});

test('retrievability decays monotonically and stays in (0,1]', () => {
  const srs = new FSRS();
  const c = srs.reviewCard(srs.createCard(T0), Rating.Good, T0);
  const r0 = srs.getRetrievability(c, T0);          // at review time
  const r1 = srs.getRetrievability(c, T0 + DAY);     // +1 day
  const r10 = srs.getRetrievability(c, T0 + 10 * DAY); // +10 days
  assert.ok(near(r0, 1), `r0 ${r0}`);
  assert.ok(near(r1, 0.965678, 1e-5), `r1 ${r1}`);
  assert.ok(r0 > r1 && r1 > r10, `monotonic decay ${r0} ${r1} ${r10}`);
  assert.ok(r10 > 0 && r10 <= 1);
});

test('New card retrievability is 0 (no memory yet)', () => {
  const srs = new FSRS();
  assert.equal(srs.getRetrievability(srs.createCard(T0), T0 + DAY), 0);
});

test('lapse from Review state: Relearning, lapse++, forget stability never exceeds prior', () => {
  const srs = new FSRS();
  // Drive a card into Review with an Easy grade, review it once more successfully,
  // then fail it.
  let c = srs.reviewCard(srs.createCard(T0), Rating.Easy, T0); // -> Review
  c = srs.reviewCard(c, Rating.Good, T0 + 5 * DAY);            // still Review, higher S
  const priorStability = c.stability;
  const lapsed = srs.reviewCard(c, Rating.Again, T0 + 10 * DAY);
  assert.equal(lapsed.state, State.Relearning);
  assert.equal(lapsed.lapses, 1);
  assert.ok(lapsed.stability <= priorStability, 'forget stability clamped to prior');
  assert.ok(lapsed.stability >= 0.1, 'stability floored at 0.1');
});

test('difficulty stays clamped within [1, 10] across many reviews', () => {
  const srs = new FSRS();
  let c = srs.reviewCard(srs.createCard(T0), Rating.Good, T0);
  let t = T0;
  for (let i = 0; i < 50; i++) {
    t += 2 * DAY;
    const rating = i % 4 === 0 ? Rating.Again : Rating.Easy; // stress mean reversion
    c = srs.reviewCard(c, rating, t);
    assert.ok(c.difficulty >= 1 && c.difficulty <= 10, `difficulty ${c.difficulty} at step ${i}`);
    assert.ok(c.stability >= 0.1, `stability ${c.stability} at step ${i}`);
  }
});

test('reviewCard is immutable (does not mutate the input card)', () => {
  const srs = new FSRS();
  const before = srs.createCard(T0);
  const snapshot = JSON.stringify(before);
  srs.reviewCard(before, Rating.Good, T0);
  assert.equal(JSON.stringify(before), snapshot, 'input card must not be mutated');
});

test('scheduler is deterministic for identical inputs', () => {
  const a = new FSRS().reviewCard(new FSRS().createCard(T0), Rating.Good, T0);
  const b = new FSRS().reviewCard(new FSRS().createCard(T0), Rating.Good, T0);
  assert.deepEqual(a, b);
});

test('interval is at least 1 day and respects maximumInterval', () => {
  const srs = new FSRS({ maximumInterval: 30 });
  let c = srs.reviewCard(srs.createCard(T0), Rating.Easy, T0);
  for (let i = 0; i < 20; i++) c = srs.reviewCard(c, Rating.Easy, c.due);
  const intervalDays = Math.round((c.due - c.lastReview) / DAY);
  assert.ok(intervalDays >= 1 && intervalDays <= 30, `interval ${intervalDays} out of bounds`);
});

test('migrateLeitnerCard maps boxes to sensible FSRS states', () => {
  const srs = new FSRS();
  const fresh = srs.migrateLeitnerCard({ box: 1, lastReviewed: 0 }, T0);
  assert.equal(fresh.state, State.New);
  const mastered = srs.migrateLeitnerCard({ box: 5, lastReviewed: T0 - DAY, nextReview: T0 }, T0);
  assert.equal(mastered.state, State.Review);
  assert.ok(mastered.stability >= 15);
});
