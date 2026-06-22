// js/immersion.js — Immersions-Labor (NLP Engine) UI Logic

import { state, elements, escapeHtml, getGlobalLearnedCount } from './state.js';
import { analyzeText, getSuffixRule } from './nlp.js';
import { speakText } from './audio.js';

let immersionResults = [];

export function initImmersionView() {
  if (!elements.immersionTextarea) return;
  
  // Attach text analyze listener if not already attached
  if (!elements.immersionAnalyzeBtn.hasAttribute('data-initialized')) {
    elements.immersionAnalyzeBtn.addEventListener('click', handleAnalyze);
    elements.immersionAnalyzeBtn.setAttribute('data-initialized', 'true');
  }
  
  // Event Delegation for clicking on parsed word pills/cards to open Word Explorer Overlay
  if (elements.immersionResultsGrid && !elements.immersionResultsGrid.hasAttribute('data-delegated')) {
    elements.immersionResultsGrid.addEventListener('click', (e) => {
      const cardEl = e.target.closest('.immersion-card');
      if (!cardEl) return;
      
      const idx = parseInt(cardEl.getAttribute('data-index'), 10);
      const item = immersionResults[idx];
      if (item) {
        openWordExplorer(item);
      }
    });
    elements.immersionResultsGrid.setAttribute('data-delegated', 'true');
  }
  
  // Initial render (empty)
  renderImmersionResults();
}

function handleAnalyze() {
  const text = elements.immersionTextarea.value.trim();
  if (!text) return;
  
  elements.immersionAnalyzeBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Analysiere...`;
  elements.immersionAnalyzeBtn.disabled = true;
  
  // Slight delay to allow UI to update to loading state
  setTimeout(() => {
    try {
      immersionResults = analyzeText(text, state.allCards, state.learnedCards);
      
      // Sort results: Unknown -> Known (Not Learned) -> Learned
      immersionResults.sort((a, b) => {
          if (a.isLearned !== b.isLearned) return a.isLearned ? 1 : -1;
          if (a.isKnown !== b.isKnown) return a.isKnown ? 1 : -1;
          return a.lemma.localeCompare(b.lemma);
      });
      
      renderImmersionResults();
    } catch (err) {
      console.error("[Immersion] Analysis failed", err);
      alert("Fehler bei der Textanalyse.");
    } finally {
      elements.immersionAnalyzeBtn.innerHTML = `<i class="fa-solid fa-magnifying-glass mr-2"></i> Text analysieren`;
      elements.immersionAnalyzeBtn.disabled = false;
    }
  }, 50);
}

function renderImmersionResults() {
  const container = elements.immersionResultsGrid;
  if (!container) return;
  
  container.innerHTML = '';
  
  if (immersionResults.length === 0) {
      elements.immersionEmptyState.classList.remove('hidden');
      return;
  }
  
  elements.immersionEmptyState.classList.add('hidden');
  
  let html = '';
  let index = 0;
  
  for (const item of immersionResults) {
      // Determine status pill
      let statusHtml = '';
      let borderClass = 'border-slate-800/40';
      let opacityClass = '';
      
      if (item.isLearned) {
          statusHtml = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex-shrink-0"><i class="fa-solid fa-check mr-1"></i>Gelernt</span>`;
          borderClass = 'border-emerald-900/40 bg-emerald-950/10';
          opacityClass = 'opacity-50 grayscale hover:opacity-100 hover:grayscale-0'; // De-emphasize already learned words
      } else if (item.isKnown) {
          statusHtml = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex-shrink-0"><i class="fa-solid fa-book-open mr-1"></i>A1-B1 Archiv</span>`;
          borderClass = 'border-amber-900/40 bg-amber-950/10';
      } else {
          statusHtml = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex-shrink-0"><i class="fa-solid fa-sparkles mr-1"></i>Neues Wort</span>`;
          borderClass = 'border-indigo-900/40 bg-indigo-950/10 shadow-[0_0_15px_rgba(99,102,241,0.1)]';
      }
      
      // Determine Gender Tag
      let genderTag = '';
      if (item.gender === 'der') genderTag = `<span class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30 mr-1.5 flex-shrink-0">DER</span>`;
      else if (item.gender === 'die') genderTag = `<span class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-400 border border-pink-500/30 mr-1.5 flex-shrink-0">DIE</span>`;
      else if (item.gender === 'das') genderTag = `<span class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 mr-1.5 flex-shrink-0">DAS</span>`;
      
      // Action Button (Displays details and serves as visual indicator)
      let actionBtn = '';
      if (!item.isLearned && item.isKnown) {
          actionBtn = `<button class="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors font-medium border border-slate-700/50 pointer-events-none">Details</button>`;
      } else if (!item.isKnown) {
          actionBtn = `<button class="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors font-medium border border-indigo-500/50 pointer-events-none"><i class="fa-solid fa-plus mr-1"></i>Legen</button>`;
      } else {
          actionBtn = `<button class="text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-slate-500 border border-slate-800/60 cursor-not-allowed pointer-events-none"><i class="fa-solid fa-check mr-1"></i>Fertig</button>`;
      }
      
      html += `
        <div data-index="${index}" class="immersion-card cursor-pointer glass p-4 rounded-xl flex items-center justify-between border ${borderClass} transition-all ${opacityClass} hover:-translate-y-0.5">
            <div class="flex flex-col gap-1.5 min-w-0 mr-3">
                <div class="flex items-center gap-2">
                    ${genderTag}
                    <h3 class="text-lg font-bold text-slate-100 notranslate truncate">${escapeHtml(item.lemma)}</h3>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs text-slate-400 italic truncate">im Text als "${escapeHtml(item.original)}"</span>
                </div>
                ${item.translation ? `<p class="text-sm font-medium text-slate-300 mt-1 truncate">${escapeHtml(item.translation)}</p>` : ''}
            </div>
            <div class="flex flex-col items-end gap-2 flex-shrink-0">
                ${statusHtml}
                ${actionBtn}
            </div>
        </div>
      `;
      index++;
  }
  
  container.innerHTML = html;
}

