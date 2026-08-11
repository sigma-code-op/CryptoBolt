# CryptoBolt: Step-by-Step Deployment Guide (Start to Finish)

This assumes you're starting fresh and want every click spelled out. Follow the parts in order —
don't skip ahead, later parts depend on earlier ones. Each step tells you exactly what to click
and what you should see afterward, so you know if it worked before moving on.

**The big picture, so you know where you're headed:**

```
1. Get the code on GitHub
2. Build the CSS (one command)
3. Set up Supabase (accounts + cloud sync database)
4. Set up Transak (crypto buy/sell)
5. Put your Supabase/Transak keys into the code
6. Deploy the backend (the AI proxy server)
7. Deploy the frontend (the actual website) to Hostinger
8. Connect your domain + HTTPS
9. Test everything on the live site
```

Grab a coffee. This takes 45–90 minutes the first time, mostly waiting for things to load.

---

## PART 1: Get the tools installed

You only do this once, ever, on your computer.

### 1.1 Install Git
- Go to https://git-scm.com/downloads, download for your OS, run the installer, click Next
  through all the defaults.
- **Check it worked**: open a terminal (Terminal on Mac, Command Prompt or PowerShell on
  Windows) and type:
  ```bash
  git --version
  ```
  You should see something like `git version 2.43.0`. If you get "command not found," restart
  your terminal/computer and try again.

### 1.2 Install Node.js
- Go to https://nodejs.org, download the **LTS** version (not "Current"), run the installer,
  Next through the defaults.
- **Check it worked**:
  ```bash
  node --version
  npm --version
  ```
  You should see something like `v22.x.x` and `10.x.x`. Needs to be v18.17 or higher.

### 1.3 Make sure you have a GitHub account
- If you don't: go to https://github.com/signup and create one. Verify your email.
- You already have the repo under `sigma-code-op` — make sure you can log in to that account.

---

## PART 2: Get the project code onto your computer and into GitHub

### 2.1 Open the project folder
- Unzip the `CryptoBolt` folder I gave you somewhere sensible, e.g. `Documents/CryptoBolt`.
- Open it in VS Code: **File → Open Folder** → select that `CryptoBolt` folder.

### 2.2 Open a terminal inside VS Code
- Menu bar: **Terminal → New Terminal**. A terminal panel opens at the bottom, already inside
  your project folder.

### 2.3 Connect this folder to your GitHub repo
If this folder is brand new (not already a git repo connected to GitHub), run:

```bash
git init
git remote add origin https://github.com/sigma-code-op/YOUR-REPO-NAME.git
```

Replace `YOUR-REPO-NAME` with your actual repo name on GitHub. If you're not sure it exists yet:
go to https://github.com/new, name it (e.g. `cryptobolt`), leave everything else default, click
**Create repository**, and use that URL above.

