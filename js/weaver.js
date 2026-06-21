// js/weaver.js — Grammatik-Weberei (Grammar Weaver) Game Engine Module

import { state, elements, safeSetItem, safeGetItem, shuffleArray } from './state.js';
import { getSharedAudioContext } from './audio.js';

// Cached weaver slot DOM references (refreshed on each board render)
let cachedWeaverSlots = [];

// Retry counter for curateWeaverSentences (guards against infinite setTimeout loop)
let weaverCurateRetries = 0;

/**
 * Synthesizes pure Web Audio SFX for haptic offline feedback.
 * @param {string} type - 'click', 'snap', 'success', or 'error'
 */
export function playWeaverSound(type) {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    const vol = state.sfxVolume !== undefined ? state.sfxVolume : 0.5;
    if (vol <= 0) return;

    if (type === 'click' || type === 'snap') {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.06);
      
      gainNode.gain.setValueAtTime(0.12 * vol, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.07);
    } else if (type === 'success') {
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio
      notes.forEach((freq, idx) => {
        const timeOffset = idx * 0.09;
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + timeOffset);
        
        gainNode.gain.setValueAtTime(0.08 * vol, ctx.currentTime + timeOffset);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + timeOffset + 0.35);
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(ctx.currentTime + timeOffset);
        osc.stop(ctx.currentTime + timeOffset + 0.36);
      });
    } else if (type === 'error') {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(90, ctx.currentTime + 0.28);
      
      gainNode.gain.setValueAtTime(0.2 * vol, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.29);
    }
  } catch (err) {
    console.warn("Web Audio Synthesis blocked or unsupported in this environment:", err);
  }
}

/**
 * Initializes the main Grammatik-Weberei view dashboard.
 * Curates matching sentences dynamically from level database.
 */
export function initWeaverView() {
  // Reset view state
  if (elements.weaverIntroScreen) elements.weaverIntroScreen.classList.remove('hidden');
  if (elements.weaverBoard) elements.weaverBoard.classList.add('hidden');
  if (elements.weaverResults) elements.weaverResults.classList.add('hidden');
  if (elements.weaverFeedback) elements.weaverFeedback.classList.add('hidden');

  // Synchronize XP counter on screen load
  const currentXp = parseInt(safeGetItem('adventure_xp', '0'), 10) || 0;
  state.adventure.xp = currentXp;
  if (elements.weaverXpCounter) {
    elements.weaverXpCounter.textContent = `${currentXp} XP`;
  }

  // Reset retry counter before curating
  weaverCurateRetries = 0;
  // Curate vocabulary database example sentences
  curateWeaverSentences();
}

/**
 * Scans vocabulary database and extracts sentences conforming to level rules.
 */
