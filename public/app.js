//  SelfCare AI Frontend Logic (app.js)
//
//  STATE: In-memory ONLY. No localStorage, no sessionStorage,
//  no IndexedDB. History disappears on page refresh by design.

"use strict";

// ── API Configuration ──────────────────────────────────────
const API_URL = "/api/chat"; // relative — works locally AND in production

// ── In-Memory Chat History ─────────────────────────────────
// CRITICAL: This is the ONLY place history is stored.
// Format: [{ role: "user"|"model", text: "..." }, ...]
let chatHistory = [];

// ── DOM References ─────────────────────────────────────────
const messagesWindow = document.getElementById("messages-window");
const welcomeScreen = document.getElementById("welcome-screen");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const sendBtnIcon = document.getElementById("send-btn-icon");
const sendBtnSpinner = document.getElementById("send-btn-spinner");
const clearChatBtn = document.getElementById("clear-chat-btn");
const mobileResetBtn = document.getElementById("mobile-reset-btn");
const sidebarToggle = document.getElementById("sidebar-toggle");
const sidebar = document.getElementById("sidebar");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");
const sidebarCloseBtn = document.getElementById("sidebar-close-btn");

// ── State Flags ────────────────────────────────────────────
let isWaiting = false; // Prevents double-submit while AI is responding

// ── Topic Prompt Map ───────────────────────────────────────
const TOPIC_PROMPTS = {
  "topic-skincare":
    "Buatkan rutinitas skincare pagi dan malam yang berbasis sains untuk kulit normal berminyak. Sebutkan senyawa aktif yang tepat untuk setiap langkah.",
  "topic-acne":
    "Jelaskan mekanisme terbentuknya jerawat (acne vulgaris) dan bahan kimia apa yang paling efektif untuk mengatasinya berdasarkan bukti ilmiah.",
  "topic-protein":
    "Berapa kebutuhan protein harian optimal untuk hipertrofi otot? Jelaskan peran asam amino esensial, terutama Leucine, dalam sintesis protein otot.",
  "topic-fat":
    "Jelaskan proses lipolisis dan bagaimana makronutrien (defisit kalori, lemak, karbohidrat) mempengaruhi fat loss. Apakah ada senyawa yang terbukti meningkatkan metabolisme?",
  "topic-antiaging":
    "Jelaskan bagaimana Retinoid (Retinol, Tretinoin, Retinal) bekerja pada tingkat seluler untuk anti-aging. Apa saja kontraindikasi dan interaksi bahan yang harus dihindari?",
};

//  Lightweight Markdown → HTML Converter
//  Handles: bold, italic, inline code, bullet lists, paragraphs

