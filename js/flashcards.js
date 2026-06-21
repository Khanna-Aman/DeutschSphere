// js/flashcards.js — Leitner SRS Flashcards, Preferences & Phonetik-Spiegel Module

import { state, elements, categoryTranslations, getSRSInfo, getCategoryIcon, saveSRSState, shuffleArray, safeSetItem, schedulePersist } from './state.js';
import { prepareUtterance, speakWord, warmUpTTS, getSharedAudioContext } from './audio.js';
import { updateOverallStats, unlockAchievement } from './stats.js';
import { getSuffixRule, generateVerbConjugation, generateAdjectiveDeclension } from './nlp.js';

// Module-scoped amplitude smoothing for phonetic waveform (was window.nativeAmp)
let nativeAmp = 0;

// Cybernetic Phoneme Guides for difficult German sounds
const PHONEME_GUIDES = {
  'ö': {
    title: 'Umlaut Ö [ø:] / [œ]',
    lips: 'Stark gerundet und leicht nach vorne vorgestülpt (wie bei „O“).',
    tongue: 'Wie beim „E“ (hoch und weit vorne im Mund platziert).',
    instructions: 'Sprechen Sie ein langes „e“ (wie in „Weg“). Halten Sie die Zunge genau in dieser Position und runden Sie nun Ihre Lippen zu einem engen „O“. So entsteht das perfekte „Ö“!',
    svg: `<svg viewBox="0 0 100 100" class="w-24 h-24 drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]">
      <defs>
        <filter id="glow-pink-o" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="glow-cyan-o" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="glow-green-o" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <!-- Lips Outer (Pink) -->
      <ellipse cx="50" cy="50" rx="26" ry="32" fill="none" stroke="#f43f5e" stroke-width="3" filter="url(#glow-pink-o)" />
      <!-- Lips Inner (Cyan) -->
      <ellipse cx="50" cy="50" rx="16" ry="22" fill="#020617" stroke="#06b6d4" stroke-width="2.5" filter="url(#glow-cyan-o)" />
      <!-- Tongue Position (Green) -->
      <path d="M 38 56 Q 50 44 62 56" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" filter="url(#glow-green-o)" />
      <!-- Rounding indicators -->
      <path d="M 20 50 A 30 30 0 0 1 80 50" fill="none" stroke="#64748b" stroke-width="1" stroke-dasharray="3 3" />
      <path d="M 20 50 A 30 30 0 0 0 80 50" fill="none" stroke="#64748b" stroke-width="1" stroke-dasharray="3 3" />
    </svg>`
  },
  'ü': {
    title: 'Umlaut Ü [y:] / [ʏ]',
    lips: 'Sehr eng kreisrund gerundet und stark vorgestülpt (wie beim Pfeifen).',
    tongue: 'Wie beim „I“ (sehr hoch und ganz weit vorne an den Zähnen).',
    instructions: 'Sprechen Sie ein langes „i“ (wie in „Sieg“). Lassen Sie die Zunge unverändert in dieser extrem hohen Vorderposition und runden Sie die Lippen fest zu einem ganz engen, kleinen „U“!',
    svg: `<svg viewBox="0 0 100 100" class="w-24 h-24 drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]">
      <defs>
        <filter id="glow-pink-u" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="glow-cyan-u" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="glow-green-u" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <!-- Tight Lips Outer (Pink) -->
      <circle cx="50" cy="50" r="20" fill="none" stroke="#f43f5e" stroke-width="3.5" filter="url(#glow-pink-u)" />
      <!-- Tight Lips Inner (Cyan) -->
      <circle cx="50" cy="50" r="10" fill="#020617" stroke="#06b6d4" stroke-width="2.5" filter="url(#glow-cyan-u)" />
      <!-- High Tongue (Green) -->
      <path d="M 42 50 Q 50 40 58 50" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" filter="url(#glow-green-u)" />
      <!-- Protrusion arrows -->
      <path d="M 18 50 L 8 50 M 82 50 L 92 50 M 50 18 L 50 8 M 50 82 L 50 92" fill="none" stroke="#06b6d4" stroke-width="1.5" stroke-linecap="round" />
    </svg>`
  },
  'ä': {
    title: 'Umlaut Ä [ɛ:] / [ɛ]',
    lips: 'Weit geöffnet und leicht flach entspannt (breiter als bei „A“).',
    tongue: 'Flach liegend, die Zungenspitze berührt leicht die unteren Schneidezähne.',
    instructions: 'Öffnen Sie den Mund wie für ein normales „A“. Ziehen Sie nun Ihre Mundwinkel ganz leicht nach außen (ein breites Grinsen simulieren) und heben Sie die Zunge minimal an, um ein offenes „E“ zu formen.',
    svg: `<svg viewBox="0 0 100 100" class="w-24 h-24 drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]">
      <defs>
        <filter id="glow-pink-a" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="glow-cyan-a" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="glow-green-a" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <!-- Wide Lips Outer (Pink) -->
      <ellipse cx="50" cy="50" rx="36" ry="22" fill="none" stroke="#f43f5e" stroke-width="3" filter="url(#glow-pink-a)" />
      <!-- Wide Lips Inner (Cyan) -->
      <ellipse cx="50" cy="50" rx="28" ry="14" fill="#020617" stroke="#06b6d4" stroke-width="2.5" filter="url(#glow-cyan-a)" />
      <!-- Flat Tongue (Green) -->
      <path d="M 28 54 Q 50 50 72 54" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" filter="url(#glow-green-a)" />
      <!-- Vertical Stretch Indicator -->
      <path d="M 50 20 L 50 32 M 50 80 L 50 68" fill="none" stroke="#f43f5e" stroke-width="1.5" stroke-linecap="round" />
    </svg>`
  },
  'sch': {
    title: 'Sibilant SCH [ʃ]',
    lips: 'Leicht gerundet, nach vorne geschoben und leicht geöffnet.',
    tongue: 'Zungenseiten liegen am Gaumen an, Zungenmitte bildet eine breite Rinne.',
    instructions: 'Bringen Sie die Zähne nahe zusammen (ohne sie ganz zu schließen). Formen Sie mit den Lippen ein leichtes Viereck, schieben Sie sie nach vorne und blasen Sie die Luft kraftvoll durch die Mitte aus (Rauschen).',
    svg: `<svg viewBox="0 0 100 100" class="w-24 h-24 drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]">
      <defs>
        <filter id="glow-pink-s" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="glow-cyan-s" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <!-- Squared Lips (Pink) -->
      <rect x="22" y="26" width="56" height="48" rx="14" fill="none" stroke="#f43f5e" stroke-width="3" filter="url(#glow-pink-s)" />
      <!-- Inner Teeth (Cyan Lines) -->
      <path d="M 32 44 Q 50 44 68 44" fill="none" stroke="#38bdf8" stroke-width="3.5" stroke-dasharray="3 2" />
      <path d="M 32 54 Q 50 52 68 54" fill="none" stroke="#38bdf8" stroke-width="3.5" stroke-dasharray="3 2" />
      <!-- Airflow Waves (Violet) -->
      <path d="M 12 48 Q 18 40 24 48 T 36 48" fill="none" stroke="#8b5cf6" stroke-width="1.5" stroke-linecap="round" />
      <path d="M 64 48 Q 70 40 76 48 T 88 48" fill="none" stroke="#8b5cf6" stroke-width="1.5" stroke-linecap="round" />
    </svg>`
  },
  'ch': {
    title: 'Frikativ CH [ç] / [x]',
    lips: 'Leicht geöffnet (Mundwinkel entspannt bis breit auseinander).',
    tongue: 'Ich-Laut [ç]: Zungenmitte nähert sich dem harten Gaumen. Ach-Laut [x]: Zungenrücken nähert sich dem weichen Gaumen.',
    instructions: 'Für den „Ich-Laut“ (nach e/i/ä/ö/ü): Flüstern Sie ein langes „jaaaa“ und halten Sie den Reibelaut in der Mitte. Für den „Ach-Laut“ (nach a/o/u): Machen Sie ein leichtes Räuspern im Rachen (wie beim Atmen an eine kalte Scheibe).',
    svg: `<svg viewBox="0 0 100 100" class="w-24 h-24 drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]">
      <defs>
        <filter id="glow-green-c" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="glow-cyan-c" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <!-- Profile Roof of Mouth (Slate) -->
      <path d="M 15 25 Q 45 25 72 42 L 72 75" fill="none" stroke="#64748b" stroke-width="4.5" stroke-linecap="round" />
      <!-- Tongue Raising in Profile (Green) -->
      <path d="M 15 78 Q 42 70 54 54 Q 60 48 70 43" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" filter="url(#glow-green-c)" />
      <!-- Friction Dots Channel (Cyan) -->
      <path d="M 40 43 Q 48 40 56 42" fill="none" stroke="#06b6d4" stroke-width="2.5" stroke-dasharray="2 3" filter="url(#glow-cyan-c)" />
      <!-- Arrow indicating airflow -->
      <path d="M 28 35 L 42 35" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round" />
      <path d="M 38 31 L 42 35 L 38 39" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round" />
    </svg>`
  },
  'r': {
    title: 'Uvulares R [ʁ] / Vokalisches R [ɐ]',
    lips: 'Leicht geöffnet und entspannt.',
    tongue: 'Konsonantisches R: Das Zäpfchen (Uvula) hinten am Gaumensegel vibriert gegen den Zungenrücken.',
    instructions: 'Für das Reibe-R: Stellen Sie sich vor, Sie gurgeln sanft mit einem Schluck Wasser ganz hinten im Mund. Die Zunge bleibt unten, während die Luft hinten am Gaumensegel ein leicht vibrierendes, weiches Reibegeräusch erzeugt.',
    svg: `<svg viewBox="0 0 100 100" class="w-24 h-24 drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]">
      <defs>
        <filter id="glow-pink-r" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="glow-green-r" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <!-- Throat & Palate profile (Slate) -->
      <path d="M 20 25 Q 55 25 65 52 L 65 80" fill="none" stroke="#64748b" stroke-width="4" stroke-linecap="round" />
      <!-- Back of Tongue profile (Green) -->
      <path d="M 20 82 Q 45 78 52 64 Q 56 58 60 82" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" filter="url(#glow-green-r)" />
      <!-- Vibrating Uvula hanging (Pink) -->
      <path d="M 58 46 Q 55 52 58 56 Q 61 52 58 46" fill="#f43f5e" stroke="#f43f5e" stroke-width="1.5" filter="url(#glow-pink-r)" />
      <!-- Vibration ripples (Violet arcs) -->
      <path d="M 48 56 Q 52 60 56 61" fill="none" stroke="#8b5cf6" stroke-width="1.5" stroke-linecap="round" />
      <path d="M 45 61 Q 50 67 55 67" fill="none" stroke="#8b5cf6" stroke-width="1" stroke-linecap="round" />
    </svg>`
  }
};

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
}

