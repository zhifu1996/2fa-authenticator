import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import accounts from './routes/accounts';
import admin from './routes/admin';

const app = new Hono<{ Bindings: Env }>();

// CORS 配置
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// API 路由
app.route('/api/accounts', accounts);
app.route('/api/admin', admin);

// 健康检查
app.get('/api/health', (c) => c.json({ status: 'ok' }));

export default app;
