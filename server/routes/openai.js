// //WORKING
// import express from 'express';
// import fetch from 'node-fetch';

// const router = express.Router();

// // Helper: Fetch coin info
// async function fetchCoinInfo(coinId) {
//   try {
//     const res = await fetch(`http://localhost:3000/api/coin-info/${encodeURIComponent(coinId)}`);
//     if (!res.ok) throw new Error("Failed to fetch coin info");
//     return await res.json();
//   } catch (err) {
//     console.error("❌ Error fetching coin info:", err);
//     return null;
//   }
// }

// router.post('/', async (req, res) => {
//   const { userMessage, coinId } = req.body;

//   if (!userMessage) {
//     return res.status(400).json({ error: 'Missing userMessage' });
//   }

//   // Fetch coin context
//   const coinInfo = coinId ? await fetchCoinInfo(coinId) : null;

//   // Build context string
//   const context = coinInfo
//     ? `
// Coin Info:
// - Name: ${coinInfo.name}
// - Symbol: ${coinInfo.symbol}
// - Sentiment: ${coinInfo.sentiment} (score ${coinInfo.avgTwitterScore})
// - Tweet count: ${coinInfo.tweetCount}
// - Celebrity mention: ${coinInfo.celebMention || "None"}
// - Price: ${coinInfo.price}
// - Liquidity: ${coinInfo.liquidity}
// - Market Cap: ${coinInfo.marketCap}
// - Volume (24h): ${coinInfo.volume24h}
// - DEX: ${coinInfo.dex}
// - Rug Risk: ${coinInfo.rugRisk}
// - Last Updated: ${coinInfo.updated}
//     `
//     : `No coin data available.`;

//   // MOCK MODE
//   if (!process.env.OPENAI_API_KEY) {
//     return res.status(200).json({
//       result: `This is a mock answer.\nThis is the question: "${userMessage}"\nThis is the context fed to the model:\n${context}`
//     });
//   }

//   // REAL MODE
//   try {
//     const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
//       method: 'POST',
//       headers: {
//         Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify({
//         model: 'gpt-4o-mini',
//         messages: [
//           { role: 'system', content: 'You are a helpful assistant that answers questions about cryptocurrency coins using the provided context.' },
//           { role: 'system', content: context },
//           { role: 'user', content: userMessage }
//         ]
//       })
//     });

//     const data = await openaiRes.json();

//     if (!openaiRes.ok) {
//       console.error(data);
//       return res.status(500).json({ error: data });
//     }

//     return res.status(200).json({ result: data.choices[0].message.content });
//   } catch (err) {
//     console.error('Fetch error:', err);
//     res.status(500).json({ error: 'Something went wrong' });
//   }
// });

// export default router;

// routes/chat.js
import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

async function fetchCoinInfo(coinId) {
  try {
    const res = await fetch(`http://localhost:3000/api/coin-info/${encodeURIComponent(coinId)}`);
    if (!res.ok) throw new Error("Failed to fetch coin info");
    return await res.json();
  } catch (err) {
    console.error("❌ Error fetching coin info:", err);
    return null;
  }
}

router.post('/', async (req, res) => {
  const { userMessage, coinId } = req.body;

  if (!userMessage) {
    return res.status(400).json({ error: 'Missing userMessage' });
  }

  // Fetch coin context
  const coinInfo = coinId ? await fetchCoinInfo(coinId) : null;

  const context = coinInfo
    ? `
Coin Info:
- Name: ${coinInfo.name}
- Symbol: ${coinInfo.symbol}
- Sentiment: ${coinInfo.sentiment} (score ${coinInfo.avgTwitterScore})
- Tweet count: ${coinInfo.tweetCount}
- Celebrity mention: ${coinInfo.celebMention || "None"}
- Price: ${coinInfo.price}
- Liquidity: ${coinInfo.liquidity}
- Market Cap: ${coinInfo.marketCap}
- Volume (24h): ${coinInfo.volume24h}
- DEX: ${coinInfo.dex}
- Rug Risk: ${coinInfo.rugRisk}
- Last Updated: ${coinInfo.updated}
    `
    : `No coin data available.`;

  // --- MOCK MODE (explicit) ---
  if (process.env.MOCK === '1') {
    return res.status(200).json({
      result: `This is a mock answer.\nThis is the question: "${userMessage}"\nThis is the context fed to the model:\n${context}`
    });
  }

  // --- OLLAMA MODE (default if OLLAMA_HOST set or no OpenAI key) ---
  const useOllama = !!process.env.OLLAMA_HOST || !process.env.OPENAI_API_KEY;
  if (useOllama) {
    try {
      const host = process.env.OLLAMA_HOST || 'http://localhost:11434';
      const model = process.env.OLLAMA_MODEL || 'llama3.1';

      const ollamaRes = await fetch(`${host}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            {
              role: 'system',
              content:
                'You are a helpful assistant that answers questions about cryptocurrency coins using the provided context. Be concise and cite the context where relevant.'
            },
            { role: 'system', content: context },
            { role: 'user', content: userMessage }
          ],
          // Optional tuning:
          // options: { temperature: 0.2, num_predict: 512 }
        })
      });

      const data = await ollamaRes.json();
      if (!ollamaRes.ok) {
        console.error('Ollama error payload:', data);
        return res.status(500).json({ error: data });
      }
      // /api/chat returns { message: { role, content }, ... }
      const answer = data?.message?.content ?? '';
      return res.status(200).json({ result: answer });
    } catch (err) {
      console.error('Ollama fetch error:', err);
      return res.status(500).json({ error: 'Ollama request failed' });
    }
  }

  // --- OPENAI MODE (fallback) ---
  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that answers questions about cryptocurrency coins using the provided context.' },
          { role: 'system', content: context },
          { role: 'user', content: userMessage }
        ]
      })
    });

    const data = await openaiRes.json();
    if (!openaiRes.ok) {
      console.error(data);
      return res.status(500).json({ error: data });
    }
    return res.status(200).json({ result: data.choices[0].message.content });
  } catch (err) {
    console.error('OpenAI fetch error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

export default router;