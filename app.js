// app.js — Weimar-themed German Vocabulary SPA ES6 Module Orchestrator
import {
  state,
  elements,
  categoryTranslations,
  getCategoryIcon,
  trackVisitedLevels,
  sortDeckBySRS,
  shuffleArray,
  safeJsonParse,
  safeSetItem,
  safeGetItem,
  migrateToFSRS,
  startSession,
  initProfileData,
  reviewCardSRS
} from './js/state.js';

import {
  initTTS,
  warmUpTTS,
  speakWord,
  stopAudioTrainer,
  toggleAudioTrainer,
  toggleTrainerLoop,
  speakText,
  playSnapHaptic,
  startFocusSound,
  stopFocusSound,
  playAchievementChime
} from './js/audio.js';

import {
  initStatsView,
  updateOverallStats,
  exportBackup,
  importBackup,
  unlockAchievement,
  copySyncKey,
  restoreSyncKey
} from './js/stats.js';

import {
  renderCard,
  nextCard,
  prevCard,
  toggleShuffle,
  toggleLearned,
  toggleReadMode,
  toggleHideLearned,
  toggleAutoplay,
  toggleImages,
  updateImagesToggleUI,
  toggleDeckPrefs,
  closeDeckPrefs,
  togglePhoneticMirror,
  closePhoneticMirror,
  togglePhoneticRecording,
  toggleAccordion
} from './js/flashcards.js';

import {
  initQuizView,
  initQuiz,
  checkSpellingAnswer,
  nextQuizQuestion,
  showQuizResults,
  retryQuiz,
  quitQuiz,
  handleMCOptionClick
} from './js/quiz.js';

import {
  initAdventureView,
  startScenario,
  resetAdventureSentence,
  checkAdventureAnswer,
  nextAdventureNode,
  quitAdventureScenario,
  speakAdventureNpcSentence,
  addAdventureXP
} from './js/adventure.js';

import {
  initWeaverView,
  startWeaverGame,
  resetWeaverSentence,
  quitWeaverGame,
  submitWeaverSentence,
  nextWeaverSentence
} from './js/weaver.js';

import {
  initImmersionView
} from './js/immersion.js';

import { CHEATCODES_DATABASE } from './js/cheatcodes_db.js';

// Local/Global Cheatcode search state
let currentCheatcodeTab = 'all';
let cheatcodeSearchQuery = '';

// V3: Register CustomEvent listeners for SRS module decoupling (replaces window.*External bridge)
let srsUpdateTimeout = null;
function handleSRSUpdate(e) {
  if (srsUpdateTimeout) cancelAnimationFrame(srsUpdateTimeout);
  srsUpdateTimeout = requestAnimationFrame(() => {
    updateOverallStats();
    renderSidebarCategories();
  });
}
window.removeEventListener('srs:card-updated', handleSRSUpdate);
window.addEventListener('srs:card-updated', handleSRSUpdate);

window.addEventListener('srs:achievement', (e) => {
  if (e.detail && e.detail.id) unlockAchievement(e.detail.id);
});

// V3: CustomEvent listeners for module decoupling (replaces window.*External bridges)
window.addEventListener('deck:filter-request', (e) => {
  const resetIndex = e.detail?.resetIndex ?? false;
  filterDeck(resetIndex);
});
window.addEventListener('audio:stop-trainer', () => {
  stopAudioTrainer();
});
// Keep theme hooks global for inline script access
window.applyTheme = applyTheme;
window.initTheme = initTheme;

// ==========================================
// THEME CUSTOMIZER ENGINE
// ==========================================

function initTheme() {
  const savedTheme = safeGetItem('current_theme', '');
  
  if (!savedTheme) {
    // V3: First visit — auto-detect system color scheme preference
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    const autoTheme = prefersLight ? 'weimar' : 'default';
    applyTheme(autoTheme);
    if (elements.themeSelect) elements.themeSelect.value = autoTheme;
    return;
  }
  
  applyTheme(savedTheme);
  
  if (elements.themeSelect) {
    elements.themeSelect.value = savedTheme;
  }
}

function applyTheme(theme) {
  document.body.classList.remove('theme-cyberpunk', 'theme-schwarzwald', 'theme-oktoberfest', 'theme-weimar');
  if (theme !== 'default') {
    document.body.classList.add(`theme-${theme}`);
  }
  safeSetItem('current_theme', theme);
}

// ==========================================
// COLLAPSIBLE KEYBOARD SHORTCUTS GUIDE
// ==========================================

function initShortcutsToggle() {
  const btn = document.getElementById('toggle-shortcuts-btn');
  const content = document.getElementById('shortcuts-content');
  const icon = document.getElementById('shortcuts-toggle-icon');
  
  if (btn && content && icon) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const isHidden = content.classList.contains('hidden');
      if (isHidden) {
        content.classList.remove('hidden');
        icon.classList.add('rotate-180');
      } else {
        content.classList.add('hidden');
        icon.classList.remove('rotate-180');
      }
    });
  }
}

// ==========================================
// CEFR LEVEL AND CURRICULUM CONTROLLER
// ==========================================

async function changeLevel(level) {
  // Stop continuous trainer on level change
  if (state.trainer && state.trainer.active) {
    stopAudioTrainer();
  }

  // Show loader
  elements.loaderOverlay.classList.remove('hidden', 'opacity-0');
  
  // Reset index and categories
  state.currentLevel = level;
  state.activeCategory = 'All';
  state.searchQuery = '';
  if (elements.searchInput) {
    elements.searchInput.value = '';
    elements.searchClear.classList.add('hidden');
  }
  
  safeSetItem('current_level', level);
  
  // Track visited levels for achievements
  trackVisitedLevels();
  
  // Reload level-scoped learned cards
  state.learnedCards = new Set(safeJsonParse(`learned_cards_${level}`, []).map(id => Number(id)));
  state.srs = safeJsonParse(`srs_state_${level}`, {});
  migrateToFSRS(); // Auto-migrate Leitner data to FSRS format
  
  // Update UI indicators
  updateLevelUI();
  
  // Re-fetch data
  await fetchData();

  // Dynamically refresh active route (Flashcards, Quiz, Cheatcodes, or Stats) with newly loaded level data
  handleRouting();
}

function updateLevelUI() {
  const levelUpper = state.currentLevel.toUpperCase(); // 'A1', 'A2', 'B1'
  
  // Update elements with class 'level-title'
  const titles = document.querySelectorAll('.level-title');
  titles.forEach(el => {
    el.textContent = `German ${levelUpper}`;
  });
  
  // Update page title
  document.title = `German ${levelUpper} Flashcards`;
  
  // Sync selector value
  if (elements.levelSelect) {
    elements.levelSelect.value = state.currentLevel;
  }
}

// ==========================================
// DATA ACQUISITION & NORMALIZATION ENGINE
// ==========================================

