/* Simple SPA – login / dashboard / admin views */
const API = '/.netlify/functions';   // Netlify functions are served at this base path

const appDiv = document.getElementById('app');

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || 'Request failed');
  return data;
}

/* ---------- UI helpers ---------- */
function showView(html) { appDiv.innerHTML = html; }
function showMsg(msg, type='success') {
  const el = document.createElement('div');
  el.className = `msg ${type}`;
  el.textContent = msg;
  setTimeout(() => el.remove(), 5000);
  return el;
}

/* ---------- Auth Views ---------- */
function loginView() {
  showView(`
    <div class="container">
      <h1>Login</h1>
      <form id="loginForm">
        <label>Email <input type="email" id="loginEmail" required></label>
        <label>Password <input type="password" id="loginPwd" required></label>
        <button type="submit">Log In</button>
      </form>
      <p>Don’t have an account? <a href="#" id="showRegister">Register</a></p>
    </div>
  `);
  document.getElementById('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const pwd = document.getElementById('loginPwd').value;
    try {
      await fetchJson(`${API}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email, password: pwd }),
      });
      showMsg('Logged in!');
      loadDashboard();
    } catch (err) {
      showMsg(err.message, 'error');
    }
  });
  document.getElementById('showRegister').addEventListener('click', e => {
    e.preventDefault();
    registerView();
  });
}

function registerView() {
  showView(`
    <div class="container">
      <h1>Register</h1>
      <form id="registerForm">
        <label>Name <input type="text" id="regName" required></label>
        <label>Email <input type="email" id="regEmail" required></label>
        <label>Password <input type="password" id="regPwd" required></label>
        <button type="submit">Register</button>
      </form>
      <p>Already have an account? <a href="#" id="showLogin">Login</a></p>
    </div>
  `);
  document.getElementById('registerForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const pwd = document.getElementById('regPwd').value;
    try {
      await fetchJson(`${API}/auth/register`, {
        method: 'POST',
        body: JSON.stringify({ name, email, password: pwd }),
      });
      showMsg('Registered – you can now log in');
      loginView();
    } catch (err) {
      showMsg(err.message, 'error');
    }
  });
  document.getElementById('showLogin').addEventListener('click', e => {
    e.preventDefault();
    loginView();
  });
}

/* ---------- Password Reset Views ---------- */
function forgotView() {
  showView(`
    <div class="container">
      <h1>Forgot Password</h1>
      <form id="forgotForm">
        <label>Email <input type="email" id="forgotEmail" required></label>
        <button type="submit">Send Reset Link</button>
      </form>
      <p><a href="#" id="backToLogin">← Back to Login</a></p>
    </div>
  `);
  document.getElementById('forgotForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value.trim();
    try {
      await fetchJson(`${API}/auth/forgot-password`, {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      showMsg('If an account exists, a reset link has been emailed.');
    } catch (err) {
      showMsg(err.message, 'error');
    }
  });
  document.getElementById('backToLogin').addEventListener('click', e => {
    e.preventDefault();
    loginView();
  });
}

function resetView() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  if (!token) {
    showView('<p>Invalid or missing token.</p>');
    return;
  }
  showView(`
    <div class="container">
      <h1>Reset Password</h1>
      <form id="resetForm">
        <label>New Password <input type="password" id="newPwd" required></label>
        <label>Confirm Password <input type="password" id="confirmPwd" required></label>
        <button type="submit">Reset Password</button>
      </form>
      <p><a href="#" id="toLogin">← Back to Login</a></p>
    </div>
  `);
  document.getElementById('resetForm').addEventListener('submit', async e => {
    e.preventDefault();
    const pwd = document.getElementById('newPwd').value;
    const confirm = document.getElementById('confirmPwd').value;
    if (pwd !== confirm) return showMsg('Passwords do not match', 'error');
    try {
      await fetchJson(`${API}/auth/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ token, password: pwd }),
      });
      showMsg('Password reset – you can now log in');
      setTimeout(() => { window.location.search = ''; loginView(); }, 1500);
    } catch (err) {
      showMsg(err.message, 'error');
    }
  });
  document.getElementById('toLogin').addEventListener('click', e => {
    e.preventDefault();
    window.location.search = '';
    loginView();
  });
}

/* ---------- Dashboard Views ---------- */
async function loadDashboard() {
  try {
    const user = await fetchJson(`${API}/auth/me`);
    const isAdmin = user.role === 'admin';
    if (isAdmin) adminDashboard(user);
    else userDashboard(user);
  } catch (err) {
    loginView();
  }
}