export function curateWeaverSentences() {
  state.weaver.sentences = [];

  if (!state.allCards || state.allCards.length === 0) {
    // No cards loaded yet, retry shortly (with limit to prevent infinite loop)
    weaverCurateRetries++;
    if (weaverCurateRetries > 10) {
      // Exhausted retries — use fallback sentences only
      return;
    }
    setTimeout(curateWeaverSentences, 300);
    return;
  }
  weaverCurateRetries = 0; // Reset on successful load

  // Build lookup table to analyze tokens
  const cardsLookup = {};
  state.allCards.forEach(card => {
    if (card.word) {
      let clean = card.word.toLowerCase().replace(/^(der|die|das)\s+/, '').trim();
      if (!cardsLookup[clean]) {
        cardsLookup[clean] = card;
      }
    }
  });

  const level = state.currentLevel; // 'a1', 'a2', 'b1'
  const pool = [];

  // Track unique German sentences to prevent duplicate games
  const seenSentences = new Set();

  state.allCards.forEach(card => {
    if (card.exampleDe && card.exampleEn) {
      const sentenceDe = card.exampleDe.trim();
      if (seenSentences.has(sentenceDe)) return;

      const words = sentenceDe.split(/\s+/);
      // Conforming sentence parameters: 4 to 12 words in length
      if (words.length >= 4 && words.length <= 11) {
        seenSentences.add(sentenceDe);
        
        // Tag tokens with grammatical properties
        const tokens = words.map((word, index) => {
          const token = analyzeToken(word, index, words, cardsLookup);
          token.uid = `${card.id}_${index}`;
          return token;
        });

        pool.push({
          text: sentenceDe,
          translation: card.exampleEn.trim(),
          tokens: tokens,
          headword: card.word,
          id: card.id
        });
      }
    }
  });

  // Fallback default sentences if level card examples are empty
  if (pool.length === 0) {
    const fallbacks = {
      a1: [
        {
          text: "Ich lerne heute Deutsch.",
          translation: "I am learning German today.",
          tokens: [
            { text: "Ich", pos: "weaver-chip-subject" },
            { text: "lerne", pos: "weaver-chip-verb" },
            { text: "heute", pos: "weaver-chip-other" },
            { text: "Deutsch.", pos: "weaver-chip-das" }
          ]
        },
        {
          text: "Der Apfel ist sehr frisch.",
          translation: "The apple is very fresh.",
          tokens: [
            { text: "Der", pos: "weaver-chip-subject" },
            { text: "Apfel", pos: "weaver-chip-der" },
            { text: "ist", pos: "weaver-chip-verb" },
            { text: "sehr", pos: "weaver-chip-other" },
            { text: "frisch.", pos: "weaver-chip-other" }
          ]
        }
      ],
      a2: [
        {
          text: "Ich kann heute nicht kommen, weil ich krank bin.",
          translation: "I cannot come today because I am sick.",
          tokens: [
            { text: "Ich", pos: "weaver-chip-subject" },
            { text: "kann", pos: "weaver-chip-verb" },
            { text: "heute", pos: "weaver-chip-other" },
            { text: "nicht", pos: "weaver-chip-other" },
            { text: "kommen,", pos: "weaver-chip-verb" },
            { text: "weil", pos: "weaver-chip-conjunction" },
            { text: "ich", pos: "weaver-chip-subject" },
            { text: "krank", pos: "weaver-chip-other" },
            { text: "bin.", pos: "weaver-chip-verb" }
          ]
        }
      ],
      b1: [
        {
          text: "Obwohl das Wetter schlecht ist, gehen wir spazieren.",
          translation: "Although the weather is bad, we are going for a walk.",
          tokens: [
            { text: "Obwohl", pos: "weaver-chip-conjunction" },
            { text: "das", pos: "weaver-chip-subject" },
            { text: "Wetter", pos: "weaver-chip-das" },
            { text: "schlecht", pos: "weaver-chip-other" },
            { text: "ist,", pos: "weaver-chip-verb" },
            { text: "gehen", pos: "weaver-chip-verb" },
            { text: "wir", pos: "weaver-chip-subject" },
            { text: "spazieren.", pos: "weaver-chip-verb" }
          ]
        }
      ]
    };
    const levelFallbacks = fallbacks[level] || fallbacks['a1'];
    levelFallbacks.forEach(item => pool.push(item));
  }

  // Shuffle pool and slice top 5 sentences
  const shuffledPool = shuffleArray([...pool]);
  state.weaver.sentences = shuffledPool.slice(0, state.weaver.totalQuestionsCount);
}

/**
 * Assigns styling classes and grammar category to individual word tokens.
 * @param {string} rawWord - Original word containing punctuation.
 * @param {number} idx - Index inside sentence.
 * @param {string[]} allWords - All raw words of sentence.
 * @param {Object} lookup - Normalized card lookup dictionary.
 * @returns {Object} Tagged token.
 */
