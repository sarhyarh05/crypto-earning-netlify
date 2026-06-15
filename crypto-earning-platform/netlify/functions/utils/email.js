const nodemailer = require('nodemailer');
require('dotenv').config({ path: '../../.env' });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendMail = async (to, subject, text) => {
  await transporter.sendMail({
    from: `"Crypto Earning" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
  });
};

module.exports = { sendMail };
