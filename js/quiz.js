// js/quiz.js — Interactive Quiz & Spelling Arena Module

import { state, elements, shuffleArray, safeSetItem, safeGetItem, escapeHtml } from './state.js';
import { speakText, playSuccessArpeggio, playErrorGlide } from './audio.js';
import { unlockAchievement } from './stats.js';

// escapeHtml imported from state.js (shared utility)

// Pre-built distractor indexes (populated once per quiz session)
let categoryIndex = null;  // Map<category, card[]>
let wordClassIndex = null; // Map<wordClass, card[]>
let allCardsExclude = null; // Full card pool for universal fallback

// Initialize/Reset the Quiz View Dashboard
export function initQuizView() {
  state.quiz.active = false;
  state.quiz.mode = null;
  state.quiz.questions = [];
  state.quiz.currentQuestionIndex = 0;
  state.quiz.score = 0;
  state.quiz.isAnswered = false;
  state.quiz.currentQuestion = null;

  // Retrieve streaks from local storage
  state.quiz.streak = parseInt(safeGetItem('quiz_streak', '0'), 10) || 0;
  state.quiz.bestStreak = parseInt(safeGetItem('quiz_best_streak', '0'), 10) || 0;

  // Update streak metrics UI
  if (elements.quizStreakCounter) elements.quizStreakCounter.textContent = state.quiz.streak;
  if (elements.quizBestStreak) elements.quizBestStreak.textContent = state.quiz.bestStreak;

  // Reset container visibility states
  if (elements.quizModeSelector) elements.quizModeSelector.classList.remove('hidden');
  if (elements.quizWorkspace) elements.quizWorkspace.classList.add('hidden');
  if (elements.quizResults) elements.quizResults.classList.add('hidden');
  if (elements.quizFeedbackPanel) elements.quizFeedbackPanel.classList.add('hidden');
}

// Start a quiz session in either 'mc' or 'spelling' mode
export function initQuiz(mode) {
  // Determine card pool (fallback to overall deck if category filter is too small)
  let quizPool = state.filteredCards.length >= 5 ? [...state.filteredCards] : [...state.allCards];
  
  if (quizPool.length === 0) {
    // Show non-blocking error in quiz workspace instead of thread-blocking alert()
    if (elements.quizOptionsContainer) {
      elements.quizOptionsContainer.innerHTML = `
        <div class="col-span-2 bg-rose-950/20 border border-rose-500/20 rounded-2xl p-6 text-center text-rose-300">
          <i class="fa-solid fa-triangle-exclamation text-2xl mb-2 text-rose-400" aria-hidden="true"></i>
          <p class="font-extrabold text-sm">No vocabulary cards available in the current deck!</p>
          <p class="text-xs text-rose-400 mt-1">Please select another category or a different CEFR level.</p>
        </div>`;
    }
    return;
  }

  // Shuffle pool and select first set of items
  const shuffledPool = shuffleArray([...quizPool]);
  
  const selectedLengthVal = elements.quizLengthSelect ? elements.quizLengthSelect.value : '10';
  if (selectedLengthVal === 'endless') {
    state.quiz.isEndless = true;
    state.quiz.roundLength = shuffledPool.length; // use all cards initially
    state.quiz.questions = [...shuffledPool];
  } else {
    state.quiz.isEndless = false;
    state.quiz.roundLength = parseInt(selectedLengthVal) || 10;
    state.quiz.questions = shuffledPool.slice(0, Math.min(state.quiz.roundLength, shuffledPool.length));
  }

  // Set active state variables
  state.quiz.active = true;
  state.quiz.mode = mode;
  state.quiz.currentQuestionIndex = 0;
  state.quiz.score = 0;
  state.quiz.totalAnswered = 0; // F29: Track total answers across buffer refills
  state.quiz.isAnswered = false;
  
  // Build distractor indexes once per quiz session for O(1) lookups
  categoryIndex = new Map();
  wordClassIndex = new Map();
  state.allCards.forEach(card => {
    // Category index
    if (!categoryIndex.has(card.category)) {
      categoryIndex.set(card.category, []);
    }
    categoryIndex.get(card.category).push(card);
    // WordClass index
    if (card.wordClass) {
      if (!wordClassIndex.has(card.wordClass)) {
        wordClassIndex.set(card.wordClass, []);
      }
      wordClassIndex.get(card.wordClass).push(card);
    }
  });

  // Hide mode selector and results, show game workspace
  if (elements.quizModeSelector) elements.quizModeSelector.classList.add('hidden');
  if (elements.quizResults) elements.quizResults.classList.add('hidden');
  if (elements.quizWorkspace) elements.quizWorkspace.classList.remove('hidden');

  // Update game mode badge text
  if (elements.quizModeBadge) {
    elements.quizModeBadge.textContent = mode === 'mc' ? 'Vocabulary Quiz (Multiple-Choice)' : 'Spelling Arena (Spelling Test)';
  }

  // Load first question
  loadQuizQuestion();
}

