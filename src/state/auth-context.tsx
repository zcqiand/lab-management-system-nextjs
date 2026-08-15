"use client";

// Token 上下文 — M98 frontend 接线层 demo 用。
//
// 存 access token（来自 SSO callback）。不存 refresh / user / tenants ——
// 那些走 backend-config 的 session 路径（待补，本仓不重写完整 OAuth 闭环）。

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const TOKEN_KEY = "lab.token";

export interface AuthContextValue {
  token: string | null;
  setToken: (token: string | null) => void;
  clearToken: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);

  // 同步 hydrate：组件 mount 时从 localStorage 读，避免 SSR/CSR mismatch
  useEffect(() => {
    try {
      const stored = localStorage.getItem(TOKEN_KEY);
      if (stored) setTokenState(stored);
    } catch {
      // localStorage 不可用（隐私模式等）—— silently ignore
    }
  }, []);

  const setToken = useCallback((next: string | null) => {
    setTokenState(next);
    try {
      if (next) localStorage.setItem(TOKEN_KEY, next);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
  }, []);

  const clearToken = useCallback(() => setToken(null), [setToken]);

  const value = useMemo<AuthContextValue>(
    () => ({ token, setToken, clearToken }),
    [token, setToken, clearToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
