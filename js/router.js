// js/router.js — SPA client-side routing, view transitions, and route guards
import { state, elements } from './state.js';
import { renderCard, closePhoneticMirror } from './flashcards.js';
import { stopAudioTrainer } from './audio.js';
import { initQuizView } from './quiz.js';
import { initStatsView } from './stats.js';
import { initWeaverView } from './weaver.js';
import { initAdventureView } from './adventure.js';
import { initImmersionView } from './immersion.js';
import { CHEATCODES_DATABASE } from './cheatcodes_db.js';

// Local-scoped state for Cheatcode panel
export const cheatcodeState = {
  currentTab: 'all',
  searchQuery: ''
};

/**
 * Initiates the view transition and triggers the core routing handler.
 * Leverages document.startViewTransition for smooth cross-fades in modern browsers.
 */
export function handleRouting() {
  const applyRoute = () => handleRoutingCore();
  
  if (document.startViewTransition) {
    document.startViewTransition(applyRoute);
  } else {
    applyRoute();
  }
}

/**
 * Handles core routing, view display toggling, navigation tab active classes,
 * and audio/TTS state teardowns on route change.
 */
export function handleRoutingCore() {
  const hash = window.location.hash || '#/';
  
  // Reset navigation button classes
  elements.navFlashcards.className = "w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent";
  elements.navCheatcodes.className = "w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent";
  if (elements.navQuiz) elements.navQuiz.className = "w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent";
  if (elements.navStats) elements.navStats.className = "w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent";
  if (elements.navAdventure) elements.navAdventure.className = "w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent";
  if (elements.navWeaver) elements.navWeaver.className = "w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent";
  if (elements.navImmersion) elements.navImmersion.className = "w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent";
  
  // Hide all view panels
  elements.flashcardsView.classList.add('hidden');
  elements.cheatcodesView.classList.add('hidden');
  if (elements.quizView) elements.quizView.classList.add('hidden');
  if (elements.statsView) elements.statsView.classList.add('hidden');
  if (elements.adventureView) elements.adventureView.classList.add('hidden');
  if (elements.weaverView) elements.weaverView.classList.add('hidden');
  if (elements.immersionView) elements.immersionView.classList.add('hidden');
  // Disable weaver state tracking
  state.weaver.active = false;

  // Clean up overlays and running audio
  if (state.phonetic && state.phonetic.isOpen) {
    closePhoneticMirror();
  }
  if (state.trainer && state.trainer.active) {
    stopAudioTrainer();
  } else if (window.speechSynthesis && window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
  
  const levelUpper = state.currentLevel.toUpperCase();

  // Route Dispatcher
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
    // Default route: Flashcards view
    elements.flashcardsView.classList.remove('hidden');
    elements.navFlashcards.className = "w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-white bg-slate-800/50 border border-slate-700/50";
    document.title = `German ${levelUpper} Flashcards`;
    
    renderCard();
  }

  // F26: Focus management — move focus to main content after route change (WCAG compliance)
  requestAnimationFrame(() => {
    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.focus({ preventScroll: true });
  });
}

/**
 * Dynamic generation and filtering of grammar cheatcode cards
 */
export function renderCheatcodes() {
  if (!elements.cheatcodesGrid) return;

  elements.cheatcodesGrid.innerHTML = '';

  const filtered = CHEATCODES_DATABASE.filter(item => {
    if (cheatcodeState.currentTab !== 'all' && item.category !== cheatcodeState.currentTab) {
      return false;
    }

    if (cheatcodeState.searchQuery) {
      const q = cheatcodeState.searchQuery.toLowerCase();
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

/**
 * Mobile sidebar drawer toggle handlers
 */
export function openMobileSidebar() {
  elements.sidebar.classList.remove('-translate-x-full');
  elements.sidebarBackdrop.classList.remove('hidden');
}

export function closeMobileSidebar() {
  elements.sidebar.classList.add('-translate-x-full');
  elements.sidebarBackdrop.classList.add('hidden');
}
