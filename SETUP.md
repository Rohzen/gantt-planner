# Gantt Planner - Setup Guide

## Password Authentication

The application now requires password authentication to access.

### Configuration

1. Copy `public/config.example.json` to `public/config.json`:
   ```bash
   copy public\config.example.json public\config.json
   ```

2. Edit `public/config.json` and set your desired password:
   ```json
   {
     "password": "your-password-here"
   }
   ```

3. The default password is: `gantt2024`

### How it works

- Password is stored in `public/config.json` (not committed to git)
- Authentication uses sessionStorage (expires when browser closes)
- Users must enter the correct password to access the application
- The `public/` folder ensures the config is accessible when deployed to GitHub Pages

## Data Persistence

All task data is now automatically saved to the browser's localStorage.

### Features

- **Automatic saving**: Tasks are saved automatically whenever they change
- **Persistent storage**: Data remains even after closing the browser
- **Load on startup**: Previously saved tasks load automatically when you open the app
- **Sync with Odoo**: You can still sync with Odoo using the "Sincronizza Odoo" button

### How it works

- Tasks are saved to `localStorage` under the key `gantt_tasks`
- On app load, it first checks for saved tasks in localStorage
- If no saved tasks exist, it attempts to load from Odoo
- Changes made locally (add task, upload CSV, etc.) are automatically saved

### Clearing saved data

To clear all saved tasks and start fresh:
```javascript
// Open browser console (F12) and run:
localStorage.removeItem('gantt_tasks');
```

Then refresh the page.

## Running the Application

### Local Development

```bash
npm start
```

The application will open at `http://localhost:3000` and show a login screen.

### Deploying to GitHub Pages

1. Make sure `public/config.json` exists with your password
2. Deploy using:
   ```bash
   npm run deploy
   ```
3. The app will be available at: `https://Rohzen.github.io/gantt-planner`

**Important for GitHub Pages:**
- The `public/config.json` file is in `.gitignore` so it won't be committed
- You need to manually create `public/config.json` before deploying
- Alternatively, you can commit the config file if you're okay with the password being public
- The app uses `process.env.PUBLIC_URL` to correctly load config on GitHub Pages subdirectory

### Deployment Checklist

Before deploying:
- [ ] Create `public/config.json` from `public/config.example.json`
- [ ] Set your desired password in `public/config.json`
- [ ] Run `npm run build` to test the build locally
- [ ] Run `npm run deploy` to publish to GitHub Pages
