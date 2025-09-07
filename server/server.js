// import express from 'express';
// import { createServer } from 'http';
// import { Server } from 'socket.io';
// import cors from 'cors';
// import session from 'express-session';
// import passport from 'passport';
// import 'dotenv/config';
// import mongoose from 'mongoose';
// import cron from 'node-cron';
// import { pipeline } from "@xenova/transformers";
// import MongoStore from 'connect-mongo';
// import passportSocketIo from 'passport.socketio';

// import openaiRoute from './routes/openai.js';
// import authRoutes from './routes/auth.js';
// import './auth/passport.js';
// import sentimentRouter from './routes/twitter.js';
// import coinRoutes, { getCachedOrFetchCoinData } from './routes/coin.js';
// import adminRoutes from './routes/admin.js';

// import { Message } from './models/Message.js';
// import { MonitoredCoin } from './models/MonitoredCoin.js';
// import cookieParser from 'cookie-parser';
// import { Filter } from 'bad-words';


// const app = express();
// const httpServer = createServer(app);
// let io;

// // --- MongoDB Connection ---
// const MONGO_URI =
//   process.env.MONGODB_URI ||     
//   process.env.MONGO_URI ||           
//   'mongodb://mongo:27017/chartdb';  

// mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 })
//   .then(() => console.log('✅ MongoDB connected:', MONGO_URI))
//   .catch(err => {
//     console.error('❌ MongoDB error:', err);
//     process.exit(1);
//   });

// const sessionStore = MongoStore.create({
//   mongoUrl: MONGO_URI,
//   ttl: 14 * 24 * 60 * 60
// });

// // --- Session Middleware ---
// app.use(session({
//   secret: process.env.SESSION_SECRET,
//   resave: false,
//   saveUninitialized: false,
//   store: sessionStore,
//   cookie: { sameSite: 'lax' }
// }));
// app.use(passport.initialize());
// app.use(passport.session());

// // --- Helpers ---
// const filter = new Filter();
// filter.addWords('kill', 'rape', 'bomb', 'shoot', 'dox', 'address', 'ssn', 'swat', 'track', 'home address', 'phone number', 'murder');

// const rateLimitWindow = 30000; 
// const maxMessages = 5;
// const userMessageTimestamps = {};
// let sentimentAnalyzer;

// const users = {};
// const messageHistory = {};
// let anonCounter = 0;
// process.setMaxListeners(20);

// app.set('trust proxy', 1);
// app.use(session({
//   secret: process.env.SESSION_SECRET,
//   resave: false,
//   saveUninitialized: false,
//   store: sessionStore,
//   cookie: {
//     sameSite: 'lax',
//     secure: process.env.NODE_ENV === 'production', // true on Cloud Run
//   }
// }));

// // --- Middleware ---
// app.use(cors({
//   origin: [
//     'http://localhost:3000',
//     'chrome-extension://mpdgkffpebjhkdeccodjpkkhlhfcihaj',
//     'https://chat-extension-997520525797.australia-southeast1.run.app',
//   ],
//   credentials: true
// }));
// app.use('/api', express.json());
// app.use(express.static('public'));

// // --- Routes ---
// app.use("/api", coinRoutes);
// app.use("/api/admin", adminRoutes);
// app.use("/api/twitter", sentimentRouter);
// app.use('/api/openai', openaiRoute);
// app.use('/auth', authRoutes);

// app.get('/login.html', (_, res) => res.redirect('/login/login.html'));
// app.get('/', (_, res) => res.redirect('/livechat/livechat.html'));
// app.get('/check-login', (req, res) => {
//   if (req.isAuthenticated()) {
//     res.json({ loggedIn: true, user: { email: req.user.email, anonName: req.user.anonName } });
//   } else {
//     res.json({ loggedIn: false });
//   }
// });
// app.get('/debug/session', (req, res) => res.json({ session: req.session, user: req.user || null }));

