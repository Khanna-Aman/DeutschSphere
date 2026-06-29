// Pre-paint level detection to prevent Flash of Incorrect Content (FOIC).
// Loaded as a blocking <script> in <head> (runs before deferred ES6 modules),
// so it can set the title and window.__initialLevel before first paint.
// Extracted from an inline <script> so the CSP script-src can drop 'unsafe-inline'.
(function () {
  try {
    var level = (localStorage.getItem('current_level') || 'a1').toUpperCase();
    document.title = 'German ' + level + ' Flashcards';
    // Set global so body-level elements can read it before ES6 modules load
    window.__initialLevel = level;
  } catch (e) {
    window.__initialLevel = 'A1';
  }
})();