export function analyzeToken(rawWord, idx, allWords, lookup) {
  const word = rawWord.replace(/[.,!?;:]/g, '').trim();
  const lower = word.toLowerCase();

  // 1. Particle Separable Prefixes (Check if verb parts end with classic prefixes)
  const commonPrefixes = ["ein", "aus", "auf", "ab", "an", "mit", "zu", "her", "hin", "vor", "nach", "weg", "los", "zurück"];
  if (idx === allWords.length - 1 && commonPrefixes.includes(lower)) {
    return { text: rawWord, pos: "weaver-chip-prefix" };
  }

  // 2. Conjunction check
  const conjunctions = ["weil", "dass", "obwohl", "wenn", "ob", "als", "da", "damit", "nachdem", "und", "aber", "oder", "denn", "sondern"];
  if (conjunctions.includes(lower)) {
    return { text: rawWord, pos: "weaver-chip-conjunction" };
  }

  // 3. Pronouns/Subjects
  const pronouns = ["ich", "du", "er", "sie", "es", "wir", "ihr", "Sie", "mich", "dich", "ihm", "ihr", "uns", "euch", "ihnen", "mein", "dein", "sein", "unser", "euer", "ihr", "ein", "eine", "einen", "einem", "einer", "eines", "der", "die", "das", "dem", "den"];
  if (pronouns.includes(lower)) {
    return { text: rawWord, pos: "weaver-chip-subject" };
  }

  // 4. Modal/Auxiliary Verbs
  const auxiliaries = ["ist", "sind", "war", "waren", "bin", "bist", "seid", "habe", "hast", "hat", "haben", "habt", "hatte", "kann", "muss", "will", "soll", "darf", "möchte", "können", "müssen", "wollen", "sollen", "dürfen", "möchten", "wird", "werden", "wurde", "wurden"];
  if (auxiliaries.includes(lower)) {
    return { text: rawWord, pos: "weaver-chip-verb" };
  }

  // 5. Lookup database match
  const match = lookup[lower];
  if (match) {
    if (match.wordClass === 'Verb') {
      return { text: rawWord, pos: "weaver-chip-verb" };
    }
    if (match.wordClass === 'Nomen') {
      const g = match.gender ? match.gender.toLowerCase() : null;
      if (g === 'der') return { text: rawWord, pos: "weaver-chip-der" };
      if (g === 'die') return { text: rawWord, pos: "weaver-chip-die" };
      if (g === 'das') return { text: rawWord, pos: "weaver-chip-das" };
      return { text: rawWord, pos: "weaver-chip-other" };
    }
  }

  // 6. Capitalization heuristic for nouns (excluding first word)
  if (idx > 0 && /^[A-ZÄÖÜ]/.test(word)) {
    return { text: rawWord, pos: "weaver-chip-other" }; // generic noun
  }

  // Default fallback
  return { text: rawWord, pos: "weaver-chip-other" };
}

/**
 * Starts a new active 5-question round of Grammatik-Weberei.
 */
export function startWeaverGame() {
  if (state.weaver.sentences.length === 0) {
    // If empty or loading, force curate
    curateWeaverSentences();
    if (state.weaver.sentences.length === 0) {
      // F19: Show inline feedback instead of blocking alert
      if (elements.weaverFeedback) {
        elements.weaverFeedback.classList.remove('hidden');
        elements.weaverFeedback.classList.add('flex');
        if (elements.weaverFeedbackIcon) {
          elements.weaverFeedbackIcon.className = 'w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg text-lg bg-amber-500';
          elements.weaverFeedbackIcon.innerHTML = '<i class="fa-solid fa-hourglass-half"></i>';
        }
        if (elements.weaverFeedbackTitle) elements.weaverFeedbackTitle.textContent = 'Vokabeldaten werden geladen...';
        if (elements.weaverFeedbackText) elements.weaverFeedbackText.textContent = 'Bitte versuchen Sie es in wenigen Sekunden erneut. Die Wortdatenbank wird noch vorbereitet.';
      }
      return;
    }
  }

  state.weaver.active = true;
  state.weaver.currentSentenceIndex = 0;
  state.weaver.xpEarned = 0;
  state.weaver.errorsCount = 0;

  // Toggle visual boards
  if (elements.weaverIntroScreen) elements.weaverIntroScreen.classList.add('hidden');
  if (elements.weaverResults) elements.weaverResults.classList.add('hidden');
  if (elements.weaverBoard) elements.weaverBoard.classList.remove('hidden');

  loadWeaverQuestion();
}

/**
 * Loads the current sentence and populates original and scrambled chips.
 */