// // --- Coin Info ---
// app.get('/api/coin-info/:coinId', async (req, res) => {
//   const coinId = req.params.coinId;
//   if (!coinId) return res.status(400).json({ error: 'Coin ID required' });
//   try {
//     const data = await getCachedOrFetchCoinData(coinId, null);
//     res.json(data);
//   } catch (err) {
//     console.error('❌ /api/coin-info error:', err);
//     res.status(500).json({ error: 'Error fetching coin info' });
//   }
// });

// // --- Hugging Face Sentiment Model ---
// (async () => { sentimentAnalyzer = await pipeline("sentiment-analysis"); })();

// // --- CTO Checker ---
// function isGoodForCTO(data) {
//   let score = 0;
//   if (data.liquidity > 20000) score += 2;
//   if (data.volume24h > 10000) score += 2;
//   if (data.rugRisk === "LOW") score += 3;
//   if (data.sentiment === "Bullish") score += 2;
//   return score >= 6;
// }

// // === Socket.IO (single instance, stateless handshake) ===
// function initSocket(server) {
//   if (io) {
//     try { io.removeAllListeners(); io.close(); } catch {}
//   }

//   io = new Server(server, {
//     cors: {
//       origin: [
//         'http://localhost:3000',
//         'chrome-extension://mpdgkffpebjhkdeccodjpkkhlhfcihaj',
//         '*', // tighten in prod
//       ],
//       methods: ['GET', 'POST'],
//       credentials: false, // not using cookies for sockets
//     },
//     // path: '/socket.io', // default
//   });

//   // 🚫 DO NOT re-add passport.socketio here
//   // io.use(passportSocketIo.authorize(...)) // <-- leave removed

//   // Accept room + anonName via handshake
//   io.use((socket, next) => {
//     const { room, anonName } = socket.handshake.auth || {};
//     socket.data.room = normalizeRoom(room || 'general');
//     socket.data.anonName = (anonName && String(anonName).trim()) || 'Anon';
//     next();
//   });

//   const rateLimitWindow = 30000;
//   const maxMessages = 5;
//   const userMessageTimestamps = {};

//   io.on('connection', async (socket) => {
//     let currentRoom = socket.data.room;
//     let currentUser = socket.data.anonName;

//     socket.join(currentRoom);
//     console.log(`🟢 ${socket.id} connected → room=${currentRoom} user=${currentUser}`);
//     socket.emit('connected', { room: currentRoom, anonName: currentUser });

//     // send last 50 messages
//     try {
//       const historyDocs = await Message.find({ room: currentRoom })
//         .sort({ createdAt: 1 })
//         .limit(50);
//       socket.emit('chat-history', historyDocs.map(m => ({
//         user: m.username, message: m.message
//       })));
//     } catch (err) {
//       console.error('❌ Failed to fetch chat history:', err);
//     }

//     // incoming message
//     socket.on('send-chat-message', async (message) => {
//       // rate limit
//       const now = Date.now();
//       const ts = userMessageTimestamps[socket.id] || [];
//       const recent = ts.filter(t => now - t < rateLimitWindow);
//       if (recent.length >= maxMessages) {
//         socket.emit('rate-limit-warning', '⏱️ Too many messages. Try again shortly.');
//         return;
//       }

//       // profanity
//       if (filter.isProfane(message)) {
//         socket.emit('message-blocked', '⚠️ Message blocked.');
//         return;
//       }

//       userMessageTimestamps[socket.id] = [...recent, now];

//       const payload = { user: currentUser, message };

//       try {
//         await Message.create({
//           username: currentUser, room: currentRoom, message, createdAt: new Date()
//         });
//       } catch (err) {
//         console.error('❌ Failed to save message:', err);
//       }

//       socket.to(currentRoom).emit('chat-message', payload);
//     });

//     // legacy support
//     socket.on('join-room', async (room) => {
//       const nextRoom = normalizeRoom(room || 'general');
//       if (nextRoom === currentRoom) return;

//       socket.leave(currentRoom);
//       currentRoom = nextRoom;
//       socket.join(currentRoom);
//       console.log(`🔗 ${socket.id} switched room → ${currentRoom}`);

