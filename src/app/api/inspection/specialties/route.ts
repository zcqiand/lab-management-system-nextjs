// M06.F01 检测专项 CRUD。
// GET  /api/inspection/specialties?keyword=&page=&pageSize= → {items,total}（wrapDict 补 id=code）
// POST /api/inspection/specialties → 201

import { NextRequest, NextResponse } from "next/server";
import { inspectionSpecialties, getSpecialty } from "@lab/management-system-msw/fixtures";
import { wrapDict, badRequest, NOW } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  return wrapDict(inspectionSpecialties as unknown as Record<string, unknown>[], req);
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const code = String(body.code ?? "");
  if (!code || !body.name) return badRequest("code/name 必填");
  if (getSpecialty(code)) return badRequest("专项编码已存在");
  const row = { createdAt: NOW(), updatedAt: NOW(), ...body };
  inspectionSpecialties.push(row as never);
  return NextResponse.json(row, { status: 201 });
}
