#!/usr/bin/env bash
# 把本地 .env.local 中的密钥批量推到 Vercel 生产环境。
# 使用：在仓库 app/ 目录下执行 `bash scripts/vercel-env-sync.sh`
# 要求：先 `vercel login`，再 `vercel link --yes`

set -euo pipefail

ENV_FILE=".env.local"
[ -f "$ENV_FILE" ] || { echo "找不到 $ENV_FILE"; exit 1; }

# 必须重新生成一个线上专属的 SESSION_SECRET（绝不沿用本地的）
SESSION_SECRET=$(openssl rand -hex 32)
echo "🔑 已生成新的 SESSION_SECRET（与本地值不同）"

# 需要从本地读取的 key（值从 .env.local 来）
LOCAL_KEYS=(
  MINIMAX_API_KEY
  MINIMAX_BASE_URL
  MINIMAX_MODEL
  # DATABASE_URL / DIRECT_URL 走 Neon 连接串，本地 .env 与 .env.local 都已就绪
  DATABASE_URL
  DIRECT_URL
)

# 解析 .env.local，忽略以 # 开头的行和空行
get_value() {
  local key="$1"
  awk -F'=' -v k="$key" '
    /^[[:space:]]*#/ {next}
    /^[[:space:]]*$/ {next}
    $1 == k { sub(/^[^=]*=/, ""); gsub(/^"|"$/, ""); print; exit }
  ' "$ENV_FILE"
}

add_var() {
  local key="$1" value="$2"
  # 如果 Vercel 上已存在同名变量，先删再加（保证幂等）
  if vercel env ls production 2>/dev/null | grep -q "^${key} "; then
    echo "  ↻ $key 已存在，先删除再覆盖"
    vercel env rm "$key" production --yes >/dev/null
  fi
  echo "$value" | vercel env add "$key" production >/dev/null
  echo "  ✓ $key"
}

echo ""
echo "▶ 推送以下变量到 Vercel production："
for key in DATABASE_URL DIRECT_URL MINIMAX_API_KEY MINIMAX_BASE_URL MINIMAX_MODEL SESSION_SECRET; do
  echo "  - $key"
done
echo ""

for key in "${LOCAL_KEYS[@]}"; do
  value="$(get_value "$key")"
  if [ -z "$value" ]; then
    echo "  ✗ $key 在 $ENV_FILE 里没读到，请检查后重跑"
    exit 1
  fi
  add_var "$key" "$value"
done

# SESSION_SECRET 用新生成的
add_var SESSION_SECRET "$SESSION_SECRET"

echo ""
echo "✅ 全部 6 个变量已同步到 Vercel production"
echo ""
echo "下一步：vercel deploy --prod"