//       try {
//         const historyDocs = await Message.find({ room: currentRoom })
//           .sort({ createdAt: 1 })
//           .limit(50);
//         socket.emit('chat-history', historyDocs.map(m => ({
//           user: m.username, message: m.message
//         })));
//       } catch (err) {
//         console.error('❌ Failed to fetch chat history on join:', err);
//       }
//     });

//     socket.on('new-user', (name, cb) => {
//       if (name && String(name).trim()) currentUser = String(name).trim();
//       if (cb) cb(currentUser);
//     });

//     socket.on('disconnect', () => {
//       console.log(`🔴 ${socket.id} disconnected from room=${currentRoom}`);
//       delete userMessageTimestamps[socket.id];
//     });
//   });
// }

// function normalizeRoom(room) {
//   return String(room).trim().toLowerCase();
// }

// cron.schedule('*/5 * * * *', async () => {
//   console.log("🔄 Checking monitored coins for CTO...");
//   try {
//     const coins = await MonitoredCoin.find({}).populate('userId');
//     for (const entry of coins) {
//       const data = await getCachedOrFetchCoinData(entry.coinId);
//       if (isGoodForCTO(data)) {
//         io.to(entry.userId._id.toString()).emit("cto-alert", {
//           coinId: entry.coinId,
//           message: `${entry.coinId} is ready for CTO!`
//         });
//         await MonitoredCoin.deleteOne({ _id: entry._id });
//       }
//     }
//   } catch (err) { console.error('❌ Error checking monitored coins:', err); }
// });

// // --- Sentiment API ---
// app.post("/api/sentiment", async (req, res) => {
//   const { message } = req.body;
//   if (!sentimentAnalyzer) return res.status(503).json({ error: "Model not ready" });
//   try { res.json((await sentimentAnalyzer(message))[0]); }
//   catch (error) { res.status(500).json({ error: error.message }); }
// });

// // --- Monitor Endpoints ---
// app.post('/api/monitor/:coinId', async (req, res) => {
//   if (!req.isAuthenticated()) return res.status(403).json({ error: "Not logged in" });
//   const userId = req.user._id; const coinId = req.params.coinId;
//   try {
//     const exists = await MonitoredCoin.findOne({ userId, coinId });
//     if (!exists) await MonitoredCoin.create({ userId, coinId });
//     res.json({ message: `Now monitoring ${coinId} for CTO.` });
//   } catch (err) {
//     console.error('❌ Error saving monitored coin:', err);
//     res.status(500).json({ error: 'Failed to monitor coin' });
//   }
// });

// app.get('/api/monitor/list', async (req, res) => {
//   if (!req.isAuthenticated()) return res.status(403).json({ error: "Not logged in" });
//   const coins = await MonitoredCoin.find({ userId: req.user._id });
//   res.json(coins);
// });

// app.delete('/api/monitor/remove/:coinId', async (req, res) => {
//   if (!req.isAuthenticated()) return res.status(403).json({ error: "Not logged in" });
//   await MonitoredCoin.deleteOne({ userId: req.user._id, coinId: req.params.coinId });
//   res.json({ message: `Stopped monitoring ${req.params.coinId}.` });
// });

// // --- Admin View of All Monitored Coins ---
// app.get('/api/admin/monitored', async (req, res) => {
//   const coins = await MonitoredCoin.find({}).populate('userId', 'email anonName');
//   res.json(coins);
// });

// initSocket(httpServer);
// // --- Start Servers ---
// const port = process.env.PORT || 3000;
// httpServer.listen(port, () => {
//   console.log(`🚀 Server + Socket.IO on :${port}`);
// });

// server.js — fully local (NO MongoDB)
import express, { Router } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import cron from 'node-cron';
import 'dotenv/config';
import { pipeline } from '@xenova/transformers';
import { Filter } from 'bad-words';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
// ==== keep your existing feature routes (must NOT touch Mongo) ====
import openaiRoute from './routes/openai.js';
import sentimentRouter from './routes/twitter.js';
import coinRoutes, { getCachedOrFetchCoinData } from './routes/coin.js';

// -----------------------------------------------------------------------------------
// In-memory stores (replace Mongo models: Message, MonitoredCoin, and Users)
// -----------------------------------------------------------------------------------

