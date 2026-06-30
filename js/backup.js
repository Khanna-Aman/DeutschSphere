// js/backup.js — Local profile backup/restore: JSON file export + import and the
// Base64 "Sync Key" copy/restore. (Extracted from events.js; data layer only.)

import { state, elements, safeSetItem, safeGetItem } from './state.js';
import * as idb from './idb-keyval.js';

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
        show_images: safeGetItem('show_images', 'true'),
        current_level: safeGetItem('current_level', 'a2')
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
        throw new Error('Invalid file format. It must be a valid .json backup file.');
      }

      const data = backup.data;

      // ── Schema validation (mirrors restoreFromSyncKey guards) ──────────────
      const isArrayOfStrings = (v) => Array.isArray(v) && v.every(x => typeof x === 'string');
      const isPlainObject    = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
      const isSrsStateObj    = (v) => {
        if (!isPlainObject(v)) return false;
        return Object.values(v).every(entry => isPlainObject(entry));
      };
      const VALID_LEVELS = new Set(['a1', 'a2', 'b1']);

      const learnedKeys = ['learned_cards_a1', 'learned_cards_a2', 'learned_cards_b1'];
      const srsKeys     = ['srs_state_a1', 'srs_state_a2', 'srs_state_b1'];
      const customKeys  = ['custom_cards_a1', 'custom_cards_a2', 'custom_cards_b1'];

      learnedKeys.forEach(k => {
        if (data[k] !== undefined && !isArrayOfStrings(data[k])) {
          throw new Error(`Invalid schema: "${k}" must be an array of strings.`);
        }
      });

      srsKeys.forEach(k => {
        if (data[k] !== undefined && !isSrsStateObj(data[k])) {
          throw new Error(`Invalid schema: "${k}" must be a plain object of FSRS state objects.`);
        }
      });

      customKeys.forEach(k => {
        if (data[k] !== undefined && !Array.isArray(data[k])) {
          throw new Error(`Invalid schema: "${k}" must be an array.`);
        }
      });

      if (data.current_level !== undefined && !VALID_LEVELS.has(String(data.current_level))) {
        throw new Error(`Invalid schema: "current_level" must be one of: a1, a2, b1.`);
      }

      if (data.show_images !== undefined && !['true', 'false', true, false].includes(data.show_images)) {
        throw new Error('Invalid schema: "show_images" must be a boolean.');
      }
      // ── End validation ─────────────────────────────────────────────────────

      // Write validated data to IndexedDB
      if (data.learned_cards_a1) await idb.set('learned_cards_a1', JSON.stringify(data.learned_cards_a1));
      if (data.learned_cards_a2) await idb.set('learned_cards_a2', JSON.stringify(data.learned_cards_a2));
      if (data.learned_cards_b1) await idb.set('learned_cards_b1', JSON.stringify(data.learned_cards_b1));

      if (data.srs_state_a1) await idb.set('srs_state_a1', JSON.stringify(data.srs_state_a1));
      if (data.srs_state_a2) await idb.set('srs_state_a2', JSON.stringify(data.srs_state_a2));
      if (data.srs_state_b1) await idb.set('srs_state_b1', JSON.stringify(data.srs_state_b1));

      if (data.custom_cards_a1) await idb.set('custom_cards_a1', JSON.stringify(data.custom_cards_a1));
      if (data.custom_cards_a2) await idb.set('custom_cards_a2', JSON.stringify(data.custom_cards_a2));
      if (data.custom_cards_b1) await idb.set('custom_cards_b1', JSON.stringify(data.custom_cards_b1));

      if (data.show_images !== undefined) safeSetItem('show_images', String(data.show_images));
      if (data.current_level !== undefined) safeSetItem('current_level', String(data.current_level));

      elements.backupImportFeedback.className = 'text-[10px] text-center font-bold text-emerald-400 mt-3';
      elements.backupImportFeedback.textContent = '✓ Backup loaded! Refreshing dashboard...';

      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err) {
      console.error('Backup restore failed:', err);
      elements.backupImportFeedback.className = 'text-[10px] text-center font-bold text-rose-400 mt-3';
      elements.backupImportFeedback.textContent = '✕ Import failed: ' + err.message;
    }
  };

  reader.onerror = function() {
    elements.backupImportFeedback.className = 'text-[10px] text-center font-bold text-rose-400 mt-3';
    elements.backupImportFeedback.textContent = '✕ Error reading the backup file.';
  };

  reader.readAsText(file);
}

