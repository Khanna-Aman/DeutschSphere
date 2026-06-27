// js/adventure.js — RPG Deutsch-Abenteuer Game Engine Module

import { state, elements, safeJsonParse, safeSetItem, safeGetItem, escapeHtml } from './state.js';
import { speakText, playSnapHaptic, playSuccessArpeggio, playErrorGlide, playEpicArpeggio } from './audio.js';

// Get FontAwesome icon class for a given scenario theme
export function getThemeIconClass(theme) {
  switch (theme) {
    case 'Gesundheit & Körper': return 'fa-solid fa-heart-pulse';
    case 'Wohnen & Freizeit': return 'fa-solid fa-house-chimney';
    case 'Einkaufen & Konsum': return 'fa-solid fa-cart-shopping';
    case 'Arbeit & Beruf': return 'fa-solid fa-briefcase';
    case 'Reisen & Mobilität': return 'fa-solid fa-plane';
    case 'Wetter': return 'fa-solid fa-cloud-sun';
    case 'Medien & Technologie': return 'fa-solid fa-laptop-code';
    default: return 'fa-solid fa-compass';
  }
}

// Audio SFX are now centralized in audio.js — imported above as
// playSnapHaptic (click), playSuccessArpeggio (correct), playErrorGlide (error), playEpicArpeggio (completion)

// Initialize the Adventure View dashboard, loading JSON files scoped by CEFR level
export async function initAdventureView() {
  // Sync and display total XP
  const xp = parseInt(safeGetItem('adventure_xp', '0'), 10) || 0;
  if (elements.adventureXpCounter) {
    elements.adventureXpCounter.textContent = `${xp} XP`;
  }
  
  // Show selector card panel, hide board and results
  if (elements.adventureSelectorScreen) elements.adventureSelectorScreen.classList.remove('hidden');
  if (elements.adventureBoard) elements.adventureBoard.classList.add('hidden');
  if (elements.adventureResults) elements.adventureResults.classList.add('hidden');
  
  // Reset state
  state.adventure.activeScenario = null;
  state.adventure.currentNode = null;
  state.adventure.constructedSentence = [];
  
  // Show loader overlay briefly
  if (elements.loaderOverlay) {
    elements.loaderOverlay.classList.remove('hidden', 'opacity-0');
  }
  
  try {
    const level = state.currentLevel; // 'a1', 'a2', 'b1'
    const response = await fetch(`./${level}/adventure.json`);
    if (!response.ok) {
      throw new Error(`Could not load adventure data for level ${level.toUpperCase()}.`);
    }
    const data = await response.json();
    state.adventure.scenarios = data;
    renderAdventureMenu();
  } catch (err) {
    console.error("Adventure loading failed:", err);
    if (elements.adventureSelector) {
      elements.adventureSelector.innerHTML = `
        <div class="col-span-full bg-rose-950/20 border border-rose-500/20 rounded-2xl p-6 text-center text-rose-300">
          <i class="fa-solid fa-triangle-exclamation text-2xl mb-2 text-rose-400"></i>
          <p class="font-extrabold text-sm">Failed to load adventure scenarios.</p>
          <p class="text-xs text-rose-400 mt-1">${escapeHtml(err.message)}</p>
          <button id="adventure-retry-btn" class="mt-4 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-lg shadow-rose-600/20">
            <i class="fa-solid fa-rotate-right mr-1"></i>Try Again
          </button>
        </div>
      `;
      // F19b: Wire up retry button
      const retryBtn = document.getElementById('adventure-retry-btn');
      if (retryBtn) retryBtn.addEventListener('click', () => initAdventureView());
    }
  } finally {
    if (elements.loaderOverlay) {
      elements.loaderOverlay.classList.add('opacity-0');
      setTimeout(() => {
        elements.loaderOverlay.classList.add('hidden');
      }, 300);
    }
  }
}