// Render the active flashcard
export function renderCard() {
  const deckLength = state.currentDeck.length;

  // Update category title text
  const germanTitle = state.activeCategory === 'All' ? 'Alle Kategorien' : state.activeCategory;
  const englishTitle = categoryTranslations[state.activeCategory] || '';
  let titleText = englishTitle ? `${germanTitle} (${englishTitle})` : germanTitle;
  if (state.searchQuery) {
    titleText += ` (Gefiltert: "${state.searchQuery}")`;
  }
  if (elements.currentCategoryTitle) elements.currentCategoryTitle.textContent = titleText;

  // Update deck stats
  if (elements.deckStats) elements.deckStats.textContent = `${deckLength} Karte(n) geladen${state.isShuffled ? ' • Gemischt' : ''}`;

  // Check if deck is empty
  if (deckLength === 0) {
    if (elements.progressBarFill) elements.progressBarFill.style.width = `0%`;
    if (elements.deckProgressText) elements.deckProgressText.textContent = `Karte 0 von 0 (0%)`;
    if (elements.cardIndexIndicator) elements.cardIndexIndicator.textContent = `0 / 0`;
    if (elements.cardMetadataBadges) elements.cardMetadataBadges.innerHTML = '';
    if (elements.cardWord) elements.cardWord.innerHTML = `<span class="text-slate-500 font-sans text-xl font-normal">Keine passenden Karten gefunden.</span>`;
    
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
      elements.flashcard.className = "glass border border-slate-900 rounded-2xl p-8 md:p-12 min-h-[180px] md:min-h-[220px] flex flex-col justify-between cursor-not-allowed select-none relative card-glow-neutral";
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
    return;
  }

  // Enable navigation elements
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

  // Retrieve current card details
  const card = state.currentDeck[state.currentIndex];

  // Collapse grammar matrix drawer instantly when moving between cards
  collapseGrammarMatrixInstantly();

  // Update Progress values
  if (elements.cardIndexIndicator) elements.cardIndexIndicator.textContent = `${state.currentIndex + 1} / ${deckLength}`;
  const progressPercent = ((state.currentIndex + 1) / deckLength) * 100;
  if (elements.progressBarFill) elements.progressBarFill.style.width = `${progressPercent}%`;
  if (elements.deckProgressText) {
    elements.deckProgressText.textContent = `Karte ${state.currentIndex + 1} von ${deckLength} (${Math.round(progressPercent)}%)`;
  }

  // Render Metadata Badges (Word Class, Gender, Plural, Learned Status)
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
      boxBadgeHTML = `<span class="px-2 py-0.5 bg-rose-500/10 border border-rose-500/35 text-rose-400 text-[10px] font-bold rounded-md flex items-center gap-1" title="Falsch beantwortet • Sofortige Wiederholung"><i class="fa-solid fa-circle-notch animate-spin text-[8px]"></i> Box 1</span>`;
    } else {
      boxBadgeHTML = `<span class="px-2 py-0.5 bg-slate-900 border border-slate-800 text-slate-400 text-[10px] font-semibold rounded-md flex items-center gap-1" title="Unstudiert • Neu">Box 1 (Neu)</span>`;
    }
  } else if (srsInfo.box === 2) {
    boxBadgeHTML = `<span class="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/35 text-indigo-400 text-[10px] font-bold rounded-md flex items-center gap-1" title="Wiederholung alle 2 Tage">Box 2</span>`;
  } else if (srsInfo.box === 3) {
    boxBadgeHTML = `<span class="px-2 py-0.5 bg-violet-500/10 border border-violet-500/35 text-violet-400 text-[10px] font-bold rounded-md flex items-center gap-1" title="Wiederholung alle 5 Tage">Box 3</span>`;
  } else if (srsInfo.box === 4) {
    boxBadgeHTML = `<span class="px-2 py-0.5 bg-purple-500/10 border border-purple-500/35 text-purple-400 text-[10px] font-bold rounded-md flex items-center gap-1" title="Wiederholung alle 9 Tage">Box 4</span>`;
  } else if (srsInfo.box === 5) {
    boxBadgeHTML = `<span class="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/35 text-emerald-400 text-[10px] font-bold rounded-md flex items-center gap-1" title="Meisterhaft beherrscht • Wiederholung alle 15 Tage"><i class="fa-solid fa-crown text-[8px]"></i> Box 5 (Meister)</span>`;
  }
  
  if (boxBadgeHTML) {
    badgesHTML += boxBadgeHTML;
  }

  // Add Learned status badge and format learned button
  const hasLearned = state.learnedCards.has(Number(card.id));
  if (hasLearned) {
    badgesHTML += `<span class="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/35 text-emerald-400 text-[10px] font-bold rounded-md flex items-center gap-1"><i class="fa-solid fa-circle-check"></i> Gelernt</span>`;
    if (elements.learnedBtn) {
      elements.learnedBtn.className = "flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white w-12 h-12 rounded-xl transition-all shadow-lg shadow-emerald-600/20 active:scale-95";
    }
  } else {
    if (elements.learnedBtn) {
      elements.learnedBtn.className = "flex items-center justify-center bg-slate-900 border border-slate-800 hover:border-emerald-500 hover:bg-emerald-950/20 text-slate-400 hover:text-emerald-400 w-12 h-12 rounded-xl transition-all shadow-md active:scale-95";
    }
  }

  if (elements.cardMetadataBadges) elements.cardMetadataBadges.innerHTML = badgesHTML;

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
    elements.flashcard.className = `glass border rounded-2xl p-8 md:p-12 min-h-[180px] md:min-h-[220px] flex flex-col justify-between cursor-pointer transition-all duration-300 select-none relative group overflow-hidden ${glowClass}`;
  }

  // Ensure card image container is visible and loads Twemoji illustration if enabled
  if (state.showImages && card.image) {
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
      elements.cardImage.src = card.image;
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
    }
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

  // Suffix Grammar Rules integration
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

  // Set Pronunciation
  if (elements.cardPronunciation) {
    if (card.pronunciation) {
      elements.cardPronunciation.textContent = `/ ${card.pronunciation} /`;
      elements.cardPronunciation.classList.remove('hidden');
    } else {
      elements.cardPronunciation.classList.add('hidden');
    }
  }

  // Set Meaning text
  if (elements.cardMeaning) elements.cardMeaning.textContent = card.meaning;

  // Handle Example Sentences
  if (elements.cardExampleDe && elements.cardExampleEn && elements.cardExamplesContainer) {
    if (card.exampleDe) {
      elements.cardExampleDe.textContent = card.exampleDe;
      elements.cardExampleEn.textContent = card.exampleEn || '';
      elements.cardExamplesContainer.classList.remove('hidden');
    } else {
      elements.cardExamplesContainer.classList.add('hidden');
    }
  }

  // Handle Antonyms
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

  // Handle Dynamic Grammar Matrix Section (Verb Conjugation / Adjective Declension)
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

  // Handle Fast Read / Slow Read accordion visibility state
  if (state.isFastRead) {
    openAccordion();
  } else {
    closeAccordionInstantly();
  }

  // Pre-prepare utterance for immediate response on click
  prepareUtterance(card);

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
}

