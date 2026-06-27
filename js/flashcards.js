// js/flashcards.js — Leitner SRS Flashcards, Preferences & Phonetik-Spiegel Module

import { state, elements, categoryTranslations, getSRSInfo, getCategoryIcon, saveSRSState, shuffleArray, safeSetItem, schedulePersist, getStreakInfo } from './state.js';
import { prepareUtterance, speakWord, warmUpTTS, getSharedAudioContext } from './audio.js';
import { updateOverallStats, unlockAchievement } from './stats.js';
import { getSuffixRule, generateVerbConjugation, generateAdjectiveDeclension } from './nlp.js';

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
    // F4: Let CSS .open class handle max-height (2000px) — no scrollHeight read needed
    elements.accordionReveal.classList.add('open');
  }
  if (elements.toggleRevealIcon) {
    elements.toggleRevealIcon.className = "fa-solid fa-chevron-up text-xs";
  }
  if (elements.toggleRevealText) {
    elements.toggleRevealText.textContent = "Details verbergen";
  }
  updateDesktopCompanionVisibility();
}

// Collapse the detail accordion with animation
export function closeAccordion() {
  state.isAccordionOpen = false;
  if (elements.accordionReveal) {
    // F4: Remove class to collapse — CSS handles the transition
    elements.accordionReveal.classList.remove('open');
  }
  if (elements.toggleRevealIcon) {
    elements.toggleRevealIcon.className = "fa-solid fa-chevron-down text-xs";
  }
  if (elements.toggleRevealText) {
    elements.toggleRevealText.textContent = "Details anzeigen";
  }
  updateDesktopCompanionVisibility();
}