function getConsolidatedCategory(rawTheme, word, wordClass, meaning) {
  const t_raw = (rawTheme || '').trim();
  
  // Quick exact match short-circuit for physically canonicalized datasets
  const canonicalCategories = [
    'Person & Familie',
    'Wohnen & Haushalt',
    'Gesundheit & Körper',
    'Natur & Umwelt',
    'Reise & Verkehr',
    'Essen & Trinken',
    'Einkaufen & Konsum',
    'Dienstleistungen & Behörden',
    'Ausbildung & Lernen',
    'Arbeit & Beruf',
    'Freizeit & Unterhaltung',
    'Zeit, Maße & Basiswortschatz'
  ];
  
  const exactMatch = canonicalCategories.find(cat => cat.toLowerCase() === t_raw.toLowerCase());
  if (exactMatch) {
    return exactMatch;
  }

  const t = t_raw.toLowerCase();
  const w = (word || '').toLowerCase().trim();
  const m = (meaning || '').toLowerCase().trim();
  const wc = (wordClass || '').toLowerCase().trim();

  // Helper matching lists
  const foodKeywords = ['essen', 'trink', 'küche', 'gemüse', 'obst', 'kochen', 'restaurant', 'gastronomie', 'ernährung', 'nahrung', 'speise', 'mahlzeit', 'bäckerei', 'bier', 'fleisch', 'fisch', 'banane', 'gemuese', 'wein', 'kaffee', 'tee', 'frühstück', 'mittagessen', 'abendessen', 'lecker', 'hung', 'durst'];
  const healthKeywords = ['gesund', 'körper', 'arzt', 'ärzt', 'krank', 'apotheke', 'fieber', 'bad', 'pflege', 'medizin', 'schmerz', 'unfall', 'klinik', 'spital', 'husten', 'schnupfen', 'tablette', 'rezept', 'therapie', 'verletz', 'blut', 'auge', 'ohr', 'mund', 'zahn', 'kopf', 'bein', 'arm', 'hand', 'fuß', 'bauch', 'herz', 'körperpflege', 'koerperpflege'];
  const travelKeywords = ['reisen', 'reise', 'verkehr', 'bahn', 'zug', 'bus', 'flug', 'auto', 'fahrrad', 'schiff', 'ticket', 'fahrkarte', 'hotel', 'touris', 'pension', 'urlaub', 'gepäck', 'koffer', 'bahnhof', 'flughafen', 'abfahrt', 'ankunft', 'stau', 'strasse', 'straße', 'kreuzung', 'ampel', 'gleis', 'reisebüro', 'ausflug', 'landkarte', 'plan', 'ticket', 'pass', 'visum'];
  const shopKeywords = ['einkauf', 'konsum', 'laden', 'geschäft', 'preis', 'bezahl', 'kauf', 'geld', 'euro', 'cent', 'billig', 'teuer', 'kosten', 'rabatt', 'angebot', 'supermarkt', 'markt', 'tasche', 'kleidung', 'kleid', 'hose', 'schuh', 'hemd', 'jacke', 'mantel', 'rock', 'anzug', 'material', 'stoff', 'leder', 'wolle', 'seide', 'baumwolle', 'plastik', 'metall', 'holz', 'glas', 'papier'];
  const workKeywords = ['arbeit', 'beruf', 'firma', 'job', 'karriere', 'kollege', 'büro', 'bewerb', 'chef', 'angestellte', 'meister', 'kolleg', 'werkstatt', 'fabrik', 'gehalt', 'lohn', 'vertrag', 'kündig', 'streik', 'arbeitsplatz', 'arbeitslos', 'überstunde', 'lebenslauf', 'praktikum', 'gehalt', 'berufstätig'];
  const educationKeywords = ['schule', 'lernen', 'ausbildung', 'stud', 'universität', 'uni', 'klasse', 'unterricht', 'sprache', 'buch', 'bücher', 'bucht', 'bildung', 'lehrer', 'schüler', 'schueler', 'prüfung', 'pruefung', 'aufgabe', 'hausaufgabe', 'fehler', 'kurs', 'zeugnis', 'diplom', 'fach', 'mathematik', 'rechnen', 'schreiben', 'lesen', 'vokabel', 'wörterbuch'];
  const homeKeywords = ['wohn', 'haus', 'zimmer', 'möbel', 'miete', 'einricht', 'haushalt', 'werkzeug', 'architekt', 'gebäude', 'gebaeude', 'küche', 'bad', 'balkon', 'garten', 'tisch', 'stuhl', 'bett', 'schrank', 'regal', 'sofa', 'lampe', 'tür', 'fenster', 'schlüssel', 'heizung', 'strom', 'wasser', 'nachbar', 'vermieter'];
  const natureKeywords = ['natur', 'umwelt', 'wetter', 'klima', 'tier', 'pflanze', 'sauber', 'erde', 'garten', 'landschaft', 'wind', 'regen', 'schnee', 'sonne', 'temperatur', 'grad', 'himmel', 'stern', 'mond', 'wald', 'berg', 'see', 'meer', 'fluss', 'baum', 'blume', 'katze', 'hund', 'vogel', 'pferd', 'kuh', 'sauberkeit', 'schmutz', 'müll', 'abfall'];
  const leisureKeywords = ['freizeit', 'unterhalt', 'spiel', 'sport', 'hobby', 'musik', 'film', 'kino', 'museum', 'kunst', 'kultur', 'literatur', 'lesen', 'fest', 'feier', 'geburtstag', 'tanzen', 'singen', 'theater', 'konzert', 'ausstellung', 'malen', 'foto', 'kamera', 'fernseher', 'radio', 'schach', 'fussball', 'fußball', 'schwimmen', 'wandern', 'reisen', 'urlaub'];
  const servicesKeywords = ['dienst', 'behörde', 'amt', 'ämter', 'polizei', 'post', 'telekom', 'bank', 'finanz', 'steuer', 'recht', 'politik', 'staat', 'gesellschaft', 'sicherheit', 'notfall', 'notfälle', 'notfaelle', 'arzt', 'krankenhaus', 'feuerwehr', 'rathaus', 'konsulat', 'botschaft', 'ausweis', 'formular', 'unterschrift', 'gebühr', 'geld', 'konto', 'überweisen', 'karte', 'brief', 'paket', 'stempel', 'telefon', 'handy', 'internet', 'computer', 'e-mail', 'mail', 'anwalt', 'gericht', 'gesetz', 'versicherung'];
  const familyKeywords = ['person', 'familie', 'freund', 'kind', 'eltern', 'partner', 'beziehung', 'charakter', 'gefühl', 'gefuehl', 'identität', 'alter', 'aussehen', 'kommunikation', 'begrüß', 'begruess', 'meinung', 'gedanke', 'denken', 'entscheid', 'heirat', 'hochzeit', 'mann', 'frau', 'bruder', 'schwester', 'mutter', 'vater', 'sohn', 'tochter', 'onkel', 'tante', 'nichte', 'neffe', 'großeltern', 'oma', 'opa', 'enkel', 'geburt', 'tod', 'sterben', 'leben', 'liebe', 'hass', 'wut', 'angst', 'freude', 'glück', 'trauer', 'streit', 'gespräch', 'diskussion', 'sagen', 'sprechen', 'erzählen', 'fragen', 'antworten', 'verstehen'];

  // Let's do an exact match test for common composite/split themes
  if (t.includes('essen') || t.includes('trink') || t.includes('koche') || t.includes('gemüse') || t.includes('obst') || t.includes('restaurant') || t.includes('küche')) {
    return 'Essen & Trinken';
  }
  if (t.includes('gesund') || t.includes('körper') || t.includes('arzt') || t.includes('krank') || t.includes('apotheke') || t.includes('pflege') || t.includes('schmerz') || t.includes('bad')) {
    return 'Gesundheit & Körper';
  }
  if (t.includes('reise') || t.includes('verkehr') || t.includes('hotel') || t.includes('flug') || t.includes('zug') || t.includes('bahn') || t.includes('auto') || t.includes('fahrrad') || t.includes('schiff')) {
    return 'Reise & Verkehr';
  }
  if (t.includes('einkauf') || t.includes('laden') || t.includes('geschäft') || t.includes('preis') || t.includes('bezahl') || t.includes('kleidung') || t.includes('kleid') || t.includes('hose') || t.includes('schuh') || t.includes('ware')) {
    return 'Einkaufen & Konsum';
  }
  if (t.includes('arbeit') || t.includes('beruf') || t.includes('job') || t.includes('firma') || t.includes('kolleg') || t.includes('büro')) {
    return 'Arbeit & Beruf';
  }
  if (t.includes('schule') || t.includes('lernen') || t.includes('ausbildung') || t.includes('stud') || t.includes('uni') || t.includes('klasse') || t.includes('unterricht') || t.includes('bildung') || t.includes('sprache')) {
    return 'Ausbildung & Lernen';
  }
  if (t.includes('wohn') || t.includes('haus') || t.includes('zimmer') || t.includes('möbel') || t.includes('miete') || t.includes('haushalt') || t.includes('werkzeug') || t.includes('gebäude') || t.includes('einricht')) {
    return 'Wohnen & Haushalt';
  }
  if (t.includes('natur') || t.includes('umwelt') || t.includes('wetter') || t.includes('klima') || t.includes('tier') || t.includes('pflanze') || t.includes('garten') || t.includes('sauber') || t.includes('sauberkeit')) {
    return 'Natur & Umwelt';
  }
  if (t.includes('freizeit') || t.includes('unterhalt') || t.includes('spiel') || t.includes('sport') || t.includes('hobby') || t.includes('musik') || t.includes('film') || t.includes('kino') || t.includes('kunst') || t.includes('kultur') || t.includes('fest') || t.includes('literatur') || t.includes('lesen')) {
    return 'Freizeit & Unterhaltung';
  }
  if (t.includes('amt') || t.includes('ämter') || t.includes('behörde') || t.includes('polizei') || t.includes('post') || t.includes('telekom') || t.includes('bank') || t.includes('finanz') || t.includes('steuer') || t.includes('recht') || t.includes('politik') || t.includes('dienst') || t.includes('sicherheit') || t.includes('notfall')) {
    return 'Dienstleistungen & Behörden';
  }
  if (t.includes('person') || t.includes('familie') || t.includes('kind') || t.includes('eltern') || t.includes('partner') || t.includes('beziehung') || t.includes('charakter') || t.includes('gefühl') || t.includes('kommunikation') || t.includes('meinung') || t.includes('gedanke') || t.includes('denken')) {
    return 'Person & Familie';
  }

  // Handle specific money/buying contexts in raw theme text
  if (t.includes('geld') || t.includes('bank') || t.includes('finanz') || t.includes('bezahl') || t.includes('preis')) {
    if (t.includes('bank') || t.includes('finanz')) return 'Dienstleistungen & Behörden';
    return 'Einkaufen & Konsum';
  }

  // Handle specific time/date contexts in raw theme text
  if (t.includes('zeit') || t.includes('datum') || t.includes('uhr') || t.includes('zahl') || t.includes('maß') || t.includes('menge')) {
    if (t.includes('freizeit')) return 'Freizeit & Unterhaltung';
    return 'Zeit, Maße & Basiswortschatz';
  }

  // Fallback keyword search on German word / English meaning / wordClass
  const matchAny = (list, words) => words.some(word => list.some(item => word.includes(item)));
  const searchTerms = [w, m];

  if (matchAny(foodKeywords, searchTerms)) return 'Essen & Trinken';
  if (matchAny(healthKeywords, searchTerms)) return 'Gesundheit & Körper';
  if (matchAny(travelKeywords, searchTerms)) return 'Reise & Verkehr';
  if (matchAny(shopKeywords, searchTerms)) return 'Einkaufen & Konsum';
  if (matchAny(workKeywords, searchTerms)) return 'Arbeit & Beruf';
  if (matchAny(educationKeywords, searchTerms)) return 'Ausbildung & Lernen';
  if (matchAny(homeKeywords, searchTerms)) return 'Wohnen & Haushalt';
  if (matchAny(natureKeywords, searchTerms)) return 'Natur & Umwelt';
  if (matchAny(leisureKeywords, searchTerms)) return 'Freizeit & Unterhaltung';
  if (matchAny(servicesKeywords, searchTerms)) return 'Dienstleistungen & Behörden';
  if (matchAny(familyKeywords, searchTerms)) return 'Person & Familie';

  // Base fallback categories based on word characteristics (Time, Numbers, Grammar / Basic Vocab)
  const numbers = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig', 'hundert', 'tausend', 'million', 'milliarde', 'erste', 'zweite', 'dritte', 'vierte'];
  const datesTime = ['januar', 'februar', 'märz', 'maerz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag', 'wochenende', 'uhr', 'minute', 'sekunde', 'stunde', 'jahr', 'monat', 'woche', 'tag', 'morgen', 'vormittag', 'mittag', 'nachmittag', 'abend', 'nacht', 'heute', 'gestern', 'morgen', 'früh', 'spät', 'datum', 'zeit'];

  if (wc === 'number' || numbers.some(num => w === num) || m.includes('number') || m.includes('numeral')) {
    return 'Zeit, Maße & Basiswortschatz';
  }
  if (datesTime.some(dt => w.includes(dt) || m.includes(dt)) || t.includes('zeit') || t.includes('datum')) {
    return 'Zeit, Maße & Basiswortschatz';
  }
  if (wc === 'pronoun' || wc === 'preposition' || wc === 'conjunction' || wc === 'article' || wc === 'adverb') {
    return 'Zeit, Maße & Basiswortschatz';
  }

  // Ultimate fallback to Zeit, Maße & Basiswortschatz
  return 'Zeit, Maße & Basiswortschatz';
}

