"use client";

// M06.F01 检测专项 — InspectionCapabilityPage resource="specialties"
import { AppShell } from "@/components/app/app-shell";
import InspectionCapabilityPage from "@/features/inspection-capability/InspectionCapabilityPage";

export default function Page() {
  return (
    <AppShell>
      <InspectionCapabilityPage resource="specialties" />
    </AppShell>
  );
}
