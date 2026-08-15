"use client";

// M03.F08 报告归档 — 流程线最后环节（archived）列表页（三态过滤 + 归档/退回 + 详情路由）
import { AppShell } from "@/components/app/app-shell";
import ReportArchivePage from "@/features/reports/ReportArchivePage";

export default function Page() {
  return (
    <AppShell>
      <ReportArchivePage />
    </AppShell>
  );
}