// Preferences: Toggle Fast Read (autoflip detail)
export function toggleReadMode() {
  state.isFastRead = !state.isFastRead;
  
  if (elements.readModeBtn && elements.readModeText) {
    if (state.isFastRead) {
      elements.readModeBtn.classList.add('bg-indigo-600', 'border-indigo-500', 'text-white', 'hover:bg-indigo-500', 'hover:text-white');
      elements.readModeBtn.classList.remove('bg-slate-950/40', 'border-slate-900/80', 'text-slate-400', 'hover:text-white', 'hover:border-slate-700');
      elements.readModeText.textContent = "Fast Read: EIN";
      openAccordion();
    } else {
      elements.readModeBtn.classList.remove('bg-indigo-600', 'border-indigo-500', 'text-white', 'hover:bg-indigo-500', 'hover:text-white');
      elements.readModeBtn.classList.add('bg-slate-950/40', 'border-slate-900/80', 'text-slate-400', 'hover:text-white', 'hover:border-slate-700');
      elements.readModeText.textContent = "Fast Read: AUS";
      closeAccordion();
    }
  }
}

// Preferences: Hide Learned Cards from current loop
export function toggleHideLearned() {
  state.hideLearned = !state.hideLearned;
  
  if (elements.hideLearnedBtn && elements.hideLearnedText) {
    if (state.hideLearned) {
      elements.hideLearnedBtn.classList.add('bg-indigo-950/40', '!border-indigo-500/30');
      elements.hideLearnedBtn.setAttribute('data-active', 'true');
      elements.hideLearnedText.textContent = "Gelernte anzeigen";
    } else {
      elements.hideLearnedBtn.classList.remove('bg-indigo-950/40', '!border-indigo-500/30');
      elements.hideLearnedBtn.removeAttribute('data-active');
      elements.hideLearnedText.textContent = "Gelernte ausblenden";
    }
  }
  
  // V3: Emit CustomEvent for deck re-filter (replaces window.filterDeckExternal bridge)
  window.dispatchEvent(new CustomEvent('deck:filter-request', { detail: { resetIndex: false } }));
}

