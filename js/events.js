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
  updateImagesToggleUI,
  updateExamplesToggleUI,
  updateReadModeUI,
  updateAutoplayUI,
  updateHideLearnedUI
} from './flashcards.js';
import {
  togglePhoneticMirror,
  closePhoneticMirror,
  togglePhoneticRecording
} from './phonetics.js';
import {
  initQuiz,
  checkSpellingAnswer,
  nextQuizQuestion,
  quitQuiz,
  handleMCOptionClick,
  showQuizResults,
  retryQuiz
} from './quiz.js';
import { exportBackup, importBackup, copySyncKey, restoreSyncKey } from './backup.js';

// Custom Event listeners for module decoupling (replaces window.* bridges)
let srsUpdateTimeout = null;
function handleSRSUpdate(e) {
  if (srsUpdateTimeout) cancelAnimationFrame(srsUpdateTimeout);
  srsUpdateTimeout = requestAnimationFrame(() => {
    renderSidebarCategories();
    // Update session stats widgets
    if (elements.sidebarSessionReviewed) {
      elements.sidebarSessionReviewed.textContent = state.session.cardsReviewed;
    }
    if (elements.sidebarMasteredCount) {
      elements.sidebarMasteredCount.textContent = state.learnedCards.size;
    }
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
    elements.flashcard.addEventListener('click', (e) => {
      if (wasCardDragged) {
        wasCardDragged = false;
        return;
      }
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

  // FSRS Grade Buttons (Again=1, Hard=2, Good=3, Easy=4)
  if (elements.fsrsGradePanel) {
    elements.fsrsGradePanel.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-rating]');
      if (!btn) return;
      const rating = parseInt(btn.getAttribute('data-rating'), 10);
      const card = state.currentDeck ? state.currentDeck[state.currentIndex] : null;
      if (card) {
        window.dispatchEvent(new CustomEvent('card:reviewed', { detail: { id: card.id, rating } }));
        nextCard();
      }
    });
  }

  // Mobile Bottom Nav — Menu button opens sidebar
  if (elements.mobileNavMenuBtn) {
    elements.mobileNavMenuBtn.addEventListener('click', () => openMobileSidebar());
  }

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

let wasCardDragged = false;

/**
 * Captures Pointer & Touch Events on cards to process responsive swiping transitions
 */
export function setupSwipeGestures() {
  const flashcard = document.getElementById('flashcard');
  if (!flashcard) return;

  let startX = 0;
  let startY = 0;
  let isDragging = false;
  let currentDx = 0;

  const getClientPos = (e) => {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    if (e.changedTouches && e.changedTouches.length > 0) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };

  const onStart = (e) => {
    const hash = window.location.hash || '#/';
    if (hash !== '#/' && hash !== '#') return;

    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('#suffix-helper-trigger')) {
      return;
    }

    isDragging = true;
    wasCardDragged = false;
    currentDx = 0;
    const pos = getClientPos(e);
    startX = pos.x;
    startY = pos.y;

    if (e.pointerId !== undefined && typeof flashcard.setPointerCapture === 'function') {
      try { flashcard.setPointerCapture(e.pointerId); } catch (_) {}
    }

    flashcard.classList.add('drag-touch');
    flashcard.classList.remove('card-spring-back', 'swipe-left', 'swipe-right');
    flashcard.style.transform = '';
  };

  const onMove = (e) => {
    if (!isDragging) return;

    const pos = getClientPos(e);
    const dx = pos.x - startX;
    const dy = pos.y - startY;

    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
      wasCardDragged = true;
    }

    currentDx = dx;
    flashcard.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx * 0.08}deg)`;

    // Show directional swipe hints proportional to drag distance
    const hintOpacity = Math.min(Math.abs(dx) / 80, 0.9);
    if (dx > 15) {
      if (elements.swipeGoodHint) elements.swipeGoodHint.style.opacity = hintOpacity;
      if (elements.swipeAgainHint) elements.swipeAgainHint.style.opacity = '0';
    } else if (dx < -15) {
      if (elements.swipeGoodHint) elements.swipeGoodHint.style.opacity = '0';
      if (elements.swipeAgainHint) elements.swipeAgainHint.style.opacity = hintOpacity;
    } else {
      if (elements.swipeGoodHint) elements.swipeGoodHint.style.opacity = '0';
      if (elements.swipeAgainHint) elements.swipeAgainHint.style.opacity = '0';
    }
  };

  const onEnd = (e) => {
    if (!isDragging) return;
    isDragging = false;

    if (e.pointerId !== undefined && typeof flashcard.releasePointerCapture === 'function') {
      try { flashcard.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    flashcard.classList.remove('drag-touch');

    const dx = currentDx;
    const threshold = 45; // 45px threshold for effortless mobile swiping

    const card = state.currentDeck ? state.currentDeck[state.currentIndex] : null;

    // Reset swipe hints
    if (elements.swipeGoodHint) elements.swipeGoodHint.style.opacity = '0';
    if (elements.swipeAgainHint) elements.swipeAgainHint.style.opacity = '0';

    if (dx > threshold && card) {
      flashcard.classList.add('swipe-right');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('card:reviewed', { detail: { id: card.id, rating: 3 } }));
        nextCard();
        flashcard.classList.remove('swipe-right');
        flashcard.style.transform = '';
        wasCardDragged = false;
      }, 250);
    } else if (dx < -threshold && card) {
      flashcard.classList.add('swipe-left');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('card:reviewed', { detail: { id: card.id, rating: 1 } }));
        nextCard();
        flashcard.classList.remove('swipe-left');
        flashcard.style.transform = '';
        wasCardDragged = false;
      }, 250);
    } else {
      flashcard.classList.add('card-spring-back');
      flashcard.style.transform = '';
      setTimeout(() => {
        flashcard.classList.remove('card-spring-back');
        wasCardDragged = false;
      }, 350);
    }
  };

  // Attach Pointer Events
  flashcard.addEventListener('pointerdown', onStart);
  flashcard.addEventListener('pointermove', onMove);
  flashcard.addEventListener('pointerup', onEnd);
  flashcard.addEventListener('pointercancel', onEnd);

  // Attach Touch Events fallback for older/quirky mobile webviews
  flashcard.addEventListener('touchstart', onStart, { passive: true });
  flashcard.addEventListener('touchmove', onMove, { passive: true });
  flashcard.addEventListener('touchend', onEnd);
  flashcard.addEventListener('touchcancel', onEnd);
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

let deferredPrompt = null;

export function initPwaInstallManager() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });

  const installBtns = document.querySelectorAll('.install-app-btn');
  installBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          console.log('[PWA] User installed application');
        }
        deferredPrompt = null;
      } else {
        const modal = document.getElementById('pwa-install-modal-overlay');
        if (modal) modal.classList.remove('hidden');
      }
    });
  });

  const closeBtn = document.getElementById('pwa-install-modal-close');
  const doneBtn = document.getElementById('pwa-install-modal-done');
  const modal = document.getElementById('pwa-install-modal-overlay');

  if (closeBtn && modal) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  if (doneBtn && modal) doneBtn.addEventListener('click', () => modal.classList.add('hidden'));
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  }
}
