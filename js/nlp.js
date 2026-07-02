// js/nlp.js — Zero-Dependency Algorithmic German NLP Engine

const STOPWORDS = new Set([
  'der', 'die', 'das', 'und', 'ist', 'zu', 'ein', 'eine', 'in', 'von', 'es', 'mit', 
  'auf', 'für', 'nicht', 'im', 'sich', 'des', 'den', 'dem', 'an', 'als', 'wie', 'auch', 
  'dass', 'aus', 'werden', 'wird', 'sie', 'er', 'wir', 'ihr', 'ich', 'du', 'sind', 'war', 
  'haben', 'hat', 'bei', 'oder', 'um', 'nur', 'noch', 'über', 'einem', 'einer', 'einen', 
  'nach', 'so', 'was', 'man', 'da', 'wenn', 'zum', 'zur', 'sein', 'seine', 'seiner', 
  'seinen', 'ihre', 'ihrer', 'ihren', 'dann', 'kann', 'können', 'mehr', 'mich', 'mir', 
  'dir', 'dich', 'uns', 'euch', 'ihnen', 'bis', 'alle', 'alles', 'dies', 'diese', 'dieser', 
  'dieses', 'vom', 'am', 'vor', 'aber', 'wieder', 'habe', 'hast', 'bin', 'bist', 'warst', 
  'waren', 'warst', 'ja', 'nein', 'doch', 'schon', 'mal', 'sehr', 'hier', 'dort', 'jetzt',
  'dazu', 'damit', 'darauf', 'darin', 'darüber', 'davon', 'mich', 'dich', 'uns', 'euch', 'ob', 'weil'
]);

/**
 * A targeted set of highly common German singular nouns ending in 'e', 'el', 'er'
 * to prevent false lemmatization and false suffix-stripping.
 */
const IRREGULAR_E_NOUNS = new Set([
  'käse', 'ende', 'auge', 'name', 'straße', 'schule', 'reise', 'frage', 'hilfe', 'woche', 
  'küche', 'tasche', 'flasche', 'blume', 'lampe', 'hose', 'jacke', 'socke', 'tasse', 'suppe', 
  'sonne', 'ecke', 'farbe', 'karte', 'größe', 'nähe', 'liebe', 'kasse', 'pflege', 'menge', 
  'kirche', 'kneipe', 'adresse', 'seite', 'zitrone', 'banane', 'orange', 'birne', 'pflaume', 
  'tomate', 'nase', 'zunge', 'zehe', 'wange', 'fliege', 'biene', 'katze', 'ziege', 'ente', 
  'taube', 'schlange', 'spinne', 'pflanze', 'erde', 'ruhe', 'sorge', 'freude', 'miete', 
  'treppe', 'decke', 'fliese', 'garage', 'gasse', 'brücke', 'haltestelle', 'fahrkarte', 
  'speisekarte', 'kreditkarte', 'postkarte', 'brieftasche', 'badewanne', 'seife', 'zahnbürste', 
  'zahnpasta', 'taschenlampe', 'gabel', 'zwiebel', 'nudel', 'kartoffel', 'regel', 'schachtel'
]);

/**
 * Strips common German plural suffixes to approximate the singular form.
 */
function lemmatizeNoun(word) {
  const wLower = word.toLowerCase();
  
  // If the word itself is already a known singular ending in 'e' or other, leave it untouched
  if (IRREGULAR_E_NOUNS.has(wLower)) {
    return word;
  }
  
  let w = word;
  
  // Handle feminine plurals and dative plurals ending in 'en' or 'n'
  if (w.endsWith('en') && w.length > 4) {
    const withoutN = w.slice(0, -1);
    const withoutNLower = withoutN.toLowerCase();
    // If the word without 'n' is a known 'e'-ending singular, return that
    if (IRREGULAR_E_NOUNS.has(withoutNLower)) {
      return withoutN;
    }
    // Otherwise, strip 'en'
    return w.slice(0, -2);
  }
  
  if (w.endsWith('nen') && w.length > 5) return w.slice(0, -1);
  if (w.endsWith('se') && w.length > 4) return w.slice(0, -1); // Autos -> Auto
  
  // Strip 'n' from plural words ending in 'rn' or 'ln' (e.g. Gabeln -> Gabel, Fehlern -> Fehler)
  if ((w.endsWith('rn') || w.endsWith('ln')) && w.length > 4) {
    return w.slice(0, -1);
  }
  
  if (w.endsWith('s') && w.length > 4 && !w.endsWith('us') && !w.endsWith('is')) return w.slice(0, -1);
  
  // Safe e-stripping for regular plurals (Tische -> Tisch), avoiding words like 'Käse' or 'Ende' if possible.
  if (w.endsWith('e') && w.length > 4 && !w.endsWith('ie') && !w.endsWith('ee')) {
    if (IRREGULAR_E_NOUNS.has(wLower)) {
      return w;
    }
    return w.slice(0, -1); 
  }
  return w;
}

