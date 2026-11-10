// M06.F08 — /api/param-interfaces POST 校验 fnTest（ADR-0056 动态表单改造语义回放）：
//   - componentPath 已随契约删除：不再必填（旧实现缺 componentPath 返 400 → 现应 201）
//   - config 升级为表单结构 schema：body.config 存在但非对象 → 400 BAD_REQUEST
//   - version 服务端管理：body 缺 version 时落 1
// 直接 import 路由 handler（同 test-records.dom 模式），测完清理不留种子。
import { describe, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/param-interfaces/route";
import { LabJwtSigner } from "@/lib/auth/jwt";
import { fnTest } from "../fn";

const signer = new LabJwtSigner(
  "dev-key-32-bytes-minimum-length!",
  "lab-management-system",
  3600,
  604800,
);
const AUTHZ = `Bearer ${signer.issue("USER-A", "acme")}`;

function post(body: unknown) {
  return POST(
    new NextRequest("http://test/api/param-interfaces", {
      method: "POST",
      headers: { authorization: AUTHZ, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("param-interfaces POST (ADR-0056 动态表单契约)", () => {
  fnTest(
    ["M06.F08.I01"],
    "POST 无 componentPath → 201（componentPath 已随契约删除，不再必填）",
    async () => {
      const res = await post({ code: "PI-TEST-NOCOMP", name: "无组件路径卡" });
      expect(res.status).toBe(201);
      const created = (await res.json()) as { code: string };
      expect(created.code).toBe("PI-TEST-NOCOMP");

      const { fixturesSingleton } = await import("@/lib/fixtures-runtime");
      const arr = fixturesSingleton.inspectionParamInterfaces as unknown as Array<
        Record<string, unknown>
      >;
      const idx = arr.findIndex((r) => r["code"] === "PI-TEST-NOCOMP");
      if (idx >= 0) arr.splice(idx, 1);
    },
  );

  fnTest(["M06.F08.I01"], "POST config 非对象（数组）→ 400 BAD_REQUEST", async () => {
    const res = await post({
      code: "PI-TEST-BADCFG",
      config: ["not", "an", "object"],
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("BAD_REQUEST");
  });

  fnTest(["M06.F08.I01"], "POST 缺 version → 落服务端缺省 1", async () => {
    const res = await post({ code: "PI-TEST-NOVER", name: "缺版本卡" });
    expect(res.status).toBe(201);
    const created = (await res.json()) as { version: number };
    expect(created.version).toBe(1);

    const { fixturesSingleton } = await import("@/lib/fixtures-runtime");
    const arr = fixturesSingleton.inspectionParamInterfaces as unknown as Array<
      Record<string, unknown>
    >;
    const idx = arr.findIndex((r) => r["code"] === "PI-TEST-NOVER");
    if (idx >= 0) arr.splice(idx, 1);
  });
});
