import express from 'express';
import { User } from '../models/Users.js';
import { Message } from '../models/Message.js';
import { MonitoredCoin } from '../models/MonitoredCoin.js';

const router = express.Router();

function isAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user?.isAdmin) return next();
  return res.status(403).json({ error: 'Forbidden' });
}

// --- Get all users (email, membership, last login) ---
router.get('/users', isAdmin, async (req, res) => {
  try {
    const users = await User.find({}, 'email membership lastLogin createdAt');
    res.json(users);
  } catch (err) {
    console.error('❌ Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// --- Get recent messages ---
router.get('/messages', isAdmin, async (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const skip = parseInt(req.query.skip) || 0;
  try {
    const messages = await Message.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    res.json(messages);
  } catch (err) {
    console.error('❌ Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// --- Get all monitored coins with user info ---
router.get('/monitored', isAdmin, async (req, res) => {
  try {
    const coins = await MonitoredCoin.find({})
      .populate('userId', 'email anonName membership');
    res.json(coins);
  } catch (err) {
    console.error('❌ Error fetching monitored coins:', err);
    res.status(500).json({ error: 'Failed to fetch monitored coins' });
  }
});

export default router;