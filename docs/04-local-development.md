# 04 — Local Development Guide

This guide walks a new developer through setting up and running SelfCare AI on their local machine.

---

## Prerequisites

Ensure the following are installed before starting:

| Tool | Minimum Version | Check |
|---|---|---|
| **Node.js** | 18.x or later | `node -v` |
| **npm** | Comes with Node.js | `npm -v` |
| A **Gemini API Key** | Free tier available | [aistudio.google.com](https://aistudio.google.com/app/apikey) |

---

## Step 1 — Clone the Repository

```bash
git clone <your-repository-url>
cd selfcare-ai
```

Or, if you already have the project folder, simply open a terminal inside it.

---

## Step 2 — Install Dependencies

```bash
npm install
```

This installs all packages listed in `package.json`:

| Package | Type | Purpose |
|---|---|---|
| `express` | dependency | HTTP server framework |
| `@google/genai` | dependency | Google Gemini API SDK |
| `dotenv` | dependency | Load `.env` variables |
| `cors` | dependency | Cross-origin request handling |
| `nodemon` | devDependency | Auto-restart server on file changes |

---

## Step 3 — Create Your `.env` File

The server requires a Gemini API key. A template file (`.env.example`) is provided.

**Option A — Copy the example file:**

```bash
# macOS / Linux
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

**Option B — Create it manually:**

Create a new file named `.env` in the project root with the following content:

```env
GEMINI_API_KEY=your_actual_api_key_here
```

Replace `your_actual_api_key_here` with the key from [Google AI Studio](https://aistudio.google.com/app/apikey).

> ⚠️ **Never commit your `.env` file.** It is already listed in `.gitignore`, but always double-check before pushing.

---

## Step 4 — Start the Development Server

```bash
npm run dev
```

`npm run dev` runs `nodemon server.js`, which:
1. Starts the Express server on **port 3000** (or `$PORT` if set)
2. Watches `server.js` for changes and auto-restarts

You should see:

```
✅ SelfCare AI server is running at http://localhost:3000
   Press Ctrl+C to stop.
```

---

## Step 5 — Open the App

Open your browser and navigate to:

```
http://localhost:3000
```

The app is fully loaded and ready — type a question about skincare chemistry or fitness nutrition to test.

---

## Quick Verifications

| Check | What to Look For |
|---|---|
| Server started | Terminal shows `✅ SelfCare AI server is running at http://localhost:3000` |
| API key loaded | No `FATAL ERROR: GEMINI_API_KEY is not defined` in terminal |
| Frontend loads | Welcome screen with chip buttons appears in browser |
| AI responds | Send a message and receive a response within a few seconds |
| History is ephemeral | Refresh the page — all messages are gone |

---

## Available npm Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `nodemon server.js` | Development server with hot-reload |
| `start` | `node server.js` | Production start (no auto-restart) |

---

## Common Issues & Fixes

### "FATAL ERROR: GEMINI_API_KEY is not defined"

- Your `.env` file is missing or the variable name is misspelled.
- Ensure the file is at the **root of the project** (same level as `server.js`), not inside `public/`.
- Restart the server after editing `.env`.

### The app loads but AI responses fail

- Your API key may be invalid or expired. Generate a new one at [aistudio.google.com](https://aistudio.google.com/app/apikey).
- Check the terminal for a `Gemini API Error:` log line with details.

### Port 3000 is already in use

Set a different port in your `.env` file:

```env
GEMINI_API_KEY=your_key_here
PORT=3001
```

Then open `http://localhost:3001` instead.

### `npm install` fails

Ensure your Node.js version is 18 or later (`node -v`). You can use [nvm](https://github.com/nvm-sh/nvm) (macOS/Linux) or [nvm-windows](https://github.com/coreybutler/nvm-windows) to switch versions.