// Preferences: Autoplay speech on card change
export function toggleAutoplay() {
  state.isAutoPlaySpeech = !state.isAutoPlaySpeech;
  
  if (elements.autoplayBtn && elements.autoplayText) {
    if (state.isAutoPlaySpeech) {
      elements.autoplayBtn.classList.add('bg-indigo-600', 'border-indigo-500', 'text-white', 'hover:bg-indigo-500', 'hover:text-white');
      elements.autoplayBtn.classList.remove('bg-slate-950/40', 'border-slate-900/80', 'text-slate-400', 'hover:text-white', 'hover:border-slate-700');
      elements.autoplayText.textContent = "Auto-Sprachausgabe: EIN";
      warmUpTTS();
    } else {
      elements.autoplayBtn.classList.remove('bg-indigo-600', 'border-indigo-500', 'text-white', 'hover:bg-indigo-500', 'hover:text-white');
      elements.autoplayBtn.classList.add('bg-slate-950/40', 'border-slate-900/80', 'text-slate-400', 'hover:text-white', 'hover:border-slate-700');
      elements.autoplayText.textContent = "Auto-Sprachausgabe: AUS";
    }
  }
}

// Preferences: Toggle illustrations
export function toggleImages() {
  state.showImages = !state.showImages;
  safeSetItem('show_images', String(state.showImages));
  updateImagesToggleUI();
  renderCard();
}

