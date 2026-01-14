import { Hono } from 'hono';
import type { Account, AccountWithCode, Env } from '../types';
import { generateTOTP, getRemaining } from '../utils/totp';

const accounts = new Hono<{ Bindings: Env }>();

// 获取所有账号及其验证码
accounts.get('/', async (c) => {
  const data = await c.env.KV.get('accounts', 'json') as { accounts: Account[] } | null;
  const accountList = data?.accounts ?? [];

  // 按 order 排序
  accountList.sort((a, b) => a.order - b.order);

  // 为每个账号生成验证码
  const accountsWithCodes: AccountWithCode[] = await Promise.all(
    accountList.map(async (account) => ({
      ...account,
      code: await generateTOTP(account.secret, account.digits, account.period),
      remaining: getRemaining(account.period),
    }))
  );

  return c.json({ accounts: accountsWithCodes });
});

export default accounts;
