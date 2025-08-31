// routes/auth.js
import express from 'express';
import passport from 'passport';
import bcrypt from 'bcrypt';
import { User } from '../models/Users.js';

const router = express.Router();

// Helper: Generate anonName
async function generateAnonName() {
  const count = await User.countDocuments();
  return `anon${String(count + 1).padStart(5, '0')}`;
}

// --- Registration ---
router.post('/register', express.json(), async (req, res) => {
  const { email, password } = req.body;
  console.log("🔐 Registration attempt:", email);

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(409).json({ error: 'User already exists' });
  }

  const saltRounds = 10;
  const hashedPassword = bcrypt.hashSync(password, saltRounds);
  const anonName = await generateAnonName();

  const newUser = new User({
    email,
    passwordHash: hashedPassword,
    anonName,
    membership: 'free',
    lastLogin: new Date()
  });

  await newUser.save();

  req.login(newUser, err => {
    if (err) {
      console.error("⚠️ Login after registration failed:", err);
      return res.status(500).json({ error: 'Login failed after registration' });
    }
    return res.json({ success: true, anonName });
  });
});

// --- Local login ---
router.post('/login', express.json(), passport.authenticate('local'), async (req, res) => {
  // Update last login
  await User.findByIdAndUpdate(req.user._id, { lastLogin: new Date() });
  res.json({ success: true, anonName: req.user.anonName });
});

// --- Google OAuth login ---
router.get('/google', passport.authenticate('google', { scope: ['email', 'profile'] }));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login/login.html' }),
  async (req, res) => {
    // Update last login
    await User.findByIdAndUpdate(req.user._id, { lastLogin: new Date() });
    res.redirect('/auth/success.html');
  }
);

// --- Logout ---
router.post('/logout', (req, res) => {
  req.logout(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  });
});

export default router;