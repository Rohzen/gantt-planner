/**
 * Odoo Connection Test Script
 * Run with: node test-odoo-connection.js
 */

const axios = require('axios');

// Load environment variables
require('dotenv').config();

const ODOO_URL = process.env.REACT_APP_ODOO_URL;
const ODOO_DB = process.env.REACT_APP_ODOO_DB;
const ODOO_USERNAME = process.env.REACT_APP_ODOO_USERNAME;
const ODOO_PASSWORD = process.env.REACT_APP_ODOO_PASSWORD;

console.log('='.repeat(60));
console.log('ODOO CONNECTION TEST');
console.log('='.repeat(60));
console.log('Configuration:');
console.log(`  URL: ${ODOO_URL}`);
console.log(`  Database: ${ODOO_DB}`);
console.log(`  Username: ${ODOO_USERNAME}`);
console.log(`  Password: ${ODOO_PASSWORD ? '***' + ODOO_PASSWORD.slice(-3) : 'NOT SET'}`);
console.log('='.repeat(60));

async function testConnection() {
  try {
    console.log('\n1. Testing basic connectivity to Odoo server...');

    // Test 1: Basic connectivity
    try {
      const response = await axios.get(ODOO_URL, {
        timeout: 10000,
        validateStatus: () => true // Accept any status code
      });
      console.log(`   ✓ Server is reachable (Status: ${response.status})`);
    } catch (error) {
      console.log(`   ✗ Server is NOT reachable`);
      console.log(`   Error: ${error.message}`);
      if (error.code === 'ENOTFOUND') {
        console.log('   This might be a DNS resolution issue.');
      }
      if (error.code === 'ETIMEDOUT') {
        console.log('   Connection timed out. Check firewall or network.');
      }
      return;
    }

    // Test 2: Authentication
    console.log('\n2. Testing authentication...');
    const authPayload = {
      jsonrpc: '2.0',
      params: {
        db: ODOO_DB,
        login: ODOO_USERNAME,
        password: ODOO_PASSWORD,
      },
    };

    console.log('   Request payload:');
    console.log(`   ${JSON.stringify(authPayload, null, 2)}`);

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

    console.log(`\n   Response status: ${authResponse.status}`);
    console.log('   Response data:');
    console.log(`   ${JSON.stringify(authResponse.data, null, 2)}`);

    if (authResponse.data.error) {
      console.log('\n   ✗ Authentication FAILED');
      console.log('   Error details:');
      console.log(`   ${JSON.stringify(authResponse.data.error, null, 2)}`);

      if (authResponse.data.error.data && authResponse.data.error.data.message) {
        const errorMsg = authResponse.data.error.data.message;
        if (errorMsg.includes('database')) {
          console.log('\n   → Database name might be incorrect');
        }
        if (errorMsg.includes('password') || errorMsg.includes('login')) {
          console.log('\n   → Username or password might be incorrect');
        }
      }
      return;
    }

    if (authResponse.data.result && authResponse.data.result.uid) {
      console.log('\n   ✓ Authentication SUCCESSFUL');
      console.log(`   User ID: ${authResponse.data.result.uid}`);
      console.log(`   Session ID: ${authResponse.data.result.session_id}`);

      // Test 3: Search for tags
      console.log('\n3. Testing tag search (project.tags)...');
      try {
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

        if (tagSearchResponse.data.result) {
          console.log(`   ✓ Tag search successful`);
          console.log(`   Found ${tagSearchResponse.data.result.length} tag(s) containing "Pianificato"`);
          console.log(`   Tag IDs: ${JSON.stringify(tagSearchResponse.data.result)}`);
        } else if (tagSearchResponse.data.error) {
          console.log(`   ✗ Tag search failed`);
          console.log(`   Error: ${JSON.stringify(tagSearchResponse.data.error, null, 2)}`);
        }
      } catch (tagError) {
        console.log(`   ✗ Tag search failed: ${tagError.message}`);
      }

      // Test 4: Search for tasks
      console.log('\n4. Testing task search (project.task)...');
      try {
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

        if (taskSearchResponse.data.result) {
          console.log(`   ✓ Task search successful`);
          console.log(`   Found ${taskSearchResponse.data.result.length} task(s) (showing first 5)`);
          console.log(`   Task IDs: ${JSON.stringify(taskSearchResponse.data.result)}`);
        } else if (taskSearchResponse.data.error) {
          console.log(`   ✗ Task search failed`);
          console.log(`   Error: ${JSON.stringify(taskSearchResponse.data.error, null, 2)}`);
        }
      } catch (taskError) {
        console.log(`   ✗ Task search failed: ${taskError.message}`);
      }

      console.log('\n' + '='.repeat(60));
      console.log('TEST COMPLETED SUCCESSFULLY');
      console.log('='.repeat(60));
    } else {
      console.log('\n   ✗ Authentication response is missing uid');
      console.log('   This might indicate an issue with the Odoo server configuration');
    }

  } catch (error) {
    console.log('\n✗ TEST FAILED');
    console.log(`Error: ${error.message}`);
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    console.log('\nFull error:');
    console.log(error);
  }
}

// Run the test
testConnection().catch(console.error);
