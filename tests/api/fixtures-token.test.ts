// fixtures 域路由 token 化 — BFF 全域 token 化 P3（ADR-0019）。
//
// 契约（与 aspnetcore 同语义）：
//   租户过滤域（fixtures 行自带 tenantId）：samples / test-records / summary(+stats)
//   / technical-requirements —— GET 按 token 租户过滤、POST stamp claim、
//   复合键路由按 claim 匹配（不匹配 = 404 not-found 语义）
//   认证但全局域：calculation-methods / param-interfaces / inspection links ——
//   只加 401 门，不过滤
// 直接 import 路由 handler + 构造 Request（同 test-records.dom.test.tsx 模式）。
// 注意：测试标题不带 M/F/I 字面（fnReporter 正则会误吸作 functional coverage）。
import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { LabJwtSigner } from "@/lib/auth/jwt";

const signer = new LabJwtSigner(
  "dev-key-32-bytes-minimum-length!",
  "lab-management-system",
  3600,
  604800,
);

const TOKEN_DEMO = `Bearer ${signer.issue("USER-A", "TENANT-001")}`;
const TOKEN_SSO = `Bearer ${signer.issue("USER-A", "00000000-0000-0000-0000-000000000001")}`;

function req(url: string, authz?: string, init?: RequestInit): NextRequest {
  // 路由 handler 形参标注 NextRequest，但只消费 Request 面（url/headers/json）——
  // 裸 Request 断言即可（同 test-records.dom.test.tsx 先例的运行时形状）
  return new Request(url, {
    ...init,
    headers: {
      ...(authz ? { authorization: authz } : {}),
      ...(init?.headers as Record<string, string> | undefined),
    },
  }) as unknown as NextRequest;
}

const BASE = "http://localhost:5201/api";