// Render scenario listing cards inside selector screen
export function renderAdventureMenu() {
  if (!elements.adventureSelector) return;
  elements.adventureSelector.innerHTML = '';
  
  const completed = safeJsonParse('adventure_completed_scenarios', []);
  
  state.adventure.scenarios.forEach(scen => {
    const isCompleted = completed.includes(scen.id);
    const card = document.createElement('div');
    
    card.className = "p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden active:scale-98 shadow-md hover:shadow-lg " +
                     (isCompleted 
                       ? "bg-emerald-950/10 border-emerald-500/20 hover:border-emerald-500/40" 
                       : "bg-slate-900/40 border-slate-800/80 hover:border-indigo-500/30 hover:bg-slate-800/20");
    
    // Category or theme badge
    const themeIcon = getThemeIconClass(scen.theme);
    const totalXP = Object.keys(scen.nodes).length * 20;
    
    card.innerHTML = `
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-[9px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/10 flex items-center gap-1">
            <i class="${themeIcon} text-[8px]"></i> ${scen.theme}
          </span>
          ${isCompleted 
            ? `<span class="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/10 flex items-center gap-1 uppercase tracking-wider">
                 <i class="fa-solid fa-check"></i> Completed
               </span>` 
            : `<span class="text-[9px] font-bold text-slate-500 bg-slate-950/40 px-2 py-0.5 rounded border border-slate-900 uppercase tracking-wider flex items-center gap-1">
                 <i class="fa-solid fa-gamepad"></i> Active
               </span>`
          }
        </div>
        <h4 class="text-base font-extrabold text-white mt-1 group-hover:text-indigo-400 transition-colors">${scen.title}</h4>
        <p class="text-xs text-slate-400 line-clamp-2 leading-relaxed mt-1">
          Play through an interactive conversation. Master sentence structures in ${scen.difficulty}.
        </p>
      </div>
      
      <div class="flex items-center justify-between border-t border-slate-900/60 pt-4 mt-5">
        <div class="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
          <i class="fa-solid fa-comments text-indigo-400/80 text-[11px]"></i>
          <span>${Object.keys(scen.nodes).length} Rounds</span>
        </div>
        <span class="text-xs font-black font-mono text-amber-400 bg-amber-500/5 px-2 py-1 rounded-lg border border-amber-500/10 flex items-center gap-1">
          <i class="fa-solid fa-star text-[10px]"></i> +${totalXP} XP
        </span>
      </div>
    `;
    
    card.addEventListener('click', () => {
      startScenario(scen);
    });
    
    elements.adventureSelector.appendChild(card);
  });
}

// Start playing a specific adventure scenario
export function startScenario(scenario) {
  state.adventure.activeScenario = scenario;
  state.adventure.currentNode = 'start';
  state.adventure.constructedSentence = [];
  state.adventure.errorsInScenario = 0;
  
  // Set Header titles
  if (elements.adventureActiveTitle) elements.adventureActiveTitle.textContent = scenario.title;
  if (elements.adventureActiveBadge) elements.adventureActiveBadge.textContent = scenario.difficulty;
  
  // Hide panels
  if (elements.adventureFeedback) elements.adventureFeedback.classList.add('hidden');
  if (elements.adventureActionButtons) elements.adventureActionButtons.classList.remove('hidden');
  
  // Toggle visibility of board and hide selector screen
  if (elements.adventureSelectorScreen) elements.adventureSelectorScreen.classList.add('hidden');
  if (elements.adventureResults) elements.adventureResults.classList.add('hidden');
  if (elements.adventureBoard) elements.adventureBoard.classList.remove('hidden');
  
  loadAdventureNode('start');
}

