// auth-context 模块引导回归（无 mock —— 本文件的存在意义就是加载真模块）。
// 注意：测试标题不带 M/F/I 字面（fnReporter 正则会误吸作 functional coverage）。
import { describe, expect, it } from "vitest";
import axios from "axios";
// import 副作用即被测行为：模块作用域安装 axios 拦截器
import "@/state/auth-context";

describe("auth-context 模块引导", () => {
  it("模块加载即装 axios 拦截器（withCredentials 依赖它）", () => {
    // 回归：installHttpClient 此前全仓无人调用，拦截器（withCredentials/
    // baseURL/Bearer）是死代码 → 跨源 XHR 不带 credentials，浏览器丢弃 authorize
    // 响应的 Set-Cookie → SSO callback 恒 "missing lab_sso_state cookie" 500。
    // 安装点必须在任何 effect 发请求之前：模块作用域（子组件 effect 先于父
    // effect，放 AuthProvider useEffect 会晚于 login 页 authorize）。
    const handlers = axios.interceptors.request.handlers as Array<{
      fulfilled?: unknown;
    } | null>;
    expect(handlers.some((h) => h?.fulfilled)).toBe(true);
  });
});
