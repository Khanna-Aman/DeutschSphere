// js/flashcards.js — FSRS SRS Flashcards, Preferences & Phonetik-Spiegel Module

import { state, elements, categoryTranslations, getSRSInfo, getCategoryIcon, saveSRSState, shuffleArray, safeSetItem, schedulePersist } from './state.js';
import { prepareUtterance, speakWord, warmUpTTS, getSharedAudioContext } from './audio.js';
import { getSuffixRule } from './nlp.js';

// Module-scoped amplitude smoothing for phonetic waveform (was window.nativeAmp)
let nativeAmp = 0;

import { PHONEME_GUIDES } from './phoneme_guides.js';

// Toggle the detail accordion
export function toggleAccordion() {
  if (state.isAccordionOpen) {
    closeAccordion();
  } else {
    openAccordion();
  }
}

// Expand the detail accordion
export function openAccordion() {
  state.isAccordionOpen = true;
  if (elements.accordionReveal) {
    elements.accordionReveal.classList.add('open');
  }
  if (elements.toggleRevealIcon) {
    elements.toggleRevealIcon.className = "fa-solid fa-chevron-up text-xs";
  }
  if (elements.toggleRevealText) {
    elements.toggleRevealText.textContent = "Hide Details";
  }
}

// Collapse the detail accordion with animation
export function closeAccordion() {
  state.isAccordionOpen = false;
  if (elements.accordionReveal) {
    elements.accordionReveal.classList.remove('open');
  }
  if (elements.toggleRevealIcon) {
    elements.toggleRevealIcon.className = "fa-solid fa-chevron-down text-xs";
  }
  if (elements.toggleRevealText) {
    elements.toggleRevealText.textContent = "Show Details";
  }
}

// Collapse the detail accordion instantly without animation
export function closeAccordionInstantly() {
  state.isAccordionOpen = false;
  if (elements.accordionReveal) {
    elements.accordionReveal.style.transition = 'none';
    elements.accordionReveal.classList.remove('open');
    requestAnimationFrame(() => {
      if (elements.accordionReveal) {
        elements.accordionReveal.style.transition = '';
      }
    });
  }
  if (elements.toggleRevealIcon) {
    elements.toggleRevealIcon.className = "fa-solid fa-chevron-down text-xs";
  }
  if (elements.toggleRevealText) {
    elements.toggleRevealText.textContent = "Show Details";
  }
}

// Render the active flashcard
/**
 * Private helper to clear UI elements and disable controls when the deck is empty.
 */
function renderEmptyDeckState() {
  if (elements.progressBarFill) elements.progressBarFill.style.width = `0%`;
  if (elements.deckProgressText) elements.deckProgressText.textContent = `Card 0 of 0 (0%)`;
  if (elements.cardIndexIndicator) elements.cardIndexIndicator.textContent = `0 / 0`;
  if (elements.cardMetadataBadges) elements.cardMetadataBadges.innerHTML = '';
  if (elements.cardWord) elements.cardWord.innerHTML = `<span class="text-slate-500 font-sans text-xl font-normal">No matching cards found.</span>`;
  
  if (elements.cardImageContainer) {
    elements.cardImageContainer.classList.add('hidden');
  }
  
  // Clear meaning accordion
  if (elements.cardMeaning) elements.cardMeaning.textContent = '';
  if (elements.cardExampleDe) elements.cardExampleDe.textContent = '';
  if (elements.cardExampleEn) elements.cardExampleEn.textContent = '';
  if (elements.cardAntonym) elements.cardAntonym.textContent = '';
  if (elements.cardAntonymContainer) elements.cardAntonymContainer.classList.add('hidden');
  if (elements.cardExamplesContainer) elements.cardExamplesContainer.classList.add('hidden');
  
  // Disable primary interaction buttons
  if (elements.flashcard) {
    elements.flashcard.className = "glass border border-slate-900 rounded-2xl p-6 md:py-6 md:px-10 min-h-[150px] md:min-h-[180px] flex flex-col justify-between cursor-not-allowed select-none relative card-glow-neutral";
  }
  if (elements.prevBtn) {
    elements.prevBtn.disabled = true;
    elements.prevBtn.classList.add('opacity-40', 'cursor-not-allowed');
  }
  if (elements.nextBtn) {
    elements.nextBtn.disabled = true;
    elements.nextBtn.classList.add('opacity-40', 'cursor-not-allowed');
  }
  if (elements.toggleRevealBtn) {
    elements.toggleRevealBtn.disabled = true;
    elements.toggleRevealBtn.classList.add('opacity-40', 'cursor-not-allowed');
  }
  if (elements.learnedBtn) {
    elements.learnedBtn.disabled = true;
    elements.learnedBtn.classList.add('opacity-40', 'cursor-not-allowed');
  }
}

/**
 * Private helper to enable control buttons when a non-empty deck is loaded.
 */
function enableNavigationControls() {
  if (elements.prevBtn) {
    elements.prevBtn.disabled = false;
    elements.prevBtn.classList.remove('opacity-40', 'cursor-not-allowed');
  }
  if (elements.nextBtn) {
    elements.nextBtn.disabled = false;
    elements.nextBtn.classList.remove('opacity-40', 'cursor-not-allowed');
  }
  if (elements.toggleRevealBtn) {
    elements.toggleRevealBtn.disabled = false;
    elements.toggleRevealBtn.classList.remove('opacity-40', 'cursor-not-allowed');
  }
  if (elements.learnedBtn) {
    elements.learnedBtn.disabled = false;
    elements.learnedBtn.classList.remove('opacity-40', 'cursor-not-allowed');
  }
}

/**
 * Sub-renderer: Build and inject metadata badges for the card.
 */
function renderCardMetadataBadges(card, deckLength) {
  let badgesHTML = '';
  if (card.wordClass) {
    badgesHTML += `<span class="px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-300 text-[10px] uppercase font-bold tracking-wider rounded-md">${card.wordClass}</span>`;
  }
  
  if (card.verified) {
    badgesHTML += `<span class="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/35 text-indigo-400 text-[10px] font-bold rounded-md flex items-center gap-1" title="NotebookLM Verified"><i class="fa-solid fa-circle-check text-indigo-400"></i> NotebookLM Verified</span>`;
  }
  
  if (card.gender) {
    let genderLabel = '';
    let genderColorClass = '';
    if (card.gender === 'der') {
      genderLabel = 'Maskulin (der)';
      genderColorClass = 'bg-blue-500/10 border-blue-500/35 text-blue-400';
    } else if (card.gender === 'die') {
      genderLabel = 'Feminin (die)';
      genderColorClass = 'bg-pink-500/10 border-pink-500/35 text-pink-400';
    } else if (card.gender === 'das') {
      genderLabel = 'Neutral (das)';
      genderColorClass = 'bg-emerald-500/10 border-emerald-500/35 text-emerald-400';
    }
    
    if (genderLabel) {
      badgesHTML += `<span class="px-2 py-0.5 border text-[10px] font-bold rounded-md ${genderColorClass}">${genderLabel}</span>`;
    }
  }

  if (card.plural) {
    badgesHTML += `<span class="px-2 py-0.5 bg-slate-900 border border-indigo-950 text-indigo-400 text-[10px] font-semibold rounded-md">Plural: ${card.plural}</span>`;
  }

  // Add FSRS Spaced Repetition (SRS) scheduling badge
  const srsInfo = getSRSInfo(card.id);
  let fsrsBadgeHTML = '';
  
  if (srsInfo.state === 0) { // State.New
    fsrsBadgeHTML = `<span class="px-2 py-0.5 bg-slate-900 border border-slate-800 text-slate-400 text-[10px] font-semibold rounded-md flex items-center gap-1" title="Unstudied • New">New</span>`;
  } else if (srsInfo.state === 1 || srsInfo.state === 3) { // State.Learning / State.Relearning
    fsrsBadgeHTML = `<span class="px-2 py-0.5 bg-rose-500/10 border border-rose-500/35 text-rose-400 text-[10px] font-bold rounded-md flex items-center gap-1" title="Learning Card • Review soon"><i class="fa-solid fa-circle-notch animate-spin text-[8px]"></i> Learning</span>`;
  } else if (srsInfo.state === 2) { // State.Review
    const stabilityStr = `S: ${srsInfo.stability.toFixed(1)}d`;
    if (srsInfo.stability >= 15) {
      fsrsBadgeHTML = `<span class="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/35 text-emerald-400 text-[10px] font-bold rounded-md flex items-center gap-1" title="Mastered • Memory Stability: ${srsInfo.stability.toFixed(2)} days"><i class="fa-solid fa-crown text-[8px]"></i> ${stabilityStr} (Master)</span>`;
    } else {
      fsrsBadgeHTML = `<span class="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/35 text-indigo-400 text-[10px] font-bold rounded-md flex items-center gap-1" title="Review Card • Memory Stability: ${srsInfo.stability.toFixed(2)} days"><i class="fa-solid fa-chart-line text-[8px]"></i> ${stabilityStr}</span>`;
    }
  }
  
  if (fsrsBadgeHTML) {
    badgesHTML += fsrsBadgeHTML;
  }

  // Add Learned status badge and format learned button
  const hasLearned = state.learnedCards.has(Number(card.id));
  if (hasLearned) {
    badgesHTML += `<span class="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/35 text-emerald-400 text-[10px] font-bold rounded-md flex items-center gap-1"><i class="fa-solid fa-circle-check"></i> Learned</span>`;
    if (elements.learnedBtn) {
      elements.learnedBtn.className = "flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white w-12 h-12 rounded-xl transition-all shadow-lg shadow-emerald-600/20 active:scale-95";
    }
  } else {
    if (elements.learnedBtn) {
      elements.learnedBtn.className = "flex items-center justify-center bg-slate-900 border border-slate-800 hover:border-emerald-500 hover:bg-emerald-950/20 text-slate-400 hover:text-emerald-400 w-12 h-12 rounded-xl transition-all shadow-md active:scale-95";
    }
  }

  if (elements.cardMetadataBadges) elements.cardMetadataBadges.innerHTML = badgesHTML;
}

