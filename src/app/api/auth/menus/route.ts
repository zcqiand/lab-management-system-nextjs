// GET /api/auth/menus → 菜单树（demo，msw authExtraHandlers 同款形状。
// 注意：SidebarNav 实际走 /api/saas/me/menus（saas 集成），本路由服务 REF 语义消费方）

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json([
    { id: "menu-dashboard", label: "工作台", path: "/dashboard", icon: "dashboard" },
    {
      id: "menu-m02",
      label: "资源管理",
      icon: "resource",
      children: [{ id: "menu-contracts", label: "合同管理", path: "/contracts" }],
    },
    {
      id: "menu-m03",
      label: "试验过程",
      icon: "flow",
      children: [
        { id: "menu-receipts", label: "接样管理", path: "/receipts" },
        { id: "menu-task", label: "任务分配", path: "/receipts?stage=task_assignment" },
        { id: "menu-entry", label: "数据录入", path: "/receipts?stage=data_entry" },
        { id: "menu-review", label: "报告审核", path: "/receipts?stage=review" },
        { id: "menu-approve", label: "报告批准", path: "/receipts?stage=approval" },
        { id: "menu-issue", label: "报告发放", path: "/receipts?stage=issuance" },
        { id: "menu-archive", label: "报告归档", path: "/receipts?stage=archived" },
      ],
    },
    {
      id: "menu-m04",
      label: "基础数据",
      icon: "data",
      children: [
        { id: "menu-techreq", label: "技术要求", path: "/technical-requirements" },
        { id: "menu-models", label: "型号维护", path: "/catalog/models" },
        { id: "menu-specs", label: "规格维护", path: "/catalog/specs" },
        { id: "menu-grades", label: "等级维护", path: "/catalog/grades" },
        { id: "menu-brands", label: "牌号维护", path: "/catalog/brands" },
      ],
    },
    {
      id: "menu-m05",
      label: "数据统计",
      icon: "stats",
      children: [{ id: "menu-summary", label: "报告汇总", path: "/summary" }],
    },
  ]);
}
