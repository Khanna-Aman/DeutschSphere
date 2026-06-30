// js/state.js — Global State & DOM Elements Selector Module

import { FSRS, fsrs, State as FSRSState, Rating } from './fsrs.js';
import * as idb from './idb-keyval.js';

// ==========================================
// SHARED UTILITIES
// ==========================================

/**
 * Escapes special HTML characters to prevent XSS injection in innerHTML.
 * Uses the browser's own textContent→innerHTML encoding for correctness.
 * C3 Audit: Module-scoped element prevents creating a transient DOM node per call.
 * @param {string} str - The raw string to escape.
 * @returns {string} HTML-safe string.
 */
const _escapeDiv = document.createElement('div');
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  _escapeDiv.textContent = str;
  return _escapeDiv.innerHTML;
}

// ==========================================
// PERSISTENCE SAFETY LAYER
// Provides safe wrappers for localStorage to prevent crashes from
// corrupted data, quota exhaustion, and rapid write flooding.
// ==========================================

/**
 * Safely reads and parses a JSON value from localStorage.
 * Returns the fallback value if the key is missing, the value is
 * corrupted, or JSON.parse throws an exception.
 * @param {string} key - The localStorage key to read.
 * @param {*} fallback - The default value to return on any failure.
 * @returns {*} The parsed value, or the fallback.
 */
export function safeJsonParse(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`[Persistence] Failed to parse localStorage key "${key}":`, e);
    return fallback;
  }
}

/**
 * F9: Safely reads a raw string value from localStorage.
 * Returns the fallback if key is missing or storage is unavailable.
 * @param {string} key - The localStorage key to read.
 * @param {string} fallback - The default value to return on any failure.
 * @returns {string} The stored value, or the fallback.
 */
export function safeGetItem(key, fallback = '') {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? raw : fallback;
  } catch (e) {
    console.warn(`[Persistence] Failed to read localStorage key "${key}":`, e);
    return fallback;
  }
}

/**
 * Safely writes a value to localStorage with QuotaExceededError handling.
 * @param {string} key - The localStorage key to write.
 * @param {string} value - The serialized value string.
 * @returns {boolean} True if the write succeeded.
 */
export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn(`[Persistence] Failed to write localStorage key "${key}" (quota exceeded?):`, e);
    return false;
  }
}

// Pending debounced writes registry: Map<key, { dataFn, timerId }>
const pendingWrites = new Map();

/**
 * Schedules a debounced localStorage write. Rapid calls with the same
 * key within the delay window collapse into a single write.
 * @param {string} key - The localStorage key to write.
 * @param {function} dataFn - A function that returns the serialized string value.
 * @param {number} delayMs - Debounce delay in milliseconds (default 300ms).
 */
export function schedulePersist(key, dataFn, delayMs = 300) {
  const existing = pendingWrites.get(key);
  if (existing) {
    clearTimeout(existing.timerId);
  }
  const timerId = setTimeout(() => {
    idb.set(key, dataFn()).catch(e => console.warn('[IDB] Write failed:', e));
    pendingWrites.delete(key);
  }, delayMs);
  pendingWrites.set(key, { dataFn, timerId });
}

/**
 * Immediately flushes all pending debounced writes.
 * Called on beforeunload to prevent data loss on tab close.
 */
export function flushAllPending() {
  for (const [key, { dataFn, timerId }] of pendingWrites) {
    clearTimeout(timerId);
    const data = dataFn();
    idb.set(key, data).catch(e => console.warn('[IDB] Flush failed:', e));
    try {
      localStorage.setItem(key, data);
    } catch (e) {
      console.warn('[Storage] LocalStorage fallback write failed:', e);
    }
  }
  pendingWrites.clear();
}

// Ensure pending writes are flushed when the tab/window closes
window.addEventListener('beforeunload', flushAllPending);

// F20: Mobile browsers may not fire beforeunload reliably — visibilitychange is more reliable
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    flushAllPending();
  }
});

// Category English Translations
export const categoryTranslations = {
  'All': 'All Categories',
  'Person, Familie & Beziehungen': 'Person, Family & Relationships',
  'Gefühle, Charakter & Meinung': 'Feelings, Character & Opinion',
  'Wohnen, Haus & Haushalt': 'Housing, Home & Household',
  'Gesundheit, Körper & Pflege': 'Health, Body & Care',
  'Natur, Umwelt & Tiere': 'Nature, Environment & Animals',
  'Reise, Verkehr & Mobilität': 'Travel, Traffic & Mobility',
  'Essen, Kochen & Restaurant': 'Food, Cooking & Restaurant',
  'Einkaufen, Geld & Konsum': 'Shopping, Money & Consumption',
  'Ausbildung, Schule & Studium': 'Education, School & University',
  'Arbeit, Beruf & Karriere': 'Work, Profession & Career',
  'Freizeit, Hobbys & Unterhaltung': 'Leisure, Hobbies & Entertainment',
  'Kommunikation, Medien & Sprache': 'Communication, Media & Language',
  'Staat, Gesellschaft & Dokumente': 'State, Society & Documents',
  'Grammatik, Pronomen & Struktur': 'Grammar, Pronouns & Structure',
  'Zahlen, Maße & Mengen': 'Numbers, Measurements & Quantities',
  'Uhrzeit, Datum & Kalender': 'Time, Date & Calendar',
  'Allgemeine Aktivitäten & Verben': 'General Activities & Verbs',
  'Eigenschaften & Adjektive': 'Properties & Adjectives',
  'Basiswortschatz & Floskeln': 'Basic Vocabulary & Phrases'
};

