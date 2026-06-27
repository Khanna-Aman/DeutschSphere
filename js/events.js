// js/events.js — Handlers for hotkeys, swipes, settings sliders, help modals, and custom dialogs
import { state, elements, safeSetItem, safeGetItem, safeJsonParse, resetActiveLevelProgress } from './state.js';
import { handleRouting, closeMobileSidebar, openMobileSidebar } from './router.js';
import { renderSidebarCategories, filterDeck } from './search.js';
import {
  speakWord,
  toggleAudioTrainer,
  stopAudioTrainer,
  playSnapHaptic,
  warmUpTTS
} from './audio.js';
import {
  renderCard,
  toggleAccordion,
  nextCard,
  prevCard,
  toggleLearned,
  toggleShuffle,
  toggleReadMode,
  toggleHideLearned,
  toggleAutoplay,
  toggleImages,
  toggleExamples,
  toggleDeckPrefs,
  closeDeckPrefs,
  togglePhoneticMirror,
  closePhoneticMirror,
  togglePhoneticRecording,
  updateImagesToggleUI,
  updateExamplesToggleUI,
  updateReadModeUI,
  updateAutoplayUI,
  updateHideLearnedUI
} from './flashcards.js';
import {
  initQuiz,
  checkSpellingAnswer,
  nextQuizQuestion,
  quitQuiz,
  handleMCOptionClick,
  showQuizResults,
  retryQuiz
} from './quiz.js';
import * as idb from './idb-keyval.js';

// Custom Event listeners for module decoupling (replaces window.* bridges)
let srsUpdateTimeout = null;
function handleSRSUpdate(e) {
  if (srsUpdateTimeout) cancelAnimationFrame(srsUpdateTimeout);
  srsUpdateTimeout = requestAnimationFrame(() => {
    renderSidebarCategories();
  });
}
window.addEventListener('srs:card-updated', handleSRSUpdate);

window.addEventListener('deck:filter-request', (e) => {
  const resetIndex = e.detail?.resetIndex ?? false;
  filterDeck(resetIndex);
});

window.addEventListener('audio:stop-trainer', () => {
  stopAudioTrainer();
});

/**
 * Sound Tone UI styles sync
 */
export function updateSoundStyleUI() {
  if (elements.soundStyleText) {
    elements.soundStyleText.textContent = state.audioTone === 'synth' ? 'Synth' : 'Acoustic';
  }
  if (elements.soundStyleBtn) {
    const icon = elements.soundStyleBtn.querySelector('.sound-style-icon');
    if (icon) {
      icon.className = state.audioTone === 'synth' ? 'sound-style-icon fa-solid fa-wave-square text-[10px]' : 'sound-style-icon fa-solid fa-guitar text-[10px] text-indigo-400';
    }
  }
}



/**
 * Loads and initializes ambient settings UI sliders
 */
export function initSettingsUI() {
  if (elements.sfxVolumeSlider) {
    elements.sfxVolumeSlider.value = state.sfxVolume;
  }
  if (elements.sfxVolumeVal) {
    elements.sfxVolumeVal.textContent = `${Math.round(state.sfxVolume * 100)}%`;
  }
  updateSoundStyleUI();
  updateReadModeUI();
  updateAutoplayUI();
  updateHideLearnedUI();
  updateImagesToggleUI();
  updateExamplesToggleUI();
}

/**
 * Initializes toggle listener on bottom collapsible keyboard guide
 */