/**
 * Common irregular and modal conjugated forms mapped directly to their infinitives.
 */
const IRREGULAR_VERB_MAP = {
  // sein
  'bin': 'sein', 'bist': 'sein', 'ist': 'sein', 'sind': 'sein', 'seid': 'sein',
  'war': 'sein', 'warst': 'sein', 'waren': 'sein', 'wart': 'sein', 'gewesen': 'sein',
  // haben
  'habe': 'haben', 'hast': 'haben', 'hat': 'haben', 'haben': 'haben', 'habt': 'haben',
  'hatte': 'haben', 'hattest': 'haben', 'hatten': 'haben', 'hattet': 'haben', 'gehabt': 'haben',
  // werden
  'werde': 'werden', 'wirst': 'werden', 'wird': 'werden', 'werden': 'werden', 'werdet': 'werden',
  'wurde': 'werden', 'wurdest': 'werden', 'wurden': 'werden', 'wurdet': 'werden', 'geworden': 'werden',
  // können
  'kann': 'können', 'kannst': 'können', 'können': 'können', 'könnt': 'können',
  'konnte': 'können', 'konntest': 'können', 'konnten': 'können', 'konntet': 'können', 'gekonnt': 'können',
  // müssen
  'muss': 'müssen', 'musst': 'müssen', 'müssen': 'müssen', 'müsst': 'müssen',
  'musste': 'müssen', 'musstest': 'müssen', 'mussten': 'müssen', 'musstet': 'müssen', 'gemusst': 'müssen',
  // wollen
  'will': 'wollen', 'willst': 'wollen', 'wollte': 'wollen', 'wolltest': 'wollen', 'wollten': 'wollen', 'wolltet': 'wollen', 'gewollt': 'wollen',
  // sollen
  'soll': 'sollen', 'sollst': 'sollen', 'sollte': 'sollen', 'solltest': 'sollen', 'sollten': 'sollen', 'solltet': 'sollen', 'gesollt': 'sollen',
  // dürfen
  'darf': 'dürfen', 'darfst': 'dürfen', 'durfte': 'dürfen', 'durftest': 'dürfen', 'durften': 'dürfen', 'durftet': 'dürfen', 'gedurft': 'dürfen',
  // mögen / möchten
  'mag': 'mögen', 'magst': 'mögen', 'mögen': 'mögen', 'mögt': 'mögen',
  'mochte': 'mögen', 'mochtest': 'mögen', 'mochten': 'mögen', 'mochtet': 'mögen', 'gemocht': 'mögen',
  'möchte': 'möchten', 'möchtest': 'möchten', 'möchten': 'möchten', 'möchtet': 'möchten',
  // wissen
  'weiß': 'wissen', 'weißt': 'wissen', 'wissen': 'wissen', 'wisst': 'wissen',
  'wusste': 'wissen', 'wusstest': 'wissen', 'wussten': 'wissen', 'wusstet': 'wissen', 'gewusst': 'wissen',
  // geben
  'gebe': 'geben', 'gibst': 'geben', 'gibt': 'geben', 'geben': 'geben', 'gebt': 'geben',
  'gab': 'geben', 'gabst': 'geben', 'gaben': 'geben', 'gabt': 'geben', 'gegeben': 'geben',
  // sehen
  'sehe': 'sehen', 'siehst': 'sehen', 'sieht': 'sehen', 'sehen': 'sehen', 'seht': 'sehen',
  'sah': 'sehen', 'sahst': 'sehen', 'sahen': 'sehen', 'saht': 'sehen', 'gesehen': 'sehen',
  // lesen
  'lese': 'lesen', 'liest': 'lesen', 'lesen': 'lesen', 'lest': 'lesen',
  'las': 'lesen', 'lasst': 'lesen', 'lasen': 'lesen', 'last': 'lesen', 'gelesen': 'lesen',
  // fahren
  'fahre': 'fahren', 'fährst': 'fahren', 'fährt': 'fahren', 'fahren': 'fahren', 'fahrt': 'fahren',
  'fuhr': 'fahren', 'fuhrst': 'fahren', 'fuhren': 'fahren', 'fuhrt': 'fahren', 'gefahren': 'fahren',
  // laufen
  'laufe': 'laufen', 'läufst': 'laufen', 'läuft': 'laufen', 'laufen': 'laufen', 'lauft': 'laufen',
  'lief': 'laufen', 'liefst': 'laufen', 'liefen': 'laufen', 'lieft': 'laufen', 'gelaufen': 'laufen',
  // sprechen
  'spreche': 'sprechen', 'sprichst': 'sprechen', 'spricht': 'sprechen', 'sprechen': 'sprechen', 'sprecht': 'sprechen',
  'sprach': 'sprechen', 'sprachst': 'sprechen', 'sprachen': 'sprechen', 'spracht': 'sprechen', 'gesprochen': 'sprechen',
  // nehmen
  'nehme': 'nehmen', 'nimmst': 'nehmen', 'nimmt': 'nehmen', 'nehmen': 'nehmen', 'nehmt': 'nehmen',
  'nahm': 'nehmen', 'nahmst': 'nehmen', 'nahmen': 'nehmen', 'nahmt': 'nehmen', 'genommen': 'nehmen',
  // essen
  'esse': 'essen', 'isst': 'essen', 'essen': 'essen', 'esst': 'essen',
  'aß': 'essen', 'aßen': 'essen', 'aßt': 'essen', 'gegessen': 'essen',
  // gehen
  'gehe': 'gehen', 'gehst': 'gehen', 'geht': 'gehen', 'gehen': 'gehen',
  'ging': 'gehen', 'gingst': 'gehen', 'gingen': 'gehen', 'gingt': 'gehen', 'gegangen': 'gehen',
  // kommen
  'komme': 'kommen', 'kommst': 'kommen', 'kommt': 'kommen', 'kommen': 'kommen',
  'kam': 'kommen', 'kamst': 'kommen', 'kamen': 'kommen', 'kamt': 'kommen', 'gekommen': 'kommen',
  // tun
  'tue': 'tun', 'tust': 'tun', 'tut': 'tun', 'tun': 'tun',
  'tat': 'tun', 'tatst': 'tun', 'taten': 'tun', 'tatet': 'tun', 'getan': 'tun',
  // schreiben
  'schreibe': 'schreiben', 'schreibst': 'schreiben', 'schreibt': 'schreiben', 'schreiben': 'schreiben',
  'schrieb': 'schreiben', 'schriebst': 'schreiben', 'schrieben': 'schreiben', 'schriebt': 'schreiben', 'geschrieben': 'schreiben'
};