async function fetchData() {
  try {
    const level = state.currentLevel;
    const response = await fetch(`./${level}/wordlist.json`);
    if (!response.ok) {
      throw new Error(`HTTP status error: ${response.status}`);
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error("Invalid format: Wordlist must be a JSON array.");
    }
    
    // Normalization with defensive code paths
    state.allCards = data.map((item, index) => {
      const word = (item.german || item.word || item.term || 'Unbekannt').trim();
      const meaning = (item.english || item.meaning || item.translation || item.definition || item.english_translation || 'No translation').trim();
      
      const wordClass = item.word_class || item.class || item.type || null;
      let gender = item.gender || null;
      if (gender) {
        gender = gender.toLowerCase().trim();
        if (gender !== 'der' && gender !== 'die' && gender !== 'das') {
          gender = null;
        }
      }
      
      const plural = item.plural || null;
      const antonym = item.antonym || item.opposite || null;
      const pronunciation = item.pronunciation || item.phonetics || item.ipa || item.pronunciation_hint || null;
      
      const exampleDe = item.example_de || item.example || item.sentence || item.example_sentence_de || null;
      const exampleEn = item.example_en || item.example_translation || item.sentence_translation || item.example_sentence_en || null;

      // Group raw theme into 12 standard pedagogical categories
      const category = getConsolidatedCategory(item.theme || item.category || item.group || 'Allgemein', word, wordClass, meaning);

      return {
        id: item.id || index + 1,
        word,
        meaning,
        category,
        wordClass,
        gender,
        plural,
        antonym,
        pronunciation,
        exampleDe,
        exampleEn,
        audio: item.audio || null,
        image: item.image || null
      };
    });

    const customList = await state.getCustomCards(level);
    state.allCards = [...state.allCards, ...customList];

    if (state.allCards.length === 0) {
      throw new Error("The vocabulary list is empty.");
    }

    state.filteredCards = [...state.allCards];
    state.currentDeck = [...state.allCards];
    
    // Build O(1) antonym lookup index (replaces O(N) linear scan per card render)
    state.antonymIndex = new Map();
    state.allCards.forEach(card => {
      const cleanWord = card.word.replace(/^(der|die|das)\s+/i, '').trim().toLowerCase();
      state.antonymIndex.set(cleanWord, card);
    });
    
    renderSidebarCategories();
    updateOverallStats();
    
    elements.loaderOverlay.classList.add('opacity-0');
    setTimeout(() => {
      elements.loaderOverlay.classList.add('hidden');
    }, 500);

    renderCard();

  } catch (error) {
    console.error("Failed to load flashcard data:", error);
    elements.loaderOverlay.classList.add('hidden');
    elements.errorMessage.textContent = `Fehler beim Laden von wordlist.json: ${error.message}. Bitte stellen Sie sicher, dass sich die Datei im selben Ordner wie index.html befindet und keine Syntaxfehler enthält.`;
    elements.errorOverlay.classList.remove('hidden');
  }
}

// ==========================================
// DYNAMIC SIDEBAR CATEGORIES GENERATOR
// ==========================================

