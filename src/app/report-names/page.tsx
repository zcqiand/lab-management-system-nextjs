"use client";

// M06.F07 报告名称 — 列表 + 5 页签编辑弹窗（基础/项目/标准/参数/扩展属性）
import { AppShell } from "@/components/app/app-shell";
import ReportNameList from "@/features/inspection-capability/ReportNameList";

export default function Page() {
  return (
    <AppShell>
      <ReportNameList />
    </AppShell>
  );
}