function markdownToHtml(text) {
  if (!text) return "";

  let html = text
    // Escape HTML entities first for security
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

    // Bold: **text**
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")

    // Italic: *text* (single star, not double)
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")

    // Inline code: `code`
    .replace(/`([^`]+)`/g, "<code>$1</code>")

    // Horizontal rules
    .replace(/^---+$/gm, "<hr/>")

    // Headers: ## and ###
    .replace(/^### (.+)$/gm, "<strong>$1</strong>")
    .replace(/^## (.+)$/gm, "<strong>$1</strong>")
    .replace(/^# (.+)$/gm, "<strong>$1</strong>");

  // Convert bullet lists (lines starting with - or *)
  const lines = html.split("\n");
  let result = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isBullet = /^[-*]\s+/.test(line);

    if (isBullet) {
      if (!inList) {
        result.push("<ul>");
        inList = true;
      }
      result.push(`<li>${line.replace(/^[-*]\s+/, "")}</li>`);
    } else {
      if (inList) {
        result.push("</ul>");
        inList = false;
      }
      result.push(line);
    }
  }
  if (inList) result.push("</ul>");

  // Wrap non-empty, non-tag lines in <p>
  const paragraphed = result
    .join("\n")
    .split(/\n{2,}/)
    .map((block) => {
      block = block.trim();
      if (!block) return "";
      if (/^<(ul|ol|li|strong|hr)/.test(block)) return block;
      return `<p>${block.replace(/\n/g, " ")}</p>`;
    })
    .join("");

  return paragraphed;
}

//  Timestamp Helper

function getTimestamp() {
  return new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

//  UI Helper: Append a Message Bubble to the Window

function appendMessage(role, text) {
  // Hide welcome screen on first message — use the cached top-level ref
  if (welcomeScreen) welcomeScreen.style.display = "none";

  const isUser = role === "user";
  const row = document.createElement("div");
  row.classList.add("message-row", isUser ? "user" : "ai");

  const avatar = document.createElement("div");
  avatar.classList.add("avatar", isUser ? "user-avatar" : "ai-avatar");
  avatar.innerHTML = isUser
    ? "<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'/><circle cx='12' cy='7' r='4'/></svg>"
    : "<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18'/></svg>";

  const bubble = document.createElement("div");
  bubble.classList.add("bubble");
  bubble.innerHTML = isUser
    ? `<p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`
    : markdownToHtml(text);

  const time = document.createElement("div");
  time.classList.add("msg-time");
  time.textContent = getTimestamp();

  const content = document.createElement("div");
  content.style.display = "flex";
  content.style.flexDirection = "column";
  content.appendChild(bubble);
  content.appendChild(time);

  row.appendChild(avatar);
  row.appendChild(content);
  messagesWindow.appendChild(row);
  scrollToBottom();

  return row;
}

//  UI Helper: Typing Indicator (three bouncing dots)

function showTypingIndicator() {
  const row = document.createElement("div");
  row.classList.add("message-row", "ai", "typing-row");
  row.id = "typing-indicator";

  const avatar = document.createElement("div");
  avatar.classList.add("avatar", "ai-avatar");
  avatar.innerHTML =
    "<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18'/></svg>";

  const bubble = document.createElement("div");
  bubble.classList.add("bubble", "typing-bubble");
  bubble.innerHTML = `
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>`;

  row.appendChild(avatar);
  row.appendChild(bubble);
  messagesWindow.appendChild(row);
  scrollToBottom();
}

function removeTypingIndicator() {
  const indicator = document.getElementById("typing-indicator");
  if (indicator) indicator.remove();
}

//  UI Helper: Scroll to bottom of the message window

function scrollToBottom() {
  messagesWindow.scrollTop = messagesWindow.scrollHeight;
}

// ── Loading State Helpers ──────────────────────────────────

/**
 * Shows or hides the loading state on the send button.
 * When loading: hide the icon, show the spinner, disable button.
 * When idle: restore icon, hide spinner, re-evaluate disabled state.
 */
function setLoadingState(loading) {
  if (loading) {
    sendBtnIcon.style.display = "none";
    sendBtnSpinner.style.display = "inline-block";
    sendBtn.disabled = true;
    sendBtn.style.opacity = "0.7";
    sendBtn.style.cursor = "not-allowed";
    userInput.disabled = true;
    userInput.placeholder = "Memproses...";
  } else {
    sendBtnIcon.style.display = "inline-block";
    sendBtnSpinner.style.display = "none";
    sendBtn.disabled = userInput.value.trim() === "";
    sendBtn.style.opacity = "";
    sendBtn.style.cursor = "";
    userInput.disabled = false;
    userInput.placeholder =
      "Tanyakan sesuatu tentang skincare atau nutrisi fitness...";
  }
}

//  Core: Send a Message to the Backend

async function sendMessage(prompt) {
  prompt = prompt.trim();
  if (!prompt || isWaiting) return;

  // ── 1. Update UI state ──
  isWaiting = true;
  setLoadingState(true);
  appendMessage("user", prompt);
  userInput.value = "";
  autoResizeTextarea();
  showTypingIndicator();

  // ── 2. Add user turn to in-memory history ──
  chatHistory.push({ role: "user", text: prompt });

  try {
    // ── 3. POST to /api/chat with current history ──
    //       NOTE: We send the history BEFORE we added the current user
    //       message, because the server creates a chat session from
    //       history[] and then sends the final `prompt` as the new message.
    //       To correctly reflect this, we send history minus the last entry.
    const historyForServer = chatHistory.slice(0, -1); // All except the just-added user message

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: prompt,
        history: historyForServer,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(
        errData.error || `Server returned HTTP ${response.status}`,
      );
    }

    const data = await response.json();
    const aiText =
      data.response || "Maaf, saya tidak mendapat respons dari AI.";

    // ── 4. Remove indicator & display response ──
    removeTypingIndicator();
    appendMessage("model", aiText);

    // ── 5. Add AI response to in-memory history ──
    chatHistory.push({ role: "model", text: aiText });
  } catch (error) {
    console.error("[SelfCare AI] Fetch error:", error);
    removeTypingIndicator();

    const errRow = appendMessage(
      "model",
      `⚠️ **Koneksi Gagal**\n\n${error.message}\n\nPastikan server berjalan di \`http://localhost:3000\` dan kunci API sudah diisi di file \`.env\`.`,
    );
    errRow.querySelector(".bubble").classList.add("error-bubble");

    // Remove the failed user message from history since the AI didn't respond
    chatHistory.pop();
  } finally {
    isWaiting = false;
    setLoadingState(false);
    userInput.focus();
  }
}