function renderSidebarCategories() {
  const counts = {};
  const learnedCounts = {};
  
  state.allCards.forEach(card => {
    counts[card.category] = (counts[card.category] || 0) + 1;
    if (state.learnedCards.has(Number(card.id))) {
      learnedCounts[card.category] = (learnedCounts[card.category] || 0) + 1;
    }
  });

  const uniqueCategories = Object.keys(counts).sort((a, b) => a.localeCompare(b, 'de'));

  const allLearned = state.learnedCards.size;
  const allTotal = state.allCards.length;
  elements.categoriesContainer.innerHTML = `
    <div class="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Themen / Kategorien</div>
    <button data-category="All" class="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-between ${state.activeCategory === 'All' ? 'sidebar-active text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'}">
      <div class="flex items-start gap-2.5 min-w-0 flex-1 mr-2">
        <i class="fa-solid fa-list text-xs text-indigo-400 mt-1.5 flex-shrink-0"></i>
        <div class="flex flex-col min-w-0 flex-1">
          <span class="font-semibold truncate">Alle Kategorien</span>
          <span class="text-[10px] text-slate-500 font-medium truncate">All Categories</span>
        </div>
      </div>
      <span class="text-xs bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono flex-shrink-0">${allLearned} / ${allTotal}</span>
    </button>
  `;

  uniqueCategories.forEach(cat => {
    const total = counts[cat];
    const learned = learnedCounts[cat] || 0;
    const isActive = state.activeCategory === cat;
    const isCompleted = learned === total;
    const translation = categoryTranslations[cat] || cat;
    
    let badgeColorClass = isActive 
      ? 'bg-slate-900 border border-slate-800 text-slate-400' 
      : (isCompleted ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30' : 'bg-slate-950 text-slate-500');

    const btn = document.createElement('button');
    btn.setAttribute('data-category', cat);
    btn.className = `w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-between ${isActive ? 'sidebar-active text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'}`;
    btn.innerHTML = `
      <div class="flex items-start gap-2.5 min-w-0 flex-1 mr-2">
        <i class="fa-solid ${isCompleted ? 'fa-circle-check text-emerald-500/70 mt-1.5' : 'fa-folder text-indigo-400/70 mt-1.5'} text-xs flex-shrink-0"></i>
        <div class="flex flex-col min-w-0 flex-1">
          <span class="font-semibold truncate">${cat}</span>
          <span class="text-[10px] text-slate-500 font-medium truncate">${translation}</span>
        </div>
      </div>
      <span class="text-xs px-2 py-0.5 rounded-full font-mono flex-shrink-0 ${badgeColorClass}">${learned} / ${total}</span>
    `;
    elements.categoriesContainer.appendChild(btn);
  });
  // F1: Category click handlers are now delegated via setupEventListeners()
}

// ==========================================
// FLEXIBLE CARDS DECK SRS SCHEDULER & FILTER
// ==========================================

function filterDeck(preserveIndex = false) {
  let filtered = state.allCards;

  if (state.activeCategory !== 'All') {
    filtered = filtered.filter(card => card.category === state.activeCategory);
  }

  if (state.searchQuery) {
    const query = state.searchQuery.toLowerCase();
    filtered = filtered.filter(card => 
      card.word.toLowerCase().includes(query) || 
      card.meaning.toLowerCase().includes(query)
    );
  }

  if (state.hideLearned) {
    filtered = filtered.filter(card => !state.learnedCards.has(Number(card.id)));
  }

  state.filteredCards = filtered;
  
  if (!preserveIndex) {
    state.currentIndex = 0;
  } else {
    if (state.filteredCards.length === 0) {
      state.currentIndex = 0;
    } else if (state.currentIndex >= state.filteredCards.length) {
      state.currentIndex = state.filteredCards.length - 1;
    }
  }

  if (state.isShuffled) {
    state.currentDeck = shuffleArray([...state.filteredCards]);
  } else {
    state.currentDeck = sortDeckBySRS([...state.filteredCards]);
  }

  renderCard();
}

// ==========================================
// v6.0: AMBIENT SETTINGS & PARTICLE BURST ENGINE
// ==========================================

function updateSoundStyleUI() {
  if (elements.soundStyleText) {
    elements.soundStyleText.textContent = state.audioTone === 'synth' ? 'Synth' : 'Acoustic';
  }
  if (elements.soundStyleBtn) {
    const icon = elements.soundStyleBtn.querySelector('i');
    if (icon) {
      icon.className = state.audioTone === 'synth' ? 'fa-solid fa-wave-square text-[10px]' : 'fa-solid fa-guitar text-[10px] text-indigo-400';
    }
  }
}

function updateParticlesUI() {
  if (elements.particlesBtn) {
    const icon = elements.particlesBtn.querySelector('i');
    if (icon) {
      if (state.particleBursts) {
        icon.className = 'fa-solid fa-toggle-on text-xs text-indigo-400';
        elements.particlesBtn.classList.remove('opacity-60');
      } else {
        icon.className = 'fa-solid fa-toggle-off text-xs text-slate-500';
        elements.particlesBtn.classList.add('opacity-60');
      }
    }
  }
}

function initSettingsUI() {
  if (elements.sfxVolumeSlider) {
    elements.sfxVolumeSlider.value = state.sfxVolume;
  }
  if (elements.sfxVolumeVal) {
    elements.sfxVolumeVal.textContent = `${Math.round(state.sfxVolume * 100)}%`;
  }
  updateSoundStyleUI();
  updateParticlesUI();
}

// ==========================================
// POMODORO FOCUS-BOOSTER & SOUNDSCAPES (V6.1)
// ==========================================

function initPomodoroFocusBooster() {
  const toggleBtn = elements.pomodoroToggleBtn;
  const durationSelect = elements.pomodoroDuration;
  const soundSelect = elements.pomodoroSound;
  const timeText = elements.pomodoroTimeText;
  const timerRing = elements.pomodoroTimerRing;

  if (!toggleBtn || !durationSelect || !soundSelect || !timeText || !timerRing) return;

  // Initialize time text based on selected option on boot
  const initialDuration = parseInt(durationSelect.value, 10);
  timeText.textContent = `${initialDuration}m`;
  updatePomodoroRing(100);

  durationSelect.addEventListener('change', () => {
    if (!state.focus.active) {
      const mins = parseInt(durationSelect.value, 10);
      timeText.textContent = `${mins}m`;
      updatePomodoroRing(100);
    }
  });

  soundSelect.addEventListener('change', () => {
    if (state.focus.active && state.focus.soundType !== soundSelect.value) {
      state.focus.soundType = soundSelect.value;
      if (state.focus.soundType === 'none') {
        stopFocusSound();
      } else {
        startFocusSound(state.focus.soundType);
      }
    }
  });

  toggleBtn.addEventListener('click', () => {
    if (state.focus.active) {
      stopFocusTimer();
    } else {
      startFocusTimer();
    }
  });
}

function updatePomodoroRing(percent) {
  const ring = elements.pomodoroTimerRing;
  if (!ring) return;
  // stroke-dasharray is 100.5
  const dasharray = 100.5;
  const offset = dasharray - (percent / 100) * dasharray;
  ring.style.strokeDashoffset = offset;
}

function startFocusTimer() {
  const durationSelect = elements.pomodoroDuration;
  const soundSelect = elements.pomodoroSound;
  const toggleBtn = elements.pomodoroToggleBtn;
  const timeText = elements.pomodoroTimeText;

  if (!durationSelect || !soundSelect || !toggleBtn || !timeText) return;

  const mins = parseInt(durationSelect.value, 10);
  state.focus.totalDuration = mins * 60;
  state.focus.timeLeft = state.focus.totalDuration;
  state.focus.soundType = soundSelect.value;
  state.focus.active = true;

  // Update button UI
  toggleBtn.innerHTML = `<i class="fa-solid fa-stop text-[10px]"></i><span>Stoppen | Stop</span>`;
  toggleBtn.className = "flex-1 py-1.5 px-3 rounded-lg text-center text-xs font-bold bg-rose-600 hover:bg-rose-500 active:scale-95 text-white transition-all shadow-md shadow-rose-600/20 flex items-center justify-center gap-1.5";

  // Disable duration dropdown during focus
  durationSelect.disabled = true;

  // Start continuous soundscape
  if (state.focus.soundType !== 'none') {
    startFocusSound(state.focus.soundType);
  }

  // Clear any existing timer
  if (state.focus.timerId) clearInterval(state.focus.timerId);

  state.focus.timerId = setInterval(() => {
    state.focus.timeLeft--;
    
    if (state.focus.timeLeft <= 0) {
      completeFocusTimer();
    } else {
      updateFocusTimerUI();
    }
  }, 1000);

  updateFocusTimerUI();
}

function stopFocusTimer() {
  const durationSelect = elements.pomodoroDuration;
  const toggleBtn = elements.pomodoroToggleBtn;
  const timeText = elements.pomodoroTimeText;

  if (state.focus.timerId) {
    clearInterval(state.focus.timerId);
    state.focus.timerId = null;
  }

  state.focus.active = false;
  stopFocusSound();

  if (durationSelect) durationSelect.disabled = false;

  // Reset button UI
  if (toggleBtn) {
    toggleBtn.innerHTML = `<i class="fa-solid fa-play text-[10px]"></i><span>Starten | Start</span>`;
    toggleBtn.className = "flex-1 py-1.5 px-3 rounded-lg text-center text-xs font-bold bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5";
  }

  // Reset display
  if (timeText && durationSelect) {
    timeText.textContent = `${durationSelect.value}m`;
  }
  updatePomodoroRing(100);
}

function updateFocusTimerUI() {
  const timeText = elements.pomodoroTimeText;
  if (!timeText) return;

  const mins = Math.floor(state.focus.timeLeft / 60);
  const secs = state.focus.timeLeft % 60;
  timeText.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

  const percent = (state.focus.timeLeft / state.focus.totalDuration) * 100;
  updatePomodoroRing(percent);
}

function completeFocusTimer() {
  stopFocusTimer();

  // Award +25 XP
  addAdventureXP(25);

  // Play achievement chime
  playAchievementChime();

  // Trigger screen-wide particle bursts
  if (window.triggerParticleBurst) {
    const burstCount = 6;
    for (let i = 0; i < burstCount; i++) {
      setTimeout(() => {
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight;
        window.triggerParticleBurst(x, y);
      }, i * 300);
    }
  }

  // Activate 15-minute 1.25x XP multiplier
  activateXpMultiplier(15 * 60); // 15 mins in seconds

  // Custom alert/notification showing multiplier
  showFocusCompletionToast();
}

function activateXpMultiplier(durationSeconds) {
  if (state.focus.multiplierTimerId) {
    clearInterval(state.focus.multiplierTimerId);
  }

  state.focus.xpMultiplierActive = true;
  let multiplierTimeLeft = durationSeconds;

  // Add visual indicator of multiplier on streak or pomodoro widget
  updateMultiplierUI(multiplierTimeLeft);

  state.focus.multiplierTimerId = setInterval(() => {
    multiplierTimeLeft--;
    if (multiplierTimeLeft <= 0) {
      clearInterval(state.focus.multiplierTimerId);
      state.focus.multiplierTimerId = null;
      state.focus.xpMultiplierActive = false;
      updateMultiplierUI(0);
    } else {
      updateMultiplierUI(multiplierTimeLeft);
    }
  }, 1000);
}

function updateMultiplierUI(timeLeft) {
  let indicator = document.getElementById('pomodoro-multiplier-badge');
  const widgetContainer = document.getElementById('pomodoro-sidebar-widget')?.firstElementChild;
  if (!widgetContainer) return;

  if (timeLeft > 0) {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'pomodoro-multiplier-badge';
      indicator.className = "mt-3 pt-2 border-t border-indigo-500/10 flex items-center justify-between text-[9px] text-amber-400 font-bold uppercase tracking-wider animate-pulse";
      widgetContainer.appendChild(indicator);
    }
    indicator.innerHTML = `<span>⚡ 1.25x XP Aktiv!</span><span class="font-mono font-black">${timeStr}</span>`;
    indicator.classList.remove('hidden');
  } else {
    if (indicator) {
      indicator.classList.add('hidden');
    }
  }
}

