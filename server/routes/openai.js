// // routes/openai.js
// import express from 'express';
// import fetch from 'node-fetch';

// const router = express.Router();

// async function fetchCoinContext(coinId) {
//   try {
//     const res = await fetch(`http://localhost:3000/api/coin-info/${coinId}`);
//     if (!res.ok) return null;
//     return await res.json();
//   } catch (err) {
//     console.error("❌ Error fetching coin context:", err);
//     return null;
//   }
// }

// router.post('/', async (req, res) => {
//   const { userMessage, coinId } = req.body;

//   // 1. Fetch coin sentiment context
//   const coinContext = await fetchCoinContext(coinId);

//   // Build context for OpenAI
//   let systemPrompt = "You are a helpful assistant that answers questions about cryptocurrency coins.";
//   if (coinContext) {
//     systemPrompt += `\n\nCoin Info:\n- Name: ${coinContext.name}\n- Sentiment: ${coinContext.sentiment} (score ${coinContext.avgScore})\n- Tweet count: ${coinContext.tweetCount}\n`;
//     if (coinContext.celeb) systemPrompt += `- Celebrity Mention: ${coinContext.celeb}\n`;
//   } else {
//     systemPrompt += "\nNo Twitter data available for this coin.";
//   }

//   // MOCK MODE
//   if (!process.env.OPENAI_API_KEY) {
//     await new Promise(r => setTimeout(r, 500));
//     return res.status(200).json({
//       mock: true,
//       userMessage,
//       context: systemPrompt,
//       result: `This is a mock AI response to your question about "${coinId}".`
//     });
//   }

//   // REAL OPENAI MODE
//   try {
//     const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
//       method: 'POST',
//       headers: {
//         Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify({
//         model: 'gpt-3.5-turbo',
//         messages: [
//           { role: 'system', content: systemPrompt },
//           { role: 'user', content: userMessage }
//         ]
//       })
//     });

//     const data = await openaiRes.json();
//     if (!openaiRes.ok) {
//       console.error(data);
//       return res.status(500).json({ error: data });
//     }

//     return res.status(200).json({
//       mock: false,
//       userMessage,
//       context: systemPrompt,
//       result: data.choices[0].message.content
//     });
//   } catch (err) {
//     console.error('Fetch error:', err);
//     res.status(500).json({ error: 'Something went wrong' });
//   }
// });

// export default router;

// MOCK ONLY
// import express from 'express';
// import fetch from 'node-fetch';

// const router = express.Router();

// // Mock fetchCoinContext to return dummy Twitter data
// async function fetchCoinContext(coinId) {
//   return {
//     name: coinId,
//     sentiment: "NEUTRAL",
//     avgScore: "0.00",
//     tweetCount: 0,
//     celeb: null,
//     tweets: []
//   };
// }

// router.post('/', async (req, res) => {
//   const { userMessage, coinId } = req.body;

//   // Build mock context
//   const coinContext = await fetchCoinContext(coinId);
//   let systemPrompt = "You are a helpful assistant that answers questions about cryptocurrency coins.";
//   systemPrompt += `\n\nCoin Info:\n- Name: ${coinContext.name}\n- Sentiment: ${coinContext.sentiment} (score ${coinContext.avgScore})\n- Tweet count: ${coinContext.tweetCount}\n`;
//   if (coinContext.celeb) {
//     systemPrompt += `- Celebrity Mention: ${coinContext.celeb}\n`;
//   }

//   // Simulate API delay
//   await new Promise(r => setTimeout(r, 500));

//   // Return structured mock response
//   return res.status(200).json({
//     mock: true,
//     userMessage,
//     context: systemPrompt,
//     result: `This is a mock AI response to your question about "${coinId}".`
//   });
// });

// export default router;

//WORKING
import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// Helper: Fetch coin info
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

  // Build context string
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

  // MOCK MODE
  if (!process.env.OPENAI_API_KEY) {
    return res.status(200).json({
      result: `This is a mock answer.\nThis is the question: "${userMessage}"\nThis is the context fed to the model:\n${context}`
    });
  }

  // REAL MODE
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
    console.error('Fetch error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

export default router;