"use client";

// M03.F01 接样管理 — 流程线第一环节列表页（三态过滤 + 新建/编辑/删除 + 详情路由）
import { AppShell } from "@/components/app/app-shell";
import ReceiptList from "@/features/receipts/ReceiptList";

export default function Page() {
  return (
    <AppShell>
      <ReceiptList />
    </AppShell>
  );
}