// Resolve absolute path to the /public folder no matter where server.js runs
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

let anonCounter = 0;
const nextAnon = () => `anon${String(++anonCounter).padStart(4, '0')}`;

// If server.js is in /server and public is at project root: ../public
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.resolve(__dirname, '..', 'public');

console.log('✅ Serving static from:', PUBLIC_DIR);


// Messages per room
const messageHistory = new Map(); // Map<room, Array<{username, message, createdAt}>>
const readRoomHistory = (room, limit = 50) => (messageHistory.get(room) || []).slice(-limit);
const appendMessage = (room, username, message) => {
  const arr = messageHistory.get(room) || [];
  const doc = { username, message, createdAt: new Date() };
  arr.push(doc);
  messageHistory.set(room, arr);
  return doc;
};

// Monitored coins per user
const monitoredByUser = new Map(); // Map<userId, Set<coinId>>
const addMonitor = (userId, coinId) => {
  const set = monitoredByUser.get(userId) || new Set();
  set.add(coinId);
  monitoredByUser.set(userId, set);
};
const removeMonitor = (userId, coinId) => {
  const set = monitoredByUser.get(userId);
  if (!set) return;
  set.delete(coinId);
  if (!set.size) monitoredByUser.delete(userId);
};
const listMonitors = (userId) => Array.from(monitoredByUser.get(userId) || new Set());

// Users (email/password auth)
const usersById = new Map();       // id -> user
const usersByEmail = new Map();    // lower(email) -> id
const findUserById = (id) => usersById.get(id) || null;
const findUserByEmail = (email) => {
  const id = usersByEmail.get(String(email).toLowerCase());
  return id ? usersById.get(id) : null;
};
const createUser = async ({ email, password, anonName }) => {
  const id = randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);
   const user = {
      id,
       _id: id,
       email,
       anonName: anonName || nextAnon(),
       passwordHash,
       createdAt: new Date(),
     };
  usersById.set(id, user);
  usersByEmail.set(email.toLowerCase(), id);
  return user;
};

// -----------------------------------------------------------------------------------
// App + Middleware
// -----------------------------------------------------------------------------------
const app = express();
const httpServer = createServer(app);
let io;

process.setMaxListeners(20);
app.set('trust proxy', 1);
app.use(cookieParser());

// Body parsers (global so /auth sees JSON)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session (MemoryStore; fine for local/dev)
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    sameSite: 'lax',
    secure: false, // set true ONLY when behind HTTPS
  }
}));

// Passport (LocalStrategy with in-memory users)
passport.use(new LocalStrategy(
  { usernameField: 'email', passwordField: 'password', session: true, passReqToCallback: true },
  async (req, email, password, done) => {
    // tolerate alternate client field names
    email = email || req.body?.username || req.body?.emailAddress;
    password = password || req.body?.pwd || req.body?.password1;
    if (!email || !password) return done(null, false, { message: 'Missing credentials' });

    try {
      const user = findUserByEmail(email);
      if (!user) return done(null, false, { message: 'Invalid email or password' });
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return done(null, false, { message: 'Invalid email or password' });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => done(null, findUserById(id)));

app.use(passport.initialize());
app.use(passport.session());

// CORS / static
app.use(cors({
  origin: [
    'http://localhost:3000',
    'chrome-extension://mpdgkffpebjhkdeccodjpkkhlhfcihaj',
    'https://chat-extension-997520525797.australia-southeast1.run.app',
  ],
  credentials: true
}));
app.use(express.static(PUBLIC_DIR));

const randomAnonName = () => `Anon${Math.floor(Math.random()*90000 + 10000)}`;
const createGuestUser = async () => {
  const guestEmail = `guest-${Date.now()}-${Math.random().toString(36).slice(2,8)}@local`;
  // random password (not used, but keeps the shape consistent)
  return createUser({ email: guestEmail, password: randomUUID(), anonName: randomAnonName() });
};

// -----------------------------------------------------------------------------------
// Auth routes (no Mongo) — /auth/register, /auth/login, /auth/logout
// -----------------------------------------------------------------------------------
const auth = Router();

auth.post('/register', async (req, res) => {
  try {
    const { email, password, anonName } = req.body || {};

    // If email/password missing OR already exists → create guest and login
    if (!email || !password || findUserByEmail(email)) {
      const guest = await createGuestUser();
      return req.login(guest, (err) => {
        if (err) return res.status(200).json({ ok: true, guest: true, user: { id: guest.id, email: guest.email, anonName: guest.anonName } });
        return res.json({ ok: true, guest: true, user: { id: guest.id, email: guest.email, anonName: guest.anonName } });
      });
    }

    // Normal registration path
    const user = await createUser({ email, password, anonName });
    return req.login(user, (err) => {
      if (err) return res.status(200).json({ ok: true, guest: true, user: { id: user.id, email: user.email, anonName: user.anonName } });
      return res.json({ ok: true, user: { id: user.id, email: user.email, anonName: user.anonName } });
    });
  } catch (e) {
    // Any unexpected error → guest fallback
    try {
      const guest = await createGuestUser();
      return req.login(guest, () =>
        res.json({ ok: true, guest: true, user: { id: guest.id, email: guest.email, anonName: guest.anonName } })
      );
    } catch {
      return res.status(500).json({ error: 'Registration failed (and guest login failed)' });
    }
  }
});

auth.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info?.message || 'Invalid credentials' });
    req.logIn(user, (err2) => {
      if (err2) return next(err2);
      res.json({ ok: true, user: { id: user.id, email: user.email, anonName: user.anonName } });
    });
  })(req, res, next);
});