/**
 * Strips common German conjugation suffixes to approximate the infinitive.
 */
export function lemmatizeVerb(word) {
  let w = word.toLowerCase();
  
  // Direct irregular conjugation lookup
  if (IRREGULAR_VERB_MAP[w]) {
    return IRREGULAR_VERB_MAP[w];
  }
  
  // Weak Präteritum (past tense) and t-stem present ich-forms ending in 'te', 'test', 'ten', 'tet'
  if (w.endsWith('test') && w.length > 5) return w.slice(0, -4) + 'en'; // spieltest -> spielen
  if (w.endsWith('ten') && w.length > 5) return w.slice(0, -3) + 'en';  // spielten -> spielen
  if (w.endsWith('tet') && w.length > 5) return w.slice(0, -3) + 'en';  // spieltet -> spielen
  if (w.endsWith('te') && w.length > 4) return w.slice(0, -2) + 'en';   // spielte -> spielen, sagte -> sagen, arbeite -> arbeiten
  
  // Weak past participle: gespielt -> spielen
  if (w.startsWith('ge') && w.endsWith('t') && w.length > 5) {
      let root = w.slice(2, -1);
      if (root.endsWith('e')) return root + 'n';
      return root + 'en';
  }
  
  // Conjugations
  if (w.endsWith('st') && w.length > 4) return w.slice(0, -2) + 'en'; // machst -> machen
  if (w.endsWith('t') && w.length > 3 && !w.endsWith('eit') && !w.endsWith('mut')) {
      let root = w.slice(0, -1);
      if (root.endsWith('e')) return root + 'n';
      return root + 'en';
  }
  if (w.endsWith('e') && w.length > 3) return w.slice(0, -1) + 'en'; // mache -> machen
  
  if (!w.endsWith('en') && !w.endsWith('rn') && !w.endsWith('ln')) {
      if (w.endsWith('e')) return w + 'n';
      return w + 'en';
  }
  return w;
}

