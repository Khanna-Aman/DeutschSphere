// app.js — Weimar-themed German Vocabulary SPA ES6 Module Orchestrator
import {
  state,
  elements,
  initProfileData,
  migrateToFSRS,
  startSession,
  reviewCardSRS,
  safeSetItem,
  safeGetItem,
  safeJsonParse
} from './js/state.js';

import {
  initTTS,
  warmUpTTS,
  stopAudioTrainer,
  toggleTrainerLoop
} from './js/audio.js';

import {
  initSettingsUI,
  setupEventListeners,
  setupSwipeGestures,
  initShortcutsToggle,
  initHelpModal,
  initFeedbackModal,
  initPwaInstallManager
} from './js/events.js';

import {
  updateImagesToggleUI,
  renderCard,
  initSidebarCategoryWords
} from './js/flashcards.js';


import {
  handleRouting
} from './js/router.js';

import { initTelemetry } from './js/telemetry.js';



import {
  get as idbGet,
  set as idbSet,
  del as idbDel
} from './js/idb-keyval.js';

import {
  getConsolidatedCategory,
  renderSidebarCategories
} from './js/search.js';

// ⚠️  DATA UPDATE CHECKLIST — BUMP THIS VERSION whenever any /a1, /a2, or /b1
// JSON data file is modified. Failing to bump invalidates all users' IDB wordlist
// caches and causes them to see stale data until they manually clear storage.
// Format: 'v<major>.<minor>.<patch>'  e.g., v1.0.1 → v1.0.2
const WORDLIST_CACHE_VERSION = 'v1.0.1';

// Global hooks for early-paint theme execution inside HTML Head
window.applyTheme = applyTheme;
window.initTheme = initTheme;

// ==========================================
// DECUPLED MESSAGE ROUTERS (CustomEvents)
// ==========================================
window.addEventListener('level:change-request', (e) => changeLevel(e.detail.level));
window.addEventListener('theme:change-request', (e) => applyTheme(e.detail.theme));
window.addEventListener('card:reviewed', (e) => reviewCardSRS(e.detail.id, e.detail.rating));
window.addEventListener('audio:toggle-loop-request', () => toggleTrainerLoop());


