import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "lab-management-system-nextjs",
  description: "实验室管理系统-Next.js",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