// Load and render the active question in the workspace
export function loadQuizQuestion() {
  const currentIdx = state.quiz.currentQuestionIndex;
  const qCard = state.quiz.questions[currentIdx];
  state.quiz.currentQuestion = qCard;
  state.quiz.isAnswered = false;

  // 1. Progress meters
  if (elements.quizProgressText) {
    if (state.quiz.isEndless) {
      elements.quizProgressText.textContent = `Question ${currentIdx + 1} (Endless Mode)`;
    } else {
      elements.quizProgressText.textContent = `Question ${currentIdx + 1} of ${state.quiz.questions.length}`;
    }
  }

  if (elements.quizProgressBarFill) {
    const pct = state.quiz.isEndless ? 50 : ((currentIdx / state.quiz.questions.length) * 100);
    elements.quizProgressBarFill.style.width = `${pct}%`;
  }

  // Toggle Finish Early button based on isEndless
  if (elements.quizFinishEarlyBtn) {
    if (state.quiz.isEndless) {
      elements.quizFinishEarlyBtn.classList.remove('hidden');
    } else {
      elements.quizFinishEarlyBtn.classList.add('hidden');
    }
  }

  // Hide feedback panel and next button initially
  if (elements.quizFeedbackPanel) elements.quizFeedbackPanel.classList.add('hidden');
  if (elements.quizNextQuestionBtn) elements.quizNextQuestionBtn.classList.add('hidden');

  // Handle card illustration (restricted to Level A1 WebP cards 1-160; disabled for V1.0.0, coming in V1.0.1)
  if (elements.quizCardImageContainer && elements.quizCardImage) {
    const activeImage = qCard.image_path || qCard.image;
    const isImageAllowed = (state.currentLevel === 'a1' || state.currentLevel === 'a2');
    if (state.showImages && isImageAllowed) {
      elements.quizCardImage.src = state.currentLevel + '/' + activeImage;
      elements.quizCardImageContainer.classList.remove('hidden');
    } else {
      elements.quizCardImageContainer.classList.add('hidden');
    }
  }

  // Handle word class indicator
  if (elements.quizWordClass) {
    elements.quizWordClass.textContent = qCard.wordClass || '';
  }

  // Mode-specific layouts
  if (state.quiz.mode === 'mc') {
    // Show MC options, hide spelling
    if (elements.quizOptionsContainer) elements.quizOptionsContainer.classList.remove('hidden');
    if (elements.quizSpellingContainer) elements.quizSpellingContainer.classList.add('hidden');

    // Randomize testing direction for MC
    qCard.direction = Math.random() < 0.5 ? 'de-to-en' : 'en-to-de';

    if (qCard.direction === 'de-to-en') {
      if (elements.quizQuestionPrompt) elements.quizQuestionPrompt.textContent = qCard.word;
      if (elements.quizQuestionSubprompt) elements.quizQuestionSubprompt.textContent = 'Choose the English meaning';
    } else {
      if (elements.quizQuestionPrompt) elements.quizQuestionPrompt.textContent = qCard.meaning;
      if (elements.quizQuestionSubprompt) elements.quizQuestionSubprompt.textContent = 'Choose the matching German word';
    }

    // Compile 4 MC choices
    generateMCOptions(qCard, qCard.direction);

  } else {
    // Show spelling input, hide MC
    if (elements.quizOptionsContainer) elements.quizOptionsContainer.classList.add('hidden');
    if (elements.quizSpellingContainer) elements.quizSpellingContainer.classList.remove('hidden');

    // Render English definition and prompt spelling the German headword
    if (elements.quizQuestionPrompt) elements.quizQuestionPrompt.textContent = qCard.meaning;

    // Set appropriate placeholder text / prompt hints for article-based nouns
    let promptHint = 'Type the German translation';
    if (qCard.wordClass === 'Nomen' && qCard.gender) {
      promptHint = `Type the noun with correct article (${qCard.gender})`;
    }
    if (elements.quizQuestionSubprompt) elements.quizQuestionSubprompt.textContent = promptHint;

    // Reset spelling text field
    if (elements.quizSpellingInput) {
      elements.quizSpellingInput.value = '';
      elements.quizSpellingInput.disabled = false;
      elements.quizSpellingInput.classList.remove('border-emerald-500', 'bg-emerald-950/15', 'border-rose-500', 'bg-rose-950/15');
      elements.quizSpellingInput.parentElement.classList.remove('shake-anim');
      setTimeout(() => elements.quizSpellingInput.focus(), 50);
    }

    if (elements.quizSpellingSubmit) {
      elements.quizSpellingSubmit.disabled = false;
      elements.quizSpellingSubmit.classList.remove('opacity-40', 'cursor-not-allowed');
    }
  }
}

