# CryptoBolt: Step-by-Step Deployment Guide (Start to Finish)

*Updated August 2026 — reflects the current Hostinger panel and Transak dashboard layouts.*

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
6. Deploy the backend (the AI proxy server) — on Hostinger
7. Deploy the frontend (the actual website) — on Hostinger
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
- Unzip the `CryptoBolt` folder somewhere sensible, e.g. `Documents/CryptoBolt`.
- Open it in VS Code: **File → Open Folder** → select that `CryptoBolt` folder.

### 2.2 Open a terminal inside VS Code
- Menu bar: **Terminal → New Terminal**. A terminal panel opens at the bottom, already inside
  your project folder.

### 2.3 Connect this folder to your GitHub repo
If this folder is brand new (not already a git repo connected to GitHub), run:

```bash
git init
git remote add origin https://github.com/sigma-code-op/CryptoBolt.git
```

If the folder is **already** connected to your existing GitHub repo (you've pushed before), skip
this step entirely — check with:
```bash
git remote -v
```
If that prints a URL with `sigma-code-op` in it, you're already connected, move on.

### 2.4 Push the code
```bash
git add .
git commit -m "Deploy-ready CryptoBolt"
git branch -M main
git push -u origin main
```
- First time pushing, it may open a browser window asking you to log into GitHub — do that.
- **Check it worked**: go to `https://github.com/sigma-code-op/CryptoBolt` in your browser.
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

### 4.5 Copy your two keys (you'll need these in Part 7)
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

### 5.2 Get your API key
1. In the left sidebar, click **Developers**.
2. Your **API Key** is shown right there under an "API Key" card — click the copy icon next to
   it and paste it into your scratch note.
3. Note the environment toggle at the top right of the dashboard (Staging / Production) — make
   sure it's set to **Staging** while you copy the key. You'll get a separate Production key
   later, once you're ready to take real payments.
4. Ignore the **API Secret** card below it — that's only needed for advanced backend-to-backend
   integrations, not for the Buy/Sell widget this project uses. Never put the API Secret in any
   frontend code.

### 5.3 About domain whitelisting
Transak's dashboard no longer has a self-serve "Allowed Domains" field. Here's what that means
in practice:
- **Staging** (what you're using now) doesn't enforce domain whitelisting — your key will work
  on `cryptobolt.io` immediately, no extra step needed.
- **Production** (real money) does require your domain to be whitelisted. When you're ready to
  go live (Part 10), you'll need to submit `cryptobolt.io` and `www.cryptobolt.io` to Transak
  support, or through the KYB verification flow at https://forms.transak.com/kyb — this is also
  when Production API access gets unlocked for you.

### 5.4 Leave it in STAGING for now
Don't touch the environment toggle yet — you'll test with fake money first, and only submit for
production access after everything else works (Part 10).

---

## PART 6: Deploy the backend (the AI proxy server) — Hostinger Node.js

This is a small Node.js server that lives in the `server/` folder of your repo. Hostinger's panel
was reorganized recently — the old "Advanced → Node.js" menu is gone. Node.js apps now live under
**Websites**.

1. Log into Hostinger → **hPanel**.
2. Left sidebar → **Websites** → **Web Apps**.
3. Click **Add Website** / **Create Application** (label may say "Deploy Web App" or similar —
   pick the **Node.js web app** option, not WordPress or PHP).
4. Choose **Import Git repository** → **Connect with GitHub**. A popup asks you to install the
   Hostinger GitHub App and pick which repos it can access — allow access to your `CryptoBolt`
   repo (under `sigma-code-op`).
5. Select the repo, branch `main`, and click through to the configuration screen. Hostinger tries
   to auto-detect settings from `package.json` — since your backend lives in the `server/`
   subfolder rather than the repo root, check for a field like **Application root**, **Working
   directory**, or **Install command** and set/adjust it so it points at `server/`:
   - **Application root / working directory**: `server`
   - **Node.js version**: 18 or newer
   - **Build/Install command**: `npm install` (run inside `server/`)
   - **Startup file**: `src/server.js`

   If the setup wizard doesn't offer a subfolder option at all, use the **Upload archive**
   method instead: zip just the contents of your `server/` folder (so `package.json` sits at the
   top of the zip) and upload that instead of connecting the whole repo. You'll then need to
   re-upload/redeploy manually whenever you change backend code, since it won't auto-track GitHub
   pushes.
6. Find the **Environment Variables** section for this app (usually on the app's dashboard under
   a "Environment Variables" or "Settings" tab) and add each of these:

   | Key | Value |
   |---|---|
   | `ALLOWED_ORIGINS` | `https://cryptobolt.io,https://www.cryptobolt.io` |
   | `GROQ_MODEL` | `openai/gpt-oss-120b` |
   | `AI_RATE_LIMIT_MAX` | `30` |
   | `AI_RATE_LIMIT_WINDOW_MINUTES` | `15` |
   | `CONTACT_RATE_LIMIT_MAX` | `5` |
   | `CONTACT_RATE_LIMIT_WINDOW_MINUTES` | `15` |

   (Optional, for the contact form to send real email — see 6.1 below, skip for now if unsure.)

7. Click **Deploy** / **Save**. Wait for the build/deploy log to finish. Hostinger will show you
   the app's URL — something like `https://your-app-name.hostinger.dev` — **copy this, you need
   it in Part 7.**
8. **Check it worked**: open `YOUR-URL/api/health` in a browser. You should see JSON like:
   ```json
   {"ok":true,"service":"cryptobolt-server","model":"openai/gpt-oss-120b", ...}
   ```
   If `model` says something else, go back into the app's Environment Variables and confirm
   `GROQ_MODEL` saved correctly, then redeploy/restart.

### 6.1 (Optional) Contact form email
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
2. Fill in the blanks with what you copied in Parts 4, 5, and 6:

```js
const CW_CONFIG = {
    apiBaseUrl: 'https://your-app-name.hostinger.dev',   // ← your backend URL from Part 6, NO trailing slash
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
2. Left sidebar → **Websites** → click **Add Website**.
3. Choose to deploy from **GitHub** — the wizard will ask you to authorize Hostinger's GitHub
   App if you haven't already (same as Part 6.4), then pick your `CryptoBolt` repo and the
   `main` branch.
4. Set the deployment/public directory to the **repository root** (not `server/` — that's the
   backend, this is the website files).
5. Click **Deploy** / **Save**.

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
2. Since you bought the domain through Hostinger, this may already be pointed correctly — check
   the DNS Zone records for an A record pointing at your site. If it was bought elsewhere,
   either point its **nameservers** to Hostinger's (Hostinger's DNS page shows you the exact
   nameserver addresses to use), or add the specific **A record** Hostinger's setup wizard shows
   you.
3. This step can take anywhere from a few minutes to 24 hours to fully propagate — don't panic
   if `cryptobolt.io` doesn't load instantly.

### 9.2 Create the backend subdomain
1. Still in Hostinger's DNS settings for `cryptobolt.io`, check whether your Node.js app (Part
   6) offers a **Domains** or **Custom Domain** tab within its own app dashboard — Hostinger's
   newer Node.js apps often let you attach a subdomain directly there.
2. If so: attach `api.cryptobolt.io` to the backend app from within its dashboard, and Hostinger
   will handle the DNS record for you automatically.
3. If not: manually add a **CNAME record** in the DNS Zone for `cryptobolt.io`:
   - **Name/Host**: `api`
   - **Points to**: your backend app's Hostinger URL host (e.g. `your-app-name.hostinger.dev`)
4. Once it's attached and resolving, update `js/00-config.js` — change `apiBaseUrl` to
   `https://api.cryptobolt.io` instead of the `.hostinger.dev` URL. Commit and push.

### 9.3 Wait, then confirm HTTPS
- Hostinger auto-issues free HTTPS certificates once DNS is pointed correctly — usually within
  minutes to a couple hours after DNS propagates.
- **Check it worked** — open each of these in a browser and confirm they load with a padlock
  icon (HTTPS, not "not secure"):
  ```
  https://cryptobolt.io
  https://cryptobolt.io/account.html
  https://cryptobolt.io/trade.html
  https://api.cryptobolt.io/api/health
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
      email app opens (depending on whether you set up SMTP in 6.1).
- [ ] Open the AI Insight panel, paste in a Groq API key (get a free one at
      https://console.groq.com if you don't have one), click analyze — it should return a result
      within a few seconds.
- [ ] Right-click anywhere on the page → **Inspect** → **Console** tab — scroll through, there
      shouldn't be red error messages.

If everything above checks out, and you're ready to accept real payments:

1. Submit `cryptobolt.io` for Transak's KYB/production approval (Part 5.3) if you haven't
   already, and get your Production API key from the dashboard.
2. Open `js/00-config.js`, change:
   ```js
   transakApiKey: 'YOUR_PRODUCTION_KEY',
   transakEnvironment: 'PRODUCTION',
   ```
3. Save, commit, push:
   ```bash
   git add js/00-config.js
   git commit -m "Go live with Transak production"
   git push
   ```
4. Hostinger auto-redeploys. Give it a minute, then confirm `trade.html`/Buy still opens
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
to your backend app in Hostinger and fix the `GROQ_MODEL` environment variable, then
restart/redeploy the app.

**Buy/Sell button doesn't open a widget:**
Check `transakApiKey` in `js/00-config.js` is correct and matches the environment
(`transakEnvironment`) you're using. In staging, no domain whitelisting is needed — if it still
fails, double-check for typos or stray spaces in the key.

**Backend health check fails / times out:**
Open your Hostinger Node.js app's dashboard → **Logs** and look for red error text — it usually
tells you exactly what's wrong (missing env var, crashed on startup, etc.).

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
4. Hostinger auto-redeploys both the frontend and backend apps within a minute or two of the
   push (assuming both are connected via GitHub as described above). If you used the manual
   zip-upload method for the backend (Part 6, fallback), you'll need to re-upload it by hand
   after backend changes.
5. GitHub Actions runs your tests automatically in the background — check the **Actions** tab
   on your GitHub repo page for a green check ✅ or red ✗ on your latest commit.