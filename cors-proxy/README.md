# CORS Proxy for Gantt Planner

A simple CORS proxy to enable Odoo API calls from the browser.

## Deploy to Vercel (Free)

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Deploy:
   ```bash
   cd cors-proxy
   vercel
   ```

3. Follow the prompts to deploy

4. You'll get a URL like: `https://your-proxy.vercel.app`

5. Update your Gantt Planner Odoo config to use: `https://your-proxy.vercel.app/proxy?url=`

## Alternative: Deploy to Railway (Free)

1. Go to https://railway.app
2. Connect your GitHub repo
3. Select the `cors-proxy` folder
4. Deploy

## Local Testing

```bash
cd cors-proxy
npm install
node api/proxy.js
```

Then use: `http://localhost:3001/proxy?url=`