export function initShortcutsToggle() {
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

/**
 * Standard setup for PWA click handlers, forms, backup buttons, and navigation hooks
 */
export function setupEventListeners() {
  window.addEventListener('hashchange', handleRouting);

  // Category list delegation click handler
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

  // Level selector level:change CustomEvent emitter
  if (elements.levelSelect) {
    elements.levelSelect.addEventListener('change', (e) => {
      window.dispatchEvent(new CustomEvent('level:change-request', { detail: { level: e.target.value } }));
    });
  }

  const errorReloadBtn = document.getElementById('error-reload-btn');
  if (errorReloadBtn) errorReloadBtn.addEventListener('click', () => location.reload());



  if (elements.flashcard) {
    elements.flashcard.addEventListener('click', () => {
      toggleAccordion();
    });
  }

  if (elements.suffixHelperTrigger) {
    elements.suffixHelperTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
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
      
      // Auto-route to home (flashcards) if not there, so the user can see the filtered deck
      if (window.location.hash !== '#/' && window.location.hash !== '') {
        window.location.hash = '#/';
      }
      
      clearTimeout(searchTimeoutId);
      searchTimeoutId = setTimeout(() => {
        filterDeck();
      }, 150);
    });

    // Handle Enter key for instantaneous search submission and mobile/desktop keyboard dismissals
    elements.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        state.searchQuery = elements.searchInput.value.trim();
        if (state.searchQuery) {
          if (elements.searchClear) elements.searchClear.classList.remove('hidden');
        } else {
          if (elements.searchClear) elements.searchClear.classList.add('hidden');
        }
        
        // Auto-route to home (flashcards) if not there, so the user can see the filtered deck
        if (window.location.hash !== '#/' && window.location.hash !== '') {
          window.location.hash = '#/';
        }
        
        clearTimeout(searchTimeoutId);
        filterDeck();
        elements.searchInput.blur();
        closeMobileSidebar();
      }
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

  // Active Sidebar Search Submit Button click behavior
  const searchSubmitBtn = document.getElementById('search-submit-btn');
  if (searchSubmitBtn) {
    searchSubmitBtn.addEventListener('click', () => {
      const input = elements.searchInput;
      if (input) {
        state.searchQuery = input.value.trim();
        if (state.searchQuery) {
          if (elements.searchClear) elements.searchClear.classList.remove('hidden');
        } else {
          if (elements.searchClear) elements.searchClear.classList.add('hidden');
        }
        // Auto-route to home (flashcards) if not there, so the user can see the filtered deck
        if (window.location.hash !== '#/' && window.location.hash !== '') {
          window.location.hash = '#/';
        }
        clearTimeout(searchTimeoutId);
        filterDeck();
        input.blur();
        closeMobileSidebar();
      }
    });
  }



  // Quick search filter chip hotkeys
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
        // Auto-route to home (flashcards) if not there, so the user can see the filtered deck
        if (window.location.hash !== '#/' && window.location.hash !== '') {
          window.location.hash = '#/';
        }
        clearTimeout(searchTimeoutId);
        filterDeck();
        input.blur();
        closeMobileSidebar();
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
  if (elements.toggleExamplesBtn) elements.toggleExamplesBtn.addEventListener('click', toggleExamples);

  if (elements.deckPrefsToggleBtn) {
    elements.deckPrefsToggleBtn.addEventListener('click', toggleDeckPrefs);
  }

  document.addEventListener('click', (e) => {
    if (elements.deckPrefsDropdown && !elements.deckPrefsDropdown.contains(e.target) && elements.deckPrefsToggleBtn && !elements.deckPrefsToggleBtn.contains(e.target)) {
      closeDeckPrefs();
    }
  });

  if (elements.deckPrefsDropdown) {
    elements.deckPrefsDropdown.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDeckPrefs();
        if (elements.deckPrefsToggleBtn) elements.deckPrefsToggleBtn.focus();
        return;
      }
      if (e.key === 'Tab') {
        const buttons = Array.from(elements.deckPrefsDropdown.querySelectorAll('button, input')).filter(el => el && el.offsetParent !== null && !el.disabled);
        if (buttons.length === 0) return;
        const firstEl = buttons[0];
        const lastEl = buttons[buttons.length - 1];
        
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
    });
  }

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
      window.dispatchEvent(new CustomEvent('theme:change-request', { detail: { theme: e.target.value } }));
    });
  }

  if (elements.quizFinishEarlyBtn) {
    elements.quizFinishEarlyBtn.addEventListener('click', () => {
      showQuizResults();
    });
  }


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


}

/**
 * Captures PointerEvents on cards to process responsive swiping transitions (Rate Good / Rate Again)
 */
