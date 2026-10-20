// POST /api/auth/login（native-login 同源复用）账密校验代理化回归。
//
// REQ-2026-023（2026-10-11 人裁方案 A）：登录账密不再本地 LAB_AUTH_DEV_PASSWORD
// 校验，改为用请求体账密调 saas /api/v1/auth/login（clientId=LAB_SAAS_CLIENT_ID），
// saas 200 → 映射 LoginResponse（lab 自家 JWT 重签，refresh 维持 dev-placeholder）；
// 错误映射五仓统一：saas 4xx → 401 INVALID_CREDENTIALS（不透传 saas 内部码），
// saas 5xx/不可达/超时 → 502 SAAS_UNAVAILABLE。
//
// 契约面（LoginResponse 成员集 / MyTenant 四字段 / 错误状态族）不变 —— contract-test
// normalize 不动；本文件锁的是实现语义与映射形状（user 来自 saas、租户名富化
// best-effort 降级、clientId 透传、菜单快照 serviceLogin 路径不回归）。
//
// 注意：测试标题不带 M/F/I 字面（fnReporter 正则会误吸作 functional coverage）。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LabJwtSigner } from "@/lib/auth/jwt";

const fetchMock = vi.fn();

const SECRET = "dev-key-32-bytes-minimum-length!";
const ISSUER = "lab-management-system";
const SIGNER = new LabJwtSigner(SECRET, ISSUER, 3600, 604800);

const SAAS_LOGIN_200 = {
  user: {
    id: "saas-user-alice",
    username: "alice",
    email: "alice@saas.local",
    status: "active",
  },
  availableTenants: [
    { tenantId: "TENANT-001", roleIds: ["admin"], status: "active" },
    { tenantId: "TENANT-002", roleIds: ["technician"], status: "active" },
  ],
  accessToken: "saas-access-token",
  refreshToken: "saas-refresh-token",
  userId: "saas-user-alice",
  clientId: "lab-management",
  tokenType: "Bearer",
  expiresIn: 3600,
};

const TENANTS_ITEMS = {
  items: [
    { id: "TENANT-001", name: "市住建工程质量检测中心", tenantKey: "city-lab" },
    { id: "TENANT-002", name: "区检测站", tenantKey: "district-lab" },
  ],
};

