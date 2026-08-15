// M06.F03 检测参数 CRUD。
// GET  /api/inspection/parameters → {items,total}（wrapDict：按专项/项目过滤经 junction
//      反查、按标准过滤经 standard-parameter；聚合列 objectNames/standardCodes）
// POST /api/inspection/parameters → 201

import { NextRequest, NextResponse } from "next/server";
import {
  inspectionParameters,
  getParameter,
  inspectionObjects,
  inspectionSpecialtyObjects,
  inspectionObjectParameters,
  inspectionStandardParameters,
} from "@lab/management-system-msw/fixtures";
import { wrapDict, badRequest, NOW } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  return wrapDict(inspectionParameters as unknown as Record<string, unknown>[], req, {
    reverse: {
      inspectionSpecialtyCode: [
        {
          link: inspectionSpecialtyObjects as unknown as Record<string, unknown>[],
          from: "inspectionSpecialtyCode",
          to: "inspectionObjectCode",
        },
        {
          link: inspectionObjectParameters as unknown as Record<string, unknown>[],
          from: "inspectionObjectCode",
          to: "inspectionParameterCode",
        },
      ],
      inspectionObjectCode: [
        {
          link: inspectionObjectParameters as unknown as Record<string, unknown>[],
          from: "inspectionObjectCode",
          to: "inspectionParameterCode",
        },
      ],
      inspectionStandardCode: [
        {
          link: inspectionStandardParameters as unknown as Record<string, unknown>[],
          from: "inspectionStandardCode",
          to: "inspectionParameterCode",
        },
      ],
    },
    aggregate: [
      {
        as: "objectNames",
        link: inspectionObjectParameters as unknown as Record<string, unknown>[],
        selfCol: "inspectionParameterCode",
        otherCol: "inspectionObjectCode",
        names: new Map(
          (inspectionObjects as unknown as Array<{ code: string; name: string }>).map((o) => [
            String(o.code),
            String(o.name),
          ]),
        ),
      },
      {
        as: "standardCodes",
        link: inspectionStandardParameters as unknown as Record<string, unknown>[],
        selfCol: "inspectionParameterCode",
        otherCol: "inspectionStandardCode",
      },
    ],
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const code = String(body.code ?? "");
  if (!code || !body.name) return badRequest("code/name 必填");
  if (getParameter(code)) return badRequest("参数编码已存在");
  const row = { createdAt: NOW(), updatedAt: NOW(), ...body };
  inspectionParameters.push(row as never);
  return NextResponse.json(row, { status: 201 });
}
