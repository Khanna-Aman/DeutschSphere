// js/audio.js — Web Audio & Speech Synthesis Pronunciation Module

import { state, elements } from './state.js';

// F7: Cached voice selection for trainer (avoids getVoices() + filter 3× per card)
let cachedDeVoice = null;
let cachedEnVoice = null;

function getCachedVoice(langPrefix) {
  if (langPrefix === 'de' && cachedDeVoice) return cachedDeVoice;
  if (langPrefix === 'en' && cachedEnVoice) return cachedEnVoice;
  const voices = window.speechSynthesis.getVoices();
  const matched = voices.filter(v => v.lang.startsWith(langPrefix));
  const voice = matched.find(v => v.localService === true) || matched[0] || null;
  if (langPrefix === 'de') cachedDeVoice = voice;
  else cachedEnVoice = voice;
  return voice;
}

// Invalidate cache when voices change (e.g., after async load)
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    cachedDeVoice = null;
    cachedEnVoice = null;
  });
}

// Global Speech Utterance reference
let globalUtterance = null;

// ==========================================
// SHARED AUDIOCONTEXT SINGLETON
// Prevents context pool exhaustion (browsers limit to 6-8 active contexts).
// All SFX functions share this single lazily-initialized instance.
// ==========================================
let sharedAudioCtx = null;
let audioIdleTimer = null;

/**
 * Returns the shared AudioContext singleton, creating it on first call.
 * Handles browser autoplay policy by resuming suspended contexts.
 * M9: Auto-suspends after 30s of inactivity to save battery on mobile.
 * @returns {AudioContext|null} The shared context, or null if Web Audio is unsupported.
 */
export function getSharedAudioContext() {
  if (!sharedAudioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    sharedAudioCtx = new AudioContextClass();
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume();
  }
  // M9: Reset idle suspend timer on each use
  resetAudioIdleTimer();
  return sharedAudioCtx;
}

/**
 * H7: Async version for callers that need guaranteed audio readiness (TTS, recording).
 * Awaits the resume() promise before returning.
 * @returns {Promise<AudioContext|null>}
 */
export async function getSharedAudioContextAsync() {
  if (!sharedAudioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    sharedAudioCtx = new AudioContextClass();
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    await sharedAudioCtx.resume();
  }
  resetAudioIdleTimer();
  return sharedAudioCtx;
}

/**
 * M9: Auto-suspend AudioContext after 30 seconds of inactivity.
 * Saves battery on mobile devices and prevents lock-screen media controls.
 */
function resetAudioIdleTimer() {
  if (audioIdleTimer) clearTimeout(audioIdleTimer);
  audioIdleTimer = setTimeout(() => {
    if (sharedAudioCtx && sharedAudioCtx.state === 'running') {
      sharedAudioCtx.suspend();
    }
  }, 30000); // 30 seconds of inactivity
}

/**
 * Physical modeling synthesis of an acoustic plucked string/bell sound.
 * Uses dual-sine frequencies (fundamental + 3rd harmonic) with rapid decay.
 */
function playAcousticPluck(ctx, freq, duration, now, volumeMultiplier = 1.0) {
  const baseVolume = 0.15 * state.sfxVolume * volumeMultiplier;
  if (baseVolume <= 0) return;

  // Fundamental frequency
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(freq, now);
  osc1.frequency.exponentialRampToValueAtTime(freq * 0.96, now + 0.08);

  // Third harmonic for chime quality
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(freq * 3, now);
  osc2.frequency.exponentialRampToValueAtTime(freq * 3 * 0.96, now + 0.08);

  gain1.gain.setValueAtTime(baseVolume * 0.8, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + duration);

  gain2.gain.setValueAtTime(baseVolume * 0.25, now);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.4);

  osc1.connect(gain1);
  gain1.connect(ctx.destination);

  osc2.connect(gain2);
  gain2.connect(ctx.destination);

  osc1.start(now);
  osc1.stop(now + duration + 0.05);

  osc2.start(now);
  osc2.stop(now + duration * 0.45);
}

