// js/pomodoro.js — Pomodoro focus-booster timers, soundscapes, XP multipliers and screen particle toasts
import { state, elements, addXP } from './state.js';
import { startFocusSound, stopFocusSound, playAchievementChime } from './audio.js';

/**
 * Initializes the Pomodoro focus booster widgets and sets up listeners.
 */
export function initPomodoroFocusBooster() {
  const toggleBtn = elements.pomodoroToggleBtn;
  const durationSelect = elements.pomodoroDuration;
  const soundSelect = elements.pomodoroSound;
  const timeText = elements.pomodoroTimeText;
  const timerRing = elements.pomodoroTimerRing;

  if (!toggleBtn || !durationSelect || !soundSelect || !timeText || !timerRing) return;

  const initialDuration = parseInt(durationSelect.value, 10);
  timeText.textContent = `${initialDuration}m`;
  updatePomodoroRing(100);

  durationSelect.addEventListener('change', () => {
    if (!state.focus.active) {
      const mins = parseInt(durationSelect.value, 10);
      timeText.textContent = `${mins}m`;
      updatePomodoroRing(100);
    }
  });

  soundSelect.addEventListener('change', () => {
    if (state.focus.active && state.focus.soundType !== soundSelect.value) {
      state.focus.soundType = soundSelect.value;
      if (state.focus.soundType === 'none') {
        stopFocusSound();
      } else {
        startFocusSound(state.focus.soundType);
      }
    }
  });

  toggleBtn.addEventListener('click', () => {
    if (state.focus.active) {
      stopFocusTimer();
    } else {
      startFocusTimer();
    }
  });
}

/**
 * Controls the stroke dash offset of the circular Pomodoro focus ring svg
 */
export function updatePomodoroRing(percent) {
  const ring = elements.pomodoroTimerRing;
  if (!ring) return;
  const dasharray = 100.5;
  const offset = dasharray - (percent / 100) * dasharray;
  ring.style.strokeDashoffset = offset;
}

/**
 * Spawns and configures the active Pomodoro interval loop
 */
export function startFocusTimer() {
  const durationSelect = elements.pomodoroDuration;
  const soundSelect = elements.pomodoroSound;
  const toggleBtn = elements.pomodoroToggleBtn;
  const timeText = elements.pomodoroTimeText;

  if (!durationSelect || !soundSelect || !toggleBtn || !timeText) return;

  const mins = parseInt(durationSelect.value, 10);
  state.focus.totalDuration = mins * 60;
  state.focus.timeLeft = state.focus.totalDuration;
  state.focus.soundType = soundSelect.value;
  state.focus.active = true;

  toggleBtn.innerHTML = `<i class="fa-solid fa-stop text-[10px]"></i><span>Stop Focus</span>`;
  toggleBtn.className = "flex-1 py-1.5 px-3 rounded-lg text-center text-xs font-bold bg-rose-600 hover:bg-rose-500 active:scale-95 text-white transition-all shadow-md shadow-rose-600/20 flex items-center justify-center gap-1.5";

  durationSelect.disabled = true;

  if (state.focus.soundType !== 'none') {
    startFocusSound(state.focus.soundType);
  }

  if (state.focus.timerId) clearInterval(state.focus.timerId);

  state.focus.timerId = setInterval(() => {
    state.focus.timeLeft--;
    
    if (state.focus.timeLeft <= 0) {
      completeFocusTimer();
    } else {
      updateFocusTimerUI();
    }
  }, 1000);

  updateFocusTimerUI();
}

/**
 * Halts and tears down any active Pomodoro session
 */
export function stopFocusTimer() {
  const durationSelect = elements.pomodoroDuration;
  const toggleBtn = elements.pomodoroToggleBtn;
  const timeText = elements.pomodoroTimeText;

  if (state.focus.timerId) {
    clearInterval(state.focus.timerId);
    state.focus.timerId = null;
  }

  state.focus.active = false;
  stopFocusSound();

  if (durationSelect) durationSelect.disabled = false;

  if (toggleBtn) {
    toggleBtn.innerHTML = `<i class="fa-solid fa-play text-[10px]"></i><span>Start Focus</span>`;
    toggleBtn.className = "flex-1 py-1.5 px-3 rounded-lg text-center text-xs font-bold bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5";
  }

  if (timeText && durationSelect) {
    timeText.textContent = `${durationSelect.value}m`;
  }
  updatePomodoroRing(100);
}

