# 03 — Frontend State & UI

This document covers `app.js` and `index.html` — how state is managed, how the UI is rendered, and how the sidebar and SweetAlert2 integrations work.

---

## 1. HTML Structure (`index.html`)

The layout is built using **Tailwind CSS utility classes** for structure and responsiveness, with custom class names defined in `style.css` for visual styling.

```html
<!-- The app root: full-viewport horizontal flex container -->
<div class="app-wrapper flex h-screen overflow-hidden relative z-10">

  <!-- Backdrop (mobile only): dark overlay behind open sidebar -->
  <div id="sidebar-backdrop" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 hidden md:hidden ..."></div>

  <!-- Sidebar: off-canvas on mobile, always-visible on desktop -->
  <aside id="sidebar" class="sidebar fixed inset-y-0 left-0 z-50
    -translate-x-full             <!-- starts off-screen on mobile -->
    md:static md:translate-x-0   <!-- pinned to layout on desktop -->
    ...transition-transform duration-300 ease-in-out">
  </aside>

  <!-- Main chat area: flex-1 fills all remaining space -->
  <main class="chat-container flex-1 min-w-0 flex flex-col h-full">
    ...
  </main>

</div>
```

The layout strategy relies on a single `flex h-screen` container:
- **Sidebar** is `fixed` on mobile (off-canvas) and `static` on `md+` (in-flow)
- **Main** is `flex-1` and always fills the remaining width

---

## 2. State Management — In-Memory Only

> ⚠️ **Critical Constraint**: This application uses **zero persistent storage**. There is no `localStorage`, no `sessionStorage`, no IndexedDB, no cookies, and no database.

The entire conversation history is stored in a single JavaScript variable:

```js
// app.js — Line 14
let chatHistory = [];
```

**Structure:** An array of message objects:
```js
// Each entry follows this shape:
{ role: "user" | "model", text: "string" }

// Example in-memory state after 2 turns:
chatHistory = [
  { role: "user",  text: "Apa itu Niacinamide?" },
  { role: "model", text: "Niacinamide adalah amida dari vitamin B3..." },
];
```

**What happens on page refresh?**
- The JavaScript variable is destroyed by the browser when the page is unloaded.
- On reload, `chatHistory = []` is re-declared as an empty array.
- The welcome screen is shown fresh, with no history.
- This is **by design** — documented in the sidebar footer: *"Tidak ada data yang disimpan di luar sesi ini."*

This constraint is confirmed in the browser's own developer console on startup:

```js
// app.js — Lines 599–602
console.log("%cchatHistory is in-memory only (let chatHistory = []). Refresh to reset.", "color: #888;");
```

---

## 3. The `sendMessage()` Flow

```js
// app.js — Lines 232–298
async function sendMessage(prompt) {
  // 1. Guard: abort if already waiting for a response
  if (!prompt || isWaiting) return;

  // 2. Update UI: show user bubble, typing indicator, disable input
  isWaiting = true;
  setLoadingState(true);
  appendMessage("user", prompt);
  showTypingIndicator();

  // 3. Push user message to in-memory history
  chatHistory.push({ role: "user", text: prompt });

  // 4. POST to backend — send history MINUS the last entry
  //    (The server uses history[] as context, then sends `prompt` as new message)
  const historyForServer = chatHistory.slice(0, -1);
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, history: historyForServer }),
  });

  // 5. Display AI response + push to history
  const data = await response.json();
  appendMessage("model", data.response);
  chatHistory.push({ role: "model", text: data.response });

  // 6. Restore UI
  isWaiting = false;
  setLoadingState(false);
}
```

> **Note on `historyForServer`:** The server's `chat.sendMessage()` takes the **latest user message as the new turn**, while `history[]` is everything **before** it. Therefore `chatHistory.slice(0, -1)` strips the just-pushed user entry before sending. On error, `chatHistory.pop()` removes that entry so the in-memory state stays in sync.

---

## 4. Markdown Rendering (`markdownToHtml`)

AI responses are formatted Markdown. A lightweight custom parser in `app.js` converts it to safe HTML:

```js
// app.js — Lines 50–114
function markdownToHtml(text) {
  return text
    .replace(/&/g, "&amp;")    // 1. Escape HTML entities (security)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")  // Bold
    .replace(/`([^`]+)`/g, "<code>$1</code>")           // Inline code
    // ... then processes bullet lists and paragraph wrapping
}
```

HTML entities are escaped **first** to prevent XSS. User messages bypass this parser and are always rendered as plain text (`<p>` + entity-escaped).

---

## 5. SweetAlert2 Integration

The reset flow uses SweetAlert2 for all user dialogs, providing a polished UX with no native browser dialogs.

### Flow Diagram

```
User clicks "Reset Sesi" button
          │
          ▼
  chatHistory.length === 0?
    ├─ YES → Show info toast: "Tidak ada riwayat obrolan."
    └─ NO  → Show confirmation dialog ──► User clicks "Ya, Hapus!"
                                                │
                                                ▼
                                        resetSession()
                                          · chatHistory = []
                                          · Re-render welcome screen
                                                │
                                                ▼
                                        Show success toast:
                                     "Riwayat obrolan telah dihapus."