// Load dialog data and scramble words for active node
export function loadAdventureNode(nodeId) {
  const scenario = state.adventure.activeScenario;
  if (!scenario || !scenario.nodes[nodeId]) {
    showAdventureResults();
    return;
  }
  
  const node = scenario.nodes[nodeId];
  state.adventure.currentNode = nodeId;
  state.adventure.currentNodeData = node;
  state.adventure.constructedSentence = [];
  
  // Reset elements
  if (elements.adventureFeedback) elements.adventureFeedback.classList.add('hidden');
  if (elements.adventureActionButtons) elements.adventureActionButtons.classList.remove('hidden');
  
  // Render npc dialogue bubble
  if (elements.adventureNpcBubble) {
    elements.adventureNpcBubble.textContent = node.npc_text;
  }
  
  // Render progress counters and bars
  const nodeKeys = Object.keys(scenario.nodes);
  const totalSteps = nodeKeys.length;
  const currentStepIndex = nodeKeys.indexOf(nodeId) + 1;
  
  if (elements.adventureProgressText) {
    elements.adventureProgressText.textContent = `Schritt ${currentStepIndex} / ${totalSteps}`;
  }
  if (elements.adventureProgressBarFill) {
    const percentage = (currentStepIndex - 1) / totalSteps * 100;
    elements.adventureProgressBarFill.style.width = `${percentage}%`;
  }
  
  // Auto-pronounce NPC line with short delay to allow audio streams to cycle
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  setTimeout(() => {
    speakText(node.npc_text, 'de-DE', 0.9);
  }, 40);
  
  // Render drops pools
  renderChipsPool(node.scrambled_chips);
  renderDropzone();
}

// Render words as active chips inside pool
export function renderChipsPool(chips) {
  if (!elements.adventureChipsPool) return;
  elements.adventureChipsPool.innerHTML = '';
  
  chips.forEach((wordText, idx) => {
    const chip = document.createElement('button');
    chip.className = "adventure-chip bg-slate-950/60 text-slate-100 hover:text-white font-medium border border-slate-800/80 text-xs px-3 py-2 rounded-xl shadow-md select-none transition-all";
    chip.textContent = wordText;
    chip.setAttribute('data-index', idx);
    
    // Filter out if currently constructed in dropzone
    const isUsed = state.adventure.constructedSentence.some(item => item.originalIndex === idx);
    if (isUsed) {
      chip.classList.add('adventure-chip-used');
    }
    
    chip.addEventListener('click', () => {
      handleChipClick(wordText, idx, chip);
    });
    
    elements.adventureChipsPool.appendChild(chip);
  });
}

// Add word chip to sentence building area
export function handleChipClick(wordText, index, chipEl) {
  if (chipEl.classList.contains('adventure-chip-used')) return;
  
  playSnapHaptic();
  
  // Add object to built list
  state.adventure.constructedSentence.push({
    word: wordText,
    originalIndex: index
  });
  
  chipEl.classList.add('adventure-chip-used');
  renderDropzone();
}

// Render dropzone container showing constructed syntax sequence
export function renderDropzone() {
  if (!elements.adventureDropzone) return;
  elements.adventureDropzone.innerHTML = '';
  
  const constructed = state.adventure.constructedSentence;
  
  if (constructed.length === 0) {
    const placeholder = document.createElement('span');
    placeholder.id = "adventure-dropzone-placeholder";
    placeholder.className = "text-slate-500 font-medium text-xs pointer-events-none";
    placeholder.textContent = "Klicken Sie auf die Chips unten, um Ihren Satz zu bauen...";
    elements.adventureDropzone.appendChild(placeholder);
    return;
  }
  
  constructed.forEach((item, dropIdx) => {
    const chip = document.createElement('button');
    chip.className = "adventure-chip bg-indigo-600/90 hover:bg-indigo-600 border border-indigo-500 hover:border-indigo-400 text-white font-bold text-xs px-3 py-2 rounded-xl shadow-lg flex items-center gap-1.5 transition-all";
    chip.innerHTML = `<span>${item.word}</span> <i class="fa-solid fa-xmark text-[10px] text-indigo-300"></i>`;
    
    chip.addEventListener('click', () => {
      removeWordFromDropzone(dropIdx);
    });
    
    elements.adventureDropzone.appendChild(chip);
  });
}

// Remove word chip from dropzone back into the pool
export function removeWordFromDropzone(dropIdx) {
  playSyntheticClickSound();
  
  const removed = state.adventure.constructedSentence.splice(dropIdx, 1)[0];
  
  // Find chip inside pool to restore pointer events
  if (elements.adventureChipsPool) {
    const chips = elements.adventureChipsPool.querySelectorAll('.adventure-chip');
    chips.forEach(chip => {
      if (parseInt(chip.getAttribute('data-index')) === removed.originalIndex) {
        chip.classList.remove('adventure-chip-used');
      }
    });
  }
  
  renderDropzone();
}

