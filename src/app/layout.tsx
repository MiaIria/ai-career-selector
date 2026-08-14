import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "路上见",
  description: "基于证据与规则的大学生职业路径决策支持系统",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
