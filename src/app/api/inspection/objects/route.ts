// M06.F02 检测项目 CRUD。
// GET  /api/inspection/objects → {items,total}（wrapDict：keyword + inspectionSpecialtyCode
//      直列过滤 + 聚合列 parameterNames/standardCodes——老 shared lab-handlers 语义）
// POST /api/inspection/objects → 201

import { NextRequest, NextResponse } from "next/server";
import {
  inspectionObjects,
  getObject,
  inspectionParameters,
  inspectionObjectParameters,
  inspectionObjectStandards,
} from "@lab/management-system-msw/fixtures";
import { wrapDict, badRequest, NOW } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  return wrapDict(inspectionObjects as unknown as Record<string, unknown>[], req, {
    aggregate: [
      {
        as: "parameterNames",
        link: inspectionObjectParameters as unknown as Record<string, unknown>[],
        selfCol: "inspectionObjectCode",
        otherCol: "inspectionParameterCode",
        names: new Map(
          (inspectionParameters as unknown as Array<{ code: string; name: string }>).map((p) => [
            String(p.code),
            String(p.name),
          ]),
        ),
      },
      {
        as: "standardCodes",
        link: inspectionObjectStandards as unknown as Record<string, unknown>[],
        selfCol: "inspectionObjectCode",
        otherCol: "inspectionStandardCode",
      },
    ],
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const code = String(body.code ?? "");
  if (!code || !body.name) return badRequest("code/name 必填");
  if (getObject(code)) return badRequest("项目编码已存在");
  const row = { createdAt: NOW(), updatedAt: NOW(), ...body };
  inspectionObjects.push(row as never);
  return NextResponse.json(row, { status: 201 });
}
