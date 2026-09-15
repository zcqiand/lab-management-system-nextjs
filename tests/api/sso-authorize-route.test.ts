// GET /api/auth/sso/authorize 跳板语义回归。
//
// 契约（镜像 lab-springboot AuthService.ssoAuthorize 2026-08-29 标准化同款语义）：
//   200 + { authorizeUrl, state }，authorizeUrl 是 saas 登录页跳板 URL
//   （${SAAS_UI_BASE_URL}/login?redirect_uri=&state=&client_id=）。
//   服务端不得匿名预拿 code——saas /oauth/authorize 已收敛为必须认证身份
//   （code 绑 Bearer sub + tenant_id claim），匿名预拿恒 401，
//   此前表现为登录页 502 SSO_AUTHORIZE_FAILED「saas session or Bearer token required」。
// 用户在 saas 登录后由 saas 前端带 session 自动调 authorize 签 code → 302 回跳。
// 注意：测试标题不带 M/F/I 字面（fnReporter 正则会误吸作 functional coverage）。
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

function makeRequest(query: string): Request {
  return new Request(
    `http://localhost:5201/api/auth/sso/authorize?${query}`,
  );
}

describe("GET /api/auth/sso/authorize 跳板语义", () => {
  beforeEach(() => {
    process.env.SAAS_UI_BASE_URL = "http://localhost:5101";
    process.env.SAAS_OAUTH_CLIENT_ID = "lab-management";
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockClear();
  });

  it("返回 saas 登录页跳板 URL，不做服务端 code 预拿（不发 saas 请求）", async () => {
    const { GET } = await import("@/app/api/auth/sso/authorize/route");
    const res = await GET(
      makeRequest(
        "response_type=code&client_id=lab-management&redirect_uri=http%3A%2F%2Flocalhost%3A5201%2Flogin&state=st-abc",
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { authorizeUrl: string; state: string };
    expect(body.state).toBe("st-abc");
    const u = new URL(body.authorizeUrl);
    expect(u.origin + u.pathname).toBe("http://localhost:5101/login");
    expect(u.searchParams.get("client_id")).toBe("lab-management");
    expect(u.searchParams.get("redirect_uri")).toBe("http://localhost:5201/login");
    expect(u.searchParams.get("state")).toBe("st-abc");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("缺 state 仍 400（CSRF 安全参数不放宽）", async () => {
    const { GET } = await import("@/app/api/auth/sso/authorize/route");
    const res = await GET(
      makeRequest(
        "response_type=code&client_id=lab-management&redirect_uri=http%3A%2F%2Flocalhost%3A5201%2Flogin",
      ),
    );
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("response_type 非 code 仍 400", async () => {
    const { GET } = await import("@/app/api/auth/sso/authorize/route");
    const res = await GET(
      makeRequest(
        "response_type=token&client_id=lab-management&redirect_uri=http%3A%2F%2Flocalhost%3A5201%2Flogin&state=st-abc",
      ),
    );
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
