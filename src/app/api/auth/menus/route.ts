// GET /api/auth/menus → 菜单树（ADR-0009：saas 快照缓存 → demo 兜底）
//
// 数据链（与 lab-springboot v0.1.7 / lab-react v0.2.13 / lab-vue v0.2.9 同款）：
//   1. SSO callback 瞬时持 saas accessToken 时拉 saas /api/v1/me/menus 存
//      快照（lib/auth/menu-snapshot.ts，TTL 30min，key = saas userId）
//   2. 本端点从 Authorization: Bearer <saas accessToken> 解出 sub（JWT payload），
//      读快照命中即返回
//   3. miss（密码登录/缓存过期/重启/无 token）回退下方静态 demo 树，端点永不 5xx
//
// 本仓 token 即 saas accessToken（sso/callback 原样透传，见其注释 §3），
// sub 为 saas user id — 与快照 key 一致，无需再查 /me。

import { NextResponse } from "next/server";
import { getMenuSnapshot } from "@/lib/auth/menu-snapshot";

/** demo 兜底菜单（原 v0.3.x demo 路由原样提取，REF 语义消费方零改动）。 */
export const FALLBACK_MENUS = [
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
];

/** 从 Authorization: Bearer <jwt> 解 JWT payload sub（不验签 — 本仓 demo 路由
 *  均不校验 JWT；快照 key 是 sub，伪造 sub 只能拿到别人的菜单快照，demo 阶段可接受）。 */
function subFromBearer(authz: string | null): string | null {
  if (!authz?.startsWith("Bearer ")) return null;
  const token = authz.slice(7);
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf-8")) as {
      sub?: string;
    };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const sub = subFromBearer(request.headers.get("authorization"));
  const snapshot = getMenuSnapshot(sub);
  return NextResponse.json(snapshot ?? FALLBACK_MENUS);
}
