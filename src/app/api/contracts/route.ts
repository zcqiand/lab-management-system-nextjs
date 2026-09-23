// GET /api/contracts?status=&keyword=&page=&pageSize=
// POST /api/contracts   (CreateContractRequest body → Contract)
//
// 数据源：lab_dev PG contracts 表（T11：msw fixtures 内存数组 → PG 迁移）。
// 三后端共库（V015 seed）：aspnetcore/springboot 直写 PG，nextjs fixtures 版是
// 唯一不入库的漂移源 —— 本进程 POST 的合同在 receipts POST 做 contract FK 校验时
// 23503 → 500（gate #4 Cluster B 实证）。
// 业务逻辑跟 lab-msw/src/handlers-extra.ts contractsExtraHandlers 一致：
// status / keyword 过滤 + 分页 + 必填 6 项 400；行读写下沉 db-queries.ts contracts 域。

import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { createContractDb, isDbUnavailable, listContractsDb } from "@/lib/db-queries";

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

/** 三后端共库 → id 与 aspnetcore/springboot 同为 UUID 形态（V015 seed 约定）。 */
function newId() {
  return crypto.randomUUID();
}

export async function GET(req: NextRequest) {
  // token 化（2026-09-23）：此前 GET 无租户过滤，SSO 数据面桥双世界行全量返回
  //（lab_dev 6 行 = 两租户各 3 条）——「nextjs 显示 6 条重复」报障根因
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const keyword = url.searchParams.get("keyword") ?? "";
  const page = Number(url.searchParams.get("page") ?? 1);
  const pageSize = Number(url.searchParams.get("pageSize") ?? 20);

  try {
    const items = await listContractsDb(auth.tenantId, {
      status: status ?? undefined,
      keyword: keyword || undefined,
    });
    return NextResponse.json(pageOf(items, page, pageSize));
  } catch (e) {
    if (isDbUnavailable(e)) {
      return NextResponse.json(
        { code: "DB_UNAVAILABLE", message: "检查 DATABASE_URL / npm run seed:db" },
        { status: 503 },
      );
    }
    throw e;
  }
}

export async function POST(req: NextRequest) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  // ADR-0019 + T11（2026-09-16）：租户身份取 token 的 tenant_id claim（requireTenant），
  // 不收 body.tenantId —— createContractDb 以显式参数 stamp，body 传入值被忽略。
  const newContract = {
    id: newId(),
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
  try {
    const row = await createContractDb(auth.tenantId, newContract);
    // 响应行来自 PG returning：未填可空列是 null 不是 undefined —— 与
    // aspnetcore DTO 物化形状对齐（POST shape 四方比对，buildingUnit 等列）。
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    if (isDbUnavailable(e)) {
      return NextResponse.json(
        { code: "DB_UNAVAILABLE", message: "检查 DATABASE_URL / npm run seed:db" },
        { status: 503 },
      );
    }
    if ((e as { code?: string }).code === "23505") {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "contractCode already exists for tenant" },
        { status: 400 },
      );
    }
    throw e;
  }
}