// Initialize Web Audio oscillator chime for unlocks and achievements
export function playAchievementChime() {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const vol = state.sfxVolume;
    if (vol <= 0) return;

    if (state.audioTone === 'acoustic') {
      // Arpeggiated sequence of physically modeled plucks
      playAcousticPluck(ctx, 523.25, 0.6, now, 1.0); // C5
      playAcousticPluck(ctx, 659.25, 0.6, now + 0.08, 0.9); // E5
      playAcousticPluck(ctx, 880.00, 0.7, now + 0.16, 1.1); // A5
      playAcousticPluck(ctx, 1046.50, 0.8, now + 0.24, 1.2); // C6
    } else {
      // First tone (fundamental pitch)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
      gain1.gain.setValueAtTime(0.15 * vol, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      
      // Second tone (harmonizing pitch, slightly offset in time)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc2.frequency.exponentialRampToValueAtTime(1046.5, now + 0.25); // C6
      gain2.gain.setValueAtTime(0.12 * vol, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      
      osc1.start(now);
      osc1.stop(now + 0.6);
      
      osc2.start(now + 0.08);
      osc2.stop(now + 0.75);
    }
  } catch (e) {
    console.warn("Web Audio chime failed to play:", e);
  }
}

// Grammatik-Weberei / RPG Drag slide pitch tone generator
export function playDragTone(freq = 280) {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return null;
    const vol = state.sfxVolume;
    if (vol <= 0) return null;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    
    gain.gain.setValueAtTime(0.03 * vol, now);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    
    return { osc, gain, ctx };
  } catch (e) {
    return null;
  }
}

// Standard Mechanical click sound on chip snapping
export function playSnapHaptic() {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    const vol = state.sfxVolume;
    if (vol <= 0) return;

    const now = ctx.currentTime;

    if (state.audioTone === 'acoustic') {
      // Gentle acoustic wooden knock / pluck snap
      playAcousticPluck(ctx, 480, 0.12, now, 0.5);
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.05);
      
      gain.gain.setValueAtTime(0.08 * vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.06);
    }
  } catch (e) {}
}

// Ascending C-Major chord cascade arpeggio on correct answer
export function playSuccessArpeggio() {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    const vol = state.sfxVolume;
    if (vol <= 0) return;

    const now = ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5

    if (state.audioTone === 'acoustic') {
      notes.forEach((freq, idx) => {
        playAcousticPluck(ctx, freq, 0.5, now + idx * 0.06, 0.7);
      });
    } else {
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        
        gain.gain.setValueAtTime(0.08 * vol, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.4);
      });
    }
  } catch (e) {}
}

// Descending pitch sweep accompanied by wrong-shake animation
export function playErrorGlide() {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    const vol = state.sfxVolume;
    if (vol <= 0) return;

    const now = ctx.currentTime;

    if (state.audioTone === 'acoustic') {
      // Physical low pitch damped string drop
      playAcousticPluck(ctx, 130, 0.4, now, 1.2);
      playAcousticPluck(ctx, 98, 0.4, now + 0.08, 1.0);
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now); // A3
      osc.frequency.linearRampToValueAtTime(110, now + 0.35); // A2
      
      // Low pass filter to reduce sawtooth harshness
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, now);
      
      gain.gain.setValueAtTime(0.08 * vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.36);
    }
  } catch (e) {}
}

// Ascending 7-note epic arpeggio cascade for scenario/level completion
export function playEpicArpeggio() {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    const vol = state.sfxVolume;
    if (vol <= 0) return;

    const now = ctx.currentTime;
    // C4 → E4 → G4 → C5 → E5 → G5 → C6 rising cascade
    const freqs = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];

    if (state.audioTone === 'acoustic') {
      freqs.forEach((freq, idx) => {
        playAcousticPluck(ctx, freq, 0.5, now + idx * 0.1, 0.8);
      });
    } else {
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);

        gain.gain.setValueAtTime(0.1 * vol, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.6);
      });
    }
  } catch (e) {}
}

