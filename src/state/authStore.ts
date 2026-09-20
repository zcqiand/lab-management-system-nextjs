import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CurrentUser } from "@/api/endpoints/model";
import { authLogin, authGetPermissions } from "@/api/endpoints/auth/auth";

/**
 * 认证会话的用户视图（lab 侧）——契约 CurrentUser 加 permissions 快照。
 * permissions 由 GET /api/auth/permissions 在 SSO 会话建立时并入（M01.F05.I04），
 * 契约里它属于 PermissionSet 端点而非 CurrentUser 本体，故在此扩展而非改契约镜像。
 */
export type User = CurrentUser & { permissions?: string[] };

/** 认证状态机 */
type AuthStatus = "idle" | "loading" | "authenticated" | "error";

/** 认证状态切片（原 @/types/store AuthState，TSOT 清理 Phase C2 内联） */
interface AuthState {
  user: User | null;
  token: string | null;
  status: AuthStatus;
  error: string | null;
}

interface AuthActions {
  /** 登录（用户名+密码）→ POST /api/auth/login；成功后存 token/user 并同步 axios 拦截器 token 源（localStorage） */
  login: (username: string, password: string) => Promise<void>;
  /** SSO 会话：用身份平台签发的 token+user 建立会话，并拉取权限集 */
  acceptSsoSession: (token: string, user: User) => Promise<void>;
  /** 登出：清除本地认证状态 */
  logout: () => void;
  /** 清除错误信息（不改变认证状态） */
  clearError: () => void;
}

export type AuthStore = AuthState & AuthActions;

function extractErrorMessage(err: unknown): string {
  const axiosErr = err as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  if (axiosErr.response?.data?.message) return axiosErr.response.data.message;
  if (axiosErr.message) return axiosErr.message;
  return "登录失败";
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      status: "idle",
      error: null,

      login: async (username, password) => {
        set({ status: "loading", error: null });
        try {
          // 委托身份端点：用户名密码登录走 orval authLogin（全局 axios 拦截器
          // 注入 baseURL；lab 不持有用户密码、改密归 saas，M01.F03.I04 已废弃）。
          const { token, user } = await authLogin({ username, password });
          set({
            user: { ...user, permissions: [] },
            token,
            status: "authenticated",
            error: null,
          });
        } catch (err) {
          set({
            user: null,
            token: null,
            status: "error",
            error: extractErrorMessage(err),
          });
        }
      },

      // @entry M01.F05.I04
      //   SSO 回调（/login?code=&state=）拿到 token+user 后建会话：写 token，
      //   拉 /auth/permissions 拿权限集并入 user，标记 authenticated。
      acceptSsoSession: async (token, user) => {
        try {
          const resp = await authGetPermissions();
          const permissions = resp.permissions ?? user.permissions;
          set({
            user: { ...user, permissions },
            token,
            status: "authenticated",
            error: null,
          });
        } catch {
          set({ user, token, status: "authenticated", error: null });
        }
      },

      logout: () => {
        set({ user: null, token: null, status: "idle", error: null });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "lab-auth",
      // 仅持久化 token 与 user（status/error 不持久化，每次进入为 idle）
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
);
