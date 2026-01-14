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

// 批量删除账号
admin.post('/accounts/batch-delete', authMiddleware, async (c) => {
  const body = await c.req.json<{ ids: string[] }>();

  const data = await c.env.KV.get('accounts', 'json') as { accounts: Account[] } | null;
  let accounts = data?.accounts ?? [];

  const deleteSet = new Set(body.ids);
  const deletedCount = accounts.filter((a) => deleteSet.has(a.id)).length;
  accounts = accounts.filter((a) => !deleteSet.has(a.id));

  // 重新排序
  accounts.forEach((a, i) => {
    a.order = i;
  });

  await c.env.KV.put('accounts', JSON.stringify({ accounts }));

  return c.json({ deleted: deletedCount });
});

// 验证 Base32 格式
function isValidBase32(str: string): boolean {
  if (!str || str.length < 8) return false;
  // Base32 只包含 A-Z 和 2-7
  return /^[A-Z2-7]+=*$/.test(str.toUpperCase());
}

// 批量导入账号
admin.post('/accounts/import', authMiddleware, async (c) => {
  const body = await c.req.json<{ content: string }>();

  const lines = body.content.split('\n').filter((line) => line.trim());
  const importedAccounts: Account[] = [];
  let skippedCount = 0;
  const duplicates: string[] = [];

  const data = await c.env.KV.get('accounts', 'json') as { accounts: Account[] } | null;
  const accounts = data?.accounts ?? [];
  let currentOrder = accounts.length;

  // 构建已存在账号的 name 集合用于去重
  const existingNames = new Set(accounts.map((a) => a.name.toLowerCase()));

  for (const line of lines) {
    // 自动检测分隔符：Tab > 竖线 > 逗号
    let separator = ',';
    if (line.includes('\t')) {
      separator = '\t';
    } else if (line.includes('|')) {
      separator = '|';
    }

    const parts = line.split(separator).map((p) => p.trim()).filter((p) => p);

    // 支持多种格式：
    // 4列: 序号, name, issuer, secret
    // 3列: name, issuer, secret (无序号)
    let name: string, issuer: string, secret: string;

    if (parts.length >= 4) {
      // 检查第一列是否为数字（序号）
      if (/^\d+$/.test(parts[0])) {
        [, name, issuer, secret] = parts;
      } else {
        [name, issuer, secret] = parts;
      }
    } else if (parts.length === 3) {
      [name, issuer, secret] = parts;
    } else {
      skippedCount++;
      continue;
    }

    // 验证必填字段和 secret 格式
    if (!name || !secret) {
      skippedCount++;
      continue;
    }

    const cleanSecret = secret.replace(/\s/g, '').toUpperCase();
    if (!isValidBase32(cleanSecret)) {
      skippedCount++;
      continue;
    }

    // 检查重复
    if (existingNames.has(name.toLowerCase())) {
      duplicates.push(name);
      continue;
    }

    const newAccount: Account = {
      id: crypto.randomUUID(),
      name,
      issuer: issuer || '',
      secret: cleanSecret,
      digits: 6,
      period: 30,
      order: currentOrder++,
    };

    accounts.push(newAccount);
    importedAccounts.push(newAccount);
    existingNames.add(name.toLowerCase());
  }

  await c.env.KV.put('accounts', JSON.stringify({ accounts }));

  return c.json({
    imported: importedAccounts.length,
    skipped: skippedCount,
    duplicates,
    accounts: importedAccounts,
  }, 201);
});

// 导出账号
admin.get('/accounts/export', authMiddleware, async (c) => {
  const data = await c.env.KV.get('accounts', 'json') as { accounts: Account[] } | null;
  const accounts = data?.accounts ?? [];
  accounts.sort((a, b) => a.order - b.order);

  // 生成 TSV 格式（Tab 分隔）
  const header = 'No\tname\tissuer\tsecret';
  const rows = accounts.map((acc, index) =>
    `${index + 1}\t${acc.name}\t${acc.issuer}\t${acc.secret}`
  );

  return c.json({
    accounts,
    tsv: [header, ...rows].join('\n'),
  });
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