// Initialize Text-to-Speech Engine
export function initTTS() {
  if (!('speechSynthesis' in window)) return;

  globalUtterance = new SpeechSynthesisUtterance();
  globalUtterance.lang = 'de-DE';

  const setGermanVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    const deVoices = voices.filter(voice => voice.lang.startsWith('de') || voice.lang.includes('DE'));
    
    // Prioritize local system voices (like Hedda Desktop on Windows) to avoid cloud network lag
    let deVoice = deVoices.find(voice => voice.localService === true);
    if (!deVoice && deVoices.length > 0) {
      deVoice = deVoices[0]; // Fallback to any German voice
    }
    
    if (deVoice) {
      globalUtterance.voice = deVoice;
    }
  };

  setGermanVoice();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = setGermanVoice;
  }

  // M3 Audit: globalUtterance is module-scoped; no need for window.activeUtterance pollution

  // Track speech playing for Phonetik-Spiegel Reference Visualizer
  globalUtterance.addEventListener('start', () => {
    state.phonetic.isNativePlaying = true;
  });
  globalUtterance.addEventListener('end', () => {
    state.phonetic.isNativePlaying = false;
  });
  globalUtterance.addEventListener('error', () => {
    state.phonetic.isNativePlaying = false;
  });
}

// Speak browser Web Speech API (Text-to-Speech)
export function triggerTTS(card) {
  if (!('speechSynthesis' in window) || !globalUtterance) {
    console.warn("Speech Synthesis is not supported in this browser.");
    return;
  }

  // Ensure text is prepared
  if (!globalUtterance.text || globalUtterance.text === " ") {
    prepareUtterance(card);
  }

  // M3 Audit: globalUtterance is module-scoped and referenced by speech queue;
  // no need for window.activeUtterance global assignment.

  // A3: Visual TTS playback indicator — animate speak button
  const speakBtn = document.getElementById('speak-btn');
  if (speakBtn) {
    speakBtn.classList.add('tts-speaking');
    globalUtterance.onend = () => speakBtn.classList.remove('tts-speaking');
    globalUtterance.onerror = () => speakBtn.classList.remove('tts-speaking');
  }

  // C4 Audit: Replace heuristic setTimeout(30ms) with rAF polling that waits for
  // the speech engine to actually finish cancelling before speaking. Prevents
  // silent utterances on slow Android devices or under CPU pressure.
  try {
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
      const pollAndSpeak = () => {
        if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
          window.speechSynthesis.speak(globalUtterance);
        } else {
          requestAnimationFrame(pollAndSpeak);
        }
      };
      requestAnimationFrame(pollAndSpeak);
    } else {
      window.speechSynthesis.speak(globalUtterance);
    }
  } catch (err) {
    console.warn("Speech synthesis failed, attempting rescue resume/cancel:", err);
    window.speechSynthesis.resume();
    window.speechSynthesis.cancel();
    requestAnimationFrame(() => {
      window.speechSynthesis.speak(globalUtterance);
    });
  }
}

// Pre-prepare SpeechSynthesisUtterance for the current card to eliminate click lag
export function prepareUtterance(card) {
  if (!globalUtterance) return;

  // Clean word of parentheses or brackets for cleaner pronunciation
  let textToSpeak = card.word.replace(/\(.*?\)/g, '').trim();
  
  // Nouns: prepend gender article if not already present
  const cleanWord = textToSpeak.replace(/^(der|die|das)\s+/i, '').trim();
  if (card.gender && !textToSpeak.match(/^(der|die|das)\s+/i)) {
    textToSpeak = `${card.gender} ${cleanWord}`;
  }

  globalUtterance.text = textToSpeak;
}

// Pronounce current German word
export function speakWord() {
  if (state.currentDeck.length === 0) return;
  const card = state.currentDeck[state.currentIndex];

  if (card.audio) {
    const audioObj = new Audio(card.audio);
    audioObj.play().catch(err => {
      console.warn("Failed to play custom audio file, falling back to TTS:", err);
      triggerTTS(card);
    });
  } else {
    triggerTTS(card);
  }
}

// Warm up browser's native text-to-speech engine to prevent startup latency
export function warmUpTTS() {
  if ('speechSynthesis' in window) {
    const silentUtterance = new SpeechSynthesisUtterance(" ");
    silentUtterance.volume = 0;
    silentUtterance.lang = 'de-DE';
    window.speechSynthesis.speak(silentUtterance);
  }
}