If the folder is **already** connected to your existing GitHub repo (you've pushed before), skip
this step entirely — check with:
```bash
git remote -v
```
If that prints a URL with `sigma-code-op` in it, you're already connected, move on.

### 2.4 Push the code
```bash
git add .
git commit -m "Deploy-ready CryptoBolt: AI model fix, cloud sync, compiled Tailwind"
git branch -M main
git push -u origin main
```
- First time pushing, it may open a browser window asking you to log into GitHub — do that.
- **Check it worked**: go to `https://github.com/sigma-code-op/YOUR-REPO-NAME` in your browser.
  You should see all the files (`index.html`, `js/`, `server/`, etc.) listed there.

---

## PART 3: Build the CSS (one-time-per-change step)

The site's styling is compiled from Tailwind into one file. You need to do this once now, and
again any time you edit HTML/CSS classes in the future.

In the VS Code terminal, inside the project folder:

```bash
npm install
npm run build:css
```

- **Check it worked**: a file `css/tailwind.css` should exist and be roughly 40KB. Run
  `ls -la css/` (Mac/Linux) or `dir css` (Windows) and confirm you see it.
- Then push it:
  ```bash
  git add css/tailwind.css
  git commit -m "Build CSS"
  git push
  ```

**Remember this for later**: every time you change a class name in any `.html` or `.js` file,
you must run `npm run build:css` again before pushing, or the live site will look broken/unstyled.

---

## PART 4: Set up Supabase (handles sign-in + cloud sync)

### 4.1 Create the project
1. Go to https://supabase.com → click **Start your project** → sign in (GitHub login is easiest).
2. Click **New project**.
3. Fill in:
   - **Name**: `cryptobolt` (or anything)
   - **Database Password**: click "Generate a password," then **copy it somewhere safe** — you
     won't need it for this app, but save it anyway.
   - **Region**: pick whichever is closest to your users.
   - **Pricing Plan**: Free is plenty.
4. Click **Create new project**. Wait 1–2 minutes while it provisions — you'll see a progress
   screen, then land on the project dashboard.

### 4.2 Run the database setup script
1. In the left sidebar, click the **SQL Editor** icon (looks like `</>`).
2. Click **New query**.
3. Open `supabase/schema.sql` from your project folder in VS Code, select all the text
   (Ctrl/Cmd+A), copy it (Ctrl/Cmd+C).
4. Paste it into the Supabase SQL editor box.
5. Click **Run** (bottom right, or Ctrl/Cmd+Enter).
6. **Check it worked**: you should see "Success. No rows returned" at the bottom. In the left
   sidebar click **Table Editor** — you should now see two tables listed: `purchases` and
   `app_state`.

### 4.3 Turn on email confirmation (recommended)
1. Left sidebar → **Authentication** → **Providers**.
2. Click on **Email**.
3. Make sure **Confirm email** is toggled ON.
4. Click **Save** if it shows a save button.

### 4.4 Set your site URL
1. Still in **Authentication**, click **URL Configuration** in the left sub-menu.
2. **Site URL**: type `https://cryptobolt.io`
3. Under **Redirect URLs**, click **Add URL** and add:
   ```
   https://cryptobolt.io/**
   https://www.cryptobolt.io/**
   ```
4. Click **Save**.

### 4.5 Copy your two keys (you'll need these in Part 6)
1. Left sidebar → **Project Settings** (gear icon) → **API**.
2. You'll see **Project URL** — copy it, paste it into a scratch note. Looks like
   `https://abcdefgh.supabase.co`.
3. Below that, **Project API keys** → find the one labeled **anon** / **public** — copy it too.
   It's a long string starting with `eyJ...`.
4. **Do not copy or use the `service_role` key anywhere in this project.** That one is secret
   and must never go into the website's code.

---

## PART 5: Set up Transak (crypto buy/sell widget)

### 5.1 Create an account
1. Go to https://dashboard.transak.com/ → sign up / log in.

### 5.2 Create an API key
1. In the left sidebar, find **Developer** → **API Keys** (naming may vary slightly by dashboard
   version — look for "API Keys" or "Integration").
2. Click **Create new API key** (or similar).
3. Copy the key it gives you — paste into your scratch note.

### 5.3 Allow your domain
1. Find **Allowed Domains** (usually on the same API key settings page).
2. Add both:
   ```
   cryptobolt.io
   www.cryptobolt.io
   ```
3. Save.

### 5.4 Leave it in STAGING for now
Don't touch the environment/production toggle yet — you'll test with fake money first, and flip
to production only after everything works (Part 9).

---

## PART 6: Deploy the backend (the AI proxy server)

This is a small Node.js server. You have two good options — pick ONE.

### Option A: Render.com (easiest for a first deploy, free tier)

1. Go to https://render.com → sign up (GitHub login is easiest — it'll ask to connect your
   GitHub account, allow it).
2. Click **New +** (top right) → **Web Service**.
3. Find and select your `sigma-code-op` repo → click **Connect**.
4. Fill in the form:
   - **Name**: `cryptobolt-api` (this becomes part of your URL)
   - **Region**: closest to you
   - **Branch**: `main`
   - **Root Directory**: `server`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. Scroll down to **Environment Variables** → click **Add Environment Variable** and add each of
   these one at a time (name in the left box, value in the right box):

   | Key | Value |
   |---|---|
   | `ALLOWED_ORIGINS` | `https://cryptobolt.io,https://www.cryptobolt.io` |
   | `GROQ_MODEL` | `openai/gpt-oss-120b` |
   | `AI_RATE_LIMIT_MAX` | `30` |
   | `AI_RATE_LIMIT_WINDOW_MINUTES` | `15` |
   | `CONTACT_RATE_LIMIT_MAX` | `5` |
   | `CONTACT_RATE_LIMIT_WINDOW_MINUTES` | `15` |

   (Optional, for the contact form to send real email — see Part 6.3 below, skip for now if
   unsure.)

6. Click **Create Web Service** (bottom of page). Wait 2–5 minutes while it builds — you'll see
   a log stream. When it says "Your service is live," it's done.
7. At the top of the page you'll see your URL, something like
   `https://cryptobolt-api.onrender.com`. **Copy this — you need it in Part 7.**

**Check it worked**: open `https://cryptobolt-api.onrender.com/api/health` (your actual URL) in a
browser. You should see JSON text like:
```json
{"ok":true,"service":"cryptobolt-server","model":"openai/gpt-oss-120b", ...}
```
If `model` says `llama-3.3-70b-versatile`, your `GROQ_MODEL` env var didn't save — go back and
check it under Render's **Environment** tab.

