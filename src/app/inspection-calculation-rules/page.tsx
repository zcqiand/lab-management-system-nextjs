"use client";

// M06.F05 计算规则 — 二级树（检测项目→检测标准）+ 拖拽列表
import { AppShell } from "@/components/app/app-shell";
import CalculationRuleList from "@/features/inspection-capability/CalculationRuleList";

export default function Page() {
  return (
    <AppShell>
      <CalculationRuleList />
    </AppShell>
  );
}
