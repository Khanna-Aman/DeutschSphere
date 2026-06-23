// js/stats.js — Profile Statistics, Achievements & Backup Module

import { state, elements, ACHIEVEMENTS, getGlobalLearnedCount, getLearnedCountForLevel, getCategoryIcon, getSRSInfo, safeJsonParse, safeSetItem, safeGetItem, getStreakInfo } from './state.js';
import { fsrs, State as FSRSState, Rating } from './fsrs.js';
import { playAchievementChime } from './audio.js';
import * as idb from './idb-keyval.js';

// Global static totals for official CEFR curriculum tiers
export const CEFR_LEVEL_TOTALS = { a1: 640, a2: 1142, b1: 2139 };

// Color map for premium parts of speech bars
export const WORD_CLASS_COLORS = {
  'Nomen': 'bg-pink-500',
  'Verb': 'bg-indigo-500',
  'Adjektiv': 'bg-purple-500',
  'Adverb': 'bg-amber-500',
  'Andere': 'bg-slate-500'
};

// Unlock a specific achievement by ID
export function unlockAchievement(id) {
  let unlocked = safeJsonParse('unlocked_achievements', []);
  if (unlocked.includes(id)) return; // already unlocked
  
  unlocked.push(id);
  safeSetItem('unlocked_achievements', JSON.stringify(unlocked));
  
  const ach = ACHIEVEMENTS.find(a => a.id === id);
  if (!ach) return;
  
  playAchievementChime();
  
  const toast = document.getElementById('achievement-toast');
  const toastTitle = document.getElementById('achievement-toast-title');
  const toastDesc = document.getElementById('achievement-toast-desc');
  
  if (toast && toastTitle && toastDesc) {
    toastTitle.textContent = ach.title;
    toastDesc.textContent = ach.desc;
    
    toast.classList.remove('translate-y-[150%]', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
    
    // Trigger cascading celebratory particle bursts and premium animations
    if (typeof window.triggerParticleBurst === 'function') {
      window.triggerParticleBurst(window.innerWidth / 2, window.innerHeight / 3);
      setTimeout(() => window.triggerParticleBurst(window.innerWidth / 3, window.innerHeight / 2), 200);
      setTimeout(() => window.triggerParticleBurst(window.innerWidth * 2 / 3, window.innerHeight / 2), 400);
    }
    if (typeof window.triggerPremiumAnimation === 'function') {
      window.triggerPremiumAnimation('achievement');
    }
    
    setTimeout(() => {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('translate-y-[150%]', 'opacity-0');
    }, 4000);
  }
  
  if (window.location.hash === '#/stats') {
    renderAchievementsGrid();
  }
}

// Render the achievements grid inside the stats page
export function renderAchievementsGrid() {
  const grid = document.getElementById('achievements-grid');
  if (!grid) return;
  
  grid.innerHTML = '';
  
  const unlocked = safeJsonParse('unlocked_achievements', []);
  
  ACHIEVEMENTS.forEach(ach => {
    const isUnlocked = unlocked.includes(ach.id);
    const card = document.createElement('div');
    
    if (isUnlocked) {
      card.className = "bg-slate-950/40 border border-amber-500/40 rounded-xl p-4 flex flex-col items-center text-center relative group overflow-hidden shadow-lg shadow-amber-500/5 transition-all duration-300 hover:scale-[1.03]";
      card.innerHTML = `
        <div class="absolute inset-0 bg-gradient-to-b from-amber-500/[0.03] to-transparent pointer-events-none"></div>
        <div class="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center ${ach.color} text-lg mb-3 shadow-md shadow-amber-500/10">
          <i class="${ach.icon}"></i>
        </div>
        <span class="font-display font-bold text-xs text-amber-400 truncate w-full">${ach.title}</span>
        <span class="text-[9px] text-slate-400 mt-1 leading-normal">${ach.desc}</span>
        <span class="absolute top-2 right-2 text-[8px] font-extrabold text-amber-500 uppercase tracking-widest bg-amber-500/10 px-1 rounded border border-amber-500/20">Freigeschaltet</span>
      `;
    } else {
      card.className = "bg-slate-950/20 border border-slate-900 rounded-xl p-4 flex flex-col items-center text-center opacity-40 select-none";
      card.innerHTML = `
        <div class="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 text-lg mb-3">
          <i class="fa-solid fa-lock"></i>
        </div>
        <span class="font-display font-bold text-xs text-slate-500 truncate w-full">${ach.title}</span>
        <span class="text-[9px] text-slate-500 mt-1 leading-normal">${ach.desc}</span>
      `;
    }
    
    grid.appendChild(card);
  });
}

// Initialize and render all premium glassmorphic statistics widgets
export function initStatsView() {
  const totalCount = state.allCards.length;
  const learnedCount = state.learnedCards.size;
  
  let masteredCount = 0;
  let dueCount = 0;
  
  // FSRS State Distribution (replaces 5-box Leitner chart)
  const fsrsStateCounts = { new: 0, learning: 0, review: 0, mastered: 0 };
  const partsOfSpeechCounts = {};
  const categoryStats = {};
  const timelineCounts = [0, 0, 0, 0, 0, 0, 0, 0]; // Day 0 to Day 7
  const now = Date.now();
  
  // Collect weak words (high difficulty or low retrievability)
  const weakWords = [];
  
  // Retention tracking
  let totalRetrievability = 0;
  let reviewedCardCount = 0;
  
  // 1. Calculate active level metrics and distributions
  state.allCards.forEach(c => {
    const info = getSRSInfo(c.id);
    
    // FSRS State Distribution
    if (info.state === FSRSState.New || info.isNew) {
      fsrsStateCounts.new++;
    } else if (info.state === FSRSState.Learning || info.state === FSRSState.Relearning) {
      fsrsStateCounts.learning++;
    } else if (info.state === FSRSState.Review) {
      if (info.stability >= 15) {
        fsrsStateCounts.mastered++;
        masteredCount++;
      } else {
        fsrsStateCounts.review++;
      }
    }
    
    // Legacy: count mastered (box 5) for backward compat display
    if (info.box === 5) masteredCount = Math.max(masteredCount, fsrsStateCounts.mastered);
    
    // Due reviews (scheduled & overdue, excluding new cards)
    if (!info.isNew && info.isDue) {
      dueCount++;
    }
    
    // Retention tracking for reviewed cards
    if (!info.isNew && info.state !== FSRSState.New) {
      totalRetrievability += info.retrievability;
      reviewedCardCount++;
    }
    
    // Weak words: difficulty > 7 or retrievability < 0.5 (only for reviewed cards)
    if (!info.isNew && info.state !== FSRSState.New) {
      if (info.difficulty > 7 || (info.retrievability > 0 && info.retrievability < 0.5)) {
        weakWords.push({
          word: c.word,
          meaning: c.meaning,
          difficulty: info.difficulty,
          retrievability: info.retrievability,
          stability: info.stability,
          lapses: info.lapses
        });
      }
    }
    
    // Bin forecast counts for 7-day timeline forecast
    if (info.isNew || info.isDue) {
      timelineCounts[0]++;
    } else {
      const diffMs = info.nextReview - now;
      if (diffMs <= 0) {
        timelineCounts[0]++;
      } else {
        const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
        if (diffDays >= 0 && diffDays < 7) {
          timelineCounts[diffDays + 1]++;
        }
      }
    }
    
    // Parts of speech distribution
    const wc = c.wordClass || 'Andere';
    partsOfSpeechCounts[wc] = (partsOfSpeechCounts[wc] || 0) + 1;
    
    // Categories distribution
    const cat = c.category || 'Allgemein';
    if (!categoryStats[cat]) {
      categoryStats[cat] = { total: 0, learned: 0 };
    }
    categoryStats[cat].total++;
    
    const hasLearned = state.learnedCards.has(Number(c.id));
    if (hasLearned) {
      categoryStats[cat].learned++;
    }
  });
  
  // Calculate retention rate
  const retentionRate = reviewedCardCount > 0
    ? Math.round((totalRetrievability / reviewedCardCount) * 100)
    : 0;
  
  // Sort weak words by retrievability (lowest first)
  weakWords.sort((a, b) => a.retrievability - b.retrievability);
  
  // 2. Render primary quick metric cards
  if (elements.statsMasteredCount) elements.statsMasteredCount.textContent = masteredCount;
  if (elements.statsLearnedCount) elements.statsLearnedCount.textContent = learnedCount;
  
  // Show daily study streak instead of quiz streak
  if (elements.statsStreakCount) {
    const streakInfo = getStreakInfo();
    elements.statsStreakCount.textContent = streakInfo.current || 0;
  }
  if (elements.statsDueCount) elements.statsDueCount.textContent = dueCount;
  
  // 3. Render and animate multi-level progress rings (A1, A2, B1)
  ['a1', 'a2', 'b1'].forEach(lvl => {
    const lvlTotal = CEFR_LEVEL_TOTALS[lvl];
    const lvlLearned = getLearnedCountForLevel(lvl);
    const lvlPct = lvlTotal > 0 ? Math.round((lvlLearned / lvlTotal) * 100) : 0;
    
    // Dynamic DOM bindings
    const ringEl = elements[`statsRing${lvl.toUpperCase()}`];
    const textEl = elements[`statsText${lvl.toUpperCase()}`];
    const countEl = elements[`statsCount${lvl.toUpperCase()}`];
    
    if (textEl) textEl.textContent = `${lvlPct}%`;
    if (countEl) countEl.textContent = `${lvlLearned} / ${lvlTotal}`;
    
    // SVG circular ring dash-offset animation
    if (ringEl) {
      const offset = 251 - (251 * lvlPct) / 100;
      ringEl.style.strokeDashoffset = offset;
    }
  });
  
  // 4. Render FSRS State Distribution Chart (replaces 5-box Leitner chart)
  if (elements.statsActiveLevelLabel) {
    elements.statsActiveLevelLabel.textContent = `${state.currentLevel.toUpperCase()} — FSRS-Verteilung`;
  }
  
  // Map FSRS states to the existing 5-bar display elements
  // Bar 1 = New, Bar 2 = Learning, Bar 3 = Review, Bar 4 = Mastered, Bar 5 = (unused/retention rate)
  const stateDistribution = [
    { count: fsrsStateCounts.new, label: 'New' },
    { count: fsrsStateCounts.learning, label: 'Learn' },
    { count: fsrsStateCounts.review, label: 'Review' },
    { count: fsrsStateCounts.mastered, label: 'Master' },
    { count: 0, label: '' } // Slot 5 unused for state distribution
  ];
  const maxStateCount = Math.max(...stateDistribution.map(s => s.count), 1);
  for (let i = 1; i <= 5; i++) {
    const count = stateDistribution[i - 1].count;
    const heightPct = (count / maxStateCount) * 100;
    
    const countEl = elements[`statsBox${i}Count`];
    const barEl = elements[`statsBox${i}Bar`];
    
    if (countEl) countEl.textContent = i <= 4 ? count : '';
    if (barEl) {
      barEl.style.height = i <= 4 ? `${heightPct}%` : '0%';
    }
  }
  
  // 4b. Render and animate SRS Due-Card Timeline Forecast Chart
  const maxTimelineCount = Math.max(...timelineCounts, 1);
  for (let i = 0; i <= 7; i++) {
    const count = timelineCounts[i];
    const heightPct = (count / maxTimelineCount) * 100;
    
    const countEl = document.getElementById(`stats-due-day${i}-count`);
    const barEl = document.getElementById(`stats-due-day${i}-bar`);
    
    if (countEl) countEl.textContent = count;
    if (barEl) {
      barEl.style.height = `0%`; // reset first to trigger CSS animation
      setTimeout(() => {
        barEl.style.height = `${heightPct}%`;
      }, 50);
    }
  }

  // Generate dynamic date/day names labels for the timeline forecast
  const labelsContainer = document.getElementById('stats-due-timeline-labels');
  if (labelsContainer) {
    labelsContainer.innerHTML = '';
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayIndex = new Date().getDay();
    
    for (let i = 0; i <= 7; i++) {
      let label = '';
      let sublabel = '';
      if (i === 0) {
        label = 'Today';
        sublabel = 'Active';
      } else if (i === 1) {
        label = 'Tomorrow';
        sublabel = '1 Day';
      } else {
        label = dayNames[(todayIndex + i) % 7];
        sublabel = `${i} Days`;
      }
      
      const span = document.createElement('span');
      span.className = 'flex-1 text-center';
      span.innerHTML = `${label}<br><span class="text-[9px] font-normal font-sans text-slate-500/80">${sublabel}</span>`;
      labelsContainer.appendChild(span);
    }
  }
  
  // 4c. Render FSRS Retention Rate & Streak Card (dynamic panel injection)
  renderFSRSMetricsPanel(retentionRate, weakWords);
  
  // 5. Render Parts of Speech Distribution
  if (elements.statsPartsOfSpeechContainer) {
    elements.statsPartsOfSpeechContainer.innerHTML = '';
    
    const sortedClasses = Object.keys(partsOfSpeechCounts).sort((a, b) => partsOfSpeechCounts[b] - partsOfSpeechCounts[a]);
    
    sortedClasses.forEach(wc => {
      const count = partsOfSpeechCounts[wc];
      const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
      const colorClass = WORD_CLASS_COLORS[wc] || WORD_CLASS_COLORS['Andere'];
      
      const wcLabels = {
        'nomen': 'Noun',
        'substantiv': 'Noun',
        'verb': 'Verb',
        'adjektiv': 'Adjective',
        'adverb': 'Adverb',
        'pronomen': 'Pronoun',
        'präposition': 'Preposition',
        'konjunktion': 'Conjunction',
        'artikel': 'Article',
        'andere': 'Other'
      };
      const englishWc = wcLabels[wc.toLowerCase()] || wc;
      
      const div = document.createElement('div');
      div.className = 'space-y-1.5';
      div.innerHTML = `
        <div class="flex justify-between items-center text-xs font-semibold">
          <span class="text-slate-300">${englishWc}</span>
          <span class="font-mono text-slate-400">${count} <span class="text-[10px] text-slate-500">(${pct}%)</span></span>
        </div>
        <div class="w-full bg-slate-950/60 rounded-full h-1.5 overflow-hidden border border-slate-900/40">
          <div class="${colorClass} h-full rounded-full transition-all duration-1000 ease-out" style="width: 0%"></div>
        </div>
      `;
      
      elements.statsPartsOfSpeechContainer.appendChild(div);
      
      // Smooth animated transition
      setTimeout(() => {
        const bar = div.querySelector('.transition-all');
        if (bar) bar.style.width = `${pct}%`;
      }, 50);
    });
  }
  
  // 6. Render categories progress breakdown grid
  if (elements.statsCategoriesGrid) {
    elements.statsCategoriesGrid.innerHTML = '';
    
    const sortedCats = Object.keys(categoryStats).sort();
    
    sortedCats.forEach(cat => {
      const stats = categoryStats[cat];
      const pct = stats.total > 0 ? Math.round((stats.learned / stats.total) * 100) : 0;
      
      const div = document.createElement('div');
      div.className = 'bg-slate-950/40 border border-slate-900/80 rounded-xl p-3 flex items-center justify-between gap-4 hover:border-slate-800 transition-all';
      div.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 text-xs">
            <i class="fa-solid ${getCategoryIcon(cat)}"></i>
          </div>
          <div class="flex flex-col">
            <span class="text-xs font-bold text-white">${cat}</span>
            <span class="text-[10px] text-slate-500 font-mono mt-0.5">${stats.learned} / ${stats.total} learned</span>
          </div>
        </div>
        <div class="flex flex-col items-end gap-1.5">
          <span class="text-xs font-mono font-black text-indigo-400">${pct}%</span>
          <div class="w-16 bg-slate-900/80 rounded-full h-1 overflow-hidden border border-slate-800/40">
            <div class="bg-indigo-500 h-full rounded-full transition-all duration-1000 ease-out" style="width: 0%"></div>
          </div>
        </div>
      `;
      
      elements.statsCategoriesGrid.appendChild(div);
      
      // Smooth animated transition
      setTimeout(() => {
        const bar = div.querySelector('.bg-indigo-500');
        if (bar) bar.style.width = `${pct}%`;
      }, 50);
    });
  }
  
  // Render Achievements grid inside statistics panel
  renderAchievementsGrid();

  // Initialize active FSRS stability decay canvas graph
  initFSRSDecaySimulator();
}

// ==========================================
// FSRS METRICS PANEL RENDERER
// Renders streak, retention rate, session stats, and weak words
// ==========================================
function renderFSRSMetricsPanel(retentionRate, weakWords) {
  // Find or create the FSRS metrics container
  let container = document.getElementById('fsrs-metrics-panel');
  if (!container) {
    // Insert after the box chart panel or at the end of the stats view
    const statsView = elements.statsView;
    if (!statsView) return;
    container = document.createElement('div');
    container.id = 'fsrs-metrics-panel';
    // Insert before the categories grid
    const categoriesSection = elements.statsCategoriesGrid?.closest('.space-y-4, [class*="grid"]')?.parentElement;
    if (categoriesSection) {
      categoriesSection.parentElement.insertBefore(container, categoriesSection);
    } else {
      statsView.appendChild(container);
    }
  }
  
  const streakInfo = getStreakInfo();
  const sessionHistory = safeJsonParse('session_history', []);
  const recentSessions = sessionHistory.slice(-5).reverse();
  
  // Build streak display
  const streakFlameColor = streakInfo.current >= 7 ? 'text-orange-500' : (streakInfo.current >= 3 ? 'text-orange-400' : 'text-slate-400');
  const streakBgGlow = streakInfo.isActiveToday ? 'border-orange-500/30 shadow-lg shadow-orange-500/5' : 'border-slate-900/80';
  
  // Build weak words display (top 5)
  const topWeakWords = weakWords.slice(0, 5);
  let weakWordsHTML = '';
  if (topWeakWords.length > 0) {
    weakWordsHTML = topWeakWords.map(w => {
      const retPct = Math.round(w.retrievability * 100);
      const retColor = retPct < 30 ? 'text-rose-400' : (retPct < 60 ? 'text-amber-400' : 'text-emerald-400');
      return `
        <div class="flex items-center justify-between py-1.5 border-b border-slate-800/30 last:border-b-0">
          <div class="flex flex-col min-w-0">
            <span class="text-xs font-bold text-white truncate">${w.word}</span>
            <span class="text-[10px] text-slate-500 truncate">${w.meaning}</span>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <span class="text-[10px] font-mono ${retColor}">${retPct}%</span>
            <span class="text-[9px] text-slate-500">D:${w.difficulty.toFixed(1)}</span>
          </div>
        </div>
      `;
    }).join('');
  } else {
    weakWordsHTML = '<p class="text-[10px] text-slate-500 italic py-2">No weak vocabulary detected. Keep it up!</p>';
  }
  
  // Build session history display
  let sessionHTML = '';
  if (recentSessions.length > 0) {
    sessionHTML = recentSessions.map(s => {
      const date = new Date(s.date);
      const dateStr = `${date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`;
      const durationMin = Math.round(s.durationMs / 60000);
      return `
        <div class="flex items-center justify-between py-1 text-[10px]">
          <span class="text-slate-400">${dateStr}</span>
          <span class="text-slate-500">${durationMin}min</span>
          <span class="font-mono font-bold ${s.accuracy >= 80 ? 'text-emerald-400' : 'text-amber-400'}">${s.accuracy}%</span>
          <span class="text-slate-500">${s.cardsReviewed} cards</span>
        </div>
      `;
    }).join('');
  } else {
    sessionHTML = '<p class="text-[10px] text-slate-500 italic py-2">No session data available yet.</p>';
  }
  
  container.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      
      <!-- Streak Card -->
      <div class="bg-slate-950/40 border ${streakBgGlow} rounded-xl p-4 relative overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-b from-orange-500/[0.02] to-transparent pointer-events-none"></div>
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/25 flex items-center justify-center ${streakFlameColor} text-lg">
            <i class="fa-solid fa-fire"></i>
          </div>
          <div class="flex flex-col">
            <span class="text-2xl font-black font-display text-white">${streakInfo.current}</span>
            <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Day Streak</span>
          </div>
        </div>
        <div class="flex items-center justify-between text-[10px] mt-2">
          <span class="text-slate-500">Longest: <span class="font-bold text-slate-300">${streakInfo.longest} days</span></span>
          <span class="text-slate-500">${streakInfo.isActiveToday
            ? '<span class="text-emerald-400 font-bold"><i class="fa-solid fa-circle-check text-[8px]"></i> Active today</span>'
            : '<span class="text-amber-400 font-bold"><i class="fa-solid fa-triangle-exclamation text-[8px]"></i> Not practiced today</span>'
          }</span>
        </div>
        ${streakInfo.freezesAvailable > 0 ? `<div class="text-[9px] text-cyan-400 mt-1"><i class="fa-solid fa-snowflake text-[8px]"></i> ${streakInfo.freezesAvailable} Streak Freeze available</div>` : ''}
      </div>
      
      <!-- Retention Rate Card -->
      <div class="bg-slate-950/40 border border-slate-900/80 rounded-xl p-4">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/25 flex items-center justify-center text-fuchsia-400 text-lg">
            <i class="fa-solid fa-brain"></i>
          </div>
          <div class="flex flex-col">
            <span class="text-2xl font-black font-display ${retentionRate >= 85 ? 'text-emerald-400' : (retentionRate >= 70 ? 'text-amber-400' : 'text-rose-400')}">${retentionRate}%</span>
            <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Retention Rate</span>
          </div>
        </div>
        <div class="w-full bg-slate-900/80 rounded-full h-2 overflow-hidden border border-slate-800/40 mt-2">
          <div class="${retentionRate >= 85 ? 'bg-emerald-500' : (retentionRate >= 70 ? 'bg-amber-500' : 'bg-rose-500')} h-full rounded-full transition-all duration-1000 ease-out" style="width: ${retentionRate}%"></div>
        </div>
        <p class="text-[10px] text-slate-500 mt-2">${retentionRate >= 85 ? 'Excellent! Your memory retention is optimal.' : (retentionRate >= 70 ? 'Good rate. Regular practice will improve it further.' : 'More reviews recommended.')}</p>
      </div>
      
      <!-- Weak Words Card -->
      <div class="bg-slate-950/40 border border-slate-900/80 rounded-xl p-4">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-400 text-sm">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <span class="text-xs font-bold text-white">Weak Words</span>
          <span class="text-[9px] bg-rose-950/40 text-rose-400 border border-rose-500/20 px-1.5 rounded-full font-mono font-bold">${weakWords.length}</span>
        </div>
        <div class="max-h-32 overflow-y-auto custom-scrollbar">
          ${weakWordsHTML}
        </div>
      </div>
      
    </div>
    
    <!-- Session History -->
    <div class="bg-slate-950/40 border border-slate-900/80 rounded-xl p-4 mb-6">
      <div class="flex items-center gap-2 mb-3">
        <div class="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 text-sm">
          <i class="fa-solid fa-clock-rotate-left"></i>
        </div>
        <span class="text-xs font-bold text-white">Recent Sessions</span>
      </div>
      <div class="flex items-center justify-between text-[9px] text-slate-500 font-bold uppercase tracking-wider border-b border-slate-800/40 pb-1 mb-1">
        <span>Date</span><span>Duration</span><span>Accuracy</span><span>Cards</span>
      </div>
      ${sessionHTML}
    </div>
  `;
}

// Update primary overall stats
export function updateOverallStats() {
  const total = state.allCards.length;
  const learnedCount = state.learnedCards.size;
  const percent = total > 0 ? Math.round((learnedCount / total) * 100) : 0;
  
  if (elements.overallProgressText) {
    elements.overallProgressText.textContent = `${learnedCount} / ${total} learned (${percent}%)`;
  }
  if (elements.overallProgressBarFill) {
    elements.overallProgressBarFill.style.width = `${percent}%`;
  }
}

// Export local profile stats
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
        quiz_streak: safeGetItem('quiz_streak', '0'),
        quiz_best_streak: safeGetItem('quiz_best_streak', '0'),
        show_images: safeGetItem('show_images', 'true'),
        current_level: safeGetItem('current_level', 'a2'),
        streak_data: safeJsonParse('streak_data', {}),
        session_history: safeJsonParse('session_history', []),
        unlocked_achievements: safeJsonParse('unlocked_achievements', [])
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

// Import local profile stats
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
        throw new Error("Invalid file format. It must be a valid .json backup file.");
      }
      
      const data = backup.data;
      
      // Asynchronously write to IndexedDB
      if (data.learned_cards_a1) await idb.set('learned_cards_a1', JSON.stringify(data.learned_cards_a1));
      if (data.learned_cards_a2) await idb.set('learned_cards_a2', JSON.stringify(data.learned_cards_a2));
      if (data.learned_cards_b1) await idb.set('learned_cards_b1', JSON.stringify(data.learned_cards_b1));
      
      if (data.srs_state_a1) await idb.set('srs_state_a1', JSON.stringify(data.srs_state_a1));
      if (data.srs_state_a2) await idb.set('srs_state_a2', JSON.stringify(data.srs_state_a2));
      if (data.srs_state_b1) await idb.set('srs_state_b1', JSON.stringify(data.srs_state_b1));
      
      if (data.custom_cards_a1) await idb.set('custom_cards_a1', JSON.stringify(data.custom_cards_a1));
      if (data.custom_cards_a2) await idb.set('custom_cards_a2', JSON.stringify(data.custom_cards_a2));
      if (data.custom_cards_b1) await idb.set('custom_cards_b1', JSON.stringify(data.custom_cards_b1));
      
      // Write configurations to localStorage
      if (data.quiz_streak !== undefined) safeSetItem('quiz_streak', String(data.quiz_streak));
      if (data.quiz_best_streak !== undefined) safeSetItem('quiz_best_streak', String(data.quiz_best_streak));
      if (data.show_images !== undefined) safeSetItem('show_images', String(data.show_images));
      if (data.current_level !== undefined) safeSetItem('current_level', String(data.current_level));
      if (data.streak_data) safeSetItem('streak_data', JSON.stringify(data.streak_data));
      if (data.session_history) safeSetItem('session_history', JSON.stringify(data.session_history));
      if (data.unlocked_achievements) safeSetItem('unlocked_achievements', JSON.stringify(data.unlocked_achievements));
      
      elements.backupImportFeedback.className = "text-[10px] text-center font-bold text-emerald-400 mt-3";
      elements.backupImportFeedback.textContent = "✓ Backup loaded! Refreshing dashboard...";
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (err) {
      console.error("Backup restore failed:", err);
      elements.backupImportFeedback.className = "text-[10px] text-center font-bold text-rose-400 mt-3";
      elements.backupImportFeedback.textContent = "✕ Import failed: " + err.message;
    }
  };
  
  reader.onerror = function() {
    elements.backupImportFeedback.className = "text-[10px] text-center font-bold text-rose-400 mt-3";
    elements.backupImportFeedback.textContent = "✕ Error reading the backup file.";
  };
  
  reader.readAsText(file);
}

// Copy Base64 Sync Key to Clipboard
export async function copySyncKey() {
  const btn = document.getElementById('sync-copy-btn');
  if (!btn) return;
  
  try {
    const key = await state.generateSyncKey();
    await navigator.clipboard.writeText(key);
    
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-check text-sm text-emerald-400"></i> <span class="text-emerald-400">Copied! ✓</span>`;
    
    // Play a quick chime/haptic or trigger particle burst
    if (typeof window.triggerParticleBurst === 'function') {
      const rect = btn.getBoundingClientRect();
      window.triggerParticleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
    
    setTimeout(() => {
      btn.innerHTML = originalText;
    }, 2000);
  } catch (err) {
    console.error("Failed to generate or copy sync key:", err);
    alert("Copy failed: " + err.message);
  }
}

// Restore entire progress profile from Base64 Sync Key with side-by-side Conflict Resolution
export async function restoreSyncKey() {
  const input = document.getElementById('sync-restore-input');
  if (!input) return;
  
  const key = input.value.trim();
  if (!key) {
    alert("Please paste a valid Sync Key.");
    return;
  }
  
  const feedback = document.getElementById('backup-import-feedback');
  if (feedback) {
    feedback.classList.remove('hidden', 'text-rose-400', 'text-emerald-400');
    feedback.classList.add('text-slate-400');
    feedback.textContent = "Validating Sync Key...";
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
    const impStreak = Number(imp.quiz_streak || 0);
    const impBestStreak = Number(imp.quiz_best_streak || 0);
    
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
    
    const localStreak = Number(localStorage.getItem('quiz_streak') || 0);
    const localBestStreak = Number(localStorage.getItem('quiz_best_streak') || 0);

    // 3. Determine if there is a real conflict
    const hasConflict = 
      impLearnedCount !== localLearnedCount ||
      impCustomCount !== localCustomCount ||
      impSrsCount !== localSrsCount ||
      impStreak !== localStreak ||
      impBestStreak !== localBestStreak;

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
            <span class="text-xs font-bold text-slate-300 border-l-2 border-indigo-500/30 pl-2">Current Streak</span>
            <span class="text-xs font-bold text-slate-300 border-l-2 border-indigo-500/30 pl-2">Best Streak</span>
          </div>

          <!-- Local Profile Column -->
          <div class="col-span-1 bg-slate-950/40 border border-slate-900/80 rounded-xl p-3 flex flex-col space-y-4 text-center">
            <span class="text-[10px] font-black uppercase tracking-wider text-indigo-400">Local Profile</span>
            <span class="text-xs font-black text-slate-100">${localLearnedCount}</span>
            <span class="text-xs font-black text-slate-100">${localCustomCount}</span>
            <span class="text-xs font-black text-slate-100">${localSrsCount}</span>
            <span class="text-xs font-black text-slate-100">${localStreak} days</span>
            <span class="text-xs font-black text-slate-100">${localBestStreak} days</span>
          </div>

          <!-- Imported Key Column -->
          <div class="col-span-1 bg-indigo-950/10 border border-indigo-900/30 rounded-xl p-3 flex flex-col space-y-4 text-center">
            <span class="text-[10px] font-black uppercase tracking-wider text-pink-400">Imported (Key)</span>
            <span class="text-xs font-black text-slate-100">${impLearnedCount}</span>
            <span class="text-xs font-black text-slate-100">${impCustomCount}</span>
            <span class="text-xs font-black text-slate-100">${impSrsCount}</span>
            <span class="text-xs font-black text-slate-100">${impStreak} days</span>
            <span class="text-xs font-black text-slate-100">${impBestStreak} days</span>
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
                Combines learned, custom, and FSRS cards of both profiles without duplicates. Retains the longer daily learning streak. Safe and seamless progress preservation.
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

        // D. Streaks
        const mergedStreak = Math.max(localStreak, impStreak);
        const mergedBestStreak = Math.max(localBestStreak, impBestStreak);
        localStorage.setItem('quiz_streak', String(mergedStreak));
        localStorage.setItem('quiz_best_streak', String(mergedBestStreak));

        // E. Streak Data Log (Union of history)
        const mergedStreakData = { ...safeJsonParse('streak_data', {}) };
        const impStreakData = imp.streak_data || {};
        if (impStreakData.history && Array.isArray(impStreakData.history)) {
          if (!mergedStreakData.history) mergedStreakData.history = [];
          mergedStreakData.history = Array.from(new Set([...mergedStreakData.history, ...impStreakData.history]));
        }
        localStorage.setItem('streak_data', JSON.stringify(mergedStreakData));

        // F. Unlocked Achievements (Union)
        const mergedAchievements = Array.from(new Set([
          ...(safeJsonParse('unlocked_achievements', [])),
          ...(imp.unlocked_achievements || [])
        ]));
        localStorage.setItem('unlocked_achievements', JSON.stringify(mergedAchievements));

        // G. Session History (Deduplicated union by startTime)
        const mergedSessionHistory = [
          ...(safeJsonParse('session_history', [])),
          ...(imp.session_history || [])
        ];
        const sessionMap = new Map();
        mergedSessionHistory.forEach(s => {
          if (s && s.startTime) sessionMap.set(s.startTime, s);
        });
        const finalSessionHistory = Array.from(sessionMap.values()).sort((a,b) => a.startTime - b.startTime);
        localStorage.setItem('session_history', JSON.stringify(finalSessionHistory));

        if (feedback) {
          feedback.textContent = "✓ Merge successful! Reloading dashboard...";
        }

        setTimeout(() => {
          window.location.reload();
        }, 1500);

      } catch (err) {
        console.error("Merge and combine failed:", err);
        alert("Error merging profiles: " + err.message);
      }
    });

  } catch (err) {
    console.error("Sync key restore failed:", err);
    if (feedback) {
      feedback.className = "text-[10px] text-center font-bold text-rose-400 mt-3";
      feedback.textContent = "✕ Recovery failed: " + err.message;
    } else {
      alert("Recovery failed: " + err.message);
    }
  }
}

