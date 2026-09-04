# CryptoBolt Deployment Checklist

Use the complete step-by-step guide in
[CryptoBolt_Complete_Deployment_Guide.md](./CryptoBolt_Complete_Deployment_Guide.md). It is the
single source of truth for deployment configuration and covers:

- The Tailwind CSS build step (`npm run build:css`)
- The Content-Security-Policy build step (`npm run build:csp` — see README.md, "Content-Security-Policy")
- Frontend hosting and domain DNS
- Node backend deployment, including the time-sensitive `GROQ_MODEL` setting
- `js/00-config.js` configuration
- Transak staging and production setup
- Supabase schema, authentication, keys, and cross-device cloud sync (`app_state`)
- SMTP contact-form setup
- HTTPS verification
- CI (GitHub Actions)
- Production smoke tests
- Troubleshooting and future updates

For a quick final check after following the guide:

- [ ] `npm run build:css` has been run and `css/tailwind.css` is committed and current.
- [ ] `npm run build:csp` has been run and every `*.html`'s CSP `<meta>` tag is committed and current.
- [ ] Frontend loads over HTTPS, fully styled.
- [ ] Backend `GET /api/health` returns `ok: true` with a `model` that isn't a retired Groq model.
- [ ] Spot and futures prices update.
- [ ] Supabase sign-up and sign-in work.
- [ ] Cloud sync: data added while signed in on one device/browser appears on another.
- [ ] Transak Buy and Sell work in STAGING.
- [ ] Contact form works or intentionally uses the mailto fallback.
- [ ] AI insight works with a visitor Groq key and local fallback works without one.
- [ ] Browser console has no CORS, missing-file, or CSP violation errors — click through app.html,
      trade.html, and one AdSense-bearing marketing page (e.g. index.html) specifically, since
      those load the widest range of third-party scripts.
- [ ] GitHub Actions CI is green on `main`.
- [ ] Transak is changed to `PRODUCTION` only after staging succeeds.