// 运行时 env 必填 helper。ADR-0019 禁 env 默认值兜底。
//
// 业务身份/凭据类（SAAS_OAUTH_CLIENT_SECRET / LAB_SAAS_SERVICE_PASSWORD 等）缺失
// 必须抛 5xx。不抛 = 静默走 demo/dev 字面值，prod 业务错误被掩盖。
//
// 用法：
//   const idpUrl = requireEnv("SAAS_IDP_URL");
//   const clientId = requireEnv("SAAS_OAUTH_CLIENT_ID");
//
// 与 dev/CI 启动期校验配套：缺失即抛 → Next.js server route handler 会
// 立即返回 500；前端 axios interceptor 应把 5xx 提示「env 缺失，与运维对齐」。
//
// 空串 "" 视为「显式设空」（测试同源相对 URL 模式依赖此语义）。L0.no_fallback
// 锁的是「未设 = 字面」兜底，不锁「显式空串」。

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (v === undefined) {
    throw new Error(
      `${name} env is required (ADR-0019 禁字面默认值). ` +
        `Set via .env.local (dev) or GitHub Secrets → ci.yml envs (prod).`,
    );
  }
  return v;
}
