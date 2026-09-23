// M04.F05 技术要求（复合主键 object+parameter+judgmentStandard）。
// GET  /api/technical-requirements?inspectionObjectCode=&inspectionParameterCode=&judgmentStandardCode=
//      → TechnicalRequirement[]（裸数组，不分页 —— SSOT listTechnicalRequirements 返数组，
//        T11 live 四方比对实证：nextjs 曾包 {items,...} 信封，「list 应是数组」红）
// POST /api/technical-requirements → 201
//
// T11(2026-09-16)：数据源必须走 fixtures-runtime 的 globalThis 单例 —— 直接 import
// fixtures 时每个路由 bundle 持有各自数组副本，POST 写进本 bundle 副本、[id] 与
// 三段复合键路由读另一份 → PUT/DELETE 恒 404（live 四方实证）。

import { NextRequest, NextResponse } from "next/server";
import { techReqArr, techReqId } from "@/lib/fixtures-runtime";
import { qp, NOW } from "@/lib/api-helpers";
import { requireTenant } from "@/lib/auth/require-tenant";

export async function GET(req: NextRequest) {
  // token 化（2026-09-23 P3）：fixtures 行自带 tenantId，按 token 租户过滤
  // （SSO 世界不镜像 tech_req —— 三端 SSO 世界天然一致为空，计划已固化）
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const url = qp(req);
  const obj = url.get("inspectionObjectCode");
  const param = url.get("inspectionParameterCode");
  const std = url.get("judgmentStandardCode");
  let items = techReqArr()
    .filter((r) => r["tenantId"] === auth.tenantId)
    .map((r): Record<string, unknown> => ({
      ...r,
      id: techReqId(r),
    }));
  if (obj) items = items.filter((r) => r["inspectionObjectCode"] === obj);
  if (param) items = items.filter((r) => r["inspectionParameterCode"] === param);
  if (std) items = items.filter((r) => r["judgmentStandardCode"] === std);
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  // ADR-0019：租户 stamp 取 token claim，不信任 body.tenantId（放 ...body 后恒胜）
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const entry = {
    createdAt: NOW(),
    updatedAt: NOW(),
    ...((await req.json().catch(() => ({}))) as object),
    tenantId: auth.tenantId,
  } as Record<string, unknown>;
  entry["id"] = techReqId(entry);
  techReqArr().push(entry);
  return NextResponse.json(entry, { status: 201 });
}