// Central Reactive Application State
export const state = {
  currentLevel: safeGetItem('current_level', 'a1'), // Active CEFR Level ('a1', 'a2', 'b1')
  visitedIntro: safeGetItem('visited_intro', 'false') === 'true', // Has the visitor completed the intro tour modal?
  allCards: [],          // Raw normalized vocabulary elements
  antonymIndex: null,    // Map<lowercaseCleanWord, card> for O(1) antonym lookup (built during data load)
  filteredCards: [],     // Cards filtered by active category + search text
  currentDeck: [],       // Active card deck layout (shuffled or ordered)
  currentIndex: 0,       // Current active card index
  isShuffled: false,     // Shuffling toggle active
  activeCategory: 'All', // Active category selector ('All' or tag)
  searchQuery: '',       // Active search term
  isAccordionOpen: false, // Core flashcard accordion revealed state
  isFastRead: safeGetItem('is_fast_read', 'false') === 'true',      // Fast Read toggle state
  hideLearned: safeGetItem('hide_learned', 'false') === 'true',     // Hide learned cards filter state
  isAutoPlaySpeech: safeGetItem('is_autoplay_speech', 'false') === 'true', // Auto-TTS speech on active card transitions
  showImages: safeGetItem('show_images', 'true') !== 'false', // Visual aids render flag
  showExamples: safeGetItem('show_examples', 'true') !== 'false', // Example sentences render flag
  sfxVolume: parseFloat(safeGetItem('sfx_volume', '0.5')), // SFX Volume (0.0 to 1.0)
  audioTone: safeGetItem('audio_tone', 'synth'), // SFX sound tone ('synth' or 'acoustic')
  learnedCards: new Set(), // Set of active level-scoped learned card IDs
  autoplayTimeoutId: null, // Timer ID for auto-pronounce execution
  
  // Quiz Arena Sub-State
  quiz: {
    active: false,
    mode: null,                // 'mc' (Multiple-Choice) or 'spelling' (Spelling test)
    questions: [],             // Question list in active round
    currentQuestionIndex: 0,
    score: 0,
    roundLength: 10,
    isAnswered: false,
    currentQuestion: null,
    options: [],               // Text options for MC choices
    isEndless: false           // Endless loop quiz active
  },

  // FSRS Spaced Repetition database (migrated from Leitner)
  // Maps cardId -> { state, difficulty, stability, due, lastReview, reps, lapses, box, nextReview, lastReviewed }
  srs: {},

  // Session Analytics Tracking
  session: {
    startTime: null,        // Timestamp when session began
    cardsReviewed: 0,
    correctCount: 0,
    wrongCount: 0
  },

  // Dual-Voice Continuous Pronunciation Trainer Sub-State
  trainer: {
    active: false,
    step: 'idle', // 'idle', 'word', 'recall_pause', 'meaning', 'sentence', 'settle_pause'
    timerId: null,
    loop: false,
    speed: 1.0,
    isNaturalAdvance: false
  },

  // Phonetik-Spiegel (Phonetic Voice Mirror) State
  phonetic: {
    isOpen: false,
    isRecording: false,
    recognition: null,
    audioContext: null,
    analyser: null,
    microphoneStream: null,
    nativeAnimationId: null,
    learnerAnimationId: null,
    isNativePlaying: false
  }
};