### Option B: Hostinger Node.js (if your Hostinger plan includes it)

1. Log into Hostinger → **hPanel**.
2. Find **Websites** or **Advanced → Node.js** (exact label depends on your plan — if you don't
   see a Node.js option at all, your plan doesn't support it; use Option A instead).
3. Click **Create Application** (or similar).
4. Set:
   - **Node.js version**: 18 or newer
   - **Application root**: point it at the `server` folder of your repo (connect via Git if
     offered, or upload the contents of `server/` directly so `package.json` sits at the top).
   - **Startup file**: `src/server.js`
5. Find the **Environment Variables** section for this app and add the same six variables from
   the table in Option A above.
6. Click **Save** / **Deploy**. Hostinger will show you the app's URL — copy it.
7. **Check it worked**: same as Option A — open `YOUR-URL/api/health` in a browser and confirm
   `ok: true` and the correct model.

### 6.3 (Optional) Contact form email
Skip this if you're fine with the contact form opening the visitor's email app instead of
sending directly. To send real email through a Hostinger mailbox, add these additional env
variables (same place as above):

| Key | Value |
|---|---|
| `SMTP_HOST` | `smtp.hostinger.com` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | `hello@cryptobolt.io` |
| `SMTP_PASS` | *(your mailbox password)* |
| `CONTACT_TO_EMAIL` | `hello@cryptobolt.io` |
| `CONTACT_FROM_EMAIL` | `hello@cryptobolt.io` |

Save, then restart/redeploy the backend app for it to pick up the new variables.

---

## PART 7: Put your keys into the code

1. In VS Code, open `js/00-config.js`.
2. It should look like this — fill in the blanks with what you copied in Parts 4, 5, and 6:

```js
const CW_CONFIG = {
    apiBaseUrl: 'https://cryptobolt-api.onrender.com',   // ← your backend URL from Part 6, NO trailing slash
    aiInsightUrl: '/api/ai-insight',
    transakApiKey: 'PASTE_YOUR_TRANSAK_KEY_HERE',         // ← from Part 5.2
    transakEnvironment: 'STAGING',                         // ← leave as STAGING for now
    supabaseUrl: 'https://abcdefgh.supabase.co',           // ← from Part 4.5
    supabaseAnonKey: 'eyJ....'                              // ← from Part 4.5 (the "anon" key)
};
```

3. Save the file.
4. Push it:
   ```bash
   git add js/00-config.js
   git commit -m "Add Supabase, Transak, and backend config"
   git push
   ```

---

## PART 8: Deploy the frontend to Hostinger

### 8.1 Connect Hostinger to your GitHub repo
1. Log into Hostinger → **hPanel**.
2. **Websites** → **Add Website** (or if you already have the site, go to its dashboard instead
   and skip to 8.2).
3. Choose the option to deploy from **GitHub** (may be labeled "Git" or under "Advanced →
   Git").
4. Authorize Hostinger to access your GitHub account if asked, then select the `sigma-code-op`
   repo and the `main` branch.
5. Set the deployment/public directory to the **repository root** (not `server/` — that's the
   backend, this is the website files).
6. Click **Deploy** / **Save**.

### 8.2 Confirm it deployed
- Hostinger will show a deployment log — wait for it to say success.
- **Check it worked**: visit the temporary Hostinger URL it gives you (something like
  `yoursite.hostinger.site`) — you should see the CryptoBolt homepage, fully styled (not a blank
  or broken-looking page).

From now on, every time you `git push` to `main`, Hostinger automatically redeploys the latest
version — that's the whole point of connecting it to GitHub.

---

## PART 9: Connect your domain + HTTPS

### 9.1 Point your domain at Hostinger
1. In Hostinger hPanel, find **Domains** → select `cryptobolt.io` → **DNS / Name Servers**.
2. If the domain was bought elsewhere, log into that registrar and either:
   - point its **nameservers** to Hostinger's (Hostinger's DNS page shows you the exact
     nameserver addresses to use), or
   - add the specific **A record** / **CNAME record** Hostinger's setup wizard shows you.
3. This step can take anywhere from a few minutes to 24 hours to fully propagate — don't panic
   if `cryptobolt.io` doesn't load instantly.

### 9.2 Create the backend subdomain (if using Option A/Render for backend)
1. Still in Hostinger's DNS settings for `cryptobolt.io`, add a new **CNAME record**:
   - **Name/Host**: `api`
   - **Points to**: your Render URL's host, e.g. `cryptobolt-api.onrender.com`
2. In Render, go to your web service → **Settings** → **Custom Domains** → **Add Custom Domain**
   → type `api.cryptobolt.io` → follow its verification steps.
3. Once verified, **update `js/00-config.js`** — change `apiBaseUrl` to `https://api.cryptobolt.io`
   instead of the `onrender.com` URL, then also add `https://api.cryptobolt.io`... actually no
   change needed to `ALLOWED_ORIGINS` (that's about who's *allowed to call* the backend, i.e. your
   frontend domain — leave it as `cryptobolt.io`). Commit and push the config change.

### 9.3 Wait, then confirm HTTPS
- Hostinger and Render both auto-issue free HTTPS certificates once DNS is pointed correctly —
  usually within minutes to a couple hours after DNS propagates.
- **Check it worked** — open each of these in a browser and confirm they load with a padlock
  icon (HTTPS, not "not secure"):
  ```
  https://cryptobolt.io
  https://cryptobolt.io/account.html
  https://cryptobolt.io/trade.html
  https://api.cryptobolt.io/api/health   (or your Render URL if you skipped 9.2)
  ```

---

## PART 10: Full test pass on the live site

Go through this list on the real `https://cryptobolt.io` — check each box mentally as you go:

- [ ] Homepage loads, fully styled, prices are updating live.
- [ ] Click a coin — chart updates. Try switching timeframes and indicators.
- [ ] Go to `trade.html` — paper trading page loads and lets you place a test order.
- [ ] Click **Sign In** → **Sign Up** → use a real email you can check → confirm you get a
      confirmation email → click the link in it → come back and sign in.
- [ ] After signing in, go to **My Account** — page loads without errors.
- [ ] Add something to your watchlist while signed in. Open the site in a different browser (or
      an incognito window), sign in with the same account — the watchlist item should appear
      there too within a few seconds (that's cloud sync working).
- [ ] Click **Buy/Sell** — the Transak widget should open (still in STAGING, so no real money).
- [ ] Go to `contact.html`, fill out the form, submit — either you get a confirmation, or your
      email app opens (depending on whether you set up SMTP in 6.3).
- [ ] Open the AI Insight panel, paste in a Groq API key (get a free one at
      https://console.groq.com if you don't have one), click analyze — it should return a result
      within a few seconds.
- [ ] Right-click anywhere on the page → **Inspect** → **Console** tab — scroll through, there
      shouldn't be red error messages.

If everything above checks out, switch Transak to real money:

1. Open `js/00-config.js`, change:
   ```js
   transakEnvironment: 'PRODUCTION',
   ```
2. Save, commit, push:
   ```bash
   git add js/00-config.js
   git commit -m "Go live with Transak production"
   git push
   ```
3. Hostinger auto-redeploys. Give it a minute, then confirm `trade.html`/Buy still opens
   correctly.

**You're live.** 🎉

---

## If something's broken — quick fixes

**Site loads but looks unstyled/broken (no colors, everything stacked weird):**
`css/tailwind.css` didn't get built or deployed. Run `npm run build:css` locally, then
`git add css/tailwind.css`, commit, push.

**"Sign In" doesn't work / errors in console mentioning Supabase:**
Double check `supabaseUrl` and `supabaseAnonKey` in `js/00-config.js` are copied correctly
(no extra spaces, no quotes missing) — recopy from Supabase's **Project Settings → API** page.

**AI panel says "model unavailable" or similar:**
Open `YOUR-BACKEND-URL/api/health` in a browser. Check the `model` field. If it's wrong, go back
to your backend host (Render or Hostinger) and fix the `GROQ_MODEL` environment variable, then
restart the service.

**Buy/Sell button doesn't open a widget:**
Check `transakApiKey` in `js/00-config.js`, and confirm `cryptobolt.io` is in Transak's Allowed
Domains list (Part 5.3).

**Backend health check fails / times out:**
Open your backend host's dashboard (Render: your service → **Logs** tab) and look for red error
text — it usually tells you exactly what's wrong (missing env var, crashed on startup, etc.).

**CORS error in the browser console** (mentions "blocked by CORS policy"):
Your `ALLOWED_ORIGINS` env var on the backend doesn't exactly match your live domain. It must be
`https://cryptobolt.io,https://www.cryptobolt.io` — check for typos, and that it's `https` not
`http`.

---

## Making changes later (your normal workflow going forward)

1. Edit files in VS Code.
2. **If you changed any CSS class names**, run `npm run build:css`.
3. ```bash
   git add .
   git commit -m "describe what you changed"
   git push
   ```
4. Hostinger auto-redeploys the frontend within a minute or two. If you changed backend code
   (`server/` folder), also redeploy on Render (it also auto-redeploys on push, same as
   Hostinger) or Hostinger Node.js (may need a manual restart depending on your plan).
5. GitHub Actions runs your tests automatically in the background — check the **Actions** tab
   on your GitHub repo page for a green check ✅ or red ✗ on your latest commit.