/** fetch 桩路由：按 URL+method 分流（代理登录 / 租户富化 / serviceLogin 同 URL 按 body 区分）。 */
function installFetchRouter(opts: {
  proxyStatus?: number;
  proxyBody?: unknown;
  proxyReject?: Error;
  tenantsStatus?: number;
}) {
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
      if (opts.proxyReject) throw opts.proxyReject;
      // 代理调用与 serviceLogin 同 URL——按 username 分流：service 账号在
      // beforeEach 里 seed 成 service-svc，代理用例走 alice。
      if (parsed.username === "service-svc") {
        return new Response(JSON.stringify({ accessToken: "svc-token" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify(opts.proxyBody ?? SAAS_LOGIN_200), {
        status: opts.proxyStatus ?? 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (u.includes("/api/v1/admin/tenants")) {
      return new Response(JSON.stringify(TENANTS_ITEMS), {
        status: opts.tenantsStatus ?? 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("{}", { status: 404 });
  });
}

async function postLogin(username: string, password: string) {
  const { POST } = await import("@/app/api/auth/login/route");
  const req = new Request("http://localhost:5201/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return POST(req);
}

beforeEach(() => {
  process.env.SAAS_IDP_URL = "http://127.0.0.1:5101";
  process.env.LAB_SAAS_CLIENT_ID = "lab-management";
  process.env.LAB_SAAS_SERVICE_USER = "service-svc";
  process.env.LAB_SAAS_SERVICE_PASSWORD = "svc-password";
  process.env.LAB_SAAS_SERVICE_CLIENT_ID = "lab-management";
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("原生登录代理 saas IdP（REQ-2026-023）", () => {
  it("saas 200 → lab 200：user/tenants 来自 saas 映射，租户名富化，token 为 lab 自签 JWT", async () => {
    installFetchRouter({});
    const res = await postLogin("alice", "pw-123");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      token: string;
      refreshToken: string;
      user: { id: string; username: string; displayName?: string; roleCode?: string };
      tenants: Array<{ tenantId: string; code: string; name: string; roleIds: string[] }>;
    };
    // user 映射自 saas user（id/username 直取）
    expect(body.user.id).toBe("saas-user-alice");
    expect(body.user.username).toBe("alice");
    // saas user 无 displayName → 回退链（||，防空串陷阱）落到 username
    expect(body.user.displayName).toBe("alice");
    // roleCode = 首租户 roleIds[0]
    expect(body.user.roleCode).toBe("admin");
    // tenants 四字段齐全 + admin/tenants 富化真名/tenantKey
    expect(body.tenants).toHaveLength(2);
    // 2026-10-20 租户标识=tenant_key（人裁「对外交互用 key」）：命中租户 tenantId=tenantKey
    expect(body.tenants[0]).toEqual({
      tenantId: "city-lab",
      code: "city-lab",
      name: "市住建工程质量检测中心",
      roleIds: ["admin"],
    });
    // lab 自家 JWT 重签（可被本仓 signer 验签；tenant_id 取首租户）
    const claims = SIGNER.verify(body.token);
    expect(claims.sub).toBe("saas-user-alice");
    expect(claims.tenant_id).toBe("city-lab");
    expect(claims.iss).toBe(ISSUER);
    // refreshToken 维持 dev-placeholder（不透传 saas refreshToken）
    const refreshPayload = JSON.parse(
      Buffer.from(body.refreshToken.split(".")[1]!, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    expect(refreshPayload.saas_refresh_token).toBe("dev-refresh-token-placeholder");
  });

  it("出站 LoginRequest：clientId=LAB_SAAS_CLIENT_ID，username/password 原值透传", async () => {
    installFetchRouter({});
    await postLogin("alice", "pw-123");
    const proxyCall = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(proxyCall[0])).toBe("http://127.0.0.1:5101/api/v1/auth/login");
    const out = JSON.parse(String(proxyCall[1].body)) as {
      username: string;
      password: string;
      clientId: string;
    };
    expect(out.username).toBe("alice");
    expect(out.password).toBe("pw-123");
    expect(out.clientId).toBe("lab-management");
  });

  it("租户富化失败（admin/tenants 5xx）→ 整体仍 200，降级 code/name=tenantId", async () => {
    installFetchRouter({ tenantsStatus: 500 });
    const res = await postLogin("alice", "pw-123");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tenants: Array<{ tenantId: string; code: string; name: string }>;
    };
    expect(body.tenants[0]).toMatchObject({
      tenantId: "TENANT-001",
      code: "TENANT-001",
      name: "TENANT-001",
    });
  });

  it("saas 4xx → lab 401 INVALID_CREDENTIALS（不透传 saas 内部码）", async () => {
    for (const status of [400, 401, 403]) {
      fetchMock.mockReset();
      installFetchRouter({
        proxyStatus: status,
        proxyBody: { code: "UNAUTHORIZED", message: "x" },
      });
      const res = await postLogin("alice", "wrong-password");
      expect(res.status, `saas ${status} 应映射 401`).toBe(401);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe("INVALID_CREDENTIALS");
    }
  });

  it("saas 5xx / 连接不可达 → 502 SAAS_UNAVAILABLE", async () => {
    fetchMock.mockReset();
    installFetchRouter({ proxyStatus: 503 });
    const res = await postLogin("alice", "pw-123");
    expect(res.status).toBe(502);
    let body = (await res.json()) as { code: string };
    expect(body.code).toBe("SAAS_UNAVAILABLE");

    fetchMock.mockReset();
    installFetchRouter({ proxyReject: new Error("connect ECONNREFUSED") });
    const res2 = await postLogin("alice", "pw-123");
    expect(res2.status).toBe(502);
    body = (await res2.json()) as { code: string };
    expect(body.code).toBe("SAAS_UNAVAILABLE");
  });

  it("菜单快照不回归：代理成功后仍走服务账号 serviceLogin 拉菜单（REQ-2026-023 非目标）", async () => {
    installFetchRouter({});
    await postLogin("alice", "pw-123");
    const loginCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("/api/v1/auth/login"),
    );
    // 第 1 次 = 代理（username=alice），第 2 次 = serviceLogin（username=service-svc）
    expect(loginCalls).toHaveLength(2);
    const svcBody = JSON.parse(String((loginCalls[1]![1] as RequestInit).body)) as {
      username: string;
      clientId: string;
    };
    expect(svcBody.username).toBe("service-svc");
    expect(svcBody.clientId).toBe("lab-management");
    // 租户富化调用也发生
    expect(
      fetchMock.mock.calls.some((c) => String(c[0]).includes("/api/v1/admin/tenants")),
    ).toBe(true);
  });

  it("空账密 400 且不出站（fetch 零调用）", async () => {
    installFetchRouter({});
    const res = await postLogin("", "");
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("源码回归锁：LAB_AUTH_DEV_PASSWORD / checkPassword 读点已退役（AC-5）", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    for (const rel of [
      "src/app/api/auth/login/route.ts",
      "src/lib/auth/factory.ts",
      "src/lib/auth/directory.ts",
      "src/lib/auth/config.ts",
      "tests/setup.ts",
    ]) {
      const raw = fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
      // 剥行/块注释后匹配——退役说明允许留在注释里，锁的是代码读点。
      const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(src, `${rel} 不得再引用 LAB_AUTH_DEV_PASSWORD`).not.toMatch(
        /LAB_AUTH_DEV_PASSWORD|Lab__Auth__DevPassword/,
      );
      if (rel.endsWith("directory.ts") || rel.endsWith("config.ts")) {
        expect(src, `${rel} 不得再有 checkPassword 本地校验路径`).not.toMatch(
          /checkPassword/,
        );
      }
    }
  });
});