// General text speak function (e.g. for RPG NPCs or generic subroutines)
export function speakText(text, lang = 'de-DE', rate = 1.0) {
  if (!('speechSynthesis' in window)) return;
  
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = lang;
  utt.rate = rate;
  
  // Set voice match (using cached voice when available)
  const langPrefix = lang.substring(0, 2);
  const cached = getCachedVoice(langPrefix);
  if (cached) {
    utt.voice = cached;
  } else {
    const voices = window.speechSynthesis.getVoices();
    const matchedVoices = voices.filter(v => v.lang.startsWith(langPrefix));
    if (matchedVoices.length > 0) {
      const localVoice = matchedVoices.find(v => v.localService === true);
      utt.voice = localVoice || matchedVoices[0];
    }
  }
  
  // C4 Audit: rAF polling replaces heuristic setTimeout(40ms)
  try {
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
      const pollAndSpeak = () => {
        if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
          window.speechSynthesis.speak(utt);
        } else {
          requestAnimationFrame(pollAndSpeak);
        }
      };
      requestAnimationFrame(pollAndSpeak);
    } else {
      window.speechSynthesis.speak(utt);
    }
  } catch (err) {
    window.speechSynthesis.speak(utt);
  }
}

// ==========================================
// DUAL-VOICE CONTINUOUS PRONUNCIATION TRAINER
// ==========================================

export function toggleAudioTrainer() {
  if (state.trainer.active) {
    stopAudioTrainer();
  } else {
    startAudioTrainer();
  }
}

export function startAudioTrainer() {
  if (state.currentDeck.length === 0) return;
  
  state.trainer.active = true;
  state.trainer.step = 'idle';
  state.trainer.isNaturalAdvance = true;
  
  // Update UI indicators
  if (elements.trainerPlayBtn) {
    elements.trainerPlayBtn.className = "w-10 h-10 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-95 text-white flex items-center justify-center transition-all shadow-lg shadow-rose-600/30";
    if (elements.trainerPlayIcon) {
      elements.trainerPlayIcon.className = "fa-solid fa-pause text-sm";
    }
  }
  
  if (elements.trainerStatusIcon) elements.trainerStatusIcon.className = "fa-solid fa-headphones-simple text-sm text-indigo-400";
  if (elements.trainerStatusText) elements.trainerStatusText.textContent = "Audio Trainer active...";
  if (elements.trainerPulseRing) elements.trainerPulseRing.classList.remove('opacity-0');
  
  runTrainerStep();
}

export function stopAudioTrainer() {
  state.trainer.active = false;
  state.trainer.step = 'idle';
  state.trainer.isNaturalAdvance = false;
  
  clearTimeout(state.trainer.timerId);
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  
  if (elements.trainerPlayBtn) {
    elements.trainerPlayBtn.className = "w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white flex items-center justify-center transition-all shadow-lg shadow-indigo-600/30";
    if (elements.trainerPlayIcon) {
      elements.trainerPlayIcon.className = "fa-solid fa-play text-sm ml-0.5";
    }
  }
  
  if (elements.trainerStatusIcon) elements.trainerStatusIcon.className = "fa-solid fa-microphone-lines text-sm";
  if (elements.trainerStatusText) elements.trainerStatusText.textContent = "Inactive (Ready)";
  if (elements.trainerPulseRing) elements.trainerPulseRing.classList.add('opacity-0');
}