export function setupSwipeGestures() {
  const flashcard = document.getElementById('flashcard');
  if (!flashcard) return;

  let startX = 0;
  let startY = 0;
  let isDragging = false;

  flashcard.addEventListener('pointerdown', (e) => {
    const hash = window.location.hash || '#/';
    if (hash !== '#/' && hash !== '#') return;

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

    flashcard.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx * 0.08}deg)`;
  });

  const handleSwipeEnd = (e) => {
    if (!isDragging) return;
    isDragging = false;
    try {
      flashcard.releasePointerCapture(e.pointerId);
    } catch (_) {}
    flashcard.classList.remove('drag-touch');

    const dx = e.clientX - startX;
    const threshold = 60;

    const card = state.currentDeck ? state.currentDeck[state.currentIndex] : null;

    if (dx > threshold && card) {
      flashcard.classList.add('swipe-right');
      setTimeout(() => {
        prevCard();
        flashcard.classList.remove('swipe-right');
        flashcard.style.transform = '';
      }, 300);
    } else if (dx < -threshold && card) {
      flashcard.classList.add('swipe-left');
      setTimeout(() => {
        nextCard();
        flashcard.classList.remove('swipe-left');
        flashcard.style.transform = '';
      }, 300);
    } else {
      flashcard.classList.add('card-spring-back');
      flashcard.style.transform = '';
      setTimeout(() => {
        flashcard.classList.remove('card-spring-back');
      }, 500);
    }
  };

  flashcard.addEventListener('pointerup', handleSwipeEnd);
  flashcard.addEventListener('pointercancel', handleSwipeEnd);
}

/**
 * Global Keyboard shortcut engine mapping. Supports numerical scores, space flips, and backspaces.
 */
export function handleKeyboardShortcuts(e) {
  const tag = document.activeElement?.tagName;
  const isEditable = document.activeElement?.isContentEditable;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || isEditable) {
    if (e.key === 'Escape') {
      document.activeElement.blur();
    }
    return;
  }

  const helpOverlay = document.getElementById('help-modal-overlay');
  if (helpOverlay && !helpOverlay.classList.contains('hidden')) {
    if (e.key === 'Escape') {
      e.preventDefault();
      toggleHelpModal();
      return;
    }
  }

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

  if (e.key === '?' || e.key === '/') {
    e.preventDefault();
    toggleHelpModal();
    return;
  }

  if (currentHash !== '#/' && currentHash !== '#') return;

  switch (e.key) {
    case '1':
    case '2':
    case '3':
    case '4': {
      e.preventDefault();
      if (state.currentDeck.length > 0) {
        const card = state.currentDeck[state.currentIndex];
        const rating = parseInt(e.key, 10);
        window.dispatchEvent(new CustomEvent('card:reviewed', { detail: { id: card.id, rating: rating } }));
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

    case 'e':
    case 'E':
      e.preventDefault();
      toggleExamples();
      break;
      
    case 'Escape':
      e.preventDefault();
      if (!elements.sidebar.classList.contains('-translate-x-full')) {
        closeMobileSidebar();
      }
      break;
  }
}

/**
 * F14: WCAG-Compliant Custom Confirmation Dialog Modal with focus loop
 */
export function showConfirmModal(message, onConfirm) {
  const overlay = document.getElementById('confirm-modal-overlay');
  const msgEl = document.getElementById('confirm-modal-message');
  const confirmBtn = document.getElementById('confirm-modal-confirm');
  const cancelBtn = document.getElementById('confirm-modal-cancel');
  if (!overlay || !msgEl || !confirmBtn || !cancelBtn) {
    if (confirm(message)) onConfirm();
    return;
  }

  msgEl.textContent = message;
  overlay.classList.remove('hidden');

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

/**
 * Triggers overall progression resets
 */
export function resetProgress() {
  showConfirmModal(
    "Are you sure you want to reset your entire learning progress (viewed/learned cards)?",
    async () => {
      if (state.trainer && state.trainer.active) {
        stopAudioTrainer();
      }

      await resetActiveLevelProgress();
      
      renderCard();

      renderSidebarCategories();
    }
  );
}

let shortcutOverlayListener = null;
let helpModalOverlayListener = null;

export function toggleShortcutOverlay() {
  const overlay = document.getElementById('shortcut-overlay');
  if (!overlay) return;
  if (overlay.classList.contains('hidden')) {
    overlay.classList.remove('hidden');
    const closeBtn = document.getElementById('shortcut-close-btn');
    if (closeBtn) requestAnimationFrame(() => closeBtn.focus());

    // Bind local focus trap listener
    shortcutOverlayListener = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        toggleShortcutOverlay();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (closeBtn) closeBtn.focus();
      }
    };
    document.addEventListener('keydown', shortcutOverlayListener);
  } else {
    overlay.classList.add('hidden');
    if (shortcutOverlayListener) {
      document.removeEventListener('keydown', shortcutOverlayListener);
      shortcutOverlayListener = null;
    }
  }
}

export function toggleHelpModal() {
  const overlay = document.getElementById('help-modal-overlay');
  if (!overlay) return;
  if (overlay.classList.contains('hidden')) {
    overlay.classList.remove('hidden');
    const closeBtn = document.getElementById('help-modal-close');
    if (closeBtn) requestAnimationFrame(() => closeBtn.focus());

    // Bind local focus trap listener
    helpModalOverlayListener = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        toggleHelpModal();
      } else if (e.key === 'Tab') {
        const closeBtn = document.getElementById('help-modal-close');
        const ackBtn = document.getElementById('help-modal-ack');
        const focusable = [closeBtn, ackBtn].filter(el => el && el.offsetParent !== null);
        if (focusable.length === 0) return;
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
    };
    document.addEventListener('keydown', helpModalOverlayListener);
  } else {
    overlay.classList.add('hidden');
    if (helpModalOverlayListener) {
      document.removeEventListener('keydown', helpModalOverlayListener);
      helpModalOverlayListener = null;
    }
  }
}

export function initHelpModal() {
  const helpTriggers = document.querySelectorAll('.help-btn-trigger, #help-fab');
  const closeBtn = document.getElementById('help-modal-close');
  const ackBtn = document.getElementById('help-modal-ack');
  const overlay = document.getElementById('help-modal-overlay');

  helpTriggers.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      toggleHelpModal();
    });
  });
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

  if (!state.visitedIntro && overlay) {
    setTimeout(() => {
      overlay.classList.remove('hidden');
    }, 1500);
  }
}

export function initFeedbackModal() {
  const triggers = document.querySelectorAll('.feedback-btn-trigger, #feedback-btn-settings');
  const closeBtn = document.getElementById('feedback-modal-close');
  const cancelBtn = document.getElementById('feedback-modal-cancel');
  const overlay = document.getElementById('feedback-modal-overlay');
  const form = document.getElementById('feedback-form');
  const anonCheck = document.getElementById('feedback-anonymous-check');
  const nameInput = document.getElementById('feedback-name');
  const statusMsg = document.getElementById('feedback-status-msg');
  const submitBtn = document.getElementById('feedback-submit-btn');
  const submitText = document.getElementById('feedback-submit-text');

  function openFeedbackModal() {
    if (overlay) overlay.classList.remove('hidden');
    if (statusMsg) {
      statusMsg.classList.add('hidden');
      statusMsg.textContent = '';
    }
  }

  function closeFeedbackModal() {
    if (overlay) overlay.classList.add('hidden');
  }

  triggers.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const dropdown = document.getElementById('deck-prefs-dropdown');
      if (dropdown) {
        dropdown.classList.add('scale-95', 'opacity-0', 'pointer-events-none');
      }
      openFeedbackModal();
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', closeFeedbackModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeFeedbackModal);
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeFeedbackModal();
    });
  }

  if (anonCheck && nameInput) {
    anonCheck.addEventListener('change', () => {
      if (anonCheck.checked) {
        nameInput.value = '';
        nameInput.disabled = true;
        nameInput.placeholder = 'Anonymous Sender';
        nameInput.classList.add('opacity-50', 'cursor-not-allowed');
      } else {
        nameInput.disabled = false;
        nameInput.placeholder = 'Enter your name...';
        nameInput.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = anonCheck && anonCheck.checked ? 'Anonymous' : (nameInput ? nameInput.value.trim() || 'Anonymous' : 'Anonymous');
      const category = document.getElementById('feedback-category')?.value || 'General Feedback';
      const message = document.getElementById('feedback-message')?.value.trim();

      if (!message) return;

      if (submitBtn) submitBtn.disabled = true;
      if (submitText) submitText.textContent = 'Sending...';

      try {
        const response = await fetch('https://formsubmit.co/ajax/2002aman.khanna@gmail.com', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            name: name,
            category: category,
            message: message,
            _subject: `[DeutschSphere Feedback] ${category} from ${name}`,
            _template: 'table'
          })
        });

        if (response.ok) {
          if (statusMsg) {
            statusMsg.className = 'text-xs font-semibold text-center text-emerald-400 mt-2';
            statusMsg.textContent = '✓ Thank you! Your feedback has been sent to the developer.';
            statusMsg.classList.remove('hidden');
          }
          form.reset();
          if (anonCheck) anonCheck.checked = false;
          if (nameInput) nameInput.disabled = false;
          setTimeout(() => {
            closeFeedbackModal();
          }, 2200);
        } else {
          throw new Error('Network error');
        }
      } catch (err) {
        if (statusMsg) {
          statusMsg.className = 'text-xs font-semibold text-center text-rose-400 mt-2';
          statusMsg.textContent = '✕ Error sending feedback. Please try again.';
          statusMsg.classList.remove('hidden');
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (submitText) submitText.textContent = 'Send Feedback';
      }
    });
  }
}

// Private helper for speech recognition speed loop triggers
function toggleTrainerLoop() {
  window.dispatchEvent(new CustomEvent('audio:toggle-loop-request'));
}

// ==========================================
// BACKUP AND SYNC CORE IMPLEMENTATION
// ==========================================

export async function exportBackup() {
  try {
    const backup = {
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
        show_images: safeGetItem('show_images', 'true'),
        current_level: safeGetItem('current_level', 'a2')
      }
    };
    
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `german_mastery_backup_${dateStr}.json`;
    
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Backup compilation failed:", err);
    if (elements.backupImportFeedback) {
      elements.backupImportFeedback.classList.remove('hidden', 'text-emerald-400', 'text-slate-400');
      elements.backupImportFeedback.classList.add('text-rose-400');
      elements.backupImportFeedback.textContent = `Fehler beim Erstellen des Backups: ${err.message}`;
    }
  }
}

export function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  if (!elements.backupImportFeedback) return;
  
  elements.backupImportFeedback.classList.remove('hidden', 'text-rose-400', 'text-emerald-400');
  elements.backupImportFeedback.classList.add('text-slate-400');
  elements.backupImportFeedback.textContent = "Analyzing backup file...";
  
  const reader = new FileReader();
  reader.onload = async function(evt) {
    try {
      const backup = JSON.parse(evt.target.result);
      if (!backup || typeof backup !== 'object' || !backup.data) {
        throw new Error('Invalid file format. It must be a valid .json backup file.');
      }

      const data = backup.data;

      // ── Schema validation (mirrors restoreFromSyncKey guards) ──────────────
      const isArrayOfStrings = (v) => Array.isArray(v) && v.every(x => typeof x === 'string');
      const isPlainObject    = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
      const isSrsStateObj    = (v) => {
        if (!isPlainObject(v)) return false;
        return Object.values(v).every(entry => isPlainObject(entry));
      };
      const VALID_LEVELS = new Set(['a1', 'a2', 'b1']);

      const learnedKeys = ['learned_cards_a1', 'learned_cards_a2', 'learned_cards_b1'];
      const srsKeys     = ['srs_state_a1', 'srs_state_a2', 'srs_state_b1'];
      const customKeys  = ['custom_cards_a1', 'custom_cards_a2', 'custom_cards_b1'];

      learnedKeys.forEach(k => {
        if (data[k] !== undefined && !isArrayOfStrings(data[k])) {
          throw new Error(`Invalid schema: "${k}" must be an array of strings.`);
        }
      });

      srsKeys.forEach(k => {
        if (data[k] !== undefined && !isSrsStateObj(data[k])) {
          throw new Error(`Invalid schema: "${k}" must be a plain object of FSRS state objects.`);
        }
      });

      customKeys.forEach(k => {
        if (data[k] !== undefined && !Array.isArray(data[k])) {
          throw new Error(`Invalid schema: "${k}" must be an array.`);
        }
      });

      if (data.current_level !== undefined && !VALID_LEVELS.has(String(data.current_level))) {
        throw new Error(`Invalid schema: "current_level" must be one of: a1, a2, b1.`);
      }

      if (data.show_images !== undefined && !['true', 'false', true, false].includes(data.show_images)) {
        throw new Error('Invalid schema: "show_images" must be a boolean.');
      }
      // ── End validation ─────────────────────────────────────────────────────

      // Write validated data to IndexedDB
      if (data.learned_cards_a1) await idb.set('learned_cards_a1', JSON.stringify(data.learned_cards_a1));
      if (data.learned_cards_a2) await idb.set('learned_cards_a2', JSON.stringify(data.learned_cards_a2));
      if (data.learned_cards_b1) await idb.set('learned_cards_b1', JSON.stringify(data.learned_cards_b1));

      if (data.srs_state_a1) await idb.set('srs_state_a1', JSON.stringify(data.srs_state_a1));
      if (data.srs_state_a2) await idb.set('srs_state_a2', JSON.stringify(data.srs_state_a2));
      if (data.srs_state_b1) await idb.set('srs_state_b1', JSON.stringify(data.srs_state_b1));

      if (data.custom_cards_a1) await idb.set('custom_cards_a1', JSON.stringify(data.custom_cards_a1));
      if (data.custom_cards_a2) await idb.set('custom_cards_a2', JSON.stringify(data.custom_cards_a2));
      if (data.custom_cards_b1) await idb.set('custom_cards_b1', JSON.stringify(data.custom_cards_b1));

      if (data.show_images !== undefined) safeSetItem('show_images', String(data.show_images));
      if (data.current_level !== undefined) safeSetItem('current_level', String(data.current_level));

      elements.backupImportFeedback.className = 'text-[10px] text-center font-bold text-emerald-400 mt-3';
      elements.backupImportFeedback.textContent = '✓ Backup loaded! Refreshing dashboard...';

      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err) {
      console.error('Backup restore failed:', err);
      elements.backupImportFeedback.className = 'text-[10px] text-center font-bold text-rose-400 mt-3';
      elements.backupImportFeedback.textContent = '✕ Import failed: ' + err.message;
    }
  };

  reader.onerror = function() {
    elements.backupImportFeedback.className = 'text-[10px] text-center font-bold text-rose-400 mt-3';
    elements.backupImportFeedback.textContent = '✕ Error reading the backup file.';
  };

  reader.readAsText(file);
}

export async function copySyncKey() {
  const btn = document.getElementById('sync-copy-btn');
  if (!btn) return;
  
  try {
    const key = await state.generateSyncKey();
    await navigator.clipboard.writeText(key);
    
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-check text-sm text-emerald-400"></i> <span class="text-emerald-400">Copied! ✓</span>`;
    
    setTimeout(() => {
      btn.innerHTML = originalText;
    }, 2000);
  } catch (err) {
    console.error('Failed to generate or copy sync key:', err);
    // Show error inline in the button itself — no blocking alert()
    if (btn) {
      const originalText = btn.innerHTML;
      btn.innerHTML = `<i class="fa-solid fa-xmark text-sm text-rose-400"></i> <span class="text-rose-400">Copy failed</span>`;
      setTimeout(() => { btn.innerHTML = originalText; }, 3000);
    }
  }
}