// Global DOM Selectors Handles Cache
export const elements = {
  levelSelect: document.getElementById('level-select'),
  loaderOverlay: document.getElementById('loader-overlay'),
  errorOverlay: document.getElementById('error-overlay'),
  errorMessage: document.getElementById('error-message'),
  sidebar: document.getElementById('sidebar'),
  sidebarBackdrop: document.getElementById('sidebar-backdrop'),
  mobileSidebarToggle: document.getElementById('mobile-sidebar-toggle'),
  mobileSidebarClose: document.getElementById('mobile-sidebar-close'),
  categoriesContainer: document.getElementById('categories-container'),
  searchInput: document.getElementById('search-input'),
  searchClear: document.getElementById('search-clear'),
  currentCategoryTitle: document.getElementById('current-category-title'),
  deckStats: document.getElementById('deck-stats'),
  shuffleBtn: document.getElementById('shuffle-btn'),
  progressBarFill: document.getElementById('progress-bar-fill'),
  deckProgressText: document.getElementById('deck-progress-text'),
  overallProgressText: document.getElementById('overall-progress-text'),
  overallProgressBarFill: document.getElementById('overall-progress-bar-fill'),
  resetProgressBtn: document.getElementById('reset-progress-btn'),
  flashcard: document.getElementById('flashcard'),
  cardIndexIndicator: document.getElementById('card-index-indicator'),
  cardMetadataBadges: document.getElementById('card-metadata-badges'),
  cardWord: document.getElementById('card-word'),
  cardPronunciation: document.getElementById('card-pronunciation'),
  accordionReveal: document.getElementById('accordion-reveal'),
  cardMeaning: document.getElementById('card-meaning'),
  cardExamplesContainer: document.getElementById('card-examples-container'),
  cardExampleDe: document.getElementById('card-example-de'),
  cardExampleEn: document.getElementById('card-example-en'),
  cardAntonymContainer: document.getElementById('card-antonym-container'),
  cardAntonym: document.getElementById('card-antonym'),
  prevBtn: document.getElementById('prev-btn'),
  nextBtn: document.getElementById('next-btn'),
  toggleRevealBtn: document.getElementById('toggle-reveal-btn'),
  learnedBtn: document.getElementById('learned-btn'),
  toggleRevealIcon: document.getElementById('toggle-reveal-icon'),
  toggleRevealText: document.getElementById('toggle-reveal-text'),
  speakBtn: document.getElementById('speak-btn'),
  readModeBtn: document.getElementById('read-mode-btn'),
  readModeText: document.getElementById('read-mode-text'),
  hideLearnedBtn: document.getElementById('hide-learned-btn'),
  hideLearnedText: document.getElementById('hide-learned-text'),
  autoplayBtn: document.getElementById('autoplay-btn'),
  autoplayText: document.getElementById('autoplay-text'),
  toggleImagesBtn: document.getElementById('toggle-images-btn'),
  toggleImagesText: document.getElementById('toggle-images-text'),
  toggleExamplesBtn: document.getElementById('toggle-examples-btn'),
  toggleExamplesText: document.getElementById('toggle-examples-text'),
  resetProgressBtnMain: document.getElementById('reset-progress-btn-main'),
  deckPrefsToggleBtn: document.getElementById('deck-prefs-toggle-btn'),
  deckPrefsDropdown: document.getElementById('deck-prefs-dropdown'),
  cardImageContainer: document.getElementById('card-image-container'),
  cardImage: document.getElementById('card-image'),

  fsrsGradePanel: document.getElementById('fsrs-grade-panel'),
  swipeGoodHint: document.getElementById('swipe-good-hint'),
  swipeAgainHint: document.getElementById('swipe-again-hint'),
  mobileNavCards: document.getElementById('mobile-nav-cards'),
  mobileNavQuizTab: document.getElementById('mobile-nav-quiz-tab'),
  mobileNavImmersionTab: document.getElementById('mobile-nav-immersion-tab'),
  mobileNavMenuBtn: document.getElementById('mobile-nav-menu-btn'),
  sidebarSessionReviewed: document.getElementById('sidebar-session-reviewed'),
  sidebarMasteredCount: document.getElementById('sidebar-mastered-count'),
  suffixHelperTrigger: document.getElementById('suffix-helper-trigger'),
  suffixDrawer: document.getElementById('suffix-drawer'),
  suffixDrawerBadge: document.getElementById('suffix-drawer-badge'),
  suffixDrawerTitle: document.getElementById('suffix-drawer-title'),
  suffixDrawerRule: document.getElementById('suffix-drawer-rule'),
  flashcardsView: document.getElementById('flashcards-view'),
  workspaceContainer: document.getElementById('flashcard-workspace-container'),
  workspaceGrid: document.getElementById('flashcard-workspace-grid'),
  workspaceLeft: document.getElementById('flashcard-workspace-left'),
  workspaceRight: document.getElementById('flashcard-workspace-right'),
  navFlashcards: document.getElementById('nav-flashcards'),
  
  // Continuous Dual-Voice Audio Trainer
  trainerPlayBtn: document.getElementById('trainer-play-btn'),
  trainerPrevBtn: document.getElementById('trainer-prev-btn'),
  trainerNextBtn: document.getElementById('trainer-next-btn'),
  trainerSpeedSlider: document.getElementById('trainer-speed-slider'),
  trainerSpeedVal: document.getElementById('trainer-speed-val'),
  trainerLoopBtn: document.getElementById('trainer-loop-btn'),
  trainerLoopText: document.getElementById('trainer-loop-text'),
  trainerPlayIcon: document.getElementById('trainer-play-icon'),
  trainerStatusIcon: document.getElementById('trainer-status-icon'),
  trainerStatusText: document.getElementById('trainer-status-text'),
  trainerPulseRing: document.getElementById('trainer-pulse-ring'),
  
  // Quiz Arena
  quizView: document.getElementById('quiz-view'),
  navQuiz: document.getElementById('nav-quiz'),
  quizModeSelector: document.getElementById('quiz-mode-selector'),
  quizModeMc: document.getElementById('quiz-mode-mc'),
  quizModeSpelling: document.getElementById('quiz-mode-spelling'),
  quizWorkspace: document.getElementById('quiz-workspace'),
  quizModeBadge: document.getElementById('quiz-mode-badge'),
  quizProgressText: document.getElementById('quiz-progress-text'),
  quizProgressBarFill: document.getElementById('quiz-progress-bar-fill'),
  quizCardImageContainer: document.getElementById('quiz-card-image-container'),
  quizCardImage: document.getElementById('quiz-card-image'),
  quizWordClass: document.getElementById('quiz-word-class'),
  quizQuestionPrompt: document.getElementById('quiz-question-prompt'),
  quizQuestionSubprompt: document.getElementById('quiz-question-subprompt'),
  quizOptionsContainer: document.getElementById('quiz-options-container'),
  quizSpellingContainer: document.getElementById('quiz-spelling-container'),
  quizSpellingInput: document.getElementById('quiz-spelling-input'),
  quizSpellingSubmit: document.getElementById('quiz-spelling-submit'),
  quizFeedbackPanel: document.getElementById('quiz-feedback-panel'),
  quizFeedbackIcon: document.getElementById('quiz-feedback-icon'),
  quizFeedbackTitle: document.getElementById('quiz-feedback-title'),
  quizFeedbackText: document.getElementById('quiz-feedback-text'),
  quizNextQuestionBtn: document.getElementById('quiz-next-question-btn'),
  quizResults: document.getElementById('quiz-results'),
  quizStatsScore: document.getElementById('quiz-stats-score'),
  quizStatsAccuracy: document.getElementById('quiz-stats-accuracy'),
  quizRetryBtn: document.getElementById('quiz-retry-btn'),
  quizQuitBtn: document.getElementById('quiz-quit-btn'),
  backupExportBtn: document.getElementById('backup-export-btn'),
  backupImportFile: document.getElementById('backup-import-file'),
  backupImportFeedback: document.getElementById('backup-import-feedback'),
  
  // Custom Controls Overrides
  themeSelect: document.getElementById('theme-select'),
  toggleShortcutsBtn: document.getElementById('toggle-shortcuts-btn'),
  shortcutsContent: document.getElementById('shortcuts-content'),
  shortcutsToggleIcon: document.getElementById('shortcuts-toggle-icon'),
  quizLengthSelect: document.getElementById('quiz-length-select'),
  quizFinishEarlyBtn: document.getElementById('quiz-finish-early-btn'),
  sfxVolumeSlider: document.getElementById('sfx-volume-slider'),
  sfxVolumeVal: document.getElementById('sfx-volume-val'),
  soundStyleBtn: document.getElementById('sound-style-btn'),
  soundStyleText: document.getElementById('sound-style-text'),
  helpModalOverlay: document.getElementById('help-modal-overlay'),
  helpModalClose: document.getElementById('help-modal-close'),
  helpModalAck: document.getElementById('help-modal-ack'),
  helpFab: document.getElementById('help-btn-mobile') || document.getElementById('help-btn-desktop'),
  helpBtnMobile: document.getElementById('help-btn-mobile'),
  helpBtnDesktop: document.getElementById('help-btn-desktop'),


  // Phonetik-Spiegel (Voice Mirror)
  phoneticBtn: document.getElementById('phonetic-btn'),
  phoneticMirrorPanel: document.getElementById('phonetic-mirror-panel'),
  phoneticCloseBtn: document.getElementById('phonetic-close-btn'),
  phoneticRecordBtn: document.getElementById('phonetic-record-btn'),
  phoneticRecordIcon: document.getElementById('phonetic-record-icon'),
  phoneticPulseRing: document.getElementById('phonetic-pulse-ring'),
  phoneticStatusMsg: document.getElementById('phonetic-status-msg'),
  phoneticSpecNative: document.getElementById('phonetic-spec-native'),
  phoneticSpecLearner: document.getElementById('phonetic-spec-learner'),
  phoneticEvaluationPanel: document.getElementById('phonetic-evaluation-panel'),
  phoneticScoreBadge: document.getElementById('phonetic-score-badge'),
  phoneticMatchedChars: document.getElementById('phonetic-matched-chars'),
  phoneticFeedbackMsg: document.getElementById('phonetic-feedback-msg'),
  phoneticMouthGuideContainer: document.getElementById('phonetic-mouth-guide-container'),
  nativeSpecHint: document.getElementById('native-spec-hint'),
  learnerSpecHint: document.getElementById('learner-spec-hint'),
  learnerSpecStatus: document.getElementById('learner-spec-status'),

  // Immersions-Labor (NLP Engine)
  navImmersion: document.getElementById('nav-immersion'),
  immersionView: document.getElementById('immersion-view'),
  immersionTextarea: document.getElementById('immersion-textarea'),
  immersionAnalyzeBtn: document.getElementById('immersion-analyze-btn'),
  immersionResultsGrid: document.getElementById('immersion-results-grid'),
  immersionEmptyState: document.getElementById('immersion-empty-state'),
  immersionExplorerOverlay: document.getElementById('immersion-explorer-overlay'),
  immersionExplorerCloseBtn: document.getElementById('immersion-explorer-close-btn'),
  explorerGermanWord: document.getElementById('explorer-german-word'),
  explorerWordClass: document.getElementById('explorer-word-class'),
  explorerEnglishMeaning: document.getElementById('explorer-english-meaning'),
  explorerCefrLevel: document.getElementById('explorer-cefr-level'),
  explorerFsrsState: document.getElementById('explorer-fsrs-state'),
  explorerFormsContainer: document.getElementById('explorer-forms-container'),
  explorerFormsText: document.getElementById('explorer-forms-text'),
  explorerExampleDe: document.getElementById('explorer-example-de'),
  explorerExampleEn: document.getElementById('explorer-example-en'),
  explorerSpeakBtn: document.getElementById('explorer-speak-btn'),
  explorerAddBtn: document.getElementById('explorer-add-btn'),
  explorerAddBtnText: document.getElementById('explorer-add-btn-text'),
  explorerVerifiedBadge: document.getElementById('explorer-verified-badge'),
  explorerGlow: document.getElementById('explorer-glow'),
  explorerCardGlowBorder: document.getElementById('explorer-card-glow-border'),
  explorerSuffixContainer: document.getElementById('explorer-suffix-container'),
  explorerSuffixBadge: document.getElementById('explorer-suffix-badge'),
  explorerSuffixTitle: document.getElementById('explorer-suffix-title'),
  explorerSuffixRule: document.getElementById('explorer-suffix-rule')
};