//  UI Helper: Auto-resize the textarea to fit content

function autoResizeTextarea() {
  userInput.style.height = "auto";
  const maxH = 160;
  userInput.style.height = Math.min(userInput.scrollHeight, maxH) + "px";
}

//  UI Helper: Reset entire session (after confirmation)

// Store the original welcome screen HTML once at startup so resetSession()
// can restore it without duplicating the markup in two places.
const WELCOME_HTML = welcomeScreen ? welcomeScreen.outerHTML : "";

function resetSession() {
  // Clear in-memory state
  chatHistory = [];

  // Restore welcome screen from the original markup — no duplication
  messagesWindow.innerHTML = WELCOME_HTML;

  // Re-init Lucide icons for the restored SVGs
  if (window.lucide) lucide.createIcons();
}

// ── SweetAlert2 Reset Confirmation ────────────────────────

/**
 * Shows a SweetAlert2 dialog to confirm resetting the chat.
 * Uses Indonesian language as required.
 */
async function confirmAndReset() {
  if (chatHistory.length === 0) {
    // Nothing to clear show a gentle info toast
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "info",
      title: "Tidak ada riwayat obrolan.",
      showConfirmButton: false,
      timer: 2500,
      timerProgressBar: true,
      background: "hsl(222, 20%, 11%)",
      color: "hsl(210, 20%, 92%)",
    });
    return;
  }

  const result = await Swal.fire({
    title: "Reset Percakapan?",
    text: "Semua riwayat obrolan ini akan dihapus dan tidak dapat dikembalikan.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Ya, Hapus!",
    cancelButtonText: "Batal",
    confirmButtonColor: "hsl(0, 70%, 55%)",
    cancelButtonColor: "hsl(222, 18%, 24%)",
    background: "hsl(222, 20%, 11%)",
    color: "hsl(210, 20%, 92%)",
    iconColor: "hsl(35, 90%, 55%)",
    customClass: {
      popup: "swal-popup-custom",
      confirmButton: "swal-confirm-custom",
      cancelButton: "swal-cancel-custom",
    },
    reverseButtons: true,
  });

  if (result.isConfirmed) {
    resetSession();

    // Success toast
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: "Riwayat obrolan telah dihapus.",
      showConfirmButton: false,
      timer: 2500,
      timerProgressBar: true,
      background: "hsl(222, 20%, 11%)",
      color: "hsl(210, 20%, 92%)",
    });
  }
}

//  Public: Inject a topic starter prompt (from sidebar buttons)

window.injectTopic = function (btn) {
  const topic = TOPIC_PROMPTS[btn.id];
  if (topic) {
    userInput.value = topic;
    autoResizeTextarea();
    updateSendBtn();
    userInput.focus();
  }
};

//  Public: Inject a quick-start prompt (from welcome chips)

window.injectPrompt = function (text) {
  userInput.value = text;
  autoResizeTextarea();
  updateSendBtn();
  userInput.focus();
};

//  UI Helper: Sync send button enabled state

function updateSendBtn() {
  if (!isWaiting) {
    sendBtn.disabled = userInput.value.trim() === "";
  }
}

//  Event Listeners

// Send on button click
sendBtn.addEventListener("click", () => sendMessage(userInput.value));

// Send on Enter (Shift+Enter = new line)
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage(userInput.value);
  }
});

// Auto-resize textarea & update send button
userInput.addEventListener("input", () => {
  autoResizeTextarea();
  updateSendBtn();
});

// Reset / clear session Sidebar button
clearChatBtn.addEventListener("click", confirmAndReset);

// Reset / clear session Mobile header button
if (mobileResetBtn) {
  mobileResetBtn.addEventListener("click", confirmAndReset);
}

// ── Sidebar State Helpers ──────────────────────────────────

/**
 * Returns true when the viewport is narrower than Tailwind's `md` breakpoint
 * (default: 768px). Used to branch between mobile-drawer and desktop behavior.
 */
function isMobile() {
  return window.innerWidth < 768;
}

// ══════════════════════════════════════════════════════════
//  MOBILE  off-canvas drawer
//  The hamburger button (id="sidebar-toggle", class md:hidden)
//  is the ONLY opener. The X button inside the sidebar and
//  the backdrop are the ONLY closers on mobile.
// ══════════════════════════════════════════════════════════