export function runTrainerStep() {
  if (!state.trainer.active || state.currentDeck.length === 0) return;
  
  const card = state.currentDeck[state.currentIndex];
  const speedScale = 1 / state.trainer.speed;
  if (state.trainer.step === 'idle') {
    state.trainer.step = 'word';
    if (elements.trainerStatusText) elements.trainerStatusText.textContent = `Pronunciation: ${card.word}`;
    
    // 1. Speak German Word
    let textToSpeak = card.word.replace(/\(.*?\)/g, '').trim();
    const cleanWord = textToSpeak.replace(/^(der|die|das)\s+/i, '').trim();
    if (card.gender && !textToSpeak.match(/^(der|die|das)\s+/i)) {
      textToSpeak = `${card.gender} ${cleanWord}`;
    }
    
    const utt = new SpeechSynthesisUtterance(textToSpeak);
    utt.lang = 'de-DE';
    utt.rate = 0.88;
    
    // V3: Use getCachedVoice() — eliminates redundant getVoices() + filter per step
    utt.voice = getCachedVoice('de');
    
    utt.onend = () => {
      state.trainer.timerId = setTimeout(() => {
        state.trainer.step = 'recall_pause';
        runTrainerStep();
      }, 1500 * speedScale);
    };
    
    utt.onerror = () => {
      state.trainer.step = 'recall_pause';
      runTrainerStep();
    };
    
    window.speechSynthesis.speak(utt);
    
  } else if (state.trainer.step === 'recall_pause') {
    state.trainer.step = 'meaning';
    if (elements.trainerStatusText) elements.trainerStatusText.textContent = `Meaning: ${card.meaning}`;
    
    // 2. Speak English Translation
    const textToSpeak = card.meaning.replace(/\(.*?\)/g, '').trim();
    const utt = new SpeechSynthesisUtterance(textToSpeak);
    utt.lang = 'en-US';
    utt.rate = 0.95;
    
    // V3: Use getCachedVoice() — eliminates redundant getVoices() + filter per step
    utt.voice = getCachedVoice('en');
    
    utt.onend = () => {
      state.trainer.timerId = setTimeout(() => {
        state.trainer.step = 'sentence';
        runTrainerStep();
      }, 1000 * speedScale);
    };
    
    utt.onerror = () => {
      state.trainer.step = 'sentence';
      runTrainerStep();
    };
    
    window.speechSynthesis.speak(utt);
    
  } else if (state.trainer.step === 'sentence') {
    if (card.exampleDe) {
      state.trainer.step = 'settle_pause';
      if (elements.trainerStatusText) elements.trainerStatusText.textContent = `Example sentence...`;
      
      const textToSpeak = card.exampleDe.trim();
      const utt = new SpeechSynthesisUtterance(textToSpeak);
      utt.lang = 'de-DE';
      utt.rate = 0.85;
      
      // V3: Use getCachedVoice() — eliminates redundant getVoices() + filter per step
      utt.voice = getCachedVoice('de');
      
      utt.onend = () => {
        state.trainer.timerId = setTimeout(() => {
          advanceTrainerNext();
        }, 2500 * speedScale);
      };
      
      utt.onerror = () => {
        advanceTrainerNext();
      };
      
      window.speechSynthesis.speak(utt);
    } else {
      advanceTrainerNext();
    }
  }
}

function advanceTrainerNext() {
  if (!state.trainer.active) return;
  
  const deckLength = state.currentDeck.length;
  const isAtEnd = state.currentIndex === deckLength - 1;
  
  if (isAtEnd && !state.trainer.loop) {
    stopAudioTrainer();
    if (elements.trainerStatusText) elements.trainerStatusText.textContent = "Trainer completed!";
    return;
  }
  
  // Natural card advancement
  state.trainer.isNaturalAdvance = true;
  state.currentIndex = (state.currentIndex + 1) % deckLength;
  
  // V3: Request card render via CustomEvent (replaces window.renderActiveCardExternal bridge)
  window.dispatchEvent(new CustomEvent('deck:render-active-card'));
  
  // C1 Audit: rAF replaces void offsetWidth forced reflow
  if (elements.flashcard) {
    elements.flashcard.classList.remove('slide-in-right');
    requestAnimationFrame(() => {
      elements.flashcard.classList.add('slide-in-right');
    });
  }
  
  state.trainer.step = 'idle';
  state.trainer.isNaturalAdvance = false;
  
  const speedScale = 1 / state.trainer.speed;
  state.trainer.timerId = setTimeout(() => {
    runTrainerStep();
  }, 1000 * speedScale);
}

