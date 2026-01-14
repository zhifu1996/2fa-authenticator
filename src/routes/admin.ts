import { Hono } from 'hono';
import type { Account, Env } from '../types';
import { createJWT, verifyJWT } from '../utils/auth';

const admin = new Hono<{ Bindings: Env }>();

// JWT 认证中间件
const authMiddleware = async (c: any, next: () => Promise<void>) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const valid = await verifyJWT(token, c.env.JWT_SECRET);
  if (!valid) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  await next();
};

// 管理员登录
admin.post('/login', async (c) => {
  const body = await c.req.json<{ password: string }>();

  if (body.password !== c.env.ADMIN_PASSWORD) {
    return c.json({ error: 'Invalid password' }, 401);
  }

  const token = await createJWT(c.env.JWT_SECRET);
  return c.json({ token });
});

// 获取账号列表（管理用，包含 secret）
admin.get('/accounts', authMiddleware, async (c) => {
  const data = await c.env.KV.get('accounts', 'json') as { accounts: Account[] } | null;
  const accounts = data?.accounts ?? [];
  accounts.sort((a, b) => a.order - b.order);
  return c.json({ accounts });
});

// 新增账号
admin.post('/accounts', authMiddleware, async (c) => {
  const body = await c.req.json<Omit<Account, 'id' | 'order'>>();

  const data = await c.env.KV.get('accounts', 'json') as { accounts: Account[] } | null;
  const accounts = data?.accounts ?? [];

  const newAccount: Account = {
    id: crypto.randomUUID(),
    name: body.name,
    issuer: body.issuer || '',
    secret: body.secret.replace(/\s/g, '').toUpperCase(),
    digits: body.digits || 6,
    period: body.period || 30,
    order: accounts.length,
  };

  accounts.push(newAccount);
  await c.env.KV.put('accounts', JSON.stringify({ accounts }));

  return c.json({ account: newAccount }, 201);
});

// 编辑账号
admin.put('/accounts/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<Partial<Omit<Account, 'id'>>>();

  const data = await c.env.KV.get('accounts', 'json') as { accounts: Account[] } | null;
  const accounts = data?.accounts ?? [];

  const index = accounts.findIndex((a) => a.id === id);
  if (index === -1) {
    return c.json({ error: 'Account not found' }, 404);
  }

  accounts[index] = {
    ...accounts[index],
    ...body,
    id, // 保持 id 不变
    secret: body.secret ? body.secret.replace(/\s/g, '').toUpperCase() : accounts[index].secret,
  };

  await c.env.KV.put('accounts', JSON.stringify({ accounts }));

  return c.json({ account: accounts[index] });
});

// 删除账号
admin.delete('/accounts/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');

  const data = await c.env.KV.get('accounts', 'json') as { accounts: Account[] } | null;
  let accounts = data?.accounts ?? [];

  const index = accounts.findIndex((a) => a.id === id);
  if (index === -1) {
    return c.json({ error: 'Account not found' }, 404);
  }

  accounts = accounts.filter((a) => a.id !== id);

  // 重新排序
  accounts.forEach((a, i) => {
    a.order = i;
  });

  await c.env.KV.put('accounts', JSON.stringify({ accounts }));

  return c.json({ success: true });
});

// 重新排序
admin.put('/accounts/reorder', authMiddleware, async (c) => {
  const body = await c.req.json<{ ids: string[] }>();

  const data = await c.env.KV.get('accounts', 'json') as { accounts: Account[] } | null;
  const accounts = data?.accounts ?? [];

  // 根据提供的 id 顺序重新排序
  const reordered: Account[] = [];
  for (let i = 0; i < body.ids.length; i++) {
    const account = accounts.find((a) => a.id === body.ids[i]);
    if (account) {
      account.order = i;
      reordered.push(account);
    }
  }

  await c.env.KV.put('accounts', JSON.stringify({ accounts: reordered }));

  return c.json({ success: true });
});

export default admin;
