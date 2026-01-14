export interface Account {
  id: string;
  name: string;
  issuer: string;
  secret: string;
  digits: number;
  period: number;
  order: number;
}

export interface AccountWithCode extends Account {
  code: string;
  remaining: number;
}

export interface Env {
  KV: KVNamespace;
  ADMIN_PASSWORD: string;
  JWT_SECRET: string;
}
