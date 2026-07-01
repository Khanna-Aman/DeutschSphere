// tests/nlp.test.mjs — deterministic unit tests for the German NLP layer.
// Runs on Node's built-in runner: `node --test tests/`. Imports js/nlp.js
// directly (pure ESM, no DOM). Covers verb lemmatization, noun lemmatization
// with irregular exclusions, Kölner Phonetik, gender prediction, suffix rules,
// and the analyzeText ingestion path used by the Immersion feature.
//
// The lemmatizer/gender predictor are heuristic (documented as best-effort in
// the audit); these tests pin the cases the module handles correctly and the
// invariants (safe on empty/punctuation input), not the known-limitation cases.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lemmatizeVerb,
  koelnerPhonetik,
  getPhoneticSimilarity,
  predictGender,
  getSuffixRule,
  analyzeText,
} from '../js/nlp.js';

test('lemmatizeVerb resolves irregulars and regular conjugations', () => {
  const cases = {
    machst: 'machen',
    ist: 'sein',
    war: 'sein',
    spielte: 'spielen',
    gegangen: 'gehen',
    gespielt: 'spielen',
    tut: 'tun',
    schrieb: 'schreiben',
  };
  for (const [inp, want] of Object.entries(cases)) {
    assert.equal(lemmatizeVerb(inp), want, `${inp} -> ${want}`);
  }
});

test('koelnerPhonetik produces the canonical phonetic codes', () => {
  assert.equal(koelnerPhonetik('Müller'), '657');
  assert.equal(koelnerPhonetik('Schmidt'), '862');
  assert.equal(koelnerPhonetik('Käse'), '48');
});

test('getPhoneticSimilarity is 100 for identical words and symmetric', () => {
  assert.equal(getPhoneticSimilarity('Müller', 'Müller'), 100);
  assert.equal(
    getPhoneticSimilarity('Wein', 'Rhein'),
    getPhoneticSimilarity('Rhein', 'Wein'),
  );
});

test('analyzeText lemmatizes plurals but preserves irregular singulars', () => {
  const lemmaOf = (w) => analyzeText(w, [])[0]?.lemma;
  // Singulars that must NOT be over-lemmatized (irregular exclusions):
  assert.equal(lemmaOf('Käse'), 'Käse');
  assert.equal(lemmaOf('Straße'), 'Straße');
  // Plurals that must be reduced to their singular:
  assert.equal(lemmaOf('Straßen'), 'Straße');
  assert.equal(lemmaOf('Enden'), 'Ende');
  assert.equal(lemmaOf('Frauen'), 'Frau');
  assert.equal(lemmaOf('Schulen'), 'Schule');
  assert.equal(lemmaOf('Gabeln'), 'Gabel');
});

test('predictGender applies German suffix rules', () => {
  const cases = {
    Zeitung: 'die',   // -ung
    Freiheit: 'die',  // -heit
    Nation: 'die',    // -ion
    Mädchen: 'das',   // -chen
    Motor: 'der',     // -or
    Lampe: 'die',     // -e heuristic
    Lehrer: 'der',    // -er heuristic
  };
  for (const [inp, want] of Object.entries(cases)) {
    assert.equal(predictGender(inp), want, `${inp} -> ${want}`);
  }
});

test('getSuffixRule returns the gender rule for suffixed nouns', () => {
  for (const w of ['Zeitung', 'Freiheit', 'Verwaltung']) {
    const rule = getSuffixRule(w);
    assert.ok(rule && rule.gender === 'die', `${w} -> die`);
  }
});

test('analyzeText resolves known dictionary entries with translation', () => {
  const dict = [{ word: 'der Tisch', meaning: 'table', translation: 'table' }];
  const result = analyzeText('Der Tisch ist groß.', dict);
  const tisch = result.find((r) => r.lemma.toLowerCase() === 'tisch');
  assert.ok(tisch, 'Tisch should be recognised');
  assert.equal(tisch.isKnown, true);
});

test('analyzeText filters stopwords and sub-3-char tokens', () => {
  // "und", "im" are stopwords/short; only content words survive.
  const lemmas = analyzeText('und im Haus', []).map((r) => r.lemma.toLowerCase());
  assert.ok(lemmas.includes('haus'), 'content word kept');
  assert.ok(!lemmas.includes('und'), 'stopword dropped');
  assert.ok(!lemmas.includes('im'), 'short token dropped');
});

test('analyzeText is safe on empty and punctuation-only input', () => {
  assert.deepEqual(analyzeText('', []), []);
  assert.deepEqual(analyzeText('!!! ... ,,,', []), []);
});
