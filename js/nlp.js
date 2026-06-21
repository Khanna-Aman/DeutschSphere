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
 * Strips common German plural suffixes to approximate the singular form.
 */
function lemmatizeNoun(word) {
  let w = word;
  if (w.endsWith('nen') && w.length > 5) return w.slice(0, -1);
  if (w.endsWith('se') && w.length > 4) return w.slice(0, -1); // Autos -> Auto
  if (w.endsWith('en') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('s') && w.length > 4 && !w.endsWith('us') && !w.endsWith('is')) return w.slice(0, -1);
  // Safe e-stripping for regular plurals (Tische -> Tisch), avoiding words like 'Käse' or 'Ende' if possible (hard algorithmically).
  if (w.endsWith('e') && w.length > 4 && !w.endsWith('ie') && !w.endsWith('ee')) return w.slice(0, -1); 
  return w;
}

/**
 * Strips common German conjugation suffixes to approximate the infinitive.
 */
export function lemmatizeVerb(word) {
  let w = word.toLowerCase();
  
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
        if ('csz'.includes(next)) {
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
          if ('ahklorux'.includes(next)) {
            code.push('4');
          } else {
            code.push('8');
          }
        } else {
          if ('szgkq'.includes(prev)) {
            code.push('8');
          } else if ('ahkorux'.includes(next)) {
            code.push('4');
          } else {
            code.push('8');
          }
        }
        break;
      case 'x':
        if ('ckq'.includes(prev)) {
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

/**
 * Generates rule-based or database-mapped German verb conjugations.
 * @param {string} verb - The base verb.
 * @returns {object} Object with conjugation forms.
 */
export function generateVerbConjugation(verb) {
  const v = verb.trim().toLowerCase();
  
  // High-accuracy irregular and modal verbs database
  const irregularDB = {
    'sein': { ich: 'bin', du: 'bist', er: 'ist', wir: 'sind', ihr: 'seid', sie: 'sind' },
    'haben': { ich: 'habe', du: 'hast', er: 'hat', wir: 'haben', ihr: 'habt', sie: 'haben' },
    'werden': { ich: 'werde', du: 'wirst', er: 'wird', wir: 'werden', ihr: 'werdet', sie: 'werden' },
    'können': { ich: 'kann', du: 'kannst', er: 'kann', wir: 'können', ihr: 'könnt', sie: 'können' },
    'müssen': { ich: 'muss', du: 'musst', er: 'muss', wir: 'müssen', ihr: 'müsst', sie: 'müssen' },
    'wollen': { ich: 'will', du: 'willst', er: 'will', wir: 'wollen', ihr: 'wollt', sie: 'wollen' },
    'sollen': { ich: 'soll', du: 'sollst', er: 'soll', wir: 'sollen', ihr: 'sollt', sie: 'sollen' },
    'dürfen': { ich: 'darf', du: 'darfst', er: 'darf', wir: 'dürfen', ihr: 'dürft', sie: 'dürfen' },
    'mögen': { ich: 'mag', du: 'magst', er: 'mag', wir: 'mögen', ihr: 'mögt', sie: 'mögen' },
    'möchten': { ich: 'möchte', du: 'möchtest', er: 'möchte', wir: 'möchten', ihr: 'möchtet', sie: 'möchten' },
    'wissen': { ich: 'weiß', du: 'weißt', er: 'weiß', wir: 'wissen', ihr: 'wisst', sie: 'wissen' },
    'geben': { ich: 'gebe', du: 'gibst', er: 'gibt', wir: 'geben', ihr: 'gebt', sie: 'geben' },
    'sehen': { ich: 'sehe', du: 'siehst', er: 'sieht', wir: 'sehen', ihr: 'seht', sie: 'sehen' },
    'lesen': { ich: 'lese', du: 'liest', er: 'liest', wir: 'lesen', ihr: 'lest', sie: 'lesen' },
    'fahren': { ich: 'fahre', du: 'fährst', er: 'fährt', wir: 'fahren', ihr: 'fahrt', sie: 'fahren' },
    'laufen': { ich: 'laufe', du: 'läufst', er: 'läuft', wir: 'laufen', ihr: 'lauft', sie: 'laufen' },
    'sprechen': { ich: 'spreche', du: 'sprichst', er: 'spricht', wir: 'sprechen', ihr: 'sprecht', sie: 'sprechen' },
    'nehmen': { ich: 'nehme', du: 'nimmst', er: 'nimmt', wir: 'nehmen', ihr: 'nehmt', sie: 'nehmen' },
    'essen': { ich: 'esse', du: 'isst', er: 'isst', wir: 'essen', ihr: 'esst', sie: 'essen' },
    'tragen': { ich: 'trage', du: 'trägst', er: 'trägt', wir: 'tragen', ihr: 'tragt', sie: 'tragen' },
    'schlafen': { ich: 'schlafe', du: 'schläfst', er: 'schläft', wir: 'schlafen', ihr: 'schlaft', sie: 'schlafen' }
  };

  if (irregularDB[v]) {
    return irregularDB[v];
  }

  // Fallback to regular weak conjugation
  let stem = v;
  let isRnLn = false;
  if (v.endsWith('en')) {
    stem = v.slice(0, -2);
  } else if (v.endsWith('rn') || v.endsWith('ln')) {
    stem = v.slice(0, -1);
    isRnLn = true;
  }

  // Ending rules
  const lastChar = stem.slice(-1);
  const secondLastChar = stem.length > 1 ? stem.slice(-2, -1) : '';
  
  // Stems ending in d, t or consonant + n/m (but not r/l + n/m) insert 'e' before st, t, et
  const needsEInsert = lastChar === 'd' || lastChar === 't' || 
                       (lastChar === 'n' && !'rl'.includes(secondLastChar) && !'aeiouäöü'.includes(secondLastChar));

  const sEnding = 'sßzx'.includes(lastChar) ? 't' : 'st';

  const ich = stem + 'e';
  const du = needsEInsert ? stem + 'est' : stem + sEnding;
  const er = needsEInsert ? stem + 'et' : stem + 't';
  const wir = isRnLn ? stem + 'n' : stem + 'en';
  const ihr = needsEInsert ? stem + 'et' : stem + 't';
  const sie = isRnLn ? stem + 'n' : stem + 'en';

  return { ich, du, er, wir, ihr, sie };
}

/**
 * Generates adjective declension endings across definite, indefinite, and zero articles.
 * @param {string} adj - The base adjective.
 * @returns {object} Object structured by article type -> case -> gender.
 */
export function generateAdjectiveDeclension(adj) {
  let stem = adj.trim().toLowerCase();
  
  // Phonetic stem adjustments (e.g. dunkel -> dunkl, teuer -> teur)
  if (stem.endsWith('el')) {
    stem = stem.slice(0, -2) + 'l';
  } else if (stem.endsWith('er') && (stem.endsWith('teuer') || stem.endsWith('sauer'))) {
    stem = stem.slice(0, -2) + 'r';
  } else if (stem === 'hoch') {
    stem = 'hoh'; // hoch -> hohe, hohen
  }

  // Declension schemes (Definite=Weak, Indefinite=Mixed, Zero=Strong)
  const weak = {
    nom: { m: 'e', f: 'e', n: 'e', p: 'en' },
    akk: { m: 'en', f: 'e', n: 'e', p: 'en' },
    dat: { m: 'en', f: 'en', n: 'en', p: 'en' },
    gen: { m: 'en', f: 'en', n: 'en', p: 'en' }
  };

  const mixed = {
    nom: { m: 'er', f: 'e', n: 'es', p: 'en' },
    akk: { m: 'en', f: 'e', n: 'es', p: 'en' },
    dat: { m: 'en', f: 'en', n: 'en', p: 'en' },
    gen: { m: 'en', f: 'en', n: 'en', p: 'en' }
  };

  const strong = {
    nom: { m: 'er', f: 'e', n: 'es', p: 'e' },
    akk: { m: 'en', f: 'e', n: 'es', p: 'e' },
    dat: { m: 'em', f: 'er', n: 'em', p: 'en' },
    gen: { m: 'en', f: 'er', n: 'en', p: 'er' }
  };

  const mapEndings = (scheme) => {
    const result = {};
    for (const [kase, genders] of Object.entries(scheme)) {
      result[kase] = {};
      for (const [gender, ending] of Object.entries(genders)) {
        result[kase][gender] = stem + ending;
      }
    }
    return result;
  };

  return {
    definite: mapEndings(weak),
    indefinite: mapEndings(mixed),
    zero: mapEndings(strong)
  };
}
