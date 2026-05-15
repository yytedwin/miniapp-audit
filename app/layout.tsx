import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "小程序上线前安全检查",
  description: "AI 生成代码安全/合规扫描工具",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
