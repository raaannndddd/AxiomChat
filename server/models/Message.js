// import mongoose from 'mongoose';

// const userSchema = new mongoose.Schema({
//   email: String,
//   passwordHash: String,
//   membership: { type: String, default: 'free' }, // free | pro | premium
//   isAdmin: { type: Boolean, default: false },
//   lastLogin: Date
// });

// export const User = mongoose.model('User', userSchema);
// server/models/Message.js
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  username: String,
  room: String,
  message: String,
  createdAt: { type: Date, default: Date.now }
});

export const Message = mongoose.model('Message', messageSchema);
