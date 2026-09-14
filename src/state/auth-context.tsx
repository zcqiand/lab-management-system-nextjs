"use client";

// 认证上下文 — token + 当前用户 + 租户列表（M00.F01 当前用户会话 / M00.F02 登录选租户）。
//
// token 存 localStorage（lab.token，原语义不变）；user / tenants / currentTenantId
// 不落盘 —— 页面刷新时由 GET /api/auth/me（带 Bearer）hydrate。
// switchTenant(tenantId)：POST /api/auth/switch-tenant → 换发新 tenant claim 的
// 真 HS256 token → 同页后续请求即落新租户作用域（无需刷新）。

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { authGetCurrentUser, authSwitchTenant } from "@/api/endpoints/endpoints";
import type { CurrentUser, MyTenant } from "@/api/endpoints/endpoints.schemas";
import { getApiBaseUrl } from "@/api/backend-config";
import { installHttpClient } from "@/api/http-client";

const TOKEN_KEY = "lab.token";

// axios 拦截器安装（baseURL / Bearer / withCredentials）：必须在任何 effect 发请求
// 之前就位 —— 子组件 effect 先于父 effect 运行，放 AuthProvider 的 useEffect 会晚于
// login 页的 SSO authorize，所以装在模块作用域（镜像 lab-react main.tsx 引导）。
// 2026-09-14 回归：此前全仓无人调用 installHttpClient，拦截器是死代码 → 跨源 XHR
// 不带 credentials，浏览器丢弃 authorize 响应的 Set-Cookie → SSO callback 恒
// "missing lab_sso_state cookie" 500。window 守卫：SSR 不装（axios 服务端实例共享，
// 且 token getter 读 localStorage）。
if (typeof window !== "undefined") {
  installHttpClient(() => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  });
}

export interface AuthContextValue {
  token: string | null;
  user: CurrentUser | null;
  tenants: MyTenant[];
  currentTenantId: string | null;
  setToken: (token: string | null) => void;
  clearToken: () => void;
  switchTenant: (tenantId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [tenants, setTenants] = useState<MyTenant[]>([]);
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);
  // 防并发 hydrate（token 变化触发多个 effect 轮次时只发一次 /me）
  const hydrating = useRef(false);

  // 同步 hydrate：组件 mount 时从 localStorage 读，避免 SSR/CSR mismatch
  useEffect(() => {
    try {
      const stored = localStorage.getItem(TOKEN_KEY);
      if (stored) setTokenState(stored);
    } catch {
      // localStorage 不可用（隐私模式等）—— silently ignore
    }
  }, []);

  // 会话信息 hydrate：有 token 且无 user → GET /api/auth/me
  // （M00.F01：顶栏 displayName + TenantSwitcher 的数据源）
  useEffect(() => {
    if (!token || user || hydrating.current) return;
    hydrating.current = true;
    authGetCurrentUser({
      headers: { Authorization: `Bearer ${token}` },
      baseURL: getApiBaseUrl(),
    })
      .then((session) => {
        setUser(session.user);
        setTenants(session.tenants ?? []);
        setCurrentTenantId(session.currentTenantId ?? session.tenants?.[0]?.tenantId ?? null);
      })
      .catch(() => {
        // /me 失败（快照 miss / 后端不可达）：不阻断 UI，顶栏显示占位。
        // 401 重定向语义由 useBackendMenus 统一处理，这里不重复。
      })
      .finally(() => {
        hydrating.current = false;
      });
  }, [token, user]);

  const setToken = useCallback((next: string | null) => {
    setTokenState(next);
    try {
      if (next) localStorage.setItem(TOKEN_KEY, next);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
  }, []);

  const clearToken = useCallback(() => {
    setToken(null);
    setUser(null);
    setTenants([]);
    setCurrentTenantId(null);
  }, [setToken]);

  // 切租户：换发带新 tenant claim 的 token，会话不中断（ADR-0019：opaque mock token 已删）
  const switchTenant = useCallback(
    async (tenantId: string) => {
      if (!token) throw new Error("switchTenant requires a token");
      const resp = await authSwitchTenant(
        { tenantId },
        {
          headers: { Authorization: `Bearer ${token}` },
          baseURL: getApiBaseUrl(),
        },
      );
      setToken(resp.token);
      setUser(resp.user);
      setTenants(resp.tenants ?? []);
      setCurrentTenantId(tenantId);
    },
    [token, setToken],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ token, user, tenants, currentTenantId, setToken, clearToken, switchTenant }),
    [token, user, tenants, currentTenantId, setToken, clearToken, switchTenant],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