export function loadWeaverQuestion() {
  const sentenceObj = state.weaver.sentences[state.weaver.currentSentenceIndex];
  if (!sentenceObj) return;

  state.weaver.constructedTokens = [];
  state.weaver.originalTokens = [...sentenceObj.tokens];
  
  // Create a scrambled shallow copy of original tokens (Fisher-Yates via shuffleArray)
  const scrambled = [...sentenceObj.tokens];
  shuffleArray(scrambled);
  state.weaver.scrambledTokens = scrambled;

  // Update badges & progress bars
  const qNum = state.weaver.currentSentenceIndex + 1;
  const totalQ = state.weaver.totalQuestionsCount;
  
  if (elements.weaverActiveTitle) {
    elements.weaverActiveTitle.textContent = `Satzbauübung ${qNum} von ${totalQ}`;
  }
  if (elements.weaverActiveBadge) {
    elements.weaverActiveBadge.textContent = state.currentLevel.toUpperCase();
  }
  if (elements.weaverProgressText) {
    elements.weaverProgressText.textContent = `Satz ${qNum} von ${totalQ}`;
  }
  if (elements.weaverProgressBarFill) {
    const pct = (qNum / totalQ) * 100;
    elements.weaverProgressBarFill.style.width = `${pct}%`;
  }
  if (elements.weaverTranslationHint) {
    elements.weaverTranslationHint.textContent = sentenceObj.translation;
  }

  // Clear feedback panel
  if (elements.weaverFeedback) elements.weaverFeedback.classList.add('hidden');
  if (elements.weaverNextBtn) elements.weaverNextBtn.classList.add('hidden');
  if (elements.weaverActionButtons) elements.weaverActionButtons.classList.remove('hidden');

  renderWeaverBoard();
}

/**
 * Renders empty slots and scrambled pool chips on the board.
 */
export function renderWeaverBoard() {
  if (!elements.weaverDropzone || !elements.weaverChipsPool) return;

  // 1. Render Dropzone assembly area
  elements.weaverDropzone.innerHTML = '';
  
  // Show placeholder if dropzone is empty
  const isDropzoneEmpty = state.weaver.constructedTokens.length === 0;
  if (isDropzoneEmpty && elements.weaverDropzonePlaceholder) {
    elements.weaverDropzone.appendChild(elements.weaverDropzonePlaceholder);
    elements.weaverDropzonePlaceholder.classList.remove('hidden');
  } else if (elements.weaverDropzonePlaceholder) {
    elements.weaverDropzonePlaceholder.classList.add('hidden');
  }

  // Create empty slots matching original sentence length
  const totalSlots = state.weaver.originalTokens.length;
  
  for (let i = 0; i < totalSlots; i++) {
    const slot = document.createElement('div');
    slot.className = 'weaver-slot';
    slot.setAttribute('data-slot-idx', i);

    // If there's an assembled token in this position, nest it inside
    if (i < state.weaver.constructedTokens.length) {
      const token = state.weaver.constructedTokens[i];
      slot.classList.add('weaver-slot-filled');
      
      const chip = createWeaverChip(token, i, true);
      slot.appendChild(chip);
    }
    
    elements.weaverDropzone.appendChild(slot);
  }

  // 2. Render Scrambled Pool container
  elements.weaverChipsPool.innerHTML = '';
  state.weaver.scrambledTokens.forEach((token, idx) => {
    // Only render chips that have NOT been dragged or clicked to the dropzone
    const alreadyUsed = state.weaver.constructedTokens.some(t => t.uid === token.uid);
    if (!alreadyUsed) {
      const chip = createWeaverChip(token, idx, false);
      elements.weaverChipsPool.appendChild(chip);
    }
  });

  // Verify active transformations (V2/Separable suffix highlights)
  // Cache slot references for hot-path collision detection in pointermove/pointerup
  cachedWeaverSlots = Array.from(elements.weaverDropzone.querySelectorAll('.weaver-slot'));
  triggerSyntaxShiftCalculations();
}

/**
 * HTML Factory creating interactive word chips with dynamic PointerEvent hooks.
 */
