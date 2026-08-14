import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthState } from '@/types/store'
import type { User } from '@/types/api'
import { identityClient, setToken, API_ROUTES } from '@/api/legacy-client'

interface AuthActions {
  /** 登录（用户名+密码）→ POST saas /auth/login（同 SSO 同源）；成功后存 token/user 并同步 apiClient */
  login: (username: string, password: string) => Promise<void>
  /** SSO 会话：用身份平台签发的 token+user 建立会话，并拉取权限集 */
  acceptSsoSession: (token: string, user: User) => Promise<void>
  /** 登出：清除本地认证状态 */
  logout: () => void
  /** 清除错误信息（不改变认证状态） */
  clearError: () => void
}

export type AuthStore = AuthState & AuthActions

function extractErrorMessage(err: unknown): string {
  const axiosErr = err as {
    response?: { data?: { message?: string } }
    message?: string
  }
  if (axiosErr.response?.data?.message) return axiosErr.response.data.message
  if (axiosErr.message) return axiosErr.message
  return '登录失败'
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      status: 'idle',
      error: null,

      login: async (username, password) => {
        set({ status: 'loading', error: null })
        try {
          // 委托 saas 身份平台：用户名密码登录走 identityClient（同 SSO 同源），
          // lab 不持有用户密码、改密归 saas（M01.F03.I04 已废弃）。
          const res = await identityClient.post<{ token: string; user: User }>(
            API_ROUTES['/auth/login'],
            { username, password },
          )
          const { token, user } = res.data
          setToken(token)
          set({ user, token, status: 'authenticated', error: null })
        } catch (err) {
          setToken(null)
          set({
            user: null,
            token: null,
            status: 'error',
            error: extractErrorMessage(err),
          })
        }
      },

      acceptSsoSession: async (token, user) => {
        setToken(token)
        try {
          const res = await identityClient.get<{ permissions: string[] }>(
            API_ROUTES['/auth/permissions'],
            // saas v0.3.0.1 契约：租户键名从 orgId 改为 departmentId。
            // 同 tenantId 兼容读（payload.departmentId ?? payload.tenantId ?? payload.orgId），
            // 这里只负责发起请求，兼容读在 ssoClient/jwt 层处理。
            { params: { departmentId: 'org-lab-root' } },
          )
          const permissions = res.data.permissions ?? user.permissions
          set({
            user: { ...user, permissions },
            token,
            status: 'authenticated',
            error: null,
          })
        } catch {
          set({ user, token, status: 'authenticated', error: null })
        }
      },

      logout: () => {
        setToken(null)
        set({ user: null, token: null, status: 'idle', error: null })
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'lab-auth',
      // 仅持久化 token 与 user（status/error 不持久化，每次进入为 idle）
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
)