/**
 * Sub-renderer: Handle the illustration WebP asset.
 * Also configures high-accessibility descriptive alt text (WCAG 2.1 SC 1.1.1).
 */
function renderCardImage(card) {
  const activeImage = card.image_path || card.image;
  const isImageAllowed = (state.currentLevel === 'a1' || state.currentLevel === 'a2');
  if (state.showImages && isImageAllowed && activeImage) {
    if (elements.cardImageContainer) {
      elements.cardImageContainer.style.display = '';
      elements.cardImageContainer.classList.remove('hidden');
    }
    
    // Clean up any old placeholder icon
    const oldPlaceholder = document.getElementById('card-image-placeholder');
    if (oldPlaceholder) {
      oldPlaceholder.remove();
    }
    
    if (elements.cardImage) {
      const targetSrc = state.currentLevel + '/' + activeImage;
      
      // Dynamic ALT text for screen reader compliance (WCAG 2.1 SC 1.1.1)
      const formattedGender = (card.wordClass === 'Noun' && card.gender) ? `${card.gender} ` : '';
      elements.cardImage.alt = `${formattedGender}${card.word} — ${card.meaning}`;

      if (!elements.cardImage.src.endsWith(targetSrc)) {
        elements.cardImage.classList.add('opacity-0');
        elements.cardImage.src = targetSrc;
      }
      
      if (elements.cardImage.complete && elements.cardImage.naturalWidth !== 0) {
        elements.cardImage.classList.remove('hidden', 'opacity-0');
      } else {
        elements.cardImage.onload = () => {
          elements.cardImage.classList.remove('hidden', 'opacity-0');
        };
      }
      
      elements.cardImage.onerror = () => {
        elements.cardImage.src = '';
        elements.cardImage.classList.add('hidden');
        if (elements.cardImageContainer) {
          elements.cardImageContainer.style.display = 'none';
          elements.cardImageContainer.classList.add('hidden');
        }
      };
    }
  } else {
    if (elements.cardImageContainer) {
      elements.cardImageContainer.style.display = 'none';
      elements.cardImageContainer.classList.add('hidden');
    }
    if (elements.cardImage) {
      elements.cardImage.src = '';
      elements.cardImage.classList.add('hidden');
      elements.cardImage.alt = '';
    }
  }
}

/**
 * Intelligent Image Preloader: Preloads upcoming and previous card images
 * into browser/service worker cache for 0ms latency during deck navigation.
 */
function preloadAdjacentCardImages() {
  const isImageAllowed = (state.currentLevel === 'a1' || state.currentLevel === 'a2');
  if (!state.showImages || !isImageAllowed || state.currentDeck.length === 0) return;
  
  const deckLength = state.currentDeck.length;
  const indicesToPreload = [
    (state.currentIndex + 1) % deckLength,
    (state.currentIndex + 2) % deckLength,
    (state.currentIndex + 3) % deckLength,
    (state.currentIndex - 1 + deckLength) % deckLength
  ];

  indicesToPreload.forEach(idx => {
    const targetCard = state.currentDeck[idx];
    if (targetCard) {
      const imgPath = targetCard.image_path || targetCard.image;
      if (imgPath) {
        const img = new Image();
        img.src = state.currentLevel + '/' + imgPath;
      }
    }
  });
}

/**
 * Sub-renderer: Apply deterministic gender glows and render the headword text with adaptive font scaling.
 */
function renderCardWord(card) {
  // Apply Gender border glow style to flashcard
  let glowClass = 'card-glow-neutral';
  if (card.gender === 'der') {
    glowClass = 'card-glow-der';
  } else if (card.gender === 'die') {
    glowClass = 'card-glow-die';
  } else if (card.gender === 'das') {
    glowClass = 'card-glow-das';
  }
  if (elements.flashcard) {
    elements.flashcard.className = `glass border rounded-2xl p-6 md:py-6 md:px-10 min-h-[150px] md:min-h-[180px] flex flex-col justify-between cursor-pointer transition-all duration-300 select-none relative group overflow-hidden ${glowClass}`;
  }

  // Set German Word with dynamic scaling for long compounds
  if (elements.cardWord) {
    elements.cardWord.textContent = card.word;
    if (card.word.length > 16) {
      elements.cardWord.className = "text-xl sm:text-2xl md:text-3xl font-black font-display tracking-tight text-white drop-shadow-md group-hover:scale-[1.02] transition-transform duration-300 leading-tight notranslate";
    } else if (card.word.length > 12) {
      elements.cardWord.className = "text-2xl sm:text-3xl md:text-4xl font-black font-display tracking-tight text-white drop-shadow-md group-hover:scale-[1.02] transition-transform duration-300 leading-tight notranslate";
    } else {
      elements.cardWord.className = "text-3xl sm:text-4xl md:text-5xl font-black font-display tracking-tight text-white drop-shadow-md group-hover:scale-[1.02] transition-transform duration-300 leading-tight notranslate";
    }
  }
}

/**
 * Sub-renderer: Detect suffix rules and configure helper overlays.
 */
function renderSuffixGrammar(card) {
  if (elements.suffixHelperTrigger && elements.suffixDrawer) {
    const suffixRule = getSuffixRule(card.word, card.wordClass);
    if (suffixRule) {
      // Show lightbulb trigger
      elements.suffixHelperTrigger.classList.remove('hidden');
      
      // Populate drawer text
      if (elements.suffixDrawerBadge) {
        elements.suffixDrawerBadge.textContent = suffixRule.badgeText;
        elements.suffixDrawerBadge.className = "px-1.5 py-0.5 text-[8px] font-extrabold rounded uppercase tracking-wider " + 
          (suffixRule.gender === 'der' ? 'bg-blue-500/20 text-blue-300' :
           suffixRule.gender === 'die' ? 'bg-pink-500/20 text-pink-300' :
           'bg-emerald-500/20 text-emerald-300');
      }
      if (elements.suffixDrawerTitle) {
        elements.suffixDrawerTitle.textContent = `Endung: -${suffixRule.suffix}`;
      }
      if (elements.suffixDrawerRule) {
        elements.suffixDrawerRule.textContent = suffixRule.rule;
      }
      
      // Ensure drawer is collapsed/hidden by default on card change
      elements.suffixDrawer.classList.add('hidden', 'pointer-events-none');
      elements.suffixDrawer.classList.remove('suffix-drawer-active');
      elements.suffixHelperTrigger.classList.remove('bg-amber-500/20', 'text-amber-300');
      elements.suffixHelperTrigger.classList.add('bg-amber-500/10', 'text-amber-400');
    } else {
      // Hide lightbulb and collapse/hide drawer
      elements.suffixHelperTrigger.classList.add('hidden');
      elements.suffixDrawer.classList.add('hidden', 'pointer-events-none');
      elements.suffixDrawer.classList.remove('suffix-drawer-active');
    }
  }
}

/**
 * Sub-renderer: Populate IPA phonetic transcriptions.
 */
function renderPronunciation(card) {
  if (elements.cardPronunciation) {
    if (card.pronunciation) {
      elements.cardPronunciation.textContent = `/ ${card.pronunciation} /`;
      elements.cardPronunciation.classList.remove('hidden');
    } else {
      elements.cardPronunciation.classList.add('hidden');
    }
  }
}

/**
 * Sub-renderer: Populate English meaning.
 */
function renderCardMeaning(card) {
  if (elements.cardMeaning) elements.cardMeaning.textContent = card.meaning;
}

/**
 * Sub-renderer: Populate contextual example sentences.
 */
function renderExampleSentences(card) {
  if (elements.cardExampleDe && elements.cardExampleEn && elements.cardExamplesContainer) {
    if (card.exampleDe && state.showExamples) {
      elements.cardExampleDe.textContent = card.exampleDe;
      elements.cardExampleEn.textContent = card.exampleEn || '';
      elements.cardExamplesContainer.classList.remove('hidden');
    } else {
      elements.cardExamplesContainer.classList.add('hidden');
    }
  }
}

/**
 * Sub-renderer: Render the antonym section with O(1) pre-indexed metadata mapping.
 */
