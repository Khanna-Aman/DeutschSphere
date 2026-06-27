// js/phoneme_guides.js — Cybernetic Phoneme Guides for difficult German sounds

export const PHONEME_GUIDES = {
  'ö': {
    title: 'Umlaut Ö [ø:] / [œ]',
    lips: 'Rounded tightly and projected slightly forward (as when saying "O").',
    tongue: 'Positioned high and far forward in the mouth (as when saying "E").',
    instructions: 'Pronounce a long "e" (like the "ay" sound in "day" but pure). Keep your tongue in exactly this high forward position and round your lips into a tight circle "O". The resulting sound is the perfect "Ö"!',
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
    lips: 'Extremely rounded, tight, and projected forward (as when whistling).',
    tongue: 'Positioned very high and far forward, right behind your front teeth (as when saying "I").',
    instructions: 'Pronounce a long "ee" sound (like in "see"). Keep your tongue completely unchanged in this extremely high forward position and round your lips tightly as if saying a very narrow "U"!',
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
    lips: 'Opened wide and slightly relaxed (wider than when saying "A").',
    tongue: 'Lying flat, with the tip of the tongue gently touching the back of your bottom teeth.',
    instructions: 'Open your mouth as if to pronounce a normal "A". Pull the corners of your mouth slightly outward (simulating a wide grin) and raise your tongue minimally to shape an open "E" (like in "bed").',
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
    lips: 'Slightly rounded, pushed forward, and slightly open.',
    tongue: 'The sides of your tongue press against your upper molars, forming a broad channel in the middle.',
    instructions: 'Bring your teeth close together (without fully touching). Form a slight square with your lips, push them forward, and blow the air forcefully through the middle (similar to the English "sh" sound in "shoe").',
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
    title: 'Fricative CH [ç] / [x]',
    lips: 'Slightly open (with the corners of your mouth relaxed or pulled slightly wide).',
    tongue: '"Ich-Laut" [ç] (after e/i/ä/ö/ü): The middle of the tongue rises near the hard palate. "Ach-Laut" [x] (after a/o/u): The back of the tongue rises near the soft palate.',
    instructions: 'For the "Ich-Laut" (after front vowels): whisper a long "yes" and hold the friction sound of the "y". For the "Ach-Laut" (after back vowels): make a gentle clearing-the-throat sound (like breathing onto cold glasses to fog them up).',
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
    title: 'Uvular R [ʁ] / Vocalic R [ɐ]',
    lips: 'Slightly open and relaxed.',
    tongue: 'Consonantal R: The uvula at the back of the soft palate vibrates gently against the back of your tongue.',
    instructions: 'For the consonantal rolled R: imagine gently gargling a tiny sip of water at the very back of your throat. The tongue stays down while the air creates a soft, vibrating friction sound at the back of your palate.',
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
