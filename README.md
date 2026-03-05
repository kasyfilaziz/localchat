# LocalChat - Local-First AI Chatbot

> A Progressive Web App (PWA) AI chatbot that runs entirely in your browser. All AI operations use cloud providers, but your API keys and chat history are stored locally. MCP servers can run in the browser using WebAssembly.

## ✨ Features

- **Local API Key Storage** - API keys are encrypted using Web Crypto API (AES-GCM) and stored in IndexedDB
- **Local Chat History** - All conversations are stored locally in your browser using IndexedDB
- **OpenAI-Compatible API** - Works with any OpenAI-compatible API (OpenAI, Ollama, LiteLLM, Anthropic via proxy, etc.)
- **MCP Server in Browser** - Run Model Context Protocol tools directly in your browser using JavaScript or Python (via Pyodide/WASM)
- **PWA-Ready** - Installable as a native app, works offline for cached assets
- **Privacy-First** - Your data never leaves your browser (except for API calls to your chosen provider)

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      BROWSER (PWA)                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                     SvelteKit (Static)                      │ │
│  │                    (Build → HTML + JS)                      │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│  ┌──────────────┐  ┌─────────┴────────┐  ┌──────────────────────┐ │
│  │ Settings     │  │  Chat Manager   │  │  MCP Engine          │ │
│  │ - API Key   │  │  - Messages    │  │  - JS Tools         │ │
│  │ - Endpoint  │  │  - Sessions     │  │  - Pyodide (Python) │ │
│  └──────┬───────┘  └────────┬────────┘  └──────────┬──────────┘ │
│         │                   │                      │             │
│         ▼                   ▼                      ▼             │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              IndexedDB (via Dexie.js)                      │ │
│  │  • encrypted_api_key (AES-GCM via Web Crypto API)          │ │
│  │  • chat_sessions                                            │ │
│  │  • mcp_config                                               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                    │
└──────────────────────────────┼────────────────────────────────────┘
                               │
                               ▼
              ┌────────────────────────────────┐
              │     OpenAI-Compatible API      │
              │  (OpenAI, Ollama, LiteLLM,    │
              │   Anthropic via proxy, dll)    │
              └────────────────────────────────┘
```

## 🛠️ Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | **SvelteKit** (static adapter) | 2.x |
| Language | **TypeScript** | 5.x |
| Build Tool | **Vite** | 7.x |
| Styling | **TailwindCSS** | 4.x |
| Storage | **Dexie.js** (IndexedDB) | 4.3.x |
| PWA | **vite-plugin-pwa** | 1.2.x |
| Encryption | **Web Crypto API** | Native |

## 📂 Project Structure

```
localchat/
├── src/
│   ├── lib/
│   │   ├── services/
│   │   │   ├── db.ts           # IndexedDB schema (Dexie.js)
│   │   │   ├── crypto.ts       # AES-GCM encryption (Web Crypto API)
│   │   │   ├── settings.ts     # API key/endpoint management
│   │   │   └── index.ts        # Service exports
│   │   └── assets/
│   │       └── favicon.svg
│   ├── routes/
│   │   ├── +layout.js          # SPA config (prerender, ssr=false)
│   │   ├── +layout.svelte      # Root layout
│   │   └── +page.svelte        # Home page
│   ├── app.css                 # TailwindCSS imports
│   └── app.html                # HTML template
├── static/
│   └── icons/                  # PWA icons
├── package.json
├── svelte.config.js
├── vite.config.ts
└── tailwind.config.js
```

## 🚀 Implementation Status

### Phase 1: Setup & Core Infrastructure ✅ COMPLETED

- [x] SvelteKit project initialization with TypeScript
- [x] Static adapter configuration (adapter-static)
- [x] TailwindCSS v4 setup with Vite plugin
- [x] PWA configuration with enhanced manifest
- [x] IndexedDB schema (Dexie.js)
- [x] Web Crypto API encryption (AES-256-GCM + PBKDF2)
- [x] API key/endpoint storage services
- [x] PWA icons generation

### Phase 2: Chat Core ✅ COMPLETED

- [x] Settings modal (API key & endpoint configuration)
- [x] Chat UI (sidebar, message list, input)
- [x] Vercel AI SDK integration
- [x] Chat history management
- [x] System prompts (multiple, CRUD)
- [x] Model selection dropdown (fetch from API)
- [x] Streaming response support

### Phase 3: MCP Integration 📋 PENDING

- [ ] MCP client implementation
- [ ] JavaScript-based tools (calculator, etc.)
- [ ] Pyodide integration for Python tools
- [ ] MCP tool calling flow

### Phase 4: Polish & Deploy 📋 PENDING

- [ ] Theme support (light/dark)
- [ ] Export/import chat
- [ ] GitHub Pages deployment

## 🔐 Security

- **API Key Encryption**: AES-256-GCM with PBKDF2 key derivation (100,000 iterations)
- **Local Storage**: All data stored in browser's IndexedDB (not localStorage)
- **No External Servers**: API keys never leave your browser (except for AI API calls)

### Security Notes

While API keys are encrypted, please note:
- This is not 100% bulletproof against sophisticated attackers
- Browser extensions with broad permissions can potentially access data
- For maximum security, avoid using on public/shared computers

## 🧪 Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run check
```

## 📄 License

MIT

## 🙏 Acknowledgments

- [SvelteKit](https://kit.svelte.dev/) - The full-stack framework for Svelte
- [Dexie.js](https://dexie.org/) - IndexedDB made easy
- [TailwindCSS](https://tailwindcss.com/) - A utility-first CSS framework
- [vite-plugin-pwa](https://vite-pwa.netlify.app/) - Zero-config PWA for Vite
- [Pyodide](https://pyodide.org/) - Python in the browser
- [MCP](https://modelcontextprotocol.io/) - Model Context Protocol