/* ---- User Dashboard ---- */
function userDashboard(user) {
  showView(`
    <div class="container">
      <h1>Welcome, ${user.name}</h1>
      <div class="dashboard">
        <div class="card">
          <h2>Your Earnings</h2>
          <p class="balance" id="balance">Loading…</p>
          <p>USDT‑equivalent</p>
        </div>
        <div class="card">
          <h2>Request Payout</h2>
          <form id="payoutForm">
            <label>Amount (USDT) <input type="number" id="payoutAmt" min="0.01" step="0.01" required></label>
            <label>Crypto Address (USDT‑ERC20) <input type="text" id="payoutAddr" placeholder="0x…" required></label>
            <button type="submit">Request Payout</button>
          </form>
        </div>
      </div>
      <p><a href="#" id="logoutBtn">Logout</a></p>
    </div>
  `);
  // load balance
  fetchJson(`${API}/auth/me`).then(u => {
    document.getElementById('balance').textContent = u.balance.toFixed(2);
  });
  // payout request
  document.getElementById('payoutForm').addEventListener('submit', async e => {
    e.preventDefault();
    const amt = parseFloat(document.getElementById('payoutAmt').value);
    const addr = document.getElementById('payoutAddr').value.trim();
    try {
      await fetchJson(`${API}/payout/request`, {
        method: 'POST',
        body: JSON.stringify({ amountUsdt: amt, cryptoAddress: addr }),
      });
      showMsg('Payout request submitted – admin will review.');
      fetchJson(`${API}/auth/me`).then(u => {
        document.getElementById('balance').textContent = u.balance.toFixed(2);
      });
    } catch (err) {
      showMsg(err.message, 'error');
    }
  });
  document.getElementById('logoutBtn').addEventListener('click', async e => {
    e.preventDefault();
    await fetchJson(`${API}/auth/logout`, { method: 'POST' });
    loginView();
  });
}

/* ---- Admin Dashboard ---- */
async function adminDashboard(user) {
  const vault = await fetchJson(`${API}/vault/balance`, { method: 'GET' });
  showView(`
    <div class="container">
      <h1>Admin Panel – ${user.name}</h1>
      <div class="dashboard">
        <div class="card">
          <h2>Vault Balance</h2>
          <p class="balance" id="vaultBal">${vault.totalUsdt.toFixed(2)} USDT</p>
        </div>
        <div class="card">
          <h2>Withdraw USDT</h2>
          <form id="withdrawForm">
            <label>Amount (USDT) <input type="number" id="wdAmt" min="0.01" step="0.01" required></label>
            <label>Destination Address <input type="text" id="wdAddr" placeholder="0x…" required></label>
            <button type="submit">Withdraw</button>
          </form>
        </div>
        <div class="card">
          <h2>Convert to Crypto</h2>
          <form id="convertForm">
            <label>Amount (USDT) <input type="number" id="cnvAmt" min="0.01" step="0.01" required></label>
            <label>Target Crypto (symbol) <input type="text" id="cnvCrypto" placeholder="ETH, BTC, BNB…" required></label>
            <button type="submit">Convert</button>
          </form>
        </div>
        <div class="card">
          <h2>Create Coinbase Checkout (Fiat‑to‑Crypto)</h2>
          <form id="checkoutForm">
            <label>Amount (USDT) <input type="number" id="chkAmt" min="0.01" step="0.01" required></label>
            <label>Desired Crypto (symbol) <input type="text" id="chkCrypto" placeholder="ETH, BTC…" required></label>
            <button type="submit">Create Checkout</button>
          </form>
          <p id="checkoutResult"></p>
        </div>
      </div>
      <p><a href="#" id="adminLogout">Logout</a></p>
    </div>
  `);
  // withdraw
  document.getElementById('withdrawForm').addEventListener('submit', async e => {
    e.preventDefault();
    const amt = parseFloat(document.getElementById('wdAmt').value);
    const addr = document.getElementById('wdAddr').value.trim();
    try {
      const res = await fetchJson(`${API}/vault/withdraw`, {
        method: 'POST',
        body: JSON.stringify({ amountUsdt: amt, toAddress: addr }),
      });
      showMsg(`Sent! Tx: ${res.txHash}`);
      document.getElementById('vaultBal').textContent = res.newBalance.toFixed(2) + ' USDT';
    } catch (err) {
      showMsg(err.message, 'error');
    }
  });
  // convert
  document.getElementById('convertForm').addEventListener('submit', async e => {
    e.preventDefault();
    const amt = parseFloat(document.getElementById('cnvAmt').value);
    const crypto = document.getElementById('cnvCrypto').value.toUpperCase().trim();
    try {
      const res = await fetchJson(`${API}/vault/convert`, {
        method: 'POST',
        body: JSON.stringify({ amountUsdt: amt, targetCrypto: crypto }),
      });
      showMsg(res.msg);
      document.getElementById('vaultBal').textContent = res.newBalance.toFixed(2) + ' USDT';
    } catch (err) {
      showMsg(err.message, 'error');
    }
  });
  // checkout
  document.getElementById('checkoutForm').addEventListener('submit', async e => {
    e.preventDefault();
    const amt = parseFloat(document.getElementById('chkAmt').value);
    const crypto = document.getElementById('chkCrypto').value.toUpperCase().trim();
    try {
      const res = await fetchJson(`${API}/vault/checkout`, {
        method: 'POST',
        body: JSON.stringify({ amountUsdt: amt, cryptoCode: crypto }),
      });
      document.getElementById('checkoutResult').innerHTML = `
        <a href="${res.checkoutUrl}" target="_blank" rel="noopener">
          Open Coinbase Checkout (pay ${amt} USDT → receive ${crypto})
        </a>
      `;
    } catch (err) {
      showMsg(err.message, 'error');
    }
  });
  document.getElementById('adminLogout').addEventListener('click', async e => {
    e.preventDefault();
    await fetchJson(`${API}/auth/logout`, { method: 'POST' });
    loginView();
  });
}

/* ---------- Router based on URL hash ---------- */
function route() {
  const hash = location.hash.slice(1) || 'login';
  if (hash === 'login') loginView();
  else if (hash === 'register') registerView();
  else if (hash === 'forgot') forgotView();
  else if (hash === 'reset') resetView();
  else loadDashboard();
}
window.addEventListener('hashchange', route);
window.addEventListener('load', route);