function renderCardAntonyms(card) {
  if (elements.cardAntonym && elements.cardAntonymContainer) {
    if (card.antonym) {
      let antonymText = card.antonym;
      const cleanAntonym = card.antonym.replace(/^(der|die|das)\s+/i, '').trim().toLowerCase();
      
      // O(1) antonym lookup via pre-built index (built during data load)
      const matchingCard = state.antonymIndex ? state.antonymIndex.get(cleanAntonym) : null;
      
      if (matchingCard) {
        antonymText += ` (${matchingCard.meaning})`;
      }
      
      elements.cardAntonym.textContent = antonymText;
      elements.cardAntonymContainer.classList.remove('hidden');
    } else {
      elements.cardAntonymContainer.classList.add('hidden');
    }
  }
}

/**
 * Sub-renderer: Generate and bind conjugation/declension tables.
 * Purged to maintain distraction-free vocabulary first paradigm.
 */
function renderGrammarMatrix(card) {
  // Purged to enforce zero-distraction focus
}

/**
 * Orchestrator: Main render function for the flashcard interface.
 * Delegates individual sections to optimized private sub-renderers.
 */
export function renderCard() {
  const deckLength = state.currentDeck.length;

  // Update category title text
  let titleText = 'All Categories';
  if (state.activeCategory !== 'All') {
    const germanTitle = state.activeCategory;
    const englishTitle = categoryTranslations[state.activeCategory] || '';
    titleText = (englishTitle && englishTitle !== germanTitle) ? `${englishTitle} (${germanTitle})` : germanTitle;
  }
  if (state.searchQuery) {
    titleText += ` (Filtered: "${state.searchQuery}")`;
  }
  if (elements.currentCategoryTitle) elements.currentCategoryTitle.textContent = titleText;

  // Update deck stats
  if (elements.deckStats) elements.deckStats.textContent = `${deckLength} card(s) loaded${state.isShuffled ? ' • Shuffled' : ''}`;

  // Check if deck is empty
  if (deckLength === 0) {
    renderEmptyDeckState();
    return;
  }

  // Enable navigation elements
  enableNavigationControls();

  // Retrieve current card details
  const card = state.currentDeck[state.currentIndex];

  // Collapse grammar matrix drawer instantly when moving between cards
  collapseGrammarMatrixInstantly();

  // Update Progress values
  if (elements.cardIndexIndicator) elements.cardIndexIndicator.textContent = `${state.currentIndex + 1} / ${deckLength}`;
  const progressPercent = ((state.currentIndex + 1) / deckLength) * 100;
  if (elements.progressBarFill) elements.progressBarFill.style.width = `${progressPercent}%`;
  if (elements.deckProgressText) {
    elements.deckProgressText.textContent = `Card ${state.currentIndex + 1} of ${deckLength} (${Math.round(progressPercent)}%)`;
  }

  // Delegate rendering tasks to dedicated modular helpers
  renderCardMetadataBadges(card, deckLength);
  renderCardImage(card);
  preloadAdjacentCardImages();
  renderCardWord(card);
  renderSuffixGrammar(card);
  renderPronunciation(card);
  renderCardMeaning(card);
  renderExampleSentences(card);
  renderCardAntonyms(card);
  renderGrammarMatrix(card);

  // Handle Fast Read / Slow Read accordion visibility state
  if (state.isFastRead) {
    openAccordion();
  } else {
    closeAccordionInstantly();
  }

  // Pre-prepare utterance for immediate response on click
  prepareUtterance(card);

  // Update Deck Companion Dashboard
  renderCompanionWordList();
  updateCompanionStats();
  updateDesktopCompanionVisibility();

  if (state.autoplayTimeoutId) {
    clearTimeout(state.autoplayTimeoutId);
    state.autoplayTimeoutId = null;
  }

  // Autoplay or Continuous trainer handling
  if (state.trainer && state.trainer.active) {
    // If active and trainer is waiting, do nothing
  } else if (state.isAutoPlaySpeech && document.activeElement !== elements.searchInput) {
    // Speak the word after a short delay for smooth transition
    state.autoplayTimeoutId = setTimeout(() => {
      state.autoplayTimeoutId = null;
      if (state.currentDeck.length > 0 && state.currentDeck[state.currentIndex].id === card.id && !state.trainer.active) {
        speakWord();
      }
    }, 350);
  }
}

// Navigation Controls
export function nextCard() {
  if (state.currentDeck.length === 0) return;
  state.currentIndex = (state.currentIndex + 1) % state.currentDeck.length;
  renderCard();
  
  // C1 Audit: rAF replaces void offsetWidth forced synchronous reflow.
  // The old pattern halted JS execution to recalculate layout for the entire subtree.
  if (elements.flashcard) {
    elements.flashcard.classList.remove('slide-in-right', 'slide-in-left', 'shuffle-anim');
    requestAnimationFrame(() => {
      elements.flashcard.classList.add('slide-in-right');
    });
  }
}

export function prevCard() {
  if (state.currentDeck.length === 0) return;
  state.currentIndex = (state.currentIndex - 1 + state.currentDeck.length) % state.currentDeck.length;
  renderCard();
  
  // C1 Audit: rAF replaces void offsetWidth forced synchronous reflow
  if (elements.flashcard) {
    elements.flashcard.classList.remove('slide-in-right', 'slide-in-left', 'shuffle-anim');
    requestAnimationFrame(() => {
      elements.flashcard.classList.add('slide-in-left');
    });
  }
}

// Shuffle card sequence
export function toggleShuffle() {
  if (state.filteredCards.length === 0) return;
  
  state.isShuffled = !state.isShuffled;
  
  // Visual button active status — unified dropdown menu item highlight
  if (elements.shuffleBtn) {
    if (state.isShuffled) {
      elements.shuffleBtn.classList.add('bg-indigo-950/40', '!border-indigo-500/30');
      elements.shuffleBtn.setAttribute('data-active', 'true');
      
      // Copy and shuffle
      state.currentDeck = shuffleArray([...state.filteredCards]);
    } else {
      elements.shuffleBtn.classList.remove('bg-indigo-950/40', '!border-indigo-500/30');
      elements.shuffleBtn.removeAttribute('data-active');
      
      // Unshuffle back to regular filter sequence
      state.currentDeck = [...state.filteredCards];
    }
  }
  
  state.currentIndex = 0;
  
  // Trigger card animation effect
  if (elements.flashcard) {
    elements.flashcard.classList.add('shuffle-anim');
    setTimeout(() => {
      elements.flashcard.classList.remove('shuffle-anim');
    }, 650);
  }

  renderCard();
}

// Mark current card as Learned / Unlearned
export function toggleLearned() {
  if (state.currentDeck.length === 0) return;
  const card = state.currentDeck[state.currentIndex];
  const hasLearned = state.learnedCards.has(Number(card.id));
  
  if (hasLearned) {
    state.learnedCards.delete(Number(card.id));
    // Demote in SRS to New/Relearning state (FSRS-compatible)
    const now = Date.now();
    state.srs[card.id] = {
      state: 3, // Relearning
      difficulty: state.srs[card.id]?.difficulty || 5.0,
      stability: 0.4,
      due: 0,
      lastReview: now,
      reps: state.srs[card.id]?.reps || 0,
      lapses: (state.srs[card.id]?.lapses || 0) + 1,
      // Backward compat
      box: 1,
      nextReview: 0,
      lastReviewed: now
    };
  } else {
    state.learnedCards.add(Number(card.id));
    // Promote in SRS to Learning state (FSRS-compatible)
    const now = Date.now();
    state.srs[card.id] = {
      state: 1, // Learning
      difficulty: state.srs[card.id]?.difficulty || 5.0,
      stability: 1.18,
      due: now + 2 * 24 * 60 * 60 * 1000,
      lastReview: now,
      reps: (state.srs[card.id]?.reps || 0) + 1,
      lapses: state.srs[card.id]?.lapses || 0,
      // Backward compat
      box: 2,
      nextReview: now + 2 * 24 * 60 * 60 * 1000,
      lastReviewed: now
    };
  }
  
  // Debounced persistence via schedulePersist
  const dedupedIds = [...new Set(Array.from(state.learnedCards).map(id => Number(id)))];
  schedulePersist(
    `learned_cards_${state.currentLevel}`,
    () => JSON.stringify(dedupedIds),
    300
  );
  saveSRSState();
  
  // V3: Emit CustomEvent for UI refresh (replaces window.*External bridge)
  window.dispatchEvent(new CustomEvent('srs:card-updated', {
    detail: { cardId: state.currentDeck[state.currentIndex]?.id, action: 'toggle-learned', level: state.currentLevel }
  }));
  
  renderCard();

  // M16: Automatically advance to the next card after a small delay if marked as learned
  if (!hasLearned) {
    setTimeout(() => {
      if (state.hideLearned) {
        window.dispatchEvent(new CustomEvent('deck:filter-request', { detail: { resetIndex: true } }));
      } else {
        nextCard();
      }
    }, 400);
  }
}

