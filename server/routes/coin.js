import express from 'express';
import fetch from 'node-fetch';
import NodeCache from 'node-cache';
import * as cheerio from 'cheerio';

const router = express.Router();
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Map for CoinGecko chain names
const chainMap = {
  ethereum: 'ethereum',
  bsc: 'binance-smart-chain',
  solana: 'solana',
  polygon: 'polygon-pos',
  arbitrum: 'arbitrum-one',
  avalanche: 'avalanche'
};

const CHAINS = ['ethereum', 'bsc', 'solana', 'base', 'arbitrum', 'optimism', 'avalanche'];

async function findDexScreenerToken(query) {
  for (const chain of CHAINS) {
    const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = await res.json();
      const firstPair = json.pairs?.[0];
      if (firstPair) {
        return {
          chain: firstPair.chainId || chain,
          address: firstPair.baseToken?.address || query
        };
      }
    } catch (err) {
      console.warn(`DexScreener search failed on ${chain}:`, err.message);
    }
  }
  return null;
}


// Safe fetch wrapper
async function safeFetch(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`❌ Error fetching ${url}:`, err);
    return null;
  }
}

// DexScreener fetch with fallback search
async function fetchDexData(coinId) {
  let dexData = await safeFetch(`https://api.dexscreener.com/latest/dex/tokens/${coinId}`);
  if (!dexData?.pairs) {
    console.log("No pairs found for token endpoint, trying search...");
    dexData = await safeFetch(`https://api.dexscreener.com/latest/dex/search?q=${coinId}`);
  }
  return dexData?.pairs?.[0] || null;
}

// Twitter sentiment fetch (calls your /api/twitter/sentiment)
async function fetchTwitterSentiment(coinId) {
  try {
    const res = await fetch(`http://localhost:3000/api/twitter/sentiment?coin=${encodeURIComponent(coinId)}`);
    if (!res.ok) throw new Error("Twitter API failed");
    return await res.json();
  } catch (err) {
    console.error("❌ Error fetching Twitter sentiment:", err);
    return { sentiment: "UNKNOWN", avgScore: "0.00", tweetCount: 0, celeb: null };
  }
}

// Main aggregator
export async function getCachedOrFetchCoinData(coinId, debug = false) {
    const cacheKey = `coin:${coinId}`;
    if (cache.has(cacheKey) && !debug) return cache.get(cacheKey);
  
    try {
      console.log("🔍 [INFO] Searching DexScreener for:", coinId);
  
      // ** NEW STEP: Resolve funky IDs via DexScreener scrape **
      const resolved = await findDexScreenerToken(coinId);
      let detectedChain = "ethereum"; // default
      if (resolved) {
        console.log("🔄 [INFO] Resolved token:", resolved);
        coinId = resolved.address;       // Use canonical mint address
        detectedChain = resolved.chain;  // Use correct chain
      }
  
      // --- DexScreener: Use resolved canonical address ---
      const searchRes = await safeFetch(`https://api.dexscreener.com/latest/dex/tokens/${coinId}`);
      const dexInfo = searchRes?.pairs?.[0];
  
      if (!dexInfo) {
        console.warn("⚠️ [WARN] DexScreener returned no pairs for", coinId);
        const unlisted = {
          name: "Unlisted",
          symbol: "N/A",
          sentiment: "NEUTRAL",
          price: "N/A",
          liquidity: "N/A",
          marketCap: "N/A",
          volume24h: "N/A",
          dex: "Not traded",
          rugRisk: "UNKNOWN",
          tweetCount: 0,
          updated: new Date().toISOString()
        };
        cache.set(cacheKey, unlisted);
        return unlisted;
      }
  
      const canonicalTokenAddress = dexInfo.baseToken?.address || coinId;
      const tokenName = dexInfo.baseToken?.name || coinId;
      const cgChain = chainMap[detectedChain] || 'ethereum';
  
      if (debug) {
        console.log("Dex Info (canonical):", JSON.stringify(dexInfo, null, 2));
        console.log("Canonical token address:", canonicalTokenAddress);
      }
  
      // --- CoinGecko: Try contract lookup, then fallback to slug search ---
      let coingeckoData = await safeFetch(
        `https://api.coingecko.com/api/v3/coins/${cgChain}/contract/${canonicalTokenAddress}`
      );
  
      if (!coingeckoData || coingeckoData.error) {
        console.warn("⚠️ [WARN] CoinGecko contract lookup failed. Trying search by name:", tokenName);
        const searchCg = await safeFetch(`https://api.coingecko.com/api/v3/search?query=${tokenName}`);
        const match = searchCg?.coins?.[0];
        if (match?.id) {
          coingeckoData = await safeFetch(`https://api.coingecko.com/api/v3/coins/${match.id}`);
          if (debug) console.log("CoinGecko slug fallback:", JSON.stringify(coingeckoData, null, 2));
        } else {
          console.warn("⚠️ [WARN] CoinGecko search also failed for:", tokenName);
        }
      }
  
      const cgInfo = coingeckoData?.market_data || {};
      const riskInfo = (await safeFetch(
        `https://api.gopluslabs.io/api/v1/token_security/${detectedChain}?contract_addresses=${canonicalTokenAddress}`
      ))?.result?.[canonicalTokenAddress] || {};
  
      const twitterData = await fetchTwitterSentiment(canonicalTokenAddress);
  
      const data = {
        name: coingeckoData?.name || dexInfo.baseToken?.name || "Unknown",
        symbol: coingeckoData?.symbol || dexInfo.baseToken?.symbol || "N/A",
        sentiment: twitterData.sentiment || "NEUTRAL",
        avgTwitterScore: twitterData.avgScore || "0.00",
        price: dexInfo.priceUsd || cgInfo.current_price?.usd || "N/A",
        liquidity: dexInfo.liquidity?.usd || "N/A",
        marketCap: dexInfo.fdv || cgInfo.market_cap?.usd || "N/A",
        volume24h: dexInfo.volume?.h24 || cgInfo.total_volume?.usd || "N/A",
        dex: dexInfo.dexId || "N/A",
        rugRisk: riskInfo.is_honeypot === 1 ? "HIGH" : "LOW",
        tweetCount: twitterData.tweetCount || 0,
        celebMention: twitterData.celeb || null,
        updated: new Date().toISOString()
      };
  
      cache.set(cacheKey, data);
      return data;
    } catch (err) {
      console.error("❌ [ERROR] getCachedOrFetchCoinData failed:", err);
      return {
        name: "Error",
        symbol: "N/A",
        sentiment: "UNKNOWN",
        price: "N/A",
        liquidity: "N/A",
        marketCap: "N/A",
        volume24h: "N/A",
        dex: "Error",
        rugRisk: "UNKNOWN",
        tweetCount: 0,
        updated: new Date().toISOString()
      };
    }
  }

// API route
router.get('/coin-info/:coinId', async (req, res) => {
  const coinId = req.params.coinId;
  const debug = req.query.debug === "true";
  if (!coinId) return res.status(400).json({ error: 'Coin ID required' });

  try {
    const data = await getCachedOrFetchCoinData(coinId, debug);
    res.json(data);
  } catch (err) {
    console.error('❌ /api/coin-info error:', err);
    res.status(500).json({ error: 'Failed to fetch coin data' });
  }
});

export default router;