/**
 * Initializes and wires the interactive FSRS-5 Memory Decay Simulator.
 */
export function initFSRSDecaySimulator() {
  const cardSelect = document.getElementById('fsrs-decay-card-select');
  const slider = document.getElementById('fsrs-decay-slider');
  const stabilityVal = document.getElementById('fsrs-decay-stability-val');
  const canvas = document.getElementById('fsrs-decay-canvas');

  if (!cardSelect || !slider || !stabilityVal || !canvas) return;

  // Local state tracker for the simulated card
  let simulatedCard = null;

  function loadCardState(cardId) {
    if (!cardId) {
      simulatedCard = fsrs.createCard();
      simulatedCard.stability = 8.0;
      simulatedCard.state = FSRSState.Review;
      simulatedCard.lastReview = Date.now() - 1 * 24 * 60 * 60 * 1000;
      return;
    }
    const cardSrs = state.srs[cardId];
    if (cardSrs) {
      simulatedCard = { ...cardSrs };
    } else {
      const srsInfo = getSRSInfo(cardId);
      simulatedCard = fsrs.createCard();
      simulatedCard.stability = srsInfo.stability && srsInfo.stability > 0 ? srsInfo.stability : 8.0;
      simulatedCard.state = FSRSState.Review;
      simulatedCard.lastReview = Date.now() - 1 * 24 * 60 * 60 * 1000;
    }
  }

  // 1. Populate learned cards select
  cardSelect.innerHTML = '';
  
  const learnedCardsList = [];
  state.allCards.forEach(c => {
    if (state.learnedCards.has(Number(c.id))) {
      learnedCardsList.push(c);
    }
  });

  if (learnedCardsList.length === 0) {
    const opt = document.createElement('option');
    opt.value = "";
    opt.textContent = "No learned cards available";
    cardSelect.appendChild(opt);
    
    // Default fallback draw
    slider.value = 8;
    stabilityVal.textContent = "8.0 Days";
    loadCardState(null);
    drawFSRSDecay(canvas, 8);
  } else {
    // Sort learned cards alphabetically by German headword
    learnedCardsList.sort((a, b) => a.word.localeCompare(b.word));

    learnedCardsList.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.word} — ${c.meaning}`;
      cardSelect.appendChild(opt);
    });

    // Load initial first learned card's stability
    const firstId = learnedCardsList[0].id;
    loadCardState(firstId);
    
    const initialStability = simulatedCard.stability;
    slider.value = Math.min(Math.max(initialStability, 1), 120);
    stabilityVal.textContent = `${Number(initialStability).toFixed(1)} Days`;
    drawFSRSDecay(canvas, initialStability);
  }

  // 2. Slider input listener
  slider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    stabilityVal.textContent = `${val.toFixed(1)} Days`;
    if (simulatedCard) {
      simulatedCard.stability = val;
    }
    drawFSRSDecay(canvas, val);
  });

  // 3. Select card change listener
  cardSelect.addEventListener('change', (e) => {
    const cardId = e.target.value;
    if (!cardId) return;
    loadCardState(cardId);
    
    const initialStability = simulatedCard.stability;
    slider.value = Math.min(Math.max(initialStability, 1), 120);
    stabilityVal.textContent = `${Number(initialStability).toFixed(1)} Days`;
    drawFSRSDecay(canvas, initialStability);
  });

  // 4. Interactive forecast chips event handlers
  const forecastChips = document.querySelectorAll('.forecast-chip');
  const ratingColors = {
    1: 'rgba(239, 68, 68, 0.75)',    // Red for Again
    2: 'rgba(245, 158, 11, 0.75)',   // Amber for Hard
    3: 'rgba(99, 102, 241, 0.75)',   // Indigo/Blue for Good
    4: 'rgba(16, 185, 129, 0.75)'    // Emerald for Easy
  };

  forecastChips.forEach(chip => {
    const rating = parseInt(chip.getAttribute('data-rating'));
    if (!rating) return;

    chip.addEventListener('mouseenter', () => {
      if (!simulatedCard) return;
      // Calculate next card state
      const nextCard = fsrs.reviewCard(simulatedCard, rating);
      const nextStability = nextCard.stability;
      const color = ratingColors[rating];
      
      // Draw dotted forecast curve
      drawFSRSDecay(canvas, simulatedCard.stability, nextStability, color);
    });

    chip.addEventListener('mouseleave', () => {
      if (!simulatedCard) return;
      // Revert to current stability decay curve
      drawFSRSDecay(canvas, simulatedCard.stability);
    });

    chip.addEventListener('click', () => {
      if (!simulatedCard) return;
      
      // Permanently update simulatedCard state
      simulatedCard = fsrs.reviewCard(simulatedCard, rating);
      const nextStability = simulatedCard.stability;
      
      // Update UI components
      slider.value = Math.min(Math.max(nextStability, 1), 120);
      stabilityVal.textContent = `${Number(nextStability).toFixed(1)} Days`;
      
      // Repaint base curve
      drawFSRSDecay(canvas, nextStability);

      // Trigger particles on forecast chip click
      if (window.triggerParticleBurst && state.particleBursts) {
        window.triggerParticleBurst(15, chip);
      }
    });
  });
}

/**
 * Draws the FSRS memory decay line graph on an HTML5 canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {number} stability - Stability parameter (S) in days
 */
export function drawFSRSDecay(canvas, stability, forecastStability = null, forecastColor = null) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Support High-DPI canvas
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  
  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
  }
  ctx.resetTransform();
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, width, height);

  const paddingLeft = 32;
  const paddingBottom = 20;
  const paddingTop = 10;
  const paddingRight = 10;
  
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Draw Grid Lines (Y-Axis)
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
  ctx.lineWidth = 1;
  ctx.font = '9px monospace';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const yTicks = [0, 0.25, 0.5, 0.75, 0.9, 1.0];
  yTicks.forEach(tick => {
    const yVal = paddingTop + chartHeight * (1 - tick);
    // Grid line
    ctx.beginPath();
    ctx.moveTo(paddingLeft, yVal);
    ctx.lineTo(width - paddingRight, yVal);
    ctx.stroke();
    // Text label
    ctx.fillText(`${Math.round(tick * 100)}%`, paddingLeft - 6, yVal);
  });

  // Draw Grid Lines (X-Axis Days)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const xTicks = [0, 5, 10, 15, 20, 25, 30];
  xTicks.forEach(tick => {
    const xVal = paddingLeft + chartWidth * (tick / 30);
    // Label
    ctx.fillText(`Day ${tick}`, xVal, height - paddingBottom + 5);
  });

  // Draw Optimal Retention line at 90%
  const optimalY = paddingTop + chartHeight * (1 - 0.9);
  ctx.strokeStyle = 'rgba(236, 72, 153, 0.25)'; // Pink neon low-alpha
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(paddingLeft, optimalY);
  ctx.lineTo(width - paddingRight, optimalY);
  ctx.stroke();
  ctx.setLineDash([]); // Reset
  ctx.fillStyle = '#ec4899';
  ctx.font = 'extrabold 8px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('OPTIMALER REVIEW-PUNKT (90%)', paddingLeft + 4, optimalY - 8);

  // Trace FSRS Decay Curve R = (1 + t / (9 * S))^-1
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.85)'; // Neon Indigo
  ctx.lineWidth = 2.5;
  ctx.shadowColor = 'rgba(99, 102, 241, 0.4)';
  ctx.shadowBlur = 6;

  ctx.beginPath();
  for (let xPixel = 0; xPixel <= chartWidth; xPixel++) {
    const t = (xPixel / chartWidth) * 30; // 30 days window
    const retention = Math.pow(1 + t / (9 * stability), -1);
    const yPixel = paddingTop + chartHeight * (1 - retention);
    
    if (xPixel === 0) {
      ctx.moveTo(paddingLeft + xPixel, yPixel);
    } else {
      ctx.lineTo(paddingLeft + xPixel, yPixel);
    }
  }
  ctx.stroke();
  
  // Draw Area under Curve (with soft glowing gradient)
  ctx.shadowBlur = 0; // Turn off shadow
  const grad = ctx.createLinearGradient(0, paddingTop, 0, height - paddingBottom);
  grad.addColorStop(0, 'rgba(99, 102, 241, 0.12)');
  grad.addColorStop(1, 'rgba(99, 102, 241, 0.0)');
  ctx.fillStyle = grad;
  
  ctx.beginPath();
  ctx.moveTo(paddingLeft, height - paddingBottom);
  for (let xPixel = 0; xPixel <= chartWidth; xPixel++) {
    const t = (xPixel / chartWidth) * 30;
    const retention = Math.pow(1 + t / (9 * stability), -1);
    const yPixel = paddingTop + chartHeight * (1 - retention);
    ctx.lineTo(paddingLeft + xPixel, yPixel);
  }
  ctx.lineTo(width - paddingRight, height - paddingBottom);
  ctx.closePath();
  ctx.fill();

  // Draw dot at 90% intersection point (solve for t: 0.9 = (1 + t / (9 * S))^-1 -> t = S)
  const optimalDay = stability;
  if (optimalDay <= 30) {
    const intersectX = paddingLeft + chartWidth * (optimalDay / 30);
    ctx.fillStyle = '#ec4899';
    ctx.beginPath();
    ctx.arc(intersectX, optimalY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Draw Dotted Forecast Curve if provided
  if (forecastStability && forecastStability > 0) {
    ctx.strokeStyle = forecastColor || 'rgba(236, 72, 153, 0.8)';
    ctx.lineWidth = 2.0;
    ctx.setLineDash([3, 3]);
    ctx.shadowBlur = 0; // Disable shadow blur for performance

    ctx.beginPath();
    for (let xPixel = 0; xPixel <= chartWidth; xPixel++) {
      const t = (xPixel / chartWidth) * 30; // 30 days window
      const retention = Math.pow(1 + t / (9 * forecastStability), -1);
      const yPixel = paddingTop + chartHeight * (1 - retention);
      
      if (xPixel === 0) {
        ctx.moveTo(paddingLeft + xPixel, yPixel);
      } else {
        ctx.lineTo(paddingLeft + xPixel, yPixel);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash

    // Draw Right-Aligned text label showing Simulated Stability S
    ctx.fillStyle = forecastColor || '#ec4899';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'right';
    const finalRetention = Math.pow(1 + 30 / (9 * forecastStability), -1);
    const finalY = paddingTop + chartHeight * (1 - finalRetention);
    // Align label cleanly above/below the final curve pixel
    ctx.fillText(`S = ${Number(forecastStability).toFixed(1)}d`, width - paddingRight, Math.max(paddingTop + 12, Math.min(height - paddingBottom - 4, finalY - 4)));
  }
}

