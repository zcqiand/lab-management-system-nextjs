"use client";

// M06.F04 检测标准 — InspectionCapabilityPage resource="standards"
import { AppShell } from "@/components/app/app-shell";
import InspectionCapabilityPage from "@/features/inspection-capability/InspectionCapabilityPage";

export default function Page() {
  return (
    <AppShell>
      <InspectionCapabilityPage resource="standards" />
    </AppShell>
  );
}
