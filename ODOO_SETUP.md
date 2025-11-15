# Odoo Integration Setup

This guide will help you configure the Gantt Planner to fetch tasks from your Odoo instance.

## Read-Only Access

**Important:** This integration is **READ-ONLY**. The application only fetches data from Odoo and does not write, update, or delete any records. All modifications (adding tasks, editing, etc.) are performed locally in the browser and can be exported to CSV.

## Prerequisites

- Odoo instance running at https://encodata.erptodo.com
- Valid Odoo username and API key
- Database name

## Configuration Steps

### 1. Generate an Odoo API Key

To generate an API key in Odoo:

1. Log in to your Odoo instance
2. Click on your username in the top right corner
3. Select **"My Profile"** or **"Preferences"**
4. Go to the **"Account Security"** tab
5. In the **"API Keys"** section, click **"New API Key"**
6. Enter a description (e.g., "Gantt Planner Integration")
7. Copy the generated API key (you won't be able to see it again!)

**Note:** API keys provide more secure access than passwords and can be revoked individually without changing your password.

### 2. Configure Environment Variables

Edit the `.env` file in the project root with your Odoo credentials:

```env
REACT_APP_ODOO_URL=https://encodata.erptodo.com
REACT_APP_ODOO_DB=dbencodata
REACT_APP_ODOO_USERNAME=roberto.zanardo@encodata.com
REACT_APP_ODOO_API_KEY=your_generated_api_key_here
```

**Important:** Never commit the `.env` file to git. It's already included in `.gitignore`.

### 3. Find Your Database Name

If you don't know your database name, you can find it:
1. Log in to Odoo web interface
2. Check the URL after login - it often contains the database name
3. Or contact your Odoo administrator

### 4. Restart the Development Server

After configuring `.env`, restart the development server:

```bash
# Stop the server (Ctrl+C)
# Start again
npm start
```

## How It Works

### Data Fetching

The app fetches tasks from the `project.task` model in Odoo with the following fields:
- `name` - Task name
- `user_ids` - Assigned users
- `date_start` - Start date
- `date_end` - End date
- `date_deadline` - Deadline
- `project_id` - Project reference
- `stage_id` - Task stage
- `depend_on_ids` - Task dependencies
- `planned_hours` - Planned hours
- `tag_ids` - Task tags

**Important:** By default, the app only fetches tasks that have tags containing "Pianificato". This ensures only planned tasks appear in the Gantt chart.

### Data Transformation

Tasks are transformed to match the Gantt planner format:
- **Resource**: First assigned user from `user_ids`
- **Start Date**: `date_start` or calculated from deadline
- **Duration**: Days between `date_start` and `date_end`, or calculated from `planned_hours` (8h = 1 day)
- **Dependencies**: Mapped from `depend_on_ids`

### Sync Button

Click "Sincronizza Odoo" to refresh tasks from Odoo at any time.

## Troubleshooting

### Authentication Errors

If you see "Impossibile caricare i task da Odoo":
1. Verify credentials in `.env` are correct
2. Check that the database name is correct
3. Ensure your user has access to `project.task` model
4. Check browser console for detailed error messages

### CORS Issues (CRITICAL for GitHub Pages deployment)

**Important:** Public CORS proxies (like corsproxy.io) **DO NOT WORK** with Odoo because they cannot forward session cookies!

#### Recommended Solution: Configure CORS on Your Odoo Server

1. **Install the CORS module** on your Odoo instance:
   - Search for "web_cors" in Odoo Apps
   - Install it (may require developer mode)

2. **Configure CORS settings**:
   - Go to Settings → Technical → Parameters → System Parameters
   - Add/modify parameter: `web.cors.allowed_origins`
   - Set value to your GitHub Pages URL: `https://rohzen.github.io`
   - Save

3. **In the app configuration**:
   - Open "Config Odoo" button
   - **UNCHECK** "Usa CORS Proxy"
   - Save configuration

#### Alternative: Deploy Your Own CORS Proxy

If you cannot modify Odoo server settings:
1. Deploy the custom proxy in `/cors-proxy` folder to Vercel/Netlify
2. Use your proxy URL in "Config Odoo" dialog
3. See `/cors-proxy/README.md` for deployment instructions

The custom proxy properly forwards cookies and maintains Odoo sessions.

### No Tasks Displayed

If the app loads but shows no tasks:
1. Verify tasks exist in Odoo `project.task`
2. **Check that tasks have a tag containing "Pianificato"** - this is required by default
3. Check that tasks have required fields populated (name, dates, assigned users)
4. Use browser developer tools to inspect the API response
5. Check browser console for warnings about missing tags

## Using CSV Upload as Fallback

If Odoo integration doesn't work, you can still use the CSV upload feature:

CSV Format:
```
Nome,Risorsa,DataInizio,Durata,Tipo
Task Name,Resource Name,2024-11-11,3,Consulenza
```

## API Details

The app uses Odoo's JSON-RPC API:
- **Authentication**: `/web/session/authenticate` (using API key)
- **Data calls**: `/web/dataset/call_kw`

Authentication is performed using an API key (passed in the password field) and is session-based with cookies. This is more secure than using passwords directly and allows you to revoke access without changing your account password.