// Generate correct option and smart distractors for Multiple Choice
export function generateMCOptions(qCard, direction) {
  if (!elements.quizOptionsContainer) return;
  elements.quizOptionsContainer.innerHTML = '';

  const getDistractors = () => {
    // O(1) distractor pool lookup via pre-built indexes
    let pool = (categoryIndex && categoryIndex.get(qCard.category) || []).filter(c => c.id !== qCard.id);
    
    // Fallback: search same word-class if category has insufficient entries
    if (pool.length < 3 && qCard.wordClass) {
      pool = (wordClassIndex && wordClassIndex.get(qCard.wordClass) || []).filter(c => c.id !== qCard.id);
    }
    
    // Fallback secondary: sample any other card
    if (pool.length < 3) {
      pool = state.allCards.filter(c => c.id !== qCard.id);
    }

    // F6: Reservoir sampling — O(k) random selection instead of O(n) full shuffle
    const count = Math.min(3, pool.length);
    const result = [];
    const seen = new Set();
    let attempts = 0;
    while (result.length < count && attempts < count * 10) {
      attempts++;
      const idx = Math.floor(Math.random() * pool.length);
      if (!seen.has(idx)) {
        seen.add(idx);
        result.push(pool[idx]);
      }
    }
    return result;
  };

  const distractors = getDistractors();
  const options = [];

  if (direction === 'de-to-en') {
    // Options are English meanings
    options.push({ text: qCard.meaning, isCorrect: true, card: qCard });
    distractors.forEach(d => {
      options.push({ text: d.meaning, isCorrect: false, card: d });
    });
  } else {
    // Options are German words
    options.push({ text: qCard.word, isCorrect: true, card: qCard });
    distractors.forEach(d => {
      options.push({ text: d.word, isCorrect: false, card: d });
    });
  }

  // Shuffle option array so correct answer is at a random index
  const shuffledOptions = shuffleArray(options);
  state.quiz.options = shuffledOptions; // Cache for keyboard shortcuts

  // Render option buttons
  shuffledOptions.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = "quiz-opt-btn quiz-option-btn w-full text-left p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all duration-200 text-slate-100 flex items-center justify-between font-medium group focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";
    
    btn.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="w-7 h-7 rounded-lg bg-white/10 group-hover:bg-indigo-500/20 group-hover:text-indigo-400 flex items-center justify-center text-xs font-bold border border-white/5 transition-colors">${idx + 1}</span>
        <span class="text-base">${escapeHtml(opt.text)}</span>
      </div>
      <i class="fa-solid fa-chevron-right text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all"></i>
    `;

    btn.addEventListener('click', () => handleMCOptionClick(opt, btn));
    elements.quizOptionsContainer.appendChild(btn);
  });
}

// Handle Multiple Choice click selection
export function handleMCOptionClick(opt, clickedBtn) {
  if (state.quiz.isAnswered) return;
  state.quiz.isAnswered = true;

  const buttons = elements.quizOptionsContainer.querySelectorAll('.quiz-opt-btn');
  buttons.forEach(b => {
    b.disabled = true;
    b.classList.remove('hover:bg-white/10', 'active:scale-[0.98]');
  });

  const qCard = state.quiz.currentQuestion;
  const isCorrect = opt.isCorrect;

  if (isCorrect) {
    // C3: Haptic feedback on correct answer (short pulse)
    if (navigator.vibrate) navigator.vibrate(30);
    playSuccessArpeggio();
    if (typeof window.triggerParticleBurst === 'function' && clickedBtn) {
      const rect = clickedBtn.getBoundingClientRect();
      window.triggerParticleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
    state.quiz.score++;
    state.quiz.streak++;
    if (state.quiz.streak > state.quiz.bestStreak) {
      state.quiz.bestStreak = state.quiz.streak;
      safeSetItem('quiz_best_streak', state.quiz.bestStreak);
    }
    safeSetItem('quiz_streak', state.quiz.streak);

    clickedBtn.classList.remove('border-white/10', 'bg-white/5');
    clickedBtn.classList.add('border-emerald-500', 'bg-emerald-950/20', 'text-emerald-400');
    clickedBtn.querySelector('span').classList.add('bg-emerald-500/20', 'text-emerald-400');

    // Show correct feedback
    if (elements.quizFeedbackPanel) {
      elements.quizFeedbackIcon.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-500 text-3xl"></i>';
      elements.quizFeedbackTitle.textContent = 'Correct!';
      elements.quizFeedbackTitle.className = 'text-lg font-bold text-emerald-400 font-display';
      elements.quizFeedbackPanel.className = 'mt-6 p-4 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 flex items-start gap-4 transition-all duration-300';
      
      let feedbackHtml = `<strong>${escapeHtml(qCard.word)}</strong>: ${escapeHtml(qCard.meaning)}`;
      if (qCard.exampleDe) {
        feedbackHtml += `<br><span class="text-xs text-slate-400 font-normal italic mt-1 block">"${escapeHtml(qCard.exampleDe)}" ${qCard.exampleEn ? `(${escapeHtml(qCard.exampleEn)})` : ''}</span>`;
      }
      elements.quizFeedbackText.innerHTML = feedbackHtml;
      elements.quizFeedbackPanel.classList.remove('hidden');
    }

    if (state.quiz.streak >= 10) {
      unlockAchievement('streak_master');
    }
  } else {
    state.quiz.streak = 0;
    safeSetItem('quiz_streak', 0);
    // C3: Haptic feedback on wrong answer (double buzz)
    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
    playErrorGlide();

    clickedBtn.classList.remove('border-white/10', 'bg-white/5');
    clickedBtn.classList.add('border-rose-500', 'bg-rose-950/20', 'text-rose-400', 'shake-anim');
    clickedBtn.querySelector('span').classList.add('bg-rose-500/20', 'text-rose-400');

    // Highlight correct option
    buttons.forEach(b => {
      const optText = b.querySelector('.text-base').textContent;
      const correctText = qCard.direction === 'de-to-en' ? qCard.meaning : qCard.word;
      if (optText === correctText) {
        b.classList.add('border-emerald-500/50', 'bg-emerald-950/10', 'text-emerald-500/80');
      }
    });

    // Show wrong feedback
    if (elements.quizFeedbackPanel) {
      elements.quizFeedbackIcon.innerHTML = '<i class="fa-solid fa-circle-xmark text-rose-500 text-3xl"></i>';
      elements.quizFeedbackTitle.textContent = 'Incorrect';
      elements.quizFeedbackTitle.className = 'text-lg font-bold text-rose-400 font-display';
      elements.quizFeedbackPanel.className = 'mt-6 p-4 rounded-2xl border border-rose-500/20 bg-rose-950/10 flex items-start gap-4 transition-all duration-300';
      
      let feedbackHtml = `<strong>${escapeHtml(qCard.word)}</strong>: ${escapeHtml(qCard.meaning)}`;
      if (qCard.exampleDe) {
        feedbackHtml += `<br><span class="text-xs text-slate-400 font-normal italic mt-1 block">"${escapeHtml(qCard.exampleDe)}" ${qCard.exampleEn ? `(${escapeHtml(qCard.exampleEn)})` : ''}</span>`;
      }
      elements.quizFeedbackText.innerHTML = feedbackHtml;
      elements.quizFeedbackPanel.classList.remove('hidden');
    }
  }

  // Update streak metrics UI
  if (elements.quizStreakCounter) elements.quizStreakCounter.textContent = state.quiz.streak;
  if (elements.quizBestStreak) elements.quizBestStreak.textContent = state.quiz.bestStreak;

  // Audio output
  if (qCard.word) {
    speakText(qCard.word, 'de');
  }

  if (elements.quizNextQuestionBtn) elements.quizNextQuestionBtn.classList.remove('hidden');
}

// Handle Spelling spelling check
export function checkSpellingAnswer() {
  if (state.quiz.isAnswered) return;
  state.quiz.isAnswered = true;

  const typed = elements.quizSpellingInput ? elements.quizSpellingInput.value.trim() : '';
  const qCard = state.quiz.currentQuestion;
  const correct = qCard.word.trim();

  // Normalize comparisons (case-insensitive, whitespace collapsed)
  const normTyped = typed.toLowerCase().replace(/\s+/g, ' ');
  const normCorrect = correct.toLowerCase().replace(/\s+/g, ' ');

  const isCorrect = normTyped === normCorrect;

  // Disable spelling controls
  if (elements.quizSpellingInput) elements.quizSpellingInput.disabled = true;
  if (elements.quizSpellingSubmit) {
    elements.quizSpellingSubmit.disabled = true;
    elements.quizSpellingSubmit.classList.add('opacity-40', 'cursor-not-allowed');
  }

  if (isCorrect) {
    playSuccessArpeggio();
    if (typeof window.triggerParticleBurst === 'function' && elements.quizSpellingInput) {
      const rect = elements.quizSpellingInput.getBoundingClientRect();
      window.triggerParticleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
    state.quiz.score++;
    state.quiz.streak++;
    if (state.quiz.streak > state.quiz.bestStreak) {
      state.quiz.bestStreak = state.quiz.streak;
      safeSetItem('quiz_best_streak', state.quiz.bestStreak);
    }
    safeSetItem('quiz_streak', state.quiz.streak);

    if (elements.quizSpellingInput) {
      elements.quizSpellingInput.classList.add('border-emerald-500', 'bg-emerald-950/15');
    }

    if (elements.quizFeedbackPanel) {
      elements.quizFeedbackIcon.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-500 text-3xl"></i>';
      elements.quizFeedbackTitle.textContent = 'Correct!';
      elements.quizFeedbackTitle.className = 'text-lg font-bold text-emerald-400 font-display';
      elements.quizFeedbackPanel.className = 'mt-6 p-4 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 flex items-start gap-4 transition-all duration-300';
      
      let feedbackHtml = `<strong>${escapeHtml(qCard.word)}</strong>: ${escapeHtml(qCard.meaning)}`;
      if (qCard.exampleDe) {
        feedbackHtml += `<br><span class="text-xs text-slate-400 font-normal italic mt-1 block">"${escapeHtml(qCard.exampleDe)}" ${qCard.exampleEn ? `(${escapeHtml(qCard.exampleEn)})` : ''}</span>`;
      }
      elements.quizFeedbackText.innerHTML = feedbackHtml;
      elements.quizFeedbackPanel.classList.remove('hidden');
    }

    if (state.quiz.streak >= 10) {
      unlockAchievement('streak_master');
    }
  } else {
    state.quiz.streak = 0;
    safeSetItem('quiz_streak', 0);
    playErrorGlide();

    if (elements.quizSpellingInput) {
      elements.quizSpellingInput.classList.add('border-rose-500', 'bg-rose-950/15');
      elements.quizSpellingInput.parentElement.classList.add('shake-anim');
    }

    if (elements.quizFeedbackPanel) {
      elements.quizFeedbackIcon.innerHTML = '<i class="fa-solid fa-circle-xmark text-rose-500 text-3xl"></i>';
      elements.quizFeedbackTitle.textContent = 'Incorrect';
      elements.quizFeedbackTitle.className = 'text-lg font-bold text-rose-400 font-display';
      elements.quizFeedbackPanel.className = 'mt-6 p-4 rounded-2xl border border-rose-500/20 bg-rose-950/10 flex items-start gap-4 transition-all duration-300';
      
      let feedbackHtml = `Your Input: <span class="line-through text-rose-400">${escapeHtml(typed) || '(empty)'}</span><br>Correct Answer: <span class="font-extrabold text-emerald-400">${escapeHtml(correct)}</span>`;
      if (qCard.exampleDe) {
        feedbackHtml += `<br><span class="text-xs text-slate-400 font-normal italic mt-1 block">"${escapeHtml(qCard.exampleDe)}" ${qCard.exampleEn ? `(${escapeHtml(qCard.exampleEn)})` : ''}</span>`;
      }
      elements.quizFeedbackText.innerHTML = feedbackHtml;
      elements.quizFeedbackPanel.classList.remove('hidden');
    }
  }

  // Update streak metrics UI
  if (elements.quizStreakCounter) elements.quizStreakCounter.textContent = state.quiz.streak;
  if (elements.quizBestStreak) elements.quizBestStreak.textContent = state.quiz.bestStreak;

  // Speak correct word
  speakText(correct, 'de');

  if (elements.quizNextQuestionBtn) elements.quizNextQuestionBtn.classList.remove('hidden');
}

// Proceed to next question or terminate round
export function nextQuizQuestion() {
  state.quiz.currentQuestionIndex++;
  state.quiz.totalAnswered = (state.quiz.totalAnswered || 0) + 1; // F29: Increment total counter

  if (state.quiz.isEndless) {
    // Endless mode: circular buffer — prune consumed questions and refill
    if (state.quiz.currentQuestionIndex >= state.quiz.questions.length - 2) {
      let quizPool = state.filteredCards.length >= 5 ? [...state.filteredCards] : [...state.allCards];
      if (quizPool.length > 0) {
        // Prune all consumed questions except the current one to prevent unbounded growth
        const remaining = state.quiz.questions.slice(state.quiz.currentQuestionIndex);
        state.quiz.questions = remaining.concat(shuffleArray([...quizPool]));
        state.quiz.currentQuestionIndex = 0;
      }
    }
    
    // F29: Marathon Achievement Unlock Check — use totalAnswered (survives buffer refills)
    if (state.quiz.totalAnswered >= 30) {
      unlockAchievement('marathon');
    }

    loadQuizQuestion();
  } else {
    // Fixed length mode
    if (state.quiz.currentQuestionIndex >= state.quiz.questions.length) {
      showQuizResults();
    } else {
      loadQuizQuestion();
    }
  }
}

// Display summary results sheet
export function showQuizResults() {
  state.quiz.active = false;

  if (elements.quizWorkspace) elements.quizWorkspace.classList.add('hidden');
  if (elements.quizFeedbackPanel) elements.quizFeedbackPanel.classList.add('hidden');
  if (elements.quizResults) elements.quizResults.classList.remove('hidden');

  // Calculate stats based on active questions played
  const total = state.quiz.isEndless ? state.quiz.currentQuestionIndex : state.quiz.questions.length;
  const score = state.quiz.score;
  const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;

  if (elements.quizStatsScore) {
    elements.quizStatsScore.textContent = `${score} / ${total}`;
  }
  if (elements.quizStatsAccuracy) {
    elements.quizStatsAccuracy.textContent = `${accuracy}%`;
  }

  // Perfect Score Achievement check
  if (accuracy === 100 && total >= 10) {
    unlockAchievement('perfect_score');
  }

  // Onboarding: Quiz Rookie — first quiz completion with 5+ questions
  if (total >= 5) {
    unlockAchievement('quiz_rookie');
  }

  // Marathon check at finish early
  if (total >= 30) {
    unlockAchievement('marathon');
  }
}

// Reset variables and replay active mode
export function retryQuiz() {
  if (elements.quizResults) elements.quizResults.classList.add('hidden');
  initQuiz(state.quiz.mode);
}

// Cancel the quiz and return to selection screen
export function quitQuiz() {
  initQuizView();
}
