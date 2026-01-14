# 2FA 验证码共享工具

基于 Cloudflare Worker 的 TOTP 验证码生成器，供团队内部共享使用。

## 功能特性

- **无需登录** - 普通用户可直接查看验证码
- **管理后台** - 管理员通过密码登录，管理账号
- **实时刷新** - 验证码自动刷新，带圆环倒计时
- **临时查询** - 支持临时输入密钥获取验证码
- **一键复制** - 点击即可复制验证码
- **兼容主流应用** - 支持 Google、GitHub、AWS 等标准 TOTP

## 一键部署

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/zhifu1996/2fa-authenticator)

### 部署步骤

1. 点击上方按钮，授权 Cloudflare 访问你的 GitHub
2. 选择你的 Cloudflare 账号
3. 部署完成后，在 Cloudflare Dashboard 中：
   - 进入 Workers & Pages > 2fa-worker > Settings > Variables
   - 添加以下 Secrets：
     - `ADMIN_PASSWORD`: 管理员密码
     - `JWT_SECRET`: JWT 密钥（可使用随机字符串）
   - 进入 KV > 创建一个 namespace，绑定到 Worker

## 手动部署

### 前置要求

- Node.js >= 18
- Cloudflare 账号

### 1. 克隆项目

```bash
git clone https://github.com/zhifu1996/2fa-authenticator.git
cd 2fa-authenticator
```

### 2. 部署 Worker (API)

```bash
cd worker
npm install

# 登录 Cloudflare
npx wrangler login

# 创建 KV namespace
npx wrangler kv:namespace create "2FA_KV"
# 将输出的 id 填入 wrangler.toml

# 设置密码
echo "你的密码" | npx wrangler secret put ADMIN_PASSWORD
openssl rand -hex 32 | npx wrangler secret put JWT_SECRET

# 部署
npm run deploy
```

### 3. 部署前端

```bash
cd web
npm install

# 修改 src/utils/api.ts 中的 API 地址为你的 Worker 地址
# 构建
npm run build

# 部署到 Cloudflare Pages
npx wrangler pages project create 2fa-web --production-branch main
npx wrangler pages deploy dist --project-name 2fa-web
```

## 本地开发

```bash
# 终端 1: 启动 API 服务器
cd worker
node dev-server.mjs

# 终端 2: 启动前端
cd web
npm run dev
```

访问 http://localhost:5173，默认管理员密码：`admin123`

## 技术栈

- **后端**: Cloudflare Worker + Hono
- **存储**: Cloudflare KV
- **前端**: Vue 3 + Vite + Tailwind CSS
- **认证**: JWT

## 项目结构

```
2fa/
├── worker/                 # Cloudflare Worker API
│   ├── src/
│   │   ├── index.ts       # 主入口
│   │   ├── routes/        # API 路由
│   │   └── utils/         # TOTP、JWT 工具
│   └── wrangler.toml      # Worker 配置
├── web/                    # Vue 3 前端
│   ├── src/
│   │   ├── views/         # 页面组件
│   │   ├── components/    # 通用组件
│   │   └── utils/         # API、TOTP 工具
│   └── vite.config.ts
└── README.md
```

## 使用说明

### 查看验证码
1. 打开网站首页
2. 查看账号列表中的验证码
3. 点击复制按钮复制验证码

### 临时查询
1. 在页面底部输入 Base32 密钥
2. 点击"获取验证码"
3. 验证码会自动刷新

### 管理账号
1. 点击右上角"管理"
2. 输入管理员密码登录
3. 可添加、编辑、删除、排序账号

## 安全说明

- 管理员密码通过 Cloudflare Secrets 存储，不会出现在代码中
- JWT 有效期 24 小时
- 建议配合 Cloudflare Access 使用，限制访问来源

## License

MIT
