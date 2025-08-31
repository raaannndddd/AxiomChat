import mongoose from 'mongoose';

const monitoredCoinSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  coinId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const MonitoredCoin = mongoose.model('MonitoredCoin', monitoredCoinSchema);