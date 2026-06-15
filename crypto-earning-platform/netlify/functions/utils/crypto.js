require('dotenv').config({ path: '../../.env' });
const { ethers } = require('ethers');
const axios = require('axios');
const CoinbaseCommerce = require('coinbase-commerce-node');

CoinbaseCommerce.Client.init(process.env.COINBASE_COMMERCE_API_KEY);

const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC);
const adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);

// ----- Helper: USDT price in USD -----
async function getUsdtPriceUsd() {
  const res = await axios.get(
    'https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd'
  );
  return res.data.tether.usd; // ≈ 1
}

// ----- Convert USDT → target crypto (using CoinGecko) -----
async function usdtToCrypto(usdtAmount, targetSymbol) {
  const usdtPrice = await getUsdtPriceUsd(); // USDT ≈ 1 USD
  const usdValue = usdtAmount * usdtPrice;

  const res = await axios.get(
    `https://api.coingecko.com/api/v3/simple/price?ids=${targetSymbol.toLowerCase()}&vs_currencies=usd`
  );
  const coinPriceUsd = res.data[targetSymbol.toLowerCase()].usd;
  const cryptoAmount = usdValue / coinPriceUsd;
  return cryptoAmount;
}

// ----- Send USDT (ERC‑20) from admin wallet -----
async function sendUsdt(toAddress, amountUsdt) {
  const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
  const usdtAbi = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function decimals() view returns (uint8)',
  ];
  const usdtContract = new ethers.Contract(USDT_ADDRESS, usdtAbi, adminWallet);

  const decimals = await usdtContract.decimals();
  const amountWei = ethers.parseUnits(amountUsdt.toString(), decimals);

  const tx = await usdtContract.transfer(toAddress, amountWei);
  const receipt = await tx.wait();
  return receipt.hash;
}

// ----- Create Coinbase Commerce checkout (fiat‑to‑crypto) -----
async function createCryptoCheckout(amountUsdt, cryptoCode) {
  const usdtPrice = await getUsdtPriceUsd();
  const usdAmount = amountUsdt * usdtPrice; // USDT ≈ USD

  const charge = await CoinbaseCommerce.Charge.create({
    name: `Vault Crypto Purchase – ${cryptoCode}`,
    description: `Buy ${cryptoCode} using vault USDT balance`,
    local_price: {
      amount: usdAmount.toFixed(2),
      currency: 'USD',
    },
    pricing_type: 'fixed_price',
    metadata: {
      vault_id: process.env.VAULT_ID || 'default',
    },
    redirect_url: process.env.BASE_URL + '/admin/checkout-success',
    cancel_url: process.env.BASE_URL + '/admin/checkout-cancel',
  });

  return { hosted_url: charge.hosted_url, id: charge.id };
}

module.exports = {
  sendUsdt,
  usdtToCrypto,
  createCryptoCheckout,
};
