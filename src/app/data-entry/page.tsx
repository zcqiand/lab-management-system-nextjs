"use client";

// `/data-entry` 页壳：features/data-entry 的 DataEntryPage。
// M03.F03 数据录入 —— 样品切换 + 参数卡片录入 + docx 报告预览。
import { AppShell } from "@/components/app/app-shell";
import DataEntryPage from "@/features/data-entry/DataEntryPage";

export default function Page() {
  return (
    <AppShell>
      <DataEntryPage />
    </AppShell>
  );
}

export { DataEntryPage };