// Collapse the detail accordion instantly without animation
// V3: Uses CSS Grid accordion — no forced reflow (void offsetHeight) needed.
// Temporarily removes transition, closes, then restores on next frame.
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
    elements.toggleRevealText.textContent = "Details anzeigen";
  }
  updateDesktopCompanionVisibility();
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

  // Add Leitner Spaced Repetition (SRS) Box badge
  const srsInfo = getSRSInfo(card.id);
  let boxBadgeHTML = '';
  if (srsInfo.box === 1) {
    if (srsInfo.lastReviewed > 0) {
      boxBadgeHTML = `<span class="px-2 py-0.5 bg-rose-500/10 border border-rose-500/35 text-rose-400 text-[10px] font-bold rounded-md flex items-center gap-1" title="Incorrectly answered • Review immediately"><i class="fa-solid fa-circle-notch animate-spin text-[8px]"></i> Box 1</span>`;
    } else {
      boxBadgeHTML = `<span class="px-2 py-0.5 bg-slate-900 border border-slate-800 text-slate-400 text-[10px] font-semibold rounded-md flex items-center gap-1" title="Unstudied • New">Box 1 (New)</span>`;
    }
  } else if (srsInfo.box === 2) {
    boxBadgeHTML = `<span class="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/35 text-indigo-400 text-[10px] font-bold rounded-md flex items-center gap-1" title="Review every 2 days">Box 2</span>`;
  } else if (srsInfo.box === 3) {
    boxBadgeHTML = `<span class="px-2 py-0.5 bg-violet-500/10 border border-violet-500/35 text-violet-400 text-[10px] font-bold rounded-md flex items-center gap-1" title="Review every 5 days">Box 3</span>`;
  } else if (srsInfo.box === 4) {
    boxBadgeHTML = `<span class="px-2 py-0.5 bg-purple-500/10 border border-purple-500/35 text-purple-400 text-[10px] font-bold rounded-md flex items-center gap-1" title="Review every 9 days">Box 4</span>`;
  } else if (srsInfo.box === 5) {
    boxBadgeHTML = `<span class="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/35 text-emerald-400 text-[10px] font-bold rounded-md flex items-center gap-1" title="Mastered • Review every 15 days"><i class="fa-solid fa-crown text-[8px]"></i> Box 5 (Master)</span>`;
  }
  
  if (boxBadgeHTML) {
    badgesHTML += boxBadgeHTML;
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
  if (state.showImages && isImageAllowed) {
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
      elements.cardImage.classList.add('hidden');
      elements.cardImage.classList.add('opacity-0');
      elements.cardImage.src = state.currentLevel + '/' + activeImage;
      
      // Dynamic ALT text for screen reader compliance (WCAG 2.1 SC 1.1.1)
      const formattedGender = (card.wordClass === 'Noun' && card.gender) ? `${card.gender} ` : '';
      elements.cardImage.alt = `${formattedGender}${card.word} — ${card.meaning}`;
      
      elements.cardImage.onload = () => {
        elements.cardImage.classList.remove('hidden');
        elements.cardImage.classList.remove('opacity-0');
      };
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
    if (card.exampleDe) {
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
 */
function renderGrammarMatrix(card) {
  if (elements.cardGrammarMatrixContainer && elements.grammarMatrixTableContainer) {
    const wc = (card.wordClass || '').toLowerCase().trim();
    if (wc === 'verb' || wc === 'adjektiv' || wc === 'adjective') {
      elements.cardGrammarMatrixContainer.classList.remove('hidden');
      
      if (wc === 'verb') {
        if (elements.grammarMatrixTitle) {
          elements.grammarMatrixTitle.textContent = 'Verbkonjugation | Verb Conjugation';
        }
        
        const conj = generateVerbConjugation(card.word);
        elements.grammarMatrixTableContainer.innerHTML = `
          <div class="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-200 min-w-[280px]">
            <div class="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 shadow-inner">
              <span class="text-[10px] uppercase text-indigo-400 font-extrabold block mb-2 tracking-wider">Singular</span>
              <div class="space-y-2">
                <div class="flex justify-between border-b border-slate-800/40 pb-1.5"><span class="text-slate-400 font-normal">ich</span> <span class="text-indigo-200 notranslate">${conj.ich}</span></div>
                <div class="flex justify-between border-b border-slate-800/40 pb-1.5"><span class="text-slate-400 font-normal">du</span> <span class="text-indigo-200 notranslate">${conj.du}</span></div>
                <div class="flex justify-between pb-0.5"><span class="text-slate-400 font-normal">er/sie/es</span> <span class="text-indigo-200 notranslate">${conj.er}</span></div>
              </div>
            </div>
            <div class="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 shadow-inner">
              <span class="text-[10px] uppercase text-indigo-400 font-extrabold block mb-2 tracking-wider">Plural</span>
              <div class="space-y-2">
                <div class="flex justify-between border-b border-slate-800/40 pb-1.5"><span class="text-slate-400 font-normal">wir</span> <span class="text-indigo-200 notranslate">${conj.wir}</span></div>
                <div class="flex justify-between border-b border-slate-800/40 pb-1.5"><span class="text-slate-400 font-normal">ihr</span> <span class="text-indigo-200 notranslate">${conj.ihr}</span></div>
                <div class="flex justify-between pb-0.5"><span class="text-slate-400 font-normal">sie/Sie</span> <span class="text-indigo-200 notranslate">${conj.sie}</span></div>
              </div>
            </div>
          </div>
        `;
      } else {
        // Adjective declension
        if (elements.grammarMatrixTitle) {
          elements.grammarMatrixTitle.textContent = 'Adjektivdeklination | Adjective Declension';
        }
        
        const decl = generateAdjectiveDeclension(card.word);
        let html = `
          <div class="flex gap-1.5 mb-4 p-1 bg-slate-950/65 border border-slate-800/85 rounded-lg w-full max-w-md mx-auto">
            <button class="adj-matrix-tab-btn flex-1 py-1.5 px-2.5 rounded-md text-[10px] font-extrabold transition-all text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 uppercase tracking-wider" data-tab="definite">Bestimmt</button>
            <button class="adj-matrix-tab-btn flex-1 py-1.5 px-2.5 rounded-md text-[10px] font-extrabold transition-all text-slate-400 hover:text-slate-200 border border-transparent uppercase tracking-wider" data-tab="indefinite">Unbestimmt</button>
            <button class="adj-matrix-tab-btn flex-1 py-1.5 px-2.5 rounded-md text-[10px] font-extrabold transition-all text-slate-400 hover:text-slate-200 border border-transparent uppercase tracking-wider" data-tab="zero">Ohne Artikel</button>
          </div>
        `;
        
        const types = ['definite', 'indefinite', 'zero'];
        types.forEach(type => {
          const scheme = decl[type];
          const isHidden = type !== 'definite' ? 'hidden' : '';
          html += `
            <div id="adj-matrix-table-${type}" class="adj-matrix-table ${isHidden} overflow-x-auto min-w-[340px]">
              <table class="w-full text-xs font-semibold text-slate-200 border-collapse">
                <thead>
                  <tr class="border-b border-slate-800/80">
                    <th class="py-2 text-left text-indigo-400 uppercase font-extrabold text-[10px] tracking-wider w-1/5">Kasus</th>
                    <th class="py-2 text-left text-slate-400 font-bold text-[10px] w-1/5">Maskulin (m)</th>
                    <th class="py-2 text-left text-slate-400 font-bold text-[10px] w-1/5">Feminin (f)</th>
                    <th class="py-2 text-left text-slate-400 font-bold text-[10px] w-1/5">Neutral (n)</th>
                    <th class="py-2 text-left text-slate-400 font-bold text-[10px] w-1/5">Plural (p)</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/40">
                  <tr class="hover:bg-indigo-500/5">
                    <td class="py-2.5 text-slate-400 font-bold uppercase text-[9px] tracking-wider">Nominativ</td>
                    <td class="py-2.5 text-indigo-200 notranslate">${scheme.nom.m}</td>
                    <td class="py-2.5 text-indigo-200 notranslate">${scheme.nom.f}</td>
                    <td class="py-2.5 text-indigo-200 notranslate">${scheme.nom.n}</td>
                    <td class="py-2.5 text-indigo-200 notranslate">${scheme.nom.p}</td>
                  </tr>
                  <tr class="hover:bg-indigo-500/5">
                    <td class="py-2.5 text-slate-400 font-bold uppercase text-[9px] tracking-wider">Akkusativ</td>
                    <td class="py-2.5 text-indigo-200 notranslate">${scheme.akk.m}</td>
                    <td class="py-2.5 text-indigo-200 notranslate">${scheme.akk.f}</td>
                    <td class="py-2.5 text-indigo-200 notranslate">${scheme.akk.n}</td>
                    <td class="py-2.5 text-indigo-200 notranslate">${scheme.akk.p}</td>
                  </tr>
                  <tr class="hover:bg-indigo-500/5">
                    <td class="py-2.5 text-slate-400 font-bold uppercase text-[9px] tracking-wider">Dativ</td>
                    <td class="py-2.5 text-indigo-200 notranslate">${scheme.dat.m}</td>
                    <td class="py-2.5 text-indigo-200 notranslate">${scheme.dat.f}</td>
                    <td class="py-2.5 text-indigo-200 notranslate">${scheme.dat.n}</td>
                    <td class="py-2.5 text-indigo-200 notranslate">${scheme.dat.p}</td>
                  </tr>
                  <tr class="hover:bg-indigo-500/5">
                    <td class="py-2.5 text-slate-400 font-bold uppercase text-[9px] tracking-wider">Genitiv</td>
                    <td class="py-2.5 text-indigo-200 notranslate">${scheme.gen.m}</td>
                    <td class="py-2.5 text-indigo-200 notranslate">${scheme.gen.f}</td>
                    <td class="py-2.5 text-indigo-200 notranslate">${scheme.gen.n}</td>
                    <td class="py-2.5 text-indigo-200 notranslate">${scheme.gen.p}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          `;
        });
        
        elements.grammarMatrixTableContainer.innerHTML = html;
        
        // Setup internal tab event listeners
        const tabBtns = elements.grammarMatrixTableContainer.querySelectorAll('.adj-matrix-tab-btn');
        tabBtns.forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card accordion flip/collapse
            const targetTab = btn.getAttribute('data-tab');
            
            // Toggle active states on buttons
            tabBtns.forEach(b => {
              if (b.getAttribute('data-tab') === targetTab) {
                b.classList.remove('text-slate-400', 'border-transparent');
                b.classList.add('text-indigo-400', 'bg-indigo-500/10', 'border-indigo-500/20');
              } else {
                b.classList.remove('text-indigo-400', 'bg-indigo-500/10', 'border-indigo-500/20');
                b.classList.add('text-slate-400', 'border-transparent');
              }
            });
            
            // Toggle active states on tables
            const tables = elements.grammarMatrixTableContainer.querySelectorAll('.adj-matrix-table');
            tables.forEach(t => {
              if (t.id === `adj-matrix-table-${targetTab}`) {
                t.classList.remove('hidden');
              } else {
                t.classList.add('hidden');
              }
            });
          });
        });
      }
    } else {
      elements.cardGrammarMatrixContainer.classList.add('hidden');
    }
  }
}

