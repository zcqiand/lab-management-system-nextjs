"use client";

// M03.F07 报告发放 — 流程线第六环节（issuance）列表页（三态过滤 + 发放/退回 + 详情路由）
import { AppShell } from "@/components/app/app-shell";
import ReportIssuePage from "@/features/reports/ReportIssuePage";

export default function Page() {
  return (
    <AppShell>
      <ReportIssuePage />
    </AppShell>
  );
}