export async function restoreSyncKey() {
  const input = document.getElementById('sync-restore-input');
  if (!input) return;
  
  const key = input.value.trim();
  const feedback = document.getElementById('backup-import-feedback');

  const showFeedbackError = (msg) => {
    if (feedback) {
      feedback.className = 'text-[10px] text-center font-bold text-rose-400 mt-3';
      feedback.textContent = msg;
    }
  };

  if (!key) {
    showFeedbackError('✕ Please paste a valid Sync Key.');
    return;
  }
  if (feedback) {
    feedback.classList.remove('hidden', 'text-rose-400', 'text-emerald-400');
    feedback.classList.add('text-slate-400');
    feedback.textContent = 'Validating Sync Key...';
  }
  
  try {
    const decodedStr = decodeURIComponent(escape(atob(key)));
    const payload = JSON.parse(decodedStr);
    if (!payload || typeof payload !== 'object' || !payload.data) {
      throw new Error("Invalid format. It must be a valid Sync Key.");
    }
    
    const imp = payload.data;
    
    // 1. Calculate Imported Metrics
    const impLearnedCount = (imp.learned_cards_a1?.length || 0) + (imp.learned_cards_a2?.length || 0) + (imp.learned_cards_b1?.length || 0);
    const impCustomCount = (imp.custom_cards_a1?.length || 0) + (imp.custom_cards_a2?.length || 0) + (imp.custom_cards_b1?.length || 0);
    const impSrsCount = Object.keys(imp.srs_state_a1 || {}).length + Object.keys(imp.srs_state_a2 || {}).length + Object.keys(imp.srs_state_b1 || {}).length;
    
    // 2. Fetch Local Metrics
    const localA1 = JSON.parse(await idb.get('learned_cards_a1') || '[]');
    const localA2 = JSON.parse(await idb.get('learned_cards_a2') || '[]');
    const localB1 = JSON.parse(await idb.get('learned_cards_b1') || '[]');
    const localLearnedCount = localA1.length + localA2.length + localB1.length;
    
    const localCustomA1 = JSON.parse(await idb.get('custom_cards_a1') || '[]');
    const localCustomA2 = JSON.parse(await idb.get('custom_cards_a2') || '[]');
    const localCustomB1 = JSON.parse(await idb.get('custom_cards_b1') || '[]');
    const localCustomCount = localCustomA1.length + localCustomA2.length + localCustomB1.length;
    
    const srsA1 = JSON.parse(await idb.get('srs_state_a1') || '{}');
    const srsA2 = JSON.parse(await idb.get('srs_state_a2') || '{}');
    const srsB1 = JSON.parse(await idb.get('srs_state_b1') || '{}');
    const localSrsCount = Object.keys(srsA1).length + Object.keys(srsA2).length + Object.keys(srsB1).length;
    


    const hasConflict = 
      impLearnedCount !== localLearnedCount ||
      impCustomCount !== localCustomCount ||
      impSrsCount !== localSrsCount;

    if (!hasConflict) {
      // Profiles are identical, restore instantly
      const success = await state.restoreFromSyncKey(key);
      if (success) {
        if (feedback) {
          feedback.className = "text-[10px] text-center font-bold text-emerald-400 mt-3";
          feedback.textContent = "✓ Already synchronized! No changes required.";
        }
      }
      return;
    }

    // 4. Create and display the Conflict Resolution Modal
    const modalDiv = document.createElement('div');
    modalDiv.id = 'sync-conflict-overlay';
    modalDiv.className = 'confirm-modal-overlay flex items-center justify-center p-4 z-[9999]';
    modalDiv.setAttribute('role', 'dialog');
    modalDiv.setAttribute('aria-modal', 'true');
    
    modalDiv.innerHTML = `
      <div class="glass border border-slate-800 rounded-3xl p-6 md:p-8 max-w-2xl w-full space-y-6 shadow-2xl animate-scale-up-center max-h-[90vh] overflow-y-auto no-scrollbar">
        <!-- Header -->
        <div class="flex items-center gap-3 border-b border-slate-900 pb-4">
          <div class="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 text-xl shrink-0">
            <i class="fa-solid fa-code-compare animate-pulse"></i>
          </div>
          <div>
            <h3 class="font-display font-bold text-lg text-white">Sync Conflict Detected</h3>
            <p class="text-[10px] text-slate-500 font-medium uppercase tracking-widest">Compare & Merge Panel</p>
          </div>
        </div>

        <p class="text-xs text-slate-300 leading-relaxed font-medium">
          The imported synchronization key differs from your local offline profile. Please compare the data and select how you would like to resolve the conflict.
        </p>

        <!-- Compare Matrix Columns -->
        <div class="grid grid-cols-3 gap-3 border-b border-slate-900 pb-5">
          <!-- Metric Label -->
          <div class="col-span-1 flex flex-col justify-center space-y-4">
            <span class="text-[10px] font-black uppercase tracking-wider text-slate-500">Metric</span>
            <span class="text-xs font-bold text-slate-300 border-l-2 border-indigo-500/30 pl-2">Learned Cards</span>
            <span class="text-xs font-bold text-slate-300 border-l-2 border-indigo-500/30 pl-2">Custom Cards</span>
            <span class="text-xs font-bold text-slate-300 border-l-2 border-indigo-500/30 pl-2">FSRS-5 Cards</span>
          </div>

          <!-- Local Profile Column -->
          <div class="col-span-1 bg-slate-950/40 border border-slate-900/80 rounded-xl p-3 flex flex-col space-y-4 text-center">
            <span class="text-[10px] font-black uppercase tracking-wider text-indigo-400">Local Profile</span>
            <span class="text-xs font-black text-slate-100">${localLearnedCount}</span>
            <span class="text-xs font-black text-slate-100">${localCustomCount}</span>
            <span class="text-xs font-black text-slate-100">${localSrsCount}</span>
          </div>

          <!-- Imported Key Column -->
          <div class="col-span-1 bg-indigo-950/10 border border-indigo-900/30 rounded-xl p-3 flex flex-col space-y-4 text-center">
            <span class="text-[10px] font-black uppercase tracking-wider text-pink-400">Imported (Key)</span>
            <span class="text-xs font-black text-slate-100">${impLearnedCount}</span>
            <span class="text-xs font-black text-slate-100">${impCustomCount}</span>
            <span class="text-xs font-black text-slate-100">${impSrsCount}</span>
          </div>
        </div>

        <!-- Action Columns & Explanations -->
        <div class="space-y-3">
          <h4 class="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Select Resolution Strategy</h4>
          
          <!-- Combine Option -->
          <button id="resolve-merge-btn" class="w-full text-left p-3.5 bg-slate-950 hover:bg-slate-900 border border-emerald-500/25 hover:border-emerald-500 rounded-2xl flex gap-3 items-start transition-all group active:scale-[0.99]">
            <div class="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
              <i class="fa-solid fa-shuffle"></i>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-black text-slate-100 font-display">Intelligent Merge</span>
                <span class="px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 text-[8px] font-black uppercase tracking-widest rounded-md">Recommended</span>
              </div>
              <p class="text-[10px] text-slate-400 leading-relaxed mt-0.5 font-medium">
                Combines learned, custom, and FSRS cards of both profiles without duplicates. Safe and seamless progress preservation.
              </p>
            </div>
          </button>

          <!-- Overwrite Option -->
          <button id="resolve-overwrite-btn" class="w-full text-left p-3.5 bg-slate-950 hover:bg-slate-900 border border-pink-500/20 hover:border-pink-500 rounded-2xl flex gap-3 items-start transition-all group active:scale-[0.99]">
            <div class="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shrink-0 group-hover:bg-pink-500 group-hover:text-white transition-colors">
              <i class="fa-solid fa-cloud-arrow-up"></i>
            </div>
            <div>
              <span class="text-xs font-black text-slate-100 font-display">Overwrite Local Data</span>
              <p class="text-[10px] text-slate-400 leading-relaxed mt-0.5 font-medium">
                Replaces your local offline profile completely with the imported sync key data. Your current local progress will be lost.
              </p>
            </div>
          </button>

          <!-- Cancel Option -->
          <button id="resolve-cancel-btn" class="w-full text-left p-3.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl flex gap-3 items-start transition-all group active:scale-[0.99]">
            <div class="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0">
              <i class="fa-solid fa-xmark"></i>
            </div>
            <div>
              <span class="text-xs font-black text-slate-100 font-display">Cancel</span>
              <p class="text-[10px] text-slate-400 leading-relaxed mt-0.5 font-medium">
                Cancels the import process. Your current local offline progress remains untouched.
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  `;

    document.body.appendChild(modalDiv);

    // 5. Wire resolution listeners
    document.getElementById('resolve-cancel-btn').addEventListener('click', () => {
      modalDiv.remove();
      if (feedback) {
        feedback.textContent = "";
        feedback.classList.add('hidden');
      }
    });

    document.getElementById('resolve-overwrite-btn').addEventListener('click', async () => {
      modalDiv.remove();
      if (feedback) {
        feedback.className = "text-[10px] text-center font-bold text-emerald-400 mt-3";
        feedback.textContent = "✓ Synchronized! Overwrite successful...";
      }
      await state.restoreFromSyncKey(key);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    });

    document.getElementById('resolve-merge-btn').addEventListener('click', async () => {
      modalDiv.remove();
      if (feedback) {
        feedback.className = "text-[10px] text-center font-bold text-emerald-400 mt-3";
        feedback.textContent = "✓ Merging profiles...";
      }

      try {
        // Run Merge Logic
        
        // A. Learned Cards (Union)
        const mergedLearnedA1 = Array.from(new Set([...localA1, ...(imp.learned_cards_a1 || [])]));
        const mergedLearnedA2 = Array.from(new Set([...localA2, ...(imp.learned_cards_a2 || [])]));
        const mergedLearnedB1 = Array.from(new Set([...localB1, ...(imp.learned_cards_b1 || [])]));
        
        await idb.set('learned_cards_a1', JSON.stringify(mergedLearnedA1));
        await idb.set('learned_cards_a2', JSON.stringify(mergedLearnedA2));
        await idb.set('learned_cards_b1', JSON.stringify(mergedLearnedB1));

        // B. Custom Cards (Union by lowercase word)
        function mergeCustom(localArr, impArr) {
          const map = new Map();
          localArr.forEach(c => { if(c && c.word) map.set(c.word.trim().toLowerCase(), c); });
          impArr.forEach(c => {
            if(c && c.word) {
              const k = c.word.trim().toLowerCase();
              if(!map.has(k)) map.set(k, c);
            }
          });
          return Array.from(map.values());
        }
        const mergedCustomA1 = mergeCustom(localCustomA1, imp.custom_cards_a1 || []);
        const mergedCustomA2 = mergeCustom(localCustomA2, imp.custom_cards_a2 || []);
        const mergedCustomB1 = mergeCustom(localCustomB1, imp.custom_cards_b1 || []);

        await idb.set('custom_cards_a1', JSON.stringify(mergedCustomA1));
        await idb.set('custom_cards_a2', JSON.stringify(mergedCustomA2));
        await idb.set('custom_cards_b1', JSON.stringify(mergedCustomB1));

        // C. SRS States (Combine, taking most recently reviewed if duplicate)
        function mergeSrs(localSrs, impSrs) {
          const merged = { ...localSrs };
          Object.keys(impSrs).forEach(cardId => {
            if (merged[cardId]) {
              const localCardSrs = merged[cardId];
              const impCardSrs = impSrs[cardId];
              const localTime = localCardSrs.lastReviewed || 0;
              const impTime = impCardSrs.lastReviewed || 0;
              if (impTime > localTime) {
                merged[cardId] = impCardSrs;
              }
            } else {
              merged[cardId] = impSrs[cardId];
            }
          });
          return merged;
        }
        const mergedSrsA1 = mergeSrs(srsA1, imp.srs_state_a1 || {});
        const mergedSrsA2 = mergeSrs(srsA2, imp.srs_state_a2 || {});
        const mergedSrsB1 = mergeSrs(srsB1, imp.srs_state_b1 || {});

        await idb.set('srs_state_a1', JSON.stringify(mergedSrsA1));
        await idb.set('srs_state_a2', JSON.stringify(mergedSrsA2));
        await idb.set('srs_state_b1', JSON.stringify(mergedSrsB1));



        if (feedback) {
          feedback.textContent = "✓ Merge successful! Reloading dashboard...";
        }

        setTimeout(() => {
          window.location.reload();
        }, 1500);

      } catch (err) {
        console.error('Merge and combine failed:', err);
        if (feedback) {
          feedback.className = 'text-[10px] text-center font-bold text-rose-400 mt-3';
          feedback.textContent = '✕ Merge failed: ' + err.message;
        }
      }
    });

  } catch (err) {
    console.error('Sync key restore failed:', err);
    if (feedback) {
      feedback.className = 'text-[10px] text-center font-bold text-rose-400 mt-3';
      feedback.textContent = '✕ Recovery failed: ' + err.message;
    }
  }
}
