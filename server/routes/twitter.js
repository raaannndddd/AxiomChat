// import express from "express";
// import NodeCache from "node-cache";
// import Sentiment from "sentiment";
// import fetch from 'node-fetch';

// const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
// const sentiment = new Sentiment();
// const router = express.Router();
// const API_KEY = process.env.TWITTERAPI_IO_KEY;
// const BASE = "https://api.twitterapi.io/search/tweets";
// const BASE_URL = "https://twitter154.p.rapidapi.com/search/tweets";


// // Define celeb names for detection
// const CELEBS = ["elon musk","vitalik","cz","saylor"];

// async function getCachedOrFetchCoinData(coinId, coinAddress) {
//   const cacheKey = `coin:${coinId}`;
//   const cached = tweetCache.get(cacheKey);
//   if (cached) return cached;

//   const tweets = await fetchTweetsForCoin(coinId, coinAddress);
//   const analysis = analyzeTweets(tweets);

//   const data = {
//     name: coinId,
//     sentiment: analysis.label,
//     avgScore: analysis.avg,
//     celeb: analysis.celeb,
//     tweetCount: tweets.length,
//     updated: new Date().toISOString(),
//     tweets
//   };

//   tweetCache.set(cacheKey, data);
//   return data;
// }

// async function fetchTweets(query, limit=30) {
//   const res = await fetch(BASE, {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//       "X-API-Key": API_KEY
//     },
//     body: JSON.stringify({ query, limit, include_metrics: true, include_user_data: true })
//   });
//   const json = await res.json();
//   return json.data?.map(t => t.text) || [];
// }

// function analyzeTweets(tweets) {
//   const scores = tweets.map(tw => sentiment.analyze(tw.text).score);
//   const avg = scores.reduce((a,b)=>a+(b||0),0) / (scores.length||1);
//   const label = avg > 0.2 ? "Bullish" : avg < -0.2 ? "Bearish" : "Neutral";

//   // Detect celebrity mentions
//   const celebTweet = tweets.find(tw => CELEBS.some(c => tw.text.toLowerCase().includes(c)));

//   return { label, avg: avg.toFixed(2), celeb: celebTweet?.user?.username || null };
// }

// router.get("/sentiment", async (req, res) => {
//   const { coin } = req.query;
//   if (!coin) return res.status(400).json({ error: "Missing coin param" });

//   const cacheKey = `sentiment:${coin}`;
//   if (cache.has(cacheKey)) return res.json(cache.get(cacheKey));

//   const queries = [
//     coin,
//     `#${coin}`,
//     coin.toLowerCase(),
//   ];

//   const tweets = (await Promise.all(queries.map(q => fetchTweets(q, 20))))
//     .flat();

//   const result = analyzeTweets(tweets);

//   cache.set(cacheKey, result);
//   res.json(result);
// });

// async function fetchTweetsForCoin(coinId, coinAddress) {
//   const queries = [
//     `${coinId}`,
//     `#${coinId}`,
//     coinAddress ? `${coinAddress}` : ""
//   ].filter(Boolean);

//   console.log("🔍 Fetching tweets for:", queries);

//   const allTweets = await Promise.all(
//     queries.map(async (query) => {
//       try {
//         const url = `${BASE_URL}?query=${encodeURIComponent(query)}&limit=20`;
//         console.log("🌐 Requesting:", url);

//         const res = await fetch(url, {
//           method: 'GET',
//           headers: {
//             'X-RapidAPI-Key': API_KEY,
//             'X-RapidAPI-Host': 'twitter154.p.rapidapi.com'
//           }
//         });

//         console.log(`📡 Response status for "${query}":`, res.status);

//         const text = await res.text(); // get raw response to debug
//         console.log("🐦 Raw response:", text);

//         let json;
//         try {
//           json = JSON.parse(text);
//         } catch (err) {
//           console.error("❌ Failed to parse JSON:", err);
//           return [];
//         }

//         console.log("🐦 Parsed response keys:", Object.keys(json));
//         return json.results || [];
//       } catch (err) {
//         console.error(`❌ Error fetching tweets for query "${query}":`, err);
//         return [];
//       }
//     })
//   );

//   // Deduplicate tweets by ID
//   const seen = new Set();
//   const uniqueTweets = [];
//   for (const tweets of allTweets) {
//     for (const tw of tweets) {
//       if (!seen.has(tw.id)) {
//         seen.add(tw.id);
//         uniqueTweets.push(tw);
//       }
//     }
//   }

//   console.log(`✅ Total unique tweets for ${coinId}:`, uniqueTweets.length);
//   return uniqueTweets;
// }

// export default router;

// ONLY MOCK
// import express from "express";
// const router = express.Router();

// // Mock Twitter sentiment route
// router.get("/sentiment", async (req, res) => {
//   const { coin } = req.query;
//   // Simulate delay
//   await new Promise(r => setTimeout(r, 500));
//   // Return mock data
//   return res.json({
//     name: coin,
//     sentiment: "NEUTRAL",
//     avgScore: "0.00",
//     celeb: null,
//     tweetCount: 0,
//     updated: new Date().toISOString(),
//     tweets: []
//   });
// });

// export default router;

// WORKING
import express from "express";
import fetch from "node-fetch";
import NodeCache from "node-cache";

const router = express.Router();
const API_KEY = process.env.TWITTERAPI_IO_KEY;
const BASE_URL = "https://twitter154.p.rapidapi.com/search/tweets";
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

async function fetchTweetsForCoin(coinId) {
  const queries = [`${coinId}`, `#${coinId}`];
  const allTweets = await Promise.all(
    queries.map(async (query) => {
      const url = `${BASE_URL}?query=${encodeURIComponent(query)}&limit=20`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': API_KEY,
          'X-RapidAPI-Host': 'twitter154.p.rapidapi.com'
        }
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json.results || [];
    })
  );

  // Deduplicate
  const seen = new Set();
  const uniqueTweets = [];
  for (const tweets of allTweets) {
    for (const tw of tweets) {
      if (!seen.has(tw.id)) {
        seen.add(tw.id);
        uniqueTweets.push(tw);
      }
    }
  }
  return uniqueTweets;
}

router.get("/sentiment", async (req, res) => {
  const { coin } = req.query;
  const cacheKey = `sentiment:${coin}`;
  if (cache.has(cacheKey)) return res.json(cache.get(cacheKey));

  // MOCK MODE
  if (!API_KEY) {
    const mockData = {
      name: coin,
      sentiment: "NEUTRAL",
      avgScore: "0.00",
      celeb: null,
      tweetCount: 0,
      updated: new Date().toISOString(),
      tweets: []
    };
    cache.set(cacheKey, mockData);
    return res.json(mockData);
  }

  // REAL MODE
  try {
    const tweets = await fetchTweetsForCoin(coin);
    const avgScore = tweets.length ? (tweets.map(t => t.text.length % 3 - 1).reduce((a,b)=>a+b)/tweets.length).toFixed(2) : "0.00"; // placeholder sentiment logic
    const sentiment = avgScore > 0.2 ? "Bullish" : avgScore < -0.2 ? "Bearish" : "Neutral";
    const result = {
      name: coin,
      sentiment,
      avgScore,
      celeb: null, // Add celeb detection if needed
      tweetCount: tweets.length,
      updated: new Date().toISOString(),
      tweets
    };
    cache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error("❌ Twitter API error:", err);
    res.status(500).json({ error: "Failed to fetch tweets" });
  }
});

export default router;
