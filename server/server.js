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
const io = new Server(httpServer, { cors: { origin: '*', methods: ['GET', 'POST'] } });
io.use(passportSocketIo.authorize({
  key: 'connect.sid',
  secret: 'your-secret-key',
  store: sessionStore,
  passport: passport,
  cookieParser
}));

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

// --- Socket.IO ---
io.on('connection', socket => {
  if (socket.request.user?._id) {
    socket.join(socket.request.user._id.toString());
  }

  let currentRoom = null;
  console.log('🟢 New client connected:', socket.id);

  socket.on('join-room', async (room) => {
    currentRoom = room;
    socket.join(room);
    console.log(`🔗 ${socket.id} joined room ${room}`);
    try {
      const history = await Message.find({ room }).sort({ createdAt: 1 }).limit(50);
      socket.emit('chat-history', history.map(m => ({ user: m.username, message: m.message })));
    } catch (err) {
      console.error('❌ Failed to fetch chat history:', err);
    }
  });

  socket.on('new-user', (anonName, callback) => {
    if (!anonName) {
      anonName = `anon${String(anonCounter).padStart(5, '0')}`;
      anonCounter++;
    }
    users[socket.id] = anonName;
    if (currentRoom) socket.to(currentRoom).emit('user-connected', anonName);
    if (callback) callback(anonName);
  });

  socket.on('send-chat-message', async message => {
    const now = Date.now();
    const timestamps = userMessageTimestamps[socket.id] || [];
    const recent = timestamps.filter(t => now - t < rateLimitWindow);
    if (recent.length >= maxMessages) return socket.emit('rate-limit-warning', '⏱️ Too many messages. Try again shortly.');
    if (filter.isProfane(message)) return socket.emit('message-blocked', '⚠️ Message blocked.');
  
    const user = users[socket.id] || (socket.request.user?.anonName || 'Unknown');
    const payload = { message, user };
    userMessageTimestamps[socket.id] = [...recent, now];
  
    try {
      await Message.create({ username: user, room: currentRoom, message, createdAt: new Date() });
    } catch (err) { console.error('❌ Failed to save message:', err); }
  
    io.to(currentRoom).emit('chat-message', payload);
  });

  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (currentRoom) socket.to(currentRoom).emit('user-disconnected', user);
    delete users[socket.id];
    delete userMessageTimestamps[socket.id];
  });
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

// --- Start Servers ---
httpServer.listen(3000, () => console.log('🚀 Server + Socket.IO running on http://localhost:3000'));
app.listen(3001, () => console.log("Sentiment API on port 3001"));