"use client";

// M03.F09 接样单详情 — 接样信息 + 样品信息 + 检测数据（只读模型卡）
import { AppShell } from "@/components/app/app-shell";
import ReceiptDetailPage from "@/features/receipts/ReceiptDetailPage";

export default function Page() {
  return (
    <AppShell>
      <ReceiptDetailPage />
    </AppShell>
  );
}
