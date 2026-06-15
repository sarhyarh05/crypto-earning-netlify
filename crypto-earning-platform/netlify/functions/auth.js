// auth.js – Netlify Function
require('dotenv').config({ path: '../../.env' });
const express = require('express');
const serverless = require('serverless-http');
const User = require('./models/User');
const jwt = require('jsonwebtoken');
const { sendMail } = require('./utils/email');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '1mb' }));

// ----- Helper: protect middleware -----
const protect = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ msg: 'No token, auth denied' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token invalid' });
  }
};

// ----- Register -----
app.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name)
    return res.status(400).json({ msg: 'All fields required' });

  let user = await User.findOne({ email });
  if (user) return res.status(400).json({ msg: 'User already exists' });

  user = new User({ email, password, name });
  await user.save();

  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({ msg: 'Registered & logged in', user: { id: user._id, email, name, role: user.role } });
});

// ----- Login -----
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ msg: 'Invalid credentials' });
  const match = await user.matchPassword(password);
  if (!match) return res.status(400).json({ msg: 'Invalid credentials' });

  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({ msg: 'Logged in', user: { id: user._id, email, name: user.name, role: user.role } });
});

// ----- Logout -----
app.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ msg: 'Logged out' });
});

// ----- Forgot Password -----
app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ msg: 'No account with that email' });

  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  user.resetToken = hashedToken;
  user.resetExpires = Date.now() + 10 * 60 * 1000; // 10 min
  await user.save();

  const resetUrl = `${process.env.BASE_URL}/reset-password?token=${resetToken}`;
  const text = `You requested a password reset. Click this link (expires in 10 min):\n${resetUrl}\nIf you didn’t request this, ignore this email.`;

  await sendMail(email, 'Password Reset Request', text);
  res.json({ msg: 'If an account exists, a reset link has been emailed.' });
});

// ----- Reset Password -----
app.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ msg: 'Missing fields' });

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    resetToken: hashedToken,
    resetExpires: { $gt: Date.now() },
  });

  if (!user) return res.status(400).json({ msg: 'Invalid or expired token' });

  user.password = password;
  user.resetToken = undefined;
  user.resetExpires = undefined;
  await user.save();

  res.json({ msg: 'Password reset successful – you can now log in.' });
});

// ----- Me (protected) -----
app.get('/me', protect, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    role: req.user.role,
  });
});

// Export as Netlify function
module.exports.handler = serverless(app);
