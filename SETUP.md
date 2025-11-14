# Gantt Planner - Setup Guide

## Password Authentication

The application now requires password authentication to access.

### Configuration

1. Copy `config.example.json` to `config.json`:
   ```bash
   copy config.example.json config.json
   ```

2. Edit `config.json` and set your desired password:
   ```json
   {
     "password": "your-password-here"
   }
   ```

3. The default password is: `gantt2024`

### How it works

- Password is stored in `config.json` (not committed to git)
- Authentication uses sessionStorage (expires when browser closes)
- Users must enter the correct password to access the application

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

```bash
npm start
```

The application will open at `http://localhost:3000` and show a login screen.
