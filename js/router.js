// js/router.js — SPA client-side routing, view transitions, and route guards
import { state, elements } from './state.js';
import { renderCard } from './flashcards.js';
import { closePhoneticMirror } from './phonetics.js';
import { stopAudioTrainer } from './audio.js';
import { initQuizView } from './quiz.js';
import { initImmersionView } from './immersion.js';

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
const MOBILE_NAV_INACTIVE = 'mobile-bottom-tab flex flex-col items-center justify-center gap-0.5 px-3 py-2.5 flex-1 text-slate-500 border-t-2 border-transparent hover:text-slate-300 transition-all';
const MOBILE_NAV_ACTIVE = 'mobile-bottom-tab flex flex-col items-center justify-center gap-0.5 px-3 py-2.5 flex-1 text-indigo-400 border-t-2 border-indigo-500 transition-all';

export function handleRoutingCore() {
  const hash = window.location.hash || '#/';

  // Reset navigation button classes
  elements.navFlashcards.className = "w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent";
  if (elements.navQuiz) elements.navQuiz.className = "w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent";
  if (elements.navImmersion) elements.navImmersion.className = "w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent";

  // Reset mobile bottom nav tabs
  if (elements.mobileNavCards) elements.mobileNavCards.className = MOBILE_NAV_INACTIVE;
  if (elements.mobileNavQuizTab) elements.mobileNavQuizTab.className = MOBILE_NAV_INACTIVE;
  if (elements.mobileNavImmersionTab) elements.mobileNavImmersionTab.className = MOBILE_NAV_INACTIVE;
  
  // Hide all active view panels
  elements.flashcardsView.classList.add('hidden');
  if (elements.quizView) elements.quizView.classList.add('hidden');
  if (elements.immersionView) elements.immersionView.classList.add('hidden');

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

  // Route Dispatcher (Flashcards, Quiz, Immersion only)
  if (hash === '#/quiz') {
    if (elements.quizView) elements.quizView.classList.remove('hidden');
    if (elements.navQuiz) elements.navQuiz.className = "w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-white bg-slate-800/50 border border-slate-700/50";
    if (elements.mobileNavQuizTab) elements.mobileNavQuizTab.className = MOBILE_NAV_ACTIVE;
    document.title = `Quiz Arena — German ${levelUpper}`;
    initQuizView();
  } else if (hash === '#/immersion') {
    if (elements.immersionView) elements.immersionView.classList.remove('hidden');
    if (elements.navImmersion) elements.navImmersion.className = "w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-white bg-slate-800/50 border border-slate-700/50";
    if (elements.mobileNavImmersionTab) elements.mobileNavImmersionTab.className = MOBILE_NAV_ACTIVE;
    document.title = `Immersions-Labor — German ${levelUpper}`;
    initImmersionView();
  } else {
    // Default route: Flashcards view
    elements.flashcardsView.classList.remove('hidden');
    elements.navFlashcards.className = "w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 text-white bg-slate-800/50 border border-slate-700/50";
    if (elements.mobileNavCards) elements.mobileNavCards.className = MOBILE_NAV_ACTIVE;
    document.title = `German ${levelUpper} Flashcards`;

    renderCard();
  }

  // Focus management — move focus to main content after route change (WCAG compliance)
  requestAnimationFrame(() => {
    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.focus({ preventScroll: true });
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
