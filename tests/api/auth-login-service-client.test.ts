// POST /api/auth/login serviceLogin() 发出的 saas 登录请求契约回归。
//
// 契约：saas /api/v1/auth/login LoginRequest 的 clientId 必填——缺了 saas 直接
// 400，serviceLogin warn 后返回 null，登录落空菜单快照（静默断菜单）。
// 5.33 已修 springboot（379b6ee）/aspnetcore（222db63），5.37 本仓对齐：
// body 补 clientId，值取 LAB_SAAS_SERVICE_CLIENT_ID（requireEnv，禁兜底，
// ADR-0019），值形 = oauth_client code（lab-management）。
// 注意：测试标题不带 M/F/I 字面（fnReporter 正则会误吸作 functional coverage）。
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

describe("serviceLogin saas 登录请求契约", () => {
  beforeEach(() => {
    process.env.SAAS_IDP_URL = "http://127.0.0.1:5101";
    process.env.LAB_SAAS_SERVICE_USER = "alice";
    process.env.LAB_SAAS_SERVICE_PASSWORD = "dev123456";
    process.env.LAB_SAAS_SERVICE_CLIENT_ID = "lab-management";
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ accessToken: "tok-abc" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  });

  it("登录请求 body 含 clientId=lab-management（LoginRequest 契约必填）", async () => {
    const { serviceLogin } = await import("@/app/api/auth/login/route");
    const token = await serviceLogin();
    expect(token).toBe("tok-abc");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toBe("http://127.0.0.1:5101/api/v1/auth/login");
    const body = JSON.parse(String(init.body)) as {
      username?: string;
      password?: string;
      clientId?: string;
    };
    expect(body.username).toBe("alice");
    expect(body.password).toBe("dev123456");
    expect(body.clientId).toBe("lab-management");
  });

  it("clientId 未配置时 requireEnv fail-fast（经 catch 转 null，与其他服务凭据同语义）", async () => {
    delete process.env.LAB_SAAS_SERVICE_CLIENT_ID;
    const { serviceLogin } = await import("@/app/api/auth/login/route");
    const token = await serviceLogin();
    expect(token).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
