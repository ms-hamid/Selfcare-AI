//  SelfCare AI - Backend Server
//  Stack: Node.js + Express + Google Gemini 2.5 Flash

// STEP 1: Load environment variables FIRST before any other imports
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

//  App Initialization

const app = express();
const PORT = process.env.PORT || 3000;

//  Security Headers (helmet)
//  Sets X-Content-Type-Options, X-Frame-Options, HSTS, etc.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Needed for lucide.createIcons() script
          "https://cdn.tailwindcss.com",
          "https://unpkg.com",
          "https://cdn.jsdelivr.net",
        ],
        scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers (onclick)
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdn.jsdelivr.net",
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "https://generativelanguage.googleapis.com"],
      },
    },
  })
);

//  CORS — only allow explicitly trusted origins
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [`http://localhost:${PORT}`];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  }),
);

//  Rate Limiting — max 20 requests per IP per minute on /api/
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,             // max requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a moment before trying again." },
});
app.use("/api/", apiLimiter);

//  Body Parser & Static Files
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

//  Gemini AI Client Setup

if (!process.env.GEMINI_API_KEY) {
  console.error(
    "FATAL ERROR: GEMINI_API_KEY is not defined in your .env file.",
  );
  process.exit(1);
}

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

//  System Instruction - The AI's Identity & Rules
//  This is injected ONCE per model initialization, not per message.

const SYSTEM_INSTRUCTION = `Anda adalah SelfCare AI, seorang ahli biokimia kulit dan spesialis nutrisi olahraga. Tugas Anda adalah menganalisis masalah kulit atau target kebugaran pengguna, lalu memberikan solusi berdasarkan sains, senyawa kimia, dan makro/mikronutrien.

ATURAN MUTLAK:

DILARANG KERAS menyebutkan atau merekomendasikan merek produk komersial apa pun.

Jika membahas kulit, gunakan nama molekul/senyawa (contoh: Niacinamide, AHA/BHA, L-Ascorbic Acid, Retinoid) dan jelaskan mekanisme kerjanya secara singkat.

Jika membahas kebugaran, bahas dari sisi metabolisme, asam amino (contoh: Leucine untuk sintesis protein), rasio makronutrien, atau fungsi biologis.

Gunakan bahasa Indonesia yang santai, edukatif, dan mudah dipahami, tetapi tetap menjaga akurasi medis/ilmiah.

Peringatkan pengguna mengenai interaksi bahan kimia yang berbahaya (contoh: jangan mencampur Retinol dengan AHA/BHA di waktu yang sama).

Sesuaikan bahasa balasan dengan bahasa dominan yang digunakan pengguna.`;

//  History limit — prevents hitting Gemini token limits on long sessions
const MAX_HISTORY_TURNS = 20; // 10 user + 10 model messages

//  POST /api/chat
//  Receives: { prompt: string, history: Array }
//  Returns:  { response: string }

app.post("/api/chat", async (req, res) => {
  const { prompt, history } = req.body;

  // Validate the incoming request
  if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
    return res
      .status(400)
      .json({ error: "A valid 'prompt' string is required." });
  }

  try {
    // ----------------------------------------------------------
    //  Format the conversation history for the Gemini SDK.
    //  The SDK expects an array of { role, parts: [{ text }] }.
    //  Frontend sends: [{ role: "user"|"model", text: "..." }]
    //  Cap to the last MAX_HISTORY_TURNS entries to avoid token
    //  limit errors on very long sessions.
    // ----------------------------------------------------------
    const formattedHistory = Array.isArray(history)
      ? history
          .slice(-MAX_HISTORY_TURNS)
          .map((msg) => ({
            role: msg.role, // "user" or "model"
            parts: [{ text: msg.text }],
          }))
      : [];

    // ----------------------------------------------------------
    //  Create a chat session with the configured model.
    //  System instruction, temperature, top_p, and top_k are
    //  set here at the session level.
    // ----------------------------------------------------------
    const chat = genAI.chats.create({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.4,
        topP: 0.8,
        topK: 40,
      },
      history: formattedHistory,
    });

    // ----------------------------------------------------------
    //  Send the user's latest message and await the response
    // ----------------------------------------------------------
    const result = await chat.sendMessage({ message: prompt.trim() });
    const responseText = result.text;

    res.json({ response: responseText });
  } catch (error) {
    // Log full error server-side for debugging
    console.error("[SelfCare AI] Gemini API Error:", error);

    // Return only a generic message — never expose SDK internals to client
    res.status(500).json({
      error: "AI service is temporarily unavailable. Please try again.",
    });
  }
});

//  Catch-all: Serve index.html for the root route

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

//  Start the Server

const server = app.listen(PORT, () => {
  console.log(`\n✅ SelfCare AI server is running at http://localhost:${PORT}`);
  console.log(`   Press Ctrl+C to stop.\n`);
});

//  Graceful Shutdown — ensures in-flight requests finish cleanly
//  before the process exits (important for Railway, Heroku, etc.)

process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("\nSIGINT received. Shutting down gracefully...");
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
});