/** Open: slide in, show backdrop, lock background scroll. */
function openSidebar() {
  sidebar.classList.remove("-translate-x-full");
  sidebar.setAttribute("aria-hidden", "false");
  sidebarToggle.setAttribute("aria-expanded", "true");

  sidebarBackdrop.classList.remove("hidden");
  // rAF ensures opacity transition fires after display:block paints
  requestAnimationFrame(() => {
    sidebarBackdrop.classList.add("opacity-100");
  });

  document.body.style.overflow = "hidden"; // prevent background scroll
}

/** Close: slide out, hide backdrop, restore scroll. */
function closeSidebar() {
  sidebar.classList.add("-translate-x-full");
  sidebar.setAttribute("aria-hidden", "true");
  sidebarToggle.setAttribute("aria-expanded", "false");

  sidebarBackdrop.classList.remove("opacity-100");
  sidebarBackdrop.classList.add("hidden");
  document.body.style.overflow = "";
}

// ══════════════════════════════════════════════════════════
//  DESKTOP  collapsible static panel
//  The panel-left button (id="sidebar-collapse-btn",
//  class="hidden md:grid") is the ONLY toggle on desktop.
//  It works by toggling "md:hidden" on the sidebar so it
//  disappears from the flex layout without touching the
//  translate classes (which are for mobile only).
// ══════════════════════════════════════════════════════════

const sidebarCollapseBtn = document.getElementById("sidebar-collapse-btn");

function toggleDesktopSidebar() {
  // Toggle .desktop-hidden which is defined in style.css as display:none !important
  // This removes the sidebar from the flex layout flow on desktop.
  const isCollapsed = sidebar.classList.contains("desktop-hidden");
  if (isCollapsed) {
    sidebar.classList.remove("desktop-hidden");
    if (sidebarCollapseBtn)
      sidebarCollapseBtn.setAttribute("aria-expanded", "true");
  } else {
    sidebar.classList.add("desktop-hidden");
    if (sidebarCollapseBtn)
      sidebarCollapseBtn.setAttribute("aria-expanded", "false");
  }
}

// ── Wire up event listeners ────────────────────────────────

// Mobile: hamburger opens the drawer
sidebarToggle.addEventListener("click", () => {
  if (isMobile()) openSidebar();
});

// Mobile: backdrop click closes the drawer
sidebarBackdrop.addEventListener("click", closeSidebar);

// Mobile: X button inside the sidebar closes the drawer
if (sidebarCloseBtn) {
  sidebarCloseBtn.addEventListener("click", closeSidebar);
}

// Desktop: panel-left collapse button
if (sidebarCollapseBtn) {
  sidebarCollapseBtn.addEventListener("click", toggleDesktopSidebar);
}

// Both: Escape key closes/collapses
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (isMobile()) {
    if (!sidebar.classList.contains("-translate-x-full")) closeSidebar();
  } else {
    if (!sidebar.classList.contains("desktop-hidden")) toggleDesktopSidebar();
  }
});

// Auto-close mobile drawer when user taps a topic button
document.querySelectorAll(".topic-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (isMobile() && !sidebar.classList.contains("-translate-x-full")) {
      closeSidebar();
    }
  });
});

// On resize: clean up mobile state when crossing to desktop.
// Debounced to avoid running DOM operations on every pixel change.
let _resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    if (!isMobile()) {
      // Ensure backdrop and scroll-lock are cleared if user resizes to desktop
      sidebarBackdrop.classList.add("hidden");
      sidebarBackdrop.classList.remove("opacity-100");
      document.body.style.overflow = "";
      sidebar.setAttribute("aria-hidden", "false");
      sidebarToggle.setAttribute("aria-expanded", "false");
    }
  }, 100);
});

// ── Initialization: set correct initial aria state ─────────

(function initSidebarAria() {
  if (isMobile()) {
    // Sidebar starts hidden on mobile (already has -translate-x-full in HTML)
    sidebar.setAttribute("aria-hidden", "true");
    sidebarToggle.setAttribute("aria-expanded", "false");
  } else {
    // Sidebar is visible on desktop by default
    sidebar.setAttribute("aria-hidden", "false");
  }
})();

//  Initialization

(function init() {
  userInput.focus();
  updateSendBtn();
  console.log(
    "%c✅ SelfCare AI Loaded",
    "color: #2de8b0; font-weight: bold; font-size: 14px;",
  );
  console.log(
    "%cchatHistory is in-memory only (let chatHistory = []). Refresh to reset.",
    "color: #888; font-size: 12px;",
  );
})();
