// M03.F01.I07 ext 字段补录（独立端点）—— Task 5.85(b) 补齐缺失路由。
//
// 此前 PUT /api/samples/{id}/ext 无 handler，请求落到 console [...path] catch-all
// 返回 200 HTML；lab-ct 旧断言只看 status∈{200,404}，恒退化也绿（评审 M1 真实案例：
// aspnetcore/springboot 在 5.54 live 批补了实现，本仓漏网）。
// 语义=整体替换 ext，镜像 aspnetcore SampleAndRecordService.UpdateExt 与 springboot
// SampleService.updateExt（5.54 批对齐注记）。
import { NextRequest } from "next/server";

import { getSample } from "@lab/management-system-msw/fixtures";
import { notFound, NOW } from "@/lib/api-helpers";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const s = getSample(params.id);
  if (!s) return notFound("Sample not found");
  const body = (await req.json().catch(() => ({}))) as { ext?: Record<string, string> };
  Object.assign(s, { ext: body.ext ?? {}, updatedAt: NOW() });
  return Response.json(s);
}
