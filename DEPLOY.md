# Vercel + Neon 部署执行清单

> 本文档是 **MiaIria/ai-career-selector** 上线 Vercel（前端+Serverless Functions）并把数据库托管到 Neon（PostgreSQL）的可复制操作清单。
> 所有命令都在仓库根目录 `app/` 执行。

---

## 0. 准备工具（已为你安装时跳过）

```bash
# 一次性全局安装两个 CLI（v3 已统一命令名为 neon）
npm install -g vercel neon@latest

# 验证
vercel --version
neon --version        # 期望 >= 3.x
```

---

## 1. 登录外部服务

```bash
# Vercel（会跳浏览器）
vercel login

# Neon v3：auth 是 login 的别名
neon auth

# 验证登录态
vercel whoami
neon me
```

---

## 2. 在 Neon 上创建项目与数据库

```bash
# 2.1 创建项目（区域建议 ap-southeast-1，离国内最近；cu=0.5 起步省钱）
neon projects create \
  --name ai-career-selector \
  --region-id aws-ap-southeast-1 \
  --cu 0.5-0.5 \
  --set-context

# 2.2 拿两条连接串（--prisma 会自动附带 sslmode=require&channel_binding=require 等 Prisma 需要的参数）
# 运行时连接（pooled + prisma 参数）：
neon connection-string --prisma --pooled

# 直连（仅给 prisma db push / migrate 使用）：
neon connection-string

# 推荐保存到临时变量，避免来回复制粘贴
export DATABASE_URL=$(neon connection-string --prisma --pooled)
export DIRECT_URL=$(neon connection-string)
echo "DATABASE_URL=$DATABASE_URL"
echo "DIRECT_URL=$DIRECT_URL"
```

把两条连接串填入下表（**不要直接打印到聊天里**）：

| 名称 | 用途 | 标志 |
| --- | --- | --- |
| `DATABASE_URL` | 应用运行时（Pooled） | `neon connection-string --prisma --pooled` |
| `DIRECT_URL` | Prisma DDL（`db push`） | `neon connection-string` |

> 之所以区分两条：Prisma 在 Neon 的 pooled 连接上跑 DDL 会失败（PgBouncer 事务模式下不支持 PREPARE），所以 schema 同步必须走直连，运行时查询走池化。

---

## 3. 本地初始化数据库 schema

```bash
# 在仓库根目录复制模板
cp .env.example .env.local
cp .env.example .env

# 用编辑器把 .env 和 .env.local 里的
#   DATABASE_URL / DIRECT_URL 换成第 2 步的两条 Neon 连接串。
# 首次空库上线由仓库中的 Prisma migration 初始化；请不要在生产环境运行 db push。
npx prisma migrate deploy
```

成功后应看到：

```
✔ Generated Prisma Client (v6.19.2)
🚀 Your database is now in sync with your Prisma schema.
Done with 1 migration in 73ms
```

> ⚠️ 首次部署前先在 Neon 控制台确认表已建出来。Vercel 的构建只生成 Prisma Client 和编译 Next.js，不会修改生产数据库结构。

---

## 4. 在 Vercel 创建项目并绑定仓库

### 方案 A：用 CLI（推荐，幂等可重跑）

```bash
# 在仓库根目录
vercel link --yes

# 第一次会问要不要创建新 project，回答 Yes；项目名建议与 repo 同名
```

### 方案 B：在 Web 控制台手动创建
1. 打开 https://vercel.com/new
2. Import `MiaIria/ai-career-selector` 仓库
3. **Root Directory** 必须填 `app`（仓库里 app/ 才是 Next.js 项目根）
4. Framework Preset 选 Next.js（自动检测）

---

## 5. 配置 Vercel 环境变量

CLI 一把梭（把 `<...>` 全部替换成你的真实值）：

```bash
# 数据库（推荐从第 2 步直接读环境变量）
vercel env add DATABASE_URL production <<< "$DATABASE_URL"
vercel env add DIRECT_URL   production <<< "$DIRECT_URL"

# MiniMax
vercel env add MINIMAX_API_KEY  production
vercel env add MINIMAX_BASE_URL production <<< "https://api.minimaxi.com/v1"
vercel env add MINIMAX_MODEL    production <<< "minimax-m3"

# 会话签名（重新生成一个，绝不复用本地值）
SESSION_SECRET=$(openssl rand -hex 32)
vercel env add SESSION_SECRET production <<< "$SESSION_SECRET"
```

或者直接在 Vercel 控制台 → Project → Settings → Environment Variables 逐条填写。

> 安全提醒：本地 `.env.local` 中的旧密钥已在本对话中暴露过，建议部署完成**后**在飞书开发者后台和 MiniMax 控制台轮换一次。

---

## 6. 首次部署

```bash
# 部署到生产环境
vercel deploy --prod
```

观察输出，关注：
- Next.js 编译是否报错
- 最后一行 `Production: https://<your-project>.vercel.app [copied to clipboard]`

## 7. 回归验收

依次验证下面 5 条链路（任何一条断，立刻看 Vercel Runtime Logs）：

| 场景 | 期望 |
| --- | --- |
| 打开 `/` | 首页能加载，无 500 |
| `/api/health` | 返回 `{ ok: true }`，看到 `database` 段显示已连接 |
| 游客模式：完成画像 → 四轨推演 | 进度能保存到浏览器；**不要**依赖飞书 |
| 决策提交 + 阶段方案生成 | 数据库能查到 `DecisionRecord` 和 `StagePlan` 记录 |
| 邮箱/手机号注册与登录 | 能创建用户并在重新登录后恢复已保存方案 |

如需检查数据库：

```bash
neon projects list
neon psql main -- -c "SELECT count(*) FROM \"User\";"
```

---

## 8. 常见问题

- **构建报 "PrismaClientInitializationError"**：通常是 `DATABASE_URL` / `DIRECT_URL` 没读到，或直连串写成了 pooled。
- **构建报 "prepared statement already exists"**：把 `DATABASE_URL` 换成 pooled 直连（用 `neon connection-string --prisma --pooled`）。
- **冷启动慢**：是 Serverless 正常现象，第一次访问会编译，约 1~3s。
- **本地跑 `next dev` 想连 Neon**：把 `app/.env.local` 也填上 Neon 两条连接串即可，不再依赖 dev.db。