export function toggleTrainerLoop() {
  if (!state.trainer) return;
  state.trainer.loop = !state.trainer.loop;
  
  if (elements.trainerLoopBtn) {
    if (state.trainer.loop) {
      elements.trainerLoopBtn.classList.add('bg-indigo-600', 'border-indigo-500', 'text-white', 'hover:bg-indigo-500', 'hover:text-white');
      elements.trainerLoopBtn.classList.remove('bg-slate-950/40', 'border-slate-900/80', 'text-slate-400', 'hover:text-white', 'hover:border-slate-700');
    } else {
      elements.trainerLoopBtn.classList.remove('bg-indigo-600', 'border-indigo-500', 'text-white', 'hover:bg-indigo-500', 'hover:text-white');
      elements.trainerLoopBtn.classList.add('bg-slate-950/40', 'border-slate-900/80', 'text-slate-400', 'hover:text-white', 'hover:border-slate-700');
    }
  }
}

// ==========================================
// CONTINUOUS FOCUS SOUND GENERATION (V6.1)
// Generates white noise, brown noise, or binaural beat oscillators
// purely using client-side Web Audio API without media dependencies.
// ==========================================
let activeFocusNodes = [];

/**
 * Creates and caches an offline AudioBuffer filled with random values.
 */
function createNoiseBuffer(ctx, type) {
  const bufferSize = 2 * ctx.sampleRate; // 2 seconds of looping noise
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  
  let lastOut = 0.0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    if (type === 'white') {
      output[i] = white;
    } else if (type === 'brown') {
      // Leaky integrator to simulate Brownian decay (warm noise)
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5;
    } else if (type === 'pink') {
      // Rain texture (midway decay)
      output[i] = (lastOut + (0.12 * white)) / 1.12;
      lastOut = output[i];
      output[i] *= 2.0;
    }
  }
  return noiseBuffer;
}

/**
 * Starts continuous synthesis of ambient sound.
 * @param {string} type - 'binaural', 'brown', or 'pink'
 */
export function startFocusSound(type) {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    
    stopFocusSound(); // Clean up current nodes first

    const sfxVol = state.sfxVolume !== undefined ? state.sfxVolume : 0.5;
    if (sfxVol <= 0) return;

    if (type === 'binaural') {
      // Dual oscillators: 200Hz left ear, 210Hz right ear (10Hz Alpha waves differential)
      const oscL = ctx.createOscillator();
      const oscR = ctx.createOscillator();
      const gainL = ctx.createGain();
      const gainR = ctx.createGain();
      const merger = ctx.createChannelMerger(2);
      
      oscL.type = 'sine';
      oscR.type = 'sine';
      
      oscL.frequency.setValueAtTime(200, ctx.currentTime);
      oscR.frequency.setValueAtTime(210, ctx.currentTime);
      
      gainL.gain.setValueAtTime(0.04 * sfxVol, ctx.currentTime);
      gainR.gain.setValueAtTime(0.04 * sfxVol, ctx.currentTime);
      
      oscL.connect(gainL);
      oscR.connect(gainR);
      
      gainL.connect(merger, 0, 0); // Connect Left Input to Left output
      gainR.connect(merger, 0, 1); // Connect Right Input to Right output
      
      merger.connect(ctx.destination);
      
      oscL.start();
      oscR.start();
      
      activeFocusNodes.push(oscL, oscR, gainL, gainR, merger);
    } else if (type === 'brown' || type === 'pink') {
      const bufferNode = ctx.createBufferSource();
      bufferNode.buffer = createNoiseBuffer(ctx, type);
      bufferNode.loop = true;
      
      const gainNode = ctx.createGain();
      // Brown noise gets slightly higher volume because it naturally sounds softer due to low frequencies
      gainNode.gain.setValueAtTime((type === 'brown' ? 0.08 : 0.04) * sfxVol, ctx.currentTime);
      
      bufferNode.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      bufferNode.start();
      
      activeFocusNodes.push(bufferNode, gainNode);
    }
  } catch (err) {
    console.warn("[Web Audio] Focus sound start failed:", err);
  }
}

/**
 * Stops any active synthesized focus soundscapes.
 */
export function stopFocusSound() {
  if (activeFocusNodes.length > 0) {
    activeFocusNodes.forEach(node => {
      try {
        node.stop();
      } catch (e) {}
      try {
        node.disconnect();
      } catch (e) {}
    });
    activeFocusNodes = [];
  }
}