export function createWeaverChip(token, arrayIdx, isInDropzone) {
  const chip = document.createElement('button');
  chip.className = `weaver-chip px-3.5 py-1.5 rounded-xl border font-bold text-sm select-none touch-none shadow-md ${token.pos}`;
  chip.textContent = token.text;
  
  // Store custom identification properties
  chip.setAttribute('data-text', token.text);
  chip.setAttribute('data-pos', token.pos);
  chip.setAttribute('data-arr-idx', arrayIdx);
  chip.setAttribute('data-in-dropzone', isInDropzone ? 'true' : 'false');

  // Add parts-of-speech icons inside
  let iconHtml = '';
  if (token.pos === 'weaver-chip-conjunction') iconHtml = '<i class="fa-solid fa-link text-amber-400 text-xs"></i>';
  else if (token.pos === 'weaver-chip-verb') iconHtml = '<i class="fa-solid fa-bolt text-indigo-400 text-xs"></i>';
  else if (token.pos === 'weaver-chip-prefix') iconHtml = '<i class="fa-solid fa-scissors text-purple-400 text-xs"></i>';
  else if (token.pos === 'weaver-chip-der') iconHtml = '<i class="fa-solid fa-square text-blue-400 text-xs"></i>';
  else if (token.pos === 'weaver-chip-die') iconHtml = '<i class="fa-solid fa-square text-pink-400 text-xs"></i>';
  else if (token.pos === 'weaver-chip-das') iconHtml = '<i class="fa-solid fa-square text-emerald-400 text-xs"></i>';

  if (iconHtml) {
    chip.innerHTML = `${iconHtml}<span>${token.text}</span>`;
  }

  // --- ACCESSBILITY & TOUCH INTERACTION CLICKS ---
  chip.addEventListener('click', (e) => {
    // Prevent clicking if user is dragging
    if (chip.classList.contains('weaver-chip-dragging')) return;
    
    playWeaverSound('click');
    if (isInDropzone) {
      // Remove clicked chip from dropzone and return to pool
      state.weaver.constructedTokens.splice(arrayIdx, 1);
    } else {
      // Push clicked chip to first available slot on dropzone
      if (state.weaver.constructedTokens.length < state.weaver.originalTokens.length) {
        state.weaver.constructedTokens.push(token);
      }
    }
    renderWeaverBoard();
  });

  // --- POINTEREVENTS TACTILE DRAG-AND-DROP DRIVER LOOP ---
  setupWeaverChipPointerEvents(chip, token, arrayIdx, isInDropzone);

  return chip;
}

// Global Drag variables
let activeWeaverDrag = null;

export function setupWeaverChipPointerEvents(chip, token, arrayIdx, isInDropzone) {
  chip.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    
    // Lazy-load audio click arpeggio trigger
    getSharedAudioContext();

    // Prevent multi-touch drag conflicts
    if (activeWeaverDrag) return;

    const rect = chip.getBoundingClientRect();
    
    // Store drag parameters
    activeWeaverDrag = {
      element: chip,
      token: token,
      originalIndex: arrayIdx,
      isInDropzone: isInDropzone,
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      initialLeft: rect.left,
      initialTop: rect.top,
      width: rect.width,
      height: rect.height
    };

    // Apply fixed viewport styles to make chip fly dynamically
    chip.style.width = activeWeaverDrag.width + 'px';
    chip.style.height = activeWeaverDrag.height + 'px';
    chip.style.left = activeWeaverDrag.initialLeft + 'px';
    chip.style.top = activeWeaverDrag.initialTop + 'px';
    
    chip.classList.add('weaver-chip-dragging');
    chip.setPointerCapture(e.pointerId);
  });

  chip.addEventListener('pointermove', (e) => {
    if (!activeWeaverDrag || activeWeaverDrag.pointerId !== e.pointerId) return;
    e.preventDefault();

    const drag = activeWeaverDrag;
    const x = e.clientX - drag.offsetX;
    const y = e.clientY - drag.offsetY;

    // Update floating position
    drag.element.style.left = x + 'px';
    drag.element.style.top = y + 'px';

    // Conduct real-time collision detection on cached slots
    cachedWeaverSlots.forEach(slot => {
      const sRect = slot.getBoundingClientRect();
      const pointerInX = e.clientX >= sRect.left && e.clientX <= sRect.right;
      const pointerInY = e.clientY >= sRect.top && e.clientY <= sRect.bottom;

      if (pointerInX && pointerInY) {
        slot.classList.add('weaver-slot-active');
      } else {
        slot.classList.remove('weaver-slot-active');
      }
    });
  });

  chip.addEventListener('pointerup', (e) => {
    if (!activeWeaverDrag || activeWeaverDrag.pointerId !== e.pointerId) return;
    e.stopPropagation();

    const drag = activeWeaverDrag;
    activeWeaverDrag = null;

    drag.element.classList.remove('weaver-chip-dragging');
    drag.element.releasePointerCapture(e.pointerId);

    // Find if released over a valid highlighted slot
    const slots = cachedWeaverSlots;
    let snappedSlotIdx = null;

    slots.forEach(slot => {
      if (slot.classList.contains('weaver-slot-active')) {
        snappedSlotIdx = parseInt(slot.getAttribute('data-slot-idx'));
        slot.classList.remove('weaver-slot-active');
      }
    });

    if (snappedSlotIdx !== null && snappedSlotIdx >= 0) {
      playWeaverSound('snap');
      
      // Determine target modifications based on snapped action
      if (snappedSlotIdx < state.weaver.constructedTokens.length) {
        // Swap existing token with newly dragged token
        const currentToken = state.weaver.constructedTokens[snappedSlotIdx];
        state.weaver.constructedTokens[snappedSlotIdx] = drag.token;
        
        // If drag started in dropzone, remove original position index
        if (drag.isInDropzone) {
          state.weaver.constructedTokens[drag.originalIndex] = currentToken;
        }
      } else {
        // Drop at slot end or append
        if (drag.isInDropzone) {
          // Relocate within dropzone array
          state.weaver.constructedTokens.splice(drag.originalIndex, 1);
        }
        state.weaver.constructedTokens.push(drag.token);
      }
    } else {
      // Released elsewhere - if started inside dropzone, remove it!
      if (drag.isInDropzone) {
        state.weaver.constructedTokens.splice(drag.originalIndex, 1);
        playWeaverSound('click');
      }
    }

    // Reset element manual sizing
    drag.element.style.width = '';
    drag.element.style.height = '';
    drag.element.style.left = '';
    drag.element.style.top = '';

    renderWeaverBoard();
  });

  chip.addEventListener('pointercancel', (e) => {
    if (!activeWeaverDrag) return;
    const drag = activeWeaverDrag;
    activeWeaverDrag = null;

    drag.element.classList.remove('weaver-chip-dragging');
    drag.element.style.width = '';
    drag.element.style.height = '';
    drag.element.style.left = '';
    drag.element.style.top = '';
    
    renderWeaverBoard();
  });
}

