# 路上见（ai-career-selector）

> 帮大学生在毕业前，把几条可能的出路**先演练一遍、看清代价和风险，再做决定**。

---

## 克隆与运行

```bash
# 1. 克隆仓库
git clone https://github.com/MiaIria/ai-career-selector.git
cd ai-career-selector

# 2. 安装依赖
npm install

# 3. 准备配置文件
cp .env.example .env.local
cp .env.example .env

# 4. 将已登记的 migration 应用到 PostgreSQL
npm run db:migrate:deploy

# 5. 启动
npm run dev
```

打开 http://localhost:3000 即可。

### 注意事项

- **Node.js 需 ≥ 20.9**（推荐 22 LTS），版本过低会在构建阶段报错。
- **第 3 步的两份配置文件都要复制。** Next.js 运行时读 `.env.local`，Prisma 命令读 `.env`；两份文件都需要填写 `DATABASE_URL` 和 `DIRECT_URL`。开发环境应使用独立的 Neon 开发库或分支，不要指向生产库。两份文件均已被 `.gitignore` 忽略，不会误提交。
- **不填 MiniMax 密钥也能体验。** 未配置 MiniMax 时，路径推演会自动回退到内置规则引擎；游客可免登录使用，进度仅保留在当前浏览器会话中。
- 想确认当前配置状态，访问 `http://localhost:3000/api/health`。

---

## 核心能力

| 阶段 | 说明 |
| --- | --- |
| **证据化画像** | 采集专业、年级、成绩、能力、经历、兴趣、价值偏好、地域、资金与时间约束；对矛盾或缺失信息追问 1—3 轮 |
| **四轨路径推演** | 每条主路径生成节点树，含进入条件、当前证据、能力缺口、可行性、时间/资金/机会成本、替代走向与规则来源 |
| **决策对比台** | 覆盖总投入、准备度、最大障碍、关键窗口、不可逆节点、最坏结果、退出成本、能力迁移价值、跨轨转换难度 |

### 四条主路径

| 主路径 | 终点 | 子赛道 |
| --- | --- | --- |
| 升学深造 | 升学录取资格 | 考研、保研 |
| 体制内发展 | 通过招录并上岸 | 公务员、事业单位 |
| 市场化就业 | 获得并确认 Offer | 校招、实习转正 |
| 自主发展 | 完成需求验证并形成初步可持续收入 | 内容创作、轻创业 |

系统会依据画像为每条主路径选定默认子赛道，你也可以手动切换同路径下的另一子赛道并重新生成。

一条设计原则：**所有判断严格区分「用户自述」「用户证明」「外部规则」三类依据**，路径节点来源标注率 100%；不输出没有样本依据的精确成功率。

---

## 目录结构

```
src/
├─ app/
│  ├─ api/
│  │  ├─ auth/              # 手机号/邮箱注册、登录与会话
│  │  ├─ auth/session/      # 签名会话
│  │  ├─ simulations/       # 四轨路径推演生成
│  │  ├─ decision/commit/   # 决策单事务提交
│  │  ├─ profile/           # 画像读写
│  │  └─ health/            # 配置自检
│  └─ page.tsx
├─ components/
│  └─ sandbox-app.tsx       # 沙盘主界面
├─ lib/
│  ├─ path-rules.ts         # 路径规则引擎（含测试）
│  ├─ decision.ts           # 四轨对比与排序（含测试）
│  ├─ minimax.ts            # MiniMax 适配层
│  ├─ session.ts            # 签名会话
│  └─ prisma.ts
└─ types/
   └─ domain.ts             # 领域类型定义

prisma/schema.prisma        # 数据模型
prisma/migrations/          # PostgreSQL 结构迁移记录
```

---

## License

[MIT](LICENSE) © 2026 MiaIria

