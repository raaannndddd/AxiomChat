import mongoose from 'mongoose';

// models/User.js
const userSchema = new mongoose.Schema({
  email: String,
  passwordHash: String,
  anonName: { type: String, default: function () {
    return `anon${Math.floor(Math.random() * 99999).toString().padStart(5, '0')}`;
  }},
  membership: { type: String, default: 'free' },
  isAdmin: { type: Boolean, default: false },
  lastLogin: Date
});

export const User = mongoose.model('User', userSchema);