/**
 * Simulates grammar forces dynamically in UI!
 * Slides and overlays visual indicators depending on placed slots.
 */
export function triggerSyntaxShiftCalculations() {
  const currentText = state.weaver.constructedTokens.map(t => t.text.toLowerCase().replace(/[.,!?;:]/g, '')).join(' ');
  const containsWeil = currentText.includes('weil') || currentText.includes('dass') || currentText.includes('obwohl') || currentText.includes('wenn');

  const slots = cachedWeaverSlots;

  slots.forEach((slot, idx) => {
    // 1. Highlight subordinating verb-end magnet pulls
    if (containsWeil && idx === slots.length - 1) {
      slot.style.boxShadow = '0 0 10px rgba(245, 158, 11, 0.2)';
      slot.style.borderColor = 'rgba(245, 158, 11, 0.4)';
    } else {
      slot.style.boxShadow = '';
      slot.style.borderColor = '';
    }
  });
}

/**
 * Resets the current question's drops back into Scrambled Pool.
 */
export function resetWeaverSentence() {
  playWeaverSound('click');
  state.weaver.constructedTokens = [];
  renderWeaverBoard();
}

/**
 * Quits active Weaver session and returns to SPA view.
 */
export function quitWeaverGame() {
  state.weaver.active = false;
  state.weaver.sentences = [];
  state.weaver.constructedTokens = [];
  window.location.hash = '#/';
}

/**
 * Submits and validates current sentence word-order.
 */
