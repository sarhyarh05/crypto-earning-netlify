// payout.js – Netlify Function
require('dotenv').config({ path: '../../.env' });
const express = require('express');
const serverless = require('serverless-http');
const User = require('./models/User');
const Vault = require('./models/Vault');
const { protect } = require('./middleware/auth');
const { sendUsdt } = require('./utils/crypto');
const { sendMail } = require('./utils/email');

const app = express();
app.use(express.json({ limit: '1mb' }));

// ----- User requests a payout -----
app.post('/request', protect, async (req, res) => {
  const { amountUsdt, cryptoAddress } = req.body;
  if (!amountUsdt || !cryptoAddress)
    return res.status(400).json({ msg: 'Amount and crypto address required' });

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ msg: 'User not found' });
  if (amountUsdt <= 0) return res.status(400).json({ msg: 'Amount must be >0' });
  if (amountUsdt > user.balance)
    return res.status(400).json({ msg: 'Insufficient earnings' });

  // Notify admin via email
  const adminEmail = process.env.ADMIN_EMAIL;
  const text = `
User ${user.name} (${user.email}) requests a payout:
Amount: ${amountUsdt} USDT
Destination: ${cryptoAddress}
Please approve in the admin vault.
`;
  await sendMail(adminEmail, 'New Payout Request', text);

  // Deduct from user balance (held until admin approves)
  user.balance -= Number(amountUsdt);
  await user.save();

  res.json({ msg: 'Payout request submitted – admin will review.' });
});

// ----- Admin approves and sends funds -----
app.post('/approve/:userId', protect, async (req, res) => {
  const { userId } = req.params;
  const { amountUsdt, cryptoAddress } = req.body;

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ msg: 'User not found' });

  const vault = await Vault.findOne();
  if (!vault) return res.status(500).json({ msg: 'Vault not found' });
  if (amountUsdt > vault.totalUsdt)
    return res.status(400).json({ msg: 'Insufficient vault funds' });

  try {
    const txHash = await sendUsdt(cryptoAddress, Number(amountUsdt));
    vault.totalUsdt -= Number(amountUsdt);
    vault.history.push({
      amount: Number(amountUsdt),
      type: 'payout',
      crypto: 'USDT',
      address: cryptoAddress,
      txHash,
    });
    await vault.save();

    await sendMail(
      user.email,
      'Your Payout Has Been Sent',
      `Your payout of ${amountUsdt} USDT has been processed.\nTx hash: ${txHash}`
    );

    res.json({ msg: 'Payout sent', txHash, newVaultBalance: vault.totalUsdt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Transfer failed' });
  }
});

module.exports.handler = serverless(app);
