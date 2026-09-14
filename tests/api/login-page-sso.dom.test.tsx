// LoginPage SSO authorize 防重入回归测试（StrictMode dev 双调 effect 场景）。
// 注意：测试标题不带 M/F/I 字面（fnReporter 正则会误吸作 functional coverage）。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { render, waitFor } from "@testing-library/react";
import LoginPage from "@/app/login/page";

const { authorizeMock, routerRef, stableSetToken } = vi.hoisted(() => ({
  authorizeMock: vi.fn(),
  routerRef: { current: { replace: () => {} } },
  // setToken 必须是稳定引用：真实 app 里 context 的 setToken 恒定；
  // 若每次 useAuth() 造新 fn，effect 依赖 [setToken] 每次重渲染都变 → effect 重跑，
  // 那是 mock 噪音不是防重入要测的场景
  stableSetToken: vi.fn(),
}));

vi.mock("@/api/endpoints/endpoints", () => ({
  authSsoAuthorize: authorizeMock,
  authSsoCallback: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => routerRef.current,
}));
vi.mock("@/state/auth-context", () => ({
  useAuth: () => ({ token: null, setToken: stableSetToken }),
}));
vi.mock("@/api/backend-config", () => ({
  getApiBaseUrl: () => "http://localhost:5204",
  getApiMode: () => "msw",
}));
// 与 getApiMode 返回值对齐：否则 mount 后 setApiMode(getApiMode()) 与初始
// useState(env.NEXT_PUBLIC_API_MODE) 不一致会触发一次重渲染（测试噪音）
vi.mock("@/api/env", () => ({
  env: {
    NEXT_PUBLIC_API_MODE: "msw",
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:5204",
  },
}));

describe("LoginPage SSO authorize 防重入", () => {
  beforeEach(() => {
    authorizeMock.mockReset();
    sessionStorage.clear();
  });

  it("StrictMode 双调 effect 时 authorize 只发起一次（state 不被覆盖）", async () => {
    authorizeMock.mockResolvedValue({ authorizeUrl: "" });
    render(
      <StrictMode>
        <LoginPage />
      </StrictMode>,
    );
    await waitFor(() => expect(authorizeMock).toHaveBeenCalledTimes(1));
    // 给 StrictMode 第二次 effect / 微任务链留出时间窗
    await new Promise((r) => setTimeout(r, 50));
    expect(authorizeMock).toHaveBeenCalledTimes(1);
  });

  it("authorize 失败后防重入 ref 复位，允许后续重试", async () => {
    authorizeMock
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue({ authorizeUrl: "" });
    const view = render(
      <StrictMode>
        <LoginPage />
      </StrictMode>,
    );
    await waitFor(() => expect(authorizeMock).toHaveBeenCalledTimes(1));
    // 换 router 引用触发依赖变化重跑（模拟真实依赖更新）
    routerRef.current = { replace: () => {} };
    view.rerender(
      <StrictMode>
        <LoginPage />
      </StrictMode>,
    );
    await waitFor(() => expect(authorizeMock).toHaveBeenCalledTimes(2));
  });
});
