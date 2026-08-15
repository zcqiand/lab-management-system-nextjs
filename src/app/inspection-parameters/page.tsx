"use client";

// M06.F03 检测参数 — InspectionCapabilityPage resource="parameters"
import { AppShell } from "@/components/app/app-shell";
import InspectionCapabilityPage from "@/features/inspection-capability/InspectionCapabilityPage";

export default function Page() {
  return (
    <AppShell>
      <InspectionCapabilityPage resource="parameters" />
    </AppShell>
  );
}