// ==========================================
// THEME CUSTOMIZER ENGINE
// ==========================================
export function initTheme() {
  const savedTheme = safeGetItem('current_theme', '');
  if (!savedTheme) {
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

export function applyTheme(theme) {
  document.body.classList.remove('theme-cyberpunk', 'theme-schwarzwald', 'theme-oktoberfest', 'theme-weimar');
  if (theme !== 'default') {
    document.body.classList.add(`theme-${theme}`);
  }
  safeSetItem('current_theme', theme);
}

// ==========================================
// CEFR LEVEL AND CURRICULUM CONTROLLER
// ==========================================
export async function changeLevel(level) {
  if (state.trainer && state.trainer.active) {
    stopAudioTrainer();
  }

  elements.loaderOverlay.classList.remove('hidden', 'opacity-0');
  
  state.currentLevel = level;
  state.activeCategory = 'All';
  state.searchQuery = '';
  if (elements.searchInput) {
    elements.searchInput.value = '';
    elements.searchClear.classList.add('hidden');
  }
  
  safeSetItem('current_level', level);
  
  await initProfileData();
  migrateToFSRS();
  
  updateLevelUI();
  updateImagesToggleUI();
  await fetchData();
  handleRouting();
}

export function updateLevelUI() {
  const levelUpper = state.currentLevel.toUpperCase();
  const titles = document.querySelectorAll('.level-title');
  titles.forEach(el => {
    el.textContent = `German ${levelUpper}`;
  });
  
  document.title = `German ${levelUpper} Flashcards`;
  
  if (elements.levelSelect) {
    elements.levelSelect.value = state.currentLevel;
  }
}

// ==========================================
// DATA ACQUISITION, NORMALIZATION & CACHING (IDB)
// ==========================================
export async function fetchData() {
  try {
    const level = state.currentLevel;
    
    // Phase 3: Validate and verify local IndexedDB cache version
    const cachedVersion = await idbGet('wordlist_cache_version');
    if (cachedVersion !== WORDLIST_CACHE_VERSION) {
      await idbDel('wordlist_a1');
      await idbDel('wordlist_a2');
      await idbDel('wordlist_b1');
      await idbSet('wordlist_cache_version', WORDLIST_CACHE_VERSION);
    }

    let parsedCards = await idbGet(`wordlist_${level}`);
    
    if (!parsedCards) {
      console.log(`[IDB Cache] Cache miss for level ${level}. Fetching over HTTP...`);
      const response = await fetch(`./${level}/wordlist.json`);
      if (!response.ok) throw new Error(`HTTP status error: ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Invalid format: Wordlist must be a JSON array.");
      
      parsedCards = data.map((item, index) => {
        const word = (item.german || item.word || item.term || 'Unbekannt').trim();
        const meaning = (item.english || item.meaning || item.translation || item.definition || item.english_translation || 'No translation').trim();
        const wordClass = item.word_class || item.class || item.type || null;
        
        let gender = item.gender || null;
        if (gender) {
          gender = gender.toLowerCase().trim();
          if (gender !== 'der' && gender !== 'die' && gender !== 'das') gender = null;
        }
        
        const plural = item.plural || null;
        const antonym = item.antonym || item.opposite || null;
        const pronunciation = item.pronunciation || item.phonetics || item.ipa || item.pronunciation_hint || null;
        const exampleDe = item.example_de || item.example || item.sentence || item.example_sentence_de || null;
        const exampleEn = item.example_en || item.example_translation || item.sentence_translation || item.example_sentence_en || null;

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
      
      await idbSet(`wordlist_${level}`, parsedCards);
      console.log(`[IDB Cache] Saved normalized level ${level} dictionary into IndexedDB.`);
    } else {
      console.log(`[IDB Cache] Cache hit! Loaded level ${level} directly from IndexedDB.`);
    }

    const customList = await state.getCustomCards(level);
    state.allCards = [...parsedCards, ...customList];

    if (state.allCards.length === 0) throw new Error("The vocabulary list is empty.");

    state.filteredCards = [...state.allCards];
    state.currentDeck = [...state.allCards];
    
    // Build O(1) antonym index maps
    state.antonymIndex = new Map();
    state.allCards.forEach(card => {
      const cleanWord = card.word.replace(/^(der|die|das)\s+/i, '').trim().toLowerCase();
      state.antonymIndex.set(cleanWord, card);
    });
    
    renderSidebarCategories();
    window.dispatchEvent(new CustomEvent('srs:card-updated'));

    // Trigger lazy background pre-caching for generated level images (disabled during automated tests to speed up navigation)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller && !navigator.webdriver) {
      const imageUrls = state.allCards
        .map(c => c.image_path || c.image)
        .filter(img => !!img)
        .map(img => `./${level}/${img}`);
      
      if (imageUrls.length > 0) {
        navigator.serviceWorker.controller.postMessage({
          type: 'PRECACHE_RESOURCES',
          urls: imageUrls
        });
        console.log(`[SW Cache] Sent ${imageUrls.length} level ${level} image assets for lazy pre-caching.`);
      }
    }

    elements.loaderOverlay.classList.add('opacity-0');
    setTimeout(() => elements.loaderOverlay.classList.add('hidden'), 500);

    renderCard();
  } catch (error) {
    console.error("Failed to load flashcard data:", error);
    elements.loaderOverlay.classList.add('hidden');
    elements.errorMessage.textContent = `Fehler beim Laden von wordlist.json: ${error.message}`;
    elements.errorOverlay.classList.remove('hidden');
  }
}



// ==========================================
// PWA SYSTEM BOOTSTRAP TERMINAL
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  initTelemetry();
  await initProfileData();
  migrateToFSRS();
  startSession();
  
  updateLevelUI();
  initTheme();
  initSettingsUI();
  initShortcutsToggle();
  initHelpModal();
  initFeedbackModal();
  initPwaInstallManager();

  fetchData();
  setupEventListeners();
  setupSwipeGestures();
  initSidebarCategoryWords();
  updateImagesToggleUI();
  initTTS();

  const shortcutCloseBtn = document.getElementById('shortcut-close-btn');
  if (shortcutCloseBtn) shortcutCloseBtn.addEventListener('click', () => {
    document.getElementById('shortcut-overlay')?.classList.add('hidden');
  });

  const shortcutOverlay = document.getElementById('shortcut-overlay');
  if (shortcutOverlay) shortcutOverlay.addEventListener('click', (e) => {
    if (e.target === shortcutOverlay) shortcutOverlay.classList.add('hidden');
  });

  document.addEventListener('click', () => warmUpTTS(), { once: true });

  handleRouting();

  // SW registration with fully automatic zero-user-action update flow:
  // 1. New SW installs → skipWaiting() fires immediately (in install handler)
  // 2. New SW activates → broadcasts SW_ACTIVATED to all tabs
  // 3. controllerchange fires in each tab → auto-reload fetches fresh files
  // Net result: users always get new code on next page load, no manual clearing needed.
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    let swReloading = false;

    // When a new SW calls clients.claim(), reload to pick up fresh cached files
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!swReloading) {
        swReloading = true;
        window.location.reload();
      }
    });

    // Log SW_ACTIVATED messages from the service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SW_ACTIVATED') {
        console.log('[SW] New version activated:', event.data.version);
      }
    });

    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('[SW] Registered:', reg.scope);

        // If a new SW is already waiting (tab was open during deploy), push it through now
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        // When a new SW installs while the page is open, push it through immediately
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        // Proactively check for updates on every page load
        reg.update();
      })
      .catch(err => console.warn('[SW] Registration failed:', err));
  }



  // Focus release on mobile background tab cycles
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (state.trainer && state.trainer.active) stopAudioTrainer();
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    }
  });
});
