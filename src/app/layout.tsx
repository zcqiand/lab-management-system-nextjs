import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/state/auth-context";
import { QueryProvider } from "@/state/query-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "lab-management-system-nextjs",
  description: "建筑工程实验室管理系统-Next.js — full-stack 前端 + 后端 API routes",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-background text-foreground antialiased">
        <AuthProvider>
          <QueryProvider>
            <Toaster />
            {children}
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