// Clear constructed sentence and reset words pool states
export function resetAdventureSentence() {
  playSyntheticClickSound();
  state.adventure.constructedSentence = [];
  
  if (elements.adventureChipsPool) {
    const chips = elements.adventureChipsPool.querySelectorAll('.adventure-chip');
    chips.forEach(chip => {
      chip.classList.remove('adventure-chip-used');
    });
  }
  
  renderDropzone();
}

// Check built word chip sequence against correct syntax
export function checkAdventureAnswer() {
  const node = state.adventure.currentNodeData;
  if (!node) return;
  
  const constructed = state.adventure.constructedSentence.map(item => item.word);
  const correct = node.correct_syntax;
  
  // Simple deep array comparison
  const isCorrect = constructed.length === correct.length && constructed.every((w, idx) => w === correct[idx]);
  
  if (isCorrect) {
    playSuccessArpeggio();
    
    // Earn 20 experience points
    addAdventureXP(20);
    
    // Show Feedback container styled with Success aesthetics
    if (elements.adventureFeedback) {
      elements.adventureFeedback.classList.remove('hidden');
      elements.adventureFeedback.className = "p-5 rounded-2xl border adventure-success-pulse flex flex-col space-y-3 bg-slate-950/60 backdrop-blur-md transition-all duration-300";
    }
    if (elements.adventureFeedbackIcon) {
      elements.adventureFeedbackIcon.className = "w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg text-lg";
      elements.adventureFeedbackIcon.innerHTML = `<i class="fa-solid fa-check"></i>`;
    }
    if (elements.adventureFeedbackTitle) {
      elements.adventureFeedbackTitle.className = "text-sm font-black text-emerald-400";
      elements.adventureFeedbackTitle.textContent = "Well done! Correct!";
    }
    if (elements.adventureFeedbackText) {
      elements.adventureFeedbackText.className = "text-xs text-slate-300 leading-relaxed";
      elements.adventureFeedbackText.textContent = `Your sentence: "${constructed.join(' ')}" is perfectly structured!`;
    }
    
    // Hide educational hint
    if (elements.adventureFeedbackTip) elements.adventureFeedbackTip.classList.add('hidden');
    
    // Hide submission actions
    if (elements.adventureActionButtons) elements.adventureActionButtons.classList.add('hidden');
    
  } else {
    playErrorGlide();
    state.adventure.errorsInScenario++;
    
    // Add horizontal shake animation to the dropzone for physical error feedback
    if (elements.adventureDropzone) {
      elements.adventureDropzone.classList.add('shake-anim');
      setTimeout(() => {
        if (elements.adventureDropzone) {
          elements.adventureDropzone.classList.remove('shake-anim');
        }
      }, 500);
    }
    
    // Show Feedback container styled with Warning/Error aesthetics
    if (elements.adventureFeedback) {
      elements.adventureFeedback.classList.remove('hidden');
      elements.adventureFeedback.className = "p-5 rounded-2xl border adventure-error-pulse flex flex-col space-y-3 bg-slate-950/60 backdrop-blur-md transition-all duration-300";
    }
    if (elements.adventureFeedbackIcon) {
      elements.adventureFeedbackIcon.className = "w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 shadow-lg text-lg";
      elements.adventureFeedbackIcon.innerHTML = `<i class="fa-solid fa-xmark"></i>`;
    }
    if (elements.adventureFeedbackTitle) {
      elements.adventureFeedbackTitle.className = "text-sm font-black text-rose-400";
      elements.adventureFeedbackTitle.textContent = "Not quite correct yet...";
    }
    if (elements.adventureFeedbackText) {
      elements.adventureFeedbackText.className = "text-xs text-slate-300 leading-relaxed";
      elements.adventureFeedbackText.textContent = constructed.length > 0
        ? `Your sentence: "${constructed.join(' ')}" has grammatical errors. Try again!`
        : "You haven't selected any words yet! Please build your sentence first.";
    }
    
    // Reveal Grammatik-Tipp Panel
    if (node.hint && elements.adventureFeedbackTip && elements.adventureFeedbackTipText) {
      elements.adventureFeedbackTipText.textContent = node.hint;
      elements.adventureFeedbackTip.classList.remove('hidden');
    }
  }
}