// Calculate globally marked learned count across level databases
const CEFR_LEVELS = ['a1', 'a2', 'b1'];
// In-memory cache
const learnedCountCache = new Map();

// Initialize all profile data and migrate from localStorage to IndexedDB
export async function initProfileData() {
  const level = state.currentLevel;
  
  // 1. Migrate active level data
  for (const prefix of ['learned_cards_', 'srs_state_']) {
    const localData = localStorage.getItem(`${prefix}${level}`);
    if (localData !== null) {
      await idb.set(`${prefix}${level}`, localData);
      localStorage.removeItem(`${prefix}${level}`);
    }
  }

  // 2. Load active level into memory (with corruption recovery)
  const idbLearned = await idb.get(`learned_cards_${level}`);
  try {
    state.learnedCards = new Set(idbLearned ? JSON.parse(idbLearned).map(id => Number(id)) : []);
  } catch (e) {
    console.error(`[state] Corrupted learned_cards_${level} in IDB, resetting:`, e);
    state.learnedCards = new Set();
    await idb.set(`learned_cards_${level}`, '[]');
  }
  
  const idbSrs = await idb.get(`srs_state_${level}`);
  try {
    state.srs = idbSrs ? JSON.parse(idbSrs) : {};
  } catch (e) {
    console.error(`[state] Corrupted srs_state_${level} in IDB, resetting:`, e);
    state.srs = {};
    await idb.set(`srs_state_${level}`, '{}');
  }

  // 3. Build global learned count cache asynchronously
  for (const lvl of CEFR_LEVELS) {
    if (lvl === level) {
      learnedCountCache.set(lvl, state.learnedCards.size);
    } else {
      let raw = await idb.get(`learned_cards_${lvl}`);
      if (!raw) {
        raw = localStorage.getItem(`learned_cards_${lvl}`);
        if (raw) {
          await idb.set(`learned_cards_${lvl}`, raw);
          localStorage.removeItem(`learned_cards_${lvl}`);
        }
      }
      try {
        const stored = raw ? JSON.parse(raw) : [];
        learnedCountCache.set(lvl, stored.length);
      } catch (e) {
        console.error(`[state] Corrupted learned_cards_${lvl} in IDB, resetting:`, e);
        learnedCountCache.set(lvl, 0);
        await idb.set(`learned_cards_${lvl}`, '[]');
      }
    }
  }
}

