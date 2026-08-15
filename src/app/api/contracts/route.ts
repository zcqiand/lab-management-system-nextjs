// GET /api/contracts?status=&keyword=&page=&pageSize=
// POST /api/contracts   (CreateContractRequest body → Contract)
//
// 数据源：lab-msw 的 `contracts` 数组（in-memory；同进程内 4-backend 切换看到同一份）。
// 业务逻辑跟 lab-msw/src/handlers-extra.ts 的 contractsExtraHandlers 一致：
// status / keyword 过滤 + 分页 + push 新合同。

import { NextRequest, NextResponse } from "next/server";
import { contracts, getContract } from "@lab/management-system-msw/fixtures";

const NOW = () => new Date().toISOString();

function pageOf<T>(items: T[], page = 1, pageSize = 20) {
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total: items.length,
  };
}

function newId(prefix: string) {
  const ts = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 0xffff).toString(36);
  return `${prefix}-${ts}${rand}`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const keyword = url.searchParams.get("keyword") ?? "";
  const page = Number(url.searchParams.get("page") ?? 1);
  const pageSize = Number(url.searchParams.get("pageSize") ?? 20);

  let items = contracts;
  if (status) items = items.filter((c) => c.status === status);
  if (keyword) {
    const k = keyword.toLowerCase();
    items = items.filter(
      (c) =>
        c.contractCode.toLowerCase().includes(k) ||
        c.projectName.toLowerCase().includes(k),
    );
  }
  return NextResponse.json(pageOf(items, page, pageSize));
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const newContract = {
    id: newId("CONTRACT"),
    tenantId: String(body.tenantId ?? "TENANT-001"),
    contractCode: String(body.contractCode ?? ""),
    clientUnit: String(body.clientUnit ?? ""),
    projectName: String(body.projectName ?? ""),
    projectLocation: body.projectLocation as string | undefined,
    constructionUnit: String(body.constructionUnit ?? ""),
    inspectionSpecialtyCode: body.inspectionSpecialtyCode as string | undefined,
    buildingUnit: body.buildingUnit as string | undefined,
    supervisorUnit: body.supervisorUnit as string | undefined,
    inspectionPerson: body.inspectionPerson as string | undefined,
    inspectionPhone: body.inspectionPhone as string | undefined,
    witnessUnit: String(body.witnessUnit ?? ""),
    witness: String(body.witness ?? ""),
    witnessPhone: body.witnessPhone as string | undefined,
    contactPerson: body.contactPerson as string | undefined,
    contactPhone: body.contactPhone as string | undefined,
    entrustedDate: body.entrustedDate as string | undefined,
    status: (body.status as "active" | "archived") ?? "active",
    createdAt: NOW(),
    updatedAt: NOW(),
  };
  // 缺必填字段 → 400
  if (
    !newContract.contractCode ||
    !newContract.clientUnit ||
    !newContract.projectName ||
    !newContract.constructionUnit ||
    !newContract.witnessUnit ||
    !newContract.witness
  ) {
    return NextResponse.json(
      {
        code: "BAD_REQUEST",
        message:
          "contractCode / clientUnit / projectName / constructionUnit / witnessUnit / witness are required",
      },
      { status: 400 },
    );
  }
  contracts.push(newContract as never);
  // 同步内存：让同一进程内 getContract 立刻能查到
  void getContract;
  return NextResponse.json(newContract, { status: 201 });
}
