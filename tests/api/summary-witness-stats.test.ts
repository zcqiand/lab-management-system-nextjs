// summary/stats 见证取样扩展 — BFF 路由层（B 通道：契约外加字段，shared 批后转正）。
// 直接 import 路由 handler + 构造 Request（同 fixtures-token.test.ts 模式）。
// 注意：测试标题不带 M/F/I 字面（fnReporter 正则会误吸作 functional coverage）。
// 契约欠账：witnessStats 未进 shared DashboardStats——兄弟仓实现时须走 shared tsp 正门。
import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { LabJwtSigner } from "@/lib/auth/jwt";

const signer = new LabJwtSigner(
  "dev-key-32-bytes-minimum-length!",
  "lab-management-system",
  3600,
  604800,
);

const TOKEN_SSO = `Bearer ${signer.issue("USER-A", "00000000-0000-0000-0000-000000000001")}`;

function req(url: string, authz?: string): NextRequest {
  return new Request(url, {
    headers: authz ? { authorization: authz } : {},
  }) as unknown as NextRequest;
}

const BASE = "http://localhost:5201/api";

describe("summary/stats 见证扩展（BFF 路由层）", () => {
  it("匿名 401；SSO token 响应含 witnessStats 形状与不变式", async () => {
    const { GET } = await import("@/app/api/summary/stats/route");
    expect((await GET(req(`${BASE}/summary/stats`))).status).toBe(401);
    const res = await GET(req(`${BASE}/summary/stats`, TOKEN_SSO));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    const w = body["witnessStats"] as {
      requireWitness: number;
      witnessed: number;
      witnessRate: number;
      details: Array<Record<string, unknown>>;
    };
    expect(w).toBeDefined();
    expect(typeof w.requireWitness).toBe("number");
    expect(typeof w.witnessed).toBe("number");
    expect(typeof w.witnessRate).toBe("number");
    expect(Array.isArray(w.details)).toBe(true);
    expect(w.witnessRate).toBeGreaterThanOrEqual(0);
    expect(w.witnessRate).toBeLessThanOrEqual(1);
    expect(w.witnessed).toBeLessThanOrEqual(w.requireWitness);
    expect(w.details.length).toBe(w.requireWitness);
    // 既有字段不受扩展影响（向后兼容）
    expect(body["funnelByStage"]).toBeDefined();
    expect(body["todayTestCount"]).toBeDefined();
  });
});