// Preferences UI Sync: Fast Read Mode
export function updateReadModeUI() {
  if (elements.readModeBtn) {
    const icon = elements.readModeBtn.querySelector('.toggle-icon');
    if (icon) {
      const wrapper = icon.parentElement;
      if (state.isFastRead) {
        icon.className = "toggle-icon fa-solid fa-toggle-on text-xs text-indigo-400";
        elements.readModeBtn.classList.add('border-indigo-500/30', 'bg-indigo-950/20');
        elements.readModeBtn.classList.remove('border-slate-800', 'bg-slate-900/80');
        elements.readModeBtn.setAttribute('data-active', 'true');
        if (wrapper) {
          wrapper.className = "read-mode-toggle-wrapper flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium transition-all bg-indigo-950/20 border border-indigo-500/30 text-indigo-400";
        }
      } else {
        icon.className = "toggle-icon fa-solid fa-toggle-off text-xs text-slate-500";
        elements.readModeBtn.classList.add('border-slate-800', 'bg-slate-900/80');
        elements.readModeBtn.classList.remove('border-indigo-500/30', 'bg-indigo-950/20');
        elements.readModeBtn.removeAttribute('data-active');
        if (wrapper) {
          wrapper.className = "read-mode-toggle-wrapper flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium transition-all bg-slate-900/80 border border-slate-800 text-slate-500 group-hover:border-indigo-500/30 group-hover:bg-indigo-950/20";
        }
      }
    }
    if (elements.readModeText) {
      elements.readModeText.textContent = state.isFastRead ? "Fast Read: EIN" : "Fast Read: AUS";
    }
  }
}

// Preferences: Toggle Fast Read (autoflip detail)
export function toggleReadMode() {
  state.isFastRead = !state.isFastRead;
  safeSetItem('is_fast_read', state.isFastRead.toString());
  updateReadModeUI();
  if (state.isFastRead) {
    openAccordion();
  } else {
    closeAccordion();
  }
}

// Preferences UI Sync: Hide Learned
export function updateHideLearnedUI() {
  if (elements.hideLearnedBtn && elements.hideLearnedText) {
    if (state.hideLearned) {
      elements.hideLearnedBtn.classList.add('bg-indigo-950/40', '!border-indigo-500/30');
      elements.hideLearnedBtn.setAttribute('data-active', 'true');
      elements.hideLearnedText.textContent = "Show Learned";
    } else {
      elements.hideLearnedBtn.classList.remove('bg-indigo-950/40', '!border-indigo-500/30');
      elements.hideLearnedBtn.removeAttribute('data-active');
      elements.hideLearnedText.textContent = "Hide Learned";
    }
  }
}

// Preferences: Hide Learned Cards from current loop
export function toggleHideLearned() {
  state.hideLearned = !state.hideLearned;
  safeSetItem('hide_learned', state.hideLearned.toString());
  updateHideLearnedUI();
  
  // V3: Emit CustomEvent for deck re-filter (replaces window.filterDeckExternal bridge)
  window.dispatchEvent(new CustomEvent('deck:filter-request', { detail: { resetIndex: false } }));
}

// Preferences UI Sync: Autoplay Speech
export function updateAutoplayUI() {
  if (elements.autoplayBtn) {
    const icon = elements.autoplayBtn.querySelector('.toggle-icon');
    if (icon) {
      const wrapper = icon.parentElement;
      if (state.isAutoPlaySpeech) {
        icon.className = "toggle-icon fa-solid fa-toggle-on text-xs text-indigo-400";
        elements.autoplayBtn.classList.add('border-indigo-500/30', 'bg-indigo-950/20');
        elements.autoplayBtn.classList.remove('border-slate-800', 'bg-slate-900/80');
        elements.autoplayBtn.setAttribute('data-active', 'true');
        if (wrapper) {
          wrapper.className = "autoplay-toggle-wrapper flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium transition-all bg-indigo-950/20 border border-indigo-500/30 text-indigo-400";
        }
      } else {
        icon.className = "toggle-icon fa-solid fa-toggle-off text-xs text-slate-500";
        elements.autoplayBtn.classList.add('border-slate-800', 'bg-slate-900/80');
        elements.autoplayBtn.classList.remove('border-indigo-500/30', 'bg-indigo-950/20');
        elements.autoplayBtn.removeAttribute('data-active');
        if (wrapper) {
          wrapper.className = "autoplay-toggle-wrapper flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium transition-all bg-slate-900/80 border border-slate-800 text-slate-500 group-hover:border-indigo-500/30 group-hover:bg-indigo-950/20";
        }
      }
    }
    if (elements.autoplayText) {
      elements.autoplayText.textContent = state.isAutoPlaySpeech ? "Auto-Sprachausgabe: EIN" : "Auto-Sprachausgabe: AUS";
    }
  }
}

// Preferences: Autoplay speech on card change
export function toggleAutoplay() {
  state.isAutoPlaySpeech = !state.isAutoPlaySpeech;
  safeSetItem('is_autoplay_speech', state.isAutoPlaySpeech.toString());
  updateAutoplayUI();
  if (state.isAutoPlaySpeech) {
    warmUpTTS();
  }
}

