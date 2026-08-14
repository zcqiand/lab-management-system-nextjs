// REF import.meta.env.VITE_* → Next.js process.env.NEXT_PUBLIC_* 的唯一适配点。
export const env = {
  IDENTITY_BASE_URL: process.env.NEXT_PUBLIC_IDENTITY_BASE_URL || "/api",
  APP_ID: process.env.NEXT_PUBLIC_APP_ID || "app-lab",
  SSO_AUTHORIZE_URL: process.env.NEXT_PUBLIC_SSO_AUTHORIZE_URL || "/sso/authorize",
  OAUTH_SCOPES: process.env.NEXT_PUBLIC_OAUTH_SCOPES || "",
  USE_MSW: process.env.NEXT_PUBLIC_USE_MSW !== "false",
} as const;
