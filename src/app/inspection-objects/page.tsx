"use client";

// M06.F02 检测项目 — InspectionCapabilityPage resource="objects"
import { AppShell } from "@/components/app/app-shell";
import InspectionCapabilityPage from "@/features/inspection-capability/InspectionCapabilityPage";

export default function Page() {
  return (
    <AppShell>
      <InspectionCapabilityPage resource="objects" />
    </AppShell>
  );
}