/**
 * Predicts noun gender deterministically based on German suffix rules.
 */
export function predictGender(noun) {
  const lower = noun.toLowerCase();
  
  // Feminine suffixes
  if (lower.endsWith('ung') || lower.endsWith('heit') || lower.endsWith('keit') || 
      lower.endsWith('schaft') || lower.endsWith('ion') || lower.endsWith('tät') ||
      lower.endsWith('ik') || lower.endsWith('ur') || lower.endsWith('enz') || lower.endsWith('ie')) {
    return 'die';
  }
  
  // Neuter suffixes
  if (lower.endsWith('chen') || lower.endsWith('lein') || lower.endsWith('ment') || 
      lower.endsWith('um') || lower.endsWith('ma') || lower.endsWith('nis')) {
    return 'das';
  }
  
  // Masculine suffixes
  if (lower.endsWith('ismus') || lower.endsWith('ig') || lower.endsWith('ling') || 
      lower.endsWith('or') || lower.endsWith('us') || lower.endsWith('ant')) {
    return 'der';
  }
  
  // Heuristics
  if (lower.endsWith('e')) return 'die'; // Very common (die Lampe, die Straße)
  if (lower.endsWith('er')) return 'der'; // Very common (der Lehrer, der Computer)
  
  return 'das'; // Neutral fallback
}

/**
 * Main ingestion function. Parses raw text, filters stopwords, lemmatizes, and predicts properties.
 * Can use a provided knownDictionary (Array of cards) to boost accuracy via local lookup.
 */
export function analyzeText(text, knownDictionary = [], learnedSet = new Set()) {
  // Unicode-aware word boundary matching for German (including Umlauts)
  const rawWords = text.match(/\b[\p{L}\p{M}]+\b/gu) || [];
  
  // Build a fast lookup map for known words to bypass algorithmic guessing
  const dictMap = new Map();
  for (const card of knownDictionary) {
      if (!card.word) continue;
      // Strip articles from dictionary headwords for matching (e.g. "der Tisch" -> "tisch")
      const cleanWord = card.word.replace(/^(der|die|das)\s+/i, '').toLowerCase();
      dictMap.set(cleanWord, card);
  }

  const uniqueLemmas = new Map();
  
  for (const w of rawWords) {
    const lower = w.toLowerCase();
    
    if (STOPWORDS.has(lower)) continue;
    if (w.length < 3) continue; // Skip tiny words
    
    const isCapitalized = w[0] === w[0].toUpperCase();
    
    let lemma = w;
    let pos = isCapitalized ? 'Noun' : 'Other';
    let gender = null;
    let translation = null;
    let isKnown = false;
    let isLearned = false;
    let cardId = null;
    
    // First, try direct lookup
    if (dictMap.has(lower)) {
        const known = dictMap.get(lower);
        lemma = known.word.replace(/^(der|die|das)\s+/i, '');
        if (isCapitalized) {
            const articleMatch = known.word.match(/^(der|die|das)\s+/i);
            gender = articleMatch ? articleMatch[1].toLowerCase() : predictGender(lemma);
        }
        translation = known.translation;
        isKnown = true;
        isLearned = learnedSet.has(Number(known.id));
        cardId = known.id;
    } else {
        // Fallback to algorithmic stripping
        if (isCapitalized) {
          lemma = lemmatizeNoun(w);
          
          // Try lookup again after lemmatization
          if (dictMap.has(lemma.toLowerCase())) {
              const known = dictMap.get(lemma.toLowerCase());
              lemma = known.word.replace(/^(der|die|das)\s+/i, '');
              const articleMatch = known.word.match(/^(der|die|das)\s+/i);
              gender = articleMatch ? articleMatch[1].toLowerCase() : predictGender(lemma);
              translation = known.translation;
              isKnown = true;
              isLearned = learnedSet.has(Number(known.id));
              cardId = known.id;
          } else {
              gender = predictGender(lemma);
          }
        } else {
          lemma = lemmatizeVerb(w);
          if (dictMap.has(lemma.toLowerCase())) {
               const known = dictMap.get(lemma.toLowerCase());
               translation = known.translation;
               isKnown = true;
               isLearned = learnedSet.has(Number(known.id));
               cardId = known.id;
          }
        }
    }
    
    // Ensure nouns are capitalized properly
    if (pos === 'Noun' && lemma.length > 0) {
        lemma = lemma[0].toUpperCase() + lemma.slice(1);
    }
    
    const hashKey = lemma.toLowerCase();
    if (!uniqueLemmas.has(hashKey)) {
       uniqueLemmas.set(hashKey, {
         original: w,
         lemma: lemma,
         pos: pos,
         gender: gender,
         translation: translation || '',
         isKnown: isKnown,
         isLearned: isLearned,
         cardId: cardId
       });
    }
  }
  
  return Array.from(uniqueLemmas.values());
}