auth.post('/logout', (req, res, next) => {
  req.logout?.(err => {
    if (err) return next(err);
    req.session?.destroy(() => res.json({ ok: true }));
  }) || res.json({ ok: true });
});

auth.post('/guest', async (_req, res) => {
  try {
    const guest = await createGuestUser();
    return _req.login(guest, () =>
      res.json({ ok: true, guest: true, user: { id: guest.id, email: guest.email, anonName: guest.anonName } })
    );
  } catch (e) {
    return res.status(500).json({ error: 'Guest login failed' });
  }
});

app.use('/auth', auth);

// login helpers (same paths as before)
app.get('/login.html', (_, res) => res.redirect('/login/login.html'));
app.get('/',            (_, res) => res.redirect('/livechat/livechat.html'));
app.get('/check-login', (req, res) => {
  const authed = typeof req.isAuthenticated === 'function' && req.isAuthenticated();
  if (authed) {
    const { email, anonName } = req.user || {};
    return res.json({ loggedIn: true, user: { email, anonName } });
  }
  res.json({ loggedIn: false });
});
app.get('/debug/session', (req, res) => res.json({ session: req.session, user: req.user || null }));

// -----------------------------------------------------------------------------------
// Feature routes (unchanged behavior)
// -----------------------------------------------------------------------------------
app.use('/api',          coinRoutes);
app.use('/api/twitter',  sentimentRouter);
app.use('/api/openai',   openaiRoute);

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

// Admin view (in-memory equivalent of previous /api/admin/monitored)
app.get('/api/admin/monitored', (_req, res) => {
  const all = [];
  for (const [userId, set] of monitoredByUser.entries()) {
    const user = findUserById(userId);
    for (const coinId of set.values()) {
      all.push({
        userId,
        coinId,
        user: user ? { email: user.email, anonName: user.anonName } : null,
      });
    }
  }
  res.json(all);
});

// -----------------------------------------------------------------------------------
// Sentiment API (HF pipeline)
// -----------------------------------------------------------------------------------
let sentimentAnalyzer;
(async () => { sentimentAnalyzer = await pipeline('sentiment-analysis'); })();