function showFocusCompletionToast() {
  const toast = document.createElement('div');
  toast.className = "fixed bottom-6 right-6 z-50 max-w-sm bg-slate-950/90 border border-indigo-500/30 text-white rounded-xl p-4 shadow-2xl shadow-indigo-500/10 flex items-start gap-3 transform translate-y-12 opacity-0 transition-all duration-500 backdrop-blur-md";
  toast.innerHTML = `
    <div class="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
      <i class="fa-solid fa-trophy text-lg"></i>
    </div>
    <div class="flex-1">
      <h4 class="text-xs font-black text-white tracking-wide uppercase">Fokus-Sitzung Beendet!</h4>
      <p class="text-[10px] text-slate-300 mt-0.5">Hervorragende Arbeit! Sie haben +25 XP erhalten und einen 1.25x XP-Multiplikator für die nächsten 15 Minuten freigeschaltet! ⚡</p>
    </div>
    <button class="text-slate-500 hover:text-slate-300 text-xs focus:outline-none" onclick="this.parentElement.remove()">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;
  document.body.appendChild(toast);
  
  // Animate in
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-12', 'opacity-0');
  });

  // Auto remove after 6 seconds
  setTimeout(() => {
    toast.classList.add('translate-y-12', 'opacity-0');
    setTimeout(() => toast.remove(), 500);
  }, 6000);
}

/**
 * Lightweight, non-blocking CSS/JS-driven particle emission burst system.
 * Generates sensory-rich feedback on correct answers and achievements.
 */
window.triggerParticleBurst = function(x, y) {
  if (!state.particleBursts) return;
  const container = document.getElementById('particle-container');
  if (!container) return;

  const colors = [
    'rgba(59, 130, 246, 0.85)',   // der - blue
    'rgba(244, 63, 94, 0.85)',    // die - pink/rose
    'rgba(16, 185, 129, 0.85)',   // das - green
    'rgba(139, 92, 246, 0.85)',   // neutral - violet
    'rgba(245, 158, 11, 0.9)'     // gold - achievement/weaver
  ];

  const particleCount = 15 + Math.floor(Math.random() * 10);
  for (let i = 0; i < particleCount; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    
    // Exact center anchor
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    
    // Randomized visual properties
    const size = 6 + Math.floor(Math.random() * 6); // 6px - 11px
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    
    const color = colors[Math.floor(Math.random() * colors.length)];
    p.style.backgroundColor = color;
    p.style.boxShadow = `0 0 10px ${color}`;
    
    // Trajectory coordinates via trigonometric distribution
    const angle = Math.random() * 2 * Math.PI;
    const distance = 40 + Math.floor(Math.random() * 120); // 40px - 160px
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    const dur = 0.5 + Math.random() * 0.5; // 0.5s - 1.0s
    
    p.style.setProperty('--dx', `${dx}px`);
    p.style.setProperty('--dy', `${dy}px`);
    p.style.setProperty('--dur', `${dur}s`);
    
    container.appendChild(p);
    
    // Self-garbage collection on complete
    setTimeout(() => {
      p.remove();
    }, dur * 1000);
  }
};

// ==========================================
// EVENT LISTENERS BINDING STATIONS
// ==========================================

function setupEventListeners() {
  window.addEventListener('hashchange', handleRouting);

  // F1: Delegated event listener for sidebar category buttons (set once, not per-render)
  if (elements.categoriesContainer) {
    elements.categoriesContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-category]');
      if (!btn) return;
      const selected = btn.getAttribute('data-category');
      state.activeCategory = selected;
      renderSidebarCategories();
      filterDeck();
      if (window.location.hash !== '#/') {
        window.location.hash = '#/';
      }
      closeMobileSidebar();
    });
  }

  if (elements.levelSelect) {
    elements.levelSelect.addEventListener('change', (e) => {
      changeLevel(e.target.value);
    });
  }

  // Error overlay reload button (replaces inline onclick)
  const errorReloadBtn = document.getElementById('error-reload-btn');
  if (errorReloadBtn) errorReloadBtn.addEventListener('click', () => location.reload());

  if (elements.cheatcodeSearch) {
    elements.cheatcodeSearch.addEventListener('input', (e) => {
      cheatcodeSearchQuery = e.target.value.trim();
      renderCheatcodes();
    });
  }

  const tabButtons = document.querySelectorAll('.cheatcode-tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => {
        b.classList.remove('active', 'border-indigo-500', 'text-white');
        b.classList.add('border-transparent', 'text-slate-400');
        b.setAttribute('aria-selected', 'false'); // V3: ARIA tab sync
      });
      btn.classList.add('active', 'border-indigo-500', 'text-white');
      btn.classList.remove('border-transparent', 'text-slate-400');
      btn.setAttribute('aria-selected', 'true'); // V3: ARIA tab sync
      currentCheatcodeTab = btn.getAttribute('data-tab');
      renderCheatcodes();
    });
  });

  if (elements.flashcard) {
    elements.flashcard.addEventListener('click', () => {
      toggleAccordion();
    });
  }

  if (elements.suffixHelperTrigger) {
    elements.suffixHelperTrigger.addEventListener('click', (e) => {
      e.stopPropagation(); // Avoid triggering card toggleAccordion click
      if (elements.suffixDrawer) {
        const isHidden = elements.suffixDrawer.classList.contains('hidden');
        if (isHidden) {
          elements.suffixDrawer.classList.remove('hidden', 'pointer-events-none');
          elements.suffixDrawer.classList.add('suffix-drawer-active');
          if (elements.suffixHelperTrigger) {
            elements.suffixHelperTrigger.classList.remove('bg-amber-500/10', 'text-amber-400');
            elements.suffixHelperTrigger.classList.add('bg-amber-500/20', 'text-amber-300');
          }
        } else {
          elements.suffixDrawer.classList.add('hidden', 'pointer-events-none');
          elements.suffixDrawer.classList.remove('suffix-drawer-active');
          if (elements.suffixHelperTrigger) {
            elements.suffixHelperTrigger.classList.remove('bg-amber-500/20', 'text-amber-300');
            elements.suffixHelperTrigger.classList.add('bg-amber-500/10', 'text-amber-400');
          }
        }
      }
    });
  }

  if (elements.nextBtn) elements.nextBtn.addEventListener('click', nextCard);
  if (elements.prevBtn) elements.prevBtn.addEventListener('click', prevCard);

  if (elements.toggleRevealBtn) elements.toggleRevealBtn.addEventListener('click', toggleAccordion);
  if (elements.learnedBtn) elements.learnedBtn.addEventListener('click', toggleLearned);

  if (elements.resetProgressBtn) elements.resetProgressBtn.addEventListener('click', resetProgress);
  if (elements.resetProgressBtnMain) elements.resetProgressBtnMain.addEventListener('click', resetProgress);

  if (elements.shuffleBtn) elements.shuffleBtn.addEventListener('click', toggleShuffle);

  let searchTimeoutId = null;
  if (elements.searchInput) {
    elements.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim();
      if (state.searchQuery) {
        elements.searchClear.classList.remove('hidden');
      } else {
        elements.searchClear.classList.add('hidden');
      }
      
      clearTimeout(searchTimeoutId);
      searchTimeoutId = setTimeout(() => {
        filterDeck();
      }, 150);
    });
  }

  if (elements.searchClear) {
    elements.searchClear.addEventListener('click', () => {
      elements.searchInput.value = '';
      state.searchQuery = '';
      elements.searchClear.classList.add('hidden');
      filterDeck();
      elements.searchInput.focus();
    });
  }

  if (elements.mobileSidebarToggle) elements.mobileSidebarToggle.addEventListener('click', openMobileSidebar);
  if (elements.mobileSidebarClose) elements.mobileSidebarClose.addEventListener('click', closeMobileSidebar);
  if (elements.sidebarBackdrop) elements.sidebarBackdrop.addEventListener('click', closeMobileSidebar);

  if (elements.speakBtn) {
    elements.speakBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      speakWord();
    });
  }

  if (elements.readModeBtn) elements.readModeBtn.addEventListener('click', toggleReadMode);
  if (elements.hideLearnedBtn) elements.hideLearnedBtn.addEventListener('click', toggleHideLearned);
  if (elements.autoplayBtn) elements.autoplayBtn.addEventListener('click', toggleAutoplay);
  if (elements.toggleImagesBtn) elements.toggleImagesBtn.addEventListener('click', toggleImages);

  if (elements.deckPrefsToggleBtn) {
    elements.deckPrefsToggleBtn.addEventListener('click', toggleDeckPrefs);
  }

  document.addEventListener('click', (e) => {
    if (elements.deckPrefsDropdown && !elements.deckPrefsDropdown.contains(e.target) && elements.deckPrefsToggleBtn && !elements.deckPrefsToggleBtn.contains(e.target)) {
      closeDeckPrefs();
    }
  });

  if (elements.phoneticBtn) {
    elements.phoneticBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePhoneticMirror();
    });
  }
  if (elements.phoneticCloseBtn) {
    elements.phoneticCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closePhoneticMirror();
    });
  }
  if (elements.phoneticRecordBtn) {
    elements.phoneticRecordBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePhoneticRecording();
    });
  }

  if (elements.trainerPlayBtn) elements.trainerPlayBtn.addEventListener('click', toggleAudioTrainer);
  if (elements.trainerPrevBtn) {
    elements.trainerPrevBtn.addEventListener('click', () => {
      if (state.trainer && state.trainer.active) {
        clearTimeout(state.trainer.timerId);
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        state.trainer.step = 'idle';
      }
      prevCard();
    });
  }
  if (elements.trainerNextBtn) {
    elements.trainerNextBtn.addEventListener('click', () => {
      if (state.trainer && state.trainer.active) {
        clearTimeout(state.trainer.timerId);
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        state.trainer.step = 'idle';
      }
      nextCard();
    });
  }
  if (elements.trainerSpeedSlider) {
    elements.trainerSpeedSlider.addEventListener('input', (e) => {
      if (state.trainer) {
        state.trainer.speed = parseFloat(e.target.value);
      }
      if (elements.trainerSpeedVal) {
        elements.trainerSpeedVal.textContent = `${parseFloat(e.target.value).toFixed(1)}x`;
      }
    });
  }
  if (elements.trainerLoopBtn) elements.trainerLoopBtn.addEventListener('click', toggleTrainerLoop);

  window.addEventListener('keydown', handleKeyboardShortcuts);

  if (elements.quizModeMc) elements.quizModeMc.addEventListener('click', () => initQuiz('mc'));
  if (elements.quizModeSpelling) elements.quizModeSpelling.addEventListener('click', () => initQuiz('spelling'));
  if (elements.quizSpellingSubmit) elements.quizSpellingSubmit.addEventListener('click', checkSpellingAnswer);
  
  if (elements.quizSpellingInput) {
    elements.quizSpellingInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        checkSpellingAnswer();
      }
    });
  }
  if (elements.quizNextQuestionBtn) elements.quizNextQuestionBtn.addEventListener('click', nextQuizQuestion);
  if (elements.quizRetryBtn) elements.quizRetryBtn.addEventListener('click', retryQuiz);
  if (elements.quizQuitBtn) elements.quizQuitBtn.addEventListener('click', quitQuiz);
  
  const kbBtns = document.querySelectorAll('.quiz-kb-btn');
  kbBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (!elements.quizSpellingInput) return;
      const char = btn.getAttribute('data-char');
      
      const start = elements.quizSpellingInput.selectionStart;
      const end = elements.quizSpellingInput.selectionEnd;
      const val = elements.quizSpellingInput.value;
      
      elements.quizSpellingInput.value = val.substring(0, start) + char + val.substring(end);
      elements.quizSpellingInput.focus();
      
      const newPos = start + char.length;
      elements.quizSpellingInput.setSelectionRange(newPos, newPos);
    });
  });

  if (elements.backupExportBtn) elements.backupExportBtn.addEventListener('click', exportBackup);
  if (elements.backupImportFile) elements.backupImportFile.addEventListener('change', importBackup);

  const syncCopyBtn = document.getElementById('sync-copy-btn');
  if (syncCopyBtn) syncCopyBtn.addEventListener('click', copySyncKey);

  const syncRestoreBtn = document.getElementById('sync-restore-btn');
  if (syncRestoreBtn) syncRestoreBtn.addEventListener('click', restoreSyncKey);

  if (elements.themeSelect) {
    elements.themeSelect.addEventListener('change', (e) => {
      applyTheme(e.target.value);
    });
  }

  if (elements.quizFinishEarlyBtn) {
    elements.quizFinishEarlyBtn.addEventListener('click', () => {
      showQuizResults();
    });
  }

  if (elements.navAdventure) {
    elements.navAdventure.addEventListener('click', () => {
      window.location.hash = '#/adventure';
    });
  }
  if (elements.adventureNpcSpeakBtn) {
    elements.adventureNpcSpeakBtn.addEventListener('click', speakAdventureNpcSentence);
  }
  if (elements.adventureResetBtn) elements.adventureResetBtn.addEventListener('click', resetAdventureSentence);
  if (elements.adventureSubmitBtn) elements.adventureSubmitBtn.addEventListener('click', checkAdventureAnswer);
  if (elements.adventureNextNodeBtn) elements.adventureNextNodeBtn.addEventListener('click', nextAdventureNode);
  
  if (elements.adventureQuitBtn) {
    elements.adventureQuitBtn.addEventListener('click', () => {
      showConfirmModal(
        "Möchten Sie das Abenteuer wirklich verlassen? Ihr aktueller Fortschritt in diesem Szenario geht verloren.",
        () => quitAdventureScenario()
      );
    });
  }
  if (elements.adventureResultsRetryBtn) {
    elements.adventureResultsRetryBtn.addEventListener('click', () => {
      if (state.adventure && state.adventure.activeScenario) {
        startScenario(state.adventure.activeScenario);
      }
    });
  }
  if (elements.adventureResultsDoneBtn) elements.adventureResultsDoneBtn.addEventListener('click', quitAdventureScenario);

  if (elements.navWeaver) {
    elements.navWeaver.addEventListener('click', () => {
      window.location.hash = '#/weaver';
    });
  }
  if (elements.weaverStartBtn) elements.weaverStartBtn.addEventListener('click', startWeaverGame);
  
  if (elements.weaverQuitBtn) {
    elements.weaverQuitBtn.addEventListener('click', () => {
      showConfirmModal(
        "Möchten Sie die Grammatik-Weberei wirklich beenden? Der aktuelle Fortschritt geht verloren.",
        () => quitWeaverGame()
      );
    });
  }
  if (elements.weaverResetBtn) elements.weaverResetBtn.addEventListener('click', resetWeaverSentence);
  if (elements.weaverSubmitBtn) elements.weaverSubmitBtn.addEventListener('click', submitWeaverSentence);
  if (elements.weaverNextBtn) elements.weaverNextBtn.addEventListener('click', nextWeaverSentence);
  if (elements.weaverResultsRetryBtn) elements.weaverResultsRetryBtn.addEventListener('click', startWeaverGame);
  if (elements.weaverResultsDoneBtn) elements.weaverResultsDoneBtn.addEventListener('click', quitWeaverGame);

  // v6.0: Customizable settings event listeners
  if (elements.sfxVolumeSlider) {
    elements.sfxVolumeSlider.addEventListener('input', (e) => {
      state.sfxVolume = parseFloat(e.target.value);
      safeSetItem('sfx_volume', state.sfxVolume.toString());
      if (elements.sfxVolumeVal) {
        elements.sfxVolumeVal.textContent = `${Math.round(state.sfxVolume * 100)}%`;
      }
    });
  }

  if (elements.soundStyleBtn) {
    elements.soundStyleBtn.addEventListener('click', () => {
      state.audioTone = state.audioTone === 'synth' ? 'acoustic' : 'synth';
      safeSetItem('audio_tone', state.audioTone);
      updateSoundStyleUI();
      playSnapHaptic();
    });
  }

  if (elements.particlesBtn) {
    elements.particlesBtn.addEventListener('click', () => {
      state.particleBursts = !state.particleBursts;
      safeSetItem('particle_bursts', state.particleBursts.toString());
      updateParticlesUI();
      playSnapHaptic();
    });
  }
}

// ==========================================
// DRAWER NAVIGATION HANDLERS
// ==========================================

function openMobileSidebar() {
  elements.sidebar.classList.remove('-translate-x-full');
  elements.sidebarBackdrop.classList.remove('hidden');
}

function closeMobileSidebar() {
  elements.sidebar.classList.add('-translate-x-full');
  elements.sidebarBackdrop.classList.add('hidden');
}

// ==========================================
// F14: CUSTOM CONFIRM MODAL (replaces native confirm())
// ==========================================

function showConfirmModal(message, onConfirm) {
  const overlay = document.getElementById('confirm-modal-overlay');
  const msgEl = document.getElementById('confirm-modal-message');
  const confirmBtn = document.getElementById('confirm-modal-confirm');
  const cancelBtn = document.getElementById('confirm-modal-cancel');
  if (!overlay || !msgEl || !confirmBtn || !cancelBtn) {
    // Fallback to native confirm if modal DOM is missing
    if (confirm(message)) onConfirm();
    return;
  }

  msgEl.textContent = message;
  overlay.classList.remove('hidden');

  // Focus the cancel button by default (safer action)
  requestAnimationFrame(() => cancelBtn.focus());

  function cleanup() {
    overlay.classList.add('hidden');
    confirmBtn.removeEventListener('click', handleConfirm);
    cancelBtn.removeEventListener('click', handleCancel);
    document.removeEventListener('keydown', handleKeydown);
  }

  function handleConfirm() {
    cleanup();
    onConfirm();
  }

  function handleCancel() {
    cleanup();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
    // Focus trap: Tab cycles between cancel and confirm buttons
    if (e.key === 'Tab') {
      const focusable = [cancelBtn, confirmBtn];
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }
  }

  confirmBtn.addEventListener('click', handleConfirm);
  cancelBtn.addEventListener('click', handleCancel);
  document.addEventListener('keydown', handleKeydown);
}

// ==========================================
// PROGRESS RESET OPERATIONS
// ==========================================

function resetProgress() {
  showConfirmModal(
    "Möchten Sie Ihren gesamten Lernfortschritt (gelesene/gelernte Karten) wirklich zurücksetzen?",
    () => {
      if (state.trainer && state.trainer.active) {
        stopAudioTrainer();
      }

      state.learnedCards.clear();
      localStorage.removeItem(`learned_cards_${state.currentLevel}`);
      
      state.srs = {};
      localStorage.removeItem(`srs_state_${state.currentLevel}`);
      
      renderCard();
      updateOverallStats();
      renderSidebarCategories();
    }
  );
}

// ==========================================
// B1: KEYBOARD SHORTCUT OVERLAY
// ==========================================

function toggleShortcutOverlay() {
  const overlay = document.getElementById('shortcut-overlay');
  if (!overlay) return;
  if (overlay.classList.contains('hidden')) {
    overlay.classList.remove('hidden');
    const closeBtn = document.getElementById('shortcut-close-btn');
    if (closeBtn) requestAnimationFrame(() => closeBtn.focus());
  } else {
    overlay.classList.add('hidden');
  }
}

// ==========================================
// C1: SWIPE GESTURE HANDLER FOR FLASHCARDS
// ==========================================

function setupSwipeGestures() {
  const flashcard = document.getElementById('flashcard');
  if (!flashcard) return;

  let startX = 0;
  let startY = 0;
  let isDragging = false;

  flashcard.addEventListener('pointerdown', (e) => {
    // Only process if on the flashcard route
    const hash = window.location.hash || '#/';
    if (hash !== '#/' && hash !== '#') return;

    // Check if the click/tap is on an interactive element (buttons, links, triggers)
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('#suffix-helper-trigger')) {
      return;
    }

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;

    flashcard.setPointerCapture(e.pointerId);
    flashcard.classList.add('drag-touch');
    flashcard.classList.remove('card-spring-back', 'swipe-left', 'swipe-right');
    flashcard.style.transform = '';
  });

  flashcard.addEventListener('pointermove', (e) => {
    if (!isDragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    // Apply translation and rotation based on horizontal/vertical offsets
    flashcard.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx * 0.08}deg)`;
  });

  flashcard.addEventListener('pointerup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    flashcard.releasePointerCapture(e.pointerId);
    flashcard.classList.remove('drag-touch');

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const threshold = 120;

    const card = state.currentDeck ? state.currentDeck[state.currentIndex] : null;

    if (dx > threshold && card) {
      // Swipe Right -> Rating Good (3) -> Next Card
      flashcard.classList.add('swipe-right');
      reviewCardSRS(card.id, 3); // 3 = Good
      if (typeof window.triggerParticleBurst === 'function') {
        window.triggerParticleBurst(window.innerWidth / 2 + 100, window.innerHeight / 2.3);
      }
      setTimeout(() => {
        nextCard();
        flashcard.classList.remove('swipe-right');
        flashcard.style.transform = '';
      }, 300);
    } else if (dx < -threshold && card) {
      // Swipe Left -> Rating Again (1) -> Next Card
      flashcard.classList.add('swipe-left');
      reviewCardSRS(card.id, 1); // 1 = Again
      if (typeof window.triggerParticleBurst === 'function') {
        window.triggerParticleBurst(window.innerWidth / 2 - 100, window.innerHeight / 2.3);
      }
      setTimeout(() => {
        nextCard();
        flashcard.classList.remove('swipe-left');
        flashcard.style.transform = '';
      }, 300);
    } else {
      // Under threshold -> Spring Snap Back
      flashcard.classList.add('card-spring-back');
      flashcard.style.transform = '';
      setTimeout(() => {
        flashcard.classList.remove('card-spring-back');
      }, 500);
    }
  });

  flashcard.addEventListener('pointercancel', (e) => {
    if (!isDragging) return;
    isDragging = false;
    flashcard.releasePointerCapture(e.pointerId);
    flashcard.classList.remove('drag-touch');
    flashcard.classList.add('card-spring-back');
    flashcard.style.transform = '';
    setTimeout(() => {
      flashcard.classList.remove('card-spring-back');
    }, 500);
  });
}

