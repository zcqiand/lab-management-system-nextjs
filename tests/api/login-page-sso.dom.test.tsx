// LoginPage SSO authorize 防重入回归测试（StrictMode dev 双调 effect 场景）。
// 注意：测试标题不带 M/F/I 字面（fnReporter 正则会误吸作 functional coverage）。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { render, waitFor } from "@testing-library/react";
import LoginPage from "@/app/login/page";

const { authorizeMock, callbackMock, routerRef, stableSetToken } = vi.hoisted(() => ({
  authorizeMock: vi.fn(),
  callbackMock: vi.fn(),
  routerRef: { current: { replace: () => {} } },
  // setToken 必须是稳定引用：真实 app 里 context 的 setToken 恒定；
  // 若每次 useAuth() 造新 fn，effect 依赖 [setToken] 每次重渲染都变 → effect 重跑，
  // 那是 mock 噪音不是防重入要测的场景
  stableSetToken: vi.fn(),
}));

vi.mock("@/api/endpoints/endpoints", () => ({
  authSsoAuthorize: authorizeMock,
  authSsoCallback: callbackMock,
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
    callbackMock.mockReset();
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

describe("LoginPage SSO callback 防重入", () => {
  beforeEach(() => {
    authorizeMock.mockReset();
    callbackMock.mockReset();
    sessionStorage.clear();
    // 回到无参数路径，避免上个用例的 URL 泄漏进下个用例
    window.history.replaceState(null, "", "/login");
  });

  it("StrictMode 双调 effect 时 callback 只 POST 一次（saas code 一次性）", async () => {
    // 回归：callback 分支此前没有防重入守卫，StrictMode dev 双调 effect →
    // 同一 code POST 两次 → saas 单次有效，第二发恒 400
    // INVALID_GRANT「code 不存在或已被使用」。
    callbackMock.mockResolvedValue({ token: "t-1" });
    sessionStorage.setItem("lab.sso.state", "st-1");
    window.history.replaceState(null, "", "/login?code=cd-1&state=st-1");

    render(
      <StrictMode>
        <LoginPage />
      </StrictMode>,
    );

    await waitFor(() => expect(callbackMock).toHaveBeenCalledTimes(1));
    // 给 StrictMode 第二次 effect / 微任务链留出时间窗
    await new Promise((r) => setTimeout(r, 50));
    expect(callbackMock).toHaveBeenCalledTimes(1);
  });

  it("发起后端与当前后端不一致 → 不 POST 旧 code，直接对新后端重走 authorize", async () => {
    // 回归：三个 lab 后端同 host 不同端口 —— cookie 按 host 共享、saas code 与
    // 旧后端 authorize 配对，切后端后把旧 code POST 给新后端必吃 INVALID_GRANT
    // 死锁（saas 单次有效）。自愈 = 识别后端切换，清残留重走。
    authorizeMock.mockResolvedValue({ authorizeUrl: "" });
    sessionStorage.setItem("lab.sso.state", "st-1");
    sessionStorage.setItem("lab.sso.backend", "http://localhost:5205");
    window.history.replaceState(null, "", "/login?code=cd-1&state=st-1");

    render(
      <StrictMode>
        <LoginPage />
      </StrictMode>,
    );

    await waitFor(() => expect(authorizeMock).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 50));
    // 旧 code 绝不发给当前后端
    expect(callbackMock).not.toHaveBeenCalled();
    // URL 残留 code/state 已清（防 reload 再走一遍陈旧流程）
    expect(window.location.search).toBe("");
  });

  it("callback 失败 → 自动重走一次 authorize 而不是挂死", async () => {
    callbackMock.mockRejectedValue(new Error("INVALID_GRANT"));
    authorizeMock.mockResolvedValue({ authorizeUrl: "" });
    sessionStorage.setItem("lab.sso.state", "st-1");
    sessionStorage.setItem("lab.sso.backend", "http://localhost:5204");
    window.history.replaceState(null, "", "/login?code=cd-1&state=st-1");

    render(
      <StrictMode>
        <LoginPage />
      </StrictMode>,
    );

    await waitFor(() => expect(authorizeMock).toHaveBeenCalledTimes(1));
    expect(callbackMock).toHaveBeenCalledTimes(1);
    // 重走上限 1：不会无限 authorize 循环
    await new Promise((r) => setTimeout(r, 50));
    expect(authorizeMock).toHaveBeenCalledTimes(1);
  });
});
