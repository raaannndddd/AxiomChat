# ChartChat: the Ultimate Crypto Chrome Extension

## Project Information
Name: Rand Halasa
Project Name
Project Description: A Chrome extension for crypto traders to chat while watching crypto charts, learn about meme coins, and get quick AI-assisted insights without leaving the page.
Track specification: FinTech


> **Privacy-first:** Rooms are anonymous to reduce doxxing risks and money-fueled harassment.
> **Not financial advice.** Use at your own risk.

---

## Why It Exists

- **Stay in context:** discuss a coin on the same page where you’re charting it.  
- **Reduce noise:** sentiment analysis surfaces constructive, high-signal messages.  
- **Learn faster:** an AI agent summarizes key coin facts and answers common questions (e.g., *“Bullish or not?”*, *“Rug risk?”*).  
- **Revisit opportunities:** monitoring & triggers (e.g., CTO-style conditions) help you return to coins when conditions improve.

---

## Key Features

- **In-chart chat:** floating panel overlay next to your chart.
- **Room-based discussions:** each coin/pair gets its own chat room.
- **Anonymity by default:** unique handles, no public PII.
- **AI coin insights (Ollama):** quick answers like “Is this looking bullish?”, “What’s the rug risk?”, and “Summarize token state.”
- **Sentiment moderation:** ban toxic content.
- **Watch & return:** set triggers (e.g., CTO-style) to revisit promising coins.
- **Admin tools (planned):** rate limits and chat content monitoring.

---

## How It Works (At a Glance)

1. **Context builder** pulls live coin data (price, liquidity, volume, market cap, sentiment).  
2. **AI agent** (local via Ollama) answers questions using that context—no cloud key required.  
3. **Socket-powered chat** keeps rooms real-time and lightweight.  
4. **Sentiment guardrails** score messages and flag hate/toxicity.

---

## Technical Stack

- **Frontend:** Next.js (Chrome Extension UI)
- **Realtime:** Socket.io
- **AI Runtime:** Ollama (local LLM inference)
- **Auth:** Google Sign-In
- **Market Data:** Dexscreener & CoinGecko APIs


---

## Example AI Prompting

The AI agent receives a structured context like:

```
Coin Info:
- Name: <name> | Symbol: <symbol>
- Sentiment: <label> (avg score <value>)
- Tweets (24h): <count> | Price: <price>
- Liquidity: <liquidity> | MC: <marketCap> | Vol (24h): <volume)
- DEX: <dex> | Rug Risk: <risk-level>
- Last Updated: <timestamp>
```

and answers trader questions directly in the chat.

---

## Setup (High Level)

Pull and start Llama2 Model:
```
ollama pull llama2
ollama serve
```

Install dependencies:
```
npm install
```

Add a .env file in root directory containing google client ID (do not change anything):
```
GOOGLE_CLIENT_ID=336952229035-95pcrf54sn563jbhpqjq3as1c04l1ekm.apps.googleusercontent.com
```

Go to google chrome extensions, turn on developer mode, press on load unpacked, and choose this project

---
