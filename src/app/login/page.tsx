"use client";

// SSO 登录 orchestrator（M98 demo，不进 function tree）
//
// 流程：
//   1. URL 带 ?token= 或 ?code=&state= → 存 token，跳 /
//   2. localStorage 有 token → 跳 /
//   3. 否则 → 调 authSsoAuthorize({ redirect: <current-url> }) 拿 authorizeUrl
//      → window.location = authorizeUrl（去 saas 登录页）
//   4. saas 登录完会带 token 回到 /login，走第 1 步
//
// saas 端目前还没接好（authorize 路由 + /login ?redirect= 解析），
// 所以这条路径在 dev 里只到 msw mock 层就停了 —— 但接口面是对的。

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
import { authSsoAuthorize } from "@/api/endpoints/endpoints";

export default function LoginPage() {
  const router = useRouter();
  const { token, setToken } = useAuth();
  const { backend, baseUrl } = useBackend();
  const [status, setStatus] = useState<string>("检查登录态...");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);

    // 1. URL 带 token / code+state（saas 回调回来） → 存，跳 /
    const tokenParam = url.searchParams.get("token");
    if (tokenParam) {
      setToken(tokenParam);
      setStatus("登录成功，正在跳转...");
      router.replace("/");
      return;
    }
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (code && state) {
      setStatus("拿到 saas code，正在换 token...");
      // 真实链路：调 authSsoCallback({ code, state })；msw 直接给 mock token
      fetch(`${baseUrl}/api/auth/sso/callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, state }),
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(r)))
        .then((data: { token?: string }) => {
          if (data.token) setToken(data.token);
          router.replace("/");
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
    const redirectTo = encodeURIComponent(`${window.location.origin}/login`);
    authSsoAuthorize({ redirect: redirectTo }, { baseURL: baseUrl })
      .then((res) => {
        const data = (res as { data?: { authorizeUrl?: string } }).data;
        const url = data?.authorizeUrl;
        console.log("[lab/login] authorizeUrl=", url);
        if (url) {
          window.location.href = url;
        } else {
          setStatus("authorizeUrl 缺失，请检查 msw / saas 配置");
        }
      })
      .catch((err: unknown) => {
        console.error("[lab/login] authSsoAuthorize failed:", err);
        setStatus(`authorize 调用失败（${backend}）：${(err as Error).message}`);
      });
  }, [backend, baseUrl, router, setToken, token]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-200 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg">实验室管理系统-Next.js</CardTitle>
          <CardDescription>SSO 登录（委托 saas 身份平台）</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <p>{status}</p>
          <p className="text-xs text-slate-400">
            流程：lab /login → saas /login → 带 token 回 lab /login → 跳 /
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
