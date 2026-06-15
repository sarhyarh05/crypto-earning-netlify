const mongoose = require('mongoose');

const vaultSchema = new mongoose.Schema({
  totalUsdt: { type: Number, default: 10000 }, // $10 000 USDT‑equivalent
  history: [
    {
      amount: Number,
      type: String, // 'deposit' | 'withdraw' | 'convert'
      crypto: String,
      address: String,
      txHash: String,
      timestamp: { type: Date, default: Date.now },
    },
  ],
});

module.exports = mongoose.model('Vault', vaultSchema);