app.post('/api/sentiment', async (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message is required' });
  if (!sentimentAnalyzer) return res.status(503).json({ error: 'Model not ready' });
  try {
    res.json((await sentimentAnalyzer(message))[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------------------------------------------------------
// Socket.IO (no passport.socketio). Chat history is in-memory.
// -----------------------------------------------------------------------------------
const filter = new Filter();
filter.addWords('kill','rape','bomb','shoot','dox','address','ssn','swat','track','home address','phone number','murder');

function normalizeRoom(room) { return String(room || 'general').trim().toLowerCase(); }

function initSocket(server) {
  if (io) { try { io.removeAllListeners(); io.close(); } catch {} }

  io = new Server(server, {
    cors: {
      origin: [
        'http://localhost:3000',
        'chrome-extension://mpdgkffpebjhkdeccodjpkkhlhfcihaj',
        '*', // tighten in prod
      ],
      methods: ['GET','POST'],
      credentials: false,
    },
  });

  // Accept room + anonName + optional userId via handshake
  io.use((socket, next) => {
    const { room, anonName, userId } = socket.handshake.auth || {};
    socket.data.room = normalizeRoom(room);
    socket.data.anonName = (anonName && String(anonName).trim()) || 'Anon';
    socket.data.userId = userId ? String(userId) : null; // only if client provides after login
    next();
  });

  const rateLimitWindow = 30000; // 30s
  const maxMessages = 5;
  const userMessageTimestamps = {};

  io.on('connection', async (socket) => {
    let currentRoom = socket.data.room;
    let currentUser = socket.data.anonName;

    socket.join(currentRoom);
    if (socket.data.userId) socket.join(`user:${socket.data.userId}`);

    console.log(`🟢 ${socket.id} connected → room=${currentRoom} user=${currentUser}`);
    socket.emit('connected', { room: currentRoom, anonName: currentUser });

    // send last 50 messages
    try {
      const history = readRoomHistory(currentRoom, 50);
      socket.emit('chat-history', history.map(m => ({ user: m.username, message: m.message })));
    } catch (err) {
      console.error('❌ Failed to fetch chat history:', err);
    }

    socket.on('send-chat-message', async (message) => {
      const now = Date.now();
      const ts = userMessageTimestamps[socket.id] || [];
      const recent = ts.filter(t => now - t < rateLimitWindow);
      if (recent.length >= maxMessages) {
        socket.emit('rate-limit-warning', '⏱️ Too many messages. Try again shortly.');
        return;
      }
      if (filter.isProfane(message)) {
        socket.emit('message-blocked', '⚠️ Message blocked.');
        return;
      }
      userMessageTimestamps[socket.id] = [...recent, now];

      appendMessage(currentRoom, currentUser, message);
      socket.to(currentRoom).emit('chat-message', { user: currentUser, message });
    });

    socket.on('join-room', async (room) => {
      const nextRoom = normalizeRoom(room);
      if (nextRoom === currentRoom) return;
      socket.leave(currentRoom);
      currentRoom = nextRoom;
      socket.join(currentRoom);
      const history = readRoomHistory(currentRoom, 50);
      socket.emit('chat-history', history.map(m => ({ user: m.username, message: m.message })));
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
initSocket(httpServer);

// -----------------------------------------------------------------------------------
// Cron: check monitored coins and notify each user's personal room if threshold met
// -----------------------------------------------------------------------------------
function isGoodForCTO(data) {
  let score = 0;
  if (data.liquidity > 20000) score += 2;
  if (data.volume24h > 10000) score += 2;
  if (data.rugRisk === 'LOW') score += 3;
  if (data.sentiment === 'Bullish') score += 2;
  return score >= 6;
}

cron.schedule('*/5 * * * *', async () => {
  console.log('🔄 Checking monitored coins for CTO...');
  try {
    for (const [userId, set] of monitoredByUser.entries()) {
      for (const coinId of set.values()) {
        const data = await getCachedOrFetchCoinData(coinId);
        if (isGoodForCTO(data)) {
          io.to(`user:${userId}`).emit('cto-alert', { coinId, message: `${coinId} is ready for CTO!` });
          removeMonitor(userId, coinId);
        }
      }
    }
  } catch (err) {
    console.error('❌ Error checking monitored coins:', err);
  }
});

// -----------------------------------------------------------------------------------
// Start
// -----------------------------------------------------------------------------------
const port = Number(process.env.PORT) || 3000;
httpServer.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server + Socket.IO on :${port} (no DB)`);
});
