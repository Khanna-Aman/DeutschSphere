// app.js — Weimar-themed German Vocabulary SPA ES6 Module Orchestrator
import {
  state,
  elements,
  categoryTranslations,
  getCategoryIcon,
  trackVisitedLevels,
  sortDeckBySRS,
  getSRSInfo,
  shuffleArray,
  safeJsonParse,
  safeSetItem,
  safeGetItem,
  migrateToFSRS,
  startSession,
  initProfileData,
  reviewCardSRS,
  resetActiveLevelProgress
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
  toggleAccordion,
  toggleGrammarMatrix
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
  
  // Reload level-scoped learned cards and SRS state asynchronously from IndexedDB
  await initProfileData();
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
    'Person, Familie & Beziehungen',
    'Gefühle, Charakter & Meinung',
    'Wohnen, Haus & Haushalt',
    'Gesundheit, Körper & Pflege',
    'Natur, Umwelt & Tiere',
    'Reise, Verkehr & Mobilität',
    'Essen, Kochen & Restaurant',
    'Einkaufen, Geld & Konsum',
    'Ausbildung, Schule & Studium',
    'Arbeit, Beruf & Karriere',
    'Freizeit, Hobbys & Unterhaltung',
    'Kommunikation, Medien & Sprache',
    'Staat, Gesellschaft & Dokumente',
    'Grammatik, Pronomen & Struktur',
    'Zahlen, Maße & Mengen',
    'Uhrzeit, Datum & Kalender',
    'Allgemeine Aktivitäten & Verben',
    'Eigenschaften & Adjektive',
    'Basiswortschatz & Floskeln'
  ];
  
  const exactMatch = canonicalCategories.find(cat => cat.toLowerCase() === t_raw.toLowerCase());
  if (exactMatch) {
    return exactMatch;
  }

  const t = t_raw.toLowerCase();
  const w = (word || '').toLowerCase().trim();
  const m = (meaning || '').toLowerCase().trim();
  const wc = (wordClass || '').toLowerCase().trim();

  // Clean articles and parenthesis for clean checks
  let w_clean = w.replace(/^(der|die|das)\s+/, '');
  w_clean = w_clean.replace(/\s*\(.*?\)\s*/g, '').trim();

  // Strict grammatical, structural, and temporal lists (exact matches)
  const grammarExactDe = new Set([
    'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mein', 'dein', 'sein', 'unser', 'euer', 'ihre', 'ihrer', 'ihres',
    'in', 'an', 'auf', 'bei', 'mit', 'zu', 'von', 'nach', 'aus', 'für', 'fuer', 'gegen', 'ohne', 'um', 'durch', 'über', 'ueber', 'unter', 'vor', 'hinter', 'neben', 'zwischen',
    'und', 'oder', 'aber', 'weil', 'dass', 'wenn', 'denn', 'als', 'da', 'der', 'die', 'das', 'ein', 'eine', 'einen', 'einem', 'eines', 'einer',
    'welche', 'welcher', 'welches', 'dieser', 'diese', 'dieses', 'wer', 'was', 'wie', 'wo', 'wann', 'warum', 'weshalb', 'deshalb', 'trotzdem', 'obwohl',
    'nicht', 'nichts', 'nur', 'kein', 'keine', 'doch', 'gar', 'etwas', 'jemand', 'niemand', 'man', 'sich', 'mich', 'dich', 'uns', 'euch', 'ihnen', 'ihm', 'ihn'
  ]);

  const numbersExactDe = new Set([
    'null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'fuenf', 'sechs', 'sieben', 'acht', 'neun', 'zehn',
    'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn', 'zwanzig',
    'dreißig', 'dreissig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig', 'hundert', 'tausend', 'million', 'milliarde',
    'erste', 'zweite', 'dritte', 'vierte', 'hälfte', 'haelfte', 'viertel', 'wenig', 'viel', 'mehr', 'manch', 'einige', 'all', 'ganz', 'beide', 'beides'
  ]);

  const timeExactDe = new Set([
    'uhr', 'jahr', 'monat', 'woche', 'tag', 'sekunde', 'minute', 'stunde', 'quartal', 'zeitraum', 'saison', 'dauer',
    'spät', 'spaet', 'früh', 'frueh', 'jetzt', 'dann', 'danach', 'heute', 'gestern', 'morgen', 'bald', 'sofort', 'später', 'spaeter', 'pünktlich', 'puenktlich',
    'immer', 'nie', 'oft', 'selten', 'manchmal', 'damals', 'generation', 'mal', 'einmal', 'zweimal', 'dreimal', 'oftmals', 'stündlich', 'stuendlich',
    'täglich', 'taeglich', 'wöchentlich', 'woechentlich', 'monatlich', 'jährlich', 'jaehrlich', 'frühling', 'sommer', 'herbst', 'winter',
    'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag', 'wochenende',
    'januar', 'februar', 'märz', 'maerz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember',
    'alltag', 'alltäglich', 'alltaeglich', 'zeit', 'uhrzeit', 'datum', 'kalender'
  ]);

  // German Stems (prefix-boundary match, e.g. \bess matches essen, esszimmer)
  const foodDe = ['ess', 'trink', 'küch', 'kuech', 'gemüs', 'gemues', 'obst', 'koch', 'restaur', 'gastro', 'speis', 'mahl', 'bäck', 'baeck', 'bier', 'fleisch', 'fisch', 'banan', 'wein', 'kaff', 'tee', 'supp', 'back', 'frühstück', 'fruehstück', 'salat', 'käse', 'kaese', 'wurst', 'milch', 'kartoffel', 'teller', 'gabel', 'messer', 'löffel', 'loeffel', 'becher', 'tasse', 'glas', 'speisekarte', 'zucker', 'salz', 'pfeffer', 'nudeln', 'reis', 'rind', 'schwein', 'braten'];
  const healthDe = ['gesund', 'körper', 'koerper', 'arzt', 'ärzt', 'aerzt', 'krank', 'apotheke', 'fieber', 'bad', 'pflege', 'medizin', 'schmerz', 'unfall', 'klinik', 'spital', 'husten', 'schnupfen', 'tablette', 'rezept', 'therapie', 'verletz', 'blut', 'auge', 'ohr', 'mund', 'zahn', 'kopf', 'bein', 'arm', 'hand', 'fuß', 'fuss', 'bauch', 'herz', 'patient', 'praxis', 'medikament', 'pflaster', 'verband', 'salbe', 'spritze', 'impfung', 'schwanger', 'geburt'];
  const travelDe = ['reis', 'verkehr', 'bahn', 'zug', 'bus', 'flug', 'auto', 'fahrrad', 'schiff', 'ticket', 'fahrkart', 'hotel', 'touris', 'pension', 'urlaub', 'gepäck', 'gepaeck', 'koffer', 'bahnhof', 'flughafen', 'abfahrt', 'ankunft', 'stau', 'strass', 'straße', 'kreuzung', 'ampel', 'gleis', 'ausflug', 'landkart', 'plan', 'pass', 'visum', 'strand', 'ferien', 'meer', 'see', 'berge', 'wandern', 'camping', 'zelt', 'buchen', 'reservier', 'abflieg', 'landen', 'verspät', 'verspaet', 'linie', 'haltestell', 'umsteig', 'einsteig', 'aussteig', 'tanken', 'tankstell'];
  const shopDe = ['einkauf', 'konsum', 'laden', 'geschäft', 'geschaeft', 'preis', 'bezahl', 'kauf', 'geld', 'euro', 'cent', 'billig', 'teuer', 'kosten', 'rabatt', 'angebot', 'supermarkt', 'markt', 'tasche', 'kleidung', 'kleid', 'hose', 'schuh', 'hemd', 'jacke', 'mantel', 'rock', 'anzug', 'material', 'stoff', 'leder', 'wolle', 'seide', 'baumwolle', 'plastik', 'metall', 'holz', 'glas', 'papier', 'verkäufer', 'verkaeufer', 'kunde', 'kassier', 'kasse', 'tüte', 'tuete', 'quittung', 'garantie', 'umtausch', 'reduzier'];
  const workDe = ['arbeit', 'beruf', 'firma', 'job', 'karriere', 'kolleg', 'büro', 'buero', 'bewerb', 'chef', 'angestellt', 'meister', 'werkstatt', 'fabrik', 'gehalt', 'lohn', 'vertrag', 'kündig', 'kuendig', 'streik', 'arbeitsplatz', 'arbeitslos', 'überstunde', 'ueberstunde', 'lebenslauf', 'praktikum', 'leiter', 'direktor', 'kollegen'];
  const educationDe = ['schul', 'lern', 'ausbildung', 'stud', 'universität', 'universitaet', 'uni', 'klass', 'unterricht', 'sprache', 'buch', 'bücher', 'buecher', 'bucht', 'bildung', 'lehr', 'schüler', 'schueler', 'prüfung', 'pruefung', 'aufgabe', 'hausaufgabe', 'fehler', 'kurs', 'zeugnis', 'diplom', 'fach', 'mathemat', 'rechn', 'schreib', 'les', 'vokabel', 'wörterbuch', 'woerterbuch', 'lehrerin', 'lektion', 'semester', 'schularbeit', 'student', 'professor', 'zertifikat'];
  const homeDe = ['wohn', 'haus', 'zimmer', 'möbel', 'moebel', 'miet', 'einricht', 'haushalt', 'werkzeug', 'architekt', 'gebäude', 'gebaeude', 'tisch', 'stuhl', 'bett', 'schrank', 'regal', 'sofa', 'lampe', 'tür', 'tuer', 'fenster', 'schlüssel', 'schluessel', 'heizung', 'strom', 'wasser', 'nachbar', 'vermiet', 'einzieh', 'auszieg', 'umzieh', 'keller', 'dach', 'wand', 'boden', 'balkon', 'terrasse'];
  const natureDe = ['natur', 'umwelt', 'wetter', 'klima', 'tier', 'pflanze', 'sauber', 'erde', 'garten', 'landschaft', 'wind', 'regen', 'schnee', 'sonne', 'temperatur', 'grad', 'himmel', 'stern', 'mond', 'wald', 'berg', 'see', 'meer', 'fluss', 'baum', 'blume', 'katze', 'hund', 'vogel', 'pferd', 'kuh', 'sauberkeit', 'schmutz', 'müll', 'muell', 'abfall', 'luft', 'umweltschutz', 'recycling', 'hitze', 'kälte', 'kaelte', 'gewitter', 'sturm', 'wolke', 'nebel'];
  const leisureDe = ['freizeit', 'unterhalt', 'spiel', 'sport', 'hobby', 'musik', 'film', 'kino', 'museum', 'kunst', 'kultur', 'literatur', 'lesen', 'fest', 'feier', 'geburtstag', 'tanz', 'sing', 'theater', 'konzert', 'ausstellung', 'mal', 'foto', 'kamera', 'fernseher', 'radio', 'schach', 'fussball', 'fußball', 'schwimm', 'wandern', 'sportplatz', 'mannschaft', 'verein', 'turnier', 'gewinn', 'verlier', 'party', 'instrument', 'gitarre', 'klavier', 'fotografier'];
  const familyDe = ['person', 'familie', 'freund', 'kind', 'eltern', 'partner', 'beziehung', 'heirat', 'hochzeit', 'mann', 'frau', 'bruder', 'schwe', 'mutter', 'vater', 'sohn', 'tocht', 'onkel', 'tant', 'nich', 'nef', 'großel', 'grossel', 'oma', 'opa', 'enkel', 'baby', 'mensch', 'leute', 'mitglieder', 'geschwister', 'verwandte', 'ehe', 'scheidung', 'alleinerziehend'];
  const emotionDe = ['charakter', 'gefühl', 'gefuehl', 'identität', 'identitaet', 'alter', 'aussehen', 'meinung', 'gedanke', 'denk', 'entscheid', 'lieb', 'hass', 'wut', 'angst', 'freud', 'glück', 'glueck', 'trau', 'streit', 'gespräch', 'gespraech', 'diskussion', 'traurig', 'froh', 'wütend', 'wuetend', 'ängstlich', 'aengstlich', 'stolz', 'schüchtern', 'schuechtern', 'höflich', 'hoeflich', 'nett', 'freundlich', 'sympathisch', 'böse', 'boese', 'dumm', 'klug', 'faul', 'fleißig', 'fleissig', 'ehrlich', 'geduldig', 'nervös', 'nervoes', 'zufrieden', 'unzufrieden', 'persönlichkeit', 'persoenlichkeit', 'hoffen', 'glauben', 'fühlen', 'fuehlen', 'weinen', 'lachen', 'lächeln', 'laecheln', 'meinen', 'empfehl'];
  const communicationDe = ['kommunikation', 'begrüß', 'begruess', 'sag', 'sprech', 'erzähl', 'erzaehl', 'frag', 'antwort', 'versteh', 'telefon', 'handy', 'computer', 'internet', 'e-mail', 'mail', 'anruf', 'brief', 'paket', 'nachricht', 'neuigkeit', 'mobiltelefon', 'netzwerk', 'smartphone', 'tastatur', 'bildschirm', 'datei', 'daten', 'online', 'web', 'apparat', 'tv', 'radio', 'kamera', 'video', 'cd', 'dvd', 'mp3', 'display', 'kabel', 'taste', 'drucker', 'kopier', 'speicher', 'programm', 'digital', 'techn', 'medien', 'anrufen', 'telefonieren', 'reden', 'diskutieren', 'erklären', 'erklaeren', 'vorlesen', 'buchstabieren', 'post', 'stempel', 'plakat', 'zettel', 'zeitung', 'zeitschrift', 'magazin', 'sender', 'empfänger', 'empfaenger', 'anrede', 'grüßen', 'gruessen', 'danken', 'bitten'];
  const documentsDe = ['amt', 'ämter', 'aemter', 'behörde', 'behoerde', 'polizei', 'telekom', 'bank', 'finanz', 'steuer', 'recht', 'politik', 'staat', 'gesellschaft', 'sicherheit', 'notfall', 'notfälle', 'notfaelle', 'feuerwehr', 'rathaus', 'konsulat', 'botschaft', 'ausweis', 'formular', 'unterschrift', 'gebühr', 'gebuehr', 'konto', 'überweisen', 'ueberweisen', 'anwalt', 'gericht', 'gesetz', 'versicherung', 'visum', 'pass', 'zertifikat', 'diplom', 'bestätigung', 'bestaetigung', 'bescheinigung', 'erlaubnis', 'vertrag', 'dokument', 'urkunde', 'antrag', 'anmeldung', 'abmeldung', 'registrier', 'genehmig', 'zoll', 'grenze', 'soldat', 'militär', 'militaer', 'krieg', 'frieden', 'richter', 'staatsanwalt', 'parlament', 'gesetzgeb', 'verfassung', 'partei', 'abgeordnet', 'minister', 'bürger', 'buerger', 'wahl', 'wähler', 'waehler', 'demokratie'];

  // English Keywords (prefix-boundary match on English, e.g. \bfood matches food, foodie)
  const foodEn = ['food', 'drink', 'eat', 'cook', 'kitchen', 'vegetable', 'fruit', 'restaurant', 'bakery', 'beer', 'meat', 'fish', 'banana', 'wine', 'coffee', 'tea', 'soup', 'bake', 'breakfast', 'lunch', 'dinner', 'salad', 'cheese', 'sausage', 'milk', 'potato', 'plate', 'fork', 'knife', 'spoon', 'cup', 'glass', 'menu', 'sugar', 'salt', 'pepper', 'oil', 'vinegar', 'meal', 'pasta', 'rice', 'beef', 'pork', 'chicken', 'bill', 'receipt'];
  const healthEn = ['health', 'body', 'doctor', 'ill', 'sick', 'pharmacy', 'fever', 'bath', 'care', 'medicine', 'pain', 'accident', 'clinic', 'hospital', 'cough', 'cold', 'pill', 'prescription', 'recipe', 'therapy', 'injur', 'blood', 'eye', 'ear', 'mouth', 'tooth', 'teeth', 'head', 'leg', 'arm', 'hand', 'foot', 'feet', 'stomach', 'heart', 'patient', 'practice', 'medication', 'plaster', 'bandage', 'ointment', 'injection', 'vaccin', 'pregnant', 'birth', 'die', 'dead', 'death'];
  const travelEn = ['travel', 'traffic', 'train', 'bus', 'flight', 'fly', 'car', 'bicycle', 'bike', 'ship', 'boat', 'ticket', 'hotel', 'touris', 'pension', 'holiday', 'vacation', 'luggage', 'baggage', 'suitcas', 'station', 'airport', 'depart', 'arriv', 'stau', 'jam', 'street', 'road', 'crossing', 'intersection', 'light', 'platform', 'excursion', 'map', 'passport', 'visa', 'beach', 'sea', 'mountain', 'hike', 'hiking', 'camp', 'tent', 'book', 'reserv', 'delay', 'punctual', 'on time', 'schedule', 'timetable', 'line', 'stop', 'change', 'get in', 'get off', 'fuel', 'gas station'];
  const shopEn = ['shop', 'consum', 'store', 'price', 'pay', 'buy', 'money', 'euro', 'cent', 'cheap', 'expensive', 'cost', 'discount', 'offer', 'supermarket', 'market', 'bag', 'cloth', 'dress', 'pant', 'shoe', 'shirt', 'jacket', 'coat', 'skirt', 'suit', 'material', 'fabric', 'leather', 'wool', 'silk', 'cotton', 'plastic', 'metal', 'wood', 'glass', 'paper', 'seller', 'customer', 'cashier', 'cash register', 'bill', 'receipt', 'guarantee', 'exchange', 'reduced', 'special offer'];
  const workEn = ['work', 'job', 'profession', 'career', 'colleague', 'office', 'apply', 'application', 'boss', 'employee', 'employer', 'master', 'workshop', 'factory', 'salary', 'wage', 'contract', 'resign', 'dismiss', 'strike', 'workplace', 'unemploy', 'overtime', 'resume', 'cv', 'internship', 'manager', 'director', 'lead'];
  const educationEn = ['school', 'learn', 'educat', 'stud', 'universit', 'college', 'class', 'teach', 'student', 'pupil', 'exam', 'test', 'task', 'exercise', 'homework', 'mistake', 'error', 'course', 'certificate', 'diploma', 'subject', 'math', 'calculat', 'write', 'read', 'vocab', 'dictionar', 'lesson', 'semester', 'term', 'professor', 'grade', 'mark'];
  const homeEn = ['live', 'house', 'room', 'furnitur', 'rent', 'household', 'tool', 'architect', 'build', 'table', 'chair', 'bed', 'cabinet', 'cupboard', 'shelf', 'shelves', 'sofa', 'couch', 'lamp', 'door', 'window', 'key', 'heat', 'electric', 'power', 'water', 'neighbor', 'landlord', 'flat', 'apartment', 'kitchen', 'bathroom', 'balcony', 'terrace', 'cellar', 'basement', 'roof', 'wall', 'floor', 'move in', 'move out', 'move house'];
  const natureEn = ['natur', 'environ', 'weather', 'climat', 'animal', 'plant', 'clean', 'earth', 'garden', 'landscap', 'wind', 'rain', 'snow', 'sun', 'temperatur', 'degree', 'sky', 'star', 'moon', 'forest', 'wood', 'mountain', 'lake', 'sea', 'ocean', 'river', 'tree', 'flower', 'cat', 'dog', 'bird', 'horse', 'cow', 'dirt', 'garbage', 'trash', 'waste', 'pollution', 'recycl', 'heat', 'cold', 'thunder', 'storm', 'cloud', 'fog'];
  const leisureEn = ['leisure', 'entertain', 'game', 'play', 'sport', 'hobby', 'music', 'film', 'movie', 'cinema', 'museum', 'art', 'cultur', 'literatur', 'read', 'festival', 'party', 'celebrat', 'birthday', 'dance', 'sing', 'theat', 'concert', 'exhibit', 'paint', 'photo', 'camera', 'tv', 'television', 'radio', 'chess', 'soccer', 'football', 'swim', 'hike', 'stadium', 'team', 'club', 'tournament', 'win', 'lose', 'instrument', 'guitar', 'piano'];
  const familyEn = ['person', 'family', 'friend', 'child', 'parent', 'partner', 'relation', 'marry', 'marriag', 'wedding', 'man', 'men', 'woman', 'women', 'brother', 'sister', 'mother', 'father', 'son', 'daughter', 'uncle', 'tante', 'niece', 'nephew', 'grandparent', 'grandma', 'grandpa', 'grandson', 'granddaught', 'baby', 'human', 'people', 'member', 'sibling', 'relative', 'divorce'];
  const emotionEn = ['charact', 'feel', 'emotion', 'identit', 'age', 'look', 'opinion', 'thought', 'think', 'decid', 'decision', 'love', 'hate', 'anger', 'angry', 'fear', 'afraid', 'joy', 'happy', 'happine', 'sad', 'grief', 'quarrel', 'argu', 'fight', 'discuss', 'proud', 'shy', 'polite', 'nice', 'kind', 'friendly', 'sympathetic', 'bad', 'stupid', 'clever', 'smart', 'lazy', 'diligent', 'honest', 'patient', 'nervous', 'satisfied', 'disappointed', 'personality', 'hope', 'believe', 'cry', 'laugh', 'smile', 'mean', 'recommend'];
  const communicationEn = ['communicat', 'greet', 'say', 'speak', 'talk', 'tell', 'ask', 'answer', 'reply', 'understand', 'conversation', 'telephone', 'phone', 'cell phone', 'mobile', 'computer', 'laptop', 'internet', 'e-mail', 'email', 'mail', 'call', 'letter', 'parcel', 'package', 'message', 'news', 'network', 'smartphone', 'keyboard', 'screen', 'monitor', 'file', 'data', 'online', 'web', 'device', 'tv', 'radio', 'camera', 'video', 'cd', 'dvd', 'mp3', 'display', 'cable', 'button', 'key', 'printer', 'copi', 'memor', 'storag', 'program', 'digital', 'techn', 'media', 'post', 'stamp', 'poster', 'note', 'newspaper', 'journal', 'magazin', 'broadcast', 'sender', 'receiver', 'salutation', 'thank', 'please'];
  const documentsEn = ['office', 'authorit', 'police', 'post', 'telecom', 'bank', 'financ', 'tax', 'law', 'legal', 'polit', 'state', 'societ', 'security', 'emergenc', 'fire brigade', 'city hall', 'rathaus', 'consulat', 'embassy', 'id card', 'identification', 'form', 'sign', 'signature', 'fee', 'account', 'transfer', 'card', 'lawyer', 'attorney', 'court', 'insur', 'visa', 'passport', 'certificat', 'diploma', 'confirm', 'contract', 'document', 'deed', 'request', 'register', 'zoll', 'custom', 'border', 'soldier', 'militar', 'war', 'peace', 'judge', 'parliament', 'constitut', 'party', 'minister', 'citizen', 'vote', 'voter', 'democrac'];

  // 1. Structural & Grammatical checks FIRST (so they don't get swept into semantic categories accidentally)
  if (['pronoun', 'preposition', 'conjunction', 'article', 'adverb'].includes(wc) || grammarExactDe.has(w_clean)) {
    return 'Grammatik, Pronomen & Struktur';
  }
  
  if (wc === 'number' || numbersExactDe.has(w_clean) || m.includes('number') || m.includes('numeral') || m.includes('measure') || m.includes('unit ') || m.includes('quantity') || ['grad', 'kilo', 'meter', 'liter', 'gramm', 'portion', 'paar', 'stück', 'teil', 'größe', 'prozent', 'tonne', 'gewicht', 'länge', 'breite', 'höhe', 'tiefe'].includes(w_clean)) {
    return 'Zahlen, Maße & Mengen';
  }
  
  if (timeExactDe.has(w_clean) || ['uhr', 'jahr', 'monat', 'woche', 'tag', 'sekunde', 'minute', 'stunde', 'quartal', 'zeitraum', 'spät', 'früh', 'jetzt', 'dann', 'danach', 'heute', 'gestern', 'morgen', 'bald', 'sofort', 'später', 'pünktlich', 'puenktlich', 'dauer'].includes(w_clean)) {
    return 'Uhrzeit, Datum & Kalender';
  }

  // Helper match functions
  const matchDe = (stems) => {
    for (const stem of stems) {
      if (stem === 'auto' && w_clean.startsWith('autor')) continue;
      if (stem === 'pass' && (w_clean.startsWith('passier') || w_clean.startsWith('passen') || w_clean.startsWith('passend'))) continue;
      const re = new RegExp('\\b' + stem.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
      if (re.test(w_clean)) return true;
    }
    return false;
  };

  const matchEn = (keywords) => {
    for (const kw of keywords) {
      const re = new RegExp('\\b' + kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b');
      if (re.test(m)) return true;
    }
    return false;
  };

  // 2. Match Specific Themes/Keywords with high priority
  if (matchDe(communicationDe) || matchEn(communicationEn)) return 'Kommunikation, Medien & Sprache';
  if (matchDe(documentsDe) || matchEn(documentsEn)) return 'Staat, Gesellschaft & Dokumente';
  if (matchDe(emotionDe) || matchEn(emotionEn)) return 'Gefühle, Charakter & Meinung';
  if (matchDe(foodDe) || matchEn(foodEn)) return 'Essen, Kochen & Restaurant';
  if (matchDe(healthDe) || matchEn(healthEn)) return 'Gesundheit, Körper & Pflege';
  if (matchDe(travelDe) || matchEn(travelEn)) return 'Reise, Verkehr & Mobilität';
  if (matchDe(shopDe) || matchEn(shopEn)) return 'Einkaufen, Geld & Konsum';
  if (matchDe(workDe) || matchEn(workEn)) return 'Arbeit, Beruf & Karriere';
  if (matchDe(educationDe) || matchEn(educationEn)) return 'Ausbildung, Schule & Studium';
  if (matchDe(homeDe) || matchEn(homeEn)) return 'Wohnen, Haus & Haushalt';
  if (matchDe(natureDe) || matchEn(natureEn)) return 'Natur, Umwelt & Tiere';
  if (matchDe(leisureDe) || matchEn(leisureEn)) return 'Freizeit, Hobbys & Unterhaltung';
  if (matchDe(familyDe) || matchEn(familyEn)) return 'Person, Familie & Beziehungen';

  // 3. Direct Map Mapping based on raw themes
  const tMapping = {
    'person & familie': 'Person, Familie & Beziehungen',
    'person, familie & beziehungen': 'Person, Familie & Beziehungen',
    'gefühle, charakter & meinung': 'Gefühle, Charakter & Meinung',
    'wohnen & haushalt': 'Wohnen, Haus & Haushalt',
    'wohnen, haus & haushalt': 'Wohnen, Haus & Haushalt',
    'gesundheit & körper': 'Gesundheit, Körper & Pflege',
    'gesundheit, körper & pflege': 'Gesundheit, Körper & Pflege',
    'natur & umwelt': 'Natur, Umwelt & Tiere',
    'natur, umwelt & tiere': 'Natur, Umwelt & Tiere',
    'reise & verkehr': 'Reise, Verkehr & Mobilität',
    'reise, verkehr & mobilität': 'Reise, Verkehr & Mobilität',
    'essen & trinken': 'Essen, Kochen & Restaurant',
    'essen, kochen & restaurant': 'Essen, Kochen & Restaurant',
    'einkaufen & konsum': 'Einkaufen, Geld & Konsum',
    'einkaufen, geld & konsum': 'Einkaufen, Geld & Konsum',
    'dienstleistungen & behörden': 'Staat, Gesellschaft & Dokumente',
    'staat, gesellschaft & dokumente': 'Staat, Gesellschaft & Dokumente',
    'ausbildung & lernen': 'Ausbildung, Schule & Studium',
    'ausbildung, schule & studium': 'Ausbildung, Schule & Studium',
    'arbeit & beruf': 'Arbeit, Beruf & Karriere',
    'arbeit, beruf & karriere': 'Arbeit, Beruf & Karriere',
    'freizeit & unterhaltung': 'Freizeit, Hobbys & Unterhaltung',
    'freizeit, hobbys & unterhaltung': 'Freizeit, Hobbys & Unterhaltung',
    'medien, technik & digitales': 'Kommunikation, Medien & Sprache',
    'kommunikation, medien & sprache': 'Kommunikation, Medien & Sprache',
    'gesellschaft, recht & staat': 'Staat, Gesellschaft & Dokumente',
    'allgemeine aktivitäten & verben': 'Allgemeine Aktivitäten & Verben',
    'eigenschaften & adjektive': 'Eigenschaften & Adjektive',
    'basiswortschatz & floskeln': 'Basiswortschatz & Floskeln'
  };

  const mappedCat = tMapping[t];
  if (mappedCat) {
    return mappedCat;
  }

  // 4. Falling back to Word Class
  if (wc.includes('verb')) {
    return 'Allgemeine Aktivitäten & Verben';
  }
  if (wc.includes('adjektiv') || wc.includes('adj') || wc.includes('adjective')) {
    return 'Eigenschaften & Adjektive';
  }

  return 'Basiswortschatz & Floskeln';
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
    const rawQuery = state.searchQuery.trim();
    
    // Check if RegExp search e.g. /regex/
    const rxMatch = rawQuery.match(/^\/(.*)\/([gimy]*)$/);
    if (rxMatch) {
      try {
        const pattern = rxMatch[1];
        const flags = rxMatch[2] || 'i';
        const regex = new RegExp(pattern, flags);
        
        filtered = filtered.filter(card => 
          regex.test(card.word) || 
          regex.test(card.meaning) ||
          (card.exampleDe && regex.test(card.exampleDe)) ||
          (card.exampleEn && regex.test(card.exampleEn))
        );
      } catch (err) {
        console.error("Invalid regular expression in search:", err);
        // On invalid regex, fallback to empty array to indicate no matches
        filtered = [];
      }
    } else {
      // Tokenized multi-category filter search
      const tokens = rawQuery.toLowerCase().split(/\s+/);
      const plainTokens = [];
      const filters = {
        wordClass: [],
        gender: [],
        srs: [],
        theme: []
      };

      tokens.forEach(token => {
        if (token.includes(':')) {
          const [key, val] = token.split(':', 2);
          if (key === 'is') {
            if (val === 'noun' || val === 'nomen') filters.wordClass.push('nomen');
            else if (val === 'verb') filters.wordClass.push('verb');
            else if (val === 'adj' || val === 'adjective' || val === 'adjektiv') filters.wordClass.push('adjektiv');
            else if (val === 'adv' || val === 'adverb') filters.wordClass.push('adverb');
            else if (val === 'pronoun' || val === 'pronomen') filters.wordClass.push('pronomen');
            else if (val === 'preposition' || val === 'präposition') filters.wordClass.push('präposition');
            else if (val === 'conjunction' || val === 'konjunktion') filters.wordClass.push('konjunktion');
            else filters.wordClass.push(val);
          } else if (key === 'gender' || key === 'g') {
            filters.gender.push(val);
          } else if (key === 'srs') {
            filters.srs.push(val);
          } else if (key === 'theme' || key === 't' || key === 'cat' || key === 'category') {
            filters.theme.push(val);
          } else {
            plainTokens.push(token);
          }
        } else {
          plainTokens.push(token);
        }
      });

      // Filter by the collected filter lists
      filtered = filtered.filter(card => {
        // 1. Word class filter (OR inside wordClass list)
        if (filters.wordClass.length > 0) {
          const cardClass = (card.wordClass || '').toLowerCase();
          if (!filters.wordClass.includes(cardClass)) return false;
        }

        // 2. Gender filter (OR inside gender list)
        if (filters.gender.length > 0) {
          const cardGender = (card.gender || '').toLowerCase();
          if (!filters.gender.includes(cardGender)) return false;
        }

        // 3. SRS state filter (OR inside srs list)
        if (filters.srs.length > 0) {
          const srsInfo = getSRSInfo(card.id);
          const matchesSrs = filters.srs.some(val => {
            if (val === 'due') return srsInfo.isDue && !srsInfo.isNew;
            if (val === 'new') return srsInfo.isNew;
            if (val === 'learned' || val === 'review') return !srsInfo.isNew;
            return false;
          });
          if (!matchesSrs) return false;
        }

        // 4. Theme / Category filter (OR inside theme list)
        if (filters.theme.length > 0) {
          const cardCat = (card.category || '').toLowerCase();
          const matchesTheme = filters.theme.some(val => cardCat.includes(val));
          if (!matchesTheme) return false;
        }

        // 5. Plain keyword tokens (AND across all plain keywords)
        if (plainTokens.length > 0) {
          const cardWord = card.word.toLowerCase();
          const cardMeaning = card.meaning.toLowerCase();
          const cardExDe = (card.exampleDe || '').toLowerCase();
          const cardExEn = (card.exampleEn || '').toLowerCase();

          return plainTokens.every(keyword => 
            cardWord.includes(keyword) || 
            cardMeaning.includes(keyword) ||
            cardExDe.includes(keyword) ||
            cardExEn.includes(keyword)
          );
        }

        return true;
      });
    }
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

  if (elements.cardGrammarMatrixTrigger) {
    elements.cardGrammarMatrixTrigger.addEventListener('click', (e) => {
      e.stopPropagation(); // Avoid triggering card toggleAccordion click
      toggleGrammarMatrix();
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

  // Bind Quick-Filter Tag Chips (V6.1)
  const quickTags = document.querySelectorAll('.search-tag-chip');
  quickTags.forEach(chip => {
    chip.addEventListener('click', () => {
      const tagText = chip.getAttribute('data-tag');
      const input = elements.searchInput;
      if (input) {
        let currentVal = input.value.trim();
        if (currentVal) {
          if (!currentVal.toLowerCase().includes(tagText.toLowerCase())) {
            input.value = currentVal + ' ' + tagText;
          }
        } else {
          input.value = tagText;
        }
        state.searchQuery = input.value.trim();
        if (elements.searchClear) {
          elements.searchClear.classList.remove('hidden');
        }
        filterDeck();
        input.focus();
      }
    });
  });


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
    async () => {
      if (state.trainer && state.trainer.active) {
        stopAudioTrainer();
      }

      await resetActiveLevelProgress();
      
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

function toggleHelpModal() {
  const overlay = document.getElementById('help-modal-overlay');
  if (!overlay) return;
  if (overlay.classList.contains('hidden')) {
    overlay.classList.remove('hidden');
    const closeBtn = document.getElementById('help-modal-close');
    if (closeBtn) requestAnimationFrame(() => closeBtn.focus());
  } else {
    overlay.classList.add('hidden');
  }
}

function initHelpModal() {
  const helpFab = document.getElementById('help-fab');
  const closeBtn = document.getElementById('help-modal-close');
  const ackBtn = document.getElementById('help-modal-ack');
  const overlay = document.getElementById('help-modal-overlay');

  if (helpFab) {
    helpFab.addEventListener('click', (e) => {
      e.preventDefault();
      toggleHelpModal();
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      toggleHelpModal();
    });
  }
  if (ackBtn) {
    ackBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (overlay) overlay.classList.add('hidden');
      if (!state.visitedIntro) {
        state.visitedIntro = true;
        safeSetItem('visited_intro', 'true');
      }
    });
  }
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) toggleHelpModal();
    });
  }

  // Trigger modal on first-time visit automatically after data loads
  if (!state.visitedIntro && overlay) {
    setTimeout(() => {
      overlay.classList.remove('hidden');
    }, 1500);
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

  // B1: Dismiss help modal overlay on Escape
  const helpOverlay = document.getElementById('help-modal-overlay');
  if (helpOverlay && !helpOverlay.classList.contains('hidden')) {
    if (e.key === 'Escape') {
      e.preventDefault();
      toggleHelpModal();
      return;
    }
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

  // B1: ? or / key toggles Help & Intro Modal (works on ALL routes)
  if (e.key === '?' || e.key === '/') {
    e.preventDefault();
    toggleHelpModal();
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
  initHelpModal();

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
