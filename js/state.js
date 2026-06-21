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
    idb.set(key, dataFn()).catch(e => console.warn('[IDB] Flush failed:', e));
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
  'Person & Familie': 'Personal Details & Family',
  'Wohnen & Haushalt': 'Living & Housing/Household',
  'Gesundheit & Körper': 'Health & Body',
  'Natur & Umwelt': 'Nature & Environment',
  'Reise & Verkehr': 'Travel & Transport',
  'Essen & Trinken': 'Food & Drink',
  'Einkaufen & Konsum': 'Shopping & Consumption',
  'Dienstleistungen & Behörden': 'Services & Authorities',
  'Ausbildung & Lernen': 'Education & Learning',
  'Arbeit & Beruf': 'Work & Profession',
  'Freizeit & Unterhaltung': 'Leisure & Entertainment',
  'Zeit, Maße & Basiswortschatz': 'Time, Measurements & Basic Vocabulary'
};

// Achievement Badge Definitions
export const ACHIEVEMENTS = [
  {
    id: 'early_bird',
    title: 'Der frühe Vogel',
    desc: 'Lerne eine Vokabel vor 7:00 Uhr morgens.',
    icon: 'fa-regular fa-clock',
    color: 'text-sky-400'
  },
  {
    id: 'night_owl',
    title: 'Nachteule',
    desc: 'Lerne eine Vokabel nach 22:00 Uhr nachts.',
    icon: 'fa-solid fa-moon',
    color: 'text-indigo-400'
  },
  {
    id: 'sprech_deutsch',
    title: 'Sprechen Sie Deutsch?',
    desc: 'Lerne insgesamt 100 Vokabeln (markiert als gelernt).',
    icon: 'fa-solid fa-comments',
    color: 'text-emerald-400'
  },
  {
    id: 'streak_master',
    title: 'Serienmeister',
    desc: 'Erreiche eine Quiz-Serie von 10 richtigen Antworten.',
    icon: 'fa-solid fa-fire',
    color: 'text-orange-500'
  },
  {
    id: 'perfect_score',
    title: 'Fehlerfrei',
    desc: 'Beende ein Quiz mit 100% Genauigkeit (mind. 10 Fragen).',
    icon: 'fa-solid fa-crown',
    color: 'text-amber-400'
  },
  {
    id: 'polyglott',
    title: 'Polyglott-Reisender',
    desc: 'Besuche alle drei Niveaustufen (A1, A2 und B1).',
    icon: 'fa-solid fa-earth-europe',
    color: 'text-blue-400'
  },
  {
    id: 'srs_pioneer',
    title: 'FSRS-Pionier',
    desc: 'Befördere mindestens 5 Vokabeln über die Lernphase hinaus.',
    icon: 'fa-solid fa-box-archive',
    color: 'text-purple-400'
  },
  {
    id: 'marathon',
    title: 'Quiz-Marathon',
    desc: 'Beantworte 30 Fragen in einer einzigen Quiz-Runde.',
    icon: 'fa-solid fa-person-running',
    color: 'text-rose-400'
  },
  {
    id: 'streak_3',
    title: 'Drei-Tage-Flamme',
    desc: 'Erreiche eine tägliche Lernserie von 3 Tagen.',
    icon: 'fa-solid fa-fire-flame-curved',
    color: 'text-orange-400'
  },
  {
    id: 'streak_7',
    title: 'Wochen-Krieger',
    desc: 'Erreiche eine tägliche Lernserie von 7 Tagen.',
    icon: 'fa-solid fa-fire-flame-simple',
    color: 'text-orange-500'
  },
  {
    id: 'streak_30',
    title: 'Monats-Meister',
    desc: 'Erreiche eine tägliche Lernserie von 30 Tagen.',
    icon: 'fa-solid fa-medal',
    color: 'text-yellow-400'
  },
  {
    id: 'retention_90',
    title: 'Gedächtnis-Genie',
    desc: 'Erreiche eine Behaltensrate von über 90%.',
    icon: 'fa-solid fa-brain',
    color: 'text-fuchsia-400'
  },
  {
    id: 'first_steps',
    title: 'Erste Schritte',
    desc: 'Bewerte deine erste Karteikarte mit dem FSRS-System.',
    icon: 'fa-solid fa-shoe-prints',
    color: 'text-lime-400'
  },
  {
    id: 'quiz_rookie',
    title: 'Quiz-Anfänger',
    desc: 'Beende dein erstes Quiz (mind. 5 Fragen).',
    icon: 'fa-solid fa-circle-check',
    color: 'text-cyan-400'
  },
  {
    id: 'adventurer',
    title: 'Abenteurer',
    desc: 'Schließe dein erstes Deutsch-Abenteuer-Szenario ab.',
    icon: 'fa-solid fa-dungeon',
    color: 'text-amber-500'
  }
];