export function openWordExplorer(item) {
  const overlay = elements.immersionExplorerOverlay;
  if (!overlay) return;

  // Query vocabulary: Find matches in current dictionary
  const card = state.allCards.find(c => c.id === Number(item.cardId) || c.word.toLowerCase() === item.lemma.toLowerCase());

  // Show/Hide Verified Badge if available
  if (elements.explorerVerifiedBadge) {
    if (card && card.verified) {
      elements.explorerVerifiedBadge.classList.remove('hidden');
    } else {
      elements.explorerVerifiedBadge.classList.add('hidden');
    }
  }

  // Set German Word/Lemma
  if (elements.explorerGermanWord) {
    elements.explorerGermanWord.textContent = item.lemma;
  }

  // Set Word Class
  if (elements.explorerWordClass) {
    let wordClassText = item.wordClass || (card ? card.wordClass : 'Nomen');
    const classLabels = {
      'noun': 'Substantiv / Nomen',
      'verb': 'Verb / Zeitwort',
      'adjective': 'Adjektiv / Eigenschaftswort',
      'adverb': 'Adverb / Umstandswort',
      'pronoun': 'Pronomen / Fürwort',
      'preposition': 'Präposition / Verhältniswort',
      'conjunction': 'Konjunktion / Bindewort',
      'article': 'Artikel / Begleiter'
    };
    elements.explorerWordClass.textContent = classLabels[wordClassText.toLowerCase()] || wordClassText;
  }

  // Set English Translation Meaning
  if (elements.explorerEnglishMeaning) {
    elements.explorerEnglishMeaning.textContent = card ? card.meaning : (item.translation || 'Unbekannte Bedeutung');
  }

  // Set CEFR Niveau
  if (elements.explorerCefrLevel) {
    elements.explorerCefrLevel.textContent = (card && card.level) ? card.level.toUpperCase() : state.currentLevel.toUpperCase();
  }

  // Set FSRS Status details on overlay
  if (elements.explorerFsrsState) {
    if (card) {
      const srsInfo = state.getSRSInfo(card.id);
      if (srsInfo.isNew) {
        elements.explorerFsrsState.textContent = 'Neu (FSRS)';
        elements.explorerFsrsState.className = 'text-xs font-extrabold text-blue-400 mt-1.5 uppercase tracking-wide';
      } else {
        const boxLabel = srsInfo.box >= 5 ? 'Meister' : `Stufe ${srsInfo.box}`;
        elements.explorerFsrsState.textContent = `${boxLabel} (${Math.round(srsInfo.retrievability * 100)}% Ret.)`;
        elements.explorerFsrsState.className = 'text-xs font-extrabold text-emerald-400 mt-1.5 uppercase tracking-wide';
      }
    } else {
      elements.explorerFsrsState.textContent = 'Nicht im Deck';
      elements.explorerFsrsState.className = 'text-xs font-extrabold text-indigo-400 mt-1.5 uppercase tracking-wide';
    }
  }

  // Plural/Conjugation Grammatical Helpers
  if (elements.explorerFormsContainer && elements.explorerFormsText) {
    if (card && (card.plural || card.gender)) {
      elements.explorerFormsContainer.classList.remove('hidden');
      let forms = [];
      if (card.gender) forms.push(`Artikel: ${card.gender.toUpperCase()}`);
      if (card.plural) forms.push(`Plural: ${card.plural}`);
      elements.explorerFormsText.textContent = forms.join(' | ');
    } else if (item.gender) {
      elements.explorerFormsContainer.classList.remove('hidden');
      elements.explorerFormsText.textContent = `Artikel (NLP vorhergesagt): ${item.gender.toUpperCase()}`;
    } else {
      elements.explorerFormsContainer.classList.add('hidden');
    }
  }

  // Suffix Grammar Rules integration in Word Explorer
  if (elements.explorerSuffixContainer) {
    const suffixRule = getSuffixRule(item.lemma);
    if (suffixRule) {
      elements.explorerSuffixContainer.classList.remove('hidden');
      if (elements.explorerSuffixBadge) {
        elements.explorerSuffixBadge.textContent = suffixRule.badgeText;
        elements.explorerSuffixBadge.className = "px-1.5 py-0.5 text-[8px] font-extrabold rounded uppercase tracking-wider " + 
          (suffixRule.gender === 'der' ? 'bg-blue-500/20 text-blue-300' :
           suffixRule.gender === 'die' ? 'bg-pink-500/20 text-pink-300' :
           suffixRule.gender === 'das' ? 'bg-emerald-500/20 text-emerald-300' :
           'bg-amber-500/20 text-amber-300');
      }
      if (elements.explorerSuffixTitle) {
        elements.explorerSuffixTitle.textContent = `Endung: -${suffixRule.suffix}`;
      }
      if (elements.explorerSuffixRule) {
        elements.explorerSuffixRule.textContent = suffixRule.rule;
      }
    } else {
      elements.explorerSuffixContainer.classList.add('hidden');
    }
  }

  // Beispielsatz render
  if (elements.explorerExampleDe && elements.explorerExampleEn) {
    if (card && card.exampleDe) {
      elements.explorerExampleDe.textContent = card.exampleDe;
      elements.explorerExampleEn.textContent = card.exampleEn || '';
      elements.explorerExampleDe.parentElement.classList.remove('hidden');
    } else {
      elements.explorerExampleDe.parentElement.classList.add('hidden');
    }
  }

  // Set deterministic gender-themed glows for the Word Explorer background & border
  if (elements.explorerGlow && elements.explorerCardGlowBorder) {
    const gender = card ? card.gender : item.gender;
    elements.explorerGlow.className = 'absolute -inset-10 blur-2xl rounded-full pointer-events-none transition-all duration-300';
    elements.explorerCardGlowBorder.className = 'absolute inset-0 border rounded-2xl pointer-events-none transition-all duration-300';

    if (gender === 'der') {
      elements.explorerGlow.classList.add('bg-blue-500/10');
      elements.explorerCardGlowBorder.classList.add('border-blue-500/30');
    } else if (gender === 'die') {
      elements.explorerGlow.classList.add('bg-pink-500/10');
      elements.explorerCardGlowBorder.classList.add('border-pink-500/30');
    } else if (gender === 'das') {
      elements.explorerGlow.classList.add('bg-emerald-500/10');
      elements.explorerCardGlowBorder.classList.add('border-emerald-500/30');
    } else {
      elements.explorerGlow.classList.add('bg-indigo-500/10');
      elements.explorerCardGlowBorder.classList.add('border-indigo-500/20');
    }
  }

  // Setup TTS Speaker Button
  const speakBtn = elements.explorerSpeakBtn;
  if (speakBtn) {
    const newSpeakBtn = speakBtn.cloneNode(true);
    speakBtn.parentNode.replaceChild(newSpeakBtn, speakBtn);
    elements.explorerSpeakBtn = newSpeakBtn;
    
    elements.explorerSpeakBtn.addEventListener('click', () => {
      const textToSpeak = card ? card.word : item.lemma;
      speakText(textToSpeak, 'de-DE');
    });
  }

  // Setup Quick Add / Learn Button
  const addBtn = elements.explorerAddBtn;
  const addBtnText = elements.explorerAddBtnText;
  if (addBtn) {
    const newAddBtn = addBtn.cloneNode(true);
    addBtn.parentNode.replaceChild(newAddBtn, addBtn);
    elements.explorerAddBtn = newAddBtn;
    elements.explorerAddBtnText = newAddBtn.querySelector('#explorer-add-btn-text') || elements.explorerAddBtnText;

    if (item.isLearned) {
      elements.explorerAddBtn.disabled = true;
      elements.explorerAddBtn.className = "px-5 py-2.5 bg-emerald-950/40 border border-emerald-900 text-emerald-400 rounded-xl text-xs font-black transition-all cursor-not-allowed flex items-center gap-2";
      if (elements.explorerAddBtnText) elements.explorerAddBtnText.textContent = "Bereits gelernt";
    } else if (card) {
      // It exists in current level deck, but is not marked learned
      elements.explorerAddBtn.disabled = false;
      elements.explorerAddBtn.className = "px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-indigo-600/20 active:scale-95 flex items-center gap-2";
      if (elements.explorerAddBtnText) elements.explorerAddBtnText.textContent = "Jetzt lernen (Lernen)";
      
      elements.explorerAddBtn.addEventListener('click', async () => {
        // Mark learned in SRS
        state.learnedCards.add(Number(card.id));
        // Add to SRS state
        state.reviewCardSRS(card.id, 3); // Automatically review with 3 (Good) as first steps
        
        // Success indications
        if (typeof window.triggerParticleBurst === 'function') {
          window.triggerParticleBurst(window.innerWidth / 2, window.innerHeight / 2);
        }
        
        // Re-analyze and re-render to sync card status
        const text = elements.immersionTextarea.value.trim();
        immersionResults = analyzeText(text, state.allCards, state.learnedCards);
        renderImmersionResults();
        
        closeWordExplorer();
      });
    } else {
      // It does not exist in our deck -> Add as a custom card!
      elements.explorerAddBtn.disabled = false;
      elements.explorerAddBtn.className = "px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-indigo-600/20 active:scale-95 flex items-center gap-2";
      if (elements.explorerAddBtnText) elements.explorerAddBtnText.textContent = "Ins Deck legen";

      elements.explorerAddBtn.addEventListener('click', async () => {
        const newCard = {
          id: Date.now(),
          word: item.lemma,
          meaning: item.translation || "User Custom Word",
          category: "Zeit, Maße & Basiswortschatz",
          wordClass: item.wordClass || "Noun",
          gender: item.gender || null,
          plural: null,
          antonym: null,
          pronunciation: null,
          exampleDe: "Ich lerne das Wort: " + item.lemma,
          exampleEn: "I am learning the word: " + item.lemma,
          custom: true
        };
        await state.addCustomCard(state.currentLevel, newCard);
        
        // Also mark it learned immediately in SRS
        state.learnedCards.add(Number(newCard.id));
        state.reviewCardSRS(newCard.id, 3);

        if (typeof window.triggerParticleBurst === 'function') {
          window.triggerParticleBurst(window.innerWidth / 2, window.innerHeight / 2);
        }

        const text = elements.immersionTextarea.value.trim();
        immersionResults = analyzeText(text, state.allCards, state.learnedCards);
        renderImmersionResults();

        closeWordExplorer();
      });
    }
  }

  // Bind Close Elements listeners
  if (elements.immersionExplorerCloseBtn) {
    elements.immersionExplorerCloseBtn.addEventListener('click', closeWordExplorer);
  }

  // Click backdrop to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeWordExplorer();
    }
  });

  // Reveal overlay & add escape keydowns
  overlay.classList.remove('hidden');
  document.addEventListener('keydown', handleExplorerKeydown);
  
  // Automatically focus on close button
  const closeBtn = document.getElementById('immersion-explorer-close-btn');
  if (closeBtn) requestAnimationFrame(() => closeBtn.focus());
}

function handleExplorerKeydown(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeWordExplorer();
    return;
  }
  if (e.key === 'Tab') {
    const closeBtn = document.getElementById('immersion-explorer-close-btn');
    const speakBtn = document.getElementById('explorer-speak-btn');
    const addBtn = document.getElementById('explorer-add-btn');
    
    // Filter visible elements
    const focusable = [closeBtn, speakBtn, addBtn].filter(el => el && !el.classList.contains('hidden') && el.offsetParent !== null);
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
}

export function closeWordExplorer() {
  const overlay = elements.immersionExplorerOverlay;
  if (overlay) {
    overlay.classList.add('hidden');
  }
  document.removeEventListener('keydown', handleExplorerKeydown);
}
