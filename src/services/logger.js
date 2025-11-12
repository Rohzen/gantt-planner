/**
 * Logger utility for debugging Odoo sync issues
 * Provides detailed logging with timestamps and context
 */

const LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
};

class Logger {
  constructor() {
    this.logs = [];
    this.enabled = true;
  }

  _formatTimestamp() {
    const now = new Date();
    return now.toISOString();
  }

  _log(level, category, message, data = null) {
    if (!this.enabled) return;

    const logEntry = {
      timestamp: this._formatTimestamp(),
      level,
      category,
      message,
      data
    };

    this.logs.push(logEntry);

    // Console output with styling
    const styles = {
      DEBUG: 'color: #888',
      INFO: 'color: #2196F3',
      WARN: 'color: #FF9800',
      ERROR: 'color: #F44336; font-weight: bold'
    };

    console.log(
      `%c[${logEntry.timestamp}] [${level}] [${category}] ${message}`,
      styles[level] || ''
    );

    if (data) {
      console.log('  Data:', data);
    }
  }

  debug(category, message, data) {
    this._log(LOG_LEVELS.DEBUG, category, message, data);
  }

  info(category, message, data) {
    this._log(LOG_LEVELS.INFO, category, message, data);
  }

  warn(category, message, data) {
    this._log(LOG_LEVELS.WARN, category, message, data);
  }

  error(category, message, data) {
    this._log(LOG_LEVELS.ERROR, category, message, data);
  }

  // Get all logs
  getLogs() {
    return this.logs;
  }

  // Get logs by level
  getLogsByLevel(level) {
    return this.logs.filter(log => log.level === level);
  }

  // Get logs by category
  getLogsByCategory(category) {
    return this.logs.filter(log => log.category === category);
  }

  // Export logs as JSON
  exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  }

  // Clear logs
  clearLogs() {
    this.logs = [];
    this.info('LOGGER', 'Logs cleared');
  }

  // Download logs as file
  downloadLogs() {
    const content = this.exportLogs();
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `odoo-sync-logs-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.info('LOGGER', 'Logs downloaded');
  }

  // Print summary
  printSummary() {
    const summary = {
      total: this.logs.length,
      debug: this.getLogsByLevel(LOG_LEVELS.DEBUG).length,
      info: this.getLogsByLevel(LOG_LEVELS.INFO).length,
      warn: this.getLogsByLevel(LOG_LEVELS.WARN).length,
      error: this.getLogsByLevel(LOG_LEVELS.ERROR).length
    };

    console.log('='.repeat(60));
    console.log('LOG SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total logs: ${summary.total}`);
    console.log(`  DEBUG: ${summary.debug}`);
    console.log(`  INFO: ${summary.info}`);
    console.log(`  WARN: ${summary.warn}`);
    console.log(`  ERROR: ${summary.error}`);
    console.log('='.repeat(60));

    return summary;
  }
}

// Create singleton instance
const logger = new Logger();

// Make it globally accessible for debugging in browser console
if (typeof window !== 'undefined') {
  window.odooLogger = logger;
}

export default logger;