// Add XP points and persist to localStorage
export function addAdventureXP(amount) {
  if (state.focus && state.focus.xpMultiplierActive) {
    amount = Math.round(amount * 1.25);
  }
  let currentXP = parseInt(safeGetItem('adventure_xp', '0'), 10) || 0;
  currentXP += amount;
  safeSetItem('adventure_xp', String(currentXP));
  
  if (state.adventure) {
    state.adventure.xp = currentXP;
  }
  
  // Bump animation for indicator
  if (elements.adventureXpCounter) {
    elements.adventureXpCounter.textContent = `${currentXP} XP`;
    elements.adventureXpCounter.classList.add('scale-110', 'text-amber-400');
    setTimeout(() => {
      elements.adventureXpCounter.classList.remove('scale-110', 'text-amber-400');
    }, 400);
  }
}

// Transition to the next branching dialogue node or end scenario
export function nextAdventureNode() {
  const scenario = state.adventure.activeScenario;
  const node = state.adventure.currentNodeData;
  if (!scenario || !node) return;
  
  const nextNodeId = node.next_node;
  if (nextNodeId === 'end') {
    showAdventureResults();
  } else {
    loadAdventureNode(nextNodeId);
  }
}

// Display completion screen and summary statistics
export function showAdventureResults() {
  const scenario = state.adventure.activeScenario;
  if (!scenario) return;
  
  // Hide active boards
  if (elements.adventureBoard) elements.adventureBoard.classList.add('hidden');
  
  // Calculate score properties
  const nodeCount = Object.keys(scenario.nodes).length;
  const scenarioXP = nodeCount * 20;
  
  // Save scenario completed tag
  let completed = safeJsonParse('adventure_completed_scenarios', []);
  if (!completed.includes(scenario.id)) {
    completed.push(scenario.id);
    safeSetItem('adventure_completed_scenarios', JSON.stringify(completed));
    state.adventure.completedScenarios = completed;
  }
  
  // Onboarding: Adventurer — first scenario completion
  window.dispatchEvent(new CustomEvent('srs:achievement', { detail: { id: 'adventurer' } }));
  
  // Calculate precision percent
  const errors = state.adventure.errorsInScenario || 0;
  const totalAttempts = nodeCount + errors;
  const precision = Math.max(0, Math.round((nodeCount / totalAttempts) * 100));
  
  // Show results view
  if (elements.adventureResults) {
    elements.adventureResults.classList.remove('hidden');
  }
  if (elements.adventureResultsXp) {
    elements.adventureResultsXp.textContent = `+${scenarioXP} XP`;
  }
  
  // Render precision metric into results card
  if (elements.adventureResults) {
    const precisionEl = elements.adventureResults.querySelector('.text-emerald-400');
    if (precisionEl) {
      precisionEl.textContent = `${precision}%`;
      if (precision < 80) {
        precisionEl.className = "text-xl font-black font-mono text-amber-500 mt-1";
      } else {
        precisionEl.className = "text-xl font-black font-mono text-emerald-400 mt-1";
      }
    }
  }
  
  // Play triumphant finish chime
  playEpicArpeggio();
}

// Quit scenario and return to scenario selector screen
export function quitAdventureScenario() {
  state.adventure.activeScenario = null;
  state.adventure.currentNode = null;
  state.adventure.constructedSentence = [];
  
  if (elements.adventureBoard) elements.adventureBoard.classList.add('hidden');
  if (elements.adventureResults) elements.adventureResults.classList.add('hidden');
  if (elements.adventureSelectorScreen) elements.adventureSelectorScreen.classList.remove('hidden');
  
  // Use cached scenarios instead of re-fetching JSON (initAdventureView would re-fetch)
  if (state.adventure.scenarios && state.adventure.scenarios.length > 0) {
    renderAdventureMenu();
  } else {
    initAdventureView();
  }
}

// Pronounce current Dialog text via German client SpeechSynthesis
export function speakAdventureNpcSentence() {
  const node = state.adventure.currentNodeData;
  if (node && node.npc_text) {
    speakText(node.npc_text, 'de-DE', 0.9);
  }
}