/**
 * Encodes a German word phonetically according to the Hans Joachim Postel Cologne Phonetic (Kölner Phonetik) algorithm.
 * @param {string} word - The input German word.
 * @returns {string} The numerical phonetic code representation.
 */
export function koelnerPhonetik(word) {
  if (!word) return "";
  let w = word.toLowerCase();
  
  // Clean string: map umlauts and strip non-alphabetic characters
  w = w.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 's');
  w = w.replace(/[^a-z]/g, '');
  if (w.length === 0) return "";

  const len = w.length;
  const code = [];

  for (let i = 0; i < len; i++) {
    const char = w[i];
    const next = i < len - 1 ? w[i + 1] : '';
    const prev = i > 0 ? w[i - 1] : '';

    switch (char) {
      case 'a': case 'e': case 'i': case 'o': case 'u': case 'y':
        code.push('0');
        break;
      case 'b':
        code.push('1');
        break;
      case 'p':
        if (next === 'h') {
          code.push('3');
        } else {
          code.push('1');
        }
        break;
      case 'd': case 't':
        if (next && 'csz'.includes(next)) {
          code.push('8');
        } else {
          code.push('2');
        }
        break;
      case 'f': case 'v': case 'w':
        code.push('3');
        break;
      case 'g': case 'k': case 'q':
        code.push('4');
        break;
      case 'c':
        if (i === 0) {
          if (next && 'ahklorux'.includes(next)) {
            code.push('4');
          } else {
            code.push('8');
          }
        } else {
          if (prev && 'szgkq'.includes(prev)) {
            code.push('8');
          } else if (next && 'ahkorux'.includes(next)) {
            code.push('4');
          } else {
            code.push('8');
          }
        }
        break;
      case 'x':
        if (prev && 'ckq'.includes(prev)) {
          code.push('8');
        } else {
          code.push('48');
        }
        break;
      case 'l':
        code.push('5');
        break;
      case 'm': case 'n':
        code.push('6');
        break;
      case 'r':
        code.push('7');
        break;
      case 's': case 'z':
        code.push('8');
        break;
      case 'h':
        // Ignored
        break;
      default:
        break;
    }
  }

  if (code.length === 0) return "";

  // Post-processing:
  // 1. Remove duplicate adjacent codes (e.g. 55 -> 5)
  // 2. Remove all '0' codes except at index 0
  const result = [code[0]];
  for (let i = 1; i < code.length; i++) {
    if (code[i] !== code[i - 1]) {
      result.push(code[i]);
    }
  }

  const finalCode = [result[0]];
  for (let i = 1; i < result.length; i++) {
    if (result[i] !== '0') {
      finalCode.push(result[i]);
    }
  }

  return finalCode.join("");
}

/**
 * Compares two German words phonetically and returns a similarity score from 0 to 100.
 * @param {string} word1 
 * @param {string} word2 
 * @returns {number} Score from 0 to 100
 */
export function getPhoneticSimilarity(word1, word2) {
  const code1 = koelnerPhonetik(word1);
  const code2 = koelnerPhonetik(word2);
  if (!code1 || !code2) return 0;
  if (code1 === code2) return 100;

  const dist = levenshteinDistance(code1, code2);
  const maxLen = Math.max(code1.length, code2.length);
  return Math.round((1 - dist / maxLen) * 100);
}

function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,    // Deletion
          dp[i][j - 1] + 1,    // Insertion
          dp[i - 1][j - 1] + 1 // Substitution
        );
      }
    }
  }
  return dp[m][n];
}

/**
 * Analyzes word endings on-the-fly and returns associated grammar rules.
 * @param {string} word 
 * @returns {object|null} Suffix rule object or null
 */
