# 02 — Backend & AI Integration

This document walks through the entire `server.js` file — from secure environment loading to the Gemini API call and error handling.

---

## 1. Environment Setup (dotenv)

```js
// server.js — Line 5
require("dotenv").config();
```

`dotenv` must be called **before any other `require`** that might depend on `process.env`. This single line reads the `.env` file and populates `process.env` with all declared variables.

The application then immediately validates the key:

```js
// server.js — Lines 25–30
if (!process.env.GEMINI_API_KEY) {
  console.error(
    "FATAL ERROR: GEMINI_API_KEY is not defined in your .env file.",
  );
  process.exit(1); // Exit immediately if the key is missing
}
```

This **fail-fast** pattern prevents the server from running in a broken state. If the key is missing, the process exits with a non-zero code before any request can be handled.

---

## 2. Middleware Stack

```js
// server.js — Lines 19–21
app.use(cors());                                          // Cross-origin requests from frontend
app.use(express.json());                                  // Parse JSON request bodies
app.use(express.static(path.join(__dirname, "public"))); // Serve index.html, app.js, style.css
```

| Middleware | Purpose |
|---|---|
| `cors()` | Allows the browser to POST to the same origin without CORS errors |
| `express.json()` | Parses the `Content-Type: application/json` body from the frontend fetch call |
| `express.static()` | Serves the entire `public/` folder as static assets — no separate web server needed |

---

## 3. Gemini AI Client Initialization

```js
// server.js — Line 32
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
```

The `GoogleGenAI` instance is created **once** at module load time and reused for every request. This is more efficient than instantiating a new client per request.

---

## 4. The System Instruction

The System Instruction acts as the AI's permanent persona and ruleset. It is injected **once per chat session**, not per message.

```js
// server.js — Lines 37–51
const SYSTEM_INSTRUCTION = `Anda adalah SelfCare AI, seorang ahli biokimia kulit dan spesialis nutrisi olahraga. ...

ATURAN MUTLAK:

DILARANG KERAS menyebutkan atau merekomendasikan merek produk komersial apa pun.

Jika membahas kulit, gunakan nama molekul/senyawa (contoh: Niacinamide, AHA/BHA, L-Ascorbic Acid, Retinoid) ...

Jika membahas kebugaran, bahas dari sisi metabolisme, asam amino ...

Gunakan bahasa Indonesia yang santai, edukatif, dan mudah dipahami, tetapi tetap menjaga akurasi medis/ilmiah.

Peringatkan pengguna mengenai interaksi bahan kimia yang berbahaya ...

Sesuaikan bahasa balasan dengan bahasa dominan yang digunakan pengguna.`;
```

**What it enforces:**
- ✅ Identity: biochemist + sports nutritionist persona
- 🚫 Hard rule: No commercial brand mentions whatsoever
- 🔬 Methodology: Use molecular/compound names (e.g., `Niacinamide`, `L-Ascorbic Acid`, `Leucine`)
- ⚠️ Safety: Warn about dangerous ingredient interactions (e.g., Retinol + AHA/BHA at the same time)
- 🌐 Language adaptation: Mirrors the user's language (responds in English if asked in English)

---

## 5. The `POST /api/chat` Endpoint

This is the single endpoint that handles all AI communication.

### 5a. Request Validation

```js
// server.js — Lines 58–65
const { prompt, history } = req.body;

if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
  return res.status(400).json({ error: "A valid 'prompt' string is required." });
}
```

The endpoint validates that `prompt` exists, is a string, and is not blank. Missing or invalid prompts receive a `400 Bad Request` immediately.

### 5b. History Formatting

```js
// server.js — Lines 73–78
const formattedHistory = Array.isArray(history)
  ? history.map((msg) => ({
      role: msg.role,           // "user" or "model"
      parts: [{ text: msg.text }],
    }))
  : [];
```

The **frontend sends** history as `[{ role: "user"|"model", text: "..." }]` (flat, simple format).

The **Gemini SDK expects** history as `[{ role: "...", parts: [{ text: "..." }] }]` (with a `parts` array).

This `map()` call translates between the two formats without any library.

### 5c. Chat Session Creation & Generation Config

```js
// server.js — Lines 85–94
const chat = genAI.chats.create({
  model: "gemini-2.5-flash",
  config: {
    systemInstruction: SYSTEM_INSTRUCTION,
    temperature: 0.4,  // Low = deterministic and factual
    topP: 0.8,
    topK: 40,
  },
  history: formattedHistory,
});
```

A **new chat session is created per request**, pre-loaded with the full conversation history. This is stateless by design — the server holds no session data between requests.

### Why These Generation Parameters?

| Parameter | Value | Reasoning |
|---|---|---|
| `temperature` | `0.4` | Low temperature produces more focused, factual, and less "creative" outputs. Ideal for medical/scientific accuracy. `0.0` = fully deterministic; `1.0` = very creative |
| `topP` | `0.8` | The model considers tokens that together make up 80% of the probability mass. Filters out unlikely (potentially wrong) completions |
| `topK` | `40` | At each step, only the top 40 most likely tokens are sampled from. Combined with `topP`, this tightly controls the output distribution |

Together, `temperature: 0.4` + `topP: 0.8` + `topK: 40` produce **reliable, science-grade responses** while still allowing some natural language variation — crucial for a chatbot giving skincare chemistry and nutrition advice.

### 5d. Sending the Message & Returning the Response

```js
// server.js — Lines 99–103
const result = await chat.sendMessage({ message: prompt.trim() });
const responseText = result.text;

res.json({ response: responseText });
```

The trimmed user prompt is sent as the final message. The `.text` property of the result contains the plain text response. This is returned to the frontend as `{ response: "..." }`.

### 5e. Error Handling

```js
// server.js — Lines 104–112
} catch (error) {
  console.error("[SelfCare AI] Gemini API Error:", error.message || error);

  res.status(500).json({
    error: "An error occurred while communicating with the AI.",
    details: error.message || "Unknown error",
  });
}
```

Structured JSON error responses allow the frontend to display user-friendly error messages (e.g., quota exceeded, invalid API key) rather than a blank screen.

---

## 6. Catch-All Route

```js
// server.js — Lines 117–119
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
```

Any GET request that doesn't match a defined route (there are none other than `/api/chat`) serves `index.html`. This enables browser-side navigation to work even if the user refreshes the page at any path.