/**
 * Orchestrator: Main render function for the flashcard interface.
 * Delegates individual sections to optimized private sub-renderers.
 */
export function renderCard() {
  const deckLength = state.currentDeck.length;

  // Update category title text
  const germanTitle = state.activeCategory === 'All' ? 'All Categories' : state.activeCategory;
  const englishTitle = categoryTranslations[state.activeCategory] || '';
  let titleText = englishTitle ? `${englishTitle} (${germanTitle})` : germanTitle;
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

  // Autoplay or Continuous trainer handling
  if (state.trainer && state.trainer.active) {
    // If active and trainer is waiting, do nothing
  } else if (state.isAutoPlaySpeech && document.activeElement !== elements.searchInput) {
    // Speak the word after a short delay for smooth transition
    setTimeout(() => {
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
  if (state.deck && state.deck[state.currentIndex]) {
    renderCard(state.deck[state.currentIndex]);
  }
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
    updateDesktopCompanionVisibility();
    
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
      elements.phoneticStatusMsg.textContent = "Bereit. Klicken Sie auf das Mikrofon, um Ihre Aufnahme zu starten.";
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
  updateDesktopCompanionVisibility();
  
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
    elements.learnerSpecStatus.textContent = "Inaktiv";
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
  if (elements.cardGrammarMatrixDrawer) {
    elements.cardGrammarMatrixDrawer.style.transition = 'none';
    elements.cardGrammarMatrixDrawer.style.gridTemplateRows = '0fr';
    elements.cardGrammarMatrixDrawer.classList.add('opacity-0', 'pointer-events-none');
    elements.cardGrammarMatrixDrawer.classList.remove('opacity-100');
    if (elements.grammarMatrixIcon) {
      elements.grammarMatrixIcon.classList.remove('rotate-180');
    }
    // Restore transition on next animation frame
    requestAnimationFrame(() => {
      if (elements.cardGrammarMatrixDrawer) {
        elements.cardGrammarMatrixDrawer.style.transition = '';
      }
    });
  }
}

export function toggleGrammarMatrix() {
  if (!elements.cardGrammarMatrixDrawer) return;
  const isOpen = elements.cardGrammarMatrixDrawer.style.gridTemplateRows === '1fr';
  
  if (isOpen) {
    elements.cardGrammarMatrixDrawer.style.gridTemplateRows = '0fr';
    elements.cardGrammarMatrixDrawer.classList.add('opacity-0', 'pointer-events-none');
    elements.cardGrammarMatrixDrawer.classList.remove('opacity-100');
    if (elements.grammarMatrixIcon) {
      elements.grammarMatrixIcon.classList.remove('rotate-180');
    }
  } else {
    elements.cardGrammarMatrixDrawer.style.gridTemplateRows = '1fr';
    elements.cardGrammarMatrixDrawer.classList.remove('opacity-0', 'pointer-events-none');
    elements.cardGrammarMatrixDrawer.classList.add('opacity-100');
    if (elements.grammarMatrixIcon) {
      elements.grammarMatrixIcon.classList.add('rotate-180');
    }
  }
}

// ==========================================================
// DECK COMPANION DASHBOARD CONTROLLER (DESKTOP OPTIMIZATION)
// ==========================================================

export function initCompanionTabs() {
  const tabWordlist = document.getElementById('companion-tab-wordlist');
  const tabStats = document.getElementById('companion-tab-stats');
  const panelWordlist = document.getElementById('companion-panel-wordlist');
  const panelStats = document.getElementById('companion-panel-stats');

  if (!tabWordlist || !tabStats || !panelWordlist || !panelStats) return;

  const selectTab = (activeTab, inactiveTab, activePanel, inactivePanel) => {
    activeTab.setAttribute('aria-selected', 'true');
    activeTab.classList.add('border-indigo-500', 'text-indigo-400');
    activeTab.classList.remove('border-transparent', 'text-slate-400');

    inactiveTab.setAttribute('aria-selected', 'false');
    inactiveTab.classList.remove('border-indigo-500', 'text-indigo-400');
    inactiveTab.classList.add('border-transparent', 'text-slate-400');

    activePanel.classList.remove('hidden');
    inactivePanel.classList.add('hidden');
  };

  tabWordlist.addEventListener('click', () => {
    selectTab(tabWordlist, tabStats, panelWordlist, panelStats);
  });

  tabStats.addEventListener('click', () => {
    selectTab(tabStats, tabWordlist, panelStats, panelWordlist);
    updateCompanionStats(); // Dynamic update when switched
  });
}

let companionScrollListenerAdded = false;

export function updateCompanionVirtualScroll(force = false) {
  const container = document.getElementById('companion-word-list-items');
  const topSpacer = document.getElementById('companion-list-top-spacer');
  const visibleContainer = document.getElementById('companion-list-visible-items');
  const bottomSpacer = document.getElementById('companion-list-bottom-spacer');

  if (!container || !topSpacer || !visibleContainer || !bottomSpacer || !state.currentDeck || state.currentDeck.length === 0) return;

  const ITEM_HEIGHT = 54;
  const scrollTop = container.scrollTop;
  const viewportHeight = container.clientHeight || 220;

  // Calculate visible range
  const totalItems = state.currentDeck.length;
  const rawStartIndex = Math.floor(scrollTop / ITEM_HEIGHT);
  const startIndex = Math.max(0, rawStartIndex - 5);
  const endIndex = Math.min(totalItems, Math.ceil((scrollTop + viewportHeight) / ITEM_HEIGHT) + 5);

  // Check if we actually need to re-render (optimization to avoid unnecessary DOM thrashing on small scroll adjustments)
  const currentStart = parseInt(visibleContainer.dataset.startIndex || '-1', 10);
  const currentEnd = parseInt(visibleContainer.dataset.endIndex || '-1', 10);

  if (!force && currentStart === startIndex && currentEnd === endIndex) {
    return;
  }

  visibleContainer.dataset.startIndex = startIndex;
  visibleContainer.dataset.endIndex = endIndex;

  // Update spacers
  topSpacer.style.height = `${startIndex * ITEM_HEIGHT}px`;
  bottomSpacer.style.height = `${(totalItems - endIndex) * ITEM_HEIGHT}px`;

  // Render visible segment
  visibleContainer.innerHTML = '';

  for (let idx = startIndex; idx < endIndex; idx++) {
    const card = state.currentDeck[idx];
    const srsInfo = getSRSInfo(card.id);
    const isCurrent = idx === state.currentIndex;

    // Determine deterministic visual states based on category, gender or state
    let genderGlowClass = 'text-slate-400';
    if (card.gender === 'der') genderGlowClass = 'text-blue-400';
    else if (card.gender === 'die') genderGlowClass = 'text-pink-400';
    else if (card.gender === 'das') genderGlowClass = 'text-emerald-400';

    const cardStateText = srsInfo.isNew ? 'New' : `Box ${srsInfo.box}`;
    const cardStateColor = srsInfo.isNew ? 'text-blue-500/85 bg-blue-500/5' : 'text-indigo-400 bg-indigo-500/5';

    const itemBtn = document.createElement('button');
    // Enforce strict fixed height of 48px to align perfectly with our 54px offset (48px item + 6px space-y-1.5)
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

    // Click handler to instantly jump to the card
    itemBtn.addEventListener('click', () => {
      state.currentIndex = idx;
      renderCard();
      speakWord();
    });

    visibleContainer.appendChild(itemBtn);
  }
}

export function renderCompanionWordList() {
  const container = document.getElementById('companion-word-list-items');
  if (!container || !state.currentDeck || state.currentDeck.length === 0) return;

  // Initialize structural components
  let topSpacer = document.getElementById('companion-list-top-spacer');
  let visibleContainer = document.getElementById('companion-list-visible-items');
  let bottomSpacer = document.getElementById('companion-list-bottom-spacer');

  if (!topSpacer || !visibleContainer || !bottomSpacer) {
    container.innerHTML = `
      <div id="companion-list-top-spacer" style="height: 0px; flex-shrink: 0;"></div>
      <div id="companion-list-visible-items" class="space-y-1.5 flex flex-col flex-shrink-0"></div>
      <div id="companion-list-bottom-spacer" style="height: 0px; flex-shrink: 0;"></div>
    `;
    topSpacer = document.getElementById('companion-list-top-spacer');
    visibleContainer = document.getElementById('companion-list-visible-items');
    bottomSpacer = document.getElementById('companion-list-bottom-spacer');
  }

  // Register scroll event listener (only once)
  if (!companionScrollListenerAdded) {
    container.addEventListener('scroll', () => {
      updateCompanionVirtualScroll();
    });
    companionScrollListenerAdded = true;
  }

  // Calculate and trigger initial scroll position to the current active card
  const ITEM_HEIGHT = 54;
  const targetScrollTop = state.currentIndex * ITEM_HEIGHT - (container.clientHeight - ITEM_HEIGHT) / 2;
  container.scrollTop = Math.max(0, targetScrollTop);

  // Perform immediate synchronous render of the visible range
  updateCompanionVirtualScroll(true);
}

export function updateCompanionStats() {
  const masteredEl = document.getElementById('companion-stat-mastered');
  const dueEl = document.getElementById('companion-stat-due');
  const reviewedEl = document.getElementById('companion-stat-reviewed');
  const streakEl = document.getElementById('companion-stat-streak');
  const retentionRateEl = document.getElementById('companion-retention-rate');
  const retentionBarEl = document.getElementById('companion-retention-bar');

  if (!state.currentDeck || state.currentDeck.length === 0) return;

  // Calculate mastery (cards in Box 4 or 5) and due counts for the current filtered deck
  let masteredCount = 0;
  let dueCount = 0;
  let totalFSRSRetrievability = 0;
  let fsrsRatedCount = 0;

  state.currentDeck.forEach(card => {
    const srsInfo = getSRSInfo(card.id);
    if (srsInfo.box >= 4) masteredCount++;
    if (srsInfo.isDue) dueCount++;

    // Calculate retrievability for retrievability retention rate
    if (srsInfo.retrievability !== undefined && srsInfo.state !== 0) { // FSRSState.New is 0
      totalFSRSRetrievability += srsInfo.retrievability;
      fsrsRatedCount++;
    }
  });

  const masteryPercent = Math.round((masteredCount / state.currentDeck.length) * 100);

  // Update elements if they exist
  if (masteredEl) masteredEl.textContent = `${masteryPercent}%`;
  if (dueEl) dueEl.textContent = dueCount;
  if (reviewedEl) reviewedEl.textContent = state.session ? state.session.cardsReviewed : 0;

  // Get current streak
  const streakInfo = getStreakInfo();
  if (streakEl) streakEl.textContent = streakInfo.current;

  // Average Retrievability (Retention Rate)
  const averageRetention = fsrsRatedCount > 0 ? totalFSRSRetrievability / fsrsRatedCount : 0.95; // default starting expectation is 95%
  const formattedRetention = Math.round(averageRetention * 100);

  if (retentionRateEl) retentionRateEl.textContent = `${formattedRetention}%`;
  if (retentionBarEl) {
    retentionBarEl.style.width = `${formattedRetention}%`;
    // Color coding based on retention
    retentionBarEl.className = 'h-full transition-all duration-300 ';
    if (formattedRetention >= 90) {
      retentionBarEl.classList.add('bg-emerald-500');
    } else if (formattedRetention >= 80) {
      retentionBarEl.classList.add('bg-amber-500');
    } else {
      retentionBarEl.classList.add('bg-rose-500');
    }
  }
}

export function syncAdaptiveLayout() {
  const container = elements.workspaceContainer;
  const grid = elements.workspaceGrid;
  if (!container || !grid) return;

  const isSplitActive = state.isAccordionOpen || (state.phonetic && state.phonetic.isOpen);

  if (isSplitActive) {
    container.classList.add('workspace-split-active');
    grid.classList.add('workspace-split-active');
  } else {
    container.classList.remove('workspace-split-active');
    grid.classList.remove('workspace-split-active');
  }
}

export function updateDesktopCompanionVisibility() {
  const companion = document.getElementById('companion-dashboard');
  if (!companion) return;

  // Sync the dynamic adaptive split-screen layout state
  syncAdaptiveLayout();

  // If accordion details are open OR phonetic mirror is open, hide companion on desktop. Otherwise, show it.
  const detailsOpen = state.isAccordionOpen;
  const phoneticOpen = state.phonetic && state.phonetic.isOpen;

  if (detailsOpen || phoneticOpen) {
    companion.classList.add('lg:hidden');
    companion.classList.remove('lg:block');
  } else {
    companion.classList.remove('lg:hidden');
    companion.classList.add('lg:block');
  }
}