// ==========================================
// KEYBOARD SHORTCUTS INTERCEPTOR
// ==========================================

function handleKeyboardShortcuts(e) {
  // Guard: Don't intercept keys while typing in any input field
  const tag = document.activeElement?.tagName;
  const isEditable = document.activeElement?.isContentEditable;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || isEditable) {
    if (e.key === 'Escape') {
      document.activeElement.blur();
    }
    return;
  }

  // B1: Dismiss shortcut overlay on Escape
  const shortcutOverlay = document.getElementById('shortcut-overlay');
  if (shortcutOverlay && !shortcutOverlay.classList.contains('hidden')) {
    if (e.key === 'Escape') {
      e.preventDefault();
      toggleShortcutOverlay();
      return;
    }
  }

  if (state.quiz.active) {
    if (e.key === 'Escape') {
      e.preventDefault();
      quitQuiz();
      return;
    }

    if (elements.quizFeedbackPanel && !elements.quizFeedbackPanel.classList.contains('hidden')) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        nextQuizQuestion();
        return;
      }
    }

    if (state.quiz.mode === 'mc' && !state.quiz.isAnswered) {
      const optionKeys = ['a', 'b', 'c', 'd', '1', '2', '3', '4'];
      const keyLower = e.key.toLowerCase();
      if (optionKeys.includes(keyLower)) {
        e.preventDefault();
        const idx = optionKeys.indexOf(keyLower) % 4;
        const optBtns = elements.quizOptionsContainer.querySelectorAll('.quiz-opt-btn');
        if (optBtns[idx] && state.quiz.options[idx]) {
          handleMCOptionClick(state.quiz.options[idx], optBtns[idx]);
        }
        return;
      }
    }
    return;
  }

  const currentHash = window.location.hash || '#/';

  if (currentHash === '#/weaver') {
    // 1. Backspace / Delete -> click Reset
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      if (elements.weaverResetBtn && !elements.weaverResetBtn.classList.contains('hidden')) {
        elements.weaverResetBtn.click();
      }
      return;
    }
    // 2. Enter -> click Next or Submit
    if (e.key === 'Enter') {
      e.preventDefault();
      if (elements.weaverNextBtn && !elements.weaverNextBtn.classList.contains('hidden')) {
        elements.weaverNextBtn.click();
      } else if (elements.weaverSubmitBtn && !elements.weaverSubmitBtn.classList.contains('hidden')) {
        elements.weaverSubmitBtn.click();
      }
      return;
    }
    // 3. Keys 1-9 -> click corresponding available scrambled chip
    if (e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      const idx = parseInt(e.key, 10) - 1;
      const chips = elements.weaverChipsPool ? elements.weaverChipsPool.querySelectorAll('.weaver-chip') : [];
      if (chips[idx]) {
        chips[idx].click();
      }
      return;
    }
  }

  if (currentHash === '#/adventure') {
    // 1. Backspace / Delete -> click Reset
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      if (elements.adventureResetBtn && !elements.adventureResetBtn.classList.contains('hidden')) {
        elements.adventureResetBtn.click();
      }
      return;
    }
    // 2. Enter -> click Next or Submit
    if (e.key === 'Enter') {
      e.preventDefault();
      if (elements.adventureNextNodeBtn && !elements.adventureNextNodeBtn.classList.contains('hidden')) {
        elements.adventureNextNodeBtn.click();
      } else if (elements.adventureSubmitBtn && !elements.adventureSubmitBtn.classList.contains('hidden')) {
        elements.adventureSubmitBtn.click();
      }
      return;
    }
    // 3. Keys 1-9 -> click corresponding available scrambled chip
    if (e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      const idx = parseInt(e.key, 10) - 1;
      if (elements.adventureChipsPool) {
        const chips = Array.from(elements.adventureChipsPool.querySelectorAll('.adventure-chip'))
                           .filter(c => !c.classList.contains('adventure-chip-used'));
        if (chips[idx]) {
          chips[idx].click();
        }
      }
      return;
    }
  }

  // B1: ? key toggles keyboard shortcut overlay (works on ALL routes)
  if (e.key === '?') {
    e.preventDefault();
    toggleShortcutOverlay();
    return;
  }

  // Guard: Flashcard keyboard shortcuts should ONLY fire on the flashcard route
  if (currentHash !== '#/' && currentHash !== '#') return;

  switch (e.key) {
    case '1':
    case '2':
    case '3':
    case '4': {
      e.preventDefault();
      if (state.currentDeck.length > 0) {
        const card = state.currentDeck[state.currentIndex];
        const rating = parseInt(e.key, 10); // 1 = Again, 2 = Hard, 3 = Good, 4 = Easy
        reviewCardSRS(card.id, rating);
        if (typeof window.triggerParticleBurst === 'function') {
          window.triggerParticleBurst(window.innerWidth / 2, window.innerHeight / 2.3);
        }
        nextCard();
      }
      break;
    }

    case ' ':
      e.preventDefault();
      toggleAccordion();
      break;
    
    case 'ArrowRight':
    case 'ArrowDown':
      e.preventDefault();
      nextCard();
      break;
      
    case 'ArrowLeft':
    case 'ArrowUp':
      e.preventDefault();
      prevCard();
      break;
      
    case 'l':
    case 'L':
      e.preventDefault();
      toggleLearned();
      break;
      
    case 's':
    case 'S':
      e.preventDefault();
      toggleShuffle();
      break;

    case 'v':
    case 'V':
      e.preventDefault();
      speakWord();
      break;

    case 'f':
    case 'F':
      e.preventDefault();
      toggleReadMode();
      break;

    case 'h':
    case 'H':
      e.preventDefault();
      toggleHideLearned();
      break;

    case 'a':
    case 'A':
      e.preventDefault();
      toggleAutoplay();
      break;

    case 'b':
    case 'B':
      e.preventDefault();
      toggleImages();
      break;
      
    case 'Escape':
      e.preventDefault();
      if (!elements.sidebar.classList.contains('-translate-x-full')) {
        closeMobileSidebar();
      }
      break;
  }
}

