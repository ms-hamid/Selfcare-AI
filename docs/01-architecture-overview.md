# 01 — Architecture Overview

> **SelfCare AI** is a science-based chatbot that answers questions about skincare chemistry and fitness nutrition. It is intentionally simple: a thin Express server acts as a secure proxy between the browser and the Gemini API.

---

## System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                           │
│                                                                 │
│  index.html  ──loads──►  app.js  ──manages──►  chatHistory[]   │
│      │                      │                   (in-memory)    │
│      │                      │                                  │
│      │               fetch POST /api/chat                      │
│      │               { prompt, history[] }                     │
└──────┼──────────────────────┼──────────────────────────────────┘
       │                      │
       │              HTTP (localhost:3000)
       │                      │
       ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                       EXPRESS BACKEND  (server.js)              │
│                                                                 │
│  1. Validates & sanitizes incoming request                      │
│  2. Formats history[] for Gemini SDK format                     │
│  3. Creates a Gemini chat session with System Instruction &     │
│     generation config (temperature, topP, topK)                 │
│  4. Calls chat.sendMessage(prompt)                              │
│  5. Returns { response: "AI text..." }                          │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                    HTTPS (Google API)
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     GOOGLE GEMINI API                           │
│                   (gemini-2.5-flash model)                      │
│                                                                 │
│  · Receives: systemInstruction + history[] + latest prompt      │
│  · Returns:  generated text response                            │
└─────────────────────────────────────────────────────────────────┘
```

**Key design principle:** The API Key (`GEMINI_API_KEY`) is **never exposed to the browser**. It lives only in the `.env` file on the server, and the frontend only ever talks to `localhost:3000`.

---

## Tech Stack

| Layer | Technology | Role in This Project |
|---|---|---|
| **Runtime** | **Node.js** | JavaScript runtime for the backend server |
| **HTTP Framework** | **Express.js** | Routes HTTP requests, serves static files, hosts the `/api/chat` endpoint |
| **AI SDK** | **@google/genai** | Official Google SDK for communicating with the Gemini 2.5 Flash model |
| **Env Management** | **dotenv** | Loads `GEMINI_API_KEY` from `.env` file into `process.env` securely |
| **Dev Server** | **nodemon** | Auto-restarts the server when `server.js` is modified during development |
| **Styling** | **Tailwind CSS (CDN)** | Utility-first CSS framework used for layout (flex, grid, responsive breakpoints) |
| **Custom CSS** | **style.css** | Project-specific design tokens: color palette, glassmorphism cards, animations, component classes |
| **Icons** | **Lucide (CDN)** | SVG icon library used for UI icons (flask, send, menu, trash, etc.) |
| **Typography** | **Google Fonts** | `Inter` and `Space Grotesk` font families for a modern, readable UI |
| **Dialogs** | **SweetAlert2 (CDN)** | Beautiful, accessible confirmation dialogs and toast notifications for the reset chat flow |

### Why Tailwind CSS + Custom CSS?

Tailwind handles **structural layout** (responsive breakpoints, flex/grid, spacing). Custom `style.css` handles **visual theming** (glassmorphism effects, gradient backgrounds, custom component classes like `.bubble`, `.sidebar`, `.chip`). This split keeps layout logic and design tokens cleanly separated.

---

## File Structure

```
selfcare-ai/
├── server.js           ← Express backend + Gemini API integration
├── package.json        ← Dependencies and npm scripts
├── .env                ← Secret API key (gitignored)
├── .env.example        ← Template for the .env file (safe to commit)
├── .gitignore
└── public/             ← Static frontend files (served by Express)
    ├── index.html      ← App shell, Tailwind layout, SweetAlert2/Lucide CDN includes
    ├── app.js          ← All frontend logic: state, API calls, UI, sidebar
    └── style.css       ← Design system: colors, glassmorphism, component styles
```
