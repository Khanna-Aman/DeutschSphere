// js/events.js — Handlers for hotkeys, swipes, settings sliders, help modals, and custom dialogs
import { state, elements, safeSetItem, safeJsonParse, resetActiveLevelProgress } from './state.js';
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
  toggleGrammarMatrix,
  nextCard,
  prevCard,
  toggleLearned,
  toggleShuffle,
  toggleReadMode,
  toggleHideLearned,
  toggleAutoplay,
  toggleImages,
  toggleDeckPrefs,
  closeDeckPrefs,
  togglePhoneticMirror,
  closePhoneticMirror,
  togglePhoneticRecording,
  updateImagesToggleUI
} from './flashcards.js';
import {
  initQuiz,
  checkSpellingAnswer,
  nextQuizQuestion,
  quitQuiz,
  handleMCOptionClick,
  showQuizResults,
  retryQuiz,
  quitQuiz as forceQuitQuiz
} from './quiz.js';
import {
  startScenario,
  resetAdventureSentence,
  checkAdventureAnswer,
  nextAdventureNode,
  quitAdventureScenario,
  speakAdventureNpcSentence
} from './adventure.js';
import {
  startWeaverGame,
  resetWeaverSentence,
  quitWeaverGame,
  submitWeaverSentence,
  nextWeaverSentence
} from './weaver.js';
import {
  exportBackup,
  importBackup,
  copySyncKey,
  restoreSyncKey,
  updateOverallStats,
  unlockAchievement
} from './stats.js';

// Custom Event listeners for module decoupling (replaces window.* bridges)
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
    const icon = elements.soundStyleBtn.querySelector('i');
    if (icon) {
      icon.className = state.audioTone === 'synth' ? 'fa-solid fa-wave-square text-[10px]' : 'fa-solid fa-guitar text-[10px] text-indigo-400';
    }
  }
}

/**
 * Ambient screen particle toggle indicator sync
 */
export function updateParticlesUI() {
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
  updateParticlesUI();
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

  if (elements.cheatcodeSearch) {
    elements.cheatcodeSearch.addEventListener('input', (e) => {
      window.dispatchEvent(new CustomEvent('cheatcode:search-input', { detail: { query: e.target.value } }));
    });
  }

  const tabButtons = document.querySelectorAll('.cheatcode-tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => {
        b.classList.remove('active', 'border-indigo-500', 'text-white');
        b.classList.add('border-transparent', 'text-slate-400');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active', 'border-indigo-500', 'text-white');
      btn.classList.remove('border-transparent', 'text-slate-400');
      btn.setAttribute('aria-selected', 'true');
      
      window.dispatchEvent(new CustomEvent('cheatcode:tab-change', { detail: { tab: btn.getAttribute('data-tab') } }));
    });
  });

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

  if (elements.cardGrammarMatrixTrigger) {
    elements.cardGrammarMatrixTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
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
      flashcard.classList.add('swipe-right');
      window.dispatchEvent(new CustomEvent('card:reviewed', { detail: { id: card.id, rating: 3 } })); // 3 = Good
      if (typeof window.triggerParticleBurst === 'function') {
        window.triggerParticleBurst(window.innerWidth / 2 + 100, window.innerHeight / 2.3);
      }
      setTimeout(() => {
        nextCard();
        flashcard.classList.remove('swipe-right');
        flashcard.style.transform = '';
      }, 300);
    } else if (dx < -threshold && card) {
      flashcard.classList.add('swipe-left');
      window.dispatchEvent(new CustomEvent('card:reviewed', { detail: { id: card.id, rating: 1 } })); // 1 = Again
      if (typeof window.triggerParticleBurst === 'function') {
        window.triggerParticleBurst(window.innerWidth / 2 - 100, window.innerHeight / 2.3);
      }
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

  if (currentHash === '#/weaver') {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      if (elements.weaverResetBtn && !elements.weaverResetBtn.classList.contains('hidden')) {
        elements.weaverResetBtn.click();
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (elements.weaverNextBtn && !elements.weaverNextBtn.classList.contains('hidden')) {
        elements.weaverNextBtn.click();
      } else if (elements.weaverSubmitBtn && !elements.weaverSubmitBtn.classList.contains('hidden')) {
        elements.weaverSubmitBtn.click();
      }
      return;
    }
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
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      if (elements.adventureResetBtn && !elements.adventureResetBtn.classList.contains('hidden')) {
        elements.adventureResetBtn.click();
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (elements.adventureNextNodeBtn && !elements.adventureNextNodeBtn.classList.contains('hidden')) {
        elements.adventureNextNodeBtn.click();
      } else if (elements.adventureSubmitBtn && !elements.adventureSubmitBtn.classList.contains('hidden')) {
        elements.adventureSubmitBtn.click();
      }
      return;
    }
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

  if (!state.visitedIntro && overlay) {
    setTimeout(() => {
      overlay.classList.remove('hidden');
    }, 1500);
  }
}

// Private helper for speech recognition speed loop triggers
function toggleTrainerLoop() {
  window.dispatchEvent(new CustomEvent('audio:toggle-loop-request'));
}
