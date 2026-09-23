// M03.F01.I07 ext 字段补录（独立端点）—— Task 5.85(b) 补齐缺失路由。
//
// 此前 PUT /api/samples/{id}/ext 无 handler，请求落到 console [...path] catch-all
// 返回 200 HTML；lab-ct 旧断言只看 status∈{200,404}，恒退化也绿（评审 M1 真实案例：
// aspnetcore/springboot 在 5.54 live 批补了实现，本仓漏网）。
// 语义=整体替换 ext，镜像 aspnetcore SampleAndRecordService.UpdateExt 与 springboot
// SampleService.updateExt（5.54 批对齐注记）。
import { NextRequest, NextResponse } from "next/server";

import { getSample } from "@lab/management-system-msw/fixtures";
import { badRequest, notFound, NOW } from "@/lib/api-helpers";
import { requireTenant } from "@/lib/auth/require-tenant";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  // 5.89：schema 校验先于存在性（镜像 aspnetcore ModelState 最先、springboot IAE 在
  // findById 前）——缺 ext 不该因 id 查不到被 404 掩盖。附带消除 dev 热载下 fixtures
  // 模块实例分叉的时序脆弱（POST 路由与本地实例不共享时 404 不会吞掉 400 契约面）。
  const body = (await req.json().catch(() => ({}))) as { ext?: Record<string, string> };
  // 5.89（5.85 评审 MINOR-1）：契约 ext 必填（sample.tsp UpdateSampleExtRequest.ext 无 ?）。
  // 原 `?? {}` 把缺 ext/坏 JSON 静默兜底成清空 ext 返 200——数据破坏面（lab-ct 缺 ext 断言锁定）。
  if (body.ext === null || typeof body.ext !== "object" || Array.isArray(body.ext)) {
    return badRequest("ext is required");
  }
  const s = getSample(params.id);
  // token 化：他租户样品 = 404 not-found 语义
  if (!s || s.tenantId !== auth.tenantId) return notFound("Sample not found");
  Object.assign(s, { ext: body.ext, updatedAt: NOW() });
  return Response.json(s);
}
