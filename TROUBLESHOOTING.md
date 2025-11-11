# Odoo Connection Troubleshooting Guide

## Test Results

Based on the connection test, here's what we found:

✓ **Server is reachable** - https://stageencodata.erptodo.com/ is responding
✗ **Authentication failed** - "Access Denied" error

## Issue: Authentication Failed

The error `odoo.exceptions.AccessDenied` indicates that the credentials are not being accepted by the Odoo server.

## Possible Causes & Solutions

### 1. **Incorrect Password**
The most common cause. Special characters in passwords can sometimes cause issues.

**Current password contains:** `1qaz/YGV&`
- The `/` and `&` characters might need special handling

**Solution:**
- Try logging in manually through the web interface first: https://stageencodata.erptodo.com/web/login
- Use the exact same credentials to verify they work
- If the password works in the browser, the issue might be with how special characters are being sent

### 2. **Incorrect Database Name**
**Current database:** `dbstageencodata`

**Solution:**
- Verify the exact database name by logging into Odoo web interface
- After login, check the URL or look in the database selector
- Common database naming patterns:
  - Without prefix: `stageencodata`
  - With underscores: `stage_encodata`
  - Different suffix: `dbstageencodata-14` (for Odoo 14)

### 3. **Email vs Username**
**Current login:** `roberto.zanardo@encodata.com`

Some Odoo installations use:
- Email addresses (current)
- Usernames without domain
- Different format

**Solution:**
- Check if you can log in with just `roberto.zanardo` instead
- Or try `admin` if you have admin access

### 4. **Account Disabled or Locked**
The account might be:
- Temporarily locked due to too many failed attempts
- Disabled by administrator
- Not authorized for API access

**Solution:**
- Contact your Odoo administrator
- Check if the account is active in Odoo
- Wait 15-30 minutes if there were multiple failed login attempts

### 5. **2FA (Two-Factor Authentication)**
If 2FA is enabled on the account, standard password authentication won't work.

**Solution:**
- Disable 2FA for this account, OR
- Use an API key instead (Odoo 14+)

### 6. **Special Characters in Password**
The password `1qaz/YGV&` contains special characters that might need URL encoding.

**Solution:**
Try URL-encoding the password in .env:
```
REACT_APP_ODOO_PASSWORD=1qaz%2FYGV%26
```
Where:
- `/` becomes `%2F`
- `&` becomes `%26`

## Immediate Steps to Take

### Step 1: Verify Manual Login
1. Open browser
2. Go to: https://stageencodata.erptodo.com/web/login
3. Try logging in with:
   - Database: `dbstageencodata`
   - Login: `roberto.zanardo@encodata.com`
   - Password: `1qaz/YGV&`

4. If login works → Problem is with API authentication
5. If login fails → Credentials are incorrect

### Step 2: Check Database Name
After successful manual login:
1. Look at the browser URL
2. Check database selector (if visible)
3. Note the exact database name

### Step 3: Try Alternative Formats

Try these combinations in `.env`:

**Option A: Different database name**
```env
REACT_APP_ODOO_URL=https://stageencodata.erptodo.com
REACT_APP_ODOO_DB=stageencodata
REACT_APP_ODOO_USERNAME=roberto.zanardo@encodata.com
REACT_APP_ODOO_PASSWORD=1qaz/YGV&
```

**Option B: Username without domain**
```env
REACT_APP_ODOO_URL=https://stageencodata.erptodo.com
REACT_APP_ODOO_DB=dbstageencodata
REACT_APP_ODOO_USERNAME=roberto.zanardo
REACT_APP_ODOO_PASSWORD=1qaz/YGV&
```

**Option C: URL-encoded password**
```env
REACT_APP_ODOO_URL=https://stageencodata.erptodo.com
REACT_APP_ODOO_DB=dbstageencodata
REACT_APP_ODOO_USERNAME=roberto.zanardo@encodata.com
REACT_APP_ODOO_PASSWORD=1qaz%2FYGV%26
```

**Option D: Remove trailing slash from URL**
```env
REACT_APP_ODOO_URL=https://stageencodata.erptodo.com
REACT_APP_ODOO_DB=dbstageencodata
REACT_APP_ODOO_USERNAME=roberto.zanardo@encodata.com
REACT_APP_ODOO_PASSWORD=1qaz/YGV&
```

After each change, test again:
```bash
node test-odoo-connection.js
```

## Getting Help from Odoo Administrator

If none of the above works, ask your Odoo administrator:

1. **"What is the exact database name?"**
   - They can check in the Odoo configuration

2. **"Is my account enabled for API access?"**
   - Some Odoo installations restrict API access

3. **"Is 2FA enabled on my account?"**
   - If yes, you'll need an API key

4. **"What authentication method should I use?"**
   - Username vs email
   - Password vs API key

5. **"Are there any IP restrictions?"**
   - Your IP might need to be whitelisted

## Using API Keys (Alternative Method)

If password authentication doesn't work, Odoo 14+ supports API keys:

1. Log into Odoo web interface
2. Go to: Preferences → Account Security → API Keys
3. Generate a new API key
4. Use the API key as the password in `.env`

## Contact Information

For further assistance:
- Odoo Documentation: https://www.odoo.com/documentation/14.0/developer/misc/api/odoo.html
- Test script location: `test-odoo-connection.js`
- Run test: `node test-odoo-connection.js`
