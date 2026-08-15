"use client";

// M03.F02 任务安排 — 流程线第二环节（分配检测人员 + 计划检测日期 + 取消任务）
import { AppShell } from "@/components/app/app-shell";
import TaskAssignmentPage from "@/features/task-assignment/TaskAssignmentPage";

export default function Page() {
  return (
    <AppShell>
      <TaskAssignmentPage />
    </AppShell>
  );
}
