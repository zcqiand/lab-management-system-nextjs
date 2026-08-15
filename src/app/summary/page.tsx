"use client";

import { AppShell } from "@/components/app/app-shell";
import { SummaryPage } from "@/features/summary/SummaryPage";

export default function SummaryRoute() {
  return (
    <AppShell>
      <SummaryPage />
    </AppShell>
  );
}