/**
 * Updates timer text layout to min:sec representation
 */
export function updateFocusTimerUI() {
  const timeText = elements.pomodoroTimeText;
  if (!timeText) return;

  const mins = Math.floor(state.focus.timeLeft / 60);
  const secs = state.focus.timeLeft % 60;
  timeText.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

  const percent = (state.focus.timeLeft / state.focus.totalDuration) * 100;
  updatePomodoroRing(percent);
}

/**
 * Triggers focus complete achievements, rewards XP, and initiates the XP multiplier duration
 */
export function completeFocusTimer() {
  stopFocusTimer();

  // Award +25 XP
  addXP(25);

  // Play achievement sound cue
  playAchievementChime();

  // Trigger screen-wide particle bursts
  if (window.triggerParticleBurst) {
    const burstCount = 6;
    for (let i = 0; i < burstCount; i++) {
      setTimeout(() => {
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight;
        window.triggerParticleBurst(x, y);
      }, i * 300);
    }
  }

  // Activate 15-minute 1.25x XP multiplier
  activateXpMultiplier(15 * 60);

  showFocusCompletionToast();
}

/**
 * Initiates the 1.25x XP countdown timer
 */
export function activateXpMultiplier(durationSeconds) {
  if (state.focus.multiplierTimerId) {
    clearInterval(state.focus.multiplierTimerId);
  }

  state.focus.xpMultiplierActive = true;
  let multiplierTimeLeft = durationSeconds;

  updateMultiplierUI(multiplierTimeLeft);

  state.focus.multiplierTimerId = setInterval(() => {
    multiplierTimeLeft--;
    if (multiplierTimeLeft <= 0) {
      clearInterval(state.focus.multiplierTimerId);
      state.focus.multiplierTimerId = null;
      state.focus.xpMultiplierActive = false;
      updateMultiplierUI(0);
    } else {
      updateMultiplierUI(multiplierTimeLeft);
    }
  }, 1000);
}

/**
 * Updates UI badge indicating active XP multiplier countdown
 */
export function updateMultiplierUI(timeLeft) {
  let indicator = document.getElementById('pomodoro-multiplier-badge');
  const widgetContainer = document.getElementById('pomodoro-sidebar-widget')?.firstElementChild;
  if (!widgetContainer) return;

  if (timeLeft > 0) {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'pomodoro-multiplier-badge';
      indicator.className = "mt-3 pt-2 border-t border-indigo-500/10 flex items-center justify-between text-[9px] text-amber-400 font-bold uppercase tracking-wider animate-pulse";
      widgetContainer.appendChild(indicator);
    }
    indicator.innerHTML = `<span>⚡ 1.25x XP Active!</span><span class="font-mono font-black">${timeStr}</span>`;
    indicator.classList.remove('hidden');
  } else {
    if (indicator) {
      indicator.classList.add('hidden');
    }
  }
}

/**
 * Renders a visual toast alert indicating success
 */
export function showFocusCompletionToast() {
  const toast = document.createElement('div');
  toast.className = "fixed bottom-6 right-6 z-50 max-w-sm bg-slate-950/90 border border-indigo-500/30 text-white rounded-xl p-4 shadow-2xl shadow-indigo-500/10 flex items-start gap-3 transform translate-y-12 opacity-0 transition-all duration-500 backdrop-blur-md";
  toast.innerHTML = `
    <div class="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
      <i class="fa-solid fa-trophy text-lg"></i>
    </div>
    <div class="flex-1">
      <h4 class="text-xs font-black text-white tracking-wide uppercase">Focus Session Completed!</h4>
      <p class="text-[10px] text-slate-300 mt-0.5">Outstanding work! You have earned +25 XP and unlocked a 1.25x XP multiplier for the next 15 minutes! ⚡</p>
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
    toast.classList.add('translate-y-12', 'opacity-0');
    setTimeout(() => toast.remove(), 500);
  }, 6000);
}
