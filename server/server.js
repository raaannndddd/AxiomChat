import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import 'dotenv/config';
import mongoose from 'mongoose';
import cron from 'node-cron';
import { pipeline } from "@xenova/transformers";
import MongoStore from 'connect-mongo';
import passportSocketIo from 'passport.socketio';

import openaiRoute from './routes/openai.js';
import authRoutes from './routes/auth.js';
import './auth/passport.js';
import sentimentRouter from './routes/twitter.js';
import coinRoutes, { getCachedOrFetchCoinData } from './routes/coin.js';
import adminRoutes from './routes/admin.js';

import { Message } from './models/Message.js';
import { MonitoredCoin } from './models/MonitoredCoin.js';
import cookieParser from 'cookie-parser';


const app = express();
const httpServer = createServer(app);
let io;

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chatapp')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

const sessionStore = MongoStore.create({
  mongoUrl: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chatapp',
  ttl: 14 * 24 * 60 * 60
});
app.use(cookieParser(process.env.SESSION_SECRET));

// --- Session Middleware ---
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: { sameSite: 'lax' }
}));
app.use(passport.initialize());
app.use(passport.session());

// --- Socket.IO Setup with Passport Sessions ---
// const io = new Server(httpServer, { cors: { origin: '*', methods: ['GET', 'POST'] } });
// io.use(passportSocketIo.authorize({
//   key: 'connect.sid',
//   secret: 'your-secret-key',
//   store: sessionStore,
//   passport: passport,
//   cookieParser
// }));


// const io = new Server(httpServer, {
//   cors: {
//     origin: ['http://localhost:3000', 'chrome-extension://mpdgkffpebjhkdeccodjpkkhlhfcihaj', '*'],
//     methods: ['GET', 'POST'],
//     credentials: false, // we are NOT relying on cookies for sockets
//   },
// });

// --- Helpers ---
import { Filter } from 'bad-words';
const filter = new Filter();
filter.addWords('kill', 'rape', 'bomb', 'shoot', 'dox', 'address', 'ssn', 'swat', 'track', 'home address', 'phone number', 'murder');

const rateLimitWindow = 30000; 
const maxMessages = 5;
const userMessageTimestamps = {};
let sentimentAnalyzer;

const users = {};
const messageHistory = {};
let anonCounter = 0;
process.setMaxListeners(20);

// --- Middleware ---
app.use(cors({
  origin: ['http://localhost:3000', 'chrome-extension://mpdgkffpebjhkdeccodjpkkhlhfcihaj'],
  credentials: true
}));
app.use('/api', express.json());
app.use(express.static('public'));

// --- Routes ---
app.use("/api", coinRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/twitter", sentimentRouter);
app.use('/api/openai', openaiRoute);
app.use('/auth', authRoutes);

app.get('/login.html', (_, res) => res.redirect('/login/login.html'));
app.get('/', (_, res) => res.redirect('/livechat/livechat.html'));
app.get('/check-login', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ loggedIn: true, user: { email: req.user.email, anonName: req.user.anonName } });
  } else {
    res.json({ loggedIn: false });
  }
});
app.get('/debug/session', (req, res) => res.json({ session: req.session, user: req.user || null }));

// --- Coin Info ---
app.get('/api/coin-info/:coinId', async (req, res) => {
  const coinId = req.params.coinId;
  if (!coinId) return res.status(400).json({ error: 'Coin ID required' });
  try {
    const data = await getCachedOrFetchCoinData(coinId, null);
    res.json(data);
  } catch (err) {
    console.error('❌ /api/coin-info error:', err);
    res.status(500).json({ error: 'Error fetching coin info' });
  }
});

// --- Hugging Face Sentiment Model ---
(async () => { sentimentAnalyzer = await pipeline("sentiment-analysis"); })();

// --- CTO Checker ---
function isGoodForCTO(data) {
  let score = 0;
  if (data.liquidity > 20000) score += 2;
  if (data.volume24h > 10000) score += 2;
  if (data.rugRisk === "LOW") score += 3;
  if (data.sentiment === "Bullish") score += 2;
  return score >= 6;
}

