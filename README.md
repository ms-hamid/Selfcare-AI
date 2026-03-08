# SelfCare AI

An AI-powered chatbot built on Google Gemini 2.5 Flash that provides science-based guidance on skincare chemistry and fitness nutrition. All advice is grounded in biochemistry and physiology - no commercial brand recommendations.

---

## Features

- **Brand-agnostic advice** - responses reference active compounds and molecules (e.g., Niacinamide, L-Ascorbic Acid, Leucine), never commercial product names
- **Chemical interaction warnings** - flags unsafe ingredient combinations (e.g., Retinol + AHA/BHA simultaneously)
- **Conversation context** - maintains multi-turn chat history within a session using in-memory state
- **Ephemeral by design** - no data is written to localStorage, a database, or any external storage; history is cleared on page refresh
- **Responsive UI** - off-canvas sidebar drawer on mobile, collapsible static panel on desktop
- **Confirmed session reset** - SweetAlert2 dialog prevents accidental history deletion

---

## Tech Stack

**Backend**

- [Node.js](https://nodejs.org/) - runtime
- [Express.js](https://expressjs.com/) - HTTP server and API routing
- [@google/genai](https://www.npmjs.com/package/@google/genai) - Google Gemini API SDK
- [dotenv](https://www.npmjs.com/package/dotenv) - environment variable management

**Frontend**

- Vanilla JavaScript - state management and DOM manipulation
- [Tailwind CSS](https://tailwindcss.com/) (CDN) - responsive layout
- [SweetAlert2](https://sweetalert2.github.io/) (CDN) - confirmation dialogs and toast notifications
- [Lucide](https://lucide.dev/) (CDN) - SVG icon set

---

## Prerequisites

- **Node.js** v18 or later - [nodejs.org](https://nodejs.org/)
- **Google Gemini API Key** - obtain one at [aistudio.google.com](https://aistudio.google.com/app/apikey)

---

## Getting Started

**1. Clone the repository**

```bash
git clone <repository-url>
cd selfcare-ai
```

**2. Install dependencies**

```bash
npm install
```

**3. Configure environment variables**

```bash
# Copy the example file
cp .env.example .env
```

Open `.env` and set your API key:

```env
GEMINI_API_KEY=your_api_key_here
```

**4. Start the server**

```bash
npm start
```

The application will be available at `http://localhost:3000`.

For development with auto-restart on file changes:

```bash
npm run dev
```

---

## Documentation

In-depth technical documentation is available in the [`docs/`](./docs) directory:

| File                                                                | Description                                                   |
| ------------------------------------------------------------------- | ------------------------------------------------------------- |
| [`01-architecture-overview.md`](./docs/01-architecture-overview.md) | System architecture, data flow, and tech stack roles          |
| [`02-backend-and-ai.md`](./docs/02-backend-and-ai.md)               | `server.js` walkthrough, Gemini configuration, and API design |
| [`03-frontend-state-and-ui.md`](./docs/03-frontend-state-and-ui.md) | State management, sidebar logic, and SweetAlert2 integration  |
| [`04-local-development.md`](./docs/04-local-development.md)         | Full setup guide and troubleshooting reference                |

---

## Disclaimer

The information provided by SelfCare AI is intended for general educational purposes only. It is based on publicly available scientific literature and does not constitute professional medical, dermatological, or nutritional advice. Always consult a qualified healthcare professional before making decisions about skincare treatments or dietary changes. The authors assume no liability for outcomes resulting from the use of this application.

---

## License

ISC
