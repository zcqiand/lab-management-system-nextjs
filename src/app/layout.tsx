import type { Metadata } from "next";
import "./globals.css";
import { BackendProvider } from "@/state/backend-context";

export const metadata: Metadata = {
  title: "lab-management-system-nextjs",
  description: "实验室管理系统-Next.js — 4-backend 切换 full-stack 前端",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-background text-foreground antialiased">
        <BackendProvider>{children}</BackendProvider>
      </body>
    </html>
  );
}
