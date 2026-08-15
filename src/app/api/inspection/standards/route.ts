// M06.F04 检测标准 CRUD。
// GET  /api/inspection/standards → {items,total}（wrapDict：按专项过滤两跳反查、
//      按项目过滤一跳反查；聚合列 parameterNames）
// POST /api/inspection/standards → 201

import { NextRequest, NextResponse } from "next/server";
import {
  inspectionStandards,
  getStandard,
  inspectionParameters,
  inspectionSpecialtyObjects,
  inspectionObjectStandards,
  inspectionStandardParameters,
} from "@lab/management-system-msw/fixtures";
import { wrapDict, badRequest, NOW } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  return wrapDict(inspectionStandards as unknown as Record<string, unknown>[], req, {
    reverse: {
      inspectionSpecialtyCode: [
        {
          link: inspectionSpecialtyObjects as unknown as Record<string, unknown>[],
          from: "inspectionSpecialtyCode",
          to: "inspectionObjectCode",
        },
        {
          link: inspectionObjectStandards as unknown as Record<string, unknown>[],
          from: "inspectionObjectCode",
          to: "inspectionStandardCode",
        },
      ],
      inspectionObjectCode: [
        {
          link: inspectionObjectStandards as unknown as Record<string, unknown>[],
          from: "inspectionObjectCode",
          to: "inspectionStandardCode",
        },
      ],
    },
    aggregate: [
      {
        as: "parameterNames",
        link: inspectionStandardParameters as unknown as Record<string, unknown>[],
        selfCol: "inspectionStandardCode",
        otherCol: "inspectionParameterCode",
        names: new Map(
          (inspectionParameters as unknown as Array<{ code: string; name: string }>).map((p) => [
            String(p.code),
            String(p.name),
          ]),
        ),
      },
    ],
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const code = String(body.code ?? "");
  if (!code || !body.name) return badRequest("code/name 必填");
  if (getStandard(code)) return badRequest("标准编码已存在");
  const row = { createdAt: NOW(), updatedAt: NOW(), ...body };
  inspectionStandards.push(row as never);
  return NextResponse.json(row, { status: 201 });
}