// Automatically sync the active level cache when learnedCards updates
export function updateLearnedCacheForActiveLevel() {
  learnedCountCache.set(state.currentLevel, state.learnedCards.size);
}

export function getGlobalLearnedCount() {
  // Ensure the current active level is dynamically updated in the cache
  updateLearnedCacheForActiveLevel();

  let totalCount = 0;
  learnedCountCache.forEach(count => {
    totalCount += count;
  });
  return totalCount;
}

export function getLearnedCountForLevel(level) {
  if (level === state.currentLevel) {
    return state.learnedCards.size;
  }
  return learnedCountCache.get(level) || 0;
}

export async function resetActiveLevelProgress() {
  state.learnedCards.clear();
  state.srs = {};
  await idb.del(`learned_cards_${state.currentLevel}`);
  await idb.del(`srs_state_${state.currentLevel}`);
  updateLearnedCacheForActiveLevel();
}



// Category icon map helper
export function getCategoryIcon(category) {
  const icons = {
    'Person, Familie & Beziehungen': 'fa-user-group',
    'Gefühle, Charakter & Meinung': 'fa-face-laugh-beam',
    'Wohnen, Haus & Haushalt': 'fa-house-chimney',
    'Gesundheit, Körper & Pflege': 'fa-heart-pulse',
    'Natur, Umwelt & Tiere': 'fa-leaf',
    'Reise, Verkehr & Mobilität': 'fa-plane-departure',
    'Essen, Kochen & Restaurant': 'fa-utensils',
    'Einkaufen, Geld & Konsum': 'fa-cart-shopping',
    'Ausbildung, Schule & Studium': 'fa-graduation-cap',
    'Arbeit, Beruf & Karriere': 'fa-briefcase',
    'Freizeit, Hobbys & Unterhaltung': 'fa-gamepad',
    'Kommunikation, Medien & Sprache': 'fa-comments',
    'Staat, Gesellschaft & Dokumente': 'fa-scale-balanced',
    'Grammatik, Pronomen & Struktur': 'fa-language',
    'Zahlen, Maße & Mengen': 'fa-calculator',
    'Uhrzeit, Datum & Kalender': 'fa-clock',
    'Allgemeine Aktivitäten & Verben': 'fa-bolt',
    'Eigenschaften & Adjektive': 'fa-tags',
    'Basiswortschatz & Floskeln': 'fa-comment-dots'
  };
  return icons[category] || 'fa-folder';
}

