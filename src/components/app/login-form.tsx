"use client";

// 客户端化包装 /api/auth/login（nextjs 即后端 模式）。
// 走 apiclient 的 backend-config 拿 baseUrl——同源时走本仓 src/app/api/auth/login/route.ts。
//
// ADR-0014：runtime backend mode 切换已废弃；baseUrl 由 NEXT_PUBLIC_API_BASE_URL 决定。

import { useState } from "react";
import { authLogin } from "@/api/endpoints/endpoints";
import { getApiBaseUrl, getApiMode } from "@/api/backend-config";

export function LoginForm() {
  const baseUrl = getApiBaseUrl();
  const apiMode = getApiMode();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("dev123456");
  const [result, setResult] = useState<string>("");

  async function onLogin() {
    try {
      const res = await authLogin(
        { username, password },
        { baseURL: baseUrl },
      );
      setResult(
        `mode=${apiMode} baseUrl=${JSON.stringify(baseUrl)}\nlogin OK → token=${(res as { token?: string }).token ?? "(no token)"}`,
      );
    } catch (e) {
      setResult(`mode=${apiMode} baseUrl=${JSON.stringify(baseUrl)}\nlogin FAIL: ${(e as Error).message}`);
    }
  }

  return (
    <div className="space-y-2">
      <div>
        <label className="block text-xs">用户名</label>
        <input
          className="border rounded px-2 py-1 text-sm w-full font-mono"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs">密码</label>
        <input
          type="password"
          className="border rounded px-2 py-1 text-sm w-full font-mono"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <button
        onClick={onLogin}
        data-testid="login-submit"
        className="border rounded px-3 py-1 text-sm"
      >
        登录（POST /api/auth/login）
      </button>
      <pre className="text-xs whitespace-pre-wrap bg-gray-100 p-2 rounded">{result}</pre>
    </div>
  );
}