// ==========================================
// CLIENT HASH-ROUTER DISPATCHER
// ==========================================

function handleRouting() {
  // V3: View Transition API — smooth cross-fade on route change
  // Progressive enhancement: falls back to instant switch in unsupported browsers
  const applyRoute = () => handleRoutingCore();
  
  if (document.startViewTransition) {
    document.startViewTransition(applyRoute);
  } else {
    applyRoute();
  }
}

function handleRoutingCore() {
  const hash = window.location.hash || '#/';
  
  elements.navFlashcards.className = "w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent";
  elements.navCheatcodes.className = "w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent";
  if (elements.navQuiz) elements.navQuiz.className = "w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent";
  if (elements.navStats) elements.navStats.className = "w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent";
  if (elements.navAdventure) elements.navAdventure.className = "w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent";
  if (elements.navWeaver) elements.navWeaver.className = "w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent";
  if (elements.navImmersion) elements.navImmersion.className = "w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent";
  
  elements.flashcardsView.classList.add('hidden');
  elements.cheatcodesView.classList.add('hidden');
  if (elements.quizView) elements.quizView.classList.add('hidden');
  if (elements.statsView) elements.statsView.classList.add('hidden');
  if (elements.adventureView) elements.adventureView.classList.add('hidden');
  if (elements.weaverView) elements.weaverView.classList.add('hidden');
  if (elements.immersionView) elements.immersionView.classList.add('hidden');
  
  elements.searchInput.disabled = true;
  elements.searchInput.parentElement.classList.add('opacity-40');
  
  state.weaver.active = false;

  if (state.phonetic && state.phonetic.isOpen) {
    closePhoneticMirror();
  }
  if (state.trainer && state.trainer.active) {
    stopAudioTrainer();
  } else if (window.speechSynthesis && window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
  
  const levelUpper = state.currentLevel.toUpperCase();

  if (hash === '#/cheatcodes') {
    elements.cheatcodesView.classList.remove('hidden');
    elements.navCheatcodes.className = "w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-white bg-slate-800/50 border border-slate-700/50";
    document.title = `Grammatik-Cheatcodes — German ${levelUpper}`;
    renderCheatcodes();
  } else if (hash === '#/quiz') {
    if (elements.quizView) elements.quizView.classList.remove('hidden');
    if (elements.navQuiz) elements.navQuiz.className = "w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-white bg-slate-800/50 border border-slate-700/50";
    document.title = `Quiz Arena — German ${levelUpper}`;
    initQuizView();
  } else if (hash === '#/stats') {
    if (elements.statsView) elements.statsView.classList.remove('hidden');
    if (elements.navStats) elements.navStats.className = "w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-white bg-slate-800/50 border border-slate-700/50";
    document.title = `Statistik — German ${levelUpper}`;
    initStatsView();
  } else if (hash === '#/weaver') {
    state.weaver.active = true;
    if (elements.weaverView) elements.weaverView.classList.remove('hidden');
    if (elements.navWeaver) elements.navWeaver.className = "w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-white bg-slate-800/50 border border-slate-700/50";
    document.title = `Grammatik-Weberei — German ${levelUpper}`;
    initWeaverView();
  } else if (hash === '#/adventure') {
    if (elements.adventureView) elements.adventureView.classList.remove('hidden');
    if (elements.navAdventure) elements.navAdventure.className = "w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-white bg-slate-800/50 border border-slate-700/50";
    document.title = `Deutsch-Abenteuer — German ${levelUpper}`;
    initAdventureView();
  } else if (hash === '#/immersion') {
    if (elements.immersionView) elements.immersionView.classList.remove('hidden');
    if (elements.navImmersion) elements.navImmersion.className = "w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-white bg-slate-800/50 border border-slate-700/50";
    document.title = `Immersions-Labor — German ${levelUpper}`;
    initImmersionView();
  } else {
    elements.flashcardsView.classList.remove('hidden');
    elements.navFlashcards.className = "w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-white bg-slate-800/50 border border-slate-700/50";
    document.title = `German ${levelUpper} Flashcards`;
    
    elements.searchInput.disabled = false;
    elements.searchInput.parentElement.classList.remove('opacity-40');
    
    renderCard();
  }

  // F26: Focus management — move focus to main content after route change
  // Use rAF to ensure DOM is painted before focus shift
  requestAnimationFrame(() => {
    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.focus({ preventScroll: true });
  });
}

// ==========================================
// GRAMMAR CHEATCODES PANEL GENERATOR
// ==========================================

function renderCheatcodes() {
  if (!elements.cheatcodesGrid) return;

  elements.cheatcodesGrid.innerHTML = '';

  const filtered = CHEATCODES_DATABASE.filter(item => {
    if (currentCheatcodeTab !== 'all' && item.category !== currentCheatcodeTab) {
      return false;
    }

    if (cheatcodeSearchQuery) {
      const q = cheatcodeSearchQuery.toLowerCase();
      const matchShortcut = item.shortcut.toLowerCase().includes(q);
      const matchRule = item.rule.toLowerCase().includes(q);
      const matchExplanation = item.explanation.toLowerCase().includes(q);
      const matchExamples = item.examples.some(ex => 
        ex.de.toLowerCase().includes(q) || ex.en.toLowerCase().includes(q)
      );
      return matchShortcut || matchRule || matchExplanation || matchExamples;
    }

    return true;
  });

  if (filtered.length === 0) {
    elements.cheatcodesGrid.classList.add('hidden');
    elements.cheatcodesEmpty.classList.remove('hidden');
    return;
  }

  elements.cheatcodesGrid.classList.remove('hidden');
  elements.cheatcodesEmpty.classList.add('hidden');

  filtered.forEach(item => {
    const cardEl = document.createElement('div');
    cardEl.className = `glass border border-slate-900 rounded-2xl p-6 flex flex-col justify-between cheatcode-card ${item.borderClass}`;

    let examplesHTML = '';
    item.examples.forEach(ex => {
      let wordLabel = ex.de;
      let genderBadge = '';
      
      const matchGender = ex.de.match(/^(der|die|das)\s+(.+)/i);
      if (matchGender) {
        const article = matchGender[1].toLowerCase();
        const word = matchGender[2];
        let genderColor = '';
        if (article === 'der') genderColor = 'bg-blue-500/10 border-blue-500/35 text-blue-400';
        else if (article === 'die') genderColor = 'bg-pink-500/10 border-pink-500/35 text-pink-400';
        else if (article === 'das') genderColor = 'bg-emerald-500/10 border-emerald-500/35 text-emerald-400';
        
        genderBadge = `<span class="px-1.5 py-0.5 border text-[9px] font-bold rounded-md ${genderColor} mr-1.5 uppercase">${article}</span>`;
        wordLabel = word;
      }

      examplesHTML += `
        <div class="flex flex-col sm:flex-row sm:items-baseline sm:justify-between py-1.5 border-b border-slate-800/30 last:border-b-0">
          <div class="flex items-center notranslate">
            ${genderBadge}
            <span class="font-bold text-slate-200 text-sm">${wordLabel}</span>
          </div>
          <span class="text-xs text-slate-400">${ex.en}</span>
        </div>
      `;
    });

    let noteHTML = '';
    if (item.note) {
      noteHTML = `<p class="text-[10px] text-amber-500/80 font-medium italic mt-2"><i class="fa-solid fa-circle-info text-[9px]"></i> ${item.note}</p>`;
    }

    cardEl.innerHTML = `
      <div>
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-xl font-extrabold text-white tracking-tight notranslate">${item.shortcut}</h3>
          <span class="px-2 py-0.5 border text-[9px] font-extrabold rounded-md uppercase tracking-wider ${item.badgeClass}">${item.badgeText}</span>
        </div>
        <p class="text-xs font-semibold text-slate-200 leading-relaxed">${item.rule}</p>
        <p class="text-[11px] text-slate-400 mt-1 leading-relaxed">${item.explanation}</p>
        ${noteHTML}
      </div>
      <div class="mt-4 pt-3 border-t border-slate-800/40">
        <h4 class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Beispiele (Examples)</h4>
        <div class="space-y-1">
          ${examplesHTML}
        </div>
      </div>
    `;

    elements.cheatcodesGrid.appendChild(cardEl);
  });
}

// ==========================================
// SYSTEM BOOTSTRAPPING TERMINAL
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
  // Read saved profiles data and migrate to IndexedDB if needed
  await initProfileData();
  migrateToFSRS(); // Auto-migrate Leitner data to FSRS format
  startSession(); // Begin session tracking
  
  updateLevelUI();
  initTheme();
  initSettingsUI();
  initPomodoroFocusBooster();
  initShortcutsToggle();
  trackVisitedLevels();

  fetchData();
  setupEventListeners();
  setupSwipeGestures(); // C1: Touch swipe navigation on flashcards
  updateImagesToggleUI();
  initTTS();

  // B1: Shortcut overlay close button + overlay click-to-dismiss
  const shortcutCloseBtn = document.getElementById('shortcut-close-btn');
  if (shortcutCloseBtn) {
    shortcutCloseBtn.addEventListener('click', toggleShortcutOverlay);
  }
  const shortcutOverlay = document.getElementById('shortcut-overlay');
  if (shortcutOverlay) {
    shortcutOverlay.addEventListener('click', (e) => {
      if (e.target === shortcutOverlay) toggleShortcutOverlay();
    });
  }

  document.addEventListener('click', () => {
    warmUpTTS();
  }, { once: true });

  handleRouting();

  // H1: Register Service Worker for offline GitHub Pages support
  // SW only works on HTTPS/localhost — gracefully skips on file:// protocol
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[SW] Registered:', reg.scope))
      .catch(err => console.warn('[SW] Registration failed:', err));
  }

  // v5.0: PWA Install Prompt Handler
  let deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    // Show install banner after 30 seconds of usage (not immediately intrusive)
    setTimeout(() => {
      const banner = document.getElementById('pwa-install-banner');
      if (banner && deferredInstallPrompt) {
        banner.classList.remove('hidden');
      }
    }, 30000);
  });

  const pwaAcceptBtn = document.getElementById('pwa-install-accept');
  const pwaDismissBtn = document.getElementById('pwa-install-dismiss');
  const pwaBanner = document.getElementById('pwa-install-banner');

  if (pwaAcceptBtn) {
    pwaAcceptBtn.addEventListener('click', async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        console.log('[PWA] Install outcome:', outcome);
        deferredInstallPrompt = null;
      }
      if (pwaBanner) pwaBanner.classList.add('hidden');
    });
  }
  if (pwaDismissBtn) {
    pwaDismissBtn.addEventListener('click', () => {
      if (pwaBanner) pwaBanner.classList.add('hidden');
      deferredInstallPrompt = null;
    });
  }

  // v5.0: Offline/Online Status Indicator
  const offlineIndicator = document.getElementById('offline-indicator');
  function updateOnlineStatus() {
    if (offlineIndicator) {
      if (!navigator.onLine) {
        offlineIndicator.classList.remove('hidden');
      } else {
        offlineIndicator.classList.add('hidden');
      }
    }
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus(); // Check on boot

  // v5.0: Streak UI Sync — update all streak displays from state
  function updateStreakUI() {
    try {
      const streak = safeJsonParse('streak_data', { current: 0, longest: 0, freezesAvailable: 1 });
      const current = streak.current || 0;
      const longest = streak.longest || 0;
      const freezes = streak.freezesAvailable ?? 1;

      // Sidebar streak
      const sidebarCount = document.getElementById('sidebar-streak-count');
      const sidebarBest = document.getElementById('sidebar-streak-best');
      const sidebarFreezes = document.getElementById('sidebar-streak-freezes');
      if (sidebarCount) sidebarCount.textContent = current;
      if (sidebarBest) sidebarBest.textContent = longest;
      if (sidebarFreezes) sidebarFreezes.textContent = freezes;

      // Mobile streak
      const mobileCount = document.getElementById('mobile-streak-count');
      if (mobileCount) mobileCount.textContent = current;

      // Stats streak
      const statsCount = document.getElementById('stats-streak-count');
      if (statsCount) statsCount.textContent = current;
    } catch (e) {
      console.warn('[Streak] Failed to update UI:', e);
    }
  }

  // Update streak UI on boot and on SRS card updates
  updateStreakUI();
  window.addEventListener('srs:card-updated', updateStreakUI);
  window.addEventListener('streak:updated', updateStreakUI);

  // V3: Stop audio when tab is backgrounded (mobile lifecycle safety)
  // Data flushing is already handled by state.js's own visibilitychange listener
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // Stop audio trainer to prevent background noise
      if (state.trainer && state.trainer.active) {
        stopAudioTrainer();
      }
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    }
  });
});