export function getSuffixRule(word, wordClass = null) {
  if (!word) return null;
  if (wordClass && !['nomen', 'noun'].includes(wordClass.toLowerCase())) {
    return null;
  }
  const lower = word.toLowerCase();

  // Noun suffix matching (ordered longest to shortest for specificity)
  const rules = [
    { suffix: 'schaft', gender: 'die', rule: 'Nouns ending in "-schaft" express relationships, groups, or qualities and are always feminine.', badgeText: 'FEMININ (die)' },
    { suffix: 'ismus', gender: 'der', rule: 'Nouns ending in "-ismus" express doctrines, theories, or concepts of Latin/Greek origin and are always masculine.', badgeText: 'MASCULINE (der)' },
    { suffix: 'heit', gender: 'die', rule: 'Nouns ending in "-heit" form abstract concepts from adjectives and are always feminine.', badgeText: 'FEMININ (die)' },
    { suffix: 'keit', gender: 'die', rule: 'Nouns ending in "-keit" form abstract concepts from adjectives and are always feminine.', badgeText: 'FEMININ (die)' },
    { suffix: 'chen', gender: 'das', rule: 'Nouns ending in "-chen" are diminutives (making things smaller/cuter) and are always neuter.', badgeText: 'NEUTRAL (das)' },
    { suffix: 'lein', gender: 'das', rule: 'Nouns ending in "-lein" are diminutives (making things smaller/cuter) and are always neuter.', badgeText: 'NEUTRAL (das)' },
    { suffix: 'ment', gender: 'das', rule: 'Nouns ending in "-ment" are of Latin/French origin and are always neuter.', badgeText: 'NEUTRAL (das)' },
    { suffix: 'enz', gender: 'die', rule: 'Nouns ending in "-enz" are loanwords of Latin origin and are always feminine.', badgeText: 'FEMININ (die)' },
    { suffix: 'ung', gender: 'die', rule: 'Nouns ending in "-ung" are derived from verbs and are always feminine.', badgeText: 'FEMININ (die)' },
    { suffix: 'ion', gender: 'die', rule: 'Nouns ending in "-ion" are loanwords of Latin origin and are always feminine.', badgeText: 'FEMININ (die)' },
    { suffix: 'tät', gender: 'die', rule: 'Nouns ending in "-tät" are loanwords of Latin origin and are always feminine.', badgeText: 'FEMININ (die)' },
    { suffix: 'ling', gender: 'der', rule: 'Nouns ending in "-ling" indicate people or things related to a property and are always masculine.', badgeText: 'MASCULINE (der)' },
    { suffix: 'ant', gender: 'der', rule: 'Nouns ending in "-ant" are loanwords of Latin/French origin and are always masculine.', badgeText: 'MASCULINE (der)' },
    { suffix: 'nis', gender: 'das', rule: 'Nouns ending in "-nis" express a state, action, or result and are almost always neuter.', badgeText: 'NEUTRAL (das)' },
    { suffix: 'ig', gender: 'der', rule: 'Nouns ending in "-ig" are masculine.', badgeText: 'MASCULINE (der)' },
    { suffix: 'or', gender: 'der', rule: 'Nouns ending in "-or" indicate actors, instruments, or agents of Latin origin and are always masculine.', badgeText: 'MASCULINE (der)' },
    { suffix: 'us', gender: 'der', rule: 'Nouns ending in "-us" are masculine.', badgeText: 'MASCULINE (der)' },
    { suffix: 'um', gender: 'das', rule: 'Nouns ending in "-um" are loanwords of Latin origin and are always neuter.', badgeText: 'NEUTRAL (das)' },
    { suffix: 'ma', gender: 'das', rule: 'Nouns ending in "-ma" are loanwords of Greek origin and are always neuter.', badgeText: 'NEUTRAL (das)' },
    { suffix: 'ur', gender: 'die', rule: 'Nouns ending in "-ur" are loanwords of Latin origin and are always feminine.', badgeText: 'FEMININ (die)' },
    { suffix: 'ik', gender: 'die', rule: 'Nouns ending in "-ik" indicate sciences, arts, or systems of Greek/Latin origin and are always feminine.', badgeText: 'FEMININ (die)' },
    { suffix: 'in', gender: 'die', rule: 'Nouns ending in "-in" denote female professions or nationalities and are always feminine.', badgeText: 'FEMININ (die)' },
    { suffix: 'er', gender: 'der', rule: 'Nouns ending in "-er" commonly denote male professions, nationalities, agents, or tools and are usually masculine.', badgeText: 'MASCULINE (der) (heuristic)' },
    { suffix: 'e', gender: 'die', rule: 'Most nouns ending in "-e" are feminine (roughly 90%).', badgeText: 'FEMININ (die) (heuristic)' }
  ];

  for (const r of rules) {
    if (lower.endsWith(r.suffix) && word.length > r.suffix.length) {
      return r;
    }
  }
  return null;
}


