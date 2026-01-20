// KV 存储工具函数

import type { Account, Env } from '../types';

interface AccountsData {
  accounts: Account[];
}

/**
 * 获取所有账户
 */
export async function getAccounts(kv: KVNamespace): Promise<Account[]> {
  const data = await kv.get('accounts', 'json') as AccountsData | null;
  return data?.accounts ?? [];
}

/**
 * 保存所有账户
 */
export async function saveAccounts(kv: KVNamespace, accounts: Account[]): Promise<void> {
  await kv.put('accounts', JSON.stringify({ accounts }));
}

/**
 * 根据 ID 查找账户
 */
export function findAccountById(accounts: Account[], id: string): Account | undefined {
  return accounts.find(a => a.id === id);
}

/**
 * 根据 ID 查找账户索引
 */
export function findAccountIndexById(accounts: Account[], id: string): number {
  return accounts.findIndex(a => a.id === id);
}

/**
 * 重新计算账户顺序
 */
export function reorderAccounts(accounts: Account[]): Account[] {
  return accounts.map((account, index) => ({
    ...account,
    order: index,
  }));
}

/**
 * 构建账户名称集合（用于去重检查）
 */
export function buildNameSet(accounts: Account[]): Set<string> {
  return new Set(accounts.map(a => a.name.toLowerCase()));
}
