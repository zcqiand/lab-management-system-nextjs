// M06.F08 参数界面：GET/PUT/DELETE /api/param-interfaces/{code}（契约路径，REQ-2026-001；
// PUT 为 PATCH 语义；DELETE 内置（isOfficial）不可删 400——REF 语义）

import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { fixturesSingleton } from "@/lib/fixtures-runtime";

const inspectionParamInterfaces = fixturesSingleton.inspectionParamInterfaces;
import { notFound, badRequest, noContent, NOW } from "@/lib/api-helpers";

function findRow(code: string): Record<string, unknown> | undefined {
  return (inspectionParamInterfaces as unknown as Record<string, unknown>[]).find(
    (r) => r["code"] === code,
  );
}

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const row = findRow(params.code);
  if (!row) return notFound("InspectionParamInterface not found");
  return Response.json(row);
}

export async function PUT(req: NextRequest, { params }: { params: { code: string } }) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const row = findRow(params.code);
  if (!row) return notFound("InspectionParamInterface not found");
  Object.assign(row, (await req.json().catch(() => ({}))) as object, {
    updatedAt: NOW(),
  });
  return Response.json(row);
}

export async function DELETE(req: NextRequest, { params }: { params: { code: string } }) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const arr = inspectionParamInterfaces as unknown as Record<string, unknown>[];
  const i = arr.findIndex((r) => r["code"] === params.code);
  if (i < 0) return notFound("参数界面不存在");
  if (arr[i]!["isOfficial"]) return badRequest("内置模型不可删除");
  arr.splice(i, 1);
  return noContent();
}
