/**
 * Odoo Connection Test Script
 * Run with: node test-odoo-connection.js
 *
 * This script provides detailed diagnostics for Odoo connection issues:
 * - Network connectivity
 * - DNS resolution
 * - Authentication
 * - API access
 * - Permission checks
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const ODOO_URL = process.env.REACT_APP_ODOO_URL;
const ODOO_DB = process.env.REACT_APP_ODOO_DB;
const ODOO_USERNAME = process.env.REACT_APP_ODOO_USERNAME;
const ODOO_API_KEY = process.env.REACT_APP_ODOO_API_KEY;

// Logging utility
const logs = [];
function log(level, message, data = null) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data
  };
  logs.push(entry);

  const colors = {
    INFO: '\x1b[36m',    // Cyan
    SUCCESS: '\x1b[32m', // Green
    WARN: '\x1b[33m',    // Yellow
    ERROR: '\x1b[31m',   // Red
    DEBUG: '\x1b[90m'    // Gray
  };
  const reset = '\x1b[0m';
  const color = colors[level] || '';

  console.log(`${color}[${entry.timestamp}] [${level}] ${message}${reset}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function saveLogs() {
  const logFile = path.join(__dirname, `odoo-test-${Date.now()}.json`);
  fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
  log('INFO', `Logs saved to: ${logFile}`);
  return logFile;
}

console.log('='.repeat(60));
console.log('ODOO CONNECTION TEST - DETAILED DIAGNOSTICS');
console.log('='.repeat(60));
console.log('Configuration:');
console.log(`  URL: ${ODOO_URL}`);
console.log(`  Database: ${ODOO_DB}`);
console.log(`  Username: ${ODOO_USERNAME}`);
console.log(`  API Key: ${ODOO_API_KEY ? '***' + ODOO_API_KEY.slice(-3) : 'NOT SET'}`);
console.log('='.repeat(60));

async function testConnection() {
  try {
    log('INFO', '=== STEP 1: Basic Connectivity Test ===');

    // Test 1: Basic connectivity
    try {
      const startTime = Date.now();
      const response = await axios.get(ODOO_URL, {
        timeout: 10000,
        validateStatus: () => true // Accept any status code
      });
      const duration = Date.now() - startTime;

      log('SUCCESS', `Server is reachable (${duration}ms)`, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        url: ODOO_URL
      });
    } catch (error) {
      log('ERROR', 'Server is NOT reachable', {
        message: error.message,
        code: error.code,
        url: ODOO_URL
      });

      if (error.code === 'ENOTFOUND') {
        log('ERROR', 'DNS Resolution Failed', {
          message: 'Could not resolve hostname. Possible issues:',
          suggestions: [
            '1. Check if the Odoo URL is correct',
            '2. Verify your DNS settings',
            '3. Try using the IP address instead of hostname'
          ]
        });
      } else if (error.code === 'ETIMEDOUT') {
        log('ERROR', 'Connection Timeout', {
          message: 'Connection timed out. Possible issues:',
          suggestions: [
            '1. Check firewall settings',
            '2. Verify network connectivity',
            '3. Check if Odoo server is behind a VPN',
            '4. Verify IP whitelisting on Odoo server'
          ]
        });
      } else if (error.code === 'ECONNREFUSED') {
        log('ERROR', 'Connection Refused', {
          message: 'Server refused connection. Possible issues:',
          suggestions: [
            '1. Odoo service might not be running',
            '2. Port might be blocked',
            '3. Wrong port number in URL'
          ]
        });
      }
      saveLogs();
      return;
    }

    // Test 2: Authentication
    log('INFO', '=== STEP 2: Authentication Test ===');
    const authPayload = {
      jsonrpc: '2.0',
      params: {
        db: ODOO_DB,
        login: ODOO_USERNAME,
        password: ODOO_API_KEY,
      },
    };

    log('DEBUG', 'Authentication payload (password hidden)', {
      jsonrpc: authPayload.jsonrpc,
      params: {
        db: authPayload.params.db,
        login: authPayload.params.login,
        password: '***'
      }
    });

    const authStartTime = Date.now();
    const authResponse = await axios.post(
      `${ODOO_URL}/web/session/authenticate`,
      authPayload,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 15000,
        validateStatus: () => true
      }
    );
    const authDuration = Date.now() - authStartTime;

    log('INFO', `Authentication request completed (${authDuration}ms)`, {
      status: authResponse.status,
      statusText: authResponse.statusText,
      setCookie: authResponse.headers['set-cookie'] ? 'Present' : 'Missing'
    });

    log('DEBUG', 'Full authentication response', {
      data: authResponse.data,
      headers: authResponse.headers
    });

    if (authResponse.data.error) {
      log('ERROR', 'Authentication FAILED', {
        error: authResponse.data.error,
        errorMessage: authResponse.data.error.data?.message,
        errorCode: authResponse.data.error.code
      });

      if (authResponse.data.error.data && authResponse.data.error.data.message) {
        const errorMsg = authResponse.data.error.data.message;
        if (errorMsg.toLowerCase().includes('database')) {
          log('ERROR', 'Database Error Detected', {
            message: 'The database name appears to be incorrect',
            configuredDB: ODOO_DB,
            suggestion: 'Verify the database name in your Odoo instance'
          });
        }
        if (errorMsg.toLowerCase().includes('password') || errorMsg.toLowerCase().includes('login') || errorMsg.toLowerCase().includes('credential')) {
          log('ERROR', 'Credentials Error Detected', {
            message: 'Username or API key appears to be incorrect',
            configuredUsername: ODOO_USERNAME,
            suggestions: [
              '1. Verify username is correct',
              '2. Check if API key is valid (not expired)',
              '3. Ensure user has API access enabled in Odoo',
              '4. Try regenerating the API key'
            ]
          });
        }
        if (errorMsg.toLowerCase().includes('access denied') || errorMsg.toLowerCase().includes('ip')) {
          log('ERROR', 'Access Denied - Possible IP Restriction', {
            message: 'Your IP might not be whitelisted',
            suggestion: 'Check Odoo IP whitelist settings in system parameters'
          });
        }
      }
      saveLogs();
      return;
    }

    if (authResponse.data.result && authResponse.data.result.uid) {
      log('SUCCESS', 'Authentication SUCCESSFUL', {
        uid: authResponse.data.result.uid,
        username: authResponse.data.result.username,
        sessionId: authResponse.data.result.session_id,
        isSystem: authResponse.data.result.is_system,
        partnerDisplayName: authResponse.data.result.partner_display_name,
        companyId: authResponse.data.result.company_id
      });

      // Test 3: Search for tags
      log('INFO', '=== STEP 3: Tag Search Test ===');
      try {
        const tagStartTime = Date.now();
        const tagSearchResponse = await axios.post(
          `${ODOO_URL}/web/dataset/call_kw`,
          {
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'project.tags',
              method: 'search',
              args: [[['name', 'ilike', 'Pianificato']]],
              kwargs: {},
            },
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Cookie': authResponse.headers['set-cookie']?.join('; ') || ''
            },
            timeout: 15000,
          }
        );
        const tagDuration = Date.now() - tagStartTime;

        if (tagSearchResponse.data.error) {
          log('ERROR', 'Tag search failed', {
            duration: tagDuration,
            error: tagSearchResponse.data.error,
            errorMessage: tagSearchResponse.data.error.data?.message
          });

          if (tagSearchResponse.data.error.data?.message?.toLowerCase().includes('access')) {
            log('ERROR', 'Access Rights Issue', {
              message: 'User may not have permission to access project.tags model',
              suggestion: 'Check user permissions in Odoo for project.tags'
            });
          }
        } else if (tagSearchResponse.data.result) {
          log('SUCCESS', `Tag search successful (${tagDuration}ms)`, {
            count: tagSearchResponse.data.result.length,
            tagIds: tagSearchResponse.data.result
          });

          if (tagSearchResponse.data.result.length === 0) {
            log('WARN', 'No tags found containing "Pianificato"', {
              message: 'This will result in NO tasks being synced',
              suggestion: 'Create a tag named "Pianificato" in Odoo or modify the filter'
            });
          }
        }
      } catch (tagError) {
        log('ERROR', 'Tag search exception', {
          message: tagError.message,
          code: tagError.code,
          response: tagError.response?.data
        });
      }

      // Test 4: Search for tasks
      log('INFO', '=== STEP 4: Task Search Test ===');
      try {
        const taskStartTime = Date.now();
        const taskSearchResponse = await axios.post(
          `${ODOO_URL}/web/dataset/call_kw`,
          {
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'project.task',
              method: 'search',
              args: [[]],
              kwargs: { limit: 5 },
            },
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Cookie': authResponse.headers['set-cookie']?.join('; ') || ''
            },
            timeout: 15000,
          }
        );
        const taskDuration = Date.now() - taskStartTime;

        if (taskSearchResponse.data.error) {
          log('ERROR', 'Task search failed', {
            duration: taskDuration,
            error: taskSearchResponse.data.error,
            errorMessage: taskSearchResponse.data.error.data?.message
          });

          if (taskSearchResponse.data.error.data?.message?.toLowerCase().includes('access')) {
            log('ERROR', 'Access Rights Issue', {
              message: 'User may not have permission to access project.task model',
              suggestion: 'Check user permissions in Odoo for project.task'
            });
          }
        } else if (taskSearchResponse.data.result) {
          log('SUCCESS', `Task search successful (${taskDuration}ms)`, {
            count: taskSearchResponse.data.result.length,
            taskIds: taskSearchResponse.data.result
          });

          if (taskSearchResponse.data.result.length === 0) {
            log('WARN', 'No tasks found in Odoo', {
              message: 'No project tasks exist in the database',
              suggestion: 'Create some tasks in Odoo to test sync'
            });
          }
        }
      } catch (taskError) {
        log('ERROR', 'Task search exception', {
          message: taskError.message,
          code: taskError.code,
          response: taskError.response?.data
        });
      }

      console.log('\n' + '='.repeat(60));
      log('SUCCESS', 'ALL TESTS COMPLETED SUCCESSFULLY');
      console.log('='.repeat(60));

      // Print summary
      const errorLogs = logs.filter(l => l.level === 'ERROR');
      const warnLogs = logs.filter(l => l.level === 'WARN');

      console.log('\nSUMMARY:');
      console.log(`  Total logs: ${logs.length}`);
      console.log(`  Errors: ${errorLogs.length}`);
      console.log(`  Warnings: ${warnLogs.length}`);

      if (errorLogs.length > 0) {
        console.log('\nERRORS DETECTED:');
        errorLogs.forEach(e => console.log(`  - ${e.message}`));
      }

      if (warnLogs.length > 0) {
        console.log('\nWARNINGS:');
        warnLogs.forEach(w => console.log(`  - ${w.message}`));
      }

      // Save logs
      const logFile = saveLogs();
      console.log(`\nDetailed logs saved to: ${logFile}`);

    } else {
      log('ERROR', 'Authentication response missing UID', {
        hasResult: !!authResponse.data.result,
        result: authResponse.data.result,
        message: 'This indicates an issue with the Odoo server configuration'
      });
      saveLogs();
    }

  } catch (error) {
    log('ERROR', 'TEST FAILED WITH EXCEPTION', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });

    if (error.response) {
      log('ERROR', 'HTTP Error Response', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }

    saveLogs();
    console.log('\n✗ TEST FAILED - Check logs above for details');
  }
}

// Run the test
console.log('\nStarting Odoo connection diagnostics...\n');
testConnection().catch(err => {
  log('ERROR', 'Unhandled exception in test', {
    message: err.message,
    stack: err.stack
  });
  saveLogs();
});