export function submitWeaverSentence() {
  const sentenceObj = state.weaver.sentences[state.weaver.currentSentenceIndex];
  if (!sentenceObj) return;

  const constructedWords = state.weaver.constructedTokens.map(t => t.text.trim());
  const correctWords = state.weaver.originalTokens.map(t => t.text.trim());

  // Strict check on array sizes
  if (constructedWords.length < correctWords.length) {
    playWeaverSound('error');
    if (elements.weaverDropzone) {
      elements.weaverDropzone.classList.add('shake');
      setTimeout(() => elements.weaverDropzone.classList.remove('shake'), 500);
    }
    // F19: Show inline visual hint instead of blocking alert
    // Highlight empty slots with a pulsing border
    if (elements.weaverDropzone) {
      const emptySlots = elements.weaverDropzone.querySelectorAll('.weaver-slot:not(.filled)');
      emptySlots.forEach(slot => {
        slot.classList.add('border-rose-500/60');
        setTimeout(() => slot.classList.remove('border-rose-500/60'), 1500);
      });
    }
    return;
  }

  // Comparison logic
  const isPerfect = constructedWords.join(' ') === correctWords.join(' ');

  if (isPerfect) {
    // Correct order arpeggio
    playWeaverSound('success');
    
    // Add XP points (25 XP Base)
    let xpGain = 25;
    state.weaver.xpEarned += xpGain;
    addWeaverXP(xpGain);

    // Reveal Feedback panel with Success theme
    if (elements.weaverFeedback) {
      elements.weaverFeedback.classList.remove('hidden');
      elements.weaverFeedback.className = "p-5 rounded-2xl border border-emerald-800 bg-emerald-950/20 backdrop-blur-md flex flex-col space-y-3 transition-all duration-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]";
    }
    if (elements.weaverFeedbackIcon) {
      elements.weaverFeedbackIcon.className = "w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg text-lg";
      elements.weaverFeedbackIcon.innerHTML = '<i class="fa-solid fa-check"></i>';
    }
    if (elements.weaverFeedbackTitle) {
      elements.weaverFeedbackTitle.textContent = "Hervorragend gewebt!";
      elements.weaverFeedbackTitle.className = "text-sm font-black text-emerald-400";
    }
    if (elements.weaverFeedbackText) {
      elements.weaverFeedbackText.innerHTML = `Der Satz ist absolut makellos strukturiert:<br><strong class="text-white text-sm font-bold">"${correctWords.join(' ')}"</strong>`;
    }

    // Dynamic Grammar Tip Card Generation
    if (elements.weaverFeedbackTip && elements.weaverFeedbackTipText) {
      elements.weaverFeedbackTip.classList.remove('hidden');
      elements.weaverFeedbackTipText.textContent = getGrammarExplanation(sentenceObj.text);
    }

    // Toggle actions
    if (elements.weaverNextBtn) elements.weaverNextBtn.classList.remove('hidden');
    if (elements.weaverActionButtons) elements.weaverActionButtons.classList.add('hidden');

  } else {
    // Error sound & shake
    playWeaverSound('error');
    state.weaver.errorsCount++;

    if (elements.weaverDropzone) {
      elements.weaverDropzone.classList.add('shake');
      setTimeout(() => elements.weaverDropzone.classList.remove('shake'), 500);
    }

    // Reveal error feedback
    if (elements.weaverFeedback) {
      elements.weaverFeedback.classList.remove('hidden');
      elements.weaverFeedback.className = "p-5 rounded-2xl border border-rose-800 bg-rose-950/20 backdrop-blur-md flex flex-col space-y-3 transition-all duration-300 shadow-[0_0_15px_rgba(244,63,94,0.15)]";
    }
    if (elements.weaverFeedbackIcon) {
      elements.weaverFeedbackIcon.className = "w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 shadow-lg text-lg";
      elements.weaverFeedbackIcon.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    }
    if (elements.weaverFeedbackTitle) {
      elements.weaverFeedbackTitle.textContent = "Strukturfehler entdeckt";
      elements.weaverFeedbackTitle.className = "text-sm font-black text-rose-400";
    }
    if (elements.weaverFeedbackText) {
      elements.weaverFeedbackText.textContent = "Die gewählte Wortreihenfolge entspricht leider nicht den deutschen Syntaxregeln. Überprüfen Sie die Position von Verben oder Pronomen!";
    }

    // Render helper hint
    if (elements.weaverFeedbackTip && elements.weaverFeedbackTipText) {
      elements.weaverFeedbackTip.classList.remove('hidden');
      elements.weaverFeedbackTipText.textContent = getGrammarExplanation(sentenceObj.text);
    }
  }
}

/**
 * Progresses to the next curated sentence in round, or displays results screen.
 */
export function nextWeaverSentence() {
  state.weaver.currentSentenceIndex++;

  if (state.weaver.currentSentenceIndex >= state.weaver.totalQuestionsCount) {
    // Round complete - display results
    showWeaverResults();
  } else {
    loadWeaverQuestion();
  }
}

