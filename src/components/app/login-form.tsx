"use client";

// 客户端化包装 /api/auth/login（nextjs 即后端 模式）。
// 走 apiclient 的 backend-config 拿 baseUrl——'nextjs' 模式时同源，
// 走本仓 src/app/api/auth/login/route.ts。

import { useState } from "react";
import { authLogin } from "@/api/endpoints/endpoints";
import { useBackend } from "@/state/backend-context";

export function LoginForm() {
  const { backend, baseUrl } = useBackend();
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
        `mode=${backend} baseUrl=${JSON.stringify(baseUrl)}\nlogin OK → token=${(res as { token?: string }).token ?? "(no token)"}`,
      );
    } catch (e) {
      setResult(`mode=${backend} baseUrl=${JSON.stringify(baseUrl)}\nlogin FAIL: ${(e as Error).message}`);
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
        data-fn="M98.F03.I02"
        className="border rounded px-3 py-1 text-sm"
      >
        登录（POST /api/auth/login）
      </button>
      <pre className="text-xs whitespace-pre-wrap bg-gray-100 p-2 rounded">{result}</pre>
    </div>
  );
}