export async function copySyncKey() {
  const btn = document.getElementById('sync-copy-btn');
  if (!btn) return;
  
  try {
    const key = await state.generateSyncKey();
    await navigator.clipboard.writeText(key);
    
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-check text-sm text-emerald-400"></i> <span class="text-emerald-400">Copied! ✓</span>`;
    
    setTimeout(() => {
      btn.innerHTML = originalText;
    }, 2000);
  } catch (err) {
    console.error('Failed to generate or copy sync key:', err);
    // Show error inline in the button itself — no blocking alert()
    if (btn) {
      const originalText = btn.innerHTML;
      btn.innerHTML = `<i class="fa-solid fa-xmark text-sm text-rose-400"></i> <span class="text-rose-400">Copy failed</span>`;
      setTimeout(() => { btn.innerHTML = originalText; }, 3000);
    }
  }
}

export async function restoreSyncKey() {
  const input = document.getElementById('sync-restore-input');
  if (!input) return;
  
  const key = input.value.trim();
  const feedback = document.getElementById('backup-import-feedback');

  const showFeedbackError = (msg) => {
    if (feedback) {
      feedback.className = 'text-[10px] text-center font-bold text-rose-400 mt-3';
      feedback.textContent = msg;
    }
  };

  if (!key) {
    showFeedbackError('✕ Please paste a valid Sync Key.');
    return;
  }
  if (feedback) {
    feedback.classList.remove('hidden', 'text-rose-400', 'text-emerald-400');
    feedback.classList.add('text-slate-400');
    feedback.textContent = 'Validating Sync Key...';
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
    


    const hasConflict = 
      impLearnedCount !== localLearnedCount ||
      impCustomCount !== localCustomCount ||
      impSrsCount !== localSrsCount;

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
          </div>

          <!-- Local Profile Column -->
          <div class="col-span-1 bg-slate-950/40 border border-slate-900/80 rounded-xl p-3 flex flex-col space-y-4 text-center">
            <span class="text-[10px] font-black uppercase tracking-wider text-indigo-400">Local Profile</span>
            <span class="text-xs font-black text-slate-100">${localLearnedCount}</span>
            <span class="text-xs font-black text-slate-100">${localCustomCount}</span>
            <span class="text-xs font-black text-slate-100">${localSrsCount}</span>
          </div>

          <!-- Imported Key Column -->
          <div class="col-span-1 bg-indigo-950/10 border border-indigo-900/30 rounded-xl p-3 flex flex-col space-y-4 text-center">
            <span class="text-[10px] font-black uppercase tracking-wider text-pink-400">Imported (Key)</span>
            <span class="text-xs font-black text-slate-100">${impLearnedCount}</span>
            <span class="text-xs font-black text-slate-100">${impCustomCount}</span>
            <span class="text-xs font-black text-slate-100">${impSrsCount}</span>
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
                Combines learned, custom, and FSRS cards of both profiles without duplicates. Safe and seamless progress preservation.
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



        if (feedback) {
          feedback.textContent = "✓ Merge successful! Reloading dashboard...";
        }

        setTimeout(() => {
          window.location.reload();
        }, 1500);

      } catch (err) {
        console.error('Merge and combine failed:', err);
        if (feedback) {
          feedback.className = 'text-[10px] text-center font-bold text-rose-400 mt-3';
          feedback.textContent = '✕ Merge failed: ' + err.message;
        }
      }
    });

  } catch (err) {
    console.error('Sync key restore failed:', err);
    if (feedback) {
      feedback.className = 'text-[10px] text-center font-bold text-rose-400 mt-3';
      feedback.textContent = '✕ Recovery failed: ' + err.message;
    }
  }
}