// Central Reactive Application State
export const state = {
  currentLevel: safeGetItem('current_level', 'a2'), // Active CEFR Level ('a1', 'a2', 'b1')
  allCards: [],          // Raw normalized vocabulary elements
  antonymIndex: null,    // Map<lowercaseCleanWord, card> for O(1) antonym lookup (built during data load)
  filteredCards: [],     // Cards filtered by active category + search text
  currentDeck: [],       // Active card deck layout (shuffled or ordered)
  currentIndex: 0,       // Current active card index
  isShuffled: false,     // Shuffling toggle active
  activeCategory: 'All', // Active category selector ('All' or tag)
  searchQuery: '',       // Active search term
  isAccordionOpen: false, // Core flashcard accordion revealed state
  isFastRead: false,      // Fast Read toggle state
  hideLearned: false,     // Hide learned cards filter state
  isAutoPlaySpeech: false, // Auto-TTS speech on active card transitions
  showImages: safeGetItem('show_images', 'true') !== 'false', // Visual aids render flag
  sfxVolume: parseFloat(safeGetItem('sfx_volume', '0.5')), // SFX Volume (0.0 to 1.0)
  audioTone: safeGetItem('audio_tone', 'synth'), // SFX sound tone ('synth' or 'acoustic')
  particleBursts: safeGetItem('particle_bursts', 'true') !== 'false', // Particle effects enabled
  learnedCards: new Set(), // Set of active level-scoped learned card IDs
  
  // Quiz Arena Sub-State
  quiz: {
    active: false,
    mode: null,                // 'mc' (Multiple-Choice) or 'spelling' (Spelling test)
    questions: [],             // Question list in active round
    currentQuestionIndex: 0,
    score: 0,
    streak: parseInt(safeGetItem('quiz_streak', '0'), 10) || 0,
    bestStreak: parseInt(safeGetItem('quiz_best_streak', '0'), 10) || 0,
    roundLength: 10,
    isAnswered: false,
    currentQuestion: null,
    options: [],               // Text options for MC choices
    isEndless: false           // Endless loop quiz active
  },

  // FSRS Spaced Repetition database (migrated from Leitner)
  // Maps cardId -> { state, difficulty, stability, due, lastReview, reps, lapses, box, nextReview, lastReviewed }
  srs: {},

  // Daily Streak Tracking
  streak: safeJsonParse('streak_data', {
    current: 0,
    longest: 0,
    lastStudyDate: null,    // ISO date string 'YYYY-MM-DD'
    freezesAvailable: 1,
    freezeUsedToday: false
  }),

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

  // Focus Booster (Pomodoro & Soundscapes) Sub-State
  focus: {
    active: false,
    timerId: null,
    timeLeft: 0,
    totalDuration: 0,
    soundType: 'none',
    xpMultiplierActive: false,
    multiplierTimerId: null
  },

  // RPG Adventure (Deutsch-Abenteuer) Sub-State
  adventure: {
    xp: parseInt(safeGetItem('adventure_xp', '0'), 10) || 0,
    scenarios: [],
    activeScenario: null,
    currentNode: null,
    constructedSentence: [],
    completedScenarios: safeJsonParse('adventure_completed_scenarios', [])
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
  },

  // Grammatik-Weberei (Grammar Weaver) State
  weaver: {
    active: false,
    sentences: [],             // Curated sentences extracted for active CEFR level
    currentSentenceIndex: 0,   // Active puzzle sentence index (0 to 4)
    constructedTokens: [],     // Dynamic chips currently filled inside active slots
    originalTokens: [],        // Standard syntax list { text, pos } in correct order
    scrambledTokens: [],       // Shuffled pool list for assembly chip board
    xpEarned: 0,               // Cumulative round XP
    errorsCount: 0,            // Validation errors count in active puzzle
    totalQuestionsCount: 5     // Sentences per game round
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
  resetProgressBtnMain: document.getElementById('reset-progress-btn-main'),
  deckPrefsToggleBtn: document.getElementById('deck-prefs-toggle-btn'),
  deckPrefsDropdown: document.getElementById('deck-prefs-dropdown'),
  cardImageContainer: document.getElementById('card-image-container'),
  cardImage: document.getElementById('card-image'),
  suffixHelperTrigger: document.getElementById('suffix-helper-trigger'),
  suffixDrawer: document.getElementById('suffix-drawer'),
  suffixDrawerBadge: document.getElementById('suffix-drawer-badge'),
  suffixDrawerTitle: document.getElementById('suffix-drawer-title'),
  suffixDrawerRule: document.getElementById('suffix-drawer-rule'),
  flashcardsView: document.getElementById('flashcards-view'),
  cheatcodesView: document.getElementById('cheatcodes-view'),
  cheatcodeSearch: document.getElementById('cheatcode-search'),
  cheatcodesGrid: document.getElementById('cheatcodes-grid'),
  cheatcodesEmpty: document.getElementById('cheatcodes-empty'),
  navFlashcards: document.getElementById('nav-flashcards'),
  navCheatcodes: document.getElementById('nav-cheatcodes'),
  
  // Continuous Dual-Voice Audio Trainer
  trainerPlayBtn: document.getElementById('trainer-play-btn'),
  trainerPrevBtn: document.getElementById('trainer-prev-btn'),
  trainerNextBtn: document.getElementById('trainer-next-btn'),
  trainerSpeedSlider: document.getElementById('trainer-speed-slider'),
  trainerSpeedVal: document.getElementById('trainer-speed-val'),
  trainerLoopBtn: document.getElementById('trainer-loop-btn'),
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
  quizStreakCounter: document.getElementById('quiz-streak-counter'),
  quizBestStreak: document.getElementById('quiz-best-streak'),
  
  // Spaced Repetition & Profile Analytics
  statsView: document.getElementById('stats-view'),
  navStats: document.getElementById('nav-stats'),
  statsMasteredCount: document.getElementById('stats-mastered-count'),
  statsLearnedCount: document.getElementById('stats-learned-count'),
  statsStreakCount: document.getElementById('stats-streak-count'),
  statsDueCount: document.getElementById('stats-due-count'),
  statsRingA1: document.getElementById('stats-ring-a1'),
  statsRingA2: document.getElementById('stats-ring-a2'),
  statsRingB1: document.getElementById('stats-ring-b1'),
  statsTextA1: document.getElementById('stats-text-a1'),
  statsTextA2: document.getElementById('stats-text-a2'),
  statsTextB1: document.getElementById('stats-text-b1'),
  statsCountA1: document.getElementById('stats-count-a1'),
  statsCountA2: document.getElementById('stats-count-a2'),
  statsCountB1: document.getElementById('stats-count-b1'),
  statsActiveLevelLabel: document.getElementById('stats-active-level-label'),
  statsBox1Count: document.getElementById('stats-box1-count'),
  statsBox2Count: document.getElementById('stats-box2-count'),
  statsBox3Count: document.getElementById('stats-box3-count'),
  statsBox4Count: document.getElementById('stats-box4-count'),
  statsBox5Count: document.getElementById('stats-box5-count'),
  statsBox1Bar: document.getElementById('stats-box1-bar'),
  statsBox2Bar: document.getElementById('stats-box2-bar'),
  statsBox3Bar: document.getElementById('stats-box3-bar'),
  statsBox4Bar: document.getElementById('stats-box4-bar'),
  statsBox5Bar: document.getElementById('stats-box5-bar'),
  statsPartsOfSpeechContainer: document.getElementById('stats-parts-of-speech-container'),
  statsCategoriesGrid: document.getElementById('stats-categories-grid'),
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
  particlesBtn: document.getElementById('particles-btn'),

  // Pomodoro Focus-Booster
  pomodoroDuration: document.getElementById('pomodoro-duration'),
  pomodoroSound: document.getElementById('pomodoro-sound'),
  pomodoroToggleBtn: document.getElementById('pomodoro-toggle-btn'),
  pomodoroTimeText: document.getElementById('pomodoro-time-text'),
  pomodoroTimerRing: document.getElementById('pomodoro-timer-ring'),

  // Deutsch-Abenteuer (RPG)
  adventureView: document.getElementById('adventure-view'),
  navAdventure: document.getElementById('nav-adventure'),
  adventureSelectorScreen: document.getElementById('adventure-selector-screen'),
  adventureSelector: document.getElementById('adventure-selector'),
  adventureBoard: document.getElementById('adventure-board'),
  adventureActiveTitle: document.getElementById('adventure-active-title'),
  adventureActiveBadge: document.getElementById('adventure-active-badge'),
  adventureProgressText: document.getElementById('adventure-progress-text'),
  adventureProgressBarFill: document.getElementById('adventure-progress-bar-fill'),
  adventureNpcBubble: document.getElementById('adventure-npc-bubble'),
  adventureNpcSpeakBtn: document.getElementById('adventure-npc-speak-btn'),
  adventureDropzone: document.getElementById('adventure-dropzone'),
  adventureChipsPool: document.getElementById('adventure-chips-pool'),
  adventureFeedback: document.getElementById('adventure-feedback'),
  adventureFeedbackIcon: document.getElementById('adventure-feedback-icon'),
  adventureFeedbackTitle: document.getElementById('adventure-feedback-title'),
  adventureFeedbackText: document.getElementById('adventure-feedback-text'),
  adventureFeedbackTip: document.getElementById('adventure-feedback-tip'),
  adventureFeedbackTipText: document.getElementById('adventure-feedback-tip-text'),
  adventureNextNodeBtn: document.getElementById('adventure-next-node-btn'),
  adventureResetBtn: document.getElementById('adventure-reset-btn'),
  adventureSubmitBtn: document.getElementById('adventure-submit-btn'),
  adventureActionButtons: document.getElementById('adventure-action-buttons'),
  adventureQuitBtn: document.getElementById('adventure-quit-btn'),
  adventureResults: document.getElementById('adventure-results'),
  adventureResultsXp: document.getElementById('adventure-results-xp'),
  adventureResultsRetryBtn: document.getElementById('adventure-results-retry-btn'),
  adventureResultsDoneBtn: document.getElementById('adventure-results-done-btn'),
  adventureXpCounter: document.getElementById('adventure-xp-counter'),

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
  nativeSpecHint: document.getElementById('native-spec-hint'),
  learnerSpecHint: document.getElementById('learner-spec-hint'),
  learnerSpecStatus: document.getElementById('learner-spec-status'),

  // Grammatik-Weberei (Grammar Weaver)
  navWeaver: document.getElementById('nav-weaver'),
  weaverView: document.getElementById('weaver-view'),
  weaverXpCounter: document.getElementById('weaver-xp-counter'),
  weaverIntroScreen: document.getElementById('weaver-intro-screen'),
  weaverStartBtn: document.getElementById('weaver-start-btn'),
  weaverBoard: document.getElementById('weaver-board'),
  weaverQuitBtn: document.getElementById('weaver-quit-btn'),
  weaverActiveTitle: document.getElementById('weaver-active-title'),
  weaverActiveBadge: document.getElementById('weaver-active-badge'),
  weaverProgressText: document.getElementById('weaver-progress-text'),
  weaverProgressBarFill: document.getElementById('weaver-progress-bar-fill'),
  weaverTranslationHint: document.getElementById('weaver-translation-hint'),
  weaverDropzone: document.getElementById('weaver-dropzone'),
  weaverDropzonePlaceholder: document.getElementById('weaver-dropzone-placeholder'),
  weaverChipsPool: document.getElementById('weaver-chips-pool'),
  weaverFeedback: document.getElementById('weaver-feedback'),
  weaverFeedbackIcon: document.getElementById('weaver-feedback-icon'),
  weaverFeedbackTitle: document.getElementById('weaver-feedback-title'),
  weaverFeedbackText: document.getElementById('weaver-feedback-text'),
  weaverFeedbackTip: document.getElementById('weaver-feedback-tip'),
  weaverFeedbackTipText: document.getElementById('weaver-feedback-tip-text'),
  weaverNextBtn: document.getElementById('weaver-next-btn'),
  weaverActionButtons: document.getElementById('weaver-action-buttons'),
  weaverResetBtn: document.getElementById('weaver-reset-btn'),
  weaverSubmitBtn: document.getElementById('weaver-submit-btn'),
  weaverResults: document.getElementById('weaver-results'),
  weaverResultsXp: document.getElementById('weaver-results-xp'),
  weaverResultsAccuracy: document.getElementById('weaver-results-accuracy'),
  weaverResultsRetryBtn: document.getElementById('weaver-results-retry-btn'),
  weaverResultsDoneBtn: document.getElementById('weaver-results-done-btn'),

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
  explorerCardGlowBorder: document.getElementById('explorer-card-glow-border')
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

  // 2. Load active level into memory
  const idbLearned = await idb.get(`learned_cards_${level}`);
  state.learnedCards = new Set(idbLearned ? JSON.parse(idbLearned).map(id => Number(id)) : []);
  
  const idbSrs = await idb.get(`srs_state_${level}`);
  state.srs = idbSrs ? JSON.parse(idbSrs) : {};

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
      const stored = raw ? JSON.parse(raw) : [];
      learnedCountCache.set(lvl, stored.length);
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

// Track visited levels to trigger achievement badge
export function trackVisitedLevels() {
  let visited = safeJsonParse('visited_levels', []);
  if (!visited.includes(state.currentLevel)) {
    visited.push(state.currentLevel);
    safeSetItem('visited_levels', JSON.stringify(visited));
  }
}

// Category icon map helper
export function getCategoryIcon(category) {
  const icons = {
    'Person & Familie': 'fa-user-group',
    'Wohnen & Haushalt': 'fa-house-chimney',
    'Gesundheit & Körper': 'fa-heart-pulse',
    'Natur & Umwelt': 'fa-leaf',
    'Reise & Verkehr': 'fa-plane-departure',
    'Essen & Trinken': 'fa-utensils',
    'Einkaufen & Konsum': 'fa-cart-shopping',
    'Dienstleistungen & Behörden': 'fa-building-columns',
    'Ausbildung & Lernen': 'fa-graduation-cap',
    'Arbeit & Beruf': 'fa-briefcase',
    'Freizeit & Unterhaltung': 'fa-gamepad',
    'Zeit, Maße & Basiswortschatz': 'fa-calendar-days'
  };
  return icons[category] || 'fa-graduation-cap';
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
  
  // Update streak on any review
  updateStreak();
  
  // Emit CustomEvent for UI refresh
  window.dispatchEvent(new CustomEvent('srs:card-updated', {
    detail: { cardId, newBox, action, level: state.currentLevel }
  }));

  // Achievement checks
  try {
    // Onboarding: First Steps — first ever SRS review
    window.dispatchEvent(new CustomEvent('srs:achievement', { detail: { id: 'first_steps' } }));
    
    const currentHour = new Date().getHours();
    if (currentHour < 7) {
      window.dispatchEvent(new CustomEvent('srs:achievement', { detail: { id: 'early_bird' } }));
    }
    if (currentHour >= 22 || currentHour < 4) {
      window.dispatchEvent(new CustomEvent('srs:achievement', { detail: { id: 'night_owl' } }));
    }
    if (getGlobalLearnedCount() >= 100) {
      window.dispatchEvent(new CustomEvent('srs:achievement', { detail: { id: 'sprech_deutsch' } }));
    }
    
    // FSRS Pioneer: 5 cards past Learning phase (state >= Review)
    let pioneerCount = 0;
    for (const key in state.srs) {
      const c = state.srs[key];
      if (c && (c.state === FSRSState.Review || (c.box && c.box >= 3))) {
        pioneerCount++;
      }
    }
    if (pioneerCount >= 5) {
      window.dispatchEvent(new CustomEvent('srs:achievement', { detail: { id: 'srs_pioneer' } }));
    }
    
    // Streak achievements
    const streakInfo = getStreakInfo();
    if (streakInfo.current >= 3) {
      window.dispatchEvent(new CustomEvent('srs:achievement', { detail: { id: 'streak_3' } }));
    }
    if (streakInfo.current >= 7) {
      window.dispatchEvent(new CustomEvent('srs:achievement', { detail: { id: 'streak_7' } }));
    }
    if (streakInfo.current >= 30) {
      window.dispatchEvent(new CustomEvent('srs:achievement', { detail: { id: 'streak_30' } }));
    }
  } catch (err) {
    console.error("Achievement checks failed:", err);
  }
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

// ==========================================
// DAILY STREAK SYSTEM
// ==========================================

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function getYesterdayDateString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Update streak based on today's study activity
export function updateStreak() {
  const today = getTodayDateString();
  const streak = state.streak;
  
  if (streak.lastStudyDate === today) {
    // Already studied today — no change
    return;
  }
  
  const yesterday = getYesterdayDateString();
  
  if (streak.lastStudyDate === yesterday) {
    // Consecutive day — increment streak
    streak.current += 1;
  } else if (streak.lastStudyDate && streak.lastStudyDate < yesterday) {
    // Missed day(s) — check for streak freeze
    if (checkStreakFreeze()) {
      // Freeze used — preserve streak and increment
      streak.current += 1;
    } else {
      // No freeze — reset streak
      streak.current = 1;
    }
  } else {
    // First ever study or null state
    streak.current = 1;
  }
  
  // Update longest
  if (streak.current > streak.longest) {
    streak.longest = streak.current;
  }
  
  streak.lastStudyDate = today;
  streak.freezeUsedToday = false;
  
  // Persist
  safeSetItem('streak_data', JSON.stringify(streak));
}

// Check and consume a streak freeze
export function checkStreakFreeze() {
  const streak = state.streak;
  if (streak.freezesAvailable > 0 && !streak.freezeUsedToday) {
    streak.freezesAvailable -= 1;
    streak.freezeUsedToday = true;
    safeSetItem('streak_data', JSON.stringify(streak));
    return true;
  }
  return false;
}

// Get current streak info for display
export function getStreakInfo() {
  return {
    current: state.streak.current || 0,
    longest: state.streak.longest || 0,
    lastStudyDate: state.streak.lastStudyDate || null,
    freezesAvailable: state.streak.freezesAvailable || 0,
    freezeUsedToday: state.streak.freezeUsedToday || false,
    isActiveToday: state.streak.lastStudyDate === getTodayDateString()
  };
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
  
  // Retention achievement check
  if (summary.accuracy >= 90 && summary.cardsReviewed >= 10) {
    window.dispatchEvent(new CustomEvent('srs:achievement', { detail: { id: 'retention_90' } }));
  }
  
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
  const customCards = await getCustomCards(level);
  customCards.push(card);
  await idb.set(`custom_cards_${level}`, JSON.stringify(customCards));
  
  // Appends directly to state.allCards in-memory
  state.allCards.push(card);
  
  // Re-index antonym index if applicable
  if (state.antonymIndex) {
    const cleanWord = card.word.replace(/^(der|die|das)\s+/i, '').trim().toLowerCase();
    state.antonymIndex.set(cleanWord, card);
  }
  
  // Dispatch custom filter event to refresh UI on-the-fly
  window.dispatchEvent(new CustomEvent('deck:filter-request', { detail: { resetIndex: true } }));
}

// ==========================================
// BASE64 ENCRYPTED SYNC KEY UTILITIES
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
      quiz_streak: localStorage.getItem('quiz_streak') || '0',
      quiz_best_streak: localStorage.getItem('quiz_best_streak') || '0',
      show_images: localStorage.getItem('show_images') || 'true',
      current_theme: localStorage.getItem('current_theme') || 'default',
      current_level: localStorage.getItem('current_level') || 'a2',
      streak_data: safeJsonParse('streak_data', {}),
      session_history: safeJsonParse('session_history', []),
      unlocked_achievements: safeJsonParse('unlocked_achievements', [])
    }
  };
  const jsonStr = JSON.stringify(payload);
  return btoa(unescape(encodeURIComponent(jsonStr)));
}

