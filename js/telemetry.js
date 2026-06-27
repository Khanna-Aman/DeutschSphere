// js/telemetry.js — Client-side Telemetry, Structured Logging, and Error Boundary Wrappers

export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

class TelemetryLogger {
  constructor() {
    this.currentLevel = LogLevel.INFO;
    this.logs = [];
    this.maxLogBuffer = 100;
  }

  setLevel(level) {
    this.currentLevel = level;
  }

  log(level, module, message, metadata = null) {
    if (level < this.currentLevel) return;

    const timestamp = new Date().toISOString();
    const entry = { timestamp, level, module, message, metadata };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogBuffer) {
      this.logs.shift();
    }

    const prefix = `[${timestamp}] [${module}]`;
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(`${prefix} ${message}`, metadata || '');
        break;
      case LogLevel.INFO:
        console.info(`${prefix} ${message}`, metadata || '');
        break;
      case LogLevel.WARN:
        console.warn(`${prefix} ${message}`, metadata || '');
        break;
      case LogLevel.ERROR:
        console.error(`${prefix} ${message}`, metadata || '');
        break;
    }
  }

  debug(module, message, metadata) { this.log(LogLevel.DEBUG, module, message, metadata); }
  info(module, message, metadata) { this.log(LogLevel.INFO, module, message, metadata); }
  warn(module, message, metadata) { this.log(LogLevel.WARN, module, message, metadata); }
  error(module, message, metadata) { this.log(LogLevel.ERROR, module, message, metadata); }
}

export const logger = new TelemetryLogger();

/**
 * Initializes global error handling boundaries for uncaught JS errors and unhandled promise rejections.
 */
export function initTelemetry() {
  // Suppress the specific Tailwind CDN production-build advisory warning only.
  // Using an exact known prefix avoids swallowing unrelated CDN warnings from other libs.
  const TAILWIND_CDN_WARNING = 'cdn.tailwindcss.com should not be used in production';
  const originalWarn = console.warn;
  console.warn = function(...args) {
    if (
      args[0] &&
      typeof args[0] === 'string' &&
      args[0].includes(TAILWIND_CDN_WARNING)
    ) {
      return; // Suppress only this specific advisory
    }
    originalWarn.apply(console, args);
  };

  window.onerror = function (message, source, lineno, colno, error) {
    logger.error('GlobalErrorBoundary', message, { source, lineno, colno, stack: error ? error.stack : null });
    return false; // Allow standard browser reporting
  };

  window.addEventListener('unhandledrejection', function (event) {
    logger.error('UnhandledPromiseRejection', event.reason ? (event.reason.message || String(event.reason)) : 'Unknown Promise Rejection', { reason: event.reason });
  });

  logger.info('Telemetry', 'Global telemetry and observability hooks initialized successfully.');
}
