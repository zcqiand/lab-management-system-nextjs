import { afterEach, describe, expect, it } from "vitest";
import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { installHttpClient } from "@/api/http-client";

// 跨源后端（aspnetcore/springboot/msw）的 SSO state cookie 依赖 withCredentials：
// 没有它，authorize 响应的 Set-Cookie 不被浏览器存储、callback 也不携带，
// lab-aspnetcore StateCookieManager 直接 "missing lab_sso_state cookie" → 500。
// 镜像 lab-react / lab-vue http-client 同款约束（后端 CORS 已 AllowCredentials）。
describe("installHttpClient", () => {
  const originalAdapter = axios.defaults.adapter;

  afterEach(() => {
    axios.defaults.adapter = originalAdapter;
  });

  it("request carries withCredentials=true for cross-origin SSO state cookie", async () => {
    let captured: InternalAxiosRequestConfig | undefined;
    axios.defaults.adapter = async (config) => {
      captured = config;
      return {
        data: {},
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      } as AxiosResponse;
    };

    installHttpClient(() => null);
    await axios.get("http://localhost:5204/api/auth/sso/authorize");

    expect(captured?.withCredentials).toBe(true);
  });

  it("repeated install replaces the interceptor instead of piling up", () => {
    axios.interceptors.request.clear();
    installHttpClient(() => null);
    installHttpClient(() => "newer-token");
    const active = (
      axios.interceptors.request.handlers as Array<{ fulfilled?: unknown } | null>
    ).filter((h) => h?.fulfilled);
    // 两个 token getter 只留一个拦截器：新 getter 生效，旧闭包不残留
    expect(active).toHaveLength(1);
  });
});