describe("fixtures 域 token 化（BFF 全域 token 化 P3）", () => {
  // ———— 租户过滤域 ————

  it("samples GET：匿名 401；TENANT-001 token 见种子行；SSO token 空列表", async () => {
    const { GET } = await import("@/app/api/samples/route");
    expect((await GET(req(`${BASE}/samples`))).status).toBe(401);
    const demo = (await (
      await GET(req(`${BASE}/samples`, TOKEN_DEMO))
    ).json()) as { items: Array<{ tenantId: string }>; total: number };
    expect(demo.total).toBeGreaterThan(0);
    expect(demo.items.every((s) => s.tenantId === "TENANT-001")).toBe(true);
    const sso = (await (
      await GET(req(`${BASE}/samples`, TOKEN_SSO))
    ).json()) as { total: number };
    expect(sso.total).toBe(0);
  });

  it("samples POST：匿名 401；token 租户 stamp（body.tenantId 不被信任）", async () => {
    const { POST } = await import("@/app/api/samples/route");
    const body = JSON.stringify({
      receiptId: "R1",
      sampleCode: "TOKENIZED-SAMPLE",
      tenantId: "TENANT-EVIL",
    });
    expect((await POST(req(`${BASE}/samples`, undefined, { method: "POST", body }))).status).toBe(
      401,
    );
    const res = await POST(
      req(`${BASE}/samples`, TOKEN_DEMO, { method: "POST", body }),
    );
    expect(res.status).toBe(201);
    const created = (await res.json()) as { id: string; tenantId: string };
    expect(created.tenantId).toBe("TENANT-001");
    // 清理：fixtures 数组跨测试共享，pop 掉本条
    const { samples } = await import("@lab/management-system-msw/fixtures");
    const i = samples.findIndex((s) => s.id === created.id);
    if (i >= 0) samples.splice(i, 1);
  });

  it("samples [id]：他租户 id 不可见不可改不可删（404 语义）", async () => {
    const { GET, PUT, DELETE } = await import("@/app/api/samples/[id]/route");
    const { samples } = await import("@lab/management-system-msw/fixtures");
    const anyId = String(samples[0]!.id);
    expect((await GET(req(`${BASE}/samples/${anyId}`, TOKEN_SSO), {
      params: { id: anyId },
    } as never)).status).toBe(404);
    expect(
      (
        await PUT(req(`${BASE}/samples/${anyId}`, TOKEN_SSO, {
          method: "PUT",
          body: JSON.stringify({ sampleCode: "hacked" }),
        }), { params: { id: anyId } } as never)
      ).status,
    ).toBe(404);
    expect(
      (await DELETE(req(`${BASE}/samples/${anyId}`, TOKEN_SSO), {
        params: { id: anyId },
      } as never)).status,
    ).toBe(404);
    // 本租户 token 可见（fixtures 种子行未被破坏）
    expect((await GET(req(`${BASE}/samples/${anyId}`, TOKEN_DEMO), {
      params: { id: anyId },
    } as never)).status).toBe(200);
  });

  it("test-records GET：匿名 401；SSO token 空列表", async () => {
    const { GET } = await import("@/app/api/test-records/route");
    expect((await GET(req(`${BASE}/test-records`))).status).toBe(401);
    const sso = (await (
      await GET(req(`${BASE}/test-records`, TOKEN_SSO))
    ).json()) as { total: number };
    expect(sso.total).toBe(0);
  });

  it("summary：匿名 401；SSO token rows 空但形状完整", async () => {
    const { GET } = await import("@/app/api/summary/route");
    expect((await GET(req(`${BASE}/summary`))).status).toBe(401);
    const body = (await (
      await GET(req(`${BASE}/summary?categoryCode=ALL`, TOKEN_SSO))
    ).json()) as { rows: unknown[]; columns: unknown[] };
    expect(body.rows).toEqual([]);
    expect(body.columns.length).toBeGreaterThan(0);
  });

  it("summary/stats：匿名 401；SSO token 计数归零但形状完整", async () => {
    const { GET } = await import("@/app/api/summary/stats/route");
    expect((await GET(req(`${BASE}/summary/stats`))).status).toBe(401);
    const body = (await (
      await GET(req(`${BASE}/summary/stats`, TOKEN_SSO))
    ).json()) as Record<string, unknown>;
    expect(body["receiptCount"]).toBe(0);
    expect(body["funnelByStage"]).toBeDefined();
  });

  it("technical-requirements：匿名 401；TENANT-001 见种子行、SSO 空；POST stamp claim", async () => {
    const { GET, POST } = await import("@/app/api/technical-requirements/route");
    expect((await GET(req(`${BASE}/technical-requirements`))).status).toBe(401);
    const demo = (await (
      await GET(req(`${BASE}/technical-requirements`, TOKEN_DEMO))
    ).json()) as Array<{ tenantId: string }>;
    expect(demo.length).toBeGreaterThan(0);
    expect(demo.every((r) => r.tenantId === "TENANT-001")).toBe(true);
    const sso = (await (
      await GET(req(`${BASE}/technical-requirements`, TOKEN_SSO))
    ).json()) as unknown[];
    expect(sso).toEqual([]);

    const body = JSON.stringify({
      inspectionObjectCode: "OBJ-TOKEN",
      inspectionParameterCode: "IP-TOKEN",
      judgmentStandardCode: "STD-TOKEN",
      tenantId: "TENANT-EVIL",
    });
    expect(
      (await POST(req(`${BASE}/technical-requirements`, undefined, { method: "POST", body })))
        .status,
    ).toBe(401);
    const created = (await (
      await POST(req(`${BASE}/technical-requirements`, TOKEN_SSO, { method: "POST", body }))
    ).json()) as { tenantId: string };
    expect(created.tenantId).toBe("00000000-0000-0000-0000-000000000001");
    // 清理
    const { techReqArr } = await import("@/lib/fixtures-runtime");
    const arr = techReqArr();
    const i = arr.findIndex(
      (r) => String(r["inspectionObjectCode"]) === "OBJ-TOKEN",
    );
    if (i >= 0) arr.splice(i, 1);
  });

  it("technical-requirements 复合键：他租户三元组 404；本租户 200", async () => {
    const { GET: listGet } = await import("@/app/api/technical-requirements/route");
    const first = (
      (await (
        await listGet(req(`${BASE}/technical-requirements`, TOKEN_DEMO))
      ).json()) as Array<Record<string, string>>
    )[0];
    const { GET } = await import(
      "@/app/api/technical-requirements/[id]/[parameter]/[standard]/route"
    );
    const params = {
      id: first!["inspectionObjectCode"],
      parameter: first!["inspectionParameterCode"],
      standard: first!["judgmentStandardCode"],
    };
    expect((await GET(req(`${BASE}/tr-x`, TOKEN_SSO), { params } as never)).status).toBe(404);
    expect((await GET(req(`${BASE}/tr-x`, TOKEN_DEMO), { params } as never)).status).toBe(200);
  });

  // ———— 认证但全局域：只加 401 门 ————

  it("calculation-methods / param-interfaces / inspection links：匿名 401", async () => {
    const { GET: cmGet } = await import("@/app/api/calculation-methods/route");
    expect((await cmGet(req(`${BASE}/calculation-methods`))).status).toBe(401);
    const { GET: piGet } = await import("@/app/api/param-interfaces/route");
    expect((await piGet(req(`${BASE}/param-interfaces`))).status).toBe(401);
    const { GET: linkGet } = await import("@/app/api/inspection/links/object-parameter/route");
    expect((await linkGet(req(`${BASE}/inspection/links/object-parameter`))).status).toBe(401);
  });
});
