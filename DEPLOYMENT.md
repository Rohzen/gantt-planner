# GitHub Pages Deployment Guide

## Pre-Deployment Setup

### 1. Configure Password

Before deploying, you must set up your password configuration:

```bash
# Copy the example config
copy public\config.example.json public\config.json

# Edit public\config.json and set your password
notepad public\config.json
```

### 2. GitHub Pages Configuration

Your `package.json` already includes:
- ✅ `"homepage": "https://Rohzen.github.io/gantt-planner"`
- ✅ `"predeploy": "npm run build"`
- ✅ `"deploy": "gh-pages -d build"`
- ✅ `gh-pages` package installed

### 3. Important Files for GitHub Pages

- `public/.nojekyll` - Prevents GitHub from processing with Jekyll
- `public/config.json` - Contains your password (not in git)
- `public/config.example.json` - Template for config

## Deployment Steps

### Option A: Deploy with Password in Repository (Not Recommended for Public Repos)

If you want the password to be committed (easier deployment but less secure):

1. Remove `public/config.json` from `.gitignore`
2. Edit `public/config.json` with your password
3. Commit and deploy:
   ```bash
   git add public/config.json
   git commit -m "Add config for deployment"
   npm run deploy
   ```

### Option B: Deploy without Committing Password (Recommended)

The password file is excluded from git, so you need to handle it separately:

1. Create `public/config.json` locally:
   ```bash
   copy public\config.example.json public\config.json
   ```

2. Edit and set your password in `public/config.json`

3. Build and deploy:
   ```bash
   npm run deploy
   ```

**Note:** The `predeploy` script will build the app and include `public/config.json` in the build, even though it's not committed to git.

### Option C: Build Locally and Push to gh-pages Branch

For more control:

1. Create `public/config.json` with your password
2. Build the project:
   ```bash
   npm run build
   ```
3. The `build` folder will contain your `config.json`
4. Deploy to gh-pages:
   ```bash
   npm run deploy
   ```

## Verification

After deployment:

1. Visit: `https://Rohzen.github.io/gantt-planner`
2. You should see the login screen
3. Enter your password from `public/config.json`
4. The app should load successfully

## Troubleshooting

### Config not loading
- Check browser console for errors
- Verify `config.json` is in the `build` folder after running `npm run build`
- Check if the file is accessible at: `https://Rohzen.github.io/gantt-planner/config.json`

### 404 Page Not Found
- Ensure GitHub Pages is enabled in repository settings
- Check that the source is set to "gh-pages" branch
- Wait a few minutes for GitHub to deploy

### Styles not loading
- Verify `"homepage"` in `package.json` matches your repository name
- Check that the path includes the repository name: `/gantt-planner`

### Password not working
- Check that `config.json` was included in the build
- Verify the JSON format is valid
- Check browser console for fetch errors

## Security Considerations

### Public Repository
If your repo is public, anyone can see:
- ❌ `public/config.json` if you commit it
- ✅ The deployed password is NOT visible in the source unless you commit it

### Private Repository
If your repo is private:
- ✅ You can safely commit `public/config.json`
- ✅ Only collaborators can see the password

### Best Practices
- Use a strong password
- Don't reuse passwords from other services
- Consider using environment variables for sensitive data
- For production, consider implementing a proper authentication backend

## Updating the Deployment

To update your deployed app:

```bash
# Make your changes
git add .
git commit -m "Your changes"
git push origin master

# Rebuild and redeploy
npm run deploy
```

## GitHub Repository Settings

Ensure in your repository settings:
1. Go to Settings → Pages
2. Source: "Deploy from a branch"
3. Branch: `gh-pages` / `root`
4. Save

The `gh-pages` package handles creating and pushing to this branch automatically.
