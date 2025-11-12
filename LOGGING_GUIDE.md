# Odoo Sync Logging Guide

This guide explains how to use the comprehensive logging system to debug Odoo synchronization issues.

## Overview

The application now includes detailed logging at every step of the Odoo sync process. This will help identify exactly where and why the sync might be failing.

## Features

### 1. Automatic Logging
The app automatically logs:
- **Configuration**: Odoo URL, database, username, API key presence
- **Authentication**: Login attempts, responses, errors
- **API Calls**: Every request to Odoo with timing information
- **Tag Search**: Finding "Pianificato" tags
- **Task Fetching**: Searching and reading tasks
- **Errors**: Detailed error information with context

### 2. Log Levels
Logs are categorized by severity:
- **DEBUG**: Detailed technical information
- **INFO**: General informational messages
- **WARN**: Warning messages (non-critical issues)
- **ERROR**: Error messages with diagnostic information

### 3. Browser Console Access
All logs are visible in the browser console with color coding:
- 🔵 INFO (Blue)
- 🟡 WARN (Yellow)
- 🔴 ERROR (Red)
- ⚫ DEBUG (Gray)

## Using the Log Viewer

### Opening the Log Viewer
1. Click the **"Log"** button (orange) in the top toolbar
2. The log viewer will open as a modal overlay

### Log Viewer Features
- **Summary**: See count of logs by level
- **Filter**: View only specific log levels (ERROR, WARN, INFO, DEBUG, or ALL)
- **Auto-scroll**: Automatically scroll to newest logs (toggle on/off)
- **Refresh**: Manually refresh the log display
- **Copy**: Copy all logs to clipboard
- **Download**: Download logs as a JSON file for sharing
- **Clear**: Clear all logs

### Interpreting Logs

#### Common Error Scenarios

**1. Authentication Errors**
```
[ERROR] [AUTH] Authentication FAILED
```
Look for:
- `errorMessage`: Contains the actual error from Odoo
- Possible causes:
  - Wrong database name
  - Invalid username
  - Invalid/expired API key
  - User doesn't have API access enabled
  - IP whitelist restriction

**2. Connection Errors**
```
[ERROR] [AUTH] No response received from server
```
Look for `code`:
- `ENOTFOUND`: DNS resolution failed - wrong URL
- `ETIMEDOUT`: Connection timeout - firewall/network issue
- `ECONNREFUSED`: Server refused connection - Odoo not running

**3. Permission Errors**
```
[ERROR] [API_CALL] Access Rights Issue
```
The user doesn't have permission to access certain models (project.tags or project.task)

**4. No Tags Found**
```
[WARN] [TAGS] No tags found containing "Pianificato"
```
No tasks will be synced because the "Pianificato" tag doesn't exist in Odoo

**5. No Tasks Found**
```
[WARN] [TASKS] No tasks found matching criteria
```
No tasks have the "Pianificato" tag assigned

## Command Line Testing

### Running the Test Script
```bash
node test-odoo-connection.js
```

This script performs comprehensive diagnostics:
1. **Basic Connectivity**: Tests if the server is reachable
2. **Authentication**: Tests login with API key
3. **Tag Search**: Tests access to project.tags model
4. **Task Search**: Tests access to project.task model

### Test Script Output
The script provides:
- Colored console output for easy reading
- Detailed error diagnostics with suggestions
- Automatic log file creation: `odoo-test-[timestamp].json`
- Summary of errors and warnings

### Common Issues Detected by Test Script

**DNS Resolution Failed**
```
Suggestions:
1. Check if the Odoo URL is correct
2. Verify your DNS settings
3. Try using the IP address instead of hostname
```

**Connection Timeout**
```
Suggestions:
1. Check firewall settings
2. Verify network connectivity
3. Check if Odoo server is behind a VPN
4. Verify IP whitelisting on Odoo server
```

**Database Error**
```
The database name appears to be incorrect
Verify the database name in your Odoo instance
```

**Credentials Error**
```
Suggestions:
1. Verify username is correct
2. Check if API key is valid (not expired)
3. Ensure user has API access enabled in Odoo
4. Try regenerating the API key
```

**IP Restriction**
```
Your IP might not be whitelisted
Check Odoo IP whitelist settings in system parameters
```

## Browser Console Access

You can also access the logger directly from the browser console:

```javascript
// View all logs
window.odooLogger.getLogs()

// Get errors only
window.odooLogger.getLogsByLevel('ERROR')

// Get logs by category
window.odooLogger.getLogsByCategory('AUTH')

// Print summary
window.odooLogger.printSummary()

// Export logs
window.odooLogger.exportLogs()

// Download logs
window.odooLogger.downloadLogs()

// Clear logs
window.odooLogger.clearLogs()
```

## Troubleshooting Workflow

1. **Run the test script first**
   ```bash
   node test-odoo-connection.js
   ```
   This will identify basic connectivity and authentication issues.

2. **Check the saved log file**
   The test script saves a detailed JSON log file that you can analyze or share.

3. **Try syncing in the browser**
   Click "Sincronizza Odoo" and monitor the browser console.

4. **Open the Log Viewer**
   Click the "Log" button to see all sync logs in a user-friendly interface.

5. **Filter by ERROR**
   In the log viewer, filter to show only errors to quickly identify issues.

6. **Download logs for support**
   If you need help, click "Download" in the log viewer to export logs.

## Configuration Verification

The logger automatically logs your configuration (with sensitive data masked):

```
[INFO] [CONFIG] Odoo Service Configuration
  url: https://your-odoo-instance.com
  database: your-db-name
  username: your-username
  hasApiKey: true
  apiKeyLength: 40
```

Verify this information matches your `.env` file.

## Tips

1. **Enable DEBUG logs** when troubleshooting - they show detailed request/response data
2. **Check timing information** - slow responses might indicate network issues
3. **Look for patterns** - repeated errors might indicate persistent configuration issues
4. **Save logs before clearing** - download them for reference or sharing
5. **Test after each change** - run the test script after modifying configuration

## Common Solutions

### Problem: Authentication fails
**Solution**:
1. Verify API key in Odoo user preferences
2. Check if API key has expired
3. Ensure user has "API Access" permission in Odoo
4. Verify database name is correct

### Problem: No tasks synced
**Solution**:
1. Create a tag named "Pianificato" in Odoo
2. Assign the tag to tasks you want to sync
3. Or modify the filter in `odooService.js` to use a different tag

### Problem: Connection timeout
**Solution**:
1. Check if your IP is whitelisted in Odoo
2. Verify firewall/network settings
3. Test from a different network
4. Contact your Odoo administrator

### Problem: Permission denied
**Solution**:
1. Check user groups in Odoo
2. Ensure user has access to Project app
3. Verify user can read project.task and project.tags models
4. Contact your Odoo administrator

## Getting Help

When asking for help, provide:
1. The downloaded log file from the log viewer
2. The output from `test-odoo-connection.js`
3. Your Odoo version
4. Any recent changes to configuration

## Security Note

Logs never include your actual API key - only a prefix or indication that it exists. However, logs may contain:
- Odoo URL
- Database name
- Username
- Error messages from Odoo

Be cautious when sharing logs publicly.
