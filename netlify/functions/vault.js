// vault.js – Netlify Function
require('dotenv').config({ path: '../../.env' });
const express = require('express');
const serverless = require('serverless-http');
const Vault = require('./models/Vault');
const { protect, adminOnly } = require('./middleware/auth');
const { sendUsdt, usdtToCrypto, createCryptoCheckout } = require('./utils/crypto');

const app = express();
app.use(express.json({ limit: '1mb' }));

// ----- Get vault balance (admin only) -----
app.get('/balance', protect, adminOnly, async (req, res) => {
  const vault = await Vault.findOne();
  if (!vault) return res.status(404).json({ msg: 'Vault not found' });
  res.json({ totalUsdt: vault.totalUsdt });
});

// ----- Withdraw USDT (admin only) -----
app.post('/withdraw', protect, adminOnly, async (req, res) => {
  const { amountUsdt, toAddress } = req.body;
  if (!amountUsdt || !toAddress)
    return res.status(400).json({ msg: 'Amount and destination address required' });

  const vault = await Vault.findOne();
  if (!vault) return res.status(500).json({ msg: 'Vault error' });
  if (amountUsdt > vault.totalUsdt)
    return res.status(400).json({ msg: 'Insufficient vault funds' });

  try {
    const txHash = await sendUsdt(toAddress, amountUsdt);
    vault.totalUsdt -= Number(amountUsdt);
    vault.history.push({
      amount: Number(amountUsdt),
      type: 'withdraw',
      crypto: 'USDT',
      address: toAddress,
      txHash,
    });
    await vault.save();
    res.json({ msg: 'USDT sent', txHash, newBalance: vault.totalUsdt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Transfer failed' });
  }
});

// ----- Convert USDT → Crypto (admin only) -----
app.post('/convert', protect, adminOnly, async (req, res) => {
  const { amountUsdt, targetCrypto } = req.body;
  if (!amountUsdt || !targetCrypto)
    return res.status(400).json({ msg: 'Amount and target crypto required' });

  const vault = await Vault.findOne();
  if (!vault) return res.status(500).json({ msg: 'Vault error' });
  if (amountUsdt > vault.totalUsdt)
    return res.status(400).json({ msg: 'Insufficient vault funds' });

  try {
    const cryptoAmount = await usdtToCrypto(Number(amountUsdt), targetCrypto);
    vault.totalUsdt -= Number(amountUsdt);
    vault.history.push({
      amount: Number(amountUsdt),
      type: 'convert',
      crypto: targetCrypto,
      address: 'N/A (internal conversion)',
      txHash: 'N/A',
    });
    await vault.save();

    res.json({
      msg: `Converted ${amountUsdt} USDT → ${cryptoAmount.toFixed(6)} ${targetCrypto}`,
      newBalance: vault.totalUsdt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Conversion failed' });
  }
});

// ----- Create Coinbase Checkout (admin only) -----
app.post('/checkout', protect, adminOnly, async (req, res) => {
  const { amountUsdt, cryptoCode } = req.body;
  if (!amountUsdt || !cryptoCode)
    return res.status(400).json({ msg: 'Amount and crypto code required' });

  try {
    const checkout = await createCryptoCheckout(Number(amountUsdt), cryptoCode);
    res.json({ checkoutUrl: checkout.hosted_url, chargeId: checkout.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Checkout creation failed' });
  }
});

module.exports.handler = serverless(app);
