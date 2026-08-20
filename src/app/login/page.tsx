"use client";

// SSO 登录 orchestrator（M01.F05.I03，OAuth 2.0 授权码模式 — 镜像 lab-react）
//
// 流程：
//   1. URL 带 ?code=&state= → 验 state（防 CSRF）→ POST /api/auth/sso/callback
//      body {grant_type:authorization_code, code, redirect_uri}
//      → 拿 lab 自家 JWT → 跳 /
//   2. 已有 token → 跳 /
//   3. 否则 → 生成 state 存 sessionStorage → GET /api/auth/sso/authorize
//      query {response_type=code, client_id=lab, redirect_uri=<callback>, state=<random>}
//      → window.location = authorizeUrl（去 saas 登录页）
//
// saas 端目前还没接好（authorize 路由 + /login ?redirect= 解析），
// 所以这条路径在 dev 里只到 msw mock 层就停了 —— 但接口面是对的（OAuth 2.0 RFC 6749）。
// client_secret 仅后端持（部署 env），不入 OpenAPI yaml。

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/state/auth-context";
import { useBackend } from "@/state/backend-context";
import {
  authSsoAuthorize,
  authSsoCallback,
} from "@/api/endpoints/endpoints";

// OAuth 2.0 client_id：lab 在 saas 注册的应用标识。
// 真部署走部署期注入；当前单仓 demo 硬编码。
const OAUTH_CLIENT_ID = "lab";
const SSO_STATE_STORAGE_KEY = "lab.sso.state";

// 生成 OAuth 2.0 state（防 CSRF，RFC 6749 §10.12）
function generateOauthState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// 计算 redirect_uri：lab 自己绝对地址的 /login 路径
function computeRedirectUri(): string {
  if (typeof window === "undefined") return "/login";
  return `${window.location.origin}/login`;
}

export default function LoginPage() {
  const router = useRouter();
  const { token, setToken } = useAuth();
  const { backend, baseUrl } = useBackend();
  const [status, setStatus] = useState<string>("检查登录态...");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);

    // 1. URL 带 code+state（saas OAuth 2.0 回调） → 验 state → POST callback → 存 token → 跳 /
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const fromParam = url.searchParams.get("from");
    if (code && stateParam) {
      const expectedState = sessionStorage.getItem(SSO_STATE_STORAGE_KEY);
      if (!expectedState || expectedState !== stateParam) {
        setStatus("state 校验失败（可能 session 过期或被攻击），请重新登录");
        sessionStorage.removeItem(SSO_STATE_STORAGE_KEY);
        return;
      }
      // state 一次性：验证通过立即清掉
      sessionStorage.removeItem(SSO_STATE_STORAGE_KEY);
      setStatus("拿到 saas code，正在换 token...");
      authSsoCallback(
        {
          grant_type: "authorization_code",
          code,
          redirect_uri: computeRedirectUri(),
        },
        { baseURL: baseUrl },
      )
        .then((resp) => {
          const data = resp as { token?: string };
          if (data.token) {
            setToken(data.token);
            // 清掉 URL 上的 code/state（防 reload 重复触发）
            url.searchParams.delete("code");
            url.searchParams.delete("state");
            window.history.replaceState(null, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : ""));
            router.replace(fromParam ?? "/");
          } else {
            setStatus("code 换 token 失败：响应无 token");
          }
        })
        .catch(() => setStatus("code 换 token 失败，请回到 saas 重试"));
      return;
    }

    // 2. 已有 token → 跳 /
    if (token) {
      setStatus("已登录，正在跳转...");
      router.replace("/");
      return;
    }

    // 3. 调 SSO authorize → 跳 saas
    setStatus(`未登录，正在跳 saas（backend=${backend}）...`);
    const csrfState = generateOauthState();
    sessionStorage.setItem(SSO_STATE_STORAGE_KEY, csrfState);
    authSsoAuthorize(
      {
        response_type: "code",
        client_id: OAUTH_CLIENT_ID,
        redirect_uri: computeRedirectUri(),
        state: csrfState,
      },
      { baseURL: baseUrl },
    )
      .then((res) => {
        const data = res as { authorizeUrl?: string };
        const url = data?.authorizeUrl;
        console.log("[lab/login] authorizeUrl=", url);
        if (url) {
          window.location.href = url;
        } else {
          setStatus("authorizeUrl 缺失，请检查 msw / saas 配置");
          sessionStorage.removeItem(SSO_STATE_STORAGE_KEY);
        }
      })
      .catch((err: unknown) => {
        console.error("[lab/login] authSsoAuthorize failed:", err);
        setStatus(`authorize 调用失败（${backend}）：${(err as Error).message}`);
        sessionStorage.removeItem(SSO_STATE_STORAGE_KEY);
      });
  }, [backend, baseUrl, router, setToken, token]);

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-200 p-4"
      data-fn="M01.F05.I03"
      data-testid="login-page-sso-orchestrator"
    >
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg">实验室管理系统-Next.js</CardTitle>
          <CardDescription>SSO 登录（OAuth 2.0 授权码模式）</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <p>{status}</p>
          <p className="text-xs text-slate-400">
            流程：lab /login → saas /authorize → saas 登录 → 带 code 回 lab /login → lab 后端换 token
          </p>
          <p className="text-xs text-slate-400">
            demo 后端：<span className="font-medium">{backend}</span> · saas 端口：3000
          </p>
          <div className="pt-2 border-t">
            <a href="/" className="text-blue-600 hover:underline text-xs">
              返回首页（BackendSwitcher + 旧 LoginForm）
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}