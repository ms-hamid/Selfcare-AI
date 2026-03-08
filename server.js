//  SelfCare AI - Backend Server
//  Stack: Node.js + Express + Google Gemini 2.5 Flash

// STEP 1: Load environment variables FIRST before any other imports
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

//  App Initialization

const app = express();
const PORT = process.env.PORT || 3000;

//  Middleware

app.use(cors()); // Allow cross-origin requests from the frontend
app.use(express.json()); // Parse incoming JSON request bodies
app.use(express.static(path.join(__dirname, "public"))); // Serve frontend files

//  Gemini AI Client Setup

if (!process.env.GEMINI_API_KEY) {
  console.error(
    "FATAL ERROR: GEMINI_API_KEY is not defined in your .env file.",
  );
  process.exit(1); // Exit immediately if the key is missing
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
    // ----------------------------------------------------------
    const formattedHistory = Array.isArray(history)
      ? history.map((msg) => ({
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
        temperature: 0.4, // Low = factual, science-accurate
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

    // Return the AI's text response to the frontend
    res.json({ response: responseText });
  } catch (error) {
    console.error("[SelfCare AI] Gemini API Error:", error.message || error);

    // Return a structured error so the frontend can handle it gracefully
    res.status(500).json({
      error: "An error occurred while communicating with the AI.",
      details: error.message || "Unknown error",
    });
  }
});

//  Catch-all: Serve index.html for the root route

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

//  Start the Server

app.listen(PORT, () => {
  console.log(`\n✅ SelfCare AI server is running at http://localhost:${PORT}`);
  console.log(`   Press Ctrl+C to stop.\n`);
});
