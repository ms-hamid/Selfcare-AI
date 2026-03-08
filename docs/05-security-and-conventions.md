# 05 — Security & Project Conventions

> **Who this is for:** you (now), future contributors, or anyone deploying this project.
> This document covers secrets management, backend security layers, and coding conventions introduced in the latest hardening update.

---

## 1. API Key Management 🔑

### Where the key lives

Your Gemini API key is stored **only** in `.env` and is never loaded anywhere else.

```
.env                  ← real key goes here (gitignored ✅)
.env.example          ← placeholder committed to git
```

### Rules

| Do ✅ | Don't ❌ |
|---|---|
| Keep the key in `.env` only | Hard-code it in any `.js` file |
| Rotate the key if it was ever exposed | Share it in chat/Slack/email |
| Use `.env.example` as the template | Commit `.env` to Git |

### How to rotate your key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Delete the old key → Create a new one
3. Paste the new key into `.env`:
   ```
   GEMINI_API_KEY=your_new_key_here
   ```
4. Restart the server: `npm run dev`

> **When to rotate:** if you ever accidentally committed `.env`, pushed to a public repo, or shared the key anywhere.

---

## 2. Environment Variables Reference

All runtime config lives in `.env`. Copy from `.env.example` to get started.

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | ✅ Yes | — | Your Google Gemini API key |
| `PORT` | No | `3000` | Port the Express server listens on |
| `ALLOWED_ORIGINS` | No | `http://localhost:{PORT}` | Comma-separated list of trusted CORS origins |

### Example `.env` for local development

```env
GEMINI_API_KEY=AIzaSy...your_key_here
PORT=3000
```

### Example `.env` for production

```env
GEMINI_API_KEY=AIzaSy...your_key_here
PORT=8080
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

---

## 3. CORS Policy 🌐

**CORS (Cross-Origin Resource Sharing)** controls which websites are allowed to call your backend API.

### How it's configured

```js
// server.js
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
  : [`http://localhost:${PORT}`];

app.use(cors({ origin: allowedOrigins, methods: ['GET', 'POST'] }));
```

- **Locally:** only `http://localhost:3000` is trusted by default — no config needed.
- **In production:** set `ALLOWED_ORIGINS` in your host's environment variables panel.

> If you see a CORS error in the browser console, double-check that your frontend's domain is listed in `ALLOWED_ORIGINS`.

---

## 4. Rate Limiting 🚦

The API endpoint `/api/chat` is protected by **express-rate-limit**.

| Setting | Value |
|---|---|
| Window | 60 seconds |
| Max requests per IP | 20 |
| Response when limit hit | `429 Too Many Requests` |

This prevents a single user or bot from flooding your Gemini API quota.

To adjust the limit, edit `server.js`:

```js
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 20,             // change this number
});
```

---

## 5. HTTP Security Headers (Helmet) 🛡️

[`helmet`](https://helmetjs.github.io/) is a middleware that sets important HTTP response headers automatically.

```js
app.use(helmet()); // applied before all routes
```

Headers it sets include:

| Header | Protects Against |
|---|---|
| `X-Content-Type-Options: nosniff` | MIME-type sniffing attacks |
| `X-Frame-Options: SAMEORIGIN` | Clickjacking |
| `Strict-Transport-Security` | HTTP downgrade attacks |
| `X-DNS-Prefetch-Control` | DNS pre-fetching leaks |
| `Referrer-Policy` | Referrer info leakage |

No configuration needed — the defaults are safe for this project.

---

## 6. Error Handling Policy 🤐

**Rule: never expose raw SDK or internal errors to the client.**

```js
// ✅ Correct pattern
catch (error) {
  console.error("[SelfCare AI] Gemini API Error:", error); // full log server-side
  res.status(500).json({ error: "AI service is temporarily unavailable. Please try again." });
}

// ❌ Wrong — leaks internal details
res.status(500).json({ error: "...", details: error.message });
```

If you add new API routes, follow the same pattern: log everything server-side, return only a human-friendly generic message to the client.

---

## 7. Chat History Size Limit 📜

The `chatHistory` array in the frontend is sent to the backend on every request. To prevent hitting Gemini's context token limits on very long sessions, the backend enforces a cap:

```js
// server.js
const MAX_HISTORY_TURNS = 20; // last 20 messages (10 pairs)
const cappedHistory = formattedHistory.slice(-MAX_HISTORY_TURNS);
```

**Why this matters:**
- Gemini has a maximum input token limit; exceeding it causes a hard API error.
- Sending less history = faster responses + lower API costs.
- The "most recent 20 turns" is enough context for coherent conversation in this use case.

To change the limit, update `MAX_HISTORY_TURNS` in `server.js`.

---

## 8. Graceful Shutdown 🧹

The server handles `SIGTERM` and `SIGINT` (Ctrl+C) signals to allow in-flight requests to finish before exiting. This is required for platforms like Railway, Heroku, and Render.

```js
const server = app.listen(PORT, ...);

process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT",  () => server.close(() => process.exit(0)));
```

You don't need to do anything; this runs automatically.

---

## 9. Deployment Checklist 🚀

Before going live, verify:

- [ ] `.env` is **not** committed to your Git repo (`git status` should not show it)
- [ ] `GEMINI_API_KEY` is set in your hosting platform's environment variables
- [ ] `ALLOWED_ORIGINS` is set to your actual frontend domain(s)
- [ ] Node.js version on the server is **≥ 18.0.0** (see `engines` in `package.json`)
- [ ] You've rotated any API key that was ever committed to version control

---

## 10. Key Files Reference

| File | Purpose |
|---|---|
| `server.js` | Express backend — all security middleware is configured here |
| `.env` | Secret config — never commit |
| `.env.example` | Template for `.env` — safe to commit |
| `.gitignore` | Ensures `.env` stays out of Git |
| `public/app.js` | Frontend logic — no secrets should ever be here |