```

### Implementation Details

```js
// app.js — Lines 346–398
async function confirmAndReset() {
  if (chatHistory.length === 0) {
    Swal.fire({ toast: true, icon: "info", title: "Tidak ada riwayat obrolan.", ... });
    return;
  }

  const result = await Swal.fire({
    title: "Reset Percakapan?",
    text: "Semua riwayat obrolan ini akan dihapus dan tidak dapat dikembalikan.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Ya, Hapus!",
    cancelButtonText: "Batal",
    confirmButtonColor: "hsl(0, 70%, 55%)",      // Red
    cancelButtonColor: "hsl(222, 18%, 24%)",     // Dark panel
    background: "hsl(222, 20%, 11%)",            // Match app dark theme
    color: "hsl(210, 20%, 92%)",                 // Light text
    reverseButtons: true,                         // Cancel on left, Confirm on right
  });

  if (result.isConfirmed) {
    resetSession();    // Clears chatHistory[] and re-renders UI
    Swal.fire({ toast: true, icon: "success", title: "Riwayat obrolan telah dihapus.", ... });
  }
}
```

The `background`, `color`, and `confirmButtonColor` values are themed to match the app's dark design system.

The `confirmAndReset` function is bound to **two buttons**: `#clear-chat-btn` (sidebar) and `#mobile-reset-btn` (header), both triggering the same flow.

---

## 6. Responsive Sidebar: Mobile vs. Desktop

The sidebar has two completely different behaviors depending on viewport width, controlled by a shared `isMobile()` helper:

```js
// app.js — Lines 463–465
function isMobile() {
  return window.innerWidth < 768; // Matches Tailwind's `md` breakpoint
}
```

### Mobile: Off-Canvas Drawer

| Action | How |
|---|---|
| **Open** | `sidebarToggle` (hamburger) clicked → `openSidebar()` removes `-translate-x-full` |
| **Close (X)** | `sidebarCloseBtn` clicked → `closeSidebar()` adds `-translate-x-full` back |
| **Close (backdrop)** | `sidebarBackdrop` clicked → `closeSidebar()` |
| **Close (Escape)** | `keydown` event → `closeSidebar()` |
| **Auto-close** | Topic button clicked → `closeSidebar()` |

```js
// app.js — Lines 475–498
function openSidebar() {
  sidebar.classList.remove("-translate-x-full");  // Slide in
  sidebarBackdrop.classList.remove("hidden");     // Show overlay
  requestAnimationFrame(() => {
    sidebarBackdrop.classList.add("opacity-100"); // Fade in (after paint)
  });
  document.body.style.overflow = "hidden";        // Lock background scroll
}

function closeSidebar() {
  sidebar.classList.add("-translate-x-full");     // Slide out
  sidebarBackdrop.classList.remove("opacity-100");
  sidebarBackdrop.classList.add("hidden");        // Hide overlay
  document.body.style.overflow = "";              // Restore scroll
}
```

> **`requestAnimationFrame` trick:** The backdrop visibility (`hidden` removal) happens in the same frame as the opacity transition. Without `rAF`, the `opacity-100` class would be applied before the browser paints the `display:block`, making the fade-in animation skip.

### Desktop: Collapsible Static Panel

On desktop (`md+`), the sidebar is always in the page flow (`md:static`). It can be optionally collapsed:

```js
// app.js — Lines 511–524
function toggleDesktopSidebar() {
  const isCollapsed = sidebar.classList.contains("desktop-hidden");
  if (isCollapsed) {
    sidebar.classList.remove("desktop-hidden"); // Show: back in flex layout
  } else {
    sidebar.classList.add("desktop-hidden");    // Hide: removed from flex layout
  }
}
```

`desktop-hidden` is defined in `style.css` as `display: none !important`, which removes the element entirely from the flex layout flow (unlike `visibility: hidden` which preserves space).

### Resize Cleanup

When a user resizes the window from mobile to desktop, a listener cleans up stale mobile state:

```js
// app.js — Lines 566–575
window.addEventListener("resize", () => {
  if (!isMobile()) {
    sidebarBackdrop.classList.add("hidden");
    document.body.style.overflow = "";
    sidebar.setAttribute("aria-hidden", "false");
  }
});
```
