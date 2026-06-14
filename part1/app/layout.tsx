import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Module 1 AI SDK Demo",
  description: "21 天 AI 应用开发求职冲刺模块 1 Demo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
