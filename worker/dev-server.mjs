// 本地开发模拟服务器 - 用于 WSL1 环境测试
import http from 'http';

// Base32 解码
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(input) {
  const cleaned = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  const bits = [];
  for (const char of cleaned) {
    const val = BASE32_CHARS.indexOf(char);
    if (val === -1) continue;
    for (let i = 4; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | bits[i + j];
    }
    bytes.push(byte);
  }
  return Buffer.from(bytes);
}

// HMAC-SHA1
import crypto from 'crypto';
function hmacSha1(key, message) {
  return crypto.createHmac('sha1', key).update(message).digest();
}

// TOTP 生成
function generateTOTP(secret, digits = 6, period = 30) {
  const time = Math.floor(Date.now() / 1000);
  const counter = Math.floor(time / period);

  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigInt64BE(BigInt(counter));

  const key = base32Decode(secret);
  const hmac = hmacSha1(key, counterBytes);

  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) |
               ((hmac[offset + 1] & 0xff) << 16) |
               ((hmac[offset + 2] & 0xff) << 8) |
               (hmac[offset + 3] & 0xff);

  const otp = code % Math.pow(10, digits);
  return otp.toString().padStart(digits, '0');
}

function getRemaining(period = 30) {
  return period - (Math.floor(Date.now() / 1000) % period);
}

// 简单 JWT
function createJWT(secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret)
    .update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function verifyJWT(token, secret) {
  try {
    const [header, payload, signature] = token.split('.');
    const expected = crypto.createHmac('sha256', secret)
      .update(`${header}.${payload}`).digest('base64url');
    if (signature !== expected) return false;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Math.floor(Date.now() / 1000);
  } catch { return false; }
}

// 模拟 KV 存储
let kvData = {
  accounts: [
    {
      id: 'demo-1',
      name: 'Demo Account',
      issuer: 'Google',
      secret: 'JBSWY3DPEHPK3PXP',
      digits: 6,
      period: 30,
      order: 0
    }
  ]
};

const ADMIN_PASSWORD = 'admin123';
const JWT_SECRET = 'dev-secret';

// HTTP 服务器
const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  // 解析 body
  let body = '';
  for await (const chunk of req) body += chunk;
  const json = body ? JSON.parse(body) : {};

  // 认证检查
  const authHeader = req.headers.authorization;
  const isAuthed = authHeader?.startsWith('Bearer ') &&
                   verifyJWT(authHeader.slice(7), JWT_SECRET);

  res.setHeader('Content-Type', 'application/json');

  // 路由
  if (path === '/api/accounts' && req.method === 'GET') {
    const accounts = kvData.accounts.map(acc => ({
      ...acc,
      code: generateTOTP(acc.secret, acc.digits, acc.period),
      remaining: getRemaining(acc.period)
    }));
    res.end(JSON.stringify({ accounts }));
  }
  else if (path === '/api/admin/login' && req.method === 'POST') {
    if (json.password === ADMIN_PASSWORD) {
      res.end(JSON.stringify({ token: createJWT(JWT_SECRET) }));
    } else {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Invalid password' }));
    }
  }
  else if (path === '/api/admin/accounts' && req.method === 'GET') {
    if (!isAuthed) { res.writeHead(401); res.end(JSON.stringify({ error: 'Unauthorized' })); return; }
    res.end(JSON.stringify({ accounts: kvData.accounts }));
  }
  else if (path === '/api/admin/accounts' && req.method === 'POST') {
    if (!isAuthed) { res.writeHead(401); res.end(JSON.stringify({ error: 'Unauthorized' })); return; }
    const account = {
      id: crypto.randomUUID(),
      name: json.name,
      issuer: json.issuer || '',
      secret: json.secret.replace(/\s/g, '').toUpperCase(),
      digits: json.digits || 6,
      period: json.period || 30,
      order: kvData.accounts.length
    };
    kvData.accounts.push(account);
    res.writeHead(201);
    res.end(JSON.stringify({ account }));
  }
  else if (path.startsWith('/api/admin/accounts/') && req.method === 'PUT') {
    if (!isAuthed) { res.writeHead(401); res.end(JSON.stringify({ error: 'Unauthorized' })); return; }
    const id = path.split('/').pop();
    if (id === 'reorder') {
      const reordered = [];
      for (let i = 0; i < json.ids.length; i++) {
        const acc = kvData.accounts.find(a => a.id === json.ids[i]);
        if (acc) { acc.order = i; reordered.push(acc); }
      }
      kvData.accounts = reordered;
      res.end(JSON.stringify({ success: true }));
    } else {
      const idx = kvData.accounts.findIndex(a => a.id === id);
      if (idx === -1) { res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' })); return; }
      kvData.accounts[idx] = { ...kvData.accounts[idx], ...json, id };
      if (json.secret) kvData.accounts[idx].secret = json.secret.replace(/\s/g, '').toUpperCase();
      res.end(JSON.stringify({ account: kvData.accounts[idx] }));
    }
  }
  else if (path.startsWith('/api/admin/accounts/') && req.method === 'DELETE') {
    if (!isAuthed) { res.writeHead(401); res.end(JSON.stringify({ error: 'Unauthorized' })); return; }
    const id = path.split('/').pop();
    kvData.accounts = kvData.accounts.filter(a => a.id !== id);
    kvData.accounts.forEach((a, i) => a.order = i);
    res.end(JSON.stringify({ success: true }));
  }
  else if (path === '/api/health') {
    res.end(JSON.stringify({ status: 'ok' }));
  }
  else if (path === '/') {
    res.end(JSON.stringify({
      message: '2FA API Server',
      endpoints: {
        accounts: '/api/accounts',
        health: '/api/health'
      },
      frontend: 'http://localhost:5173'
    }));
  }
  else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(8787, () => {
  console.log('Mock API server running at http://localhost:8787');
  console.log('Admin password: admin123');
  console.log('Demo account with secret: JBSWY3DPEHPK3PXP');
});
