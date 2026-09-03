"use client";

// V016 菜单路径对齐：saas /me/menus 下发 lab 仪表盘菜单 path=dashboard（m-lab-dash）。
// 旧路径 /summary（m-summary 统计汇总）保留，两路由同渲染 SummaryPage（仪表盘容器
// M05.F01.I02 + 核心指标 I03 + 任务漏斗 I04 + 汇总表 I01）。
import { SummaryPage } from "@/features/summary/SummaryPage";

export default function DashboardRoute() {
  return <SummaryPage />;
}