// Premium Coming Soon Toast
function showToast(title, description, icon = 'fa-circle-info') {
  // Remove existing premium toasts to prevent stacking
  const existing = document.querySelectorAll('.premium-coming-soon-toast');
  existing.forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = "premium-coming-soon-toast fixed bottom-6 right-6 z-50 max-w-sm bg-slate-950/95 border border-indigo-500/30 text-white rounded-xl p-4 shadow-2xl shadow-indigo-500/10 flex items-start gap-3 transform translate-y-12 opacity-0 transition-all duration-500 backdrop-blur-md";
  toast.innerHTML = `
    <div class="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
      <i class="fa-solid ${icon} text-lg animate-pulse"></i>
    </div>
    <div class="flex-1">
      <h4 class="text-xs font-black text-white tracking-wide uppercase">${title}</h4>
      <p class="text-[10px] text-slate-300 mt-0.5">${description}</p>
    </div>
    <button class="text-slate-500 hover:text-slate-300 text-xs focus:outline-none" onclick="this.parentElement.remove()">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;
  document.body.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-12', 'opacity-0');
  });

  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.add('translate-y-12', 'opacity-0');
      setTimeout(() => toast.remove(), 500);
    }
  }, 5000);
}

// Preferences: Toggle illustrations
export function toggleImages() {
  if (state.currentLevel === 'b1') {
    showToast(
      "Illustrations Compiling",
      "Level B1 illustrations are currently compiling in the background! They will be ready in V1.0.1. Currently, illustrations are active for levels A1 and A2.",
      "fa-image"
    );
    state.showImages = false;
    safeSetItem('show_images', 'false');
    updateImagesToggleUI();
    return;
  }

  // Toggle state
  state.showImages = !state.showImages;
  safeSetItem('show_images', state.showImages ? 'true' : 'false');
  updateImagesToggleUI();

  if (state.showImages) {
    showToast(
      "Premium-Illustrationen",
      "Premium hand-curated illustrations are now active for Level A1 & A2! ✨",
      "fa-image"
    );
  } else {
    showToast(
      "Illustrationen Deaktiviert",
      "Premium illustrations are now deactivated.",
      "fa-image"
    );
  }

  // Re-render current card to apply image state change immediately
  renderCard();

}

export function updateImagesToggleUI() {
  const toggleBtn = document.getElementById('toggle-images-btn');
  const label = document.getElementById('toggle-images-label');
  const sublabel = document.getElementById('toggle-images-sublabel');

  if (!toggleBtn) return;

  const icon = toggleBtn.querySelector('.toggle-icon');
  const wrapper = icon ? icon.parentElement : null;

  if (state.currentLevel === 'b1') {
    // Force disabled / compilation notice
    toggleBtn.classList.remove('bg-indigo-600', 'border-indigo-500', 'text-white', 'hover:bg-indigo-500', 'hover:text-white');
    toggleBtn.classList.add('bg-slate-950/40', 'border-slate-900/80', 'text-slate-500/70', 'cursor-not-allowed');
    toggleBtn.title = "Illustrationen für B1 werden kompiliert (B)";
    if (label) {
      label.textContent = "Premium Illustrations";
      label.classList.add('text-slate-400');
      label.classList.remove('text-indigo-400');
    }
    if (sublabel) {
      sublabel.textContent = "Compiling for B1...";
      sublabel.classList.add('text-slate-500');
      sublabel.classList.remove('text-indigo-500/80');
    }
    if (icon) {
      icon.className = "toggle-icon fa-solid fa-toggle-off text-xs text-slate-500/40";
    }
    if (wrapper) {
      wrapper.className = "toggle-images-wrapper flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium transition-all bg-slate-950/40 border border-slate-900/80 text-slate-500/40";
    }
  } else {
    // A1 or A2: can be toggled
    toggleBtn.classList.remove('cursor-not-allowed');
    toggleBtn.title = "Toggle Premium Illustrations (B)";
    
    if (state.showImages) {
      // Active state
      toggleBtn.classList.add('bg-indigo-600', 'border-indigo-500', 'text-white', 'hover:bg-indigo-500', 'hover:text-white');
      toggleBtn.classList.remove('bg-slate-950/40', 'border-slate-900/80', 'text-slate-500/70');
      toggleBtn.setAttribute('data-active', 'true');
      if (label) {
        label.textContent = "Premium Illustrations";
        label.classList.remove('text-slate-400');
        label.classList.add('text-indigo-400');
      }
      if (sublabel) {
        sublabel.textContent = "Active (A1 & A2 supported)";
        sublabel.classList.remove('text-slate-500');
        sublabel.classList.add('text-indigo-500/80');
      }
      if (icon) {
        icon.className = "toggle-icon fa-solid fa-toggle-on text-xs text-indigo-400";
      }
      if (wrapper) {
        wrapper.className = "toggle-images-wrapper flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium transition-all bg-indigo-950/20 border border-indigo-500/30 text-indigo-400";
      }
    } else {
      // Inactive state
      toggleBtn.classList.remove('bg-indigo-600', 'border-indigo-500', 'text-white', 'hover:bg-indigo-500', 'hover:text-white');
      toggleBtn.classList.add('bg-slate-950/40', 'border-slate-900/80', 'text-slate-500/70');
      toggleBtn.removeAttribute('data-active');
      if (label) {
        label.textContent = "Premium Illustrations";
        label.classList.add('text-slate-400');
        label.classList.remove('text-indigo-400');
      }
      if (sublabel) {
        sublabel.textContent = "Deactivated";
        sublabel.classList.add('text-slate-500');
        sublabel.classList.remove('text-indigo-500/80');
      }
      if (icon) {
        icon.className = "toggle-icon fa-solid fa-toggle-off text-xs text-slate-500";
      }
      if (wrapper) {
        wrapper.className = "toggle-images-wrapper flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium transition-all bg-slate-900/80 border border-slate-800 text-slate-500 group-hover:border-indigo-500/30 group-hover:bg-indigo-950/20";
      }
    }
  }
}

export function updateExamplesToggleUI() {
  if (elements.toggleExamplesBtn) {
    const icon = elements.toggleExamplesBtn.querySelector('.toggle-icon');
    if (icon) {
      const wrapper = icon.parentElement;
      if (state.showExamples) {
        icon.className = "toggle-icon fa-solid fa-toggle-on text-xs text-indigo-400";
        elements.toggleExamplesBtn.classList.add('border-indigo-500/30', 'bg-indigo-950/20');
        elements.toggleExamplesBtn.classList.remove('border-slate-800', 'bg-slate-900/80');
        elements.toggleExamplesBtn.setAttribute('data-active', 'true');
        if (wrapper) {
          wrapper.className = "toggle-examples-wrapper flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium transition-all bg-indigo-950/20 border border-indigo-500/30 text-indigo-400";
        }
      } else {
        icon.className = "toggle-icon fa-solid fa-toggle-off text-xs text-slate-500";
        elements.toggleExamplesBtn.classList.add('border-slate-800', 'bg-slate-900/80');
        elements.toggleExamplesBtn.classList.remove('border-indigo-500/30', 'bg-indigo-950/20');
        elements.toggleExamplesBtn.removeAttribute('data-active');
        if (wrapper) {
          wrapper.className = "toggle-examples-wrapper flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium transition-all bg-slate-900/80 border border-slate-800 text-slate-500 group-hover:border-indigo-500/30 group-hover:bg-indigo-950/20";
        }
      }
    }
    if (elements.toggleExamplesText) {
      elements.toggleExamplesText.textContent = state.showExamples ? "Beispiele: EIN" : "Beispiele: AUS";
    }
  }
}

export function toggleExamples() {
  state.showExamples = !state.showExamples;
  safeSetItem('show_examples', state.showExamples ? 'true' : 'false');
  updateExamplesToggleUI();
  if (state.showExamples) {
    showToast("Beispielsätze Aktiviert", "Example sentences are now active on flashcards.", "fa-quote-left");
  } else {
    showToast("Beispielsätze Deaktiviert", "Example sentences are now hidden for cleaner flashcards.", "fa-quote-left");
  }
  const card = state.currentDeck ? state.currentDeck[state.currentIndex] : null;
  if (card) renderExampleSentences(card);
}

// Dropdown: Deck preferences open/close
export function toggleDeckPrefs(e) {
  if (e) e.stopPropagation();
  const isExpanded = elements.deckPrefsToggleBtn.getAttribute('aria-expanded') === 'true';
  
  if (isExpanded) {
    closeDeckPrefs();
  } else {
    elements.deckPrefsToggleBtn.setAttribute('aria-expanded', 'true');
    elements.deckPrefsDropdown.classList.remove('opacity-0', 'invisible', 'scale-95', 'pointer-events-none');
    elements.deckPrefsDropdown.classList.add('opacity-100', 'scale-100');
    
    // Automatically focus first item inside the settings menu for accessibility
    const firstEl = elements.deckPrefsDropdown.querySelector('button, input');
    if (firstEl) {
      requestAnimationFrame(() => firstEl.focus());
    }
  }
}

export function closeDeckPrefs() {
  if (elements.deckPrefsToggleBtn && elements.deckPrefsDropdown) {
    elements.deckPrefsToggleBtn.setAttribute('aria-expanded', 'false');
    elements.deckPrefsDropdown.classList.remove('opacity-100', 'scale-100');
    elements.deckPrefsDropdown.classList.add('opacity-0', 'invisible', 'scale-95', 'pointer-events-none');
  }
}

// V3: Expose renderCard via CustomEvent listener (replaces window.renderActiveCardExternal bridge)
window.addEventListener('deck:render-active-card', () => renderCard());

// ==========================================
// PHONETIK-SPIEGEL (SPEECH PRONUNCIATION MIRROR)
// ==========================================

export function togglePhoneticMirror() {
  if (state.currentDeck.length === 0) return;

  if (state.phonetic.isOpen) {
    closePhoneticMirror();
  } else {
    if (state.trainer && state.trainer.active) {
      // V3: Request audio trainer stop via CustomEvent (replaces window.stopAudioTrainerExternal bridge)
      window.dispatchEvent(new CustomEvent('audio:stop-trainer'));
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    state.phonetic.isOpen = true;
    
    if (elements.phoneticMirrorPanel) {
      elements.phoneticMirrorPanel.classList.add('open');
      setTimeout(() => {
        elements.phoneticMirrorPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 200);
    }
    
    if (elements.phoneticBtn) {
      elements.phoneticBtn.classList.add('bg-pink-950/20', 'border-pink-500', 'text-pink-400');
      elements.phoneticBtn.classList.remove('bg-slate-900/80', 'border-slate-800', 'text-slate-400');
    }

    if (elements.phoneticEvaluationPanel) {
      elements.phoneticEvaluationPanel.classList.add('hidden');
    }
    if (elements.phoneticStatusMsg) {
      elements.phoneticStatusMsg.textContent = "Ready. Click the microphone to start recording your pronunciation.";
    }

    drawNativeWave();

    setTimeout(() => {
      if (state.phonetic.isOpen) {
        speakWord();
      }
    }, 400);
  }
}

export function closePhoneticMirror() {
  state.phonetic.isOpen = false;
  
  if (elements.phoneticMirrorPanel) {
    elements.phoneticMirrorPanel.classList.remove('open');
  }
  
  if (elements.phoneticBtn) {
    elements.phoneticBtn.classList.remove('bg-pink-950/20', 'border-pink-500', 'text-pink-400');
    elements.phoneticBtn.classList.add('bg-slate-900/80', 'border-slate-800', 'text-slate-400');
  }

  if (state.phonetic.isRecording) {
    stopPhoneticRecording();
  }

  if (state.phonetic.nativeAnimationId) {
    cancelAnimationFrame(state.phonetic.nativeAnimationId);
    state.phonetic.nativeAnimationId = null;
  }
  if (state.phonetic.learnerAnimationId) {
    cancelAnimationFrame(state.phonetic.learnerAnimationId);
    state.phonetic.learnerAnimationId = null;
  }

  [elements.phoneticSpecNative, elements.phoneticSpecLearner].forEach(canvas => {
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  });

  if (elements.phoneticMouthGuideContainer) {
    elements.phoneticMouthGuideContainer.innerHTML = '';
    elements.phoneticMouthGuideContainer.classList.add('hidden');
  }
}

export function togglePhoneticRecording() {
  if (state.phonetic.isRecording) {
    stopPhoneticRecording();
  } else {
    startPhoneticRecording();
  }
}

export function startPhoneticRecording() {
  if (state.phonetic.isRecording) return;

  // H6: SpeechRecognition requires HTTPS — detect file:// protocol and warn user
  if (location.protocol === 'file:') {
    if (elements.phoneticStatusMsg) {
      elements.phoneticStatusMsg.textContent = "⚠️ Speech recognition requires HTTPS. Please open the app via a local server (e.g., python -m http.server) or GitHub Pages.";
    }
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (elements.phoneticStatusMsg) {
      elements.phoneticStatusMsg.textContent = "Error: Speech recognition is not supported in your browser (recommended: Google Chrome or Microsoft Edge).";
    }
    return;
  }

  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      state.phonetic.microphoneStream = stream;
      state.phonetic.isRecording = true;

      // C2: Use shared AudioContext singleton instead of creating new one per session
      try {
        const sharedCtx = getSharedAudioContext();
        if (sharedCtx) {
          state.phonetic.audioContext = sharedCtx;
          state.phonetic.analyser = sharedCtx.createAnalyser();
          state.phonetic.analyser.fftSize = 256;

          state.phonetic.micSourceNode = sharedCtx.createMediaStreamSource(stream);
          state.phonetic.micSourceNode.connect(state.phonetic.analyser);
        }
      } catch (err) {
        console.warn("Failed to initialize Web Audio Analyser context:", err);
      }

      if (elements.phoneticRecordIcon) {
        elements.phoneticRecordIcon.className = "fa-solid fa-stop text-lg text-white scale-110";
      }
      if (elements.phoneticPulseRing) {
        elements.phoneticPulseRing.classList.add('phonetic-pulse-active');
      }
      if (elements.phoneticRecordBtn) {
        elements.phoneticRecordBtn.classList.remove('text-pink-400', 'border-pink-500/30');
        elements.phoneticRecordBtn.classList.add('bg-pink-600', 'border-pink-500', 'text-white');
      }
      if (elements.learnerSpecStatus) {
        elements.learnerSpecStatus.textContent = "Listening...";
        elements.learnerSpecStatus.className = "text-pink-400 animate-pulse font-bold";
      }
      if (elements.phoneticStatusMsg) {
        elements.phoneticStatusMsg.textContent = "Listening... Please pronounce the German word clearly.";
      }
      if (elements.phoneticEvaluationPanel) {
        elements.phoneticEvaluationPanel.classList.add('hidden');
      }

      drawLearnerWave();

      state.phonetic.recognition = new SpeechRecognition();
      state.phonetic.recognition.lang = 'de-DE';
      state.phonetic.recognition.interimResults = false;
      state.phonetic.recognition.maxAlternatives = 1;

      state.phonetic.recognition.onresult = (event) => {
        // M12 Audit: Guard against undefined transcript from garbled/short audio
        const spokenText = event.results?.[0]?.[0]?.transcript?.trim() ?? '';
        evaluatePhoneticPronunciation(spokenText);
      };

      state.phonetic.recognition.onerror = (event) => {
        console.warn("Speech Recognition Error Event:", event.error);
        if (event.error === 'no-speech') {
          if (elements.phoneticStatusMsg) {
            elements.phoneticStatusMsg.textContent = "No speech detected. Please try again.";
          }
        } else {
          if (elements.phoneticStatusMsg) {
            elements.phoneticStatusMsg.textContent = `Recognition error: ${event.error}. Please try again.`;
          }
        }
        stopPhoneticRecording();
      };

      state.phonetic.recognition.onend = () => {
        stopPhoneticRecording();
      };

      state.phonetic.recognition.start();
    })
    .catch(err => {
      console.error("Microphone hardware access blocked:", err);
      if (elements.phoneticStatusMsg) {
        elements.phoneticStatusMsg.textContent = "Microphone access denied. Please allow microphone access in your browser settings.";
      }
    });
}

export function stopPhoneticRecording() {
  if (!state.phonetic.isRecording) return;

  state.phonetic.isRecording = false;

  if (state.phonetic.recognition) {
    try {
      state.phonetic.recognition.stop();
    } catch (e) {}
    state.phonetic.recognition = null;
  }

  if (state.phonetic.microphoneStream) {
    state.phonetic.microphoneStream.getTracks().forEach(track => {
      try {
        track.stop();
      } catch (e) {}
    });
    state.phonetic.microphoneStream = null;
  }

  // C2: Disconnect mic source from shared AudioContext but do NOT close it (it's shared)
  if (state.phonetic.micSourceNode) {
    try {
      state.phonetic.micSourceNode.disconnect();
    } catch (e) {}
    state.phonetic.micSourceNode = null;
  }
  // Clear analyser reference but preserve the shared AudioContext
  state.phonetic.analyser = null;
  state.phonetic.audioContext = null;

  if (elements.phoneticRecordIcon) {
    elements.phoneticRecordIcon.className = "fa-solid fa-microphone text-lg group-hover:scale-110 transition-transform";
  }
  if (elements.phoneticPulseRing) {
    elements.phoneticPulseRing.classList.remove('phonetic-pulse-active');
  }
  if (elements.phoneticRecordBtn) {
    elements.phoneticRecordBtn.classList.add('text-pink-400', 'border-pink-500/30');
    elements.phoneticRecordBtn.classList.remove('bg-pink-600', 'border-pink-500', 'text-white');
  }
  if (elements.learnerSpecStatus) {
    elements.learnerSpecStatus.textContent = "Inactive";
    elements.learnerSpecStatus.className = "text-slate-500 font-bold";
  }
}

// C5 Audit: Cached canvas dimensions updated by ResizeObserver instead of reading
// clientWidth/clientHeight on every animation frame (which forced synchronous layout).
let nativeCW = 320, nativeCH = 64, nativeDpr = 1;
let learnerCW = 320, learnerCH = 64, learnerDpr = 1;

const phoneticResizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(entries => {
  for (const entry of entries) {
    const { width, height } = entry.contentRect;
    const dpr = window.devicePixelRatio || 1;
    if (entry.target === elements.phoneticSpecNative?.parentElement) {
      nativeCW = width || 320;
      nativeCH = height || 64;
      nativeDpr = dpr;
    } else if (entry.target === elements.phoneticSpecLearner?.parentElement) {
      learnerCW = width || 320;
      learnerCH = height || 64;
      learnerDpr = dpr;
    }
  }
}) : null;

export function drawNativeWave() {
  const canvas = elements.phoneticSpecNative;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  // Observe parent container for resize events (fires once immediately)
  if (canvas.parentElement && !canvas.parentElement._phoneticObserved) {
    if (phoneticResizeObserver) phoneticResizeObserver.observe(canvas.parentElement);
    canvas.parentElement._phoneticObserved = true;
  }
  
  let frame = 0;
  
  function render() {
    if (!state.phonetic.isOpen) {
      cancelAnimationFrame(state.phonetic.nativeAnimationId);
      return;
    }
    
    // C5 Audit: Use cached dimensions from ResizeObserver
    canvas.width = nativeCW * nativeDpr;
    canvas.height = nativeCH * nativeDpr;
    canvas.style.width = nativeCW + 'px';
    canvas.style.height = nativeCH + 'px';
    ctx.setTransform(nativeDpr, 0, 0, nativeDpr, 0, 0);
    const width = nativeCW;
    const height = nativeCH;
    
    ctx.clearRect(0, 0, width, height);
    
    // Grid backplate
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let i = 0; i < height; i += 20) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    // Dynamic wave
    ctx.beginPath();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgb(99, 102, 241)';
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(99, 102, 241, 0.5)';
    
    const amplitude = state.phonetic.isNativePlaying ? (height / 2.6) : 0;
    
    nativeAmp = nativeAmp * 0.88 + amplitude * 0.12;
    
    ctx.moveTo(0, height / 2);
    for (let x = 0; x < width; x++) {
      const envelope = Math.sin((x / width) * Math.PI);
      const angle1 = (x * 0.04) + frame * 0.15;
      const angle2 = (x * 0.015) - frame * 0.07;
      const y = (height / 2) + nativeAmp * envelope * (Math.sin(angle1) * 0.72 + Math.cos(angle2) * 0.28);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    // Harmonic helper wave
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
    ctx.moveTo(0, height / 2);
    for (let x = 0; x < width; x++) {
      const envelope = Math.sin((x / width) * Math.PI);
      const angle1 = (x * 0.035) - frame * 0.09;
      const angle2 = (x * 0.055) + frame * 0.14;
      const y = (height / 2) + nativeAmp * 0.55 * envelope * (Math.cos(angle1) * 0.5 + Math.sin(angle2) * 0.5);
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    frame++;
    state.phonetic.nativeAnimationId = requestAnimationFrame(render);
  }
  
  if (state.phonetic.nativeAnimationId) {
    cancelAnimationFrame(state.phonetic.nativeAnimationId);
  }
  render();
}

export function drawLearnerWave() {
  const canvas = elements.phoneticSpecLearner;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  // Observe parent container for resize events (fires once immediately)
  if (canvas.parentElement && !canvas.parentElement._phoneticObserved) {
    if (phoneticResizeObserver) phoneticResizeObserver.observe(canvas.parentElement);
    canvas.parentElement._phoneticObserved = true;
  }
  
  function render() {
    if (!state.phonetic.isRecording || !state.phonetic.isOpen) {
      cancelAnimationFrame(state.phonetic.learnerAnimationId);
      state.phonetic.learnerAnimationId = null;
      return;
    }
    
    // C5 Audit: Use cached dimensions from ResizeObserver
    canvas.width = learnerCW * learnerDpr;
    canvas.height = learnerCH * learnerDpr;
    canvas.style.width = learnerCW + 'px';
    canvas.style.height = learnerCH + 'px';
    ctx.setTransform(learnerDpr, 0, 0, learnerDpr, 0, 0);
    const width = learnerCW;
    const height = learnerCH;
    
    const analyser = state.phonetic.analyser;
    if (!analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);
    
    ctx.clearRect(0, 0, width, height);
    
    // Grid backplate
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let i = 0; i < height; i += 20) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    // Time-domain wave
    ctx.beginPath();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgb(236, 72, 153)';
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(236, 72, 153, 0.5)';
    
    const sliceWidth = width * 1.0 / bufferLength;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const envelope = Math.sin((i / bufferLength) * Math.PI);
      const offset = (v - 1.0) * envelope;
      const y = (height / 2) + offset * (height * 0.48);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      
      x += sliceWidth;
    }
    
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Frequency spectrum bars overlay
    const freqData = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(freqData);
    
    ctx.fillStyle = 'rgba(236, 72, 153, 0.07)';
    const barWidth = (width / bufferLength) * 2.8;
    let barX = 0;
    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (freqData[i] / 255) * (height * 0.55);
      ctx.fillRect(barX, height - barHeight, barWidth, barHeight);
      barX += barWidth + 1;
    }

    state.phonetic.learnerAnimationId = requestAnimationFrame(render);
  }
  
  if (state.phonetic.learnerAnimationId) {
    cancelAnimationFrame(state.phonetic.learnerAnimationId);
  }
  render();
}

export function evaluatePhoneticPronunciation(spokenText) {
  if (state.currentDeck.length === 0) return;
  const card = state.currentDeck[state.currentIndex];
  
  let targetWord = card.word.trim();
  const targetWordClean = targetWord.replace(/\(.*?\)/g, '').trim();
  
  const targetCore = targetWordClean.replace(/^(der|die|das)\s+/i, '').trim().toLowerCase();
  const spokenCore = spokenText.replace(/^(der|die|das)\s+/i, '').trim().toLowerCase();
  
  const cleanTarget = targetCore.replace(/[^a-zäöüß]/g, '');
  const cleanSpoken = spokenCore.replace(/[^a-zäöüß]/g, '');
  
  const distance = getLevenshteinDistance(cleanTarget, cleanSpoken);
  const maxLength = Math.max(cleanTarget.length, cleanSpoken.length);
  let score = 0;
  if (maxLength > 0) {
    score = Math.round(((maxLength - distance) / maxLength) * 100);
  } else if (cleanTarget.length === 0 && cleanSpoken.length === 0) {
    score = 100;
  }

  if (elements.phoneticMatchedChars) {
    elements.phoneticMatchedChars.innerHTML = '';
    
    let spokenIdx = 0;
    const sourceTokens = targetWordClean.split('');
    const isCharMatched = new Array(sourceTokens.length).fill(false);
    
    sourceTokens.forEach((char, idx) => {
      const cleanChar = char.toLowerCase();
      const isAlpha = /[a-zäöüß0-9]/i.test(cleanChar);
      
      const span = document.createElement('span');
      span.textContent = char;
      span.className = 'transition-all duration-300 transform';
      
      if (!isAlpha) {
        span.className += ' text-slate-500 font-normal';
      } else {
        let matched = false;
        for (let offset = -2; offset <= 2; offset++) {
          const checkIdx = spokenIdx + offset;
          if (checkIdx >= 0 && checkIdx < cleanSpoken.length && cleanSpoken[checkIdx] === cleanChar) {
            matched = true;
            spokenIdx = checkIdx + 1;
            break;
          }
        }
        
        isCharMatched[idx] = matched;
        
        if (matched) {
          span.className += ' text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.35)] font-black text-xl scale-105';
        } else {
          span.className += ' text-rose-500 font-bold decoration-rose-500/50 decoration-2 line-through';
        }
      }
      
      elements.phoneticMatchedChars.appendChild(span);
    });

    // Detect failed difficult phonemes (ö, ü, ä, ch, sch, r)
    const failedPhonemes = new Set();
    const cleanWordLower = targetWordClean.toLowerCase();
    
    // Find all 'sch'
    let index = 0;
    while ((index = cleanWordLower.indexOf('sch', index)) !== -1) {
      const failed = !isCharMatched[index] || !isCharMatched[index + 1] || !isCharMatched[index + 2];
      if (failed) failedPhonemes.add('sch');
      index += 3;
    }
    
    // Find all 'ch' (not part of 'sch')
    index = 0;
    while ((index = cleanWordLower.indexOf('ch', index)) !== -1) {
      if (index === 0 || cleanWordLower[index - 1] !== 's') {
        const failed = !isCharMatched[index] || !isCharMatched[index + 1];
        if (failed) failedPhonemes.add('ch');
      }
      index += 2;
    }
    
    // Find all 'ö'
    index = 0;
    while ((index = cleanWordLower.indexOf('ö', index)) !== -1) {
      if (!isCharMatched[index]) failedPhonemes.add('ö');
      index += 1;
    }
    
    // Find all 'ü'
    index = 0;
    while ((index = cleanWordLower.indexOf('ü', index)) !== -1) {
      if (!isCharMatched[index]) failedPhonemes.add('ü');
      index += 1;
    }
    
    // Find all 'ä'
    index = 0;
    while ((index = cleanWordLower.indexOf('ä', index)) !== -1) {
      if (!isCharMatched[index]) failedPhonemes.add('ä');
      index += 1;
    }
    
    // Find all 'r'
    index = 0;
    while ((index = cleanWordLower.indexOf('r', index)) !== -1) {
      if (!isCharMatched[index]) failedPhonemes.add('r');
      index += 1;
    }

    // Render Anatomical Mouth Guide if any failed
    if (elements.phoneticMouthGuideContainer) {
      if (failedPhonemes.size > 0 && score < 100) {
        let guidesHTML = `
          <div class="mt-4 pt-3 border-t border-slate-900 animate-fade-in space-y-3">
            <div class="flex items-center gap-2">
              <span class="flex h-2 w-2 relative">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <h5 class="text-[10px] font-extrabold uppercase tracking-widest text-rose-400">Mouth Positioning Guide</h5>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        `;
        
        failedPhonemes.forEach(ph => {
          const guide = PHONEME_GUIDES[ph];
          if (guide) {
            guidesHTML += `
              <div class="bg-slate-950 border border-slate-900 rounded-lg p-3 flex gap-3 items-center hover:border-pink-500/20 transition-colors duration-300">
                <div class="flex-shrink-0 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-md p-1">
                  ${guide.svg}
                </div>
                <div class="space-y-1 min-w-0">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-xs font-black text-pink-400 font-sans tracking-wide uppercase">${guide.title}</span>
                    <span class="px-1.5 py-0.5 bg-pink-500/10 border border-pink-500/25 text-pink-400 text-[8px] font-black uppercase tracking-wider rounded">Mouth Guide</span>
                  </div>
                  <p class="text-[10px] text-slate-300 leading-normal font-medium"><strong class="text-slate-400 font-extrabold uppercase text-[8px] tracking-wider block">Lips:</strong> ${guide.lips}</p>
                  <p class="text-[10px] text-slate-300 leading-normal font-medium"><strong class="text-slate-400 font-extrabold uppercase text-[8px] tracking-wider block">Tongue:</strong> ${guide.tongue}</p>
                  <p class="text-[10px] text-slate-400 leading-normal italic font-medium pt-0.5"><strong class="text-slate-400 font-extrabold uppercase text-[8px] tracking-widest block not-italic">Instructions:</strong> ${guide.instructions}</p>
                </div>
              </div>
            `;
          }
        });
        
        guidesHTML += `
            </div>
          </div>
        `;
        
        elements.phoneticMouthGuideContainer.innerHTML = guidesHTML;
        elements.phoneticMouthGuideContainer.classList.remove('hidden');
      } else {
        elements.phoneticMouthGuideContainer.innerHTML = '';
        elements.phoneticMouthGuideContainer.classList.add('hidden');
      }
    }
  }

  if (elements.phoneticScoreBadge) {
    elements.phoneticScoreBadge.textContent = `${score}% Match`;
    elements.phoneticScoreBadge.className = "px-2 py-0.5 font-mono text-xs font-black rounded border transition-all duration-300";
    
    if (score >= 90) {
      elements.phoneticScoreBadge.classList.add('bg-emerald-500/10', 'border-emerald-500/35', 'text-emerald-400');
    } else if (score >= 70) {
      elements.phoneticScoreBadge.classList.add('bg-amber-500/10', 'border-amber-500/35', 'text-amber-400');
    } else {
      elements.phoneticScoreBadge.classList.add('bg-rose-500/10', 'border-rose-500/35', 'text-rose-400');
    }
  }

  let feedbackMessage = '';
  if (score === 100) {
    feedbackMessage = `Perfect! You pronounced the word flawlessly. ("${spokenText}")`;
  } else if (score >= 90) {
    feedbackMessage = `Excellent pronunciation! Very minor deviations, but perfectly intelligible. ("${spokenText}")`;
  } else if (score >= 75) {
    feedbackMessage = `Great job! Check the red strikethrough characters to refine your pronunciation. ("${spokenText}")`;
  } else if (score >= 50) {
    feedbackMessage = `Good try! Listen to the model audio speaker, and pay special attention to the consonants and umlauts. ("${spokenText}")`;
  } else if (spokenText.length > 0) {
    feedbackMessage = `The recognized speech deviates significantly ("${spokenText}"). Please compare your pronunciation with the speaker audio.`;
  } else {
    feedbackMessage = "Speech was too faint or distorted to analyze. Speak louder, closer to the microphone, or slightly slower.";
  }

  if (elements.phoneticFeedbackMsg) {
    elements.phoneticFeedbackMsg.textContent = feedbackMessage;
  }

  if (elements.phoneticEvaluationPanel) {
    elements.phoneticEvaluationPanel.classList.remove('hidden');
  }

  if (elements.phoneticStatusMsg) {
    elements.phoneticStatusMsg.textContent = `Evaluation complete: ${score}% match.`;
  }
}

// C3 Audit: Single-row optimization — O(min(m,n)) space instead of O(m×n) 2D array.
// Eliminates many small garbage-collectable array objects on the phonetic evaluation hot path.
export function getLevenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  // Ensure 'a' is the shorter string for minimal row allocation
  if (a.length > b.length) { const tmp = a; a = b; b = tmp; }
  const prev = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prevDiag = prev[0];
    prev[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const temp = prev[i];
      prev[i] = Math.min(
        prev[i] + 1,
        prev[i - 1] + 1,
        prevDiag + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      prevDiag = temp;
    }
  }
  return prev[a.length];
}

export function collapseGrammarMatrixInstantly() {
  // Purged to enforce zero-distraction focus
}

export function toggleGrammarMatrix() {
  // Purged to enforce zero-distraction focus
}

// ============================================================
// SIDEBAR CATEGORY WORDS — replaces the old companion panels
// ============================================================

/**
 * Wire the sidebar "Category Words" toggle button.
 * Called once on app init.
 */
export function initSidebarCategoryWords() {
  const btn = document.getElementById('toggle-category-words-btn');
  const content = document.getElementById('category-words-content');
  const icon = document.getElementById('category-words-toggle-icon');
  if (!btn || !content || !icon) return;

  btn.addEventListener('click', () => {
    const isOpen = !content.classList.contains('hidden');
    if (isOpen) {
      content.classList.add('hidden');
      icon.style.transform = 'rotate(0deg)';
    } else {
      content.classList.remove('hidden');
      icon.style.transform = 'rotate(180deg)';
      // Refresh the word list when user opens the panel
      renderCompanionWordList();
    }
  });
}

let companionScrollListenerAdded = false;

/**
 * Virtual-scroll renderer for the sidebar category word list.
 */
function updateCompanionVirtualScrollForContainer(container, scrollerHeightId, visibleContainerId, force = false) {
  const scrollerHeight = document.getElementById(scrollerHeightId);
  const visibleContainer = document.getElementById(visibleContainerId);

  if (!container || !scrollerHeight || !visibleContainer || !state.currentDeck || state.currentDeck.length === 0) return;

  const ITEM_HEIGHT = 54;
  const scrollTop = container.scrollTop;
  const viewportHeight = container.clientHeight || 260;

  const totalItems = state.currentDeck.length;
  const rawStartIndex = Math.floor(scrollTop / ITEM_HEIGHT);
  const startIndex = Math.max(0, rawStartIndex - 5);
  const endIndex = Math.min(totalItems, Math.ceil((scrollTop + viewportHeight) / ITEM_HEIGHT) + 5);

  const currentStart = parseInt(visibleContainer.dataset.startIndex || '-1', 10);
  const currentEnd = parseInt(visibleContainer.dataset.endIndex || '-1', 10);

  if (!force && currentStart === startIndex && currentEnd === endIndex) return;

  visibleContainer.dataset.startIndex = startIndex;
  visibleContainer.dataset.endIndex = endIndex;

  scrollerHeight.style.height = `${totalItems * ITEM_HEIGHT}px`;
  visibleContainer.style.top = `${startIndex * ITEM_HEIGHT}px`;
  visibleContainer.innerHTML = '';

  for (let idx = startIndex; idx < endIndex; idx++) {
    const card = state.currentDeck[idx];
    const srsInfo = getSRSInfo(card.id);
    const isCurrent = idx === state.currentIndex;

    let genderGlowClass = 'text-slate-400';
    if (card.gender === 'der') genderGlowClass = 'text-blue-400';
    else if (card.gender === 'die') genderGlowClass = 'text-pink-400';
    else if (card.gender === 'das') genderGlowClass = 'text-emerald-400';

    let cardStateText = '';
    let cardStateColor = '';
    if (srsInfo.state === 0) {
      cardStateText = 'New';
      cardStateColor = 'text-blue-500 bg-blue-500/10 border border-blue-500/20';
    } else if (srsInfo.state === 1 || srsInfo.state === 3) {
      cardStateText = 'Learning';
      cardStateColor = 'text-rose-500 bg-rose-500/10 border border-rose-500/20';
    } else {
      cardStateText = `S: ${srsInfo.stability.toFixed(1)}d`;
      cardStateColor = srsInfo.stability >= 15
        ? 'text-emerald-500 bg-emerald-500/10 border border-emerald-500/20'
        : 'text-indigo-400 bg-indigo-500/10 border border-indigo-500/20';
    }

    const itemBtn = document.createElement('button');
    itemBtn.className = `w-full h-[48px] flex-shrink-0 min-h-[48px] max-h-[48px] flex items-center justify-between text-left py-2 px-3 rounded-xl border transition-all duration-200 cursor-pointer ${
      isCurrent
        ? 'bg-slate-900/90 border-indigo-500/60 shadow-md shadow-slate-950/40 translate-x-0.5'
        : 'bg-slate-950/20 border-slate-900/60 hover:bg-slate-900/40 hover:border-slate-800/80'
    }`;

    itemBtn.innerHTML = `
      <div class="flex flex-col gap-0.5 max-w-[70%] overflow-hidden">
        <span class="text-xs font-black tracking-wide truncate ${genderGlowClass}">${card.word}</span>
        <span class="text-[10px] font-bold text-slate-500 truncate">${card.meaning}</span>
      </div>
      <div class="flex items-center gap-1.5 flex-shrink-0">
        <span class="text-[8px] px-1.5 py-0.5 rounded-md font-extrabold uppercase tracking-widest ${cardStateColor}">
          ${cardStateText}
        </span>
        ${srsInfo.isDue ? '<span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>' : ''}
      </div>
    `;

    itemBtn.addEventListener('click', () => {
      state.currentIndex = idx;
      renderCard();
      speakWord();
      // On mobile: close sidebar after jumping to a word
      const sidebar = document.getElementById('sidebar');
      const backdrop = document.getElementById('sidebar-backdrop');
      if (sidebar && window.innerWidth < 768) {
        sidebar.classList.add('-translate-x-full');
        if (backdrop) backdrop.classList.add('hidden');
      }
    });

    visibleContainer.appendChild(itemBtn);
  }
}

/** Update virtual scroll for the sidebar word list container */
export function updateCompanionVirtualScroll(force = false) {
  const container = document.getElementById('companion-word-list-items');
  if (!container) return;
  updateCompanionVirtualScrollForContainer(
    container,
    'companion-word-list-items-scroller-height',
    'companion-word-list-items-visible-items',
    force
  );
}

/** Render the word list into the sidebar Category Words panel */
export function renderCompanionWordList() {
  const container = document.getElementById('companion-word-list-items');
  if (!container || !state.currentDeck || state.currentDeck.length === 0) return;

  const ITEM_HEIGHT = 54;
  const totalItems = state.currentDeck.length;

  container.style.position = 'relative';

  const scrollerId = 'companion-word-list-items-scroller-height';
  const visibleId = 'companion-word-list-items-visible-items';

  let scrollerHeight = document.getElementById(scrollerId);
  let visibleContainer = document.getElementById(visibleId);

  if (!scrollerHeight || !visibleContainer) {
    container.innerHTML = `
      <div id="${scrollerId}" style="height: ${totalItems * ITEM_HEIGHT}px; width: 1px; pointer-events: none; visibility: hidden;"></div>
      <div id="${visibleId}" class="space-y-1.5 flex flex-col absolute left-0 right-0" style="top: 0px;"></div>
    `;
    scrollerHeight = document.getElementById(scrollerId);
    visibleContainer = document.getElementById(visibleId);
  } else {
    scrollerHeight.style.height = `${totalItems * ITEM_HEIGHT}px`;
  }

  if (!container.__companionScrollBound) {
    container.addEventListener('scroll', () => updateCompanionVirtualScrollForContainer(container, scrollerId, visibleId));
    container.__companionScrollBound = true;
  }

  const targetScrollTop = state.currentIndex * ITEM_HEIGHT - (container.clientHeight - ITEM_HEIGHT) / 2;
  container.scrollTop = Math.max(0, targetScrollTop);

  updateCompanionVirtualScrollForContainer(container, scrollerId, visibleId, true);
}

/** No-op stubs — Session Stats removed. Retained to avoid reference errors in legacy call sites. */
export function updateCompanionStats() {}
export function initCompanionTabs() {}
export function updateDesktopCompanionVisibility() {}
export function syncAdaptiveLayout() {}
