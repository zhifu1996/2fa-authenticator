# 2FA 验证码共享工具

基于 Cloudflare Worker 的 TOTP 验证码生成器，供团队内部共享使用。

## 功能特性

- **公开/隐私分组** - 账号可设置为公开或隐私，未登录仅显示公开账号
- **管理后台** - 管理员通过密码登录，管理账号
- **扫码添加** - 支持扫描二维码自动识别 otpauth:// URI 添加账号
- **分组显示** - 按 Issuer 分组，组内按名称排序
- **实时刷新** - 验证码自动刷新，带圆环倒计时
- **临时查询** - 支持临时输入密钥获取验证码
- **一键复制** - 点击即可复制验证码或账号名
- **批量操作** - 支持批量导入、导出、删除、设置可见性
- **Aegis 兼容** - 导入导出支持 Aegis JSON 格式，兼容主流 2FA 应用
- **多格式支持** - 导入导出支持 Aegis JSON、简单 JSON、TSV、CSV 格式
- **重复检测** - 导入时自动检测重复账号
- **移动端适配** - 针对手机端优化的卡片布局
- **兼容主流应用** - 支持 Google、GitHub、AWS 等标准 TOTP

## 一键部署

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/zhifu1996/2fa-authenticator)

### 部署后配置

部署完成后，需要设置环境变量：

```bash
# 登录 Cloudflare
npx wrangler login

# 设置管理员密码（必须）
echo -n "你的密码" | npx wrangler secret put ADMIN_PASSWORD

# 设置 JWT 密钥（可选，不设置会自动基于密码生成）
openssl rand -hex 32 | tr -d '\n' | npx wrangler secret put JWT_SECRET
```

或在 Cloudflare Dashboard 中：

1. 进入 **Workers & Pages** > **2fa-authenticator** > **Settings** > **Variables**
2. 添加以下 Secrets：
   - `ADMIN_PASSWORD`: 管理员密码（必须）
   - `JWT_SECRET`: JWT 密钥（可选，推荐设置以增强安全性）

## 手动部署

### 1. 克隆项目

```bash
git clone https://github.com/zhifu1996/2fa-authenticator.git
cd 2fa-authenticator
```

### 2. 安装依赖

```bash
npm install
cd web && npm install && cd ..
```

### 3. 创建 KV 并配置

```bash
# 登录 Cloudflare
npx wrangler login

# 创建 KV namespace
npx wrangler kv:namespace create "KV"
# 将输出的 id 填入 wrangler.toml
```

### 4. 构建前端

```bash
cd web && npm run build && cd ..
```

### 5. 部署

```bash
# 设置密码（必须）
echo -n "你的密码" | npx wrangler secret put ADMIN_PASSWORD

# 设置 JWT 密钥（可选）
openssl rand -hex 32 | tr -d '\n' | npx wrangler secret put JWT_SECRET

# 部署
npx wrangler deploy
```

## 本地开发

```bash
# 终端 1: 启动 API 模拟服务器
node dev-server.mjs

# 终端 2: 启动前端
cd web
npm run dev
```

访问 http://localhost:5173 ，默认管理员密码：`admin123`

## 技术栈

- **后端**: Cloudflare Worker + Hono
- **存储**: Cloudflare KV
- **前端**: Vue 3 + Vite + Tailwind CSS
- **认证**: JWT
- **扫码**: html5-qrcode

## 项目结构

```
2fa-authenticator/
├── src/                    # Worker 源码
│   ├── index.ts           # 主入口
│   ├── routes/            # API 路由
│   └── utils/             # TOTP、JWT 工具
├── web/                    # Vue 3 前端
│   ├── src/
│   │   ├── views/         # 页面组件
│   │   ├── components/    # 通用组件
│   │   └── utils/         # API、TOTP 工具
│   └── vite.config.ts
├── wrangler.toml          # Worker 配置
├── dev-server.mjs         # 本地开发服务器
└── README.md
```

## 使用说明

### 查看验证码
1. 打开网站首页
2. 未登录时只显示公开账号的验证码
3. 账号按 Issuer 分组显示
4. 点击复制按钮复制验证码，点击账号名复制账号

### 临时查询
1. 在页面底部输入 Base32 密钥
2. 点击"获取验证码"
3. 验证码会自动刷新

### 管理账号
1. 点击右上角"管理"
2. 输入管理员密码登录
3. 可添加、编辑、删除账号
4. 可设置账号为公开或隐私

### 扫码添加
1. 在管理后台点击"扫码添加"
2. 允许摄像头权限
3. 扫描其他 App 的 2FA 二维码
4. 自动识别并填入账号信息

### 批量操作
- **批量导入**: 支持 Aegis JSON、简单 JSON、TSV、CSV 格式，自动识别
- **批量导出**: 可选择账号，支持 Aegis JSON、简单 JSON、TSV、CSV 格式
- **批量删除**: 勾选多个账号后点击删除
- **批量设置可见性**: 勾选账号后点击"设为公开"或"设为隐私"

### 导入格式示例

**Aegis JSON 格式（推荐）：**
```json
{
  "db": {
    "entries": [
      {
        "type": "totp",
        "name": "test@gmail.com",
        "issuer": "Google",
        "info": { "secret": "JBSWY3DPEHPK3PXP" }
      }
    ]
  }
}
```

**简单 JSON 格式：**
```json
{
  "keys": [
    { "name": "test@gmail.com", "issuer": "Google", "secret": "JBSWY3DPEHPK3PXP" }
  ]
}
```

**TSV/CSV 格式：**
```
No	name	issuer	secret	isPublic
1	test@gmail.com	Google	JBSWY3DPEHPK3PXP	false
```

## 安全说明

- 管理员密码通过 Cloudflare Secrets 存储，不会出现在代码中
- JWT 有效期 24 小时
- 隐私账号仅登录后可见
- 建议配合 Cloudflare Access 使用，限制访问来源

## License

MIT