// Save active SRS state to localStorage (debounced to prevent main-thread blocking)
export function saveSRSState() {
  schedulePersist(
    `srs_state_${state.currentLevel}`,
    () => JSON.stringify(state.srs),
    300
  );
}

// Save learned cards to localStorage (debounced, paired with SRS state)
// P4 Audit: learnedCards is already a Set of Numbers (normalized on insert),
// so the previous Set→Array→map→Set pipeline was redundant.
function saveLearnedCards() {
  const ids = Array.from(state.learnedCards);
  schedulePersist(
    `learned_cards_${state.currentLevel}`,
    () => JSON.stringify(ids),
    300
  );
}

// Get SRS metrics for a specific card (enhanced with FSRS fields)
export function getSRSInfo(cardId) {
  const cardSrs = state.srs[cardId];
  const now = Date.now();
  if (!cardSrs) {
    return {
      box: 1,
      nextReview: 0,
      lastReviewed: 0,
      isDue: true,
      isNew: true,
      // FSRS fields
      difficulty: 0,
      stability: 0,
      retrievability: 0,
      state: FSRSState.New,
      reps: 0,
      lapses: 0
    };
  }
  return {
    box: cardSrs.box || 1,
    nextReview: cardSrs.nextReview || cardSrs.due || 0,
    lastReviewed: cardSrs.lastReviewed || cardSrs.lastReview || 0,
    isDue: (cardSrs.due || cardSrs.nextReview || 0) <= now,
    isNew: cardSrs.state === FSRSState.New,
    // FSRS fields
    difficulty: cardSrs.difficulty || 0,
    stability: cardSrs.stability || 0,
    retrievability: cardSrs.state !== undefined && cardSrs.state !== FSRSState.New
      ? fsrs.getRetrievability(cardSrs, now)
      : 0,
    state: cardSrs.state !== undefined ? cardSrs.state : FSRSState.New,
    reps: cardSrs.reps || 0,
    lapses: cardSrs.lapses || 0
  };
}

// Promote card via FSRS (correct recall — defaults to Rating.Good)
export function promoteCardSRS(cardId) {
  reviewCardSRS(cardId, Rating.Good);
}

// Demote card via FSRS (incorrect recall — Rating.Again)
export function demoteCardSRS(cardId) {
  reviewCardSRS(cardId, Rating.Again);
}

// Granular FSRS review with explicit rating (Again=1, Hard=2, Good=3, Easy=4)
export function reviewCardSRS(cardId, rating) {
  const now = Date.now();
  
  // Get or create current card state
  let currentCard = state.srs[cardId];
  if (!currentCard || currentCard.state === undefined) {
    // Either new card or old Leitner format — create/migrate
    if (currentCard && currentCard.box !== undefined && currentCard.stability === undefined) {
      currentCard = fsrs.migrateLeitnerCard(currentCard, now);
    } else {
      currentCard = fsrs.createCard(now);
    }
  }
  
  // Apply FSRS review
  const updated = fsrs.reviewCard(currentCard, rating, now);
  state.srs[cardId] = updated;

  // Track session analytics (Again=1 is a miss; Hard/Good/Easy counts as recalled)
  recordAnswer(rating >= Rating.Hard);

  const newBox = updated.box;
  const action = rating === Rating.Again ? 'demote' : 'promote';
  
  // Sync learned_cards set: box >= 2 means learned
  if (newBox >= 2) {
    state.learnedCards.add(Number(cardId));
  } else {
    state.learnedCards.delete(Number(cardId));
  }
  saveLearnedCards();
  saveSRSState();
  // Emit CustomEvent for UI refresh
  window.dispatchEvent(new CustomEvent('srs:card-updated', {
    detail: { cardId, newBox, action, level: state.currentLevel }
  }));
}