// === Socket.IO (single instance, stateless handshake) ===
function initSocket(server) {
  if (io) {
    try { io.removeAllListeners(); io.close(); } catch {}
  }

  io = new Server(server, {
    cors: {
      origin: [
        'http://localhost:3000',
        'chrome-extension://mpdgkffpebjhkdeccodjpkkhlhfcihaj',
        '*', // tighten in prod
      ],
      methods: ['GET', 'POST'],
      credentials: false, // not using cookies for sockets
    },
    // path: '/socket.io', // default
  });

  // 🚫 DO NOT re-add passport.socketio here
  // io.use(passportSocketIo.authorize(...)) // <-- leave removed

  // Accept room + anonName via handshake
  io.use((socket, next) => {
    const { room, anonName } = socket.handshake.auth || {};
    socket.data.room = normalizeRoom(room || 'general');
    socket.data.anonName = (anonName && String(anonName).trim()) || 'Anon';
    next();
  });

  const rateLimitWindow = 30000;
  const maxMessages = 5;
  const userMessageTimestamps = {};

  io.on('connection', async (socket) => {
    let currentRoom = socket.data.room;
    let currentUser = socket.data.anonName;

    socket.join(currentRoom);
    console.log(`🟢 ${socket.id} connected → room=${currentRoom} user=${currentUser}`);
    socket.emit('connected', { room: currentRoom, anonName: currentUser });

    // send last 50 messages
    try {
      const historyDocs = await Message.find({ room: currentRoom })
        .sort({ createdAt: 1 })
        .limit(50);
      socket.emit('chat-history', historyDocs.map(m => ({
        user: m.username, message: m.message
      })));
    } catch (err) {
      console.error('❌ Failed to fetch chat history:', err);
    }

    // incoming message
    socket.on('send-chat-message', async (message) => {
      // rate limit
      const now = Date.now();
      const ts = userMessageTimestamps[socket.id] || [];
      const recent = ts.filter(t => now - t < rateLimitWindow);
      if (recent.length >= maxMessages) {
        socket.emit('rate-limit-warning', '⏱️ Too many messages. Try again shortly.');
        return;
      }

      // profanity
      if (filter.isProfane(message)) {
        socket.emit('message-blocked', '⚠️ Message blocked.');
        return;
      }

      userMessageTimestamps[socket.id] = [...recent, now];

      const payload = { user: currentUser, message };

      try {
        await Message.create({
          username: currentUser, room: currentRoom, message, createdAt: new Date()
        });
      } catch (err) {
        console.error('❌ Failed to save message:', err);
      }

      socket.to(currentRoom).emit('chat-message', payload);
    });

    // legacy support
    socket.on('join-room', async (room) => {
      const nextRoom = normalizeRoom(room || 'general');
      if (nextRoom === currentRoom) return;

      socket.leave(currentRoom);
      currentRoom = nextRoom;
      socket.join(currentRoom);
      console.log(`🔗 ${socket.id} switched room → ${currentRoom}`);

      try {
        const historyDocs = await Message.find({ room: currentRoom })
          .sort({ createdAt: 1 })
          .limit(50);
        socket.emit('chat-history', historyDocs.map(m => ({
          user: m.username, message: m.message
        })));
      } catch (err) {
        console.error('❌ Failed to fetch chat history on join:', err);
      }
    });

    socket.on('new-user', (name, cb) => {
      if (name && String(name).trim()) currentUser = String(name).trim();
      if (cb) cb(currentUser);
    });

    socket.on('disconnect', () => {
      console.log(`🔴 ${socket.id} disconnected from room=${currentRoom}`);
      delete userMessageTimestamps[socket.id];
    });
  });
}

function normalizeRoom(room) {
  return String(room).trim().toLowerCase();
}

cron.schedule('*/5 * * * *', async () => {
  console.log("🔄 Checking monitored coins for CTO...");
  try {
    const coins = await MonitoredCoin.find({}).populate('userId');
    for (const entry of coins) {
      const data = await getCachedOrFetchCoinData(entry.coinId);
      if (isGoodForCTO(data)) {
        io.to(entry.userId._id.toString()).emit("cto-alert", {
          coinId: entry.coinId,
          message: `${entry.coinId} is ready for CTO!`
        });
        await MonitoredCoin.deleteOne({ _id: entry._id });
      }
    }
  } catch (err) { console.error('❌ Error checking monitored coins:', err); }
});

// --- Sentiment API ---
app.post("/api/sentiment", async (req, res) => {
  const { message } = req.body;
  if (!sentimentAnalyzer) return res.status(503).json({ error: "Model not ready" });
  try { res.json((await sentimentAnalyzer(message))[0]); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

// --- Monitor Endpoints ---
app.post('/api/monitor/:coinId', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(403).json({ error: "Not logged in" });
  const userId = req.user._id; const coinId = req.params.coinId;
  try {
    const exists = await MonitoredCoin.findOne({ userId, coinId });
    if (!exists) await MonitoredCoin.create({ userId, coinId });
    res.json({ message: `Now monitoring ${coinId} for CTO.` });
  } catch (err) {
    console.error('❌ Error saving monitored coin:', err);
    res.status(500).json({ error: 'Failed to monitor coin' });
  }
});

app.get('/api/monitor/list', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(403).json({ error: "Not logged in" });
  const coins = await MonitoredCoin.find({ userId: req.user._id });
  res.json(coins);
});

app.delete('/api/monitor/remove/:coinId', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(403).json({ error: "Not logged in" });
  await MonitoredCoin.deleteOne({ userId: req.user._id, coinId: req.params.coinId });
  res.json({ message: `Stopped monitoring ${req.params.coinId}.` });
});

// --- Admin View of All Monitored Coins ---
app.get('/api/admin/monitored', async (req, res) => {
  const coins = await MonitoredCoin.find({}).populate('userId', 'email anonName');
  res.json(coins);
});

initSocket(httpServer);
// --- Start Servers ---
httpServer.listen(3000, () => console.log('🚀 Server + Socket.IO running on http://localhost:3000'));
app.listen(3001, () => console.log("Sentiment API on port 3001"));