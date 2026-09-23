// catalog 4 码表（型号/规格/等级/牌号）共享 GET/POST/PUT/DELETE —— Batch1 接真库版。
//
// 前身是 fixture 数组工厂（msw catalogHandlers 的 Next route 版，GET 收数组引用）；
// 2026-09 Batch1 起 16 条 dict+catalog 路由统一走 src/lib/db-queries.ts 的
// listDictDb / createDictDb / putDictDb / deleteDictDb（CATALOG_CFGS 四张表配置），
// 本文件保留为薄封装，让 8 个 catalog route.ts 维持 catalogGet(req) 同款调用形状。
//
// 语义真相源 = fixture 版 catalogHandlers（golden 快照逐字节对齐）：
//   GET    ?inspectionObjectCode= 直列过滤 + id=code 补列 + Page<T> 4 字段
//          （keyword 不支持——fixture 版静默忽略，DB 版同款只声明 inspectionObjectCode）
//   POST   {code,name,sortOrder} 强转兜底 + 201；fixture 版无查重（内存数组可存重复
//          code），DB 侧 code 是主键——重复改返 400「编码已存在」（唯一一处刻意偏差，
//          正常前端流不会触发，见 db-queries createDictDb）
//   PUT    body 键覆盖 + code 不可改 + updatedAt 重写；404 "Entry not found"
//   DELETE 204 / 404 "Entry not found"

import { NextRequest, NextResponse } from "next/server";
import { qp, num, NOW, notFound, noContent, badRequest } from "@/lib/api-helpers";
import { requireTenant } from "@/lib/auth/require-tenant";
import {
  CATALOG_CFGS,
  type DictCfg,
  listDictDb,
  createDictDb,
  putDictDb,
  deleteDictDb,
  isDbUnavailable,
} from "@/lib/db-queries";

export type CatalogFamily = keyof typeof CATALOG_CFGS;

function dbUnavailable() {
  return NextResponse.json(
    { code: "DB_UNAVAILABLE", message: "检查 DATABASE_URL / npm run seed:db" },
    { status: 503 },
  );
}

export async function catalogGet(cfg: DictCfg, req: NextRequest) {
  // token 化（2026-09-23）：catalog 4 表按 token 租户过滤（aspnetcore
  // CatalogController 全 16 端点 _tenantContext.TenantId 同语义）
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const url = qp(req);
    // fixture 版 catalogGet 不支持 keyword（query 里给了也静默忽略）——不传即同语义
    return NextResponse.json(
      await listDictDb(auth.tenantId, cfg, {
        direct: { inspectionObjectCode: url.get("inspectionObjectCode") ?? "" },
        page: num(url.get("page"), 1),
        pageSizeParam: url.get("pageSize"),
      }),
    );
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}

export async function catalogPost(cfg: DictCfg, req: NextRequest) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  // fixture 版 catalogPost 的强转兜底原样保留（code/name 空串也放行，无 code/name 必填校验）
  const entry = {
    code: String(body.code ?? ""),
    name: String(body.name ?? ""),
    sortOrder: Number(body.sortOrder ?? 0),
    createdAt: NOW(),
    updatedAt: NOW(),
    ...body,
  };
  try {
    const res = await createDictDb(auth.tenantId, cfg, entry);
    if (!res.ok) return badRequest(res.message);
    return NextResponse.json(res.row, { status: 201 });
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}

export async function catalogPut(cfg: DictCfg, req: NextRequest, code: string) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const row = await putDictDb(auth.tenantId, cfg, code, body);
    if (!row) return notFound("Entry not found");
    return NextResponse.json(row);
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}

export async function catalogDelete(cfg: DictCfg, req: NextRequest, code: string) {
  const auth = requireTenant(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const ok = await deleteDictDb(auth.tenantId, cfg, code);
    if (!ok) return notFound("Entry not found");
    return noContent();
  } catch (e) {
    if (isDbUnavailable(e)) return dbUnavailable();
    throw e;
  }
}