// Sort cards based on FSRS retrievability (lowest retrievability first = most urgent)
export function sortDeckBySRS(cards) {
  const now = Date.now();
  // Schwartzian transform: pre-compute SRS info once per card instead of per-comparison.
  const infoCache = new Map();
  cards.forEach(c => infoCache.set(c.id, getSRSInfo(c.id)));
  
  return [...cards].sort((a, b) => {
    const infoA = infoCache.get(a.id);
    const infoB = infoCache.get(b.id);
    
    const dueA = infoA.isDue;
    const dueB = infoB.isDue;
    const newA = infoA.isNew;
    const newB = infoB.isNew;
    
    // 1. Due cards first, sorted by lowest retrievability (most forgotten)
    if (dueA && dueB && !newA && !newB) {
      return infoA.retrievability - infoB.retrievability;
    }
    
    // 2. Prioritize due over not due
    if (dueA && !dueB) return -1;
    if (!dueA && dueB) return 1;
    
    // 3. Prioritize new cards over scheduled cards that are not yet due
    if (newA && !dueB && !newB) return -1;
    if (newB && !dueA && !newA) return 1;
    
    // 4. If both are not due: sort by retrievability (lowest first)
    if (infoA.retrievability !== infoB.retrievability) {
      return infoA.retrievability - infoB.retrievability;
    }
    return infoA.nextReview - infoB.nextReview;
  });
}

// ==========================================
// FSRS DATA MIGRATION (Leitner → FSRS)
// ==========================================

// Auto-migrate all SRS records from old Leitner format to FSRS format
export function migrateToFSRS() {
  let migrated = false;
  const now = Date.now();
  for (const cardId in state.srs) {
    const record = state.srs[cardId];
    // Detect old Leitner format: has 'box' but no 'stability' field
    if (record && record.box !== undefined && record.stability === undefined) {
      state.srs[cardId] = fsrs.migrateLeitnerCard(record, now);
      migrated = true;
    }
  }
  if (migrated) {
    saveSRSState();
    // FSRS migration completed silently
  }
}

// Centralized XP addition helper (unifies weaver and adventure XP)
export function addXP(amount) {
  // Silent no-op to support de-gamified focus
}




// ==========================================
// SESSION ANALYTICS TRACKING
// ==========================================

// Start a new study session
export function startSession() {
  state.session = {
    startTime: Date.now(),
    cardsReviewed: 0,
    correctCount: 0,
    wrongCount: 0
  };
}

// End the current session and persist summary to history
export function endSession() {
  if (!state.session.startTime) return null;
  
  const duration = Date.now() - state.session.startTime;
  const summary = {
    date: new Date().toISOString(),
    durationMs: duration,
    cardsReviewed: state.session.cardsReviewed,
    correctCount: state.session.correctCount,
    wrongCount: state.session.wrongCount,
    accuracy: state.session.cardsReviewed > 0
      ? Math.round((state.session.correctCount / state.session.cardsReviewed) * 100)
      : 0
  };
  
  // Append to session history (keep last 50 sessions)
  const history = safeJsonParse('session_history', []);
  history.push(summary);
  if (history.length > 50) history.splice(0, history.length - 50);
  safeSetItem('session_history', JSON.stringify(history));
  
  // Reset session
  state.session = { startTime: null, cardsReviewed: 0, correctCount: 0, wrongCount: 0 };
  
  return summary;
}

// Record a single answer in the current session
export function recordAnswer(correct) {
  state.session.cardsReviewed += 1;
  if (correct) {
    state.session.correctCount += 1;
  } else {
    state.session.wrongCount += 1;
  }
}

// ==========================================
// CUSTOM CARDS PERSISTENCE LAYER
// ==========================================

// Get custom cards for a level from IndexedDB
export async function getCustomCards(level) {
  const raw = await idb.get(`custom_cards_${level}`);
  return raw ? JSON.parse(raw) : [];
}

// Add a custom card to a level and save to IndexedDB
export async function addCustomCard(level, card) {
  // Validate card schema — reject objects missing required fields
  if (!card || typeof card !== 'object' ||
      typeof card.german !== 'string' || !card.german.trim() ||
      typeof card.english !== 'string' || !card.english.trim()) {
    console.error('[state] addCustomCard rejected: card must have non-empty german and english string fields', card);
    return;
  }
  const customCards = await getCustomCards(level);
  customCards.push(card);
  await idb.set(`custom_cards_${level}`, JSON.stringify(customCards));
  
  // Appends directly to state.allCards in-memory
  state.allCards.push(card);
  
  // Re-index antonym index if applicable
  if (state.antonymIndex) {
    const cleanWord = (card.word || card.german).replace(/^(der|die|das)\s+/i, '').trim().toLowerCase();
    state.antonymIndex.set(cleanWord, card);
  }
  
  // Dispatch custom filter event to refresh UI on-the-fly
  window.dispatchEvent(new CustomEvent('deck:filter-request', { detail: { resetIndex: true } }));
}

// ==========================================
// BASE64 ENCODED SYNC KEY UTILITIES
// (Note: NOT encrypted — Base64 is reversible encoding. Treat keys as sensitive.)
// ==========================================

