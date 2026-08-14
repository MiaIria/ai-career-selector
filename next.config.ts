import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Prisma 在 Vercel 部署时需要保留为外部包，避免被 webpack 打包成无效的客户端代码
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
