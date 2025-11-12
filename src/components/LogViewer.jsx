import React, { useState, useEffect } from 'react';
import { logger } from '../services/odooService';
import './LogViewer.css';

/**
 * Log Viewer Component
 * Displays real-time logs from the Odoo sync process
 * Allows filtering by level and downloading logs
 */
const LogViewer = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (isOpen) {
      // Refresh logs when opened
      refreshLogs();

      // Auto-refresh every 1 second
      const interval = setInterval(refreshLogs, 1000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const refreshLogs = () => {
    const allLogs = logger.getLogs();
    setLogs(allLogs);

    // Auto-scroll to bottom if enabled
    if (autoScroll) {
      setTimeout(() => {
        const logContainer = document.querySelector('.log-entries');
        if (logContainer) {
          logContainer.scrollTop = logContainer.scrollHeight;
        }
      }, 100);
    }
  };

  const filteredLogs = filter === 'ALL'
    ? logs
    : logs.filter(log => log.level === filter);

  const getLevelColor = (level) => {
    const colors = {
      DEBUG: '#888',
      INFO: '#2196F3',
      WARN: '#FF9800',
      ERROR: '#F44336'
    };
    return colors[level] || '#000';
  };

  const getLevelBadgeClass = (level) => {
    const classes = {
      DEBUG: 'badge-debug',
      INFO: 'badge-info',
      WARN: 'badge-warn',
      ERROR: 'badge-error'
    };
    return classes[level] || '';
  };

  const handleDownload = () => {
    logger.downloadLogs();
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all logs?')) {
      logger.clearLogs();
      refreshLogs();
    }
  };

  const handleCopy = () => {
    const logText = logger.exportLogs();
    navigator.clipboard.writeText(logText);
    alert('Logs copied to clipboard!');
  };

  const summary = {
    total: logs.length,
    debug: logs.filter(l => l.level === 'DEBUG').length,
    info: logs.filter(l => l.level === 'INFO').length,
    warn: logs.filter(l => l.level === 'WARN').length,
    error: logs.filter(l => l.level === 'ERROR').length
  };

  if (!isOpen) return null;

  return (
    <div className="log-viewer-overlay">
      <div className="log-viewer-modal">
        <div className="log-viewer-header">
          <h2>Odoo Sync Logs</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="log-viewer-controls">
          <div className="log-summary">
            <span className="summary-item">Total: {summary.total}</span>
            <span className="summary-item summary-debug">DEBUG: {summary.debug}</span>
            <span className="summary-item summary-info">INFO: {summary.info}</span>
            <span className="summary-item summary-warn">WARN: {summary.warn}</span>
            <span className="summary-item summary-error">ERROR: {summary.error}</span>
          </div>

          <div className="log-filters">
            <label>
              Filter:
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="ALL">All Levels</option>
                <option value="ERROR">Errors Only</option>
                <option value="WARN">Warnings Only</option>
                <option value="INFO">Info Only</option>
                <option value="DEBUG">Debug Only</option>
              </select>
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
              />
              Auto-scroll
            </label>
          </div>

          <div className="log-actions">
            <button onClick={refreshLogs} className="btn-action">Refresh</button>
            <button onClick={handleCopy} className="btn-action">Copy</button>
            <button onClick={handleDownload} className="btn-action">Download</button>
            <button onClick={handleClear} className="btn-action btn-danger">Clear</button>
          </div>
        </div>

        <div className="log-entries">
          {filteredLogs.length === 0 ? (
            <div className="no-logs">
              No logs available. Logs will appear here when you sync with Odoo.
            </div>
          ) : (
            filteredLogs.map((log, index) => (
              <div
                key={index}
                className={`log-entry log-level-${log.level.toLowerCase()}`}
              >
                <div className="log-entry-header">
                  <span className="log-timestamp">{log.timestamp}</span>
                  <span className={`log-level ${getLevelBadgeClass(log.level)}`}>
                    {log.level}
                  </span>
                  <span className="log-category">[{log.category}]</span>
                  <span className="log-message">{log.message}</span>
                </div>
                {log.data && (
                  <div className="log-data">
                    <pre>{JSON.stringify(log.data, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default LogViewer;
