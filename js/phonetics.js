// js/phonetics.js — Phonetik-Spiegel: speech recording, live waveform rendering,
// and Levenshtein-based pronunciation scoring. (Extracted from flashcards.js.)

import { state, elements } from './state.js';
import { speakWord, getSharedAudioContext } from './audio.js';
import { PHONEME_GUIDES } from './phoneme_guides.js';

// Module-scoped amplitude smoothing for phonetic waveform (was window.nativeAmp)
let nativeAmp = 0;

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