// Compresses and packages the entire IndexedDB SRS profile into a Base64 Sync Key
export async function generateSyncKey() {
  const payload = {
    version: "3.0.0",
    timestamp: Date.now(),
    data: {
      learned_cards_a1: JSON.parse(await idb.get('learned_cards_a1') || '[]'),
      learned_cards_a2: JSON.parse(await idb.get('learned_cards_a2') || '[]'),
      learned_cards_b1: JSON.parse(await idb.get('learned_cards_b1') || '[]'),
      srs_state_a1: JSON.parse(await idb.get('srs_state_a1') || '{}'),
      srs_state_a2: JSON.parse(await idb.get('srs_state_a2') || '{}'),
      srs_state_b1: JSON.parse(await idb.get('srs_state_b1') || '{}'),
      custom_cards_a1: JSON.parse(await idb.get('custom_cards_a1') || '[]'),
      custom_cards_a2: JSON.parse(await idb.get('custom_cards_a2') || '[]'),
      custom_cards_b1: JSON.parse(await idb.get('custom_cards_b1') || '[]'),
      show_images: localStorage.getItem('show_images') || 'true',
      current_theme: localStorage.getItem('current_theme') || 'default',
      current_level: localStorage.getItem('current_level') || 'a2'
    }
  };
  const jsonStr = JSON.stringify(payload);
  return btoa(unescape(encodeURIComponent(jsonStr)));
}

// Decodes and restores the entire IndexedDB SRS profile from a Base64 Sync Key
// Note: The Sync Key is Base64-encoded (NOT encrypted). Treat it like a password.
export async function restoreFromSyncKey(base64Str) {
  try {
    const decodedStr = decodeURIComponent(escape(atob(base64Str.trim())));
    const payload = JSON.parse(decodedStr);
    if (!payload || typeof payload !== 'object' || !payload.data) {
      throw new Error("Invalid format. It must be a valid Sync Key.");
    }
    
    const data = payload.data;

    // --- Schema Validation Helpers ---
    const isArrayOfNumbers = (arr) => Array.isArray(arr) && arr.every(v => typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v))));
    const isPlainObject = (obj) => obj !== null && typeof obj === 'object' && !Array.isArray(obj);
    const isArrayOfObjects = (arr) => Array.isArray(arr) && arr.every(v => isPlainObject(v));
    const isSafeString = (val) => typeof val === 'string' && val.length < 256;
    const isSafeNumber = (val) => typeof val === 'number' && isFinite(val);
    const VALID_LEVELS = ['a1', 'a2', 'b1'];
    const VALID_THEMES = ['default', 'cyberpunk', 'schwarzwald', 'oktoberfest', 'weimar'];

    // --- Validate & write learned_cards (must be arrays of numeric IDs) ---
    for (const lvl of VALID_LEVELS) {
      const key = `learned_cards_${lvl}`;
      if (data[key] !== undefined) {
        if (!isArrayOfNumbers(data[key])) {
          console.warn(`[sync] Rejected ${key}: not an array of numbers`);
          continue;
        }
        await idb.set(key, JSON.stringify(data[key].map(Number)));
      }
    }

    // --- Validate & write srs_state (must be plain objects) ---
    for (const lvl of VALID_LEVELS) {
      const key = `srs_state_${lvl}`;
      if (data[key] !== undefined) {
        if (!isPlainObject(data[key])) {
          console.warn(`[sync] Rejected ${key}: not a plain object`);
          continue;
        }
        await idb.set(key, JSON.stringify(data[key]));
      }
    }

    // --- Validate & write custom_cards (must be arrays of objects with german/english) ---
    for (const lvl of VALID_LEVELS) {
      const key = `custom_cards_${lvl}`;
      if (data[key] !== undefined) {
        if (!isArrayOfObjects(data[key])) {
          console.warn(`[sync] Rejected ${key}: not an array of objects`);
          continue;
        }
        // Filter out cards missing required fields
        const validCards = data[key].filter(c => typeof c.german === 'string' && typeof c.english === 'string');
        await idb.set(key, JSON.stringify(validCards));
      }
    }
    
    // --- Validate & write localStorage scalars (strict type checks) ---
    if (data.show_images !== undefined && typeof data.show_images === 'boolean')
      localStorage.setItem('show_images', String(data.show_images));
    if (data.current_theme !== undefined && isSafeString(data.current_theme) && VALID_THEMES.includes(data.current_theme))
      localStorage.setItem('current_theme', data.current_theme);
    if (data.current_level !== undefined && isSafeString(data.current_level) && VALID_LEVELS.includes(data.current_level))
      localStorage.setItem('current_level', data.current_level);
    
    return true;
  } catch (e) {
    console.error("Failed to restore from sync key:", e);
    throw e;
  }
}

// Bind helper methods directly to state to make them globally accessible to other modules
state.getSRSInfo = getSRSInfo;
state.saveSRSState = saveSRSState;
state.promoteCardSRS = promoteCardSRS;
state.demoteCardSRS = demoteCardSRS;
state.sortDeckBySRS = sortDeckBySRS;
state.reviewCardSRS = reviewCardSRS;
state.migrateToFSRS = migrateToFSRS;

state.startSession = startSession;
state.endSession = endSession;
state.recordAnswer = recordAnswer;
state.getCustomCards = getCustomCards;
state.addCustomCard = addCustomCard;
state.generateSyncKey = generateSyncKey;
state.restoreFromSyncKey = restoreFromSyncKey;
state.addXP = addXP;

// Generic helper to shuffle an array in-place (Fisher-Yates)
export function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}