export function updateImagesToggleUI() {
  if (elements.toggleImagesBtn && elements.toggleImagesText) {
    if (state.showImages) {
      elements.toggleImagesBtn.classList.add('bg-indigo-600', 'border-indigo-500', 'text-white', 'hover:bg-indigo-500', 'hover:text-white');
      elements.toggleImagesBtn.classList.remove('bg-slate-950/40', 'border-slate-900/80', 'text-slate-400', 'hover:text-white', 'hover:border-slate-700');
      elements.toggleImagesText.textContent = "Bilder anzeigen: EIN";
    } else {
      elements.toggleImagesBtn.classList.remove('bg-indigo-600', 'border-indigo-500', 'text-white', 'hover:bg-indigo-500', 'hover:text-white');
      elements.toggleImagesBtn.classList.add('bg-slate-950/40', 'border-slate-900/80', 'text-slate-400', 'hover:text-white', 'hover:border-slate-700');
      elements.toggleImagesText.textContent = "Bilder anzeigen: AUS";
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
      elements.phoneticStatusMsg.textContent = "⚠️ Spracherkennung erfordert HTTPS. Bitte öffnen Sie die App über einen lokalen Server (python -m http.server) oder GitHub Pages.";
    }
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (elements.phoneticStatusMsg) {
      elements.phoneticStatusMsg.textContent = "Fehler: Spracherkennung in Ihrem Browser nicht unterstützt (empfohlen: Google Chrome / Edge).";
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
        elements.learnerSpecStatus.textContent = "Zuhören...";
        elements.learnerSpecStatus.className = "text-pink-400 animate-pulse font-bold";
      }
      if (elements.phoneticStatusMsg) {
        elements.phoneticStatusMsg.textContent = "Ich höre zu... Bitte sprechen Sie das Wort deutlich aus.";
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
            elements.phoneticStatusMsg.textContent = "Keine Sprache erkannt. Bitte versuchen Sie es noch einmal.";
          }
        } else {
          if (elements.phoneticStatusMsg) {
            elements.phoneticStatusMsg.textContent = `Erkennungsfehler: ${event.error}. Bitte erneut versuchen.`;
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
        elements.phoneticStatusMsg.textContent = "Mikrofon-Zugriff verweigert. Bitte erlauben Sie den Mikrofon-Zugriff in den Einstellungen.";
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
              <h5 class="text-[10px] font-extrabold uppercase tracking-widest text-rose-400">Phonetische Hilfestellung | Mouth Positioning Guide</h5>
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
                    <span class="px-1.5 py-0.5 bg-pink-500/10 border border-pink-500/25 text-pink-400 text-[8px] font-black uppercase tracking-wider rounded">Mundstellung</span>
                  </div>
                  <p class="text-[10px] text-slate-300 leading-normal font-medium"><strong class="text-slate-400 font-extrabold uppercase text-[8px] tracking-wider block">Lippen | Lips:</strong> ${guide.lips}</p>
                  <p class="text-[10px] text-slate-300 leading-normal font-medium"><strong class="text-slate-400 font-extrabold uppercase text-[8px] tracking-wider block">Zunge | Tongue:</strong> ${guide.tongue}</p>
                  <p class="text-[10px] text-slate-400 leading-normal italic font-medium pt-0.5"><strong class="text-slate-400 font-extrabold uppercase text-[8px] tracking-widest block not-italic">Anleitung:</strong> ${guide.instructions}</p>
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
    feedbackMessage = `Perfekt! Sie haben das Wort fehlerfrei ausgesprochen. ("${spokenText}")`;
  } else if (score >= 90) {
    feedbackMessage = `Ausgezeichnete Aussprache! Kleine Abweichung vorhanden, aber vollkommen verständlich. ("${spokenText}")`;
  } else if (score >= 75) {
    feedbackMessage = `Sehr gutes Ergebnis! Achten Sie auf die rot durchgestrichenen Buchstaben, um die Aussprache zu optimieren. ("${spokenText}")`;
  } else if (score >= 50) {
    feedbackMessage = `Guter Versuch! Hören Sie sich die Vorlage (Modell-Button) an und trainieren Sie besonders die Konsonanten und Umlaute. ("${spokenText}")`;
  } else if (spokenText.length > 0) {
    feedbackMessage = `Erkannter Text weicht stark ab ("${spokenText}"). Bitte vergleichen Sie Ihre Betonung mit dem Audio-Sprecher.`;
  } else {
    feedbackMessage = "Das Wort konnte leider nicht eindeutig analysiert werden. Sprechen Sie lauter, näher am Mikrofon oder etwas langsamer.";
  }

  if (elements.phoneticFeedbackMsg) {
    elements.phoneticFeedbackMsg.textContent = feedbackMessage;
  }

  if (elements.phoneticEvaluationPanel) {
    elements.phoneticEvaluationPanel.classList.remove('hidden');
  }

  if (elements.phoneticStatusMsg) {
    elements.phoneticStatusMsg.textContent = `Auswertung abgeschlossen: ${score}% Übereinstimmung.`;
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
