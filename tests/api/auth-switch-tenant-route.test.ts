// POST /api/auth/switch-tenant 密码登录会话租户体系回归（REQ-2026-023 live 实证）。
//
// 现场：登录响应 tenants / JWT tenant_id claim 已是 saas 租户体系（REQ-2026-023：
// tenant_id=saas currentTenantId ?? 首租户），但本 route 校验写死 DEMO_TENANTS
// （TENANT-00x 字面量）→ 密码登录用户拿登录响应里的租户切租户 404 NOT_FOUND
// （2026-10-11 contract-test live 五目标同时失败指纹）。
// 契约：M00.F02.I01「校验租户归属后换发」——归属=用户当前会话的租户集
// （membership snapshot，login/sso/callback 写入），demo 列表只作快照 miss 兜底。

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

const SECRET = "dev-key-32-bytes-minimum-length!";
const ISSUER = "lab-management-system";

// saas 真实租户是 UUID 形（live 实测 00000000-…-01），刻意不用 TENANT-00x 字面量
// ——字面量会与 DEMO_TENANTS 撞键，掩盖跨体系失配（本测试的存在理由）。
const SAAS_LOGIN_200 = {
  user: {
    id: "00000000-0000-0000-0000-b00000000001",
    username: "alice",
    email: "alice@saas.local",
    status: "active",
  },
  availableTenants: [
    {
      tenantId: "00000000-0000-0000-0000-000000000001",
      roleIds: ["admin"],
      status: "active",
    },
    {
      tenantId: "00000000-0000-0000-0000-000000000002",
      roleIds: ["technician"],
      status: "active",
    },
  ],
  accessToken: "saas-access-token",
  refreshToken: "saas-refresh-token",
  userId: "00000000-0000-0000-0000-b00000000001",
};

const TENANTS_ITEMS = {
  items: [
    {
      id: "00000000-0000-0000-0000-000000000001",
      name: "市住建工程质量检测中心",
      tenantKey: "city-lab",
    },
    {
      id: "00000000-0000-0000-0000-000000000002",
      name: "区检测站",
      tenantKey: "district-lab",
    },
  ],
};

function installFetchRouter() {
  fetchMock.mockImplementation(async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    const bodyStr = String(init?.body ?? "");
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(bodyStr) as Record<string, unknown>;
    } catch {
      // GET 请求无 body
    }
    if (u.includes("/api/v1/auth/login")) {
      if (parsed.username === "service-svc") {
        return new Response(JSON.stringify({ accessToken: "svc-token" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify(SAAS_LOGIN_200), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (u.includes("/api/v1/admin/tenants")) {
      return new Response(JSON.stringify(TENANTS_ITEMS), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("{}", { status: 404 });
  });
}

beforeEach(async () => {
  process.env.SAAS_IDP_URL = "http://127.0.0.1:5101";
  process.env.LAB_SAAS_CLIENT_ID = "lab-management";
  process.env.LAB_SAAS_SERVICE_USER = "service-svc";
  process.env.LAB_SAAS_SERVICE_PASSWORD = "svc-password";
  process.env.LAB_SAAS_SERVICE_CLIENT_ID = "lab-management";
  process.env.LAB_JWT_SECRET = SECRET;
  process.env.LAB_JWT_ISSUER = ISSUER;
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  installFetchRouter();
  const { __resetMembershipSnapshotCache } =
    await import("@/lib/auth/membership-snapshot");
  __resetMembershipSnapshotCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function postLogin() {
  const { POST } = await import("@/app/api/auth/login/route");
  return POST(
    new Request("http://localhost:5201/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "pw-from-saas" }),
    }),
  );
}

async function postSwitch(token: string, tenantId: string) {
  const { POST } = await import("@/app/api/auth/switch-tenant/route");
  return POST(
    new Request("http://localhost:5201/api/auth/switch-tenant", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tenantId }),
    }),
  );
}

describe("switch-tenant 密码登录会话租户体系（REQ-2026-023 live 回归）", () => {
  it("密码登录后切登录响应里的租户 → 200 + 3 段 JWT + 同体系租户集", async () => {
    const loginRes = await postLogin();
    expect(loginRes.status).toBe(200);
    const loginBody = (await loginRes.json()) as {
      token: string;
      tenants: { tenantId: string }[];
    };
    const tid = loginBody.tenants[0]?.tenantId ?? "";
    expect(tid).toBe("00000000-0000-0000-0000-000000000001");

    const res = await postSwitch(loginBody.token, tid);
    expect(res.status, `switch(登录租户) 期望 200 实得 ${res.status}`).toBe(200);
    const body = (await res.json()) as {
      token: string;
      tenants: { tenantId: string }[];
    };
    expect(body.token.split(".").length).toBe(3);
    expect(body.tenants.some((t) => t.tenantId === tid)).toBe(true);
  });

  it("切不属于用户会话的租户 → 404", async () => {
    const loginRes = await postLogin();
    const loginBody = (await loginRes.json()) as { token: string };
    const res = await postSwitch(loginBody.token, "00000000-0000-0000-0000-00000000dead");
    expect(res.status).toBe(404);
  });
});