// Decrypts and restores the entire IndexedDB SRS profile from a Base64 Sync Key
export async function restoreFromSyncKey(base64Str) {
  try {
    const decodedStr = decodeURIComponent(escape(atob(base64Str.trim())));
    const payload = JSON.parse(decodedStr);
    if (!payload || typeof payload !== 'object' || !payload.data) {
      throw new Error("Dateiformat ist ungültig. Es muss ein gültiger Sync-Schlüssel sein.");
    }
    
    const data = payload.data;
    
    // Asynchronously write to IndexedDB
    if (data.learned_cards_a1) await idb.set('learned_cards_a1', JSON.stringify(data.learned_cards_a1));
    if (data.learned_cards_a2) await idb.set('learned_cards_a2', JSON.stringify(data.learned_cards_a2));
    if (data.learned_cards_b1) await idb.set('learned_cards_b1', JSON.stringify(data.learned_cards_b1));
    
    if (data.srs_state_a1) await idb.set('srs_state_a1', JSON.stringify(data.srs_state_a1));
    if (data.srs_state_a2) await idb.set('srs_state_a2', JSON.stringify(data.srs_state_a2));
    if (data.srs_state_b1) await idb.set('srs_state_b1', JSON.stringify(data.srs_state_b1));
    
    if (data.custom_cards_a1) await idb.set('custom_cards_a1', JSON.stringify(data.custom_cards_a1));
    if (data.custom_cards_a2) await idb.set('custom_cards_a2', JSON.stringify(data.custom_cards_a2));
    if (data.custom_cards_b1) await idb.set('custom_cards_b1', JSON.stringify(data.custom_cards_b1));
    
    // Write to localStorage
    if (data.quiz_streak !== undefined) localStorage.setItem('quiz_streak', String(data.quiz_streak));
    if (data.quiz_best_streak !== undefined) localStorage.setItem('quiz_best_streak', String(data.quiz_best_streak));
    if (data.show_images !== undefined) localStorage.setItem('show_images', String(data.show_images));
    if (data.current_theme !== undefined) localStorage.setItem('current_theme', String(data.current_theme));
    if (data.current_level !== undefined) localStorage.setItem('current_level', String(data.current_level));
    if (data.streak_data) localStorage.setItem('streak_data', JSON.stringify(data.streak_data));
    if (data.session_history) localStorage.setItem('session_history', JSON.stringify(data.session_history));
    if (data.unlocked_achievements) localStorage.setItem('unlocked_achievements', JSON.stringify(data.unlocked_achievements));
    
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
state.updateStreak = updateStreak;
state.getStreakInfo = getStreakInfo;
state.startSession = startSession;
state.endSession = endSession;
state.recordAnswer = recordAnswer;
state.getCustomCards = getCustomCards;
state.addCustomCard = addCustomCard;
state.generateSyncKey = generateSyncKey;
state.restoreFromSyncKey = restoreFromSyncKey;

// Generic helper to shuffle an array in-place (Fisher-Yates)
export function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}