/**
 * Computes precision metrics and triggers complete arpeggio milestone.
 */
export function showWeaverResults() {
  if (elements.weaverBoard) elements.weaverBoard.classList.add('hidden');
  if (elements.weaverFeedback) elements.weaverFeedback.classList.add('hidden');
  if (elements.weaverResults) elements.weaverResults.classList.remove('hidden');

  const earned = state.weaver.xpEarned;
  const errors = state.weaver.errorsCount;
  const totalAttempts = state.weaver.totalQuestionsCount + errors;
  const accuracy = Math.max(0, Math.round((state.weaver.totalQuestionsCount / totalAttempts) * 100));

  // Visual text renders
  if (elements.weaverResultsXp) {
    elements.weaverResultsXp.textContent = `+${earned} XP`;
  }
  if (elements.weaverResultsAccuracy) {
    elements.weaverResultsAccuracy.textContent = `${accuracy}% Genauigkeit`;
    if (accuracy < 75) {
      elements.weaverResultsAccuracy.className = "text-xl font-black font-mono text-amber-500 mt-1";
    } else {
      elements.weaverResultsAccuracy.className = "text-xl font-black font-mono text-emerald-400 mt-1";
    }
  }

  playWeaverSound('success');
}

/**
 * Computes custom dynamic grammatical rule tips for the feedback cards.
 */
export function getGrammarExplanation(sentenceText) {
  const clean = sentenceText.toLowerCase().replace(/[.,!?;:]/g, '');
  const words = clean.split(/\s+/);

  // Check subclause subordinating conjunctions
  const subConjunctions = ["weil", "dass", "obwohl", "wenn", "ob", "als", "da", "damit", "nachdem"];
  const subFound = words.find(w => subConjunctions.includes(w));
  if (subFound) {
    return `💡 Grammatik-Tipp: Das Wort "${subFound}" leitet einen Nebensatz ein! Im deutschen Nebensatz wandert das konjugierte Verb (z. B. "ist", "bin", "kann") immer an das absolute Satzende.`;
  }

  // Check separable prefix particles
  const commonPrefixes = ["ein", "aus", "auf", "ab", "an", "mit", "zu", "her", "hin", "vor", "nach", "weg", "los", "zurück"];
  const lastWord = words[words.length - 1];
  if (commonPrefixes.includes(lastWord)) {
    return `💡 Grammatik-Tipp: Trennbares Verb im Hauptsatz erkannt! Das Präfix "${lastWord}" trennt sich ab und fliegt an das Satzende, während das Hauptverb an Position 2 konjugiert wird (V2-Regel).`;
  }

  // Check coordinating conjunctions (ADUSO)
  const coConjunctions = ["und", "aber", "oder", "denn", "sondern"];
  const coFound = words.find(w => coConjunctions.includes(w));
  if (coFound) {
    return `💡 Grammatik-Tipp: Die Konjunktion "${coFound}" ist ein ADUSO-Bindewort (Position 0). Es verbindet Sätze, verändert aber die reguläre Wortreihenfolge des folgenden Satzes nicht!`;
  }

  // Standard Main Clause V2
  return `💡 Grammatik-Tipp (V2-Regel): In einem deutschen Aussagesatz steht das konjugierte Hauptverb immer unumstößlich an der zweiten Position des Satzes (Position 2).`;
}

/**
 * Persistent helper adding XP and syncing counter indicator.
 */
export function addWeaverXP(amount) {
  if (state.focus && state.focus.xpMultiplierActive) {
    amount = Math.round(amount * 1.25);
  }
  let currentXP = parseInt(safeGetItem('adventure_xp', '0'), 10) || 0;
  currentXP += amount;
  safeSetItem('adventure_xp', String(currentXP));
  
  state.adventure.xp = currentXP;

  if (elements.weaverXpCounter) {
    elements.weaverXpCounter.textContent = `${currentXP} XP`;
    elements.weaverXpCounter.classList.add('scale-115', 'text-amber-400');
    setTimeout(() => {
      elements.weaverXpCounter.classList.remove('scale-115', 'text-amber-400');
    }, 450);
  }
}
